import { EvidenceManager } from "../evidence/evidenceManager";
import { SourceRegistry } from "../retrieval/sourceRegistry";
import { Evidence } from "../contracts/types";

export type SourceAuthorityTier = "TIER_1_PRIMARY" | "TIER_2_SUPPORTING";

export interface AuthoritativeAgronomicDocument {
  id: string;
  tier: SourceAuthorityTier;
  institution: string;
  title: string;
  url: string;
  publishedAt: string;
  applicableCrop: string; // e.g. "WHEAT", "RICE", "COTTON", "MAIZE", "MUSTARD"
  applicableRegions: string[]; // e.g. ["Punjab", "Haryana", "North-Western Plains Zone", "ALL_INDIA"]
  applicableSoilTypes: string[]; // e.g. ["ALLUVIAL", "BLACK_REGUR", "LOAM", "ANY"]
  growthStages?: string[];
  keyTopics: string[]; // e.g. ["NPK_SPLIT", "ZINC_MANAGEMENT", "IRRIGATION_CRI", "ORGANIC_MANURE"]
  excerpt: string;
}

export interface RetrievalContext {
  crop: string;
  cropVariety?: string;
  state?: string;
  district?: string;
  soilType?: string;
  growthStage?: string;
  targetYield?: number;
}

export interface RetrievalResult {
  evidence: Evidence[];
  matchedDocumentsCount: number;
  regionalMatchFound: boolean;
  regionalWarning?: string;
}

/**
 * Authoritative agronomic knowledge base curated from ICAR, State Agricultural Universities, and FAO.
 */
