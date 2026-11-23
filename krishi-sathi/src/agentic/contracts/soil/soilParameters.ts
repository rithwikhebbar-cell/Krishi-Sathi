import { z } from "zod";

// ============================================================================
// 1. Soil Texture & General Soil Type Enums
// ============================================================================

export const SoilTextureClassValues = [
  "SAND",
  "LOAMY_SAND",
  "SANDY_LOAM",
  "LOAM",
  "SILT_LOAM",
  "SILT",
  "SANDY_CLAY_LOAM",
  "CLAY_LOAM",
  "SILTY_CLAY_LOAM",
  "SANDY_CLAY",
  "SILTY_CLAY",
  "CLAY",
  "UNKNOWN",
] as const;

export const SoilTextureClassSchema = z.enum(SoilTextureClassValues);

export const SoilClassificationTypeValues = [
  "ALLUVIAL",
  "BLACK_REGUR",
  "RED",
  "LATERITE",
  "ARID_DESERT",
  "SALINE_ALKALINE",
  "PEATY_MARSHY",
  "MOUNTAIN_FOREST",
  "OTHER",
] as const;

export const SoilClassificationTypeSchema = z.enum(SoilClassificationTypeValues);

// ============================================================================
// 2. Laboratory Testing Methods Enums
// NOTE: Methods are chemically distinct and NOT interchangeable (e.g. Olsen vs Bray)
// ============================================================================

export const PhTestMethodValues = [
  "SUSPENSION_1_2_WATER",       // 1:2 soil to water suspension, glass electrode
  "SUSPENSION_1_2_5_WATER",     // 1:2.5 soil to water suspension, standard ICAR/State lab
  "SUSPENSION_1_1_WATER",       // 1:1 soil to water suspension
  "CALCIUM_CHLORIDE_0_01M",     // 0.01M CaCl2 suspension
  "SATURATED_SOIL_PASTE",       // Saturated paste method for saline/alkali soils
  "FIELD_KIT_COLORIMETRIC",     // Rapid field testing kit
  "UNKNOWN_METHOD",
] as const;

export const PhTestMethodSchema = z.enum(PhTestMethodValues);

export const EcTestMethodValues = [
  "SUSPENSION_1_2_WATER",       // 1:2 soil:water at 25°C
  "SUSPENSION_1_2_5_WATER",     // 1:2.5 soil:water conductivity at 25°C
  "SATURATION_EXTRACT_ECe",     // Electrical conductivity of saturation extract
  "FIELD_CONDUCTIVITY_METER",
  "UNKNOWN_METHOD",
] as const;

export const EcTestMethodSchema = z.enum(EcTestMethodValues);

export const OcTestMethodValues = [
  "WALKLEY_BLACK_WET_OXIDATION", // Walkley-Black rapid titration method (chromic acid)
  "LOSS_ON_IGNITION",            // High-temperature furnace combustion
  "ELEMENTAL_CHNS_ANALYZER",     // Automated dry combustion analyzer
  "RAPID_COLORIMETRIC",
  "UNKNOWN_METHOD",
] as const;

export const OcTestMethodSchema = z.enum(OcTestMethodValues);

export const NitrogenTestMethodValues = [
  "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA", // 0.32% KMnO4 + 2.5% NaOH distillation
  "KJELDAHL_TOTAL_NITROGEN",             // Total N digestion
  "ORGANIC_CARBON_CORRELATION",          // Estimated proxy from Organic Carbon %
  "UNKNOWN_METHOD",
] as const;

export const NitrogenTestMethodSchema = z.enum(NitrogenTestMethodValues);

export const PhosphorusTestMethodValues = [
  "OLSEN_SODIUM_BICARBONATE",    // 0.5 M NaHCO3 at pH 8.5 (for neutral to alkaline soils)
  "BRAY_KURTZ_1_ACID_FLUORIDE",  // 0.03 M NH4F + 0.025 M HCl (for acidic soils)
  "BRAY_KURTZ_2",                // 0.03 M NH4F + 0.1 M HCl (for strongly acidic soils)
  "MEHLICH_3",                   // Multi-element acidic extractant
  "TRUOG",                       // 0.002 N H2SO4 buffered with (NH4)2SO4
  "UNKNOWN_METHOD",
] as const;

