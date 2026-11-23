import { DeterministicEngine } from "./types";
import {
  CropNutrientRequirementInput,
  CropNutrientRequirementInputSchema,
  CropNutrientOutput,
  CropNutrientOutputSchema,
  FertilizerProductRecommendation,
  NutrientBalanceBreakdown,
} from "../contracts/soil/nutrientTypes";
import { ValidationError } from "../contracts/errors";
import { SoilInterpretationEngine } from "./soilInterpretation";
import { StcrRegistry, StcrLookupQuery } from "./stcrRegistry";
import { FertilizerRegistry } from "./fertilizerRegistry";
import { SplitScheduler } from "./splitScheduler";

export class SoilNutrientEngine
  implements DeterministicEngine<CropNutrientRequirementInput, CropNutrientOutput>
{
  public readonly engineName = "soil-nutrient-engine";
  public readonly version = "stcr-icar-v1.0.0" as const;

  private readonly stcrRegistry = StcrRegistry.getInstance();
  private readonly fertilizerRegistry = FertilizerRegistry.getInstance();

  /**
   * Deterministically calculates crop-specific nutrient requirements and commercial fertilizer schedules.
   * Adheres strictly to ICAR-AICRP on STCR targeted yield calibrations and FCO product grades.
   */
  public calculate(rawInput: CropNutrientRequirementInput): CropNutrientOutput {
    const parsed = CropNutrientRequirementInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(
        `Invalid input for SoilNutrientEngine: ${parsed.error.issues.map((i) => i.message).join(", ")}`
      );
    }

    const input = parsed.data;
    const { cropName, targetYieldQuintalsPerHa, fieldId, soilParameters } = input;
    const normCrop = cropName.trim().toLowerCase();

    // 1. Evaluate soil parameter ratings against validated benchmarks
    const classifications = SoilInterpretationEngine.interpret(soilParameters);

    // 2. Query regional STCR equation registry
    const stcrQuery: StcrLookupQuery = {
      crop: cropName,
      stateOrRegion: input.stateOrRegion,
      targetYieldQuintalsPerHa,
      soilMethods: {
        nitrogen: soilParameters.primary.availableNitrogen.testMethod,
        phosphorus: soilParameters.primary.availablePhosphorus.testMethod,
        potassium: soilParameters.primary.availablePotassium.testMethod,
      },
    };

    const lookupResult = this.stcrRegistry.findEquation(stcrQuery);
    const limitations: string[] = [];
    const unsupportedParameters: string[] = [];
    const evidenceReferences: string[] = [
      "ICAR Soil Health Card Scheme Guidelines (2015), Ministry of Agriculture & Farmers Welfare, GoI",
    ];

    // 3. Handle unsupported crop, region, yield or testing methods
    if (!lookupResult.isSupported || !lookupResult.equation) {
      unsupportedParameters.push(...lookupResult.unsupportedReasons);
      limitations.push(...lookupResult.unsupportedReasons);
      limitations.push(
        "Deterministic calculation halted: Numerical fertilizer recommendations cannot be computed without a scientifically validated STCR equation matching laboratory testing methods and target yield boundaries."
      );

      const emptyOutput: CropNutrientOutput = {
        calculationId: `calc_${fieldId}_${Date.now()}`,
        cropName,
        cropVariety: input.cropVariety,
        fieldId,
        targetYieldQuintalsPerHa,
        methodology: "STCR_TARGET_YIELD",
        calculationStatus: "UNSUPPORTED_PARAMETERS",
        stcrEquationsApplied: [],
        netRequirementKgPerHa: { n: 0, p2o5: 0, k2o: 0 },
        netRequirementKgPerAcre: { n: 0, p2o5: 0, k2o: 0 },
        classifications,
        fertilizerRecommendations: [],
        splitSchedules: [],
        limitationsAndAssumptions: limitations,
        unsupportedParameters,
        evidenceReferences,
        calculatedAt: new Date().toISOString(),
      };

      return CropNutrientOutputSchema.parse(emptyOutput);
    }

    const eq = lookupResult.equation;
    evidenceReferences.push(
      `${eq.sourceInstitution} — ${eq.sourcePublication} (Version: ${eq.equationVersion}) [${eq.sourceReference}]`
    );

    limitations.push(...eq.notes);
    limitations.push(
      `Calibrated specifically for ${eq.soilConditions} under adequate irrigation.`
    );

    // 4. Extract soil test values in kg/ha
    const snKgHa = soilParameters.primary.availableNitrogen.value;
    const spKgHa = soilParameters.primary.availablePhosphorus.value;
    const skKgHa = soilParameters.primary.availablePotassium.value;

    // 5. STCR Target-Yield Calculations
    // Gross Crop Requirement (T * targetYieldFactor)
    const cropDemandN = Math.round(targetYieldQuintalsPerHa * eq.nitrogenEquation.targetYieldFactor * 10) / 10;
    const cropDemandP2O5 = Math.round(targetYieldQuintalsPerHa * eq.phosphorusEquation.targetYieldFactor * 10) / 10;
    const cropDemandK2O = Math.round(targetYieldQuintalsPerHa * eq.potassiumEquation.targetYieldFactor * 10) / 10;

    // Soil Contribution (SN * soilFactor)
    const soilContribN = Math.round(snKgHa * eq.nitrogenEquation.soilFactor * 10) / 10;
    const soilContribP2O5 = Math.round(spKgHa * eq.phosphorusEquation.soilFactor * 10) / 10;
    const soilContribK2O = Math.round(skKgHa * eq.potassiumEquation.soilFactor * 10) / 10;

    // 6. Organic Manure (FYM) Credit Calculation
    let fymCreditN = 0;
    let fymCreditP2O5 = 0;
    let fymCreditK2O = 0;

    if (input.organicManureTonnesPerHa > 0) {
      if (
        eq.nitrogenEquation.fymFactor !== undefined &&
        eq.phosphorusEquation.fymFactor !== undefined &&
        eq.potassiumEquation.fymFactor !== undefined
      ) {
        fymCreditN = Math.round(input.organicManureTonnesPerHa * eq.nitrogenEquation.fymFactor * 10) / 10;
        fymCreditP2O5 = Math.round(input.organicManureTonnesPerHa * eq.phosphorusEquation.fymFactor * 10) / 10;
        fymCreditK2O = Math.round(input.organicManureTonnesPerHa * eq.potassiumEquation.fymFactor * 10) / 10;
        limitations.push(
          `FYM credit of ${fymCreditN} kg N, ${fymCreditP2O5} kg P2O5, and ${fymCreditK2O} kg K2O deducted using validated STCR-IPNS interaction coefficients for ${input.organicManureTonnesPerHa} tonnes/ha FYM.`
        );
      } else {
        limitations.push(
          `FYM application of ${input.organicManureTonnesPerHa} tonnes/ha was reported, but equation '${eq.equationId}' does not possess validated FYM interaction coefficients. In accordance with strict agronomic principles, no arbitrary numerical deduction was fabricated. Long-term residual fertility benefits are acknowledged.`
        );
      }
    }

    // 7. Net Nutrient Requirements (FN, FP2O5, FK2O)
    const netN = Math.max(0, Math.round((cropDemandN - soilContribN - fymCreditN) * 10) / 10);
    const netP2O5 = Math.max(0, Math.round((cropDemandP2O5 - soilContribP2O5 - fymCreditP2O5) * 10) / 10);
    const netK2O = Math.max(0, Math.round((cropDemandK2O - soilContribK2O - fymCreditK2O) * 10) / 10);

    // Convert kg/ha to kg/acre (1 hectare = 2.47105 acres)
    const HA_TO_ACRE = 2.47105;
    const netNAcre = Math.round((netN / HA_TO_ACRE) * 10) / 10;
    const netP2O5Acre = Math.round((netP2O5 / HA_TO_ACRE) * 10) / 10;
    const netK2OAcre = Math.round((netK2O / HA_TO_ACRE) * 10) / 10;

    // Check Micronutrient: Zinc (DTPA)
    let netZnHa = 0;
    let netZnAcre = 0;
    const znClassification = classifications.find((c) => c.parameterKey === "availableZincPpm");
    const isZnDeficient =
      znClassification?.rating === "DEFICIENT" ||
      (soilParameters.micronutrients?.availableZincPpm &&
        soilParameters.micronutrients.availableZincPpm.value < 0.6);

    if (isZnDeficient) {
      netZnHa = 5.25; // 25 kg ZnSO4.7H2O supplies 5.25 kg Zn/ha
      netZnAcre = Math.round((netZnHa / HA_TO_ACRE) * 10) / 10;
    }

    // 8. Commercial Fertilizer Product Allocation
    const fertilizerRecs: FertilizerProductRecommendation[] = [];
    let nSuppliedByDap = 0;
    let p2o5Supplied = 0;
    let k2oSupplied = 0;
    let nSuppliedByUrea = 0;
    let sSupplied = 0;
    let znSupplied = 0;

    // A. Phosphatic allocation (DAP or SSP)
    if (netP2O5 > 0) {
      if (normCrop === "mustard") {
        // Mustard benefits heavily from SSP supplying both P2O5 (16%) and Sulphur (11%)
        const sspProduct = this.fertilizerRegistry.getProduct("SSP")!;
        const sspKgHa = Math.round((netP2O5 / 0.16) * 10) / 10;
        const sspKgAcre = Math.round((sspKgHa / HA_TO_ACRE) * 10) / 10;
        p2o5Supplied = Math.round(sspKgHa * 0.16 * 10) / 10;
        sSupplied += Math.round(sspKgHa * 0.11 * 10) / 10;

        fertilizerRecs.push({
          productCode: "SSP",
          commercialName: sspProduct.commercialName,
          quantityKgPerHa: sspKgHa,
          quantityKgPerAcre: sspKgAcre,
          nutrientGrade: sspProduct.grade,
          nutrientsSuppliedKgPerHa: {
            n: 0,
            p2o5: p2o5Supplied,
            k2o: 0,
            s: Math.round(sspKgHa * 0.11 * 10) / 10,
          },
          applicationMethod: sspProduct.defaultApplicationMethod,
          precautions: sspProduct.precautions,
        });
      } else {
        // Standard crops: DAP (18% N, 46% P2O5)
        const dapProduct = this.fertilizerRegistry.getProduct("DAP")!;
        const dapKgHa = Math.round((netP2O5 / 0.46) * 10) / 10;
        const dapKgAcre = Math.round((dapKgHa / HA_TO_ACRE) * 10) / 10;
        p2o5Supplied = Math.round(dapKgHa * 0.46 * 10) / 10;
        nSuppliedByDap = Math.round(dapKgHa * 0.18 * 10) / 10;

        fertilizerRecs.push({
          productCode: "DAP",
          commercialName: dapProduct.commercialName,
          quantityKgPerHa: dapKgHa,
          quantityKgPerAcre: dapKgAcre,
          nutrientGrade: dapProduct.grade,
          nutrientsSuppliedKgPerHa: {
            n: nSuppliedByDap,
            p2o5: p2o5Supplied,
            k2o: 0,
          },
          applicationMethod: dapProduct.defaultApplicationMethod,
          precautions: dapProduct.precautions,
        });
      }
    }

    // B. Nitrogenous allocation (Urea 46% N)
    // CRITICAL: Deduct Nitrogen supplied by DAP to avoid double-counting!
    const remainingNRequirement = Math.max(0, Math.round((netN - nSuppliedByDap) * 10) / 10);
    if (remainingNRequirement > 0) {
      const ureaProduct = this.fertilizerRegistry.getProduct("UREA")!;
      const ureaKgHa = Math.round((remainingNRequirement / 0.46) * 10) / 10;
      const ureaKgAcre = Math.round((ureaKgHa / HA_TO_ACRE) * 10) / 10;
      nSuppliedByUrea = Math.round(ureaKgHa * 0.46 * 10) / 10;

      fertilizerRecs.push({
        productCode: "UREA",
        commercialName: ureaProduct.commercialName,
        quantityKgPerHa: ureaKgHa,
        quantityKgPerAcre: ureaKgAcre,
        nutrientGrade: ureaProduct.grade,
        nutrientsSuppliedKgPerHa: {
          n: nSuppliedByUrea,
          p2o5: 0,
          k2o: 0,
        },
        applicationMethod: ureaProduct.defaultApplicationMethod,
        precautions: ureaProduct.precautions,
      });
    }

    // C. Potassic allocation (MOP 60% K2O)
    if (netK2O > 0) {
      const mopProduct = this.fertilizerRegistry.getProduct("MOP")!;
      const mopKgHa = Math.round((netK2O / 0.60) * 10) / 10;
      const mopKgAcre = Math.round((mopKgHa / HA_TO_ACRE) * 10) / 10;
      k2oSupplied = Math.round(mopKgHa * 0.60 * 10) / 10;

      fertilizerRecs.push({
        productCode: "MOP",
        commercialName: mopProduct.commercialName,
        quantityKgPerHa: mopKgHa,
        quantityKgPerAcre: mopKgAcre,
        nutrientGrade: mopProduct.grade,
        nutrientsSuppliedKgPerHa: {
          n: 0,
          p2o5: 0,
          k2o: k2oSupplied,
        },
        applicationMethod: mopProduct.defaultApplicationMethod,
        precautions: mopProduct.precautions,
      });
    }

    // D. Micronutrient allocation: Zinc Sulphate 21%
    if (isZnDeficient) {
      const znProduct = this.fertilizerRegistry.getProduct("ZINC_SULPHATE_HEPTAHYDRATE_21")!;
      const znKgHa = 25.0; // Standard 25 kg/ha basal recommendation
      const znKgAcre = Math.round((znKgHa / HA_TO_ACRE) * 10) / 10;
      znSupplied = Math.round(znKgHa * 0.21 * 10) / 10;
      sSupplied += Math.round(znKgHa * 0.10 * 10) / 10;

      fertilizerRecs.push({
        productCode: "ZINC_SULPHATE_HEPTAHYDRATE_21",
        commercialName: znProduct.commercialName,
        quantityKgPerHa: znKgHa,
        quantityKgPerAcre: znKgAcre,
        nutrientGrade: znProduct.grade,
        nutrientsSuppliedKgPerHa: {
          n: 0,
          p2o5: 0,
          k2o: 0,
          s: Math.round(znKgHa * 0.10 * 10) / 10,
          zn: znSupplied,
        },
        applicationMethod: znProduct.defaultApplicationMethod,
        precautions: znProduct.precautions,
      });
      limitations.push(
        "Zinc Sulphate (21%) recommended at 25 kg/ha due to deficient soil test (< 0.6 ppm). Apply once in 2-3 seasons."
      );
    }

    // 9. Multi-tier Nutrient Balance Accounting
    const totalNSupplied = Math.round((nSuppliedByDap + nSuppliedByUrea) * 10) / 10;
    const remainingDeficitN = Math.max(0, Math.round((netN - totalNSupplied) * 10) / 10);
    const remainingDeficitP2O5 = Math.max(0, Math.round((netP2O5 - p2o5Supplied) * 10) / 10);
    const remainingDeficitK2O = Math.max(0, Math.round((netK2O - k2oSupplied) * 10) / 10);

    const nutrientBalance: NutrientBalanceBreakdown = {
      cropDemandKgPerHa: {
        n: cropDemandN,
        p2o5: cropDemandP2O5,
        k2o: cropDemandK2O,
      },
      soilContributionKgPerHa: {
        n: soilContribN,
        p2o5: soilContribP2O5,
        k2o: soilContribK2O,
      },
      organicManureCreditKgPerHa: {
        n: fymCreditN,
        p2o5: fymCreditP2O5,
        k2o: fymCreditK2O,
      },
      fertilizerSuppliedKgPerHa: {
        n: totalNSupplied,
        p2o5: p2o5Supplied,
        k2o: k2oSupplied,
        s: sSupplied > 0 ? sSupplied : undefined,
        zn: znSupplied > 0 ? znSupplied : undefined,
      },
      remainingDeficitKgPerHa: {
        n: remainingDeficitN,
        p2o5: remainingDeficitP2O5,
        k2o: remainingDeficitK2O,
      },
    };

    // 10. Growth-Stage Split Application Schedule
    const { schedules: splitSchedules, limitations: scheduleLimitations } =
      SplitScheduler.generateSchedule(cropName, fertilizerRecs);
    limitations.push(...scheduleLimitations);

    // 11. Final Output Assembly
    const finalOutput: CropNutrientOutput = {
      calculationId: `calc_${fieldId}_${Date.now()}`,
      cropName,
      cropVariety: input.cropVariety,
      fieldId,
      targetYieldQuintalsPerHa,
      methodology: "STCR_TARGET_YIELD",
      calculationStatus: "COMPLETED",
      stcrEquationsApplied: [
        `FN = ${eq.nitrogenEquation.targetYieldFactor} * T - ${eq.nitrogenEquation.soilFactor} * SN${eq.nitrogenEquation.fymFactor ? ` - ${eq.nitrogenEquation.fymFactor} * FYM` : ""}`,
        `FP2O5 = ${eq.phosphorusEquation.targetYieldFactor} * T - ${eq.phosphorusEquation.soilFactor} * SP${eq.phosphorusEquation.fymFactor ? ` - ${eq.phosphorusEquation.fymFactor} * FYM` : ""}`,
        `FK2O = ${eq.potassiumEquation.targetYieldFactor} * T - ${eq.potassiumEquation.soilFactor} * SK${eq.potassiumEquation.fymFactor ? ` - ${eq.potassiumEquation.fymFactor} * FYM` : ""}`,
      ],
      netRequirementKgPerHa: {
        n: netN,
        p2o5: netP2O5,
        k2o: netK2O,
        zn: netZnHa > 0 ? netZnHa : undefined,
      },
      netRequirementKgPerAcre: {
        n: netNAcre,
        p2o5: netP2O5Acre,
        k2o: netK2OAcre,
        zn: netZnAcre > 0 ? netZnAcre : undefined,
      },
      nutrientBalance,
      classifications,
      fertilizerRecommendations: fertilizerRecs,
      splitSchedules,
      limitationsAndAssumptions: limitations,
      unsupportedParameters,
      evidenceReferences,
      calculatedAt: new Date().toISOString(),
    };

    return CropNutrientOutputSchema.parse(finalOutput);
  }
}
