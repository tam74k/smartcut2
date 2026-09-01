import React, { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem('smartcut_active_session');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center text-3xl mb-4 border border-rose-500/30">
            ⚠️
          </div>
          <h2 className="text-xl font-bold mb-2">تنبيه في تشغيل الواجهة</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            حدث خطأ غير متوقع أثناء تحميل أحد المكونات. يرجى النقر على الزر أدناه لإعادة تحميل التطبيق.
          </p>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all"
            >
              🔄 إعادة تحميل الصفحة
            </button>
            <button
              onClick={this.handleReset}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-medium text-xs border border-slate-700 transition-all"
            >
              تصفير الجلسة المؤقتة
            </button>
          </div>
          {this.state.error && (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-rose-500/30 text-right text-xs max-w-2xl w-full text-rose-300 overflow-auto font-mono dir-ltr select-text">
              <div className="font-bold text-rose-400 mb-1">Error: {this.state.error.message}</div>
              <pre className="text-[11px] whitespace-pre-wrap text-slate-400">{this.state.error.stack}</pre>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