export const PhosphorusTestMethodSchema = z.enum(PhosphorusTestMethodValues);

export const PotassiumTestMethodValues = [
  "NEUTRAL_NORMAL_AMMONIUM_ACETATE", // 1N neutral NH4OAc pH 7.0 Flame Photometer
  "MEHLICH_3",                       // Multi-element extractant
  "COLD_SULFURIC_ACID_EXTRACTABLE",
  "UNKNOWN_METHOD",
] as const;

export const PotassiumTestMethodSchema = z.enum(PotassiumTestMethodValues);

export const SulphurTestMethodValues = [
  "CALCIUM_CHLORIDE_TURBIDIMETRIC", // 0.15% CaCl2 extractable, BaCl2 turbidimetry
  "MONOCALCIUM_PHOSPHATE",          // 500 ppm P extractant
  "AMMONIUM_ACETATE_ACETIC_ACID",
  "UNKNOWN_METHOD",
] as const;

export const SulphurTestMethodSchema = z.enum(SulphurTestMethodValues);

export const CationExchangeTestMethodValues = [
  "NEUTRAL_AMMONIUM_ACETATE_TITRATION", // 1N NH4OAc EDTA versenate titration
  "ATOMIC_ABSORPTION_SPECTROMETRY",     // AAS determination
  "ICP_OES",                            // Inductively coupled plasma OES
  "UNKNOWN_METHOD",
] as const;

export const CationExchangeTestMethodSchema = z.enum(CationExchangeTestMethodValues);

export const MicronutrientTestMethodValues = [
  "DTPA_TEA_CaCl2_LINDSAY_NORVELL", // 0.005M DTPA + 0.1M TEA + 0.01M CaCl2 pH 7.3
  "HOT_WATER_AZOMETHINE_H",         // Hot water soluble Boron via spectrophotometry
  "AAS",                            // Atomic Absorption Spectrophotometry
  "ICP_OES",                        // ICP-OES
  "UNKNOWN_METHOD",
] as const;

export const MicronutrientTestMethodSchema = z.enum(MicronutrientTestMethodValues);

// ============================================================================
// 3. Agronomic Nutrient Rating Values (ICAR benchmark brackets)
// ============================================================================

export const SoilNutrientRatingValues = [
  "VERY_LOW",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
  "DEFICIENT",
  "SUFFICIENT",
  "TOXIC",
  "NORMAL",
  "ACIDIC",
  "ALKALINE",
  "SALINE",
  "NON_SALINE",
  "EXCESSIVE",
  "UNKNOWN",
] as const;

export const SoilNutrientRatingSchema = z.enum(SoilNutrientRatingValues);

// ============================================================================
// 4. Parameter Field Schemas
// ============================================================================

export const NumericParameterSchema = z.object({
  value: z.number({ message: "Parameter value must be a valid number" }),
  unit: z.string().trim().min(1, "Measurement unit is required"),
  testMethod: z.string().trim().min(1, "Test method identifier is required"),
  rating: SoilNutrientRatingSchema.optional(),
  notes: z.string().trim().optional(),
});

// Physical Properties
export const SoilPhysicalParametersSchema = z.object({
  textureClass: SoilTextureClassSchema.default("UNKNOWN"),
  classificationType: SoilClassificationTypeSchema.default("OTHER"),
  soilDepthCm: z.number().positive().max(500).optional(),
  bulkDensityGPerCc: z.number().positive().max(3.0).optional(),
  fieldCapacityPercent: z.number().min(0).max(100).optional(),
  permanentWiltingPointPercent: z.number().min(0).max(100).optional(),
});

