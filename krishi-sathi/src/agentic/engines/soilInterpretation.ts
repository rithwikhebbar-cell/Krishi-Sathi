import { SoilParameters, SoilNutrientRating } from "../contracts/soil/soilParameters";
import { NutrientClassification } from "../contracts/soil/nutrientTypes";

/**
 * Standard Agricultural Interpretation Module.
 * Benchmarks are strictly sourced from:
 * 1. ICAR - Soil Health Card Scheme Guidelines (Ministry of Agriculture & Farmers Welfare, GoI, 2015).
 * 2. PAU Package of Practices for Rabi & Kharif Crops (Punjab Agricultural University).
 * 3. TNAU Agritech Portal Soil Fertility Ratings.
 *
 * NOTE: Testing methods are chemically distinct and non-interchangeable.
 * If testing method is unsupported or missing, returns UNKNOWN with explanation.
 */

export interface ParameterBenchmark {
  parameterKey: string;
  displayName: string;
  applicableMethod: string;
  unit: string;
  referenceSource: string;
  evaluate(value: number, method: string): {
    rating: SoilNutrientRating;
    range: string;
    interpretation: string;
  };
}

export class SoilInterpretationEngine {
  private static readonly BENCHMARK_MAP: Record<string, ParameterBenchmark> = {
    // 1. Available Nitrogen (Alkaline Permanganate Method)
    availableNitrogen: {
      parameterKey: "availableNitrogen",
      displayName: "Available Nitrogen (N)",
      applicableMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
      unit: "kg/ha",
      referenceSource: "ICAR Soil Health Card Scheme Standard (2015) / Subbiah & Asija (1956)",
      evaluate(value: number, method: string) {
        if (method !== "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable: Method '${method}' does not have verified ICAR rating brackets in this registry.`,
          };
        }
        if (value < 280) {
          return {
            rating: "LOW",
            range: "Low (< 280 kg/ha)",
            interpretation: "Soil is low in readily mineralizable nitrogen. Crop response to nitrogenous fertilizers will be high.",
          };
        } else if (value <= 560) {
          return {
            rating: "MEDIUM",
            range: "Medium (280 - 560 kg/ha)",
            interpretation: "Soil nitrogen availability is in the medium range. Balanced recommended dose is advised.",
          };
        } else {
          return {
            rating: "HIGH",
            range: "High (> 560 kg/ha)",
            interpretation: "Soil is high in available nitrogen. Nitrogen application may be economized by 20-25%.",
          };
        }
      },
    },

