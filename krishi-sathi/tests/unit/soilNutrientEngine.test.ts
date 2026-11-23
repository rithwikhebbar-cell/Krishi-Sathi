import { describe, it, expect } from "vitest";
import {
  SoilNutrientEngine,
  SoilInterpretationEngine,
  StcrRegistry,
  FertilizerRegistry,
} from "../../src/agentic/engines";
import { CropNutrientRequirementInput } from "../../src/agentic/contracts";

describe("SoilNutrientEngine & Deterministic Agronomic Calculations (M1.3 Phase 2)", () => {
  const engine = new SoilNutrientEngine();

  const standardSoilParameters = {
    physical: {
      textureClass: "SANDY_LOAM" as const,
      classificationType: "ALLUVIAL" as const,
      soilDepthCm: 45,
    },
    chemical: {
      ph: {
        value: 7.4,
        unit: "pH_units" as const,
        testMethod: "SUSPENSION_1_2_5_WATER" as const,
      },
      electricalConductivity: {
        value: 0.45,
        unit: "dS/m" as const,
        testMethod: "SUSPENSION_1_2_WATER" as const,
      },
      organicCarbonPercent: {
        value: 0.55,
        unit: "%" as const,
        testMethod: "WALKLEY_BLACK_WET_OXIDATION" as const,
      },
    },
    primary: {
      availableNitrogen: {
        value: 280,
        unit: "kg/ha" as const,
        testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA" as const,
      },
      availablePhosphorus: {
        value: 20.0,
        unit: "kg/ha_P2O5" as const,
        testMethod: "OLSEN_SODIUM_BICARBONATE" as const,
        chemicalForm: "P2O5" as const,
      },
      availablePotassium: {
        value: 180.0,
        unit: "kg/ha_K2O" as const,
        testMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE" as const,
        chemicalForm: "K2O" as const,
      },
    },
    secondary: {
      availableSulphurPpm: {
        value: 14.0,
        unit: "ppm" as const,
        testMethod: "CALCIUM_CHLORIDE_TURBIDIMETRIC" as const,
      },
    },
    micronutrients: {
      availableZincPpm: {
        value: 0.50, // Deficient (< 0.6 ppm)
        unit: "ppm" as const,
        testMethod: "DTPA_TEA_CaCl2_LINDSAY_NORVELL" as const,
      },
    },
  };

  describe("1. Soil Parameter Interpretation (ICAR Benchmarks)", () => {
    it("classifies standard parameters into correct ICAR rating brackets", () => {
      const classifications = SoilInterpretationEngine.interpret(standardSoilParameters);

      const nClass = classifications.find((c) => c.parameterKey === "availableNitrogen");
      expect(nClass?.rating).toBe("MEDIUM");

      const pClass = classifications.find((c) => c.parameterKey === "availablePhosphorus");
      expect(pClass?.rating).toBe("LOW"); // 20 kg P2O5/ha is < 22.9 kg/ha threshold

      const znClass = classifications.find((c) => c.parameterKey === "availableZincPpm");
      expect(znClass?.rating).toBe("DEFICIENT"); // 0.50 ppm is < 0.6 ppm

      const phClass = classifications.find((c) => c.parameterKey === "ph");
      expect(phClass?.rating).toBe("NORMAL");
    });

    it("returns UNKNOWN rating when an unsupported testing method is used", () => {
      const customSoil = {
        ...standardSoilParameters,
        primary: {
          ...standardSoilParameters.primary,
          availableNitrogen: {
            value: 300,
            unit: "kg/ha" as const,
            testMethod: "UNKNOWN_METHOD" as const, // Unsupported method
          },
        },
      };

      const classifications = SoilInterpretationEngine.interpret(customSoil);
      const nClass = classifications.find((c) => c.parameterKey === "availableNitrogen");
      expect(nClass?.rating).toBe("UNKNOWN");
      expect(nClass?.interpretation).toContain("Rating unavailable");
    });
  });

  describe("2. STCR Target-Yield Calculations & Multi-Nutrient Accounting", () => {
    it("accurately calculates STCR targeted yield recommendations for Wheat (50 q/ha)", () => {
      const input: CropNutrientRequirementInput = {
        fieldId: "field-punjab-01",
        cropName: "Wheat",
        cropVariety: "HD-2967",
        targetYieldQuintalsPerHa: 50.0,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: standardSoilParameters,
      };

      const result = engine.calculate(input);

      expect(result.calculationStatus).toBe("COMPLETED");
      expect(result.methodology).toBe("STCR_TARGET_YIELD");

      // Math verification:
      // FN = 4.39 * 50 - 0.22 * 280 = 219.5 - 61.6 = 157.9 kg N/ha
      // FP2O5 = 2.84 * 50 - 0.40 * 20 = 142.0 - 8.0 = 134.0 kg P2O5/ha
      // FK2O = 2.45 * 50 - 0.15 * 180 = 122.5 - 27.0 = 95.5 kg K2O/ha
      expect(result.netRequirementKgPerHa.n).toBeCloseTo(157.9, 1);
      expect(result.netRequirementKgPerHa.p2o5).toBeCloseTo(134.0, 1);
      expect(result.netRequirementKgPerHa.k2o).toBeCloseTo(95.5, 1);

      // Acre conversions (divided by 2.47105)
      expect(result.netRequirementKgPerAcre.n).toBeCloseTo(63.9, 1);
      expect(result.netRequirementKgPerAcre.p2o5).toBeCloseTo(54.2, 1);
      expect(result.netRequirementKgPerAcre.k2o).toBeCloseTo(38.6, 1);
    });

    it("deducts nitrogen supplied by DAP from urea requirement to prevent double-counting", () => {
      const input: CropNutrientRequirementInput = {
        fieldId: "field-01",
        cropName: "Wheat",
        targetYieldQuintalsPerHa: 50.0,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: standardSoilParameters,
      };

      const result = engine.calculate(input);

      // DAP requirement: 134.0 kg P2O5 / 0.46 = 291.3 kg DAP/ha
      const dap = result.fertilizerRecommendations.find((f) => f.productCode === "DAP");
      expect(dap).toBeDefined();
      expect(dap!.quantityKgPerHa).toBeCloseTo(291.3, 1);

      // Nitrogen supplied by DAP: 291.3 * 0.18 = 52.4 kg N/ha
      expect(dap!.nutrientsSuppliedKgPerHa.n).toBeCloseTo(52.4, 1);

      // Remaining N requirement: 157.9 - 52.4 = 105.5 kg N/ha
      // Urea needed: 105.5 / 0.46 = 229.3 kg Urea/ha
      const urea = result.fertilizerRecommendations.find((f) => f.productCode === "UREA");
      expect(urea).toBeDefined();
      expect(urea!.quantityKgPerHa).toBeCloseTo(229.3, 1);

      // Total N supplied = 52.4 (from DAP) + 105.5 (from Urea) = 157.9 kg N/ha
      const totalN = dap!.nutrientsSuppliedKgPerHa.n + urea!.nutrientsSuppliedKgPerHa.n;
      expect(totalN).toBeCloseTo(result.netRequirementKgPerHa.n, 1);

      // Potash MOP: 95.5 / 0.60 = 159.2 kg MOP/ha
      const mop = result.fertilizerRecommendations.find((f) => f.productCode === "MOP");
      expect(mop).toBeDefined();
      expect(mop!.quantityKgPerHa).toBeCloseTo(159.2, 1);
    });

    it("recommends Zinc Sulphate when soil zinc is deficient", () => {
      const input: CropNutrientRequirementInput = {
        fieldId: "field-01",
        cropName: "Wheat",
        targetYieldQuintalsPerHa: 50.0,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: standardSoilParameters, // Zn is 0.50 ppm (< 0.6)
      };

      const result = engine.calculate(input);
      const znRec = result.fertilizerRecommendations.find(
        (f) => f.productCode === "ZINC_SULPHATE_HEPTAHYDRATE_21"
      );
      expect(znRec).toBeDefined();
      expect(znRec!.quantityKgPerHa).toBe(25.0);
      expect(znRec!.nutrientsSuppliedKgPerHa.zn).toBeCloseTo(5.25, 1);
    });

    it("properly credits Farmyard Manure (FYM) using calibrated STCR-IPNS factors", () => {
      const inputWithFym: CropNutrientRequirementInput = {
        fieldId: "field-01",
        cropName: "Wheat",
        targetYieldQuintalsPerHa: 50.0,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 10.0, // 10 tonnes FYM/ha
        soilParameters: standardSoilParameters,
      };

      const result = engine.calculate(inputWithFym);

      // Equation: FN = 4.39*T - 0.22*SN - 0.85*FYM
      // FYM credit for N = 0.85 * 10 = 8.5 kg N
      // Net N without FYM = 157.9 -> Net N with FYM = 157.9 - 8.5 = 149.4 kg N/ha
      expect(result.netRequirementKgPerHa.n).toBeCloseTo(149.4, 1);

      // FYM credit for P2O5 = 0.42 * 10 = 4.2 kg P2O5
      // Net P2O5 without FYM = 134.0 -> with FYM = 134.0 - 4.2 = 129.8 kg P2O5/ha
      expect(result.netRequirementKgPerHa.p2o5).toBeCloseTo(129.8, 1);
    });
  });

  describe("3. Honest Handling of Unsupported Parameters & Edge Cases", () => {
    it("returns UNSUPPORTED_PARAMETERS and zero fertilizer amounts for unregistered crops", () => {
      const input: CropNutrientRequirementInput = {
        fieldId: "field-01",
        cropName: "Dragonfruit", // Not in STCR registry
        targetYieldQuintalsPerHa: 20.0,
        croppingSeason: "ANNUAL",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: standardSoilParameters,
      };

      const result = engine.calculate(input);

      expect(result.calculationStatus).toBe("UNSUPPORTED_PARAMETERS");
      expect(result.fertilizerRecommendations.length).toBe(0);
      expect(result.splitSchedules.length).toBe(0);
      expect(result.unsupportedParameters.some((p) => p.includes("Dragonfruit"))).toBe(true);
      expect(result.limitationsAndAssumptions.some((l) => l.includes("halted"))).toBe(true);
    });

    it("rejects target yield exceeding physiological calibration ceiling", () => {
      const input: CropNutrientRequirementInput = {
        fieldId: "field-01",
        cropName: "Wheat",
        targetYieldQuintalsPerHa: 95.0, // Max for wheat equation is 65 q/ha
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: standardSoilParameters,
      };

      const result = engine.calculate(input);

      expect(result.calculationStatus).toBe("UNSUPPORTED_PARAMETERS");
      expect(result.unsupportedParameters.some((p) => p.includes("exceeds the validated physiological ceiling"))).toBe(true);
    });

    it("rejects calculation when soil test method does not match equation calibration", () => {
      const incompatibleSoil = {
        ...standardSoilParameters,
        primary: {
          ...standardSoilParameters.primary,
          availablePhosphorus: {
            value: 20.0,
            unit: "kg/ha_P2O5" as const,
            testMethod: "BRAY_KURTZ_1_ACID_FLUORIDE" as const, // Equation requires Olsen!
            chemicalForm: "P2O5" as const,
          },
        },
      };

      const input: CropNutrientRequirementInput = {
        fieldId: "field-01",
        cropName: "Wheat",
        targetYieldQuintalsPerHa: 50.0,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: incompatibleSoil,
      };

      const result = engine.calculate(input);

      expect(result.calculationStatus).toBe("UNSUPPORTED_PARAMETERS");
      expect(result.unsupportedParameters.some((p) => p.includes("Testing method mismatch for Phosphorus"))).toBe(true);
    });
  });

  describe("4. Growth-Stage Split Application Schedules", () => {
    it("generates 3-stage split schedule for Wheat", () => {
      const input: CropNutrientRequirementInput = {
        fieldId: "field-01",
        cropName: "Wheat",
        targetYieldQuintalsPerHa: 50.0,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: standardSoilParameters,
      };

      const result = engine.calculate(input);
      expect(result.splitSchedules.length).toBe(3);

      const [basal, cri, jointing] = result.splitSchedules;
      expect(basal.stageCode).toBe("BASAL_AT_SOWING");
      expect(cri.stageCode).toBe("EARLY_VEGETATIVE_TILLERING");
      expect(jointing.stageCode).toBe("TOP_DRESSING_SECOND");

      // Basal should contain DAP, MOP and 1/3 Urea
      const basalFertCodes = basal.fertilizers.map((f) => f.productCode);
      expect(basalFertCodes).toContain("DAP");
      expect(basalFertCodes).toContain("MOP");
      expect(basalFertCodes).toContain("UREA");
    });
  });

  describe("5. Reproducibility & Determinism", () => {
    it("produces identical outputs for identical inputs across successive executions", () => {
      const input: CropNutrientRequirementInput = {
        fieldId: "field-deterministic",
        cropName: "Wheat",
        targetYieldQuintalsPerHa: 50.0,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: standardSoilParameters,
      };

      const res1 = engine.calculate(input);
      const res2 = engine.calculate(input);

      expect(res1.netRequirementKgPerHa).toEqual(res2.netRequirementKgPerHa);
      expect(res1.fertilizerRecommendations).toEqual(res2.fertilizerRecommendations);
      expect(res1.nutrientBalance).toEqual(res2.nutrientBalance);
    });
  });

  describe("6. Tool Integration (soil.nutrient.calculate)", () => {
    it("exposes the engine as a READ_ONLY agent tool definition", async () => {
      const { soilNutrientTool } = await import("../../src/agentic/tools");
      expect(soilNutrientTool.name).toBe("soil.nutrient.calculate");
      expect(soilNutrientTool.permission).toBe("READ_ONLY");
      expect(soilNutrientTool.timeoutMs).toBe(5000);

      const input: CropNutrientRequirementInput = {
        fieldId: "field-tool-01",
        cropName: "Wheat",
        targetYieldQuintalsPerHa: 50.0,
        croppingSeason: "RABI",
        isIrrigated: true,
        organicManureTonnesPerHa: 0,
        soilParameters: standardSoilParameters,
      };

      const output = await soilNutrientTool.execute(input);
      expect(output.calculationStatus).toBe("COMPLETED");
      expect(output.cropName).toBe("Wheat");
      expect(output.fertilizerRecommendations.length).toBeGreaterThan(0);
    });
  });
});
