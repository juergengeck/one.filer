import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
import type { LeuteModel } from '@refinio/one.models/lib/models/index.js';
import type { SHA256IdHash } from './types/compatibility.js';
import type { Group } from '@refinio/one.core/lib/recipes.js';
import type { ConnectionsModel } from '@refinio/one.models/lib/models/index.js';
interface GroupConfig {
    iom?: SHA256IdHash<Group>;
    everyone?: SHA256IdHash<Group>;
}
/**
 * This class manages all access rights for the replicant.
 */
export default class AccessRightsManager {
    private readonly channelManager;
    private readonly leuteModel;
    private initialized;
    private groupConfig;
    /**
     * Create a new instance.
     *
     * @param connectionsModel
     * @param channelManager
     * @param leuteModel
     */
    constructor(connectionsModel: ConnectionsModel, channelManager: ChannelManager, leuteModel: LeuteModel);
    /**
     * Set up the access rights handling for the application on the current instance.
     *
     * @returns {Promise<void>}
     */
    init(groups?: GroupConfig): Promise<void>;
    /**
     * Shuts everything down.
     *
     * @returns {Promise<void>}
     */
    shutdown(): Promise<void>;
    /**
     * Handler for new versions or new profiles.
     * @param result
     */
    private shareProfileWithEverybody;
    /**
     * This function trusts the keys of the newly paired connection.
     *
     * Since keys are transported after the established connection via chum, we need to wait
     * for a while until keys are available. => 10 retries each seconds.
     *
     * @param _initiatedLocally
     * @param _localPersonId
     * @param _localInstanceId
     * @param remotePersonId
     * @param _remoteInstanceId
     * @param _token
     */
    private static trustPairingKeys;
    private groups;
    /**
     * Setup access rights for the patient app.
     *
     * Note that this function is just a hack until groups are functioning properly
     *
     * @returns {Promise<void>}
     */
    private giveAccessToChannels;
    /**
     * Apply the specified channel access rights by writing access objects.
     *
     * Note that the array should not have duplicate entries in regard to owner / channelname
     * combinations, otherwise only one of them will be applied. Which one is not deterministic.
     *
     * @param {ChannelAccessRights[]} channelAccessRights
     * @returns {Promise<void>}
     */
    private applyAccessRights;
}
export {};
//# sourceMappingURL=AccessRightsManager.d.ts.map