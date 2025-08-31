// Comprehensive test for real cache implementations
const { PersistentCache } = require('../lib/src/cache/PersistentCache.js');
const { SmartCacheManager } = require('../lib/src/cache/SmartCacheManager.js');
const { CachedProjFSProvider } = require('../lib/src/filer/CachedProjFSProvider.js');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const rmdir = promisify(fs.rmdir);
const exists = promisify(fs.exists);

console.log('🧪 Running comprehensive cache functionality tests...\n');

async function cleanup(dir) {
    try {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    } catch (e) {
        // Ignore cleanup errors
    }
}

async function runTests() {
    let passed = 0;
    let failed = 0;
    const testDir = './test-cache-comprehensive';
    
    // Clean up before tests
    await cleanup(testDir);
    
    console.log('📦 Testing PersistentCache with real file persistence...');
    
    try {
        const cache = new PersistentCache(testDir, { maxMemoryMB: 1 });
        
        // Test 1: Directory caching
        const dirEntries = [
            { name: 'file1.txt', hash: 'abc123', size: 100, isDirectory: false, mode: 33188 },
            { name: 'subdir', hash: '', size: 0, isDirectory: true, mode: 16877 }
        ];
        
        await cache.cacheDirectory('/test/dir', dirEntries);
        const cached = await cache.getCachedDirectory('/test/dir');
        
        if (cached && cached.length === 2 && cached[0].name === 'file1.txt') {
            console.log('  ✅ Directory caching works');
            passed++;
        } else {
            console.log('  ❌ Directory caching failed');
            failed++;
        }
        
        // Test 2: File caching with Buffer
        const fileContent = Buffer.from('This is test file content');
        const fileStat = { mode: 33188, size: fileContent.length, mtime: new Date() };
        
        await cache.cacheFile('/test/file.txt', fileContent, fileStat);
        const cachedFile = await cache.getCachedFile('/test/file.txt');
        
        if (cachedFile && Buffer.isBuffer(cachedFile.content) && 
            cachedFile.content.toString() === 'This is test file content') {
            console.log('  ✅ File caching with Buffer works');
            passed++;
        } else {
            console.log('  ❌ File caching failed');
            failed++;
        }
        
        // Test 3: Cache persistence to disk
        cache.saveToDisk();
        const indexPath = path.join(testDir, 'cache', 'index.json');
        
        if (fs.existsSync(indexPath)) {
            console.log('  ✅ Cache persistence to disk works');
            passed++;
        } else {
            console.log('  ❌ Cache persistence failed');
            failed++;
        }
        
        // Test 4: Cache invalidation
        cache.invalidate('/test');
        const afterInvalidate = await cache.getCachedDirectory('/test/dir');
        
        if (afterInvalidate === null) {
            console.log('  ✅ Cache invalidation works');
            passed++;
        } else {
            console.log('  ❌ Cache invalidation failed');
            failed++;
        }
        
        // Test 5: Cache stats
        const stats = cache.getCacheStats();
        if (typeof stats.memoryCacheSize === 'number' && 
            typeof stats.hits === 'number' &&
            typeof stats.misses === 'number') {
            console.log('  ✅ Cache statistics tracking works');
            passed++;
        } else {
            console.log('  ❌ Cache statistics failed');
            failed++;
        }
        
        cache.shutdown();
        
    } catch (error) {
        console.log('  ❌ PersistentCache tests failed:', error.message);
        failed++;
    }
    
    console.log('\n🧠 Testing SmartCacheManager with LRU eviction...');
    
    try {
        const persistCache = new PersistentCache(testDir, { maxMemoryMB: 1 });
        const smartCache = new SmartCacheManager(persistCache, {
            maxMemoryEntries: 5,
            defaultTTL: 1000 // 1 second TTL for testing
        });
        
        // Test 1: Multi-layer caching
        await smartCache.set('layer-test', 'value1', { priority: 'high' });
        const layerValue = await smartCache.get('layer-test');
        
        if (layerValue === 'value1') {
            console.log('  ✅ Multi-layer caching works');
            passed++;
        } else {
            console.log('  ❌ Multi-layer caching failed');
            failed++;
        }
        
        // Test 2: LRU eviction (fill cache beyond limit)
        for (let i = 0; i < 10; i++) {
            await smartCache.set(`key${i}`, `value${i}`, { priority: 'normal' });
        }
        
        const cacheStats = smartCache.getStats();
        if (cacheStats.size <= 5 && cacheStats.evictions > 0) {
            console.log('  ✅ LRU eviction works');
            passed++;
        } else {
            console.log('  ❌ LRU eviction failed');
            failed++;
        }
        
        // Test 3: TTL expiration
        await smartCache.set('ttl-test', 'expires', { ttl: 500 });
        await new Promise(resolve => setTimeout(resolve, 600));
        const expiredValue = await smartCache.get('ttl-test');
        
        if (expiredValue === undefined) {
            console.log('  ✅ TTL expiration works');
            passed++;
        } else {
            console.log('  ❌ TTL expiration failed');
            failed++;
        }
        
        // Test 4: Priority-based caching
        await smartCache.clear();
        await smartCache.set('high-priority', 'important', { priority: 'high' });
        await smartCache.set('low-priority', 'less-important', { priority: 'low' });
        
        // Fill cache to trigger eviction
        for (let i = 0; i < 6; i++) {
            await smartCache.set(`filler${i}`, `data${i}`, { priority: 'low' });
        }
        
        // High priority should still be there
        const highPriorityValue = await smartCache.get('high-priority');
        if (highPriorityValue === 'important') {
            console.log('  ✅ Priority-based eviction works');
            passed++;
        } else {
            console.log('  ❌ Priority-based eviction failed');
            failed++;
        }
        
        smartCache.shutdown();
        
    } catch (error) {
        console.log('  ❌ SmartCacheManager tests failed:', error.message);
        failed++;
    }
    
    console.log('\n🚀 Testing CachedProjFSProvider...');
    
    try {
        // Create a mock base provider
        const mockProvider = {
            async getDirectoryEntries(path) {
                return [
                    { name: 'file1.txt', isDirectory: false, isSymbolicLink: false, size: 100 },
                    { name: 'subdir', isDirectory: true, isSymbolicLink: false }
                ];
            },
            async getFileData(path) {
                return Buffer.from(`Content of ${path}`);
            },
            async getPlaceholderData(path) {
                return { size: 1024 };
            }
        };
        
        const provider = new CachedProjFSProvider(mockProvider);
        
        // Test 1: Directory caching
        const entries1 = await provider.getDirectoryEntries('/test');
        const entries2 = await provider.getDirectoryEntries('/test'); // Should hit cache
        
        const stats = provider.getStats();
        if (stats.cacheHits > 0 && entries1.includes('file1.txt')) {
            console.log('  ✅ ProjFS directory caching works');
            passed++;
        } else {
            console.log('  ❌ ProjFS directory caching failed');
            failed++;
        }
        
        // Test 2: File data caching
        const data1 = await provider.getFileData('/test/file.txt');
        const data2 = await provider.getFileData('/test/file.txt'); // Should hit cache
        
        const stats2 = provider.getStats();
        if (stats2.cacheHits > stats.cacheHits && data1.toString().includes('Content of')) {
            console.log('  ✅ ProjFS file caching works');
            passed++;
        } else {
            console.log('  ❌ ProjFS file caching failed');
            failed++;
        }
        
        // Test 3: Metadata caching
        const metadata = await provider.getFileMetadata('/test/file.txt');
        if (metadata && metadata.size === 1024) {
            console.log('  ✅ ProjFS metadata caching works');
            passed++;
        } else {
            console.log('  ❌ ProjFS metadata caching failed');
            failed++;
        }
        
        provider.shutdown();
        
    } catch (error) {
        console.log('  ❌ CachedProjFSProvider tests failed:', error.message);
        failed++;
    }
    
    // Clean up after tests
    await cleanup(testDir);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Comprehensive Test Results:');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 All comprehensive tests passed! Real implementations working!');
        return true;
    } else {
        console.log('\n💥 Some tests failed');
        return false;
    }
}

runTests().then((success) => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});