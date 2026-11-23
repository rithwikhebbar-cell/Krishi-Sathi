import { FertilizerProductCode, FertilizerGradeSpecs } from "../contracts/soil/nutrientTypes";

export interface RegisteredFertilizerProduct {
  code: FertilizerProductCode;
  commercialName: string;
  chemicalName: string;
  grade: FertilizerGradeSpecs;
  solubility: "HIGH" | "MEDIUM" | "LOW";
  physicalForm: "PRILLED_GRANULAR" | "CRYSTALLINE" | "POWDER";
  primaryNutrientsSupplied: string[];
  secondaryNutrientsSupplied: string[];
  sourceStandard: string;
  effectiveDate: string;
  validationStatus: "OFFICIALLY_VERIFIED" | "PROVISIONAL";
  defaultApplicationMethod: string;
  precautions: string;
}

export class FertilizerRegistry {
  private static instance: FertilizerRegistry;
  private readonly products = new Map<FertilizerProductCode, RegisteredFertilizerProduct>();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): FertilizerRegistry {
    if (!FertilizerRegistry.instance) {
      FertilizerRegistry.instance = new FertilizerRegistry();
    }
    return FertilizerRegistry.instance;
  }

  private registerDefaults(): void {
    const defaultProducts: RegisteredFertilizerProduct[] = [
      {
        code: "UREA",
        commercialName: "Neem Coated Urea (46% N)",
        chemicalName: "Carbamide [CO(NH2)2]",
        grade: { nPercent: 46.0, p2o5Percent: 0, k2oPercent: 0 },
        solubility: "HIGH",
        physicalForm: "PRILLED_GRANULAR",
        primaryNutrientsSupplied: ["Nitrogen (N)"],
        secondaryNutrientsSupplied: [],
        sourceStandard: "Fertiliser (Inorganic, Organic or Mixed) (Control) Order, 1985 (FCO), Govt of India",
        effectiveDate: "2015-05-25",
        validationStatus: "OFFICIALLY_VERIFIED",
        defaultApplicationMethod: "Split into 2-3 top dressings after irrigation; avoid broadcasting on saturated standing water",
        precautions: "Do not apply in direct contact with seed. Ensure adequate soil moisture at application to avoid ammonia volatilization.",
      },
      {
        code: "DAP",
        commercialName: "Di-Ammonium Phosphate (18-46-0)",
        chemicalName: "Diammonium hydrogen phosphate [(NH4)2HPO4]",
        grade: { nPercent: 18.0, p2o5Percent: 46.0, k2oPercent: 0 },
        solubility: "HIGH",
        physicalForm: "PRILLED_GRANULAR",
        primaryNutrientsSupplied: ["Nitrogen (N)", "Phosphorus (P2O5)"],
        secondaryNutrientsSupplied: [],
        sourceStandard: "Fertiliser (Control) Order, 1985 (FCO), Govt of India",
        effectiveDate: "1985-09-25",
        validationStatus: "OFFICIALLY_VERIFIED",
        defaultApplicationMethod: "Basal application at sowing, placed 5 cm below and to the side of seed row",
        precautions: "Supplies both Nitrogen (18%) and Phosphate (46%). Nitrogen supplied by DAP MUST be deducted from total nitrogenous requirement.",
      },
      {
        code: "MOP",
        commercialName: "Muriate of Potash (60% K2O)",
        chemicalName: "Potassium Chloride [KCl]",
        grade: { nPercent: 0, p2o5Percent: 0, k2oPercent: 60.0 },
        solubility: "HIGH",
        physicalForm: "CRYSTALLINE",
        primaryNutrientsSupplied: ["Potassium (K2O)"],
        secondaryNutrientsSupplied: [],
        sourceStandard: "Fertiliser (Control) Order, 1985 (FCO), Govt of India",
        effectiveDate: "1985-09-25",
        validationStatus: "OFFICIALLY_VERIFIED",
        defaultApplicationMethod: "Basal dressing at sowing; split application recommended in coarse sandy soils",
        precautions: "Contains chloride (approx 47% Cl-). Avoid heavy applications in chloride-sensitive crops (tobacco, potato, grapes).",
      },
      {
        code: "SSP",
        commercialName: "Single Super Phosphate (16% P2O5, 11% S)",
        chemicalName: "Monocalcium phosphate + Calcium Sulphate [Ca(H2PO4)2 + CaSO4]",
        grade: { nPercent: 0, p2o5Percent: 16.0, k2oPercent: 0, sPercent: 11.0 },
        solubility: "MEDIUM",
        physicalForm: "PRILLED_GRANULAR",
        primaryNutrientsSupplied: ["Phosphorus (P2O5)"],
        secondaryNutrientsSupplied: ["Sulphur (S)", "Calcium (Ca approx 19%)"],
        sourceStandard: "Fertiliser (Control) Order, 1985 (FCO), Govt of India",
        effectiveDate: "1985-09-25",
        validationStatus: "OFFICIALLY_VERIFIED",
        defaultApplicationMethod: "Basal application drilled below seed zone",
        precautions: "Excellent source for oilseeds and pulses requiring both Phosphate and Sulphur. Contains approx 19% Calcium.",
      },
      {
        code: "ZINC_SULPHATE_HEPTAHYDRATE_21",
        commercialName: "Zinc Sulphate Heptahydrate (21% Zn, 10% S)",
        chemicalName: "Zinc Sulphate Heptahydrate [ZnSO4.7H2O]",
        grade: { nPercent: 0, p2o5Percent: 0, k2oPercent: 0, sPercent: 10.0, znPercent: 21.0 },
        solubility: "HIGH",
        physicalForm: "CRYSTALLINE",
        primaryNutrientsSupplied: [],
        secondaryNutrientsSupplied: ["Zinc (Zn)", "Sulphur (S)"],
        sourceStandard: "Fertiliser (Control) Order, 1985 (FCO), Govt of India",
        effectiveDate: "1985-09-25",
        validationStatus: "OFFICIALLY_VERIFIED",
        defaultApplicationMethod: "Soil application at sowing/field preparation (25 kg/ha once in 2-3 years)",
        precautions: "DO NOT mix directly with phosphatic fertilizers (DAP/SSP) in the same slurry or furrow, as insoluble zinc phosphate forms.",
      },
      {
        code: "ZINC_SULPHATE_MONOHYDRATE_33",
        commercialName: "Zinc Sulphate Monohydrate (33% Zn, 15% S)",
        chemicalName: "Zinc Sulphate Monohydrate [ZnSO4.H2O]",
        grade: { nPercent: 0, p2o5Percent: 0, k2oPercent: 0, sPercent: 15.0, znPercent: 33.0 },
        solubility: "HIGH",
        physicalForm: "POWDER",
        primaryNutrientsSupplied: [],
        secondaryNutrientsSupplied: ["Zinc (Zn)", "Sulphur (S)"],
        sourceStandard: "Fertiliser (Control) Order, 1985 (FCO), Govt of India",
        effectiveDate: "2006-11-03",
        validationStatus: "OFFICIALLY_VERIFIED",
        defaultApplicationMethod: "Soil application at sowing (16 kg/ha once in 2-3 years)",
        precautions: "High concentration formulation. Do not mix directly with phosphatic fertilizers in furrow.",
      },
    ];

    for (const prod of defaultProducts) {
      this.products.set(prod.code, prod);
    }
  }

  public getProduct(code: FertilizerProductCode): RegisteredFertilizerProduct | undefined {
    return this.products.get(code);
  }

  public getAllProducts(): RegisteredFertilizerProduct[] {
    return Array.from(this.products.values());
  }
}
