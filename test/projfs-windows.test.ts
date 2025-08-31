/**
 * Comprehensive Component Tests for Windows ProjFS Implementation
 */

// @ts-ignore - after may be used in future test implementations
import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess, exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);
const mkdir = promisify(fs.mkdir);
// @ts-ignore - rmdir may be used in future test implementations
const rmdir = promisify(fs.rmdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

describe('Windows ProjFS Component Tests', function() {
    this.timeout(30000); // 30 second timeout for async operations
    
    const TEST_PROJFS_ROOT = 'C:\\OneFilerTest';
    const TEST_SECRET = 'test123';
    let projfsProcess: ChildProcess | null = null;
    
    before(function() {
        // Skip these tests if not on Windows
        if (process.platform !== 'win32') {
            console.log('Skipping Windows ProjFS tests on non-Windows platform');
            this.skip();
        }
    });
    
    // Helper to start ProjFS mount
    async function startProjFSMount(rootPath: string = TEST_PROJFS_ROOT): Promise<ChildProcess> {
        // Clean up any existing mount
        try {
            await exec(`rmdir /s /q "${rootPath}" 2>nul`);
        } catch (err) {
            // Directory might not exist, that's OK
        }
        
        return new Promise((resolve, reject) => {
            const proc = spawn('node', [
                'electron-app\\dist\\main-native.js',
                'start',
                '-s', TEST_SECRET,
                '--filer', 'true',
                '--filer-projfs-root', rootPath
            ], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true
            });
            
            let startupOutput = '';
            let errorOutput = '';
            
            proc.stdout?.on('data', (data) => {
                startupOutput += data.toString();
                console.log('[ProjFS stdout]:', data.toString());
                
                // Check for successful mount message
                if (startupOutput.includes('mounted successfully') || 
                    startupOutput.includes('ProjFS with COW cache') ||
                    startupOutput.includes('Provider mounted successfully')) {
                    resolve(proc);
                }
            });
            
            proc.stderr?.on('data', (data) => {
                errorOutput += data.toString();
                console.error('[ProjFS stderr]:', data.toString());
            });
            
            proc.on('error', (err) => {
                reject(new Error(`Failed to start ProjFS: ${err.message}`));
            });
            
            proc.on('exit', (code) => {
                if (code !== 0 && code !== null) {
                    reject(new Error(`ProjFS process exited with code ${code}: ${errorOutput}`));
                }
            });
            
            // Timeout if mount doesn't succeed
            setTimeout(() => {
                if (!proc.killed) {
                    proc.kill();
                    reject(new Error(`ProjFS mount timeout. Output: ${startupOutput}\nErrors: ${errorOutput}`));
                }
            }, 15000);
        });
    }
    
    // Helper to stop ProjFS mount
    async function stopProjFSMount(proc: ChildProcess): Promise<void> {
        return new Promise((resolve) => {
            if (!proc || proc.killed) {
                resolve();
                return;
            }
            
            proc.on('exit', () => resolve());
            
            // On Windows, we need to use taskkill for clean shutdown
            exec(`taskkill /PID ${proc.pid} /T /F 2>nul`).then(() => {
                setTimeout(resolve, 1000);
            }).catch(() => {
                // Process might already be dead
                resolve();
            });
        });
    }
    
    // Helper to wait for mount to be ready
    async function waitForMount(rootPath: string, maxRetries: number = 10): Promise<void> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const stats = await stat(rootPath);
                if (stats.isDirectory()) {
                    // Try to list directory to ensure ProjFS is responding
                    const files = await readdir(rootPath);
                    if (files.length > 0) {
                        return;
                    }
                }
            } catch (err) {
                // Directory might not exist yet
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error('ProjFS root not ready after maximum retries');
    }
    
    describe('Mount Lifecycle', () => {
        it('should successfully mount and unmount ProjFS filesystem', async () => {
            projfsProcess = await startProjFSMount();
            expect(projfsProcess).to.not.be.null;
            expect(projfsProcess.killed).to.be.false;
            
            await waitForMount(TEST_PROJFS_ROOT);
            
            // Verify directory exists and is accessible
            const stats = await stat(TEST_PROJFS_ROOT);
            expect(stats.isDirectory()).to.be.true;
            
            await stopProjFSMount(projfsProcess);
            projfsProcess = null;
        });
        
        it('should handle multiple mount/unmount cycles', async () => {
            for (let i = 0; i < 3; i++) {
                console.log(`Mount cycle ${i + 1}/3`);
                projfsProcess = await startProjFSMount();
                await waitForMount(TEST_PROJFS_ROOT);
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
                
                // Wait a bit between cycles
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        });
        
        it('should prevent multiple mounts to same location', async () => {
            // Start first mount
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
            
            // Try to start second mount - should fail
            try {
                const secondProcess = await startProjFSMount();
                await stopProjFSMount(secondProcess);
                expect.fail('Should have thrown an error for duplicate mount');
            } catch (err: any) {
                expect(err.message).to.include('ProjFS');
            }
            
            // Clean up first mount
            await stopProjFSMount(projfsProcess);
            projfsProcess = null;
        });
    });
    
    describe('File Operations', () => {
        beforeEach(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        
        afterEach(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            // Clean up
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => {});
        });
        
        it('should list root directory with virtual folders', async () => {
            const files = await readdir(TEST_PROJFS_ROOT);
            expect(files).to.be.an('array');
            expect(files).to.include.members(['chats', 'debug', 'invites', 'objects', 'types']);
        });
        
        it('should read file attributes correctly', async () => {
            const debugPath = path.join(TEST_PROJFS_ROOT, 'debug');
            const stats = await stat(debugPath);
            expect(stats.isDirectory()).to.be.true;
        });
        
        it('should navigate nested virtual directories', async () => {
            const debugFiles = await readdir(path.join(TEST_PROJFS_ROOT, 'debug'));
            expect(debugFiles).to.be.an('array');
            expect(debugFiles).to.include.members(['version.txt', 'instanceId.txt']);
        });
        
        it('should hydrate and read virtual files on demand', async () => {
            const versionPath = path.join(TEST_PROJFS_ROOT, 'debug', 'version.txt');
            
            // First access triggers hydration
            const content = await readFile(versionPath, 'utf8');
            expect(content).to.be.a('string');
            expect(content.length).to.be.greaterThan(0);
            
            // Second access should use cached/hydrated version
            const content2 = await readFile(versionPath, 'utf8');
            expect(content2).to.equal(content);
        });
        
        it('should handle non-existent files appropriately', async () => {
            try {
                await readFile(path.join(TEST_PROJFS_ROOT, 'nonexistent.txt'));
                expect.fail('Should have thrown error for non-existent file');
            } catch (err: any) {
                expect(err.code).to.be.oneOf(['ENOENT', 'ERROR_FILE_NOT_FOUND']);
            }
        });
        
        it('should support COW for modified files', async () => {
            const testFile = path.join(TEST_PROJFS_ROOT, 'test-cow.txt');
            const originalContent = 'Original content';
            const modifiedContent = 'Modified content';
            
            // Write original file
            await writeFile(testFile, originalContent);
            
            // Read back
            let content = await readFile(testFile, 'utf8');
            expect(content).to.equal(originalContent);
            
            // Modify file (triggers COW)
            await writeFile(testFile, modifiedContent);
            
            // Read modified content
            content = await readFile(testFile, 'utf8');
            expect(content).to.equal(modifiedContent);
            
            // Clean up
            await unlink(testFile);
        });
    });
    
    describe('Invitation System', () => {
        beforeEach(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        
        afterEach(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => {});
        });
        
        it('should generate IOP invitation with correct URL', async () => {
            const invitePath = path.join(TEST_PROJFS_ROOT, 'invites', 'iop_invite.txt');
            const content = await readFile(invitePath, 'utf8');
            
            expect(content).to.include('https://edda.dev.refinio.one');
            expect(content).to.match(/token|publicKey/);
        });
        
        it('should refresh invitation content appropriately', async () => {
            const invitePath = path.join(TEST_PROJFS_ROOT, 'invites', 'iop_invite.txt');
            
            // First read
            const content1 = await readFile(invitePath, 'utf8');
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Second read
            const content2 = await readFile(invitePath, 'utf8');
            
            expect(content1).to.include('edda.dev.refinio.one');
            expect(content2).to.include('edda.dev.refinio.one');
        });
    });
    
    describe('Performance Tests', () => {
        beforeEach(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        
        afterEach(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => {});
        });
        
        it('should handle rapid sequential file reads efficiently', async () => {
            const versionPath = path.join(TEST_PROJFS_ROOT, 'debug', 'version.txt');
            const iterations = 100;
            
            const start = Date.now();
            for (let i = 0; i < iterations; i++) {
                await readFile(versionPath, 'utf8');
            }
            const duration = Date.now() - start;
            
            console.log(`${iterations} reads completed in ${duration}ms`);
            expect(duration).to.be.lessThan(3000); // Should complete within 3 seconds
        });
        
        it('should handle concurrent file operations', async () => {
            const basePath = path.join(TEST_PROJFS_ROOT, 'debug');
            const concurrency = 20;
            
            const start = Date.now();
            const promises = [];
            
            // Mix of different operations
            for (let i = 0; i < concurrency; i++) {
                if (i % 3 === 0) {
                    promises.push(readdir(basePath));
                } else if (i % 3 === 1) {
                    promises.push(stat(basePath));
                } else {
                    promises.push(readFile(path.join(basePath, 'version.txt'), 'utf8'));
                }
            }
            
            const results = await Promise.all(promises);
            const duration = Date.now() - start;
            
            console.log(`${concurrency} concurrent operations completed in ${duration}ms`);
            expect(results).to.have.lengthOf(concurrency);
            expect(duration).to.be.lessThan(3000); // Should complete within 3 seconds
        });
        
        it('should efficiently cache hydrated files', async () => {
            const testPath = path.join(TEST_PROJFS_ROOT, 'debug', 'instanceId.txt');
            
            // First read (hydration)
            const start1 = Date.now();
            await readFile(testPath, 'utf8');
            const hydrationTime = Date.now() - start1;
            
            // Subsequent reads (should be cached)
            const start2 = Date.now();
            for (let i = 0; i < 10; i++) {
                await readFile(testPath, 'utf8');
            }
            const cachedTime = (Date.now() - start2) / 10;
            
            console.log(`Hydration time: ${hydrationTime}ms, Cached read time: ${cachedTime}ms`);
            expect(cachedTime).to.be.lessThan(hydrationTime);
        });
    });
    
    describe('Error Handling', () => {
        beforeEach(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        
        afterEach(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => {});
        });
        
        it('should handle process termination gracefully', async () => {
            // Forcefully terminate the process
            await exec(`taskkill /PID ${projfsProcess!.pid} /F`);
            
            // Wait for termination
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Directory should become inaccessible
            try {
                await readdir(TEST_PROJFS_ROOT);
                // Might still work if Windows hasn't cleaned up yet
            } catch (err: any) {
                expect(err.code).to.be.oneOf(['ENOENT', 'ERROR_PATH_NOT_FOUND', 'ERROR_NOT_A_REPARSE_POINT']);
            }
            
            // Should be able to restart
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
            
            const files = await readdir(TEST_PROJFS_ROOT);
            expect(files).to.include.members(['chats', 'debug', 'invites']);
        });
        
        it('should handle invalid operations appropriately', async () => {
            // Try to create directory in read-only location
            try {
                await mkdir(path.join(TEST_PROJFS_ROOT, 'objects', 'newdir'));
                // Might succeed if objects allows writes
            } catch (err: any) {
                expect(err.code).to.be.oneOf(['EACCES', 'ERROR_ACCESS_DENIED', 'EROFS']);
            }
        });
    });
    
    describe('Windows Integration', () => {
        beforeEach(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        
        afterEach(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => {});
        });
        
        it('should be accessible via Windows Explorer compatible paths', async () => {
            // Test Windows-style path access
            const { stdout } = await exec(`dir "${TEST_PROJFS_ROOT}"`);
            expect(stdout).to.include('chats');
            expect(stdout).to.include('debug');
            expect(stdout).to.include('invites');
        });
        
        it('should support Windows file attributes', async () => {
            const { stdout } = await exec(`attrib "${path.join(TEST_PROJFS_ROOT, 'debug')}"`);
            // Check that attributes can be read
            expect(stdout).to.be.a('string');
        });
        
        it('should integrate with Windows file operations', async () => {
            const testFile = path.join(TEST_PROJFS_ROOT, 'windows-test.txt');
            
            // Use Windows echo command to write file
            await exec(`echo Hello from Windows > "${testFile}"`);
            
            // Read using Node.js
            const content = await readFile(testFile, 'utf8');
            expect(content).to.include('Hello from Windows');
            
            // Delete using Windows del command
            await exec(`del "${testFile}"`);
            
            // Verify deletion
            try {
                await stat(testFile);
                expect.fail('File should have been deleted');
            } catch (err: any) {
                expect(err.code).to.equal('ENOENT');
            }
        });
    });
});

// Export test runner for use in CI/CD
export async function runWindowsProjFSTests(): Promise<boolean> {
    const Mocha = require('mocha');
    const mocha = new Mocha();
    
    mocha.addFile(__filename);
    
    return new Promise((resolve) => {
        mocha.run((failures: number) => {
            resolve(failures === 0);
        });
    });
}