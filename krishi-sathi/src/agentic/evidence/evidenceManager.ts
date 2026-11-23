import { createHash } from "crypto";
import {
  Evidence,
  CreateEvidenceInput,
  ResearchReport,
  EvidenceFreshness,
  EvidenceType,
} from "../contracts/types";
import { BudgetExceededError, ValidationError } from "../contracts/errors";
import { EvidenceSchema } from "../contracts/schemas";

/**
 * Normalizes a URI by lowercasing hostname and stripping tracking query parameters.
 */
export function normalizeUri(uri: string): string {
  try {
    const url = new URL(uri);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "fbclid", "gclid", "source", "tracking", "session_id"
    ];
    for (const p of trackingParams) {
      url.searchParams.delete(p);
    }
    return url.toString();
  } catch {
    return uri.trim();
  }
}

export function computeContentHash(content: string, uri: string = ""): string {
  const cleanUri = normalizeUri(uri).toLowerCase();
  const normalized = `${cleanUri}::${content.trim().replace(/\s+/g, " ")}`;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function evaluateFreshness(
  type: EvidenceType,
  retrievedAt: string,
  publishedAt?: string
): EvidenceFreshness {
  const retrievedTime = new Date(retrievedAt).getTime();
  const now = Date.now();
  const ageHours = (now - retrievedTime) / (1000 * 60 * 60);

  if (type === "WEATHER_OBSERVATION") {
    if (ageHours <= 3) return "CURRENT";
    if (ageHours <= 24) return "RECENT";
    return "STALE";
  }

  if (type === "WEATHER_FORECAST") {
    if (ageHours <= 12) return "CURRENT";
    if (ageHours <= 48) return "RECENT";
    return "STALE";
  }

  if (type === "DETERMINISTIC_CALCULATION") {
    return "CURRENT";
  }

  // Research and agronomic documents
  if (publishedAt) {
    const pubDate = new Date(publishedAt).getTime();
    if (!isNaN(pubDate)) {
      const ageYears = (now - pubDate) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears <= 3) return "CURRENT";
      if (ageYears <= 10) return "RECENT";
      if (ageYears > 15) return "STALE";
    }
  }

  return "RECENT";
}

export function calculateRelevance(
  query: string | undefined,
  excerpt: string,
  title: string
): number {
  if (!query || query.trim().length === 0) return 0.5;

  const queryTokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTokens.length === 0) return 0.5;

  const targetText = `${title.toLowerCase()} ${excerpt.toLowerCase()}`;
  let matches = 0;

  for (const token of queryTokens) {
    if (targetText.includes(token)) {
      matches++;
    }
  }

  const rawScore = matches / queryTokens.length;
  // Bounded between 0.2 and 1.0
  return Math.min(1.0, Math.max(0.2, Math.round(rawScore * 100) / 100));
}

export class EvidenceManager {
  private readonly items: Evidence[] = [];
  private readonly hashMap = new Map<string, Evidence>();
  private readonly idMap = new Map<string, Evidence>();

  constructor(private readonly maxItems: number = 20) {
    if (maxItems < 1) {
      throw new ValidationError("maxItems must be at least 1");
    }
  }

  /**
   * Registers a piece of evidence with deduplication, freshness, relevance, and conflict awareness.
   */
  register(input: CreateEvidenceInput): Evidence {
    const cleanUri = normalizeUri(input.sourceUri);
    const contentHash = input.contentHash ?? computeContentHash(input.excerpt, cleanUri);

    // Deduplication check
    const existing = this.hashMap.get(contentHash);
    if (existing) {
      return existing;
    }

    if (this.items.length >= this.maxItems) {
      throw new BudgetExceededError("evidence items", this.maxItems, this.items.length + 1);
    }

    const id = input.id ?? `evi_${contentHash.substring(0, 12)}`;
    const retrievedAt = input.retrievedAt ?? new Date().toISOString();
    const evidenceType: EvidenceType = input.evidenceType ?? "AGRONOMIC_GUIDELINE";
    const freshness: EvidenceFreshness = input.freshness ?? evaluateFreshness(evidenceType, retrievedAt, input.publishedAt);
    const relevanceScore = input.relevanceScore ?? calculateRelevance(input.researchQuery, input.excerpt, input.sourceTitle);

    const candidate: Evidence = {
      id,
      taskId: input.taskId,
      sourceUri: cleanUri,
      sourceTitle: input.sourceTitle,
      publisher: input.publisher,
      publishedAt: input.publishedAt,
      lastUpdatedAt: input.lastUpdatedAt,
      retrievedAt,
      evidenceType,
      excerpt: input.excerpt,
      contentHash,
      researchQuery: input.researchQuery,
      retrievalMethod: input.retrievalMethod,
      freshness,
      relevanceScore,
      isUntrusted: input.isUntrusted ?? true,
      extractionWarnings: input.extractionWarnings ?? [],
      conflictNotes: input.conflictNotes ?? [],
    };

    // Detect conflicts with previously registered evidence
    this.detectConflicts(candidate);

    const validated = EvidenceSchema.parse(candidate);

    this.items.push(validated);
    this.hashMap.set(contentHash, validated);
    this.idMap.set(validated.id, validated);

    return validated;
  }

