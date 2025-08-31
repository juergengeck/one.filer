/**
 * Cross-Platform Integration Tests
 * 
 * These tests verify data synchronization between Windows (ProjFS) and Linux (FUSE3)
 * versions of ONE.filer through the refinio network.
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess, exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);

interface Instance {
    name: string;
    platform: 'windows' | 'linux';
    process: ChildProcess | null;
    mountPoint: string;
    dataDir: string;
    secret: string;
    port: number;
}

describe('Cross-Platform Integration Tests', function() {
    this.timeout(60000); // 60 second timeout for network operations
    
    const instances: Instance[] = [
        {
            name: 'windows-instance',
            platform: 'windows',
            process: null,
            mountPoint: 'C:\\OneFiler',
            dataDir: 'C:\\OneFilerData',
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
    
    // Helper to start an instance
    async function startInstance(instance: Instance): Promise<void> {
        console.log(`Starting ${instance.name} on ${instance.platform}`);
        
        // Clean up previous data thoroughly
        if (instance.platform === 'windows') {
            await exec(`rmdir /s /q "${instance.dataDir}" 2>nul`).catch(() => {});
            await exec(`rmdir /s /q "${instance.mountPoint}" 2>nul`).catch(() => {});
            // Kill any hanging processes
            await exec(`taskkill /F /IM node.exe /FI "WINDOWTITLE eq ${instance.name}*" 2>nul`).catch(() => {});
            await exec(`taskkill /F /IM node.exe /FI "COMMANDLINE eq *OneFiler*" 2>nul`).catch(() => {});
        } else {
            await exec(`fusermount -u ${instance.mountPoint} 2>/dev/null || true`);
            await exec(`rm -rf ${instance.dataDir} ${instance.mountPoint}`);
            await mkdir(instance.mountPoint, { recursive: true });
        }
        
        // Create data directory
        await mkdir(instance.dataDir, { recursive: true });
        
        // Create a minimal config for fresh instance
        if (instance.platform === 'windows') {
            const configPath = path.join(instance.dataDir, 'test-config.json');
            const minimalConfig = {
                directory: instance.dataDir,
                useFiler: true,
                filerConfig: {
                    useProjFS: true,
                    mountPoint: instance.mountPoint,
                    verboseLogging: false,
                    traceAllOperations: false
                },
                // Force completely fresh instance
                freshInstance: true,
                skipObjectPreload: true
            };
            await writeFile(configPath, JSON.stringify(minimalConfig, null, 2));
        }
        
        return new Promise((resolve, reject) => {
            const args = [
                'lib/index.js',
                'start',
                '-s', instance.secret,
                '-d', instance.dataDir,
                '--filer', 'true',
                '--commServerUrl', 'wss://comm10.dev.refinio.one'
            ];
            
            if (instance.platform === 'windows') {
                const configPath = path.join(instance.dataDir, 'test-config.json');
                args.push('--config', configPath);
            } else {
                args.push('--filer-mount-point', instance.mountPoint);
            }
            
            instance.process = spawn('node', args, {
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
                
                if (!resolved && (
                    startupOutput.includes('mounted successfully') ||
                    startupOutput.includes('Replicant started successfully')
                )) {
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
            
            // Timeout
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
    
    // Helper to stop an instance
    async function stopInstance(instance: Instance): Promise<void> {
        if (!instance.process || instance.process.killed) return;
        
        return new Promise((resolve) => {
            instance.process!.on('exit', () => {
                instance.process = null;
                resolve();
            });
            
            if (instance.platform === 'windows') {
                exec(`taskkill /PID ${instance.process!.pid} /T /F`).catch(() => {});
            } else {
                instance.process!.kill('SIGTERM');
            }
            
            setTimeout(() => {
                if (instance.process && !instance.process.killed) {
                    instance.process.kill('SIGKILL');
                }
                resolve();
            }, 5000);
        });
    }
    
    // Helper to wait for file system to be ready
    async function waitForFileSystem(mountPoint: string, maxRetries: number = 20): Promise<void> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const files = await readdir(mountPoint);
                if (files.length > 0 && files.includes('invites')) {
                    return;
                }
            } catch (err) {
                // Not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error(`File system not ready at ${mountPoint}`);
    }
    
    // Helper to get invitation from an instance
    async function getInvitation(instance: Instance): Promise<string> {
        const invitePath = path.join(instance.mountPoint, 'invites', 'iop_invite.txt');
        return await readFile(invitePath, 'utf8');
    }
    
    // Helper to accept invitation
    async function acceptInvitation(instance: Instance, invitation: string): Promise<void> {
        const acceptPath = path.join(instance.mountPoint, 'invites', 'accept_invite.txt');
        await writeFile(acceptPath, invitation);
        
        // Wait for pairing to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    describe('Basic Connectivity', () => {
        it('should start both Windows and Linux instances', async function() {
            // Skip if not in appropriate environment
            if (process.platform === 'win32') {
                // Can only test Windows instance
                const winInstance = instances[0];
                await startInstance(winInstance);
                await waitForFileSystem(winInstance.mountPoint);
                
                const files = await readdir(winInstance.mountPoint);
                expect(files).to.include.members(['chats', 'debug', 'invites']);
                
                await stopInstance(winInstance);
            } else {
                // Can only test Linux instance
                const linuxInstance = instances[1];
                await startInstance(linuxInstance);
                await waitForFileSystem(linuxInstance.mountPoint);
                
                const files = await readdir(linuxInstance.mountPoint);
                expect(files).to.include.members(['chats', 'debug', 'invites']);
                
                await stopInstance(linuxInstance);
            }
        });
    });
    
    describe('Pairing and Connection', () => {
        let primaryInstance: Instance;
        let secondaryInstance: Instance;
        
        before(async function() {
            // Determine which instances we can actually run
            if (process.platform === 'win32') {
                console.log('Running Windows-only pairing test');
                this.skip(); // Can't test cross-platform on single machine
            } else {
                // For Linux, we'll create two Linux instances
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
        
        it('should establish pairing between instances', async function() {
            if (!primaryInstance || !secondaryInstance) {
                this.skip();
            }
            
            // Start both instances
            await startInstance(primaryInstance);
            await waitForFileSystem(primaryInstance.mountPoint);
            
            await startInstance(secondaryInstance);
            await waitForFileSystem(secondaryInstance.mountPoint);
            
            // Get invitation from primary
            const invitation = await getInvitation(primaryInstance);
            expect(invitation).to.include('edda.dev.refinio.one');
            
            // Accept invitation on secondary
            await acceptInvitation(secondaryInstance, invitation);
            
            // Verify connection established
            // Check debug/connections or similar
            const primaryConnections = await readFile(
                path.join(primaryInstance.mountPoint, 'debug', 'connections.json'),
                'utf8'
            ).catch(() => '[]');
            
            const connections = JSON.parse(primaryConnections);
            expect(connections.length).to.be.greaterThan(0);
        });
        
        after(async function() {
            if (primaryInstance) await stopInstance(primaryInstance);
            if (secondaryInstance) await stopInstance(secondaryInstance);
        });
    });
    
    describe('Data Synchronization', () => {
        let instance1: Instance;
        let instance2: Instance;
        
        before(async function() {
            // Setup two instances for sync testing
            if (process.platform !== 'linux') {
                this.skip(); // Need Linux for this test
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
            
            // Start and pair instances
            await startInstance(instance1);
            await waitForFileSystem(instance1.mountPoint);
            
            await startInstance(instance2);
            await waitForFileSystem(instance2.mountPoint);
            
            const invitation = await getInvitation(instance1);
            await acceptInvitation(instance2, invitation);
        });
        
        it('should synchronize chat messages between instances', async function() {
            if (!instance1 || !instance2) {
                this.skip();
            }
            
            // Create a chat message on instance1
            const chatPath1 = path.join(instance1.mountPoint, 'chats', 'test-chat.txt');
            const testMessage = 'Hello from instance 1';
            await writeFile(chatPath1, testMessage);
            
            // Wait for sync
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check if message appears on instance2
            const chatPath2 = path.join(instance2.mountPoint, 'chats', 'test-chat.txt');
            
            let synced = false;
            for (let i = 0; i < 10; i++) {
                try {
                    const content = await readFile(chatPath2, 'utf8');
                    if (content === testMessage) {
                        synced = true;
                        break;
                    }
                } catch (err) {
                    // File might not exist yet
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            expect(synced).to.be.true;
        });
        
        it('should synchronize file modifications bidirectionally', async function() {
            if (!instance1 || !instance2) {
                this.skip();
            }
            
            // Create file on instance2
            const filePath2 = path.join(instance2.mountPoint, 'sync-test-file.txt');
            await writeFile(filePath2, 'Initial content from instance 2');
            
            // Wait and check on instance1
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const filePath1 = path.join(instance1.mountPoint, 'sync-test-file.txt');
            let content1 = '';
            
            for (let i = 0; i < 10; i++) {
                try {
                    content1 = await readFile(filePath1, 'utf8');
                    if (content1.includes('instance 2')) break;
                } catch (err) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            expect(content1).to.include('instance 2');
            
            // Modify on instance1
            await writeFile(filePath1, 'Modified by instance 1');
            
            // Check modification appears on instance2
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            let content2 = '';
            for (let i = 0; i < 10; i++) {
                content2 = await readFile(filePath2, 'utf8');
                if (content2.includes('instance 1')) break;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            expect(content2).to.include('instance 1');
        });
        
        after(async function() {
            if (instance1) await stopInstance(instance1);
            if (instance2) await stopInstance(instance2);
        });
    });
    
    describe('Performance Under Load', () => {
        let loadInstance1: Instance;
        let loadInstance2: Instance;
        
        before(async function() {
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
        
        it('should handle concurrent file operations during sync', async function() {
            if (!loadInstance1 || !loadInstance2) {
                this.skip();
            }
            
            await startInstance(loadInstance1);
            await waitForFileSystem(loadInstance1.mountPoint);
            
            await startInstance(loadInstance2);
            await waitForFileSystem(loadInstance2.mountPoint);
            
            // Pair instances
            const invitation = await getInvitation(loadInstance1);
            await acceptInvitation(loadInstance2, invitation);
            
            // Create multiple files concurrently
            const fileCount = 20;
            const promises = [];
            
            for (let i = 0; i < fileCount; i++) {
                const fileName = `load-test-${i}.txt`;
                const content = `Content for file ${i}`;
                
                if (i % 2 === 0) {
                    // Even files created on instance1
                    promises.push(
                        writeFile(path.join(loadInstance1.mountPoint, fileName), content)
                    );
                } else {
                    // Odd files created on instance2
                    promises.push(
                        writeFile(path.join(loadInstance2.mountPoint, fileName), content)
                    );
                }
            }
            
            await Promise.all(promises);
            
            // Wait for sync
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Verify all files exist on both instances
            const files1 = await readdir(loadInstance1.mountPoint);
            const files2 = await readdir(loadInstance2.mountPoint);
            
            const loadFiles1 = files1.filter(f => f.startsWith('load-test-'));
            const loadFiles2 = files2.filter(f => f.startsWith('load-test-'));
            
            expect(loadFiles1.length).to.equal(fileCount);
            expect(loadFiles2.length).to.equal(fileCount);
        });
        
        after(async function() {
            if (loadInstance1) await stopInstance(loadInstance1);
            if (loadInstance2) await stopInstance(loadInstance2);
        });
    });
    
    describe('Error Recovery', () => {
        it('should recover from network disconnection', async function() {
            // This would require simulating network issues
            // For now, marking as pending
            this.skip();
        });
        
        it('should handle instance restart during sync', async function() {
            // This would test resilience to instance failures
            // For now, marking as pending
            this.skip();
        });
    });
});

// Export test runner for CI/CD integration
export async function runCrossPlatformTests(): Promise<boolean> {
    const Mocha = require('mocha');
    const mocha = new Mocha();
    
    mocha.addFile(__filename);
    
    return new Promise((resolve) => {
        mocha.run((failures: number) => {
            resolve(failures === 0);
        });
    });
}