const run = async () => {
  const {default: TemporaryFileSystem} = await import('@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js');
  const fs = new TemporaryFileSystem();
  
  console.log('Testing stat for mount points:');
  const paths = ['/chats', '/debug', '/objects', '/invites', '/types'];
  
  for (const path of paths) {
    try {
      const stat = await fs.stat(path);
      console.log(`${path}:`, {
        isDirectory: stat.isDirectory,
        mode: stat.mode,
        size: stat.size
      });
    } catch (e) {
      console.log(`${path}: ERROR -`, e.message);
    }
  }
};

run().catch(console.error);