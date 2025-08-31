/**
 * Test Fresh Instance - Start with completely fresh configuration
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const timestamp = Date.now();
const testName = `fresh-test-${timestamp}`;
const testDataDir = path.resolve(process.cwd(), testName, 'data');
const testMountPoint = path.resolve(process.cwd(), testName, 'mount');
const testSecret = `secret-${timestamp}`;

console.log('Fresh Instance Test');
console.log('===================');
console.log(`Data: ${testDataDir}`);
console.log(`Mount: ${testMountPoint}`);
console.log(`Secret: ${testSecret}`);
console.log();

// Ensure directories exist
fs.mkdirSync(testDataDir, { recursive: true });

// Create minimal config
const config = {
    secret: testSecret,
    dataDirectory: testDataDir,
    useFiler: true,
    filerConfig: {
        enabled: true,
        mountPoint: testMountPoint,
        pairingUrl: 'https://leute.demo.refinio.one/invites/invitePartner/?invited=true',
        iomMode: 'light',
        logCalls: false
    },
    commServerUrl: 'wss://comm10.dev.refinio.one'
};

const configPath = path.join(process.cwd(), testName, 'config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Created config at:', configPath);

// Start using config file
const proc = spawn('node', [
    'lib/index.js',
    'start',
    '-s', testSecret,
    '-c', configPath
], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: 'pipe'
});

let output = '';
let errorOutput = '';
let ready = false;

proc.stdout.on('data', (data) => {
    const str = data.toString();
    output += str;
    console.log('[OUT]:', str.trim());
    
    if (!ready && (str.includes('Replicant started') || str.includes('mounted'))) {
        ready = true;
        console.log('\n✅ Instance started!');
        setTimeout(checkInvites, 5000);
    }
});

proc.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.error('[ERR]:', data.toString().trim());
});

proc.on('exit', (code) => {
    console.log(`\nExit code: ${code}`);
    if (!ready) {
        console.log('Full output:', output);
        console.log('Error output:', errorOutput);
    }
    cleanup();
});

async function checkInvites() {
    console.log('\n🔍 Checking invites...');
    
    const invitesDir = path.join(testMountPoint, 'invites');
    if (!fs.existsSync(invitesDir)) {
        console.log('❌ No invites directory');
        proc.kill();
        return;
    }
    
    const files = fs.readdirSync(invitesDir);
    console.log('📂 Files:', files);
    
    for (const file of files.filter(f => f.endsWith('.txt'))) {
        const content = fs.readFileSync(path.join(invitesDir, file), 'utf8');
        const url = content.substring(0, 50);
        console.log(`📄 ${file}: ${url}...`);
        
        if (content.includes('leute.demo.refinio.one')) {
            console.log('   ✅ CORRECT URL!');
        } else {
            console.log('   ❌ INCORRECT URL');
        }
    }
    
    const pngFiles = files.filter(f => f.endsWith('.png'));
    console.log(`\n🖼️ PNG files: ${pngFiles.length}`);
    
    setTimeout(() => {
        console.log('\nStopping...');
        proc.kill();
    }, 3000);
}

function cleanup() {
    try {
        fs.rmSync(path.resolve(process.cwd(), testName), { recursive: true, force: true });
        console.log('✅ Cleaned up');
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
    process.exit(0);
}

process.on('SIGINT', () => {
    proc.kill();
});