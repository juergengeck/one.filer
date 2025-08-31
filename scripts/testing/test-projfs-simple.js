#!/usr/bin/env node
// Simple ProjFS test - just check if we can access the virtual directories
import * as fs from 'fs';
import { spawn } from 'child_process';

const MOUNT_POINT = process.argv[2] || 'C:\\OneFilerExplorer';

console.log(`📁 Checking ProjFS mount at: ${MOUNT_POINT}\n`);

// Function to check directory access
async function checkAccess() {
    // Check if mount point exists
    if (!fs.existsSync(MOUNT_POINT)) {
        console.log('❌ Mount point does not exist');
        return;
    }
    
    console.log('✅ Mount point exists');
    
    // Try to list contents
    try {
        const items = fs.readdirSync(MOUNT_POINT);
        console.log(`✅ Directory listing: ${items.length} items`);
        console.log(`   Items: ${items.join(', ')}\n`);
        
        // Try to access each subdirectory
        for (const item of items) {
            const itemPath = `${MOUNT_POINT}\\${item}`;
            console.log(`📁 Checking ${item}:`);
            
            // Check if we can stat it
            try {
                const stats = fs.statSync(itemPath);
                console.log(`   ✅ Can stat - isDirectory: ${stats.isDirectory()}`);
            } catch (e) {
                console.log(`   ❌ Cannot stat: ${e.message}`);
            }
            
            // Try Explorer access
            console.log(`   🔍 Opening in Explorer...`);
            spawn('explorer', [itemPath], { detached: true, stdio: 'ignore' });
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check again after Explorer access
            try {
                const stats = fs.statSync(itemPath);
                console.log(`   ✅ After Explorer: Can stat - isDirectory: ${stats.isDirectory()}`);
                
                // Try to list contents if it's a directory
                if (stats.isDirectory()) {
                    try {
                        const subItems = fs.readdirSync(itemPath);
                        console.log(`   ✅ Contains ${subItems.length} items`);
                    } catch (e) {
                        console.log(`   ❌ Cannot list contents: ${e.message}`);
                    }
                }
            } catch (e) {
                console.log(`   ❌ Still cannot stat: ${e.message}`);
            }
            
            console.log('');
        }
    } catch (e) {
        console.log(`❌ Cannot list directory: ${e.message}`);
    }
}

checkAccess().catch(console.error);