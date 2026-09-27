import { useState } from 'react';

export type BrandLogoVariant = 'full' | 'mark' | 'reversed' | 'monochrome' | 'app';

const BRAND_LOGO_SRC: Record<BrandLogoVariant, string> = {
  full: '/logo/edureach-hub.svg',
  mark: '/logo/edureach-hub-mark.svg',
  reversed: '/logo/edureach-hub-reversed.svg',
  monochrome: '/logo/edureach-hub-monochrome.svg',
  app: '/logo/edureach-hub-app-icon.svg',
};

export default function BrandLogo({
  height = 32,
  radius = 8,
  variant = 'full',
}: {
  height?: number;
  radius?: number | string;
  variant?: BrandLogoVariant;
}) {
  const [failed, setFailed] = useState(false);
  const src = BRAND_LOGO_SRC[variant];

  if (failed) {
    return (
      <span className="er-logo-fallback" style={{ height, minWidth: height, borderRadius: radius }} aria-hidden="true">
        ER
      </span>
    );
  }

  return (
    <img
      src={src}
      alt="EduReach Hub"
      height={height}
      onError={() => setFailed(true)}
      style={{
        width: 'auto',
        height,
        maxWidth: variant === 'mark' || variant === 'app' ? `${height}px` : '220px',
        objectFit: 'contain',
        borderRadius: radius,
        display: 'block',
        flex: 'none',
      }}
    />
  );
}
