import { Fuse } from './lib/fuse/native-fuse3.js';

const mountPoint = '/home/gecko/simple-filer';
console.log('Mounting at:', mountPoint);

const ops = {
    getattr: (path, cb) => {
        console.log('getattr:', path);
        if (path === '/') {
            cb(0, { 
                mode: 16877, // directory
                size: 4096,
                uid: process.getuid(),
                gid: process.getgid()
            });
        } else if (path === '/hello.txt') {
            cb(0, { 
                mode: 33188, // file
                size: 12,
                uid: process.getuid(),
                gid: process.getgid()
            });
        } else {
            cb(Fuse.ENOENT);
        }
    },
    readdir: (path, cb) => {
        console.log('readdir:', path);
        if (path === '/') {
            cb(0, ['hello.txt']);
        } else {
            cb(Fuse.ENOENT);
        }
    },
    read: (path, fd, buffer, length, position, cb) => {
        console.log('read:', path);
        if (path === '/hello.txt') {
            const content = 'Hello FUSE!\n';
            const slice = content.slice(position, position + length);
            buffer.write(slice);
            cb(slice.length);
        } else {
            cb(Fuse.ENOENT);
        }
    }
};

const fuse = new Fuse(mountPoint, ops, { debug: true });
fuse.mount(err => {
    if (err) {
        console.error('Mount error:', err);
        process.exit(1);
    }
    console.log('Filesystem mounted at', mountPoint);
    console.log('You can check it at:', mountPoint);
    console.log('Press Ctrl+C to unmount');
});

process.on('SIGINT', () => {
    console.log('\nUnmounting...');
    fuse.unmount(err => {
        if (err) {
            console.error('Unmount error:', err);
            process.exit(1);
        }
        console.log('Unmounted successfully');
        process.exit(0);
    });
});