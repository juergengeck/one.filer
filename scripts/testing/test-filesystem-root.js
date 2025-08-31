async function testFilesystemRoot() {
    console.log('Testing filesystem root entries...\n');
    
    try {
        // Load the TemporaryFileSystem like the app does
        const { default: TemporaryFileSystem } = await import('@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js');
        
        // Create a minimal filesystem instance
        const fs = new TemporaryFileSystem();
        
        // Try to read root directory
        console.log('Calling fs.readDir("/")...');
        const rootDir = await fs.readDir('/');
        
        console.log('Root directory returned:', JSON.stringify(rootDir, null, 2));
        
        if (rootDir && rootDir.children) {
            console.log(`\nFound ${rootDir.children.length} children:`);
            for (const child of rootDir.children) {
                console.log(`  - ${child}`);
                
                // Try to stat each child
                try {
                    const childPath = `/${child}`;
                    const stat = await fs.stat(childPath);
                    console.log(`    stat(${childPath}):`, stat);
                } catch (e) {
                    console.log(`    stat(${childPath}): ERROR -`, e.message);
                }
            }
        } else {
            console.log('No children found or invalid format');
        }
        
    } catch (error) {
        console.error('Error testing filesystem:', error);
    }
}

testFilesystemRoot().catch(console.error);