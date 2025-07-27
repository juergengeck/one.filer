"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IFileSystemToProjFSAdapter = void 0;
const Logger_js_1 = require("../utils/Logger.js");
const PathMapper_js_1 = require("../utils/PathMapper.js");
const AttributeConverter_js_1 = require("../utils/AttributeConverter.js");
const CacheManager_js_1 = require("../cache/CacheManager.js");
/**
 * Adapter that bridges IFileSystem implementations with Windows ProjectedFS.
 *
 * This class translates between the ONE.models IFileSystem interface and
 * the Windows ProjectedFS callback system, enabling any IFileSystem
 * implementation to be exposed as a virtual filesystem on Windows.
 */
class IFileSystemToProjFSAdapter {
    fileSystem;
    logger;
    pathMapper;
    attributeConverter;
    cache;
    constructor(fileSystem, virtualRoot, options) {
        this.fileSystem = fileSystem;
        this.logger = new Logger_js_1.Logger('IFileSystemToProjFSAdapter', options?.logLevel);
        this.pathMapper = new PathMapper_js_1.PathMapper(virtualRoot);
        this.attributeConverter = new AttributeConverter_js_1.AttributeConverter();
        this.cache = new CacheManager_js_1.CacheManager(options?.cacheSize || 100 * 1024 * 1024); // 100MB default
        this.logger.info(`Initialized adapter for virtual root: ${virtualRoot}`);
    }
    /**
     * Called by ProjFS to get metadata about a file or directory.
     * Maps to IFileSystem.stat()
     */
    async onGetPlaceholderInfo(relativePath) {
        this.logger.debug(`onGetPlaceholderInfo: ${relativePath}`);
        try {
            const virtualPath = this.pathMapper.toVirtualPath(relativePath);
            // Check cache first
            const cached = await this.cache.getFileInfo(virtualPath);
            if (cached) {
                return cached;
            }
            // Get metadata from IFileSystem
            const stat = await this.fileSystem.stat(virtualPath);
            // Convert to ProjFS format
            const info = {
                fileSize: BigInt(stat.size),
                isDirectory: this.attributeConverter.isDirectory(stat.mode),
                creationTime: new Date(), // IFileSystem doesn't track times
                lastWriteTime: new Date(), // Use current time as fallback
                lastAccessTime: new Date(),
                changeTime: new Date(),
                fileAttributes: this.attributeConverter.modeToWindowsAttributes(stat.mode)
            };
            // Cache the result
            await this.cache.putFileInfo(virtualPath, info);
            return info;
        }
        catch (error) {
            this.logger.error(`Failed to get placeholder info for ${relativePath}:`, error);
            throw this.convertError(error);
        }
    }
    /**
     * Called by ProjFS to read file data.
     * Maps to IFileSystem.readFile() or readFileInChunks()
     */
    async onGetFileData(relativePath, byteOffset, length) {
        this.logger.debug(`onGetFileData: ${relativePath} offset=${byteOffset} length=${length}`);
        try {
            const virtualPath = this.pathMapper.toVirtualPath(relativePath);
            // Check content cache
            const cachedContent = await this.cache.getFileContent(virtualPath, Number(byteOffset), length);
            if (cachedContent) {
                return cachedContent;
            }
            // Read from IFileSystem
            let content;
            if (this.fileSystem.supportsChunkedReading(virtualPath)) {
                // Use chunked reading for efficiency
                const result = await this.fileSystem.readFileInChunks(virtualPath, length, Number(byteOffset));
                content = Buffer.from(result.content);
            }
            else {
                // Fall back to reading entire file
                const file = await this.fileSystem.readFile(virtualPath);
                const fullContent = Buffer.from(file.content);
                // Extract requested range
                const start = Number(byteOffset);
                const end = Math.min(start + length, fullContent.length);
                content = fullContent.slice(start, end);
            }
            // Cache the content
            await this.cache.putFileContent(virtualPath, Number(byteOffset), content);
            return content;
        }
        catch (error) {
            this.logger.error(`Failed to read file data for ${relativePath}:`, error);
            throw this.convertError(error);
        }
    }
    /**
     * Called by ProjFS to enumerate directory contents.
     * Maps to IFileSystem.readDir()
     */
    async onGetDirectoryEnumeration(relativePath, searchPattern) {
        this.logger.debug(`onGetDirectoryEnumeration: ${relativePath} pattern=${searchPattern}`);
        try {
            const virtualPath = this.pathMapper.toVirtualPath(relativePath);
            // Check cache
            const cached = await this.cache.getDirectoryListing(virtualPath);
            if (cached) {
                return this.filterByPattern(cached, searchPattern);
            }
            // Read directory from IFileSystem
            const dir = await this.fileSystem.readDir(virtualPath);
            // Get metadata for each child
            const entries = [];
            for (const childName of dir.children) {
                try {
                    const childPath = this.pathMapper.join(virtualPath, childName);
                    const childStat = await this.fileSystem.stat(childPath);
                    entries.push({
                        fileName: childName,
                        isDirectory: this.attributeConverter.isDirectory(childStat.mode),
                        fileSize: BigInt(childStat.size),
                        creationTime: new Date(),
                        lastWriteTime: new Date(),
                        lastAccessTime: new Date(),
                        changeTime: new Date(),
                        fileAttributes: this.attributeConverter.modeToWindowsAttributes(childStat.mode)
                    });
                }
                catch (error) {
                    // Skip entries we can't stat
                    this.logger.warn(`Failed to stat child ${childName}:`, error);
                }
            }
            // Cache the full listing
            await this.cache.putDirectoryListing(virtualPath, entries);
            // Apply search pattern if provided
            return this.filterByPattern(entries, searchPattern);
        }
        catch (error) {
            this.logger.error(`Failed to enumerate directory ${relativePath}:`, error);
            throw this.convertError(error);
        }
    }
    /**
     * Called when a file handle is closed after modifications.
     * This is where we handle file writes by creating new content in ONE.core.
     */
    async onNotifyFileHandleClosedFileModified(relativePath, isDirectory, isFileDeleted, _notification) {
        this.logger.info(`onNotifyFileHandleClosedFileModified: ${relativePath} deleted=${isFileDeleted}`);
        if (isDirectory) {
            // Directory modifications are handled differently
            // For now, just invalidate cache
            const virtualPath = this.pathMapper.toVirtualPath(relativePath);
            await this.cache.invalidatePath(virtualPath);
            return;
        }
        try {
            const virtualPath = this.pathMapper.toVirtualPath(relativePath);
            if (isFileDeleted) {
                // Handle file deletion
                await this.handleFileDeletion(virtualPath);
            }
            else {
                // Handle file modification
                await this.handleFileModification(relativePath, virtualPath);
            }
            // Invalidate caches
            await this.cache.invalidatePath(virtualPath);
            // Also invalidate parent directory
            const parentPath = this.pathMapper.getParent(virtualPath);
            await this.cache.invalidatePath(parentPath);
        }
        catch (error) {
            this.logger.error(`Failed to handle file modification for ${relativePath}:`, error);
            throw this.convertError(error);
        }
    }
    /**
     * Called when a file is renamed or moved.
     */
    async onNotifyFileRenamed(relativePath, destinationPath, _isDirectory, _notification) {
        this.logger.info(`onNotifyFileRenamed: ${relativePath} -> ${destinationPath}`);
        try {
            const srcVirtualPath = this.pathMapper.toVirtualPath(relativePath);
            const destVirtualPath = this.pathMapper.toVirtualPath(destinationPath);
            // Perform the rename operation
            const result = await this.fileSystem.rename(srcVirtualPath, destVirtualPath);
            if (result !== 0) {
                throw new Error(`Failed to rename: ${srcVirtualPath} -> ${destVirtualPath}`);
            }
            // Invalidate caches for both paths
            await this.cache.invalidatePath(srcVirtualPath);
            await this.cache.invalidatePath(destVirtualPath);
            // Invalidate parent directories
            const srcParent = this.pathMapper.getParent(srcVirtualPath);
            const destParent = this.pathMapper.getParent(destVirtualPath);
            await this.cache.invalidatePath(srcParent);
            if (srcParent !== destParent) {
                await this.cache.invalidatePath(destParent);
            }
        }
        catch (error) {
            this.logger.error(`Failed to handle rename ${relativePath} -> ${destinationPath}:`, error);
            throw this.convertError(error);
        }
    }
    /**
     * Called when a new file is created.
     */
    async onNotifyNewFileCreated(relativePath, isDirectory, _notification) {
        this.logger.info(`onNotifyNewFileCreated: ${relativePath} isDirectory=${isDirectory}`);
        try {
            const virtualPath = this.pathMapper.toVirtualPath(relativePath);
            const parentPath = this.pathMapper.getParent(virtualPath);
            if (isDirectory) {
                // Create new directory
                await this.fileSystem.createDir(virtualPath, 0o755);
            }
            else {
                // For files, we need to wait for content to be written
                // This will be handled in onNotifyFileHandleClosedFileModified
                this.logger.debug(`New file created, waiting for content: ${virtualPath}`);
            }
            // Invalidate parent directory cache
            await this.cache.invalidatePath(parentPath);
        }
        catch (error) {
            this.logger.error(`Failed to handle new file creation ${relativePath}:`, error);
            throw this.convertError(error);
        }
    }
    /**
     * Called before a file or directory is deleted.
     */
    async onNotifyPreDelete(relativePath, isDirectory, _notification) {
        this.logger.info(`onNotifyPreDelete: ${relativePath} isDirectory=${isDirectory}`);
        try {
            const virtualPath = this.pathMapper.toVirtualPath(relativePath);
            if (isDirectory) {
                // Remove directory
                const result = await this.fileSystem.rmdir(virtualPath);
                if (result !== 0) {
                    throw new Error(`Failed to delete directory: ${virtualPath}`);
                }
            }
            else {
                // Remove file
                const result = await this.fileSystem.unlink(virtualPath);
                if (result !== 0) {
                    throw new Error(`Failed to delete file: ${virtualPath}`);
                }
            }
            // Invalidate caches
            await this.cache.invalidatePath(virtualPath);
            const parentPath = this.pathMapper.getParent(virtualPath);
            await this.cache.invalidatePath(parentPath);
        }
        catch (error) {
            this.logger.error(`Failed to handle pre-delete for ${relativePath}:`, error);
            throw this.convertError(error);
        }
    }
    /**
     * Handle file deletion
     */
    async handleFileDeletion(virtualPath) {
        // Call unlink on the IFileSystem
        const result = await this.fileSystem.unlink(virtualPath);
        if (result !== 0) {
            throw new Error(`Failed to delete file: ${virtualPath}`);
        }
    }
    /**
     * Handle file modification by reading content from ProjFS scratch
     * and storing it as a new BLOB in ONE.core
     */
    async handleFileModification(_relativePath, virtualPath) {
        this.logger.info(`Handling file modification for ${virtualPath}`);
        // Note: In a full implementation, we would:
        // 1. Read the modified content from the ProjFS scratch/working files
        //    This requires native integration to read from Windows filesystem
        // 2. Calculate the content hash (SHA256) for ONE.core
        // 3. Store the content as a new BLOB in ONE.core storage
        // 4. Update the file's metadata in the IFileSystem
        // For now, we just invalidate the cache and log the modification
        // The actual content update would happen through the IFileSystem's
        // createFile or a similar method when ONE.core integration is complete
        this.logger.info(`File modified: ${virtualPath} - cache invalidated`);
        // In production, this would integrate with ONE.core's BLOB storage:
        // const content = await this.readModifiedContent(relativePath);
        // const hash = await this.storeAsBlob(content);
        // await this.updateFileInCRDT(virtualPath, hash);
    }
    /**
     * Filter directory entries by search pattern
     */
    filterByPattern(entries, pattern) {
        if (!pattern || pattern === '*') {
            return entries;
        }
        // Convert Windows wildcard pattern to regex
        const regex = new RegExp('^' + pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') + '$', 'i');
        return entries.filter(entry => regex.test(entry.fileName));
    }
    /**
     * Convert IFileSystem errors to Windows error codes
     */
    convertError(error) {
        // Map ONE.core/IFileSystem errors to Windows errors
        if (error.code === 'FSE-ENOENT') {
            return new Error('ERROR_FILE_NOT_FOUND');
        }
        if (error.code === 'FSE-EACCES') {
            return new Error('ERROR_ACCESS_DENIED');
        }
        if (error.code === 'FSE-EEXIST') {
            return new Error('ERROR_FILE_EXISTS');
        }
        // Default error
        return error;
    }
    /**
     * Cleanup resources
     */
    async shutdown() {
        this.logger.info('Shutting down IFileSystemToProjFSAdapter');
        await this.cache.clear();
    }
}
exports.IFileSystemToProjFSAdapter = IFileSystemToProjFSAdapter;
