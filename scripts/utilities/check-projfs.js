#!/usr/bin/env node
import { spawn } from 'child_process';

console.log('🔍 Checking ProjFS Status on Windows\n');

// Check if ProjFS feature is enabled
console.log('1️⃣ Checking Windows Features...');
const dism = spawn('cmd', ['/c', 'dism', '/online', '/get-featureinfo', '/featurename:Client-ProjFS'], {
    shell: false,
    stdio: 'pipe'
});

let output = '';
dism.stdout.on('data', (data) => {
    output += data.toString();
});

dism.stderr.on('data', (data) => {
    console.error('Error:', data.toString());
});

dism.on('close', (code) => {
    if (code !== 0) {
        console.log('❌ Could not check ProjFS status. Try running as Administrator.');
        checkProjFSDriver();
    } else {
        // Parse the output
        if (output.includes('State : Enabled')) {
            console.log('✅ ProjFS feature is ENABLED');
        } else if (output.includes('State : Disabled')) {
            console.log('❌ ProjFS feature is DISABLED');
            console.log('\n💡 To enable ProjFS:');
            console.log('   1. Open "Turn Windows features on or off"');
            console.log('   2. Check "Windows Projected File System"');
            console.log('   3. Click OK and restart if prompted');
        } else {
            console.log('⚠️  Could not determine ProjFS status');
            console.log('Output:', output);
        }
        checkProjFSDriver();
    }
});

function checkProjFSDriver() {
    console.log('\n2️⃣ Checking ProjFS Driver...');
    
    // Check if projfs.sys driver is loaded
    const sc = spawn('cmd', ['/c', 'sc', 'query', 'projfs'], {
        shell: false,
        stdio: 'pipe'
    });
    
    let driverOutput = '';
    sc.stdout.on('data', (data) => {
        driverOutput += data.toString();
    });
    
    sc.on('close', (code) => {
        if (code === 0 && driverOutput.includes('RUNNING')) {
            console.log('✅ ProjFS driver is RUNNING');
        } else {
            console.log('❌ ProjFS driver is NOT running');
        }
        
        checkExistingMounts();
    });
}

function checkExistingMounts() {
    console.log('\n3️⃣ Checking for existing ProjFS mounts...');
    
    // Use fsutil to check for reparse points
    const fsutil = spawn('cmd', ['/c', 'fsutil', 'reparsepoint', 'query', 'C:\\'], {
        shell: false,
        stdio: 'pipe'
    });
    
    let mountsFound = false;
    
    fsutil.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('IO_REPARSE_TAG_PROJFS')) {
            mountsFound = true;
        }
    });
    
    fsutil.on('close', () => {
        if (mountsFound) {
            console.log('✅ Found existing ProjFS mounts');
        } else {
            console.log('ℹ️  No existing ProjFS mounts found');
        }
        
        console.log('\n📊 Summary:');
        console.log('If ProjFS is not working, try:');
        console.log('1. Enable the feature in Windows Features');
        console.log('2. Restart your computer');
        console.log('3. Run your application as Administrator');
        console.log('4. Check Event Viewer > Applications and Services > Microsoft > Windows > ProjectedFileSystem');
    });
}