import { describe, it, expect } from "vitest";
import { FileValidator } from "../../src/agentic/soil/fileValidator";
import { SoilReportExtractor } from "../../src/agentic/soil/soilReportExtractor";
import { MockModelProvider } from "../../src/agentic/providers/mockProvider";

describe("SoilReportExtractor & Normalization (M1.3 Phase 3)", () => {
  it("extracts and normalizes parameters from a digital soil report", async () => {
    // Generate valid mock PDF stream buffer containing digital text
    const sampleDigitalPdf = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
        `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n` +
        `4 0 obj\n<< /Length 280 >>\nstream\n` +
        `BT\n` +
        `(Soil Testing Laboratory Ludhiana) Tj\n` +
        `(Sample ID: SHC-2026-1049) Tj\n` +
        `(Date of Testing: 2026-11-21) Tj\n` +
        `(pH: 7.5) Tj\n` +
        `(Electrical Conductivity: 0.45 dS/m) Tj\n` +
        `(Organic Carbon: 0.62 %) Tj\n` +
        `(Available Nitrogen: 120 kg/acre) Tj\n` + // Needs normalization from kg/acre to kg/ha
        `(Available Phosphorus: 18.5 kg/ha_P2O5) Tj\n` +
        `(Available Potassium: 175 kg/ha_K2O) Tj\n` +
        `(Available Zinc: 0.48 ppm) Tj\n` +
        `ET\nendstream\nendobj\nxref\n0 5\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
    );

    const validatedFile = FileValidator.validate(sampleDigitalPdf, "soil_report_2026.pdf", "application/pdf");
    expect(validatedFile.format).toBe("PDF_DIGITAL");

    const extraction = await SoilReportExtractor.extract(validatedFile, {
      fieldId: "field-test-01",
      farmerId: "farmer-101",
    });

    expect(extraction.approvalProvenance.status).toBe("PENDING_APPROVAL");
    expect(extraction.labMetadata?.labName).toContain("Soil Testing Laboratory");
    expect(extraction.labMetadata?.sampleCode).toBe("SHC-2026-1049");

    // Check pH
    expect(extraction.candidates.ph).toBeDefined();
    expect(extraction.candidates.ph.parsedNumericValue).toBe(7.5);

    // Check Nitrogen unit conversion: 120 kg/acre * 2.47105 = 296.5 kg/ha
    expect(extraction.candidates.availableNitrogen).toBeDefined();
    expect(extraction.candidates.availableNitrogen.parsedNumericValue).toBe(120);
    expect(extraction.candidates.availableNitrogen.extractedUnit).toBe("kg/acre");
    expect(extraction.candidates.availableNitrogen.normalizedUnit).toBe("kg/ha");
    expect(extraction.candidates.availableNitrogen.normalizedValue).toBeCloseTo(296.5, 1);
    expect(extraction.candidates.availableNitrogen.extractionWarnings.some((w) => w.includes("Converted from kg/acre"))).toBe(true);

    // Check Zinc
    expect(extraction.candidates.availableZincPpm).toBeDefined();
    expect(extraction.candidates.availableZincPpm.normalizedValue).toBe(0.48);
  });

  it("extracts parameters from scanned images using multimodal vision provider", async () => {
    // Valid PNG signature: 8 bytes
    const mockImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    const validatedFile = FileValidator.validate(mockImageBuffer, "scanned_soil_card.png", "image/png");
    expect(validatedFile.format).toBe("IMAGE_PNG");

    const mockProvider = new MockModelProvider();
    const extraction = await SoilReportExtractor.extract(validatedFile, {
      fieldId: "field-vision-01",
      farmerId: "farmer-101",
      modelProvider: mockProvider,
    });

    expect(extraction.approvalProvenance.status).toBe("PENDING_APPROVAL");
    expect(extraction.candidates.ph.normalizedValue).toBe(7.4);
    expect(extraction.candidates.availableNitrogen.normalizedValue).toBe(290);
    expect(extraction.candidates.availablePhosphorus.normalizedValue).toBe(22.0);
    expect(extraction.candidates.availableZincPpm.normalizedValue).toBe(0.52);
  });

  it("handles molecular conversion of elemental P to P2O5 and elemental K to K2O", async () => {
    const rawPdf = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
        `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n` +
        `4 0 obj\n<< /Length 120 >>\nstream\n` +
        `BT\n` +
        `(Available Phosphorus: 10 kg/ha_P) Tj\n` +
        `(Available Potassium: 100 kg/ha_K) Tj\n` +
        `ET\nendstream\nendobj\nxref\n0 5\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
    );

    const validatedFile = FileValidator.validate(rawPdf, "elemental_report.pdf");
    const extraction = await SoilReportExtractor.extract(validatedFile, {
      fieldId: "field-elem",
      farmerId: "farmer-101",
    });

    // P -> P2O5: 10 * 2.29 = 22.9 kg/ha_P2O5
    expect(extraction.candidates.availablePhosphorus.normalizedValue).toBeCloseTo(22.9, 1);
    expect(extraction.candidates.availablePhosphorus.normalizedUnit).toBe("kg/ha_P2O5");

    // K -> K2O: 100 * 1.20 = 120 kg/ha_K2O
    expect(extraction.candidates.availablePotassium.normalizedValue).toBeCloseTo(120.0, 1);
    expect(extraction.candidates.availablePotassium.normalizedUnit).toBe("kg/ha_K2O");
  });
});
