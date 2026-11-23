import { randomUUID } from "crypto";
import {
  FieldProfile,
  FieldProfileSchema,
  CreateFieldProfileInput,
  UpdateFieldProfileInput,
  ApprovedSoilProfile,
  HistoricalSoilTestRecord,
  HistoricalSoilTestRecordSchema,
} from "../contracts/soil/fieldTypes";
import { SoilReportExtraction, SoilReportExtractionSchema } from "../contracts/soil/extractionTypes";
import { ValidationError, NotFoundError, UnauthorizedError, DatabaseError } from "../contracts/errors";
import { SupabaseClient } from "./supabaseClient";

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface ListFieldsOptions extends PaginationOptions {
  includeArchived?: boolean;
}

export interface ISoilRepository {
  createField(input: CreateFieldProfileInput): Promise<FieldProfile>;
  getField(fieldId: string): Promise<FieldProfile | undefined>;
  getFieldOrThrow(fieldId: string): Promise<FieldProfile>;
  listFieldsByFarmer(farmerId: string, options?: ListFieldsOptions): Promise<FieldProfile[]>;
  updateField(fieldId: string, updates: UpdateFieldProfileInput, farmerId: string): Promise<FieldProfile>;
  archiveField(fieldId: string, farmerId: string): Promise<FieldProfile>;

  saveReport(report: SoilReportExtraction): Promise<void>;
  getReport(reportId: string): Promise<SoilReportExtraction | undefined>;
  getReportOrThrow(reportId: string): Promise<SoilReportExtraction>;
  listReportsByField(fieldId: string): Promise<SoilReportExtraction[]>;

  getHistory(fieldId: string, options?: PaginationOptions): Promise<HistoricalSoilTestRecord[]>;
  getHistoricalRecord(recordId: string): Promise<HistoricalSoilTestRecord | undefined>;
  activateApprovedProfile(
    fieldId: string,
    approvedProfile: ApprovedSoilProfile,
    historyRecord: HistoricalSoilTestRecord,
    corrections?: Record<string, unknown>
  ): Promise<void>;

  clear(): Promise<void> | void;
}

// ============================================================================
// 1. In-Memory Soil Repository (Used for local tests or fallback)
// ============================================================================

export class InMemorySoilRepository implements ISoilRepository {
  private readonly fields = new Map<string, FieldProfile>();
  private readonly reports = new Map<string, SoilReportExtraction>();
  private readonly history = new Map<string, HistoricalSoilTestRecord[]>();
  private readonly edits = new Map<string, Array<Record<string, unknown>>>();

  public clear(): void {
    this.fields.clear();
    this.reports.clear();
    this.history.clear();
    this.edits.clear();
  }

  public async createField(input: CreateFieldProfileInput): Promise<FieldProfile> {
    const id = `field_${randomUUID()}`;
    const now = new Date().toISOString();

    const field: FieldProfile = {
      id,
      farmerId: input.farmerId,
      name: input.name,
      areaAcres: input.areaAcres,
      location: input.location,
      primarySoilType: input.primarySoilType,
      primaryTextureClass: input.primaryTextureClass,
      irrigationSource: input.irrigationSource,
      activeSoilProfile: null,
      totalHistoricalSoilTests: 0,
      createdAt: now,
      updatedAt: now,
    };

    const validated = FieldProfileSchema.parse(field);
    this.fields.set(id, validated);
    this.history.set(id, []);
    return validated;
  }

  public async getField(fieldId: string): Promise<FieldProfile | undefined> {
    return this.fields.get(fieldId);
  }

  public async getFieldOrThrow(fieldId: string): Promise<FieldProfile> {
    const field = this.fields.get(fieldId);
    if (!field) {
      throw new NotFoundError(`Field with ID '${fieldId}' was not found.`);
    }
    return field;
  }

  public async listFieldsByFarmer(farmerId: string, options?: ListFieldsOptions): Promise<FieldProfile[]> {
    let list = Array.from(this.fields.values()).filter((f) => f.farmerId === farmerId);
    // If soft-archived fields are present, filter unless requested
    if (!options?.includeArchived) {
      list = list.filter((f) => !(f as unknown as { isArchived?: boolean }).isArchived);
    }
    const offset = options?.offset || 0;
    const limit = options?.limit || list.length;
    return list.slice(offset, offset + limit);
  }

