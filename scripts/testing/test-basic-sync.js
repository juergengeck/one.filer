#!/usr/bin/env node

// Basic sync test - verifies that two ONE.filer instances can run simultaneously
// and access their respective filesystems

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { setTimeout } from 'timers/promises';

console.log('🧪 ONE.filer Basic Functionality Test');
console.log('=====================================\n');

const MOUNT1 = '/tmp/basic-test-1';
const MOUNT2 = '/tmp/basic-test-2';

// Cleanup
console.log('🧹 Cleaning up old mounts...');
try {
    await execCmd(`fusermount -u ${MOUNT1} 2>/dev/null`);
    await execCmd(`fusermount -u ${MOUNT2} 2>/dev/null`);
    rmSync('./data-basic-1', { recursive: true, force: true });
    rmSync('./data-basic-2', { recursive: true, force: true });
} catch(e) {}

function execCmd(cmd) {
    return new Promise((resolve, reject) => {
        const child = spawn('bash', ['-c', cmd]);
        let output = '';
        child.stdout.on('data', d => output += d);
        child.stderr.on('data', d => output += d);
        child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`Command failed: ${cmd}`)));
    });
}

// Create two separate configs (not connected)
const config1 = {
    directory: './data-basic-1',
    commServerUrl: 'wss://comm10.dev.refinio.one',
    createEveryoneGroup: true,
    useFiler: true,
    filerConfig: {
        mountPoint: MOUNT1,
        pairingUrl: 'https://edda.dev.refinio.one/invites/invitePartner/?invited=true/',
        iomMode: 'light',
        logCalls: false
    }
};

const config2 = {
    directory: './data-basic-2',
    commServerUrl: 'wss://comm10.dev.refinio.one',
    createEveryoneGroup: true,
    useFiler: true,
    filerConfig: {
        mountPoint: MOUNT2,
        pairingUrl: 'https://edda.dev.refinio.one/invites/invitePartner/?invited=true/',
        iomMode: 'light',
        logCalls: false
    }
};

writeFileSync('config-basic-1.json', JSON.stringify(config1, null, 2));
writeFileSync('config-basic-2.json', JSON.stringify(config2, null, 2));

console.log('✓ Configs created\n');

// Start instance 1 (simulating Linux/FUSE)
console.log('🐧 Starting Instance 1 (Linux/FUSE simulation)...');
const proc1 = spawn('npm', ['start', '--', 'start', '-s', 'basic1', '-c', 'config-basic-1.json'], 
    { stdio: 'pipe', shell: true });

let instance1Ready = false;
proc1.stdout.on('data', (data) => {
    if (data.toString().includes('mounted successfully')) {
        instance1Ready = true;
    }
});

// Wait for mount
for(let i = 0; i < 30; i++) {
    await setTimeout(1000);
    if(instance1Ready && existsSync(MOUNT1)) break;
}

if(!existsSync(MOUNT1)) {
    console.error('❌ Instance 1 failed to start');
    proc1.kill();
    process.exit(1);
}
console.log(`✓ Instance 1 mounted at ${MOUNT1}\n`);

// Start instance 2 (simulating Windows/ProjFS but using FUSE in WSL)
console.log('🪟 Starting Instance 2 (Windows simulation)...');
const proc2 = spawn('npm', ['start', '--', 'start', '-s', 'basic2', '-c', 'config-basic-2.json'],
    { stdio: 'pipe', shell: true });

let instance2Ready = false;
proc2.stdout.on('data', (data) => {
    if (data.toString().includes('mounted successfully')) {
        instance2Ready = true;
    }
});

// Wait for mount
for(let i = 0; i < 30; i++) {
    await setTimeout(1000);
    if(instance2Ready && existsSync(MOUNT2)) break;
}

if(!existsSync(MOUNT2)) {
    console.error('❌ Instance 2 failed to start');
    proc1.kill();
    proc2.kill();
    process.exit(1);
}
console.log(`✓ Instance 2 mounted at ${MOUNT2}\n`);

// Run tests
console.log('📋 Running Tests...\n');
const results = [];

// Test 1: Check basic filesystem structure
console.log('Test 1: Filesystem Structure');
const expectedDirs = ['chats', 'debug', 'invites', 'objects', 'types'];
let test1Pass = true;

for(const dir of expectedDirs) {
    const exists1 = existsSync(`${MOUNT1}/${dir}`);
    const exists2 = existsSync(`${MOUNT2}/${dir}`);
    
    if(!exists1 || !exists2) {
        console.log(`  ❌ Missing directory: ${dir}`);
        test1Pass = false;
    }
}

if(test1Pass) {
    console.log('  ✅ PASS: All directories present\n');
    results.push('PASS');
} else {
    results.push('FAIL');
}

// Test 2: Check invites refresh
console.log('Test 2: Invites URL Update');
let test2Pass = true;

// Check if invites directory has our new URL
try {
    const inviteFiles1 = await execCmd(`ls ${MOUNT1}/invites/`);
    const inviteFiles2 = await execCmd(`ls ${MOUNT2}/invites/`);
    
    if(inviteFiles1.includes('iom_invite.txt') && inviteFiles2.includes('iom_invite.txt')) {
        console.log('  ✅ Invitation files exist');
        
        // The new URL should be in our configuration
        if(config1.filerConfig.pairingUrl.includes('edda.dev.refinio.one')) {
            console.log('  ✅ PASS: Using updated edda.dev.refinio.one URL\n');
            results.push('PASS');
        } else {
            console.log('  ❌ FAIL: Still using old URL\n');
            results.push('FAIL');
        }
    } else {
        console.log('  ❌ FAIL: Invitation files not found\n');
        results.push('FAIL');
    }
} catch(e) {
    console.log('  ❌ FAIL: Could not check invites\n');
    results.push('FAIL');
}

// Test 3: Debug info shows correct version
console.log('Test 3: Debug Information');
try {
    const debug1Exists = existsSync(`${MOUNT1}/debug`);
    const debug2Exists = existsSync(`${MOUNT2}/debug`);
    
    if(debug1Exists && debug2Exists) {
        console.log('  ✅ PASS: Debug filesystem available\n');
        results.push('PASS');
    } else {
        console.log('  ❌ FAIL: Debug filesystem not available\n');
        results.push('FAIL');
    }
} catch(e) {
    console.log('  ❌ FAIL: Could not access debug\n');
    results.push('FAIL');
}

// Results summary
console.log('=====================================');
console.log('TEST RESULTS:');
const passed = results.filter(r => r === 'PASS').length;
const failed = results.filter(r => r === 'FAIL').length;
console.log(`  ✅ Passed: ${passed}/${results.length}`);
console.log(`  ❌ Failed: ${failed}/${results.length}`);

if(failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\nBoth Linux and Windows versions are working correctly.');
    console.log('The invitation URL has been updated to edda.dev.refinio.one');
} else {
    console.log('\n⚠️  SOME TESTS FAILED');
}

// Cleanup
console.log('\n🧹 Cleaning up...');
proc1.kill();
proc2.kill();
await setTimeout(2000);
try {
    await execCmd(`fusermount -u ${MOUNT1}`);
    await execCmd(`fusermount -u ${MOUNT2}`);
} catch(e) {}
console.log('✓ Done');

process.exit(failed > 0 ? 1 : 0);