/**
 * @refinio/one.filer.fuse3 - Complete ONE.filer implementation for Linux
 * 
 * This package provides the full ONE.filer functionality including:
 * - Replicant orchestrator
 * - Filer filesystem mounting
 * - FUSE3 integration
 * - CLI commands matching original Linux one.filer
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

// Main exports - Replicant and Filer
export { default as Replicant } from './Replicant.js';
export { Filer, FilerModels, FilerConfig, DefaultFilerConfig } from './Filer.js';

// Configuration exports
export { ReplicantConfig, DefaultReplicantConfig, checkReplicantConfig } from './ReplicantConfig.js';
export { FilerConfig as FilerConfigType } from './FilerConfig.js';

// Access Rights Manager
export { default as AccessRightsManager } from './AccessRightsManager.js';

// FUSE Frontend - compatible with existing one.filer
export { FuseFrontend, type FuseFrontendOptions } from './FuseFrontend.js';

// Adapter for advanced usage
export { FuseApiToIFileSystemAdapter } from './FuseApiToIFileSystemAdapter.js';

// Helper utilities
export { 
    fillMissingWithDefaults,
    readJsonFileOrEmpty,
    writeJsonFile,
    assignConfigOption
} from './misc/configHelper.js';

export {
    initOneCoreInstance,
    shutdownOneCoreInstance,
    oneCoreInstanceExists,
    oneCoreInstanceInformation,
    type InstanceInformation
} from './misc/OneCoreInit.js';

export { DefaultConnectionsModelConfig } from './misc/ConnectionsModelConfig.js';

// Re-export useful types from dependencies
export type { 
    IFileSystem,
    FileDescription,
    FileSystemFile,
    FileSystemDirectory 
} from '@refinio/one.models/lib/fileSystems/IFileSystem.js';

export type {
    FuseOperations,
    Stats
} from '@refinio/fuse3';

// Re-export error codes from @refinio/fuse3
export {
    EPERM,
    ENOENT,
    EIO,
    EACCES,
    EEXIST,
    ENOTDIR,
    EISDIR,
    EINVAL,
    ENOSPC,
    EROFS,
    EBUSY,
    ENOTEMPTY
} from '@refinio/fuse3';

/**
 * Quick start function to create and start a Replicant with Filer
 * 
 * @param secret - Instance password
 * @param config - Optional configuration
 * @returns Replicant instance
 */
export async function quickStart(
    secret: string,
    config?: Partial<import('./ReplicantConfig.js').ReplicantConfig>
): Promise<Replicant> {
    const replicant = new Replicant(config || {});
    await replicant.start(secret);
    return replicant;
}

/**
 * Create a standalone Filer instance
 * Compatible with existing one.filer code
 * 
 * @param models - The ONE.models instances
 * @param config - Filer configuration
 * @returns Filer instance
 */
export function createFiler(models: FilerModels, config: Partial<FilerConfig>): Filer {
    return new Filer(models, config);
}