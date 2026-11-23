import { Router, Request, Response } from "express";
import { SoilRepository } from "../../agentic/soil/soilRepository";
import { FileValidator } from "../../agentic/soil/fileValidator";
import { SoilReportExtractor } from "../../agentic/soil/soilReportExtractor";
import { FarmerApprovalService } from "../../agentic/soil/farmerApprovalService";
import { SoilNutrientEngine } from "../../agentic/engines/soilNutrientEngine";
import {
  CreateFieldProfileInputSchema,
  UpdateFieldProfileInputSchema,
} from "../../agentic/contracts/soil/fieldTypes";
import { ReviewSoilReportInputSchema } from "../../agentic/contracts/soil/extractionTypes";
import { createDefaultModelProvider } from "../../agentic/providers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  DatabaseError,
} from "../../agentic/contracts/errors";

export const soilRouter = Router();

const repository = SoilRepository.getInstance();
const approvalService = new FarmerApprovalService();
const nutrientEngine = new SoilNutrientEngine();

// Helper to authenticate / extract farmer identity from headers or query
function getFarmerId(req: Request): string {
  const headerId = req.headers["x-farmer-id"] as string | undefined;
  const queryId = req.query.farmerId as string | undefined;
  const bodyId = req.body?.farmerId as string | undefined;
  return headerId || queryId || bodyId || "default-farmer";
}

// Helper to sanitize route parameter
function getParamId(req: Request, paramName = "id"): string {
  const val = req.params[paramName];
  return Array.isArray(val) ? val[0] : val;
}

// ============================================================================
// 1. Multi-Field Management Endpoints
// ============================================================================

soilRouter.post("/fields", async (req: Request, res: Response) => {
  try {
    const farmerId = getFarmerId(req);
    const candidate = {
      ...req.body,
      farmerId: req.body.farmerId || farmerId,
    };

    const parsed = CreateFieldProfileInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        issues: parsed.error.issues,
      });
    }

    const field = await repository.createField(parsed.data);
    return res.status(201).json(field);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

