const realFuse = require('fuse-native');

// Test with minimal operations first
console.log('Testing with minimal operations...');

const minimalOps = {
  init: (cb) => {
    console.log('init called');
    cb(0);
  },
  getattr: function (path, cb) {
    console.log('getattr called for:', path);
    if (path === '/') {
      return cb(0, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        nlink: 1,
        size: 100,
        mode: 16877,
        uid: process.getuid(),
        gid: process.getgid()
      });
    }
    return cb(realFuse.ENOENT);
  },
  readdir: function (path, cb) {
    console.log('readdir called for:', path);
    if (path === '/') return cb(0, ['test']);
    return cb(0);
  }
};

let fuse = new realFuse('/home/refinio/test-fuse', minimalOps, { debug: false });

fuse.mount(err => {
  if (err) {
    console.error('Minimal mount failed:', err);
  } else {
    console.log('✅ Minimal mount successful!');
    fuse.unmount(() => {
      console.log('Minimal unmounted');
      
      // Now test with error operation added
      console.log('\nTesting with error operation added...');
      
      const opsWithError = {
        ...minimalOps,
        error: (err) => {
          console.log('error called:', err);
        }
      };
      
      fuse = new realFuse('/home/refinio/test-fuse', opsWithError, { debug: false });
      
      fuse.mount(err => {
        if (err) {
          console.error('❌ Mount with error operation failed:', err);
        } else {
          console.log('✅ Mount with error operation successful!');
          fuse.unmount(() => {
            console.log('Unmounted with error operation');
            process.exit(0);
          });
        }
      });
    });
  }
}); 