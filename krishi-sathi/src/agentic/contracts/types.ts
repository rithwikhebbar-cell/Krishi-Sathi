import { z } from "zod";
import {
  TaskStatusSchema,
  ToolPermissionSchema,
  RetryPolicySchema,
  ResearchTaskInputSchema,
  ResearchTaskSchema,
  ResearchStepSchema,
  ResearchPlanSchema,
  ToolExecutionStatusSchema,
  ToolExecutionSchema,
  EvidenceSchema,
  ResearchFindingSchema,
  ResearchReportSchema,
  RuntimeEventTypeSchema,
  RuntimeEventSchema,
  RuntimeLimitsSchema,
} from "./schemas";

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

export type ResearchTaskInput = z.infer<typeof ResearchTaskInputSchema>;
export type ResearchTask = z.infer<typeof ResearchTaskSchema>;

export type ResearchStep = z.infer<typeof ResearchStepSchema>;
export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;

export type ToolExecutionStatus = z.infer<typeof ToolExecutionStatusSchema>;
export type ToolExecution = z.infer<typeof ToolExecutionSchema>;

export type EvidenceType = z.infer<typeof import("./schemas").EvidenceTypeSchema>;
export type EvidenceFreshness = z.infer<typeof import("./schemas").EvidenceFreshnessSchema>;

export type Evidence = z.infer<typeof EvidenceSchema>;
export type CreateEvidenceInput = Omit<
  Evidence,
  "id" | "retrievedAt" | "contentHash" | "freshness" | "extractionWarnings" | "conflictNotes"
> & {
  id?: string;
  retrievedAt?: string;
  contentHash?: string;
  freshness?: EvidenceFreshness;
  extractionWarnings?: string[];
  conflictNotes?: string[];
};

export type ResearchFinding = z.infer<typeof ResearchFindingSchema>;
export type ResearchReport = z.infer<typeof ResearchReportSchema>;

export type RuntimeEventType = z.infer<typeof RuntimeEventTypeSchema>;
export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;

export type RuntimeLimits = z.infer<typeof RuntimeLimitsSchema>;

export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = {
  maxSteps: 4,
  maxEvidenceItems: 20,
  toolTimeoutMs: 10_000,
  maxRetriesPerTool: 2,
  maxConcurrentTools: 2,
  totalTaskTimeoutMs: 60_000,
};

export interface ToolExecutionContext {
  taskId: string;
  stepId: string;
  signal?: AbortSignal;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  permission: ToolPermission;
  timeoutMs: number;
  retryPolicy?: RetryPolicy;
  inputSchema?: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  execute(input: TInput, context?: ToolExecutionContext): Promise<TOutput>;
}

export interface ToolDefinitionSummary {
  name: string;
  description: string;
  permission: ToolPermission;
  timeoutMs: number;
}

export interface ResearchExecutionResult {
  task: ResearchTask;
  status: TaskStatus;
  plan?: ResearchPlan;
  report?: ResearchReport;
  evidence: Evidence[];
  toolExecutions: ToolExecution[];
  events: RuntimeEvent[];
  errors: string[];
  durationMs: number;
}
