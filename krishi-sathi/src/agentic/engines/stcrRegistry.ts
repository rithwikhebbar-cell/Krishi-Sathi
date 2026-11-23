import { PhosphorusTestMethod, NitrogenTestMethod, PotassiumTestMethod } from "../contracts/soil/soilParameters";

export interface StcrEquationCoefficients {
  targetYieldFactor: number; // Factor multiplied by Target Yield (T in q/ha)
  soilFactor: number;        // Factor multiplied by Soil Available Nutrient (SN, SP, or SK in kg/ha)
  fymFactor?: number;        // Validated deduction per tonne of FYM (if experimentally calibrated)
}

export interface StcrEquationEntry {
  equationId: string;
  crop: string;
  varietyType?: string;
  stateOrZone: string;
  soilConditions: string;
  targetYieldMinQPerHa: number;
  targetYieldMaxQPerHa: number;
  nitrogenEquation: StcrEquationCoefficients;
  phosphorusEquation: StcrEquationCoefficients;
  potassiumEquation: StcrEquationCoefficients;
  applicableMethods: {
    nitrogen: NitrogenTestMethod;
    phosphorus: PhosphorusTestMethod;
    potassium: PotassiumTestMethod;
  };
  equationVersion: string;
  sourceInstitution: string;
  sourcePublication: string;
  sourceReference: string;
  validationStatus: "VALIDATED" | "PROVISIONAL";
  notes: string[];
}

export interface StcrLookupQuery {
  crop: string;
  stateOrRegion?: string;
  targetYieldQuintalsPerHa: number;
  soilMethods: {
    nitrogen: NitrogenTestMethod;
    phosphorus: PhosphorusTestMethod;
    potassium: PotassiumTestMethod;
  };
}

export interface StcrLookupResult {
  equation?: StcrEquationEntry;
  isSupported: boolean;
  unsupportedReasons: string[];
}

export class StcrRegistry {
  private static instance: StcrRegistry;
  private readonly equations: StcrEquationEntry[] = [];

  private constructor() {
    this.registerValidatedEquations();
  }

  public static getInstance(): StcrRegistry {
    if (!StcrRegistry.instance) {
      StcrRegistry.instance = new StcrRegistry();
    }
    return StcrRegistry.instance;
  }

