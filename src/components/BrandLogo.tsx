import { useState } from 'react';

/** Official EduReach Hub logo. Falls back to the ER monogram tile until the
 *  production logo file is installed at this path. */
export const BRAND_LOGO_SRC = '/icons/edureach-logo.png';

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
      alt="EduReach Hub"
      height={height}
      onError={() => setFailed(true)}
      style={{ width: 'auto', height, borderRadius: radius, display: 'block', flex: 'none' }}
    />
  );
}
