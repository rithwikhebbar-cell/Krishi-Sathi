import {
  CropWaterInput,
  CropWaterInputSchema,
  CropWaterOutput,
  CropWaterOutputSchema,
  DeterministicEngine,
} from "./types";
import { ValidationError } from "../contracts/errors";

/**
 * Standard FAO-56 Crop Coefficients (Kc) for Indian agro-climatic conditions.
 */
export const CROP_COEFFICIENTS: Record<
  CropWaterInput["crop"],
  Record<CropWaterInput["growthStage"], number>
> = {
  wheat: { initial: 0.40, development: 0.80, mid_season: 1.15, late_season: 0.30 },
  rice: { initial: 1.05, development: 1.10, mid_season: 1.20, late_season: 0.90 },
  cotton: { initial: 0.45, development: 0.75, mid_season: 1.15, late_season: 0.70 },
  maize: { initial: 0.40, development: 0.80, mid_season: 1.20, late_season: 0.60 },
  mustard: { initial: 0.35, development: 0.70, mid_season: 1.10, late_season: 0.35 },
  soybean: { initial: 0.40, development: 0.75, mid_season: 1.15, late_season: 0.50 },
};

export class CropWaterDemandEngine implements DeterministicEngine<CropWaterInput, CropWaterOutput> {
  public readonly engineName = "fao56-crop-water-balance";
  public readonly version = "fao56-waterbalance-v1.0.0" as const;

  /**
   * Deterministically calculates daily crop water requirement (ETc) and net irrigation requirement.
   * Authoritative calculation based on FAO Irrigation and Drainage Paper 56.
   */
  calculate(rawInput: CropWaterInput): CropWaterOutput {
    const parsed = CropWaterInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(
        `Invalid input for CropWaterDemandEngine: ${parsed.error.issues.map((i) => i.message).join(", ")}`
      );
    }

    const { crop, growthStage, referenceEvapotranspirationMmDay, forecastRainfallMm, fieldAreaHectares } = parsed.data;

    const kc = CROP_COEFFICIENTS[crop][growthStage];
    // ETc = Kc * ET0
    const etcMmDay = Math.round(kc * referenceEvapotranspirationMmDay * 100) / 100;

    // Effective rainfall using standard FAO/USDA-SCS empirical formula
    let effectiveRainMm = 0;
    if (forecastRainfallMm > 0) {
      if (forecastRainfallMm <= 250) {
        effectiveRainMm = (forecastRainfallMm * (125 - 0.2 * forecastRainfallMm)) / 125;
      } else {
        effectiveRainMm = 125 + 0.1 * forecastRainfallMm;
      }
    }
    effectiveRainMm = Math.max(0, Math.round(effectiveRainMm * 100) / 100);

    // Net Irrigation = max(0, ETc - Peff)
    const netIrrigationMmDay = Math.max(0, Math.round((etcMmDay - effectiveRainMm) * 100) / 100);

    // 1 mm over 1 hectare (10,000 m2) = 10,000 Liters (10 m3)
    const dailyIrrigationVolumeLitersPerHectare = Math.round(netIrrigationMmDay * 10_000);
    const totalIrrigationVolumeLiters = Math.round(dailyIrrigationVolumeLitersPerHectare * fieldAreaHectares);

    const output: CropWaterOutput = {
      engineVersion: this.version,
      crop,
      growthStage,
      cropCoefficientKc: kc,
      referenceEt0MmDay: referenceEvapotranspirationMmDay,
      cropWaterRequirementEtcMmDay: etcMmDay,
      forecastRainfallMm,
      effectiveRainfallMm: effectiveRainMm,
      netIrrigationRequirementMmDay: netIrrigationMmDay,
      dailyIrrigationVolumeLitersPerHectare,
      totalIrrigationVolumeLiters,
      units: {
        referenceEt0: "mm/day",
        cropWaterRequirementEtc: "mm/day",
        forecastRainfall: "mm",
        effectiveRainfall: "mm",
        netIrrigationRequirement: "mm/day",
        dailyVolumePerHectare: "Liters/ha/day",
        totalVolume: "Liters/day",
      },
      calculationMethod: "FAO-56 Single Crop Coefficient & USDA-SCS Effective Precipitation",
      authoritativeRule: "Deterministic calculation is authoritative. Gemini may explain findings but cannot alter or recalculate these values.",
      calculatedAt: new Date().toISOString(),
    };

    return CropWaterOutputSchema.parse(output);
  }
}
