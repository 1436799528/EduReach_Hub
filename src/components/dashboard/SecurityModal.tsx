import { useState, type FormEvent } from 'react';
import { KeyRound, Laptop, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { recordSecurityEvent } from '../../lib/studentDashboard';

const inputStyle = { width: '100%', padding: '9px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' } as const;
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' } as const;

function describeDevice() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = ua.includes('Edg/') ? 'Edge' : ua.includes('Chrome/') ? 'Chrome' : ua.includes('Firefox/') ? 'Firefox' : ua.includes('Safari/') ? 'Safari' : 'Browser';
  const os = ua.includes('Windows') ? 'Windows' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : 'Device';
  return `${browser} / ${os}`;
}

/**
 * Account security dialog: password change, other-device sign-out and the MFA flag.
 * Self-contained so the dashboard shell only has to toggle it open.
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
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);

  if (!open) return null;

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
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
      if (!isLocalMode) {
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
        if (userId) void recordSecurityEvent(userId, 'password_changed', 'Password changed from student dashboard');
      }
      setMessage(isLocalMode ? 'Password validated for this local account session.' : 'Password updated successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutOtherDevices = async () => {
    setSessionRevoked(false);
    try {
      if (!isLocalMode) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
        if (signOutError) throw signOutError;
        if (userId) void recordSecurityEvent(userId, 'sessions_revoked', 'Other sessions revoked from student dashboard');
      }
      setSessionRevoked(true);
      window.setTimeout(() => setSessionRevoked(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign out other devices right now.');
    }
  };

  const handleMfaToggle = async () => {
    const nextValue = !mfaEnabled;
    onMfaChange(nextValue);
    if (isLocalMode || !userId) return;
    const { error: updateError } = await supabase.from('profiles').update({ mfa_enabled: nextValue }).eq('id', userId);
    if (updateError) {
      onMfaChange(!nextValue);
      setError(updateError.message);
      return;
    }
    void recordSecurityEvent(userId, nextValue ? 'mfa_enabled' : 'mfa_disabled', `MFA ${nextValue ? 'enabled' : 'disabled'} from student dashboard`);
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
              <span style={{ fontSize: '12px', color: '#64748b' }}>Password, active sessions &amp; optional MFA</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close security settings" style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handlePasswordChange} style={{ marginBottom: '22px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Change Password</h4>
          {message && <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '8px 12px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '10px' }}>{message}</div>}
          {error && <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '10px' }}>{error}</div>}
          <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Enter current password" autoComplete="current-password" style={inputStyle} />
            </div>
            <div className="dash-two-col">
              <div>
                <label style={labelStyle}>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" minLength={8} required autoComplete="new-password" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Repeat new password" minLength={8} required autoComplete="new-password" style={inputStyle} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={busy} className="dash-btn dash-btn-primary">
            {busy ? 'Updating…' : 'Update Password'}
          </button>
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
          <button type="button" onClick={handleSignOutOtherDevices} className="dash-btn dash-btn-secondary">
            Sign Out from All Other Devices
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h4 style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Two-Factor Authentication (MFA)</h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Add extra security using an authenticator app (Google Authenticator / Authy).</p>
          </div>
          <button
            type="button"
            onClick={handleMfaToggle}
            className="dash-btn"
            style={{ background: mfaEnabled ? '#059669' : '#e2e8f0', color: mfaEnabled ? '#ffffff' : '#475569', whiteSpace: 'nowrap' }}
          >
            {mfaEnabled ? 'Enabled' : 'Enable MFA'}
          </button>
        </div>
      </div>
    </div>
  );
}
