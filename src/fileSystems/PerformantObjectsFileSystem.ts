import type { IFileSystem } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';
import ObjectsFileSystem from '@refinio/one.models/lib/fileSystems/ObjectsFileSystem.js';

/**
 * Performance-optimized wrapper around ObjectsFileSystem that limits initial enumeration
 * to prevent hanging during ProjFS pre-caching, but allows full access on-demand
 */
export class PerformantObjectsFileSystem implements IFileSystem {
    private readonly objectsFileSystem: ObjectsFileSystem;
    private readonly initialLimit: number;
    private hasBeenFullyEnumerated: boolean = false;

    constructor(initialLimit: number = 50) {
        this.objectsFileSystem = new ObjectsFileSystem();
        this.initialLimit = initialLimit;
    }

    async readDir(path: string): Promise<{ children: string[] } | null> {
        // For root objects directory during initial enumeration, limit results
        if (path === '/' && !this.hasBeenFullyEnumerated) {
            console.log(`[PerformantObjectsFileSystem] Initial enumeration - limiting to ${this.initialLimit} objects`);
            
            const fullResult = await this.objectsFileSystem.readDir(path);
            if (!fullResult?.children) {
                return fullResult;
            }

            // Return limited set initially
            const limitedChildren = fullResult.children.slice(0, this.initialLimit);
            console.log(`[PerformantObjectsFileSystem] Limited objects: ${fullResult.children.length} -> ${limitedChildren.length}`);
            
            return {
                children: limitedChildren
            };
        }

        // For subsequent requests or specific object paths, return full results
        return await this.objectsFileSystem.readDir(path);
    }

    /**
     * Call this method to enable full enumeration (e.g., when user explicitly browses objects)
     */
    enableFullEnumeration(): void {
        console.log('[PerformantObjectsFileSystem] Full enumeration enabled');
        this.hasBeenFullyEnumerated = true;
    }

    // Delegate all other methods to the underlying ObjectsFileSystem
    async readFile(path: string): Promise<string | Uint8Array | null> {
        return await this.objectsFileSystem.readFile(path);
    }

    async writeFile(path: string, content: string | Uint8Array): Promise<void> {
        return await this.objectsFileSystem.writeFile(path, content);
    }

    async stat(path: string): Promise<{ 
        isDirectory?: boolean; 
        mode: number; 
        size: number; 
        mtime?: Date; 
    } | null> {
        return await this.objectsFileSystem.stat(path);
    }

    async mkdir(path: string): Promise<void> {
        return await this.objectsFileSystem.mkdir(path);
    }

    async rmdir(path: string): Promise<void> {
        return await this.objectsFileSystem.rmdir(path);
    }

    async unlink(path: string): Promise<void> {
        return await this.objectsFileSystem.unlink(path);
    }

    async mountFileSystem?(path: string, fileSystem: IFileSystem): Promise<void> {
        if (this.objectsFileSystem.mountFileSystem) {
            return await this.objectsFileSystem.mountFileSystem(path, fileSystem);
        }
        throw new Error('mountFileSystem not supported');
    }

    async unmountFileSystem?(path: string): Promise<void> {
        if (this.objectsFileSystem.unmountFileSystem) {
            return await this.objectsFileSystem.unmountFileSystem(path);
        }
        throw new Error('unmountFileSystem not supported');
    }
}