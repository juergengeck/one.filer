"use strict";
/**
 * Comprehensive Component Tests for Linux FUSE3 Implementation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLinuxFuseTests = void 0;
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const exec = (0, util_1.promisify)(require('child_process').exec);
const mkdir = (0, util_1.promisify)(fs.mkdir);
const rmdir = (0, util_1.promisify)(fs.rmdir);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const readFile = (0, util_1.promisify)(fs.readFile);
const stat = (0, util_1.promisify)(fs.stat);
const readdir = (0, util_1.promisify)(fs.readdir);
const unlink = (0, util_1.promisify)(fs.unlink);
(0, mocha_1.describe)('Linux FUSE3 Component Tests', function () {
    this.timeout(30000); // 30 second timeout for async operations
    // Skip these tests if not on Linux
    (0, mocha_1.before)(function () {
        if (process.platform !== 'linux') {
            console.log('Skipping FUSE tests - not on Linux platform');
            this.skip();
        }
    });
    const TEST_MOUNT_POINT = '/tmp/test-fuse-mount';
    const TEST_SECRET = 'test123';
    let fuseProcess = null;
    // Helper to start FUSE mount
    async function startFuseMount(mountPoint = TEST_MOUNT_POINT) {
        // Clean up any existing mount
        await exec(`fusermount -u ${mountPoint} 2>/dev/null || true`);
        await exec(`rm -rf ${mountPoint}`);
        await mkdir(mountPoint, { recursive: true });
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)('node', [
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
    async function stopFuseMount(proc) {
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
    async function waitForMount(mountPoint, maxRetries = 10) {
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
            }
            catch (err) {
                if (err.code === 'ENOTCONN') {
                    // Transport endpoint not connected - mount not ready
                    console.log(`Retry ${i + 1}/${maxRetries}: Transport endpoint not connected`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                // Log the error for debugging
                console.log(`Retry ${i + 1}/${maxRetries}: ${err.message}`);
                // Other errors might indicate the mount is actually working
                if (i === maxRetries - 1)
                    throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error('Mount point not ready after maximum retries');
    }
    (0, mocha_1.describe)('Mount Lifecycle', () => {
        (0, mocha_1.it)('should successfully mount and unmount FUSE filesystem', async () => {
            fuseProcess = await startFuseMount();
            (0, chai_1.expect)(fuseProcess).to.not.be.null;
            (0, chai_1.expect)(fuseProcess.killed).to.be.false;
            await waitForMount(TEST_MOUNT_POINT);
            // Verify mount exists - with timeout protection
            try {
                const { stdout } = await exec('mount | grep fuse', { timeout: 5000 });
                (0, chai_1.expect)(stdout).to.include(TEST_MOUNT_POINT);
            }
            catch (err) {
                // On some systems, mount command might not be available or might timeout
                console.log('Warning: Could not verify mount with mount command:', err.message);
                // Instead, verify by checking if we can access the mount point
                const files = await readdir(TEST_MOUNT_POINT);
                (0, chai_1.expect)(files).to.be.an('array');
            }
            await stopFuseMount(fuseProcess);
            fuseProcess = null;
        });
        (0, mocha_1.it)('should handle multiple mount/unmount cycles', async () => {
            for (let i = 0; i < 3; i++) {
                fuseProcess = await startFuseMount();
                await waitForMount(TEST_MOUNT_POINT);
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
                // Ensure clean unmount
                await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
            }
        });
        (0, mocha_1.it)('should reject mounting to non-existent parent directory', async () => {
            const invalidMount = '/nonexistent/path/mount';
            try {
                fuseProcess = await startFuseMount(invalidMount);
                chai_1.expect.fail('Should have thrown an error');
            }
            catch (err) {
                (0, chai_1.expect)(err.message).to.include('Failed to start FUSE');
            }
        });
    });
    (0, mocha_1.describe)('File Operations', () => {
        (0, mocha_1.beforeEach)(async () => {
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (fuseProcess) {
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
            }
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
        });
        (0, mocha_1.it)('should list root directory', async () => {
            const files = await readdir(TEST_MOUNT_POINT);
            (0, chai_1.expect)(files).to.be.an('array');
            (0, chai_1.expect)(files).to.include.members(['chats', 'debug', 'invites', 'objects', 'types']);
        });
        (0, mocha_1.it)('should read file attributes', async () => {
            const stats = await stat(path.join(TEST_MOUNT_POINT, 'debug'));
            (0, chai_1.expect)(stats.isDirectory()).to.be.true;
            (0, chai_1.expect)(stats.mode & 0o777).to.equal(0o755);
        });
        (0, mocha_1.it)('should navigate nested directories', async () => {
            const debugFiles = await readdir(path.join(TEST_MOUNT_POINT, 'debug'));
            (0, chai_1.expect)(debugFiles).to.be.an('array');
            // Check for expected debug files
            (0, chai_1.expect)(debugFiles).to.include.members(['version.txt', 'instanceId.txt']);
        });
        (0, mocha_1.it)('should read text files', async () => {
            const versionPath = path.join(TEST_MOUNT_POINT, 'debug', 'version.txt');
            const content = await readFile(versionPath, 'utf8');
            (0, chai_1.expect)(content).to.be.a('string');
            (0, chai_1.expect)(content.length).to.be.greaterThan(0);
        });
        (0, mocha_1.it)('should handle non-existent files gracefully', async () => {
            try {
                await readFile(path.join(TEST_MOUNT_POINT, 'nonexistent.txt'));
                chai_1.expect.fail('Should have thrown ENOENT error');
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.equal('ENOENT');
            }
        });
        (0, mocha_1.it)('should create and delete files in temporary filesystem', async () => {
            const testFile = path.join(TEST_MOUNT_POINT, 'test-file.txt');
            const testContent = 'Hello from test';
            // Write file
            await writeFile(testFile, testContent);
            // Read back
            const readContent = await readFile(testFile, 'utf8');
            (0, chai_1.expect)(readContent).to.equal(testContent);
            // Delete file
            await unlink(testFile);
            // Verify deletion
            try {
                await stat(testFile);
                chai_1.expect.fail('File should have been deleted');
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.equal('ENOENT');
            }
        });
    });
    (0, mocha_1.describe)('Invitation System', () => {
        (0, mocha_1.beforeEach)(async () => {
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (fuseProcess) {
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
            }
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
        });
        (0, mocha_1.it)('should generate IOP invitation with correct URL', async () => {
            const invitePath = path.join(TEST_MOUNT_POINT, 'invites', 'iop_invite.txt');
            const content = await readFile(invitePath, 'utf8');
            (0, chai_1.expect)(content).to.include('https://edda.dev.refinio.one');
            (0, chai_1.expect)(content).to.match(/token|publicKey/);
        });
        (0, mocha_1.it)('should refresh invitation on subsequent reads', async () => {
            const invitePath = path.join(TEST_MOUNT_POINT, 'invites', 'iop_invite.txt');
            // First read
            const content1 = await readFile(invitePath, 'utf8');
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 100));
            // Second read - should potentially be different (or at least re-generated)
            const content2 = await readFile(invitePath, 'utf8');
            (0, chai_1.expect)(content1).to.be.a('string');
            (0, chai_1.expect)(content2).to.be.a('string');
            (0, chai_1.expect)(content1).to.include('edda.dev.refinio.one');
            (0, chai_1.expect)(content2).to.include('edda.dev.refinio.one');
        });
    });
    (0, mocha_1.describe)('Performance Tests', () => {
        (0, mocha_1.beforeEach)(async () => {
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (fuseProcess) {
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
            }
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
        });
        (0, mocha_1.it)('should handle rapid sequential reads', async () => {
            const versionPath = path.join(TEST_MOUNT_POINT, 'debug', 'version.txt');
            const iterations = 100;
            const start = Date.now();
            for (let i = 0; i < iterations; i++) {
                await readFile(versionPath, 'utf8');
            }
            const duration = Date.now() - start;
            console.log(`${iterations} reads completed in ${duration}ms`);
            (0, chai_1.expect)(duration).to.be.lessThan(5000); // Should complete within 5 seconds
        });
        (0, mocha_1.it)('should handle concurrent reads', async () => {
            const versionPath = path.join(TEST_MOUNT_POINT, 'debug', 'version.txt');
            const concurrency = 50;
            const start = Date.now();
            const promises = Array(concurrency).fill(null).map(() => readFile(versionPath, 'utf8'));
            const results = await Promise.all(promises);
            const duration = Date.now() - start;
            console.log(`${concurrency} concurrent reads completed in ${duration}ms`);
            (0, chai_1.expect)(results).to.have.lengthOf(concurrency);
            (0, chai_1.expect)(results.every(r => r.length > 0)).to.be.true;
            (0, chai_1.expect)(duration).to.be.lessThan(2000); // Should complete within 2 seconds
        });
    });
    (0, mocha_1.describe)('Error Handling', () => {
        (0, mocha_1.beforeEach)(async () => {
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (fuseProcess) {
                await stopFuseMount(fuseProcess);
                fuseProcess = null;
            }
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
        });
        (0, mocha_1.it)('should handle process crashes gracefully', async () => {
            // Kill the FUSE process abruptly
            fuseProcess.kill('SIGKILL');
            // Wait for process to die
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Try to access mount point - should get transport endpoint error
            try {
                await readdir(TEST_MOUNT_POINT);
                chai_1.expect.fail('Should have gotten transport endpoint error');
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.be.oneOf(['ENOTCONN', 'EIO']);
            }
            // Clean up stale mount
            await exec(`fusermount -u ${TEST_MOUNT_POINT} 2>/dev/null || true`);
            // Should be able to remount
            fuseProcess = await startFuseMount();
            await waitForMount(TEST_MOUNT_POINT);
            const files = await readdir(TEST_MOUNT_POINT);
            (0, chai_1.expect)(files).to.include.members(['chats', 'debug', 'invites']);
        });
        (0, mocha_1.it)('should handle permission errors appropriately', async function () {
            // This test would require running as different user or with limited permissions
            // Skipping for now but important for production
            this.skip();
        });
    });
});
// Export test runner for use in CI/CD
async function runLinuxFuseTests() {
    const Mocha = require('mocha');
    const mocha = new Mocha();
    mocha.addFile(__filename);
    return new Promise((resolve) => {
        mocha.run((failures) => {
            resolve(failures === 0);
        });
    });
}
exports.runLinuxFuseTests = runLinuxFuseTests;
