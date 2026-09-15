import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import HighDensityHome from './HighDensityHome';
import IntegrationBridge from './IntegrationBridge.tsx';
import ServiceTrackOverride from './ServiceTrackOverride.tsx';
import { initUiPolish } from './uiPolish';
import './app.css';
import './home-refresh.css';
import './card-polish.css';
import './service-track.css';
import './dense-portal.css';

function RootRouter() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const cleanPath = path.replace(/\/$/, '') || '/';
  if (cleanPath === '/') return <HighDensityHome />;
  return cleanPath === '/services/track' ? <ServiceTrackOverride /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IntegrationBridge />
    <RootRouter />
  </StrictMode>,
);

initUiPolish();
