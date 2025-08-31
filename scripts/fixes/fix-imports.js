#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function fixImports(dir) {
    const files = await readdir(dir, { withFileTypes: true });
    
    for (const file of files) {
        const fullPath = join(dir, file.name);
        
        if (file.isDirectory()) {
            await fixImports(fullPath);
        } else if (file.name.endsWith('.js')) {
            let content = await readFile(fullPath, 'utf8');
            
            // Fix relative imports that don't have .js extension
            content = content.replace(
                /from\s+['"](\.[^'"]+)(?<!\.js)(?<!\.json)['"]/g,
                "from '$1.js'"
            );
            
            // Fix dynamic imports
            content = content.replace(
                /import\(['"](\.[^'"]+)(?<!\.js)(?<!\.json)['"]\)/g,
                "import('$1.js')"
            );
            
            await writeFile(fullPath, content);
        }
    }
}

fixImports('./lib').then(() => {
    console.log('Fixed all imports in lib directory');
}).catch(console.error);