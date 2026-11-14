import { inspectPassword } from '../lib/passwordStrength';

/**
 * Requirements first, score second. The bar is decoration for the score; the
 * checklist is the part a keyboard or screen-reader user can act on, and it
 * never hides a requirement behind colour alone.
 */
export default function PasswordStrengthMeter({ value, confirm, idPrefix = 'auth-password-strength' }: { value: string; confirm?: string; idPrefix?: string }) {
  const strength = inspectPassword(value);
  const mismatch = Boolean(confirm) && value !== confirm;
  if (!value && !confirm) {
    return (
      <div className="auth-password-guidance" id={idPrefix}>
        <p>Use at least 8 characters. A longer phrase is easier to remember and harder to guess.</p>
      </div>
    );
  }
  return (
    <div className="auth-password-guidance" id={idPrefix}>
      <div className={`auth-strength is-${strength.score}`}>
        <div className="auth-strength-track" aria-hidden="true"><i style={{ width: `${strength.percent}%` }} /></div>
        <p className="auth-strength-label" aria-live="polite">Password strength: <strong>{strength.label}</strong></p>
      </div>
      <ul className="auth-strength-rules" aria-label="Password requirements">
        {strength.requirements.map((requirement) => (
          <li key={requirement.id} className={requirement.met ? 'is-met' : undefined}>
            <span aria-hidden="true">{requirement.met ? '✓' : '○'}</span>
            <span>{requirement.label}{requirement.id === 'common' && !requirement.met ? ' — choose something less predictable' : ''}</span>
            <span className="er-visually-hidden">{requirement.met ? ' (met)' : ' (not met)'}</span>
          </li>
        ))}
        {confirm !== undefined && confirm.length > 0 && (
          <li className={mismatch ? 'is-missing' : 'is-met'}>
            <span aria-hidden="true">{mismatch ? '○' : '✓'}</span>
            <span>Both passwords match</span>
            <span className="er-visually-hidden">{mismatch ? ' (not met)' : ' (met)'}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
