/**
 * Start Command - Start one.filer service
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import {Command} from 'commander';
import {readJsonFileOrEmpty, assignConfigOption} from '../misc/configHelper.js';
import {DefaultFilerConfig} from '../FilerConfig.js';
import Replicant from '../Replicant.js';
import {checkReplicantConfig, DefaultReplicantConfig} from '../ReplicantConfig.js';

export const startCommand = new Command('start');

startCommand
    .description('Start one.filer service')
    .requiredOption('-s, --secret <string>', 'ONE instance password')
    .option(
        '-c, --config <string>',
        'The path to the configuration file. Defaults to "config.json".'
    )
    .option(
        '-d, --directory <string>',
        `Path to desired location of the ONE data folder. Defaults to "${DefaultReplicantConfig.directory}"`
    )
    .option('-l, --log', 'Enable logging')
    .option('--log-debug', 'Enable logging with debug messages')
    .option(
        '--commServerUrl <URL>',
        `URL to a communication server. Defaults to "${DefaultReplicantConfig.commServerUrl}"`
    )
    .option(
        '--pairing-url <URL>',
        `URL to a one.leute instance for invites. Defaults to "${DefaultFilerConfig.pairingUrl}"`
    )
    .option(
        '--pairing-iom-mode <string>',
        `The mode of the iom: "full" or "light". Defaults to "${DefaultFilerConfig.iomMode}"`
    )
    .option(
        '--filer <boolean>',
        `Enable filer directory. Defaults to "${DefaultReplicantConfig.useFiler}"`
    )
    .option(
        '--filer-log-calls <boolean>',
        `Enable logging of all filer calls. Defaults to "${DefaultFilerConfig.logCalls}"`
    )
    .option(
        '--filer-mount-point <string>',
        `The filer mount point path. Defaults to "${DefaultFilerConfig.mountPoint}"`
    )
    .action(async options => {
        try {
            // Read configuration file
            const config = await readJsonFileOrEmpty(options.config || 'config.json');
            const replicantConfig = checkReplicantConfig(config);

            // Apply command line options
            assignConfigOption(replicantConfig, 'directory', options.directory);
            assignConfigOption(replicantConfig, 'commServerUrl', options.commServerUrl);
            assignConfigOption(replicantConfig, 'useFiler', options.filer);
            assignConfigOption(replicantConfig, 'filerConfig.pairingUrl', options.pairingUrl);
            assignConfigOption(replicantConfig, 'filerConfig.iomMode', options.pairingIomMode);
            assignConfigOption(replicantConfig, 'filerConfig.logCalls', options.filerLogCalls);
            assignConfigOption(replicantConfig, 'filerConfig.mountPoint', options.filerMountPoint);

            // Create and start replicant
            const replicant = new Replicant(replicantConfig);
            await replicant.start(options.secret);

            console.log('✅ Replicant started successfully');

            // Handle graceful shutdown
            process.on('SIGINT', async () => {
                console.log('\n🛑 Shutting down...');
                try {
                    await replicant.stop();
                    console.log('✅ Shutdown complete');
                    process.exit(0);
                } catch (err) {
                    console.error('❌ Shutdown error:', err);
                    process.exit(1);
                }
            });

            // Keep process running
            process.stdin.resume();
        } catch (err) {
            console.error('❌ Failed to start:', err);
            process.exit(1);
        }
    });