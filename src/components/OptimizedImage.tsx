import { useState } from 'react';
import {
  NEUTRAL_IMAGE_PLACEHOLDER,
  buildSrcSet,
  imageCdnEnabled,
  isLocalImagePath,
  isRemoteImage,
  safeImageUrl,
  sizesFor,
  transformedImageUrl,
  widthsFor,
  type ImageEnvironment,
} from '../lib/imagePipeline';

/**
 * The one image component.
 *
 * `<picture>` with AVIF and WebP sources (the Image CDN generates both from the
 * original), a single `<img>` fallback, explicit `width`/`height` so the layout
 * never shifts, `decoding="async"` everywhere, and `loading="lazy"` below the
 * fold. The fallback is the original file, so a build without a CDN still shows
 * the image rather than a broken request.
 *
 * A remote image is passed through untouched and marked
 * `referrerPolicy="no-referrer"` — it belongs to whoever published it, and
 * `attribution` is how the page says so. On failure the component renders the
 * neutral placeholder drawing, never a stock photograph of a different place.
 */

export interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  /** The layout slot, in CSS pixels. Drives the generated widths. */
  width: number;
  height: number;
  layout?: 'card' | 'row' | 'hero' | 'article';
  sizes?: string;
  /** Above-the-fold images: eager + high priority. Never the default. */
  priority?: boolean;
  className?: string;
  /** Shown when there is no image at all, e.g. a category name. */
  placeholderLabel?: string;
  /** “Image: University of X” — never a claim that EduReach owns it. */
  attribution?: string;
  /** Overridable for tests and for a page that knows it has no CDN. */
  environment?: ImageEnvironment;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  layout = 'card',
  sizes,
  priority = false,
  className,
  placeholderLabel,
  attribution,
  environment,
}: OptimizedImageProps) {
  const [failed, setFailed] = useState(false);
  const safe = safeImageUrl(src);
  const cdn = imageCdnEnabled(environment);
  const transformable = Boolean(safe && isLocalImagePath(safe) && cdn);
  const remote = isRemoteImage(safe);
  const sizesValue = sizes ?? sizesFor(layout);
  const widths = widthsFor(width);
  const aspect = height > 0 ? `auto ${width} / ${height}` : undefined;

  if (!safe || failed) {
    return (
      <span
        className={`er-image-placeholder ${className || ''}`.trim()}
        style={{ aspectRatio: aspect }}
        role="img"
        aria-label={alt}
      >
        <img src={NEUTRAL_IMAGE_PLACEHOLDER} alt="" width={width} height={height} loading="lazy" decoding="async" aria-hidden="true" />
        {placeholderLabel && <small aria-hidden="true">{placeholderLabel}</small>}
      </span>
    );
  }

  const avifSrcSet = transformable ? buildSrcSet(safe, widths, { format: 'avif' }) : '';
  const webpSrcSet = transformable ? buildSrcSet(safe, widths, { format: 'webp' }) : '';
  // The `src` is the largest WebP variant, so a browser that ignores `srcset`
  // still gets a correctly-sized, modern file rather than the original PNG.
  const fallbackSrc = transformable
    ? transformedImageUrl(safe, { width: widths[widths.length - 1], format: 'webp' })
    : safe;

  return (
    <span className={`er-image ${className || ''}`.trim()} style={{ aspectRatio: aspect }}>
      <picture>
        {avifSrcSet && <source type="image/avif" srcSet={avifSrcSet} sizes={sizesValue} />}
        {webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} sizes={sizesValue} />}
        <img
          src={fallbackSrc}
          srcSet={webpSrcSet || undefined}
          sizes={webpSrcSet ? sizesValue : undefined}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          // `fetchPriority` is React 19's camelCase prop; the DOM attribute is
          // `fetchpriority` and only matters for the one eager image per page.
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy={remote ? 'no-referrer' : undefined}
          onError={() => setFailed(true)}
        />
      </picture>
      {attribution && <small className="er-image-attribution">{attribution}</small>}
    </span>
  );
}
