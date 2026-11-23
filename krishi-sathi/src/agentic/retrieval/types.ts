import { z } from "zod";

export const NormalizedDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceInstitution: z.string(),
  sourceUrl: z.string().url(),
  publishedAt: z.string().optional(),
  lastUpdatedAt: z.string().optional(),
  retrievedAt: z.string().datetime(),
  documentType: z.enum(["HTML", "RESEARCH_PAPER", "EXTENSION_GUIDE", "ADVISORY", "UNSUPPORTED"]),
  language: z.string().default("en"),
  extractedText: z.string(),
  headings: z.array(z.string()).default([]),
  tables: z.array(z.string()).default([]),
  numericalParameters: z.record(z.string(), z.string()).optional(),
  extractionStatus: z.enum(["SUCCESS", "PARTIAL", "UNSUPPORTED_FORMAT", "FAILED"]),
  extractionWarnings: z.array(z.string()).default([]),
  contentHash: z.string(),
});

export type NormalizedDocument = z.infer<typeof NormalizedDocumentSchema>;

export interface AgriculturalSource {
  domain: string;
  institutionName: string;
  category: "NATIONAL_RESEARCH" | "STATE_UNIVERSITY" | "METEOROLOGY" | "INTERNATIONAL" | "GOVERNMENT";
  isApproved: boolean;
  notes?: string;
}

export interface RetrievalOptions {
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
}
