import type { ConnectionsModel } from '@refinio/one.models/lib/models/index.js';
import type { ChannelManager, LeuteModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import type IoMManager from '@refinio/one.models/lib/models/IoM/IoMManager.js';
import type Notifications from '@refinio/one.models/lib/models/Notifications.js';
import type { FilerConfig } from './FilerConfig';
export interface FilerModels {
    channelManager: ChannelManager;
    connections: ConnectionsModel;
    leuteModel: LeuteModel;
    notifications: Notifications;
    topicModel: TopicModel;
    iomManager: IoMManager;
}
/**
 * This class represents the main starting point for `one.filer`
 *
 * It has a default composition of file systems. See setupRootFileSystem for details.
 */
export declare class Filer {
    private readonly models;
    private readonly config;
    private shutdownFunctions;
    constructor(models: FilerModels, config: Partial<FilerConfig>);
    /**
     * Init the filer by setting up file systems and mounting fuse.
     */
    init(): Promise<void>;
    /**
     * Shutdown filer.
     */
    shutdown(): Promise<void>;
    /**
     * Set up the root filesystem by mounting all wanted filesystems.
     */
    private setupRootFileSystem;
}
//# sourceMappingURL=Filer.d.ts.map