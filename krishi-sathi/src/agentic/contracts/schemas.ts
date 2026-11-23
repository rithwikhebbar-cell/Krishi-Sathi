import { z } from "zod";

export const TaskStatusValues = [
  "CREATED",
  "VALIDATING",
  "PLANNING",
  "EXECUTING",
  "EVALUATING",
  "SYNTHESIZING",
  "VALIDATING_REPORT",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
] as const;

export const TaskStatusSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const upper = val.toUpperCase();
    if (upper === "VALIDATING") return "VALIDATING";
    if (upper === "VALIDATING_REPORT") return "VALIDATING_REPORT";
    if (upper === "CREATED") return "CREATED";
    if (upper === "PLANNING") return "PLANNING";
    if (upper === "EXECUTING") return "EXECUTING";
    if (upper === "EVALUATING") return "EVALUATING";
    if (upper === "SYNTHESIZING") return "SYNTHESIZING";
    if (upper === "COMPLETED") return "COMPLETED";
    if (upper === "FAILED") return "FAILED";
    if (upper === "CANCELLED") return "CANCELLED";
    if (upper === "TIMED_OUT") return "TIMED_OUT";
  }
  return val;
}, z.enum(TaskStatusValues));

export const ToolPermissionValues = ["READ_ONLY", "REQUIRES_APPROVAL", "BLOCKED"] as const;

export const ToolPermissionSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const upper = val.toUpperCase();
    if (upper === "READ_ONLY") return "READ_ONLY";
    if (upper === "REQUIRES_APPROVAL") return "REQUIRES_APPROVAL";
    if (upper === "BLOCKED") return "BLOCKED";
  }
  return val;
}, z.enum(ToolPermissionValues));

export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(5).default(2),
  backoffMs: z.number().int().min(0).max(10_000).default(500),
});

export const ResearchTaskInputSchema = z.object({
  id: z.string().min(1).optional(),
  ownerId: z.string().min(1, "ownerId is required"),
  question: z.string().trim().min(5, "Question must be at least 5 characters").max(1000, "Question cannot exceed 1000 characters"),
  context: z.record(z.string(), z.unknown()).default({}),
});

export const ResearchTaskSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  question: z.string().trim().min(5).max(1000),
  context: z.record(z.string(), z.unknown()).default({}),
  status: TaskStatusSchema.default("CREATED"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ResearchStepSchema = z.object({
  id: z.string().min(1),
  purpose: z.string().trim().min(3),
  toolName: z.string().trim().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
});

export const ResearchPlanSchema = z.object({
  taskId: z.string().min(1),
  steps: z.array(ResearchStepSchema).min(1, "Plan must contain at least 1 step").max(10, "Plan steps limit exceeded"),
  explanation: z.string().optional(),
  generatedAt: z.string().datetime(),
});

export const ToolExecutionStatusValues = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "TIMED_OUT",
  "CANCELLED",
] as const;

export const ToolExecutionStatusSchema = z.enum(ToolExecutionStatusValues);

export const ToolExecutionSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  stepId: z.string().min(1),
  toolName: z.string().min(1),
  input: z.unknown(),
  output: z.unknown().optional(),
  status: ToolExecutionStatusSchema,
  attempts: z.number().int().min(1),
  durationMs: z.number().min(0),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

export const EvidenceTypeValues = [
  "WEATHER_OBSERVATION",
  "WEATHER_FORECAST",
  "RESEARCH_DOCUMENT",
  "AGRONOMIC_GUIDELINE",
  "DETERMINISTIC_CALCULATION",
  "OTHER",
] as const;

export const EvidenceTypeSchema = z.enum(EvidenceTypeValues);

