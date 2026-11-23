import { describe, expect, it } from "vitest";
import {
  ResearchTaskInputSchema,
  ResearchTaskSchema,
  ResearchPlanSchema,
  ResearchStepSchema,
  EvidenceSchema,
  ResearchReportSchema,
  RuntimeLimitsSchema,
  ToolPermissionSchema,
} from "../../src/agentic/contracts/schemas";
import { DEFAULT_RUNTIME_LIMITS } from "../../src/agentic/contracts/types";

describe("Contracts and Schemas", () => {
  describe("ResearchTaskInputSchema", () => {
    it("accepts a valid question and ownerId", () => {
      const valid = {
        ownerId: "user-123",
        question: "What are optimal irrigation practices for wheat in Punjab?",
        context: { soilType: "alluvial" },
      };
      const parsed = ResearchTaskInputSchema.parse(valid);
      expect(parsed.question).toBe(valid.question);
      expect(parsed.ownerId).toBe(valid.ownerId);
    });

    it("rejects questions that are too short", () => {
      expect(() =>
        ResearchTaskInputSchema.parse({ ownerId: "u1", question: "Crop" })
      ).toThrow();
    });

    it("rejects questions that exceed 1000 characters", () => {
      expect(() =>
        ResearchTaskInputSchema.parse({ ownerId: "u1", question: "x".repeat(1001) })
      ).toThrow();
    });

    it("rejects missing ownerId", () => {
      expect(() =>
        ResearchTaskInputSchema.parse({ question: "Valid question here?" })
      ).toThrow();
    });
  });

  describe("ResearchPlanSchema", () => {
    it("accepts valid plan with steps", () => {
      const plan = {
        taskId: "task-abc",
        steps: [
          {
            id: "step-1",
            purpose: "Check weather forecast",
            toolName: "weather.lookup",
            input: { location: "Punjab" },
          },
        ],
        generatedAt: new Date().toISOString(),
      };
      const parsed = ResearchPlanSchema.parse(plan);
      expect(parsed.steps).toHaveLength(1);
    });

    it("rejects empty steps array", () => {
      expect(() =>
        ResearchPlanSchema.parse({
          taskId: "t1",
          steps: [],
          generatedAt: new Date().toISOString(),
        })
      ).toThrow();
    });
  });

  describe("EvidenceSchema", () => {
    it("validates evidence items and enforces contentHash and isUntrusted flag", () => {
      const item = {
        id: "evi_123",
        taskId: "task_1",
        sourceUri: "https://icar.org.in/wheat",
        sourceTitle: "ICAR Wheat Cultivation Guidelines",
        retrievedAt: new Date().toISOString(),
        excerpt: "Wheat requires first irrigation at 21 days (CRI stage).",
        contentHash: "abcdef1234567890",
        retrievalMethod: "tool:crop.knowledge.lookup",
        isUntrusted: true,
      };
      const parsed = EvidenceSchema.parse(item);
      expect(parsed.isUntrusted).toBe(true);
      expect(parsed.contentHash).toBe("abcdef1234567890");
    });
  });

  describe("ResearchReportSchema", () => {
    it("validates complete report with citations", () => {
      const report = {
        taskId: "task_1",
        summary: "Wheat irrigation requires careful timing across growth stages.",
        findings: [
          {
            claim: "CRI stage is the most critical for first irrigation.",
            evidenceIds: ["evi_123"],
            confidence: "high" as const,
          },
        ],
        assumptions: ["Standard winter climate conditions apply."],
        limitations: ["Guidance does not substitute for field moisture meters."],
        generatedAt: new Date().toISOString(),
      };
      const parsed = ResearchReportSchema.parse(report);
      expect(parsed.findings[0].evidenceIds).toContain("evi_123");
    });

    it("rejects findings without evidenceIds", () => {
      const invalid = {
        taskId: "task_1",
        summary: "Wheat irrigation requires careful timing across growth stages.",
        findings: [
          {
            claim: "CRI stage is the most critical for first irrigation.",
            evidenceIds: [],
            confidence: "high",
          },
        ],
        assumptions: [],
        limitations: [],
        generatedAt: new Date().toISOString(),
      };
      expect(() => ResearchReportSchema.parse(invalid)).toThrow();
    });
  });

  describe("RuntimeLimitsSchema", () => {
    it("uses default runtime limits", () => {
      expect(DEFAULT_RUNTIME_LIMITS.maxSteps).toBe(4);
      expect(DEFAULT_RUNTIME_LIMITS.maxEvidenceItems).toBe(20);
      expect(DEFAULT_RUNTIME_LIMITS.toolTimeoutMs).toBe(10_000);
      expect(DEFAULT_RUNTIME_LIMITS.maxRetriesPerTool).toBe(2);
      expect(DEFAULT_RUNTIME_LIMITS.maxConcurrentTools).toBe(2);
    });

    it("validates custom limits within valid bounds", () => {
      const custom = RuntimeLimitsSchema.parse({
        maxSteps: 3,
        maxEvidenceItems: 15,
        toolTimeoutMs: 5000,
        maxRetriesPerTool: 1,
        maxConcurrentTools: 1,
        totalTaskTimeoutMs: 30000,
      });
      expect(custom.maxSteps).toBe(3);
    });
  });

  describe("ToolPermissionSchema", () => {
    it("normalizes lowercase 'read_only' to 'READ_ONLY'", () => {
      expect(ToolPermissionSchema.parse("read_only")).toBe("READ_ONLY");
      expect(ToolPermissionSchema.parse("READ_ONLY")).toBe("READ_ONLY");
      expect(ToolPermissionSchema.parse("requires_approval")).toBe("REQUIRES_APPROVAL");
      expect(ToolPermissionSchema.parse("blocked")).toBe("BLOCKED");
    });
  });
});
