import { FileAttributes } from '../native/projfs-types.js';

/**
 * Converts between Unix-style file modes and Windows file attributes.
 * 
 * IFileSystem uses Unix-style modes (octal permissions + file type).
 * Windows uses file attribute flags.
 */
export class AttributeConverter {
    // Unix file type masks
    private static readonly S_IFMT = 0o170000;   // File type mask
    private static readonly S_IFREG = 0o100000;  // Regular file
    private static readonly S_IFDIR = 0o040000;  // Directory
    private static readonly S_IFLNK = 0o120000;  // Symbolic link
    
    // Unix permission masks
    private static readonly S_IRUSR = 0o400;     // User read
    private static readonly S_IWUSR = 0o200;     // User write
    private static readonly S_IXUSR = 0o100;     // User execute
    private static readonly S_IRGRP = 0o040;     // Group read
    private static readonly S_IWGRP = 0o020;     // Group write
    private static readonly S_IXGRP = 0o010;     // Group execute
    private static readonly S_IROTH = 0o004;     // Other read
    private static readonly S_IWOTH = 0o002;     // Other write
    private static readonly S_IXOTH = 0o001;     // Other execute
    
    /**
     * Convert Unix mode to Windows file attributes.
     * 
     * @param mode Unix-style file mode
     * @returns Windows file attributes
     */
    modeToWindowsAttributes(mode: number): number {
        let attributes = 0;
        
        // File type
        const fileType = mode & AttributeConverter.S_IFMT;
        
        if (fileType === AttributeConverter.S_IFDIR) {
            attributes |= FileAttributes.DIRECTORY;
        } else if (fileType === AttributeConverter.S_IFLNK) {
            attributes |= FileAttributes.REPARSE_POINT;
        }
        
        // Read-only (no write permission for user)
        if (!(mode & AttributeConverter.S_IWUSR)) {
            attributes |= FileAttributes.READONLY;
        }
        
        // Hidden files (Unix convention: files starting with .)
        // This would need the filename to determine, so handled elsewhere
        
        // System files (no direct Unix equivalent, could use extended attributes)
        
        // Archive (set for all regular files by default on Windows)
        if (fileType === AttributeConverter.S_IFREG) {
            attributes |= FileAttributes.ARCHIVE;
        }
        
        // Normal file (no special attributes)
        if (attributes === 0 || attributes === FileAttributes.ARCHIVE) {
            attributes |= FileAttributes.NORMAL;
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
    windowsAttributesToMode(attributes: number, isDirectory: boolean): number {
        let mode = 0;
        
        // File type
        if (isDirectory || (attributes & FileAttributes.DIRECTORY)) {
            mode |= AttributeConverter.S_IFDIR;
        } else if (attributes & FileAttributes.REPARSE_POINT) {
            mode |= AttributeConverter.S_IFLNK;
        } else {
            mode |= AttributeConverter.S_IFREG;
        }
        
        // Permissions
        if (attributes & FileAttributes.READONLY) {
            // Read-only: r--r--r-- (0444)
            mode |= AttributeConverter.S_IRUSR | AttributeConverter.S_IRGRP | AttributeConverter.S_IROTH;
        } else {
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
    isDirectory(mode: number): boolean {
        return (mode & AttributeConverter.S_IFMT) === AttributeConverter.S_IFDIR;
    }
    
    /**
     * Check if a Unix mode represents a regular file.
     */
    isRegularFile(mode: number): boolean {
        return (mode & AttributeConverter.S_IFMT) === AttributeConverter.S_IFREG;
    }
    
    /**
     * Check if a Unix mode represents a symbolic link.
     */
    isSymbolicLink(mode: number): boolean {
        return (mode & AttributeConverter.S_IFMT) === AttributeConverter.S_IFLNK;
    }
    
    /**
     * Get file type string from Unix mode.
     */
    getFileType(mode: number): 'file' | 'directory' | 'symlink' | 'unknown' {
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
    isHiddenFile(filename: string): boolean {
        return filename.startsWith('.') && filename !== '.' && filename !== '..';
    }
    
    /**
     * Apply hidden attribute if needed based on filename.
     */
    applyHiddenAttribute(attributes: number, filename: string): number {
        if (this.isHiddenFile(filename)) {
            return attributes | FileAttributes.HIDDEN;
        }
        return attributes;
    }
    
    /**
     * Format Unix permissions as string (e.g., "rwxr-xr-x").
     */
    formatPermissions(mode: number): string {
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
    getDefaultFileMode(): number {
        // -rw-rw-r-- (0664)
        return AttributeConverter.S_IFREG | 0o664;
    }
    
    /**
     * Get default mode for a new directory.
     */
    getDefaultDirectoryMode(): number {
        // drwxrwxr-x (0775)
        return AttributeConverter.S_IFDIR | 0o775;
    }
}