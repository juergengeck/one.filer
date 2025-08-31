/**
 * Direct test of ProjFS integration with filer system
 */

console.log('🔧 Testing ProjFS integration with ONE filer...');

async function testProjFSFiler() {
    try {
        // Import the built modules
        const { WindowsFuse } = await import('./lib/fuse/windows-fuse3.js');
        
        console.log('✅ Windows FUSE module loaded successfully');
        
        // Create a simple file system mock for testing
        const mockFileSystem = {
            readdir: (path, callback) => {
                console.log(`📁 Mock readdir called for: ${path}`);
                
                if (path === '/') {
                    // Return the standard ONE filer directories
                    callback(0, ['chats', 'debug', 'invites', 'objects', 'types'], [
                        { mode: 0o040755, size: 0, mtime: new Date(), atime: new Date(), ctime: new Date(), uid: 0, gid: 0 },
                        { mode: 0o040755, size: 0, mtime: new Date(), atime: new Date(), ctime: new Date(), uid: 0, gid: 0 },
                        { mode: 0o040755, size: 0, mtime: new Date(), atime: new Date(), ctime: new Date(), uid: 0, gid: 0 },
                        { mode: 0o040755, size: 0, mtime: new Date(), atime: new Date(), ctime: new Date(), uid: 0, gid: 0 },
                        { mode: 0o040755, size: 0, mtime: new Date(), atime: new Date(), ctime: new Date(), uid: 0, gid: 0 }
                    ]);
                } else {
                    callback(0, []);
                }
            },
            
            getattr: (path, callback) => {
                console.log(`📄 Mock getattr called for: ${path}`);
                
                if (path === '/' || path === '/chats' || path === '/debug' || path === '/invites' || path === '/objects' || path === '/types') {
                    callback(0, {
                        mode: 0o040755, // directory
                        size: 0,
                        mtime: new Date(),
                        atime: new Date(),
                        ctime: new Date(),
                        uid: 0,
                        gid: 0
                    });
                } else {
                    callback(2); // ENOENT
                }
            },
            
            init: (callback) => {
                console.log('🔧 Mock init called');
                callback(0);
            }
        };
        
        // Create a unique mount path for testing
        const testMountPath = `test_projfs_${Date.now()}`;
        
        console.log(`🪟 Creating Windows FUSE instance for: ${testMountPath}`);
        
        const windowsFuse = new WindowsFuse(testMountPath, mockFileSystem, {
            displayFolder: 'ONE Filer Test'
        });
        
        console.log('📂 Attempting to mount filesystem...');
        
        await new Promise((resolve, reject) => {
            windowsFuse.mount((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        
        console.log('✅ ProjFS filesystem mounted successfully!');
        console.log(`📁 Mounted at: ${windowsFuse.mnt}`);
        console.log('🔍 Try opening Windows Explorer and navigate to the mount point');
        console.log('📂 You should see directories: chats, debug, invites, objects, types');
        
        // Keep running for 30 seconds to allow testing
        console.log('⏰ Keeping mounted for 30 seconds for testing...');
        
        setTimeout(async () => {
            console.log('🛑 Unmounting filesystem...');
            
            await new Promise((resolve) => {
                windowsFuse.unmount((err) => {
                    if (err) {
                        console.error('❌ Error during unmount:', err);
                    } else {
                        console.log('✅ Filesystem unmounted successfully');
                    }
                    resolve();
                });
            });
            
            console.log('🏁 Test completed');
        }, 30000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testProjFSFiler();