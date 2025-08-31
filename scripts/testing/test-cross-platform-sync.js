#!/usr/bin/env node

/**
 * Cross-platform ONE.filer synchronization test
 * Tests data synchronization between Windows (ProjFS) and Linux (FUSE3) versions
 */

import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class CrossPlatformSyncTest {
    constructor() {
        this.testDir = path.join(process.cwd(), 'test-sync-output');
        this.linuxMountPoint = '/tmp/one-filer-linux-test';
        this.windowsMountPoint = 'C:\\OneFilerTest';
        this.testStartTime = Date.now();
    }

    async setup() {
        console.log('📋 Setting up test environment...');
        
        // Create test output directory
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
        }
        
        // Cleanup any existing mounts
        await this.cleanup();
        
        console.log('✅ Test environment ready');
    }

    async cleanup() {
        console.log('🧹 Cleaning up previous test runs...');
        
        // Kill any running instances
        try {
            if (process.platform === 'win32') {
                await execAsync('taskkill /F /IM electron.exe 2>nul');
                await execAsync('wmic process where "name=\'node.exe\' and commandline like \'%one.filer%\'" delete 2>nul');
            } else {
                await execAsync('pkill -f "one.filer" 2>/dev/null || true');
                await execAsync(`fusermount -u ${this.linuxMountPoint} 2>/dev/null || true`);
                await execAsync(`rm -rf ${this.linuxMountPoint} 2>/dev/null || true`);
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    async startLinuxInstance() {
        console.log('\n🐧 Starting Linux FUSE3 instance...');
        
        // Create mount point
        await execAsync(`mkdir -p ${this.linuxMountPoint}`);
        
        // Start Linux instance with FUSE3
        const linuxProcess = spawn('npm', ['start', '--', 
            'start',
            '-s', 'test123',
            '-c', 'configs/linux-test.json',
            '-m', this.linuxMountPoint
        ], {
            cwd: process.cwd(),
            stdio: 'pipe',
            env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0' }
        });

        // Capture output
        const outputFile = path.join(this.testDir, 'linux-instance.log');
        const outputStream = fs.createWriteStream(outputFile);
        
        linuxProcess.stdout.pipe(outputStream);
        linuxProcess.stderr.pipe(outputStream);
        
        // Wait for mount to be ready
        await this.waitForMount(this.linuxMountPoint, 'Linux FUSE3');
        
        return linuxProcess;
    }

    async startWindowsInstance() {
        console.log('\n🪟 Starting Windows ProjFS instance...');
        
        // Start Windows instance with ProjFS
        const windowsProcess = spawn('cmd', ['/c', 'npm', 'run', 'start:native', '--',
            'start',
            '-s', 'test123',
            '-c', 'configs\\windows-test.json',
            '-m', this.windowsMountPoint
        ], {
            cwd: process.cwd(),
            stdio: 'pipe',
            env: { ...process.env, NODE_ENV: 'test' }
        });

        // Capture output
        const outputFile = path.join(this.testDir, 'windows-instance.log');
        const outputStream = fs.createWriteStream(outputFile);
        
        windowsProcess.stdout.pipe(outputStream);
        windowsProcess.stderr.pipe(outputStream);
        
        // Wait for mount to be ready
        await this.waitForMount(this.windowsMountPoint, 'Windows ProjFS');
        
        return windowsProcess;
    }

    async waitForMount(mountPoint, instanceName) {
        console.log(`⏳ Waiting for ${instanceName} mount at ${mountPoint}...`);
        
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                // Check if mount point is accessible
                if (process.platform === 'win32') {
                    await execAsync(`dir "${mountPoint}" 2>nul`);
                } else {
                    await execAsync(`ls "${mountPoint}" 2>/dev/null`);
                }
                
                console.log(`✅ ${instanceName} mount is ready`);
                return;
            } catch (e) {
                // Not ready yet
                await sleep(1000);
            }
        }
        
        throw new Error(`${instanceName} mount failed to become ready after ${maxWaitTime}ms`);
    }

    async getInvitationUrl(mountPoint) {
        console.log(`📨 Getting invitation URL from ${mountPoint}...`);
        
        const invitesPath = path.join(mountPoint, 'invites');
        
        try {
            // List invitation files
            const files = fs.readdirSync(invitesPath);
            const inviteFile = files.find(f => f.endsWith('.txt') && f.includes('invite'));
            
            if (!inviteFile) {
                throw new Error('No invitation file found');
            }
            
            // Read invitation URL
            const invitePath = path.join(invitesPath, inviteFile);
            const inviteContent = fs.readFileSync(invitePath, 'utf8');
            
            // Extract URL from content
            const urlMatch = inviteContent.match(/https?:\/\/[^\s]+/);
            if (!urlMatch) {
                throw new Error('No URL found in invitation file');
            }
            
            console.log(`✅ Found invitation URL: ${urlMatch[0].substring(0, 50)}...`);
            return urlMatch[0];
        } catch (error) {
            console.error(`❌ Failed to get invitation URL: ${error.message}`);
            throw error;
        }
    }

    async acceptInvitation(mountPoint, invitationUrl) {
        console.log(`🤝 Accepting invitation at ${mountPoint}...`);
        
        const acceptPath = path.join(mountPoint, 'invites', 'accept.txt');
        
        try {
            // Write invitation URL to accept file
            fs.writeFileSync(acceptPath, invitationUrl);
            console.log(`✅ Invitation accepted`);
            
            // Wait for connection to establish
            await sleep(3000);
        } catch (error) {
            console.error(`❌ Failed to accept invitation: ${error.message}`);
            throw error;
        }
    }

    async testDataSync(sourceMountPoint, targetMountPoint, instanceName) {
        console.log(`\n📝 Testing data synchronization from ${instanceName}...`);
        
        const testData = {
            filename: `test-${Date.now()}.txt`,
            content: `Test data from ${instanceName} at ${new Date().toISOString()}\nThis should sync to the other instance.`
        };
        
        try {
            // Write test file in source
            const sourcePath = path.join(sourceMountPoint, 'chats', 'test', testData.filename);
            console.log(`Writing test file: ${sourcePath}`);
            fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
            fs.writeFileSync(sourcePath, testData.content);
            console.log(`✅ Test file written`);
            
            // Wait for sync
            console.log(`⏳ Waiting for synchronization...`);
            await sleep(5000);
            
            // Check if file appears in target
            const targetPath = path.join(targetMountPoint, 'chats', 'test', testData.filename);
            console.log(`Checking for synced file: ${targetPath}`);
            
            if (fs.existsSync(targetPath)) {
                const syncedContent = fs.readFileSync(targetPath, 'utf8');
                if (syncedContent === testData.content) {
                    console.log(`✅ Data synchronized successfully!`);
                    return true;
                } else {
                    console.error(`❌ Synced file has different content`);
                    console.error(`Expected: ${testData.content}`);
                    console.error(`Got: ${syncedContent}`);
                    return false;
                }
            } else {
                console.error(`❌ File not synchronized to target`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Sync test failed: ${error.message}`);
            return false;
        }
    }

    async runTest() {
        console.log('🚀 Starting Cross-Platform ONE.filer Sync Test');
        console.log('=' .repeat(60));
        
        let linuxProcess, windowsProcess;
        let testPassed = true;
        
        try {
            await this.setup();
            
            // Determine which platform we're running on
            if (process.platform === 'win32') {
                console.log('Running on Windows - will test Windows -> Linux sync');
                
                // Start Windows instance first
                windowsProcess = await this.startWindowsInstance();
                await sleep(3000);
                
                // Get invitation from Windows
                const inviteUrl = await this.getInvitationUrl(this.windowsMountPoint);
                
                // Start Linux instance in WSL
                console.log('Starting Linux instance in WSL...');
                const wslResult = await execAsync(`wsl bash -c "cd /mnt/c/Users/juerg/source/one.filer && npm start -- start -s test123 -c configs/linux-test.json -m ${this.linuxMountPoint} &"`);
                await this.waitForMount(`\\\\wsl$\\Ubuntu${this.linuxMountPoint}`, 'Linux FUSE3 via WSL');
                
                // Accept invitation in Linux
                await this.acceptInvitation(`\\\\wsl$\\Ubuntu${this.linuxMountPoint}`, inviteUrl);
                
                // Test sync both ways
                const winToLinux = await this.testDataSync(this.windowsMountPoint, `\\\\wsl$\\Ubuntu${this.linuxMountPoint}`, 'Windows');
                const linuxToWin = await this.testDataSync(`\\\\wsl$\\Ubuntu${this.linuxMountPoint}`, this.windowsMountPoint, 'Linux');
                
                testPassed = winToLinux && linuxToWin;
                
            } else {
                console.log('Running on Linux/WSL - will test Linux -> Windows sync');
                
                // Start Linux instance first
                linuxProcess = await this.startLinuxInstance();
                await sleep(3000);
                
                // Get invitation from Linux
                const inviteUrl = await this.getInvitationUrl(this.linuxMountPoint);
                
                // We can't start Windows process from Linux, so just document the manual test steps
                console.log('\n📋 Manual Windows Test Steps:');
                console.log('1. Open a Windows terminal');
                console.log('2. Navigate to: C:\\Users\\juerg\\source\\one.filer');
                console.log('3. Run: npm run start:native -- start -s test123 -c configs\\windows-test.json');
                console.log(`4. Create file: ${this.windowsMountPoint}\\invites\\accept.txt`);
                console.log(`5. Paste this URL into accept.txt: ${inviteUrl}`);
                console.log('6. Test file synchronization between the instances');
                
                testPassed = false; // Manual intervention required
            }
            
        } catch (error) {
            console.error(`\n❌ Test failed: ${error.message}`);
            console.error(error.stack);
            testPassed = false;
        } finally {
            // Cleanup
            console.log('\n🧹 Cleaning up test instances...');
            
            if (linuxProcess) {
                linuxProcess.kill();
            }
            if (windowsProcess) {
                windowsProcess.kill();
            }
            
            await this.cleanup();
            
            // Report results
            console.log('\n' + '=' .repeat(60));
            if (testPassed) {
                console.log('✅ CROSS-PLATFORM SYNC TEST PASSED');
            } else {
                console.log('❌ CROSS-PLATFORM SYNC TEST FAILED');
            }
            console.log(`⏱️ Test duration: ${((Date.now() - this.testStartTime) / 1000).toFixed(2)}s`);
            
            // Save detailed results
            const resultsFile = path.join(this.testDir, 'test-results.json');
            fs.writeFileSync(resultsFile, JSON.stringify({
                testPassed,
                platform: process.platform,
                timestamp: new Date().toISOString(),
                duration: Date.now() - this.testStartTime
            }, null, 2));
            
            console.log(`📄 Results saved to: ${resultsFile}`);
            
            process.exit(testPassed ? 0 : 1);
        }
    }
}

// Run the test
const test = new CrossPlatformSyncTest();
test.runTest().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});