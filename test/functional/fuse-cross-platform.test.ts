import { expect } from 'chai';
import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Cross-platform FUSE tests that run on both Linux (native FUSE) and Windows (ProjFS)
 */
describe('Cross-Platform FUSE Tests', function() {
    this.timeout(60000); // 60 second timeout for functional tests
    
    const platform = os.platform();
    const isWindows = platform === 'win32';
    const isLinux = platform === 'linux';
    const isWSL = isLinux && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
    
    // Platform-specific configuration
    const config = {
        mountPoint: isWindows ? 'C:\\FuseXPlatTest' : path.join(os.homedir(), 'fuse-xplat-test'),
        dataDir: path.join(process.cwd(), `test-data-fuse-${platform}`),
        shell: isWindows ? 'cmd' : 'bash',
        pathSep: isWindows ? '\\' : '/',
        lineEnding: isWindows ? '\r\n' : '\n',
        rmCommand: isWindows ? 'rmdir /s /q' : 'rm -rf'
    };
    
    const testSecret = 'test-secret-' + Date.now();
    let filerProcess: ChildProcess | null = null;

    // Helper to normalize paths for the current platform
    function normalizePath(p: string): string {
        return isWindows ? p.replace(/\//g, '\\') : p.replace(/\\/g, '/');
    }

    before(function() {
        if (!isLinux && !isWindows) {
            console.log(`Platform ${platform} not supported for FUSE tests`);
            this.skip();
            return;
        }
        
        // Platform-specific checks
        if (isWindows) {
            try {
                execSync('where PrjFlt.dll', { stdio: 'ignore' });
            } catch (e) {
                console.log('ProjFS not available on Windows');
                this.skip();
                return;
            }
        } else if (isLinux) {
            try {
                execSync('which fusermount', { stdio: 'ignore' });
            } catch (e) {
                console.log('FUSE not available on Linux');
                this.skip();
                return;
            }
        }
        
        // Clean up any existing test data
        if (fs.existsSync(config.dataDir)) {
            execSync(`${config.rmCommand} "${config.dataDir}"`, { shell: config.shell });
        }
        
        // Clean up mount point if it exists
        if (fs.existsSync(config.mountPoint)) {
            try {
                if (isLinux) {
                    execSync(`fusermount -u ${config.mountPoint} 2>/dev/null || true`);
                }
                fs.rmdirSync(config.mountPoint, { recursive: true });
            } catch (e) {
                console.log('Could not remove mount point, it may be in use');
            }
        }
        
        // Initialize test instance
        console.log('Initializing test ONE.core instance...');
        fs.mkdirSync(config.dataDir, { recursive: true });
        
        const cwd = process.cwd();
        process.chdir(config.dataDir);
        
        try {
            execSync(
                `npx one-core init --secret ${testSecret} create --username test@example.com --password test123`,
                { stdio: 'inherit', shell: config.shell }
            );
        } catch (e) {
            console.log('Failed to initialize test instance:', e);
            throw e;
        } finally {
            process.chdir(cwd);
        }
    });

    after(function(done) {
        // Clean up
        if (filerProcess) {
            filerProcess.kill();
            setTimeout(() => {
                // Platform-specific unmount
                if (isLinux && fs.existsSync(config.mountPoint)) {
                    try {
                        execSync(`fusermount -u ${config.mountPoint} 2>/dev/null || true`);
                    } catch (e) {}
                }
                
                // Clean up test data
                if (fs.existsSync(config.dataDir)) {
                    try {
                        execSync(`${config.rmCommand} "${config.dataDir}"`, { shell: config.shell });
                    } catch (e) {
                        console.log('Could not clean test data:', e);
                    }
                }
                
                // Remove mount point
                if (fs.existsSync(config.mountPoint)) {
                    try {
                        fs.rmdirSync(config.mountPoint, { recursive: true });
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

    describe('FUSE Mount and Basic Operations', () => {
        it('should start one.filer with platform-appropriate FUSE', function(done) {
            const configPath = path.join(process.cwd(), `test-fuse-${platform}-config.json`);
            
            // Create platform-specific config
            const filerConfig: any = {
                directory: config.dataDir,
                useFiler: true,
                filerConfig: {
                    mountPoint: isWindows ? '/mnt/fuse-test' : config.mountPoint,
                    fuseOptions: {}
                }
            };
            
            // Add Windows-specific options
            if (isWindows) {
                filerConfig.filerConfig.fuseOptions.projfs = {
                    virtualizationRootPath: config.mountPoint,
                    poolThreadCount: 4,
                    enableNegativePathCache: true
                };
            } else {
                filerConfig.filerConfig.fuseOptions = {
                    allow_other: true,
                    default_permissions: false
                };
            }
            
            fs.writeFileSync(configPath, JSON.stringify(filerConfig, null, 2));
            
            // Start one.filer
            console.log(`Starting one.filer with ${isWindows ? 'Windows' : 'Linux'} FUSE...`);
            filerProcess = spawn('npm', ['start', '--', 'start', '--secret', testSecret, '--config', configPath], {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: isWindows
            });
            
            let output = '';
            let errorOutput = '';
            
            filerProcess.stdout!.on('data', (data: Buffer) => {
                output += data.toString();
                console.log('FILER:', data.toString().trim());
            });
            
            filerProcess.stderr!.on('data', (data: Buffer) => {
                errorOutput += data.toString();
                console.error('FILER ERROR:', data.toString().trim());
            });
            
            // Platform-specific mount detection
            const checkMount = () => {
                if (isWindows) {
                    // Windows: Check for success messages
                    if (output.includes('Windows FUSE3 filesystem mounted') || 
                        output.includes('ProjFS provider started successfully')) {
                        console.log('Windows FUSE mount established');
                        setTimeout(() => done(), 2000);
                        return true;
                    }
                } else {
                    // Linux: Check mount command
                    try {
                        const mountInfo = execSync('mount | grep fuse', { encoding: 'utf8' });
                        if (mountInfo.includes(config.mountPoint)) {
                            console.log('Linux FUSE mount established');
                            done();
                            return true;
                        }
                    } catch (e) {}
                }
                return false;
            };
            
            // Check for mount periodically
            const interval = setInterval(() => {
                if (checkMount()) {
                    clearInterval(interval);
                }
            }, 1000);
            
            // Timeout
            setTimeout(() => {
                clearInterval(interval);
                console.log('Mount timeout - Output:', output);
                console.log('Mount timeout - Errors:', errorOutput);
                done(new Error(`${platform} FUSE mount failed to establish`));
            }, 30000);
        });

        it('should verify mount point is accessible', function() {
            expect(fs.existsSync(config.mountPoint)).to.be.true;
            
            const stats = fs.statSync(config.mountPoint);
            expect(stats.isDirectory()).to.be.true;
            
            if (isLinux) {
                const mountOutput = execSync(`mountpoint "${config.mountPoint}" || echo "not mounted"`, { 
                    encoding: 'utf8' 
                });
                expect(mountOutput).to.not.include('not mounted');
            }
        });

        it('should list root directories consistently', function() {
            const dirs = fs.readdirSync(config.mountPoint);
            console.log('Root directories:', dirs);
            
            expect(dirs).to.be.an('array');
            expect(dirs).to.include.members(['connections', 'files', 'objects']);
        });

        it('should handle basic file operations', function() {
            const filesPath = path.join(config.mountPoint, 'files');
            const testFileName = `test-${platform}-${Date.now()}.txt`;
            const testFilePath = path.join(filesPath, testFileName);
            const testContent = `Hello from ${platform} FUSE!${config.lineEnding}`;
            
            // Create
            fs.writeFileSync(testFilePath, testContent);
            expect(fs.existsSync(testFilePath)).to.be.true;
            
            // Read
            const readContent = fs.readFileSync(testFilePath, 'utf8');
            expect(readContent).to.equal(testContent);
            
            // Update
            const newContent = testContent + `Updated on ${platform}${config.lineEnding}`;
            fs.writeFileSync(testFilePath, newContent);
            const updatedContent = fs.readFileSync(testFilePath, 'utf8');
            expect(updatedContent).to.equal(newContent);
            
            // Delete
            fs.unlinkSync(testFilePath);
            expect(fs.existsSync(testFilePath)).to.be.false;
        });

        it('should handle directory operations', function() {
            const filesPath = path.join(config.mountPoint, 'files');
            const testDirName = `test-dir-${platform}-${Date.now()}`;
            const testDir = path.join(filesPath, testDirName);
            
            // Create directory
            fs.mkdirSync(testDir);
            expect(fs.existsSync(testDir)).to.be.true;
            expect(fs.statSync(testDir).isDirectory()).to.be.true;
            
            // Create nested structure
            const nestedDir = path.join(testDir, 'nested', 'deep');
            fs.mkdirSync(nestedDir, { recursive: true });
            expect(fs.existsSync(nestedDir)).to.be.true;
            
            // Create files in directories
            const file1 = path.join(testDir, 'file1.txt');
            const file2 = path.join(nestedDir, 'file2.txt');
            
            fs.writeFileSync(file1, 'File 1 content');
            fs.writeFileSync(file2, 'File 2 content');
            
            // List directory recursively
            const listDir = (dir: string): string[] => {
                const items: string[] = [];
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    items.push(fullPath);
                    if (entry.isDirectory()) {
                        items.push(...listDir(fullPath));
                    }
                }
                
                return items;
            };
            
            const allItems = listDir(testDir);
            expect(allItems.length).to.be.at.least(4); // At least 2 dirs + 2 files
            
            // Clean up
            fs.unlinkSync(file2);
            fs.unlinkSync(file1);
            fs.rmdirSync(nestedDir);
            fs.rmdirSync(path.dirname(nestedDir));
            fs.rmdirSync(testDir);
            expect(fs.existsSync(testDir)).to.be.false;
        });

        it('should handle large files efficiently', function() {
            this.timeout(30000);
            
            const filesPath = path.join(config.mountPoint, 'files');
            const largeFile = path.join(filesPath, `large-${platform}.bin`);
            
            // Create 5MB file
            const size = 5 * 1024 * 1024;
            const chunks = 1024; // Write in 5KB chunks
            const chunkSize = size / chunks;
            
            // Write file in chunks
            const writeStream = fs.createWriteStream(largeFile);
            
            return new Promise<void>((resolve, reject) => {
                let written = 0;
                
                function writeChunk() {
                    const chunk = Buffer.alloc(chunkSize);
                    for (let i = 0; i < chunkSize; i++) {
                        chunk[i] = (written + i) % 256;
                    }
                    
                    if (written < size) {
                        writeStream.write(chunk, (err) => {
                            if (err) reject(err);
                            else {
                                written += chunkSize;
                                writeChunk();
                            }
                        });
                    } else {
                        writeStream.end(() => {
                            // Verify file
                            const stats = fs.statSync(largeFile);
                            expect(stats.size).to.equal(size);
                            
                            // Read and verify a sample
                            const fd = fs.openSync(largeFile, 'r');
                            const sampleBuffer = Buffer.alloc(1024);
                            fs.readSync(fd, sampleBuffer, 0, 1024, 1024 * 1024); // Read 1KB at 1MB offset
                            fs.closeSync(fd);
                            
                            // Verify sample content
                            for (let i = 0; i < 1024; i++) {
                                expect(sampleBuffer[i]).to.equal((1024 * 1024 + i) % 256);
                            }
                            
                            // Clean up
                            fs.unlinkSync(largeFile);
                            resolve();
                        });
                    }
                }
                
                writeChunk();
            });
        });

        it('should handle concurrent operations', function(done) {
            const filesPath = path.join(config.mountPoint, 'files');
            const concurrentDir = path.join(filesPath, `concurrent-${platform}`);
            
            if (!fs.existsSync(concurrentDir)) {
                fs.mkdirSync(concurrentDir);
            }
            
            const fileCount = 20;
            const operations: Promise<void>[] = [];
            
            // Concurrent writes
            for (let i = 0; i < fileCount; i++) {
                operations.push(new Promise<void>((resolve, reject) => {
                    const filePath = path.join(concurrentDir, `file-${i}.txt`);
                    const content = `Concurrent file ${i} on ${platform}${config.lineEnding}`.repeat(10);
                    
                    fs.writeFile(filePath, content, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }));
            }
            
            // Concurrent reads
            Promise.all(operations).then(() => {
                const readOps: Promise<void>[] = [];
                
                for (let i = 0; i < fileCount; i++) {
                    readOps.push(new Promise<void>((resolve, reject) => {
                        const filePath = path.join(concurrentDir, `file-${i}.txt`);
                        
                        fs.readFile(filePath, 'utf8', (err, data) => {
                            if (err) reject(err);
                            else {
                                const expected = `Concurrent file ${i} on ${platform}${config.lineEnding}`.repeat(10);
                                if (data !== expected) reject(new Error('Content mismatch'));
                                else resolve();
                            }
                        });
                    }));
                }
                
                return Promise.all(readOps);
            }).then(() => {
                // Clean up
                for (let i = 0; i < fileCount; i++) {
                    fs.unlinkSync(path.join(concurrentDir, `file-${i}.txt`));
                }
                fs.rmdirSync(concurrentDir);
                done();
            }).catch(done);
        });
    });

    describe('Platform-Specific Features', () => {
        if (isWindows) {
            it('should handle Windows-specific file attributes', function() {
                const filesPath = path.join(config.mountPoint, 'files');
                const attrFile = path.join(filesPath, 'attributes-test.txt');
                
                fs.writeFileSync(attrFile, 'Windows attributes test');
                
                // Check if we can read Windows attributes
                const stats = fs.statSync(attrFile);
                expect(stats).to.have.property('mode');
                
                // Test with Windows attrib command
                const attribOutput = execSync(`attrib "${attrFile}"`, { 
                    encoding: 'utf8',
                    shell: 'cmd'
                });
                console.log('Windows attributes:', attribOutput);
                
                fs.unlinkSync(attrFile);
            });
        }
        
        if (isLinux) {
            it('should handle Linux permissions', function() {
                const filesPath = path.join(config.mountPoint, 'files');
                const permFile = path.join(filesPath, 'permissions-test.txt');
                
                fs.writeFileSync(permFile, 'Linux permissions test');
                
                // Check permissions
                const stats = fs.statSync(permFile);
                const mode = (stats.mode & parseInt('777', 8)).toString(8);
                console.log('File permissions:', mode);
                
                expect(stats.mode & fs.constants.S_IRUSR).to.be.above(0);
                
                fs.unlinkSync(permFile);
            });
        }
    });

    describe('Error Handling', () => {
        it('should handle cross-platform errors consistently', function() {
            const filesPath = path.join(config.mountPoint, 'files');
            
            // Non-existent file
            expect(() => {
                fs.readFileSync(path.join(filesPath, 'does-not-exist.txt'));
            }).to.throw(/ENOENT/);
            
            // Invalid operations
            expect(() => {
                fs.writeFileSync(config.mountPoint, 'test'); // Write to directory
            }).to.throw();
            
            // Directory operations on files
            const tempFile = path.join(filesPath, 'temp.txt');
            fs.writeFileSync(tempFile, 'temp');
            
            expect(() => {
                fs.readdirSync(tempFile); // Read directory on file
            }).to.throw();
            
            fs.unlinkSync(tempFile);
        });
    });
});