export * from "./errors";
export * from "./schemas";
export * from "./types";
export * from "./soil";

import { RuntimeLimits } from "./types";

export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = {
  maxSteps: 4,
  maxEvidenceItems: 20,
  toolTimeoutMs: 10_000,
  maxRetriesPerTool: 2,
  maxConcurrentTools: 2,
  totalTaskTimeoutMs: 60_000,
};
