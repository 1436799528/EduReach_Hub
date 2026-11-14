import { BadgeCheck } from 'lucide-react';

/**
 * The verification mark the design standard asks for: a visual check beside a
 * name, with an accessible label, instead of the words "Verified Student"
 * appended to the name itself.
 *
 * `label` is announced, not rendered by default. Pass `withLabel` when the
 * surface needs the words too (for example, a public profile with more room).
 */
export default function VerifiedBadge({
  label = 'Verified student',
  withLabel = false,
}: {
  label?: string;
  withLabel?: boolean;
}) {
  return (
    <span className="er-verified" role="img" aria-label={label} title={label}>
      <BadgeCheck size={withLabel ? 16 : 17} aria-hidden="true" />
      {withLabel && <span>{label}</span>}
    </span>
  );
}
