import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import RoutesComponent from './app.tsx';
import './index.css';
import { createPortal } from 'react-dom';
import { Toaster } from '@client/src/components/ui/sonner';

const CLIENT_BASE_PATH = process.env.CLIENT_BASE_PATH || '/';

// 简单的错误提示组件
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
    <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>页面加载出错</h2>
    <p style={{ color: '#6b7280', marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
      {error.message}
    </p>
    <button
      onClick={resetErrorBoundary}
      style={{
        padding: '10px 24px',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
      }}
    >
      重试
    </button>
  </div>
);

const MainApp = () => {
  return (
    <BrowserRouter basename={CLIENT_BASE_PATH}>
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <RoutesComponent />
          {createPortal(<Toaster />, document.body)}
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')!).render(<MainApp />);
