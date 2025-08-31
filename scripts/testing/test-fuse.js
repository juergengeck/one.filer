const Fuse = require('fuse-native');

const ops = {
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
    return cb(Fuse.ENOENT);
  },
  readdir: function (path, cb) {
    console.log('readdir called for:', path);
    if (path === '/') return cb(0, ['test']);
    return cb(0);
  }
};

const fuse = new Fuse('/home/refinio/test-fuse', ops, { debug: true });
console.log('Attempting to mount...');

fuse.mount(err => {
  if (err) {
    console.error('Mount failed:', err);
    process.exit(1);
  }
  console.log('Mount successful!');
  
  setTimeout(() => {
    fuse.unmount(() => {
      console.log('Unmounted');
      process.exit(0);
    });
  }, 2000);
}); 