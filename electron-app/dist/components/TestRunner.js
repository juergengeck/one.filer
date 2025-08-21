import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Play, CheckCircle, XCircle, Clock, Loader2, ChevronRight, ChevronDown, AlertCircle, Copy, Check } from 'lucide-react';
export function TestRunner() {
    const [isRunning, setIsRunning] = useState(false);
    const [testResults, setTestResults] = useState([]);
    const [expandedSuites, setExpandedSuites] = useState(new Set());
    const [error, setError] = useState(null);
    const [selectedSuite, setSelectedSuite] = useState(null);
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
            }
            else {
                const errorMsg = result?.error || 'Failed to run tests';
                console.error('[TestRunner UI] Test failed:', errorMsg);
                setError(errorMsg);
                // Don't clear results on error
            }
        }
        catch (err) {
            console.error('[TestRunner UI] Test execution error:', err);
            setError(`Test execution error: ${err}`);
            // Don't clear results on error
        }
        finally {
            setIsRunning(false);
        }
    };
    const runSingleSuite = async (suiteName) => {
        setIsRunning(true);
        setError(null);
        setSelectedSuite(suiteName);
        try {
            const result = await window.electronAPI.runTestSuite(suiteName);
            if (result.success && result.result) {
                // Update or add the suite result
                setTestResults(prev => {
                    const filtered = prev.filter(r => r.name !== suiteName);
                    return [...filtered, result.result];
                });
                setExpandedSuites(prev => new Set([...prev, suiteName]));
            }
            else {
                setError(result.error || `Failed to run suite: ${suiteName}`);
            }
        }
        catch (err) {
            setError(`Test execution error: ${err}`);
        }
        finally {
            setIsRunning(false);
            setSelectedSuite(null);
        }
    };
    const toggleSuite = (suiteName) => {
        setExpandedSuites(prev => {
            const newSet = new Set(prev);
            if (newSet.has(suiteName)) {
                newSet.delete(suiteName);
            }
            else {
                newSet.add(suiteName);
            }
            return newSet;
        });
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'pass':
                return React.createElement(CheckCircle, { className: "w-4 h-4 text-green-500" });
            case 'fail':
                return React.createElement(XCircle, { className: "w-4 h-4 text-red-500" });
            case 'skip':
                return React.createElement(AlertCircle, { className: "w-4 h-4 text-yellow-500" });
        }
    };
    const getSuiteStatus = (suite) => {
        if (suite.failed > 0)
            return 'fail';
        if (suite.skipped > 0 && suite.passed === 0)
            return 'skip';
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
            const tests = suite.tests.map(test => `  ${test.status === 'pass' ? '✓' : test.status === 'fail' ? '✗' : '○'} ${test.test}${test.error ? '\n    Error: ' + test.error : ''}`).join('\n');
            return header + tests;
        }).join('\n\n');
        const summary = `\nTest Summary:\n${getTotalStats().passed} passed, ${getTotalStats().failed} failed, ${getTotalStats().skipped} skipped\n`;
        navigator.clipboard.writeText(results + summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (React.createElement("div", { className: "p-6 space-y-6" },
        React.createElement(Card, null,
            React.createElement(CardHeader, null,
                React.createElement(CardTitle, { className: "flex items-center justify-between" },
                    React.createElement("span", null, "Test Runner"),
                    React.createElement("div", { className: "flex gap-2" },
                        testResults.length > 0 && (React.createElement("button", { onClick: copyTestResults, className: "px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-2" }, copied ? (React.createElement(React.Fragment, null,
                            React.createElement(Check, { className: "w-4 h-4" }),
                            "Copied!")) : (React.createElement(React.Fragment, null,
                            React.createElement(Copy, { className: "w-4 h-4" }),
                            "Copy Results")))),
                        React.createElement("button", { onClick: runAllTests, disabled: isRunning, className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" }, isRunning ? (React.createElement(React.Fragment, null,
                            React.createElement(Loader2, { className: "w-4 h-4 animate-spin" }),
                            "Running...")) : (React.createElement(React.Fragment, null,
                            React.createElement(Play, { className: "w-4 h-4" }),
                            "Run All Tests"))))),
                React.createElement(CardDescription, null, "Execute unit, integration, and end-to-end tests")),
            React.createElement(CardContent, null,
                error && (React.createElement("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700" }, error)),
                testResults && testResults.length > 0 && (React.createElement("div", { className: "space-y-4" },
                    React.createElement("div", { className: "grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded" },
                        React.createElement("div", { className: "text-center" },
                            React.createElement("div", { className: "text-2xl font-bold text-green-600" }, getTotalStats().passed),
                            React.createElement("div", { className: "text-sm text-gray-600" }, "Passed")),
                        React.createElement("div", { className: "text-center" },
                            React.createElement("div", { className: "text-2xl font-bold text-red-600" }, getTotalStats().failed),
                            React.createElement("div", { className: "text-sm text-gray-600" }, "Failed")),
                        React.createElement("div", { className: "text-center" },
                            React.createElement("div", { className: "text-2xl font-bold text-yellow-600" }, getTotalStats().skipped),
                            React.createElement("div", { className: "text-sm text-gray-600" }, "Skipped")),
                        React.createElement("div", { className: "text-center" },
                            React.createElement("div", { className: "text-2xl font-bold text-blue-600" },
                                (getTotalStats().duration / 1000).toFixed(2),
                                "s"),
                            React.createElement("div", { className: "text-sm text-gray-600" }, "Duration"))),
                    React.createElement("div", { className: "space-y-2" }, testResults && Array.isArray(testResults) && testResults.map((suite) => (React.createElement("div", { key: suite.name, className: "border rounded" },
                        React.createElement("div", { className: "p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50", onClick: () => toggleSuite(suite.name) },
                            React.createElement("div", { className: "flex items-center gap-2" },
                                expandedSuites.has(suite.name) ?
                                    React.createElement(ChevronDown, { className: "w-4 h-4" }) :
                                    React.createElement(ChevronRight, { className: "w-4 h-4" }),
                                getStatusIcon(getSuiteStatus(suite)),
                                React.createElement("span", { className: "font-medium" }, suite.name)),
                            React.createElement("div", { className: "flex items-center gap-4" },
                                React.createElement("div", { className: "flex items-center gap-2 text-sm" },
                                    React.createElement("span", { className: "text-green-600" }, suite.passed),
                                    React.createElement("span", { className: "text-gray-400" }, "/"),
                                    React.createElement("span", { className: "text-red-600" }, suite.failed),
                                    React.createElement("span", { className: "text-gray-400" }, "/"),
                                    React.createElement("span", { className: "text-yellow-600" }, suite.skipped)),
                                React.createElement("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        runSingleSuite(suite.name);
                                    }, disabled: isRunning, className: "px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50" }, isRunning && selectedSuite === suite.name ? (React.createElement(Loader2, { className: "w-3 h-3 animate-spin" })) : (React.createElement(Play, { className: "w-3 h-3" }))))),
                        expandedSuites.has(suite.name) && suite.tests && Array.isArray(suite.tests) && (React.createElement("div", { className: "border-t" }, suite.tests.map((test, idx) => (React.createElement("div", { key: idx, className: "px-6 py-2 flex items-center justify-between hover:bg-gray-50 text-sm" },
                            React.createElement("div", { className: "flex items-center gap-2" },
                                getStatusIcon(test.status),
                                React.createElement("span", null, test.test)),
                            React.createElement("div", { className: "flex items-center gap-2" },
                                test.duration && (React.createElement("span", { className: "text-gray-500" },
                                    test.duration,
                                    "ms")),
                                test.error && (React.createElement("span", { className: "text-red-500 text-xs max-w-xs truncate" }, test.error)))))))))))))),
                !isRunning && testResults.length === 0 && !error && (React.createElement("div", { className: "text-center py-8 text-gray-500" },
                    React.createElement(Clock, { className: "w-12 h-12 mx-auto mb-3" }),
                    React.createElement("p", null, "No test results yet"),
                    React.createElement("p", { className: "text-sm mt-1" }, "Click \"Run All Tests\" to start"))))),
        React.createElement(Card, null,
            React.createElement(CardHeader, null,
                React.createElement(CardTitle, null, "Quick Tests"),
                React.createElement(CardDescription, null, "Run individual test suites")),
            React.createElement(CardContent, null,
                React.createElement("div", { className: "grid grid-cols-3 gap-3" },
                    React.createElement("button", { onClick: () => runSingleSuite('Cache System'), disabled: isRunning, className: "p-3 border rounded hover:bg-gray-50 disabled:opacity-50" },
                        React.createElement("div", { className: "font-medium" }, "Cache System"),
                        React.createElement("div", { className: "text-sm text-gray-500" }, "Unit tests")),
                    React.createElement("button", { onClick: () => runSingleSuite('Application Layer'), disabled: isRunning, className: "p-3 border rounded hover:bg-gray-50 disabled:opacity-50" },
                        React.createElement("div", { className: "font-medium" }, "Application"),
                        React.createElement("div", { className: "text-sm text-gray-500" }, "IPC & UI tests")),
                    React.createElement("button", { onClick: () => runSingleSuite('End-to-End'), disabled: isRunning, className: "p-3 border rounded hover:bg-gray-50 disabled:opacity-50" },
                        React.createElement("div", { className: "font-medium" }, "End-to-End"),
                        React.createElement("div", { className: "text-sm text-gray-500" }, "Full stack tests")))))));
}
//# sourceMappingURL=TestRunner.js.map