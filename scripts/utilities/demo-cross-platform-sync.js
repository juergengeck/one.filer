/**
 * Cross-Platform Synchronization Demo
 * 
 * This demonstrates:
 * 1. Starting Windows and Linux instances
 * 2. Establishing connection via IOP invite
 * 3. Syncing data between them
 * 
 * NOTE: This is a manual demo script that shows the process.
 * Run with administrator privileges for ProjFS support.
 */

import { spawn, exec as execCallback } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const exec = promisify(execCallback);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

console.log('='.repeat(60));
console.log('ONE.filer Cross-Platform Synchronization Demo');
console.log('='.repeat(60));
console.log();

// Configuration
const timestamp = Date.now();
const DEMO_TIMEOUT = 120000; // 2 minutes

const windowsConfig = {
    secret: 'windows-demo-123',
    dataDirectory: path.resolve(process.cwd(), `demo-data-windows-${timestamp}`),
    mountPoint: `C:\\OneFilerDemoWin${timestamp}`,
    filer: true,
    useProjFS: true,
    filerConfig: {
        enabled: true,
        mountPoint: `C:\\OneFilerDemoWin${timestamp}`,
        logCalls: false,
        pairingUrl: 'https://leute.demo.refinio.one/invites/invitePartner/?invited=true',
        iomMode: 'light'
    },
    commServerUrl: 'wss://comm10.dev.refinio.one'
};

const linuxConfig = {
    secret: 'linux-demo-456',
    dataDirectory: `/tmp/demo-data-linux-${timestamp}`,
    mountPoint: `/tmp/demo-mount-linux-${timestamp}`,
    filer: true,
    useProjFS: false,
    filerConfig: {
        enabled: true,
        mountPoint: `/tmp/demo-mount-linux-${timestamp}`,
        logCalls: false,
        pairingUrl: 'https://leute.demo.refinio.one/invites/invitePartner/?invited=true',
        iomMode: 'light'
    },
    commServerUrl: 'wss://comm10.dev.refinio.one'
};

class DemoInstance {
    constructor(name, config, platform) {
        this.name = name;
        this.config = config;
        this.platform = platform;
        this.process = null;
        this.ready = false;
        this.output = [];
    }

    async start() {
        console.log(`\n📊 Starting ${this.name} instance...`);
        
        // Create config file
        const configPath = `demo-config-${this.name}.json`;
        await writeFile(configPath, JSON.stringify(this.config, null, 2));
        
        // Prepare command
        let command, args;
        if (this.platform === 'windows') {
            command = 'node';
            args = [
                'lib/index.js', 'start',
                '-s', this.config.secret,
                '-c', configPath,
                '--filer', 'true'
            ];
        } else {
            // For WSL
            const wslCwd = process.cwd().replace(/\\/g, '/').replace('C:', '/mnt/c');
            command = 'wsl';
            args = [
                'bash', '-c',
                `cd '${wslCwd}' && node lib/index.js start -s ${this.config.secret} -c ${configPath} --filer true`
            ];
        }
        
        // Start process
        this.process = spawn(command, args, {
            cwd: process.cwd(),
            env: { ...process.env, USE_PROJFS: this.platform === 'windows' ? 'true' : 'false' }
        });
        
        // Capture output
        this.process.stdout.on('data', (data) => {
            const output = data.toString();
            this.output.push(output);
            console.log(`[${this.name}] ${output.trim()}`);
            
            if (output.includes('Replicant started successfully') ||
                output.includes('Filer started') ||
                output.includes('mounted successfully')) {
                this.ready = true;
            }
        });
        
        this.process.stderr.on('data', (data) => {
            const error = data.toString();
            console.error(`[${this.name} ERROR] ${error.trim()}`);
        });
        
        // Wait for ready
        return this.waitForReady();
    }

