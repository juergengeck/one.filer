/**
 * Setup two ONE.filer instances that can pair with each other
 * One Windows (ProjFS) and one Linux (FUSE) instance
 */

import Replicant from './lib/Replicant.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';

const COMM_SERVER = 'wss://comm10.dev.refinio.one';
const PAIRING_URL = 'https://edda.dev.refinio.one';

async function setupPairedInstances() {
    console.log('🔗 Setting up paired ONE.filer instances...');
    console.log('================================================');
    
    try {
        // 1. Setup Windows instance (ProjFS)
        console.log('\n1️⃣ Setting up Windows instance (ProjFS)...');
        
        const windowsConfig = {
            directory: './data-windows-projfs',
            commServerUrl: COMM_SERVER,
            createEveryoneGroup: true,
            useFiler: true,
            filerConfig: {
                useProjFS: true,
                projfsRoot: 'C:\\OneFilerWindows',
                projfsCacheSize: 104857600,
                mountPoint: 'C:\\OneFilerWindows',
                pairingUrl: PAIRING_URL,
                iomMode: 'full',
                logCalls: false  // Reduce logging
            },
            connectionsConfig: {
                commServerUrl: COMM_SERVER,
                acceptIncomingConnections: true,
                acceptUnknownInstances: true,  // Important for pairing
                acceptUnknownPersons: true,    // Important for pairing
                allowPairing: true,
                pairingTokenExpirationDuration: 3600000, // 1 hour
                establishOutgoingConnections: true
            }
        };
        
        // Save Windows config
        writeFileSync('./config-windows-instance.json', JSON.stringify(windowsConfig, null, 2));
        console.log('   ✅ Windows config saved to config-windows-instance.json');
        
        // 2. Setup Linux instance (FUSE) 
        console.log('\n2️⃣ Setting up Linux instance (FUSE)...');
        
        const linuxConfig = {
            directory: './data-linux-fuse',
            commServerUrl: COMM_SERVER,
            createEveryoneGroup: true,
            useFiler: true,
            filerConfig: {
                useProjFS: false,  // Force FUSE mode
                mountPoint: '/tmp/one-filer-linux',
                pairingUrl: PAIRING_URL,
                iomMode: 'full',
                logCalls: false,
                fuseOptions: {
                    force: true,
                    mkdir: true
                }
            },
            connectionsConfig: {
                commServerUrl: COMM_SERVER,
                acceptIncomingConnections: true,
                acceptUnknownInstances: true,
                acceptUnknownPersons: true,
                allowPairing: true,
                pairingTokenExpirationDuration: 3600000,
                establishOutgoingConnections: true
            }
        };
        
        // Save Linux config
        writeFileSync('./config-linux-instance.json', JSON.stringify(linuxConfig, null, 2));
        console.log('   ✅ Linux config saved to config-linux-instance.json');
        
        // 3. Create start scripts
        console.log('\n3️⃣ Creating start scripts...');
        
        // Windows start script
        const windowsStartScript = `
import Replicant from './lib/Replicant.js';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./config-windows-instance.json', 'utf8'));
const replicant = new Replicant(config);

console.log('🪟 Starting Windows ProjFS instance...');
console.log('📡 Communication server:', config.commServerUrl);

await replicant.start('windows-secret-123');

console.log('✅ Windows instance started!');
console.log('📁 Mount point:', config.filerConfig.projfsRoot);
console.log('📋 To get invitation: Check C:\\\\OneFilerWindows\\\\invites\\\\iom_invite.txt');

// Keep running
process.on('SIGINT', async () => {
    console.log('\\n🛑 Shutting down Windows instance...');
    await replicant.stop();
    process.exit(0);
});

// Keep the process alive
await new Promise(() => {});
`;
        writeFileSync('./start-windows-instance.js', windowsStartScript);
        console.log('   ✅ Created start-windows-instance.js');
        
        // Linux start script with invitation acceptance
        const linuxStartScript = `
import Replicant from './lib/Replicant.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { setTimeout } from 'timers/promises';

const config = JSON.parse(readFileSync('./config-linux-instance.json', 'utf8'));
const replicant = new Replicant(config);

console.log('🐧 Starting Linux FUSE instance...');
console.log('📡 Communication server:', config.commServerUrl);

await replicant.start('linux-secret-456');

console.log('✅ Linux instance started!');
console.log('📁 Mount point:', config.filerConfig.mountPoint);

// Wait for filesystem to be ready
console.log('⏳ Waiting for filesystem to be ready...');
await setTimeout(3000);

// Try to accept Windows invitation if available
const invitationFile = './windows-invitation.txt';
if (existsSync(invitationFile)) {
    console.log('📧 Found Windows invitation, attempting to accept...');
    const invitation = readFileSync(invitationFile, 'utf8').trim();
    
    const acceptPath = config.filerConfig.mountPoint + '/invites/accept/invitation.txt';
    try {
        writeFileSync(acceptPath, invitation);
        console.log('✅ Invitation written to accept path');
        
        await setTimeout(3000);
        
        // Check status
        const statusPath = config.filerConfig.mountPoint + '/invites/accept/status.txt';
        if (existsSync(statusPath)) {
            const status = readFileSync(statusPath, 'utf8');
            console.log('📊 Pairing status:', status);
        }
        
        // Check connections
        const connectionsPath = config.filerConfig.mountPoint + '/invites/connections.txt';
        if (existsSync(connectionsPath)) {
            const connections = readFileSync(connectionsPath, 'utf8');
            console.log('🔗 Connections:', connections);
        }
    } catch (e) {
        console.error('❌ Failed to accept invitation:', e.message);
    }
} else {
    console.log('ℹ️  No Windows invitation found');
    console.log('📋 Linux invitation available at:', config.filerConfig.mountPoint + '/invites/iom_invite.txt');
}

// Keep running
process.on('SIGINT', async () => {
    console.log('\\n🛑 Shutting down Linux instance...');
    await replicant.stop();
    process.exit(0);
});

// Keep the process alive
await new Promise(() => {});
`;
        writeFileSync('./start-linux-instance.js', linuxStartScript);
        console.log('   ✅ Created start-linux-instance.js');
        
        // 4. Create pairing helper script
        const pairingScript = `
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { setTimeout } from 'timers/promises';

async function performPairing() {
    console.log('🤝 Pairing Helper');
    console.log('=================');
    
    // Extract Windows invitation
    const windowsInvitePath = 'C:\\\\OneFilerWindows\\\\invites\\\\iom_invite.txt';
    const linuxAcceptPath = '/tmp/one-filer-linux/invites/accept/invitation.txt';
    
    console.log('📋 Step 1: Extract invitation from Windows instance');
    console.log('   Path:', windowsInvitePath);
    
    if (!existsSync(windowsInvitePath)) {
        console.log('❌ Windows invitation not found. Make sure Windows instance is running.');
        return;
    }
    
    const invitation = readFileSync(windowsInvitePath, 'utf8').trim();
    console.log('✅ Invitation extracted:', invitation.substring(0, 50) + '...');
    
    console.log('\\n📋 Step 2: Write invitation to Linux accept path');
    console.log('   Path:', linuxAcceptPath);
    
    try {
        writeFileSync(linuxAcceptPath, invitation);
        console.log('✅ Invitation written');
        
        console.log('\\n⏳ Waiting for pairing to complete...');
        await setTimeout(5000);
        
        // Check Linux status
        const statusPath = '/tmp/one-filer-linux/invites/accept/status.txt';
        if (existsSync(statusPath)) {
            const status = readFileSync(statusPath, 'utf8');
            console.log('\\n📊 Pairing Status:');
            console.log(status);
        }
        
        // Check connections on both sides
        console.log('\\n🔗 Checking connections...');
        
        const windowsConnections = 'C:\\\\OneFilerWindows\\\\invites\\\\connections.txt';
        if (existsSync(windowsConnections)) {
            console.log('Windows connections:', readFileSync(windowsConnections, 'utf8'));
        }
        
        const linuxConnections = '/tmp/one-filer-linux/invites/connections.txt';
        if (existsSync(linuxConnections)) {
            console.log('Linux connections:', readFileSync(linuxConnections, 'utf8'));
        }
        
        console.log('\\n✅ Pairing process complete!');
        
    } catch (e) {
        console.error('❌ Failed to complete pairing:', e.message);
    }
}

performPairing().catch(console.error);
`;
        writeFileSync('./perform-pairing.js', pairingScript);
        console.log('   ✅ Created perform-pairing.js');
        
        // 5. Instructions
        console.log('\n' + '='.repeat(60));
        console.log('📋 INSTRUCTIONS FOR PAIRING TWO INSTANCES:');
        console.log('='.repeat(60));
        console.log('\n1. Start Windows instance (in one terminal):');
        console.log('   node start-windows-instance.js');
        console.log('\n2. Wait for it to fully initialize');
        console.log('\n3. Start Linux instance (in another terminal):');
        console.log('   node start-linux-instance.js');
        console.log('\n4. After both are running, perform pairing:');
        console.log('   node perform-pairing.js');
        console.log('\n5. The instances should now be connected!');
        console.log('\nℹ️  Both instances will connect to:', COMM_SERVER);
        console.log('ℹ️  Windows mount: C:\\OneFilerWindows');
        console.log('ℹ️  Linux mount: /tmp/one-filer-linux');
        console.log('\n✨ Once paired, changes in one filesystem will sync to the other!');
        
    } catch (error) {
        console.error('💥 Error setting up paired instances:', error);
    }
}

// Run the setup
setupPairedInstances().catch(console.error);