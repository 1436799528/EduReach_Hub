import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { isOffline } from '../lib/failures';

/**
 * APP-3 — the connection strip.
 *
 * Rules this follows deliberately:
 *  - It never replaces the page. The student keeps working, keeps their typed
 *    answers, and keeps reading content that is already on screen.
 *  - It is announced politely, not as an alert, so a screen reader is not
 *    interrupted mid-question.
 *  - It does not appear at all while the connection is fine, and it disappears
 *    the moment the browser reports the connection is back, without a reload.
 *
 * Reconnection *behaviour* (retrying a failed save/submit) lives with the code
 * that owns the request; this component only reports the connection state.
 */
export default function ConnectionBanner() {
  const [offline, setOffline] = useState(isOffline);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="er-connection-strip" role="status" aria-live="polite">
      <WifiOff size={15} aria-hidden="true" />
      <span>
        <strong>You are offline.</strong> You can keep reading and working — anything you save is kept on this device and sent when you reconnect.
      </span>
    </div>
  );
}
