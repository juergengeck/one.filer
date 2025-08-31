/**
 * Test script to verify that ProjFS properly uses IFileSystem callbacks
 * instead of direct disk storage
 */

import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Mock IFileSystem for testing
class MockFileSystem {
    constructor() {
        this.calls = [];
    }

    async stat(filepath) {
        this.calls.push({ method: 'stat', path: filepath });
        console.log(`[IFileSystem] stat called for: ${filepath}`);
        
        // Return mock stats
        if (filepath === '/chats') {
            return { mode: 0o040755, size: 0 }; // Directory
        } else if (filepath === '/chats/test.txt') {
            return { mode: 0o100644, size: 13 }; // File
        }
        
        throw new Error('File not found');
    }

    async readFile(filepath) {
        this.calls.push({ method: 'readFile', path: filepath });
        console.log(`[IFileSystem] readFile called for: ${filepath}`);
        
        if (filepath === '/chats/test.txt') {
            return { content: 'Hello, World!' };
        }
        
        throw new Error('File not found');
    }

    async readDir(dirpath) {
        this.calls.push({ method: 'readDir', path: dirpath });
        console.log(`[IFileSystem] readDir called for: ${dirpath}`);
        
        if (dirpath === '/chats') {
            return { children: ['test.txt'] };
        }
        
        return { children: [] };
    }
}

async function testIFSProjFS() {
    console.log('Testing IFSProjFS with IFileSystem callbacks...\n');
    
    try {
        // Import the IFSProjFS provider
        const { IFSProjFSProvider } = require('./one.ifsprojfs');
        
        // Create mock filesystem
        const mockFS = new MockFileSystem();
        
        // Get instance path (you may need to adjust this)
        const instancePath = process.env.ONE_INSTANCE_PATH || path.join(process.env.USERPROFILE, '.one', 'default');
        console.log(`Using instance path: ${instancePath}\n`);
        
        // Create provider with mock filesystem
        const provider = new IFSProjFSProvider({
            instancePath: instancePath,
            virtualRoot: 'C:\\OneFilerTest',
            fileSystem: mockFS,
            cacheTTL: 5
        });
        
        console.log('Mounting virtual filesystem...');
        await provider.mount();
        console.log('Virtual filesystem mounted at C:\\OneFilerTest\n');
        
        console.log('Test Results:');
        console.log('1. Navigate to C:\\OneFilerTest in Windows Explorer');
        console.log('2. Try accessing the /chats directory');
        console.log('3. Try reading /chats/test.txt');
        console.log('4. Check the console output to verify IFileSystem callbacks are being used\n');
        
        console.log('Provider statistics:');
        console.log(provider.getStats());
        
        console.log('\nPress Ctrl+C to unmount and exit...');
        
        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\nUnmounting...');
            await provider.unmount();
            console.log('\nIFileSystem call log:');
            console.log(JSON.stringify(mockFS.calls, null, 2));
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the test
testIFSProjFS();