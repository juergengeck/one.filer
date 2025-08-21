import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Activity, HardDrive, Server, AlertTriangle } from 'lucide-react';
export function DiagnosticsPanel() {
    const [diagnostics, setDiagnostics] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const runDiagnostics = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.runDiagnostics();
            setDiagnostics(result);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to run diagnostics');
        }
        finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        runDiagnostics();
    }, []);
    const getStatusIcon = (status) => {
        switch (status) {
            case 'running':
                return React.createElement(CheckCircle, { className: "h-5 w-5 text-green-500" });
            case 'stopped':
                return React.createElement(XCircle, { className: "h-5 w-5 text-gray-500" });
            case 'error':
                return React.createElement(AlertCircle, { className: "h-5 w-5 text-red-500" });
            case 'starting':
                return React.createElement(RefreshCw, { className: "h-5 w-5 text-blue-500 animate-spin" });
            default:
                return React.createElement(AlertTriangle, { className: "h-5 w-5 text-yellow-500" });
        }
    };
    if (error) {
        return (React.createElement(Card, null,
            React.createElement(CardContent, { className: "pt-6" },
                React.createElement("div", { className: "flex items-center gap-2 text-red-600" },
                    React.createElement(AlertCircle, { className: "h-5 w-5" }),
                    React.createElement("span", null,
                        "Diagnostics Error: ",
                        error)))));
    }
    if (!diagnostics) {
        return (React.createElement(Card, null,
            React.createElement(CardContent, { className: "pt-6" },
                React.createElement("div", { className: "flex items-center gap-2" },
                    React.createElement(RefreshCw, { className: "h-5 w-5 animate-spin" }),
                    React.createElement("span", null, "Loading diagnostics...")))));
    }
    return (React.createElement("div", { className: "space-y-4" },
        React.createElement("div", { className: "flex items-center justify-between" },
            React.createElement("h2", { className: "text-2xl font-bold" }, "System Diagnostics"),
            React.createElement("button", { onClick: runDiagnostics, disabled: isLoading, className: "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50" },
                React.createElement(RefreshCw, { className: `h-4 w-4 ${isLoading ? 'animate-spin' : ''}` }),
                "Refresh")),
        React.createElement(Card, null,
            React.createElement(CardHeader, null,
                React.createElement(CardTitle, { className: "flex items-center gap-2" },
                    React.createElement(Server, { className: "h-5 w-5" }),
                    "Service Status"),
                React.createElement(CardDescription, null, "Current status of all registered services")),
            React.createElement(CardContent, null,
                React.createElement("div", { className: "space-y-3" }, diagnostics?.services && Object.entries(diagnostics.services).map(([name, service]) => (React.createElement("div", { key: name, className: "border rounded-lg p-4" },
                    React.createElement("div", { className: "flex items-center justify-between" },
                        React.createElement("div", { className: "flex items-center gap-3" },
                            getStatusIcon(service.status),
                            React.createElement("div", null,
                                React.createElement("h4", { className: "font-medium capitalize" }, name),
                                React.createElement("p", { className: "text-sm text-gray-600" },
                                    service.status === 'running' && service.pid && `PID: ${service.pid}`,
                                    service.error && React.createElement("span", { className: "text-red-600" }, service.error)))),
                        React.createElement("div", { className: "text-sm text-gray-500" },
                            "Last check: ",
                            new Date(service.lastCheck).toLocaleTimeString())),
                    React.createElement("div", { className: "mt-2 text-sm text-gray-600" },
                        React.createElement("div", { className: "flex gap-4" },
                            React.createElement("span", null,
                                "Health Check: ",
                                service.config.hasHealthCheck ? '✓' : '✗'),
                            React.createElement("span", null,
                                "Dependencies: ",
                                service.config.hasRequiredServices ? '✓' : '✗'),
                            React.createElement("span", null,
                                "Retry Attempts: ",
                                service.config.retryAttempts))))))))),
        React.createElement(Card, null,
            React.createElement(CardHeader, null,
                React.createElement(CardTitle, { className: "flex items-center gap-2" },
                    React.createElement(Activity, { className: "h-5 w-5" }),
                    "System Information"),
                React.createElement(CardDescription, null, "Runtime environment details")),
            React.createElement(CardContent, null,
                React.createElement("div", { className: "grid grid-cols-2 gap-4" },
                    React.createElement("div", null,
                        React.createElement("h4", { className: "font-medium mb-2" }, "Platform"),
                        React.createElement("div", { className: "space-y-1 text-sm" },
                            React.createElement("div", null,
                                "OS: ",
                                diagnostics.system.platform,
                                " (",
                                diagnostics.system.arch,
                                ")"),
                            React.createElement("div", null,
                                "Node: ",
                                diagnostics.system.nodeVersion),
                            React.createElement("div", null,
                                "Electron: ",
                                diagnostics.system.electronVersion),
                            React.createElement("div", null,
                                "Chrome: ",
                                diagnostics.system.chromeVersion),
                            React.createElement("div", null,
                                "V8: ",
                                diagnostics.system.v8Version))),
                    React.createElement("div", null,
                        React.createElement("h4", { className: "font-medium mb-2" }, "Configuration"),
                        React.createElement("div", { className: "space-y-1 text-sm" },
                            React.createElement("div", null,
                                "WSL Distro: ",
                                diagnostics.config.wslDistro),
                            React.createElement("div", null,
                                "Start Minimized: ",
                                diagnostics.config.startMinimized ? 'Yes' : 'No'),
                            React.createElement("div", null,
                                "System Tray: ",
                                diagnostics.config.showInSystemTray ? 'Yes' : 'No'),
                            React.createElement("div", null,
                                "Auto Connect: ",
                                diagnostics.config.autoConnect ? 'Yes' : 'No')))))),
        React.createElement(Card, null,
            React.createElement(CardHeader, null,
                React.createElement(CardTitle, { className: "flex items-center gap-2" },
                    React.createElement(HardDrive, { className: "h-5 w-5" }),
                    "Application Paths"),
                React.createElement(CardDescription, null, "Important directory locations")),
            React.createElement(CardContent, null,
                React.createElement("div", { className: "space-y-2 font-mono text-sm" },
                    React.createElement("div", null,
                        React.createElement("span", { className: "font-medium" }, "User Data:"),
                        React.createElement("div", { className: "text-gray-600 break-all" }, diagnostics.paths.userData)),
                    React.createElement("div", null,
                        React.createElement("span", { className: "font-medium" }, "Cache:"),
                        React.createElement("div", { className: "text-gray-600 break-all" }, diagnostics.paths.cache)),
                    React.createElement("div", null,
                        React.createElement("span", { className: "font-medium" }, "Logs:"),
                        React.createElement("div", { className: "text-gray-600 break-all" }, diagnostics.paths.logs)),
                    React.createElement("div", null,
                        React.createElement("span", { className: "font-medium" }, "Temp:"),
                        React.createElement("div", { className: "text-gray-600 break-all" }, diagnostics.paths.temp)),
                    React.createElement("div", null,
                        React.createElement("span", { className: "font-medium" }, "Replicant Path:"),
                        React.createElement("div", { className: "text-gray-600 break-all" }, diagnostics.config.replicantPath))))),
        React.createElement("div", { className: "text-sm text-gray-500 text-right" },
            "Diagnostics run at: ",
            new Date(diagnostics.timestamp).toLocaleString())));
}
//# sourceMappingURL=DiagnosticsPanel.js.map