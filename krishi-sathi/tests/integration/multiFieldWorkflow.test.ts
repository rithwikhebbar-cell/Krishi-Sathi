import { describe, it, expect, beforeEach } from "vitest";
import { SoilRepository, InMemorySoilRepository } from "../../src/agentic/soil/soilRepository";
import { FarmerApprovalService } from "../../src/agentic/soil/farmerApprovalService";
import { FileValidator } from "../../src/agentic/soil/fileValidator";
import { SoilReportExtractor } from "../../src/agentic/soil/soilReportExtractor";
import { SoilNutrientEngine } from "../../src/agentic/engines/soilNutrientEngine";
import { UnauthorizedError, ValidationError } from "../../src/agentic/contracts/errors";

describe("Multi-Field & Historical Soil Workflow Integration (M1.3 Phase 4)", () => {
  let repository: SoilRepository;
  let approvalService: FarmerApprovalService;
  let nutrientEngine: SoilNutrientEngine;

  beforeEach(() => {
    SoilRepository.setInstance(new InMemorySoilRepository());
    repository = new SoilRepository();
    approvalService = new FarmerApprovalService();
    nutrientEngine = new SoilNutrientEngine();
  });

  const pdfReportBuffer = Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n` +
      `4 0 obj\n<< /Length 200 >>\nstream\n` +
      `BT\n` +
      `(pH: 7.4) Tj\n` +
      `(Electrical Conductivity: 0.35 dS/m) Tj\n` +
      `(Organic Carbon: 0.58 %) Tj\n` +
      `(Available Nitrogen: 280 kg/ha) Tj\n` +
      `(Available Phosphorus: 22.0 kg/ha_P2O5) Tj\n` +
      `(Available Potassium: 160 kg/ha_K2O) Tj\n` +
      `ET\nendstream\nendobj\nxref\n0 5\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
  );

  it("supports managing multiple fields per farmer with strict ownership isolation", async () => {
    // Farmer Alpha creates two fields
    const fieldAlpha1 = await repository.createField({
      farmerId: "farmer-alpha",
      name: "North Orchard",
      areaAcres: 5.0,
      location: { state: "Punjab", district: "Ludhiana" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    const fieldAlpha2 = await repository.createField({
      farmerId: "farmer-alpha",
      name: "South Wheat Basin",
      areaAcres: 8.0,
      location: { state: "Punjab", district: "Ludhiana" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "SANDY_LOAM",
      irrigationSource: "CANAL",
    });

    // Farmer Beta creates one field
    const fieldBeta = await repository.createField({
      farmerId: "farmer-beta",
      name: "Beta Cotton Acreage",
      areaAcres: 12.0,
      location: { state: "Maharashtra", district: "Wardha" },
      primarySoilType: "BLACK_REGUR",
      primaryTextureClass: "CLAY_LOAM",
      irrigationSource: "RAIN_FED",
    });

    // 1. List fields for Farmer Alpha
    const alphaFields = await repository.listFieldsByFarmer("farmer-alpha");
    expect(alphaFields.length).toBe(2);
    expect(alphaFields.map((f) => f.name)).toContain("North Orchard");
    expect(alphaFields.map((f) => f.name)).toContain("South Wheat Basin");

    // 2. List fields for Farmer Beta
    const betaFields = await repository.listFieldsByFarmer("farmer-beta");
    expect(betaFields.length).toBe(1);
    expect(betaFields[0].name).toBe("Beta Cotton Acreage");

    // 3. Farmer Beta cannot update Farmer Alpha's field
    await expect(
      repository.updateField(fieldAlpha1.id, { name: "Hijacked Orchard" }, "farmer-beta")
    ).rejects.toThrow(UnauthorizedError);

    // 4. Farmer Beta cannot archive Farmer Alpha's field
    await expect(
      repository.archiveField(fieldAlpha1.id, "farmer-beta")
    ).rejects.toThrow(UnauthorizedError);

    // 5. Farmer Alpha archives South Wheat Basin
    const archived = await repository.archiveField(fieldAlpha2.id, "farmer-alpha");
    expect((archived as unknown as { isArchived: boolean }).isArchived).toBe(true);

    // 6. Default list excludes archived fields
    const activeAlphaFields = await repository.listFieldsByFarmer("farmer-alpha");
    expect(activeAlphaFields.length).toBe(1);
    expect(activeAlphaFields[0].id).toBe(fieldAlpha1.id);

    // 7. List with includeArchived returns all fields
    const allAlphaFields = await repository.listFieldsByFarmer("farmer-alpha", { includeArchived: true });
    expect(allAlphaFields.length).toBe(2);
  });

  it("handles the complete multi-field upload, approval, history, and advisory flow", async () => {
    // 1. Create two fields for Farmer Alice
    const field1 = await repository.createField({
      farmerId: "farmer-alice",
      name: "Plot One",
      areaAcres: 4.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    const field2 = await repository.createField({
      farmerId: "farmer-alice",
      name: "Plot Two",
      areaAcres: 6.0,
      location: { state: "Punjab", district: "Bathinda" },
      primarySoilType: "ALLUVIAL",
      primaryTextureClass: "LOAM",
      irrigationSource: "TUBEWELL",
    });

    // 2. Upload and extract report for Field 1
    const file = FileValidator.validate(pdfReportBuffer, "test_report.pdf");
    const extraction = await SoilReportExtractor.extract(file, {
      fieldId: field1.id,
      farmerId: "farmer-alice",
    });
    await repository.saveReport(extraction);

    // Verify both fields start with null active soil profile
    let f1 = await repository.getFieldOrThrow(field1.id);
    let f2 = await repository.getFieldOrThrow(field2.id);
    expect(f1.activeSoilProfile).toBeNull();
    expect(f2.activeSoilProfile).toBeNull();

    // 3. Farmer Alice reviews and approves Field 1 report with corrections
    const approvalResult = await approvalService.approve(
      {
        reportId: extraction.id,
        action: "APPROVE",
        reviewerId: "farmer-alice",
        corrections: {
          availableNitrogen: {
            value: 295,
            reason: "Laboratory revised available N reading from retest",
          },
        },
      },
      "farmer-alice"
    );

    expect(approvalResult.updatedReport.approvalProvenance.status).toBe("APPROVED");
    expect(approvalResult.historicalRecord.isImmutable).toBe(true);

    // 4. Verify Field 1 active profile is updated while Field 2 remains unpolluted
    f1 = await repository.getFieldOrThrow(field1.id);
    f2 = await repository.getFieldOrThrow(field2.id);

    expect(f1.activeSoilProfile).not.toBeNull();
    expect(f1.activeSoilProfile?.parameters.primary.availableNitrogen.value).toBe(295);
    expect(f1.totalHistoricalSoilTests).toBe(1);

    expect(f2.activeSoilProfile).toBeNull();
    expect(f2.totalHistoricalSoilTests).toBe(0);

    // 5. Historical records for Field 1 are durable and immutable
    const historyF1 = await repository.getHistory(field1.id);
    expect(historyF1.length).toBe(1);
    expect(historyF1[0].recordId).toBe(approvalResult.historicalRecord.recordId);
    expect(historyF1[0].parameters.primary.availableNitrogen.value).toBe(295);

    // 6. Running nutrient advisory on Field 1 succeeds with active approved profile
    const recommendation = nutrientEngine.calculate({
      fieldId: f1.id,
      cropName: "WHEAT",
      cropVariety: "HD-2967",
      targetYieldQuintalsPerHa: 50,
      croppingSeason: "RABI",
      isIrrigated: true,
      organicManureTonnesPerHa: 5,
      greenManuringDone: false,
      previousCropLegume: false,
      soilParameters: f1.activeSoilProfile!.parameters,
    });

    expect(recommendation.fertilizerRecommendations.some((f) => f.productCode === "UREA")).toBe(true);
    expect(recommendation.fertilizerRecommendations.some((f) => f.productCode === "DAP")).toBe(true);
    expect(recommendation.netRequirementKgPerHa.n).toBeGreaterThan(0);

    // 7. Duplicate approval of the same report fails
    await expect(
      approvalService.approve(
        {
          reportId: extraction.id,
          action: "APPROVE",
          reviewerId: "farmer-alice",
        },
        "farmer-alice"
      )
    ).rejects.toThrow(ValidationError);
  });
});