soilRouter.get("/fields", async (req: Request, res: Response) => {
  try {
    const farmerId = getFarmerId(req);
    const includeArchived = req.query.includeArchived === "true";
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const fields = await repository.listFieldsByFarmer(farmerId, {
      includeArchived,
      limit,
      offset,
    });
    return res.json({ fields, count: fields.length, offset: offset || 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

soilRouter.get("/fields/:id", async (req: Request, res: Response) => {
  try {
    const fieldId = getParamId(req);
    const field = await repository.getField(fieldId);
    if (!field) {
      return res.status(404).json({ error: "NOT_FOUND", message: `Field '${fieldId}' was not found.` });
    }
    return res.json(field);
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NOT_FOUND", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

soilRouter.patch("/fields/:id", async (req: Request, res: Response) => {
  try {
    const fieldId = getParamId(req);
    const farmerId = getFarmerId(req);

    const parsed = UpdateFieldProfileInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        issues: parsed.error.issues,
      });
    }

    const updated = await repository.updateField(fieldId, parsed.data, farmerId);
    return res.json(updated);
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NOT_FOUND", message: err.message });
    }
    if (err instanceof UnauthorizedError) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: err.message });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

soilRouter.patch("/fields/:id/archive", async (req: Request, res: Response) => {
  try {
    const fieldId = getParamId(req);
    const farmerId = getFarmerId(req);

    const archived = await repository.archiveField(fieldId, farmerId);
    return res.json({ message: "Field archived successfully.", field: archived });
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NOT_FOUND", message: err.message });
    }
    if (err instanceof UnauthorizedError) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

soilRouter.get("/fields/:id/history", async (req: Request, res: Response) => {
  try {
    const fieldId = getParamId(req);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const history = await repository.getHistory(fieldId, { limit, offset });
    return res.json({ fieldId, count: history.length, offset: offset || 0, historicalRecords: history });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

// ============================================================================
// 2. Soil Report Upload & Extraction Endpoint
// ============================================================================

soilRouter.post("/fields/:id/soil-reports/upload", async (req: Request, res: Response) => {
  try {
    const fieldId = getParamId(req);
    const field = await repository.getField(fieldId);
    if (!field) {
      return res.status(404).json({ error: "NOT_FOUND", message: `Field '${fieldId}' was not found.` });
    }

    const farmerId = getFarmerId(req);
    if (field.farmerId !== farmerId && farmerId !== "system-admin") {
      return res.status(403).json({ error: "UNAUTHORIZED", message: "You do not own this field." });
    }

    const { fileName, fileBase64, mimeType } = req.body;
    if (!fileName || !fileBase64) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Missing 'fileName' or 'fileBase64' in upload payload.",
      });
    }

    const fileBuffer = Buffer.from(fileBase64, "base64");

    // File validation: checks magic signatures, size, path traversal
    const validatedFile = FileValidator.validate(fileBuffer, fileName, mimeType);

    // Extraction: routes digital text or vision extraction
    const extraction = await SoilReportExtractor.extract(validatedFile, {
      fieldId,
      farmerId,
      modelProvider: createDefaultModelProvider(),
    });

    // Save report in repository in PENDING_APPROVAL status
    await repository.saveReport(extraction);

    return res.status(202).json({
      message: "Soil report extracted successfully. Awaiting explicit farmer review and approval.",
      reportId: extraction.id,
      status: extraction.approvalProvenance.status,
      overallConfidence: extraction.overallConfidence,
      extractedCandidatesCount: Object.keys(extraction.candidates).length,
      warnings: extraction.globalExtractionWarnings,
      extraction,
    });
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

// ============================================================================
// 3. Farmer Review & Approval Endpoints
// ============================================================================

soilRouter.get("/soil-reports/:id/review", async (req: Request, res: Response) => {
  try {
    const farmerId = getFarmerId(req);
    const reportId = getParamId(req);
    const report = await approvalService.getReviewPayload(reportId, farmerId);
    return res.json(report);
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NOT_FOUND", message: err.message });
    }
    if (err instanceof UnauthorizedError) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

soilRouter.get("/soil-reports/:id/status", async (req: Request, res: Response) => {
  try {
    const reportId = getParamId(req);
    const report = await repository.getReport(reportId);
    if (!report) {
      return res.status(404).json({ error: "NOT_FOUND", message: `Report '${reportId}' not found.` });
    }
    return res.json({
      reportId: report.id,
      fieldId: report.fieldId,
      status: report.approvalProvenance.status,
      reviewedAt: report.approvalProvenance.reviewedAt,
      reviewedBy: report.approvalProvenance.reviewedBy,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

soilRouter.post("/soil-reports/:id/approve", async (req: Request, res: Response) => {
  try {
    const farmerId = getFarmerId(req);
    const reportId = getParamId(req);
    const inputCandidate = {
      reportId,
      action: "APPROVE",
      reviewerId: req.body?.reviewerId || farmerId,
      reviewerRole: req.body?.reviewerRole || "FARMER",
      corrections: req.body?.corrections,
      notes: req.body?.notes,
    };

    const parsed = ReviewSoilReportInputSchema.safeParse(inputCandidate);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    const result = await approvalService.approve(parsed.data, farmerId);
    return res.json({
      message: "Soil report successfully approved and active field profile updated.",
      approvedProfile: result.approvedProfile,
      historicalRecord: result.historicalRecord,
      reportStatus: result.updatedReport.approvalProvenance.status,
    });
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NOT_FOUND", message: err.message });
    }
    if (err instanceof UnauthorizedError) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: err.message });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: err.message });
    }
    if (err instanceof DatabaseError) {
      return res.status(500).json({ error: "DATABASE_ERROR", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

soilRouter.post("/soil-reports/:id/reject", async (req: Request, res: Response) => {
  try {
    const farmerId = getFarmerId(req);
    const reportId = getParamId(req);
    const reason = req.body?.rejectionReason || "Farmer rejected extracted data due to discrepancy.";
    const notes = req.body?.notes;

    const updated = await approvalService.reject(reportId, farmerId, reason, notes);
    return res.json({
      message: "Soil report marked REJECTED. Active field profile was unchanged.",
      reportId: updated.id,
      status: updated.approvalProvenance.status,
      rejectionReason: reason,
    });
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NOT_FOUND", message: err.message });
    }
    if (err instanceof UnauthorizedError) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: err.message });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});

// ============================================================================
// 4. Recommendation Endpoint using Active Approved Profile
// ============================================================================

soilRouter.post("/fields/:id/recommendations/nutrient", async (req: Request, res: Response) => {
  try {
    const fieldId = getParamId(req);
    const field = await repository.getFieldOrThrow(fieldId);
    if (!field.activeSoilProfile) {
      return res.status(400).json({
        error: "NO_ACTIVE_SOIL_PROFILE",
        message: "Field does not have an approved active soil profile. Upload and approve a soil test report first.",
      });
    }

    const { cropName, cropVariety, targetYieldQuintalsPerHa, croppingSeason, organicManureTonnesPerHa } = req.body;
    if (!cropName || !targetYieldQuintalsPerHa) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Missing 'cropName' or 'targetYieldQuintalsPerHa'.",
      });
    }

    const recommendation = nutrientEngine.calculate({
      fieldId: field.id,
      cropName,
      cropVariety,
      targetYieldQuintalsPerHa,
      croppingSeason: croppingSeason || "RABI",
      isIrrigated: true,
      organicManureTonnesPerHa: organicManureTonnesPerHa || 0,
      greenManuringDone: req.body?.greenManuringDone || false,
      previousCropLegume: req.body?.previousCropLegume || false,
      soilParameters: field.activeSoilProfile.parameters,
    });

    return res.json(recommendation);
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NOT_FOUND", message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message });
  }
});
