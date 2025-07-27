import { getIdObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { isFunction } from '@refinio/one.core/lib/util/type-checks-basic.js';
import { ChannelManager, ConnectionsModel, ConsentModel, DocumentModel, LeuteModel, QuestionnaireModel, TopicModel } from '@refinio/one.models/lib/models/index.js';
import { default as IoMManager } from '@refinio/one.models/lib/models/IoM/IoMManager.js';
// import {default as GroupModel} from '@refinio/one.models/lib/models/Leute/GroupModel.js'; // Unused
import { default as Notifications } from '@refinio/one.models/lib/models/Notifications.js';
import { existsSync, readdirSync } from 'fs';
import { rimraf } from 'rimraf';
import { Filer } from './filer/Filer';
import { fillMissingWithDefaults } from './misc/configHelper';
// import {DefaultConnectionsModelConfig} from './misc/ConnectionsModelConfig'; // Unused
import { initOneCoreInstance, oneCoreInstanceExists, oneCoreInstanceInformation, shutdownOneCoreInstance } from './misc/OneCoreInit';
import AccessRightsManager from './AccessRightsManager';
import { DefaultReplicantConfig } from './ReplicantConfig';
/**
 * This class is the central component for the replicant.
 *
 * In order to start a replicant all you have to do is:
 *
 * const replicant = new Replicant({});
 * await replicant.init('my secret');
 *
 */
export default class Replicant {
    config;
    filerAccessRightsManager;
    consentFile;
    channelManager;
    leuteModel;
    questionnaires;
    connections;
    iomManager;
    documents;
    topicModel;
    notifications;
    filer;
    constructor(config) {
        if (process.platform !== 'win32' && isFunction(process.getuid) && process.getuid() === 0) {
            throw new Error('You cannot start this process as root.');
        }
        this.config = fillMissingWithDefaults(config, DefaultReplicantConfig);
        this.leuteModel = new LeuteModel(this.config.commServerUrl, this.config.createEveryoneGroup);
        this.iomManager = new IoMManager(this.leuteModel, this.config.commServerUrl);
        this.channelManager = new ChannelManager(this.leuteModel);
        this.connections = new ConnectionsModel(this.leuteModel, this.config.connectionsConfig);
        this.consentFile = new ConsentModel();
        this.filerAccessRightsManager = new AccessRightsManager(this.connections, this.channelManager, this.leuteModel);
        this.questionnaires = new QuestionnaireModel(this.channelManager);
        this.documents = new DocumentModel(this.channelManager);
        this.topicModel = new TopicModel(this.channelManager, this.leuteModel);
        this.notifications = new Notifications(this.channelManager);
        if (this.config.useFiler) {
            this.filer = new Filer({
                channelManager: this.channelManager,
                connections: this.connections,
                leuteModel: this.leuteModel,
                notifications: this.notifications,
                topicModel: this.topicModel,
                iomManager: this.iomManager
            }, this.config.filerConfig);
        }
    }
    /**
     * Start the replicant.
     *
     * This will create a new or open an existing one instance and initialize all models.
     *
     * @param secret - The secret is used to unlock the one instance. It is only used to
     * derive the master keys used for decrypting data. (at the moment only private keys are
     * encrypted)
     */
    async start(secret) {
        await initOneCoreInstance(secret, this.config.directory);
        await this.leuteModel.init();
        await this.iomManager.init();
        await this.channelManager.init();
        await this.consentFile.init(this.channelManager);
        await this.questionnaires.init();
        // Get Everyone group - it should be created by leuteModel.init() if createEveryoneGroup is true
        let everyoneGroup;
        try {
            everyoneGroup = await LeuteModel.everyoneGroup();
        }
        catch (error) {
            console.error('Error: Everyone group does not exist. Make sure createEveryoneGroup is set to true in config.');
            throw error;
        }
        await this.filerAccessRightsManager.init({
            iom: (await this.iomManager.iomGroup()).groupIdHash,
            everyone: everyoneGroup.groupIdHash
        });
        await this.documents.init();
        await this.topicModel.init();
        await this.connections.init();
        if (this.filer) {
            await this.filer.init();
        }
        await this.setPersonNameToInitialIdentityIfNone();
    }
    /**
     * Stop the replicant.
     */
    async stop() {
        for (const component of [
            this.connections,
            this.topicModel,
            this.questionnaires,
            this.consentFile,
            this.channelManager,
            this.documents,
            this.iomManager,
            this.leuteModel,
            this.filerAccessRightsManager,
            this.filer
        ]) {
            try {
                if (component) {
                    // eslint-disable-next-line no-await-in-loop
                    await component.shutdown();
                }
            }
            catch (e) {
                console.error(e);
            }
        }
        shutdownOneCoreInstance();
    }
    /**
     * This can be used to create a new one.core instance if none exists.
     *
     * This function has more options how to initialize the one.core instance compared to just using
     * the default creation done by start().
     *
     * @param identity - The identity file used to initialize the instance.
     * @param secret - The secret used to set up the instance.
     * @param directory - The directory in which to store the data.
     * @throws if an instance already exists.
     *
     */
    static async createReplicantInstance(identity, secret, directory = DefaultReplicantConfig.directory) {
        await initOneCoreInstance(secret, directory, identity);
        shutdownOneCoreInstance();
    }
    /**
     * Returns whether an instance exists in the given directory.
     *
     * @param directory - The directory in which to store the data.
     */
    static async instanceExists(directory = DefaultReplicantConfig.directory) {
        return oneCoreInstanceExists(directory);
    }
    /**
     * Returns the information used to initialize the one.core instance (except the secret).
     *
     * @param directory - The directory in which to store the data.
     */
    static async getInstanceInformation(directory = DefaultReplicantConfig.directory) {
        return oneCoreInstanceInformation(directory);
    }
    /**
     * Deletes the instance by eradicating all data in the data folder.
     *
     * Note: This whole file tries to assure that only one instance lives in the specified data
     * folder. But there might be exceptions e.g. if you manually delete the key value stores or
     * copy data in the data folder manually. So beware, that this call will delete the whole
     * directory.
     *
     * @param directory - The directory in which to store the data.
     */
    static async deleteInstance(directory = DefaultReplicantConfig.directory) {
        // This check assures, that data is only deleted if we find the key value store.
        // Otherwise we could potentially kill directories that we didn't want to delete if the
        // config file or the working directory is wrong.
        if (!(await Replicant.instanceExists(directory))) {
            return;
        }
        if (existsSync(directory)) {
            const files = readdirSync(directory);
            if (files.length > 0) {
                rimraf.sync(directory);
            }
        }
    }
    /**
     * Adds a name to our own main profile.
     */
    async setPersonNameToInitialIdentityIfNone() {
        const me = await this.leuteModel.me();
        // If we have more than one identity, then we already had an IoM pairing => no fiddling
        // with the new IoM identity.
        if (me.identities().length !== 1) {
            return;
        }
        const myMainProfile = await me.mainProfile();
        if (myMainProfile.descriptionsOfType('PersonName').length === 0) {
            const person = await getIdObject(myMainProfile.personId);
            myMainProfile.personDescriptions.push({
                $type$: 'PersonName',
                name: `Initial Replicant Identity ${person.email?.slice(0, 8) || 'unknown'}`
            });
            await myMainProfile.saveAndLoad();
        }
    }
}
//# sourceMappingURL=Replicant.js.map