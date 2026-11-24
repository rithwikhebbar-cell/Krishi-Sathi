import { describe, it, expect } from "vitest";
import { AgriculturalKnowledgeRetriever } from "../../src/agentic/soil/agriculturalKnowledgeRetriever";
import { EvidenceManager } from "../../src/agentic/evidence/evidenceManager";
import { SourceRegistry } from "../../src/agentic/retrieval/sourceRegistry";

describe("AgriculturalKnowledgeRetriever & Source Hierarchy (M1.3 Phase 5)", () => {
  const sourceRegistry = new SourceRegistry();
  const retriever = new AgriculturalKnowledgeRetriever(sourceRegistry);

  it("retrieves Tier 1 ICAR and PAU packages of practices for Punjab wheat", () => {
    const evidenceManager = new EvidenceManager();
    const result = retriever.retrieveContextualEvidence(
      {
        crop: "WHEAT",
        state: "Punjab",
        district: "Ludhiana",
        soilType: "ALLUVIAL",
        growthStage: "initial",
      },
      evidenceManager
    );

    expect(result.matchedDocumentsCount).toBeGreaterThan(0);
    expect(result.regionalMatchFound).toBe(true);
    expect(result.regionalWarning).toBeUndefined();

    const titles = result.evidence.map((e) => e.sourceTitle);
    expect(titles.some((t) => t.includes("ICAR-Indian Institute of Wheat & Barley Research") || t.includes("PAU"))).toBe(true);

    // Verify evidence was properly stored in EvidenceManager with SHA-256 hash
    const stored = evidenceManager.list();
    expect(stored.length).toBe(result.matchedDocumentsCount);
    expect(stored[0].contentHash).toBeDefined();
    expect(stored[0].contentHash.length).toBe(64);
  });

  it("retrieves Central Zone cotton packages of practices for Maharashtra Vertisols", () => {
    const evidenceManager = new EvidenceManager();
    const result = retriever.retrieveContextualEvidence(
      {
        crop: "COTTON",
        state: "Maharashtra",
        district: "Nagpur",
        soilType: "BLACK_REGUR",
      },
      evidenceManager
    );

    expect(result.matchedDocumentsCount).toBeGreaterThan(0);
    expect(result.regionalMatchFound).toBe(true);
    const titles = result.evidence.map((e) => e.sourceTitle);
    expect(titles.some((t) => t.includes("CICR") || t.includes("Cotton"))).toBe(true);
  });

  it("emits an explicit regional warning when state-specific package is not present", () => {
    const evidenceManager = new EvidenceManager();
    const result = retriever.retrieveContextualEvidence(
      {
        crop: "WHEAT",
        state: "Kerala", // Non-traditional wheat growing state with no regional package
        soilType: "LATERITE",
      },
      evidenceManager
    );

    // Should not crash or invent false regional documents
    expect(result.regionalMatchFound).toBe(false);
    expect(result.regionalWarning).toContain("Package of Practices for 'Kerala' could not be matched directly");
  });

  it("prevents unregistered or unapproved domains from being accepted into EvidenceManager", () => {
    const evidenceManager = new EvidenceManager();
    const result = retriever.retrieveContextualEvidence(
      {
        crop: "WHEAT",
        state: "Punjab",
      },
      evidenceManager
    );

    // All registered sources must belong to approved domains in SourceRegistry
    for (const item of result.evidence) {
      const host = new URL(item.sourceUri).hostname;
      expect(sourceRegistry.isDomainApproved(host)).toBe(true);
    }
  });
});
