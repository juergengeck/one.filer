import { isObject } from '../utils/typeChecks';
export const DefaultFilerConfig = {
    mountPoint: 'mnt',
    pairingUrl: 'https://leute.dev.refinio.one/invites/invitePartner/?invited=true/',
    iomMode: 'light',
    logCalls: false,
    fuseOptions: {}
};
export function checkFilerConfig(config) {
    if (!isObject(config)) {
        throw new Error('Filer configuration needs to be an object.');
    }
    if (Object.hasOwn(config, 'mountPoint') && typeof config.mountPoint !== 'string') {
        throw new Error('"mountPoint" of filer configuration needs to be a string.');
    }
    if (Object.hasOwn(config, 'pairingUrl') && typeof config.pairingUrl !== 'string') {
        throw new Error('"pairingUrl" of filer configuration needs to be a string.');
    }
    if (Object.hasOwn(config, 'iomMode') &&
        (typeof config.iomMode !== 'string' || !['light', 'full'].includes(config.iomMode))) {
        throw new Error('"iomMode" of filer configuration needs to be "light" or "full"');
    }
    if (Object.hasOwn(config, 'logCalls') !== undefined && typeof config.logCalls !== 'boolean') {
        throw new Error('"logCalls" of filer configuration needs to be a boolean');
    }
    if (Object.hasOwn(config, 'fuseOptions') && !isObject(config.fuseOptions)) {
        throw new Error('"fuseOptions" of filer configuration needs to be an object.');
    }
    return config;
}
//# sourceMappingURL=FilerConfig.js.map