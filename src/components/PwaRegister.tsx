import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || window.location.protocol !== 'https:') return;

    // Bump the registration URL whenever the worker cache policy changes so
    // browsers holding an older worker immediately retrieve and activate it.
    navigator.serviceWorker.register('/sw.js?v=5').catch(() => undefined);
  }, []);

  return null;
}
