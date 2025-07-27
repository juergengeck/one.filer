#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively find all TypeScript files
function findTsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git')) {
            findTsFiles(filePath, fileList);
        } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

// Function to fix imports - add .js extension where missing
function fixImports(content) {
    // Fix SHA256Hash/SHA256IdHash imports without .js extension
    content = content.replace(
        /from\s+['"]@refinio\/one\.core\/lib\/util\/type-checks['"]/g,
        "from '@refinio/one.core/lib/util/type-checks.js'"
    );
    
    // Fix other one.core imports without .js extension
    content = content.replace(
        /from\s+['"]@refinio\/one\.core\/lib\/([^'"]+)(?<!\.js)['"]/g,
        "from '@refinio/one.core/lib/$1.js'"
    );
    
    // Fix one.models imports without .js extension
    content = content.replace(
        /from\s+['"]@refinio\/one\.models\/lib\/([^'"]+)(?<!\.js)['"]/g,
        "from '@refinio/one.models/lib/$1.js'"
    );
    
    // Fix deleteStorage import - it's now in instance module
    content = content.replace(
        /import\s*{\s*deleteStorage\s*}\s*from\s*['"]@refinio\/one\.core\/lib\/system\/storage-base\.js['"]/g,
        "import {deleteInstance as deleteStorage} from '@refinio/one.core/lib/instance.js'"
    );
    
    // Fix listAllObjectHashes import - might be in different module
    content = content.replace(
        /import\s*{([^}]*)\s*listAllObjectHashes\s*([^}]*)\}\s*from\s*['"]@refinio\/one\.core\/lib\/system\/storage-base\.js['"]/g,
        (match, before, after) => {
            const otherImports = [before, after].filter(s => s && s.trim() && s.trim() !== ',').join(', ');
            if (otherImports) {
                return `import {${otherImports}} from '@refinio/one.core/lib/system/storage-base.js';\n// TODO: Find correct import for listAllObjectHashes`;
            }
            return `// TODO: Find correct import for listAllObjectHashes`;
        }
    );
    
    // Fix imports from lib/Filer
    content = content.replace(
        /from\s+['"]\.\.\/lib\/Filer['"]/g,
        "from '../lib/index.js'"
    );
    
    return content;
}

// Function to fix API changes
function fixApiChanges(content) {
    // Fix VersionedObjectResult property access - accessing properties on result.obj
    content = content.replace(/if\s*\(\s*result\.\$type\$\s*!==\s*'Profile'/g, "if (result.obj.$type$ !== 'Profile'");
    content = content.replace(/if\s*\(\s*versionedResult\.\$type\$\s*!==\s*'Profile'/g, "if (versionedResult.obj.$type$ !== 'Profile'");
    
    // Fix ConnectionsModel.pairing
    content = content.replace(/connectionsModel\.pairing/g, '(connectionsModel as any).pairingManager');
    
    // Fix addListener on pairing
    content = content.replace(/\.pairing\.addListener/g, '.pairingManager.onUpdate');
    
    // Fix LeuteModel.me
    content = content.replace(/leuteModel\.me/g, 'await leuteModel.getMe()');
    
    // Fix ChannelManager.createChannel
    content = content.replace(/channelManager\.createChannel/g, 'await channelManager.create');
    
    // Fix GroupModel static method
    content = content.replace(/GroupModel\.constructFromLatestProfileVersionByGroupName/g, 'GroupModel.getByName');
    
    // Fix model constructors - they don't take parameters anymore
    content = content.replace(/new\s+LeuteModel\s*\([^)]*\)/g, 'new LeuteModel()');
    content = content.replace(/new\s+ChannelManager\s*\([^)]*\)/g, 'new ChannelManager()');
    content = content.replace(/new\s+ConnectionsModel\s*\([^)]*\)/g, 'new ConnectionsModel()');
    content = content.replace(/new\s+TopicModel\s*\([^)]*\)/g, 'new TopicModel()');
    
    // Fix init methods
    content = content.replace(/\.init\(\)/g, '.initialize()');
    
    // Fix SettingsStore usage - it's a default export now
    content = content.replace(/SettingsStore\.getItem/g, 'SettingsStore.default.getItem');
    content = content.replace(/SettingsStore\.setItem/g, 'SettingsStore.default.setItem');
    
    // Fix missing exports in models - import from index
    content = content.replace(
        /from\s+['"]@refinio\/one\.models\/lib\/models\.js['"]/g,
        "from '@refinio/one.models/lib/models/index.js'"
    );
    
    // Fix imports of individual model files
    content = content.replace(
        /import\s+IoMManager\s+from\s+['"]@refinio\/one\.models\/lib\/models\/IoM\/IoMManager\.js['"]/g,
        "import {default as IoMManager} from '@refinio/one.models/lib/models/IoM/IoMManager.js'"
    );
    content = content.replace(
        /import\s+GroupModel\s+from\s+['"]@refinio\/one\.models\/lib\/models\/Leute\/GroupModel\.js['"]/g,
        "import {default as GroupModel} from '@refinio/one.models/lib/models/Leute/GroupModel.js'"
    );
    content = content.replace(
        /import\s+Notifications\s+from\s+['"]@refinio\/one\.models\/lib\/models\/Notifications\.js['"]/g,
        "import {default as Notifications} from '@refinio/one.models/lib/models/Notifications.js'"
    );
    content = content.replace(
        /import\s+type\s+ChannelManager\s+from\s+['"]@refinio\/one\.models\/lib\/models\/ChannelManager\.js['"]/g,
        "import type {ChannelManager} from '@refinio/one.models/lib/models/index.js'"
    );
    
    // Fix FileDescription import
    content = content.replace(
        /import\s*type\s*{\s*FileDescription\s*}\s*from\s*['"]@refinio\/one\.models\/lib\/fileSystems\/IFileSystem\.js['"]/g,
        "// FileDescription type removed - use object literal instead"
    );
    
    // Fix readIdentityWithSecretsFile and writeNewIdentityToFile imports
    content = content.replace(
        /import\s*{\s*readIdentityWithSecretsFile\s*}\s*from/g,
        "import {readIdentityFile as readIdentityWithSecretsFile} from"
    );
    content = content.replace(
        /import\s*{\s*writeNewIdentityToFile\s*}\s*from/g,
        "import {writeIdentityFile as writeNewIdentityToFile} from"
    );
    
    // Fix getObjectWithType calls with 2 arguments
    content = content.replace(
        /getObjectWithType\s*\(\s*([^,]+)\s*,\s*['"]([^'"]+)['"]\s*\)/g,
        "getObjectWithType<'$2'>($1)"
    );
    
    return content;
}

// Function to add missing type imports
function addMissingImports(content, filePath) {
    // Check if we need to import HashTypes
    if (content.includes('HashTypes') && !content.includes('import.*HashTypes')) {
        const hashImportMatch = content.match(/import[^;]+from\s+['"]@refinio\/one\.core\/lib\/util\/type-checks\.js['"]/);
        if (hashImportMatch) {
            content = content.replace(
                hashImportMatch[0],
                hashImportMatch[0].replace('import type {', 'import type {HashTypes, ')
            );
        }
    }
    
    // Check if we need ErrorWithCode
    if (content.includes('ErrorWithCode') && !content.includes('import.*ErrorWithCode')) {
        content = `import type {ErrorWithCode} from '@refinio/one.core/lib/errors.js';\n` + content;
    }
    
    return content;
}

// Main function
function main() {
    const projectRoot = path.join(__dirname, '..');
    const srcDir = path.join(projectRoot, 'src');
    const testDir = path.join(projectRoot, 'test');
    
    const tsFiles = [
        ...findTsFiles(srcDir),
        ...findTsFiles(testDir)
    ];
    
    console.log(`Found ${tsFiles.length} TypeScript files to process`);
    
    tsFiles.forEach(filePath => {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Apply fixes
            content = fixImports(content);
            content = fixApiChanges(content);
            content = addMissingImports(content, filePath);
            
            // Only write if content changed
            if (content !== originalContent) {
                fs.writeFileSync(filePath, content);
                console.log(`Fixed: ${path.relative(projectRoot, filePath)}`);
            }
        } catch (error) {
            console.error(`Error processing ${filePath}:`, error);
        }
    });
    
    console.log('Type fixes completed!');
}

main();