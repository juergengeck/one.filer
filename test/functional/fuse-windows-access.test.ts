import { expect } from 'chai';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Windows Access to Linux FUSE Functional Tests', function() {
    this.timeout(120000); // 2 minute timeout for cross-platform tests
    
    const isWindows = os.platform() === 'win32';
    const isLinux = os.platform() === 'linux';
    const isWSL = isLinux && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
    
    // Test configuration
    const wslDistro = 'Ubuntu';
    const linuxMountPoint = '/home/gecko/one-filer-test-mount';
    const windowsDriveLetter = 'T'; // Use T: for test drive
    const testDataDir = '/home/gecko/one-filer-test-data';
    const testSecret = 'test-secret-' + Date.now();
    
    let filerProcess: any = null;

    before(function() {
        // This test suite requires either:
        // 1. Running on Windows with WSL available
        // 2. Running in WSL with Windows interop
        if (!isWindows && !isWSL) {
            this.skip();
            return;
        }
        
        console.log('Test environment:', {
            platform: os.platform(),
            isWindows,
            isWSL,
            isLinux
        });
    });

    after(function(done) {
        // Clean up
        if (filerProcess) {
            filerProcess.kill();
        }
        
        setTimeout(() => {
            // Unmount Windows drive
            if (isWindows) {
                try {
                    execSync(`net use ${windowsDriveLetter}: /delete /y`, { stdio: 'ignore' });
                } catch (e) {}
            }
            
            // Clean up WSL mount and data
            if (isWSL || isWindows) {
                const wslCommand = isWindows ? 'wsl -d Ubuntu --' : '';
                try {
                    execSync(`${wslCommand} fusermount -u ${linuxMountPoint} 2>/dev/null || true`);
                    execSync(`${wslCommand} rm -rf ${testDataDir}`);
                    execSync(`${wslCommand} rmdir ${linuxMountPoint} 2>/dev/null || true`);
                } catch (e) {}
            }
            
            done();
        }, 2000);
    });

    describe('WSL Setup and FUSE Mount', () => {
        it('should verify WSL is accessible', function() {
            if (isWindows) {
                // Check WSL is installed and Ubuntu distro exists
                const wslList = execSync('wsl -l -v', { encoding: 'utf8' });
                expect(wslList).to.include('Ubuntu');
                
                // Test basic WSL command
                const result = execSync('wsl -d Ubuntu -- echo "WSL OK"', { encoding: 'utf8' });
                expect(result.trim()).to.equal('WSL OK');
            } else if (isWSL) {
                // In WSL, check Windows interop
                const result = execSync('cmd.exe /c echo "Windows OK" 2>/dev/null || echo "No interop"', { encoding: 'utf8' });
                expect(result).to.not.include('No interop');
            }
        });

        it('should initialize and start one.filer in WSL', function(done) {
            this.timeout(60000);
            
            const wslExec = (cmd: string) => {
                if (isWindows) {
                    return execSync(`wsl -d Ubuntu -- bash -c "${cmd}"`, { encoding: 'utf8' });
                } else {
                    return execSync(cmd, { encoding: 'utf8' });
                }
            };
            
            // Initialize test instance in WSL
            console.log('Initializing test instance in WSL...');
            wslExec(`rm -rf ${testDataDir} && mkdir -p ${testDataDir}`);
            wslExec(`cd ${testDataDir} && npx one-core init --secret ${testSecret} create --username test@example.com --password test123`);
            
            // Create mount point
            wslExec(`mkdir -p ${linuxMountPoint}`);
            
            // Create config file
            const config = {
                directory: testDataDir,
                useFiler: true,
                filerConfig: {
                    mountPoint: linuxMountPoint,
                    fuseOptions: {
                        allow_other: true,
                        default_permissions: false
                    }
                }
            };
            
            const configPath = `${testDataDir}/test-config.json`;
            wslExec(`echo '${JSON.stringify(config, null, 2)}' > ${configPath}`);
            
            // Start one.filer in WSL
            console.log('Starting one.filer in WSL...');
            const startCommand = isWindows
                ? `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/juerg/source/one.filer && npm start -- start --secret ${testSecret} --config ${configPath} > ${testDataDir}/filer.log 2>&1 &"`
                : `cd ${process.cwd()} && nohup npm start -- start --secret ${testSecret} --config ${configPath} > ${testDataDir}/filer.log 2>&1 &`;
            
            if (isWindows) {
                // Start in new window for Windows
                filerProcess = spawn('cmd', ['/c', 'start', 'WSL one.filer', '/min', 'cmd', '/c', startCommand], {
                    detached: true,
                    stdio: 'ignore'
                });
            } else {
                execSync(startCommand);
            }
            
            // Wait for mount to be ready
            let attempts = 0;
            const checkMount = setInterval(() => {
                attempts++;
                try {
                    const mountCheck = wslExec(`mountpoint ${linuxMountPoint} && echo "MOUNTED" || echo "NOT_MOUNTED"`);
                    if (mountCheck.includes('MOUNTED')) {
                        clearInterval(checkMount);
                        console.log('FUSE mount established in WSL');
                        done();
                    }
                } catch (e) {
                    console.log(`Mount check attempt ${attempts} failed`);
                }
                
                if (attempts > 30) {
                    clearInterval(checkMount);
                    done(new Error('FUSE mount failed to establish in WSL'));
                }
            }, 1000);
        });
    });

    describe('Windows Access to WSL FUSE', () => {
        it('should access WSL filesystem from Windows', function() {
            if (!isWindows) {
                this.skip();
                return;
            }
            
            // Test both path formats
            const pathFormats = [
                `\\\\wsl$\\${wslDistro}${linuxMountPoint}`,
                `\\\\wsl.localhost\\${wslDistro}${linuxMountPoint}`
            ];
            
            let accessiblePath: string | null = null;
            for (const testPath of pathFormats) {
                try {
                    execSync(`dir "${testPath}" >nul 2>&1`);
                    accessiblePath = testPath;
                    console.log(`Successfully accessed WSL path: ${testPath}`);
                    break;
                } catch (e) {
                    console.log(`Failed to access: ${testPath}`);
                }
            }
            
            expect(accessiblePath).to.not.be.null;
        });

        it('should map WSL FUSE mount to Windows drive letter', function() {
            if (!isWindows) {
                this.skip();
                return;
            }
            
            // Remove any existing mapping
            try {
                execSync(`net use ${windowsDriveLetter}: /delete /y`, { stdio: 'ignore' });
            } catch (e) {}
            
            // Try to map the drive
            const pathFormats = [
                `\\\\wsl.localhost\\${wslDistro}${linuxMountPoint}`,
                `\\\\wsl$\\${wslDistro}${linuxMountPoint}`
            ];
            
            let mapped = false;
            for (const testPath of pathFormats) {
                try {
                    execSync(`net use ${windowsDriveLetter}: "${testPath}" /persistent:no`);
                    mapped = true;
                    console.log(`Successfully mapped ${testPath} to ${windowsDriveLetter}:`);
                    break;
                } catch (e) {
                    console.log(`Failed to map: ${testPath}`);
                }
            }
            
            expect(mapped).to.be.true;
            
            // Verify drive is accessible
            const driveList = execSync('net use', { encoding: 'utf8' });
            expect(driveList).to.include(`${windowsDriveLetter}:`);
        });

        it('should list FUSE directories from Windows', function() {
            if (!isWindows) {
                this.skip();
                return;
            }
            
            const dirOutput = execSync(`dir ${windowsDriveLetter}: /b`, { encoding: 'utf8' });
            const dirs = dirOutput.trim().split('\n').map(d => d.trim());
            
            console.log('Directories visible from Windows:', dirs);
            expect(dirs).to.include.members(['connections', 'files', 'objects']);
        });

        it('should read and write files from Windows', function() {
            if (!isWindows) {
                this.skip();
                return;
            }
            
            const testFileName = `test-from-windows-${Date.now()}.txt`;
            const testFilePath = `${windowsDriveLetter}:\\files\\${testFileName}`;
            const testContent = 'Hello from Windows!\r\nThis is a test file.';
            
            // Write file from Windows
            execSync(`echo ${testContent} > "${testFilePath}"`);
            
            // Verify file exists
            const exists = fs.existsSync(testFilePath);
            expect(exists).to.be.true;
            
            // Read file back
            const readContent = fs.readFileSync(testFilePath, 'utf8');
            expect(readContent).to.include('Hello from Windows');
            
            // Verify from WSL side
            const wslContent = execSync(`wsl -d Ubuntu -- cat ${linuxMountPoint}/files/${testFileName}`, { encoding: 'utf8' });
            expect(wslContent).to.include('Hello from Windows');
            
            // Delete file
            fs.unlinkSync(testFilePath);
            expect(fs.existsSync(testFilePath)).to.be.false;
        });

        it('should handle file operations from Windows Explorer', function() {
            if (!isWindows) {
                this.skip();
                return;
            }
            
            const testDir = `${windowsDriveLetter}:\\files\\windows-test-dir`;
            
            // Create directory
            execSync(`mkdir "${testDir}"`);
            expect(fs.existsSync(testDir)).to.be.true;
            
            // Create file in directory
            const filePath = path.join(testDir, 'test.txt');
            fs.writeFileSync(filePath, 'Test content from Windows');
            
            // Copy file
            const copyPath = path.join(testDir, 'test-copy.txt');
            execSync(`copy "${filePath}" "${copyPath}"`);
            expect(fs.existsSync(copyPath)).to.be.true;
            
            // Rename file
            const newPath = path.join(testDir, 'renamed.txt');
            execSync(`move "${copyPath}" "${newPath}"`);
            expect(fs.existsSync(copyPath)).to.be.false;
            expect(fs.existsSync(newPath)).to.be.true;
            
            // Clean up
            execSync(`rmdir /s /q "${testDir}"`);
            expect(fs.existsSync(testDir)).to.be.false;
        });

        it('should handle concurrent access from Windows and WSL', function(done) {
            const fileName = `concurrent-test-${Date.now()}.txt`;
            const promises: Promise<void>[] = [];
            
            // Write from Windows
            if (isWindows) {
                promises.push(new Promise((resolve, reject) => {
                    const winPath = `${windowsDriveLetter}:\\files\\${fileName}-windows`;
                    fs.writeFile(winPath, 'Written from Windows', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }));
            }
            
            // Write from WSL
            promises.push(new Promise((resolve, reject) => {
                const wslPath = `${linuxMountPoint}/files/${fileName}-wsl`;
                const wslWrite = isWindows
                    ? `wsl -d Ubuntu -- bash -c "echo 'Written from WSL' > ${wslPath}"`
                    : `echo 'Written from WSL' > ${wslPath}`;
                
                try {
                    execSync(wslWrite);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            }));
            
            Promise.all(promises)
                .then(() => {
                    // Verify both files exist
                    if (isWindows) {
                        const winFile = `${windowsDriveLetter}:\\files\\${fileName}-windows`;
                        const wslFile = `${windowsDriveLetter}:\\files\\${fileName}-wsl`;
                        
                        expect(fs.existsSync(winFile)).to.be.true;
                        expect(fs.existsSync(wslFile)).to.be.true;
                    }
                    done();
                })
                .catch(done);
        });

        it('should handle large file transfers between Windows and WSL', function() {
            if (!isWindows) {
                this.skip();
                return;
            }
            
            this.timeout(60000);
            
            const largeFileName = 'large-transfer-test.bin';
            const winPath = `${windowsDriveLetter}:\\files\\${largeFileName}`;
            
            // Create 5MB file from Windows
            const size = 5 * 1024 * 1024;
            const buffer = Buffer.alloc(size);
            for (let i = 0; i < size; i++) {
                buffer[i] = i % 256;
            }
            
            fs.writeFileSync(winPath, buffer);
            
            // Verify size from Windows
            const stats = fs.statSync(winPath);
            expect(stats.size).to.equal(size);
            
            // Verify from WSL
            const wslSize = execSync(`wsl -d Ubuntu -- stat -c%s ${linuxMountPoint}/files/${largeFileName}`, { encoding: 'utf8' });
            expect(parseInt(wslSize.trim())).to.equal(size);
            
            // Read back from Windows and verify content
            const readBuffer = fs.readFileSync(winPath);
            expect(Buffer.compare(buffer, readBuffer)).to.equal(0);
            
            // Clean up
            fs.unlinkSync(winPath);
        });
    });

    describe('Cross-Platform Compatibility', () => {
        it('should handle different line endings correctly', function() {
            const fileName = 'line-endings-test.txt';
            const content = 'Line 1\r\nLine 2\nLine 3\r\n';
            
            if (isWindows) {
                // Write from Windows
                const winPath = `${windowsDriveLetter}:\\files\\${fileName}`;
                fs.writeFileSync(winPath, content);
                
                // Read from WSL and check
                const wslContent = execSync(`wsl -d Ubuntu -- cat ${linuxMountPoint}/files/${fileName}`, { encoding: 'utf8' });
                expect(wslContent).to.include('Line 1');
                expect(wslContent).to.include('Line 2');
                expect(wslContent).to.include('Line 3');
            } else if (isWSL) {
                // Write from WSL
                const wslPath = `${linuxMountPoint}/files/${fileName}`;
                fs.writeFileSync(wslPath, content);
                
                // Content should be preserved
                const readContent = fs.readFileSync(wslPath, 'utf8');
                expect(readContent).to.equal(content);
            }
        });

        it('should handle special characters in filenames', function() {
            const specialNames = [
                'test with spaces.txt',
                'test-with-dashes.txt',
                'test_with_underscores.txt',
                'test.multiple.dots.txt'
            ];
            
            for (const name of specialNames) {
                if (isWindows) {
                    const winPath = `${windowsDriveLetter}:\\files\\${name}`;
                    fs.writeFileSync(winPath, 'test');
                    expect(fs.existsSync(winPath)).to.be.true;
                    fs.unlinkSync(winPath);
                } else if (isWSL) {
                    const wslPath = `${linuxMountPoint}/files/${name}`;
                    fs.writeFileSync(wslPath, 'test');
                    expect(fs.existsSync(wslPath)).to.be.true;
                    fs.unlinkSync(wslPath);
                }
            }
        });
    });

    describe('Performance Tests', () => {
        it('should measure file operation latency from Windows', function() {
            if (!isWindows) {
                this.skip();
                return;
            }
            
            const iterations = 100;
            const fileName = 'latency-test.txt';
            const filePath = `${windowsDriveLetter}:\\files\\${fileName}`;
            
            // Measure write latency
            const writeStart = Date.now();
            for (let i = 0; i < iterations; i++) {
                fs.writeFileSync(filePath, `Iteration ${i}`);
            }
            const writeTime = Date.now() - writeStart;
            const avgWriteLatency = writeTime / iterations;
            
            console.log(`Average write latency: ${avgWriteLatency.toFixed(2)}ms`);
            expect(avgWriteLatency).to.be.below(100); // Should be under 100ms
            
            // Measure read latency
            const readStart = Date.now();
            for (let i = 0; i < iterations; i++) {
                fs.readFileSync(filePath);
            }
            const readTime = Date.now() - readStart;
            const avgReadLatency = readTime / iterations;
            
            console.log(`Average read latency: ${avgReadLatency.toFixed(2)}ms`);
            expect(avgReadLatency).to.be.below(50); // Reads should be faster
            
            // Clean up
            fs.unlinkSync(filePath);
        });
    });
});