import { promises as fs } from 'fs';
import * as path from 'path';

export async function verifyProjFSMount(mountPath: string): Promise<void> {
    console.log(`\n[MountVerification] Checking ProjFS mount at ${mountPath}...`);
    
    try {
        // Check if mount point exists
        const mountStats = await fs.stat(mountPath);
        console.log(`[MountVerification] Mount point exists: ${mountStats.isDirectory() ? 'YES (directory)' : 'NO (not a directory)'}`);
        
        // Check expected subdirectories
        const expectedDirs = ['chats', 'debug', 'objects', 'invites', 'types'];
        const issues: string[] = [];
        
        for (const dir of expectedDirs) {
            const dirPath = path.join(mountPath, dir);
            try {
                const stats = await fs.stat(dirPath);
                const isDir = stats.isDirectory();
                const mode = stats.mode;
                
                console.log(`[MountVerification] ${dir}: isDirectory=${isDir}, mode=${mode.toString(8)} (0x${mode.toString(16)})`);
                
                if (!isDir) {
                    issues.push(`${dir} is showing as a file instead of directory!`);
                }
            } catch (err) {
                console.log(`[MountVerification] ${dir}: ERROR - ${(err as Error).message}`);
                issues.push(`${dir} cannot be accessed: ${(err as Error).message}`);
            }
        }
        
        if (issues.length > 0) {
            console.error(`[MountVerification] ❌ MOUNT ISSUES DETECTED:`);
            issues.forEach(issue => console.error(`  - ${issue}`));
            console.error(`[MountVerification] This indicates the isDirectory flag is not being properly set in ProjFS`);
        } else {
            console.log(`[MountVerification] ✅ All virtual directories are properly mounted as directories`);
        }
        
        // Try to list contents of one directory to verify it's accessible
        try {
            const debugContents = await fs.readdir(path.join(mountPath, 'debug'));
            console.log(`[MountVerification] /debug directory contents: ${debugContents.length} items`);
        } catch (err) {
            console.error(`[MountVerification] Could not list /debug contents: ${(err as Error).message}`);
        }
        
    } catch (err) {
        console.error(`[MountVerification] ERROR: Could not verify mount: ${(err as Error).message}`);
    }
}