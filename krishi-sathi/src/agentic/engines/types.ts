import { z } from "zod";

export const CropWaterInputSchema = z.object({
  crop: z.enum(["wheat", "rice", "cotton", "maize", "mustard", "soybean"]),
  growthStage: z.enum(["initial", "development", "mid_season", "late_season"]),
  referenceEvapotranspirationMmDay: z.number().positive("ET0 must be greater than 0 mm/day"),
  forecastRainfallMm: z.number().min(0, "Rainfall cannot be negative"),
  soilType: z.enum(["sandy", "loamy", "clayey", "alluvial"]).default("loamy"),
  fieldAreaHectares: z.number().positive().default(1.0),
});

export type CropWaterInput = z.infer<typeof CropWaterInputSchema>;

export const CropWaterOutputSchema = z.object({
  engineVersion: z.literal("fao56-waterbalance-v1.0.0"),
  crop: z.string(),
  growthStage: z.string(),
  cropCoefficientKc: z.number(),
  referenceEt0MmDay: z.number(),
  cropWaterRequirementEtcMmDay: z.number(),
  forecastRainfallMm: z.number(),
  effectiveRainfallMm: z.number(),
  netIrrigationRequirementMmDay: z.number(),
  dailyIrrigationVolumeLitersPerHectare: z.number(),
  totalIrrigationVolumeLiters: z.number(),
  units: z.record(z.string(), z.string()),
  calculationMethod: z.string(),
  authoritativeRule: z.string(),
  calculatedAt: z.string(),
});

export type CropWaterOutput = z.infer<typeof CropWaterOutputSchema>;

export interface DeterministicEngine<TInput, TOutput> {
  readonly engineName: string;
  readonly version: string;
  calculate(input: TInput): TOutput;
}
