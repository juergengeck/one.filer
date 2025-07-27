import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import { serializeWithType } from '@refinio/one.core/lib/util/promise.js';
import { isObject, SET_ACCESS_MODE } from './utils/typeChecks';
import { getAllEntries } from '@refinio/one.core/lib/reverse-map-query.js';
import { sign } from '@refinio/one.models/lib/misc/Signature.js';
import { getObjectByIdHash, onVersionedObj } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { createAccess } from '@refinio/one.core/lib/access.js';
/**
 * This class manages all access rights for the replicant.
 */
export default class AccessRightsManager {
    channelManager;
    leuteModel;
    initialized = false;
    groupConfig = {};
    /**
     * Create a new instance.
     *
     * @param connectionsModel
     * @param channelManager
     * @param leuteModel
     */
    constructor(connectionsModel, channelManager, leuteModel) {
        this.channelManager = channelManager;
        this.leuteModel = leuteModel;
        // Register hook for new connections && contacts
        connectionsModel.pairing.onPairingSuccess(AccessRightsManager.trustPairingKeys.bind(this));
        onVersionedObj.addListener(this.shareProfileWithEverybody.bind(this));
    }
    /**
     * Set up the access rights handling for the application on the current instance.
     *
     * @returns {Promise<void>}
     */
    async init(groups) {
        if (this.initialized) {
            throw new Error('The SmilerAccessRightsModel is already initialized');
        }
        if (groups) {
            this.groupConfig = groups;
        }
        await this.channelManager.createChannel('contacts');
        // const mainContactObjects = await this.leuteModel.getContactObjectHashes(this.mainId);
        // await this.channelManager.postToChannelIfNotExist(
        //     'contacts',
        //     await getObject(mainContactObjects[0])
        // );
        await this.giveAccessToChannels();
        this.initialized = true;
    }
    /**
     * Shuts everything down.
     *
     * @returns {Promise<void>}
     */
    async shutdown() {
        this.initialized = false;
    }
    /**
     * Handler for new versions or new profiles.
     * @param result
     */
    async shareProfileWithEverybody(result) {
        try {
            if (result.obj.$type$ !== 'Profile' || !this.initialized) {
                return;
            }
            await serializeWithType('Share', async () => {
                const setAccessParam = {
                    id: result.idHash,
                    person: [],
                    group: this.groups('everyone'),
                    mode: SET_ACCESS_MODE.ADD
                };
                await createAccess([setAccessParam]);
            });
        }
        catch (e) {
            console.error(e);
        }
    }
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
    static async trustPairingKeys(_initiatedLocally, _localPersonId, _localInstanceId, remotePersonId, _remoteInstanceId, _token) {
        try {
            const keys = await getAllEntries(remotePersonId, 'Keys');
            if (keys.length > 0) {
                console.log('Key signing succeeded', remotePersonId);
                await sign(keys[0]);
                return;
            }
        }
        catch (e) {
            console.error(e);
        }
    }
    groups(...groupNames) {
        const groups = [];
        for (const groupName of groupNames) {
            const groupConfigEntry = this.groupConfig[groupName];
            if (groupConfigEntry !== undefined) {
                groups.push(groupConfigEntry);
            }
        }
        return groups;
    }
    /**
     * Setup access rights for the patient app.
     *
     * Note that this function is just a hack until groups are functioning properly
     *
     * @returns {Promise<void>}
     */
    async giveAccessToChannels() {
        const me = await this.leuteModel.me();
        const mainId = await me.mainIdentity();
        // Build list of access rights for our own channels
        const channelAccessRights = [
            {
                owner: mainId,
                persons: [],
                groups: this.groups('iom'),
                channels: [
                    'contacts',
                    'mainFileSystemChannelId',
                    'wbc',
                    'document',
                    'electrocardiogram',
                    'questionnaireResponse',
                    'consentFile',
                    'feedbackChannel',
                    'audioExercise'
                ]
            },
            {
                owner: mainId,
                persons: [],
                groups: this.groups('iom'),
                channels: [
                    'bodyTemperature',
                    'diary',
                    'newsChannel',
                    'incompleteQuestionnaireResponse'
                ]
            }
        ];
        await this.applyAccessRights(channelAccessRights);
    }
    /**
     * Apply the specified channel access rights by writing access objects.
     *
     * Note that the array should not have duplicate entries in regard to owner / channelname
     * combinations, otherwise only one of them will be applied. Which one is not deterministic.
     *
     * @param {ChannelAccessRights[]} channelAccessRights
     * @returns {Promise<void>}
     */
    async applyAccessRights(channelAccessRights) {
        await serializeWithType('IdAccess', async () => {
            await Promise.all(channelAccessRights.map(async (accessInfo) => {
                await Promise.all(accessInfo.channels.map(async (channelId) => {
                    try {
                        const setAccessParam = {
                            id: await calculateIdHashOfObj({
                                $type$: 'ChannelInfo',
                                id: channelId,
                                owner: accessInfo.owner
                            }),
                            person: accessInfo.persons,
                            group: accessInfo.groups,
                            mode: SET_ACCESS_MODE.REPLACE
                        };
                        await getObjectByIdHash(setAccessParam.id); // To check whether a channel with this id exists
                        await createAccess([setAccessParam]);
                    }
                    catch (error) {
                        // If the partner was not connected with this instance previously,
                        // then the calculateIdHashOfObj function will return a FileNotFoundError.
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        if (isObject(error) && error.name !== 'FileNotFoundError') {
                            console.error(error);
                        }
                    }
                }));
            }));
        });
    }
}
//# sourceMappingURL=AccessRightsManager.js.map