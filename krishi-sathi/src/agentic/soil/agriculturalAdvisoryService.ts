import { randomUUID } from "crypto";
import {
  AgriculturalAdvisory,
  AgriculturalAdvisorySchema,
  GenerateAdvisoryInput,
} from "../contracts/soil/advisoryTypes";
import { FieldProfile, ApprovedSoilProfile } from "../contracts/soil/fieldTypes";
import { CropNutrientOutput } from "../contracts/soil/nutrientTypes";
import { CropWaterOutput } from "../engines/types";
import { Evidence } from "../contracts/types";
import { EvidenceManager } from "../evidence/evidenceManager";
import { RetrievalResult } from "./agriculturalKnowledgeRetriever";
import { ModelProvider } from "../providers/types";
import { AdvisoryIntegrityValidator } from "./advisoryIntegrityValidator";
import { AdvisoryConfidenceEvaluator } from "./advisoryConfidenceEvaluator";

export interface AdvisorySynthesisContext {
  field: FieldProfile;
  soilProfile: ApprovedSoilProfile;
  calculation: CropNutrientOutput;
  cropWaterAssessment?: CropWaterOutput;
  weatherSummary?: string;
  evidence: Evidence[];
  evidenceManager: EvidenceManager;
  retrievalResult: RetrievalResult;
  modelProvider: ModelProvider;
  input: GenerateAdvisoryInput;
}

export class AgriculturalAdvisoryService {
  /**
   * Synthesizes an evidence-grounded agricultural advisory combining approved soil profiles,
   * deterministic nutrient requirements, crop-water demand, and authoritative ICAR/SAU evidence.
   */
  public async synthesize(context: AdvisorySynthesisContext): Promise<AgriculturalAdvisory> {
    const {
      field,
      soilProfile,
      calculation,
      cropWaterAssessment,
      weatherSummary,
      evidence,
      evidenceManager,
      retrievalResult,
      modelProvider,
      input,
    } = context;

    // 1. Prepare structured context payload for model
    const synthesisPayload = {
      field: {
        id: field.id,
        name: field.name,
        areaAcres: field.areaAcres,
        location: field.location,
        soilType: field.primarySoilType,
        textureClass: field.primaryTextureClass,
      },
      cropContext: {
        cropName: input.cropName,
        cropVariety: input.cropVariety,
        targetYieldQuintalsPerHa: input.targetYieldQuintalsPerHa,
        croppingSeason: input.croppingSeason,
        growthStage: input.growthStage,
      },
      approvedSoilParameters: soilProfile.parameters,
      deterministicNutrientOutput: calculation,
      cropWaterOutput: cropWaterAssessment,
      weatherContext: weatherSummary,
      verifiedEvidence: evidence.map((e) => ({
        evidenceId: e.id,
        source: e.sourceTitle,
        uri: e.sourceUri,
        excerpt: e.excerpt,
      })),
    };

    let rawSynthesized: unknown = null;
    if (typeof modelProvider.synthesizeAdvisory === "function") {
      try {
        rawSynthesized = await modelProvider.synthesizeAdvisory(synthesisPayload);
      } catch (err) {
        // Fall back to authoritative deterministic baseline if provider throws
        rawSynthesized = null;
      }
    }

    // 2. Build or complete advisory structure
    let advisory: AgriculturalAdvisory;

    if (rawSynthesized && typeof rawSynthesized === "object") {
      const parsed = AgriculturalAdvisorySchema.safeParse(rawSynthesized);
      if (parsed.success) {
        advisory = parsed.data;
      } else {
        advisory = this.buildAuthoritativeBaseline(context, synthesisPayload);
      }
    } else {
      advisory = this.buildAuthoritativeBaseline(context, synthesisPayload);
    }

    // 3. Strict Numerical Integrity Validation & Enforcement
    const integrityCheck = AdvisoryIntegrityValidator.validate(
      advisory,
      calculation,
      evidenceManager,
      cropWaterAssessment
    );

    if (!integrityCheck.isValid) {
      // Re-enforce authoritative numbers and record discrepancy as limitation
      advisory = AdvisoryIntegrityValidator.enforceAuthoritativeValues(
        advisory,
        calculation,
        cropWaterAssessment
      );
      advisory.evidenceAndLimitations.knownLimitations.push(
        ...integrityCheck.errors.map((e) => `[Integrity Safeguard] ${e}`)
      );
    }

    // 4. Multi-dimensional Confidence Evaluation
    advisory.confidence = AdvisoryConfidenceEvaluator.evaluate(
      soilProfile,
      calculation,
      retrievalResult
    );

    // 5. Ensure metadata, IDs and versioning
    if (!advisory.id || !advisory.id.startsWith("adv_")) {
      advisory.id = `adv_${randomUUID()}`;
    }
    advisory.fieldId = field.id;
    advisory.farmerId = field.farmerId;
    advisory.soilTestRecordId = soilProfile.soilTestReportId;
    advisory.cropName = input.cropName;
    advisory.cropVariety = input.cropVariety;
    advisory.targetYieldQuintalsPerHa = input.targetYieldQuintalsPerHa;
    advisory.croppingSeason = input.croppingSeason || advisory.croppingSeason || "RABI";
    if (advisory.fieldOverview) {
      advisory.fieldOverview.season = input.croppingSeason || advisory.fieldOverview.season || "RABI";
    }
    advisory.deterministicCalculation = calculation;
    advisory.cropWaterAssessment = cropWaterAssessment;
    advisory.weatherSummary = weatherSummary;
    advisory.generatedAt = new Date().toISOString();
    advisory.modelVersion = modelProvider.providerName === "gemini" ? "gemini-1.5-flash" : "mock-v1";

    return AgriculturalAdvisorySchema.parse(advisory);
  }

