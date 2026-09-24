export const BRAND_LOGO_SRC = '/icons/edureach-icon.svg';

export default function BrandLogo({ height = 32, radius = 8 }: { height?: number; radius?: number | string }) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="EduReach Hub NG"
      height={height}
      width={height}
      style={{ width: height, height, maxWidth: '220px', objectFit: 'contain', borderRadius: radius, display: 'block', flex: 'none' }}
    />
  );
}
