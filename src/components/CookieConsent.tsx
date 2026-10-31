import { useEffect, useState } from 'react';
import { readPrivacyPreferences, savePrivacyPreferences } from '../lib/privacyPreferences';

/**
 * First-party privacy controls. Necessary storage is always on; optional
 * analytics are off until a visitor explicitly enables them.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const current = readPrivacyPreferences();
    if (current) {
      setAnalytics(current.analytics);
      setVisible(false);
    } else {
      setVisible(true);
    }
  }, []);

  function save(value: boolean) {
    savePrivacyPreferences(value);
    setAnalytics(value);
    setVisible(false);
    setCustomizing(false);
    // Reload ensures the new preference is applied consistently to page-view
    // events and any currently mounted feature without buffering past events.
    window.dispatchEvent(new CustomEvent('edureach:privacy-preferences-changed'));
  }

  function openSettings() {
    const current = readPrivacyPreferences();
    setAnalytics(current?.analytics === true);
    setCustomizing(true);
    setVisible(true);
  }

  return (
    <>
      {!visible && (
        <button
          type="button"
          onClick={openSettings}
          aria-label="Open cookie and privacy settings"
          style={{
            position: 'fixed', right: 16, bottom: 16, zIndex: 900,
            border: '1px solid #174a3a', borderRadius: 999, padding: '9px 14px',
            background: '#ffffff', color: '#174a3a', fontSize: 12,
            fontWeight: 650, cursor: 'pointer', boxShadow: '0 2px 12px rgba(15,23,42,.12)',
          }}
        >
          Cookie settings
        </button>
      )}
      {visible && (
        <section
          aria-labelledby="er-cookie-title"
          aria-describedby="er-cookie-description"
          aria-live="polite"
          style={{
            position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 1000,
            maxWidth: 760, margin: '0 auto', padding: 20,
            background: '#ffffff', color: '#172033', border: '1px solid #cbd5e1',
            borderRadius: 14, boxShadow: '0 12px 36px rgba(15,23,42,.20)',
          }}
        >
          <h2 id="er-cookie-title" style={{ margin: '0 0 8px', fontSize: 17 }}>Your privacy choices</h2>
          <p id="er-cookie-description" style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6 }}>
            EduReach uses essential browser storage for core features. Optional first-party analytics are off unless
            you choose to allow them. You can change this choice at any time in Cookie settings. Read our{' '}
            <a href="/cookies" style={{ color: '#174a3a', textDecoration: 'underline' }}>Cookie Policy</a> and{' '}
            <a href="/privacy" style={{ color: '#174a3a', textDecoration: 'underline' }}>Privacy Notice</a>.
          </p>
          {customizing && (
            <div style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '12px 0', marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13 }}>
                <strong>Essential storage</strong> — always active because sign-in, security and core site functions depend on it.
              </p>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
                <span><strong>Optional analytics</strong> — allow EduReach's first-party, aggregated product analytics to help improve the platform.</span>
              </label>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            <button type="button" onClick={() => save(false)} style={buttonStyle}>Reject optional</button>
            {customizing ? (
              <button type="button" onClick={() => save(analytics)} style={buttonStyle}>Save choices</button>
            ) : (
              <button type="button" onClick={() => setCustomizing(true)} style={buttonStyle}>Customize</button>
            )}
            <button type="button" onClick={() => save(true)} style={{ ...buttonStyle, background: '#174a3a', color: '#ffffff', borderColor: '#174a3a' }}>
              Accept optional
            </button>
          </div>
        </section>
      )}
    </>
  );
}

const buttonStyle: React.CSSProperties = {
  minHeight: 40, padding: '9px 14px', borderRadius: 8, border: '1px solid #64748b',
  background: '#ffffff', color: '#172033', fontSize: 13, fontWeight: 650, cursor: 'pointer',
};