  public async updateField(
    fieldId: string,
    updates: UpdateFieldProfileInput,
    farmerId: string
  ): Promise<FieldProfile> {
    const field = await this.getFieldOrThrow(fieldId);
    if (field.farmerId !== farmerId && farmerId !== "system-admin") {
      throw new UnauthorizedError(`Farmer '${farmerId}' does not own field '${fieldId}'.`);
    }

    if (updates.name !== undefined) field.name = updates.name;
    if (updates.areaAcres !== undefined) field.areaAcres = updates.areaAcres;
    if (updates.location !== undefined) {
      field.location = { ...field.location, ...updates.location } as typeof field.location;
    }
    if (updates.primarySoilType !== undefined) field.primarySoilType = updates.primarySoilType;
    if (updates.primaryTextureClass !== undefined) field.primaryTextureClass = updates.primaryTextureClass;
    if (updates.irrigationSource !== undefined) field.irrigationSource = updates.irrigationSource;

    field.updatedAt = new Date().toISOString();
    const validated = FieldProfileSchema.parse(field);
    this.fields.set(fieldId, validated);
    return validated;
  }

  public async archiveField(fieldId: string, farmerId: string): Promise<FieldProfile> {
    const field = await this.getFieldOrThrow(fieldId);
    if (field.farmerId !== farmerId && farmerId !== "system-admin") {
      throw new UnauthorizedError(`Farmer '${farmerId}' does not own field '${fieldId}'.`);
    }
    (field as unknown as { isArchived: boolean }).isArchived = true;
    field.updatedAt = new Date().toISOString();
    this.fields.set(fieldId, field);
    return field;
  }

  public async saveReport(report: SoilReportExtraction): Promise<void> {
    this.reports.set(report.id, report);
  }

  public async getReport(reportId: string): Promise<SoilReportExtraction | undefined> {
    return this.reports.get(reportId);
  }

  public async getReportOrThrow(reportId: string): Promise<SoilReportExtraction> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new NotFoundError(`Soil report with ID '${reportId}' was not found.`);
    }
    return report;
  }

  public async listReportsByField(fieldId: string): Promise<SoilReportExtraction[]> {
    return Array.from(this.reports.values()).filter((r) => r.fieldId === fieldId);
  }

  public async getHistory(fieldId: string, options?: PaginationOptions): Promise<HistoricalSoilTestRecord[]> {
    const records = this.history.get(fieldId) || [];
    const offset = options?.offset || 0;
    const limit = options?.limit || records.length;
    return records.slice(offset, offset + limit);
  }

  public async getHistoricalRecord(recordId: string): Promise<HistoricalSoilTestRecord | undefined> {
    for (const list of this.history.values()) {
      const found = list.find((r) => r.recordId === recordId);
      if (found) return found;
    }
    return undefined;
  }

  public async activateApprovedProfile(
    fieldId: string,
    approvedProfile: ApprovedSoilProfile,
    historyRecord: HistoricalSoilTestRecord,
    corrections?: Record<string, unknown>
  ): Promise<void> {
    const field = await this.getFieldOrThrow(fieldId);

    // Save corrections if provided
    if (corrections && Object.keys(corrections).length > 0) {
      const reportEdits = this.edits.get(historyRecord.soilTestReportId) || [];
      for (const [key, corr] of Object.entries(corrections)) {
        reportEdits.push({ parameterKey: key, correction: corr, createdAt: new Date().toISOString() });
      }
      this.edits.set(historyRecord.soilTestReportId, reportEdits);
    }

    // 1. Append immutable history record
    const records = this.history.get(fieldId) || [];
    records.push(historyRecord);
    this.history.set(fieldId, records);

    // 2. Update active profile on field
    field.activeSoilProfile = approvedProfile;
    field.totalHistoricalSoilTests = records.length;
    field.updatedAt = new Date().toISOString();

    this.fields.set(fieldId, field);
  }
}

// ============================================================================
// 2. Supabase-Backed Soil Repository (Production Database Implementation)
// ============================================================================

