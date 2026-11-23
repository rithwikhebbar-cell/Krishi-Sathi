import { z } from "zod";
import { SoilParametersSchema, SoilNutrientRatingSchema } from "./soilParameters";

// ============================================================================
// 1. Agronomic Context Enums
// ============================================================================

export const CroppingSeasonValues = [
  "KHARIF",      // Monsoon season (June-October)
  "RABI",        // Winter season (October-April)
  "ZAID_SUMMER", // Summer season (March-June)
  "ANNUAL",      // E.g. Sugarcane
  "PERENNIAL",   // E.g. Orchard / Fruit crops
] as const;

export const CroppingSeasonSchema = z.enum(CroppingSeasonValues);

export const NutrientCalculationMethodologyValues = [
  "STCR_TARGET_YIELD",          // Soil Test Crop Response Targeted Yield equations
  "SOIL_TEST_RATING_PERCENTILE",// General ICAR % adjustment based on Low/Medium/High soil rating
  "GENERAL_RECOMMENDED_DOSE",   // State Agricultural University state blanket RDF
] as const;

export const NutrientCalculationMethodologySchema = z.enum(NutrientCalculationMethodologyValues);

export const NutrientCalculationStatusValues = [
  "COMPLETED",
  "PARTIAL",
  "UNSUPPORTED_PARAMETERS",
  "INSUFFICIENT_DATA",
] as const;

export const NutrientCalculationStatusSchema = z.enum(NutrientCalculationStatusValues);

export const FertilizerProductCodeValues = [
  "UREA",                 // 46% N
  "DAP",                  // 18% N, 46% P2O5
  "MOP",                  // 60% K2O (Muriate of Potash / Potassium Chloride)
  "SSP",                  // 16% P2O5, 11% S, 19% Ca (Single Super Phosphate)
  "NPK_10_26_26",         // Complex fertilizer
  "NPK_12_32_16",         // Complex fertilizer
  "NPK_20_20_0_13",       // Ammonium Phosphate Sulphate
  "ZINC_SULPHATE_HEPTAHYDRATE_21", // 21% Zn, 10% S
  "ZINC_SULPHATE_MONOHYDRATE_33",  // 33% Zn, 15% S
  "BENTONITE_SULPHUR_90", // 90% elemental S
  "BORAX_10_5",           // 10.5% Boron
  "FERROUS_SULPHATE_19",  // 19% Fe
  "OTHER_FERTILIZER",
] as const;

export const FertilizerProductCodeSchema = z.enum(FertilizerProductCodeValues);

export const SplitApplicationStageValues = [
  "BASAL_AT_SOWING",             // At sowing / transplanting
  "EARLY_VEGETATIVE_TILLERING",   // 20-30 days after sowing
  "PANICLE_INITIATION_FLOWERING", // 40-55 days after sowing
  "GRAIN_FILLING_DEVELOPMENT",   // Post-flowering
  "TOP_DRESSING_FIRST",
  "TOP_DRESSING_SECOND",
  "FOLIAR_SPRAY",
] as const;

export const SplitApplicationStageSchema = z.enum(SplitApplicationStageValues);

// ============================================================================
// 2. Calculation Input Schema
// ============================================================================

export const CropNutrientRequirementInputSchema = z.object({
  fieldId: z.string().min(1, "fieldId is required"),
  cropName: z.string().trim().min(1, "cropName is required"),
  cropVariety: z.string().trim().optional(),
  targetYieldQuintalsPerHa: z.number().positive("Target yield must be greater than 0 q/ha"),
  croppingSeason: CroppingSeasonSchema.default("RABI"),
  isIrrigated: z.boolean().default(true),
  soilParameters: SoilParametersSchema,
  organicManureTonnesPerHa: z.number().nonnegative().default(0), // Farmyard Manure (FYM)
  greenManuringDone: z.boolean().default(false),
  previousCropLegume: z.boolean().default(false),
  stateOrRegion: z.string().trim().optional(),
});

// ============================================================================
// 3. Nutrient Classification & Interpretation Schemas
// ============================================================================

export const NutrientClassificationSchema = z.object({
  parameterKey: z.string(),
  displayName: z.string(),
  testValue: z.number(),
  unit: z.string(),
  testMethod: z.string(),
  rating: SoilNutrientRatingSchema,
  benchmarkRange: z.string(), // E.g. "Medium: 280 - 560 kg/ha"
  interpretation: z.string(), // E.g. "Soil is deficient in available nitrogen; response to nitrogenous fertilizers will be high."
});

// ============================================================================
// 4. Fertilizer Product Recommendation Schemas
// ============================================================================

export const FertilizerGradeSpecsSchema = z.object({
  nPercent: z.number().nonnegative().max(100),
  p2o5Percent: z.number().nonnegative().max(100),
  k2oPercent: z.number().nonnegative().max(100),
  sPercent: z.number().nonnegative().max(100).optional(),
  znPercent: z.number().nonnegative().max(100).optional(),
  bPercent: z.number().nonnegative().max(100).optional(),
  fePercent: z.number().nonnegative().max(100).optional(),
});

