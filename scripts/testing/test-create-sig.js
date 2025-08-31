const realFuse = require('fuse-native');

const ops = {
  init: (cb) => cb(0),
  getattr: function (path, cb) {
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
    if (path === '/') return cb(0, ['test']);
    return cb(0);
  },
  create: function (path, mode, cb) {
    console.log('create called with:', path, mode, 'callback function arguments:', cb.length);
    // Test different callback signatures
    console.log('Calling cb(0, 123) - error 0, fd 123');
    cb(0, 123); // Standard: error, fd
  },
  open: function (path, flags, cb) {
    console.log('open called with:', path, flags);
    cb(0, 456); // error, fd
  }
};

const fuse = new realFuse('/home/refinio/test-fuse', ops, { debug: true });

fuse.mount(err => {
  if (err) {
    console.error('❌ Mount failed:', err);
    process.exit(1);
  }
  console.log('✅ Mount successful!');
  
  setTimeout(() => {
    fuse.unmount(() => {
      console.log('Unmounted');
      process.exit(0);
    });
  }, 2000);
}); 