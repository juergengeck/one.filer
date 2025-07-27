/**
 * projfs.one - Windows ProjectedFS provider for ONE.core
 * 
 * This package enables Windows applications to access ONE.core's 
 * content-addressed storage through a virtual filesystem using 
 * Windows Projected File System (ProjFS).
 */

export { ProjFSProvider } from './provider/ProjFSProvider.js';
export { IFileSystemToProjFSAdapter } from './provider/IFileSystemToProjFSAdapter.js';
// OneFilerProvider requires one.filer to be in the same project

export * from './native/projfs-types.js';
export * from './utils/Logger.js';
export * from './utils/PathMapper.js';
export * from './utils/AttributeConverter.js';
export * from './utils/ProjFSAvailability.js';
export * from './cache/CacheManager.js';

// Re-export key types from ONE.models for convenience
export type { 
    IFileSystem, 
    FileSystemFile, 
    FileSystemDirectory, 
    FileDescription 
} from '@refinio/one.models/lib/fileSystems/IFileSystem.js';