export const AUTHORITATIVE_AGRONOMIC_KNOWLEDGE: AuthoritativeAgronomicDocument[] = [
  // 1. ICAR - Wheat Package of Practices (Punjab / NWPZ)
  {
    id: "icar_iiwbr_wheat_pop_2024",
    tier: "TIER_1_PRIMARY",
    institution: "ICAR-Indian Institute of Wheat & Barley Research (IIWBR) & PAU",
    title: "Package of Practices for Wheat Cultivation in North-Western Plains Zone",
    url: "https://icar.org.in/iiwbr-wheat-package-practices-2024",
    publishedAt: "2024-09-15T00:00:00Z",
    applicableCrop: "WHEAT",
    applicableRegions: ["Punjab", "Haryana", "Western Uttar Pradesh", "North-Western Plains Zone"],
    applicableSoilTypes: ["ALLUVIAL", "LOAM", "CLAY_LOAM"],
    growthStages: ["initial", "development", "mid_season", "late_season"],
    keyTopics: ["NPK_SPLIT", "ZINC_MANAGEMENT", "IRRIGATION_CRI"],
    excerpt:
      "For irrigated wheat in alluvial soils of NWPZ, split nitrogen application is critical: 50% basal at sowing, 25% at Crown Root Initiation (CRI, 20-25 DAS), and 25% at first node/flowering stage. Full dose of P2O5 and K2O must be applied basal at sowing. In Zinc-deficient soils (DTPA-Zn < 0.6 ppm), broadcast 25 kg/ha of Zinc Sulphate Heptahydrate (21% Zn) or 15 kg/ha of Zinc Sulphate Monohydrate (33% Zn) at basal preparation.",
  },

  // 2. PAU - Nitrogen and Organic Manure Integration
  {
    id: "pau_wheat_nutrient_ipns_2023",
    tier: "TIER_1_PRIMARY",
    institution: "Punjab Agricultural University (PAU), Ludhiana",
    title: "Integrated Plant Nutrient Supply for High Target Yield Wheat (PAU Farm Bulletin)",
    url: "https://pau.edu/crop-production/wheat-ipns-bulletin-2023",
    publishedAt: "2023-10-10T00:00:00Z",
    applicableCrop: "WHEAT",
    applicableRegions: ["Punjab"],
    applicableSoilTypes: ["ALLUVIAL", "LOAM"],
    growthStages: ["initial"],
    keyTopics: ["ORGANIC_MANURE", "FYM_CREDIT", "NPK_SPLIT"],
    excerpt:
      "Application of well-decomposed Farmyard Manure (FYM) @ 10 t/ha before sowing reduces the inorganic chemical fertilizer N requirement by 15-20 kg/ha and P2O5 requirement by 5-10 kg/ha in subsequent wheat. Apply DAP and MOP strictly as basal; top-dressing of phosphorus is agronomically ineffective due to low soil mobility.",
  },

  // 3. ICAR-IIRR - Rice Nutrient & Water Management
  {
    id: "icar_iirr_rice_pop_2024",
    tier: "TIER_1_PRIMARY",
    institution: "ICAR-Indian Institute of Rice Research (IIRR)",
    title: "Standard Package of Practices for Irrigated Rice (Transplanted)",
    url: "https://icar.org.in/iirr-rice-production-practices-2024",
    publishedAt: "2024-05-20T00:00:00Z",
    applicableCrop: "RICE",
    applicableRegions: ["Punjab", "Haryana", "Uttar Pradesh", "West Bengal", "Andhra Pradesh", "ALL_INDIA"],
    applicableSoilTypes: ["ALLUVIAL", "CLAY_LOAM", "BLACK_REGUR"],
    growthStages: ["initial", "development", "mid_season"],
    keyTopics: ["NPK_SPLIT", "ZINC_MANAGEMENT", "WATER_MANAGEMENT"],
    excerpt:
      "Nitrogen in puddle-transplanted rice should be applied in three equal splits: 1/3 basal at transplanting, 1/3 at maximum tillering (21-25 DAT), and 1/3 at panicle initiation (40-45 DAT). Never apply urea directly on deeply standing water; maintain shallow soil moisture during top dressing.",
  },

  // 4. ICAR-CICR - Cotton Nutrient and Soil Management (Maharashtra / Central Zone)
  {
    id: "icar_cicr_cotton_pop_2023",
    tier: "TIER_1_PRIMARY",
    institution: "ICAR-Central Institute for Cotton Research (CICR), Nagpur",
    title: "Integrated Nutrient Management for Bt-Cotton in Vertisols of Central India",
    url: "https://icar.org.in/cicr-cotton-nutrient-management-2023",
    publishedAt: "2023-06-12T00:00:00Z",
    applicableCrop: "COTTON",
    applicableRegions: ["Maharashtra", "Gujarat", "Madhya Pradesh", "Central Zone"],
    applicableSoilTypes: ["BLACK_REGUR", "CLAY_LOAM"],
    growthStages: ["initial", "development", "mid_season"],
    keyTopics: ["NPK_SPLIT", "POTASSIUM_TIMING", "MAGNESIUM_DEFICIENCY"],
    excerpt:
      "In deep black soils (Vertisols), apply nitrogen in 3 splits (basal, square formation, and peak boll development). Potassium is crucial to prevent leaf reddening and square drop; 50% K2O at basal and 50% at boll development stage significantly enhances fiber strength and seed cotton yield.",
  },

  // 5. ICAR-DRMR - Mustard / Rapeseed Nutrient Management
  {
    id: "icar_drmr_mustard_pop_2024",
    tier: "TIER_1_PRIMARY",
    institution: "ICAR-Directorate of Rapeseed-Mustard Research (DRMR), Bharatpur",
    title: "Balanced Nutrition and Sulphur Fertilization in Rapeseed-Mustard",
    url: "https://icar.org.in/drmr-mustard-nutrient-guide-2024",
    publishedAt: "2024-08-10T00:00:00Z",
    applicableCrop: "MUSTARD",
    applicableRegions: ["Rajasthan", "Haryana", "Punjab", "Uttar Pradesh", "Madhya Pradesh"],
    applicableSoilTypes: ["ALLUVIAL", "SANDY_LOAM", "LOAM"],
    growthStages: ["initial", "development"],
    keyTopics: ["SULPHUR_REQUIREMENT", "NPK_SPLIT"],
    excerpt:
      "Mustard has a very high sulphur demand for oil synthesis. Apply 20-30 kg S/ha using Bentonite Sulphur (90% S) or Single Super Phosphate (SSP 11% S) basal at sowing. Nitrogen should be applied 50% basal and 50% at first irrigation (30 DAS).",
  },

  // 6. ICAR-IIMR - Maize Nutrient and Water Management
  {
    id: "icar_iimr_maize_pop_2023",
    tier: "TIER_1_PRIMARY",
    institution: "ICAR-Indian Institute of Maize Research (IIMR), Ludhiana",
    title: "Best Management Practices for Hybrid Maize in Indo-Gangetic Plains",
    url: "https://icar.org.in/iimr-maize-bmp-guide-2023",
    publishedAt: "2023-04-18T00:00:00Z",
    applicableCrop: "MAIZE",
    applicableRegions: ["Punjab", "Bihar", "Karnataka", "Telangana", "ALL_INDIA"],
    applicableSoilTypes: ["ALLUVIAL", "RED", "LOAM"],
    growthStages: ["initial", "development", "mid_season"],
    keyTopics: ["NPK_SPLIT", "ZINC_MANAGEMENT", "IRRIGATION_TASSELING"],
    excerpt:
      "For high-yielding hybrid maize, apply Nitrogen in three splits: 20% basal, 50% at knee-high stage (V6), and 30% at tasseling (VT). Avoid waterlogging during vegetative stage and water stress during silking.",
  },

  // 7. FAO - General Soil Fertility & Crop Water Management (Tier 1 International)
  {
    id: "fao_56_irrigation_crop_water_guidelines",
    tier: "TIER_1_PRIMARY",
    institution: "Food and Agriculture Organization of the United Nations (FAO)",
    title: "FAO Irrigation and Drainage Paper No. 56: Crop Evapotranspiration",
    url: "https://fao.org/land-water/databases-software/cropwat/en",
    publishedAt: "2022-01-01T00:00:00Z",
    applicableCrop: "ALL_CROPS",
    applicableRegions: ["ALL_INDIA", "GLOBAL"],
    applicableSoilTypes: ["ANY"],
    keyTopics: ["WATER_MANAGEMENT", "EVAPOTRANSPIRATION"],
    excerpt:
      "Evapotranspiration demand varies with crop growth stages. Peak water stress sensitivity occurs during critical reproductive stages (flowering and grain-filling). Soil moisture deficit during these phases causes irreversible yield reduction.",
  },
];

