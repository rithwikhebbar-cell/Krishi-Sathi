import { inflateSync } from "zlib";

export interface PdfExtractionResult {
  extractedText: string;
  isScannedOrImageOnly: boolean;
  pageCount: number;
  warnings: string[];
}

export class NativePdfTextExtractor {
  /**
   * Lightweight digital PDF text stream extractor using native Node.js zlib decompression.
   * Decodes /FlateDecode content streams and extracts PostScript text runs (Tj, TJ, ').
   * Identifies whether the PDF is a digital text document or a scanned image wrapper.
   */
  public static extractText(buffer: Buffer): PdfExtractionResult {
    const warnings: string[] = [];
    const textChunks: string[] = [];
    let pageCount = 0;

    const rawPdf = buffer.toString("binary");

    // Estimate page count via /Type /Page occurrences
    const pageMatches = rawPdf.match(/\/Type\s*\/Page\b/g);
    pageCount = pageMatches ? pageMatches.length : 1;

    // Find all streams: stream ... endstream
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(rawPdf)) !== null) {
      const streamContentBinary = match[1];
      const streamBuffer = Buffer.from(streamContentBinary, "binary");

      let decompressed = "";
      try {
        // Most PDF streams use standard FlateDecode (zlib deflate)
        const unzipped = inflateSync(streamBuffer);
        decompressed = unzipped.toString("latin1");
      } catch {
        // Uncompressed ASCII stream fallback
        decompressed = streamContentBinary;
      }

      // Extract text operands:
      // (Hello World) Tj
      // [(Hello) -20 (World)] TJ
      // (Text) '
      const tjMatches = decompressed.matchAll(/\(([^)]*)\)\s*(?:Tj|')/g);
      for (const tj of tjMatches) {
        const cleaned = this.unescapePdfText(tj[1]);
        if (cleaned) textChunks.push(cleaned);
      }

      const arrayTjMatches = decompressed.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
      for (const atj of arrayTjMatches) {
        const innerStrings = atj[1].matchAll(/\(([^)]*)\)/g);
        const joined = Array.from(innerStrings)
          .map((m) => this.unescapePdfText(m[1]))
          .join("");
        if (joined) textChunks.push(joined);
      }
    }

    const fullText = textChunks.join(" ").replace(/\s+/g, " ").trim();
    const isScannedOrImageOnly = fullText.length < 50;

    if (isScannedOrImageOnly) {
      warnings.push(
        "PDF document contains minimal or no digital text streams. Document identified as scanned PDF/image wrapper; routing to OCR/multimodal vision extraction."
      );
    }

    return {
      extractedText: fullText,
      isScannedOrImageOnly,
      pageCount,
      warnings,
    };
  }

  private static unescapePdfText(str: string): string {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .trim();
  }
}
