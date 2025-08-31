"use strict";
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
exports.runWindowsProjFSTests = void 0;
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const exec = (0, util_1.promisify)(child_process_1.exec);
const mkdir = (0, util_1.promisify)(fs.mkdir);
const rmdir = (0, util_1.promisify)(fs.rmdir);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const readFile = (0, util_1.promisify)(fs.readFile);
const stat = (0, util_1.promisify)(fs.stat);
const readdir = (0, util_1.promisify)(fs.readdir);
const unlink = (0, util_1.promisify)(fs.unlink);
(0, mocha_1.describe)('Windows ProjFS Component Tests', function () {
    this.timeout(30000);
    const TEST_PROJFS_ROOT = 'C:\\OneFilerTest';
    const TEST_SECRET = 'test123';
    let projfsProcess = null;
    (0, mocha_1.before)(function () {
        if (process.platform !== 'win32') {
            console.log('Skipping Windows ProjFS tests on non-Windows platform');
            this.skip();
        }
    });
    async function startProjFSMount(rootPath = TEST_PROJFS_ROOT) {
        try {
            await exec(`rmdir /s /q "${rootPath}" 2>nul`);
        }
        catch (err) {
        }
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)('node', [
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
            setTimeout(() => {
                if (!proc.killed) {
                    proc.kill();
                    reject(new Error(`ProjFS mount timeout. Output: ${startupOutput}\nErrors: ${errorOutput}`));
                }
            }, 15000);
        });
    }
    async function stopProjFSMount(proc) {
        return new Promise((resolve) => {
            if (!proc || proc.killed) {
                resolve();
                return;
            }
            proc.on('exit', () => resolve());
            exec(`taskkill /PID ${proc.pid} /T /F 2>nul`).then(() => {
                setTimeout(resolve, 1000);
            }).catch(() => {
                resolve();
            });
        });
    }
    async function waitForMount(rootPath, maxRetries = 10) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const stats = await stat(rootPath);
                if (stats.isDirectory()) {
                    const files = await readdir(rootPath);
                    if (files.length > 0) {
                        return;
                    }
                }
            }
            catch (err) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error('ProjFS root not ready after maximum retries');
    }
    (0, mocha_1.describe)('Mount Lifecycle', () => {
        (0, mocha_1.it)('should successfully mount and unmount ProjFS filesystem', async () => {
            projfsProcess = await startProjFSMount();
            (0, chai_1.expect)(projfsProcess).to.not.be.null;
            (0, chai_1.expect)(projfsProcess.killed).to.be.false;
            await waitForMount(TEST_PROJFS_ROOT);
            const stats = await stat(TEST_PROJFS_ROOT);
            (0, chai_1.expect)(stats.isDirectory()).to.be.true;
            await stopProjFSMount(projfsProcess);
            projfsProcess = null;
        });
        (0, mocha_1.it)('should handle multiple mount/unmount cycles', async () => {
            for (let i = 0; i < 3; i++) {
                console.log(`Mount cycle ${i + 1}/3`);
                projfsProcess = await startProjFSMount();
                await waitForMount(TEST_PROJFS_ROOT);
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        });
        (0, mocha_1.it)('should prevent multiple mounts to same location', async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
            try {
                const secondProcess = await startProjFSMount();
                await stopProjFSMount(secondProcess);
                chai_1.expect.fail('Should have thrown an error for duplicate mount');
            }
            catch (err) {
                (0, chai_1.expect)(err.message).to.include('ProjFS');
            }
            await stopProjFSMount(projfsProcess);
            projfsProcess = null;
        });
    });
    (0, mocha_1.describe)('File Operations', () => {
        (0, mocha_1.beforeEach)(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => { });
        });
        (0, mocha_1.it)('should list root directory with virtual folders', async () => {
            const files = await readdir(TEST_PROJFS_ROOT);
            (0, chai_1.expect)(files).to.be.an('array');
            (0, chai_1.expect)(files).to.include.members(['chats', 'debug', 'invites', 'objects', 'types']);
        });
        (0, mocha_1.it)('should read file attributes correctly', async () => {
            const debugPath = path.join(TEST_PROJFS_ROOT, 'debug');
            const stats = await stat(debugPath);
            (0, chai_1.expect)(stats.isDirectory()).to.be.true;
        });
        (0, mocha_1.it)('should navigate nested virtual directories', async () => {
            const debugFiles = await readdir(path.join(TEST_PROJFS_ROOT, 'debug'));
            (0, chai_1.expect)(debugFiles).to.be.an('array');
            (0, chai_1.expect)(debugFiles).to.include.members(['version.txt', 'instanceId.txt']);
        });
        (0, mocha_1.it)('should hydrate and read virtual files on demand', async () => {
            const versionPath = path.join(TEST_PROJFS_ROOT, 'debug', 'version.txt');
            const content = await readFile(versionPath, 'utf8');
            (0, chai_1.expect)(content).to.be.a('string');
            (0, chai_1.expect)(content.length).to.be.greaterThan(0);
            const content2 = await readFile(versionPath, 'utf8');
            (0, chai_1.expect)(content2).to.equal(content);
        });
        (0, mocha_1.it)('should handle non-existent files appropriately', async () => {
            try {
                await readFile(path.join(TEST_PROJFS_ROOT, 'nonexistent.txt'));
                chai_1.expect.fail('Should have thrown error for non-existent file');
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.be.oneOf(['ENOENT', 'ERROR_FILE_NOT_FOUND']);
            }
        });
        (0, mocha_1.it)('should support COW for modified files', async () => {
            const testFile = path.join(TEST_PROJFS_ROOT, 'test-cow.txt');
            const originalContent = 'Original content';
            const modifiedContent = 'Modified content';
            await writeFile(testFile, originalContent);
            let content = await readFile(testFile, 'utf8');
            (0, chai_1.expect)(content).to.equal(originalContent);
            await writeFile(testFile, modifiedContent);
            content = await readFile(testFile, 'utf8');
            (0, chai_1.expect)(content).to.equal(modifiedContent);
            await unlink(testFile);
        });
    });
    (0, mocha_1.describe)('Invitation System', () => {
        (0, mocha_1.beforeEach)(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => { });
        });
        (0, mocha_1.it)('should generate IOP invitation with correct URL', async () => {
            const invitePath = path.join(TEST_PROJFS_ROOT, 'invites', 'iop_invite.txt');
            const content = await readFile(invitePath, 'utf8');
            (0, chai_1.expect)(content).to.include('https://edda.dev.refinio.one');
            (0, chai_1.expect)(content).to.match(/token|publicKey/);
        });
        (0, mocha_1.it)('should refresh invitation content appropriately', async () => {
            const invitePath = path.join(TEST_PROJFS_ROOT, 'invites', 'iop_invite.txt');
            const content1 = await readFile(invitePath, 'utf8');
            await new Promise(resolve => setTimeout(resolve, 100));
            const content2 = await readFile(invitePath, 'utf8');
            (0, chai_1.expect)(content1).to.include('edda.dev.refinio.one');
            (0, chai_1.expect)(content2).to.include('edda.dev.refinio.one');
        });
    });
    (0, mocha_1.describe)('Performance Tests', () => {
        (0, mocha_1.beforeEach)(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => { });
        });
        (0, mocha_1.it)('should handle rapid sequential file reads efficiently', async () => {
            const versionPath = path.join(TEST_PROJFS_ROOT, 'debug', 'version.txt');
            const iterations = 100;
            const start = Date.now();
            for (let i = 0; i < iterations; i++) {
                await readFile(versionPath, 'utf8');
            }
            const duration = Date.now() - start;
            console.log(`${iterations} reads completed in ${duration}ms`);
            (0, chai_1.expect)(duration).to.be.lessThan(3000);
        });
        (0, mocha_1.it)('should handle concurrent file operations', async () => {
            const basePath = path.join(TEST_PROJFS_ROOT, 'debug');
            const concurrency = 20;
            const start = Date.now();
            const promises = [];
            for (let i = 0; i < concurrency; i++) {
                if (i % 3 === 0) {
                    promises.push(readdir(basePath));
                }
                else if (i % 3 === 1) {
                    promises.push(stat(basePath));
                }
                else {
                    promises.push(readFile(path.join(basePath, 'version.txt'), 'utf8'));
                }
            }
            const results = await Promise.all(promises);
            const duration = Date.now() - start;
            console.log(`${concurrency} concurrent operations completed in ${duration}ms`);
            (0, chai_1.expect)(results).to.have.lengthOf(concurrency);
            (0, chai_1.expect)(duration).to.be.lessThan(3000);
        });
        (0, mocha_1.it)('should efficiently cache hydrated files', async () => {
            const testPath = path.join(TEST_PROJFS_ROOT, 'debug', 'instanceId.txt');
            const start1 = Date.now();
            await readFile(testPath, 'utf8');
            const hydrationTime = Date.now() - start1;
            const start2 = Date.now();
            for (let i = 0; i < 10; i++) {
                await readFile(testPath, 'utf8');
            }
            const cachedTime = (Date.now() - start2) / 10;
            console.log(`Hydration time: ${hydrationTime}ms, Cached read time: ${cachedTime}ms`);
            (0, chai_1.expect)(cachedTime).to.be.lessThan(hydrationTime);
        });
    });
    (0, mocha_1.describe)('Error Handling', () => {
        (0, mocha_1.beforeEach)(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => { });
        });
        (0, mocha_1.it)('should handle process termination gracefully', async () => {
            await exec(`taskkill /PID ${projfsProcess.pid} /F`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await readdir(TEST_PROJFS_ROOT);
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.be.oneOf(['ENOENT', 'ERROR_PATH_NOT_FOUND', 'ERROR_NOT_A_REPARSE_POINT']);
            }
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
            const files = await readdir(TEST_PROJFS_ROOT);
            (0, chai_1.expect)(files).to.include.members(['chats', 'debug', 'invites']);
        });
        (0, mocha_1.it)('should handle invalid operations appropriately', async () => {
            try {
                await mkdir(path.join(TEST_PROJFS_ROOT, 'objects', 'newdir'));
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.be.oneOf(['EACCES', 'ERROR_ACCESS_DENIED', 'EROFS']);
            }
        });
    });
    (0, mocha_1.describe)('Windows Integration', () => {
        (0, mocha_1.beforeEach)(async () => {
            projfsProcess = await startProjFSMount();
            await waitForMount(TEST_PROJFS_ROOT);
        });
        (0, mocha_1.afterEach)(async () => {
            if (projfsProcess) {
                await stopProjFSMount(projfsProcess);
                projfsProcess = null;
            }
            await exec(`rmdir /s /q "${TEST_PROJFS_ROOT}" 2>nul`).catch(() => { });
        });
        (0, mocha_1.it)('should be accessible via Windows Explorer compatible paths', async () => {
            const { stdout } = await exec(`dir "${TEST_PROJFS_ROOT}"`);
            (0, chai_1.expect)(stdout).to.include('chats');
            (0, chai_1.expect)(stdout).to.include('debug');
            (0, chai_1.expect)(stdout).to.include('invites');
        });
        (0, mocha_1.it)('should support Windows file attributes', async () => {
            const { stdout } = await exec(`attrib "${path.join(TEST_PROJFS_ROOT, 'debug')}"`);
            (0, chai_1.expect)(stdout).to.be.a('string');
        });
        (0, mocha_1.it)('should integrate with Windows file operations', async () => {
            const testFile = path.join(TEST_PROJFS_ROOT, 'windows-test.txt');
            await exec(`echo Hello from Windows > "${testFile}"`);
            const content = await readFile(testFile, 'utf8');
            (0, chai_1.expect)(content).to.include('Hello from Windows');
            await exec(`del "${testFile}"`);
            try {
                await stat(testFile);
                chai_1.expect.fail('File should have been deleted');
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.equal('ENOENT');
            }
        });
    });
});
async function runWindowsProjFSTests() {
    const Mocha = require('mocha');
    const mocha = new Mocha();
    mocha.addFile(__filename);
    return new Promise((resolve) => {
        mocha.run((failures) => {
            resolve(failures === 0);
        });
    });
}
exports.runWindowsProjFSTests = runWindowsProjFSTests;
//# sourceMappingURL=projfs-windows.test.js.map