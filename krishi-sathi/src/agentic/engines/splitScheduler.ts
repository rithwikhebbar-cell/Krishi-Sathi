import {
  NutrientSplitApplicationSchedule,
  FertilizerProductRecommendation,
} from "../contracts/soil/nutrientTypes";

export class SplitScheduler {
  /**
   * Generates crop-specific, growth-stage-aware split application schedules.
   * Based on Punjab Agricultural University (PAU), ICAR, and TNAU agronomic packages of practices.
   */
  public static generateSchedule(
    crop: string,
    fertilizers: FertilizerProductRecommendation[]
  ): {
    schedules: NutrientSplitApplicationSchedule[];
    limitations: string[];
  } {
    const normCrop = crop.trim().toLowerCase();
    const schedules: NutrientSplitApplicationSchedule[] = [];
    const limitations: string[] = [];

    const urea = fertilizers.find((f) => f.productCode === "UREA");
    const dap = fertilizers.find((f) => f.productCode === "DAP");
    const mop = fertilizers.find((f) => f.productCode === "MOP");
    const ssp = fertilizers.find((f) => f.productCode === "SSP");
    const zn = fertilizers.find(
      (f) =>
        f.productCode === "ZINC_SULPHATE_HEPTAHYDRATE_21" ||
        f.productCode === "ZINC_SULPHATE_MONOHYDRATE_33"
    );

    const ureaHa = urea?.quantityKgPerHa || 0;
    const ureaAcre = urea?.quantityKgPerAcre || 0;
    const dapHa = dap?.quantityKgPerHa || 0;
    const dapAcre = dap?.quantityKgPerAcre || 0;
    const mopHa = mop?.quantityKgPerHa || 0;
    const mopAcre = mop?.quantityKgPerAcre || 0;
    const sspHa = ssp?.quantityKgPerHa || 0;
    const sspAcre = ssp?.quantityKgPerAcre || 0;
    const znHa = zn?.quantityKgPerHa || 0;
    const znAcre = zn?.quantityKgPerAcre || 0;

    switch (normCrop) {
      case "wheat": {
        // Wheat: 1/3 N + all P + all K basal; 1/3 N at CRI (21-25 DAS); 1/3 N at Jointing/Tillering (40-45 DAS)
        const basalUreaHa = Math.round((ureaHa / 3) * 10) / 10;
        const basalUreaAcre = Math.round((ureaAcre / 3) * 10) / 10;
        const criUreaHa = Math.round((ureaHa / 3) * 10) / 10;
        const criUreaAcre = Math.round((ureaAcre / 3) * 10) / 10;
        const lateUreaHa = Math.max(0, Math.round((ureaHa - basalUreaHa - criUreaHa) * 10) / 10);
        const lateUreaAcre = Math.max(0, Math.round((ureaAcre - basalUreaAcre - criUreaAcre) * 10) / 10);

        const basalFertilizers = [];
        if (dap && dapHa > 0) {
          basalFertilizers.push({
            productCode: dap.productCode,
            commercialName: dap.commercialName,
            quantityKgPerHa: dapHa,
            quantityKgPerAcre: dapAcre,
            applicationGuidance: "Drill 5 cm below seed level during final land preparation or sowing.",
          });
        }
        if (ssp && sspHa > 0) {
          basalFertilizers.push({
            productCode: ssp.productCode,
            commercialName: ssp.commercialName,
            quantityKgPerHa: sspHa,
            quantityKgPerAcre: sspAcre,
            applicationGuidance: "Incorporate into soil before sowing.",
          });
        }
        if (mop && mopHa > 0) {
          basalFertilizers.push({
            productCode: mop.productCode,
            commercialName: mop.commercialName,
            quantityKgPerHa: mopHa,
            quantityKgPerAcre: mopAcre,
            applicationGuidance: "Broadcast and mix thoroughly during last ploughing.",
          });
        }
        if (basalUreaHa > 0) {
          basalFertilizers.push({
            productCode: "UREA" as const,
            commercialName: "Neem Coated Urea (46% N)",
            quantityKgPerHa: basalUreaHa,
            quantityKgPerAcre: basalUreaAcre,
            applicationGuidance: "Apply as starter nitrogen dose at sowing.",
          });
        }

        schedules.push({
          stageCode: "BASAL_AT_SOWING",
          stageTitle: "Basal Application (At Sowing)",
          timingDescription: "0 DAS (At Sowing / Drilling)",
          soilMoistureRequirement: "Adequate moisture for seed germination (Rauni irrigation)",
          fertilizers: basalFertilizers,
          agronomicRationale:
            "Full phosphorus and potassium placement promotes early seminal root development and seedling cold tolerance.",
        });

        if (criUreaHa > 0) {
          schedules.push({
            stageCode: "EARLY_VEGETATIVE_TILLERING",
            stageTitle: "First Top Dressing (Crown Root Initiation / CRI)",
            timingDescription: "21 - 25 DAS (Immediately before or after 1st irrigation)",
            soilMoistureRequirement: "Apply in moist soil or just prior to first irrigation",
            fertilizers: [
              {
                productCode: "UREA",
                commercialName: "Neem Coated Urea (46% N)",
                quantityKgPerHa: criUreaHa,
                quantityKgPerAcre: criUreaAcre,
                applicationGuidance: "Broadcast evenly across the field when leaves are dry.",
              },
            ],
            agronomicRationale:
              "CRI is the most critical physiological stage for wheat yield determination. Nitrogen deficiency here permanently limits tiller count.",
          });
        }

        if (lateUreaHa > 0) {
          schedules.push({
            stageCode: "TOP_DRESSING_SECOND",
            stageTitle: "Second Top Dressing (Jointing / Stem Elongation)",
            timingDescription: "40 - 45 DAS (With 2nd irrigation)",
            soilMoistureRequirement: "Irrigated soil condition",
            fertilizers: [
              {
                productCode: "UREA",
                commercialName: "Neem Coated Urea (46% N)",
                quantityKgPerHa: lateUreaHa,
                quantityKgPerAcre: lateUreaAcre,
                applicationGuidance: "Broadcast uniformly before irrigation.",
              },
            ],
            agronomicRationale:
              "Supports spikelet formation and prevents tiller mortality during stem elongation.",
          });
        }
        break;
      }

      case "rice": {
        // Rice: Basal 1/3 N + all P + 50% K + Zn; 1/3 N at tillering (21 DAS); 1/3 N + 50% K at Panicle Initiation (42-45 DAS)
        const basalUreaHa = Math.round((ureaHa / 3) * 10) / 10;
        const basalUreaAcre = Math.round((ureaAcre / 3) * 10) / 10;
        const tilleringUreaHa = Math.round((ureaHa / 3) * 10) / 10;
        const tilleringUreaAcre = Math.round((ureaAcre / 3) * 10) / 10;
        const piUreaHa = Math.max(0, Math.round((ureaHa - basalUreaHa - tilleringUreaHa) * 10) / 10);
        const piUreaAcre = Math.max(0, Math.round((ureaAcre - basalUreaAcre - tilleringUreaAcre) * 10) / 10);

        const mopBasalHa = Math.round((mopHa / 2) * 10) / 10;
        const mopBasalAcre = Math.round((mopAcre / 2) * 10) / 10;
        const mopPiHa = Math.max(0, Math.round((mopHa - mopBasalHa) * 10) / 10);
        const mopPiAcre = Math.max(0, Math.round((mopAcre - mopBasalAcre) * 10) / 10);

        const basalFertilizers = [];
        if (dap && dapHa > 0) {
          basalFertilizers.push({
            productCode: dap.productCode,
            commercialName: dap.commercialName,
            quantityKgPerHa: dapHa,
            quantityKgPerAcre: dapAcre,
            applicationGuidance: "Incorporate into puddle soil at last puddling before transplanting.",
          });
        }
        if (mopBasalHa > 0) {
          basalFertilizers.push({
            productCode: "MOP" as const,
            commercialName: "Muriate of Potash (60% K2O)",
            quantityKgPerHa: mopBasalHa,
            quantityKgPerAcre: mopBasalAcre,
            applicationGuidance: "Mix thoroughly into mud during final puddling.",
          });
        }
        if (basalUreaHa > 0) {
          basalFertilizers.push({
            productCode: "UREA" as const,
            commercialName: "Neem Coated Urea (46% N)",
            quantityKgPerHa: basalUreaHa,
            quantityKgPerAcre: basalUreaAcre,
            applicationGuidance: "Incorporate basal nitrogen into reduced zone to minimize volatilization.",
          });
        }
        if (zn && znHa > 0) {
          basalFertilizers.push({
            productCode: zn.productCode,
            commercialName: zn.commercialName,
            quantityKgPerHa: znHa,
            quantityKgPerAcre: znAcre,
            applicationGuidance: "Broadcast separately at puddling. DO NOT mix in same bucket with DAP/SSP.",
          });
        }

        schedules.push({
          stageCode: "BASAL_AT_SOWING",
          stageTitle: "Basal Application (Transplanting / Puddling)",
          timingDescription: "0 DAT (At final puddling / transplanting)",
          soilMoistureRequirement: "Puddled soil with thin film of standing water (2 cm)",
          fertilizers: basalFertilizers,
          agronomicRationale:
            "Supplies starter N, full P, starter K and Zinc to combat transplanting shock and Khaira disease.",
        });

        if (tilleringUreaHa > 0) {
          schedules.push({
            stageCode: "EARLY_VEGETATIVE_TILLERING",
            stageTitle: "First Top Dressing (Active Tillering)",
            timingDescription: "21 - 25 DAT (Days after transplanting)",
            soilMoistureRequirement: "Drain standing water if possible; re-flood 24-48 hours after application",
            fertilizers: [
              {
                productCode: "UREA",
                commercialName: "Neem Coated Urea (46% N)",
                quantityKgPerHa: tilleringUreaHa,
                quantityKgPerAcre: tilleringUreaAcre,
                applicationGuidance: "Broadcast in afternoon when dew has dried from foliage.",
              },
            ],
            agronomicRationale: "Drives maximum productive tillering and leaf area index.",
          });
        }

        const piFertilizers = [];
        if (piUreaHa > 0) {
          piFertilizers.push({
            productCode: "UREA" as const,
            commercialName: "Neem Coated Urea (46% N)",
            quantityKgPerHa: piUreaHa,
            quantityKgPerAcre: piUreaAcre,
            applicationGuidance: "Broadcast evenly across flooded field.",
          });
        }
        if (mopPiHa > 0) {
          piFertilizers.push({
            productCode: "MOP" as const,
            commercialName: "Muriate of Potash (60% K2O)",
            quantityKgPerHa: mopPiHa,
            quantityKgPerAcre: mopPiAcre,
            applicationGuidance: "Broadcast split potassic dose with nitrogen.",
          });
        }

        if (piFertilizers.length > 0) {
          schedules.push({
            stageCode: "PANICLE_INITIATION_FLOWERING",
            stageTitle: "Second Top Dressing (Panicle Initiation)",
            timingDescription: "42 - 45 DAT (Panicle emergence in boot leaf)",
            soilMoistureRequirement: "Submerged soil condition (3-5 cm water)",
            fertilizers: piFertilizers,
            agronomicRationale:
              "Potassium and late nitrogen maximize spikelet fertility, reduce sterility, and improve grain filling.",
          });
        }
        break;
      }

      case "maize": {
        // Maize: 1/3 N + all P + all K + Zn basal; 1/3 N at Knee-high (30 DAS); 1/3 N at Tasseling (50-55 DAS)
        const basalUreaHa = Math.round((ureaHa / 3) * 10) / 10;
        const basalUreaAcre = Math.round((ureaAcre / 3) * 10) / 10;
        const kneeUreaHa = Math.round((ureaHa / 3) * 10) / 10;
        const kneeUreaAcre = Math.round((ureaAcre / 3) * 10) / 10;
        const tasselUreaHa = Math.max(0, Math.round((ureaHa - basalUreaHa - kneeUreaHa) * 10) / 10);
        const tasselUreaAcre = Math.max(0, Math.round((ureaAcre - basalUreaAcre - kneeUreaAcre) * 10) / 10);

        const basalFertilizers = [];
        if (dap && dapHa > 0) {
          basalFertilizers.push({
            productCode: dap.productCode,
            commercialName: dap.commercialName,
            quantityKgPerHa: dapHa,
            quantityKgPerAcre: dapAcre,
            applicationGuidance: "Band placement 5 cm to side and 5 cm below seed row.",
          });
        }
        if (mop && mopHa > 0) {
          basalFertilizers.push({
            productCode: mop.productCode,
            commercialName: mop.commercialName,
            quantityKgPerHa: mopHa,
            quantityKgPerAcre: mopAcre,
            applicationGuidance: "Band or broadcast at sowing.",
          });
        }
        if (basalUreaHa > 0) {
          basalFertilizers.push({
            productCode: "UREA" as const,
            commercialName: "Neem Coated Urea (46% N)",
            quantityKgPerHa: basalUreaHa,
            quantityKgPerAcre: basalUreaAcre,
            applicationGuidance: "Starter nitrogen placement.",
          });
        }
        if (zn && znHa > 0) {
          basalFertilizers.push({
            productCode: zn.productCode,
            commercialName: zn.commercialName,
            quantityKgPerHa: znHa,
            quantityKgPerAcre: znAcre,
            applicationGuidance: "Soil application at sowing. Do not place in seed furrow with DAP.",
          });
        }

        schedules.push({
          stageCode: "BASAL_AT_SOWING",
          stageTitle: "Basal Application (At Sowing)",
          timingDescription: "0 DAS (At Sowing)",
          soilMoistureRequirement: "Optimum seedbed moisture",
          fertilizers: basalFertilizers,
          agronomicRationale: "Establishes vigorous root system and supplies starter nutrients.",
        });

        if (kneeUreaHa > 0) {
          schedules.push({
            stageCode: "EARLY_VEGETATIVE_TILLERING",
            stageTitle: "First Side Dressing (Knee-High Stage)",
            timingDescription: "30 DAS (Knee-high plant stage)",
            soilMoistureRequirement: "Moist soil following rain or irrigation",
            fertilizers: [
              {
                productCode: "UREA",
                commercialName: "Neem Coated Urea (46% N)",
                quantityKgPerHa: kneeUreaHa,
                quantityKgPerAcre: kneeUreaAcre,
                applicationGuidance: "Band application along crop rows followed by earthing up.",
              },
            ],
            agronomicRationale: "Matches rapid nitrogen uptake phase and prevents lodging.",
          });
        }

        if (tasselUreaHa > 0) {
          schedules.push({
            stageCode: "PANICLE_INITIATION_FLOWERING",
            stageTitle: "Second Side Dressing (Tasseling / Silking)",
            timingDescription: "50 - 55 DAS (Tassel emergence)",
            soilMoistureRequirement: "Adequate moisture is essential during flowering",
            fertilizers: [
              {
                productCode: "UREA",
                commercialName: "Neem Coated Urea (46% N)",
                quantityKgPerHa: tasselUreaHa,
                quantityKgPerAcre: tasselUreaAcre,
                applicationGuidance: "Apply between rows before irrigation.",
              },
            ],
            agronomicRationale: "Supports cob size, kernel set and reduces tip barrenness.",
          });
        }
        break;
      }

      case "mustard": {
        // Mustard: 1/2 N + all P + all K + all S basal; 1/2 N at flowering (30 DAS)
        const basalUreaHa = Math.round((ureaHa / 2) * 10) / 10;
        const basalUreaAcre = Math.round((ureaAcre / 2) * 10) / 10;
        const topUreaHa = Math.max(0, Math.round((ureaHa - basalUreaHa) * 10) / 10);
        const topUreaAcre = Math.max(0, Math.round((ureaAcre - basalUreaAcre) * 10) / 10);

        const basalFertilizers = [];
        if (ssp && sspHa > 0) {
          basalFertilizers.push({
            productCode: ssp.productCode,
            commercialName: ssp.commercialName,
            quantityKgPerHa: sspHa,
            quantityKgPerAcre: sspAcre,
            applicationGuidance: "Incorporate into soil at final land preparation (supplies P, S, Ca).",
          });
        } else if (dap && dapHa > 0) {
          basalFertilizers.push({
            productCode: dap.productCode,
            commercialName: dap.commercialName,
            quantityKgPerHa: dapHa,
            quantityKgPerAcre: dapAcre,
            applicationGuidance: "Drill below seed at sowing.",
          });
        }
        if (mop && mopHa > 0) {
          basalFertilizers.push({
            productCode: mop.productCode,
            commercialName: mop.commercialName,
            quantityKgPerHa: mopHa,
            quantityKgPerAcre: mopAcre,
            applicationGuidance: "Broadcast at sowing.",
          });
        }
        if (basalUreaHa > 0) {
          basalFertilizers.push({
            productCode: "UREA" as const,
            commercialName: "Neem Coated Urea (46% N)",
            quantityKgPerHa: basalUreaHa,
            quantityKgPerAcre: basalUreaAcre,
            applicationGuidance: "Basal nitrogen dressing.",
          });
        }

        schedules.push({
          stageCode: "BASAL_AT_SOWING",
          stageTitle: "Basal Application (At Sowing)",
          timingDescription: "0 DAS (At Sowing)",
          soilMoistureRequirement: "Conserved soil moisture in seedbed",
          fertilizers: basalFertilizers,
          agronomicRationale: "Phosphorus, potassium and sulphur are essential at sowing for taproot and oil precursors.",
        });

        if (topUreaHa > 0) {
          schedules.push({
            stageCode: "EARLY_VEGETATIVE_TILLERING",
            stageTitle: "First Top Dressing (Flowering & Branching)",
            timingDescription: "30 DAS (Immediately after 1st irrigation)",
            soilMoistureRequirement: "Apply in vapsa (field capacity) condition after first irrigation",
            fertilizers: [
              {
                productCode: "UREA",
                commercialName: "Neem Coated Urea (46% N)",
                quantityKgPerHa: topUreaHa,
                quantityKgPerAcre: topUreaAcre,
                applicationGuidance: "Broadcast uniformly across field.",
              },
            ],
            agronomicRationale: "Drives primary and secondary branch development and siliqua counts.",
          });
        }
        break;
      }

      default: {
        limitations.push(
          `Crop '${crop}' does not have a validated growth-stage split schedule registered in the engine. Blanket commercial quantities are provided as total seasonal requirement.`
        );
        break;
      }
    }

    return { schedules, limitations };
  }
}
