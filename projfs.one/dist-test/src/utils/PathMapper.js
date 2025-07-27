"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathMapper = void 0;
/**
 * Handles path mapping between Windows paths and IFileSystem virtual paths.
 *
 * Windows paths use backslashes and may have drive letters.
 * IFileSystem uses forward slashes and Unix-style paths.
 */
class PathMapper {
    virtualRoot;
    normalizedRoot;
    constructor(virtualRoot) {
        this.virtualRoot = virtualRoot;
        // Normalize the root path (ensure it ends with backslash)
        this.normalizedRoot = this.normalizeWindowsPath(virtualRoot);
    }
    /**
     * Convert a ProjFS relative path to an IFileSystem virtual path.
     *
     * @param relativePath Path relative to virtualization root (Windows style)
     * @returns Unix-style path for IFileSystem
     *
     * @example
     * // relativePath: "documents\report.pdf"
     * // returns: "/documents/report.pdf"
     */
    toVirtualPath(relativePath) {
        // Handle empty path (root)
        if (!relativePath || relativePath === '.' || relativePath === '\\') {
            return '/';
        }
        // Convert backslashes to forward slashes
        let virtualPath = relativePath.replace(/\\/g, '/');
        // Ensure path starts with /
        if (!virtualPath.startsWith('/')) {
            virtualPath = '/' + virtualPath;
        }
        // Remove trailing slash (except for root)
        if (virtualPath.length > 1 && virtualPath.endsWith('/')) {
            virtualPath = virtualPath.slice(0, -1);
        }
        return virtualPath;
    }
    /**
     * Convert an IFileSystem virtual path to a Windows path.
     *
     * @param virtualPath Unix-style path from IFileSystem
     * @returns Windows absolute path
     *
     * @example
     * // virtualPath: "/documents/report.pdf"
     * // returns: "C:\VirtualDrive\documents\report.pdf"
     */
    toWindowsPath(virtualPath) {
        // Remove leading slash
        let relativePath = virtualPath;
        if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
        }
        // Convert forward slashes to backslashes
        relativePath = relativePath.replace(/\//g, '\\');
        // Combine with virtual root
        if (relativePath) {
            return this.normalizedRoot + relativePath;
        }
        else {
            return this.normalizedRoot.slice(0, -1); // Remove trailing backslash for root
        }
    }
    /**
     * Get the relative path from a Windows absolute path.
     *
     * @param absolutePath Windows absolute path
     * @returns Relative path from virtualization root
     */
    toRelativePath(absolutePath) {
        const normalized = this.normalizeWindowsPath(absolutePath);
        if (!normalized.startsWith(this.normalizedRoot)) {
            throw new Error(`Path ${absolutePath} is not under virtual root ${this.virtualRoot}`);
        }
        // Remove the root portion
        let relative = normalized.substring(this.normalizedRoot.length);
        // Remove leading backslash if present
        if (relative.startsWith('\\')) {
            relative = relative.substring(1);
        }
        return relative || '.';
    }
    /**
     * Join virtual path components.
     *
     * @param parts Path components to join
     * @returns Joined virtual path
     */
    join(...parts) {
        // Filter out empty parts
        const filtered = parts.filter(p => p && p !== '.');
        if (filtered.length === 0) {
            return '/';
        }
        // Join with forward slashes
        let joined = filtered.join('/');
        // Normalize slashes
        joined = joined.replace(/\/+/g, '/');
        // Ensure starts with /
        if (!joined.startsWith('/')) {
            joined = '/' + joined;
        }
        // Remove trailing slash (except for root)
        if (joined.length > 1 && joined.endsWith('/')) {
            joined = joined.slice(0, -1);
        }
        return joined;
    }
    /**
     * Get the parent directory of a virtual path.
     *
     * @param virtualPath Virtual path
     * @returns Parent directory path, or null if at root
     */
    getParent(virtualPath) {
        if (virtualPath === '/' || !virtualPath) {
            return '/';
        }
        const lastSlash = virtualPath.lastIndexOf('/');
        if (lastSlash <= 0) {
            return '/';
        }
        return virtualPath.substring(0, lastSlash);
    }
    /**
     * Get the filename from a virtual path.
     *
     * @param virtualPath Virtual path
     * @returns Filename component
     */
    getFilename(virtualPath) {
        if (virtualPath === '/' || !virtualPath) {
            return '';
        }
        const lastSlash = virtualPath.lastIndexOf('/');
        return virtualPath.substring(lastSlash + 1);
    }
    /**
     * Check if a path is the root directory.
     */
    isRoot(virtualPath) {
        return virtualPath === '/' || virtualPath === '';
    }
    /**
     * Normalize a Windows path.
     * - Convert to uppercase for case-insensitive comparison
     * - Ensure trailing backslash for directories
     */
    normalizeWindowsPath(path) {
        let normalized = path.toUpperCase();
        // Ensure trailing backslash
        if (!normalized.endsWith('\\')) {
            normalized += '\\';
        }
        return normalized;
    }
    /**
     * Check if a filename matches a Windows wildcard pattern.
     * Used for directory enumeration filtering.
     *
     * @param filename Filename to test
     * @param pattern Windows wildcard pattern (e.g., "*.txt", "test?.doc")
     * @returns True if filename matches pattern
     */
    matchesPattern(filename, pattern) {
        if (!pattern || pattern === '*' || pattern === '*.*') {
            return true;
        }
        // Convert Windows wildcard to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.') // Escape dots
            .replace(/\*/g, '.*') // * matches any characters
            .replace(/\?/g, '.'); // ? matches single character
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(filename);
    }
}
exports.PathMapper = PathMapper;
