/**
 * Script to run Linux FUSE version and accept invitation from Windows version
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { Replicant } from './lib/Replicant.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function runLinuxFuseWithInvitation() {
    console.log('🐧 Setting up Linux FUSE version to accept Windows invitation...');
    
    try {
        // Read the invitation extracted from Windows
        const invitationFile = './windows-invitation.txt';
        if (!existsSync(invitationFile)) {
            console.log('❌ Windows invitation file not found');
            console.log('💡 Please run extract-windows-invitation.js first');
            return;
        }
        
        const windowsInvitation = readFileSync(invitationFile, 'utf8').trim();
        console.log('📧 Windows invitation loaded:', windowsInvitation);
        
        // Create a separate config for the Linux instance to avoid conflicts
        const linuxConfig = {
            directory: './data-linux-fuse', // Different directory
            commServerUrl: 'wss://comm10.dev.refinio.one', // Same server as Windows
            createEveryoneGroup: true,
            useFiler: true,
            filerConfig: {
                mountPoint: '/tmp/one-filer-linux', // Different mount point
                useProjFS: false, // Force FUSE mode
                logCalls: true,
                pairingUrl: 'https://leute.refinio.one', // Same pairing URL
                iomMode: 'full'
            }
        };
        
        console.log('⚙️ Linux FUSE configuration:', JSON.stringify(linuxConfig, null, 2));
        
        // Create the Linux Replicant instance
        console.log('🔧 Creating Linux Replicant instance...');
        const linuxReplicant = new Replicant(linuxConfig);
        
        // Start with a different secret to create a separate identity
        const linuxSecret = 'linux-fuse-secret-123';
        console.log('🚀 Starting Linux Replicant...');
        await linuxReplicant.start(linuxSecret);
        
        console.log('✅ Linux FUSE version started successfully!');
        console.log(`📁 FUSE mounted at: ${linuxConfig.filerConfig.mountPoint}`);
        
        // Wait a moment for the filesystem to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now try to accept the Windows invitation
        console.log('🤝 Attempting to accept Windows invitation...');
        
        // Try to access the invitation acceptance interface
        const acceptPath = `${linuxConfig.filerConfig.mountPoint}/invites/accept/invitation.txt`;
        
        console.log(`📝 Writing invitation to: ${acceptPath}`);
        
        try {
            // Write the invitation to the accept file
            writeFileSync(acceptPath, windowsInvitation);
            console.log('✅ Invitation written successfully!');
            
            // Wait a moment for processing
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check the status
            const statusPath = `${linuxConfig.filerConfig.mountPoint}/invites/accept/status.txt`;
            if (existsSync(statusPath)) {
                const status = readFileSync(statusPath, 'utf8');
                console.log('📊 Invitation status:');
                console.log(status);
            }
            
            // Check connections
            const connectionsPath = `${linuxConfig.filerConfig.mountPoint}/invites/connections.txt`;
            if (existsSync(connectionsPath)) {
                const connections = readFileSync(connectionsPath, 'utf8');
                console.log('🔗 Active connections:');
                console.log(connections);
            }
            
        } catch (writeError) {
            console.error('❌ Failed to write invitation:', writeError.message);
            console.log('💡 The filesystem might not be ready yet or the path might not exist');
        }
        
        // Keep the instance running for testing
        console.log('🔄 Linux FUSE instance running...');
        console.log('Press Ctrl+C to stop');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down Linux FUSE instance...');
            try {
                await linuxReplicant.stop();
                console.log('✅ Linux instance stopped');
            } catch (e) {
                console.error('❌ Error during shutdown:', e);
            }
            process.exit(0);
        });
        
        // Keep the process alive
        await new Promise(() => {}); // Never resolves
        
    } catch (error) {
        console.error('💥 Error setting up Linux FUSE version:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the Linux FUSE version
runLinuxFuseWithInvitation().catch(console.error);