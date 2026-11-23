import { describe, expect, it } from "vitest";
import {
  EvidenceManager,
  evaluateFreshness,
  calculateRelevance,
  normalizeUri,
} from "../../src/agentic/evidence/evidenceManager";

describe("Evidence Intelligence & Quality", () => {
  describe("Freshness Classification", () => {
    it("classifies weather observation freshness based on hours elapsed", () => {
      const nowIso = new Date().toISOString();
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const threeDaysAgo = new Date(Date.now() - 72 * 3600 * 1000).toISOString();

      expect(evaluateFreshness("WEATHER_OBSERVATION", twoHoursAgo)).toBe("CURRENT");
      expect(evaluateFreshness("WEATHER_OBSERVATION", twelveHoursAgo)).toBe("RECENT");
      expect(evaluateFreshness("WEATHER_OBSERVATION", threeDaysAgo)).toBe("STALE");
    });

    it("classifies agricultural research documents based on publication years", () => {
      const nowIso = new Date().toISOString();
      const twoYearsAgo = new Date(Date.now() - 2 * 365.25 * 24 * 3600 * 1000).toISOString();
      const eightYearsAgo = new Date(Date.now() - 8 * 365.25 * 24 * 3600 * 1000).toISOString();
      const twentyYearsAgo = new Date(Date.now() - 20 * 365.25 * 24 * 3600 * 1000).toISOString();

      expect(evaluateFreshness("RESEARCH_DOCUMENT", nowIso, twoYearsAgo)).toBe("CURRENT");
      expect(evaluateFreshness("RESEARCH_DOCUMENT", nowIso, eightYearsAgo)).toBe("RECENT");
      expect(evaluateFreshness("RESEARCH_DOCUMENT", nowIso, twentyYearsAgo)).toBe("STALE");
    });

    it("classifies deterministic calculations as CURRENT", () => {
      expect(evaluateFreshness("DETERMINISTIC_CALCULATION", new Date().toISOString())).toBe("CURRENT");
    });
  });

  describe("Relevance Scoring", () => {
    it("computes relevance score matching query keywords in excerpt and title", () => {
      const query = "wheat irrigation CRI stage";
      const highRelevance = "Crown root initiation (CRI) stage is critical for wheat irrigation.";
      const lowRelevance = "Cotton fertilizer application guidelines.";

      const scoreHigh = calculateRelevance(query, highRelevance, "Wheat Guide");
      const scoreLow = calculateRelevance(query, lowRelevance, "Cotton Guide");

      expect(scoreHigh).toBeGreaterThan(scoreLow);
      expect(scoreHigh).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("URI Normalization & Deduplication", () => {
    it("normalizes URIs by stripping tracking parameters", () => {
      const url1 = "https://icar.org.in/wheat?utm_source=twitter&utm_medium=social&ref=feed";
      const url2 = "https://icar.org.in/wheat";

      expect(normalizeUri(url1)).toBe("https://icar.org.in/wheat");
      expect(normalizeUri(url2)).toBe("https://icar.org.in/wheat");
    });

    it("deduplicates identical evidence even if URLs have different tracking queries", () => {
      const manager = new EvidenceManager(10);
      const e1 = manager.register({
        taskId: "task-1",
        sourceUri: "https://icar.org.in/paddy?utm_source=newsletter",
        sourceTitle: "Paddy Guide",
        excerpt: "Maintain shallow submergence during vegetative phase.",
        retrievalMethod: "test",
      });

      const e2 = manager.register({
        taskId: "task-1",
        sourceUri: "https://icar.org.in/paddy?utm_source=google_ads&ref=promo",
        sourceTitle: "Paddy Guide",
        excerpt: "Maintain shallow submergence during vegetative phase.",
        retrievalMethod: "test",
      });

      expect(manager.count()).toBe(1);
      expect(e1.id).toBe(e2.id);
    });
  });

  describe("Conflicting Evidence Detection & Preservation", () => {
    it("detects quantitative conflict between two sources for the same crop and preserves both", () => {
      const manager = new EvidenceManager(10);

      const e1 = manager.register({
        taskId: "task-1",
        sourceUri: "https://icar.org.in/wheat-standard",
        sourceTitle: "ICAR National Wheat Standard",
        excerpt: "Wheat requires 4 to 6 irrigations across critical growth stages in Northern India.",
        retrievalMethod: "icar",
      });

      const e2 = manager.register({
        taskId: "task-1",
        sourceUri: "https://pau.edu/wheat-subsurface",
        sourceTitle: "PAU Drip Irrigation Study",
        excerpt: "Under high water table conditions, wheat requires only 2 to 3 irrigations.",
        retrievalMethod: "pau",
      });

      // Both items are preserved
      expect(manager.count()).toBe(2);
      expect(manager.get(e1.id)?.conflictNotes?.length).toBeGreaterThan(0);
      expect(manager.get(e2.id)?.conflictNotes?.length).toBeGreaterThan(0);

      const conflicts = manager.getConflictingEvidence();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictDescription).toContain("Noticeable variance in irrigation advice for wheat");
      expect(conflicts[0].conflictingEvidenceIds).toContain(e1.id);
      expect(conflicts[0].conflictingEvidenceIds).toContain(e2.id);
    });
  });
});
