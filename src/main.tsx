import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const edulebStyles = [
  'https://themewagon.github.io/eduleb/assets/bootstrap/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://themewagon.github.io/eduleb/assets/fonts/font-awesome.min.css',
  'https://themewagon.github.io/eduleb/assets/fonts/themify-icons.css',
  'https://themewagon.github.io/eduleb/assets/owlcarousel/css/owl.carousel.css',
  'https://themewagon.github.io/eduleb/assets/owlcarousel/css/owl.theme.css',
  'https://themewagon.github.io/eduleb/assets/css/jquery-simple-mobilemenu.css',
  'https://themewagon.github.io/eduleb/assets/css/magnific-popup.css',
  'https://themewagon.github.io/eduleb/assets/css/animate.css',
  'https://themewagon.github.io/eduleb/assets/css/style.css',
];

const edulebFonts = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Jost:ital,wght@0,100..900;1,100..900&display=swap';

for (const href of [edulebFonts, ...edulebStyles]) {
  if (!document.head.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const edulebScripts = [
  'https://themewagon.github.io/eduleb/assets/js/jquery-1.12.4.min.js',
  'https://themewagon.github.io/eduleb/assets/bootstrap/js/bootstrap.bundle.min.js',
  'https://themewagon.github.io/eduleb/assets/js/modernizr-2.8.3.min.js',
  'https://themewagon.github.io/eduleb/assets/js/jquery-simple-mobilemenu.js',
  'https://themewagon.github.io/eduleb/assets/owlcarousel/js/owl.carousel.min.js',
  'https://themewagon.github.io/eduleb/assets/js/jquery.magnific-popup.min.js',
  'https://themewagon.github.io/eduleb/assets/js/jquery.inview.min.js',
  'https://themewagon.github.io/eduleb/assets/js/scrolltopcontrol.js',
  'https://themewagon.github.io/eduleb/assets/js/wow.min.js',
  'https://themewagon.github.io/eduleb/assets/js/scripts.js',
];

window.setTimeout(() => {
  for (const src of edulebScripts) {
    if (!document.body.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      document.body.appendChild(script);
    }
  }
}, 0);
