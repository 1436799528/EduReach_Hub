import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || window.location.protocol !== 'https:') return;

    // Version the registration URL so browsers holding an older worker script
    // are forced to retrieve the current worker instead of reusing a stale copy.
    navigator.serviceWorker.register('/sw.js?v=4').catch(() => undefined);
  }, []);

  return null;
}
