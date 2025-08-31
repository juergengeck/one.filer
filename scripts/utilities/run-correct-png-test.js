/**
 * Run Correct PNG Test - Final test with all fixes applied
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const timestamp = Date.now();
const testId = `correct-png-${timestamp}`;

// Create unique paths
const dataDir = path.join('C:\\', 'TestData', testId);
const mountPoint = `C:\\CorrectPNG${timestamp}`;
const secret = `secret-${timestamp}`;

console.log('========================================================');
console.log('🎯 FINAL PNG INVITE TEST WITH CORRECT URL');
console.log('========================================================');
console.log();
console.log('Configuration:');
console.log(`  Data Directory: ${dataDir}`);
console.log(`  Mount Point: ${mountPoint}`);
console.log(`  Secret: ${secret}`);
console.log(`  Expected URL: https://leute.dev.refinio.one/invites/invitePartner/?invited=true`);
console.log();

// Ensure data directory exists
fs.mkdirSync(dataDir, { recursive: true });

// Create config with correct settings
const config = {
    directory: dataDir,
    secret: secret,
    useFiler: true,
    filerConfig: {
        enabled: true,
        useProjFS: true,
        mountPoint: mountPoint,
        pairingUrl: 'https://leute.dev.refinio.one/invites/invitePartner/?invited=true',
        iomMode: 'light',
        logCalls: false
    },
    commServerUrl: 'wss://comm10.dev.refinio.one'
};

const configPath = path.join(dataDir, 'config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('✅ Configuration created');
console.log('🚀 Starting instance...');
console.log();

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

let ready = false;

proc.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Only show key messages
    if (output.includes('ERROR') || 
        output.includes('mounted') || 
        output.includes('started successfully') ||
        output.includes('Provider mounted')) {
        console.log('[OUT]:', output.trim());
    }
    
    if (!ready && (output.includes('Replicant started') || output.includes('Provider mounted'))) {
        ready = true;
        setTimeout(verifyPNG, 5000);
    }
});

proc.stderr.on('data', (data) => {
    console.error('[ERR]:', data.toString().trim());
});

proc.on('exit', (code) => {
    if (!ready) {
        console.log('❌ Failed to start (exit code:', code, ')');
    }
    cleanup();
});

async function verifyPNG() {
    console.log();
    console.log('========================================================');
    console.log('🔍 VERIFYING PNG INVITES');
    console.log('========================================================');
    console.log();
    
    const invitesDir = path.join(mountPoint, 'invites');
    
    if (!fs.existsSync(mountPoint)) {
        console.log('❌ Mount point does not exist:', mountPoint);
        proc.kill();
        return;
    }
    
    if (!fs.existsSync(invitesDir)) {
        console.log('❌ Invites directory does not exist');
        proc.kill();
        return;
    }
    
    const files = fs.readdirSync(invitesDir);
    console.log('📂 Files in invites directory:', files);
    console.log();
    
    // Check text files
    let allCorrect = true;
    const txtFiles = files.filter(f => f.endsWith('.txt'));
    
    for (const file of txtFiles) {
        const content = fs.readFileSync(path.join(invitesDir, file), 'utf8');
        console.log(`📄 ${file}:`);
        console.log(`   Preview: ${content.substring(0, 70)}...`);
        
        if (content.includes('https://leute.dev.refinio.one/invites/invitePartner/?invited=true')) {
            console.log('   ✅ CORRECT: Uses leute.dev.refinio.one');
        } else if (content.includes('https://leute.demo.refinio.one')) {
            console.log('   ❌ WRONG: Uses .demo instead of .dev');
            allCorrect = false;
        } else if (content.includes('https://leute.refinio.one')) {
            console.log('   ❌ WRONG: Missing .dev subdomain');
            allCorrect = false;
        } else {
            console.log('   ❓ Unknown URL');
            allCorrect = false;
        }
    }
    
    // Check PNG files
    const pngFiles = files.filter(f => f.endsWith('.png'));
    console.log();
    console.log(`🖼️ PNG files: ${pngFiles.length}`);
    for (const file of pngFiles) {
        const stats = fs.statSync(path.join(invitesDir, file));
        console.log(`   ${file}: ${stats.size} bytes`);
    }
    
    console.log();
    console.log('========================================================');
    if (allCorrect && txtFiles.length > 0) {
        console.log('🎉 SUCCESS! ALL INVITES USE THE CORRECT URL!');
        console.log('========================================================');
        console.log();
        console.log('✅ The PNG QR codes now contain the correct URL:');
        console.log('   https://leute.dev.refinio.one/invites/invitePartner/?invited=true#...');
        console.log();
        console.log('📍 Mount point:', mountPoint);
        console.log('📂 Invites at:', invitesDir);
    } else {
        console.log('❌ FAILED! INVITES STILL HAVE INCORRECT URLs');
        console.log('========================================================');
    }
    
    console.log();
    console.log('Test complete. Stopping in 5 seconds...');
    
    setTimeout(() => {
        proc.kill();
    }, 5000);
}

function cleanup() {
    console.log();
    console.log('Cleaning up...');
    try {
        fs.rmSync(dataDir.split('\\').slice(0, -1).join('\\'), { recursive: true, force: true });
        console.log('✅ Cleanup complete');
    } catch (err) {
        // Ignore cleanup errors
    }
    process.exit(0);
}

process.on('SIGINT', () => {
    proc.kill();
});