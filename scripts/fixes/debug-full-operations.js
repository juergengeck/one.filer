const realFuse = require('fuse-native');
const FuseApiToIFileSystemAdapter = require('./lib/filer/FuseApiToIFileSystemAdapter.js').default;

console.log('Testing with COMPLETE operation set from our application...');

// Create a mock filesystem
const mockFs = {
  readDir: () => Promise.resolve({children: ['test']}),
  getattr: () => Promise.resolve({
    size: 100,
    mode: 33188,
    mtime: new Date(),
    atime: new Date(),
    ctime: new Date(),
    uid: process.getuid ? process.getuid() : 0,
    gid: process.getgid ? process.getgid() : 0
  }),
  supportsChunkedReading: () => false,
  createDir: () => Promise.resolve(),
  createFile: () => Promise.resolve(),
  unlink: () => Promise.resolve(),
  symlink: () => Promise.resolve(),
  readlink: () => Promise.resolve({content: Buffer.from('test')}),
  rename: () => Promise.resolve()
};

// Create our adapter
const adapter = new FuseApiToIFileSystemAdapter(mockFs, '/home/refinio/test-mount', false);

// EXACT same operations as in FuseFrontend.ts
const fuseHandlers = {
  init: (cb) => {
    console.log('🔧 FUSE init called');
    adapter.fuseInit(cb);
  },
  error: (err) => {
    console.error('🔧 FUSE error called:', err);
    adapter.fuseError(() => {});
  },
  getattr: (path, cb) => {
    console.log('🔧 FUSE getattr called:', path);
    adapter.fuseGetattr(path, cb);
  },
  readdir: (path, cb) => {
    console.log('🔧 FUSE readdir called:', path);
    adapter.fuseReaddir(path, cb);
  },
  access: adapter.fuseAccess.bind(adapter),
  statfs: adapter.fuseStatfs.bind(adapter),
  fgetattr: adapter.fuseFgetattr.bind(adapter),
  flush: adapter.fuseFlush.bind(adapter),
  fsync: adapter.fuseFsync.bind(adapter),
  fsyncdir: adapter.fuseFsyncdir.bind(adapter),
  truncate: adapter.fuseTruncate.bind(adapter),
  ftruncate: adapter.fuseFtruncate.bind(adapter),
  readlink: adapter.fuseReadlink.bind(adapter),
  chown: adapter.fuseChown.bind(adapter),
  chmod: adapter.fuseChmod.bind(adapter),
  mknod: adapter.fuseMknod.bind(adapter),
  setxattr: adapter.fuseSetxattr.bind(adapter),
  getxattr: (path, name, cb) => {
    adapter.fuseGetxattr(path, name, 0, (err, xattr) => {
      cb(err, xattr || undefined);
    });
  },
  listxattr: adapter.fuseListxattr.bind(adapter),
  removexattr: adapter.fuseRemovexattr.bind(adapter),
  open: adapter.fuseOpen.bind(adapter),
  opendir: adapter.fuseOpendir.bind(adapter),
  read: adapter.fuseRead.bind(adapter),
  write: adapter.fuseWrite.bind(adapter),
  release: adapter.fuseRelease.bind(adapter),
  releasedir: adapter.fuseReleasedir.bind(adapter),
  create: adapter.fuseCreate.bind(adapter),
  utimens: (path, atime, mtime, cb) => {
    adapter.fuseUtimens(path, new Date(atime * 1000), new Date(mtime * 1000), cb);
  },
  unlink: adapter.fuseUnlink.bind(adapter),
  rename: adapter.fuseRename.bind(adapter),
  link: adapter.fuseLink.bind(adapter),
  symlink: adapter.fuseSymlink.bind(adapter),
  mkdir: adapter.fuseMkdir.bind(adapter),
  rmdir: adapter.fuseRmdir.bind(adapter)
};

console.log('Operations count:', Object.keys(fuseHandlers).length);
console.log('Operations:', Object.keys(fuseHandlers).join(', '));

// Test 1: With same options as our application
console.log('\n=== Test 1: With same options as our application ===');
const fuse1 = new realFuse('/home/refinio/test-mount', fuseHandlers, {
  displayFolder: 'One FUSE'
});

fuse1.mount(err => {
  if (err) {
    console.log(`❌ FAILED with displayFolder option: ${err.message}`);
    
    // Test 2: Without displayFolder option
    console.log('\n=== Test 2: Without displayFolder option ===');
    const fuse2 = new realFuse('/home/refinio/test-mount', fuseHandlers, {
      debug: true
    });
    
    fuse2.mount(err2 => {
      if (err2) {
        console.log(`❌ FAILED without displayFolder: ${err2.message}`);
        
        // Test 3: With minimal options
        console.log('\n=== Test 3: With minimal options ===');
        const fuse3 = new realFuse('/home/refinio/test-mount', fuseHandlers, {});
        
        fuse3.mount(err3 => {
          if (err3) {
            console.log(`❌ FAILED with minimal options: ${err3.message}`);
            console.log('\n🔍 The issue is with our complete operation set or specific operation signatures!');
          } else {
            console.log(`✅ SUCCESS with minimal options`);
            fuse3.unmount(() => {
              console.log('Unmounted successfully');
            });
          }
          process.exit(0);
        });
      } else {
        console.log(`✅ SUCCESS without displayFolder`);
        fuse2.unmount(() => {
          console.log('Unmounted successfully');
          process.exit(0);
        });
      }
    });
  } else {
    console.log(`✅ SUCCESS with displayFolder option`);
    fuse1.unmount(() => {
      console.log('Unmounted successfully');
      process.exit(0);
    });
  }
}); 