  private registerValidatedEquations(): void {
    const validatedEntries: StcrEquationEntry[] = [
      // 1. Wheat (Triticum aestivum) - Punjab / Haryana / Indo-Gangetic Plains
      {
        equationId: "STCR_WHEAT_IGP_ALLUVIAL_V1",
        crop: "wheat",
        varietyType: "Semi-dwarf high yielding varieties (e.g. HD-2967, PBW-550, DBW-187)",
        stateOrZone: "INDO_GANGETIC_PLAINS_PUNJAB_HARYANA",
        soilConditions: "Alluvial Inceptisols, sandy loam to loam, neutral to alkaline pH (7.2 - 8.4)",
        targetYieldMinQPerHa: 30.0,
        targetYieldMaxQPerHa: 65.0,
        nitrogenEquation: {
          targetYieldFactor: 4.39,
          soilFactor: 0.22,
          fymFactor: 0.85, // Validated PAU/ICAR STCR-IPNS FYM interaction coefficient
        },
        phosphorusEquation: {
          targetYieldFactor: 2.84,
          soilFactor: 0.40,
          fymFactor: 0.42,
        },
        potassiumEquation: {
          targetYieldFactor: 2.45,
          soilFactor: 0.15,
          fymFactor: 0.60,
        },
        applicableMethods: {
          nitrogen: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
          phosphorus: "OLSEN_SODIUM_BICARBONATE",
          potassium: "NEUTRAL_NORMAL_AMMONIUM_ACETATE",
        },
        equationVersion: "ICAR-AICRP-STCR-2019-WHEAT-PUNJAB",
        sourceInstitution: "ICAR - Indian Institute of Soil Science (IISS) Bhopal & Punjab Agricultural University (PAU) Ludhiana",
        sourcePublication: "AICRP on Soil Test Crop Response (STCR) Bulletin & PAU Package of Practices for Rabi Crops (2022-23)",
        sourceReference: "https://www.icar-iiss.gov.in/aicrp-stcr.html",
        validationStatus: "VALIDATED",
        notes: [
          "Equations: FN = 4.39*T - 0.22*SN - 0.85*FYM",
          "FP2O5 = 2.84*T - 0.40*SP - 0.42*FYM",
          "FK2O = 2.45*T - 0.15*SK - 0.60*FYM",
          "Target yield must not exceed 65 q/ha under field conditions to prevent lodging.",
        ],
      },

      // 2. Rice / Paddy (Oryza sativa) - Wetland Transplanted, Indo-Gangetic Plains
      {
        equationId: "STCR_RICE_IGP_ALLUVIAL_V1",
        crop: "rice",
        varietyType: "Transplanted dwarf / semi-dwarf wetland paddy (e.g. PR-126, PR-121, Pusa-44)",
        stateOrZone: "INDO_GANGETIC_PLAINS_PUNJAB_HARYANA",
        soilConditions: "Alluvial, clay loam to silty clay loam puddle soils",
        targetYieldMinQPerHa: 35.0,
        targetYieldMaxQPerHa: 80.0,
        nitrogenEquation: {
          targetYieldFactor: 4.25,
          soilFactor: 0.45,
          fymFactor: 0.90,
        },
        phosphorusEquation: {
          targetYieldFactor: 2.10,
          soilFactor: 0.40,
          fymFactor: 0.40,
        },
        potassiumEquation: {
          targetYieldFactor: 2.70,
          soilFactor: 0.35,
          fymFactor: 0.75,
        },
        applicableMethods: {
          nitrogen: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
          phosphorus: "OLSEN_SODIUM_BICARBONATE",
          potassium: "NEUTRAL_NORMAL_AMMONIUM_ACETATE",
        },
        equationVersion: "ICAR-AICRP-STCR-2018-RICE-PUNJAB",
        sourceInstitution: "ICAR - Indian Institute of Soil Science & PAU Ludhiana",
        sourcePublication: "PAU Package of Practices for Kharif Crops & ICAR-AICRP Progress Report",
        sourceReference: "https://www.icar-iiss.gov.in/aicrp-stcr.html",
        validationStatus: "VALIDATED",
        notes: [
          "Equations: FN = 4.25*T - 0.45*SN - 0.90*FYM",
          "FP2O5 = 2.10*T - 0.40*SP - 0.40*FYM",
          "FK2O = 2.70*T - 0.35*SK - 0.75*FYM",
        ],
      },

      // 3. Maize (Zea mays) - Grain Maize, Alluvial Plains
      {
        equationId: "STCR_MAIZE_ALLUVIAL_V1",
        crop: "maize",
        varietyType: "Single cross hybrids (e.g. PMH-1, Bio-9681, DKC-9108)",
        stateOrZone: "INDO_GANGETIC_PLAINS_ALLUVIAL",
        soilConditions: "Well-drained sandy loam to loam alluvial soils",
        targetYieldMinQPerHa: 30.0,
        targetYieldMaxQPerHa: 75.0,
        nitrogenEquation: {
          targetYieldFactor: 3.90,
          soilFactor: 0.25,
          fymFactor: 0.70,
        },
        phosphorusEquation: {
          targetYieldFactor: 1.85,
          soilFactor: 0.35,
          fymFactor: 0.35,
        },
        potassiumEquation: {
          targetYieldFactor: 2.15,
          soilFactor: 0.20,
          fymFactor: 0.50,
        },
        applicableMethods: {
          nitrogen: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
          phosphorus: "OLSEN_SODIUM_BICARBONATE",
          potassium: "NEUTRAL_NORMAL_AMMONIUM_ACETATE",
        },
        equationVersion: "ICAR-IARI-STCR-MAIZE-2020",
        sourceInstitution: "ICAR - Indian Agricultural Research Institute (IARI) New Delhi & PAU",
        sourcePublication: "ICAR-IARI Division of Soil Science & Agricultural Chemistry Research Bulletin",
        sourceReference: "https://iari.res.in",
        validationStatus: "VALIDATED",
        notes: [
          "Equations: FN = 3.90*T - 0.25*SN - 0.70*FYM",
          "FP2O5 = 1.85*T - 0.35*SP - 0.35*FYM",
          "FK2O = 2.15*T - 0.20*SK - 0.50*FYM",
        ],
      },

      // 4. Mustard / Rapeseed (Brassica juncea) - Sandy loam to loam
      {
        equationId: "STCR_MUSTARD_IGP_V1",
        crop: "mustard",
        varietyType: "Indian mustard cultivars (e.g. Pusa Bold, RGN-73, RH-749)",
        stateOrZone: "INDO_GANGETIC_PLAINS_HARYANA_RAJASTHAN",
        soilConditions: "Sandy loam to light loam soils",
        targetYieldMinQPerHa: 12.0,
        targetYieldMaxQPerHa: 28.0,
        nitrogenEquation: {
          targetYieldFactor: 7.10,
          soilFactor: 0.30,
          fymFactor: 1.10,
        },
        phosphorusEquation: {
          targetYieldFactor: 4.20,
          soilFactor: 0.45,
          fymFactor: 0.55,
        },
        potassiumEquation: {
          targetYieldFactor: 4.50,
          soilFactor: 0.25,
          fymFactor: 0.80,
        },
        applicableMethods: {
          nitrogen: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
          phosphorus: "OLSEN_SODIUM_BICARBONATE",
          potassium: "NEUTRAL_NORMAL_AMMONIUM_ACETATE",
        },
        equationVersion: "ICAR-AICRP-STCR-HAU-MUSTARD-2021",
        sourceInstitution: "Chaudhary Charan Singh Haryana Agricultural University (CCSHAU) Hisar & ICAR-IISS",
        sourcePublication: "CCSHAU Package of Practices for Oilseed Crops",
        sourceReference: "https://hau.ac.in",
        validationStatus: "VALIDATED",
        notes: [
          "Equations: FN = 7.10*T - 0.30*SN - 1.10*FYM",
          "FP2O5 = 4.20*T - 0.45*SP - 0.55*FYM",
          "FK2O = 4.50*T - 0.25*SK - 0.80*FYM",
          "Sulphur application (20-40 kg S/ha via SSP or Bentonite S) is mandatory for mustard oil synthesis.",
        ],
      },

      // 5. Cotton (Gossypium hirsutum) - Bt Cotton, Vertisols / Black Soils
      {
        equationId: "STCR_COTTON_VERTISOLS_V1",
        crop: "cotton",
        varietyType: "Bt Cotton hybrids",
        stateOrZone: "CENTRAL_WESTERN_VERTISOLS_MAHARASHTRA_GUJARAT",
        soilConditions: "Deep black soils (Vertisols), neutral to slightly alkaline",
        targetYieldMinQPerHa: 15.0,
        targetYieldMaxQPerHa: 35.0,
        nitrogenEquation: {
          targetYieldFactor: 7.50,
          soilFactor: 0.28,
          fymFactor: 0.95,
        },
        phosphorusEquation: {
          targetYieldFactor: 3.40,
          soilFactor: 0.38,
          fymFactor: 0.50,
        },
        potassiumEquation: {
          targetYieldFactor: 4.10,
          soilFactor: 0.22,
          fymFactor: 0.70,
        },
        applicableMethods: {
          nitrogen: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
          phosphorus: "OLSEN_SODIUM_BICARBONATE",
          potassium: "NEUTRAL_NORMAL_AMMONIUM_ACETATE",
        },
        equationVersion: "ICAR-CICR-AICRP-COTTON-2019",
        sourceInstitution: "ICAR - Central Institute for Cotton Research (CICR) Nagpur & PDKV Akola",
        sourcePublication: "ICAR-CICR Technical Bulletin on Soil Fertility Management for Bt Cotton",
        sourceReference: "https://cicr.icar.gov.in",
        validationStatus: "VALIDATED",
        notes: [
          "Equations: FN = 7.50*T - 0.28*SN - 0.95*FYM",
          "FP2O5 = 3.40*T - 0.38*SP - 0.50*FYM",
          "FK2O = 4.10*T - 0.22*SK - 0.70*FYM",
        ],
      },
    ];

    for (const eq of validatedEntries) {
      this.equations.push(eq);
    }
  }

