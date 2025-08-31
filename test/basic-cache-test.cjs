// Basic test using stubs
const { PersistentCache } = require('../lib/src/cache/PersistentCache.js');
const { SmartCacheManager } = require('../lib/src/cache/SmartCacheManager.js');

console.log('🧪 Running basic cache functionality tests...');

async function runTests() {
    let passed = 0;
    let failed = 0;
    
    // Test 1: PersistentCache basic operations
    try {
        const cache = new PersistentCache('./test-instance');
        
        // Test set/get
        await cache.set('key1', 'value1');
        const value1 = await cache.get('key1');
        if (value1 === 'value1') {
            console.log('✅ PersistentCache set/get');
            passed++;
        } else {
            console.log('❌ PersistentCache set/get');
            failed++;
        }
        
        // Test has
        const hasKey = await cache.has('key1');
        if (hasKey === true) {
            console.log('✅ PersistentCache has method');
            passed++;
        } else {
            console.log('❌ PersistentCache has method');
            failed++;
        }
        
        // Test delete
        await cache.delete('key1');
        const valueAfterDelete = await cache.get('key1');
        if (valueAfterDelete === undefined) {
            console.log('✅ PersistentCache delete');
            passed++;
        } else {
            console.log('❌ PersistentCache delete');
            failed++;
        }
        
    } catch (error) {
        console.log('❌ PersistentCache tests failed:', error.message);
        failed++;
    }
    
    // Test 2: SmartCacheManager basic operations
    try {
        const cache = new PersistentCache('./test-instance');
        const smartCache = new SmartCacheManager(cache);
        
        // Test set/get
        await smartCache.set('smart-key', 'smart-value');
        const value = await smartCache.get('smart-key');
        if (value === 'smart-value') {
            console.log('✅ SmartCacheManager set/get');
            passed++;
        } else {
            console.log('❌ SmartCacheManager set/get');
            failed++;
        }
        
        // Test invalidate
        await smartCache.invalidate('smart');
        const valueAfterInvalidate = await smartCache.get('smart-key');
        if (valueAfterInvalidate === undefined) {
            console.log('✅ SmartCacheManager invalidate');
            passed++;
        } else {
            console.log('❌ SmartCacheManager invalidate');
            failed++;
        }
        
        // Test stats
        const stats = smartCache.getStats();
        if (typeof stats.size === 'number') {
            console.log('✅ SmartCacheManager stats');
            passed++;
        } else {
            console.log('❌ SmartCacheManager stats');
            failed++;
        }
        
    } catch (error) {
        console.log('❌ SmartCacheManager tests failed:', error.message);
        failed++;
    }
    
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed === 0) {
        console.log('🎉 All basic tests passed!');
        return true;
    } else {
        console.log('💥 Some tests failed');
        return false;
    }
}

runTests().then((success) => {
    process.exit(success ? 0 : 1);
});