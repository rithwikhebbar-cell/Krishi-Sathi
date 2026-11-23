export * from "./types";
export * from "./mockProvider";
export * from "./geminiAdapter";

import { ResearchPlan, ResearchReport, ResearchTask, Evidence } from "../contracts/types";
import { ModelProvider } from "./types";
import { GeminiModelAdapter } from "./geminiAdapter";
import { MockModelProvider } from "./mockProvider";

/**
 * Backward compatibility class for starter NotConfiguredModelAdapter
 */
export class NotConfiguredModelAdapter implements ModelProvider {
  public readonly providerName = "not-configured";

  async createPlan(): Promise<ResearchPlan> {
    throw new Error("Gemini model adapter is not configured yet.");
  }

  async synthesize(): Promise<ResearchReport> {
    throw new Error("Gemini model adapter is not configured yet.");
  }
}

/**
 * Creates an appropriate provider:
 * If GEMINI_API_KEY is available, returns GeminiModelAdapter.
 * Otherwise returns MockModelProvider (or NotConfiguredModelAdapter if requested).
 */
export function createDefaultModelProvider(forceMock = false): ModelProvider {
  if (!forceMock && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
    return new GeminiModelAdapter();
  }
  return new MockModelProvider();
}
