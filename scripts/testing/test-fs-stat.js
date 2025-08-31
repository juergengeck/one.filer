import TemporaryFileSystem from '@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js';
import ObjectsFileSystem from '@refinio/one.models/lib/fileSystems/ObjectsFileSystem.js';
import DebugFileSystem from '@refinio/one.models/lib/fileSystems/DebugFileSystem.js';
import TypesFileSystem from '@refinio/one.models/lib/fileSystems/TypesFileSystem.js';
import FileSystemHelpers from '@refinio/one.models/lib/fileSystems/FileSystemHelpers.js';

// Simple test filesystem
const rootFs = new TemporaryFileSystem({
    '/': {type: 'dir', mode: 16877},
    '/chats': {type: 'dir', mode: 16877},
    '/debug': {type: 'dir', mode: 16877},
    '/objects': {type: 'dir', mode: 16877},
    '/invites': {type: 'dir', mode: 16877}
});

async function test() {
    const stat = await rootFs.stat('/chats');
    console.log('Stat for /chats:', stat);
    
    const fileMode = FileSystemHelpers.retrieveFileMode(stat.mode);
    console.log('FileMode:', fileMode);
    console.log('isDirectory?', fileMode.type === 'dir');
}

test().catch(console.error);
