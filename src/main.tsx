import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import HubApp from './HubApp';
import './app.css';
import './hub.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HubApp />
  </StrictMode>,
);
