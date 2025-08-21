import React, { useState } from 'react';
import { X, Folder, HardDrive, AlertCircle } from 'lucide-react';

interface CreateDriveModalProps {
    onClose: () => void;
    onCreate: (config: { name: string; path: string }) => Promise<void>;
}

export function CreateDriveModal({ onClose, onCreate }: CreateDriveModalProps) {
    const [name, setName] = useState('');
    const [path, setPath] = useState('');
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);

    const handleSelectPath = async () => {
        const selectedPath = await window.electronAPI.dialog.selectFolder();
        if (selectedPath) {
            setPath(selectedPath);
            // Auto-generate name from path if empty
            if (!name) {
                const pathParts = selectedPath.split('\\');
                const folderName = pathParts[pathParts.length - 1];
                setName(`${folderName} Drive`);
            }
        }
    };

    const handleCreate = async () => {
        // Validation
        if (!name.trim()) {
            setError('Please enter a drive name');
            return;
        }
        if (!path) {
            setError('Please select a folder path');
            return;
        }

        setError('');
        setCreating(true);

        try {
            await onCreate({ name: name.trim(), path });
        } catch (err: any) {
            setError(err.message || 'Failed to create drive');
            setCreating(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create Virtual Drive</h2>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label htmlFor="drive-name">
                            <HardDrive size={16} />
                            Drive Name
                        </label>
                        <input
                            id="drive-name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g., My Documents"
                            className="form-control"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="drive-path">
                            <Folder size={16} />
                            Mount Path
                        </label>
                        <div className="path-input-group">
                            <input
                                id="drive-path"
                                type="text"
                                value={path}
                                onChange={e => setPath(e.target.value)}
                                placeholder="Select or enter a folder path"
                                className="form-control"
                            />
                            <button 
                                className="btn btn-secondary"
                                onClick={handleSelectPath}
                            >
                                Browse
                            </button>
                        </div>
                        <p className="form-hint">
                            This is where the virtual drive will appear in Windows Explorer
                        </p>
                    </div>

                    {error && (
                        <div className="alert alert-error">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="info-box">
                        <h4>What happens next?</h4>
                        <ul>
                            <li>A virtual drive will be created at the specified path</li>
                            <li>You can access ONE.core content through Windows Explorer</li>
                            <li>The drive can be started and stopped at any time</li>
                            <li>All file operations are transparently handled by ONE.core</li>
                        </ul>
                    </div>
                </div>

                <div className="modal-footer">
                    <button 
                        className="btn btn-secondary" 
                        onClick={onClose}
                        disabled={creating}
                    >
                        Cancel
                    </button>
                    <button 
                        className="btn btn-primary" 
                        onClick={handleCreate}
                        disabled={creating || !name || !path}
                    >
                        {creating ? 'Creating...' : 'Create Drive'}
                    </button>
                </div>
            </div>
        </div>
    );
}