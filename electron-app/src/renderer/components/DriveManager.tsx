import React, { useState } from 'react';
import { useDrives } from '../contexts/DriveContext';
import { DriveList } from './DriveList';
import { CreateDriveModal } from './CreateDriveModal';
import { Plus, HardDrive } from 'lucide-react';

export function DriveManager() {
    const { drives, createDrive, loading } = useDrives();
    const [showCreateModal, setShowCreateModal] = useState(false);

    const handleCreateDrive = async (config: { name: string; path: string }) => {
        await createDrive(config);
        setShowCreateModal(false);
    };

    return (
        <div className="drive-manager">
            <header className="page-header">
                <div className="header-content">
                    <h1>Virtual Drives</h1>
                    <p>Create and manage your ONE.core virtual drives</p>
                </div>
                <button 
                    className="btn btn-primary"
                    onClick={() => setShowCreateModal(true)}
                >
                    <Plus size={20} />
                    New Drive
                </button>
            </header>

            {drives.length === 0 ? (
                <div className="empty-state large">
                    <HardDrive size={64} />
                    <h2>No Virtual Drives</h2>
                    <p>Create your first virtual drive to start accessing ONE.core content</p>
                    <button 
                        className="btn btn-primary btn-lg"
                        onClick={() => setShowCreateModal(true)}
                    >
                        Create Virtual Drive
                    </button>
                </div>
            ) : (
                <DriveList drives={drives} />
            )}

            {showCreateModal && (
                <CreateDriveModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateDrive}
                />
            )}
        </div>
    );
}