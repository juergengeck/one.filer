/**
 * Configure Command - Configure ONE instance
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import {Command} from 'commander';
import {readJsonFileOrEmpty, writeJsonFile} from '../misc/configHelper.js';
import {checkReplicantConfig} from '../ReplicantConfig.js';
import * as readline from 'readline';

export const configureCommand = new Command('configure');

configureCommand
    .description('Configure ONE instance')
    .option(
        '-c, --config <string>',
        'The path to the configuration file. Defaults to "config.json".'
    )
    .action(async options => {
        try {
            const configPath = options.config || 'config.json';
            const config = await readJsonFileOrEmpty(configPath);

            console.log('🔧 ONE.filer Configuration');
            console.log('Press Enter to keep current value\n');

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const question = (prompt: string): Promise<string> => {
                return new Promise(resolve => {
                    rl.question(prompt, resolve);
                });
            };

            // Configure basic settings
            const directory = await question(
                `Data directory [${config.directory || 'data'}]: `
            );
            if (directory) config.directory = directory;

            const commServerUrl = await question(
                `Communication server URL [${config.commServerUrl || 'wss://comm.one.eu.replicant.refinio.one'}]: `
            );
            if (commServerUrl) config.commServerUrl = commServerUrl;

            const useFiler = await question(
                `Enable Filer (yes/no) [${config.useFiler !== false ? 'yes' : 'no'}]: `
            );
            if (useFiler) {
                config.useFiler = useFiler.toLowerCase() === 'yes';
            }

            // Configure Filer settings if enabled
            if (config.useFiler !== false) {
                console.log('\n📁 Filer Configuration:');
                
                if (!config.filer) config.filer = {};

                const mountPoint = await question(
                    `Mount point [${config.filer.mountPoint || '/tmp/one-filer'}]: `
                );
                if (mountPoint) config.filer.mountPoint = mountPoint;

                const logCalls = await question(
                    `Log FUSE calls (yes/no) [${config.filer.logCalls ? 'yes' : 'no'}]: `
                );
                if (logCalls) {
                    config.filer.logCalls = logCalls.toLowerCase() === 'yes';
                }

                const pairingUrl = await question(
                    `Pairing URL [${config.filer.pairingUrl || 'https://app.leute.io'}]: `
                );
                if (pairingUrl) config.filer.pairingUrl = pairingUrl;

                const iomMode = await question(
                    `IoM mode (full/light) [${config.filer.iomMode || 'light'}]: `
                );
                if (iomMode) config.filer.iomMode = iomMode;
            }

            rl.close();

            // Validate configuration
            const validatedConfig = checkReplicantConfig(config);

            // Save configuration
            await writeJsonFile(configPath, config);

            console.log(`\n✅ Configuration saved to ${configPath}`);
        } catch (err) {
            console.error('❌ Configuration failed:', err);
            process.exit(1);
        }
    });