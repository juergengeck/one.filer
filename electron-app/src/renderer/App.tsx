import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { DriveManager } from './components/DriveManager';
import { Settings } from './components/Settings';
import { Navigation } from './components/Navigation';
import { DriveProvider } from './contexts/DriveContext';
import './styles/app.css';

type Route = 'dashboard' | 'drives' | 'settings';

export function App() {
    const [currentRoute, setCurrentRoute] = useState<Route>('dashboard');

    useEffect(() => {
        // Listen for navigation events from main process
        const unsubscribe = window.electronAPI.onNavigate((route) => {
            if (route === '/settings') {
                setCurrentRoute('settings');
            }
        });

        return unsubscribe;
    }, []);

    const renderContent = () => {
        switch (currentRoute) {
            case 'dashboard':
                return <Dashboard />;
            case 'drives':
                return <DriveManager />;
            case 'settings':
                return <Settings />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <DriveProvider>
            <div className="app">
                <Navigation 
                    currentRoute={currentRoute} 
                    onNavigate={setCurrentRoute} 
                />
                <main className="main-content">
                    {renderContent()}
                </main>
            </div>
        </DriveProvider>
    );
}