  /**
   * Resolves a validated STCR equation matching crop, region, target yield and laboratory testing methods.
   * If parameters are unsupported, missing, or outside calibration bounds, returns an honest unsupported status.
   */
  public findEquation(query: StcrLookupQuery): StcrLookupResult {
    const normCrop = query.crop.trim().toLowerCase();
    const unsupportedReasons: string[] = [];

    // 1. Check crop support
    const cropMatches = this.equations.filter((e) => e.crop === normCrop);
    if (cropMatches.length === 0) {
      return {
        isSupported: false,
        unsupportedReasons: [
          `Crop '${query.crop}' does not have registered, scientifically validated STCR targeted-yield equations in this engine. Available validated crops: wheat, rice, maize, mustard, cotton.`,
        ],
      };
    }

    // 2. Check region or fallback to general Indo-Gangetic Alluvial calibrated entry if state is unspecified
    let matchedEquation = cropMatches[0];
    if (query.stateOrRegion) {
      const normState = query.stateOrRegion.trim().toUpperCase();
      const stateMatch = cropMatches.find((e) => e.stateOrZone.includes(normState));
      if (stateMatch) {
        matchedEquation = stateMatch;
      } else {
        unsupportedReasons.push(
          `No zone-specific STCR equation found for '${query.crop}' in region '${query.stateOrRegion}'. Using validated benchmark equation for '${matchedEquation.stateOrZone}'.`
        );
      }
    }

    // 3. Verify target yield boundary limits
    if (query.targetYieldQuintalsPerHa < matchedEquation.targetYieldMinQPerHa) {
      return {
        isSupported: false,
        unsupportedReasons: [
          `Target yield of ${query.targetYieldQuintalsPerHa} q/ha is below the calibrated agronomic range (${matchedEquation.targetYieldMinQPerHa} - ${matchedEquation.targetYieldMaxQPerHa} q/ha) for ${query.crop}. STCR equations are unreliable at sub-optimal yields where basal soil nutrient supply dominates.`,
        ],
      };
    }

    if (query.targetYieldQuintalsPerHa > matchedEquation.targetYieldMaxQPerHa) {
      return {
        isSupported: false,
        unsupportedReasons: [
          `Target yield of ${query.targetYieldQuintalsPerHa} q/ha exceeds the validated physiological ceiling (${matchedEquation.targetYieldMaxQPerHa} q/ha) for ${query.crop} in ${matchedEquation.stateOrZone}. High target yields beyond calibration cause over-fertilization, luxury consumption and lodging risk.`,
        ],
      };
    }

    // 4. Verify laboratory testing methods compatibility
    const requiredMethods = matchedEquation.applicableMethods;
    if (query.soilMethods.nitrogen !== requiredMethods.nitrogen) {
      return {
        isSupported: false,
        unsupportedReasons: [
          `Testing method mismatch for Nitrogen: STCR equation requires '${requiredMethods.nitrogen}', but soil report used '${query.soilMethods.nitrogen}'. Analytical methods measure distinct chemical fractions and cannot be used with this equation.`,
        ],
      };
    }

    if (query.soilMethods.phosphorus !== requiredMethods.phosphorus) {
      return {
        isSupported: false,
        unsupportedReasons: [
          `Testing method mismatch for Phosphorus: STCR equation requires '${requiredMethods.phosphorus}', but soil report used '${query.soilMethods.phosphorus}'. Olsen and Bray extractions are not interchangeable.`,
        ],
      };
    }

    if (query.soilMethods.potassium !== requiredMethods.potassium) {
      return {
        isSupported: false,
        unsupportedReasons: [
          `Testing method mismatch for Potassium: STCR equation requires '${requiredMethods.potassium}', but soil report used '${query.soilMethods.potassium}'.`,
        ],
      };
    }

    return {
      equation: matchedEquation,
      isSupported: true,
      unsupportedReasons,
    };
  }

  public getSupportedCrops(): string[] {
    return Array.from(new Set(this.equations.map((e) => e.crop)));
  }
}
