/**
 * Delete Command - Delete ONE instance
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import {Command} from 'commander';
import Replicant from '../Replicant.js';
import {readJsonFileOrEmpty} from '../misc/configHelper.js';
import {DefaultReplicantConfig} from '../ReplicantConfig.js';
import * as readline from 'readline';

export const deleteCommand = new Command('delete');

deleteCommand
    .description('Delete ONE instance')
    .option(
        '-d, --directory <string>',
        `Path to the ONE data folder. Defaults to "${DefaultReplicantConfig.directory}"`
    )
    .option(
        '-c, --config <string>',
        'The path to the configuration file. Defaults to "config.json".'
    )
    .option('--force', 'Delete without confirmation')
    .action(async options => {
        try {
            // Determine directory
            let directory = options.directory;
            
            if (!directory && options.config) {
                const config = await readJsonFileOrEmpty(options.config);
                directory = config.directory;
            }
            
            if (!directory) {
                directory = DefaultReplicantConfig.directory;
            }

            console.log(`⚠️  This will permanently delete the ONE instance at: ${directory}`);

            // Ask for confirmation unless --force is used
            if (!options.force) {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise<string>(resolve => {
                    rl.question('Are you sure? Type "yes" to confirm: ', resolve);
                });
                rl.close();

                if (answer.toLowerCase() !== 'yes') {
                    console.log('❌ Deletion cancelled');
                    process.exit(0);
                }
            }

            // Delete the instance
            await Replicant.deleteInstance(directory);

            console.log(`✅ Instance deleted successfully from ${directory}`);
        } catch (err) {
            console.error('❌ Deletion failed:', err);
            process.exit(1);
        }
    });