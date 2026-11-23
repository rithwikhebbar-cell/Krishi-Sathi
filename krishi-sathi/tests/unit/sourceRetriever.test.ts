import { describe, expect, it } from "vitest";
import { SSRFValidator, SecurityError } from "../../src/agentic/retrieval/ssrfValidator";
import { DocumentParser } from "../../src/agentic/retrieval/documentParser";
import { SourceRetriever } from "../../src/agentic/retrieval/sourceRetriever";
import { SourceRegistry } from "../../src/agentic/retrieval/sourceRegistry";

describe("SourceRetriever and SSRF Protection", () => {
  describe("SSRFValidator", () => {
    it("blocks localhost, loopback IPs, and cloud metadata", () => {
      expect(() => SSRFValidator.validateUrl("http://localhost/secret")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("http://127.0.0.1:8080/admin")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("http://169.254.169.254/latest/meta-data/")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("http://metadata.google.internal/computeMetadata")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("http://[::1]/internal")).toThrow(SecurityError);
    });

    it("blocks private IPv4 subnet ranges", () => {
      expect(() => SSRFValidator.validateUrl("http://10.0.0.1/db")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("http://192.168.1.1/router")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("http://172.20.0.5/docker")).toThrow(SecurityError);
    });

    it("blocks non-HTTP protocols", () => {
      expect(() => SSRFValidator.validateUrl("file:///etc/passwd")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("gopher://127.0.0.1:70")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("ftp://files.internal")).toThrow(SecurityError);
    });

    it("blocks non-standard ports", () => {
      expect(() => SSRFValidator.validateUrl("http://icar.org.in:8443/test")).toThrow(SecurityError);
      expect(() => SSRFValidator.validateUrl("http://icar.org.in:22/ssh")).toThrow(SecurityError);
    });

    it("enforces approved domain whitelist", () => {
      const registry = new SourceRegistry();
      const approved = registry.getApprovedDomains();

      // Approved domains pass
      expect(SSRFValidator.validateUrl("https://icar.org.in/package", { allowedDomains: approved })).toBeDefined();
      expect(SSRFValidator.validateUrl("https://www.fao.org/land-water", { allowedDomains: approved })).toBeDefined();

      // Unauthorized domains fail
      expect(() =>
        SSRFValidator.validateUrl("https://unapproved-commercial-site.com/wheat", { allowedDomains: approved })
      ).toThrow(SecurityError);
    });
  });

  describe("DocumentParser", () => {
    it("extracts text, headings, tables, and numerical parameters while stripping scripts and boilerplate", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>ICAR Wheat Irrigation Guidelines</title>
            <script>alert("malicious script");</script>
            <style>body { font-size: 14px; }</style>
          </head>
          <body>
            <nav><a href="/home">Home</a></nav>
            <header>Banner</header>
            <h1>Critical Growth Stages</h1>
            <p>Wheat requires first irrigation at CRI stage (21 days). Seed rate is 100-125 kg/ha.</p>
            <h2>Water Requirements</h2>
            <p>Optimal soil pH between 6.0 to 7.5. Total irrigation water 400-450 mm.</p>
            <table>
              <tr><th>Stage</th><th>Days</th></tr>
              <tr><td>CRI</td><td>21</td></tr>
              <tr><td>Tillering</td><td>45</td></tr>
            </table>
            <footer>Copyright 2026 ICAR</footer>
          </body>
        </html>
      `;

      const doc = DocumentParser.parseHtml(sampleHtml, "https://icar.org.in/wheat", "ICAR");

      expect(doc.title).toBe("ICAR Wheat Irrigation Guidelines");
      expect(doc.extractedText).toContain("Wheat requires first irrigation at CRI stage");
      expect(doc.extractedText).not.toContain("alert");
      expect(doc.headings).toContain("Critical Growth Stages");
      expect(doc.headings).toContain("Water Requirements");
      expect(doc.tables).toHaveLength(1);
      expect(doc.tables[0]).toContain("| CRI | 21 |");
      expect(doc.numericalParameters?.seed_rate).toBe("100-125 kg/ha");
      expect(doc.numericalParameters?.ph_range).toBe("6.0 to 7.5");
      expect(doc.contentHash).toBeDefined();
      expect(doc.extractionStatus).toBe("SUCCESS");
    });
  });

  describe("SourceRetriever Integration", () => {
    it("safely retrieves approved URLs and handles size limits", async () => {
      const mockFetch = async () => {
        return new Response("<html><head><title>FAO Soils</title></head><body><h1>Soil Health</h1><p>Optimal organic carbon > 0.75%.</p></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      };

      const retriever = new SourceRetriever(new SourceRegistry(), { fetchFn: mockFetch as any });
      const doc = await retriever.retrieveUrl("https://fao.org/soils");

      expect(doc.title).toBe("FAO Soils");
      expect(doc.extractedText).toContain("Optimal organic carbon");
      expect(doc.sourceInstitution).toContain("Food and Agriculture Organization");
    });

    it("handles PDF URLs by returning an unsupported format record without crashing", async () => {
      const mockFetch = async () => {
        return new Response("%PDF-1.4 dummy binary content", {
          status: 200,
          headers: { "content-type": "application/pdf" },
        });
      };

      const retriever = new SourceRetriever(new SourceRegistry(), { fetchFn: mockFetch as any });
      const doc = await retriever.retrieveUrl("https://icar.org.in/bulletin.pdf");

      expect(doc.documentType).toBe("UNSUPPORTED");
      expect(doc.extractionStatus).toBe("UNSUPPORTED_FORMAT");
      expect(doc.sourceUrl).toBe("https://icar.org.in/bulletin.pdf");
      expect(doc.extractionWarnings[0]).toContain("PDF binary document");
    });

    it("rejects responses exceeding maxBytes limit", async () => {
      const hugeHtml = "A".repeat(5000);
      const mockFetch = async () => new Response(hugeHtml, { status: 200, headers: { "content-type": "text/html" } });

      const retriever = new SourceRetriever(new SourceRegistry(), {
        maxBytes: 1000,
        fetchFn: mockFetch as any,
      });

      await expect(retriever.retrieveUrl("https://icar.org.in/huge")).rejects.toThrow(SecurityError);
    });
  });
});
