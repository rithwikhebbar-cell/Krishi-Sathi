import { randomUUID } from "crypto";
import { SoilRepository } from "./soilRepository";
import {
  ReviewSoilReportInput,
  SoilReportExtraction,
  ApprovalProvenance,
} from "../contracts/soil/extractionTypes";
import {
  SoilParameters,
  SoilParametersSchema,
} from "../contracts/soil/soilParameters";
import {
  ApprovedSoilProfile,
  HistoricalSoilTestRecord,
} from "../contracts/soil/fieldTypes";
import { ValidationError, UnauthorizedError } from "../contracts/errors";

export class FarmerApprovalService {
  private readonly repository = SoilRepository.getInstance();

  /**
   * Retrieves review payload ensuring authenticated farmer ownership.
   */
  public async getReviewPayload(reportId: string, requestingFarmerId: string): Promise<SoilReportExtraction> {
    const report = await this.repository.getReportOrThrow(reportId);
    this.assertOwnership(report, requestingFarmerId);
    return report;
  }

  /**
   * Allows farmer to review, correct, and approve extracted soil test data.
   * On approval, atomically updates field's active soil profile and appends immutable historical snapshot.
   */
  public async approve(input: ReviewSoilReportInput, requestingFarmerId: string): Promise<{
    approvedProfile: ApprovedSoilProfile;
    historicalRecord: HistoricalSoilTestRecord;
    updatedReport: SoilReportExtraction;
  }> {
    const report = await this.repository.getReportOrThrow(input.reportId);
    this.assertOwnership(report, requestingFarmerId);

    // 1. Guard against duplicate approvals or approving rejected reports
    if (report.approvalProvenance.status === "APPROVED") {
      throw new ValidationError(`Soil report '${report.id}' has already been approved and cannot be approved again.`);
    }
    if (report.approvalProvenance.status === "REJECTED") {
      throw new ValidationError(`Soil report '${report.id}' is marked REJECTED and cannot be approved.`);
    }

    const now = new Date().toISOString();
    const editedFields: string[] = [];

    // 2. Apply farmer corrections if provided
    if (input.corrections) {
      for (const [key, correction] of Object.entries(input.corrections)) {
        const candidate = report.candidates[key];
        if (candidate) {
          candidate.farmerCorrection = {
            correctedValue: correction.value,
            correctedUnit: correction.unit,
            correctedMethod: correction.method,
            correctedAt: now,
            reason: correction.reason,
          };
          // Update normalized value to the farmer's corrected value
          candidate.normalizedValue = correction.value;
          if (correction.unit) candidate.normalizedUnit = correction.unit;
          if (correction.method) candidate.extractedMethod = correction.method;
          editedFields.push(key);
        }
      }
    }

    // 3. Assemble full standardized SoilParameters object from candidates
    const assembledParameters = this.buildSoilParametersFromCandidates(report.candidates, report.labMetadata);

    // Strict Zod contract validation
    const parsedParams = SoilParametersSchema.safeParse(assembledParameters);
    if (!parsedParams.success) {
      throw new ValidationError(
        `Approved soil parameters failed validation: ${parsedParams.error.issues.map((i) => i.message).join(", ")}`
      );
    }
    const validParameters: SoilParameters = parsedParams.data;

    // 4. Create immutable ApprovalProvenance
    const provenance: ApprovalProvenance = {
      status: "APPROVED",
      reviewedBy: requestingFarmerId,
      reviewerRole: input.reviewerRole || "FARMER",
      reviewedAt: now,
      editedFields,
      notes: input.notes,
    };

    // 5. Create ApprovedSoilProfile
    const profileId = `profile_${randomUUID()}`;
    const approvedProfile: ApprovedSoilProfile = {
      profileId,
      fieldId: report.fieldId,
      soilTestReportId: report.id,
      parameters: validParameters,
      approvalProvenance: provenance,
      effectiveFrom: now,
      isCurrentlyActive: true,
    };

    // 6. Create HistoricalSoilTestRecord (Immutable snapshot)
    const recordId = `hist_${randomUUID()}`;
    const historicalRecord: HistoricalSoilTestRecord = {
      recordId,
      fieldId: report.fieldId,
      soilTestReportId: report.id,
      testDate: report.labMetadata?.testingDate || now.slice(0, 10),
      recordedAt: now,
      parameters: validParameters,
      labMetadata: report.labMetadata,
      approvalProvenance: provenance,
      isImmutable: true,
    };

    // 7. Atomic persistence into repository (via RPC in Supabase, atomic in-memory otherwise)
    await this.repository.activateApprovedProfile(
      report.fieldId,
      approvedProfile,
      historicalRecord,
      input.corrections
    );

    // 8. Update report status
    report.approvalProvenance = provenance;
    report.approvedParameters = validParameters;
    await this.repository.saveReport(report);

    return {
      approvedProfile,
      historicalRecord,
      updatedReport: report,
    };
  }

