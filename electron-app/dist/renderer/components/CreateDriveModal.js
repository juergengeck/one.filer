import React, { useState } from 'react';
import { X, Folder, HardDrive, AlertCircle } from 'lucide-react';
export function CreateDriveModal({ onClose, onCreate }) {
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
        }
        catch (err) {
            setError(err.message || 'Failed to create drive');
            setCreating(false);
        }
    };
    return (React.createElement("div", { className: "modal-overlay", onClick: onClose },
        React.createElement("div", { className: "modal", onClick: e => e.stopPropagation() },
            React.createElement("div", { className: "modal-header" },
                React.createElement("h2", null, "Create Virtual Drive"),
                React.createElement("button", { className: "btn-icon", onClick: onClose },
                    React.createElement(X, { size: 20 }))),
            React.createElement("div", { className: "modal-body" },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "drive-name" },
                        React.createElement(HardDrive, { size: 16 }),
                        "Drive Name"),
                    React.createElement("input", { id: "drive-name", type: "text", value: name, onChange: e => setName(e.target.value), placeholder: "e.g., My Documents", className: "form-control", autoFocus: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "drive-path" },
                        React.createElement(Folder, { size: 16 }),
                        "Mount Path"),
                    React.createElement("div", { className: "path-input-group" },
                        React.createElement("input", { id: "drive-path", type: "text", value: path, onChange: e => setPath(e.target.value), placeholder: "Select or enter a folder path", className: "form-control" }),
                        React.createElement("button", { className: "btn btn-secondary", onClick: handleSelectPath }, "Browse")),
                    React.createElement("p", { className: "form-hint" }, "This is where the virtual drive will appear in Windows Explorer")),
                error && (React.createElement("div", { className: "alert alert-error" },
                    React.createElement(AlertCircle, { size: 16 }),
                    error)),
                React.createElement("div", { className: "info-box" },
                    React.createElement("h4", null, "What happens next?"),
                    React.createElement("ul", null,
                        React.createElement("li", null, "A virtual drive will be created at the specified path"),
                        React.createElement("li", null, "You can access ONE.core content through Windows Explorer"),
                        React.createElement("li", null, "The drive can be started and stopped at any time"),
                        React.createElement("li", null, "All file operations are transparently handled by ONE.core")))),
            React.createElement("div", { className: "modal-footer" },
                React.createElement("button", { className: "btn btn-secondary", onClick: onClose, disabled: creating }, "Cancel"),
                React.createElement("button", { className: "btn btn-primary", onClick: handleCreate, disabled: creating || !name || !path }, creating ? 'Creating...' : 'Create Drive')))));
}
//# sourceMappingURL=CreateDriveModal.js.map