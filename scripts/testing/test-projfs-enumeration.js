import { promises as fs } from 'fs';
import path from 'path';

async function testProjFS() {
    const projfsRoot = 'C:\\OneFiler';
    
    console.log(`Testing ProjFS at: ${projfsRoot}`);
    
    try {
        // Check if directory exists
        const stats = await fs.stat(projfsRoot);
        console.log('Directory exists:', stats.isDirectory());
        
        // Try to list contents
        console.log('\nAttempting to read directory contents...');
        const contents = await fs.readdir(projfsRoot);
        console.log('Contents:', contents);
        
        if (contents.length === 0) {
            console.log('\nDirectory appears empty from Node.js');
            console.log('This suggests ProjFS callbacks may not be working correctly');
        }
        
        // Try to access a known subdirectory
        console.log('\nTrying to access /objects subdirectory...');
        try {
            const objectsPath = path.join(projfsRoot, 'objects');
            await fs.stat(objectsPath);
            console.log('Objects directory exists!');
        } catch (err) {
            console.log('Objects directory not accessible:', err.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testProjFS();