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
exports.runCrossPlatformTests = void 0;
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const exec = (0, util_1.promisify)(child_process_1.exec);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const readFile = (0, util_1.promisify)(fs.readFile);
const stat = (0, util_1.promisify)(fs.stat);
const readdir = (0, util_1.promisify)(fs.readdir);
const unlink = (0, util_1.promisify)(fs.unlink);
const mkdir = (0, util_1.promisify)(fs.mkdir);
(0, mocha_1.describe)('Cross-Platform Integration Tests', function () {
    this.timeout(60000);
    const instances = [
        {
            name: 'windows-instance',
            platform: 'windows',
            process: null,
            mountPoint: 'C:\\OneFilerIntegTest1',
            dataDir: 'C:\\OneFilerData1',
            secret: 'test123',
            port: 8081
        },
        {
            name: 'linux-instance',
            platform: 'linux',
            process: null,
            mountPoint: '/tmp/onefiler-integ-test',
            dataDir: '/tmp/onefiler-data',
            secret: 'test456',
            port: 8082
        }
    ];
    async function startInstance(instance) {
        console.log(`Starting ${instance.name} on ${instance.platform}`);
        if (instance.platform === 'windows') {
            await exec(`rmdir /s /q "${instance.dataDir}" 2>nul`).catch(() => { });
            await exec(`rmdir /s /q "${instance.mountPoint}" 2>nul`).catch(() => { });
        }
        else {
            await exec(`fusermount -u ${instance.mountPoint} 2>/dev/null || true`);
            await exec(`rm -rf ${instance.dataDir} ${instance.mountPoint}`);
            await mkdir(instance.mountPoint, { recursive: true });
        }
        await mkdir(instance.dataDir, { recursive: true });
        return new Promise((resolve, reject) => {
            const args = [
                'lib/index.js',
                'start',
                '-s', instance.secret,
                '-d', instance.dataDir,
                '--filer', 'true',
                '--commServerUrl', 'wss://comm10.dev.refinio.one'
            ];
            
            // For Windows, use a config file with ProjFS settings
            if (instance.platform === 'windows') {
                // Create a temporary config file for this instance
                const configFile = path.join(instance.dataDir, 'config.json');
                const configData = {
                    directory: instance.dataDir,
                    commServerUrl: 'wss://comm10.dev.refinio.one',
                    useFiler: true,
                    filerConfig: {
                        useProjFS: true,
                        mountPoint: instance.mountPoint
                    }
                };
                fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
                args.push('-c', configFile);
            }
            else {
                args.push('--filer-mount-point', instance.mountPoint);
            }
            instance.process = (0, child_process_1.spawn)('node', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    ONE_INSTANCE_PORT: instance.port.toString()
                }
            });
            let startupOutput = '';
            let errorOutput = '';
            let resolved = false;
            instance.process.stdout?.on('data', (data) => {
                startupOutput += data.toString();
                console.log(`[${instance.name} stdout]:`, data.toString());
                if (!resolved && (startupOutput.includes('mounted successfully') ||
                    startupOutput.includes('Replicant started successfully'))) {
                    resolved = true;
                    resolve();
                }
            });
            instance.process.stderr?.on('data', (data) => {
                errorOutput += data.toString();
                console.error(`[${instance.name} stderr]:`, data.toString());
            });
            instance.process.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error(`Failed to start ${instance.name}: ${err.message}`));
                }
            });
            instance.process.on('exit', (code) => {
                if (!resolved && code !== 0 && code !== null) {
                    resolved = true;
                    reject(new Error(`${instance.name} exited with code ${code}: ${errorOutput}`));
                }
            });
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (instance.process && !instance.process.killed) {
                        instance.process.kill();
                    }
                    reject(new Error(`${instance.name} startup timeout. Output: ${startupOutput}`));
                }
            }, 30000);
        });
    }
    async function stopInstance(instance) {
        if (!instance.process || instance.process.killed)
            return;
        return new Promise((resolve) => {
            instance.process.on('exit', () => {
                instance.process = null;
                resolve();
            });
            if (instance.platform === 'windows') {
                exec(`taskkill /PID ${instance.process.pid} /T /F`).catch(() => { });
            }
            else {
                instance.process.kill('SIGTERM');
            }
            setTimeout(() => {
                if (instance.process && !instance.process.killed) {
                    instance.process.kill('SIGKILL');
                }
                resolve();
            }, 5000);
        });
    }
    async function waitForFileSystem(mountPoint, maxRetries = 20) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const files = await readdir(mountPoint);
                if (files.length > 0 && files.includes('invites')) {
                    return;
                }
            }
            catch (err) {
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error(`File system not ready at ${mountPoint}`);
    }
    async function getInvitation(instance) {
        const invitePath = path.join(instance.mountPoint, 'invites', 'iop_invite.txt');
        return await readFile(invitePath, 'utf8');
    }
    async function acceptInvitation(instance, invitation) {
        const acceptPath = path.join(instance.mountPoint, 'invites', 'accept_invite.txt');
        await writeFile(acceptPath, invitation);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    (0, mocha_1.describe)('Basic Connectivity', () => {
        (0, mocha_1.it)('should start both Windows and Linux instances', async function () {
            if (process.platform === 'win32') {
                const winInstance = instances[0];
                await startInstance(winInstance);
                await waitForFileSystem(winInstance.mountPoint);
                const files = await readdir(winInstance.mountPoint);
                (0, chai_1.expect)(files).to.include.members(['chats', 'debug', 'invites']);
                await stopInstance(winInstance);
            }
            else {
                const linuxInstance = instances[1];
                await startInstance(linuxInstance);
                await waitForFileSystem(linuxInstance.mountPoint);
                const files = await readdir(linuxInstance.mountPoint);
                (0, chai_1.expect)(files).to.include.members(['chats', 'debug', 'invites']);
                await stopInstance(linuxInstance);
            }
        });
    });
    (0, mocha_1.describe)('Pairing and Connection', () => {
        let primaryInstance;
        let secondaryInstance;
        (0, mocha_1.before)(async function () {
            if (process.platform === 'win32') {
                console.log('Running Windows-only pairing test');
                this.skip();
            }
            else {
                primaryInstance = {
                    name: 'linux-primary',
                    platform: 'linux',
                    process: null,
                    mountPoint: '/tmp/onefiler-primary',
                    dataDir: '/tmp/onefiler-data-primary',
                    secret: 'primary123',
                    port: 8083
                };
                secondaryInstance = {
                    name: 'linux-secondary',
                    platform: 'linux',
                    process: null,
                    mountPoint: '/tmp/onefiler-secondary',
                    dataDir: '/tmp/onefiler-data-secondary',
                    secret: 'secondary123',
                    port: 8084
                };
            }
        });
        (0, mocha_1.it)('should establish pairing between instances', async function () {
            if (!primaryInstance || !secondaryInstance) {
                this.skip();
            }
            await startInstance(primaryInstance);
            await waitForFileSystem(primaryInstance.mountPoint);
            await startInstance(secondaryInstance);
            await waitForFileSystem(secondaryInstance.mountPoint);
            const invitation = await getInvitation(primaryInstance);
            (0, chai_1.expect)(invitation).to.include('edda.dev.refinio.one');
            await acceptInvitation(secondaryInstance, invitation);
            const primaryConnections = await readFile(path.join(primaryInstance.mountPoint, 'debug', 'connections.json'), 'utf8').catch(() => '[]');
            const connections = JSON.parse(primaryConnections);
            (0, chai_1.expect)(connections.length).to.be.greaterThan(0);
        });
        (0, mocha_1.after)(async function () {
            if (primaryInstance)
                await stopInstance(primaryInstance);
            if (secondaryInstance)
                await stopInstance(secondaryInstance);
        });
    });
    (0, mocha_1.describe)('Data Synchronization', () => {
        let instance1;
        let instance2;
        (0, mocha_1.before)(async function () {
            if (process.platform !== 'linux') {
                this.skip();
            }
            instance1 = {
                name: 'sync-instance-1',
                platform: 'linux',
                process: null,
                mountPoint: '/tmp/sync-test-1',
                dataDir: '/tmp/sync-data-1',
                secret: 'sync123',
                port: 8085
            };
            instance2 = {
                name: 'sync-instance-2',
                platform: 'linux',
                process: null,
                mountPoint: '/tmp/sync-test-2',
                dataDir: '/tmp/sync-data-2',
                secret: 'sync456',
                port: 8086
            };
            await startInstance(instance1);
            await waitForFileSystem(instance1.mountPoint);
            await startInstance(instance2);
            await waitForFileSystem(instance2.mountPoint);
            const invitation = await getInvitation(instance1);
            await acceptInvitation(instance2, invitation);
        });
        (0, mocha_1.it)('should synchronize chat messages between instances', async function () {
            if (!instance1 || !instance2) {
                this.skip();
            }
            const chatPath1 = path.join(instance1.mountPoint, 'chats', 'test-chat.txt');
            const testMessage = 'Hello from instance 1';
            await writeFile(chatPath1, testMessage);
            await new Promise(resolve => setTimeout(resolve, 5000));
            const chatPath2 = path.join(instance2.mountPoint, 'chats', 'test-chat.txt');
            let synced = false;
            for (let i = 0; i < 10; i++) {
                try {
                    const content = await readFile(chatPath2, 'utf8');
                    if (content === testMessage) {
                        synced = true;
                        break;
                    }
                }
                catch (err) {
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            (0, chai_1.expect)(synced).to.be.true;
        });
        (0, mocha_1.it)('should synchronize file modifications bidirectionally', async function () {
            if (!instance1 || !instance2) {
                this.skip();
            }
            const filePath2 = path.join(instance2.mountPoint, 'sync-test-file.txt');
            await writeFile(filePath2, 'Initial content from instance 2');
            await new Promise(resolve => setTimeout(resolve, 5000));
            const filePath1 = path.join(instance1.mountPoint, 'sync-test-file.txt');
            let content1 = '';
            for (let i = 0; i < 10; i++) {
                try {
                    content1 = await readFile(filePath1, 'utf8');
                    if (content1.includes('instance 2'))
                        break;
                }
                catch (err) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            (0, chai_1.expect)(content1).to.include('instance 2');
            await writeFile(filePath1, 'Modified by instance 1');
            await new Promise(resolve => setTimeout(resolve, 5000));
            let content2 = '';
            for (let i = 0; i < 10; i++) {
                content2 = await readFile(filePath2, 'utf8');
                if (content2.includes('instance 1'))
                    break;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            (0, chai_1.expect)(content2).to.include('instance 1');
        });
        (0, mocha_1.after)(async function () {
            if (instance1)
                await stopInstance(instance1);
            if (instance2)
                await stopInstance(instance2);
        });
    });
    (0, mocha_1.describe)('Performance Under Load', () => {
        let loadInstance1;
        let loadInstance2;
        (0, mocha_1.before)(async function () {
            if (process.platform !== 'linux') {
                this.skip();
            }
            loadInstance1 = {
                name: 'load-test-1',
                platform: 'linux',
                process: null,
                mountPoint: '/tmp/load-test-1',
                dataDir: '/tmp/load-data-1',
                secret: 'load123',
                port: 8087
            };
            loadInstance2 = {
                name: 'load-test-2',
                platform: 'linux',
                process: null,
                mountPoint: '/tmp/load-test-2',
                dataDir: '/tmp/load-data-2',
                secret: 'load456',
                port: 8088
            };
        });
        (0, mocha_1.it)('should handle concurrent file operations during sync', async function () {
            if (!loadInstance1 || !loadInstance2) {
                this.skip();
            }
            await startInstance(loadInstance1);
            await waitForFileSystem(loadInstance1.mountPoint);
            await startInstance(loadInstance2);
            await waitForFileSystem(loadInstance2.mountPoint);
            const invitation = await getInvitation(loadInstance1);
            await acceptInvitation(loadInstance2, invitation);
            const fileCount = 20;
            const promises = [];
            for (let i = 0; i < fileCount; i++) {
                const fileName = `load-test-${i}.txt`;
                const content = `Content for file ${i}`;
                if (i % 2 === 0) {
                    promises.push(writeFile(path.join(loadInstance1.mountPoint, fileName), content));
                }
                else {
                    promises.push(writeFile(path.join(loadInstance2.mountPoint, fileName), content));
                }
            }
            await Promise.all(promises);
            await new Promise(resolve => setTimeout(resolve, 10000));
            const files1 = await readdir(loadInstance1.mountPoint);
            const files2 = await readdir(loadInstance2.mountPoint);
            const loadFiles1 = files1.filter(f => f.startsWith('load-test-'));
            const loadFiles2 = files2.filter(f => f.startsWith('load-test-'));
            (0, chai_1.expect)(loadFiles1.length).to.equal(fileCount);
            (0, chai_1.expect)(loadFiles2.length).to.equal(fileCount);
        });
        (0, mocha_1.after)(async function () {
            if (loadInstance1)
                await stopInstance(loadInstance1);
            if (loadInstance2)
                await stopInstance(loadInstance2);
        });
    });
    (0, mocha_1.describe)('Error Recovery', () => {
        (0, mocha_1.it)('should recover from network disconnection', async function () {
            this.skip();
        });
        (0, mocha_1.it)('should handle instance restart during sync', async function () {
            this.skip();
        });
    });
});
async function runCrossPlatformTests() {
    const Mocha = require('mocha');
    const mocha = new Mocha();
    mocha.addFile(__filename);
    return new Promise((resolve) => {
        mocha.run((failures) => {
            resolve(failures === 0);
        });
    });
}
exports.runCrossPlatformTests = runCrossPlatformTests;
//# sourceMappingURL=cross-platform-integration.test.js.map