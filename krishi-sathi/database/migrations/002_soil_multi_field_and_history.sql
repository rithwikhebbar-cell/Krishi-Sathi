-- ============================================================================
-- KRISHI SATHI — MILESTONE 1.3: PHASE 4
-- Persistent Multi-Field Management & Historical Soil Repository
-- Migration: 002_soil_multi_field_and_history.sql
-- ============================================================================

-- Ensure uuid-ossp or pgcrypto extension is available for random UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Table: farmers
-- Represents registered agricultural farmers and authenticating identities
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.farmers (
  id text PRIMARY KEY,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. Table: agricultural_fields
-- Supports multiple agricultural fields per farmer with geolocation and active soil profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agricultural_fields (
  id text PRIMARY KEY,
  farmer_id text NOT NULL,
  name text NOT NULL,
  area_acres numeric NOT NULL CHECK (area_acres > 0),
  location jsonb NOT NULL,
  primary_soil_type text NOT NULL DEFAULT 'ALLUVIAL',
  primary_texture_class text NOT NULL DEFAULT 'UNKNOWN',
  irrigation_source text NOT NULL DEFAULT 'TUBEWELL',
  active_soil_profile jsonb,
  active_soil_test_record_id text,
  total_historical_soil_tests integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. Table: soil_reports
-- Stores metadata and extracted parameters for uploaded soil-test reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.soil_reports (
  id text PRIMARY KEY,
  field_id text NOT NULL REFERENCES public.agricultural_fields(id) ON DELETE CASCADE,
  farmer_id text NOT NULL,
  source_file_name text NOT NULL,
  file_mime_type text NOT NULL,
  content_hash text NOT NULL,
  storage_path text,
  file_format text NOT NULL,
  file_size_bytes integer,
  extraction_status text NOT NULL DEFAULT 'COMPLETED',
  approval_status text NOT NULL DEFAULT 'PENDING_APPROVAL',
  overall_confidence numeric NOT NULL CHECK (overall_confidence >= 0 AND overall_confidence <= 1),
  extraction_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_parameters jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. Table: soil_test_records (IMMUTABLE)
-- Immutable historical snapshots of approved soil tests. Never updated or deleted.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.soil_test_records (
  id text PRIMARY KEY,
  field_id text NOT NULL REFERENCES public.agricultural_fields(id) ON DELETE RESTRICT,
  farmer_id text NOT NULL,
  report_id text REFERENCES public.soil_reports(id) ON DELETE RESTRICT,
  sample_code text,
  test_date text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  parameters jsonb NOT NULL,
  lab_metadata jsonb,
  approval_provenance jsonb NOT NULL,
  is_immutable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. Table: soil_report_edits
-- Tracks fine-grained audit trail of any parameter corrections made by the farmer
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.soil_report_edits (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES public.soil_reports(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  original_value numeric,
  corrected_value numeric NOT NULL,
  original_unit text,
  corrected_unit text,
  original_method text,
  corrected_method text,
  reason text,
  farmer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key constraint for active_soil_test_record_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fields_active_soil_test_record') THEN
    ALTER TABLE public.agricultural_fields
      ADD CONSTRAINT fk_fields_active_soil_test_record
      FOREIGN KEY (active_soil_test_record_id)
      REFERENCES public.soil_test_records(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fields_farmer ON public.agricultural_fields(farmer_id);
CREATE INDEX IF NOT EXISTS idx_fields_active ON public.agricultural_fields(farmer_id) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_reports_field ON public.soil_reports(field_id);
CREATE INDEX IF NOT EXISTS idx_reports_farmer ON public.soil_reports(farmer_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.soil_reports(approval_status);
CREATE INDEX IF NOT EXISTS idx_history_field_date ON public.soil_test_records(field_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_history_farmer ON public.soil_test_records(farmer_id);
CREATE INDEX IF NOT EXISTS idx_edits_report ON public.soil_report_edits(report_id);

-- ============================================================================
-- 7. Database-Level Immutability Protection
-- Ensures historical soil test records cannot be mutated or deleted by anyone
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_soil_test_records_immutability()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Historical soil test records are immutable and cannot be updated or deleted. Attempted operation on Record ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_soil_test_records ON public.soil_test_records;
CREATE TRIGGER trg_protect_soil_test_records
  BEFORE UPDATE OR DELETE ON public.soil_test_records
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_soil_test_records_immutability();

-- ============================================================================
-- 8. Transactional RPC: approve_soil_report
-- Atomic approval, edit tracking, history snapshot, and active profile promotion
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_soil_report(
  p_report_id text,
  p_farmer_id text,
  p_reviewer_role text,
  p_notes text,
  p_corrections jsonb,
  p_approved_profile jsonb,
  p_historical_record jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_report record;
  v_field record;
  v_record_id text;
  v_correction_key text;
  v_corr jsonb;
BEGIN
  -- 1. Lock and retrieve report
  SELECT * INTO v_report FROM public.soil_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Soil report % was not found.', p_report_id;
  END IF;

  -- 2. Verify ownership
  IF v_report.farmer_id != p_farmer_id AND p_farmer_id != 'system-admin' THEN
    RAISE EXCEPTION 'Unauthorized: Farmer % is not authorized to approve report %', p_farmer_id, p_report_id;
  END IF;

  -- 3. Verify approval status
  IF v_report.approval_status = 'APPROVED' THEN
    RAISE EXCEPTION 'Soil report % has already been approved and cannot be approved again.', p_report_id;
  END IF;
  IF v_report.approval_status = 'REJECTED' THEN
    RAISE EXCEPTION 'Soil report % is marked REJECTED and cannot be approved.', p_report_id;
  END IF;

  -- 4. Lock and verify associated field
  SELECT * INTO v_field FROM public.agricultural_fields WHERE id = v_report.field_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Field % associated with report % was not found.', v_report.field_id, p_report_id;
  END IF;

  -- 5. Record farmer corrections if provided
  IF p_corrections IS NOT NULL AND p_corrections != '{}'::jsonb THEN
    FOR v_correction_key, v_corr IN SELECT * FROM jsonb_each(p_corrections)
    LOOP
      INSERT INTO public.soil_report_edits (
        id,
        report_id,
        parameter_key,
        original_value,
        corrected_value,
        original_unit,
        corrected_unit,
        original_method,
        corrected_method,
        reason,
        farmer_id,
        created_at
      ) VALUES (
        'edit_' || gen_random_uuid()::text,
        p_report_id,
        v_correction_key,
        (v_corr->>'originalValue')::numeric,
        (v_corr->>'correctedValue')::numeric,
        v_corr->>'originalUnit',
        v_corr->>'correctedUnit',
        v_corr->>'originalMethod',
        v_corr->>'correctedMethod',
        v_corr->>'reason',
        p_farmer_id,
        now()
      );
    END LOOP;
  END IF;

  -- 6. Insert immutable historical record
  v_record_id := p_historical_record->>'recordId';
  INSERT INTO public.soil_test_records (
    id,
    field_id,
    farmer_id,
    report_id,
    sample_code,
    test_date,
    recorded_at,
    parameters,
    lab_metadata,
    approval_provenance,
    is_immutable,
    created_at
  ) VALUES (
    v_record_id,
    v_report.field_id,
    p_farmer_id,
    p_report_id,
    p_historical_record->'labMetadata'->>'sampleCode',
    p_historical_record->>'testDate',
    (p_historical_record->>'recordedAt')::timestamptz,
    p_historical_record->'parameters',
    p_historical_record->'labMetadata',
    p_historical_record->'approvalProvenance',
    true,
    now()
  );

  -- 7. Atomically promote active soil profile on agricultural field
  UPDATE public.agricultural_fields
  SET
    active_soil_profile = p_approved_profile,
    active_soil_test_record_id = v_record_id,
    total_historical_soil_tests = total_historical_soil_tests + 1,
    updated_at = now()
  WHERE id = v_report.field_id;

  -- 8. Mark report as approved with audit provenance
  UPDATE public.soil_reports
  SET
    approval_status = 'APPROVED',
    approval_provenance = p_approved_profile->'approvalProvenance',
    approved_parameters = p_approved_profile->'parameters',
    updated_at = now()
  WHERE id = p_report_id;

  -- 9. Return atomically finalized response payload
  RETURN jsonb_build_object(
    'reportId', p_report_id,
    'fieldId', v_report.field_id,
    'approvedProfile', p_approved_profile,
    'historicalRecord', p_historical_record,
    'status', 'APPROVED'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. Row-Level Security (RLS) Policies
-- Enforces cross-farmer data isolation
-- ============================================================================
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agricultural_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soil_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soil_test_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soil_report_edits ENABLE ROW LEVEL SECURITY;

-- Farmers table policies
DROP POLICY IF EXISTS farmers_select_own ON public.farmers;
CREATE POLICY farmers_select_own ON public.farmers
  FOR SELECT USING (id = auth.uid()::text OR auth_user_id = auth.uid());

-- Agricultural fields table policies
DROP POLICY IF EXISTS fields_select_own ON public.agricultural_fields;
CREATE POLICY fields_select_own ON public.agricultural_fields
  FOR SELECT USING (farmer_id = auth.uid()::text);

DROP POLICY IF EXISTS fields_insert_own ON public.agricultural_fields;
CREATE POLICY fields_insert_own ON public.agricultural_fields
  FOR INSERT WITH CHECK (farmer_id = auth.uid()::text);

DROP POLICY IF EXISTS fields_update_own ON public.agricultural_fields;
CREATE POLICY fields_update_own ON public.agricultural_fields
  FOR UPDATE USING (farmer_id = auth.uid()::text);

-- Soil reports table policies
DROP POLICY IF EXISTS reports_select_own ON public.soil_reports;
CREATE POLICY reports_select_own ON public.soil_reports
  FOR SELECT USING (farmer_id = auth.uid()::text);

DROP POLICY IF EXISTS reports_insert_own ON public.soil_reports;
CREATE POLICY reports_insert_own ON public.soil_reports
  FOR INSERT WITH CHECK (farmer_id = auth.uid()::text);

DROP POLICY IF EXISTS reports_update_own ON public.soil_reports;
CREATE POLICY reports_update_own ON public.soil_reports
  FOR UPDATE USING (farmer_id = auth.uid()::text);

-- Soil test records (History) policies: SELECT only for owner, no direct INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS history_select_own ON public.soil_test_records;
CREATE POLICY history_select_own ON public.soil_test_records
  FOR SELECT USING (farmer_id = auth.uid()::text);

-- Soil report edits policies
DROP POLICY IF EXISTS edits_select_own ON public.soil_report_edits;
CREATE POLICY edits_select_own ON public.soil_report_edits
  FOR SELECT USING (farmer_id = auth.uid()::text);
