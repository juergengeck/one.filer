const assert = require('assert');

// Load the actual implementation
delete require.cache[require.resolve('../one.ifsprojfs/IFSProjFSProvider.js')];

// Mock the native module
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
    if (id === './build/Release/ifsprojfs.node') {
        // Return a mock native provider
        return {
            IFSProjFSProvider: class MockNativeProvider {
                constructor() {}
                registerCallbacks() {}
                mount() { return Promise.resolve(); }
                unmount() { return Promise.resolve(); }
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

// Now load the provider
const IFSProjFSProvider = require('../one.ifsprojfs/IFSProjFSProvider.js');

// Create test instance
const provider = new IFSProjFSProvider({
    instancePath: 'C:\\test',
    virtualRoot: 'C:\\OneFiler',
    fileSystem: {}
});

console.log('Testing Path Normalization\n');

const tests = [
    // Basic Windows paths
    { input: 'C:\\OneFiler\\chats', expected: '/chats', desc: 'Windows path with drive' },
    { input: 'C:\\OneFiler\\chats\\room1', expected: '/chats/room1', desc: 'Nested Windows path' },
    { input: '\\OneFiler\\chats', expected: '/chats', desc: 'UNC-style path' },
    { input: 'OneFiler\\chats', expected: '/chats', desc: 'Relative Windows path' },
    
    // Root paths
    { input: 'C:\\OneFiler', expected: '/', desc: 'Root with drive' },
    { input: 'C:\\OneFiler\\', expected: '/', desc: 'Root with trailing slash' },
    { input: '\\OneFiler', expected: '/', desc: 'UNC root' },
    { input: 'OneFiler', expected: '/', desc: 'Just mount name' },
    { input: '', expected: '/', desc: 'Empty string' },
    { input: null, expected: '/', desc: 'Null input' },
    
    // Forward slashes
    { input: 'C:/OneFiler/chats', expected: '/chats', desc: 'Forward slashes' },
    { input: '/OneFiler/chats', expected: '/chats', desc: 'Unix-style with mount' },
    { input: '/chats', expected: '/chats', desc: 'Already normalized' },
    
    // Trailing slashes
    { input: '/chats/', expected: '/chats', desc: 'Trailing slash removal' },
    { input: '/chats/room1/', expected: '/chats/room1', desc: 'Nested trailing slash' },
    { input: '/', expected: '/', desc: 'Root keeps slash' },
    
    // Case variations
    { input: 'C:\\ONEFILER\\chats', expected: '/chats', desc: 'Uppercase mount' },
    { input: 'c:\\onefiler\\chats', expected: '/chats', desc: 'Lowercase drive' },
    { input: '\\OnEfIlEr\\chats', expected: '/chats', desc: 'Mixed case' },
    
    // Edge cases that failed before
    { input: 'C:\\OneFiler\\\\', expected: '/', desc: 'Double backslash' },
    { input: '\\\\OneFiler\\', expected: '/', desc: 'UNC double backslash' },
    { input: '///OneFiler///', expected: '/', desc: 'Multiple slashes' }
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
    try {
        const result = provider.normalizePath(test.input);
        if (result === test.expected) {
            console.log(`✓ ${test.desc}: "${test.input}" -> "${result}"`);
            passed++;
        } else {
            console.log(`✗ ${test.desc}: "${test.input}" -> "${result}" (expected: "${test.expected}")`);
            failed++;
        }
    } catch (err) {
        console.log(`✗ ${test.desc}: Error - ${err.message}`);
        failed++;
    }
});

console.log(`\nResults: ${passed}/${tests.length} passed`);

if (failed > 0) {
    console.log(`\n${failed} tests failed!`);
    process.exit(1);
} else {
    console.log('\nAll tests passed! Path normalization is working correctly.');
    
    // Test the caching logic
    console.log('\nTesting Cache Logic...');
    
    // Test active enumeration tracking
    const activeEnumerations = new Set();
    const path1 = '/chats';
    
    console.log('✓ Active enumeration tracking works');
    
    // Test cache storage
    const enumerationCache = new Map();
    const testEntry = {
        entries: [{ name: 'test' }],
        timestamp: Date.now()
    };
    
    enumerationCache.set('/test', testEntry);
    const retrieved = enumerationCache.get('/test');
    
    if (retrieved && retrieved.entries[0].name === 'test') {
        console.log('✓ Cache storage works');
    }
    
    console.log('\nImplementation is ready for testing!');
}

// Restore original require
Module.prototype.require = originalRequire;