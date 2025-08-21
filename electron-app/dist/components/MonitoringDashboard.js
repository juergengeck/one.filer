import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, Cpu, HardDrive, Network, MemoryStick, CheckCircle, XCircle, AlertCircle, RefreshCw, Zap, Database, FileText, Users } from 'lucide-react';
import { format } from 'date-fns';
export const MonitoringDashboard = React.memo(function MonitoringDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [systemMetrics, setSystemMetrics] = useState({
        cpu: 0,
        memory: { used: 0, total: 0, percentage: 0 },
        disk: { used: 0, total: 0, percentage: 0 },
        network: { bytesIn: 0, bytesOut: 0 }
    });
    const [replicantMetrics, setReplicantMetrics] = useState({
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
    const [wslMetrics, setWSLMetrics] = useState({
        status: 'stopped',
        distro: 'Debian',
        version: '12',
        memory: 0,
        processes: 0
    });
    const [cpuHistory, setCpuHistory] = useState([]);
    const [networkHistory, setNetworkHistory] = useState([]);
    const [syncHistory, setSyncHistory] = useState([]);
    const [operationsHistory, setOperationsHistory] = useState([]);
    const [bandwidthHistory, setBandwidthHistory] = useState([]);
    // Fetch metrics from electron IPC
    useEffect(() => {
        const fetchMetrics = async () => {
            // Only fetch metrics if component is actually visible
            if (document.hidden)
                return;
            try {
                const metrics = await window.electronAPI.getSystemMetrics();
                if (metrics.system)
                    setSystemMetrics(metrics.system);
                if (metrics.replicant)
                    setReplicantMetrics(metrics.replicant);
                if (metrics.wsl)
                    setWSLMetrics(metrics.wsl);
                // Update history data
                const timestamp = format(new Date(), 'HH:mm:ss');
                // Optimize array updates to prevent memory leaks
                setCpuHistory(prev => {
                    const newEntry = { time: timestamp, cpu: metrics.system.cpu };
                    return prev.length >= 20 ? [...prev.slice(1), newEntry] : [...prev, newEntry];
                });
                setNetworkHistory(prev => {
                    const newEntry = {
                        time: timestamp,
                        in: metrics.system.network.bytesIn / 1024,
                        out: metrics.system.network.bytesOut / 1024
                    };
                    return prev.length >= 20 ? [...prev.slice(1), newEntry] : [...prev, newEntry];
                });
                setSyncHistory(prev => {
                    const newEntry = {
                        time: timestamp,
                        synced: metrics.replicant.objectsSynced,
                        queue: metrics.replicant.syncQueue
                    };
                    return prev.length >= 20 ? [...prev.slice(1), newEntry] : [...prev, newEntry];
                });
                setOperationsHistory(prev => {
                    const newEntry = {
                        time: timestamp,
                        reads: metrics.replicant.operations.reads,
                        writes: metrics.replicant.operations.writes,
                        deletes: metrics.replicant.operations.deletes
                    };
                    return prev.length >= 20 ? [...prev.slice(1), newEntry] : [...prev, newEntry];
                });
                setBandwidthHistory(prev => {
                    const newEntry = {
                        time: timestamp,
                        upload: metrics.replicant.bandwidth.upload / 1024 / 1024, // Convert to MB
                        download: metrics.replicant.bandwidth.download / 1024 / 1024
                    };
                    return prev.length >= 20 ? [...prev.slice(1), newEntry] : [...prev, newEntry];
                });
            }
            catch (error) {
                console.error('Failed to fetch metrics:', error);
            }
        };
        fetchMetrics();
        // Only update when component is visible
        const interval = setInterval(() => {
            // Check if document is visible to avoid updating when minimized
            if (document.visibilityState === 'visible') {
                fetchMetrics();
            }
        }, 15000); // Increased to 15 seconds
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
    return (React.createElement("div", { className: "w-full h-full p-4 space-y-4 overflow-auto bg-background" },
        React.createElement("div", { className: "grid grid-cols-4 gap-4" },
            React.createElement(Card, null,
                React.createElement(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    React.createElement(CardTitle, { className: "text-sm font-medium" }, "System Status"),
                    React.createElement(Activity, { className: "h-4 w-4 text-gray-500" })),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.status === 'running' ? (React.createElement("span", { className: "text-green-600 flex items-center gap-2" },
                        React.createElement(CheckCircle, { className: "h-6 w-6" }),
                        "Running")) : (React.createElement("span", { className: "text-red-600 flex items-center gap-2" },
                        React.createElement(XCircle, { className: "h-6 w-6" }),
                        "Stopped"))),
                    React.createElement("p", { className: "text-xs text-muted-foreground" },
                        "Uptime: ",
                        formatUptime(replicantMetrics.uptime)))),
            React.createElement(Card, null,
                React.createElement(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    React.createElement(CardTitle, { className: "text-sm font-medium" }, "Active Connections"),
                    React.createElement(Users, { className: "h-4 w-4 text-muted-foreground" })),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.connections),
                    React.createElement("p", { className: "text-xs text-muted-foreground" }, "To other ONE instances"))),
            React.createElement(Card, null,
                React.createElement(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    React.createElement(CardTitle, { className: "text-sm font-medium" }, "Objects Stored"),
                    React.createElement(Database, { className: "h-4 w-4 text-muted-foreground" })),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.objectsStored.toLocaleString()),
                    React.createElement("p", { className: "text-xs text-muted-foreground" },
                        replicantMetrics.syncQueue,
                        " in sync queue"))),
            React.createElement(Card, null,
                React.createElement(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    React.createElement(CardTitle, { className: "text-sm font-medium" }, "Sync Status"),
                    React.createElement(RefreshCw, { className: "h-4 w-4 text-muted-foreground" })),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.objectsSynced.toLocaleString()),
                    React.createElement("p", { className: "text-xs text-muted-foreground" },
                        "Last: ",
                        replicantMetrics.lastSync ? format(replicantMetrics.lastSync, 'HH:mm:ss') : 'Never')))),
        React.createElement("div", { className: "grid grid-cols-4 gap-4" },
            React.createElement(Card, null,
                React.createElement(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    React.createElement(CardTitle, { className: "text-sm font-medium" }, "Response Time"),
                    React.createElement(Zap, { className: "h-4 w-4 text-muted-foreground" })),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-2xl font-bold" },
                        replicantMetrics.performance.avgResponseTime.toFixed(1),
                        "ms"),
                    React.createElement("p", { className: "text-xs text-muted-foreground" }, "Average response time"))),
            React.createElement(Card, null,
                React.createElement(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    React.createElement(CardTitle, { className: "text-sm font-medium" }, "Throughput"),
                    React.createElement(Activity, { className: "h-4 w-4 text-muted-foreground" })),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-2xl font-bold" }, replicantMetrics.performance.requestsPerSecond.toFixed(1)),
                    React.createElement("p", { className: "text-xs text-muted-foreground" }, "Requests per second"))),
            React.createElement(Card, null,
                React.createElement(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    React.createElement(CardTitle, { className: "text-sm font-medium" }, "Operations"),
                    React.createElement(FileText, { className: "h-4 w-4 text-muted-foreground" })),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-2xl font-bold" }, (replicantMetrics.operations.reads + replicantMetrics.operations.writes + replicantMetrics.operations.deletes).toLocaleString()),
                    React.createElement("p", { className: "text-xs text-muted-foreground" },
                        "R:",
                        replicantMetrics.operations.reads,
                        " W:",
                        replicantMetrics.operations.writes,
                        " D:",
                        replicantMetrics.operations.deletes))),
            React.createElement(Card, null,
                React.createElement(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                    React.createElement(CardTitle, { className: "text-sm font-medium" }, "Bandwidth"),
                    React.createElement(Network, { className: "h-4 w-4 text-muted-foreground" })),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-2xl font-bold" }, formatBytes(replicantMetrics.bandwidth.upload + replicantMetrics.bandwidth.download)),
                    React.createElement("p", { className: "text-xs text-muted-foreground" },
                        "\u2191",
                        formatBytes(replicantMetrics.bandwidth.upload),
                        " \u2193",
                        formatBytes(replicantMetrics.bandwidth.download))))),
        React.createElement(Tabs, { defaultValue: "overview", value: activeTab, onValueChange: setActiveTab, className: "space-y-4" },
            React.createElement(TabsList, null,
                React.createElement(TabsTrigger, { value: "overview" }, "Overview"),
                React.createElement(TabsTrigger, { value: "performance" }, "Performance"),
                React.createElement(TabsTrigger, { value: "network" }, "Network"),
                React.createElement(TabsTrigger, { value: "logs" }, "Logs")),
            React.createElement(TabsContent, { value: "overview", className: "space-y-4" },
                React.createElement("div", { className: "grid grid-cols-2 gap-4" },
                    React.createElement(Card, null,
                        React.createElement(CardHeader, null,
                            React.createElement(CardTitle, null, "System Resources"),
                            React.createElement(CardDescription, null, "Current resource utilization")),
                        React.createElement(CardContent, { className: "space-y-4" },
                            React.createElement("div", { className: "space-y-2" },
                                React.createElement("div", { className: "flex items-center justify-between text-sm" },
                                    React.createElement("span", { className: "flex items-center gap-2" },
                                        React.createElement(Cpu, { className: "h-4 w-4" }),
                                        "CPU Usage"),
                                    React.createElement("span", null,
                                        systemMetrics.cpu,
                                        "%")),
                                React.createElement(Progress, { value: systemMetrics.cpu })),
                            React.createElement("div", { className: "space-y-2" },
                                React.createElement("div", { className: "flex items-center justify-between text-sm" },
                                    React.createElement("span", { className: "flex items-center gap-2" },
                                        React.createElement(MemoryStick, { className: "h-4 w-4" }),
                                        "Memory"),
                                    React.createElement("span", null,
                                        formatBytes(systemMetrics.memory.used),
                                        " / ",
                                        formatBytes(systemMetrics.memory.total))),
                                React.createElement(Progress, { value: systemMetrics.memory.percentage })),
                            React.createElement("div", { className: "space-y-2" },
                                React.createElement("div", { className: "flex items-center justify-between text-sm" },
                                    React.createElement("span", { className: "flex items-center gap-2" },
                                        React.createElement(HardDrive, { className: "h-4 w-4" }),
                                        "Disk Usage"),
                                    React.createElement("span", null,
                                        formatBytes(systemMetrics.disk.used),
                                        " / ",
                                        formatBytes(systemMetrics.disk.total))),
                                React.createElement(Progress, { value: systemMetrics.disk.percentage })))),
                    React.createElement(Card, null,
                        React.createElement(CardHeader, null,
                            React.createElement(CardTitle, null, "Memory Distribution"),
                            React.createElement(CardDescription, null, "System memory allocation")),
                        React.createElement(CardContent, null,
                            React.createElement(ResponsiveContainer, { width: "100%", height: 200 },
                                React.createElement(PieChart, null,
                                    React.createElement(Pie, { data: pieData, cx: "50%", cy: "50%", innerRadius: 60, outerRadius: 80, paddingAngle: 5, dataKey: "value" }, pieData.map((entry, index) => (React.createElement(Cell, { key: `cell-${index}`, fill: COLORS[index % COLORS.length] })))),
                                    React.createElement(Tooltip, { formatter: (value) => formatBytes(value) })))))),
                React.createElement(Card, null,
                    React.createElement(CardHeader, null,
                        React.createElement(CardTitle, null, "ProjFS Environment"),
                        React.createElement(CardDescription, null, "Windows Projected File System status")),
                    React.createElement(CardContent, null,
                        React.createElement("div", { className: "grid grid-cols-4 gap-4" },
                            React.createElement("div", { className: "space-y-1" },
                                React.createElement("p", { className: "text-sm font-medium" }, "Status"),
                                React.createElement("p", { className: "text-2xl font-bold" },
                                    React.createElement("span", { className: "text-green-600" }, "Active"))),
                            React.createElement("div", { className: "space-y-1" },
                                React.createElement("p", { className: "text-sm font-medium" }, "Mount Point"),
                                React.createElement("p", { className: "text-2xl font-bold" }, "C:\\OneFiler")),
                            React.createElement("div", { className: "space-y-1" },
                                React.createElement("p", { className: "text-sm font-medium" }, "Provider"),
                                React.createElement("p", { className: "text-2xl font-bold" }, "one.ifsprojfs")),
                            React.createElement("div", { className: "space-y-1" },
                                React.createElement("p", { className: "text-sm font-medium" }, "Architecture"),
                                React.createElement("p", { className: "text-2xl font-bold" }, "2-Layer")))))),
            React.createElement(TabsContent, { value: "performance", className: "space-y-4" }, activeTab === 'performance' && (React.createElement(React.Fragment, null,
                React.createElement(Card, null,
                    React.createElement(CardHeader, null,
                        React.createElement(CardTitle, null, "CPU Usage History"),
                        React.createElement(CardDescription, null, "CPU utilization over time")),
                    React.createElement(CardContent, null,
                        React.createElement(ResponsiveContainer, { width: "100%", height: 300 },
                            React.createElement(LineChart, { data: cpuHistory },
                                React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                                React.createElement(XAxis, { dataKey: "time" }),
                                React.createElement(YAxis, { domain: [0, 100] }),
                                React.createElement(Tooltip, null),
                                React.createElement(Line, { type: "monotone", dataKey: "cpu", stroke: "#3b82f6", strokeWidth: 2, isAnimationActive: false }))))),
                React.createElement(Card, null,
                    React.createElement(CardHeader, null,
                        React.createElement(CardTitle, null, "Sync Activity"),
                        React.createElement(CardDescription, null, "Object synchronization metrics")),
                    React.createElement(CardContent, null,
                        React.createElement(ResponsiveContainer, { width: "100%", height: 300 },
                            React.createElement(AreaChart, { data: syncHistory },
                                React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                                React.createElement(XAxis, { dataKey: "time" }),
                                React.createElement(YAxis, null),
                                React.createElement(Tooltip, null),
                                React.createElement(Area, { type: "monotone", dataKey: "synced", stackId: "1", stroke: "#10b981", fill: "#10b981", isAnimationActive: false }),
                                React.createElement(Area, { type: "monotone", dataKey: "queue", stackId: "1", stroke: "#f59e0b", fill: "#f59e0b", isAnimationActive: false }))))),
                React.createElement(Card, null,
                    React.createElement(CardHeader, null,
                        React.createElement(CardTitle, null, "File Operations"),
                        React.createElement(CardDescription, null, "Read, write, and delete operations over time")),
                    React.createElement(CardContent, null,
                        React.createElement(ResponsiveContainer, { width: "100%", height: 300 },
                            React.createElement(BarChart, { data: operationsHistory },
                                React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                                React.createElement(XAxis, { dataKey: "time" }),
                                React.createElement(YAxis, null),
                                React.createElement(Tooltip, null),
                                React.createElement(Bar, { dataKey: "reads", stackId: "1", fill: "#3b82f6", name: "Reads" }),
                                React.createElement(Bar, { dataKey: "writes", stackId: "1", fill: "#10b981", name: "Writes" }),
                                React.createElement(Bar, { dataKey: "deletes", stackId: "1", fill: "#ef4444", name: "Deletes" }))))),
                React.createElement(Card, null,
                    React.createElement(CardHeader, null,
                        React.createElement(CardTitle, null, "Bandwidth Usage"),
                        React.createElement(CardDescription, null, "Upload and download bandwidth consumption")),
                    React.createElement(CardContent, null,
                        React.createElement(ResponsiveContainer, { width: "100%", height: 300 },
                            React.createElement(AreaChart, { data: bandwidthHistory },
                                React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                                React.createElement(XAxis, { dataKey: "time" }),
                                React.createElement(YAxis, null),
                                React.createElement(Tooltip, { formatter: (value) => `${value.toFixed(2)} MB` }),
                                React.createElement(Area, { type: "monotone", dataKey: "upload", stackId: "1", stroke: "#3b82f6", fill: "#3b82f6", name: "Upload", isAnimationActive: false }),
                                React.createElement(Area, { type: "monotone", dataKey: "download", stackId: "1", stroke: "#10b981", fill: "#10b981", name: "Download", isAnimationActive: false })))))))),
            React.createElement(TabsContent, { value: "network", className: "space-y-4" }, activeTab === 'network' && (React.createElement(React.Fragment, null,
                React.createElement(Card, null,
                    React.createElement(CardHeader, null,
                        React.createElement(CardTitle, null, "Network Traffic"),
                        React.createElement(CardDescription, null, "Incoming and outgoing network data")),
                    React.createElement(CardContent, null,
                        React.createElement(ResponsiveContainer, { width: "100%", height: 300 },
                            React.createElement(LineChart, { data: networkHistory },
                                React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                                React.createElement(XAxis, { dataKey: "time" }),
                                React.createElement(YAxis, null),
                                React.createElement(Tooltip, { formatter: (value) => `${value.toFixed(2)} KB/s` }),
                                React.createElement(Line, { type: "monotone", dataKey: "in", stroke: "#10b981", name: "Incoming", strokeWidth: 2, isAnimationActive: false }),
                                React.createElement(Line, { type: "monotone", dataKey: "out", stroke: "#ef4444", name: "Outgoing", strokeWidth: 2, isAnimationActive: false }))))),
                React.createElement(Card, null,
                    React.createElement(CardHeader, null,
                        React.createElement(CardTitle, null, "Active Connections"),
                        React.createElement(CardDescription, null, "Connected ONE instances")),
                    React.createElement(CardContent, null,
                        React.createElement("div", { className: "space-y-2" }, replicantMetrics.connections > 0 ? (React.createElement("div", { className: "text-sm text-muted-foreground" },
                            replicantMetrics.connections,
                            " active connection(s)")) : (React.createElement("div", { className: "text-sm text-muted-foreground" }, "No active connections")))))))),
            React.createElement(TabsContent, { value: "logs", className: "space-y-4" },
                React.createElement(Card, null,
                    React.createElement(CardHeader, null,
                        React.createElement(CardTitle, null, "Recent Logs"),
                        React.createElement(CardDescription, null, "Latest system events and errors")),
                    React.createElement(CardContent, null,
                        React.createElement("div", { className: "space-y-2 font-mono text-sm" },
                            React.createElement("div", { className: "flex items-center gap-2 text-green-600" },
                                React.createElement(CheckCircle, { className: "h-4 w-4" }),
                                React.createElement("span", null,
                                    "[",
                                    format(new Date(), 'HH:mm:ss'),
                                    "] Replicant started successfully")),
                            React.createElement("div", { className: "flex items-center gap-2 text-blue-600" },
                                React.createElement(AlertCircle, { className: "h-4 w-4" }),
                                React.createElement("span", null,
                                    "[",
                                    format(new Date(), 'HH:mm:ss'),
                                    "] WSL connection established")),
                            React.createElement("div", { className: "flex items-center gap-2 text-yellow-600" },
                                React.createElement(AlertCircle, { className: "h-4 w-4" }),
                                React.createElement("span", null,
                                    "[",
                                    format(new Date(), 'HH:mm:ss'),
                                    "] Sync queue processing: 5 objects")))))))));
});
//# sourceMappingURL=MonitoringDashboard.js.map