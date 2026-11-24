import {
  AdvisoryConfidenceAssessment,
  AdvisoryConfidenceLevel,
} from "../contracts/soil/advisoryTypes";
import { ApprovedSoilProfile } from "../contracts/soil/fieldTypes";
import { CropNutrientOutput } from "../contracts/soil/nutrientTypes";
import { RetrievalResult } from "./agriculturalKnowledgeRetriever";

export class AdvisoryConfidenceEvaluator {
  /**
   * Deterministically evaluates confidence across four critical dimensions:
   * 1. Soil Data Quality
   * 2. Calculation Validity
   * 3. Evidence Quality
   * 4. Overall Completeness
   */
  public static evaluate(
    soilProfile: ApprovedSoilProfile | null,
    calculation: CropNutrientOutput,
    retrievalResult: RetrievalResult
  ): AdvisoryConfidenceAssessment {
    const rationaleParts: string[] = [];

    // 1. Soil Data Quality Evaluation
    let soilQuality: AdvisoryConfidenceLevel = "HIGH";
    if (!soilProfile) {
      soilQuality = "INSUFFICIENT_DATA";
      rationaleParts.push("No approved active soil profile exists for this field.");
    } else {
      const testDate = new Date(soilProfile.effectiveFrom).getTime();
      const ageYears = (Date.now() - testDate) / (1000 * 60 * 60 * 24 * 365.25);

      if (ageYears > 3.0) {
        soilQuality = "LOW";
        rationaleParts.push("Soil test report is over 3 years old; nutrients may have altered.");
      } else if (ageYears > 2.0) {
        soilQuality = "MODERATE";
        rationaleParts.push("Soil test is between 2-3 years old.");
      }

      // Check missing micronutrients/secondary nutrients
      const hasSecondary = soilProfile.parameters.secondary && Object.keys(soilProfile.parameters.secondary).length > 0;
      const hasMicro = soilProfile.parameters.micronutrients && Object.keys(soilProfile.parameters.micronutrients).length > 0;
      if (!hasSecondary || !hasMicro) {
        if (soilQuality === "HIGH") soilQuality = "MODERATE";
        rationaleParts.push("Secondary (Sulphur) or micronutrient (Zinc, Boron) tests were not included in lab report.");
      }
    }

    // 2. Calculation Validity Evaluation
    let calcValidity: AdvisoryConfidenceLevel = "HIGH";
    if (calculation.calculationStatus === "UNSUPPORTED_PARAMETERS") {
      calcValidity = "INSUFFICIENT_DATA";
      rationaleParts.push(`Nutrient calculation limited: ${calculation.unsupportedParameters.join(", ")}.`);
    } else if (calculation.methodology === "GENERAL_RECOMMENDED_DOSE") {
      calcValidity = "LOW";
      rationaleParts.push("State blanket recommended dose applied (no STCR targeted yield equation available).");
    } else if (calculation.methodology === "SOIL_TEST_RATING_PERCENTILE") {
      calcValidity = "MODERATE";
      rationaleParts.push("Calculated using ICAR percentile ratings adjustment.");
    } else {
      calcValidity = "HIGH";
      rationaleParts.push("Calculated using authoritative regional STCR targeted yield equations.");
    }

    // 3. Evidence Quality Evaluation
    let evidenceQuality: AdvisoryConfidenceLevel = "HIGH";
    if (retrievalResult.matchedDocumentsCount === 0) {
      evidenceQuality = "INSUFFICIENT_DATA";
      rationaleParts.push("No verified ICAR/SAU evidence matched this specific crop and region.");
    } else if (retrievalResult.regionalWarning) {
      evidenceQuality = "MODERATE";
      rationaleParts.push(retrievalResult.regionalWarning);
    } else {
      evidenceQuality = "HIGH";
      rationaleParts.push(`${retrievalResult.matchedDocumentsCount} verified ICAR/SAU agronomic packages of practices supported this advisory.`);
    }

    // 4. Overall Completeness Evaluation
    let overallCompleteness: AdvisoryConfidenceLevel = "HIGH";
    if (soilQuality === "INSUFFICIENT_DATA" || calcValidity === "INSUFFICIENT_DATA") {
      overallCompleteness = "INSUFFICIENT_DATA";
    } else if (soilQuality === "LOW" || calcValidity === "LOW" || (evidenceQuality as string) === "LOW") {
      overallCompleteness = "LOW";
    } else if (soilQuality === "MODERATE" || calcValidity === "MODERATE" || evidenceQuality === "MODERATE") {
      overallCompleteness = "MODERATE";
    } else {
      overallCompleteness = "HIGH";
    }

    return {
      soilDataQuality: soilQuality,
      calculationValidity: calcValidity,
      evidenceQuality,
      overallCompleteness,
      confidenceRationale: rationaleParts.join(" "),
    };
  }
}
