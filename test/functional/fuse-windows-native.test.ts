import { expect } from 'chai';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FUSE Windows Native Tests (ProjFS)', function() {
    this.timeout(60000); // 60 second timeout for functional tests
    
    const isWindows = os.platform() === 'win32';
    const testMountPoint = isWindows ? 'C:\\FuseTest' : path.join(os.homedir(), 'fuse-test');
    const testDataDir = path.join(process.cwd(), 'test-data-fuse-windows');
    const testSecret = 'test-secret-' + Date.now();
    
    let filerProcess: any = null;

    before(function() {
        if (!isWindows) {
            console.log('Skipping Windows FUSE tests on non-Windows platform');
            this.skip();
            return;
        }
        
        // Check if ProjFS is available
        try {
            execSync('where PrjFlt.dll', { stdio: 'ignore' });
        } catch (e) {
            console.log('ProjFS not available on this system');
            this.skip();
            return;
        }
        
        // Clean up any existing test data
        if (fs.existsSync(testDataDir)) {
            execSync(`rmdir /s /q "${testDataDir}"`, { shell: 'cmd' });
        }
        
        // Clean up mount point if it exists
        if (fs.existsSync(testMountPoint)) {
            try {
                fs.rmdirSync(testMountPoint, { recursive: true });
            } catch (e) {
                console.log('Could not remove mount point, it may be in use');
            }
        }
        
        // Initialize test instance
        console.log('Initializing test ONE.core instance...');
        fs.mkdirSync(testDataDir, { recursive: true });
        process.chdir(testDataDir);
        
        try {
            execSync(`npx one-core init --secret ${testSecret} create --username test@example.com --password test123`, {
                stdio: 'inherit',
                shell: 'cmd'
            });
        } catch (e) {
            console.log('Failed to initialize test instance:', e);
            throw e;
        }
        
        process.chdir(path.dirname(testDataDir));
    });

    after(function(done) {
        // Clean up
        if (filerProcess) {
            filerProcess.kill();
            setTimeout(() => {
                // Clean up test data
                if (fs.existsSync(testDataDir)) {
                    try {
                        execSync(`rmdir /s /q "${testDataDir}"`, { shell: 'cmd' });
                    } catch (e) {
                        console.log('Could not clean test data:', e);
                    }
                }
                
                // Remove mount point
                if (fs.existsSync(testMountPoint)) {
                    try {
                        fs.rmdirSync(testMountPoint, { recursive: true });
                    } catch (e) {
                        console.log('Could not remove mount point:', e);
                    }
                }
                
                done();
            }, 2000);
        } else {
            done();
        }
    });

    describe('Basic Windows FUSE Operations', () => {
        it('should start one.filer with Windows FUSE mount', function(done) {
            const configPath = path.join(process.cwd(), 'test-fuse-windows-config.json');
            
            // Create test config for Windows
            const config = {
                directory: testDataDir,
                useFiler: true,
                filerConfig: {
                    mountPoint: '/mnt/fuse-test', // Unix-style path
                    fuseOptions: {
                        projfs: {
                            virtualizationRootPath: testMountPoint,
                            poolThreadCount: 4,
                            enableNegativePathCache: true
                        }
                    }
                }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            // Start one.filer with Windows FUSE
            console.log('Starting one.filer with Windows FUSE (ProjFS)...');
            filerProcess = spawn('npm', ['start', '--', 'start', '--secret', testSecret, '--config', configPath], {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true
            });
            
            let output = '';
            filerProcess.stdout.on('data', (data: Buffer) => {
                output += data.toString();
                console.log('FILER:', data.toString().trim());
                
                // Look for successful mount message
                if (output.includes('Windows FUSE3 filesystem mounted') || 
                    output.includes('ProjFS provider started successfully')) {
                    console.log('Windows FUSE mount established successfully');
                    // Give it a moment to fully initialize
                    setTimeout(() => done(), 2000);
                }
            });
            
            filerProcess.stderr.on('data', (data: Buffer) => {
                console.error('FILER ERROR:', data.toString().trim());
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                done(new Error('Windows FUSE mount failed to establish'));
            }, 30000);
        });

        it('should verify mount point is accessible', function() {
            expect(fs.existsSync(testMountPoint)).to.be.true;
            
            // On Windows, check if it's a reparse point (ProjFS)
            const stats = fs.statSync(testMountPoint);
            expect(stats.isDirectory()).to.be.true;
        });

        it('should list root directories', function() {
            const dirs = fs.readdirSync(testMountPoint);
            console.log('Root directories:', dirs);
            
            expect(dirs).to.be.an('array');
            expect(dirs).to.include.members(['connections', 'files', 'objects']);
        });

        it('should read directory contents', function() {
            const connectionsPath = path.join(testMountPoint, 'connections');
            expect(fs.existsSync(connectionsPath)).to.be.true;
            
            const stats = fs.statSync(connectionsPath);
            expect(stats.isDirectory()).to.be.true;
            
            const contents = fs.readdirSync(connectionsPath);
            console.log('Connections directory:', contents);
            expect(contents).to.be.an('array');
        });

        it('should create and read files', function() {
            const filesPath = path.join(testMountPoint, 'files');
            const testFileName = 'test-file-' + Date.now() + '.txt';
            const testFilePath = path.join(filesPath, testFileName);
            const testContent = 'Hello from Windows FUSE test!\r\n';
            
            // Create file
            fs.writeFileSync(testFilePath, testContent);
            
            // Verify file exists
            expect(fs.existsSync(testFilePath)).to.be.true;
            
            // Read file back
            const readContent = fs.readFileSync(testFilePath, 'utf8');
            expect(readContent).to.equal(testContent);
            
            // Check file stats
            const stats = fs.statSync(testFilePath);
            expect(stats.isFile()).to.be.true;
            expect(stats.size).to.equal(testContent.length);
        });

        it('should handle file operations', function() {
            const filesPath = path.join(testMountPoint, 'files');
            const testFile = path.join(filesPath, 'operations-test.txt');
            
            // Write initial content
            fs.writeFileSync(testFile, 'Initial content');
            
            // Append content
            fs.appendFileSync(testFile, '\r\nAppended content');
            
            // Read and verify
            const content = fs.readFileSync(testFile, 'utf8');
            expect(content).to.equal('Initial content\r\nAppended content');
            
            // Rename file
            const newPath = path.join(filesPath, 'renamed-test.txt');
            fs.renameSync(testFile, newPath);
            
            expect(fs.existsSync(testFile)).to.be.false;
            expect(fs.existsSync(newPath)).to.be.true;
            
            // Delete file
            fs.unlinkSync(newPath);
            expect(fs.existsSync(newPath)).to.be.false;
        });

        it('should handle directory operations', function() {
            const filesPath = path.join(testMountPoint, 'files');
            const testDir = path.join(filesPath, 'test-directory');
            
            // Create directory
            fs.mkdirSync(testDir);
            expect(fs.existsSync(testDir)).to.be.true;
            
            const stats = fs.statSync(testDir);
            expect(stats.isDirectory()).to.be.true;
            
            // Create file in directory
            const fileInDir = path.join(testDir, 'file.txt');
            fs.writeFileSync(fileInDir, 'File in directory');
            
            // List directory
            const contents = fs.readdirSync(testDir);
            expect(contents).to.include('file.txt');
            
            // Remove file and directory
            fs.unlinkSync(fileInDir);
            fs.rmdirSync(testDir);
            expect(fs.existsSync(testDir)).to.be.false;
        });

        it('should handle large files', function() {
            this.timeout(30000);
            
            const filesPath = path.join(testMountPoint, 'files');
            const largeFile = path.join(filesPath, 'large-file.bin');
            
            // Create 10MB of random data
            const size = 10 * 1024 * 1024;
            const buffer = Buffer.alloc(size);
            for (let i = 0; i < size; i++) {
                buffer[i] = Math.floor(Math.random() * 256);
            }
            
            // Write large file
            fs.writeFileSync(largeFile, buffer);
            
            // Verify size
            const stats = fs.statSync(largeFile);
            expect(stats.size).to.equal(size);
            
            // Read back and verify
            const readBuffer = fs.readFileSync(largeFile);
            expect(readBuffer.length).to.equal(size);
            expect(Buffer.compare(buffer, readBuffer)).to.equal(0);
            
            // Clean up
            fs.unlinkSync(largeFile);
        });

        it('should handle concurrent operations', function(done) {
            const filesPath = path.join(testMountPoint, 'files');
            const promises: Promise<void>[] = [];
            
            // Create multiple files concurrently
            for (let i = 0; i < 10; i++) {
                const promise = new Promise<void>((resolve, reject) => {
                    const fileName = `concurrent-${i}.txt`;
                    const filePath = path.join(filesPath, fileName);
                    const content = `Content for file ${i}\r\n`.repeat(100);
                    
                    fs.writeFile(filePath, content, (err) => {
                        if (err) reject(err);
                        else {
                            // Read back to verify
                            fs.readFile(filePath, 'utf8', (err, data) => {
                                if (err) reject(err);
                                else if (data !== content) reject(new Error('Content mismatch'));
                                else resolve();
                            });
                        }
                    });
                });
                promises.push(promise);
            }
            
            Promise.all(promises)
                .then(() => done())
                .catch(done);
        });

        it('should handle Windows-specific paths', function() {
            const filesPath = path.join(testMountPoint, 'files');
            
            // Test with spaces in filename
            const spaceFile = path.join(filesPath, 'file with spaces.txt');
            fs.writeFileSync(spaceFile, 'Content with spaces');
            expect(fs.existsSync(spaceFile)).to.be.true;
            fs.unlinkSync(spaceFile);
            
            // Test with long filename
            const longName = 'a'.repeat(200) + '.txt';
            const longFile = path.join(filesPath, longName);
            fs.writeFileSync(longFile, 'Long filename test');
            expect(fs.existsSync(longFile)).to.be.true;
            fs.unlinkSync(longFile);
        });

        it('should integrate with Windows Explorer', function() {
            // This test verifies that files are visible in Windows Explorer
            // by using Windows commands
            
            const filesPath = path.join(testMountPoint, 'files');
            const explorerTestFile = path.join(filesPath, 'explorer-test.txt');
            
            // Create a file
            fs.writeFileSync(explorerTestFile, 'Windows Explorer test');
            
            // Use Windows DIR command to verify
            const dirOutput = execSync(`dir /b "${filesPath}"`, { 
                encoding: 'utf8',
                shell: 'cmd'
            });
            
            expect(dirOutput).to.include('explorer-test.txt');
            
            // Clean up
            fs.unlinkSync(explorerTestFile);
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent files gracefully', function() {
            const filesPath = path.join(testMountPoint, 'files');
            const nonExistent = path.join(filesPath, 'does-not-exist.txt');
            
            expect(() => {
                fs.readFileSync(nonExistent);
            }).to.throw(/ENOENT/);
        });

        it('should handle invalid operations', function() {
            const rootPath = testMountPoint;
            
            // Try to write to root (should fail)
            expect(() => {
                fs.writeFileSync(path.join(rootPath, 'invalid.txt'), 'test');
            }).to.throw();
        });

        it('should handle Windows-specific errors', function() {
            const filesPath = path.join(testMountPoint, 'files');
            
            // Test invalid characters in filename
            const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
            
            for (const char of invalidChars) {
                const invalidFile = path.join(filesPath, `invalid${char}file.txt`);
                expect(() => {
                    fs.writeFileSync(invalidFile, 'test');
                }).to.throw();
            }
        });
    });

    describe('Performance Tests', () => {
        it('should handle rapid file operations efficiently', function() {
            this.timeout(30000);
            
            const filesPath = path.join(testMountPoint, 'files');
            const perfDir = path.join(filesPath, 'performance-test');
            
            // Create test directory
            if (!fs.existsSync(perfDir)) {
                fs.mkdirSync(perfDir);
            }
            
            const startTime = Date.now();
            const fileCount = 100;
            
            // Create many small files
            for (let i = 0; i < fileCount; i++) {
                const filePath = path.join(perfDir, `perf-${i}.txt`);
                fs.writeFileSync(filePath, `Performance test file ${i}`);
            }
            
            // Read them all back
            for (let i = 0; i < fileCount; i++) {
                const filePath = path.join(perfDir, `perf-${i}.txt`);
                const content = fs.readFileSync(filePath, 'utf8');
                expect(content).to.equal(`Performance test file ${i}`);
            }
            
            // Clean up
            for (let i = 0; i < fileCount; i++) {
                const filePath = path.join(perfDir, `perf-${i}.txt`);
                fs.unlinkSync(filePath);
            }
            
            fs.rmdirSync(perfDir);
            
            const duration = Date.now() - startTime;
            console.log(`Performance test completed in ${duration}ms for ${fileCount * 3} operations`);
            expect(duration).to.be.below(30000); // Should complete within 30 seconds
        });
    });
});