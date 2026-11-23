import { describe, expect, it } from "vitest";
import { EvidenceManager, computeContentHash } from "../../src/agentic/evidence/evidenceManager";
import { BudgetExceededError } from "../../src/agentic/contracts/errors";

describe("EvidenceManager", () => {
  it("rejects report citations that do not exist", () => {
    const manager = new EvidenceManager(5);
    const errors = manager.validateReport({
      findings: [{ claim: "Claim", evidenceIds: ["missing"], confidence: "low" }],
    });
    expect(errors).toContain("Unknown evidence reference: missing");
  });

  it("registers evidence and retains complete metadata", () => {
    const manager = new EvidenceManager(10);
    const evidence = manager.register({
      taskId: "task-100",
      sourceUri: "https://icar.gov.in/paddy",
      sourceTitle: "ICAR Rice Directives",
      publisher: "ICAR",
      excerpt: "Maintain 2-3 cm shallow water depth during initial tillering.",
      retrievalMethod: "tool:crop.knowledge.lookup",
    });

    expect(evidence.id).toBeDefined();
    expect(evidence.contentHash).toBeDefined();
    expect(evidence.isUntrusted).toBe(true);
    expect(evidence.retrievedAt).toBeDefined();
    expect(manager.count()).toBe(1);
    expect(manager.has(evidence.id)).toBe(true);
    expect(manager.get(evidence.id)?.sourceTitle).toBe("ICAR Rice Directives");
  });

  it("deduplicates identical evidence based on content hash without wasting budget", () => {
    const manager = new EvidenceManager(3);
    const item1 = manager.register({
      taskId: "task-100",
      sourceUri: "https://icar.gov.in/paddy",
      sourceTitle: "ICAR Rice Directives",
      excerpt: "Maintain 2-3 cm shallow water depth.",
      retrievalMethod: "tool:crop.knowledge.lookup",
    });

    const item2 = manager.register({
      taskId: "task-100",
      sourceUri: "https://icar.gov.in/paddy",
      sourceTitle: "ICAR Rice Directives (duplicate call)",
      excerpt: "Maintain 2-3 cm shallow water depth.",
      retrievalMethod: "tool:crop.knowledge.lookup",
    });

    expect(manager.count()).toBe(1);
    expect(item1.id).toBe(item2.id);
    expect(item1.contentHash).toBe(item2.contentHash);
  });

  it("enforces evidence count limit and throws BudgetExceededError", () => {
    const manager = new EvidenceManager(2);

    manager.register({
      taskId: "task-1",
      sourceUri: "uri://1",
      sourceTitle: "Title 1",
      excerpt: "Excerpt 1",
      retrievalMethod: "test",
    });

    manager.register({
      taskId: "task-1",
      sourceUri: "uri://2",
      sourceTitle: "Title 2",
      excerpt: "Excerpt 2",
      retrievalMethod: "test",
    });

    expect(() =>
      manager.register({
        taskId: "task-1",
        sourceUri: "uri://3",
        sourceTitle: "Title 3",
        excerpt: "Excerpt 3",
        retrievalMethod: "test",
      })
    ).toThrow(BudgetExceededError);
  });

  it("computes deterministic SHA-256 content hashes", () => {
    const hash1 = computeContentHash("Same content", "https://example.com");
    const hash2 = computeContentHash("Same content", "https://example.com");
    const hash3 = computeContentHash("Different content", "https://example.com");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64);
  });
});
