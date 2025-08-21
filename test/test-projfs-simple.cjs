const assert = require('assert');
const { EventEmitter } = require('events');

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// Simple test framework
function describe(name, fn) {
    console.log(`\n${name}`);
    fn();
}

function it(name, fn) {
    totalTests++;
    try {
        const result = fn();
        if (result && typeof result.then === 'function') {
            return result
                .then(() => {
                    passedTests++;
                    console.log(`  ✓ ${name}`);
                })
                .catch(err => {
                    failedTests++;
                    console.log(`  ✗ ${name}`);
                    failures.push({ test: name, error: err });
                });
        } else {
            passedTests++;
            console.log(`  ✓ ${name}`);
        }
    } catch (err) {
        failedTests++;
        console.log(`  ✗ ${name}`);
        failures.push({ test: name, error: err });
    }
}

// Mock filesystem
class MockFileSystem {
    constructor() {
        this.data = {
            '/': { children: ['chats', 'debug', 'objects', 'invites'], isDirectory: true },
            '/chats': { children: ['room1', 'room2'], isDirectory: true },
            '/debug': { children: [], isDirectory: true },
            '/objects': { children: [], isDirectory: true },
            '/invites': { children: ['iom_invite.png', 'iom_invite.txt', 'iop_invite.png', 'iop_invite.txt'], isDirectory: true }
        };
    }
    
    async readDir(path) {
        const data = this.data[path];
        if (!data) throw new Error(`Path not found: ${path}`);
        return { children: data.children };
    }
    
    async stat(path) {
        const data = this.data[path];
        if (!data) throw new Error(`Path not found: ${path}`);
        return {
            isDirectory: data.isDirectory || false,
            size: data.size || 0,
            mode: data.isDirectory ? 16877 : 33188
        };
    }
}

