const realFuse = require('fuse-native');
const { Fuse } = require('./lib/fuse/native-fuse3.js');

console.log('Testing our Fuse wrapper vs direct fuse-native...');

const ops = {
  init: (cb) => {
    console.log('init called');
    cb(0);
  },
  error: (err) => {
    console.log('error called:', err);
  },
  getattr: function (path, cb) {
    if (path === '/') {
      return cb(0, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        nlink: 1,
        size: 100,
        mode: 16877,
        uid: process.getuid ? process.getuid() : 0,
        gid: process.getgid ? process.getgid() : 0
      });
    }
    return cb(realFuse.ENOENT);
  },
  readdir: function (path, cb) {
    if (path === '/') return cb(0, ['test']);
    return cb(0, []);
  }
};

console.log('\n=== Test 1: Direct fuse-native ===');
const fuse1 = new realFuse('/home/refinio/test-mount', ops, { debug: false });

fuse1.mount(err => {
  if (err) {
    console.log(`❌ Direct fuse-native FAILED: ${err.message}`);
  } else {
    console.log(`✅ Direct fuse-native SUCCESS`);
    fuse1.unmount(() => {
      
      // Test our wrapper
      console.log('\n=== Test 2: Our Fuse wrapper ===');
      const fuse2 = new Fuse('/home/refinio/test-mount', ops, { debug: false });
      
      fuse2.mount(err2 => {
        if (err2) {
          console.log(`❌ Our wrapper FAILED: ${err2.message}`);
        } else {
          console.log(`✅ Our wrapper SUCCESS`);
          fuse2.unmount(() => {
            console.log('All tests complete');
            process.exit(0);
          });
        }
      });
    });
  }
}); 