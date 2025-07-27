import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Activity,
  HardDrive,
  Server,
  Settings,
  AlertTriangle
} from 'lucide-react';

interface ServiceDiagnostic {
  name: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  pid?: number;
  error?: string;
  lastCheck: string;
  config: {
    hasHealthCheck: boolean;
    hasRequiredServices: boolean;
    retryAttempts: number;
  };
}

interface Diagnostics {
  timestamp: string;
  services: Record<string, ServiceDiagnostic>;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
    chromeVersion: string;
    v8Version: string;
  };
  config: {
    wslDistro: string;
    replicantPath: string;
    startMinimized: boolean;
    showInSystemTray: boolean;
    autoConnect: boolean;
  };
  paths: {
    userData: string;
    cache: string;
    logs: string;
    temp: string;
  };
}

export function DiagnosticsPanel() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.runDiagnostics();
      setDiagnostics(result as Diagnostics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run diagnostics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'stopped':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'starting':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Diagnostics Error: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!diagnostics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading diagnostics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">System Diagnostics</h2>
        <button
          onClick={runDiagnostics}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Status
          </CardTitle>
          <CardDescription>Current status of all registered services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(diagnostics.services).map(([name, service]) => (
              <div key={name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <h4 className="font-medium capitalize">{name}</h4>
                      <p className="text-sm text-gray-600">
                        {service.status === 'running' && service.pid && `PID: ${service.pid}`}
                        {service.error && <span className="text-red-600">{service.error}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <div className="flex gap-4">
                    <span>Health Check: {service.config.hasHealthCheck ? '✓' : '✗'}</span>
                    <span>Dependencies: {service.config.hasRequiredServices ? '✓' : '✗'}</span>
                    <span>Retry Attempts: {service.config.retryAttempts}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Information
          </CardTitle>
          <CardDescription>Runtime environment details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Platform</h4>
              <div className="space-y-1 text-sm">
                <div>OS: {diagnostics.system.platform} ({diagnostics.system.arch})</div>
                <div>Node: {diagnostics.system.nodeVersion}</div>
                <div>Electron: {diagnostics.system.electronVersion}</div>
                <div>Chrome: {diagnostics.system.chromeVersion}</div>
                <div>V8: {diagnostics.system.v8Version}</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Configuration</h4>
              <div className="space-y-1 text-sm">
                <div>WSL Distro: {diagnostics.config.wslDistro}</div>
                <div>Start Minimized: {diagnostics.config.startMinimized ? 'Yes' : 'No'}</div>
                <div>System Tray: {diagnostics.config.showInSystemTray ? 'Yes' : 'No'}</div>
                <div>Auto Connect: {diagnostics.config.autoConnect ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paths */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Application Paths
          </CardTitle>
          <CardDescription>Important directory locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="font-medium">User Data:</span>
              <div className="text-gray-600 break-all">{diagnostics.paths.userData}</div>
            </div>
            <div>
              <span className="font-medium">Cache:</span>
              <div className="text-gray-600 break-all">{diagnostics.paths.cache}</div>
            </div>
            <div>
              <span className="font-medium">Logs:</span>
              <div className="text-gray-600 break-all">{diagnostics.paths.logs}</div>
            </div>
            <div>
              <span className="font-medium">Temp:</span>
              <div className="text-gray-600 break-all">{diagnostics.paths.temp}</div>
            </div>
            <div>
              <span className="font-medium">Replicant Path:</span>
              <div className="text-gray-600 break-all">{diagnostics.config.replicantPath}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timestamp */}
      <div className="text-sm text-gray-500 text-right">
        Diagnostics run at: {new Date(diagnostics.timestamp).toLocaleString()}
      </div>
    </div>
  );
}