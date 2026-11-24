import { describe, it, expect } from "vitest";
import { AdvisoryIntegrityValidator } from "../../src/agentic/soil/advisoryIntegrityValidator";
import { EvidenceManager } from "../../src/agentic/evidence/evidenceManager";
import { AgriculturalAdvisory } from "../../src/agentic/contracts/soil/advisoryTypes";
import { CropNutrientOutput } from "../../src/agentic/contracts/soil/nutrientTypes";
import { CropWaterOutput } from "../../src/agentic/engines/types";

describe("AdvisoryIntegrityValidator & Deterministic Safeguards (M1.3 Phase 5)", () => {
  const evidenceManager = new EvidenceManager();
  const validEvidence = evidenceManager.register({
    taskId: "task-01",
    sourceUri: "https://icar.org.in/iiwbr-wheat-2024",
    sourceTitle: "ICAR IIWBR Wheat Package",
    publisher: "ICAR",
    excerpt: "Apply 50% N basal and remaining in two equal splits.",
    evidenceType: "RESEARCH_DOCUMENT",
    retrievalMethod: "test",
    isUntrusted: true,
  });

  const mockDeterministicCalc: CropNutrientOutput = {
    calculationId: "calc_01",
    cropName: "WHEAT",
    fieldId: "field_01",
    targetYieldQuintalsPerHa: 50,
    methodology: "STCR_TARGET_YIELD",
    calculationStatus: "COMPLETED",
    stcrEquationsApplied: ["N = 4.41*T - 0.40*SN"],
    netRequirementKgPerHa: { n: 125.0, p2o5: 58.0, k2o: 42.0 },
    netRequirementKgPerAcre: { n: 50.6, p2o5: 23.5, k2o: 17.0 },
    classifications: [],
    fertilizerRecommendations: [
      {
        productCode: "UREA",
        commercialName: "Urea (46% N)",
        quantityKgPerHa: 220.0,
        quantityKgPerAcre: 89.0,
        nutrientGrade: { nPercent: 46, p2o5Percent: 0, k2oPercent: 0 },
        nutrientsSuppliedKgPerHa: { n: 101.2, p2o5: 0, k2o: 0 },
        applicationMethod: "Split broadcast",
      },
      {
        productCode: "DAP",
        commercialName: "Di-Ammonium Phosphate (18:46:0)",
        quantityKgPerHa: 126.0,
        quantityKgPerAcre: 51.0,
        nutrientGrade: { nPercent: 18, p2o5Percent: 46, k2oPercent: 0 },
        nutrientsSuppliedKgPerHa: { n: 22.7, p2o5: 58.0, k2o: 0 },
        applicationMethod: "Basal drill",
      },
    ],
    splitSchedules: [],
    limitationsAndAssumptions: [],
    unsupportedParameters: [],
    evidenceReferences: [],
    calculatedAt: new Date().toISOString(),
  };

  const mockCropWater: CropWaterOutput = {
    engineVersion: "fao56-waterbalance-v1.0.0",
    crop: "wheat",
    growthStage: "development",
    cropCoefficientKc: 0.8,
    referenceEt0MmDay: 4.5,
    cropWaterRequirementEtcMmDay: 3.6,
    forecastRainfallMm: 0,
    effectiveRainfallMm: 0,
    netIrrigationRequirementMmDay: 3.6,
    dailyIrrigationVolumeLitersPerHectare: 36000,
    totalIrrigationVolumeLiters: 72000,
    units: {
      referenceEt0: "mm/day",
      cropWaterRequirementEtc: "mm/day",
      forecastRainfall: "mm",
      effectiveRainfall: "mm",
      netIrrigationRequirement: "mm/day",
      dailyVolumePerHectare: "Liters/ha/day",
      totalVolume: "Liters/day",
    },
    calculationMethod: "FAO-56",
    authoritativeRule: "Authoritative",
    calculatedAt: new Date().toISOString(),
  };

  const createValidAdvisory = (): AgriculturalAdvisory => ({
    id: "adv_test_01",
    fieldId: "field_01",
    farmerId: "farmer_01",
    soilTestRecordId: "rec_01",
    cropName: "WHEAT",
    targetYieldQuintalsPerHa: 50,
    croppingSeason: "RABI",
    fieldOverview: {
      fieldId: "field_01",
      fieldName: "North Orchard",
      cropName: "WHEAT",
      targetYieldQuintalsPerHa: 50,
      season: "RABI",
      areaAcres: 5.0,
      soilSummary: "Summary",
      primarySoilLimitations: [],
    },
    soilHealth: {
      interpretationSummary: "Normal soil",
      phAndSalinityAssessment: "Neutral pH",
      organicCarbonAssessment: "Medium OC",
      deficienciesOrExcesses: [],
      parametersRequiringRetest: [],
    },
    nutrientManagement: {
      npkStrategyExplanation: "Strategy",
      recommendedProductsExplanation: "Formulation",
      splitApplicationRationale: "Split rationale",
      secondaryAndMicronutrientNotes: [],
      protectedFertilizerDoses: [
        { productCode: "UREA", commercialName: "Urea (46% N)", quantityKgPerHa: 220.0, quantityKgPerAcre: 89.0 },
        { productCode: "DAP", commercialName: "Di-Ammonium Phosphate (18:46:0)", quantityKgPerHa: 126.0, quantityKgPerAcre: 51.0 },
      ],
      protectedNetNutrientRequirement: { n: 125.0, p2o5: 58.0, k2o: 42.0 },
    },
    waterManagement: {
      cropWaterSummary: "ETc is 3.6 mm/day",
      fao56Assessment: "FAO-56 assessment",
      weatherAndRainfallContext: "Normal weather",
      irrigationPracticesAndRestrictions: [],
      protectedEtcMmDay: 3.6,
      protectedNetIrrigationMmDay: 3.6,
    },
    actionPlan: {
      immediateActions: ["Apply basal"],
      upcomingStageActions: [],
      monitoringRequirements: [],
      followUpTestingRecommendations: [],
    },
    evidenceAndLimitations: {
      supportingSources: [
        {
          evidenceId: validEvidence.id,
          title: "ICAR IIWBR Wheat Package",
          publisherOrInstitution: "ICAR",
        },
      ],
      knownLimitations: [],
      missingInformation: [],
      unsupportedRecommendations: [],
      conflictingGuidance: [],
    },
    confidence: {
      soilDataQuality: "HIGH",
      calculationValidity: "HIGH",
      evidenceQuality: "HIGH",
      overallCompleteness: "HIGH",
      confidenceRationale: "High confidence",
    },
    deterministicCalculation: mockDeterministicCalc,
    cropWaterAssessment: mockCropWater,
    generatedAt: new Date().toISOString(),
    modelVersion: "gemini-1.5-flash",
    version: 1,
  });

  it("passes validation when all deterministic numbers and citations match perfectly", () => {
    const advisory = createValidAdvisory();
    const result = AdvisoryIntegrityValidator.validate(
      advisory,
      mockDeterministicCalc,
      evidenceManager,
      mockCropWater
    );

    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("detects and rejects altered nutrient requirement numbers (N, P2O5, K2O)", () => {
    const advisory = createValidAdvisory();
    // Tamper with N: changed 125.0 to 140.0
    advisory.nutrientManagement.protectedNetNutrientRequirement.n = 140.0;

    const result = AdvisoryIntegrityValidator.validate(
      advisory,
      mockDeterministicCalc,
      evidenceManager,
      mockCropWater
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Deterministic N requirement violation"))).toBe(true);
  });

  it("detects and rejects altered commercial fertilizer doses", () => {
    const advisory = createValidAdvisory();
    // Tamper with Urea quantity: changed 220 to 150
    advisory.nutrientManagement.protectedFertilizerDoses[0].quantityKgPerHa = 150.0;

    const result = AdvisoryIntegrityValidator.validate(
      advisory,
      mockDeterministicCalc,
      evidenceManager,
      mockCropWater
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Fertilizer quantity mismatch for 'UREA'"))).toBe(true);
  });

  it("detects and rejects altered crop water demand values", () => {
    const advisory = createValidAdvisory();
    // Tamper with ETc: changed 3.6 to 6.2
    advisory.waterManagement.protectedEtcMmDay = 6.2;

    const result = AdvisoryIntegrityValidator.validate(
      advisory,
      mockDeterministicCalc,
      evidenceManager,
      mockCropWater
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Deterministic Crop Water ETc violation"))).toBe(true);
  });

  it("detects and rejects fabricated or unregistered evidence citations", () => {
    const advisory = createValidAdvisory();
    // Inject a hallucinated citation not in EvidenceManager
    advisory.evidenceAndLimitations.supportingSources.push({
      evidenceId: "fake_hallucinated_citation_999",
      title: "Imaginary Agronomy Paper",
      publisherOrInstitution: "Fake Institute",
    });

    const result = AdvisoryIntegrityValidator.validate(
      advisory,
      mockDeterministicCalc,
      evidenceManager,
      mockCropWater
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Fabricated or unregistered evidence citation"))).toBe(true);
  });

  it("enforces authoritative values safely restoring exact deterministic numbers", () => {
    const advisory = createValidAdvisory();
    advisory.nutrientManagement.protectedNetNutrientRequirement.n = 999;
    advisory.nutrientManagement.protectedFertilizerDoses[0].quantityKgPerHa = 0;

    const enforced = AdvisoryIntegrityValidator.enforceAuthoritativeValues(
      advisory,
      mockDeterministicCalc,
      mockCropWater
    );

    expect(enforced.nutrientManagement.protectedNetNutrientRequirement.n).toBe(125.0);
    expect(enforced.nutrientManagement.protectedFertilizerDoses[0].quantityKgPerHa).toBe(220.0);
  });
});
