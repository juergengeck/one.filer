import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveManager } from '../../src/main/services/DriveManager';
import { ProjFSProvider } from 'projfs.one';

// Mock ProjFS provider
vi.mock('projfs.one', () => ({
    ProjFSProvider: vi.fn().mockImplementation(() => ({
        start: vi.fn().mockResolvedValue(true),
        stop: vi.fn().mockResolvedValue(true),
        isRunning: vi.fn().mockReturnValue(false),
        getStats: vi.fn().mockReturnValue({
            placeholderInfoRequests: 0,
            fileDataRequests: 0,
            directoryEnumerations: 0,
            fileModifications: 0,
            uptime: 0
        })
    }))
}));

describe('DriveManager', () => {
    let driveManager: DriveManager;

    beforeEach(() => {
        driveManager = new DriveManager();
        vi.clearAllMocks();
    });

    describe('createDrive', () => {
        it('should create a new drive with unique ID', async () => {
            const config = { name: 'Test Drive', path: 'C:\\TestDrive' };
            const drive = await driveManager.createDrive(config);

            expect(drive).toMatchObject({
                id: expect.stringMatching(/^drive_\d+$/),
                name: 'Test Drive',
                path: 'C:\\TestDrive',
                isRunning: false
            });
        });

        it('should add drive to internal collection', async () => {
            const config = { name: 'Test Drive', path: 'C:\\TestDrive' };
            const drive = await driveManager.createDrive(config);

            const drives = await driveManager.listDrives();
            expect(drives).toHaveLength(1);
            expect(drives[0]).toEqual(drive);
        });

        it('should validate drive name', async () => {
            const config = { name: '', path: 'C:\\TestDrive' };
            
            await expect(driveManager.createDrive(config))
                .rejects.toThrow('Drive name is required');
        });

        it('should validate drive path', async () => {
            const config = { name: 'Test Drive', path: '' };
            
            await expect(driveManager.createDrive(config))
                .rejects.toThrow('Drive path is required');
        });
    });

    describe('startDrive', () => {
        it('should start a stopped drive', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            const result = await driveManager.startDrive(drive.id);
            expect(result).toBe(true);

            const updatedDrive = await driveManager.getDrive(drive.id);
            expect(updatedDrive?.isRunning).toBe(true);
        });

        it('should not start an already running drive', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            await driveManager.startDrive(drive.id);
            const result = await driveManager.startDrive(drive.id);
            
            expect(result).toBe(false);
        });

        it('should handle non-existent drive', async () => {
            const result = await driveManager.startDrive('non-existent');
            expect(result).toBe(false);
        });

        it('should create ProjFS provider on start', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            await driveManager.startDrive(drive.id);
            
            expect(ProjFSProvider).toHaveBeenCalledWith(
                expect.any(Object), // IFileSystem
                expect.objectContaining({
                    logLevel: 'info',
                    cacheSize: 100 * 1024 * 1024
                })
            );
        });
    });

    describe('stopDrive', () => {
        it('should stop a running drive', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            await driveManager.startDrive(drive.id);
            const result = await driveManager.stopDrive(drive.id);
            
            expect(result).toBe(true);
            
            const updatedDrive = await driveManager.getDrive(drive.id);
            expect(updatedDrive?.isRunning).toBe(false);
        });

        it('should handle stopping non-running drive', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            const result = await driveManager.stopDrive(drive.id);
            expect(result).toBe(false);
        });
    });

    describe('deleteDrive', () => {
        it('should delete a stopped drive', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            const result = await driveManager.deleteDrive(drive.id);
            expect(result).toBe(true);

            const drives = await driveManager.listDrives();
            expect(drives).toHaveLength(0);
        });

        it('should stop and delete a running drive', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            await driveManager.startDrive(drive.id);
            const result = await driveManager.deleteDrive(drive.id);
            
            expect(result).toBe(true);
            
            const drives = await driveManager.listDrives();
            expect(drives).toHaveLength(0);
        });
    });

    describe('getDriveStats', () => {
        it('should return stats for running drive', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            await driveManager.startDrive(drive.id);
            const stats = await driveManager.getDriveStats(drive.id);

            expect(stats).toMatchObject({
                placeholderInfoRequests: expect.any(Number),
                fileDataRequests: expect.any(Number),
                directoryEnumerations: expect.any(Number),
                fileModifications: expect.any(Number),
                uptime: expect.any(Number)
            });
        });

        it('should return null for stopped drive', async () => {
            const drive = await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            const stats = await driveManager.getDriveStats(drive.id);
            expect(stats).toBeNull();
        });
    });

    describe('persistence', () => {
        it('should save drives to store', async () => {
            const saveSpy = vi.spyOn(driveManager as any, 'saveDrives');
            
            await driveManager.createDrive({
                name: 'Test Drive',
                path: 'C:\\TestDrive'
            });

            expect(saveSpy).toHaveBeenCalled();
        });

        it('should load drives from store', async () => {
            // Create drives with first instance
            const drive1 = await driveManager.createDrive({
                name: 'Drive 1',
                path: 'C:\\Drive1'
            });
            const drive2 = await driveManager.createDrive({
                name: 'Drive 2',
                path: 'C:\\Drive2'
            });

            // Create new instance (simulating app restart)
            const newDriveManager = new DriveManager();
            await newDriveManager.loadDrives();

            const drives = await newDriveManager.listDrives();
            expect(drives).toHaveLength(2);
            expect(drives[0].name).toBe('Drive 1');
            expect(drives[1].name).toBe('Drive 2');
        });
    });
});