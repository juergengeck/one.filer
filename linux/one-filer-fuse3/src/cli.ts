#!/usr/bin/env node
/**
 * ONE.filer FUSE3 CLI - Full Replicant Implementation
 * 
 * Command-line interface matching the original Linux one.filer
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import { program } from 'commander';
import { platform } from '@refinio/fuse3';
import { configureCommand } from './commands/configure.js';
import { deleteCommand } from './commands/delete.js';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { writeDefaultConfigCommand } from './commands/write-default-config.js';

// Load ONE Core Node.js modules
async function main(): Promise<void> {
    // Check platform
    if (!platform.isLinux) {
        console.error('❌ This tool only works on Linux. Current platform:', process.platform);
        process.exit(1);
    }

    // Load ONE Core platform modules
    await import('@refinio/one.core/lib/system/load-nodejs.js');

    // Set up uncaught exception handler
    process.on('uncaughtException', (err, origin) => {
        console.error(`Uncaught ${err.name}, Origin: ${origin}`);
        console.error(err.message);
        console.error(err.stack);
        process.exit(1);
    });

    // Configure program
    await program
        .name('one-filer-fuse3')
        .version('1.0.0', '-v, --version', 'Display the version')
        .description('Command Line Interface for ONE.filer with FUSE3 on Linux')
        .addCommand(configureCommand)
        .addCommand(deleteCommand)
        .addCommand(initCommand)
        .addCommand(startCommand, { isDefault: true })
        .addCommand(writeDefaultConfigCommand)
        .parseAsync();
}

// Run main function
main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});