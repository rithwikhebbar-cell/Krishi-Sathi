import { describe, expect, it } from "vitest";
import { ReportValidator } from "../../src/agentic/validators/reportValidator";
import { EvidenceManager } from "../../src/agentic/evidence/evidenceManager";
import { ResearchReport } from "../../src/agentic/contracts/types";

describe("ReportValidator", () => {
  it("approves a well-formed report with valid citations", () => {
    const evidenceManager = new EvidenceManager(10);
    const evidence = evidenceManager.register({
      taskId: "task-1",
      sourceUri: "https://icar.gov.in/wheat",
      sourceTitle: "ICAR Wheat Guidelines",
      excerpt: "Crown root initiation occurs at 20-25 days.",
      retrievalMethod: "tool:crop.knowledge.lookup",
    });

    const report: ResearchReport = {
      taskId: "task-1",
      summary: "Comprehensive irrigation guide for wheat cultivation.",
      findings: [
        {
          claim: "CRI stage is the most sensitive period for moisture stress.",
          evidenceIds: [evidence.id],
          confidence: "high",
        },
      ],
      assumptions: ["Soil has standard drainage."],
      limitations: ["Rainfall timing may alter required frequency."],
      generatedAt: new Date().toISOString(),
    };

    const result = ReportValidator.validate(report, evidenceManager);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.report).toBeDefined();
  });

  it("rejects reports with missing or too-short summaries", () => {
    const evidenceManager = new EvidenceManager(10);
    const result = ReportValidator.validate(
      {
        taskId: "task-1",
        summary: "Short",
        findings: [{ claim: "A valid finding with citation", evidenceIds: ["evi_1"], confidence: "medium" }],
        assumptions: [],
        limitations: [],
        generatedAt: new Date().toISOString(),
      },
      evidenceManager
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("summary"))).toBe(true);
  });

  it("rejects reports with uncited findings", () => {
    const evidenceManager = new EvidenceManager(10);
    const result = ReportValidator.validate(
      {
        taskId: "task-1",
        summary: "Summary of agricultural findings for the region.",
        findings: [
          {
            claim: "Uncited claim about soil nitrogen levels.",
            evidenceIds: [],
            confidence: "low",
          },
        ],
        assumptions: [],
        limitations: [],
        generatedAt: new Date().toISOString(),
      },
      evidenceManager
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("lacks evidence"))).toBe(true);
  });

  it("rejects reports with fabricated or unknown evidence IDs", () => {
    const evidenceManager = new EvidenceManager(10);
    evidenceManager.register({
      taskId: "task-1",
      sourceUri: "uri://known",
      sourceTitle: "Real evidence",
      excerpt: "Real excerpt",
      retrievalMethod: "test",
    });

    const report: ResearchReport = {
      taskId: "task-1",
      summary: "Agricultural assessment summary.",
      findings: [
        {
          claim: "Claims referencing phantom citation.",
          evidenceIds: ["phantom_evidence_id_999"],
          confidence: "medium",
        },
      ],
      assumptions: [],
      limitations: [],
      generatedAt: new Date().toISOString(),
    };

    const result = ReportValidator.validate(report, evidenceManager);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("phantom_evidence_id_999"))).toBe(true);
  });
});
