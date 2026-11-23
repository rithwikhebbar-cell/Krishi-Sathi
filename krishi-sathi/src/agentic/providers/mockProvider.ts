import {
  ModelProvider,
  ModelUsageMetadata,
} from "./types";
import {
  ResearchPlan,
  ResearchReport,
  ResearchTask,
  Evidence,
  ToolDefinitionSummary,
} from "../contracts/types";
import { CancellationError, ProviderError, ValidationError } from "../contracts/errors";
import { ResearchPlanSchema, ResearchReportSchema } from "../contracts/schemas";

export interface MockProviderOptions {
  planOverride?: ResearchPlan | ((task: ResearchTask) => ResearchPlan);
  reportOverride?: ResearchReport | ((task: ResearchTask, evidence: Evidence[]) => ResearchReport);
  visionOverride?: string | ((request: import("./types").VisionExtractionRequest) => string);
  planDelayMs?: number;
  synthesizeDelayMs?: number;
  failOnPlan?: boolean;
  failOnSynthesize?: boolean;
  failOnVision?: boolean;
  returnMalformedPlan?: boolean;
  returnMalformedReport?: boolean;
}

export class MockModelProvider implements ModelProvider {
  public readonly providerName = "mock";
  private lastUsage?: ModelUsageMetadata;

  constructor(private readonly options: MockProviderOptions = {}) { }

  async createPlan(
    task: ResearchTask,
    availableTools: ToolDefinitionSummary[],
    signal?: AbortSignal
  ): Promise<ResearchPlan> {
    if (signal?.aborted) {
      throw new CancellationError("MockProvider.createPlan");
    }

    if (this.options.planDelayMs) {
      await this.sleep(this.options.planDelayMs, signal);
    }

    if (this.options.failOnPlan) {
      throw new ProviderError("mock", "Simulated model planning failure");
    }

    if (this.options.returnMalformedPlan) {
      // Intentionally return invalid plan
      return {
        taskId: task.id,
        steps: [] as any,
        generatedAt: "invalid-date",
      };
    }

    if (this.options.planOverride) {
      const plan = typeof this.options.planOverride === "function"
        ? this.options.planOverride(task)
        : this.options.planOverride;
      return ResearchPlanSchema.parse(plan);
    }

    // Generate intelligent deterministic plan matching available tools
    const steps = [];
    const hasWeather = availableTools.some((t) => t.name === "weather.lookup");
    const hasCrop = availableTools.some((t) => t.name === "crop.knowledge.lookup");

    if (hasCrop) {
      const crop = task.question.toLowerCase().includes("rice")
        ? "Rice"
        : task.question.toLowerCase().includes("wheat")
          ? "Wheat"
          : "Wheat";

      steps.push({
        id: `step_${task.id}_1`,
        purpose: `Look up agronomical recommendations for ${crop}`,
        toolName: "crop.knowledge.lookup",
        input: { crop, topic: "irrigation", query: `irrigation guidelines for ${crop}` },
      });
    }

    if (hasWeather) {
      steps.push({
        id: `step_${task.id}_2`,
        purpose: "Look up forecast and rainfall probability for the region",
        toolName: "weather.lookup",
        input: { location: "Punjab, India", days: 3 },
      });
    }

    if (steps.length === 0 && availableTools.length > 0) {
      steps.push({
        id: `step_${task.id}_1`,
        purpose: `Query available tool ${availableTools[0].name}`,
        toolName: availableTools[0].name,
        input: {},
      });
    }

    const defaultPlan: ResearchPlan = {
      taskId: task.id,
      steps,
      explanation: "Deterministic research plan to evaluate crop requirements and weather conditions.",
      generatedAt: new Date().toISOString(),
    };

    this.lastUsage = {
      promptTokens: 120,
      completionTokens: 85,
      totalTokens: 205,
      modelName: "mock-agricultural-planner-v1",
      latencyMs: this.options.planDelayMs ?? 10,
    };

    return ResearchPlanSchema.parse(defaultPlan);
  }

