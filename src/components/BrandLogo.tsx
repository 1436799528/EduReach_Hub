import { useState } from 'react';

export const BRAND_LOGO_SRC = 'https://cdn.phototourl.com/free/2026-09-21-ef5b6526-ef17-4517-9aab-443facfc3d90.png';

export default function BrandLogo({ height = 32, radius = 8 }: { height?: number; radius?: number | string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="er-logo-fallback" style={{ height, minWidth: height, borderRadius: radius }}>
        ER
      </span>
    );
  }

  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="EduReach Hub NG"
      height={height}
      onError={() => setFailed(true)}
      style={{ width: 'auto', height, maxWidth: '220px', objectFit: 'contain', borderRadius: radius, display: 'block', flex: 'none' }}
    />
  );
}
