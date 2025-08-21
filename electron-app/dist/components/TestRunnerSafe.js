import React from 'react';
import { TestRunner } from './TestRunner';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertCircle } from 'lucide-react';
class TestRunnerErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        console.error('[TestRunner ErrorBoundary] Caught error:', error);
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('[TestRunner ErrorBoundary] Error details:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (React.createElement(Card, null,
                React.createElement(CardHeader, null,
                    React.createElement(CardTitle, { className: "text-red-600 flex items-center gap-2" },
                        React.createElement(AlertCircle, { className: "h-5 w-5" }),
                        "Test Runner Error")),
                React.createElement(CardContent, null,
                    React.createElement("div", { className: "text-sm text-gray-600" },
                        React.createElement("p", null, "The test runner encountered an error:"),
                        React.createElement("pre", { className: "mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto" }, this.state.error?.message || 'Unknown error'),
                        React.createElement("button", { onClick: () => this.setState({ hasError: false, error: null }), className: "mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" }, "Try Again")))));
        }
        return this.props.children;
    }
}
export function TestRunnerSafe() {
    return (React.createElement(TestRunnerErrorBoundary, null,
        React.createElement(TestRunner, null)));
}
//# sourceMappingURL=TestRunnerSafe.js.map