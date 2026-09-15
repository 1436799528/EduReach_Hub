import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import IntegrationBridge from './IntegrationBridge.tsx';
import ServiceTrackOverride from './ServiceTrackOverride.tsx';
import './app.css';
import './home-refresh.css';
import './card-polish.css';

function RootRouter() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return path.replace(/\/$/, '') === '/services/track' ? <ServiceTrackOverride /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IntegrationBridge />
    <RootRouter />
  </StrictMode>,
);
