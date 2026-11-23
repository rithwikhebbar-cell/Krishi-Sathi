import { describe, expect, it } from "vitest";
import { ResearchRuntime } from "../../src/agentic/runtime/researchRuntime";
import { createDefaultToolRegistry } from "../../src/agentic/tools";
import { MockModelProvider } from "../../src/agentic/providers/mockProvider";

describe("ResearchRuntime Integration", () => {
  it("executes a complete end-to-end research task with mock provider and built-in tools", async () => {
    const tools = createDefaultToolRegistry();
    const provider = new MockModelProvider();
    const runtime = new ResearchRuntime({ tools, provider });

    const result = await runtime.runTask({
      ownerId: "farmer-pb-01",
      question: "What are the recommended irrigation schedules for wheat during dry spells?",
      context: { location: "Punjab, India", soilType: "Loamy" },
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.task.status).toBe("COMPLETED");
    expect(result.plan).toBeDefined();
    expect(result.plan?.steps.length).toBeGreaterThan(0);
    expect(result.toolExecutions.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.report).toBeDefined();
    expect(result.report?.findings.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    // Verify all findings cite registered evidence
    const evidenceIds = new Set(result.evidence.map((e) => e.id));
    for (const finding of result.report!.findings) {
      expect(finding.evidenceIds.length).toBeGreaterThan(0);
      for (const id of finding.evidenceIds) {
        expect(evidenceIds.has(id)).toBe(true);
      }
    }

    // Verify event lifecycle
    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).toContain("TASK_CREATED");
    expect(eventTypes).toContain("TASK_VALIDATING");
    expect(eventTypes).toContain("TASK_VALIDATED");
    expect(eventTypes).toContain("PLAN_GENERATION_STARTED");
    expect(eventTypes).toContain("PLAN_GENERATED");
    expect(eventTypes).toContain("PLAN_VALIDATED");
    expect(eventTypes).toContain("TOOL_STARTED");
    expect(eventTypes).toContain("TOOL_COMPLETED");
    expect(eventTypes).toContain("EVIDENCE_REGISTERED");
    expect(eventTypes).toContain("EVALUATION_COMPLETED");
    expect(eventTypes).toContain("SYNTHESIS_STARTED");
    expect(eventTypes).toContain("SYNTHESIS_COMPLETED");
    expect(eventTypes).toContain("REPORT_VALIDATING");
    expect(eventTypes).toContain("REPORT_VALIDATED");
    expect(eventTypes).toContain("TASK_COMPLETED");
  });

  it("handles planner failure cleanly and transitions to FAILED status", async () => {
    const tools = createDefaultToolRegistry();
    const provider = new MockModelProvider({ failOnPlan: true });
    const runtime = new ResearchRuntime({ tools, provider });

    const result = await runtime.runTask({
      ownerId: "user-1",
      question: "How to handle rice blast disease in high humidity?",
    });

    expect(result.status).toBe("FAILED");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/planning failure/i);
    expect(result.events.some((e) => e.type === "TASK_FAILED")).toBe(true);
  });

  it("handles task cancellation via AbortSignal", async () => {
    const tools = createDefaultToolRegistry();
    const provider = new MockModelProvider({ planDelayMs: 200 });
    const runtime = new ResearchRuntime({ tools, provider });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const result = await runtime.runTask(
      {
        ownerId: "user-1",
        question: "Irrigation recommendations for cotton crops?",
      },
      { signal: controller.signal }
    );

    expect(result.status).toBe("CANCELLED");
    expect(result.events.some((e) => e.type === "TASK_CANCELLED")).toBe(true);
  });

  it("handles global task timeout and transitions to TIMED_OUT", async () => {
    const tools = createDefaultToolRegistry();
    const provider = new MockModelProvider({ planDelayMs: 250 });
    const runtime = new ResearchRuntime({
      tools,
      provider,
      limits: { totalTaskTimeoutMs: 50 }, // Extremely tight timeout
    });

    const result = await runtime.runTask({
      ownerId: "user-1",
      question: "Soil health recommendations for acidic soils?",
    });

    expect(result.status).toBe("TIMED_OUT");
    expect(result.events.some((e) => e.type === "TASK_TIMED_OUT")).toBe(true);
  });

  it("rejects synthesis output if citations are fabricated or ungrounded", async () => {
    const tools = createDefaultToolRegistry();
    const provider = new MockModelProvider({
      reportOverride: (task) => ({
        taskId: task.id,
        summary: "This report fabricates its citations.",
        findings: [
          {
            claim: "Pesticide application will completely cure all pests immediately.",
            evidenceIds: ["fake_citation_9999"],
            confidence: "high" as const,
          },
        ],
        assumptions: [],
        limitations: [],
        generatedAt: new Date().toISOString(),
      }),
    });

    const runtime = new ResearchRuntime({ tools, provider });
    const result = await runtime.runTask({
      ownerId: "user-1",
      question: "Is chemical spraying safe before harvest?",
    });

    expect(result.status).toBe("FAILED");
    expect(result.errors.some((e) => e.includes("fake_citation_9999"))).toBe(true);
  });
});
