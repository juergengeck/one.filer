/**
 * Run Fresh OneFiler with Correct URL
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const timestamp = Date.now();
const mountPoint = `C:\\FreshOneFiler${timestamp}`;
const dataDir = `fresh-onefiler-${timestamp}`;
const secret = `fresh-${timestamp}`;

console.log('============================================================');
console.log('🚀 STARTING FRESH ONE.FILER WITH leute.dev.refinio.one');
console.log('============================================================');
console.log();
console.log(`Mount Point: ${mountPoint}`);
console.log(`Data Dir: ${dataDir}`);
console.log();

// Create data directory
fs.mkdirSync(dataDir, { recursive: true });

// Create config
const config = {
    directory: dataDir,
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

// Start instance
const proc = spawn('node', [
    'lib/index.js',
    'start',
    '-s', secret,
    '-c', configPath
], {
    cwd: process.cwd(),
    stdio: 'inherit'
});

// Keep running until Ctrl+C
process.on('SIGINT', () => {
    console.log('\nStopping...');
    proc.kill();
    process.exit(0);
});

console.log('Starting ONE.filer...');
console.log('The mount will be available at:', mountPoint);
console.log();
console.log('Once started, check the invites at:');
console.log(`  ${mountPoint}\\invites`);
console.log();
console.log('Press Ctrl+C to stop');
console.log();