import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { readPrivacyPreferences, savePrivacyPreferences } from '../lib/privacyPreferences';
import { OPTIONAL_ANALYTICS_ENABLED } from '../lib/analyticsAvailability';

/**
 * The privacy choice is deliberately small and immediate.
 *
 * Essential storage is always on because sign-in cannot work without it.
 * Optional analytics are off until a visitor says otherwise. When the browser
 * refuses storage, the choice cannot be recorded, so the panel says that and
 * offers a session-only way to dismiss it. A button that looks broken is worse
 * than an honest limitation.
 */
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
      setError('Your choice could not be saved. Optional analytics are disabled. Enable browser storage and try again, or continue without saving for this visit.');
      setAnalytics(false);
      return;
    }
    setError('');
    setAnalytics(value);
    setVisible(false);
    setCustomizing(false);
    window.dispatchEvent(new CustomEvent('edureach:privacy-preferences-changed'));
  }

  function continueWithoutSaving() {
    // Nothing is claimed about the choice: analytics remain off and the next
    // visit asks again. This only removes the panel the visitor is stuck behind.
    setError('');
    setVisible(false);
    setCustomizing(false);
  }

  function openSettings() {
    setAnalytics(OPTIONAL_ANALYTICS_ENABLED && readPrivacyPreferences()?.analytics === true);
    setError('');
    setCustomizing(true);
    setVisible(true);
  }

  // The persistent floating pill covered page controls, especially on phones.
  // The footer's "Cookie settings" control dispatches this event instead, so a
  // saved choice can still be reviewed without a control hovering the page.
  useEffect(() => {
    const openFromFooter = () => openSettings();
    window.addEventListener('edureach:open-cookie-settings', openFromFooter);
    return () => window.removeEventListener('edureach:open-cookie-settings', openFromFooter);
  }, []);

  return (
    <>
      {visible && (
        <section className="er-cookie-consent" aria-labelledby="er-cookie-title" aria-describedby="er-cookie-description">
          <div className="er-cookie-heading">
            <h2 id="er-cookie-title">Your privacy choices</h2>
            <button className="er-cookie-close" type="button" aria-label="Close privacy choices" onClick={continueWithoutSaving}><X size={15} aria-hidden="true" /></button>
          </div>
          <p id="er-cookie-description">
            Essential storage keeps sign-in and security working. Optional analytics stay off unless you allow them.
            Read our <a href="/cookies" target="_blank" rel="noopener noreferrer">Cookie Policy</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>.
          </p>

          {customizing && (
            <div className="er-cookie-options">
              <p><strong>Essential storage</strong> is always active for sign-in, security and core functions.</p>
              <label>
                <input type="checkbox" checked={analytics} disabled={!OPTIONAL_ANALYTICS_ENABLED} onChange={(event) => setAnalytics(event.target.checked)} />
                <span><strong>Optional analytics</strong> {OPTIONAL_ANALYTICS_ENABLED ? '— allow aggregated first-party product analytics.' : 'are temporarily unavailable.'}</span>
              </label>
            </div>
          )}

          {error && (
            <div className="er-cookie-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={continueWithoutSaving}>Continue for this visit</button>
            </div>
          )}

          <div className="er-cookie-actions">
            <button type="button" onClick={() => save(false)}>Reject optional</button>
            {customizing
              ? <button type="button" className="er-cookie-save" onClick={() => save(analytics)}>Save choices</button>
              : <button type="button" onClick={() => setCustomizing(true)}>Customize</button>}
            {OPTIONAL_ANALYTICS_ENABLED && (
              <button className="er-cookie-accept" type="button" onClick={() => save(true)}>Allow analytics</button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