// Chemical Properties (pH, EC, Organic Carbon)
export const SoilChemicalParametersSchema = z.object({
  ph: z.object({
    value: z.number().min(0).max(14, "Soil pH must be between 0 and 14"),
    unit: z.literal("pH_units").default("pH_units"),
    testMethod: PhTestMethodSchema.default("SUSPENSION_1_2_5_WATER"),
    rating: SoilNutrientRatingSchema.optional(),
  }),
  electricalConductivity: z.object({
    value: z.number().min(0, "Electrical conductivity cannot be negative"),
    unit: z.enum(["dS/m", "mmhos/cm", "mS/cm"]).default("dS/m"),
    testMethod: EcTestMethodSchema.default("SUSPENSION_1_2_WATER"),
    rating: SoilNutrientRatingSchema.optional(),
  }),
  organicCarbonPercent: z.object({
    value: z.number().min(0).max(100, "Organic carbon % must be between 0 and 100"),
    unit: z.literal("%").default("%"),
    testMethod: OcTestMethodSchema.default("WALKLEY_BLACK_WET_OXIDATION"),
    rating: SoilNutrientRatingSchema.optional(),
  }),
  organicMatterPercent: z.object({
    value: z.number().min(0).max(100).optional(),
    unit: z.literal("%").default("%"),
  }).optional(),
});

// Primary Macronutrients (N, P, K)
export const SoilPrimaryNutrientsSchema = z.object({
  availableNitrogen: z.object({
    value: z.number().min(0, "Available Nitrogen cannot be negative"),
    unit: z.enum(["kg/ha", "kg/acre", "ppm", "mg/kg"]).default("kg/ha"),
    testMethod: NitrogenTestMethodSchema.default("ALKALINE_PERMANGANATE_SUBBIAH_ASIJA"),
    rating: SoilNutrientRatingSchema.optional(),
  }),
  availablePhosphorus: z.object({
    value: z.number().min(0, "Available Phosphorus cannot be negative"),
    unit: z.enum(["kg/ha_P", "kg/ha_P2O5", "kg/acre_P", "kg/acre_P2O5", "ppm", "mg/kg"]).default("kg/ha_P2O5"),
    testMethod: PhosphorusTestMethodSchema.default("OLSEN_SODIUM_BICARBONATE"),
    rating: SoilNutrientRatingSchema.optional(),
    chemicalForm: z.enum(["P", "P2O5"]).default("P2O5"),
  }),
  availablePotassium: z.object({
    value: z.number().min(0, "Available Potassium cannot be negative"),
    unit: z.enum(["kg/ha_K", "kg/ha_K2O", "kg/acre_K", "kg/acre_K2O", "ppm", "mg/kg"]).default("kg/ha_K2O"),
    testMethod: PotassiumTestMethodSchema.default("NEUTRAL_NORMAL_AMMONIUM_ACETATE"),
    rating: SoilNutrientRatingSchema.optional(),
    chemicalForm: z.enum(["K", "K2O"]).default("K2O"),
  }),
});

// Secondary Nutrients (S, Ca, Mg)
export const SoilSecondaryNutrientsSchema = z.object({
  availableSulphurPpm: z.object({
    value: z.number().min(0),
    unit: z.enum(["ppm", "mg/kg", "kg/ha"]).default("ppm"),
    testMethod: SulphurTestMethodSchema.default("CALCIUM_CHLORIDE_TURBIDIMETRIC"),
    rating: SoilNutrientRatingSchema.optional(),
  }).optional(),
  exchangeableCalciumCmolPerKg: z.object({
    value: z.number().min(0),
    unit: z.enum(["cmol(+)/kg", "meq/100g", "ppm"]).default("cmol(+)/kg"),
    testMethod: CationExchangeTestMethodSchema.default("NEUTRAL_AMMONIUM_ACETATE_TITRATION"),
    rating: SoilNutrientRatingSchema.optional(),
  }).optional(),
  exchangeableMagnesiumCmolPerKg: z.object({
    value: z.number().min(0),
    unit: z.enum(["cmol(+)/kg", "meq/100g", "ppm"]).default("cmol(+)/kg"),
    testMethod: CationExchangeTestMethodSchema.default("NEUTRAL_AMMONIUM_ACETATE_TITRATION"),
    rating: SoilNutrientRatingSchema.optional(),
  }).optional(),
});