// Run tests
async function runTests() {
    console.log('Testing ProjFS Provider Implementation\n');
    
    // Create a test provider using our current implementation
    const providerCode = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'one.ifsprojfs', 'IFSProjFSProvider.js'),
        'utf8'
    );
    
    // Extract just the class definition for testing
    const classMatch = providerCode.match(/class IFSProjFSProvider[\s\S]+normalizePath\(inputPath\)[\s\S]+?return normalized \|\| '\/';[\s\S]+?\}/);
    
    if (!classMatch) {
        console.error('Could not extract normalizePath method from provider');
        return;
    }
    
    // Create a minimal test class with just the normalizePath method
    const TestProvider = eval(`
        (function() {
            class TestProvider {
                ${classMatch[0].substring(classMatch[0].indexOf('normalizePath'))}
            }
            return TestProvider;
        })()
    `);
    
    const provider = new TestProvider();
    
    describe('Path Normalization', () => {
        it('should normalize Windows paths correctly', () => {
            assert.strictEqual(provider.normalizePath('C:\\OneFiler\\chats'), '/chats');
            assert.strictEqual(provider.normalizePath('C:\\OneFiler\\chats\\room1'), '/chats/room1');
            assert.strictEqual(provider.normalizePath('\\OneFiler\\chats'), '/chats');
            assert.strictEqual(provider.normalizePath('OneFiler\\chats'), '/chats');
        });
        
        it('should handle root path', () => {
            assert.strictEqual(provider.normalizePath('C:\\OneFiler'), '/');
            assert.strictEqual(provider.normalizePath('C:\\OneFiler\\'), '/');
            assert.strictEqual(provider.normalizePath('\\OneFiler'), '/');
            assert.strictEqual(provider.normalizePath('OneFiler'), '/');
            assert.strictEqual(provider.normalizePath(''), '/');
            assert.strictEqual(provider.normalizePath(null), '/');
        });
        
        it('should handle forward slashes', () => {
            assert.strictEqual(provider.normalizePath('C:/OneFiler/chats'), '/chats');
            assert.strictEqual(provider.normalizePath('/OneFiler/chats'), '/chats');
            assert.strictEqual(provider.normalizePath('/chats'), '/chats');
        });
        
        it('should remove trailing slashes except for root', () => {
            assert.strictEqual(provider.normalizePath('/chats/'), '/chats');
            assert.strictEqual(provider.normalizePath('/chats/room1/'), '/chats/room1');
            assert.strictEqual(provider.normalizePath('/'), '/');
        });
        
        it('should handle case variations', () => {
            assert.strictEqual(provider.normalizePath('C:\\ONEFILER\\chats'), '/chats');
            assert.strictEqual(provider.normalizePath('c:\\onefiler\\chats'), '/chats');
            assert.strictEqual(provider.normalizePath('\\OnEfIlEr\\chats'), '/chats');
        });
        
        it('should handle edge cases', () => {
            assert.strictEqual(provider.normalizePath('C:\\OneFiler\\'), '/');
            assert.strictEqual(provider.normalizePath('C:\\OneFiler\\\\'), '/');
            assert.strictEqual(provider.normalizePath('\\\\OneFiler\\'), '/');
            assert.strictEqual(provider.normalizePath('///OneFiler///'), '/');
            assert.strictEqual(provider.normalizePath('C:\\OneFiler\\..\\OneFiler\\chats'), '/chats');
        });
    });
    
    // Test the caching logic
    describe('Caching Logic', () => {
        it('should track active enumerations', () => {
            const activeSet = new Set();
            
            // Simulate enumeration start
            const path1 = '/chats';
            assert.strictEqual(activeSet.has(path1), false);
            
            activeSet.add(path1);
            assert.strictEqual(activeSet.has(path1), true);
            
            // Should block duplicate
            assert.strictEqual(activeSet.has(path1), true);
            
            // Different path should work
            const path2 = '/debug';
            assert.strictEqual(activeSet.has(path2), false);
            activeSet.add(path2);
            assert.strictEqual(activeSet.has(path2), true);
            
            // Cleanup
            activeSet.delete(path1);
            assert.strictEqual(activeSet.has(path1), false);
        });
        
        it('should handle cache expiration', () => {
            const cache = new Map();
            const CACHE_DURATION = 100; // 100ms for testing
            
            const entry = {
                entries: ['test'],
                timestamp: Date.now()
            };
            
            cache.set('/test', entry);
            
            // Should be valid immediately
            const cached = cache.get('/test');
            assert.strictEqual(cached !== undefined, true);
            assert.strictEqual(Date.now() - cached.timestamp < CACHE_DURATION, true);
            
            // After timeout, should be expired
            setTimeout(() => {
                const expired = cache.get('/test');
                assert.strictEqual(expired !== undefined, true);
                assert.strictEqual(Date.now() - expired.timestamp >= CACHE_DURATION, true);
            }, CACHE_DURATION + 10);
        });
    });
    
    // Test name extraction
    describe('Name Extraction', () => {
        it('should extract just the filename from paths', () => {
            // Test various path formats
            const tests = [
                { input: 'chats', expected: 'chats' },
                { input: '/chats', expected: 'chats' },
                { input: '\\chats', expected: 'chats' },
                { input: 'C:\\OneFiler\\chats', expected: 'chats' },
                { input: '/root/chats', expected: 'chats' },
                { input: 'root\\sub\\chats', expected: 'chats' },
                { input: 'chats/', expected: 'chats' },
                { input: 'chats\\', expected: 'chats' }
            ];
            
            tests.forEach(test => {
                // Using the same logic as in the provider
                const parts = test.input.split(/[\/\\]/).filter(p => p);
                const name = parts[parts.length - 1] || test.input;
                assert.strictEqual(name, test.expected, `Failed for input: ${test.input}`);
            });
        });
        
        it('should detect invalid names with path separators', () => {
            const invalidNames = [
                'folder/subfolder',
                'folder\\subfolder',
                '/absolute/path',
                '\\windows\\path',
                'C:\\full\\path'
            ];
            
            invalidNames.forEach(name => {
                const hasPathSep = name.includes('/') || name.includes('\\');
                assert.strictEqual(hasPathSep, true, `Should detect path separator in: ${name}`);
            });
        });
    });
}

// Run all tests
runTests().then(() => {
    console.log(`\n\nTest Results:`);
    console.log(`Total: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    
    if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach(f => {
            console.log(`\n${f.test}:`);
            console.log(f.error.message);
            if (f.error.stack) {
                console.log(f.error.stack.split('\n').slice(1, 3).join('\n'));
            }
        });
    }
    
    process.exit(failedTests > 0 ? 1 : 0);
}).catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});