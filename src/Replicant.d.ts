import type { IdentityWithSecrets } from '@refinio/one.models/lib/misc/IdentityExchange.js';
import type { ReplicantConfig } from './ReplicantConfig';
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
    private readonly config;
    private readonly filerAccessRightsManager;
    private readonly consentFile;
    private readonly channelManager;
    private readonly leuteModel;
    private readonly questionnaires;
    private readonly connections;
    private readonly iomManager;
    private readonly documents;
    private readonly topicModel;
    private readonly notifications;
    private readonly filer?;
    constructor(config: Partial<ReplicantConfig>);
    /**
     * Start the replicant.
     *
     * This will create a new or open an existing one instance and initialize all models.
     *
     * @param secret - The secret is used to unlock the one instance. It is only used to
     * derive the master keys used for decrypting data. (at the moment only private keys are
     * encrypted)
     */
    start(secret: string): Promise<void>;
    /**
     * Stop the replicant.
     */
    stop(): Promise<void>;
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
    static createReplicantInstance(identity: IdentityWithSecrets, secret: string, directory?: string): Promise<void>;
    /**
     * Returns whether an instance exists in the given directory.
     *
     * @param directory - The directory in which to store the data.
     */
    static instanceExists(directory?: string): Promise<boolean>;
    /**
     * Returns the information used to initialize the one.core instance (except the secret).
     *
     * @param directory - The directory in which to store the data.
     */
    static getInstanceInformation(directory?: string): Promise<{
        personEmail: string;
        instanceName: string;
    }>;
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
    static deleteInstance(directory?: string): Promise<void>;
    /**
     * Adds a name to our own main profile.
     */
    private setPersonNameToInitialIdentityIfNone;
}
//# sourceMappingURL=Replicant.d.ts.map