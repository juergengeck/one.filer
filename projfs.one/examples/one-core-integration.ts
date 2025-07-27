import { ProjFSProvider } from '../src/index.js';
// This would be imported from actual ONE.core
// import { OneCore } from '@refinio/one.core';

/**
 * Example: Integrate projfs.one with ONE.core
 * 
 * This example shows how to expose ONE.core's content-addressed
 * storage as a Windows virtual filesystem.
 */
(async function main() {
    console.log('projfs.one - ONE.core Integration Example');
    console.log('========================================\n');
    
    // Initialize ONE.core (pseudo-code)
    /*
    const oneCore = await OneCore.init({
        directory: './data',
        secret: process.env.ONE_CORE_SECRET || 'development-secret'
    });
    
    console.log('ONE.core initialized');
    console.log(`Instance ID: ${oneCore.instanceId}`);
    */
    
    // For demonstration, we'll show the expected API
    const mockOneCore = {
        async getPersistentFileSystem() {
            // Returns IFileSystem implementation
            throw new Error('Mock implementation - replace with real ONE.core');
        },
        
        async getObjectsFileSystem() {
            // Returns IFileSystem for raw object access
            throw new Error('Mock implementation - replace with real ONE.core');
        }
    };
    
    try {
        // Create provider with ONE.core integration
        const provider = await ProjFSProvider.createWithOneCore(mockOneCore, {
            virtualizationRoot: 'C:\\OneDrive',
            fileSystemType: 'persistent', // or 'objects' for raw access
            logLevel: 'info',
            cacheSize: 100 * 1024 * 1024 // 100MB cache
        });
        
        // Start the virtual filesystem
        await provider.start(null as any, {
            virtualizationRootPath: 'C:\\OneDrive',
            poolThreadCount: 0, // Use default
            concurrentThreadCount: 0, // Use default
            enableNegativePathCache: true
        });
        
        console.log('\nONE.core filesystem mounted at C:\\OneDrive');
        console.log('\nFeatures:');
        console.log('- Content-addressed storage with deduplication');
        console.log('- Automatic versioning through CRDT');
        console.log('- On-demand file hydration');
        console.log('- High-performance caching');
        console.log('\nPress Ctrl+C to stop...\n');
        
        // Monitor performance
        let lastStats = provider.getStats();
        setInterval(() => {
            const stats = provider.getStats();
            const bytesReadDelta = Number(stats.totalBytesRead - lastStats.totalBytesRead);
            const requestsDelta = stats.fileDataRequests - lastStats.fileDataRequests;
            
            if (bytesReadDelta > 0 || requestsDelta > 0) {
                console.log(`Activity: ${requestsDelta} requests, ${(bytesReadDelta / 1024).toFixed(2)} KB read`);
            }
            
            lastStats = stats;
        }, 5000);
        
        // Handle shutdown
        process.on('SIGINT', async () => {
            console.log('\nShutting down ONE.core filesystem...');
            await provider.stop();
            // await oneCore.shutdown();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
})();

// Configuration examples
console.log('Configuration Examples:');
console.log('======================\n');

console.log('1. Basic mount with default settings:');
console.log(`
const provider = new ProjFSProvider(fileSystem);
await provider.start({
    virtualizationRootPath: 'C:\\\\MyDrive'
});
`);

console.log('\n2. Advanced configuration:');
console.log(`
const provider = new ProjFSProvider(fileSystem, {
    logLevel: 'debug',
    cacheSize: 500 * 1024 * 1024 // 500MB
});

await provider.start({
    virtualizationRootPath: 'C:\\\\MyDrive',
    poolThreadCount: 8,
    concurrentThreadCount: 4,
    enableNegativePathCache: true,
    initializeFlags: 0
});
`);

console.log('\n3. Multiple filesystem types:');
console.log(`
// Persistent files (user documents)
const persistentFS = await oneCore.getPersistentFileSystem();
const documentsProvider = new ProjFSProvider(persistentFS);
await documentsProvider.start({ 
    virtualizationRootPath: 'C:\\\\Documents' 
});

// Raw object access (for debugging)
const objectsFS = await oneCore.getObjectsFileSystem();
const objectsProvider = new ProjFSProvider(objectsFS);
await objectsProvider.start({ 
    virtualizationRootPath: 'C:\\\\OneObjects' 
});
`);

console.log('\n\nNote: This is a demonstration. Real implementation requires:');
console.log('- Actual ONE.core instance');
console.log('- Compiled native module (projfs_native.node)');
console.log('- Windows 10 1809+ with ProjFS enabled');
console.log('- Administrator privileges for first run');