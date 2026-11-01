import { useEffect, useState } from 'react';
import { readPrivacyPreferences, savePrivacyPreferences } from '../lib/privacyPreferences';

/** Optional analytics remain off until a visitor explicitly opts in. */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const current = readPrivacyPreferences();
    setAnalytics(current?.analytics === true);
    setVisible(!current);
  }, []);

  function save(value: boolean) {
    savePrivacyPreferences(value);
    setAnalytics(value);
    setVisible(false);
    setCustomizing(false);
    window.dispatchEvent(new CustomEvent('edureach:privacy-preferences-changed'));
  }

  function openSettings() {
    setAnalytics(readPrivacyPreferences()?.analytics === true);
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
            Essential browser storage supports core features. Optional first-party analytics stay off unless you allow them.
            Change this choice any time in Cookie settings. Read our <a href="/cookies">Cookie Policy</a> and <a href="/privacy">Privacy Notice</a>.
          </p>
          {customizing && (
            <div className="er-cookie-options">
              <p><strong>Essential storage</strong> is always active for sign-in, security and core functions.</p>
              <label>
                <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
                <span><strong>Optional analytics</strong> — allow aggregated first-party product analytics.</span>
              </label>
            </div>
          )}
          <div className="er-cookie-actions">
            <button type="button" onClick={() => save(false)}>Reject optional</button>
            {customizing
              ? <button type="button" onClick={() => save(analytics)}>Save choices</button>
              : <button type="button" onClick={() => setCustomizing(true)}>Customize</button>}
            <button className="er-cookie-accept" type="button" onClick={() => save(true)}>Accept optional</button>
          </div>
        </section>
      )}
    </>
  );
}
