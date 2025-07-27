#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixImportsInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix all relative imports - add .js if missing
    const importRegex = /from\s+['"](\.\.?\/[^'"]+?)(?<!\.js)['"]/g;
    content = content.replace(importRegex, (match, importPath) => {
        modified = true;
        return match.replace(importPath, importPath + '.js');
    });
    
    // Also fix import statements without from
    const importRegex2 = /import\s+['"](\.\.?\/[^'"]+?)(?<!\.js)['"]/g;
    content = content.replace(importRegex2, (match, importPath) => {
        modified = true;
        return match.replace(importPath, importPath + '.js');
    });
    
    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.startsWith('.')) {
            walkDir(fullPath);
        } else if (file.endsWith('.js')) {
            fixImportsInFile(fullPath);
        }
    }
}

const libDir = path.join(path.dirname(__dirname), 'lib');
console.log('Fixing imports in:', libDir);
walkDir(libDir);
console.log('Done!');