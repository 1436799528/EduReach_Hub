import type { CSSProperties } from 'react';
import { rolePresentation } from '../lib/rolePresentation';

/** A compact, colour-coded role chip for admin lists and profile headings. */
export default function RoleBadge({
  role,
  showStudent = true,
}: {
  role: unknown;
  showStudent?: boolean;
}) {
  const presentation = rolePresentation(role);
  if (presentation.role === 'student' && !showStudent) return null;
  const style = {
    '--er-role-color': presentation.color,
    '--er-role-surface': presentation.surface,
    '--er-role-border': presentation.border,
  } as CSSProperties;
  return (
    <span
      className="er-role-badge"
      data-role={presentation.role}
      style={style}
      aria-label={`${presentation.label} role`}
      title={presentation.description}
    >
      {presentation.label}
    </span>
  );
}
