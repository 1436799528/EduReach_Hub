import { ArrowRight } from 'lucide-react';

export default function SectionHead({
  title,
  href,
  linkLabel = 'View all',
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="er-section-head">
      <h2>{title}</h2>
      {href && (
        <a href={href}>
          {linkLabel} <ArrowRight size={12} />
        </a>
      )}
    </div>
  );
}
