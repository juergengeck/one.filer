import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Post-build script to add .js extensions to TypeScript imports
 * Required for ES modules
 */

const distDir = './dist';

async function processFile(filePath) {
    const content = await readFile(filePath, 'utf8');
    
    // Add .js extension to relative imports
    const modified = content.replace(
        /from\s+['"](\.[^'"]+)(?<!\.js)['"];/g,
        (match, importPath) => {
            // Don't add .js if it's already there or if it's a directory import
            if (importPath.endsWith('.js') || importPath.endsWith('/')) {
                return match;
            }
            return `from '${importPath}.js';`;
        }
    );
    
    // Also handle dynamic imports
    const modified2 = modified.replace(
        /import\s*\(\s*['"](\.[^'"]+)(?<!\.js)['"]\s*\)/g,
        (match, importPath) => {
            if (importPath.endsWith('.js') || importPath.endsWith('/')) {
                return match;
            }
            return `import('${importPath}.js')`;
        }
    );
    
    if (modified2 !== content) {
        await writeFile(filePath, modified2);
        console.log(`Processed: ${filePath}`);
    }
}

async function processDirectory(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
            await processDirectory(fullPath);
        } else if (entry.name.endsWith('.js')) {
            await processFile(fullPath);
        }
    }
}

console.log('Adding .js extensions to imports...');
await processDirectory(distDir);
console.log('Post-build processing complete.');