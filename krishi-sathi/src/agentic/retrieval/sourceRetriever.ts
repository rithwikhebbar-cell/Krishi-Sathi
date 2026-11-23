import { SSRFValidator, SecurityError } from "./ssrfValidator";
import { SourceRegistry } from "./sourceRegistry";
import { DocumentParser } from "./documentParser";
import { NormalizedDocument, RetrievalOptions } from "./types";
import { TimeoutError, ValidationError } from "../contracts/errors";

export class SourceRetriever {
  private readonly registry: SourceRegistry;
  private readonly maxBytes: number;
  private readonly defaultTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    registry = new SourceRegistry(),
    options: {
      maxBytes?: number;
      defaultTimeoutMs?: number;
      fetchFn?: typeof fetch;
    } = {}
  ) {
    this.registry = registry;
    this.maxBytes = options.maxBytes ?? 2 * 1024 * 1024; // 2MB max
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Safely retrieves an agricultural document with SSRF protection, size caps, and redirects.
   */
  async retrieveUrl(
    targetUrl: string,
    options: RetrievalOptions = {}
  ): Promise<NormalizedDocument> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const signal = options.signal;

    if (signal?.aborted) {
      throw new Error("Retrieval cancelled by AbortSignal");
    }

    // SSRF validation of initial target URL against approved agricultural domains
    const approvedDomains = this.registry.getApprovedDomains();
    const validatedUrl = SSRFValidator.validateUrl(targetUrl, {
      allowedDomains: approvedDomains,
    });

    const institution = this.registry.getSourceForHost(validatedUrl.hostname)?.institutionName || "Agricultural Research Source";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortHandler = () => controller.abort();

    if (signal) {
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    try {
      let currentUrl = validatedUrl.toString();
      let response: Response;
      let redirectsCount = 0;
      const MAX_REDIRECTS = 3;

      // Handle redirects manually to enforce SSRF validation at every hop
      while (true) {
        response = await this.fetchFn(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "KrishiSathiAgriculturalAgent/1.0 (+https://krishi-sathi.internal; academic/research)",
            "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9",
          },
        });

        // Check for redirect status
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          redirectsCount++;
          if (redirectsCount > MAX_REDIRECTS) {
            throw new SecurityError(`Exceeded maximum redirect limit of ${MAX_REDIRECTS}`);
          }

          const redirectLocation = response.headers.get("location");
          if (!redirectLocation) {
            throw new ValidationError("Redirect response missing 'Location' header");
          }

          // Re-validate target URL with SSRF checks
          const resolvedRedirect = new URL(redirectLocation, currentUrl);
          SSRFValidator.validateUrl(resolvedRedirect.toString(), {
            allowedDomains: approvedDomains,
          });

          currentUrl = resolvedRedirect.toString();
          continue;
        }

        break;
      }

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} retrieving '${currentUrl}': ${response.statusText}`);
      }

      // Check Content-Type
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/pdf")) {
        // PDF detected: do not crash, return structured unsupported format
        return {
          id: `doc_pdf_${Date.now()}`,
          title: `PDF Document at ${currentUrl}`,
          sourceInstitution: institution,
          sourceUrl: currentUrl,
          retrievedAt: new Date().toISOString(),
          documentType: "UNSUPPORTED",
          language: "en",
          extractedText: `[PDF document detected at ${currentUrl}. PDF binary parsing is not supported in M1.2. The source URL has been preserved for agricultural provenance.]`,
          headings: [],
          tables: [],
          extractionStatus: "UNSUPPORTED_FORMAT",
          extractionWarnings: ["PDF binary document: text extraction unsupported in M1.2."],
          contentHash: "pdf_unparsed",
        };
      }

      if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
        throw new SecurityError(`Unsupported content type '${contentType}'. Only HTML and text documents are allowed.`);
      }

      // Read response body with size limit enforcement
      const rawText = await response.text();
      if (rawText.length > this.maxBytes) {
        throw new SecurityError(`Document size (${rawText.length} bytes) exceeds limit of ${this.maxBytes} bytes`);
      }

      return DocumentParser.parseHtml(rawText, currentUrl, institution);
    } catch (err: unknown) {
      if ((err as any)?.name === "AbortError" && !signal?.aborted) {
        throw new TimeoutError(`Document retrieval from '${targetUrl}'`, timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  }
}
