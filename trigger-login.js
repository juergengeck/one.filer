import { writeFileSync } from 'fs';

// Wait a bit for the app to start
setTimeout(() => {
    console.log('Triggering login by creating login-trigger.txt...');
    writeFileSync('electron-app/login-trigger.txt', 'trigger');
}, 5000);