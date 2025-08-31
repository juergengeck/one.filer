import {Command} from '@commander-js/extra-typings';
import {SimpleFuseFrontend} from '../filer/SimpleFuseFrontend.js';

export const testFuseCommand = new Command('test-fuse');

testFuseCommand
    .description('Test basic FUSE functionality with minimal ESM implementation')
    .option('-m, --mount-point <path>', 'Mount point for FUSE', '/tmp/one-filer-test')
    .option('--skip-config', 'Skip FUSE configuration check (useful when FUSE is already configured)')
    .action(async (options) => {
        console.log('🚀 Testing ONE.filer ESM FUSE stack...');
        console.log(`Mount point: ${options.mountPoint}`);

        const fuseFrontend = new SimpleFuseFrontend();

        try {
            if (options.skipConfig) {
                console.log('⏭️  Skipping FUSE configuration check...');
            } else {
                // Check if FUSE is configured
                const isConfigured = await SimpleFuseFrontend.isFuseNativeConfigured();
                console.log(`FUSE configured: ${isConfigured ? '✅' : '❌'}`);

                if (!isConfigured) {
                    console.log('Configuring FUSE...');
                    await SimpleFuseFrontend.configureFuseNative();
                }
            }

            // Create mount point if it doesn't exist
            try {
                const fs = await import('fs/promises');
                await fs.mkdir(options.mountPoint, { recursive: true });
                console.log(`✅ Mount point ready: ${options.mountPoint}`);
            } catch (error) {
                console.log(`Mount point already exists or created: ${options.mountPoint}`);
            }

            console.log('🔗 Attempting FUSE mount...');
            // Start the FUSE mount
            await fuseFrontend.start(options.mountPoint);

            // Keep the process running
            await new Promise((resolve) => {
                // This will run until Ctrl+C
            });

        } catch (error) {
            console.error('❌ FUSE test failed:', error);
            process.exit(1);
        }
    }); 