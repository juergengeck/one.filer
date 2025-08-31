import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Test minimal instance startup
console.log('Testing minimal instance startup...');

const timestamp = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
const dataDir = path.resolve(process.cwd(), 'test-minimal-' + timestamp);
const secret = 'minimal-test-' + timestamp;

// Create absolute path data directory
fs.mkdirSync(dataDir, { recursive: true });

console.log('Data directory:', dataDir);
console.log('Secret:', secret);

const proc = spawn('node', [
    'lib/index.js',
    'start',
    '-s', secret,
    '-d', dataDir,
    '--filer', 'false'
], {
    cwd: process.cwd(),
    stdio: 'pipe'
});

let output = '';
let errorOutput = '';

proc.stdout.on('data', (data) => {
    const str = data.toString();
    output += str;
    console.log('[OUT]:', str.trim());
});

proc.stderr.on('data', (data) => {
    const str = data.toString();
    errorOutput += str;
    console.error('[ERR]:', str.trim());
});

proc.on('exit', (code, signal) => {
    console.log(`Process exited with code ${code}, signal ${signal}`);
    
    // Clean up
    try {
        fs.rmSync(dataDir, { recursive: true, force: true });
        console.log('Cleaned up data directory');
    } catch (err) {
        console.error('Failed to clean up:', err.message);
    }
    
    process.exit(code || 0);
});

// Kill after 10 seconds
setTimeout(() => {
    console.log('Killing process after timeout');
    proc.kill('SIGTERM');
    
    setTimeout(() => {
        proc.kill('SIGKILL');
    }, 2000);
}, 10000);