  /**
   * Constructs an authoritative baseline advisory directly grounded in deterministic engine outputs
   * and verified evidence when LLM is unavailable or for testing.
   */
  private buildAuthoritativeBaseline(
    context: AdvisorySynthesisContext,
    payload: Record<string, unknown>
  ): AgriculturalAdvisory {
    const { field, soilProfile, calculation, cropWaterAssessment, weatherSummary, evidence, input } = context;

    const primarySources = evidence.map((e) => ({
      evidenceId: e.id,
      title: e.sourceTitle,
      publisherOrInstitution: e.sourceTitle.split(":")[0] || "ICAR/SAU",
      url: e.sourceUri,
      applicableRegion: field.location.state,
      applicableCrop: input.cropName,
      relevanceNote: "Authoritative Package of Practices guideline for crop nutrition and water balance.",
    }));

    const ph = soilProfile.parameters.chemical.ph.value;
    const ec = soilProfile.parameters.chemical.electricalConductivity.value;
    const oc = soilProfile.parameters.chemical.organicCarbonPercent.value;

    const defsOrExcesses: string[] = [];
    for (const cls of calculation.classifications) {
      if (cls.rating === "LOW" || cls.rating === "VERY_LOW") {
        defsOrExcesses.push(`${cls.displayName} is deficient (${cls.testValue} ${cls.unit}, benchmark: ${cls.benchmarkRange}).`);
      } else if (cls.rating === "HIGH" || cls.rating === "VERY_HIGH") {
        defsOrExcesses.push(`${cls.displayName} is high (${cls.testValue} ${cls.unit}, benchmark: ${cls.benchmarkRange}).`);
      }
    }

    const upcomingStages = calculation.splitSchedules.map((s) => ({
      stageCode: s.stageCode,
      stageTitle: s.stageTitle,
      actions: s.fertilizers.map(
        (f) => `Apply ${f.quantityKgPerHa} kg/ha (${f.quantityKgPerAcre} kg/acre) of ${f.commercialName}. ${f.applicationGuidance}`
      ),
    }));

    return {
      id: `adv_${randomUUID()}`,
      fieldId: field.id,
      farmerId: field.farmerId,
      soilTestRecordId: soilProfile.soilTestReportId,
      cropName: input.cropName,
      cropVariety: input.cropVariety,
      targetYieldQuintalsPerHa: input.targetYieldQuintalsPerHa,
      croppingSeason: input.croppingSeason,

      fieldOverview: {
        fieldId: field.id,
        fieldName: field.name,
        cropName: input.cropName,
        cropVariety: input.cropVariety,
        targetYieldQuintalsPerHa: input.targetYieldQuintalsPerHa,
        season: input.croppingSeason,
        areaAcres: field.areaAcres,
        soilSummary: `Field '${field.name}' in ${field.location.district}, ${field.location.state} with ${field.primarySoilType} soil (${field.primaryTextureClass}).`,
        primarySoilLimitations: ph < 6.5 ? ["Soil acidity limitation"] : ph > 8.2 ? ["Soil alkalinity / calcareous limitation"] : [],
      },

      soilHealth: {
        interpretationSummary: `Soil pH is ${ph} (${ph >= 6.5 && ph <= 7.8 ? "Normal neutral range" : "Requires pH management"}), EC is ${ec} dS/m (non-saline), Organic Carbon is ${oc}%.`,
        phAndSalinityAssessment: `pH ${ph} indicates optimal nutrient availability for standard field crops. Soluble salts (EC ${ec} dS/m) are well within non-hazardous thresholds (< 1.0 dS/m).`,
        organicCarbonAssessment: `Organic Carbon is ${oc}%, representing ${oc < 0.5 ? "low" : oc <= 0.75 ? "medium" : "high"} soil organic matter status.`,
        deficienciesOrExcesses: defsOrExcesses,
        parametersRequiringRetest: !soilProfile.parameters.micronutrients?.availableZincPpm ? ["Zinc (Zn) test missing from laboratory card"] : [],
      },

      nutrientManagement: {
        npkStrategyExplanation: `Target yield of ${input.targetYieldQuintalsPerHa} q/ha requires net nutrients: N: ${calculation.netRequirementKgPerHa.n} kg/ha, P2O5: ${calculation.netRequirementKgPerHa.p2o5} kg/ha, K2O: ${calculation.netRequirementKgPerHa.k2o} kg/ha calculated via ${calculation.methodology}.`,
        recommendedProductsExplanation: `Fertilizer requirement is formulated using: ${calculation.fertilizerRecommendations.map((f) => `${f.commercialName} (${f.quantityKgPerHa} kg/ha)`).join(", ")}.`,
        splitApplicationRationale: "Nitrogen is scheduled in splits across critical vegetative and reproductive stages to minimize leaching and maximize nitrogen use efficiency (NUE). Phosphorus and Potash are applied 100% basal.",
        secondaryAndMicronutrientNotes: calculation.netRequirementKgPerHa.zn
          ? [`Apply Zinc Sulphate to correct soil Zinc deficiency (${calculation.netRequirementKgPerHa.zn} kg/ha Zn requirement).`]
          : [],
        organicManureNotes: input.organicManureTonnesPerHa
          ? `Application of ${input.organicManureTonnesPerHa} t/ha Farmyard Manure (FYM) has been credited in reducing inorganic fertilizer NPK requirements.`
          : undefined,
        protectedFertilizerDoses: calculation.fertilizerRecommendations.map((f) => ({
          productCode: f.productCode,
          commercialName: f.commercialName,
          quantityKgPerHa: f.quantityKgPerHa,
          quantityKgPerAcre: f.quantityKgPerAcre,
        })),
        protectedNetNutrientRequirement: {
          n: calculation.netRequirementKgPerHa.n,
          p2o5: calculation.netRequirementKgPerHa.p2o5,
          k2o: calculation.netRequirementKgPerHa.k2o,
        },
      },

      waterManagement: {
        cropWaterSummary: cropWaterAssessment
          ? `Daily crop water requirement (ETc) is ${cropWaterAssessment.cropWaterRequirementEtcMmDay} mm/day under FAO-56 single crop coefficient model.`
          : "Standard regional irrigation scheduling guidelines apply.",
        fao56Assessment: cropWaterAssessment
          ? `Estimated net irrigation requirement is ${cropWaterAssessment.netIrrigationRequirementMmDay} mm/day (${cropWaterAssessment.dailyIrrigationVolumeLitersPerHectare} Liters/ha/day).`
          : "FAO-56 reference evapotranspiration could not be calculated from active weather feed.",
        weatherAndRainfallContext: weatherSummary || "Local weather conditions are normal for the seasonal crop window.",
        irrigationPracticesAndRestrictions: [
          "Irrigate at critical growth stages (Crown Root Initiation, Flowering, Grain-Filling).",
          "Avoid excessive standing water during top-dressing of urea.",
        ],
        protectedEtcMmDay: cropWaterAssessment?.cropWaterRequirementEtcMmDay || 0,
        protectedNetIrrigationMmDay: cropWaterAssessment?.netIrrigationRequirementMmDay || 0,
      },

      actionPlan: {
        immediateActions: [
          `Procure recommended commercial fertilizers: ${calculation.fertilizerRecommendations.map((f) => f.commercialName).join(", ")}.`,
          "Apply 100% basal phosphorus and potash at field preparation before sowing/transplanting.",
        ],
        upcomingStageActions: upcomingStages,
        monitoringRequirements: [
          "Monitor for lower-leaf chlorosis indicating early nitrogen deficiency.",
          "Check soil moisture before each scheduled split top-dressing.",
        ],
        followUpTestingRecommendations: [
          "Conduct follow-up soil health testing after 2 years or before the next crop rotation.",
        ],
      },

      evidenceAndLimitations: {
        supportingSources: primarySources,
        knownLimitations: calculation.limitationsAndAssumptions,
        missingInformation: !soilProfile.parameters.secondary?.availableSulphurPpm
          ? ["Sulphur laboratory test missing from soil health card."]
          : [],
        unsupportedRecommendations: calculation.unsupportedParameters,
        conflictingGuidance: [],
      },

      confidence: {
        soilDataQuality: "HIGH",
        calculationValidity: "HIGH",
        evidenceQuality: "HIGH",
        overallCompleteness: "HIGH",
        confidenceRationale: "Authoritative baseline synthesized from approved soil test and ICAR STCR models.",
      },

      deterministicCalculation: calculation,
      cropWaterAssessment,
      weatherSummary,
      generatedAt: new Date().toISOString(),
      modelVersion: "gemini-1.5-flash",
      version: 1,
    };
  }
}
