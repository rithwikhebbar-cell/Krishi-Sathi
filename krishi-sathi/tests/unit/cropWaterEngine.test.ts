import { describe, expect, it } from "vitest";
import { CropWaterDemandEngine, CROP_COEFFICIENTS } from "../../src/agentic/engines/cropWaterEngine";
import { createCropWaterBalanceTool } from "../../src/agentic/tools/builtins/cropWaterBalanceTool";
import { ValidationError } from "../../src/agentic/contracts/errors";

describe("CropWaterDemandEngine & Tool", () => {
  const engine = new CropWaterDemandEngine();

  it("calculates crop evapotranspiration (ETc) using standard FAO-56 Kc values", () => {
    // Wheat mid-season Kc is 1.15
    const result = engine.calculate({
      crop: "wheat",
      growthStage: "mid_season",
      referenceEvapotranspirationMmDay: 4.0, // ET0 = 4.0 mm/day
      forecastRainfallMm: 0,
      fieldAreaHectares: 1.0,
    });

    expect(result.cropCoefficientKc).toBe(1.15);
    expect(result.cropWaterRequirementEtcMmDay).toBe(4.6); // 1.15 * 4.0 = 4.6 mm/day
    expect(result.effectiveRainfallMm).toBe(0);
    expect(result.netIrrigationRequirementMmDay).toBe(4.6);
    expect(result.dailyIrrigationVolumeLitersPerHectare).toBe(46_000); // 4.6 mm * 10,000 L/mm/ha
    expect(result.totalIrrigationVolumeLiters).toBe(46_000);
    expect(result.engineVersion).toBe("fao56-waterbalance-v1.0.0");
    expect(result.authoritativeRule).toContain("Deterministic calculation is authoritative");
  });

  it("calculates effective precipitation and deducts it from net irrigation requirement", () => {
    const result = engine.calculate({
      crop: "rice",
      growthStage: "mid_season", // Rice mid-season Kc = 1.20
      referenceEvapotranspirationMmDay: 5.0, // ETc = 6.0 mm/day
      forecastRainfallMm: 10.0, // 10 mm rainfall
      fieldAreaHectares: 2.5,
    });

    expect(result.cropWaterRequirementEtcMmDay).toBe(6.0);
    expect(result.effectiveRainfallMm).toBeGreaterThan(0);
    expect(result.netIrrigationRequirementMmDay).toBeLessThan(6.0);
    expect(result.totalIrrigationVolumeLiters).toBe(result.dailyIrrigationVolumeLitersPerHectare * 2.5);
  });

  it("rejects invalid or negative physical inputs", () => {
    expect(() =>
      engine.calculate({
        crop: "wheat",
        growthStage: "mid_season",
        referenceEvapotranspirationMmDay: -2.0, // Invalid negative ET0
        forecastRainfallMm: 0,
      })
    ).toThrow(ValidationError);

    expect(() =>
      engine.calculate({
        crop: "wheat",
        growthStage: "mid_season",
        referenceEvapotranspirationMmDay: 4.0,
        forecastRainfallMm: -5.0, // Invalid negative rainfall
      })
    ).toThrow(ValidationError);
  });

  it("integrates with the tool registry via cropWaterBalanceTool", async () => {
    const tool = createCropWaterBalanceTool();
    const output = await tool.execute({
      crop: "cotton",
      growthStage: "initial",
      referenceEvapotranspirationMmDay: 3.5,
      forecastRainfallMm: 0,
    });

    expect(output.crop).toBe("cotton");
    expect(output.growthStage).toBe("initial");
    expect(output.cropCoefficientKc).toBe(CROP_COEFFICIENTS.cotton.initial);
    expect(output.units.netIrrigationRequirement).toBe("mm/day");
  });
});
