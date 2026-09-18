import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import HubApp from './HubApp';
import PwaRegister from './components/PwaRegister';
import './hub.css';
import './card-system.css';
import './hub-portal-tuning.css';
import './dashboard-v2.css';
import './admin.css';
import './cbt-engine.css';
import './compact-portal.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PwaRegister />
    <HubApp />
  </StrictMode>,
);
