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
exports.MonitoringDashboard = MonitoringDashboard;
const react_1 = __importStar(require("react"));
const card_1 = require("./ui/card");
const tabs_1 = require("./ui/tabs");
const progress_1 = require("./ui/progress");
const recharts_1 = require("recharts");
const lucide_react_1 = require("lucide-react");
const date_fns_1 = require("date-fns");
function MonitoringDashboard() {
    const [systemMetrics, setSystemMetrics] = (0, react_1.useState)({
        cpu: 0,
        memory: { used: 0, total: 0, percentage: 0 },
        disk: { used: 0, total: 0, percentage: 0 },
        network: { bytesIn: 0, bytesOut: 0 }
    });
    const [replicantMetrics, setReplicantMetrics] = (0, react_1.useState)({
        status: 'stopped',
        uptime: 0,
        connections: 0,
        objectsStored: 0,
        objectsSynced: 0,
        syncQueue: 0,
        errors: 0,
        lastSync: null,
        bandwidth: {
            upload: 0,
            download: 0
        },
        operations: {
            reads: 0,
            writes: 0,
            deletes: 0
        },
        performance: {
            avgResponseTime: 0,
            requestsPerSecond: 0
        }
    });
    const [wslMetrics, setWSLMetrics] = (0, react_1.useState)({
        status: 'stopped',
        distro: 'Debian',
        version: '12',
        memory: 0,
        processes: 0
    });
    const [cpuHistory, setCpuHistory] = (0, react_1.useState)([]);
    const [networkHistory, setNetworkHistory] = (0, react_1.useState)([]);
    const [syncHistory, setSyncHistory] = (0, react_1.useState)([]);
    const [operationsHistory, setOperationsHistory] = (0, react_1.useState)([]);
    const [bandwidthHistory, setBandwidthHistory] = (0, react_1.useState)([]);
    // Fetch metrics from electron IPC
    (0, react_1.useEffect)(() => {
        const fetchMetrics = async () => {
            try {
                const metrics = await window.electronAPI.getSystemMetrics();
                setSystemMetrics(metrics.system);
                setReplicantMetrics(metrics.replicant);
                setWSLMetrics(metrics.wsl);
                // Update history data
                const timestamp = (0, date_fns_1.format)(new Date(), 'HH:mm:ss');
                setCpuHistory(prev => [...prev.slice(-20), { time: timestamp, cpu: metrics.system.cpu }]);
                setNetworkHistory(prev => [...prev.slice(-20), {
                        time: timestamp,
                        in: metrics.system.network.bytesIn / 1024,
                        out: metrics.system.network.bytesOut / 1024
                    }]);
                setSyncHistory(prev => [...prev.slice(-20), {
                        time: timestamp,
                        synced: metrics.replicant.objectsSynced,
                        queue: metrics.replicant.syncQueue
                    }]);
                setOperationsHistory(prev => [...prev.slice(-20), {
                        time: timestamp,
                        reads: metrics.replicant.operations.reads,
                        writes: metrics.replicant.operations.writes,
                        deletes: metrics.replicant.operations.deletes
                    }]);
                setBandwidthHistory(prev => [...prev.slice(-20), {
                        time: timestamp,
                        upload: metrics.replicant.bandwidth.upload / 1024 / 1024, // Convert to MB
                        download: metrics.replicant.bandwidth.download / 1024 / 1024
                    }]);
            }
            catch (error) {
                console.error('Failed to fetch metrics:', error);
            }
        };
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 2000);
        return () => clearInterval(interval);
    }, []);
    const formatBytes = (bytes) => {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };
    const formatUptime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };
    const pieData = [
        { name: 'Used', value: systemMetrics.memory.used },
        { name: 'Free', value: systemMetrics.memory.total - systemMetrics.memory.used }
    ];
    const COLORS = ['#3b82f6', '#e5e7eb'];
    return (react_1.default.createElement("div", { className: "w-full h-full p-4 space-y-4 overflow-auto bg-background" },
        react_1.default.createElement("div", { className: "grid grid-cols-4 gap-4" },
            react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "System Status"),
                    react_1.default.createElement(lucide_react_1.Activity, { className: "h-4 w-4 text-gray-500" })),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.status === 'running' ? (react_1.default.createElement("span", { className: "text-green-600 flex items-center gap-2" },
                        react_1.default.createElement(lucide_react_1.CheckCircle, { className: "h-6 w-6" }),
                        "Running")) : (react_1.default.createElement("span", { className: "text-red-600 flex items-center gap-2" },
                        react_1.default.createElement(lucide_react_1.XCircle, { className: "h-6 w-6" }),
                        "Stopped"))),
                    react_1.default.createElement("p", { className: "text-xs text-muted-foreground" },
                        "Uptime: ",
                        formatUptime(replicantMetrics.uptime)))),
            react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Active Connections"),
                    react_1.default.createElement(lucide_react_1.Users, { className: "h-4 w-4 text-muted-foreground" })),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.connections),
                    react_1.default.createElement("p", { className: "text-xs text-muted-foreground" }, "To other ONE instances"))),
            react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Objects Stored"),
                    react_1.default.createElement(lucide_react_1.Database, { className: "h-4 w-4 text-muted-foreground" })),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.objectsStored.toLocaleString()),
                    react_1.default.createElement("p", { className: "text-xs text-muted-foreground" },
                        replicantMetrics.syncQueue,
                        " in sync queue"))),
            react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Sync Status"),
                    react_1.default.createElement(lucide_react_1.RefreshCw, { className: "h-4 w-4 text-muted-foreground" })),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.objectsSynced.toLocaleString()),
                    react_1.default.createElement("p", { className: "text-xs text-muted-foreground" },
                        "Last: ",
                        replicantMetrics.lastSync ? (0, date_fns_1.format)(replicantMetrics.lastSync, 'HH:mm:ss') : 'Never')))),
        react_1.default.createElement("div", { className: "grid grid-cols-4 gap-4" },
            react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Response Time"),
                    react_1.default.createElement(lucide_react_1.Zap, { className: "h-4 w-4 text-muted-foreground" })),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "text-2xl font-bold" },
                        replicantMetrics.performance.avgResponseTime.toFixed(1),
                        "ms"),
                    react_1.default.createElement("p", { className: "text-xs text-muted-foreground" }, "Average response time"))),
            react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Throughput"),
                    react_1.default.createElement(lucide_react_1.Activity, { className: "h-4 w-4 text-muted-foreground" })),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.performance.requestsPerSecond.toFixed(1)),
                    react_1.default.createElement("p", { className: "text-xs text-muted-foreground" }, "Requests per second"))),
            react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Operations"),
                    react_1.default.createElement(lucide_react_1.FileText, { className: "h-4 w-4 text-muted-foreground" })),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "text-2xl font-bold" }, (replicantMetrics.operations.reads + replicantMetrics.operations.writes + replicantMetrics.operations.deletes).toLocaleString()),
                    react_1.default.createElement("p", { className: "text-xs text-muted-foreground" },
                        "R:",
                        replicantMetrics.operations.reads,
                        " W:",
                        replicantMetrics.operations.writes,
                        " D:",
                        replicantMetrics.operations.deletes))),
            react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    react_1.default.createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Bandwidth"),
                    react_1.default.createElement(lucide_react_1.Network, { className: "h-4 w-4 text-muted-foreground" })),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "text-2xl font-bold" }, formatBytes(replicantMetrics.bandwidth.upload + replicantMetrics.bandwidth.download)),
                    react_1.default.createElement("p", { className: "text-xs text-muted-foreground" },
                        "\u2191",
                        formatBytes(replicantMetrics.bandwidth.upload),
                        " \u2193",
                        formatBytes(replicantMetrics.bandwidth.download))))),
        react_1.default.createElement(tabs_1.Tabs, { defaultValue: "overview", className: "space-y-4" },
            react_1.default.createElement(tabs_1.TabsList, null,
                react_1.default.createElement(tabs_1.TabsTrigger, { value: "overview" }, "Overview"),
                react_1.default.createElement(tabs_1.TabsTrigger, { value: "performance" }, "Performance"),
                react_1.default.createElement(tabs_1.TabsTrigger, { value: "network" }, "Network"),
                react_1.default.createElement(tabs_1.TabsTrigger, { value: "logs" }, "Logs")),
            react_1.default.createElement(tabs_1.TabsContent, { value: "overview", className: "space-y-4" },
                react_1.default.createElement("div", { className: "grid grid-cols-2 gap-4" },
                    react_1.default.createElement(card_1.Card, null,
                        react_1.default.createElement(card_1.CardHeader, null,
                            react_1.default.createElement(card_1.CardTitle, null, "System Resources"),
                            react_1.default.createElement(card_1.CardDescription, null, "Current resource utilization")),
                        react_1.default.createElement(card_1.CardContent, { className: "space-y-4" },
                            react_1.default.createElement("div", { className: "space-y-2" },
                                react_1.default.createElement("div", { className: "flex items-center justify-between text-sm" },
                                    react_1.default.createElement("span", { className: "flex items-center gap-2" },
                                        react_1.default.createElement(lucide_react_1.Cpu, { className: "h-4 w-4" }),
                                        "CPU Usage"),
                                    react_1.default.createElement("span", null,
                                        systemMetrics.cpu,
                                        "%")),
                                react_1.default.createElement(progress_1.Progress, { value: systemMetrics.cpu })),
                            react_1.default.createElement("div", { className: "space-y-2" },
                                react_1.default.createElement("div", { className: "flex items-center justify-between text-sm" },
                                    react_1.default.createElement("span", { className: "flex items-center gap-2" },
                                        react_1.default.createElement(lucide_react_1.MemoryStick, { className: "h-4 w-4" }),
                                        "Memory"),
                                    react_1.default.createElement("span", null,
                                        formatBytes(systemMetrics.memory.used),
                                        " / ",
                                        formatBytes(systemMetrics.memory.total))),
                                react_1.default.createElement(progress_1.Progress, { value: systemMetrics.memory.percentage })),
                            react_1.default.createElement("div", { className: "space-y-2" },
                                react_1.default.createElement("div", { className: "flex items-center justify-between text-sm" },
                                    react_1.default.createElement("span", { className: "flex items-center gap-2" },
                                        react_1.default.createElement(lucide_react_1.HardDrive, { className: "h-4 w-4" }),
                                        "Disk Usage"),
                                    react_1.default.createElement("span", null,
                                        formatBytes(systemMetrics.disk.used),
                                        " / ",
                                        formatBytes(systemMetrics.disk.total))),
                                react_1.default.createElement(progress_1.Progress, { value: systemMetrics.disk.percentage })))),
                    react_1.default.createElement(card_1.Card, null,
                        react_1.default.createElement(card_1.CardHeader, null,
                            react_1.default.createElement(card_1.CardTitle, null, "Memory Distribution"),
                            react_1.default.createElement(card_1.CardDescription, null, "System memory allocation")),
                        react_1.default.createElement(card_1.CardContent, null,
                            react_1.default.createElement(recharts_1.ResponsiveContainer, { width: "100%", height: 200 },
                                react_1.default.createElement(recharts_1.PieChart, null,
                                    react_1.default.createElement(recharts_1.Pie, { data: pieData, cx: "50%", cy: "50%", innerRadius: 60, outerRadius: 80, paddingAngle: 5, dataKey: "value" }, pieData.map((entry, index) => (react_1.default.createElement(recharts_1.Cell, { key: `cell-${index}`, fill: COLORS[index % COLORS.length] })))),
                                    react_1.default.createElement(recharts_1.Tooltip, { formatter: (value) => formatBytes(value) })))))),
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, null,
                        react_1.default.createElement(card_1.CardTitle, null, "WSL Environment"),
                        react_1.default.createElement(card_1.CardDescription, null, "Windows Subsystem for Linux status")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement("div", { className: "grid grid-cols-4 gap-4" },
                            react_1.default.createElement("div", { className: "space-y-1" },
                                react_1.default.createElement("p", { className: "text-sm font-medium" }, "Status"),
                                react_1.default.createElement("p", { className: "text-2xl font-bold" }, wslMetrics.status === 'running' ? (react_1.default.createElement("span", { className: "text-green-600" }, "Running")) : (react_1.default.createElement("span", { className: "text-red-600" }, "Stopped")))),
                            react_1.default.createElement("div", { className: "space-y-1" },
                                react_1.default.createElement("p", { className: "text-sm font-medium" }, "Distribution"),
                                react_1.default.createElement("p", { className: "text-2xl font-bold" }, wslMetrics.distro)),
                            react_1.default.createElement("div", { className: "space-y-1" },
                                react_1.default.createElement("p", { className: "text-sm font-medium" }, "Processes"),
                                react_1.default.createElement("p", { className: "text-2xl font-bold" }, wslMetrics.processes)),
                            react_1.default.createElement("div", { className: "space-y-1" },
                                react_1.default.createElement("p", { className: "text-sm font-medium" }, "Memory Usage"),
                                react_1.default.createElement("p", { className: "text-2xl font-bold" }, formatBytes(wslMetrics.memory))))))),
            react_1.default.createElement(tabs_1.TabsContent, { value: "performance", className: "space-y-4" },
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, null,
                        react_1.default.createElement(card_1.CardTitle, null, "CPU Usage History"),
                        react_1.default.createElement(card_1.CardDescription, null, "CPU utilization over time")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement(recharts_1.ResponsiveContainer, { width: "100%", height: 300 },
                            react_1.default.createElement(recharts_1.LineChart, { data: cpuHistory },
                                react_1.default.createElement(recharts_1.CartesianGrid, { strokeDasharray: "3 3" }),
                                react_1.default.createElement(recharts_1.XAxis, { dataKey: "time" }),
                                react_1.default.createElement(recharts_1.YAxis, { domain: [0, 100] }),
                                react_1.default.createElement(recharts_1.Tooltip, null),
                                react_1.default.createElement(recharts_1.Line, { type: "monotone", dataKey: "cpu", stroke: "#3b82f6", strokeWidth: 2 }))))),
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, null,
                        react_1.default.createElement(card_1.CardTitle, null, "Sync Activity"),
                        react_1.default.createElement(card_1.CardDescription, null, "Object synchronization metrics")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement(recharts_1.ResponsiveContainer, { width: "100%", height: 300 },
                            react_1.default.createElement(recharts_1.AreaChart, { data: syncHistory },
                                react_1.default.createElement(recharts_1.CartesianGrid, { strokeDasharray: "3 3" }),
                                react_1.default.createElement(recharts_1.XAxis, { dataKey: "time" }),
                                react_1.default.createElement(recharts_1.YAxis, null),
                                react_1.default.createElement(recharts_1.Tooltip, null),
                                react_1.default.createElement(recharts_1.Area, { type: "monotone", dataKey: "synced", stackId: "1", stroke: "#10b981", fill: "#10b981" }),
                                react_1.default.createElement(recharts_1.Area, { type: "monotone", dataKey: "queue", stackId: "1", stroke: "#f59e0b", fill: "#f59e0b" }))))),
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, null,
                        react_1.default.createElement(card_1.CardTitle, null, "File Operations"),
                        react_1.default.createElement(card_1.CardDescription, null, "Read, write, and delete operations over time")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement(recharts_1.ResponsiveContainer, { width: "100%", height: 300 },
                            react_1.default.createElement(recharts_1.BarChart, { data: operationsHistory },
                                react_1.default.createElement(recharts_1.CartesianGrid, { strokeDasharray: "3 3" }),
                                react_1.default.createElement(recharts_1.XAxis, { dataKey: "time" }),
                                react_1.default.createElement(recharts_1.YAxis, null),
                                react_1.default.createElement(recharts_1.Tooltip, null),
                                react_1.default.createElement(recharts_1.Bar, { dataKey: "reads", stackId: "1", fill: "#3b82f6", name: "Reads" }),
                                react_1.default.createElement(recharts_1.Bar, { dataKey: "writes", stackId: "1", fill: "#10b981", name: "Writes" }),
                                react_1.default.createElement(recharts_1.Bar, { dataKey: "deletes", stackId: "1", fill: "#ef4444", name: "Deletes" }))))),
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, null,
                        react_1.default.createElement(card_1.CardTitle, null, "Bandwidth Usage"),
                        react_1.default.createElement(card_1.CardDescription, null, "Upload and download bandwidth consumption")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement(recharts_1.ResponsiveContainer, { width: "100%", height: 300 },
                            react_1.default.createElement(recharts_1.AreaChart, { data: bandwidthHistory },
                                react_1.default.createElement(recharts_1.CartesianGrid, { strokeDasharray: "3 3" }),
                                react_1.default.createElement(recharts_1.XAxis, { dataKey: "time" }),
                                react_1.default.createElement(recharts_1.YAxis, null),
                                react_1.default.createElement(recharts_1.Tooltip, { formatter: (value) => `${value.toFixed(2)} MB` }),
                                react_1.default.createElement(recharts_1.Area, { type: "monotone", dataKey: "upload", stackId: "1", stroke: "#3b82f6", fill: "#3b82f6", name: "Upload" }),
                                react_1.default.createElement(recharts_1.Area, { type: "monotone", dataKey: "download", stackId: "1", stroke: "#10b981", fill: "#10b981", name: "Download" })))))),
            react_1.default.createElement(tabs_1.TabsContent, { value: "network", className: "space-y-4" },
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, null,
                        react_1.default.createElement(card_1.CardTitle, null, "Network Traffic"),
                        react_1.default.createElement(card_1.CardDescription, null, "Incoming and outgoing network data")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement(recharts_1.ResponsiveContainer, { width: "100%", height: 300 },
                            react_1.default.createElement(recharts_1.LineChart, { data: networkHistory },
                                react_1.default.createElement(recharts_1.CartesianGrid, { strokeDasharray: "3 3" }),
                                react_1.default.createElement(recharts_1.XAxis, { dataKey: "time" }),
                                react_1.default.createElement(recharts_1.YAxis, null),
                                react_1.default.createElement(recharts_1.Tooltip, { formatter: (value) => `${value.toFixed(2)} KB/s` }),
                                react_1.default.createElement(recharts_1.Line, { type: "monotone", dataKey: "in", stroke: "#10b981", name: "Incoming", strokeWidth: 2 }),
                                react_1.default.createElement(recharts_1.Line, { type: "monotone", dataKey: "out", stroke: "#ef4444", name: "Outgoing", strokeWidth: 2 }))))),
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, null,
                        react_1.default.createElement(card_1.CardTitle, null, "Active Connections"),
                        react_1.default.createElement(card_1.CardDescription, null, "Connected ONE instances")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement("div", { className: "space-y-2" }, replicantMetrics.connections > 0 ? (react_1.default.createElement("div", { className: "text-sm text-muted-foreground" },
                            replicantMetrics.connections,
                            " active connection(s)")) : (react_1.default.createElement("div", { className: "text-sm text-muted-foreground" }, "No active connections")))))),
            react_1.default.createElement(tabs_1.TabsContent, { value: "logs", className: "space-y-4" },
                react_1.default.createElement(card_1.Card, null,
                    react_1.default.createElement(card_1.CardHeader, null,
                        react_1.default.createElement(card_1.CardTitle, null, "Recent Logs"),
                        react_1.default.createElement(card_1.CardDescription, null, "Latest system events and errors")),
                    react_1.default.createElement(card_1.CardContent, null,
                        react_1.default.createElement("div", { className: "space-y-2 font-mono text-sm" },
                            react_1.default.createElement("div", { className: "flex items-center gap-2 text-green-600" },
                                react_1.default.createElement(lucide_react_1.CheckCircle, { className: "h-4 w-4" }),
                                react_1.default.createElement("span", null,
                                    "[",
                                    (0, date_fns_1.format)(new Date(), 'HH:mm:ss'),
                                    "] Replicant started successfully")),
                            react_1.default.createElement("div", { className: "flex items-center gap-2 text-blue-600" },
                                react_1.default.createElement(lucide_react_1.AlertCircle, { className: "h-4 w-4" }),
                                react_1.default.createElement("span", null,
                                    "[",
                                    (0, date_fns_1.format)(new Date(), 'HH:mm:ss'),
                                    "] WSL connection established")),
                            react_1.default.createElement("div", { className: "flex items-center gap-2 text-yellow-600" },
                                react_1.default.createElement(lucide_react_1.AlertCircle, { className: "h-4 w-4" }),
                                react_1.default.createElement("span", null,
                                    "[",
                                    (0, date_fns_1.format)(new Date(), 'HH:mm:ss'),
                                    "] Sync queue processing: 5 objects")))))))));
}
//# sourceMappingURL=MonitoringDashboard.js.map