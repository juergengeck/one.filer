import { OneFilerProvider } from '../src/integration/OneFilerProvider.js';

/**
 * Full Stack Integration Example
 * 
 * This demonstrates running the complete ONE ecosystem stack with Windows native support:
 * - one.core (content-addressed storage)
 * - one.models (filesystem abstractions)
 * - one.filer (ONE filesystem implementation)
 * - projfs.one (Windows ProjectedFS integration)
 * 
 * The result is a native Windows virtual drive that provides access to:
 * - /chats - Chat conversations and files
 * - /debug - Debugging and diagnostic information
 * - /invites - Pairing and invitation management
 * - /objects - Raw content-addressed objects
 * - /types - Type definitions
 */

async function runFullStackDemo() {
    console.log('🚀 ONE Full Stack Integration Demo');
    console.log('==================================\n');
    
    console.log('📦 Stack Components:');
    console.log('   1. one.core    - Content-addressed storage');
    console.log('   2. one.models  - Filesystem abstractions');
    console.log('   3. one.filer   - ONE filesystem implementation');
    console.log('   4. projfs.one  - Windows native integration\n');
    
    // Configuration
    const config = {
        // ONE.core data directory
        directory: process.env.ONE_DIRECTORY || './one-data',
        
        // Secret for ONE.core initialization
        secret: process.env.ONE_SECRET || 'development-secret-change-in-production',
        
        // Windows virtual drive location
        virtualizationRoot: process.env.PROJFS_ROOT || 'C:\\OneFiler',
        
        // Communication server
        communicationUrl: process.env.ONE_COMM_URL || 'https://comm.one-dragon.com',
        
        // Logging
        logLevel: (process.env.LOG_LEVEL as any) || 'info'
    };
    
    console.log('⚙️  Configuration:');
    console.log(`   Data Directory: ${config.directory}`);
    console.log(`   Virtual Drive:  ${config.virtualizationRoot}`);
    console.log(`   Comm Server:    ${config.communicationUrl}`);
    console.log(`   Log Level:      ${config.logLevel}\n`);
    
    let provider: OneFilerProvider | null = null;
    
    try {
        // Create and initialize the provider
        console.log('🔄 Initializing ONE stack...\n');
        
        provider = await OneFilerProvider.createWithDefaults(
            config.directory,
            config.secret,
            {
                virtualizationRoot: config.virtualizationRoot,
                communicationUrl: config.communicationUrl,
                logLevel: config.logLevel as any
            }
        );
        
        console.log('\n✅ ONE stack initialized successfully!');
        console.log(`📁 Virtual drive available at: ${config.virtualizationRoot}\n`);
        
        // Show available filesystems
        console.log('📂 Available Filesystems:');
        console.log('   /chats    - Chat conversations and shared files');
        console.log('   /debug    - System diagnostics and logs');
        console.log('   /invites  - Pairing invitations');
        console.log('   /objects  - Raw content-addressed objects');
        console.log('   /types    - ONE type definitions\n');
        
        // Display statistics
        const displayStats = () => {
            const stats = provider!.getStats();
            console.log('\n📊 Statistics:');
            console.log(`   ProjFS Operations:`);
            console.log(`     - Placeholder requests: ${stats.projfs.placeholderInfoRequests || 0}`);
            console.log(`     - File data requests:   ${stats.projfs.fileDataRequests || 0}`);
            console.log(`     - Directory listings:   ${stats.projfs.directoryEnumerations || 0}`);
            console.log(`     - Cache hits:          ${stats.projfs.cacheHits || 0}`);
            console.log(`     - Cache misses:        ${stats.projfs.cacheMisses || 0}`);
            console.log(`   System:`);
            console.log(`     - Uptime: ${stats.projfs.uptime || 0}s`);
            console.log(`     - Cache size: ${Math.round((stats.oneFiler.cacheSize || 0) / 1024 / 1024)}MB`);
        };
        
        // Display initial stats
        displayStats();
        
        console.log('\n🎯 Integration Features:');
        console.log('   ✓ Native Windows performance (no WSL overhead)');
        console.log('   ✓ Real-time file synchronization');
        console.log('   ✓ Content-addressed deduplication');
        console.log('   ✓ Encrypted storage and transport');
        console.log('   ✓ Multi-device synchronization');
        console.log('   ✓ Offline capability\n');
        
        console.log('💡 Usage Instructions:');
        console.log(`   1. Open Windows Explorer`);
        console.log(`   2. Navigate to ${config.virtualizationRoot}`);
        console.log('   3. Browse and interact with files normally');
        console.log('   4. Changes sync automatically across devices\n');
        
        console.log('🔧 Advanced Features Available:');
        console.log('   - Version history for all files');
        console.log('   - Conflict-free collaborative editing');
        console.log('   - Granular access control');
        console.log('   - End-to-end encryption\n');
        
        // Keep running and display stats periodically
        console.log('✨ Virtual filesystem is running!');
        console.log('   Press Ctrl+C to stop...\n');
        
        // Update stats every 30 seconds
        const statsInterval = setInterval(displayStats, 30000);
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down...');
            clearInterval(statsInterval);
            
            if (provider) {
                await provider.shutdown();
            }
            
            console.log('✅ Shutdown complete');
            process.exit(0);
        });
        
        // Keep the process running
        await new Promise(() => {}); // Never resolves
        
    } catch (error) {
        console.error('\n❌ Failed to start full stack:', error);
        
        if (provider) {
            try {
                await provider.shutdown();
            } catch (e) {
                console.error('Error during cleanup:', e);
            }
        }
        
        console.log('\n💡 Troubleshooting:');
        console.log('   1. Ensure you are running on Windows');
        console.log('   2. Run as Administrator (first time)');
        console.log('   3. Check that ProjectedFS is enabled');
        console.log('   4. Verify ONE.core dependencies are installed');
        console.log('   5. Check the logs for detailed errors');
        
        process.exit(1);
    }
}

// Configuration validation
function validateEnvironment() {
    console.log('🔍 Validating environment...\n');
    
    if (process.platform !== 'win32') {
        console.warn('⚠️  Warning: Not running on Windows');
        console.warn('   ProjFS is Windows-only. Will use mock mode.\n');
    }
    
    if (!process.env.ONE_DIRECTORY) {
        console.log('ℹ️  Using default data directory: ./one-data');
    }
    
    if (!process.env.ONE_SECRET) {
        console.warn('⚠️  Warning: Using default development secret');
        console.warn('   Set ONE_SECRET environment variable for production\n');
    }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
    console.clear();
    validateEnvironment();
    
    runFullStackDemo().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

export { runFullStackDemo };