/**
 * Write Default Config Command - Write default configuration file
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import {Command} from 'commander';
import {writeJsonFile} from '../misc/configHelper.js';
import {DefaultReplicantConfig} from '../ReplicantConfig.js';
import {DefaultFilerConfig} from '../FilerConfig.js';

export const writeDefaultConfigCommand = new Command('write-default-config');

writeDefaultConfigCommand
    .description('Write default configuration file')
    .argument('<path>', 'Path to write configuration file')
    .action(async (path: string) => {
        try {
            // Create full default configuration
            const config = {
                ...DefaultReplicantConfig,
                filer: DefaultFilerConfig
            };

            // Write configuration file
            await writeJsonFile(path, config);

            console.log(`✅ Default configuration written to ${path}`);
            console.log('\nConfiguration contents:');
            console.log(JSON.stringify(config, null, 2));
        } catch (err) {
            console.error('❌ Failed to write configuration:', err);
            process.exit(1);
        }
    });