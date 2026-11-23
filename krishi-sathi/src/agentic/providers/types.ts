import {
  ResearchPlan,
  ResearchReport,
  ResearchTask,
  Evidence,
  ToolDefinitionSummary,
} from "../contracts/types";

export interface ModelUsageMetadata {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  modelName?: string;
  latencyMs?: number;
}

export interface VisionExtractionRequest {
  fileBase64: string;
  mimeType: string;
  prompt: string;
  systemInstruction?: string;
  signal?: AbortSignal;
}

export interface ModelProvider {
  readonly providerName: string;

  createPlan(
    task: ResearchTask,
    availableTools: ToolDefinitionSummary[],
    signal?: AbortSignal
  ): Promise<ResearchPlan>;

  synthesize(
    task: ResearchTask,
    evidence: Evidence[],
    signal?: AbortSignal
  ): Promise<ResearchReport>;

  extractVisionData?(
    request: VisionExtractionRequest
  ): Promise<string>;

  getUsageMetadata?(): ModelUsageMetadata | undefined;
}
