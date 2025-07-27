/**
 * This file provides functions that help you to create or open a one.core instance.
 *
 * Those functions store some information you usually need to log in to an instance in
 * local storage (browser) / key value file (node). This way the user doesn't have to specify such
 * information. This is especially useful if such information is random. The user does not want
 * to input random data.
 *
 * At the moment the person email and instance names are random unless you explicitly specify it
 * in the identity file on instance creation.
 */
// Dynamic imports to avoid TypeScript declaration issues
// import {closeInstance, initInstance} from '@refinio/one.core/lib/instance.js';
import { SettingsStore } from '@refinio/one.core/lib/system/settings-store.js';
import { setBaseDirOrName } from '@refinio/one.core/lib/system/storage-base.js';
import { isString } from '../utils/typeChecks';
// Import recipes will be done dynamically to avoid TypeScript issues
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
export async function initOneCoreInstance(secret, directory, identity) {
    // Dynamic import to avoid TypeScript declaration issues
    const { initInstance } = await import('@refinio/one.core/lib/instance.js');
    setBaseDirOrName(directory);
    const storedInstanceName = await SettingsStore.getItem('instance');
    const storedEmail = await SettingsStore.getItem('email');
    let instanceOptions;
    if (identity) {
        if (isString(storedInstanceName) && isString(storedEmail)) {
            console.log('Error: An instance already exists. You cannot pass an identity file to initOneCoreInstance.');
            process.exit(1);
        }
        else {
            // instanceOptions = convertIdentityToInstanceOptions(identity, secret);
            throw new Error('Identity conversion not implemented yet');
        }
    }
    else if (isString(storedInstanceName) && isString(storedEmail)) {
        instanceOptions = {
            name: storedInstanceName,
            email: storedEmail,
            secret
        };
    }
    else {
        // Generate random instance name and email
        const randomString = Math.random().toString(36).substring(2, 15);
        instanceOptions = {
            name: `rnd-${randomString}`,
            email: `rnd.generated@${randomString}.com`,
            secret
        };
    }
    try {
        // Dynamic imports for recipes to avoid TypeScript issues
        const [coreModule, stableModule, experimentalModule] = await Promise.all([
            import('@refinio/one.core/lib/recipes.js'),
            import('@refinio/one.models/lib/recipes/recipes-stable.js'),
            import('@refinio/one.models/lib/recipes/recipes-experimental.js')
        ]);
        const CORE_RECIPES = coreModule.CORE_RECIPES || coreModule.default;
        const RecipesStable = stableModule.default;
        const RecipesExperimental = experimentalModule.default;
        await initInstance({
            ...instanceOptions,
            directory: directory,
            initialRecipes: [...CORE_RECIPES, ...RecipesStable, ...RecipesExperimental],
            initiallyEnabledReverseMapTypes: new Map(),
            initiallyEnabledReverseMapTypesForIdObjects: new Map()
        });
        if (!isString(storedInstanceName) || !isString(storedEmail)) {
            await SettingsStore.setItem('instance', instanceOptions.name);
            await SettingsStore.setItem('email', instanceOptions.email);
        }
    }
    catch (e) {
        // See https://github.com/refinio/one.core/blob/master/test/storage-base-test.ts#L977
        if (e.code === 'CYENC-SYMDEC') {
            console.log('Error: invalid password');
            process.exit(1);
        }
        else {
            throw new Error(e.message);
        }
    }
}
/**
 * Closes the one.core instance.
 */
export async function shutdownOneCoreInstance() {
    // Dynamic import to avoid TypeScript declaration issues
    const { closeInstance } = await import('@refinio/one.core/lib/instance.js');
    closeInstance();
}
/**
 * Checks if the one.core instance exists by checking the Settings Store (Local storage on
 * browser or key value file on node)
 * @param directory
 */
export async function oneCoreInstanceExists(directory) {
    setBaseDirOrName(directory);
    const storedInstanceName = await SettingsStore.getItem('instance');
    const storedEmail = await SettingsStore.getItem('email');
    return isString(storedInstanceName) && isString(storedEmail);
}
/**
 * Retrieves the person email and instance name from local storage / key value file.
 *
 * Throws if no instance exists.
 *
 * @param directory
 */
export async function oneCoreInstanceInformation(directory) {
    setBaseDirOrName(directory);
    const personEmail = await SettingsStore.getItem('instance');
    const instanceName = await SettingsStore.getItem('email');
    if (!isString(personEmail) || !isString(instanceName)) {
        throw new Error('No one.core instance exists.');
    }
    return {
        personEmail,
        instanceName
    };
}
//# sourceMappingURL=OneCoreInit.js.map