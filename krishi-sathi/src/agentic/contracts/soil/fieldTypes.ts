import { z } from "zod";
import {
  SoilParametersSchema,
  SoilClassificationTypeSchema,
  SoilTextureClassSchema,
} from "./soilParameters";
import { ApprovalProvenanceSchema, SoilReportLabMetadataSchema } from "./extractionTypes";

// ============================================================================
// 1. Irrigation & Location Types
// ============================================================================

export const IrrigationSourceValues = [
  "CANAL",
  "TUBEWELL",
  "OPEN_WELL",
  "DRIP_IRRIGATION",
  "SPRINKLER",
  "TANK_POND",
  "RAIN_FED",
  "OTHER",
] as const;

export const IrrigationSourceSchema = z.enum(IrrigationSourceValues);

export const GeoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  state: z.string().trim().min(1, "State is required"),
  district: z.string().trim().min(1, "District is required"),
  subDistrictOrTehsil: z.string().trim().optional(),
  village: z.string().trim().optional(),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits").optional(),
});

// ============================================================================
// 2. Approved Active Soil Profile Schema
// Represents the single authoritative, active soil profile currently used for farm advisories
// ============================================================================

export const ApprovedSoilProfileSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
  soilTestReportId: z.string().min(1, "Source report ID is required"),
  parameters: SoilParametersSchema,
  approvalProvenance: ApprovalProvenanceSchema,
  effectiveFrom: z.string().datetime(),
  expiresAt: z.string().datetime().optional(), // Typically 3 years from test date per agronomic guidelines
  isCurrentlyActive: z.boolean().default(true),
});

// ============================================================================
// 3. Immutable Historical Soil Test Record Schema
// Once stored, historical test records can never be mutated or discarded
// ============================================================================

export const HistoricalSoilTestRecordSchema = z.object({
  recordId: z.string().min(1, "Record ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
  soilTestReportId: z.string().min(1, "Source report ID is required"),
  testDate: z.string().min(4, "Test date is required"),
  recordedAt: z.string().datetime(),
  parameters: SoilParametersSchema,
  labMetadata: SoilReportLabMetadataSchema.optional(),
  approvalProvenance: ApprovalProvenanceSchema,
  isImmutable: z.literal(true).default(true),
});

// ============================================================================
// 4. Field Profile Schema (Multi-field per farmer)
// ============================================================================

export const FieldProfileSchema = z.object({
  id: z.string().min(1, "Field ID is required"),
  farmerId: z.string().min(1, "Farmer owner ID is required"),
  name: z.string().trim().min(1, "Field name is required").max(100),
  areaAcres: z.number().positive("Field area must be greater than 0"),
  location: GeoLocationSchema,
  primarySoilType: SoilClassificationTypeSchema.default("ALLUVIAL"),
  primaryTextureClass: SoilTextureClassSchema.default("UNKNOWN"),
  irrigationSource: IrrigationSourceSchema.default("TUBEWELL"),
  activeSoilProfile: ApprovedSoilProfileSchema.nullable().default(null),
  totalHistoricalSoilTests: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Field Creation & Update Inputs
export const CreateFieldProfileInputSchema = z.object({
  farmerId: z.string().min(1, "farmerId is required"),
  name: z.string().trim().min(1, "Field name is required").max(100),
  areaAcres: z.number().positive("Field area must be greater than 0"),
  location: GeoLocationSchema,
  primarySoilType: SoilClassificationTypeSchema.default("ALLUVIAL"),
  primaryTextureClass: SoilTextureClassSchema.default("UNKNOWN"),
  irrigationSource: IrrigationSourceSchema.default("TUBEWELL"),
});

export const UpdateFieldProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  areaAcres: z.number().positive().optional(),
  location: GeoLocationSchema.partial().optional(),
  primarySoilType: SoilClassificationTypeSchema.optional(),
  primaryTextureClass: SoilTextureClassSchema.optional(),
  irrigationSource: IrrigationSourceSchema.optional(),
});

// ============================================================================
// 5. Historical Soil Comparison Schemas
// Enforces testing-method compatibility checks across historical snapshots
// ============================================================================

export const ParameterHistoricalTrendPointSchema = z.object({
  recordId: z.string(),
  testDate: z.string(),
  value: z.number(),
  unit: z.string(),
  testMethod: z.string(),
  rating: z.string().optional(),
});

export const ParameterHistoricalComparisonSchema = z.object({
  parameterKey: z.string(),
  parameterDisplayName: z.string(),
  trendPoints: z.array(ParameterHistoricalTrendPointSchema),
  isMethodologyConsistent: z.boolean(),
  methodologyWarning: z.string().optional(), // E.g. "Warning: Olsen P (2023) and Bray P (2025) cannot be directly subtracted."
  netChange: z.number().nullable(),
  percentChange: z.number().nullable(),
});

export const HistoricalSoilComparisonResultSchema = z.object({
  fieldId: z.string(),
  comparisonDate: z.string().datetime(),
  recordsComparedCount: z.number().int().min(1),
  parameters: z.record(z.string(), ParameterHistoricalComparisonSchema),
  methodologyWarnings: z.array(z.string()).default([]),
});

// ============================================================================
// 6. Inferred TypeScript Types
// ============================================================================

export type IrrigationSource = z.infer<typeof IrrigationSourceSchema>;
export type GeoLocation = z.infer<typeof GeoLocationSchema>;

export type ApprovedSoilProfile = z.infer<typeof ApprovedSoilProfileSchema>;
export type HistoricalSoilTestRecord = z.infer<typeof HistoricalSoilTestRecordSchema>;

export type FieldProfile = z.infer<typeof FieldProfileSchema>;
export type CreateFieldProfileInput = z.infer<typeof CreateFieldProfileInputSchema>;
export type UpdateFieldProfileInput = z.infer<typeof UpdateFieldProfileInputSchema>;

export type ParameterHistoricalTrendPoint = z.infer<typeof ParameterHistoricalTrendPointSchema>;
export type ParameterHistoricalComparison = z.infer<typeof ParameterHistoricalComparisonSchema>;
export type HistoricalSoilComparisonResult = z.infer<typeof HistoricalSoilComparisonResultSchema>;
