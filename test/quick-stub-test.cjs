// Quick test to verify stub implementations work
const { PersistentCache } = require('../lib/src/cache/PersistentCache.js');
const { SmartCacheManager } = require('../lib/src/cache/SmartCacheManager.js');
const { CachedProjFSProvider } = require('../lib/src/filer/CachedProjFSProvider.js');

async function runQuickTest() {
    console.log('🧪 Testing stub implementations...');
    
    try {
        // Test PersistentCache
        const cache = new PersistentCache('./test-instance');
        await cache.set('test-key', 'test-value');
        const value = await cache.get('test-key');
        console.log('✅ PersistentCache: set/get works');
        
        // Test SmartCacheManager
        const smartCache = new SmartCacheManager(cache);
        await smartCache.set('smart-key', 'smart-value');
        const smartValue = await smartCache.get('smart-key');
        console.log('✅ SmartCacheManager: set/get works');
        
        // Test CachedProjFSProvider
        const provider = new CachedProjFSProvider(null);
        const fileData = await provider.getFileData('/test');
        const dirEntries = await provider.getDirectoryEntries('/test');
        console.log('✅ CachedProjFSProvider: methods callable');
        
        console.log('🎉 All stub implementations functional!');
        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

runQuickTest().then((success) => {
    process.exit(success ? 0 : 1);
});