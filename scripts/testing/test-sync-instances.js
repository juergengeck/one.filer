#!/usr/bin/env node

/**
 * Test script to verify data syncing between two ONE.filer instances
 * - Starts Linux/FUSE instance
 * - Starts Windows simulation instance 
 * - Connects them via invitation
 * - Tests data synchronization
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { setTimeout } from 'timers/promises';
import path from 'path';

const LINUX_DATA_DIR = './data-test-linux';
const WINDOWS_DATA_DIR = './data-test-windows';
const LINUX_MOUNT = '/tmp/one-filer-test-linux';
const WINDOWS_MOUNT = '/tmp/one-filer-test-windows';  // Simulated Windows mount in WSL

// Colors for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
    console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

async function cleanupPreviousTest() {
    logSection('🧹 Cleaning up previous test data');
    
    // Clean data directories
    if (existsSync(LINUX_DATA_DIR)) {
        rmSync(LINUX_DATA_DIR, { recursive: true, force: true });
        log(`✓ Removed ${LINUX_DATA_DIR}`, colors.green);
    }
    
    if (existsSync(WINDOWS_DATA_DIR)) {
        rmSync(WINDOWS_DATA_DIR, { recursive: true, force: true });
        log(`✓ Removed ${WINDOWS_DATA_DIR}`, colors.green);
    }
    
    // Unmount any existing FUSE mounts
    try {
        await execCommand(`fusermount -u ${LINUX_MOUNT} 2>/dev/null`);
        log(`✓ Unmounted ${LINUX_MOUNT}`, colors.green);
    } catch (e) {
        // Ignore if not mounted
    }
    
    try {
        await execCommand(`fusermount -u ${WINDOWS_MOUNT} 2>/dev/null`);
        log(`✓ Unmounted ${WINDOWS_MOUNT}`, colors.green);
    } catch (e) {
        // Ignore if not mounted
    }
}

function execCommand(command) {
    return new Promise((resolve, reject) => {
        const child = spawn('bash', ['-c', command]);
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed: ${command}\n${error}`));
            } else {
                resolve(output);
            }
        });
    });
}

async function startInstance(name, config, secret, dataDir) {
    log(`Starting ${name} instance...`, colors.yellow);
    
    // Create config file
    const configPath = `./config-test-${name.toLowerCase()}.json`;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    // Start the instance
    const child = spawn('npm', ['start', '--', 'start', '-s', secret, '-c', configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
    });
    
    // Capture output for debugging
    let ready = false;
    const readyPromise = new Promise((resolve) => {
        child.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Filer file system was mounted') || 
                output.includes('filesystem mounted successfully')) {
                ready = true;
                resolve();
            }
            // Log output with instance prefix
            output.split('\n').forEach(line => {
                if (line.trim()) {
                    console.log(`[${name}] ${line}`);
                }
            });
        });
        
        child.stderr.on('data', (data) => {
            console.error(`[${name} ERROR] ${data.toString()}`);
        });
    });
    
    // Wait for ready with timeout
    await Promise.race([
        readyPromise,
        setTimeout(30000).then(() => {
            if (!ready) {
                throw new Error(`${name} instance failed to start within 30 seconds`);
            }
        })
    ]);
    
    log(`✓ ${name} instance started successfully`, colors.green);
    
    return child;
}

async function getInvitation(mountPath) {
    const invitePath = path.join(mountPath, 'invites', 'iom_invite.txt');
    
    // Wait for invitation file to be available
    let attempts = 0;
    while (!existsSync(invitePath) && attempts < 10) {
        await setTimeout(1000);
        attempts++;
    }
    
    if (!existsSync(invitePath)) {
        throw new Error(`Invitation file not found at ${invitePath}`);
    }
    
    const invitation = readFileSync(invitePath, 'utf8').trim();
    log(`✓ Got invitation from ${mountPath}`, colors.green);
    return invitation;
}

async function acceptInvitation(mountPath, invitation) {
    const acceptPath = path.join(mountPath, 'invites', 'accept', 'invitation.txt');
    
    // Ensure accept directory exists
    const acceptDir = path.dirname(acceptPath);
    if (!existsSync(acceptDir)) {
        mkdirSync(acceptDir, { recursive: true });
    }
    
    // Write invitation to accept
    writeFileSync(acceptPath, invitation);
    log(`✓ Wrote invitation to ${acceptPath}`, colors.green);
    
    // Wait for pairing to complete
    await setTimeout(5000);
    
    // Check status
    const statusPath = path.join(mountPath, 'invites', 'accept', 'status.txt');
    if (existsSync(statusPath)) {
        const status = readFileSync(statusPath, 'utf8');
        log(`Pairing status: ${status}`, colors.cyan);
    }
    
    // Check connections
    const connectionsPath = path.join(mountPath, 'invites', 'connections.txt');
    if (existsSync(connectionsPath)) {
        const connections = readFileSync(connectionsPath, 'utf8');
        log(`Connections: ${connections}`, colors.cyan);
        return JSON.parse(connections);
    }
    
    return null;
}

async function testDataSync(mount1, mount2, instance1Name, instance2Name) {
    logSection('📝 Testing Data Synchronization');
    
    const testResults = [];
    
    // Test 1: Create a file in instance 1, verify it appears in instance 2
    log(`\nTest 1: Create file in ${instance1Name}, verify in ${instance2Name}`, colors.bright);
    const testFile1 = path.join(mount1, 'chats', 'test-sync-1.txt');
    const testContent1 = `Test sync from ${instance1Name} at ${new Date().toISOString()}`;
    
    try {
        // Ensure chats directory exists
        const chatsDir1 = path.join(mount1, 'chats');
        if (!existsSync(chatsDir1)) {
            mkdirSync(chatsDir1, { recursive: true });
        }
        
        writeFileSync(testFile1, testContent1);
        log(`✓ Created test file in ${instance1Name}`, colors.green);
        
        // Wait for sync
        await setTimeout(3000);
        
        // Check if file appears in instance 2
        const testFile2 = path.join(mount2, 'chats', 'test-sync-1.txt');
        if (existsSync(testFile2)) {
            const content2 = readFileSync(testFile2, 'utf8');
            if (content2 === testContent1) {
                log(`✓ File synced successfully to ${instance2Name}`, colors.green);
                testResults.push({ test: 'File sync 1->2', status: 'PASS' });
            } else {
                log(`✗ File content mismatch in ${instance2Name}`, colors.red);
                testResults.push({ test: 'File sync 1->2', status: 'FAIL', error: 'Content mismatch' });
            }
        } else {
            log(`✗ File not found in ${instance2Name}`, colors.red);
            testResults.push({ test: 'File sync 1->2', status: 'FAIL', error: 'File not synced' });
        }
    } catch (error) {
        log(`✗ Test 1 failed: ${error.message}`, colors.red);
        testResults.push({ test: 'File sync 1->2', status: 'FAIL', error: error.message });
    }
    
    // Test 2: Create a file in instance 2, verify it appears in instance 1
    log(`\nTest 2: Create file in ${instance2Name}, verify in ${instance1Name}`, colors.bright);
    const testFile3 = path.join(mount2, 'chats', 'test-sync-2.txt');
    const testContent2 = `Test sync from ${instance2Name} at ${new Date().toISOString()}`;
    
    try {
        // Ensure chats directory exists
        const chatsDir2 = path.join(mount2, 'chats');
        if (!existsSync(chatsDir2)) {
            mkdirSync(chatsDir2, { recursive: true });
        }
        
        writeFileSync(testFile3, testContent2);
        log(`✓ Created test file in ${instance2Name}`, colors.green);
        
        // Wait for sync
        await setTimeout(3000);
        
        // Check if file appears in instance 1
        const testFile4 = path.join(mount1, 'chats', 'test-sync-2.txt');
        if (existsSync(testFile4)) {
            const content4 = readFileSync(testFile4, 'utf8');
            if (content4 === testContent2) {
                log(`✓ File synced successfully to ${instance1Name}`, colors.green);
                testResults.push({ test: 'File sync 2->1', status: 'PASS' });
            } else {
                log(`✗ File content mismatch in ${instance1Name}`, colors.red);
                testResults.push({ test: 'File sync 2->1', status: 'FAIL', error: 'Content mismatch' });
            }
        } else {
            log(`✗ File not found in ${instance1Name}`, colors.red);
            testResults.push({ test: 'File sync 2->1', status: 'FAIL', error: 'File not synced' });
        }
    } catch (error) {
        log(`✗ Test 2 failed: ${error.message}`, colors.red);
        testResults.push({ test: 'File sync 2->1', status: 'FAIL', error: error.message });
    }
    
    // Test 3: Update a file in instance 1, verify change in instance 2
    log(`\nTest 3: Update file in ${instance1Name}, verify in ${instance2Name}`, colors.bright);
    try {
        const updatedContent = `Updated content from ${instance1Name} at ${new Date().toISOString()}`;
        writeFileSync(testFile1, updatedContent);
        log(`✓ Updated test file in ${instance1Name}`, colors.green);
        
        // Wait for sync
        await setTimeout(3000);
        
        // Check if update appears in instance 2
        const testFile2 = path.join(mount2, 'chats', 'test-sync-1.txt');
        if (existsSync(testFile2)) {
            const content2 = readFileSync(testFile2, 'utf8');
            if (content2 === updatedContent) {
                log(`✓ File update synced successfully to ${instance2Name}`, colors.green);
                testResults.push({ test: 'File update 1->2', status: 'PASS' });
            } else {
                log(`✗ File update not synced to ${instance2Name}`, colors.red);
                testResults.push({ test: 'File update 1->2', status: 'FAIL', error: 'Update not synced' });
            }
        }
    } catch (error) {
        log(`✗ Test 3 failed: ${error.message}`, colors.red);
        testResults.push({ test: 'File update 1->2', status: 'FAIL', error: error.message });
    }
    
    return testResults;
}

async function runTest() {
    logSection('🚀 ONE.filer Instance Sync Test');
    
    let linuxProcess = null;
    let windowsProcess = null;
    
    try {
        // Clean up previous test
        await cleanupPreviousTest();
        
        // Create configurations
        logSection('📋 Creating Instance Configurations');
        
        const linuxConfig = {
            directory: LINUX_DATA_DIR,
            commServerUrl: 'wss://comm10.dev.refinio.one',
            createEveryoneGroup: true,
            useFiler: true,
            filerConfig: {
                mountPoint: LINUX_MOUNT,
                pairingUrl: 'https://edda.dev.refinio.one/invites/invitePartner/?invited=true/',
                iomMode: 'full',
                logCalls: false
            },
            connectionsConfig: {
                commServerUrl: 'wss://comm10.dev.refinio.one',
                acceptIncomingConnections: true,
                acceptUnknownInstances: true,
                acceptUnknownPersons: true,
                allowPairing: true,
                pairingTokenExpirationDuration: 3600000,
                establishOutgoingConnections: true
            }
        };
        
        const windowsConfig = {
            directory: WINDOWS_DATA_DIR,
            commServerUrl: 'wss://comm10.dev.refinio.one',
            createEveryoneGroup: true,
            useFiler: true,
            filerConfig: {
                mountPoint: WINDOWS_MOUNT,  // Simulated Windows mount
                pairingUrl: 'https://edda.dev.refinio.one/invites/invitePartner/?invited=true/',
                iomMode: 'full',
                logCalls: false
            },
            connectionsConfig: {
                commServerUrl: 'wss://comm10.dev.refinio.one',
                acceptIncomingConnections: true,
                acceptUnknownInstances: true,
                acceptUnknownPersons: true,
                allowPairing: true,
                pairingTokenExpirationDuration: 3600000,
                establishOutgoingConnections: true
            }
        };
        
        // Start instances
        logSection('🔧 Starting ONE.filer Instances');
        
        linuxProcess = await startInstance('Linux', linuxConfig, 'linux-test-123', LINUX_DATA_DIR);
        await setTimeout(2000);  // Give Linux instance time to fully initialize
        
        windowsProcess = await startInstance('Windows', windowsConfig, 'windows-test-456', WINDOWS_DATA_DIR);
        await setTimeout(2000);  // Give Windows instance time to fully initialize
        
        // Perform pairing
        logSection('🤝 Pairing Instances');
        
        // Get invitation from Linux instance
        const linuxInvitation = await getInvitation(LINUX_MOUNT);
        log(`Linux invitation: ${linuxInvitation.substring(0, 50)}...`, colors.cyan);
        
        // Accept invitation in Windows instance
        const connections = await acceptInvitation(WINDOWS_MOUNT, linuxInvitation);
        
        if (connections && connections.length > 0) {
            log(`✓ Instances successfully paired!`, colors.green);
            log(`Active connections: ${connections.length}`, colors.cyan);
        } else {
            log(`⚠ Pairing may not have completed successfully`, colors.yellow);
        }
        
        // Wait for connection to stabilize
        await setTimeout(5000);
        
        // Test data synchronization
        const testResults = await testDataSync(LINUX_MOUNT, WINDOWS_MOUNT, 'Linux', 'Windows');
        
        // Display test results
        logSection('📊 Test Results');
        
        let passCount = 0;
        let failCount = 0;
        
        testResults.forEach(result => {
            if (result.status === 'PASS') {
                log(`✓ ${result.test}: PASS`, colors.green);
                passCount++;
            } else {
                log(`✗ ${result.test}: FAIL - ${result.error}`, colors.red);
                failCount++;
            }
        });
        
        console.log('\n' + '='.repeat(60));
        log(`Total Tests: ${testResults.length}`, colors.bright);
        log(`Passed: ${passCount}`, colors.green);
        log(`Failed: ${failCount}`, failCount > 0 ? colors.red : colors.green);
        
        if (failCount === 0) {
            log('\n🎉 All tests passed successfully!', colors.green + colors.bright);
        } else {
            log(`\n⚠ ${failCount} test(s) failed`, colors.yellow + colors.bright);
        }
        
    } catch (error) {
        log(`\n❌ Test failed with error: ${error.message}`, colors.red + colors.bright);
        console.error(error.stack);
    } finally {
        // Cleanup
        logSection('🧹 Cleaning Up');
        
        if (linuxProcess) {
            linuxProcess.kill();
            log('✓ Stopped Linux instance', colors.green);
        }
        
        if (windowsProcess) {
            windowsProcess.kill();
            log('✓ Stopped Windows instance', colors.green);
        }
        
        // Unmount
        try {
            await execCommand(`fusermount -u ${LINUX_MOUNT} 2>/dev/null`);
            await execCommand(`fusermount -u ${WINDOWS_MOUNT} 2>/dev/null`);
        } catch (e) {
            // Ignore unmount errors
        }
        
        log('\n✓ Test complete', colors.green + colors.bright);
    }
}

// Run the test
runTest().catch(console.error);