export const FertilizerProductRecommendationSchema = z.object({
  productCode: FertilizerProductCodeSchema,
  commercialName: z.string().trim().min(1),
  quantityKgPerHa: z.number().nonnegative(),
  quantityKgPerAcre: z.number().nonnegative(),
  nutrientGrade: FertilizerGradeSpecsSchema,
  nutrientsSuppliedKgPerHa: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
    s: z.number().nonnegative().optional(),
    zn: z.number().nonnegative().optional(),
  }),
  applicationMethod: z.string().trim(),
  precautions: z.string().trim().optional(),
});

// ============================================================================
// 5. Growth-Stage Split Application Schedule Schemas
// ============================================================================

export const GrowthStageFertilizerItemSchema = z.object({
  productCode: FertilizerProductCodeSchema,
  commercialName: z.string(),
  quantityKgPerHa: z.number().nonnegative(),
  quantityKgPerAcre: z.number().nonnegative(),
  applicationGuidance: z.string(),
});

export const NutrientSplitApplicationScheduleSchema = z.object({
  stageCode: SplitApplicationStageSchema,
  stageTitle: z.string(),
  timingDescription: z.string(), // E.g. "At basal/sowing (0 DAS)"
  soilMoistureRequirement: z.string().optional(),
  fertilizers: z.array(GrowthStageFertilizerItemSchema),
  agronomicRationale: z.string(),
});

// Nutrient Balance Accounting Breakdown
export const NutrientBalanceBreakdownSchema = z.object({
  cropDemandKgPerHa: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
  }),
  soilContributionKgPerHa: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
  }),
  organicManureCreditKgPerHa: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
  }),
  fertilizerSuppliedKgPerHa: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
    s: z.number().nonnegative().optional(),
    zn: z.number().nonnegative().optional(),
  }),
  remainingDeficitKgPerHa: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
  }),
});

// ============================================================================
// 6. Comprehensive Deterministic Nutrient Output Schema
// ============================================================================

export const CropNutrientOutputSchema = z.object({
  calculationId: z.string().min(1),
  cropName: z.string().min(1),
  cropVariety: z.string().optional(),
  fieldId: z.string().min(1),
  targetYieldQuintalsPerHa: z.number().positive(),
  methodology: NutrientCalculationMethodologySchema,
  calculationStatus: NutrientCalculationStatusSchema.default("COMPLETED"),
  stcrEquationsApplied: z.array(z.string()).default([]),

  // Net Elemental/Oxide nutrient requirement calculated deterministically
  netRequirementKgPerHa: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
    s: z.number().nonnegative().optional(),
    zn: z.number().nonnegative().optional(),
    fe: z.number().nonnegative().optional(),
    b: z.number().nonnegative().optional(),
  }),
  netRequirementKgPerAcre: z.object({
    n: z.number().nonnegative(),
    p2o5: z.number().nonnegative(),
    k2o: z.number().nonnegative(),
    s: z.number().nonnegative().optional(),
    zn: z.number().nonnegative().optional(),
    fe: z.number().nonnegative().optional(),
    b: z.number().nonnegative().optional(),
  }),

  // Multi-tier nutrient balance accounting
  nutrientBalance: NutrientBalanceBreakdownSchema.optional(),

  // Detailed parameter classifications against ICAR benchmarks
  classifications: z.array(NutrientClassificationSchema),

  // Commercial fertilizer combinations
  fertilizerRecommendations: z.array(FertilizerProductRecommendationSchema),

  // Growth-stage split application schedules
  splitSchedules: z.array(NutrientSplitApplicationScheduleSchema),

  // Explicit calculation limitations and boundaries
  limitationsAndAssumptions: z.array(z.string()).default([]),

  // Unsupported or unvalidated parameters identified during calculation
  unsupportedParameters: z.array(z.string()).default([]),

  // Evidence citations and ICAR/SAU guidelines
  evidenceReferences: z.array(z.string()).default([]),

  calculatedAt: z.string().datetime(),
});

// ============================================================================
// 7. Inferred TypeScript Types
// ============================================================================

export type CroppingSeason = z.infer<typeof CroppingSeasonSchema>;
export type NutrientCalculationMethodology = z.infer<typeof NutrientCalculationMethodologySchema>;
export type NutrientCalculationStatus = z.infer<typeof NutrientCalculationStatusSchema>;
export type FertilizerProductCode = z.infer<typeof FertilizerProductCodeSchema>;
export type SplitApplicationStage = z.infer<typeof SplitApplicationStageSchema>;

export type CropNutrientRequirementInput = z.infer<typeof CropNutrientRequirementInputSchema>;
export type NutrientClassification = z.infer<typeof NutrientClassificationSchema>;
export type FertilizerGradeSpecs = z.infer<typeof FertilizerGradeSpecsSchema>;
export type FertilizerProductRecommendation = z.infer<typeof FertilizerProductRecommendationSchema>;
export type GrowthStageFertilizerItem = z.infer<typeof GrowthStageFertilizerItemSchema>;
export type NutrientSplitApplicationSchedule = z.infer<typeof NutrientSplitApplicationScheduleSchema>;
export type NutrientBalanceBreakdown = z.infer<typeof NutrientBalanceBreakdownSchema>;
export type CropNutrientOutput = z.infer<typeof CropNutrientOutputSchema>;
