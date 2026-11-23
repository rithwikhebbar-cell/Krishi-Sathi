import { describe, it, expect, beforeEach } from "vitest";
import { SoilRepository, InMemorySoilRepository } from "../../src/agentic/soil/soilRepository";
import { FarmerApprovalService } from "../../src/agentic/soil/farmerApprovalService";
import { FileValidator } from "../../src/agentic/soil/fileValidator";
import { SoilReportExtractor } from "../../src/agentic/soil/soilReportExtractor";

describe("FarmerApprovalService & Soil Repository Workflow (M1.3 Phase 4)", () => {
  let repository: SoilRepository;
  let service: FarmerApprovalService;

  beforeEach(() => {
    SoilRepository.setInstance(new InMemorySoilRepository());
    repository = new SoilRepository();
    service = new FarmerApprovalService();
  });

  const validPdfBuffer = Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n` +
      `4 0 obj\n<< /Length 200 >>\nstream\n` +
      `BT\n` +
      `(pH: 7.2) Tj\n` +
      `(Electrical Conductivity: 0.38 dS/m) Tj\n` +
      `(Organic Carbon: 0.52 %) Tj\n` +
      `(Available Nitrogen: 275 kg/ha) Tj\n` +
      `(Available Phosphorus: 19.5 kg/ha_P2O5) Tj\n` +
      `(Available Potassium: 165 kg/ha_K2O) Tj\n` +
      `ET\nendstream\nendobj\nxref\n0 5\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
  );

  it("enforces that unapproved reports do NOT modify the field's active soil profile", async () => {
    const field = await repository.createField({
      farmerId: "farmer-01",
      name: "South Plot",
      areaAcres: 5.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    expect(field.activeSoilProfile).toBeNull();
    expect(field.totalHistoricalSoilTests).toBe(0);

    const file = FileValidator.validate(validPdfBuffer, "report.pdf");
    const extraction = await SoilReportExtractor.extract(file, {
      fieldId: field.id,
      farmerId: "farmer-01",
    });

    await repository.saveReport(extraction);

    // Active profile MUST still be null!
    const updatedField = await repository.getFieldOrThrow(field.id);
    expect(updatedField.activeSoilProfile).toBeNull();
    const history = await repository.getHistory(field.id);
    expect(history.length).toBe(0);
  });

  it("successfully approves a report and creates an immutable historical record", async () => {
    const field = await repository.createField({
      farmerId: "farmer-01",
      name: "South Plot",
      areaAcres: 5.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    const file = FileValidator.validate(validPdfBuffer, "report.pdf");
    const extraction = await SoilReportExtractor.extract(file, {
      fieldId: field.id,
      farmerId: "farmer-01",
    });
    await repository.saveReport(extraction);

    const result = await service.approve(
      {
        reportId: extraction.id,
        action: "APPROVE",
        reviewerId: "farmer-01",
        notes: "Approved after verifying with physical card",
      },
      "farmer-01"
    );

    expect(result.updatedReport.approvalProvenance.status).toBe("APPROVED");
    expect(result.historicalRecord.isImmutable).toBe(true);

    // Check active profile on field
    const fieldAfterApproval = await repository.getFieldOrThrow(field.id);
    expect(fieldAfterApproval.activeSoilProfile).not.toBeNull();
    expect(fieldAfterApproval.activeSoilProfile?.parameters.chemical.ph.value).toBe(7.2);
    expect(fieldAfterApproval.totalHistoricalSoilTests).toBe(1);

    // Check historical snapshot
    const history = await repository.getHistory(field.id);
    expect(history.length).toBe(1);
    expect(history[0].recordId).toBe(result.historicalRecord.recordId);
  });

  it("applies farmer manual corrections during the approval step", async () => {
    const field = await repository.createField({
      farmerId: "farmer-01",
      name: "South Plot",
      areaAcres: 5.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    const file = FileValidator.validate(validPdfBuffer, "report.pdf");
    const extraction = await SoilReportExtractor.extract(file, {
      fieldId: field.id,
      farmerId: "farmer-01",
    });
    await repository.saveReport(extraction);

    // Farmer notices pH was extracted as 7.2 but lab card says 7.8
    const result = await service.approve(
      {
        reportId: extraction.id,
        action: "APPROVE",
        reviewerId: "farmer-01",
        corrections: {
          ph: {
            value: 7.8,
            reason: "Extracted value 7.2 corrected to 7.8 from physical stamp",
          },
        },
      },
      "farmer-01"
    );

    expect(result.approvedProfile.parameters.chemical.ph.value).toBe(7.8);
    expect(result.approvedProfile.approvalProvenance.editedFields).toContain("ph");
    expect(result.updatedReport.candidates.ph.farmerCorrection?.correctedValue).toBe(7.8);
  });

  it("rejects unauthorized approval attempts from another farmer", async () => {
    const field = await repository.createField({
      farmerId: "farmer-01",
      name: "Field A",
      areaAcres: 3.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    const file = FileValidator.validate(validPdfBuffer, "report.pdf");
    const extraction = await SoilReportExtractor.extract(file, {
      fieldId: field.id,
      farmerId: "farmer-01",
    });
    await repository.saveReport(extraction);

    // Farmer-02 attempts to approve Farmer-01's report
    await expect(
      service.approve(
        {
          reportId: extraction.id,
          action: "APPROVE",
          reviewerId: "farmer-02",
        },
        "farmer-02"
      )
    ).rejects.toThrow(/not authorized to access or modify soil report/);
  });

  it("prevents duplicate approval of an already approved report", async () => {
    const field = await repository.createField({
      farmerId: "farmer-01",
      name: "Field B",
      areaAcres: 4.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    const file = FileValidator.validate(validPdfBuffer, "report.pdf");
    const extraction = await SoilReportExtractor.extract(file, {
      fieldId: field.id,
      farmerId: "farmer-01",
    });
    await repository.saveReport(extraction);

    await service.approve({ reportId: extraction.id, action: "APPROVE", reviewerId: "farmer-01" }, "farmer-01");

    // Second approval attempt must fail
    await expect(
      service.approve({ reportId: extraction.id, action: "APPROVE", reviewerId: "farmer-01" }, "farmer-01")
    ).rejects.toThrow(/has already been approved/);
  });

  it("handles rejection without modifying the active profile", async () => {
    const field = await repository.createField({
      farmerId: "farmer-01",
      name: "Field C",
      areaAcres: 4.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    const file = FileValidator.validate(validPdfBuffer, "report.pdf");
    const extraction = await SoilReportExtractor.extract(file, {
      fieldId: field.id,
      farmerId: "farmer-01",
    });
    await repository.saveReport(extraction);

    const rejected = await service.reject(
      extraction.id,
      "farmer-01",
      "Scanned page is blurred and illegible"
    );

    expect(rejected.approvalProvenance.status).toBe("REJECTED");
    expect(rejected.approvalProvenance.rejectionReason).toBe("Scanned page is blurred and illegible");

    // Active profile on field remains null
    const fieldAfterRejection = await repository.getFieldOrThrow(field.id);
    expect(fieldAfterRejection.activeSoilProfile).toBeNull();
    const history = await repository.getHistory(field.id);
    expect(history.length).toBe(0);
  });
});
