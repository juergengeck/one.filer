const fs = require('fs');
const path = require('path');
const glob = require('glob');

const baseDir = path.join(__dirname, '..', 'node_modules', '@refinio', 'one.models', 'lib', 'fileSystems');

// Files that need fixing
const files = [
    'TemporaryFileSystem.js',
    'ObjectsFileSystem.js', 
    'PairingFileSystem.js',
    'TypesFileSystem.js',
    'utils/EasyFileSystem.js'
];

console.log('Fixing directory permissions in one.models...\n');

files.forEach(file => {
    const filePath = path.join(baseDir, file);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Replace restrictive directory permissions
        if (content.includes('0o0040555')) {
            content = content.replace(/0o0040555/g, '0o0040755');
            modified = true;
        }
        
        // Also check for decimal version
        if (content.includes('16749')) {
            content = content.replace(/16749/g, '16877');
            modified = true;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✅ Fixed permissions in ${file}`);
        } else {
            console.log(`⏭️  No changes needed in ${file}`);
        }
        
    } catch (err) {
        console.error(`❌ Error fixing ${file}:`, err.message);
    }
});

console.log('\nAll permission fixes applied!');