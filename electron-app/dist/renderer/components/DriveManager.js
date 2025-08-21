import React, { useState } from 'react';
import { useDrives } from '../contexts/DriveContext';
import { DriveList } from './DriveList';
import { CreateDriveModal } from './CreateDriveModal';
import { Plus, HardDrive } from 'lucide-react';
export function DriveManager() {
    const { drives, createDrive, loading } = useDrives();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const handleCreateDrive = async (config) => {
        await createDrive(config);
        setShowCreateModal(false);
    };
    return (React.createElement("div", { className: "drive-manager" },
        React.createElement("header", { className: "page-header" },
            React.createElement("div", { className: "header-content" },
                React.createElement("h1", null, "Virtual Drives"),
                React.createElement("p", null, "Create and manage your ONE.core virtual drives")),
            React.createElement("button", { className: "btn btn-primary", onClick: () => setShowCreateModal(true) },
                React.createElement(Plus, { size: 20 }),
                "New Drive")),
        drives.length === 0 ? (React.createElement("div", { className: "empty-state large" },
            React.createElement(HardDrive, { size: 64 }),
            React.createElement("h2", null, "No Virtual Drives"),
            React.createElement("p", null, "Create your first virtual drive to start accessing ONE.core content"),
            React.createElement("button", { className: "btn btn-primary btn-lg", onClick: () => setShowCreateModal(true) }, "Create Virtual Drive"))) : (React.createElement(DriveList, { drives: drives })),
        showCreateModal && (React.createElement(CreateDriveModal, { onClose: () => setShowCreateModal(false), onCreate: handleCreateDrive }))));
}
//# sourceMappingURL=DriveManager.js.map