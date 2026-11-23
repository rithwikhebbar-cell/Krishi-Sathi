import { describe, it, expect } from "vitest";
import {
  SoilParametersSchema,
  SoilPhysicalParametersSchema,
  SoilChemicalParametersSchema,
  SoilPrimaryNutrientsSchema,
  SoilSecondaryNutrientsSchema,
  SoilMicronutrientsSchema,
  PhosphorusTestMethodSchema,
  NitrogenTestMethodSchema,
  SoilReportExtractionSchema,
  ApprovalProvenanceSchema,
  ExtractionReviewStatusSchema,
  FieldProfileSchema,
  HistoricalSoilTestRecordSchema,
  CropNutrientRequirementInputSchema,
  CropNutrientOutputSchema,
  FertilizerProductRecommendationSchema,
} from "../../src/agentic/contracts";

describe("Soil Domain Contracts (M1.3 Phase 1)", () => {
  describe("SoilParametersSchema & Chemical Non-interchangeability", () => {
    it("validates a fully specified valid soil parameters object", () => {
      const sampleSoil = {
        physical: {
          textureClass: "SANDY_LOAM",
          classificationType: "ALLUVIAL",
          soilDepthCm: 45,
          bulkDensityGPerCc: 1.35,
        },
        chemical: {
          ph: {
            value: 7.4,
            unit: "pH_units",
            testMethod: "SUSPENSION_1_2_5_WATER",
            rating: "NORMAL",
          },
          electricalConductivity: {
            value: 0.45,
            unit: "dS/m",
            testMethod: "SUSPENSION_1_2_WATER",
            rating: "NON_SALINE",
          },
          organicCarbonPercent: {
            value: 0.55,
            unit: "%",
            testMethod: "WALKLEY_BLACK_WET_OXIDATION",
            rating: "MEDIUM",
          },
        },
        primary: {
          availableNitrogen: {
            value: 290,
            unit: "kg/ha",
            testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
            rating: "MEDIUM",
          },
          availablePhosphorus: {
            value: 22.4,
            unit: "kg/ha_P2O5",
            testMethod: "OLSEN_SODIUM_BICARBONATE",
            rating: "MEDIUM",
            chemicalForm: "P2O5",
          },
          availablePotassium: {
            value: 180,
            unit: "kg/ha_K2O",
            testMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE",
            rating: "MEDIUM",
            chemicalForm: "K2O",
          },
        },
        secondary: {
          availableSulphurPpm: {
            value: 14.5,
            unit: "ppm",
            testMethod: "CALCIUM_CHLORIDE_TURBIDIMETRIC",
            rating: "SUFFICIENT",
          },
        },
        micronutrients: {
          availableZincPpm: {
            value: 0.75,
            unit: "ppm",
            testMethod: "DTPA_TEA_CaCl2_LINDSAY_NORVELL",
            rating: "SUFFICIENT",
          },
        },
      };

      const parsed = SoilParametersSchema.parse(sampleSoil);
      expect(parsed.chemical.ph.value).toBe(7.4);
      expect(parsed.primary.availablePhosphorus.testMethod).toBe("OLSEN_SODIUM_BICARBONATE");
    });

    it("rejects invalid pH outside 0-14", () => {
      expect(() => {
        SoilChemicalParametersSchema.parse({
          ph: {
            value: 15.2, // Invalid
            unit: "pH_units",
            testMethod: "SUSPENSION_1_2_5_WATER",
          },
          electricalConductivity: {
            value: 0.5,
            unit: "dS/m",
            testMethod: "SUSPENSION_1_2_WATER",
          },
          organicCarbonPercent: {
            value: 0.6,
            unit: "%",
            testMethod: "WALKLEY_BLACK_WET_OXIDATION",
          },
        });
      }).toThrow(/Soil pH must be between 0 and 14/);
    });

    it("enforces distinct testing methods for phosphorus (Olsen vs Bray)", () => {
      expect(PhosphorusTestMethodSchema.parse("OLSEN_SODIUM_BICARBONATE")).toBe("OLSEN_SODIUM_BICARBONATE");
      expect(PhosphorusTestMethodSchema.parse("BRAY_KURTZ_1_ACID_FLUORIDE")).toBe("BRAY_KURTZ_1_ACID_FLUORIDE");
      expect(() => PhosphorusTestMethodSchema.parse("INVALID_COLOR_METHOD")).toThrow();
    });

    it("enforces distinct testing methods for nitrogen", () => {
      expect(NitrogenTestMethodSchema.parse("ALKALINE_PERMANGANATE_SUBBIAH_ASIJA")).toBe(
        "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA"
      );
      expect(NitrogenTestMethodSchema.parse("KJELDAHL_TOTAL_NITROGEN")).toBe("KJELDAHL_TOTAL_NITROGEN");
    });
  });

  describe("Extraction, Approval & Provenance Contracts", () => {
    it("enforces extraction review states (PENDING_APPROVAL, APPROVED, REJECTED)", () => {
      expect(ExtractionReviewStatusSchema.parse("PENDING_APPROVAL")).toBe("PENDING_APPROVAL");
      expect(ExtractionReviewStatusSchema.parse("APPROVED")).toBe("APPROVED");
      expect(ExtractionReviewStatusSchema.parse("REJECTED")).toBe("REJECTED");
      expect(() => ExtractionReviewStatusSchema.parse("AUTO_APPLIED")).toThrow();
    });

    it("validates extraction candidates with confidence and warnings", () => {
      const extraction = {
        id: "extr-001",
        fieldId: "field-101",
        farmerId: "farmer-999",
        sourceFileName: "soil_report_lab_2026.pdf",
        fileFormat: "PDF_DIGITAL",
        contentHash: "a1b2c3d4e5f6g7h8",
        extractedAt: "2026-11-23T12:00:00Z",
        overallConfidence: 0.88,
        globalExtractionWarnings: ["Minor crease detected on page 1 header"],
        candidates: {
          availableNitrogen: {
            parameterKey: "availableNitrogen",
            rawKeyText: "Available N (kg/ha)",
            rawValueText: "310",
            parsedNumericValue: 310,
            extractedUnit: "kg/ha",
            extractedMethod: "Subbiah & Asija",
            normalizedValue: 310,
            normalizedUnit: "kg/ha",
            confidence: 0.95,
            extractionWarnings: [],
          },
        },
        approvalProvenance: {
          status: "PENDING_APPROVAL",
          reviewerRole: "FARMER",
          editedFields: [],
        },
      };

      const parsed = SoilReportExtractionSchema.parse(extraction);
      expect(parsed.approvalProvenance.status).toBe("PENDING_APPROVAL");
      expect(parsed.candidates.availableNitrogen.parsedNumericValue).toBe(310);
    });

    it("captures farmer edits and reviewer details in approval provenance", () => {
      const provenance = {
        status: "APPROVED",
        reviewedBy: "farmer-999",
        reviewerRole: "FARMER",
        reviewedAt: "2026-11-23T12:30:00Z",
        editedFields: ["availablePhosphorus"],
        notes: "Corrected Olsen P value from 12 to 22 kg/ha based on physical lab receipt stamp",
      };

      const parsed = ApprovalProvenanceSchema.parse(provenance);
      expect(parsed.status).toBe("APPROVED");
      expect(parsed.editedFields).toContain("availablePhosphorus");
      expect(parsed.reviewedBy).toBe("farmer-999");
    });
  });

  describe("Field Profiles & Immutable Historical Records", () => {
    it("validates multi-field profile creation per farmer", () => {
      const field = {
        id: "field-001",
        farmerId: "farmer-999",
        name: "North Canal Field",
        areaAcres: 3.5,
        location: {
          state: "Punjab",
          district: "Ludhiana",
          village: "Mullanpur",
          pincode: "141101",
        },
        primarySoilType: "ALLUVIAL",
        primaryTextureClass: "SANDY_LOAM",
        irrigationSource: "CANAL",
        createdAt: "2026-11-23T10:00:00Z",
        updatedAt: "2026-11-23T10:00:00Z",
      };

      const parsed = FieldProfileSchema.parse(field);
      expect(parsed.name).toBe("North Canal Field");
      expect(parsed.activeSoilProfile).toBeNull();
      expect(parsed.totalHistoricalSoilTests).toBe(0);
    });

    it("enforces immutable flag on historical soil test records", () => {
      const historyRecord = {
        recordId: "hist-001",
        fieldId: "field-001",
        soilTestReportId: "report-001",
        testDate: "2024-03-15",
        recordedAt: "2026-11-23T10:00:00Z",
        parameters: {
          physical: { textureClass: "LOAM", classificationType: "ALLUVIAL" },
          chemical: {
            ph: { value: 7.2, unit: "pH_units", testMethod: "SUSPENSION_1_2_5_WATER" },
            electricalConductivity: { value: 0.35, unit: "dS/m", testMethod: "SUSPENSION_1_2_WATER" },
            organicCarbonPercent: { value: 0.48, unit: "%", testMethod: "WALKLEY_BLACK_WET_OXIDATION" },
          },
          primary: {
            availableNitrogen: { value: 260, unit: "kg/ha", testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA" },
            availablePhosphorus: { value: 18.5, unit: "kg/ha_P2O5", testMethod: "OLSEN_SODIUM_BICARBONATE", chemicalForm: "P2O5" },
            availablePotassium: { value: 160, unit: "kg/ha_K2O", testMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE", chemicalForm: "K2O" },
          },
          secondary: {},
          micronutrients: {},
        },
        approvalProvenance: {
          status: "APPROVED",
          reviewedBy: "farmer-999",
          reviewerRole: "FARMER",
          reviewedAt: "2024-03-20T10:00:00Z",
          editedFields: [],
        },
        isImmutable: true,
      };

      const parsed = HistoricalSoilTestRecordSchema.parse(historyRecord);
      expect(parsed.isImmutable).toBe(true);

      // Attempting to mutate isImmutable to false should fail
      expect(() => {
        HistoricalSoilTestRecordSchema.parse({
          ...historyRecord,
          isImmutable: false,
        });
      }).toThrow();
    });
  });

  describe("Nutrient Calculation Inputs & Outputs", () => {
    it("validates crop nutrient requirement calculation input", () => {
      const input = {
        fieldId: "field-001",
        cropName: "Wheat",
        cropVariety: "HD-2967",
        targetYieldQuintalsPerHa: 50,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 10,
        soilParameters: {
          physical: { textureClass: "LOAM", classificationType: "ALLUVIAL" },
          chemical: {
            ph: { value: 7.5, unit: "pH_units", testMethod: "SUSPENSION_1_2_5_WATER" },
            electricalConductivity: { value: 0.4, unit: "dS/m", testMethod: "SUSPENSION_1_2_WATER" },
            organicCarbonPercent: { value: 0.5, unit: "%", testMethod: "WALKLEY_BLACK_WET_OXIDATION" },
          },
          primary: {
            availableNitrogen: { value: 280, unit: "kg/ha", testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA" },
            availablePhosphorus: { value: 20, unit: "kg/ha_P2O5", testMethod: "OLSEN_SODIUM_BICARBONATE", chemicalForm: "P2O5" },
            availablePotassium: { value: 175, unit: "kg/ha_K2O", testMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE", chemicalForm: "K2O" },
          },
          secondary: {},
          micronutrients: {},
        },
      };

      const parsed = CropNutrientRequirementInputSchema.parse(input);
      expect(parsed.cropName).toBe("Wheat");
      expect(parsed.targetYieldQuintalsPerHa).toBe(50);
    });

    it("validates fertilizer product recommendation schema with multi-nutrient grade specs", () => {
      const dapRecommendation = {
        productCode: "DAP",
        commercialName: "Di-Ammonium Phosphate (DAP 18-46-0)",
        quantityKgPerHa: 130.4,
        quantityKgPerAcre: 52.8,
        nutrientGrade: {
          nPercent: 18,
          p2o5Percent: 46,
          k2oPercent: 0,
        },
        nutrientsSuppliedKgPerHa: {
          n: 23.47,
          p2o5: 60.0,
          k2o: 0,
        },
        applicationMethod: "Basal application at the time of sowing (drilled below seed)",
        precautions: "Do not place directly in contact with seeds to avoid seedling injury",
      };

      const parsed = FertilizerProductRecommendationSchema.parse(dapRecommendation);
      expect(parsed.productCode).toBe("DAP");
      expect(parsed.nutrientsSuppliedKgPerHa.n).toBeCloseTo(23.47);
      expect(parsed.nutrientsSuppliedKgPerHa.p2o5).toBe(60.0);
    });

    it("validates full structured crop nutrient calculation output envelope", () => {
      const output = {
        calculationId: "calc-wheat-50q",
        cropName: "Wheat",
        cropVariety: "HD-2967",
        fieldId: "field-001",
        targetYieldQuintalsPerHa: 50,
        methodology: "STCR_TARGET_YIELD",
        stcrEquationsApplied: [
          "FN = 4.39 * T - 0.22 * SN",
          "FP2O5 = 2.84 * T - 0.40 * SP",
          "FK2O = 2.45 * T - 0.15 * SK",
        ],
        netRequirementKgPerHa: {
          n: 120,
          p2o5: 60,
          k2o: 40,
          zn: 5,
        },
        netRequirementKgPerAcre: {
          n: 48.6,
          p2o5: 24.3,
          k2o: 16.2,
          zn: 2.02,
        },
        classifications: [
          {
            parameterKey: "availableNitrogen",
            displayName: "Available Nitrogen",
            testValue: 280,
            unit: "kg/ha",
            testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
            rating: "LOW",
            benchmarkRange: "Low (< 280 kg/ha), Medium (280-560 kg/ha)",
            interpretation: "Nitrogen availability is at lower threshold; recommended full nitrogenous fertilization.",
          },
        ],
        fertilizerRecommendations: [
          {
            productCode: "UREA",
            commercialName: "Urea (46% N)",
            quantityKgPerHa: 210,
            quantityKgPerAcre: 85,
            nutrientGrade: { nPercent: 46, p2o5Percent: 0, k2oPercent: 0 },
            nutrientsSuppliedKgPerHa: { n: 96.6, p2o5: 0, k2o: 0 },
            applicationMethod: "Split into 3 doses",
          },
        ],
        splitSchedules: [
          {
            stageCode: "BASAL_AT_SOWING",
            stageTitle: "Basal Application",
            timingDescription: "0 DAS (At sowing)",
            fertilizers: [
              {
                productCode: "DAP",
                commercialName: "Di-Ammonium Phosphate",
                quantityKgPerHa: 130,
                quantityKgPerAcre: 52.6,
                applicationGuidance: "Drill 5 cm below seed",
              },
            ],
            agronomicRationale: "Phosphorus and initial starter nitrogen are critical for early root development.",
          },
        ],
        limitationsAndAssumptions: [
          "STCR equations calibrated for Indo-Gangetic Alluvial plains under adequate irrigation.",
          "Target yield must not exceed 60 q/ha for dwarf wheat varieties in this zone.",
        ],
        evidenceReferences: ["ICAR-AICRP-STCR-Wheat-Punjab-2023"],
        calculatedAt: "2026-11-23T12:00:00Z",
      };

      const parsed = CropNutrientOutputSchema.parse(output);
      expect(parsed.methodology).toBe("STCR_TARGET_YIELD");
      expect(parsed.splitSchedules.length).toBe(1);
      expect(parsed.fertilizerRecommendations[0].productCode).toBe("UREA");
    });
  });
});
