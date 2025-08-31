#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Post-build script to add .js extensions to relative imports in compiled files.
 * This is necessary because TypeScript strips .js extensions from imports during compilation.
 */

function addJsExtensions(filePath) {
    try {
        let content = readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        // Add .js to relative imports that don't already have it
        content = content.replace(
            /from\s+['"](\.[./]+[^'"]+?)(?<!\.js)(?<!\.json)(?<!\.mjs)(?<!\.cjs)['"]/g,
            "from '$1.js'"
        );
        
        if (content !== originalContent) {
            writeFileSync(filePath, content, 'utf8');
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

function processDirectory(dir, processedCount = 0) {
    const items = readdirSync(dir);
    
    for (const item of items) {
        const fullPath = join(dir, item);
        
        try {
            const stat = statSync(fullPath);
            
            if (stat.isDirectory()) {
                // Skip node_modules and build directories
                if (item === 'node_modules' || item === 'build' || item === 'node_gyp_bins') {
                    continue;
                }
                processedCount = processDirectory(fullPath, processedCount);
            } else if (item.endsWith('.js')) {
                if (addJsExtensions(fullPath)) {
                    processedCount++;
                }
            }
        } catch (error) {
            // Skip files/directories we can't access
            if (error.code === 'EACCES' || error.code === 'EPERM') {
                console.warn(`Skipping inaccessible path: ${fullPath}`);
                continue;
            }
            throw error;
        }
    }
    
    return processedCount;
}

// Process the lib directory
const libDir = join(process.cwd(), 'lib');
console.log('Adding .js extensions to imports in compiled files...');
const count = processDirectory(libDir);
console.log(`Processed ${count} files.`);