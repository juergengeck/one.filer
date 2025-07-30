"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = App;
const react_1 = __importStar(require("react"));
const MonitoringDashboard_1 = require("./components/MonitoringDashboard");
const tabs_1 = require("./components/ui/tabs");
const card_1 = require("./components/ui/card");
const lucide_react_1 = require("lucide-react");
require("./globals.css");
function App() {
    const [state, setState] = (0, react_1.useState)({
        wslStatus: { installed: false, running: false, distros: [] },
        replicantStatus: { running: false },
        isConnecting: false,
        error: null,
        success: null,
        mountPoint: null
    });
    const [secret, setSecret] = (0, react_1.useState)('');
    const [configPath, setConfigPath] = (0, react_1.useState)('');
    const [showSecret, setShowSecret] = (0, react_1.useState)(false);
    const [activeTab, setActiveTab] = (0, react_1.useState)('connect');
    // Update status periodically
    (0, react_1.useEffect)(() => {
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
                // If replicant is running, switch to monitoring tab
                if (replicant.running && activeTab === 'connect') {
                    setActiveTab('monitoring');
                }
            }
            catch (error) {
                console.error('Failed to update status:', error);
            }
        };
        updateStatus();
        const interval = setInterval(updateStatus, 2000);
        return () => clearInterval(interval);
    }, [activeTab]);
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
            // Check WSL first
            if (!state.wslStatus.running) {
                const startResult = await window.electronAPI.startWsl();
                if (!startResult.success) {
                    throw new Error(startResult.message || 'Failed to start WSL');
                }
            }
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
    return (react_1.default.createElement("div", { className: "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900" },
        react_1.default.createElement("div", { className: "container mx-auto p-4" },
            react_1.default.createElement("div", { className: "mb-6 text-center" },
                react_1.default.createElement("h1", { className: "text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent" }, "ONE Filer Control Center"),
                react_1.default.createElement("p", { className: "text-slate-600 dark:text-slate-400 mt-2" }, "Manage your distributed storage system")),
            react_1.default.createElement("div", { className: "mb-6 grid grid-cols-2 gap-4" },
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, { className: "pb-3" },
                        react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "WSL Status")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement("div", { className: "flex items-center gap-2" }, state.wslStatus.installed ? (state.wslStatus.running ? (react_1.default.createElement(react_1.default.Fragment, null,
                            react_1.default.createElement(lucide_react_1.CheckCircle, { className: "h-5 w-5 text-green-500" }),
                            react_1.default.createElement("span", { className: "text-sm font-medium" }, "Running"))) : (react_1.default.createElement(react_1.default.Fragment, null,
                            react_1.default.createElement(lucide_react_1.AlertCircle, { className: "h-5 w-5 text-yellow-500" }),
                            react_1.default.createElement("span", { className: "text-sm font-medium" }, "Stopped")))) : (react_1.default.createElement(react_1.default.Fragment, null,
                            react_1.default.createElement(lucide_react_1.XCircle, { className: "h-5 w-5 text-red-500" }),
                            react_1.default.createElement("span", { className: "text-sm font-medium" }, "Not Installed")))))),
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, { className: "pb-3" },
                        react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Replicant Status")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement("div", { className: "flex items-center gap-2" }, state.replicantStatus.running ? (react_1.default.createElement(react_1.default.Fragment, null,
                            react_1.default.createElement(lucide_react_1.CheckCircle, { className: "h-5 w-5 text-green-500" }),
                            react_1.default.createElement("span", { className: "text-sm font-medium" },
                                "Running ",
                                state.replicantStatus.pid && `(PID: ${state.replicantStatus.pid})`))) : (react_1.default.createElement(react_1.default.Fragment, null,
                            react_1.default.createElement(lucide_react_1.XCircle, { className: "h-5 w-5 text-red-500" }),
                            react_1.default.createElement("span", { className: "text-sm font-medium" }, "Stopped"))))))),
            react_1.default.createElement(tabs_1.Tabs, { value: activeTab, onValueChange: setActiveTab },
                react_1.default.createElement(tabs_1.TabsList, { className: "grid w-full grid-cols-3" },
                    react_1.default.createElement(tabs_1.TabsTrigger, { value: "connect", className: "flex items-center gap-2" },
                        react_1.default.createElement(lucide_react_1.Shield, { className: "h-4 w-4" }),
                        "Connect"),
                    react_1.default.createElement(tabs_1.TabsTrigger, { value: "monitoring", className: "flex items-center gap-2" },
                        react_1.default.createElement(lucide_react_1.Activity, { className: "h-4 w-4" }),
                        "Monitoring"),
                    react_1.default.createElement(tabs_1.TabsTrigger, { value: "settings", className: "flex items-center gap-2" },
                        react_1.default.createElement(lucide_react_1.Settings, { className: "h-4 w-4" }),
                        "Settings")),
                react_1.default.createElement(tabs_1.TabsContent, { value: "connect", className: "mt-6" },
                    react_1.default.createElement(card_1.Card, null,
                        react_1.default.createElement(card_1.CardHeader, null,
                            react_1.default.createElement(card_1.CardTitle, null, "Connect to ONE Instance"),
                            react_1.default.createElement(card_1.CardDescription, null, "Enter your secret to start the replicant service")),
                        react_1.default.createElement(card_1.CardContent, null,
                            react_1.default.createElement("form", { onSubmit: handleConnect, className: "space-y-4" },
                                react_1.default.createElement("div", null,
                                    react_1.default.createElement("label", { htmlFor: "secret", className: "block text-sm font-medium mb-1" }, "Password"),
                                    react_1.default.createElement("div", { className: "relative" },
                                        react_1.default.createElement("input", { id: "secret", type: showSecret ? 'text' : 'password', value: secret, onChange: (e) => setSecret(e.target.value), className: "w-full px-3 py-2 border rounded-md pr-10", placeholder: "Enter your ONE instance secret", required: true, disabled: state.isConnecting }),
                                        react_1.default.createElement("button", { type: "button", onClick: () => setShowSecret(!showSecret), className: "absolute right-2 top-2 text-gray-500 hover:text-gray-700" }, showSecret ? react_1.default.createElement(lucide_react_1.EyeOff, { className: "h-5 w-5" }) : react_1.default.createElement(lucide_react_1.Eye, { className: "h-5 w-5" })))),
                                react_1.default.createElement("div", null,
                                    react_1.default.createElement("label", { htmlFor: "configPath", className: "block text-sm font-medium mb-1" }, "Config Path (Optional)"),
                                    react_1.default.createElement("input", { id: "configPath", type: "text", value: configPath, onChange: (e) => setConfigPath(e.target.value), className: "w-full px-3 py-2 border rounded-md", placeholder: "Leave empty for default config", disabled: state.isConnecting })),
                                state.error && (react_1.default.createElement("div", { className: "bg-red-50 text-red-800 p-3 rounded-md text-sm" }, state.error)),
                                state.success && (react_1.default.createElement("div", { className: "bg-green-50 text-green-800 p-3 rounded-md text-sm" },
                                    state.success,
                                    state.mountPoint && (react_1.default.createElement("div", { className: "mt-1" },
                                        "Mount point: ",
                                        react_1.default.createElement("code", { className: "font-mono" }, state.mountPoint))))),
                                react_1.default.createElement("div", { className: "flex gap-3" }, state.replicantStatus.running ? (react_1.default.createElement("button", { type: "button", onClick: handleDisconnect, className: "flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors" }, "Stop Replicant")) : (react_1.default.createElement("button", { type: "submit", disabled: state.isConnecting || !state.wslStatus.installed, className: "flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" }, state.isConnecting ? (react_1.default.createElement(react_1.default.Fragment, null,
                                    react_1.default.createElement(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }),
                                    "Starting Replicant...")) : ('Start Replicant')))))))),
                react_1.default.createElement(tabs_1.TabsContent, { value: "monitoring", className: "mt-6" }, state.replicantStatus.running ? (react_1.default.createElement(MonitoringDashboard_1.MonitoringDashboard, null)) : (react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardContent, { className: "pt-6" },
                        react_1.default.createElement("div", { className: "text-center py-8" },
                            react_1.default.createElement(lucide_react_1.AlertCircle, { className: "h-12 w-12 text-yellow-500 mx-auto mb-4" }),
                            react_1.default.createElement("h3", { className: "text-lg font-medium mb-2" }, "Replicant Not Running"),
                            react_1.default.createElement("p", { className: "text-sm text-gray-600" }, "Start the replicant service to view monitoring data")))))),
                react_1.default.createElement(tabs_1.TabsContent, { value: "settings", className: "mt-6" },
                    react_1.default.createElement(card_1.Card, null,
                        react_1.default.createElement(card_1.CardHeader, null,
                            react_1.default.createElement(card_1.CardTitle, null, "Settings"),
                            react_1.default.createElement(card_1.CardDescription, null, "Configure ONE Filer behavior")),
                        react_1.default.createElement(card_1.CardContent, null,
                            react_1.default.createElement("div", { className: "space-y-4" },
                                react_1.default.createElement("div", null,
                                    react_1.default.createElement("h3", { className: "text-sm font-medium mb-2" }, "WSL Distribution"),
                                    react_1.default.createElement("p", { className: "text-sm text-gray-600" }, state.wslStatus.distros.length > 0 ? state.wslStatus.distros.join(', ') : 'None')),
                                react_1.default.createElement("div", null,
                                    react_1.default.createElement("h3", { className: "text-sm font-medium mb-2" }, "Installation Path"),
                                    react_1.default.createElement("p", { className: "text-sm text-gray-600 font-mono" }, "C:\\Program Files\\ONE Filer")),
                                react_1.default.createElement("div", null,
                                    react_1.default.createElement("h3", { className: "text-sm font-medium mb-2" }, "Version"),
                                    react_1.default.createElement("p", { className: "text-sm text-gray-600" }, "1.0.0"))))))))));
}
//# sourceMappingURL=App.js.map