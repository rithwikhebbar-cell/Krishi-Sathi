import { AgriculturalAdvisory } from "../contracts/soil/advisoryTypes";
import { CropNutrientOutput } from "../contracts/soil/nutrientTypes";
import { CropWaterOutput } from "../engines/types";
import { EvidenceManager } from "../evidence/evidenceManager";
import { ValidationError } from "../contracts/errors";

export interface IntegrityValidationResult {
  isValid: boolean;
  errors: string[];
}

export class AdvisoryIntegrityValidator {
  /**
   * Strictly validates that the AI-synthesized advisory has not altered, invented,
   * or overridden any authoritative deterministic nutrient or crop-water values,
   * and that all cited evidence exists in the EvidenceManager.
   */
  public static validate(
    advisory: AgriculturalAdvisory,
    deterministicCalculation: CropNutrientOutput,
    evidenceManager: EvidenceManager,
    cropWaterAssessment?: CropWaterOutput
  ): IntegrityValidationResult {
    const errors: string[] = [];
    const tolerance = 0.1;

    // 1. Verify Net Nutrient Requirement Numbers (N, P2O5, K2O)
    const expectedN = deterministicCalculation.netRequirementKgPerHa.n;
    const actualN = advisory.nutrientManagement.protectedNetNutrientRequirement.n;
    if (Math.abs(expectedN - actualN) > tolerance) {
      errors.push(
        `Deterministic N requirement violation: Expected ${expectedN} kg/ha, received ${actualN} kg/ha in advisory.`
      );
    }

    const expectedP = deterministicCalculation.netRequirementKgPerHa.p2o5;
    const actualP = advisory.nutrientManagement.protectedNetNutrientRequirement.p2o5;
    if (Math.abs(expectedP - actualP) > tolerance) {
      errors.push(
        `Deterministic P2O5 requirement violation: Expected ${expectedP} kg/ha, received ${actualP} kg/ha in advisory.`
      );
    }

    const expectedK = deterministicCalculation.netRequirementKgPerHa.k2o;
    const actualK = advisory.nutrientManagement.protectedNetNutrientRequirement.k2o;
    if (Math.abs(expectedK - actualK) > tolerance) {
      errors.push(
        `Deterministic K2O requirement violation: Expected ${expectedK} kg/ha, received ${actualK} kg/ha in advisory.`
      );
    }

    // 2. Verify Commercial Fertilizer Doses
    const expectedFertilizers = deterministicCalculation.fertilizerRecommendations;
    for (const exp of expectedFertilizers) {
      const match = advisory.nutrientManagement.protectedFertilizerDoses.find(
        (f) => f.productCode === exp.productCode
      );
      if (!match) {
        errors.push(
          `Missing commercial fertilizer product '${exp.productCode}' in synthesized advisory.`
        );
      } else if (Math.abs(match.quantityKgPerHa - exp.quantityKgPerHa) > tolerance) {
        errors.push(
          `Fertilizer quantity mismatch for '${exp.productCode}': Expected ${exp.quantityKgPerHa} kg/ha, received ${match.quantityKgPerHa} kg/ha in advisory.`
        );
      }
    }

    // 3. Verify Crop Water Demand (FAO-56)
    if (cropWaterAssessment) {
      const expectedEtc = cropWaterAssessment.cropWaterRequirementEtcMmDay;
      const actualEtc = advisory.waterManagement.protectedEtcMmDay;
      if (Math.abs(expectedEtc - actualEtc) > tolerance) {
        errors.push(
          `Deterministic Crop Water ETc violation: Expected ${expectedEtc} mm/day, received ${actualEtc} mm/day in advisory.`
        );
      }

      const expectedNetIrr = cropWaterAssessment.netIrrigationRequirementMmDay;
      const actualNetIrr = advisory.waterManagement.protectedNetIrrigationMmDay;
      if (Math.abs(expectedNetIrr - actualNetIrr) > tolerance) {
        errors.push(
          `Deterministic Net Irrigation violation: Expected ${expectedNetIrr} mm/day, received ${actualNetIrr} mm/day in advisory.`
        );
      }
    }

    // 4. Verify Evidence Citations (Grounding Integrity)
    const validEvidenceIds = new Set(evidenceManager.list().map((e) => e.id));
    for (const source of advisory.evidenceAndLimitations.supportingSources) {
      if (!validEvidenceIds.has(source.evidenceId)) {
        errors.push(
          `Fabricated or unregistered evidence citation '${source.evidenceId}' ("${source.title}") detected in advisory.`
        );
      }
    }

    // 5. Verify Unsupported Parameters Status
    if (deterministicCalculation.calculationStatus === "UNSUPPORTED_PARAMETERS") {
      const hasExplanation =
        advisory.evidenceAndLimitations.unsupportedRecommendations.length > 0 ||
        advisory.nutrientManagement.npkStrategyExplanation.toLowerCase().includes("unsupported");
      if (!hasExplanation) {
        errors.push(
          "Deterministic engine reported UNSUPPORTED_PARAMETERS, but advisory did not document unsupported limitations."
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Enforces and patches authoritative values directly onto an advisory payload
   * so that the deterministic calculation always remains strictly authoritative.
   */
  public static enforceAuthoritativeValues(
    advisory: AgriculturalAdvisory,
    deterministicCalculation: CropNutrientOutput,
    cropWaterAssessment?: CropWaterOutput
  ): AgriculturalAdvisory {
    advisory.nutrientManagement.protectedNetNutrientRequirement = {
      n: deterministicCalculation.netRequirementKgPerHa.n,
      p2o5: deterministicCalculation.netRequirementKgPerHa.p2o5,
      k2o: deterministicCalculation.netRequirementKgPerHa.k2o,
    };

    advisory.nutrientManagement.protectedFertilizerDoses =
      deterministicCalculation.fertilizerRecommendations.map((f) => ({
        productCode: f.productCode,
        commercialName: f.commercialName,
        quantityKgPerHa: f.quantityKgPerHa,
        quantityKgPerAcre: f.quantityKgPerAcre,
      }));

    if (cropWaterAssessment) {
      advisory.waterManagement.protectedEtcMmDay = cropWaterAssessment.cropWaterRequirementEtcMmDay;
      advisory.waterManagement.protectedNetIrrigationMmDay = cropWaterAssessment.netIrrigationRequirementMmDay;
    }

    return advisory;
  }
}
