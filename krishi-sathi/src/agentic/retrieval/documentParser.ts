import { createHash } from "crypto";
import { NormalizedDocument } from "./types";

export class DocumentParser {
  /**
   * Cleans and normalizes raw HTML into structured agricultural document model.
   */
  static parseHtml(
    html: string,
    sourceUrl: string,
    institutionName: string
  ): NormalizedDocument {
    const warnings: string[] = [];

    // Check for PDF mentions or redirect hints
    if (html.toLowerCase().includes(".pdf") && html.length < 500) {
      warnings.push("Document appears to be a stub pointing to an external PDF download.");
    }

    // 1. Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1].trim() : "";
    const title = this.decodeHtmlEntities(rawTitle) || `Document from ${institutionName}`;

    // 2. Extract Headings (h1, h2, h3, h4)
    const headings: string[] = [];
    const headingMatches = html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi);
    for (const match of headingMatches) {
      const headingText = this.stripTags(match[1]).trim();
      if (headingText && !headings.includes(headingText)) {
        headings.push(headingText);
      }
    }

    // 3. Extract Tables
    const tables: string[] = [];
    const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);
    for (const match of tableMatches) {
      const tableContent = match[1];
      const tableRows: string[] = [];
      const rowMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      for (const rowMatch of rowMatches) {
        const cellMatches = rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
        const cells: string[] = [];
        for (const cellMatch of cellMatches) {
          cells.push(this.stripTags(cellMatch[1]).trim());
        }
        if (cells.length > 0) {
          tableRows.push(`| ${cells.join(" | ")} |`);
        }
      }
      if (tableRows.length > 0) {
        tables.push(tableRows.join("\n"));
      }
    }

    // 4. Remove scripts, styles, forms, nav, header, footer
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, " ");

    // 5. Replace paragraph/break tags with newlines
    cleaned = cleaned
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<br\s*[\/]?>/gi, "\n");

    // 6. Strip all remaining HTML tags
    cleaned = this.stripTags(cleaned);

    // 7. Decode HTML entities and normalize whitespace
    cleaned = this.decodeHtmlEntities(cleaned);
    const lines = cleaned
      .split("\n")
      .map((l) => l.trim().replace(/\s+/g, " "))
      .filter((l) => l.length > 0);

    const extractedText = lines.join("\n\n");

    // 8. Extract numerical agricultural parameters (e.g., pH, kg/ha, mm, °C)
    const numericalParameters: Record<string, string> = {};
    const agronomicPatterns = [
      { key: "seed_rate", regex: /(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:kg\/ha|kg\/acre|g\/m2))/i },
      { key: "irrigation_water", regex: /(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:mm|cm|litres|irrigations))/i },
      { key: "ph_range", regex: /(?:pH\s*(?:between\s*)?|soil\s*pH\s*)(\d+(?:\.\d+)?\s*(?:to|-)\s*\d+(?:\.\d+)?)/i },
      { key: "temperature_optimum", regex: /(\d+(?:\.\d+)?\s*(?:to|-|±)\s*\d+(?:\.\d+)?\s*°C)/i },
      { key: "npk_ratio", regex: /(\d+:\d+:\d+(?:\s*NPK|\s*N:P:K)?)/i },
    ];

    for (const pat of agronomicPatterns) {
      const match = extractedText.match(pat.regex);
      if (match) {
        numericalParameters[pat.key] = match[1];
      }
    }

    // 9. Compute content hash
    const normalizedForHash = `${sourceUrl}::${title}::${extractedText.slice(0, 5000)}`;
    const contentHash = createHash("sha256").update(normalizedForHash, "utf8").digest("hex");
    const docId = `doc_${contentHash.substring(0, 12)}`;

    return {
      id: docId,
      title,
      sourceInstitution: institutionName,
      sourceUrl,
      retrievedAt: new Date().toISOString(),
      documentType: "HTML",
      language: "en",
      extractedText,
      headings,
      tables,
      numericalParameters: Object.keys(numericalParameters).length > 0 ? numericalParameters : undefined,
      extractionStatus: extractedText.length > 50 ? "SUCCESS" : "PARTIAL",
      extractionWarnings: warnings,
      contentHash,
    };
  }

  static stripTags(str: string): string {
    return str.replace(/<[^>]*>/g, " ");
  }

  static decodeHtmlEntities(str: string): string {
    return str
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–");
  }
}
