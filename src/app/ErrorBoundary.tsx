import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Something went wrong while loading this page.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EduReach route error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#FAF8FF',
          padding: '24px',
          fontFamily: 'var(--er-font-sans)',
        }}
      >
        <div
          style={{
            width: 'min(100%, 440px)',
            background: '#ffffff',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '22px',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 12px',
              background: '#FFF0E6',
              color: '#D9381E',
              fontWeight: 900,
            }}
          >
            ER
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0F172A' }}>
            Page could not load
          </h1>
          <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: '12.5px', lineHeight: 1.55 }}>
            {this.state.message}. Please refresh the page or return to the portal homepage.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 0,
                background: '#D9381E',
                color: '#ffffff',
                borderRadius: '7px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
            <a
              href="/"
              style={{
                border: '1px solid #CBD5E1',
                background: '#ffffff',
                color: '#0F172A',
                borderRadius: '7px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
