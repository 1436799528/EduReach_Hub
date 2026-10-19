declare module 'pdf-parse/lib/pdf-parse.js' {
  export type PdfParseResult = { text: string; numpages: number; info?: Record<string, unknown>; metadata?: unknown };
  export default function pdfParse(
    data: Buffer | Uint8Array,
    options?: { max?: number; version?: string },
  ): Promise<PdfParseResult>;
}
