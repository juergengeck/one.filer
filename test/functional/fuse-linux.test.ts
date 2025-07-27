import { expect } from 'chai';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FUSE Linux Functional Tests', function() {
    this.timeout(60000); // 60 second timeout for functional tests
    
    const isLinux = os.platform() === 'linux';
    const isWSL = isLinux && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
    const testMountPoint = path.join(os.homedir(), 'one-filer-test-mount');
    const testDataDir = path.join(process.cwd(), 'test-data-fuse');
    const testSecret = 'test-secret-' + Date.now();
    
    let filerProcess: any = null;

    before(function() {
        if (!isLinux) {
            this.skip();
            return;
        }
        
        // Clean up any existing test data
        if (fs.existsSync(testDataDir)) {
            execSync(`rm -rf ${testDataDir}`);
        }
        
        // Create test mount point
        if (!fs.existsSync(testMountPoint)) {
            fs.mkdirSync(testMountPoint, { recursive: true });
        }
        
        // Initialize test instance
        console.log('Initializing test ONE.core instance...');
        execSync(`mkdir -p ${testDataDir}`);
        process.chdir(testDataDir);
        
        try {
            execSync(`npx one-core init --secret ${testSecret} create --username test@example.com --password test123`, {
                stdio: 'inherit'
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
                // Unmount if still mounted
                try {
                    execSync(`fusermount -u ${testMountPoint} 2>/dev/null || true`);
                } catch (e) {}
                
                // Clean up test data
                if (fs.existsSync(testDataDir)) {
                    execSync(`rm -rf ${testDataDir}`);
                }
                
                // Remove mount point
                if (fs.existsSync(testMountPoint)) {
                    fs.rmdirSync(testMountPoint);
                }
                
                done();
            }, 2000);
        } else {
            done();
        }
    });

    describe('Basic FUSE Operations', () => {
        it('should start one.filer with FUSE mount', function(done) {
            const configPath = path.join(process.cwd(), 'test-fuse-config.json');
            
            // Create test config
            const config = {
                directory: testDataDir,
                useFiler: true,
                filerConfig: {
                    mountPoint: testMountPoint,
                    fuseOptions: {
                        allow_other: true,
                        default_permissions: false
                    }
                }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            // Start one.filer
            console.log('Starting one.filer with FUSE...');
            filerProcess = spawn('npm', ['start', '--', 'start', '--secret', testSecret, '--config', configPath], {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            let output = '';
            filerProcess.stdout.on('data', (data: Buffer) => {
                output += data.toString();
                console.log('FILER:', data.toString().trim());
            });
            
            filerProcess.stderr.on('data', (data: Buffer) => {
                console.error('FILER ERROR:', data.toString().trim());
            });
            
            // Wait for mount to be ready
            const checkMount = setInterval(() => {
                try {
                    const mountInfo = execSync('mount | grep fuse', { encoding: 'utf8' });
                    if (mountInfo.includes(testMountPoint)) {
                        clearInterval(checkMount);
                        console.log('FUSE mount established successfully');
                        done();
                    }
                } catch (e) {
                    // Not mounted yet
                }
            }, 1000);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkMount);
                done(new Error('FUSE mount failed to establish'));
            }, 30000);
        });

        it('should verify mount point is accessible', function() {
            expect(fs.existsSync(testMountPoint)).to.be.true;
            
            // Check if it's actually a mount point
            const mountOutput = execSync('mountpoint ' + testMountPoint, { encoding: 'utf8' });
            expect(mountOutput).to.include('is a mountpoint');
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
            const testContent = 'Hello from FUSE test!\n';
            
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
            fs.appendFileSync(testFile, '\nAppended content');
            
            // Read and verify
            const content = fs.readFileSync(testFile, 'utf8');
            expect(content).to.equal('Initial content\nAppended content');
            
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
                    const content = `Content for file ${i}\n`.repeat(100);
                    
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

        it('should respect permissions', function() {
            if (!isWSL) {
                // Skip on non-WSL Linux where permissions might work differently
                this.skip();
                return;
            }
            
            const filesPath = path.join(testMountPoint, 'files');
            const testFile = path.join(filesPath, 'permissions-test.txt');
            
            // Create file
            fs.writeFileSync(testFile, 'Permission test');
            
            // Check default permissions
            const stats = fs.statSync(testFile);
            const mode = stats.mode & parseInt('777', 8);
            console.log('File permissions:', mode.toString(8));
            
            // Permissions should be readable
            expect(stats.mode & fs.constants.S_IRUSR).to.be.above(0);
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
    });
});