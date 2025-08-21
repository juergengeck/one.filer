// This script will be executed in the renderer process to trigger login
window.electronAPI.login({
    secret: 'test-secret',
    configPath: undefined
}).then(result => {
    console.log('Login result:', result);
}).catch(err => {
    console.error('Login error:', err);
});