export class SupabaseSoilRepository implements ISoilRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || new SupabaseClient();
  }

  public async clear(): Promise<void> {
    // In production, clear is not supported or used only in local testing environments
  }

  public async createField(input: CreateFieldProfileInput): Promise<FieldProfile> {
    const id = `field_${randomUUID()}`;
    const now = new Date().toISOString();

    const row = {
      id,
      farmer_id: input.farmerId,
      name: input.name,
      area_acres: input.areaAcres,
      location: input.location,
      primary_soil_type: input.primarySoilType,
      primary_texture_class: input.primaryTextureClass,
      irrigation_source: input.irrigationSource,
      active_soil_profile: null,
      active_soil_test_record_id: null,
      total_historical_soil_tests: 0,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    const inserted = await this.client.insert<Record<string, unknown>>("agricultural_fields", row);
    return this.mapFieldRowToProfile(inserted);
  }

  public async getField(fieldId: string): Promise<FieldProfile | undefined> {
    const row = await this.client.selectOne<Record<string, unknown>>("agricultural_fields", {
      id: `eq.${fieldId}`,
    });
    if (!row) return undefined;
    return this.mapFieldRowToProfile(row);
  }

  public async getFieldOrThrow(fieldId: string): Promise<FieldProfile> {
    const field = await this.getField(fieldId);
    if (!field) {
      throw new NotFoundError(`Field with ID '${fieldId}' was not found.`);
    }
    return field;
  }

  public async listFieldsByFarmer(farmerId: string, options?: ListFieldsOptions): Promise<FieldProfile[]> {
    const queryParams: Record<string, string | number | boolean> = {
      farmer_id: `eq.${farmerId}`,
      order: "created_at.desc",
    };
    if (!options?.includeArchived) {
      queryParams["is_archived"] = "eq.false";
    }
    if (options?.limit !== undefined) {
      queryParams["limit"] = options.limit;
    }
    if (options?.offset !== undefined) {
      queryParams["offset"] = options.offset;
    }

    const rows = await this.client.select<Record<string, unknown>>("agricultural_fields", queryParams);
    return rows.map((r) => this.mapFieldRowToProfile(r));
  }

  public async updateField(
    fieldId: string,
    updates: UpdateFieldProfileInput,
    farmerId: string
  ): Promise<FieldProfile> {
    const current = await this.getFieldOrThrow(fieldId);
    if (current.farmerId !== farmerId && farmerId !== "system-admin") {
      throw new UnauthorizedError(`Farmer '${farmerId}' does not own field '${fieldId}'.`);
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.areaAcres !== undefined) patch.area_acres = updates.areaAcres;
    if (updates.location !== undefined) {
      patch.location = { ...current.location, ...updates.location };
    }
    if (updates.primarySoilType !== undefined) patch.primary_soil_type = updates.primarySoilType;
    if (updates.primaryTextureClass !== undefined) patch.primary_texture_class = updates.primaryTextureClass;
    if (updates.irrigationSource !== undefined) patch.irrigation_source = updates.irrigationSource;

    const updatedRows = await this.client.update<Record<string, unknown>>(
      "agricultural_fields",
      { id: `eq.${fieldId}` },
      patch
    );
    if (!updatedRows.length) {
      throw new NotFoundError(`Field with ID '${fieldId}' was not found for update.`);
    }
    return this.mapFieldRowToProfile(updatedRows[0]);
  }

  public async archiveField(fieldId: string, farmerId: string): Promise<FieldProfile> {
    const current = await this.getFieldOrThrow(fieldId);
    if (current.farmerId !== farmerId && farmerId !== "system-admin") {
      throw new UnauthorizedError(`Farmer '${farmerId}' does not own field '${fieldId}'.`);
    }

    const updatedRows = await this.client.update<Record<string, unknown>>(
      "agricultural_fields",
      { id: `eq.${fieldId}` },
      { is_archived: true, updated_at: new Date().toISOString() }
    );
    return this.mapFieldRowToProfile(updatedRows[0]);
  }

  public async saveReport(report: SoilReportExtraction): Promise<void> {
    const existing = await this.getReport(report.id);
    const row = {
      id: report.id,
      field_id: report.fieldId,
      farmer_id: report.farmerId,
      source_file_name: report.sourceFileName,
      file_mime_type: report.fileFormat,
      content_hash: report.contentHash,
      file_format: report.fileFormat,
      file_size_bytes: report.fileSizeBytes || null,
      overall_confidence: report.overallConfidence,
      extraction_status: "COMPLETED",
      approval_status: report.approvalProvenance.status,
      extraction_metadata: {
        candidates: report.candidates,
        labMetadata: report.labMetadata,
        rawExtractedText: report.rawExtractedText,
        globalExtractionWarnings: report.globalExtractionWarnings,
      },
      approval_provenance: report.approvalProvenance,
      approved_parameters: report.approvedParameters || null,
      created_at: report.extractedAt,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.client.update("soil_reports", { id: `eq.${report.id}` }, row);
    } else {
      await this.client.insert("soil_reports", row);
    }
  }

  public async getReport(reportId: string): Promise<SoilReportExtraction | undefined> {
    const row = await this.client.selectOne<Record<string, unknown>>("soil_reports", {
      id: `eq.${reportId}`,
    });
    if (!row) return undefined;
    return this.mapReportRowToExtraction(row);
  }

  public async getReportOrThrow(reportId: string): Promise<SoilReportExtraction> {
    const report = await this.getReport(reportId);
    if (!report) {
      throw new NotFoundError(`Soil report with ID '${reportId}' was not found.`);
    }
    return report;
  }

  public async listReportsByField(fieldId: string): Promise<SoilReportExtraction[]> {
    const rows = await this.client.select<Record<string, unknown>>("soil_reports", {
      field_id: `eq.${fieldId}`,
      order: "created_at.desc",
    });
    return rows.map((r) => this.mapReportRowToExtraction(r));
  }

  public async getHistory(fieldId: string, options?: PaginationOptions): Promise<HistoricalSoilTestRecord[]> {
    const queryParams: Record<string, string | number> = {
      field_id: `eq.${fieldId}`,
      order: "test_date.desc",
    };
    if (options?.limit !== undefined) queryParams["limit"] = options.limit;
    if (options?.offset !== undefined) queryParams["offset"] = options.offset;

    const rows = await this.client.select<Record<string, unknown>>("soil_test_records", queryParams);
    return rows.map((r) => this.mapHistoryRowToRecord(r));
  }

  public async getHistoricalRecord(recordId: string): Promise<HistoricalSoilTestRecord | undefined> {
    const row = await this.client.selectOne<Record<string, unknown>>("soil_test_records", {
      id: `eq.${recordId}`,
    });
    if (!row) return undefined;
    return this.mapHistoryRowToRecord(row);
  }

  /**
   * Transactional approval RPC call in Supabase
   */
  public async activateApprovedProfile(
    fieldId: string,
    approvedProfile: ApprovedSoilProfile,
    historyRecord: HistoricalSoilTestRecord,
    corrections?: Record<string, unknown>
  ): Promise<void> {
    await this.client.rpc("approve_soil_report", {
      p_report_id: historyRecord.soilTestReportId,
      p_farmer_id: approvedProfile.approvalProvenance.reviewedBy || historyRecord.approvalProvenance.reviewedBy,
      p_reviewer_role: approvedProfile.approvalProvenance.reviewerRole || "FARMER",
      p_notes: approvedProfile.approvalProvenance.notes || null,
      p_corrections: corrections || {},
      p_approved_profile: approvedProfile,
      p_historical_record: historyRecord,
    });
  }

  // --- Row Mappers with Zod Validation ---

  private mapFieldRowToProfile(row: Record<string, unknown>): FieldProfile {
    const candidate: FieldProfile = {
      id: String(row.id),
      farmerId: String(row.farmer_id),
      name: String(row.name),
      areaAcres: Number(row.area_acres),
      location: row.location as FieldProfile["location"],
      primarySoilType: (row.primary_soil_type as FieldProfile["primarySoilType"]) || "ALLUVIAL",
      primaryTextureClass: (row.primary_texture_class as FieldProfile["primaryTextureClass"]) || "UNKNOWN",
      irrigationSource: (row.irrigation_source as FieldProfile["irrigationSource"]) || "TUBEWELL",
      activeSoilProfile: (row.active_soil_profile as FieldProfile["activeSoilProfile"]) || null,
      totalHistoricalSoilTests: Number(row.total_historical_soil_tests || 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
    return FieldProfileSchema.parse(candidate);
  }

  private mapReportRowToExtraction(row: Record<string, unknown>): SoilReportExtraction {
    const meta = (row.extraction_metadata || {}) as Record<string, unknown>;
    const candidate: SoilReportExtraction = {
      id: String(row.id),
      fieldId: String(row.field_id),
      farmerId: String(row.farmer_id),
      sourceFileName: String(row.source_file_name),
      fileFormat: String(row.file_format) as SoilReportExtraction["fileFormat"],
      fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : undefined,
      contentHash: String(row.content_hash),
      extractedAt: String(row.created_at),
      overallConfidence: Number(row.overall_confidence),
      globalExtractionWarnings: (meta.globalExtractionWarnings as string[]) || [],
      labMetadata: meta.labMetadata as SoilReportExtraction["labMetadata"],
      candidates: (meta.candidates as SoilReportExtraction["candidates"]) || {},
      rawExtractedText: meta.rawExtractedText as string | undefined,
      approvalProvenance: (row.approval_provenance as SoilReportExtraction["approvalProvenance"]) || {
        status: "PENDING_APPROVAL",
        reviewerRole: "FARMER",
        editedFields: [],
      },
      approvedParameters: (row.approved_parameters as SoilReportExtraction["approvedParameters"]) || undefined,
    };
    return SoilReportExtractionSchema.parse(candidate);
  }

  private mapHistoryRowToRecord(row: Record<string, unknown>): HistoricalSoilTestRecord {
    const candidate: HistoricalSoilTestRecord = {
      recordId: String(row.id),
      fieldId: String(row.field_id),
      soilTestReportId: String(row.report_id),
      testDate: String(row.test_date),
      recordedAt: String(row.recorded_at || row.created_at),
      parameters: row.parameters as HistoricalSoilTestRecord["parameters"],
      labMetadata: row.lab_metadata as HistoricalSoilTestRecord["labMetadata"],
      approvalProvenance: row.approval_provenance as HistoricalSoilTestRecord["approvalProvenance"],
      isImmutable: true,
    };
    return HistoricalSoilTestRecordSchema.parse(candidate);
  }
}

// ============================================================================
// 3. SoilRepository Singleton Facade
// ============================================================================

export class SoilRepository implements ISoilRepository {
  private static instance: ISoilRepository;

  public static getInstance(): ISoilRepository {
    if (!SoilRepository.instance) {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        SoilRepository.instance = new SupabaseSoilRepository();
      } else {
        SoilRepository.instance = new InMemorySoilRepository();
      }
    }
    return SoilRepository.instance;
  }

  public static setInstance(repo: ISoilRepository): void {
    SoilRepository.instance = repo;
  }

  public static resetInstance(): void {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      SoilRepository.instance = new SupabaseSoilRepository();
    } else {
      SoilRepository.instance = new InMemorySoilRepository();
    }
  }

  // Delegated ISoilRepository calls
  public createField(input: CreateFieldProfileInput): Promise<FieldProfile> {
    return SoilRepository.getInstance().createField(input);
  }

  public getField(fieldId: string): Promise<FieldProfile | undefined> {
    return SoilRepository.getInstance().getField(fieldId);
  }

  public getFieldOrThrow(fieldId: string): Promise<FieldProfile> {
    return SoilRepository.getInstance().getFieldOrThrow(fieldId);
  }

  public listFieldsByFarmer(farmerId: string, options?: ListFieldsOptions): Promise<FieldProfile[]> {
    return SoilRepository.getInstance().listFieldsByFarmer(farmerId, options);
  }

  public updateField(fieldId: string, updates: UpdateFieldProfileInput, farmerId: string): Promise<FieldProfile> {
    return SoilRepository.getInstance().updateField(fieldId, updates, farmerId);
  }

  public archiveField(fieldId: string, farmerId: string): Promise<FieldProfile> {
    return SoilRepository.getInstance().archiveField(fieldId, farmerId);
  }

  public saveReport(report: SoilReportExtraction): Promise<void> {
    return SoilRepository.getInstance().saveReport(report);
  }

  public getReport(reportId: string): Promise<SoilReportExtraction | undefined> {
    return SoilRepository.getInstance().getReport(reportId);
  }

  public getReportOrThrow(reportId: string): Promise<SoilReportExtraction> {
    return SoilRepository.getInstance().getReportOrThrow(reportId);
  }

  public listReportsByField(fieldId: string): Promise<SoilReportExtraction[]> {
    return SoilRepository.getInstance().listReportsByField(fieldId);
  }

  public getHistory(fieldId: string, options?: PaginationOptions): Promise<HistoricalSoilTestRecord[]> {
    return SoilRepository.getInstance().getHistory(fieldId, options);
  }

  public getHistoricalRecord(recordId: string): Promise<HistoricalSoilTestRecord | undefined> {
    return SoilRepository.getInstance().getHistoricalRecord(recordId);
  }

  public activateApprovedProfile(
    fieldId: string,
    approvedProfile: ApprovedSoilProfile,
    historyRecord: HistoricalSoilTestRecord,
    corrections?: Record<string, unknown>
  ): Promise<void> {
    return SoilRepository.getInstance().activateApprovedProfile(fieldId, approvedProfile, historyRecord, corrections);
  }

  public clear(): Promise<void> | void {
    return SoilRepository.getInstance().clear();
  }
}
