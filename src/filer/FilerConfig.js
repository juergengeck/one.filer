"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFilerConfig = exports.DefaultFilerConfig = void 0;
const typeChecks_1 = require("../utils/typeChecks");
exports.DefaultFilerConfig = {
    mountPoint: 'mnt',
    pairingUrl: 'https://leute.dev.refinio.one/invites/invitePartner/?invited=true',
    iomMode: 'light',
    logCalls: false,
    fuseOptions: {}
};
function checkFilerConfig(config) {
    if (!(0, typeChecks_1.isObject)(config)) {
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
    if (Object.hasOwn(config, 'logCalls') && typeof config.logCalls !== 'boolean') {
        throw new Error('"logCalls" of filer configuration needs to be a boolean');
    }
    if (Object.hasOwn(config, 'fuseOptions') && !(0, typeChecks_1.isObject)(config.fuseOptions)) {
        throw new Error('"fuseOptions" of filer configuration needs to be an object.');
    }
    return config;
}
exports.checkFilerConfig = checkFilerConfig;
//# sourceMappingURL=FilerConfig.js.map