export class AgriculturalKnowledgeRetriever {
  private readonly sourceRegistry: SourceRegistry;

  constructor(sourceRegistry?: SourceRegistry) {
    this.sourceRegistry = sourceRegistry || new SourceRegistry();
  }

  /**
   * Retrieves contextual agricultural evidence applicable to the farmer's specific field,
   * crop, location, soil type, and growth stage. Populates EvidenceManager.
   */
  public retrieveContextualEvidence(
    context: RetrievalContext,
    evidenceManager: EvidenceManager
  ): RetrievalResult {
    const normalizedCrop = context.crop.toUpperCase().trim();
    const normalizedState = context.state?.trim().toLowerCase();
    const normalizedSoilType = context.soilType?.toUpperCase().trim();

    let regionalMatchFound = false;
    let regionalWarning: string | undefined;

    // Filter documents strictly from authoritative knowledge base
    const eligibleDocs = AUTHORITATIVE_AGRONOMIC_KNOWLEDGE.filter((doc) => {
      // 1. Crop Match (Crop specific or ALL_CROPS)
      const cropMatches =
        doc.applicableCrop === "ALL_CROPS" ||
        doc.applicableCrop === normalizedCrop ||
        (normalizedCrop.includes("WHEAT") && doc.applicableCrop === "WHEAT") ||
        (normalizedCrop.includes("RICE") && doc.applicableCrop === "RICE") ||
        (normalizedCrop.includes("COTTON") && doc.applicableCrop === "COTTON") ||
        (normalizedCrop.includes("MAIZE") && doc.applicableCrop === "MAIZE") ||
        (normalizedCrop.includes("MUSTARD") && doc.applicableCrop === "MUSTARD");

      if (!cropMatches) return false;

      // 2. Region Match
      let regionMatches = false;
      if (doc.applicableRegions.includes("ALL_INDIA") || doc.applicableRegions.includes("GLOBAL")) {
        regionMatches = true;
      } else if (normalizedState) {
        regionMatches = doc.applicableRegions.some(
          (reg) =>
            reg.toLowerCase().includes(normalizedState) ||
            normalizedState.includes(reg.toLowerCase())
        );
      } else {
        // If state is not specified, include general/all-india documents
        regionMatches = true;
      }

      if (regionMatches && !doc.applicableRegions.includes("ALL_INDIA")) {
        regionalMatchFound = true;
      }

      // 3. Soil Type Match
      let soilMatches = true;
      if (normalizedSoilType && !doc.applicableSoilTypes.includes("ANY")) {
        soilMatches = doc.applicableSoilTypes.some(
          (st) => st === normalizedSoilType || st.includes(normalizedSoilType)
        );
      }

      return regionMatches && soilMatches;
    });

    // Check regional warning: If user has a specified state, but no region-specific doc was found
    if (normalizedState && !regionalMatchFound && eligibleDocs.length > 0) {
      regionalWarning = `Note: State-specific Package of Practices for '${context.state}' could not be matched directly; general national ICAR/FAO guidelines have been referenced.`;
    }

    // Convert matching documents into Evidence items in the EvidenceManager
    const retrievedEvidence: Evidence[] = [];

    for (const doc of eligibleDocs) {
      // Check if domain is approved in SourceRegistry
      const urlHost = new URL(doc.url).hostname;
      if (!this.sourceRegistry.isDomainApproved(urlHost)) {
        continue;
      }

      const evidenceItem = evidenceManager.register({
        taskId: "task-advisory",
        sourceUri: doc.url,
        sourceTitle: `${doc.institution}: ${doc.title}`,
        publisher: doc.institution,
        excerpt: doc.excerpt,
        evidenceType: "RESEARCH_DOCUMENT",
        publishedAt: doc.publishedAt,
        researchQuery: `${context.crop} ${context.state || ""} ${context.soilType || ""}`,
        retrievalMethod: "agricultural_knowledge_retriever",
        isUntrusted: true,
      });

      retrievedEvidence.push(evidenceItem);
    }

    return {
      evidence: retrievedEvidence,
      matchedDocumentsCount: retrievedEvidence.length,
      regionalMatchFound,
      regionalWarning,
    };
  }
}
