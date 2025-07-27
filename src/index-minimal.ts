#!/usr/bin/env node

import {Command} from '@commander-js/extra-typings';
import {testFuseCommand} from './commands/test-fuse.js';

const program = new Command();

program
    .name('one-filer')
    .description('ONE.filer - Windows Explorer integration via WSL2 FUSE (ESM Test)')
    .version('4.0.0-beta-1');

// Add the test command
program.addCommand(testFuseCommand);

// Parse command line arguments
program.parse(); 