// Micronutrients (Zn, Fe, Cu, Mn, B)
export const SoilMicronutrientsSchema = z.object({
  availableZincPpm: z.object({
    value: z.number().min(0),
    unit: z.enum(["ppm", "mg/kg"]).default("ppm"),
    testMethod: MicronutrientTestMethodSchema.default("DTPA_TEA_CaCl2_LINDSAY_NORVELL"),
    rating: SoilNutrientRatingSchema.optional(),
  }).optional(),
  availableIronPpm: z.object({
    value: z.number().min(0),
    unit: z.enum(["ppm", "mg/kg"]).default("ppm"),
    testMethod: MicronutrientTestMethodSchema.default("DTPA_TEA_CaCl2_LINDSAY_NORVELL"),
    rating: SoilNutrientRatingSchema.optional(),
  }).optional(),
  availableCopperPpm: z.object({
    value: z.number().min(0),
    unit: z.enum(["ppm", "mg/kg"]).default("ppm"),
    testMethod: MicronutrientTestMethodSchema.default("DTPA_TEA_CaCl2_LINDSAY_NORVELL"),
    rating: SoilNutrientRatingSchema.optional(),
  }).optional(),
  availableManganesePpm: z.object({
    value: z.number().min(0),
    unit: z.enum(["ppm", "mg/kg"]).default("ppm"),
    testMethod: MicronutrientTestMethodSchema.default("DTPA_TEA_CaCl2_LINDSAY_NORVELL"),
    rating: SoilNutrientRatingSchema.optional(),
  }).optional(),
  availableBoronPpm: z.object({
    value: z.number().min(0),
    unit: z.enum(["ppm", "mg/kg"]).default("ppm"),
    testMethod: MicronutrientTestMethodSchema.default("HOT_WATER_AZOMETHINE_H"),
    rating: SoilNutrientRatingSchema.optional(),
  }).optional(),
});

// Comprehensive Unified Soil Parameters Schema
export const SoilParametersSchema = z.object({
  physical: SoilPhysicalParametersSchema.default({
    textureClass: "UNKNOWN",
    classificationType: "OTHER",
  }),
  chemical: SoilChemicalParametersSchema,
  primary: SoilPrimaryNutrientsSchema,
  secondary: SoilSecondaryNutrientsSchema.default({}),
  micronutrients: SoilMicronutrientsSchema.default({}),
  metadata: z.object({
    sampleId: z.string().trim().optional(),
    testedAt: z.string().optional(),
    laboratoryName: z.string().trim().optional(),
    samplingDepthCm: z.string().trim().optional(),
  }).optional(),
});

// ============================================================================
// 5. Inferred TypeScript Types
// ============================================================================

export type SoilTextureClass = z.infer<typeof SoilTextureClassSchema>;
export type SoilClassificationType = z.infer<typeof SoilClassificationTypeSchema>;

export type PhTestMethod = z.infer<typeof PhTestMethodSchema>;
export type EcTestMethod = z.infer<typeof EcTestMethodSchema>;
export type OcTestMethod = z.infer<typeof OcTestMethodSchema>;
export type NitrogenTestMethod = z.infer<typeof NitrogenTestMethodSchema>;
export type PhosphorusTestMethod = z.infer<typeof PhosphorusTestMethodSchema>;
export type PotassiumTestMethod = z.infer<typeof PotassiumTestMethodSchema>;
export type SulphurTestMethod = z.infer<typeof SulphurTestMethodSchema>;
export type CationExchangeTestMethod = z.infer<typeof CationExchangeTestMethodSchema>;
export type MicronutrientTestMethod = z.infer<typeof MicronutrientTestMethodSchema>;

export type SoilNutrientRating = z.infer<typeof SoilNutrientRatingSchema>;

export type SoilPhysicalParameters = z.infer<typeof SoilPhysicalParametersSchema>;
export type SoilChemicalParameters = z.infer<typeof SoilChemicalParametersSchema>;
export type SoilPrimaryNutrients = z.infer<typeof SoilPrimaryNutrientsSchema>;
export type SoilSecondaryNutrients = z.infer<typeof SoilSecondaryNutrientsSchema>;
export type SoilMicronutrients = z.infer<typeof SoilMicronutrientsSchema>;
export type SoilParameters = z.infer<typeof SoilParametersSchema>;
