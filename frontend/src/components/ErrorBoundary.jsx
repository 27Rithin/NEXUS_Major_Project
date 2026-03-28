import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[NEXUS] UI CRASH DETECTED:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <span className="text-4xl text-red-500">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">System UI Error</h1>
          <p className="text-slate-400 max-w-sm mb-8 text-sm leading-relaxed">
            The NEXUS React interface has encountered a critical rendering error. The self-healing logic is active.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20"
          >
            Manual Recovery (Reload)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
