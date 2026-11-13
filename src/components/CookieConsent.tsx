import { useEffect, useState } from 'react';
import { readPrivacyPreferences, savePrivacyPreferences } from '../lib/privacyPreferences';
import { OPTIONAL_ANALYTICS_ENABLED } from '../lib/analyticsAvailability';

/** Optional analytics remain off until a visitor explicitly opts in. */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const current = readPrivacyPreferences();
    setAnalytics(OPTIONAL_ANALYTICS_ENABLED && current?.analytics === true);
    setVisible(!current);
  }, []);

  function save(value: boolean) {
    if (!savePrivacyPreferences(value)) {
      setError('Your choice could not be saved. Optional analytics are disabled. Enable browser storage and try again.');
      return;
    }
    setError('');
    setAnalytics(value);
    setVisible(false);
    setCustomizing(false);
    window.dispatchEvent(new CustomEvent('edureach:privacy-preferences-changed'));
  }

  function openSettings() {
    setAnalytics(OPTIONAL_ANALYTICS_ENABLED && readPrivacyPreferences()?.analytics === true);
    setCustomizing(true);
    setVisible(true);
  }

  return (
    <>
      {!visible && <button className="er-cookie-settings" type="button" onClick={openSettings}>Cookie settings</button>}
      {visible && (
        <section className="er-cookie-consent" aria-labelledby="er-cookie-title" aria-describedby="er-cookie-description">
          <h2 id="er-cookie-title">Your privacy choices</h2>
          <p id="er-cookie-description">
            Essential browser storage supports core features. {OPTIONAL_ANALYTICS_ENABLED ? 'Optional analytics stay off unless you allow them.' : 'Optional analytics are temporarily disabled.'}
            Change this choice any time in Cookie settings. Read our <a href="/cookies">Cookie Policy</a> and <a href="/privacy">Privacy Notice</a>.
          </p>
          {error && <p role="alert">{error}</p>}
          {customizing && (
            <div className="er-cookie-options">
              <p><strong>Essential storage</strong> is always active for sign-in, security and core functions.</p>
              <label>
                <input type="checkbox" checked={analytics} disabled={!OPTIONAL_ANALYTICS_ENABLED} onChange={(event) => setAnalytics(event.target.checked)} />
                <span><strong>Optional analytics</strong> — {OPTIONAL_ANALYTICS_ENABLED ? 'allow aggregated first-party product analytics.' : 'temporarily unavailable.'}</span>
              </label>
            </div>
          )}
          <div className="er-cookie-actions">
            <button type="button" onClick={() => save(false)}>Reject optional</button>
            {customizing
              ? <button type="button" onClick={() => save(analytics)}>Save choices</button>
              : <button type="button" onClick={() => setCustomizing(true)}>Customize</button>}
            <button className="er-cookie-accept" type="button" disabled={!OPTIONAL_ANALYTICS_ENABLED} onClick={() => save(true)}>Accept optional</button>
          </div>
        </section>
      )}
    </>
  );
}
