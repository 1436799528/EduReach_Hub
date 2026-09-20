import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import PwaRegister from './components/PwaRegister';
import { AuthProvider } from './lib/auth';
import './hub.css';
import './card-system.css';
import './hub-portal-tuning.css';
import './dashboard-v2.css';
import './admin.css';
import './cbt-engine.css';
import './compact-portal.css';
import './image-card-system.css';
import './home-card-first.css';
import './myschool-clean.css';
import './styles/theme.css';
import './card-density.css';
import './landing-polish.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PwaRegister />
      <App />
    </AuthProvider>
  </StrictMode>,
);
