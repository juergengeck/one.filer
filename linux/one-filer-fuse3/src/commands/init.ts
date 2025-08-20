/**
 * Init Command - Initialize ONE instance
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import {Command} from 'commander';
import {generateNewIdentity} from '@refinio/one.models/lib/misc/IdentityExchange.js';
import type {IdentityWithSecrets} from '@refinio/one.models/lib/misc/IdentityExchange.js';
import {initOneCoreInstance, oneCoreInstanceExists} from '../misc/OneCoreInit.js';
import {writeJsonFile} from '../misc/configHelper.js';
import {DefaultReplicantConfig} from '../ReplicantConfig.js';
import fs from 'fs/promises';
import path from 'path';

export const initCommand = new Command('init');

initCommand
    .description('Initialize a new ONE instance')
    .requiredOption('-s, --secret <string>', 'ONE instance password')
    .option(
        '-d, --directory <string>',
        `Path to desired location of the ONE data folder. Defaults to "${DefaultReplicantConfig.directory}"`
    )
    .option(
        '-c, --config <string>',
        'Path to save configuration file. Defaults to "config.json"'
    )
    .option('--force', 'Force initialization even if instance already exists')
    .action(async options => {
        try {
            const directory = options.directory || DefaultReplicantConfig.directory;
            const configPath = options.config || 'config.json';

            // Check if instance already exists
            if (oneCoreInstanceExists(directory) && !options.force) {
                console.error(`❌ Instance already exists at ${directory}`);
                console.error('Use --force to reinitialize');
                process.exit(1);
            }

            console.log(`🔧 Initializing ONE instance at ${directory}...`);

            // Create directory if it doesn't exist
            await fs.mkdir(directory, { recursive: true });

            // Generate new identity
            const identity = await generateNewIdentity();

            // Initialize ONE Core instance
            await initOneCoreInstance({
                directory,
                secret: options.secret,
                identity
            });

            // Create default configuration
            const config = {
                ...DefaultReplicantConfig,
                directory
            };

            // Save configuration file
            await writeJsonFile(configPath, config);

            console.log(`✅ Instance initialized successfully at ${directory}`);
            console.log(`✅ Configuration saved to ${configPath}`);
            console.log(`🔑 Identity hash: ${identity.identity}`);
            console.log('\nYou can now start the service with:');
            console.log(`  one-filer-fuse3 start --secret "${options.secret}" --config "${configPath}"`);
        } catch (err) {
            console.error('❌ Initialization failed:', err);
            process.exit(1);
        }
    });