  /**
   * Compatibility method for starter interface: add()
   */
  add(item: Evidence): void {
    const cleanUri = normalizeUri(item.sourceUri);
    const contentHash = item.contentHash || computeContentHash(item.excerpt, cleanUri);
    if (this.hashMap.has(contentHash) || this.items.some((e) => e.contentHash === contentHash)) {
      return;
    }

    if (this.items.length >= this.maxItems) {
      throw new BudgetExceededError("evidence items", this.maxItems, this.items.length + 1);
    }

    const validated = EvidenceSchema.parse({
      ...item,
      sourceUri: cleanUri,
      contentHash,
      isUntrusted: item.isUntrusted ?? true,
      freshness: item.freshness ?? "CURRENT",
      evidenceType: item.evidenceType ?? "AGRONOMIC_GUIDELINE",
    });

    this.items.push(validated);
    this.hashMap.set(contentHash, validated);
    this.idMap.set(validated.id, validated);
  }

  get(id: string): Evidence | undefined {
    return this.idMap.get(id);
  }

  has(id: string): boolean {
    return this.idMap.has(id);
  }

  list(): Evidence[] {
    return [...this.items];
  }

  count(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
    this.hashMap.clear();
    this.idMap.clear();
  }

  /**
   * Inspects and detects potential conflicts (e.g. differing irrigation or dosage numbers for same crop).
   * Preserves both sources and records conflict notes on both items without deleting either.
   */
  private detectConflicts(candidate: Evidence): void {
    const candidateText = candidate.excerpt.toLowerCase();
    const candidateCrop = this.extractCropMention(candidateText);
    if (!candidateCrop) return;

    for (const existing of this.items) {
      const existingText = existing.excerpt.toLowerCase();
      const existingCrop = this.extractCropMention(existingText);

      if (existingCrop === candidateCrop && existing.id !== candidate.id) {
        // Check for conflicting irrigation number statements
        const candIrr = candidateText.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*irrigations/i);
        const existIrr = existingText.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*irrigations/i);

        if (candIrr && existIrr && (candIrr[1] !== existIrr[1] || candIrr[2] !== existIrr[2])) {
          const note = `Noticeable variance in irrigation advice for ${candidateCrop}: Source '${candidate.sourceTitle}' suggests ${candIrr[0]}, whereas '${existing.sourceTitle}' suggests ${existIrr[0]}.`;
          candidate.conflictNotes = candidate.conflictNotes ?? [];
          if (!candidate.conflictNotes.includes(note)) {
            candidate.conflictNotes.push(note);
          }
          existing.conflictNotes = existing.conflictNotes ?? [];
          if (!existing.conflictNotes.includes(note)) {
            existing.conflictNotes.push(note);
          }
        }
      }
    }
  }

  private extractCropMention(text: string): string | undefined {
    const crops = ["wheat", "rice", "paddy", "cotton", "maize", "mustard", "sugarcane", "soybean"];
    for (const c of crops) {
      if (text.includes(c)) return c;
    }
    return undefined;
  }

  /**
   * Retrieves all detected evidence conflicts.
   */
  getConflictingEvidence(): Array<{ topic: string; conflictDescription: string; conflictingEvidenceIds: string[] }> {
    const conflicts: Array<{ topic: string; conflictDescription: string; conflictingEvidenceIds: string[] }> = [];
    const seenNotes = new Set<string>();

    for (const item of this.items) {
      for (const note of item.conflictNotes ?? []) {
        if (!seenNotes.has(note)) {
          seenNotes.add(note);
          const involved = this.items.filter((e) => (e.conflictNotes ?? []).includes(note)).map((e) => e.id);
          conflicts.push({
            topic: "Agronomic guideline variance",
            conflictDescription: note,
            conflictingEvidenceIds: involved,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Validates that all findings in a report have citations and that all citations point to known evidence.
   */
  validateReport(report: Pick<ResearchReport, "findings">): string[] {
    const knownIds = new Set(this.items.map((item) => item.id));
    const errors: string[] = [];

    for (const finding of report.findings) {
      if (!finding.evidenceIds || finding.evidenceIds.length === 0) {
        errors.push(`Finding lacks evidence: ${finding.claim}`);
        continue;
      }
      for (const id of finding.evidenceIds) {
        if (!knownIds.has(id)) {
          errors.push(`Unknown evidence reference: ${id}`);
        }
      }
    }

    return errors;
  }
}