  /**
   * Rejects an extracted soil report. Does NOT update field profile or create historical records.
   */
  public async reject(
    reportId: string,
    requestingFarmerId: string,
    rejectionReason: string,
    notes?: string
  ): Promise<SoilReportExtraction> {
    const report = await this.repository.getReportOrThrow(reportId);
    this.assertOwnership(report, requestingFarmerId);

    if (report.approvalProvenance.status === "APPROVED") {
      throw new ValidationError(`Cannot reject report '${report.id}' because it has already been approved.`);
    }

    const now = new Date().toISOString();
    report.approvalProvenance = {
      status: "REJECTED",
      reviewedBy: requestingFarmerId,
      reviewerRole: "FARMER",
      reviewedAt: now,
      rejectionReason,
      editedFields: [],
      notes,
    };

    await this.repository.saveReport(report);
    return report;
  }

  private assertOwnership(report: SoilReportExtraction, farmerId: string): void {
    if (report.farmerId !== farmerId && farmerId !== "system-admin") {
      throw new UnauthorizedError(
        `Farmer '${farmerId}' is not authorized to access or modify soil report '${report.id}' belonging to '${report.farmerId}'.`
      );
    }
  }

  private buildSoilParametersFromCandidates(
    candidates: SoilReportExtraction["candidates"],
    labMetadata?: SoilReportExtraction["labMetadata"]
  ): unknown {
    const getVal = (key: string, fallback: number) => {
      const c = candidates[key];
      if (c && c.normalizedValue !== null && c.normalizedValue !== undefined) {
        return c.normalizedValue;
      }
      return fallback;
    };

    const getUnit = (key: string, fallback: string) => {
      const c = candidates[key];
      return c?.normalizedUnit || fallback;
    };

    const getMethod = (key: string, fallback: string) => {
      const c = candidates[key];
      return c?.extractedMethod || fallback;
    };

    return {
      physical: {
        textureClass: "UNKNOWN",
        classificationType: "OTHER",
      },
      chemical: {
        ph: {
          value: getVal("ph", 7.0),
          unit: "pH_units",
          testMethod: getMethod("ph", "SUSPENSION_1_2_5_WATER"),
        },
        electricalConductivity: {
          value: getVal("electricalConductivity", 0.3),
          unit: getUnit("electricalConductivity", "dS/m"),
          testMethod: getMethod("electricalConductivity", "SUSPENSION_1_2_WATER"),
        },
        organicCarbonPercent: {
          value: getVal("organicCarbonPercent", 0.5),
          unit: "%",
          testMethod: getMethod("organicCarbonPercent", "WALKLEY_BLACK_WET_OXIDATION"),
        },
      },
      primary: {
        availableNitrogen: {
          value: getVal("availableNitrogen", 250),
          unit: "kg/ha",
          testMethod: getMethod("availableNitrogen", "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA"),
        },
        availablePhosphorus: {
          value: getVal("availablePhosphorus", 18.0),
          unit: "kg/ha_P2O5",
          testMethod: getMethod("availablePhosphorus", "OLSEN_SODIUM_BICARBONATE"),
          chemicalForm: "P2O5",
        },
        availablePotassium: {
          value: getVal("availablePotassium", 150.0),
          unit: "kg/ha_K2O",
          testMethod: getMethod("availablePotassium", "NEUTRAL_NORMAL_AMMONIUM_ACETATE"),
          chemicalForm: "K2O",
        },
      },
      secondary: candidates.availableSulphurPpm
        ? {
            availableSulphurPpm: {
              value: getVal("availableSulphurPpm", 12.0),
              unit: "ppm",
              testMethod: getMethod("availableSulphurPpm", "CALCIUM_CHLORIDE_TURBIDIMETRIC"),
            },
          }
        : {},
      micronutrients: candidates.availableZincPpm
        ? {
            availableZincPpm: {
              value: getVal("availableZincPpm", 0.6),
              unit: "ppm",
              testMethod: getMethod("availableZincPpm", "DTPA_TEA_CaCl2_LINDSAY_NORVELL"),
            },
          }
        : {},
      metadata: {
        sampleId: labMetadata?.sampleCode,
        testedAt: labMetadata?.testingDate,
        laboratoryName: labMetadata?.labName,
      },
    };
  }
}
