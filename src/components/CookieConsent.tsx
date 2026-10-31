import { useState } from 'react';
import { readPrivacyPreferences, savePrivacyPreferences } from '../lib/privacyPreferences';

/** Adapted from PR #32: analytics remain off until a choice is saved. */
export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !readPrivacyPreferences());
  const [error, setError] = useState('');

  function save(analytics: boolean) {
    if (!savePrivacyPreferences(analytics)) {
      setError('Your choice could not be saved. Optional analytics are disabled in this tab; enable browser storage and try again.');
      return;
    }
    setError('');
    setVisible(false);
  }

  if (!visible) return <button type="button" className="privacy-settings hub-outline-btn" onClick={() => setVisible(true)}>Cookie settings</button>;
  return (
    <section className="privacy-panel" aria-labelledby="privacy-title" aria-describedby="privacy-description" aria-live="polite">
      <h2 id="privacy-title">Your privacy choices</h2>
      <p id="privacy-description">Essential browser storage supports the site. Optional first-party analytics are off unless you allow them. Change your choice anytime in Cookie settings. Read our <a href="/cookies">Cookie Policy</a> and <a href="/privacy">Privacy Notice</a>.</p>
      {error && <p role="alert">{error}</p>}
      <div className="privacy-actions">
        <button type="button" className="hub-outline-btn" onClick={() => save(false)}>Reject optional</button>
        <button type="button" className="hub-primary-btn" onClick={() => save(true)}>Accept optional</button>
      </div>
    </section>
  );
}
