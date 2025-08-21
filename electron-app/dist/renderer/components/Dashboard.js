import React from 'react';
import { useDrives } from '../contexts/DriveContext';
import { DriveCard } from './DriveCard';
import { SystemStats } from './SystemStats';
import { QuickActions } from './QuickActions';
import { HardDrive, AlertCircle } from 'lucide-react';
export function Dashboard() {
    const { drives, loading } = useDrives();
    const runningDrives = drives.filter(d => d.isRunning);
    if (loading) {
        return (React.createElement("div", { className: "dashboard loading" },
            React.createElement("div", { className: "spinner" }, "Loading...")));
    }
    return (React.createElement("div", { className: "dashboard" },
        React.createElement("header", { className: "dashboard-header" },
            React.createElement("h1", null, "ONE.Filer Dashboard"),
            React.createElement("p", { className: "subtitle" }, "Manage your virtual drives and monitor performance")),
        React.createElement("div", { className: "stats-overview" },
            React.createElement("div", { className: "stat-card" },
                React.createElement(HardDrive, { className: "stat-icon" }),
                React.createElement("div", { className: "stat-content" },
                    React.createElement("h3", null, "Total Drives"),
                    React.createElement("p", { className: "stat-value" }, drives.length))),
            React.createElement("div", { className: "stat-card" },
                React.createElement(HardDrive, { className: "stat-icon running" }),
                React.createElement("div", { className: "stat-content" },
                    React.createElement("h3", null, "Running"),
                    React.createElement("p", { className: "stat-value" }, runningDrives.length))),
            React.createElement("div", { className: "stat-card" },
                React.createElement(AlertCircle, { className: "stat-icon" }),
                React.createElement("div", { className: "stat-content" },
                    React.createElement("h3", null, "Stopped"),
                    React.createElement("p", { className: "stat-value" }, drives.length - runningDrives.length)))),
        React.createElement(QuickActions, null),
        React.createElement("section", { className: "drives-section" },
            React.createElement("h2", null, "Active Drives"),
            runningDrives.length === 0 ? (React.createElement("div", { className: "empty-state" },
                React.createElement(HardDrive, { size: 48 }),
                React.createElement("p", null, "No drives are currently running"),
                React.createElement("button", { className: "btn btn-primary", onClick: () => window.electronAPI.drive.create({
                        name: 'New Drive',
                        path: 'C:\\VirtualDrive'
                    }) }, "Create Your First Drive"))) : (React.createElement("div", { className: "drives-grid" }, runningDrives.map(drive => (React.createElement(DriveCard, { key: drive.id, drive: drive })))))),
        React.createElement(SystemStats, null)));
}
//# sourceMappingURL=Dashboard.js.map