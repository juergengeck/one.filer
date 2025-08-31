/**
 * Start Fresh Instance with Correct URL
 * This script starts a completely fresh ONE.filer instance with the correct leute.demo.refinio.one URL
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const timestamp = Date.now();
const instanceId = `correct-url-${timestamp}`;

// Create unique paths for this instance
const dataDir = path.join('C:\\', 'OneFilerData', instanceId);
const mountPoint = path.join('C:\\', 'OneFilerCorrect' + timestamp);
const secret = `demo-secret-${timestamp}`;

console.log('================================================================');
console.log('Starting Fresh ONE.filer Instance with Correct URL');
console.log('================================================================');
console.log();
console.log('Configuration:');
console.log(`  Data Directory: ${dataDir}`);
console.log(`  Mount Point: ${mountPoint}`);
console.log(`  Secret: ${secret}`);
console.log(`  Pairing URL: https://leute.demo.refinio.one/invites/invitePartner/?invited=true`);
console.log();

// Ensure data directory exists
fs.mkdirSync(dataDir, { recursive: true });

// Create configuration file
const config = {
    secret: secret,
    dataDirectory: dataDir,
    useFiler: true,
    filerConfig: {
        enabled: true,
        mountPoint: mountPoint,
        logCalls: false,
        pairingUrl: 'https://leute.demo.refinio.one/invites/invitePartner/?invited=true',
        iomMode: 'light'
    },
    commServerUrl: 'wss://comm10.dev.refinio.one'
};

const configPath = path.join(dataDir, 'config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('✅ Configuration file created');
console.log();
console.log('Starting ONE.filer instance...');
console.log('================================');

// Start the instance
const proc = spawn('node', [
    'lib/index.js',
    'start',
    '-s', secret,
    '-c', configPath
], {
    cwd: process.cwd(),
    stdio: 'pipe'
});

let instanceReady = false;

proc.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[STDOUT]:', output.trim());
    
    if (!instanceReady && (output.includes('Replicant started') || output.includes('mounted'))) {
        instanceReady = true;
        console.log();
        console.log('================================================================');
        console.log('✅ INSTANCE STARTED SUCCESSFULLY!');
        console.log('================================================================');
        console.log();
        console.log('Mount point is available at:', mountPoint);
        console.log();
        
        // Wait a bit for filesystem to stabilize, then check invites
        setTimeout(() => checkInvites(), 5000);
    }
});

proc.stderr.on('data', (data) => {
    console.error('[STDERR]:', data.toString().trim());
});

proc.on('exit', (code, signal) => {
    console.log();
    console.log('Process exited with code', code);
    
    if (!instanceReady) {
        console.log();
        console.log('❌ FAILED TO START INSTANCE');
        console.log('This might be due to:');
        console.log('  1. Invalid password error - clear any cached data');
        console.log('  2. ProjFS not enabled - requires admin privileges');
        console.log('  3. Port conflicts - check if another instance is running');
    }
    
    process.exit(code || 1);
});

async function checkInvites() {
    console.log('Checking generated invites...');
    console.log('================================');
    
    const invitesDir = path.join(mountPoint, 'invites');
    
    if (!fs.existsSync(mountPoint)) {
        console.log('❌ Mount point does not exist');
        console.log('   ProjFS might not be working properly');
        return;
    }
    
    if (!fs.existsSync(invitesDir)) {
        console.log('⏳ Waiting for invites directory...');
        setTimeout(checkInvites, 3000);
        return;
    }
    
    const files = fs.readdirSync(invitesDir);
    console.log('📂 Files in invites directory:', files);
    console.log();
    
    // Check text files for correct URL
    const txtFiles = files.filter(f => f.endsWith('.txt'));
    let allCorrect = true;
    
    for (const file of txtFiles) {
        const content = fs.readFileSync(path.join(invitesDir, file), 'utf8');
        console.log(`📄 ${file}:`);
        console.log(`   Content: ${content.substring(0, 80)}...`);
        
        if (content.includes('https://leute.demo.refinio.one/invites/invitePartner/?invited=true')) {
            console.log('   ✅ CORRECT: Uses leute.demo.refinio.one');
        } else if (content.includes('https://leute.dev.refinio.one')) {
            console.log('   ❌ INCORRECT: Uses leute.dev.refinio.one (should be .demo)');
            allCorrect = false;
        } else if (content.includes('https://leute.refinio.one')) {
            console.log('   ❌ INCORRECT: Missing .demo subdomain');
            allCorrect = false;
        } else {
            console.log('   ❓ Unknown URL pattern');
            allCorrect = false;
        }
        console.log();
    }
    
    // Check PNG files
    const pngFiles = files.filter(f => f.endsWith('.png'));
    console.log(`🖼️ PNG files found: ${pngFiles.length}`);
    for (const file of pngFiles) {
        const stats = fs.statSync(path.join(invitesDir, file));
        console.log(`   ${file}: ${stats.size} bytes`);
    }
    
    console.log();
    console.log('================================================================');
    if (allCorrect && txtFiles.length > 0) {
        console.log('🎉 SUCCESS! All invite URLs are using the correct domain!');
        console.log('================================================================');
        console.log();
        console.log('The PNG QR codes should now contain:');
        console.log('  https://leute.demo.refinio.one/invites/invitePartner/?invited=true#...');
        console.log();
        console.log('You can verify by scanning the QR codes in:');
        console.log(`  ${invitesDir}`);
    } else {
        console.log('⚠️ ISSUE DETECTED WITH INVITE URLS');
        console.log('================================================================');
        console.log('Some invites are not using the correct URL.');
        console.log('This instance might be using cached configuration.');
    }
    
    console.log();
    console.log('Instance is running. Press Ctrl+C to stop.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log();
    console.log('Shutting down instance...');
    proc.kill('SIGTERM');
});

console.log();
console.log('Waiting for instance to start (this may take up to 30 seconds)...');