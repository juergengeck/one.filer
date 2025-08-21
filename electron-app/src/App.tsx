import React, { useState, useEffect } from 'react';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { TestRunnerSafe } from './components/TestRunnerSafe';
// import { DebugLogs } from './components/DebugLogs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { 
  Shield, 
  Settings, 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Stethoscope,
  Terminal
} from 'lucide-react';
import './globals.css';

interface AppState {
  wslStatus: {
    installed: boolean;
    running: boolean;
    distros: string[];
  };
  replicantStatus: {
    running: boolean;
    pid?: number;
  };
  isConnecting: boolean;
  error: string | null;
  success: string | null;
  mountPoint: string | null;
}

export function App() {
  const [state, setState] = useState<AppState>({
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
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    };

    updateStatus();
    // Reduce update frequency to lower CPU usage
    const interval = setInterval(updateStatus, 5000); // Changed from 2000ms to 5000ms
    return () => clearInterval(interval);
  }, []); // Remove activeTab dependency to prevent multiple intervals
  

  const handleConnect = async (e: React.FormEvent) => {
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
      } else {
        setState(prev => ({
          ...prev,
          error: result.message,
          success: null
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed',
        success: null
      }));
    } finally {
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
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to stop replicant'
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto p-4">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ONE Filer Control Center
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage your distributed storage system
          </p>
        </div>

        {/* Status Bar */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Native Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">ProjFS Ready</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Replicant Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {state.replicantStatus.running ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">
                      Running {state.replicantStatus.pid && `(PID: ${state.replicantStatus.pid})`}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-medium">Stopped</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="connect" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Connect
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Tests
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Diagnostics
            </TabsTrigger>
            <TabsTrigger value="debug" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Debug
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connect" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Connect to ONE Instance</CardTitle>
                <CardDescription>
                  Enter your secret to start the replicant service
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConnect} className="space-y-4">
                  <div>
                    <label htmlFor="secret" className="block text-sm font-medium mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="secret"
                        type={showSecret ? 'text' : 'password'}
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md pr-10"
                        placeholder="Enter your ONE instance secret"
                        required
                        disabled={state.isConnecting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                      >
                        {showSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="configPath" className="block text-sm font-medium mb-1">
                      Config Path (Optional)
                    </label>
                    <input
                      id="configPath"
                      type="text"
                      value={configPath}
                      onChange={(e) => setConfigPath(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="Leave empty for default config"
                      disabled={state.isConnecting}
                    />
                  </div>

                  {state.error && (
                    <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
                      {state.error}
                    </div>
                  )}

                  {state.success && (
                    <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
                      {state.success}
                      {state.mountPoint && (
                        <div className="mt-1">
                          Mount point: <code className="font-mono">{state.mountPoint}</code>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {state.replicantStatus.running ? (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
                      >
                        Stop Replicant
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={state.isConnecting}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {state.isConnecting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Starting Replicant...
                          </>
                        ) : (
                          'Start Replicant'
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="mt-6">
            {state.replicantStatus.running && activeTab === 'monitoring' ? (
              <MonitoringDashboard />
            ) : state.replicantStatus.running ? null : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Replicant Not Running</h3>
                    <p className="text-sm text-gray-600">
                      Start the replicant service to view monitoring data
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Configure ONE Filer behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Filesystem Mode</h3>
                    <p className="text-sm text-gray-600">
                      Native Windows (ProjFS)
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Installation Path</h3>
                    <p className="text-sm text-gray-600 font-mono">
                      C:\Program Files\ONE Filer
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Version</h3>
                    <p className="text-sm text-gray-600">1.0.0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tests" className="mt-6">
            <TestRunnerSafe />
          </TabsContent>

          <TabsContent value="diagnostics" className="mt-6">
            <DiagnosticsPanel />
          </TabsContent>


          <TabsContent value="debug" className="mt-6">
            <div className="h-[600px]">
              {/* <DebugLogs /> */}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}