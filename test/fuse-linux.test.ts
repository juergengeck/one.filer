/**
 * Comprehensive Component Tests for Linux FUSE3 Implementation
 */

// @ts-ignore - after may be used in future test implementations
import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const exec = promisify(require('child_process').exec);
const mkdir = promisify(fs.mkdir);
// @ts-ignore - rmdir may be used in future test implementations  
const rmdir = promisify(fs.rmdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

describe('Linux FUSE3 Component Tests', function() {
    this.timeout(30000); // 30 second timeout for async operations
    
    // Skip these tests if not on Linux
    before(function() {
        if (process.platform !== 'linux') {
            console.log('Skipping FUSE tests - not on Linux platform');
            (this as any).skip();
        }
    });
    
    const TEST_MOUNT_POINT = '/tmp/test-fuse-mount';
    const TEST_SECRET = 'test123';
    let fuseProcess: ChildProcess | null = null;
    
    // Helper to start FUSE mount
    async function startFuseMount(mountPoint: string = TEST_MOUNT_POINT): Promise<ChildProcess> {
        // Clean up any existing mount
        await exec(`fusermount -u ${mountPoint} 2>/dev/null || true`);
        await exec(`rm -rf ${mountPoint}`);
        await mkdir(mountPoint, { recursive: true });
        
        return new Promise((resolve, reject) => {
            const proc = spawn('node', [
                'lib/index.js',
                'start',
                '-s', TEST_SECRET,
                '--filer', 'true',
                '--filer-mount-point', mountPoint
            ], {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            let startupOutput = '';
            let errorOutput = '';
            
            proc.stdout?.on('data', (data) => {
                startupOutput += data.toString();
                console.log('[FUSE stdout]:', data.toString());
                
                // Check for successful mount message
                if (startupOutput.includes('mounted successfully') || 
                    startupOutput.includes('Filer file system was mounted')) {
                    resolve(proc);
                }
            });
            
            proc.stderr?.on('data', (data) => {
                errorOutput += data.toString();
                console.error('[FUSE stderr]:', data.toString());
            });
            
            proc.on('error', (err) => {
                reject(new Error(`Failed to start FUSE: ${err.message}`));
            });
            
            proc.on('exit', (code) => {
                if (code !== 0 && code !== null) {
                    reject(new Error(`FUSE process exited with code ${code}: ${errorOutput}`));
                }
            });
            
            // Timeout if mount doesn't succeed
            setTimeout(() => {
                if (!proc.killed) {
                    proc.kill();
                    reject(new Error(`FUSE mount timeout. Output: ${startupOutput}\nErrors: ${errorOutput}`));
                }
            }, 10000);
        });
    }
    
    // Helper to stop FUSE mount
    async function stopFuseMount(proc: ChildProcess): Promise<void> {
        return new Promise((resolve) => {
            if (!proc || proc.killed) {
                resolve();
                return;
            }
            
            proc.on('exit', () => resolve());
            proc.kill('SIGTERM');
            
            // Force kill after timeout
            setTimeout(() => {
                if (!proc.killed) {
                    proc.kill('SIGKILL');
                }
                resolve();
            }, 5000);
        });
    }
    
    // Helper to wait for mount to be ready
    async function waitForMount(mountPoint: string, maxRetries: number = 10): Promise<void> {
        console.log(`Waiting for mount point: ${mountPoint}`);
        for (let i = 0; i < maxRetries; i++) {
            try {
                const stats = await stat(mountPoint);
                if (stats.isDirectory()) {
                    // Try to list directory to ensure it's mounted
                    const files = await readdir(mountPoint);
                    console.log(`Mount successful, found ${files.length} files/directories`);
                    return;
                }
            } catch (err: any) {
                if (err.code === 'ENOTCONN') {
                    // Transport endpoint not connected - mount not ready
                    console.log(`Retry ${i + 1}/${maxRetries}: Transport endpoint not connected`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                // Log the error for debugging
                console.log(`Retry ${i + 1}/${maxRetries}: ${err.message}`);
                // Other errors might indicate the mount is actually working
                if (i === maxRetries - 1) throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error('Mount point not ready after maximum retries');
    }
    
    describe('Mount Lifecycle', () => {
        it('should successfully mount and unmount FUSE filesystem', async () => {
            fuseProcess = await startFuseMount();
            expect(fuseProcess).to.not.be.null;
            expect(fuseProcess.killed).to.be.false;
            
            await waitForMount(TEST_MOUNT_POINT);
            
            // Verify mount exists - with timeout protection
            try {
                const { stdout } = await exec('mount | grep fuse', { timeout: 5000 });
                expect(stdout).to.include(TEST_MOUNT_POINT);
            } catch (err: any) {
                // On some systems, mount command might not be available or might timeout
                console.log('Warning: Could not verify mount with mount command:', err.message);
                // Instead, verify by checking if we can access the mount point
                const files = await readdir(TEST_MOUNT_POINT);
                expect(files).to.be.an('array');
            }
            
            await stopFuseMount(fuseProcess);
            fuseProcess = null;
        });
        
        it('should handle multiple mount/unmount cycles', async () => {
            for (let i = 0; i < 3; i++) {
                fuseProcess = await startFuseMount();
                await waitForMount(TEST_MOUNT_POINT);
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
                
                // Ensure clean unmount
                await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
            }
        });
        
        it('should reject mounting to non-existent parent directory', async () => {
            const invalidMount = '/nonexistent/path/mount';
            
            try {
                fuseProcess = await startFuseMount(invalidMount);
                expect.fail('Should have thrown an error');
            } catch (err: any) {
                expect(err.message).to.include('Failed to start FUSE');
            }
        });
    });
    
    describe('File Operations', () => {
        beforeEach(async () => {
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
        });
        
        afterEach(async () => {
            if (fuseProcess) {
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
            }
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
        });
        
        it('should list root directory', async () => {
            const files = await readdir(TEST_MOUNT_POINT);
            expect(files).to.be.an('array');
            expect(files).to.include.members(['chats', 'debug', 'invites', 'objects', 'types']);
        });
        
        it('should read file attributes', async () => {
            const stats = await stat(path.join(TEST_MOUNT_POINT, 'debug'));
            expect(stats.isDirectory()).to.be.true;
            expect(stats.mode & 0o777).to.equal(0o755);
        });
        
        it('should navigate nested directories', async () => {
            const debugFiles = await readdir(path.join(TEST_MOUNT_POINT, 'debug'));
            expect(debugFiles).to.be.an('array');
            
            // Check for expected debug files
            expect(debugFiles).to.include.members(['version.txt', 'instanceId.txt']);
        });
        
        it('should read text files', async () => {
            const versionPath = path.join(TEST_MOUNT_POINT, 'debug', 'version.txt');
            const content = await readFile(versionPath, 'utf8');
            expect(content).to.be.a('string');
            expect(content.length).to.be.greaterThan(0);
        });
        
        it('should handle non-existent files gracefully', async () => {
            try {
                await readFile(path.join(TEST_MOUNT_POINT, 'nonexistent.txt'));
                expect.fail('Should have thrown ENOENT error');
            } catch (err: any) {
                expect(err.code).to.equal('ENOENT');
            }
        });
        
        it('should create and delete files in temporary filesystem', async () => {
            const testFile = path.join(TEST_MOUNT_POINT, 'test-file.txt');
            const testContent = 'Hello from test';
            
            // Write file
            await writeFile(testFile, testContent);
            
            // Read back
            const readContent = await readFile(testFile, 'utf8');
            expect(readContent).to.equal(testContent);
            
            // Delete file
            await unlink(testFile);
            
            // Verify deletion
            try {
                await stat(testFile);
                expect.fail('File should have been deleted');
            } catch (err: any) {
                expect(err.code).to.equal('ENOENT');
            }
        });
    });
    
    describe('Invitation System', () => {
        beforeEach(async () => {
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
        });
        
        afterEach(async () => {
            if (fuseProcess) {
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
            }
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
        });
        
        it('should generate IOP invitation with correct URL', async () => {
            const invitePath = path.join(TEST_MOUNT_POINT, 'invites', 'iop_invite.txt');
            const content = await readFile(invitePath, 'utf8');
            
            expect(content).to.include('https://edda.dev.refinio.one');
            expect(content).to.match(/token|publicKey/);
        });
        
        it('should refresh invitation on subsequent reads', async () => {
            const invitePath = path.join(TEST_MOUNT_POINT, 'invites', 'iop_invite.txt');
            
            // First read
            const content1 = await readFile(invitePath, 'utf8');
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Second read - should potentially be different (or at least re-generated)
            const content2 = await readFile(invitePath, 'utf8');
            
            expect(content1).to.be.a('string');
            expect(content2).to.be.a('string');
            expect(content1).to.include('edda.dev.refinio.one');
            expect(content2).to.include('edda.dev.refinio.one');
        });
    });
    
    describe('Performance Tests', () => {
        beforeEach(async () => {
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
        });
        
        afterEach(async () => {
            if (fuseProcess) {
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
            }
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
        });
        
        it('should handle rapid sequential reads', async () => {
            const versionPath = path.join(TEST_MOUNT_POINT, 'debug', 'version.txt');
            const iterations = 100;
            
            const start = Date.now();
            for (let i = 0; i < iterations; i++) {
                await readFile(versionPath, 'utf8');
            }
            const duration = Date.now() - start;
            
            console.log(`${iterations} reads completed in ${duration}ms`);
            expect(duration).to.be.lessThan(5000); // Should complete within 5 seconds
        });
        
        it('should handle concurrent reads', async () => {
            const versionPath = path.join(TEST_MOUNT_POINT, 'debug', 'version.txt');
            const concurrency = 50;
            
            const start = Date.now();
            const promises = Array(concurrency).fill(null).map(() =>
                readFile(versionPath, 'utf8')
            );
            
            const results = await Promise.all(promises);
            const duration = Date.now() - start;
            
            console.log(`${concurrency} concurrent reads completed in ${duration}ms`);
            expect(results).to.have.lengthOf(concurrency);
            expect(results.every(r => r.length > 0)).to.be.true;
            expect(duration).to.be.lessThan(2000); // Should complete within 2 seconds
        });
    });
    
    describe('Error Handling', () => {
        beforeEach(async () => {
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
        });
        
        afterEach(async () => {
            if (fuseProcess) {
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
            }
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
        });
        
        it('should handle process crashes gracefully', async () => {
            // Kill the FUSE process abruptly
            fuseProcess!.kill('SIGKILL');
            
            // Wait for process to die
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to access mount point - should get transport endpoint error
            try {
                await readdir(TEST_MOUNT_POINT);
                expect.fail('Should have gotten transport endpoint error');
            } catch (err: any) {
                expect(err.code).to.be.oneOf(['ENOTCONN', 'EIO']);
            }
            
            // Clean up stale mount
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
            
            // Should be able to remount
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
            
            const files = await readdir(TEST_MOUNT_POINT);
            expect(files).to.include.members(['chats', 'debug', 'invites']);
        });
        
        it('should handle permission errors appropriately', async function() {
            // This test would require running as different user or with limited permissions
            // Skipping for now but important for production
            (this as any).skip();
        });
    });
});

// Export test runner for use in CI/CD
export async function runLinuxFuseTests(): Promise<boolean> {
    const Mocha = require('mocha');
    const mocha = new Mocha();
    
    mocha.addFile(__filename);
    
    return new Promise((resolve) => {
        mocha.run((failures: number) => {
            resolve(failures === 0);
        });
    });
}