/**
 * Replicant - Central orchestrator for ONE.filer
 * 
 * This class initializes and manages all ONE.models components and the Filer.
 * Adapted from the current project's Replicant to use @refinio/fuse3.
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import {getIdObject} from '@refinio/one.core/lib/storage-versioned-objects.js';
import {isFunction} from '@refinio/one.core/lib/util/type-checks-basic.js';
import type {IdentityWithSecrets} from '@refinio/one.models/lib/misc/IdentityExchange.js';
import {
    ChannelManager,
    ConnectionsModel,
    ConsentModel,
    DocumentModel,
    LeuteModel,
    QuestionnaireModel,
    TopicModel
} from '@refinio/one.models/lib/models/index.js';
import {default as IoMManager} from '@refinio/one.models/lib/models/IoM/IoMManager.js';
// import {default as GroupModel} from '@refinio/one.models/lib/models/Leute/GroupModel.js'; // Unused
import {default as Notifications} from '@refinio/one.models/lib/models/Notifications.js';
import {existsSync, readdirSync} from 'fs';
import {rimraf} from 'rimraf';
// Import Filer type only - actual import happens conditionally
import type {Filer} from './Filer';
import {fillMissingWithDefaults} from './misc/configHelper';
// import {DefaultConnectionsModelConfig} from './misc/ConnectionsModelConfig'; // Unused
import {
    initOneCoreInstance,
    oneCoreInstanceExists,
    oneCoreInstanceInformation,
    shutdownOneCoreInstance
} from './misc/OneCoreInit';
import AccessRightsManager from './AccessRightsManager';
import type {ReplicantConfig} from './ReplicantConfig';
import {DefaultReplicantConfig} from './ReplicantConfig';

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
    private readonly config: ReplicantConfig;

    private readonly filerAccessRightsManager: AccessRightsManager;
    private readonly consentFile: ConsentModel;
    private readonly channelManager: ChannelManager;
    private readonly leuteModel: LeuteModel;
    private readonly questionnaires: QuestionnaireModel;
    private readonly connections: ConnectionsModel;
    private readonly iomManager: IoMManager;
    private readonly documents: DocumentModel;
    private readonly topicModel: TopicModel;
    private readonly notifications: Notifications;
    private filer?: Filer;

    constructor(config: Partial<ReplicantConfig>) {
        if (process.platform !== 'win32' && isFunction(process.getuid) && process.getuid() === 0) {
            throw new Error('You cannot start this process as root.');
        }

        this.config = fillMissingWithDefaults(config, DefaultReplicantConfig);

        this.leuteModel = new LeuteModel(this.config.commServerUrl, this.config.createEveryoneGroup);
        this.iomManager = new IoMManager(this.leuteModel, this.config.commServerUrl);
        this.channelManager = new ChannelManager(this.leuteModel);
        this.connections = new ConnectionsModel(this.leuteModel, this.config.connectionsConfig);
        this.consentFile = new ConsentModel();
        this.filerAccessRightsManager = new AccessRightsManager(
            this.connections,
            this.channelManager,
            this.leuteModel
        );
        this.questionnaires = new QuestionnaireModel(this.channelManager);
        this.documents = new DocumentModel(this.channelManager);
        this.topicModel = new TopicModel(this.channelManager, this.leuteModel);
        this.notifications = new Notifications(this.channelManager);

        // Filer initialization moved to start() method to allow dynamic imports
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
    async start(secret: string): Promise<void> {
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
        } catch (error) {
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

        // Initialize filer if configured - using Linux/FUSE implementation
        if (this.config.useFiler) {
            console.log('[REPLICANT] useFiler is true, initializing FUSE-based filer...');
            const models = {
                channelManager: this.channelManager,
                connections: this.connections,
                leuteModel: this.leuteModel,
                notifications: this.notifications,
                topicModel: this.topicModel,
                iomManager: this.iomManager
            };
            
            // For Linux, always use FUSE-based Filer
            console.log('[REPLICANT] Using FUSE mode with @refinio/fuse3...');
            const { Filer } = await import('./Filer.js');
            console.log('[REPLICANT] Filer imported, creating instance...');
            this.filer = new Filer(models, this.config.filerConfig);
            console.log('[REPLICANT] Filer instance created');
            
            console.log('[REPLICANT] About to call filer.init()...');
            await this.filer.init();
            console.log('[REPLICANT] filer.init() completed successfully');
        } else {
            console.log('[REPLICANT] useFiler is false, skipping filer initialization');
        }

        await this.setPersonNameToInitialIdentityIfNone();
    }

    /**
     * Stop the replicant.
     */
    public async stop(): Promise<void> {
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
            } catch (e) {
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
    public static async createReplicantInstance(
        identity: IdentityWithSecrets,
        secret: string,
        directory: string = DefaultReplicantConfig.directory
    ): Promise<void> {
        await initOneCoreInstance(secret, directory, identity);
        shutdownOneCoreInstance();
    }

    /**
     * Returns whether an instance exists in the given directory.
     *
     * @param directory - The directory in which to store the data.
     */
    public static async instanceExists(
        directory: string = DefaultReplicantConfig.directory
    ): Promise<boolean> {
        return oneCoreInstanceExists(directory);
    }

    /**
     * Returns the information used to initialize the one.core instance (except the secret).
     *
     * @param directory - The directory in which to store the data.
     */
    public static async getInstanceInformation(
        directory: string = DefaultReplicantConfig.directory
    ): Promise<{personEmail: string; instanceName: string}> {
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
    public static async deleteInstance(
        directory: string = DefaultReplicantConfig.directory
    ): Promise<void> {
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
    private async setPersonNameToInitialIdentityIfNone(): Promise<void> {
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
                name: `Initial Replicant Identity ${(person as any).email?.slice(0, 8) || 'unknown'}`
            });
            await myMainProfile.saveAndLoad();
        }
    }
}