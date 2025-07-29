import {Command} from '@commander-js/extra-typings';
import {COLOR} from '@refinio/one.core/lib/logger.js';

export const configureCommand = new Command('configure');

configureCommand
    .description('Configure fuse-native (may need root/admin privileges)')
    .action(async () => {
        try {
            // Only load FuseFrontend on Linux - Windows uses ProjFS
            if (process.platform === 'win32') {
                console.log('Configure command is not needed on Windows. ProjFS is used instead of FUSE.');
                return;
            }
            
            const {FuseFrontend} = await import('../filer/FuseFrontend.js');
            
            if (await FuseFrontend.isFuseNativeConfigured()) {
                console.log('fuse-native already configured.');
                return;
            }

            await FuseFrontend.configureFuseNative();

            console.log('fuse-native configured.');
        } catch (err) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            console.log(`${COLOR.FG_RED}${err}${COLOR.OFF}`);
            process.exit(1);
        }
    });
