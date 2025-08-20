/**
 * ONE Core Initialization Utilities
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import {SettingsStore} from '@refinio/one.core/lib/system/settings-store.js';
import {setBaseDirOrName} from '@refinio/one.core/lib/system/storage-base.js';
import type {IdentityWithSecrets} from '@refinio/one.models/lib/misc/IdentityExchange.js';
import {generateNewIdentity} from '@refinio/one.models/lib/misc/IdentityExchange.js';
import fs from 'fs';
import path from 'path';

export interface InstanceInformation {
    directory: string;
    secret: string;
    identity?: IdentityWithSecrets;
}

/**
 * Initialize ONE Core instance
 * 
 * @param info - Instance information
 */
export async function initOneCoreInstance(info: InstanceInformation): Promise<void> {
    // Set the base directory
    setBaseDirOrName(info.directory);
    
    // Initialize settings store
    const settingsStore = new SettingsStore();
    await settingsStore.init();
    
    // Store the secret
    await settingsStore.set('secret', info.secret);
    
    // Generate or use existing identity
    if (!info.identity) {
        info.identity = await generateNewIdentity();
    }
    
    // Store identity
    await settingsStore.set('identity', info.identity);
}

/**
 * Shutdown ONE Core instance
 */
export async function shutdownOneCoreInstance(): Promise<void> {
    // Cleanup tasks
    const settingsStore = new SettingsStore();
    await settingsStore.shutdown();
}

/**
 * Check if ONE Core instance exists
 * 
 * @param directory - Directory to check
 * @returns true if instance exists
 */
export function oneCoreInstanceExists(directory: string): boolean {
    const dataPath = path.join(directory, 'data');
    return fs.existsSync(dataPath);
}

/**
 * Get ONE Core instance information
 * 
 * @param directory - Instance directory
 * @param secret - Instance secret
 * @returns Instance information or undefined
 */
export async function oneCoreInstanceInformation(
    directory: string,
    secret: string
): Promise<InstanceInformation | undefined> {
    if (!oneCoreInstanceExists(directory)) {
        return undefined;
    }
    
    try {
        setBaseDirOrName(directory);
        const settingsStore = new SettingsStore();
        await settingsStore.init();
        
        const storedSecret = await settingsStore.get('secret');
        if (storedSecret !== secret) {
            throw new Error('Invalid secret');
        }
        
        const identity = await settingsStore.get('identity') as IdentityWithSecrets;
        
        return {
            directory,
            secret,
            identity
        };
    } catch (err) {
        console.error('Error loading instance information:', err);
        return undefined;
    }
}