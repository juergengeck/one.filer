// Test the isDirectory flow from JavaScript to cache
const { createRequire } = await import('module');
const require = createRequire(import.meta.url);

async function test() {
    const IFSProjFSProvider = require('./one.ifsprojfs/IFSProjFSProvider.js');
    
    // Mock filesystem
    const mockFileSystem = {
        readDir: async (path) => {
            console.log(`[MockFS] readDir(${path})`);
            if (path === '/') {
                return { children: ['chats', 'debug', 'objects'] };
            }
            return { children: [] };
        },
        stat: async (path) => {
            console.log(`[MockFS] stat(${path})`);
            // Return mode that indicates directory
            return {
                mode: 16749,  // This should indicate directory
                size: 0,
                isDirectory: undefined  // This is what we get from TemporaryFileSystem
            };
        },
        readFile: async (path) => {
            return { content: Buffer.from('test') };
        }
    };
    
    const provider = new IFSProjFSProvider({
        instancePath: 'C:\\temp\\test',
        virtualRoot: 'C:\\TestMount',
        fileSystem: mockFileSystem,
        debug: true
    });
    
    // Test fetchDirectoryEntries
    console.log('\n=== Testing fetchDirectoryEntries ===');
    const entries = await provider.fetchDirectoryEntries('/', {});
    
    console.log('\n=== Results ===');
    entries.forEach(entry => {
        console.log(`Entry: ${entry.name}`);
        console.log(`  isDirectory: ${entry.isDirectory}`);
        console.log(`  mode: ${entry.mode} (0o${entry.mode.toString(8)})`);
    });
}

test().catch(console.error);