import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import IntegrationBridge from './IntegrationBridge.tsx';
import './app.css';
import './home-refresh.css';
import './card-polish.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IntegrationBridge />
    <App />
  </StrictMode>,
);
