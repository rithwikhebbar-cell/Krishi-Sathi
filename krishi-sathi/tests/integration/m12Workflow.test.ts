import { describe, expect, it } from "vitest";
import { ResearchRuntime } from "../../src/agentic/runtime/researchRuntime";
import { createDefaultToolRegistry } from "../../src/agentic/tools";
import { MockModelProvider } from "../../src/agentic/providers/mockProvider";
import { app, taskStore } from "../../src/server/index";

describe("Milestone 1.2 End-to-End Workflow Integration", () => {
  it("executes multi-tool research workflow with weather, agricultural documents, and deterministic engine", async () => {
    const tools = createDefaultToolRegistry();

    const provider = new MockModelProvider({
      planOverride: (task) => ({
        taskId: task.id,
        steps: [
          {
            id: "step_weather",
            purpose: "Check weather and rainfall forecast in Punjab",
            toolName: "weather.lookup",
            input: { location: "Ludhiana", days: 3 },
          },
          {
            id: "step_agronomy",
            purpose: "Fetch ICAR wheat irrigation recommendations",
            toolName: "crop.knowledge.lookup",
            input: { crop: "wheat", topic: "irrigation", query: "wheat irrigation schedule" },
          },
          {
            id: "step_water_calc",
            purpose: "Calculate deterministic crop water requirement and net irrigation demand",
            toolName: "crop.water.balance",
            input: {
              crop: "wheat",
              growthStage: "mid_season",
              referenceEvapotranspirationMmDay: 3.5,
              forecastRainfallMm: 0,
              fieldAreaHectares: 2.0,
            },
          },
        ],
        explanation: "Comprehensive agricultural investigation combining live weather observations, agronomic guidelines, and deterministic FAO-56 irrigation calculations.",
        generatedAt: new Date().toISOString(),
      }),
    });

    const runtime = new ResearchRuntime({ tools, provider });

    const result = await runtime.runTask({
      ownerId: "farmer-ludhiana-01",
      question: "What is the net irrigation requirement for mid-season wheat in Ludhiana given current weather?",
      context: { location: "Ludhiana, Punjab", crop: "wheat" },
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.toolExecutions).toHaveLength(3);
    expect(result.evidence.length).toBeGreaterThanOrEqual(3);

    // Verify distinct evidence types gathered
    const evidenceTypes = result.evidence.map((e) => e.evidenceType);
    expect(evidenceTypes).toContain("WEATHER_FORECAST");
    expect(evidenceTypes).toContain("RESEARCH_DOCUMENT");
    expect(evidenceTypes).toContain("DETERMINISTIC_CALCULATION");

    // Verify deterministic calculation evidence is marked authoritative (isUntrusted === false)
    const calcEvidence = result.evidence.find((e) => e.evidenceType === "DETERMINISTIC_CALCULATION");
    expect(calcEvidence).toBeDefined();
    expect(calcEvidence?.isUntrusted).toBe(false);
    expect(calcEvidence?.sourceUri).toContain("engine://");

    // Verify final report has all M1.2 rich sections
    expect(result.report).toBeDefined();
    expect(result.report?.deterministicCalculations.length).toBeGreaterThan(0);
    expect(result.report?.sources.length).toBeGreaterThan(0);
    expect(result.report?.practicalInterpretation).toBeDefined();

    // Verify citation integrity
    const registeredIds = new Set(result.evidence.map((e) => e.id));
    for (const finding of result.report!.findings) {
      expect(finding.evidenceIds.length).toBeGreaterThan(0);
      for (const id of finding.evidenceIds) {
        expect(registeredIds.has(id)).toBe(true);
      }
    }
  });

  it("handles the Express API /api/research/tools endpoint", async () => {
    const { EventEmitter } = await import("events");
    const req = new EventEmitter();
    (req as any).method = "GET";
    (req as any).url = "/api/research/tools";
    (req as any).headers = {};

    let responseData: any;
    let statusCode = 200;

    const res = {
      setHeader: () => {},
      getHeader: () => {},
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        responseData = data;
        return res;
      },
    };

    await (app as any).handle(req, res);

    expect(statusCode).toBe(200);
    expect(responseData.tools.some((t: any) => t.name === "weather.lookup")).toBe(true);
    expect(responseData.tools.some((t: any) => t.name === "crop.water.balance")).toBe(true);
  });
});