    async waitForReady(timeout = 30000) {
        const start = Date.now();
        while (!this.ready && (Date.now() - start) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (!this.ready) {
            throw new Error(`${this.name} failed to start within ${timeout}ms`);
        }
        
        console.log(`✅ ${this.name} instance ready!`);
        
        // Additional wait for filesystem to be mounted
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    async stop() {
        if (this.process && !this.process.killed) {
            console.log(`🛑 Stopping ${this.name}...`);
            this.process.kill('SIGTERM');
            
            await new Promise(resolve => {
                this.process.once('exit', resolve);
                setTimeout(resolve, 5000);
            });
        }
        
        // Clean up
        try {
            await fs.promises.unlink(`demo-config-${this.name}.json`);
            if (this.platform === 'windows') {
                await fs.promises.rm(this.config.dataDirectory, { recursive: true, force: true });
            } else {
                await exec(`wsl rm -rf '${this.config.dataDirectory}'`);
            }
        } catch (err) {
            // Ignore cleanup errors
        }
    }
}

async function main() {
    let windowsInstance;
    let linuxInstance;
    
    try {
        // Check prerequisites
        console.log('🔍 Checking prerequisites...');
        
        if (process.platform !== 'win32') {
            throw new Error('This demo requires Windows');
        }
        
        try {
            const { stdout } = await exec('wsl echo "WSL test"');
            console.log('✅ WSL is available');
        } catch (err) {
            throw new Error('WSL is not available. Please install WSL.');
        }
        
        // Check if running as administrator (needed for ProjFS)
        try {
            await exec('net session');
            console.log('✅ Running as administrator');
        } catch (err) {
            console.log('⚠️  Not running as administrator - ProjFS may not work');
        }
        
        // Start instances
        console.log('\n🚀 Starting instances...');
        
        windowsInstance = new DemoInstance('Windows', windowsConfig, 'windows');
        linuxInstance = new DemoInstance('Linux', linuxConfig, 'linux');
        
        await windowsInstance.start();
        await linuxInstance.start();
        
        // Demonstrate the running instances
        console.log('\n🎉 Both instances are running!');
        console.log('📁 Windows mount point:', windowsConfig.mountPoint);
        console.log('📁 Linux mount point:', linuxConfig.mountPoint);
        
        // Check if mount points exist
        const winMountExists = fs.existsSync(windowsConfig.mountPoint);
        const linuxMountExists = await exec(`wsl [ -d '${linuxConfig.mountPoint}' ] && echo "exists" || echo "missing"`);
        
        console.log(`🔍 Windows mount exists: ${winMountExists}`);
        console.log(`🔍 Linux mount exists: ${linuxMountExists.stdout.trim() === 'exists'}`);
        
        if (winMountExists) {
            const winFiles = fs.readdirSync(windowsConfig.mountPoint);
            console.log('📂 Windows files:', winFiles);
        }
        
        if (linuxMountExists.stdout.trim() === 'exists') {
            const linuxFiles = await exec(`wsl ls '${linuxConfig.mountPoint}'`);
            console.log('📂 Linux files:', linuxFiles.stdout.split('\n').filter(f => f.trim()));
        }
        
        console.log('\n💡 To establish connection and sync data:');
        console.log('1. Get invitation from Windows instance invites folder');
        console.log('2. Place invitation in Linux instance invites/accept_invite.txt');
        console.log('3. Create test files in either mount point');
        console.log('4. Watch them sync to the other instance!');
        
        // Keep running for demo
        console.log(`\n⏰ Demo will run for ${DEMO_TIMEOUT/1000} seconds...`);
        console.log('Press Ctrl+C to stop early');
        
        await new Promise(resolve => {
            const timeout = setTimeout(resolve, DEMO_TIMEOUT);
            
            process.on('SIGINT', () => {
                console.log('\n🛑 Demo interrupted by user');
                clearTimeout(timeout);
                resolve();
            });
        });
        
    } catch (err) {
        console.error('\n❌ Demo failed:', err.message);
        process.exit(1);
        
    } finally {
        // Clean up
        console.log('\n🧹 Cleaning up...');
        
        if (windowsInstance) {
            await windowsInstance.stop();
        }
        
        if (linuxInstance) {
            await linuxInstance.stop();
        }
        
        console.log('✅ Demo complete!');
    }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('\n💥 Uncaught error:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled rejection:', reason);
    process.exit(1);
});

// Run the demo
main().catch(err => {
    console.error('\n💥 Demo error:', err.message);
    process.exit(1);
});