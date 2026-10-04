/**
 * Content sniffing for admin image uploads (audit P3-3).
 *
 * The upload endpoint used to derive the stored object's type from the MIME
 * string the client put in the data URL — `data:image/png;base64,...` — and
 * never look at the bytes. Anything an authenticated editor could encode would
 * therefore be written to the public `admin-content` bucket labelled as an
 * image. The declared type is a claim; these PNG/JPEG/GIF/WebP signatures are
 * the bytes, and both must agree before an object is stored.
 *
 * Deliberately tiny and dependency-free so it can be unit-tested directly.
 */

export type ImageKind = 'png' | 'jpeg' | 'gif' | 'webp';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (bytes.length < start + length) return '';
  return String.fromCharCode(...bytes.slice(start, start + length));
}

/**
 * The image type the file's own bytes declare, or null when they match none of
 * the four formats the upload endpoint accepts.
 */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpeg';
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif';
  // WEBP is a RIFF container: 'RIFF' + 4 size bytes + 'WEBP'.
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  return null;
}

/**
 * True when the bytes really are the format the client declared. `jpeg` and
 * `jpg` are the same format, which is the only normalisation applied.
 */
export function matchesDeclaredImageType(bytes: Uint8Array, declaredKind: string): boolean {
  const declared = declaredKind.toLowerCase() === 'jpg' ? 'jpeg' : declaredKind.toLowerCase();
  const detected = detectImageKind(bytes);
  return detected !== null && detected === declared;
}
