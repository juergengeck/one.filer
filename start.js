#!/usr/bin/env node

/**
 * Simple Node.js starter for ONE Leute Replicant
 */

// Set module type to ESM
process.env.NODE_OPTIONS = '--experimental-specifier-resolution=node';

import('./lib/index.js').catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});