/**
 * Content sniffing for PDF uploads.
 *
 * The PDF bank endpoint must not trust the MIME string or extension the
 * client declares - `data:application/pdf;base64,...` or `.pdf` - alone.
 * A valid PDF file starts with the magic header `%PDF-` (0x25 0x50 0x44 0x46
 * 0x2D) in its first bytes. This helper checks that signature.
 *
 * Private storage and existing access controls (service_role only, inbox→routed,
 * destination checks, 10 MB limit, HTTPS source_url) are preserved; this adds
 * the missing bytes check.
 *
 * Small and dependency-free so it can be unit-tested directly.
 */

export function isPdfBuffer(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}
