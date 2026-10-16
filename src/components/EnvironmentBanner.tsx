import { AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * P2-1 — the banner that tells the truth when the backend is not there.
 *
 * `src/lib/supabase.ts` never throws, and the whole product has a careful local
 * fallback: services render from a static catalogue, CBT is scored in the
 * browser, and "applications" persist to `localStorage` with official-looking
 * reference codes. That behaviour is deliberate for previews — and dangerous
 * when it ships, because nothing on screen distinguishes it from the real
 * product.
 *
 * So: in a production build only, and only when the client Supabase contract is
 * unmet, a strip appears at the top of every route. It does not replace the page
 * (a previewer still needs to use it) and it is announced politely.
 *
 * The banner cannot say "the site is broken" because it is not: it says what is
 * true — this deployment is not saving anything.
 */
export default function EnvironmentBanner() {
  // Dev builds legitimately run unconfigured; they are not the danger.
  if (!import.meta.env?.PROD || isSupabaseConfigured) return null;

  return (
    <div className="er-connection-strip" role="status" aria-live="polite">
      <AlertTriangle size={15} aria-hidden="true" />
      <span>
        <strong>Preview build — not connected to the live service.</strong> Everything you submit stays on this
        device: service requests are not filed, and exam attempts are not recorded.
      </span>
    </div>
  );
}
