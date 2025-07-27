const fs = require('fs');
const path = require('path');

// Fix the permissions in TemporaryFileSystem
const filePath = path.join(__dirname, '..', 'node_modules', '@refinio', 'one.models', 'lib', 'fileSystems', 'TemporaryFileSystem.js');

console.log('Fixing file permissions in:', filePath);

try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace restrictive directory permissions with 755
    const original = 'mode: 0o0040555';
    const replacement = 'mode: 0o0040755';
    
    if (content.includes(original)) {
        content = content.replace(original, replacement);
        fs.writeFileSync(filePath, content);
        console.log('✅ Fixed directory permissions from 0555 to 0755');
    } else {
        console.log('⚠️  Permission string not found, file may already be patched');
    }
    
    // Also check for the decimal version
    const originalDec = 'mode: 16749';
    const replacementDec = 'mode: 16877';
    
    if (content.includes(originalDec)) {
        content = content.replace(originalDec, replacementDec);
        fs.writeFileSync(filePath, content);
        console.log('✅ Fixed decimal directory permissions');
    }
    
} catch (err) {
    console.error('❌ Error fixing permissions:', err.message);
}