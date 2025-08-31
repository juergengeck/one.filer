import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
    const addon = require('./lib/fuse/n-api/fuse3_napi.node');
    console.log('Addon loaded successfully');
    console.log('EPERM:', addon.EPERM);
    console.log('ENOENT:', addon.ENOENT);
    console.log('Fuse constructor:', typeof addon.Fuse);
} catch (err) {
    console.error('Failed to load addon:', err);
}