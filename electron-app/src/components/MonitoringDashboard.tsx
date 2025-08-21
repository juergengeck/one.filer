import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  MemoryStick,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Database,
  FileText,
  Users
} from 'lucide-react';
import { format } from 'date-fns';

interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

interface ReplicantMetrics {
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  connections: number;
  objectsStored: number;
  objectsSynced: number;
  syncQueue: number;
  errors: number;
  lastSync: Date | null;
  bandwidth: {
    upload: number;
    download: number;
  };
  operations: {
    reads: number;
    writes: number;
    deletes: number;
  };
  performance: {
    avgResponseTime: number;
    requestsPerSecond: number;
  };
}

interface WSLMetrics {
  status: 'running' | 'stopped';
  distro: string;
  version: string;
  memory: number;
  processes: number;
}

export const MonitoringDashboard = React.memo(function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: { used: 0, total: 0, percentage: 0 },
    disk: { used: 0, total: 0, percentage: 0 },
    network: { bytesIn: 0, bytesOut: 0 }
  });

  const [replicantMetrics, setReplicantMetrics] = useState<ReplicantMetrics>({
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

  const [wslMetrics, setWSLMetrics] = useState<WSLMetrics>({
    status: 'stopped',
    distro: 'Debian',
    version: '12',
    memory: 0,
    processes: 0
  });

  const [cpuHistory, setCpuHistory] = useState<any[]>([]);
  const [networkHistory, setNetworkHistory] = useState<any[]>([]);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [operationsHistory, setOperationsHistory] = useState<any[]>([]);
  const [bandwidthHistory, setBandwidthHistory] = useState<any[]>([]);

  // Fetch metrics from electron IPC
  useEffect(() => {
    const fetchMetrics = async () => {
      // Only fetch metrics if component is actually visible
      if (document.hidden) return;
      
      try {
        const metrics = await window.electronAPI.getSystemMetrics();
        if (metrics.system) setSystemMetrics(metrics.system);
        if (metrics.replicant) setReplicantMetrics(metrics.replicant);
        if (metrics.wsl) setWSLMetrics(metrics.wsl);

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
      } catch (error) {
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const pieData = [
    { name: 'Used', value: systemMetrics.memory.used },
    { name: 'Free', value: systemMetrics.memory.total - systemMetrics.memory.used }
  ];

  const COLORS = ['#3b82f6', '#e5e7eb'];

  return (
    <div className="w-full h-full p-4 space-y-4 overflow-auto bg-background">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {replicantMetrics.status === 'running' ? (
                <span className="text-green-600 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6" />
                  Running
                </span>
              ) : (
                <span className="text-red-600 flex items-center gap-2">
                  <XCircle className="h-6 w-6" />
                  Stopped
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Uptime: {formatUptime(replicantMetrics.uptime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replicantMetrics.connections}</div>
            <p className="text-xs text-muted-foreground">
              To other ONE instances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Objects Stored</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replicantMetrics.objectsStored.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {replicantMetrics.syncQueue} in sync queue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replicantMetrics.objectsSynced.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last: {replicantMetrics.lastSync ? format(replicantMetrics.lastSync, 'HH:mm:ss') : 'Never'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replicantMetrics.performance.avgResponseTime.toFixed(1)}ms</div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replicantMetrics.performance.requestsPerSecond.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Requests per second
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(replicantMetrics.operations.reads + replicantMetrics.operations.writes + replicantMetrics.operations.deletes).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              R:{replicantMetrics.operations.reads} W:{replicantMetrics.operations.writes} D:{replicantMetrics.operations.deletes}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(replicantMetrics.bandwidth.upload + replicantMetrics.bandwidth.download)}
            </div>
            <p className="text-xs text-muted-foreground">
              ↑{formatBytes(replicantMetrics.bandwidth.upload)} ↓{formatBytes(replicantMetrics.bandwidth.download)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
                <CardDescription>Current resource utilization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      CPU Usage
                    </span>
                    <span>{systemMetrics.cpu}%</span>
                  </div>
                  <Progress value={systemMetrics.cpu} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <MemoryStick className="h-4 w-4" />
                      Memory
                    </span>
                    <span>{formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}</span>
                  </div>
                  <Progress value={systemMetrics.memory.percentage} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      Disk Usage
                    </span>
                    <span>{formatBytes(systemMetrics.disk.used)} / {formatBytes(systemMetrics.disk.total)}</span>
                  </div>
                  <Progress value={systemMetrics.disk.percentage} />
                </div>
              </CardContent>
            </Card>

            {/* Memory Usage Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Memory Distribution</CardTitle>
                <CardDescription>System memory allocation</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatBytes(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* ProjFS Status */}
          <Card>
            <CardHeader>
              <CardTitle>ProjFS Environment</CardTitle>
              <CardDescription>Windows Projected File System status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-2xl font-bold">
                    <span className="text-green-600">Active</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Mount Point</p>
                  <p className="text-2xl font-bold">C:\OneFiler</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Provider</p>
                  <p className="text-2xl font-bold">one.ifsprojfs</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Architecture</p>
                  <p className="text-2xl font-bold">2-Layer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* Only render charts when tab is active to prevent resource consumption */}
          {activeTab === 'performance' && (
          <>
          {/* CPU History Chart */}
          <Card>
            <CardHeader>
              <CardTitle>CPU Usage History</CardTitle>
              <CardDescription>CPU utilization over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cpuHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sync Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Activity</CardTitle>
              <CardDescription>Object synchronization metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={syncHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="synced" stackId="1" stroke="#10b981" fill="#10b981" isAnimationActive={false} />
                  <Area type="monotone" dataKey="queue" stackId="1" stroke="#f59e0b" fill="#f59e0b" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Operations History Chart */}
          <Card>
            <CardHeader>
              <CardTitle>File Operations</CardTitle>
              <CardDescription>Read, write, and delete operations over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={operationsHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="reads" stackId="1" fill="#3b82f6" name="Reads" />
                  <Bar dataKey="writes" stackId="1" fill="#10b981" name="Writes" />
                  <Bar dataKey="deletes" stackId="1" fill="#ef4444" name="Deletes" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bandwidth Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Bandwidth Usage</CardTitle>
              <CardDescription>Upload and download bandwidth consumption</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={bandwidthHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `${value.toFixed(2)} MB`} />
                  <Area type="monotone" dataKey="upload" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Upload" isAnimationActive={false} />
                  <Area type="monotone" dataKey="download" stackId="1" stroke="#10b981" fill="#10b981" name="Download" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          </>
          )}
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          {activeTab === 'network' && (
          <>
          {/* Network Traffic Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Network Traffic</CardTitle>
              <CardDescription>Incoming and outgoing network data</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={networkHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `${value.toFixed(2)} KB/s`} />
                  <Line type="monotone" dataKey="in" stroke="#10b981" name="Incoming" strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="out" stroke="#ef4444" name="Outgoing" strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Connection Details */}
          <Card>
            <CardHeader>
              <CardTitle>Active Connections</CardTitle>
              <CardDescription>Connected ONE instances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {replicantMetrics.connections > 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {replicantMetrics.connections} active connection(s)
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No active connections
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
              <CardDescription>Latest system events and errors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>[{format(new Date(), 'HH:mm:ss')}] Replicant started successfully</span>
                </div>
                <div className="flex items-center gap-2 text-blue-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>[{format(new Date(), 'HH:mm:ss')}] WSL connection established</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>[{format(new Date(), 'HH:mm:ss')}] Sync queue processing: 5 objects</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});