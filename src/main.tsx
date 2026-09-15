import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import HubApp from './HubApp';
import PwaRegister from './components/PwaRegister';
import './app.css';
import './hub.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PwaRegister />
    <HubApp />
  </StrictMode>,
);
