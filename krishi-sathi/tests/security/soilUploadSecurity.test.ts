import { describe, it, expect } from "vitest";
import { FileValidator } from "../../src/agentic/soil/fileValidator";

describe("Soil Report Upload Security (M1.3 Phase 3)", () => {
  it("rejects an executable disguised with a .pdf extension (magic signature check)", () => {
    // Windows PE executable header: "MZ" (0x4D, 0x5A)
    const fakePdf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

    expect(() => {
      FileValidator.validate(fakePdf, "malicious_script.pdf", "application/pdf");
    }).toThrow(/Invalid file signature/);
  });

  it("rejects an HTML script disguised with a .png extension", () => {
    const fakeImage = Buffer.from("<script>alert('xss')</script>");

    expect(() => {
      FileValidator.validate(fakeImage, "avatar.png", "image/png");
    }).toThrow(/Invalid file signature/);
  });

  it("enforces maximum file size limit (10 MB)", () => {
    const smallBuffer = Buffer.from("%PDF-1.4 mock content");
    // Should succeed with custom 100-byte limit
    expect(() => {
      FileValidator.validate(smallBuffer, "small.pdf", "application/pdf", { maxFileSizeBytes: 100 });
    }).not.toThrow();

    // Should fail if buffer exceeds custom limit
    expect(() => {
      FileValidator.validate(smallBuffer, "overflow.pdf", "application/pdf", { maxFileSizeBytes: 10 });
    }).toThrow(/File size .* exceeds allowed limit/);
  });

  it("sanitizes filenames and neutralizes directory traversal sequences", () => {
    const validPdf = Buffer.from("%PDF-1.4 standard content");
    const validated = FileValidator.validate(
      validPdf,
      "../../../../etc/shadow/malicious.pdf",
      "application/pdf"
    );

    expect(validated.sanitizedFileName).not.toContain("../");
    expect(validated.sanitizedFileName).not.toContain("/");
    expect(validated.sanitizedFileName).toBe("malicious.pdf");
    expect(validated.internalFileId.startsWith("file_")).toBe(true);
  });

  it("rejects zero-byte empty uploads", () => {
    expect(() => {
      FileValidator.validate(Buffer.alloc(0), "empty.pdf");
    }).toThrow(/Uploaded file is empty/);
  });
});
