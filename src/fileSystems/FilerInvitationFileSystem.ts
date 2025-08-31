import PairingFileSystem from '@refinio/one.models/lib/fileSystems/PairingFileSystem.js';
import type { FileSystemFile } from '@refinio/one.models/lib/fileSystems/IFileSystem.js';

// Extended file interface for our use case
interface ExtendedFileSystemFile extends FileSystemFile {
    size?: number;
}

/**
 * Extended PairingFileSystem that refreshes invitations periodically
 * to ensure they are always fresh when accessed
 */
export default class FilerInvitationFileSystem extends PairingFileSystem {
    private lastRefreshTime: number = 0;
    private readonly REFRESH_INTERVAL = 5000; // Refresh invitations every 5 seconds

    constructor(
        connectionsModel: any,
        iomManager: any,
        pairingUrl: string,
        iomMode: 'full' | 'light' = 'full'
    ) {
        super(connectionsModel, iomManager, pairingUrl, iomMode);
    }

    /**
     * Check if invitations need refreshing and refresh them if needed
     */
    private async checkAndRefreshInvitations(): Promise<void> {
        const now = Date.now();
        if (now - this.lastRefreshTime > this.REFRESH_INTERVAL) {
            try {
                // Refresh both IoM and IoP invitations
                // These methods are defined in the parent PairingFileSystem
                await (this as any).refreshIomInvite();
                await (this as any).refreshIopInvite();
                this.lastRefreshTime = now;
                console.log('[FilerInvitationFileSystem] Refreshed invitations');
            } catch (error) {
                console.error('[FilerInvitationFileSystem] Error refreshing invitations:', error);
            }
        }
    }

    async readFile(filePath: string): Promise<ExtendedFileSystemFile> {
        // Check if we need to refresh invitations when accessing invitation files
        if (filePath.includes('invite')) {
            await this.checkAndRefreshInvitations();
        }
        
        // Use parent implementation for all files
        const file = await super.readFile(filePath);
        
        // Calculate file size from content and add it to our extended interface
        if (file && file.content) {
            const size = file.content.byteLength || (file.content as any).length || 0;
            return {
                ...file,
                size
            } as ExtendedFileSystemFile;
        }
        
        return file as ExtendedFileSystemFile;
    }
}