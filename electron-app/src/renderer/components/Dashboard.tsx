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
        return (
            <div className="dashboard loading">
                <div className="spinner">Loading...</div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>ONE.Filer Dashboard</h1>
                <p className="subtitle">Manage your virtual drives and monitor performance</p>
            </header>

            <div className="stats-overview">
                <div className="stat-card">
                    <HardDrive className="stat-icon" />
                    <div className="stat-content">
                        <h3>Total Drives</h3>
                        <p className="stat-value">{drives.length}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <HardDrive className="stat-icon running" />
                    <div className="stat-content">
                        <h3>Running</h3>
                        <p className="stat-value">{runningDrives.length}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <AlertCircle className="stat-icon" />
                    <div className="stat-content">
                        <h3>Stopped</h3>
                        <p className="stat-value">{drives.length - runningDrives.length}</p>
                    </div>
                </div>
            </div>

            <QuickActions />

            <section className="drives-section">
                <h2>Active Drives</h2>
                {runningDrives.length === 0 ? (
                    <div className="empty-state">
                        <HardDrive size={48} />
                        <p>No drives are currently running</p>
                        <button 
                            className="btn btn-primary"
                            onClick={() => window.electronAPI.drive.create({ 
                                name: 'New Drive', 
                                path: 'C:\\VirtualDrive' 
                            })}
                        >
                            Create Your First Drive
                        </button>
                    </div>
                ) : (
                    <div className="drives-grid">
                        {runningDrives.map(drive => (
                            <DriveCard key={drive.id} drive={drive} />
                        ))}
                    </div>
                )}
            </section>

            <SystemStats />
        </div>
    );
}