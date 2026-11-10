import { AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * P2-1 - the banner that tells the truth when the backend is not there.
 *
 * `src/lib/supabase.ts` has an unconfigured preview fallback. Static catalogue
 * content may render, but that does not establish a live submission or account.
 * Service requests must not be represented as filed in this mode.
 *
 * So: in a production build only, and only when the client Supabase contract is
 * unmet, a strip appears at the top of every route. It does not replace the page
 * (a previewer still needs to use it) and it is announced politely.
 *
 * Browser storage can also fail, so do not promise that drafts are preserved.
 */
export default function EnvironmentBanner() {
  // Dev builds legitimately run unconfigured; they are not the danger.
  if (!import.meta.env?.PROD || isSupabaseConfigured) return null;

  return (
    <div className="er-connection-strip" role="status" aria-live="polite">
      <AlertTriangle size={15} aria-hidden="true" />
      <span>
        <strong>Preview build: not connected to the live service.</strong> Service requests cannot be submitted,
        and exam attempts are not recorded by EduReach. Drafts may not be saved.
      </span>
    </div>
  );
}
