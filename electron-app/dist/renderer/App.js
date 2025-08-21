import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { DriveManager } from './components/DriveManager';
import { Settings } from './components/Settings';
import { Navigation } from './components/Navigation';
import { DriveProvider } from './contexts/DriveContext';
import './styles/app.css';
export function App() {
    const [currentRoute, setCurrentRoute] = useState('dashboard');
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
                return React.createElement(Dashboard, null);
            case 'drives':
                return React.createElement(DriveManager, null);
            case 'settings':
                return React.createElement(Settings, null);
            default:
                return React.createElement(Dashboard, null);
        }
    };
    return (React.createElement(DriveProvider, null,
        React.createElement("div", { className: "app" },
            React.createElement(Navigation, { currentRoute: currentRoute, onNavigate: setCurrentRoute }),
            React.createElement("main", { className: "main-content" }, renderContent()))));
}
//# sourceMappingURL=App.js.map