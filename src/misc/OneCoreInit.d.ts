import type { IdentityWithSecrets } from '@refinio/one.models/lib/misc/IdentityExchange.js';
/**
 * Initializes one.core.
 *
 * @param secret - The secret used to encrypt stuff - like private keys.
 * @param directory - The storage directory of one.core
 * @param identity - An identity file that is used to initialize a new one.core instance. If an
 * instance already exists and you specify an identity file the initialization will fail. If a
 * new one.core instance is created and you don't specify an identity, a completely random
 * identity is created.
 */
export declare function initOneCoreInstance(secret: string, directory: string, identity?: IdentityWithSecrets): Promise<void>;
/**
 * Closes the one.core instance.
 */
export declare function shutdownOneCoreInstance(): Promise<void>;
/**
 * Checks if the one.core instance exists by checking the Settings Store (Local storage on
 * browser or key value file on node)
 * @param directory
 */
export declare function oneCoreInstanceExists(directory: string): Promise<boolean>;
/**
 * Retrieves the person email and instance name from local storage / key value file.
 *
 * Throws if no instance exists.
 *
 * @param directory
 */
export declare function oneCoreInstanceInformation(directory: string): Promise<{
    personEmail: string;
    instanceName: string;
}>;
//# sourceMappingURL=OneCoreInit.d.ts.map