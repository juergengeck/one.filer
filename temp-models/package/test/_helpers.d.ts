import type { Instance, OneObjectTypeNames, OneVersionedObjectTypeNames, Recipe } from '@refinio/one.core/lib/recipes.js';
import type { KeyPair } from '@refinio/one.core/lib/crypto/encryption.js';
import type { SignKeyPair } from '@refinio/one.core/lib/crypto/sign.js';
export declare const defaultDbName = "testDb";
export interface StorageHelpersInitOpts {
    email?: string;
    secret?: string;
    personEncryptionKeyPair?: KeyPair;
    personSignKeyPair?: SignKeyPair;
    instanceEncryptionKeyPair?: KeyPair;
    instanceSignKeyPair?: SignKeyPair;
    name?: string;
    dbKey?: string;
    addTypes?: boolean;
    deleteDb?: boolean;
    encryptStorage?: boolean;
    initialRecipes?: readonly Recipe[];
    initiallyEnabledReverseMapTypes?: Array<[OneObjectTypeNames, Set<string>]>;
    initiallyEnabledReverseMapTypesForIdObjects?: Array<[OneVersionedObjectTypeNames, Set<string>]>;
}
export declare function initOneCorePlatform(): Promise<void>;
export declare function init({ email, secret, personEncryptionKeyPair, personSignKeyPair, instanceEncryptionKeyPair, instanceSignKeyPair, name, dbKey, deleteDb, encryptStorage, initiallyEnabledReverseMapTypes, initiallyEnabledReverseMapTypesForIdObjects }?: StorageHelpersInitOpts): Promise<Instance>;
export declare function buildTestFile(): File;
//# sourceMappingURL=_helpers.d.ts.map