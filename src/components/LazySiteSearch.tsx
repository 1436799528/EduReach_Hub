import { lazy, Suspense } from 'react';
import type { SiteSearchProps } from './SiteSearch';
import '../site-search.css';

const InteractiveSiteSearch = lazy(() => import('./SiteSearch'));

export default function LazySiteSearch(props: SiteSearchProps) {
  const variant = props.variant || 'header';

  return (
    <Suspense fallback={<div className={`site-search site-search--${variant}`} aria-hidden="true" />}>
      <InteractiveSiteSearch {...props} />
    </Suspense>
  );
}
