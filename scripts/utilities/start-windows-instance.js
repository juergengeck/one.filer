
import '@refinio/one.core/lib/system/load-nodejs.js';  // Load platform modules
import Replicant from './lib/Replicant.js';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./config-windows-instance.json', 'utf8'));
const replicant = new Replicant(config);

console.log('🪟 Starting Windows ProjFS instance...');
console.log('📡 Communication server:', config.commServerUrl);

await replicant.start('windows-secret-123');

console.log('✅ Windows instance started!');
console.log('📁 Mount point:', config.filerConfig.projfsRoot);
console.log('📋 To get invitation: Check C:\\OneFilerWindows\\invites\\iom_invite.txt');

// Keep running
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Windows instance...');
    await replicant.stop();
    process.exit(0);
});

// Keep the process alive
await new Promise(() => {});
