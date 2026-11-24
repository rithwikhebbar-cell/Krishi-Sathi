import { describe, it, expect, beforeEach } from "vitest";
import { SoilRepository, InMemorySoilRepository } from "../../src/agentic/soil/soilRepository";
import { FarmerApprovalService } from "../../src/agentic/soil/farmerApprovalService";
import { FileValidator } from "../../src/agentic/soil/fileValidator";
import { SoilReportExtractor } from "../../src/agentic/soil/soilReportExtractor";
import { AgriculturalIntelligenceService } from "../../src/agentic/soil/agriculturalIntelligenceService";
import { MockModelProvider } from "../../src/agentic/providers/mockProvider";
import { ValidationError, UnauthorizedError } from "../../src/agentic/contracts/errors";

describe("Agricultural Intelligence & Advisory Workflow Integration (M1.3 Phase 5)", () => {
  let repository: SoilRepository;
  let approvalService: FarmerApprovalService;
  let intelligenceService: AgriculturalIntelligenceService;

  beforeEach(() => {
    SoilRepository.setInstance(new InMemorySoilRepository());
    repository = new SoilRepository();
    approvalService = new FarmerApprovalService();
    intelligenceService = new AgriculturalIntelligenceService({
      repository,
      modelProvider: new MockModelProvider(),
    });
  });

  const validSoilPdfBuffer = Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n` +
      `4 0 obj\n<< /Length 250 >>\nstream\n` +
      `BT\n` +
      `(pH: 7.3) Tj\n` +
      `(Electrical Conductivity: 0.35 dS/m) Tj\n` +
      `(Organic Carbon: 0.60 %) Tj\n` +
      `(Available Nitrogen: 280 kg/ha) Tj\n` +
      `(Available Phosphorus: 20.0 kg/ha_P2O5) Tj\n` +
      `(Available Potassium: 170 kg/ha_K2O) Tj\n` +
      `(Available Zinc: 0.65 ppm) Tj\n` +
      `ET\nendstream\nendobj\nxref\n0 5\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
  );

  it("strictly rejects generating an advisory if field has no approved active soil profile", async () => {
    const field = await repository.createField({
      farmerId: "farmer-alpha",
      name: "Field Zero",
      areaAcres: 4.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    await expect(
      intelligenceService.generateAdvisory(
        {
          fieldId: field.id,
          cropName: "WHEAT",
          targetYieldQuintalsPerHa: 50,
          croppingSeason: "RABI",
        },
        "farmer-alpha"
      )
    ).rejects.toThrow(/does not have an approved active soil profile/);
  });

  it("executes the complete end-to-end intelligence advisory flow with verified evidence and persistence", async () => {
    // 1. Create Field
    const field = await repository.createField({
      farmerId: "farmer-alpha",
      name: "Green Horizon",
      areaAcres: 5.0,
      location: { state: "Punjab", district: "Ludhiana" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    // 2. Upload, Extract, and Approve Report
    const validatedFile = FileValidator.validate(validSoilPdfBuffer, "report.pdf");
    const extraction = await SoilReportExtractor.extract(validatedFile, {
      fieldId: field.id,
      farmerId: "farmer-alpha",
    });
    await repository.saveReport(extraction);

    await approvalService.approve(
      {
        reportId: extraction.id,
        action: "APPROVE",
        reviewerId: "farmer-alpha",
        notes: "Verified against laboratory certificate",
      },
      "farmer-alpha"
    );

    // 3. Generate Advisory
    const advisory = await intelligenceService.generateAdvisory(
      {
        fieldId: field.id,
        cropName: "WHEAT",
        cropVariety: "HD-3086",
        targetYieldQuintalsPerHa: 50,
        croppingSeason: "RABI",
        growthStage: "initial",
        organicManureTonnesPerHa: 5,
      },
      "farmer-alpha"
    );

    // 4. Verify Advisory Structure
    expect(advisory.id).toMatch(/^adv_/);
    expect(advisory.fieldId).toBe(field.id);
    expect(advisory.farmerId).toBe("farmer-alpha");
    expect(advisory.version).toBe(1);

    // Verify Deterministic Numbers
    expect(advisory.nutrientManagement.protectedNetNutrientRequirement.n).toBeGreaterThan(0);
    expect(advisory.nutrientManagement.protectedFertilizerDoses.length).toBeGreaterThan(0);
    expect(advisory.nutrientManagement.protectedFertilizerDoses.some((f) => f.productCode === "UREA")).toBe(true);

    // Verify Crop Water Demand
    expect(advisory.cropWaterAssessment).toBeDefined();
    expect(advisory.waterManagement.protectedEtcMmDay).toBeGreaterThan(0);

    // Verify Evidence Citations (ICAR / SAU)
    expect(advisory.evidenceAndLimitations.supportingSources.length).toBeGreaterThan(0);
    expect(
      advisory.evidenceAndLimitations.supportingSources.some((s) => s.title.includes("Wheat") || s.publisherOrInstitution.includes("ICAR"))
    ).toBe(true);

    // Verify Confidence
    expect(["HIGH", "MODERATE"]).toContain(advisory.confidence.overallCompleteness);
    expect(["HIGH", "MODERATE"]).toContain(advisory.confidence.soilDataQuality);

    // 5. Verify Persistence in Repository
    const persisted = await repository.getAdvisory(advisory.id);
    expect(persisted).toBeDefined();
    expect(persisted?.id).toBe(advisory.id);

    // 6. Verify History Retrieval
    const history = await repository.listAdvisoriesByField(field.id);
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(advisory.id);
  });

  it("blocks unauthorized farmers from generating or accessing field advisories", async () => {
    const field = await repository.createField({
      farmerId: "farmer-alpha",
      name: "Private Field",
      areaAcres: 3.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    // Farmer Beta attempts to generate advisory for Farmer Alpha's field
    await expect(
      intelligenceService.generateAdvisory(
        {
          fieldId: field.id,
          cropName: "WHEAT",
          targetYieldQuintalsPerHa: 45,
        },
        "farmer-beta"
      )
    ).rejects.toThrow(UnauthorizedError);
  });
});
