import { z } from "zod";
import { SoilParametersSchema } from "./soilParameters";

// ============================================================================
// 1. Extraction Status & Format Enums
// ============================================================================

export const ExtractionReviewStatusValues = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
] as const;

export const ExtractionReviewStatusSchema = z.enum(ExtractionReviewStatusValues);

export const ReportSourceFormatValues = [
  "PDF_DIGITAL",
  "PDF_SCANNED",
  "IMAGE_PNG",
  "IMAGE_JPEG",
  "IMAGE_WEBP",
  "TEXT_MANUAL",
  "OTHER",
] as const;

export const ReportSourceFormatSchema = z.enum(ReportSourceFormatValues);

export const ReviewerRoleValues = [
  "FARMER",
  "AGRONOMIST",
  "EXTENSION_OFFICER",
  "SYSTEM_ADMIN",
] as const;

export const ReviewerRoleSchema = z.enum(ReviewerRoleValues);

// ============================================================================
// 2. Extracted Candidate Schema
// Captures raw text, parsed values, normalization math, unit conversion & confidence
// ============================================================================

export const ExtractedParameterCandidateSchema = z.object({
  parameterKey: z.string().trim().min(1, "Parameter identifier is required"),
  rawKeyText: z.string().trim().min(1, "Original key label text is required"),
  rawValueText: z.string().trim().min(1, "Original value text is required"),
  parsedNumericValue: z.number().nullable(),
  extractedUnit: z.string().trim().optional(),
  extractedMethod: z.string().trim().optional(),
  normalizedValue: z.number().nullable(),
  normalizedUnit: z.string().trim().optional(),
  confidence: z.number().min(0).max(1, "Confidence score must be between 0.0 and 1.0"),
  extractionWarnings: z.array(z.string()).default([]),
  farmerCorrection: z.object({
    correctedValue: z.number(),
    correctedUnit: z.string().trim().optional(),
    correctedMethod: z.string().trim().optional(),
    correctedAt: z.string().datetime(),
    reason: z.string().trim().optional(),
  }).optional(),
});

// ============================================================================
// 3. Approval Provenance Schema
// Strict audit trail tracking farmer verification, edits, timestamp & reviewer
// ============================================================================

export const ApprovalProvenanceSchema = z.object({
  status: ExtractionReviewStatusSchema.default("PENDING_APPROVAL"),
  reviewedBy: z.string().trim().optional(),
  reviewerRole: ReviewerRoleSchema.default("FARMER"),
  reviewedAt: z.string().datetime().optional(),
  rejectionReason: z.string().trim().optional(),
  editedFields: z.array(z.string()).default([]),
  notes: z.string().trim().optional(),
  ipAddress: z.string().trim().optional(),
});

// ============================================================================
// 4. Laboratory Report Metadata Schema
// ============================================================================

export const SoilReportLabMetadataSchema = z.object({
  labName: z.string().trim().optional(),
  labRegistrationNumber: z.string().trim().optional(),
  sampleCode: z.string().trim().optional(),
  farmerNameOnReport: z.string().trim().optional(),
  collectionDate: z.string().optional(),
  testingDate: z.string().optional(),
  district: z.string().trim().optional(),
  state: z.string().trim().optional(),
  samplingDepth: z.string().trim().optional(),
});

// ============================================================================
// 5. Complete Soil Report Extraction Envelope
// ============================================================================

export const SoilReportExtractionSchema = z.object({
  id: z.string().min(1, "Extraction ID is required"),
  fieldId: z.string().min(1, "Associated field ID is required"),
  farmerId: z.string().min(1, "Owner farmer ID is required"),
  sourceFileName: z.string().trim().min(1, "Source file name is required"),
  fileFormat: ReportSourceFormatSchema,
  fileSizeBytes: z.number().int().nonnegative().optional(),
  contentHash: z.string().trim().min(8, "Cryptographic hash of source report is required"),
  extractedAt: z.string().datetime(),
  overallConfidence: z.number().min(0).max(1),
  globalExtractionWarnings: z.array(z.string()).default([]),
  labMetadata: SoilReportLabMetadataSchema.optional(),
  candidates: z.record(z.string(), ExtractedParameterCandidateSchema),
  rawExtractedText: z.string().optional(),
  approvalProvenance: ApprovalProvenanceSchema.default({
    status: "PENDING_APPROVAL",
    reviewerRole: "FARMER",
    editedFields: [],
  }),
  approvedParameters: SoilParametersSchema.optional(),
});

// Manual Soil Test Entry Payload Schema
export const ManualSoilEntryInputSchema = z.object({
  fieldId: z.string().min(1, "fieldId is required"),
  farmerId: z.string().min(1, "farmerId is required"),
  sampleCode: z.string().trim().optional(),
  collectionDate: z.string().optional(),
  testingDate: z.string().optional(),
  laboratoryName: z.string().trim().optional(),
  parameters: SoilParametersSchema,
  farmerNotes: z.string().trim().optional(),
});

// Review & Approval Action Input Schema
export const ReviewSoilReportInputSchema = z.object({
  reportId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  reviewerId: z.string().min(1, "Reviewer identifier is required"),
  reviewerRole: ReviewerRoleSchema.default("FARMER"),
  corrections: z.record(
    z.string(),
    z.object({
      value: z.number(),
      unit: z.string().trim().optional(),
      method: z.string().trim().optional(),
      reason: z.string().trim().optional(),
    })
  ).optional(),
  rejectionReason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

// ============================================================================
// 6. Inferred TypeScript Types
// ============================================================================

export type ExtractionReviewStatus = z.infer<typeof ExtractionReviewStatusSchema>;
export type ReportSourceFormat = z.infer<typeof ReportSourceFormatSchema>;
export type ReviewerRole = z.infer<typeof ReviewerRoleSchema>;

export type ExtractedParameterCandidate = z.infer<typeof ExtractedParameterCandidateSchema>;
export type ApprovalProvenance = z.infer<typeof ApprovalProvenanceSchema>;
export type SoilReportLabMetadata = z.infer<typeof SoilReportLabMetadataSchema>;
export type SoilReportExtraction = z.infer<typeof SoilReportExtractionSchema>;

export type ManualSoilEntryInput = z.infer<typeof ManualSoilEntryInputSchema>;
export type ReviewSoilReportInput = z.infer<typeof ReviewSoilReportInputSchema>;
