"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Filer = void 0;
const TemporaryFileSystem_js_1 = __importDefault(require("@refinio/one.models/lib/fileSystems/TemporaryFileSystem.js"));
const ObjectsFileSystem_js_1 = __importDefault(require("@refinio/one.models/lib/fileSystems/ObjectsFileSystem.js"));
const DebugFileSystem_js_1 = __importDefault(require("@refinio/one.models/lib/fileSystems/DebugFileSystem.js"));
const TypesFileSystem_js_1 = __importDefault(require("@refinio/one.models/lib/fileSystems/TypesFileSystem.js"));
const ChatFileSystem_js_1 = __importDefault(require("@refinio/one.models/lib/fileSystems/ChatFileSystem.js"));
const PairingFileSystem_js_1 = __importDefault(require("@refinio/one.models/lib/fileSystems/PairingFileSystem.js"));
const TestDataFileSystem_js_1 = require("../fileSystems/TestDataFileSystem.js");
const commit_hash_1 = require("../commit-hash");
const FilerConfig_1 = require("./FilerConfig");
const FuseFrontend_1 = require("./FuseFrontend");
const configHelper_1 = require("../misc/configHelper");
/**
 * This class represents the main starting point for `one.filer`
 *
 * It has a default composition of file systems. See setupRootFileSystem for details.
 */
class Filer {
    models;
    config;
    shutdownFunctions = [];
    constructor(models, config) {
        this.config = (0, configHelper_1.fillMissingWithDefaults)(config, FilerConfig_1.DefaultFilerConfig);
        this.models = models;
    }
    /**
     * Init the filer by setting up file systems and mounting fuse.
     */
    async init() {
        // Ensure we're running in Node.js environment (WSL2 Debian with Node.js)
        if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
            throw new Error('Fuse can only be mounted in Node.js environment');
        }
        // Don't allow FUSE on Windows
        if (process.platform === 'win32') {
            throw new Error('FUSE not supported on Windows - use ProjFS mode instead');
        }
        const rootFileSystem = await this.setupRootFileSystem();
        // Always use standard FUSE in WSL2
        console.log('🐧 Starting FUSE in WSL2...');
        const fuseFrontend = new FuseFrontend_1.FuseFrontend();
        await fuseFrontend.start(rootFileSystem, this.config.mountPoint, this.config.logCalls, this.config.fuseOptions || {});
        this.shutdownFunctions.push(fuseFrontend.stop.bind(fuseFrontend));
        console.log(`[info]: Filer file system was mounted at ${this.config.mountPoint}`);
    }
    /**
     * Shutdown filer.
     */
    async shutdown() {
        for await (const fn of this.shutdownFunctions) {
            try {
                await fn();
            }
            catch (e) {
                console.error('Failed to exscute shutdown routine', e);
            }
        }
        this.shutdownFunctions = [];
    }
    /**
     * Set up the root filesystem by mounting all wanted filesystems.
     */
    async setupRootFileSystem() {
        const chatFileSystem = new ChatFileSystem_js_1.default(this.models.leuteModel, this.models.topicModel, this.models.channelManager, this.models.notifications, '/objects');
        const debugFileSystem = new DebugFileSystem_js_1.default(this.models.leuteModel, this.models.topicModel, this.models.connections, this.models.channelManager);
        console.log('[TRACE] Creating PairingFileSystem with:', {
            hasConnections: !!this.models.connections,
            hasIomManager: !!this.models.iomManager,
            pairingUrl: this.config.pairingUrl,
            iomMode: this.config.iomMode
        });
        const pairingFileSystem = new PairingFileSystem_js_1.default(this.models.connections, this.models.iomManager, this.config.pairingUrl, this.config.iomMode);
        console.log('[TRACE] PairingFileSystem created');
        const objectsFileSystem = new ObjectsFileSystem_js_1.default();
        const typesFileSystem = new TypesFileSystem_js_1.default();
        debugFileSystem.commitHash = commit_hash_1.COMMIT_HASH;
        const rootFileSystem = new TemporaryFileSystem_js_1.default();
        await rootFileSystem.mountFileSystem('/chats', chatFileSystem);
        await rootFileSystem.mountFileSystem('/debug', debugFileSystem);
        await rootFileSystem.mountFileSystem('/invites', pairingFileSystem);
        await rootFileSystem.mountFileSystem('/objects', objectsFileSystem);
        await rootFileSystem.mountFileSystem('/types', typesFileSystem);
        // Mount test data filesystem
        const testDataFileSystem = new TestDataFileSystem_js_1.TestDataFileSystem();
        await rootFileSystem.mountFileSystem('/test-data', testDataFileSystem);
        // Initialize test-data immediately to ensure it's ready
        await testDataFileSystem.initialize();
        return rootFileSystem;
    }
}
exports.Filer = Filer;
//# sourceMappingURL=Filer.js.map