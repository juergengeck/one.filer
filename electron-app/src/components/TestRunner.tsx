import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import type { TestSuiteResult, TestResult } from '../preload';

export function TestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestSuiteResult[]>([]);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Prevent component from unmounting
  React.useEffect(() => {
    console.log('[TestRunner UI] Component mounted');
    return () => {
      console.log('[TestRunner UI] Component unmounting - this should not happen during tests!');
    };
  }, []);

  const runAllTests = async () => {
    console.log('[TestRunner UI] Starting test execution...');
    setIsRunning(true);
    setError(null);
    setTestResults([]);
    
    try {
      const result = await window.electronAPI.runTests();
      console.log('[TestRunner UI] Test result received:', result);
      
      if (result && result.success && result.results) {
        console.log('[TestRunner UI] Setting test results:', result.results);
        setTestResults(result.results);
        // Keep the results visible
        setExpandedSuites(new Set(result.results.map(r => r.name)));
      } else {
        const errorMsg = result?.error || 'Failed to run tests';
        console.error('[TestRunner UI] Test failed:', errorMsg);
        setError(errorMsg);
        // Don't clear results on error
      }
    } catch (err) {
      console.error('[TestRunner UI] Test execution error:', err);
      setError(`Test execution error: ${err}`);
      // Don't clear results on error
    } finally {
      setIsRunning(false);
    }
  };

  const runSingleSuite = async (suiteName: string) => {
    setIsRunning(true);
    setError(null);
    setSelectedSuite(suiteName);
    
    try {
      const result = await window.electronAPI.runTestSuite(suiteName);
      
      if (result.success && result.result) {
        // Update or add the suite result
        setTestResults(prev => {
          const filtered = prev.filter(r => r.name !== suiteName);
          return [...filtered, result.result!];
        });
        setExpandedSuites(prev => new Set([...prev, suiteName]));
      } else {
        setError(result.error || `Failed to run suite: ${suiteName}`);
      }
    } catch (err) {
      setError(`Test execution error: ${err}`);
    } finally {
      setIsRunning(false);
      setSelectedSuite(null);
    }
  };

  const toggleSuite = (suiteName: string) => {
    setExpandedSuites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suiteName)) {
        newSet.delete(suiteName);
      } else {
        newSet.add(suiteName);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'skip') => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skip':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getSuiteStatus = (suite: TestSuiteResult) => {
    if (suite.failed > 0) return 'fail';
    if (suite.skipped > 0 && suite.passed === 0) return 'skip';
    return 'pass';
  };

  const getTotalStats = () => {
    const total = testResults.reduce((acc, suite) => ({
      passed: acc.passed + suite.passed,
      failed: acc.failed + suite.failed,
      skipped: acc.skipped + suite.skipped,
      duration: acc.duration + suite.duration
    }), { passed: 0, failed: 0, skipped: 0, duration: 0 });
    
    return total;
  };

  const copyTestResults = () => {
    const results = testResults.map(suite => {
      const header = `${suite.name}\n${suite.passed}/${suite.tests.length} passed\n`;
      const tests = suite.tests.map(test => 
        `  ${test.status === 'pass' ? '✓' : test.status === 'fail' ? '✗' : '○'} ${test.test}${test.error ? '\n    Error: ' + test.error : ''}`
      ).join('\n');
      return header + tests;
    }).join('\n\n');
    
    const summary = `\nTest Summary:\n${getTotalStats().passed} passed, ${getTotalStats().failed} failed, ${getTotalStats().skipped} skipped\n`;
    
    navigator.clipboard.writeText(results + summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Test Runner</span>
            <div className="flex gap-2">
              {testResults.length > 0 && (
                <button
                  onClick={copyTestResults}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Results
                    </>
                  )}
                </button>
              )}
              <button
                onClick={runAllTests}
                disabled={isRunning}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run All Tests
                  </>
                )}
              </button>
            </div>
          </CardTitle>
          <CardDescription>
            Execute unit, integration, and end-to-end tests
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}
          
          {testResults && testResults.length > 0 && (
            <div className="space-y-4">
              {/* Overall Statistics */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {getTotalStats().passed}
                  </div>
                  <div className="text-sm text-gray-600">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {getTotalStats().failed}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {getTotalStats().skipped}
                  </div>
                  <div className="text-sm text-gray-600">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {(getTotalStats().duration / 1000).toFixed(2)}s
                  </div>
                  <div className="text-sm text-gray-600">Duration</div>
                </div>
              </div>
              
              {/* Test Suites */}
              <div className="space-y-2">
                {testResults && Array.isArray(testResults) && testResults.map((suite) => (
                  <div key={suite.name} className="border rounded">
                    <div 
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleSuite(suite.name)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedSuites.has(suite.name) ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                        {getStatusIcon(getSuiteStatus(suite))}
                        <span className="font-medium">{suite.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-600">{suite.passed}</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-red-600">{suite.failed}</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-yellow-600">{suite.skipped}</span>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            runSingleSuite(suite.name);
                          }}
                          disabled={isRunning}
                          className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          {isRunning && selectedSuite === suite.name ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    {expandedSuites.has(suite.name) && suite.tests && Array.isArray(suite.tests) && (
                      <div className="border-t">
                        {suite.tests.map((test, idx) => (
                          <div 
                            key={idx} 
                            className="px-6 py-2 flex items-center justify-between hover:bg-gray-50 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {getStatusIcon(test.status)}
                              <span>{test.test}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {test.duration && (
                                <span className="text-gray-500">
                                  {test.duration}ms
                                </span>
                              )}
                              {test.error && (
                                <span className="text-red-500 text-xs max-w-xs truncate">
                                  {test.error}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!isRunning && testResults.length === 0 && !error && (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3" />
              <p>No test results yet</p>
              <p className="text-sm mt-1">Click "Run All Tests" to start</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Quick Test Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Tests</CardTitle>
          <CardDescription>Run individual test suites</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => runSingleSuite('Cache System')}
              disabled={isRunning}
              className="p-3 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <div className="font-medium">Cache System</div>
              <div className="text-sm text-gray-500">Unit tests</div>
            </button>
            
            <button
              onClick={() => runSingleSuite('Application Layer')}
              disabled={isRunning}
              className="p-3 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <div className="font-medium">Application</div>
              <div className="text-sm text-gray-500">IPC & UI tests</div>
            </button>
            
            <button
              onClick={() => runSingleSuite('End-to-End')}
              disabled={isRunning}
              className="p-3 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <div className="font-medium">End-to-End</div>
              <div className="text-sm text-gray-500">Full stack tests</div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}