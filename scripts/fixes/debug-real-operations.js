const realFuse = require('fuse-native');

// Import our actual adapter to test its operations
const FuseApiToIFileSystemAdapter = require('./lib/filer/FuseApiToIFileSystemAdapter.js').default;

console.log('Testing with our actual FuseApiToIFileSystemAdapter operations...');

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

// Test operations incrementally - based on our FuseFrontend.ts
const operationSets = [
  // Set 1: Basic operations
  {
    name: "Basic operations",
    ops: {
      init: (cb) => { console.log('init called'); adapter.fuseInit(cb); },
      error: (err) => { console.log('error called:', err); adapter.fuseError(() => {}); },
      getattr: adapter.fuseGetattr.bind(adapter),
      readdir: adapter.fuseReaddir.bind(adapter)
    }
  },
  // Set 2: Add access and statfs
  {
    name: "With access & statfs",
    ops: {
      init: (cb) => { console.log('init called'); adapter.fuseInit(cb); },
      error: (err) => { console.log('error called:', err); adapter.fuseError(() => {}); },
      getattr: adapter.fuseGetattr.bind(adapter),
      readdir: adapter.fuseReaddir.bind(adapter),
      access: adapter.fuseAccess.bind(adapter),
      statfs: adapter.fuseStatfs.bind(adapter)
    }
  },
  // Set 3: Add the problematic ones
  {
    name: "With fgetattr (suspicious)",
    ops: {
      init: (cb) => { console.log('init called'); adapter.fuseInit(cb); },
      error: (err) => { console.log('error called:', err); adapter.fuseError(() => {}); },
      getattr: adapter.fuseGetattr.bind(adapter),
      readdir: adapter.fuseReaddir.bind(adapter),
      access: adapter.fuseAccess.bind(adapter),
      statfs: adapter.fuseStatfs.bind(adapter),
      fgetattr: adapter.fuseFgetattr.bind(adapter)
    }
  },
  // Set 4: Add file operations
  {
    name: "With file operations",
    ops: {
      init: (cb) => { console.log('init called'); adapter.fuseInit(cb); },
      error: (err) => { console.log('error called:', err); adapter.fuseError(() => {}); },
      getattr: adapter.fuseGetattr.bind(adapter),
      readdir: adapter.fuseReaddir.bind(adapter),
      access: adapter.fuseAccess.bind(adapter),
      statfs: adapter.fuseStatfs.bind(adapter),
      fgetattr: adapter.fuseFgetattr.bind(adapter),
      flush: adapter.fuseFlush.bind(adapter),
      open: adapter.fuseOpen.bind(adapter),
      read: adapter.fuseRead.bind(adapter),
      write: adapter.fuseWrite.bind(adapter),
      create: adapter.fuseCreate.bind(adapter),
      release: adapter.fuseRelease.bind(adapter)
    }
  }
];

async function testOperationSet(set) {
  return new Promise((resolve) => {
    console.log(`\n=== Testing: ${set.name} ===`);
    console.log('Operations:', Object.keys(set.ops).join(', '));
    
    const fuse = new realFuse('/home/refinio/test-mount', set.ops, { debug: false });
    
    fuse.mount(err => {
      if (err) {
        console.log(`❌ FAILED: ${err.message}`);
        resolve(false);
      } else {
        console.log(`✅ SUCCESS`);
        fuse.unmount(() => {
          resolve(true);
        });
      }
    });
  });
}

async function runTests() {
  for (const set of operationSets) {
    const success = await testOperationSet(set);
    if (!success) {
      console.log(`\n🔍 IDENTIFIED PROBLEM in operation set: ${set.name}`);
      break;
    }
  }
  
  console.log('\nTest complete');
  process.exit(0);
}

runTests().catch(console.error); 