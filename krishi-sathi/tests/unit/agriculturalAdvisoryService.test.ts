import { describe, it, expect } from "vitest";
import { AgriculturalAdvisoryService } from "../../src/agentic/soil/agriculturalAdvisoryService";
import { EvidenceManager } from "../../src/agentic/evidence/evidenceManager";
import { MockModelProvider } from "../../src/agentic/providers/mockProvider";
import { FieldProfile, ApprovedSoilProfile } from "../../src/agentic/contracts/soil/fieldTypes";
import { CropNutrientOutput } from "../../src/agentic/contracts/soil/nutrientTypes";
import { CropWaterOutput } from "../../src/agentic/engines/types";

describe("AgriculturalAdvisoryService & Multi-Dimensional Confidence (M1.3 Phase 5)", () => {
  const service = new AgriculturalAdvisoryService();
  const evidenceManager = new EvidenceManager();
  const mockEvidence = evidenceManager.register({
    taskId: "task-01",
    sourceUri: "https://icar.org.in/iiwbr-wheat-2024",
    sourceTitle: "ICAR Wheat Guidelines",
    publisher: "ICAR",
    excerpt: "Apply nitrogen in split applications.",
    evidenceType: "RESEARCH_DOCUMENT",
    retrievalMethod: "test",
    isUntrusted: true,
  });

  const mockField: FieldProfile = {
    id: "field_test",
    farmerId: "farmer_1",
    name: "North Orchard",
    areaAcres: 5.0,
    location: { state: "Punjab", district: "Ludhiana" },
    primarySoilType: "ALLUVIAL",
    primaryTextureClass: "LOAM",
    irrigationSource: "TUBEWELL",
    activeSoilProfile: null,
    totalHistoricalSoilTests: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockApprovedProfile: ApprovedSoilProfile = {
    profileId: "prof_1",
    fieldId: "field_test",
    soilTestReportId: "rep_1",
    parameters: {
      physical: { textureClass: "LOAM", classificationType: "ALLUVIAL" },
      chemical: {
        ph: { value: 7.4, unit: "pH_units", testMethod: "SUSPENSION_1_2_5_WATER" },
        electricalConductivity: { value: 0.35, unit: "dS/m", testMethod: "SUSPENSION_1_2_WATER" },
        organicCarbonPercent: { value: 0.65, unit: "%", testMethod: "WALKLEY_BLACK_WET_OXIDATION" },
      },
      primary: {
        availableNitrogen: { value: 280, unit: "kg/ha", testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA" },
        availablePhosphorus: { value: 19.5, unit: "kg/ha_P2O5", testMethod: "OLSEN_SODIUM_BICARBONATE", chemicalForm: "P2O5" },
        availablePotassium: { value: 165, unit: "kg/ha_K2O", testMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE", chemicalForm: "K2O" },
      },
      secondary: {
        availableSulphurPpm: { value: 14.0, unit: "ppm", testMethod: "CALCIUM_CHLORIDE_TURBIDIMETRIC" },
      },
      micronutrients: {
        availableZincPpm: { value: 0.72, unit: "ppm", testMethod: "DTPA_TEA_CaCl2_LINDSAY_NORVELL" },
      },
    },
    approvalProvenance: {
      status: "APPROVED",
      reviewedBy: "farmer_1",
      reviewerRole: "FARMER",
      editedFields: [],
    },
    effectiveFrom: new Date().toISOString(),
    isCurrentlyActive: true,
  };

  const mockCalculation: CropNutrientOutput = {
    calculationId: "calc_test",
    cropName: "WHEAT",
    fieldId: "field_test",
    targetYieldQuintalsPerHa: 50,
    methodology: "STCR_TARGET_YIELD",
    calculationStatus: "COMPLETED",
    stcrEquationsApplied: ["N = 4.41*T - 0.40*SN"],
    netRequirementKgPerHa: { n: 110, p2o5: 50, k2o: 40 },
    netRequirementKgPerAcre: { n: 44.5, p2o5: 20.2, k2o: 16.2 },
    classifications: [],
    fertilizerRecommendations: [
      {
        productCode: "UREA",
        commercialName: "Urea",
        quantityKgPerHa: 200,
        quantityKgPerAcre: 81,
        nutrientGrade: { nPercent: 46, p2o5Percent: 0, k2oPercent: 0 },
        nutrientsSuppliedKgPerHa: { n: 92, p2o5: 0, k2o: 0 },
        applicationMethod: "Split",
      },
    ],
    splitSchedules: [
      {
        stageCode: "BASAL_AT_SOWING",
        stageTitle: "Basal at Sowing",
        timingDescription: "0 DAS",
        fertilizers: [
          {
            productCode: "UREA",
            commercialName: "Urea",
            quantityKgPerHa: 100,
            quantityKgPerAcre: 40.5,
            applicationGuidance: "Broadcast before sowing",
          },
        ],
        agronomicRationale: "Initial vegetative nutrition",
      },
    ],
    limitationsAndAssumptions: ["Assumes adequate soil moisture"],
    unsupportedParameters: [],
    evidenceReferences: [],
    calculatedAt: new Date().toISOString(),
  };

  it("synthesizes an authoritative baseline advisory when LLM is in mock mode", async () => {
    const mockProvider = new MockModelProvider();

    const advisory = await service.synthesize({
      field: mockField,
      soilProfile: mockApprovedProfile,
      calculation: mockCalculation,
      weatherSummary: "Mild winter conditions",
      evidence: [mockEvidence],
      evidenceManager,
      retrievalResult: {
        evidence: [mockEvidence],
        matchedDocumentsCount: 1,
        regionalMatchFound: true,
      },
      modelProvider: mockProvider,
      input: {
        fieldId: mockField.id,
        cropName: "WHEAT",
        targetYieldQuintalsPerHa: 50,
        croppingSeason: "RABI",
      },
    });

    expect(advisory.id).toBeDefined();
    expect(advisory.cropName).toBe("WHEAT");
    expect(advisory.nutrientManagement.protectedNetNutrientRequirement.n).toBe(110);
    expect(advisory.nutrientManagement.protectedFertilizerDoses[0].quantityKgPerHa).toBe(200);
    expect(advisory.confidence.overallCompleteness).toBe("HIGH");
    expect(advisory.confidence.soilDataQuality).toBe("HIGH");
    expect(advisory.evidenceAndLimitations.supportingSources.length).toBe(1);
    expect(advisory.actionPlan.immediateActions.length).toBeGreaterThan(0);
  });

  it("safely enforces deterministic numbers if Gemini synthesis attempts to alter them", async () => {
    // Model attempts to override Urea quantity to 300 kg/ha instead of 200
    const mockProvider = new MockModelProvider({
      advisoryOverride: (context: any) => ({
        id: "adv_hacked",
        fieldId: "field_test",
        farmerId: "farmer_1",
        soilTestRecordId: "rep_1",
        cropName: "WHEAT",
        targetYieldQuintalsPerHa: 50,
        croppingSeason: "RABI",
        fieldOverview: {
          fieldId: "field_test",
          fieldName: "North Orchard",
          cropName: "WHEAT",
          targetYieldQuintalsPerHa: 50,
          season: "RABI",
          areaAcres: 5.0,
          soilSummary: "Summary of field soil conditions and texture",
          primarySoilLimitations: [],
        },
        soilHealth: {
          interpretationSummary: "Interpretation summary of soil health and fertility",
          phAndSalinityAssessment: "pH and salinity assessment for wheat cultivation",
          organicCarbonAssessment: "Organic carbon assessment and status",
          deficienciesOrExcesses: [],
          parametersRequiringRetest: [],
        },
        nutrientManagement: {
          npkStrategyExplanation: "Strategy for balanced NPK fertilization in wheat",
          recommendedProductsExplanation: "Formulation explanation for recommended chemical fertilizers",
          splitApplicationRationale: "Rationale for splitting nitrogen application across growth stages",
          secondaryAndMicronutrientNotes: [],
          protectedFertilizerDoses: [
            { productCode: "UREA", commercialName: "Urea", quantityKgPerHa: 300, quantityKgPerAcre: 120 }, // Altered!
          ],
          protectedNetNutrientRequirement: { n: 999, p2o5: 50, k2o: 40 }, // Altered!
        },
        waterManagement: {
          cropWaterSummary: "Crop water summary details for wheat crop under FAO-56",
          fao56Assessment: "Assessment for FAO-56 irrigation requirement and ETc",
          weatherAndRainfallContext: "Context for weather forecast and local rainfall",
          irrigationPracticesAndRestrictions: [],
          protectedEtcMmDay: 0,
          protectedNetIrrigationMmDay: 0,
        },
        actionPlan: {
          immediateActions: ["Action 1"],
          upcomingStageActions: [],
          monitoringRequirements: [],
          followUpTestingRecommendations: [],
        },
        evidenceAndLimitations: {
          supportingSources: [{ evidenceId: mockEvidence.id, title: "Title", publisherOrInstitution: "ICAR" }],
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
          confidenceRationale: "Rationale",
        },
        deterministicCalculation: mockCalculation,
        generatedAt: new Date().toISOString(),
        modelVersion: "gemini-1.5-flash",
        version: 1,
      }),
    });

    const advisory = await service.synthesize({
      field: mockField,
      soilProfile: mockApprovedProfile,
      calculation: mockCalculation,
      evidence: [mockEvidence],
      evidenceManager,
      retrievalResult: {
        evidence: [mockEvidence],
        matchedDocumentsCount: 1,
        regionalMatchFound: true,
      },
      modelProvider: mockProvider,
      input: {
        fieldId: mockField.id,
        cropName: "WHEAT",
        targetYieldQuintalsPerHa: 50,
      },
    });

    // The integrity validator must have detected the discrepancy and reverted to authoritative 110 & 200
    expect(advisory.nutrientManagement.protectedNetNutrientRequirement.n).toBe(110);
    expect(advisory.nutrientManagement.protectedFertilizerDoses[0].quantityKgPerHa).toBe(200);
    expect(
      advisory.evidenceAndLimitations.knownLimitations.some((lim) =>
        lim.includes("[Integrity Safeguard]")
      )
    ).toBe(true);
  });
});
