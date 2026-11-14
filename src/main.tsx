import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import PwaRegister from './components/PwaRegister';
import CookieConsent from './components/CookieConsent';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './lib/auth';
import { installGlobalErrorReporting } from './lib/errorTelemetry';
import './hub.css';
import './card-system.css';
import './cbt-engine.css';
import './compact-portal.css';
import './image-card-system.css';
import './home-card-first.css';
import './myschool-clean.css';
import './styles/theme.css';
import './compact-design-system.css';
import './compact-structural.css';
import './edu-portal.css';
import './data-control.css';
import './components/CookieConsent.css';
// The shared type scale and student-state surfaces are collected here, after
// the component sheets they standardise (see the file header), but a11y.css must
// remain the final import: it owns the focus-ring cascade the a11y gate checks.
import './styles/type-system.css';
// Brand action colours are the last word on primary buttons and selected
// states, so they follow every component sheet; a11y.css still closes the file.
import './styles/brand-actions.css';
// UX-5 product system: hierarchy, spacing, navigation and control states.
import './styles/ux5-product.css';
import './styles/a11y.css';


// P2-2: a route that throws inside React is caught by the boundary, but a
// rejected promise or a script-level error outside it had nowhere to go. Both
// are installed once, here, and only in a production build.
installGlobalErrorReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <PwaRegister />
        <App />
        <CookieConsent />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
