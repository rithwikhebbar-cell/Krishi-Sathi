import { z } from "zod";
import { CropNutrientOutputSchema } from "./nutrientTypes";
import { CropWaterOutputSchema } from "../../engines/types";

// ============================================================================
// 1. Confidence & Uncertainty Enums
// ============================================================================

export const AdvisoryConfidenceLevelValues = [
  "HIGH",
  "MODERATE",
  "LOW",
  "INSUFFICIENT_DATA",
] as const;

export const AdvisoryConfidenceLevelSchema = z.enum(AdvisoryConfidenceLevelValues);
export type AdvisoryConfidenceLevel = z.infer<typeof AdvisoryConfidenceLevelSchema>;

export const AdvisoryConfidenceAssessmentSchema = z.object({
  soilDataQuality: AdvisoryConfidenceLevelSchema,
  calculationValidity: AdvisoryConfidenceLevelSchema,
  evidenceQuality: AdvisoryConfidenceLevelSchema,
  overallCompleteness: AdvisoryConfidenceLevelSchema,
  confidenceRationale: z.string().trim().min(1),
});
export type AdvisoryConfidenceAssessment = z.infer<typeof AdvisoryConfidenceAssessmentSchema>;

// ============================================================================
// 2. Advisory Content Sections
// ============================================================================

// A. Field Overview
export const AdvisoryFieldOverviewSchema = z.object({
  fieldId: z.string().min(1),
  fieldName: z.string().min(1),
  cropName: z.string().min(1),
  cropVariety: z.string().optional(),
  targetYieldQuintalsPerHa: z.number().positive(),
  season: z.string(),
  areaAcres: z.number().positive(),
  soilSummary: z.string().trim().min(5),
  primarySoilLimitations: z.array(z.string()).default([]),
});
export type AdvisoryFieldOverview = z.infer<typeof AdvisoryFieldOverviewSchema>;

// B. Soil Health Interpretation
export const AdvisorySoilHealthSchema = z.object({
  interpretationSummary: z.string().trim().min(5),
  phAndSalinityAssessment: z.string().trim().min(5),
  organicCarbonAssessment: z.string().trim().min(5),
  deficienciesOrExcesses: z.array(z.string()).default([]),
  parametersRequiringRetest: z.array(z.string()).default([]),
});
export type AdvisorySoilHealth = z.infer<typeof AdvisorySoilHealthSchema>;

// C. Nutrient Management Advisory
export const AdvisoryNutrientManagementSchema = z.object({
  npkStrategyExplanation: z.string().trim().min(10),
  recommendedProductsExplanation: z.string().trim().min(10),
  splitApplicationRationale: z.string().trim().min(10),
  secondaryAndMicronutrientNotes: z.array(z.string()).default([]),
  organicManureNotes: z.string().optional(),
  protectedFertilizerDoses: z.array(
    z.object({
      productCode: z.string(),
      commercialName: z.string(),
      quantityKgPerHa: z.number().nonnegative(),
      quantityKgPerAcre: z.number().nonnegative(),
    })
  ),
  protectedNetNutrientRequirement: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
  }),
});
export type AdvisoryNutrientManagement = z.infer<typeof AdvisoryNutrientManagementSchema>;

// D. Water Management Advisory
export const AdvisoryWaterManagementSchema = z.object({
  cropWaterSummary: z.string().trim().min(10),
  fao56Assessment: z.string().trim().min(10),
  weatherAndRainfallContext: z.string().trim().min(5),
  irrigationPracticesAndRestrictions: z.array(z.string()).default([]),
  protectedEtcMmDay: z.number().nonnegative(),
  protectedNetIrrigationMmDay: z.number().nonnegative(),
});
export type AdvisoryWaterManagement = z.infer<typeof AdvisoryWaterManagementSchema>;

// E. Practical Action Plan
export const AdvisoryActionPlanSchema = z.object({
  immediateActions: z.array(z.string()).min(1),
  upcomingStageActions: z.array(
    z.object({
      stageCode: z.string(),
      stageTitle: z.string(),
      actions: z.array(z.string()),
    })
  ).default([]),
  monitoringRequirements: z.array(z.string()).default([]),
  followUpTestingRecommendations: z.array(z.string()).default([]),
});
export type AdvisoryActionPlan = z.infer<typeof AdvisoryActionPlanSchema>;

// F. Evidence and Limitations
export const AdvisorySourceReferenceSchema = z.object({
  evidenceId: z.string().min(1),
  title: z.string().min(1),
  publisherOrInstitution: z.string().min(1),
  url: z.string().optional(),
  applicableRegion: z.string().optional(),
  applicableCrop: z.string().optional(),
  relevanceNote: z.string().optional(),
});
export type AdvisorySourceReference = z.infer<typeof AdvisorySourceReferenceSchema>;

export const AdvisoryEvidenceAndLimitationsSchema = z.object({
  supportingSources: z.array(AdvisorySourceReferenceSchema).default([]),
  knownLimitations: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  unsupportedRecommendations: z.array(z.string()).default([]),
  conflictingGuidance: z.array(z.string()).default([]),
});
export type AdvisoryEvidenceAndLimitations = z.infer<typeof AdvisoryEvidenceAndLimitationsSchema>;

// ============================================================================
// 3. Complete Agricultural Advisory Envelope
// ============================================================================

export const AgriculturalAdvisorySchema = z.object({
  id: z.string().min(1),
  fieldId: z.string().min(1),
  farmerId: z.string().min(1),
  soilTestRecordId: z.string().min(1),
  cropName: z.string().min(1),
  cropVariety: z.string().optional(),
  targetYieldQuintalsPerHa: z.number().positive(),
  croppingSeason: z.string(),
  fieldOverview: AdvisoryFieldOverviewSchema,
  soilHealth: AdvisorySoilHealthSchema,
  nutrientManagement: AdvisoryNutrientManagementSchema,
  waterManagement: AdvisoryWaterManagementSchema,
  actionPlan: AdvisoryActionPlanSchema,
  evidenceAndLimitations: AdvisoryEvidenceAndLimitationsSchema,
  confidence: AdvisoryConfidenceAssessmentSchema,
  deterministicCalculation: CropNutrientOutputSchema,
  cropWaterAssessment: CropWaterOutputSchema.optional(),
  weatherSummary: z.string().optional(),
  generatedAt: z.string().datetime(),
  modelVersion: z.string().default("gemini-1.5-flash"),
  version: z.number().int().positive().default(1),
});
export type AgriculturalAdvisory = z.infer<typeof AgriculturalAdvisorySchema>;

// ============================================================================
// 4. Advisory Generation Input Schema
// ============================================================================

export const GenerateAdvisoryInputSchema = z.object({
  fieldId: z.string().min(1, "fieldId is required"),
  cropName: z.string().trim().min(1, "cropName is required"),
  cropVariety: z.string().trim().optional(),
  targetYieldQuintalsPerHa: z.number().positive("targetYieldQuintalsPerHa must be > 0"),
  croppingSeason: z.string().default("RABI"),
  growthStage: z.enum(["initial", "development", "mid_season", "late_season"]).default("initial"),
  organicManureTonnesPerHa: z.number().nonnegative().default(0),
  greenManuringDone: z.boolean().default(false),
  previousCropLegume: z.boolean().default(false),
  notes: z.string().trim().optional(),
});
export type GenerateAdvisoryInput = z.infer<typeof GenerateAdvisoryInputSchema>;
