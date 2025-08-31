import '@refinio/one.core/lib/system/load-nodejs.js';  // Load platform modules
import Replicant from './lib/Replicant.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { setTimeout } from 'timers/promises';

// Configuration for second Windows instance
const config = {
    directory: './data-windows-projfs-2',  // Different data directory
    commServerUrl: 'wss://comm10.dev.refinio.one',  // Same server as first instance
    createEveryoneGroup: true,
    useFiler: true,
    filerConfig: {
        useProjFS: true,
        projfsRoot: 'C:\\OneFilerWindows2',  // Different mount point
        projfsCacheSize: 104857600,
        mountPoint: 'C:\\OneFilerWindows2',
        pairingUrl: 'https://edda.dev.refinio.one',
        iomMode: 'full',
        logCalls: false
    },
    connectionsConfig: {
        commServerUrl: 'wss://comm10.dev.refinio.one',
        acceptIncomingConnections: true,
        acceptUnknownInstances: true,
        acceptUnknownPersons: true,
        allowPairing: true,
        pairingTokenExpirationDuration: 3600000,
        establishOutgoingConnections: true
    }
};

const replicant = new Replicant(config);

console.log('🪟 Starting Second Windows ProjFS instance...');
console.log('📡 Communication server:', config.commServerUrl);

await replicant.start('windows-secret-456');  // Different secret

console.log('✅ Second Windows instance started!');
console.log('📁 Mount point:', config.filerConfig.projfsRoot);

// Wait for filesystem to be ready
console.log('⏳ Waiting for filesystem to be ready...');
await setTimeout(3000);

// Try to accept first Windows instance invitation if available
const invitationFile = './windows-invitation.txt';
if (existsSync(invitationFile)) {
    console.log('📧 Found first Windows instance invitation, attempting to accept...');
    const invitation = readFileSync(invitationFile, 'utf8').trim();
    
    const acceptPath = config.filerConfig.mountPoint + '\\invites\\accept\\invitation.txt';
    try {
        writeFileSync(acceptPath, invitation);
        console.log('✅ Invitation written to accept path');
        
        await setTimeout(3000);
        
        // Check status
        const statusPath = config.filerConfig.mountPoint + '\\invites\\accept\\status.txt';
        if (existsSync(statusPath)) {
            const status = readFileSync(statusPath, 'utf8');
            console.log('📊 Pairing status:', status);
        }
        
        // Check connections
        const connectionsPath = config.filerConfig.mountPoint + '\\invites\\connections.txt';
        if (existsSync(connectionsPath)) {
            const connections = readFileSync(connectionsPath, 'utf8');
            console.log('🔗 Connections:', connections);
        }
    } catch (e) {
        console.error('❌ Failed to accept invitation:', e.message);
    }
} else {
    console.log('ℹ️  No invitation found');
    console.log('📋 Second instance invitation available at:', config.filerConfig.mountPoint + '\\invites\\iom_invite.txt');
}

// Keep running
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down second Windows instance...');
    await replicant.stop();
    process.exit(0);
});

// Keep the process alive
await new Promise(() => {});