  async synthesize(
    task: ResearchTask,
    evidence: Evidence[],
    signal?: AbortSignal
  ): Promise<ResearchReport> {
    if (signal?.aborted) {
      throw new CancellationError("MockProvider.synthesize");
    }

    if (this.options.synthesizeDelayMs) {
      await this.sleep(this.options.synthesizeDelayMs, signal);
    }

    if (this.options.failOnSynthesize) {
      throw new ProviderError("mock", "Simulated model synthesis failure");
    }

    if (this.options.returnMalformedReport) {
      return {
        taskId: task.id,
        summary: "", // Invalid: min 10 chars
        findings: [],
        deterministicCalculations: [],
        conflictingEvidence: [],
        sources: [],
        assumptions: [],
        limitations: [],
        generatedAt: new Date().toISOString(),
      };
    }

    if (this.options.reportOverride) {
      const report = typeof this.options.reportOverride === "function"
        ? this.options.reportOverride(task, evidence)
        : this.options.reportOverride;
      return ResearchReportSchema.parse(report);
    }

    // Formulate evidence-grounded findings citing actual registered evidence IDs
    const findings = evidence.length > 0
      ? evidence.map((e, idx) => ({
        claim: `Evidence indicates: ${e.excerpt.slice(0, 80).trim()}${e.excerpt.length > 80 ? "..." : ""}`,
        evidenceIds: [e.id],
        confidence: (idx === 0 ? "high" : "medium") as "high" | "medium",
      }))
      : [
        {
          claim: "Baseline agricultural guidance based on regional historical parameters.",
          evidenceIds: ["placeholder"],
          confidence: "low" as const,
        },
      ];

    // Extract deterministic calculations and weather context from evidence
    const deterministicCalculations = evidence
      .filter((e) => e.evidenceType === "DETERMINISTIC_CALCULATION")
      .map((e) => ({
        engine: "fao56-waterbalance-v1.0.0",
        calculation: "Crop Water Demand & Net Irrigation",
        result: e.excerpt,
        unit: "mm/day",
        evidenceId: e.id,
      }));

    const weatherEv = evidence.find((e) => e.evidenceType === "WEATHER_FORECAST" || e.evidenceType === "WEATHER_OBSERVATION");
    const weatherContext = weatherEv ? weatherEv.excerpt : undefined;

    const defaultReport: ResearchReport = {
      taskId: task.id,
      question: task.question,
      scope: "Agricultural Research Investigation",
      summary: `Comprehensive agricultural research summary regarding: "${task.question}". Grounded in verified evidence.`,
      findings,
      weatherContext,
      deterministicCalculations,
      conflictingEvidence: [],
      assumptions: [
        "Regional weather forecasts remain representative of the micro-climate.",
        "Soil condition conforms to standard regional agricultural classifications.",
      ],
      limitations: [
        "Read-only tools provide observational guidance, not automated sensor telemetry.",
        "Local field soil testing is recommended before applying high-density nitrogen fertilizers.",
      ],
      practicalInterpretation: "Farmers should observe crop growth milestones and consult local extension officers before major interventions.",
      sources: evidence.map((e) => ({
        evidenceId: e.id,
        title: e.sourceTitle,
        institution: e.publisher || e.sourceTitle,
        url: e.sourceUri,
        freshness: e.freshness,
      })),
      generatedAt: new Date().toISOString(),
    };

    this.lastUsage = {
      promptTokens: 250,
      completionTokens: 180,
      totalTokens: 430,
      modelName: "mock-agricultural-synthesizer-v1",
      latencyMs: this.options.synthesizeDelayMs ?? 15,
    };

    return ResearchReportSchema.parse(defaultReport);
  }

  async extractVisionData(request: import("./types").VisionExtractionRequest): Promise<string> {
    if (request.signal?.aborted) {
      throw new CancellationError("MockProvider.extractVisionData");
    }

    if (this.options.failOnVision) {
      throw new ProviderError("mock", "Simulated vision extraction failure");
    }

    if (this.options.visionOverride) {
      return typeof this.options.visionOverride === "function"
        ? this.options.visionOverride(request)
        : this.options.visionOverride;
    }

    return JSON.stringify({
      labMetadata: {
        labName: "District Soil Testing Laboratory",
        sampleCode: "SHC-2026-8812",
        testingDate: "2026-11-20",
        district: "Ludhiana",
        state: "Punjab",
      },
      parameters: {
        ph: { value: 7.4, unit: "pH_units", testMethod: "SUSPENSION_1_2_5_WATER", confidence: 0.95 },
        electricalConductivity: { value: 0.45, unit: "dS/m", testMethod: "SUSPENSION_1_2_WATER", confidence: 0.92 },
        organicCarbonPercent: { value: 0.55, unit: "%", testMethod: "WALKLEY_BLACK_WET_OXIDATION", confidence: 0.90 },
        availableNitrogen: { value: 290, unit: "kg/ha", testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA", confidence: 0.93 },
        availablePhosphorus: { value: 22.0, unit: "kg/ha_P2O5", testMethod: "OLSEN_SODIUM_BICARBONATE", confidence: 0.91 },
        availablePotassium: { value: 180, unit: "kg/ha_K2O", testMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE", confidence: 0.94 },
        availableZincPpm: { value: 0.52, unit: "ppm", testMethod: "DTPA_TEA_CaCl2_LINDSAY_NORVELL", confidence: 0.89 },
      },
    });
  }

  getUsageMetadata(): ModelUsageMetadata | undefined {
    return this.lastUsage;
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new CancellationError("MockProvider delay aborted"));
        },
        { once: true }
      );
    });
  }
}
