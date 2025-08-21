import { SYSTEM } from '@refinio/one.core/lib/system/platform.js';
import { statSync } from 'fs';
import path from 'path';
import { readFile } from 'fs/promises';
import { initInstance } from '@refinio/one.core/lib/instance.js';
import RecipesStable from '../lib/recipes/recipes-stable.js';
import RecipesExperimental from '../lib/recipes/recipes-experimental.js';
export const defaultDbName = 'testDb';
export async function initOneCorePlatform() {
    await import(`@refinio/one.core/lib/system/load-${SYSTEM}.js`);
}
export async function init({ email = 'test@test.com', secret = 'SECRET PASSWORD', personEncryptionKeyPair, personSignKeyPair, instanceEncryptionKeyPair, instanceSignKeyPair, name = 'test', dbKey = defaultDbName, deleteDb = true, encryptStorage = false, initiallyEnabledReverseMapTypes = [], initiallyEnabledReverseMapTypesForIdObjects = [] } = {}) {
    await initOneCorePlatform();
    return await initInstance({
        name,
        email,
        secret,
        personEncryptionKeyPair,
        personSignKeyPair,
        instanceEncryptionKeyPair,
        instanceSignKeyPair,
        wipeStorage: deleteDb,
        encryptStorage,
        directory: 'test/' + dbKey,
        initialRecipes: [...RecipesStable, ...RecipesExperimental],
        initiallyEnabledReverseMapTypes: new Map(initiallyEnabledReverseMapTypes),
        initiallyEnabledReverseMapTypesForIdObjects: new Map(initiallyEnabledReverseMapTypesForIdObjects)
    });
}
export function buildTestFile() {
    const filePath = './test/consent.pdf';
    const stats = statSync(filePath);
    return {
        lastModified: stats.ctimeMs,
        name: path.basename(filePath),
        size: stats.size,
        type: 'application/pdf',
        arrayBuffer: () => readFile(filePath)
    };
}
//# sourceMappingURL=_helpers.js.map