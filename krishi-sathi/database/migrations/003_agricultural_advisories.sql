-- ============================================================================
-- KRISHI SATHI — MILESTONE 1.3: PHASE 5
-- Agricultural Intelligence & Gemini Advisory Synthesis Persistence
-- Migration: 003_agricultural_advisories.sql
-- ============================================================================

-- ============================================================================
-- 1. Table: agricultural_advisories
-- Stores comprehensive, evidence-grounded agricultural advisories synthesized by Gemini
-- Traceable to approved soil profile and exact deterministic calculation snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agricultural_advisories (
  id text PRIMARY KEY,
  field_id text NOT NULL REFERENCES public.agricultural_fields(id) ON DELETE CASCADE,
  farmer_id text NOT NULL REFERENCES public.farmers(id) ON DELETE RESTRICT,
  soil_test_record_id text NOT NULL REFERENCES public.soil_test_records(id) ON DELETE RESTRICT,
  crop_name text NOT NULL,
  crop_variety text,
  target_yield numeric NOT NULL CHECK (target_yield > 0),
  cropping_season text NOT NULL DEFAULT 'RABI',
  deterministic_calculation jsonb NOT NULL,
  crop_water_assessment jsonb,
  weather_context jsonb,
  advisory_content jsonb NOT NULL,
  confidence_assessment jsonb NOT NULL,
  model_metadata jsonb NOT NULL DEFAULT '{"model": "gemini-1.5-flash", "provider": "gemini"}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_advisories_field ON public.agricultural_advisories(field_id);
CREATE INDEX IF NOT EXISTS idx_advisories_farmer ON public.agricultural_advisories(farmer_id);
CREATE INDEX IF NOT EXISTS idx_advisories_soil_test ON public.agricultural_advisories(soil_test_record_id);
CREATE INDEX IF NOT EXISTS idx_advisories_crop ON public.agricultural_advisories(crop_name);
CREATE INDEX IF NOT EXISTS idx_advisories_created ON public.agricultural_advisories(created_at DESC);

-- ============================================================================
-- 3. Row-Level Security (RLS)
-- ============================================================================
ALTER TABLE public.agricultural_advisories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advisories_select_own ON public.agricultural_advisories;
CREATE POLICY advisories_select_own ON public.agricultural_advisories
  FOR SELECT USING (farmer_id = auth.uid()::text);

DROP POLICY IF EXISTS advisories_insert_own ON public.agricultural_advisories;
CREATE POLICY advisories_insert_own ON public.agricultural_advisories
  FOR INSERT WITH CHECK (farmer_id = auth.uid()::text);

DROP POLICY IF EXISTS advisories_update_own ON public.agricultural_advisories;
CREATE POLICY advisories_update_own ON public.agricultural_advisories
  FOR UPDATE USING (farmer_id = auth.uid()::text);