    // 2. Available Phosphorus (Olsen Method for Neutral/Alkaline soils)
    availablePhosphorusOlsen: {
      parameterKey: "availablePhosphorus",
      displayName: "Available Phosphorus (Olsen P2O5)",
      applicableMethod: "OLSEN_SODIUM_BICARBONATE",
      unit: "kg/ha_P2O5",
      referenceSource: "ICAR Soil Health Card Scheme Standard (2015) / Olsen et al. (1954)",
      evaluate(value: number, method: string) {
        if (method !== "OLSEN_SODIUM_BICARBONATE") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable: Method '${method}' cannot be interpreted using Olsen standard thresholds.`,
          };
        }
        // Olsen P2O5: Low < 22.9 kg/ha (< 10 kg P/ha), Medium 22.9 - 56.3 kg/ha (10-24.6 kg P/ha), High > 56.3 kg/ha (> 24.6 kg P/ha)
        if (value < 22.9) {
          return {
            rating: "LOW",
            range: "Low (< 22.9 kg P2O5/ha or < 10 kg P/ha)",
            interpretation: "Phosphorus availability is low. Full phosphatic basal dressing is necessary for vigorous root establishment.",
          };
        } else if (value <= 56.3) {
          return {
            rating: "MEDIUM",
            range: "Medium (22.9 - 56.3 kg P2O5/ha)",
            interpretation: "Phosphorus status is medium. Standard recommended maintenance dose is required.",
          };
        } else {
          return {
            rating: "HIGH",
            range: "High (> 56.3 kg P2O5/ha)",
            interpretation: "Soil phosphorus is high. Phosphatic fertilizer dose can be reduced to prevent nutrient fixation and luxury consumption.",
          };
        }
      },
    },

    // 3. Available Phosphorus (Bray-1 Method for Acidic soils)
    availablePhosphorusBray: {
      parameterKey: "availablePhosphorus",
      displayName: "Available Phosphorus (Bray-1 P2O5)",
      applicableMethod: "BRAY_KURTZ_1_ACID_FLUORIDE",
      unit: "kg/ha_P2O5",
      referenceSource: "ICAR National Bureau of Soil Survey & Land Use Planning (NBSS&LUP) Acid Soils Guidelines",
      evaluate(value: number, method: string) {
        if (method !== "BRAY_KURTZ_1_ACID_FLUORIDE") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable: Method '${method}' cannot be interpreted using Bray-1 acid soil thresholds.`,
          };
        }
        if (value < 15.0) {
          return {
            rating: "LOW",
            range: "Low (< 15.0 kg P2O5/ha)",
            interpretation: "Available P is low in acidic soil. Water-soluble or citrate-soluble P fertilizer required with liming if pH < 5.5.",
          };
        } else if (value <= 35.0) {
          return {
            rating: "MEDIUM",
            range: "Medium (15.0 - 35.0 kg P2O5/ha)",
            interpretation: "Available P is in the medium range for acidic soils.",
          };
        } else {
          return {
            rating: "HIGH",
            range: "High (> 35.0 kg P2O5/ha)",
            interpretation: "Available P is high.",
          };
        }
      },
    },

    // 4. Available Potassium (Neutral 1N Ammonium Acetate Method)
    availablePotassium: {
      parameterKey: "availablePotassium",
      displayName: "Available Potassium (K2O)",
      applicableMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE",
      unit: "kg/ha_K2O",
      referenceSource: "ICAR Soil Health Card Scheme Standard (2015) / Stanford & English (1949)",
      evaluate(value: number, method: string) {
        if (method !== "NEUTRAL_NORMAL_AMMONIUM_ACETATE") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable: Method '${method}' does not have verified ICAR flame-photometric calibration.`,
          };
        }
        // Potassium K2O: Low < 132 kg/ha (< 110 kg K/ha), Medium 132 - 336 kg/ha (110 - 280 kg K/ha), High > 336 kg/ha (> 280 kg K/ha)
        if (value < 132) {
          return {
            rating: "LOW",
            range: "Low (< 132 kg K2O/ha or < 110 kg K/ha)",
            interpretation: "Soil is low in exchangeable potassium. Potassic fertilization (MOP) is critical to prevent lodging and drought vulnerability.",
          };
        } else if (value <= 336) {
          return {
            rating: "MEDIUM",
            range: "Medium (132 - 336 kg K2O/ha)",
            interpretation: "Available potassium is in the medium range. Apply recommended potassic dose.",
          };
        } else {
          return {
            rating: "HIGH",
            range: "High (> 336 kg K2O/ha)",
            interpretation: "Soil is high in exchangeable potassium. Potassium application can be reduced or omitted for low-K demanding crops.",
          };
        }
      },
    },

    // 5. Organic Carbon (Walkley-Black Method)
    organicCarbonPercent: {
      parameterKey: "organicCarbonPercent",
      displayName: "Organic Carbon",
      applicableMethod: "WALKLEY_BLACK_WET_OXIDATION",
      unit: "%",
      referenceSource: "ICAR Soil Health Card Scheme Standard (2015) / Walkley & Black (1934)",
      evaluate(value: number, method: string) {
        if (method !== "WALKLEY_BLACK_WET_OXIDATION") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable: Method '${method}' is not calibrated against Walkley-Black wet oxidation brackets.`,
          };
        }
        if (value < 0.50) {
          return {
            rating: "LOW",
            range: "Low (< 0.50%)",
            interpretation: "Soil organic carbon is poor. High priority for organic manures (FYM, compost) and green manuring to improve soil biology and CEC.",
          };
        } else if (value <= 0.75) {
          return {
            rating: "MEDIUM",
            range: "Medium (0.50% - 0.75%)",
            interpretation: "Soil organic carbon is in the moderate range. Maintain with regular crop residue retention and organic amendments.",
          };
        } else {
          return {
            rating: "HIGH",
            range: "High (> 0.75%)",
            interpretation: "Soil organic carbon is good. Fosters beneficial microbial activity and moisture retention.",
          };
        }
      },
    },

    // 6. Soil Reaction (pH in 1:2.5 or 1:2 Water)
    ph: {
      parameterKey: "ph",
      displayName: "Soil pH (Reaction)",
      applicableMethod: "SUSPENSION_1_2_5_WATER",
      unit: "pH_units",
      referenceSource: "ICAR Soil Health Card Scheme Standard (2015) / Central Soil Salinity Research Institute (CSSRI)",
      evaluate(value: number) {
        if (value < 6.5) {
          return {
            rating: "ACIDIC",
            range: "Acidic (< 6.5)",
            interpretation: "Soil is acidic. Phosphorus fixation by iron/aluminum oxides is elevated; micronutrient toxicity may occur in strongly acidic soils (pH < 5.5).",
          };
        } else if (value <= 7.8) {
          return {
            rating: "NORMAL",
            range: "Normal / Neutral (6.5 - 7.8)",
            interpretation: "Soil pH is in the optimal range for availability of most plant nutrients.",
          };
        } else if (value <= 8.5) {
          return {
            rating: "ALKALINE",
            range: "Alkaline / Calcareous (7.8 - 8.5)",
            interpretation: "Soil is alkaline. Micronutrient availability (especially Zinc and Iron) and Phosphorus availability may be constrained by calcium carbonate.",
          };
        } else {
          return {
            rating: "TOXIC",
            range: "Highly Alkaline / Sodic (> 8.5)",
            interpretation: "Soil is sodic/alkali. Excess sodium impairs soil structure and water infiltration. Gypsum application is advised based on gypsum requirement.",
          };
        }
      },
    },

    // 7. Electrical Conductivity (EC in 1:2 water)
    electricalConductivity: {
      parameterKey: "electricalConductivity",
      displayName: "Electrical Conductivity (EC)",
      applicableMethod: "SUSPENSION_1_2_WATER",
      unit: "dS/m",
      referenceSource: "Central Soil Salinity Research Institute (CSSRI) / ICAR Soil Health Card Scheme (2015)",
      evaluate(value: number) {
        if (value < 1.0) {
          return {
            rating: "NON_SALINE",
            range: "Non-Saline (< 1.0 dS/m in 1:2)",
            interpretation: "Salt concentration is normal. No restriction on crop growth or seedling germination.",
          };
        } else if (value <= 2.0) {
          return {
            rating: "SALINE",
            range: "Slightly Saline / Critical (1.0 - 2.0 dS/m)",
            interpretation: "Critical for salt-sensitive crops. Germination of pulses and oilseeds may be inhibited.",
          };
        } else {
          return {
            rating: "TOXIC",
            range: "Saline / Injurious (> 2.0 dS/m in 1:2)",
            interpretation: "High soluble salt hazard. Yield of semi-tolerant and sensitive crops will be severely depressed. Leaching with good quality water recommended.",
          };
        }
      },
    },

    // 8. Available Zinc (DTPA Extractable)
    availableZincPpm: {
      parameterKey: "availableZincPpm",
      displayName: "Available Zinc (Zn)",
      applicableMethod: "DTPA_TEA_CaCl2_LINDSAY_NORVELL",
      unit: "ppm",
      referenceSource: "ICAR-AICRP on Micro- and Secondary-Nutrients / Lindsay & Norvell (1978)",
      evaluate(value: number, method: string) {
        if (method !== "DTPA_TEA_CaCl2_LINDSAY_NORVELL") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable: Method '${method}' not calibrated for DTPA zinc threshold.`,
          };
        }
        if (value < 0.6) {
          return {
            rating: "DEFICIENT",
            range: "Deficient (< 0.6 ppm)",
            interpretation: "Soil is acutely deficient in Zinc. Significant yield loss expected in rice ('Khaira' disease) and maize without Zinc Sulphate application.",
          };
        } else if (value <= 1.2) {
          return {
            rating: "LOW",
            range: "Marginal / Low (0.6 - 1.2 ppm)",
            interpretation: "Zinc availability is marginal. Maintenance dose recommended for intensive cropping systems.",
          };
        } else {
          return {
            rating: "SUFFICIENT",
            range: "Sufficient (> 1.2 ppm)",
            interpretation: "Available zinc is adequate. No soil application required this season.",
          };
        }
      },
    },

    // 9. Available Sulphur (CaCl2 Turbidimetric)
    availableSulphurPpm: {
      parameterKey: "availableSulphurPpm",
      displayName: "Available Sulphur (S)",
      applicableMethod: "CALCIUM_CHLORIDE_TURBIDIMETRIC",
      unit: "ppm",
      referenceSource: "ICAR-TNAU Benchmark / Chesnin & Yien (1950)",
      evaluate(value: number, method: string) {
        if (method !== "CALCIUM_CHLORIDE_TURBIDIMETRIC") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable: Method '${method}' not calibrated for CaCl2 sulphur threshold.`,
          };
        }
        if (value < 10.0) {
          return {
            rating: "DEFICIENT",
            range: "Deficient (< 10.0 ppm)",
            interpretation: "Sulphur is deficient. High priority for oilseed and pulse crops requiring high sulphur for protein/oil synthesis.",
          };
        } else if (value <= 20.0) {
          return {
            rating: "MEDIUM",
            range: "Medium / Sufficient (10.0 - 20.0 ppm)",
            interpretation: "Sulphur availability is in the medium range.",
          };
        } else {
          return {
            rating: "SUFFICIENT",
            range: "High / Sufficient (> 20.0 ppm)",
            interpretation: "Soil sulphur is high.",
          };
        }
      },
    },

    // 10. Available Iron (DTPA)
    availableIronPpm: {
      parameterKey: "availableIronPpm",
      displayName: "Available Iron (Fe)",
      applicableMethod: "DTPA_TEA_CaCl2_LINDSAY_NORVELL",
      unit: "ppm",
      referenceSource: "ICAR-AICRP Micronutrients / Lindsay & Norvell (1978)",
      evaluate(value: number, method: string) {
        if (method !== "DTPA_TEA_CaCl2_LINDSAY_NORVELL") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable for method '${method}'.`,
          };
        }
        if (value < 4.5) {
          return {
            rating: "DEFICIENT",
            range: "Deficient (< 4.5 ppm)",
            interpretation: "Iron is deficient. Calcareous or alkaline soils may show interveinal chlorosis in young leaves.",
          };
        } else {
          return {
            rating: "SUFFICIENT",
            range: "Sufficient (>= 4.5 ppm)",
            interpretation: "Iron availability is sufficient.",
          };
        }
      },
    },

    // 11. Available Boron (Hot Water Soluble)
    availableBoronPpm: {
      parameterKey: "availableBoronPpm",
      displayName: "Available Boron (B)",
      applicableMethod: "HOT_WATER_AZOMETHINE_H",
      unit: "ppm",
      referenceSource: "ICAR-AICRP Micronutrients / Berger & Truog (1939)",
      evaluate(value: number, method: string) {
        if (method !== "HOT_WATER_AZOMETHINE_H") {
          return {
            rating: "UNKNOWN",
            range: "Method dependent",
            interpretation: `Rating unavailable for method '${method}'.`,
          };
        }
        if (value < 0.5) {
          return {
            rating: "DEFICIENT",
            range: "Deficient (< 0.5 ppm)",
            interpretation: "Boron is deficient. Crucial for pollen germination, flowering and grain/fruit set in mustard and pulses.",
          };
        } else {
          return {
            rating: "SUFFICIENT",
            range: "Sufficient (>= 0.5 ppm)",
            interpretation: "Available boron is sufficient.",
          };
        }
      },
    },
  };

  /**
   * Evaluates all provided soil parameters against validated agricultural benchmarks.
   */
  public static interpret(soil: SoilParameters): NutrientClassification[] {
    const results: NutrientClassification[] = [];

    // Chemical: pH
    if (soil.chemical.ph) {
      const bm = this.BENCHMARK_MAP.ph;
      const evalRes = bm.evaluate(soil.chemical.ph.value, soil.chemical.ph.testMethod);
      results.push({
        parameterKey: "ph",
        displayName: bm.displayName,
        testValue: soil.chemical.ph.value,
        unit: soil.chemical.ph.unit,
        testMethod: soil.chemical.ph.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Chemical: EC
    if (soil.chemical.electricalConductivity) {
      const bm = this.BENCHMARK_MAP.electricalConductivity;
      const evalRes = bm.evaluate(soil.chemical.electricalConductivity.value, soil.chemical.electricalConductivity.testMethod);
      results.push({
        parameterKey: "electricalConductivity",
        displayName: bm.displayName,
        testValue: soil.chemical.electricalConductivity.value,
        unit: soil.chemical.electricalConductivity.unit,
        testMethod: soil.chemical.electricalConductivity.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Chemical: Organic Carbon
    if (soil.chemical.organicCarbonPercent) {
      const bm = this.BENCHMARK_MAP.organicCarbonPercent;
      const evalRes = bm.evaluate(soil.chemical.organicCarbonPercent.value, soil.chemical.organicCarbonPercent.testMethod);
      results.push({
        parameterKey: "organicCarbonPercent",
        displayName: bm.displayName,
        testValue: soil.chemical.organicCarbonPercent.value,
        unit: soil.chemical.organicCarbonPercent.unit,
        testMethod: soil.chemical.organicCarbonPercent.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Primary: Available Nitrogen
    if (soil.primary.availableNitrogen) {
      const bm = this.BENCHMARK_MAP.availableNitrogen;
      const evalRes = bm.evaluate(soil.primary.availableNitrogen.value, soil.primary.availableNitrogen.testMethod);
      results.push({
        parameterKey: "availableNitrogen",
        displayName: bm.displayName,
        testValue: soil.primary.availableNitrogen.value,
        unit: soil.primary.availableNitrogen.unit,
        testMethod: soil.primary.availableNitrogen.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Primary: Available Phosphorus
    if (soil.primary.availablePhosphorus) {
      const pMethod = soil.primary.availablePhosphorus.testMethod;
      const bm = pMethod === "BRAY_KURTZ_1_ACID_FLUORIDE"
        ? this.BENCHMARK_MAP.availablePhosphorusBray
        : this.BENCHMARK_MAP.availablePhosphorusOlsen;

      const evalRes = bm.evaluate(soil.primary.availablePhosphorus.value, pMethod);
      results.push({
        parameterKey: "availablePhosphorus",
        displayName: bm.displayName,
        testValue: soil.primary.availablePhosphorus.value,
        unit: soil.primary.availablePhosphorus.unit,
        testMethod: pMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Primary: Available Potassium
    if (soil.primary.availablePotassium) {
      const bm = this.BENCHMARK_MAP.availablePotassium;
      const evalRes = bm.evaluate(soil.primary.availablePotassium.value, soil.primary.availablePotassium.testMethod);
      results.push({
        parameterKey: "availablePotassium",
        displayName: bm.displayName,
        testValue: soil.primary.availablePotassium.value,
        unit: soil.primary.availablePotassium.unit,
        testMethod: soil.primary.availablePotassium.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Secondary: Sulphur
    if (soil.secondary?.availableSulphurPpm) {
      const bm = this.BENCHMARK_MAP.availableSulphurPpm;
      const evalRes = bm.evaluate(soil.secondary.availableSulphurPpm.value, soil.secondary.availableSulphurPpm.testMethod);
      results.push({
        parameterKey: "availableSulphurPpm",
        displayName: bm.displayName,
        testValue: soil.secondary.availableSulphurPpm.value,
        unit: soil.secondary.availableSulphurPpm.unit,
        testMethod: soil.secondary.availableSulphurPpm.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Micronutrient: Zinc
    if (soil.micronutrients?.availableZincPpm) {
      const bm = this.BENCHMARK_MAP.availableZincPpm;
      const evalRes = bm.evaluate(soil.micronutrients.availableZincPpm.value, soil.micronutrients.availableZincPpm.testMethod);
      results.push({
        parameterKey: "availableZincPpm",
        displayName: bm.displayName,
        testValue: soil.micronutrients.availableZincPpm.value,
        unit: soil.micronutrients.availableZincPpm.unit,
        testMethod: soil.micronutrients.availableZincPpm.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Micronutrient: Iron
    if (soil.micronutrients?.availableIronPpm) {
      const bm = this.BENCHMARK_MAP.availableIronPpm;
      const evalRes = bm.evaluate(soil.micronutrients.availableIronPpm.value, soil.micronutrients.availableIronPpm.testMethod);
      results.push({
        parameterKey: "availableIronPpm",
        displayName: bm.displayName,
        testValue: soil.micronutrients.availableIronPpm.value,
        unit: soil.micronutrients.availableIronPpm.unit,
        testMethod: soil.micronutrients.availableIronPpm.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    // Micronutrient: Boron
    if (soil.micronutrients?.availableBoronPpm) {
      const bm = this.BENCHMARK_MAP.availableBoronPpm;
      const evalRes = bm.evaluate(soil.micronutrients.availableBoronPpm.value, soil.micronutrients.availableBoronPpm.testMethod);
      results.push({
        parameterKey: "availableBoronPpm",
        displayName: bm.displayName,
        testValue: soil.micronutrients.availableBoronPpm.value,
        unit: soil.micronutrients.availableBoronPpm.unit,
        testMethod: soil.micronutrients.availableBoronPpm.testMethod,
        rating: evalRes.rating,
        benchmarkRange: evalRes.range,
        interpretation: evalRes.interpretation,
      });
    }

    return results;
  }
}
