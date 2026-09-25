import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Laptop, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { recordSecurityEvent } from '../../lib/studentDashboard';

const inputStyle = { width: '100%', padding: '9px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' } as const;
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' } as const;

type MfaSetup = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

function describeDevice() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = ua.includes('Edg/') ? 'Edge' : ua.includes('Chrome/') ? 'Chrome' : ua.includes('Firefox/') ? 'Firefox' : ua.includes('Safari/') ? 'Safari' : 'Browser';
  const os = ua.includes('Windows') ? 'Windows' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : 'Device';
  return `${browser} / ${os}`;
}

/**
 * Account security dialog: password change, other-device sign-out and real
 * Supabase TOTP MFA enrollment. Local preview mode deliberately disables the
 * controls that cannot persist or revoke a real account session.
 */
export default function SecurityModal({
  open,
  onClose,
  userId,
  isLocalMode,
  mfaEnabled,
  onMfaChange,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  isLocalMode: boolean;
  mfaEnabled: boolean;
  onMfaChange: (enabled: boolean) => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);

  useEffect(() => {
    if (!open || isLocalMode || !userId) return;
    let active = true;
    setMfaLoading(true);
    void supabase.auth.mfa.listFactors()
      .then(({ data, error: listError }) => {
        if (!active) return;
        if (listError) throw listError;
        const verifiedFactor = data?.totp?.find((factor) => factor.status === 'verified');
        setMfaFactorId(verifiedFactor?.id || '');
        onMfaChange(Boolean(verifiedFactor));
      })
      .catch((value) => {
        if (active) setError(value instanceof Error ? value.message : 'Unable to load MFA status.');
      })
      .finally(() => {
        if (active) setMfaLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, isLocalMode, userId, onMfaChange]);

  if (!open) return null;

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    if (isLocalMode) {
      setError('Password changes are unavailable in local preview mode. Connect an EduReach account to update your password.');
      setBusy(false);
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      setBusy(false);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      setBusy(false);
      return;
    }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      if (userId) void recordSecurityEvent(userId, 'password_changed', 'Password changed from student dashboard');
      setMessage('Password updated successfully.');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Password update failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutOtherDevices = async () => {
    setError('');
    if (isLocalMode) {
      setError('Other-device session management is unavailable in local preview mode.');
      return;
    }
    setSessionRevoked(false);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
      if (signOutError) throw signOutError;
      if (userId) void recordSecurityEvent(userId, 'sessions_revoked', 'Other sessions revoked from student dashboard');
      setSessionRevoked(true);
      window.setTimeout(() => setSessionRevoked(false), 3000);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to sign out other devices right now.');
    }
  };

  const updateMfaProfile = async (enabled: boolean) => {
    if (!userId) return;
    const { error: updateError } = await supabase.from('profiles').update({ mfa_enabled: enabled }).eq('id', userId);
    if (updateError) throw updateError;
  };

  const handleMfaToggle = async () => {
    setError('');
    setMessage('');
    if (isLocalMode || !userId) {
      setError('MFA setup requires a connected EduReach account.');
      return;
    }
    setMfaBusy(true);
    try {
      if (mfaEnabled) {
        if (!mfaFactorId) throw new Error('No verified authenticator factor was found. Refresh and try again.');
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
        if (unenrollError) throw unenrollError;
        await updateMfaProfile(false);
        setMfaFactorId('');
        onMfaChange(false);
        setMessage('Two-factor authentication has been disabled.');
        return;
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'EduReach Hub authenticator',
        issuer: 'EduReach Hub',
      });
      if (enrollError) throw enrollError;
      if (!data?.totp) throw new Error('The authenticator setup could not be prepared.');
      setMfaSetup({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
      setMessage('Scan the QR code with your authenticator app, then enter the six-digit code to finish setup.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update MFA settings.');
    } finally {
      setMfaBusy(false);
    }
  };

  const verifyMfa = async () => {
    if (!mfaSetup || !/^\d{6}$/.test(mfaCode)) {
      setError('Enter the six-digit code from your authenticator app.');
      return;
    }
    setMfaBusy(true);
    setError('');
    setMessage('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaSetup.factorId });
      if (challengeError || !challenge) throw challengeError || new Error('Unable to create an MFA challenge.');
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaSetup.factorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;
      await updateMfaProfile(true);
      setMfaFactorId(mfaSetup.factorId);
      setMfaSetup(null);
      setMfaCode('');
      onMfaChange(true);
      setMessage('Two-factor authentication is now enabled.');
      void recordSecurityEvent(userId, 'mfa_enabled', 'MFA enabled from student dashboard');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'The MFA code could not be verified.');
    } finally {
      setMfaBusy(false);
    }
  };

  const cancelMfaSetup = async () => {
    if (!mfaSetup) return;
    setMfaBusy(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId: mfaSetup.factorId });
    } finally {
      setMfaSetup(null);
      setMfaCode('');
      setMfaBusy(false);
      setMessage('MFA setup cancelled.');
    }
  };

  return (
    <div className="dash-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dash-security-title">
      <div className="dash-modal" style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center' }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h3 id="dash-security-title" style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>Account Security &amp; Devices</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Password, active sessions &amp; authenticator MFA</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close security settings" style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handlePasswordChange} style={{ marginBottom: '22px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
          <h4 style={{ margin: '0 0 4px', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Change Password</h4>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>Your active signed-in session is used to authorize this change.</p>
          {isLocalMode && <div style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '10px' }}>Password changes are disabled in local preview mode.</div>}
          {message && <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '8px 12px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '10px' }}>{message}</div>}
          {error && <div role="alert" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '10px' }}>{error}</div>}
          <fieldset disabled={isLocalMode || busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
              <div className="dash-two-col">
                <div>
                  <label htmlFor="security-new-password" style={labelStyle}>New Password</label>
                  <input id="security-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" minLength={8} required autoComplete="new-password" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="security-confirm-password" style={labelStyle}>Confirm New Password</label>
                  <input id="security-confirm-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Repeat new password" minLength={8} required autoComplete="new-password" style={inputStyle} />
                </div>
              </div>
            </div>
            <button type="submit" className="dash-btn dash-btn-primary">
              {busy ? 'Updating…' : 'Update Password'}
            </button>
          </fieldset>
        </form>

        <div style={{ marginBottom: '22px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Active Sessions &amp; Devices</h4>
          {sessionRevoked && <div style={{ background: '#ecfdf5', color: '#047857', padding: '8px 12px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '10px' }}>All other devices have been logged out.</div>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <Laptop size={18} color="#C85841" />
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '12.5px', display: 'block', color: '#0f172a' }}>Current Web Session • {describeDevice()}</strong>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>This device • Active now</span>
              </div>
            </div>
            <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, whiteSpace: 'nowrap' }}>THIS DEVICE</span>
          </div>
          <button type="button" onClick={handleSignOutOtherDevices} disabled={isLocalMode} className="dash-btn dash-btn-secondary">
            {isLocalMode ? 'Unavailable in preview' : 'Sign Out from All Other Devices'}
          </button>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <h4 style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Two-Factor Authentication (MFA)</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Use an authenticator app such as Google Authenticator or Authy.</p>
            </div>
            {!mfaSetup && (
              <button
                type="button"
                onClick={() => void handleMfaToggle()}
                disabled={isLocalMode || mfaLoading || mfaBusy}
                className="dash-btn"
                style={{ background: mfaEnabled ? '#059669' : '#e2e8f0', color: mfaEnabled ? '#ffffff' : '#475569', whiteSpace: 'nowrap' }}
              >
                {mfaLoading ? 'Checking…' : mfaBusy ? 'Working…' : mfaEnabled ? 'Disable MFA' : 'Set up MFA'}
              </button>
            )}
          </div>

          {isLocalMode && <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#92400e' }}>MFA setup is available after a connected account is configured.</p>}

          {mfaSetup && (
            <div style={{ marginTop: '14px', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(mfaSetup.qrCode)}`}
                  alt="QR code for EduReach Hub authenticator setup"
                  width={150}
                  height={150}
                  style={{ background: '#ffffff', padding: '8px', borderRadius: '6px' }}
                />
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#475569' }}>Scan the QR code, or enter this secret manually:</p>
                  <code style={{ display: 'block', overflowWrap: 'anywhere', padding: '7px 8px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '11px', letterSpacing: '0.04em' }}>{mfaSetup.secret}</code>
                  <label style={{ ...labelStyle, marginTop: '12px' }} htmlFor="mfa-code">Authenticator code</label>
                  <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button type="button" className="dash-btn dash-btn-primary" onClick={() => void verifyMfa()} disabled={mfaBusy || mfaCode.length !== 6}>{mfaBusy ? 'Verifying…' : 'Verify and enable MFA'}</button>
                <button type="button" className="dash-btn dash-btn-secondary" onClick={() => void cancelMfaSetup()} disabled={mfaBusy}>Cancel</button>
              </div>
              {mfaSetup.uri && <span className="er-visually-hidden">Authenticator URI: {mfaSetup.uri}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
