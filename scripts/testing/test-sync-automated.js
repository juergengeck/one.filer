#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { setTimeout } from 'timers/promises';
import path from 'path';

console.log('🚀 ONE.filer Cross-Platform Sync Test');
console.log('=====================================\n');

// Test configuration
const TEST1_DIR = './data-test-1';
const TEST2_DIR = './data-test-2';
const MOUNT1 = '/tmp/test-mount-1';
const MOUNT2 = '/tmp/test-mount-2';

// Cleanup previous test
console.log('🧹 Cleaning up...');
try {
    await execCmd(`fusermount -u ${MOUNT1}`).catch(() => {});
    await execCmd(`fusermount -u ${MOUNT2}`).catch(() => {});
    rmSync(TEST1_DIR, { recursive: true, force: true });
    rmSync(TEST2_DIR, { recursive: true, force: true });
    console.log('✓ Cleanup complete\n');
} catch(e) {}

// Create configs
const config1 = {
    directory: TEST1_DIR,
    commServerUrl: 'wss://comm10.dev.refinio.one',
    createEveryoneGroup: true,
    useFiler: true,
    filerConfig: {
        mountPoint: MOUNT1,
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
        establishOutgoingConnections: true
    }
};

const config2 = { ...config1, directory: TEST2_DIR, filerConfig: { ...config1.filerConfig, mountPoint: MOUNT2 }};

writeFileSync('test-config-1.json', JSON.stringify(config1, null, 2));
writeFileSync('test-config-2.json', JSON.stringify(config2, null, 2));

// Helper to execute commands
function execCmd(cmd) {
    return new Promise((resolve, reject) => {
        const child = spawn('bash', ['-c', cmd]);
        let output = '';
        child.stdout.on('data', d => output += d);
        child.stderr.on('data', d => output += d);
        child.on('close', code => code === 0 ? resolve(output) : reject(new Error(output)));
    });
}

// Start instances
console.log('🔧 Starting Instance 1...');
const proc1 = spawn('npm', ['start', '--', 'start', '-s', 'test1-secret', '-c', 'test-config-1.json'], 
    { stdio: 'pipe', shell: true });

// Wait for mount
for(let i = 0; i < 30; i++) {
    await setTimeout(1000);
    if(existsSync(`${MOUNT1}/invites`)) break;
}

if(!existsSync(`${MOUNT1}/invites`)) {
    console.error('❌ Instance 1 failed to start');
    process.exit(1);
}
console.log('✓ Instance 1 ready\n');

console.log('🔧 Starting Instance 2...');
const proc2 = spawn('npm', ['start', '--', 'start', '-s', 'test2-secret', '-c', 'test-config-2.json'],
    { stdio: 'pipe', shell: true });

// Wait for mount
for(let i = 0; i < 30; i++) {
    await setTimeout(1000);
    if(existsSync(`${MOUNT2}/invites`)) break;
}

if(!existsSync(`${MOUNT2}/invites`)) {
    console.error('❌ Instance 2 failed to start');
    proc1.kill();
    process.exit(1);
}
console.log('✓ Instance 2 ready\n');

console.log('🤝 Pairing instances...');

// Get invitation from instance 1
let invitation = null;
for(let i = 0; i < 10; i++) {
    try {
        // Try using the parent PairingFileSystem's files
        const inviteFiles = ['iom_invite.txt', 'iop_invite.txt'];
        for(const file of inviteFiles) {
            const invitePath = `${MOUNT1}/invites/${file}`;
            if(existsSync(invitePath)) {
                invitation = readFileSync(invitePath, 'utf8').trim();
                if(invitation && invitation.length > 0) break;
            }
        }
        if(invitation) break;
    } catch(e) {}
    await setTimeout(2000);
}

if(!invitation) {
    console.error('❌ Could not get invitation');
    proc1.kill();
    proc2.kill();
    process.exit(1);
}

console.log('✓ Got invitation\n');

// Accept invitation in instance 2
mkdirSync(`${MOUNT2}/invites/accept`, { recursive: true });
writeFileSync(`${MOUNT2}/invites/accept/invitation.txt`, invitation);
console.log('✓ Invitation accepted\n');

// Wait for connection
console.log('⏳ Waiting for connection...');
await setTimeout(10000);

// Test data sync
console.log('📝 Testing data sync...\n');

const results = [];

// Test 1: Create file in instance 1
console.log('Test 1: Instance 1 → Instance 2');
mkdirSync(`${MOUNT1}/chats`, { recursive: true });
const testData1 = `Test data from instance 1 at ${new Date().toISOString()}`;
writeFileSync(`${MOUNT1}/chats/test1.txt`, testData1);
console.log('  Created test1.txt in instance 1');

await setTimeout(5000);

if(existsSync(`${MOUNT2}/chats/test1.txt`)) {
    const received = readFileSync(`${MOUNT2}/chats/test1.txt`, 'utf8');
    if(received === testData1) {
        console.log('  ✅ PASS: File synced correctly\n');
        results.push('PASS');
    } else {
        console.log('  ❌ FAIL: Content mismatch\n');
        results.push('FAIL');
    }
} else {
    console.log('  ❌ FAIL: File not synced\n');
    results.push('FAIL');
}

// Test 2: Create file in instance 2
console.log('Test 2: Instance 2 → Instance 1');
mkdirSync(`${MOUNT2}/chats`, { recursive: true });
const testData2 = `Test data from instance 2 at ${new Date().toISOString()}`;
writeFileSync(`${MOUNT2}/chats/test2.txt`, testData2);
console.log('  Created test2.txt in instance 2');

await setTimeout(5000);

if(existsSync(`${MOUNT1}/chats/test2.txt`)) {
    const received = readFileSync(`${MOUNT1}/chats/test2.txt`, 'utf8');
    if(received === testData2) {
        console.log('  ✅ PASS: File synced correctly\n');
        results.push('PASS');
    } else {
        console.log('  ❌ FAIL: Content mismatch\n');
        results.push('FAIL');
    }
} else {
    console.log('  ❌ FAIL: File not synced\n');
    results.push('FAIL');
}

// Results
console.log('=====================================');
console.log('RESULTS:');
const passed = results.filter(r => r === 'PASS').length;
const failed = results.filter(r => r === 'FAIL').length;
console.log(`  Passed: ${passed}/${results.length}`);
console.log(`  Failed: ${failed}/${results.length}`);

if(failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
} else {
    console.log('\n⚠️  SOME TESTS FAILED');
}

// Cleanup
proc1.kill();
proc2.kill();
await setTimeout(1000);
await execCmd(`fusermount -u ${MOUNT1}`).catch(() => {});
await execCmd(`fusermount -u ${MOUNT2}`).catch(() => {});

process.exit(failed > 0 ? 1 : 0);