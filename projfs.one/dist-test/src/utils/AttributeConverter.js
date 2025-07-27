"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributeConverter = void 0;
const projfs_types_js_1 = require("../native/projfs-types.js");
/**
 * Converts between Unix-style file modes and Windows file attributes.
 *
 * IFileSystem uses Unix-style modes (octal permissions + file type).
 * Windows uses file attribute flags.
 */
class AttributeConverter {
    // Unix file type masks
    static S_IFMT = 0o170000; // File type mask
    static S_IFREG = 0o100000; // Regular file
    static S_IFDIR = 0o040000; // Directory
    static S_IFLNK = 0o120000; // Symbolic link
    // Unix permission masks
    static S_IRUSR = 0o400; // User read
    static S_IWUSR = 0o200; // User write
    static S_IXUSR = 0o100; // User execute
    static S_IRGRP = 0o040; // Group read
    static S_IWGRP = 0o020; // Group write
    static S_IXGRP = 0o010; // Group execute
    static S_IROTH = 0o004; // Other read
    static S_IWOTH = 0o002; // Other write
    static S_IXOTH = 0o001; // Other execute
    /**
     * Convert Unix mode to Windows file attributes.
     *
     * @param mode Unix-style file mode
     * @returns Windows file attributes
     */
    modeToWindowsAttributes(mode) {
        let attributes = 0;
        // File type
        const fileType = mode & AttributeConverter.S_IFMT;
        if (fileType === AttributeConverter.S_IFDIR) {
            attributes |= projfs_types_js_1.FileAttributes.DIRECTORY;
        }
        else if (fileType === AttributeConverter.S_IFLNK) {
            attributes |= projfs_types_js_1.FileAttributes.REPARSE_POINT;
        }
        // Read-only (no write permission for user)
        if (!(mode & AttributeConverter.S_IWUSR)) {
            attributes |= projfs_types_js_1.FileAttributes.READONLY;
        }
        // Hidden files (Unix convention: files starting with .)
        // This would need the filename to determine, so handled elsewhere
        // System files (no direct Unix equivalent, could use extended attributes)
        // Archive (set for all regular files by default on Windows)
        if (fileType === AttributeConverter.S_IFREG) {
            attributes |= projfs_types_js_1.FileAttributes.ARCHIVE;
        }
        // Normal file (no special attributes)
        if (attributes === 0 || attributes === projfs_types_js_1.FileAttributes.ARCHIVE) {
            attributes |= projfs_types_js_1.FileAttributes.NORMAL;
        }
        return attributes;
    }
    /**
     * Convert Windows file attributes to Unix mode.
     *
     * @param attributes Windows file attributes
     * @param isDirectory Whether this is a directory
     * @returns Unix-style file mode
     */
    windowsAttributesToMode(attributes, isDirectory) {
        let mode = 0;
        // File type
        if (isDirectory || (attributes & projfs_types_js_1.FileAttributes.DIRECTORY)) {
            mode |= AttributeConverter.S_IFDIR;
        }
        else if (attributes & projfs_types_js_1.FileAttributes.REPARSE_POINT) {
            mode |= AttributeConverter.S_IFLNK;
        }
        else {
            mode |= AttributeConverter.S_IFREG;
        }
        // Permissions
        if (attributes & projfs_types_js_1.FileAttributes.READONLY) {
            // Read-only: r--r--r-- (0444)
            mode |= AttributeConverter.S_IRUSR | AttributeConverter.S_IRGRP | AttributeConverter.S_IROTH;
        }
        else {
            // Read-write: rw-rw-r-- (0664)
            mode |= AttributeConverter.S_IRUSR | AttributeConverter.S_IWUSR |
                AttributeConverter.S_IRGRP | AttributeConverter.S_IWGRP |
                AttributeConverter.S_IROTH;
        }
        // Add execute permission for directories
        if (isDirectory) {
            mode |= AttributeConverter.S_IXUSR | AttributeConverter.S_IXGRP | AttributeConverter.S_IXOTH;
        }
        return mode;
    }
    /**
     * Check if a Unix mode represents a directory.
     */
    isDirectory(mode) {
        return (mode & AttributeConverter.S_IFMT) === AttributeConverter.S_IFDIR;
    }
    /**
     * Check if a Unix mode represents a regular file.
     */
    isRegularFile(mode) {
        return (mode & AttributeConverter.S_IFMT) === AttributeConverter.S_IFREG;
    }
    /**
     * Check if a Unix mode represents a symbolic link.
     */
    isSymbolicLink(mode) {
        return (mode & AttributeConverter.S_IFMT) === AttributeConverter.S_IFLNK;
    }
    /**
     * Get file type string from Unix mode.
     */
    getFileType(mode) {
        const fileType = mode & AttributeConverter.S_IFMT;
        switch (fileType) {
            case AttributeConverter.S_IFREG:
                return 'file';
            case AttributeConverter.S_IFDIR:
                return 'directory';
            case AttributeConverter.S_IFLNK:
                return 'symlink';
            default:
                return 'unknown';
        }
    }
    /**
     * Check if a filename should be hidden on Windows.
     * Files starting with '.' are hidden by convention.
     */
    isHiddenFile(filename) {
        return filename.startsWith('.') && filename !== '.' && filename !== '..';
    }
    /**
     * Apply hidden attribute if needed based on filename.
     */
    applyHiddenAttribute(attributes, filename) {
        if (this.isHiddenFile(filename)) {
            return attributes | projfs_types_js_1.FileAttributes.HIDDEN;
        }
        return attributes;
    }
    /**
     * Format Unix permissions as string (e.g., "rwxr-xr-x").
     */
    formatPermissions(mode) {
        const perms = [];
        // User permissions
        perms.push(mode & AttributeConverter.S_IRUSR ? 'r' : '-');
        perms.push(mode & AttributeConverter.S_IWUSR ? 'w' : '-');
        perms.push(mode & AttributeConverter.S_IXUSR ? 'x' : '-');
        // Group permissions
        perms.push(mode & AttributeConverter.S_IRGRP ? 'r' : '-');
        perms.push(mode & AttributeConverter.S_IWGRP ? 'w' : '-');
        perms.push(mode & AttributeConverter.S_IXGRP ? 'x' : '-');
        // Other permissions
        perms.push(mode & AttributeConverter.S_IROTH ? 'r' : '-');
        perms.push(mode & AttributeConverter.S_IWOTH ? 'w' : '-');
        perms.push(mode & AttributeConverter.S_IXOTH ? 'x' : '-');
        return perms.join('');
    }
    /**
     * Get default mode for a new file.
     */
    getDefaultFileMode() {
        // -rw-rw-r-- (0664)
        return AttributeConverter.S_IFREG | 0o664;
    }
    /**
     * Get default mode for a new directory.
     */
    getDefaultDirectoryMode() {
        // drwxrwxr-x (0775)
        return AttributeConverter.S_IFDIR | 0o775;
    }
}
exports.AttributeConverter = AttributeConverter;
