import { ResearchReport } from "../contracts/types";
import { ResearchReportSchema } from "../contracts/schemas";
import { EvidenceManager } from "../evidence/evidenceManager";

export interface ReportValidationResult {
  isValid: boolean;
  errors: string[];
  report?: ResearchReport;
}

export class ReportValidator {
  /**
   * Strictly validates report schema, factual evidence citations, assumptions, and limitations.
   */
  static validate(
    rawReport: unknown,
    evidenceManager: EvidenceManager
  ): ReportValidationResult {
    const errors: string[] = [];

    // 1. Zod schema validation
    const parsed = ResearchReportSchema.safeParse(rawReport);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`Schema violation at '${issue.path.join(".")}': ${issue.message}`);
      }
      return { isValid: false, errors };
    }

    const report = parsed.data;

    // 2. Summary check
    if (!report.summary || report.summary.trim().length < 10) {
      errors.push("Report summary must be at least 10 characters.");
    }

    // 3. Findings check
    if (!report.findings || report.findings.length === 0) {
      errors.push("Report contains no findings. At least one factual finding is required.");
    }

    // 4. Citation and provenance validation
    const registeredIds = new Set(evidenceManager.list().map((e) => e.id));

    for (const [index, finding] of (report.findings ?? []).entries()) {
      if (!finding.claim || finding.claim.trim().length === 0) {
        errors.push(`Finding at index ${index} has an empty claim.`);
        continue;
      }

      if (!finding.evidenceIds || finding.evidenceIds.length === 0) {
        errors.push(`Finding lacks evidence citation: "${finding.claim}"`);
        continue;
      }

      for (const citedId of finding.evidenceIds) {
        if (!registeredIds.has(citedId)) {
          errors.push(
            `Finding "${finding.claim}" cites unknown evidence ID '${citedId}'. Fabricated or unregistered citations are strictly forbidden.`
          );
        }
      }
    }

    // 5. Deterministic calculation and conflict citation checks
    for (const calc of report.deterministicCalculations ?? []) {
      if (calc.evidenceId && !registeredIds.has(calc.evidenceId)) {
        errors.push(
          `Deterministic calculation '${calc.calculation}' references unknown evidence ID '${calc.evidenceId}'.`
        );
      }
    }

    for (const conflict of report.conflictingEvidence ?? []) {
      for (const id of conflict.conflictingEvidenceIds ?? []) {
        if (!registeredIds.has(id)) {
          errors.push(
            `Conflicting evidence for '${conflict.topic}' references unknown evidence ID '${id}'.`
          );
        }
      }
    }

    // 6. Explicit assumptions and limitations
    if (!Array.isArray(report.assumptions)) {
      errors.push("Report must explicitly declare an assumptions list.");
    }

    if (!Array.isArray(report.limitations)) {
      errors.push("Report must explicitly declare a limitations list.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      report: errors.length === 0 ? report : undefined,
    };
  }
}

/**
 * Backward compatibility function for starter signature:
 * validateReport(report: ResearchReport, evidence: EvidenceManager): string[]
 */
export function validateReport(
  report: ResearchReport,
  evidence: EvidenceManager
): string[] {
  const result = ReportValidator.validate(report, evidence);
  return result.errors;
}
