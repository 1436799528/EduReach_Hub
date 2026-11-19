import type { CSSProperties } from 'react';
import { BadgeCheck } from 'lucide-react';
import { rolePresentation } from '../lib/rolePresentation';

/**
 * The verification mark the design standard asks for: a visual check beside a
 * name, with an accessible label, instead of the words "Verified Student"
 * appended to the name itself.
 *
 * ROLE-2: a student keeps the general green check. A staff account colours the
 * check by role and adds its named role immediately after it — admin gold,
 * editorial blue, service teal. The words are still announced, not inferred
 * from colour alone.
 */
export default function VerifiedBadge({
  label = 'Verified student',
  withLabel = false,
  role,
}: {
  label?: string;
  withLabel?: boolean;
  role?: unknown;
}) {
  const presentation = rolePresentation(role);
  const isStaff = presentation.role !== 'student';
  const style = {
    '--er-role-color': presentation.color,
    '--er-role-surface': presentation.surface,
    '--er-role-border': presentation.border,
  } as CSSProperties;
  return (
    <span className="er-identity-marks" data-role={presentation.role} style={style}>
      <span className="er-verified" role="img" aria-label={label} title={label}>
        <BadgeCheck size={withLabel ? 16 : 17} aria-hidden="true" />
        {withLabel && <span>{label}</span>}
      </span>
      {isStaff && (
        <span
          className="er-role-chip"
          aria-label={`${presentation.label} role`}
          title={presentation.description}
        >
          {presentation.label}
        </span>
      )}
    </span>
  );
}
