import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseClient } from "../../src/agentic/soil/supabaseClient";
import { SupabaseSoilRepository } from "../../src/agentic/soil/soilRepository";
import { CreateFieldProfileInput } from "../../src/agentic/contracts/soil/fieldTypes";
import { DatabaseError, NotFoundError, UnauthorizedError, ValidationError } from "../../src/agentic/contracts/errors";

describe("SupabaseSoilRepository & Database Integration (M1.3 Phase 4)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: SupabaseClient;
  let repository: SupabaseSoilRepository;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new SupabaseClient({
      supabaseUrl: "https://test-project.supabase.co",
      supabaseKey: "service-role-test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    repository = new SupabaseSoilRepository(client);
  });

  const sampleFieldInput: CreateFieldProfileInput = {
    farmerId: "farmer-101",
    name: "North Vineyard",
    areaAcres: 4.5,
    location: {
      state: "Maharashtra",
      district: "Nashik",
      village: "Dindori",
    },
    primarySoilType: "BLACK_REGUR",
    primaryTextureClass: "CLAY_LOAM",
    irrigationSource: "DRIP_IRRIGATION",
  };

  it("persists a newly created agricultural field and retrieves it", async () => {
    const mockCreatedRow = {
      id: "field_12345",
      farmer_id: "farmer-101",
      name: "North Vineyard",
      area_acres: 4.5,
      location: sampleFieldInput.location,
      primary_soil_type: "BLACK_REGUR",
      primary_texture_class: "CLAY_LOAM",
      irrigation_source: "DRIP_IRRIGATION",
      active_soil_profile: null,
      active_soil_test_record_id: null,
      total_historical_soil_tests: 0,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => [mockCreatedRow],
    });

    const result = await repository.createField(sampleFieldInput);

    expect(result.id).toBe("field_12345");
    expect(result.farmerId).toBe("farmer-101");
    expect(result.name).toBe("North Vineyard");
    expect(result.areaAcres).toBe(4.5);
    expect(result.activeSoilProfile).toBeNull();
    expect(result.totalHistoricalSoilTests).toBe(0);

    // Verify correct PostgREST URL and headers were used
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test-project.supabase.co/rest/v1/agricultural_fields",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "service-role-test-key",
          Prefer: "return=representation",
        }),
      })
    );
  });

  it("lists multiple fields belonging to a farmer and excludes archived fields by default", async () => {
    const mockFields = [
      {
        id: "field_1",
        farmer_id: "farmer-101",
        name: "Plot 1",
        area_acres: 2.0,
        location: { state: "Punjab", district: "Bathinda" },
        primary_soil_type: "ALLUVIAL",
        primary_texture_class: "LOAM",
        irrigation_source: "TUBEWELL",
        active_soil_profile: null,
        total_historical_soil_tests: 0,
        is_archived: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "field_2",
        farmer_id: "farmer-101",
        name: "Plot 2",
        area_acres: 3.5,
        location: { state: "Punjab", district: "Bathinda" },
        primary_soil_type: "ALLUVIAL",
        primary_texture_class: "LOAM",
        irrigation_source: "TUBEWELL",
        active_soil_profile: null,
        total_historical_soil_tests: 1,
        is_archived: false,
        created_at: "2026-01-02T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockFields,
    });

    const fields = await repository.listFieldsByFarmer("farmer-101");
    expect(fields.length).toBe(2);
    expect(fields[0].name).toBe("Plot 1");
    expect(fields[1].name).toBe("Plot 2");

    // Verify PostgREST query param included is_archived=eq.false
    const requestedUrl = mockFetch.mock.calls[0][0];
    expect(requestedUrl).toContain("farmer_id=eq.farmer-101");
    expect(requestedUrl).toContain("is_archived=eq.false");
  });

  it("archives an agricultural field safely and updates is_archived flag", async () => {
    // 1. First call: getFieldOrThrow
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "field_archive_target",
          farmer_id: "farmer-101",
          name: "Old Meadow",
          area_acres: 5.0,
          location: { state: "Punjab", district: "Ludhiana" },
          primary_soil_type: "ALLUVIAL",
          primary_texture_class: "LOAM",
          irrigation_source: "TUBEWELL",
          active_soil_profile: null,
          total_historical_soil_tests: 0,
          is_archived: false,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    // 2. Second call: update field patch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "field_archive_target",
          farmer_id: "farmer-101",
          name: "Old Meadow",
          area_acres: 5.0,
          location: { state: "Punjab", district: "Ludhiana" },
          primary_soil_type: "ALLUVIAL",
          primary_texture_class: "LOAM",
          irrigation_source: "TUBEWELL",
          active_soil_profile: null,
          total_historical_soil_tests: 0,
          is_archived: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-05T00:00:00Z",
        },
      ],
    });

    const result = await repository.archiveField("field_archive_target", "farmer-101");
    expect(result.id).toBe("field_archive_target");

    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.stringContaining("id=eq.field_archive_target"),
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"is_archived":true'),
      })
    );
  });

  it("prevents an unauthorized farmer from updating or archiving another farmer's field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "field_owner_only",
          farmer_id: "farmer-alice",
          name: "Alice Field",
          area_acres: 3.0,
          location: { state: "Punjab", district: "Ludhiana" },
          primary_soil_type: "ALLUVIAL",
          primary_texture_class: "LOAM",
          irrigation_source: "TUBEWELL",
          active_soil_profile: null,
          total_historical_soil_tests: 0,
          is_archived: false,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    // Farmer Bob attempts to update Farmer Alice's field
    await expect(
      repository.updateField("field_owner_only", { name: "Bob Hijack" }, "farmer-bob")
    ).rejects.toThrow(UnauthorizedError);
  });

  it("calls the atomic approval RPC function with all parameters and handles successful execution", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        reportId: "report_99",
        fieldId: "field_77",
        status: "APPROVED",
      }),
    });

    const approvedProfile = {
      profileId: "profile_1",
      fieldId: "field_77",
      soilTestReportId: "report_99",
      parameters: {
        physical: { textureClass: "UNKNOWN", classificationType: "OTHER" },
        chemical: {
          ph: { value: 7.2, unit: "pH_units", testMethod: "SUSPENSION_1_2_5_WATER" },
          electricalConductivity: { value: 0.3, unit: "dS/m", testMethod: "SUSPENSION_1_2_WATER" },
          organicCarbonPercent: { value: 0.5, unit: "%", testMethod: "WALKLEY_BLACK_WET_OXIDATION" },
        },
        primary: {
          availableNitrogen: { value: 250, unit: "kg/ha", testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA" },
          availablePhosphorus: { value: 18.0, unit: "kg/ha_P2O5", testMethod: "OLSEN_SODIUM_BICARBONATE", chemicalForm: "P2O5" },
          availablePotassium: { value: 150.0, unit: "kg/ha_K2O", testMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE", chemicalForm: "K2O" },
        },
        secondary: {},
        micronutrients: {},
      },
      approvalProvenance: {
        status: "APPROVED" as const,
        reviewedBy: "farmer-101",
        reviewerRole: "FARMER" as const,
        reviewedAt: "2026-01-01T10:00:00Z",
        editedFields: ["ph"],
      },
      effectiveFrom: "2026-01-01T10:00:00Z",
      isCurrentlyActive: true,
    };

    const historyRecord = {
      recordId: "hist_1",
      fieldId: "field_77",
      soilTestReportId: "report_99",
      testDate: "2026-01-01",
      recordedAt: "2026-01-01T10:00:00Z",
      parameters: approvedProfile.parameters,
      approvalProvenance: approvedProfile.approvalProvenance,
      isImmutable: true as const,
    };

    await repository.activateApprovedProfile("field_77", approvedProfile, historyRecord, {
      ph: { value: 7.2, reason: "Manual calibration check" },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test-project.supabase.co/rest/v1/rpc/approve_soil_report",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"p_report_id":"report_99"'),
      })
    );
  });

  it("translates RPC transaction failures into domain ValidationError when report is already approved", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        message: "Soil report report_99 has already been approved and cannot be approved again.",
      }),
    });

    const approvedProfile = {
      profileId: "profile_1",
      fieldId: "field_77",
      soilTestReportId: "report_99",
      parameters: {} as unknown as any,
      approvalProvenance: {
        status: "APPROVED" as const,
        reviewedBy: "farmer-101",
        reviewerRole: "FARMER" as const,
        editedFields: [],
      },
      effectiveFrom: "2026-01-01T10:00:00Z",
      isCurrentlyActive: true,
    };

    const historyRecord = {
      recordId: "hist_1",
      fieldId: "field_77",
      soilTestReportId: "report_99",
      testDate: "2026-01-01",
      recordedAt: "2026-01-01T10:00:00Z",
      parameters: approvedProfile.parameters,
      approvalProvenance: approvedProfile.approvalProvenance,
      isImmutable: true as const,
    };

    await expect(
      repository.activateApprovedProfile("field_77", approvedProfile, historyRecord)
    ).rejects.toThrow(ValidationError);
  });

  it("handles connection failure and network errors gracefully without leaking stack internals", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection ECONNREFUSED to supabase.co"));

    await expect(repository.getField("field_net_err")).rejects.toThrow(DatabaseError);
  });

  it("retrieves historical soil test records with pagination parameters", async () => {
    const mockHistoryRow = {
      id: "hist_rec_01",
      field_id: "field_88",
      farmer_id: "farmer-101",
      report_id: "report_88",
      sample_code: "SAMPLE-99",
      test_date: "2026-01-01",
      recorded_at: "2026-01-01T12:00:00Z",
      parameters: {
        physical: { textureClass: "UNKNOWN", classificationType: "OTHER" },
        chemical: {
          ph: { value: 7.0, unit: "pH_units", testMethod: "SUSPENSION_1_2_5_WATER" },
          electricalConductivity: { value: 0.3, unit: "dS/m", testMethod: "SUSPENSION_1_2_WATER" },
          organicCarbonPercent: { value: 0.5, unit: "%", testMethod: "WALKLEY_BLACK_WET_OXIDATION" },
        },
        primary: {
          availableNitrogen: { value: 250, unit: "kg/ha", testMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA" },
          availablePhosphorus: { value: 18.0, unit: "kg/ha_P2O5", testMethod: "OLSEN_SODIUM_BICARBONATE", chemicalForm: "P2O5" },
          availablePotassium: { value: 150.0, unit: "kg/ha_K2O", testMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE", chemicalForm: "K2O" },
        },
        secondary: {},
        micronutrients: {},
      },
      lab_metadata: { sampleCode: "SAMPLE-99" },
      approval_provenance: {
        status: "APPROVED",
        reviewedBy: "farmer-101",
        reviewerRole: "FARMER",
        editedFields: [],
      },
      is_immutable: true,
      created_at: "2026-01-01T12:00:00Z",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockHistoryRow],
    });

    const history = await repository.getHistory("field_88", { limit: 5, offset: 10 });
    expect(history.length).toBe(1);
    expect(history[0].recordId).toBe("hist_rec_01");
    expect(history[0].isImmutable).toBe(true);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).toContain("offset=10");
  });
});
