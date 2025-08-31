
import '@refinio/one.core/lib/system/load-nodejs.js';  // Load platform modules
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
    console.log('\n🛑 Shutting down Linux instance...');
    await replicant.stop();
    process.exit(0);
});

// Keep the process alive
await new Promise(() => {});