export const EvidenceFreshnessValues = ["CURRENT", "RECENT", "STALE", "UNKNOWN"] as const;
export const EvidenceFreshnessSchema = z.enum(EvidenceFreshnessValues);

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  sourceUri: z.string().trim().min(1),
  sourceTitle: z.string().trim().min(1),
  publisher: z.string().trim().optional(),
  retrievedAt: z.string().datetime(),
  publishedAt: z.string().optional(),
  lastUpdatedAt: z.string().optional(),
  evidenceType: EvidenceTypeSchema.default("AGRONOMIC_GUIDELINE"),
  excerpt: z.string().trim().min(1),
  contentHash: z.string().min(8),
  researchQuery: z.string().optional(),
  retrievalMethod: z.string().trim().min(1),
  freshness: EvidenceFreshnessSchema.default("CURRENT"),
  relevanceScore: z.number().min(0).max(1).optional(),
  isUntrusted: z.boolean().default(true),
  extractionWarnings: z.array(z.string()).default([]),
  conflictNotes: z.array(z.string()).default([]),
});

export const ResearchFindingSchema = z.object({
  claim: z.string().trim().min(5, "Claim must be at least 5 characters"),
  evidenceIds: z.array(z.string().min(1)).min(1, "Finding lacks evidence: each factual finding must cite at least one evidence item"),
  confidence: z.enum(["low", "medium", "high"]),
});

export const DeterministicCalculationItemSchema = z.object({
  engine: z.string(),
  calculation: z.string(),
  result: z.string(),
  unit: z.string(),
  evidenceId: z.string(),
});

export const ConflictingEvidenceItemSchema = z.object({
  topic: z.string(),
  conflictDescription: z.string(),
  conflictingEvidenceIds: z.array(z.string()),
});

export const ReportSourceItemSchema = z.object({
  evidenceId: z.string(),
  title: z.string(),
  institution: z.string(),
  url: z.string(),
  freshness: z.string().optional(),
});

export const ResearchReportSchema = z.object({
  taskId: z.string().min(1),
  question: z.string().optional(),
  scope: z.string().optional(),
  locationContext: z.string().optional(),
  cropContext: z.string().optional(),
  summary: z.string().trim().min(10, "Summary must be at least 10 characters"),
  findings: z.array(ResearchFindingSchema),
  weatherContext: z.string().optional(),
  deterministicCalculations: z.array(DeterministicCalculationItemSchema).default([]),
  conflictingEvidence: z.array(ConflictingEvidenceItemSchema).default([]),
  assumptions: z.array(z.string().trim()).default([]),
  limitations: z.array(z.string().trim()).default([]),
  practicalInterpretation: z.string().optional(),
  sources: z.array(ReportSourceItemSchema).default([]),
  generatedAt: z.string().datetime(),
});

export const RuntimeEventTypeValues = [
  "TASK_CREATED",
  "TASK_VALIDATING",
  "TASK_VALIDATED",
  "PLAN_GENERATION_STARTED",
  "PLAN_GENERATED",
  "PLAN_VALIDATED",
  "TOOL_STARTED",
  "TOOL_COMPLETED",
  "TOOL_FAILED",
  "TOOL_RETRIED",
  "EVIDENCE_REGISTERED",
  "EVALUATION_COMPLETED",
  "SYNTHESIS_STARTED",
  "SYNTHESIS_COMPLETED",
  "REPORT_VALIDATING",
  "REPORT_VALIDATED",
  "TASK_COMPLETED",
  "TASK_FAILED",
  "TASK_CANCELLED",
  "TASK_TIMED_OUT",
] as const;

export const RuntimeEventTypeSchema = z.enum(RuntimeEventTypeValues);

export const RuntimeEventSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  type: RuntimeEventTypeSchema,
  timestamp: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const RuntimeLimitsSchema = z.object({
  maxSteps: z.number().int().min(1).max(10).default(4),
  maxEvidenceItems: z.number().int().min(1).max(100).default(20),
  toolTimeoutMs: z.number().int().min(100).max(60_000).default(10_000),
  maxRetriesPerTool: z.number().int().min(0).max(5).default(2),
  maxConcurrentTools: z.number().int().min(1).max(10).default(2),
  totalTaskTimeoutMs: z.number().int().min(1000).max(300_000).default(60_000),
});
