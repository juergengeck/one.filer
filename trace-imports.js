// Import tracer to debug what's loading FUSE
console.log('=== Import Trace ===');
console.log('Platform:', process.platform);
console.log('Starting import of lib/index.js...\n');

// Hook into module loading
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id.includes('fuse') || id.includes('FUSE')) {
        console.log(`[REQUIRE] ${id} from ${this.filename}`);
        console.trace();
    }
    return originalRequire.apply(this, arguments);
};

// Also track dynamic imports
const originalImport = global.import || (async (specifier) => import(specifier));
global.import = async function(specifier) {
    if (specifier.includes('fuse') || specifier.includes('FUSE')) {
        console.log(`[IMPORT] ${specifier}`);
        console.trace();
    }
    return originalImport.call(this, specifier);
};

// Now import the main module
import('./lib/index.js').then(() => {
    console.log('\nImport successful');
}).catch(err => {
    console.error('\nImport failed:', err.message);
    console.error('Stack:', err.stack);
});