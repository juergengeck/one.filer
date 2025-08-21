import React, { useState, useEffect } from 'react';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { TestRunnerSafe } from './components/TestRunnerSafe';
// import { DebugLogs } from './components/DebugLogs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Shield, Settings, Activity, CheckCircle, XCircle, AlertCircle, Loader2, Eye, EyeOff, Stethoscope, Terminal } from 'lucide-react';
import './globals.css';
export function App() {
    const [state, setState] = useState({
        wslStatus: { installed: false, running: false, distros: [] },
        replicantStatus: { running: false },
        isConnecting: false,
        error: null,
        success: null,
        mountPoint: null
    });
    const [secret, setSecret] = useState('');
    const [configPath, setConfigPath] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [activeTab, setActiveTab] = useState('connect');
    // Debug tab changes
    React.useEffect(() => {
        console.log('[App] Active tab changed to:', activeTab);
    }, [activeTab]);
    // Update status periodically
    useEffect(() => {
        const updateStatus = async () => {
            try {
                const [wsl, replicant] = await Promise.all([
                    window.electronAPI.checkWslStatus(),
                    window.electronAPI.checkReplicantStatus()
                ]);
                setState(prev => ({
                    ...prev,
                    wslStatus: wsl,
                    replicantStatus: replicant
                }));
                // Only auto-switch to monitoring tab once after connecting
                // Don't switch if user is on a different tab
                // Comment out for now as it's interfering with other tabs
                // if (replicant.running && activeTab === 'connect') {
                //   setActiveTab('monitoring');
                // }
            }
            catch (error) {
                console.error('Failed to update status:', error);
            }
        };
        updateStatus();
        // Reduce update frequency to lower CPU usage
        const interval = setInterval(updateStatus, 5000); // Changed from 2000ms to 5000ms
        return () => clearInterval(interval);
    }, []); // Remove activeTab dependency to prevent multiple intervals
    const handleConnect = async (e) => {
        e.preventDefault();
        if (!secret) {
            setState(prev => ({ ...prev, error: 'Please enter your password' }));
            return;
        }
        setState(prev => ({
            ...prev,
            isConnecting: true,
            error: null,
            success: null
        }));
        try {
            // No WSL needed - running natively!
            // Start replicant
            const result = await window.electronAPI.login({
                secret,
                configPath: configPath || undefined
            });
            if (result.success) {
                setState(prev => ({
                    ...prev,
                    success: result.message,
                    mountPoint: result.mountPoint || null,
                    error: null
                }));
                // Clear form
                setSecret('');
                setConfigPath('');
                // Switch to monitoring tab after a delay
                setTimeout(() => {
                    setActiveTab('monitoring');
                }, 1500);
            }
            else {
                setState(prev => ({
                    ...prev,
                    error: result.message,
                    success: null
                }));
            }
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Connection failed',
                success: null
            }));
        }
        finally {
            setState(prev => ({ ...prev, isConnecting: false }));
        }
    };
    const handleDisconnect = async () => {
        try {
            await window.electronAPI.stopReplicant();
            setState(prev => ({
                ...prev,
                success: 'Replicant stopped successfully',
                error: null
            }));
            setActiveTab('connect');
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to stop replicant'
            }));
        }
    };
    return (React.createElement("div", { className: "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900" },
        React.createElement("div", { className: "container mx-auto p-4" },
            React.createElement("div", { className: "mb-6 text-center" },
                React.createElement("h1", { className: "text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent" }, "ONE Filer Control Center"),
                React.createElement("p", { className: "text-slate-600 dark:text-slate-400 mt-2" }, "Manage your distributed storage system")),
            React.createElement("div", { className: "mb-6 grid grid-cols-2 gap-4" },
                React.createElement(Card, null,
                    React.createElement(CardHeader, { className: "pb-3" },
                        React.createElement(CardTitle, { className: "text-sm font-medium" }, "Native Mode")),
                    React.createElement(CardContent, null,
                        React.createElement("div", { className: "flex items-center gap-2" },
                            React.createElement(CheckCircle, { className: "h-5 w-5 text-green-500" }),
                            React.createElement("span", { className: "text-sm font-medium" }, "ProjFS Ready")))),
                React.createElement(Card, null,
                    React.createElement(CardHeader, { className: "pb-3" },
                        React.createElement(CardTitle, { className: "text-sm font-medium" }, "Replicant Status")),
                    React.createElement(CardContent, null,
                        React.createElement("div", { className: "flex items-center gap-2" }, state.replicantStatus.running ? (React.createElement(React.Fragment, null,
                            React.createElement(CheckCircle, { className: "h-5 w-5 text-green-500" }),
                            React.createElement("span", { className: "text-sm font-medium" },
                                "Running ",
                                state.replicantStatus.pid && `(PID: ${state.replicantStatus.pid})`))) : (React.createElement(React.Fragment, null,
                            React.createElement(XCircle, { className: "h-5 w-5 text-red-500" }),
                            React.createElement("span", { className: "text-sm font-medium" }, "Stopped"))))))),
            React.createElement(Tabs, { value: activeTab, onValueChange: setActiveTab },
                React.createElement(TabsList, { className: "grid w-full grid-cols-6" },
                    React.createElement(TabsTrigger, { value: "connect", className: "flex items-center gap-2" },
                        React.createElement(Shield, { className: "h-4 w-4" }),
                        "Connect"),
                    React.createElement(TabsTrigger, { value: "monitoring", className: "flex items-center gap-2" },
                        React.createElement(Activity, { className: "h-4 w-4" }),
                        "Monitoring"),
                    React.createElement(TabsTrigger, { value: "tests", className: "flex items-center gap-2" },
                        React.createElement(CheckCircle, { className: "h-4 w-4" }),
                        "Tests"),
                    React.createElement(TabsTrigger, { value: "settings", className: "flex items-center gap-2" },
                        React.createElement(Settings, { className: "h-4 w-4" }),
                        "Settings"),
                    React.createElement(TabsTrigger, { value: "diagnostics", className: "flex items-center gap-2" },
                        React.createElement(Stethoscope, { className: "h-4 w-4" }),
                        "Diagnostics"),
                    React.createElement(TabsTrigger, { value: "debug", className: "flex items-center gap-2" },
                        React.createElement(Terminal, { className: "h-4 w-4" }),
                        "Debug")),
                React.createElement(TabsContent, { value: "connect", className: "mt-6" },
                    React.createElement(Card, null,
                        React.createElement(CardHeader, null,
                            React.createElement(CardTitle, null, "Connect to ONE Instance"),
                            React.createElement(CardDescription, null, "Enter your secret to start the replicant service")),
                        React.createElement(CardContent, null,
                            React.createElement("form", { onSubmit: handleConnect, className: "space-y-4" },
                                React.createElement("div", null,
                                    React.createElement("label", { htmlFor: "secret", className: "block text-sm font-medium mb-1" }, "Password"),
                                    React.createElement("div", { className: "relative" },
                                        React.createElement("input", { id: "secret", type: showSecret ? 'text' : 'password', value: secret, onChange: (e) => setSecret(e.target.value), className: "w-full px-3 py-2 border rounded-md pr-10", placeholder: "Enter your ONE instance secret", required: true, disabled: state.isConnecting }),
                                        React.createElement("button", { type: "button", onClick: () => setShowSecret(!showSecret), className: "absolute right-2 top-2 text-gray-500 hover:text-gray-700" }, showSecret ? React.createElement(EyeOff, { className: "h-5 w-5" }) : React.createElement(Eye, { className: "h-5 w-5" })))),
                                React.createElement("div", null,
                                    React.createElement("label", { htmlFor: "configPath", className: "block text-sm font-medium mb-1" }, "Config Path (Optional)"),
                                    React.createElement("input", { id: "configPath", type: "text", value: configPath, onChange: (e) => setConfigPath(e.target.value), className: "w-full px-3 py-2 border rounded-md", placeholder: "Leave empty for default config", disabled: state.isConnecting })),
                                state.error && (React.createElement("div", { className: "bg-red-50 text-red-800 p-3 rounded-md text-sm" }, state.error)),
                                state.success && (React.createElement("div", { className: "bg-green-50 text-green-800 p-3 rounded-md text-sm" },
                                    state.success,
                                    state.mountPoint && (React.createElement("div", { className: "mt-1" },
                                        "Mount point: ",
                                        React.createElement("code", { className: "font-mono" }, state.mountPoint))))),
                                React.createElement("div", { className: "flex gap-3" }, state.replicantStatus.running ? (React.createElement("button", { type: "button", onClick: handleDisconnect, className: "flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors" }, "Stop Replicant")) : (React.createElement("button", { type: "submit", disabled: state.isConnecting, className: "flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" }, state.isConnecting ? (React.createElement(React.Fragment, null,
                                    React.createElement(Loader2, { className: "h-4 w-4 animate-spin" }),
                                    "Starting Replicant...")) : ('Start Replicant')))))))),
                React.createElement(TabsContent, { value: "monitoring", className: "mt-6" }, state.replicantStatus.running && activeTab === 'monitoring' ? (React.createElement(MonitoringDashboard, null)) : state.replicantStatus.running ? null : (React.createElement(Card, null,
                    React.createElement(CardContent, { className: "pt-6" },
                        React.createElement("div", { className: "text-center py-8" },
                            React.createElement(AlertCircle, { className: "h-12 w-12 text-yellow-500 mx-auto mb-4" }),
                            React.createElement("h3", { className: "text-lg font-medium mb-2" }, "Replicant Not Running"),
                            React.createElement("p", { className: "text-sm text-gray-600" }, "Start the replicant service to view monitoring data")))))),
                React.createElement(TabsContent, { value: "settings", className: "mt-6" },
                    React.createElement(Card, null,
                        React.createElement(CardHeader, null,
                            React.createElement(CardTitle, null, "Settings"),
                            React.createElement(CardDescription, null, "Configure ONE Filer behavior")),
                        React.createElement(CardContent, null,
                            React.createElement("div", { className: "space-y-4" },
                                React.createElement("div", null,
                                    React.createElement("h3", { className: "text-sm font-medium mb-2" }, "Filesystem Mode"),
                                    React.createElement("p", { className: "text-sm text-gray-600" }, "Native Windows (ProjFS)")),
                                React.createElement("div", null,
                                    React.createElement("h3", { className: "text-sm font-medium mb-2" }, "Installation Path"),
                                    React.createElement("p", { className: "text-sm text-gray-600 font-mono" }, "C:\\Program Files\\ONE Filer")),
                                React.createElement("div", null,
                                    React.createElement("h3", { className: "text-sm font-medium mb-2" }, "Version"),
                                    React.createElement("p", { className: "text-sm text-gray-600" }, "1.0.0")))))),
                React.createElement(TabsContent, { value: "tests", className: "mt-6" },
                    React.createElement(TestRunnerSafe, null)),
                React.createElement(TabsContent, { value: "diagnostics", className: "mt-6" },
                    React.createElement(DiagnosticsPanel, null)),
                React.createElement(TabsContent, { value: "debug", className: "mt-6" },
                    React.createElement("div", { className: "h-[600px]" }))))));
}
//# sourceMappingURL=App.js.map