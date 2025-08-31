const fs = require('fs');
const path = require('path');

console.log('Testing mounted ONE content...');

const mountPoint = '/home/refinio/one-files';

function exploreDirectory(dirPath, level = 0) {
  const indent = '  '.repeat(level);
  
  try {
    console.log(`${indent}📁 ${path.basename(dirPath) || 'root'}/`);
    
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      
      try {
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          if (level < 3) { // Limit recursion depth
            exploreDirectory(itemPath, level + 1);
          } else {
            console.log(`${indent}  📁 ${item}/ (not expanded - depth limit)`);
          }
        } else if (stats.isFile()) {
          console.log(`${indent}  📄 ${item} (${stats.size} bytes)`);
          
          // Show content of small text files
          if (stats.size < 1000 && item.toLowerCase().includes('.txt')) {
            try {
              const content = fs.readFileSync(itemPath, 'utf8');
              console.log(`${indent}    Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
            } catch (e) {
              console.log(`${indent}    Content: [Unable to read as text]`);
            }
          }
        }
      } catch (e) {
        console.log(`${indent}  ❌ ${item} (Error: ${e.message})`);
      }
    }
  } catch (e) {
    console.log(`${indent}❌ Error reading directory: ${e.message}`);
  }
}

console.log(`\nExploring mounted ONE content at: ${mountPoint}`);
console.log('='.repeat(50));

exploreDirectory(mountPoint); 