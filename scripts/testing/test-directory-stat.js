import '@refinio/one.core/lib/system/load-nodejs.js';
import Replicant from './lib/Replicant.js';
import { readFileSync } from 'fs';

// Load config
const config = JSON.parse(readFileSync('config.json', 'utf8'));

// Start replicant
const replicant = new Replicant({
  directory: config.dataDirectory || './data',
  useFiler: true,
  filerConfig: {
    useProjFS: false,  // Don't mount ProjFS
    mountPoint: '',
    logCalls: false
  }
});

async function test() {
  try {
    const secret = 'test-secret-123';
    await replicant.start(secret);
    console.log('Replicant started');
    
    // Get the filesystem
    const rootFs = replicant.filer.getRootFileSystem();
    
    // Test stat on various paths
    const paths = ['/', '/chats', '/objects', '/invites', '/debug'];
    
    for (const path of paths) {
      try {
        const stat = await rootFs.stat(path);
        console.log(`\nPath: ${path}`);
        console.log('  stat:', JSON.stringify(stat, null, 2));
        console.log('  isDirectory:', stat.isDirectory);
        console.log('  mode:', stat.mode);
      } catch (err) {
        console.log(`\nPath: ${path} - Error: ${err.message}`);
      }
    }
    
    await replicant.stop();
  } catch (error) {
    console.error('Error:', error);
  }
}

test();