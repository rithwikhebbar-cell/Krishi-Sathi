import {
  AgriculturalAdvisory,
  GenerateAdvisoryInput,
  GenerateAdvisoryInputSchema,
} from "../contracts/soil/advisoryTypes";
import { SoilRepository } from "./soilRepository";
import { SoilNutrientEngine } from "../engines/soilNutrientEngine";
import { CropWaterDemandEngine, CROP_COEFFICIENTS } from "../engines/cropWaterEngine";
import { CropWaterOutput } from "../engines/types";
import { OpenMeteoClient } from "../weather/openMeteoClient";
import { AgriculturalKnowledgeRetriever } from "./agriculturalKnowledgeRetriever";
import { AgriculturalAdvisoryService } from "./agriculturalAdvisoryService";
import { EvidenceManager } from "../evidence/evidenceManager";
import { createDefaultModelProvider } from "../providers";
import { ModelProvider } from "../providers/types";
import { ValidationError, UnauthorizedError, NotFoundError } from "../contracts/errors";

export interface IntelligenceServiceOptions {
  repository?: SoilRepository;
  nutrientEngine?: SoilNutrientEngine;
  cropWaterEngine?: CropWaterDemandEngine;
  knowledgeRetriever?: AgriculturalKnowledgeRetriever;
  advisoryService?: AgriculturalAdvisoryService;
  weatherClient?: OpenMeteoClient;
  modelProvider?: ModelProvider;
}

export class AgriculturalIntelligenceService {
  private readonly repository: SoilRepository;
  private readonly nutrientEngine: SoilNutrientEngine;
  private readonly cropWaterEngine: CropWaterDemandEngine;
  private readonly knowledgeRetriever: AgriculturalKnowledgeRetriever;
  private readonly advisoryService: AgriculturalAdvisoryService;
  private readonly weatherClient: OpenMeteoClient;
  private readonly modelProvider: ModelProvider;

  constructor(options: IntelligenceServiceOptions = {}) {
    this.repository = options.repository || new SoilRepository();
    this.nutrientEngine = options.nutrientEngine || new SoilNutrientEngine();
    this.cropWaterEngine = options.cropWaterEngine || new CropWaterDemandEngine();
    this.knowledgeRetriever = options.knowledgeRetriever || new AgriculturalKnowledgeRetriever();
    this.advisoryService = options.advisoryService || new AgriculturalAdvisoryService();
    this.weatherClient = options.weatherClient || new OpenMeteoClient();
    this.modelProvider = options.modelProvider || createDefaultModelProvider();
  }

  /**
   * Orchestrates the complete Agricultural Intelligence pipeline:
   * 1. Field & farmer authorization
   * 2. Active approved soil profile retrieval
   * 3. Deterministic nutrient calculation
   * 4. Crop-water balance calculation
   * 5. Weather context retrieval
   * 6. Contextual agricultural evidence retrieval (Tier 1/2 ICAR/SAU/FAO)
   * 7. Gemini advisory synthesis
   * 8. Output integrity validation & confidence scoring
   * 9. Advisory persistence
   */
  public async generateAdvisory(
    inputCandidate: GenerateAdvisoryInput,
    farmerId: string
  ): Promise<AgriculturalAdvisory> {
    const parsedInput = GenerateAdvisoryInputSchema.parse(inputCandidate);

    // 1. Retrieve Field and Assert Farmer Ownership
    const field = await this.repository.getFieldOrThrow(parsedInput.fieldId);
    if (field.farmerId !== farmerId && farmerId !== "system-admin") {
      throw new UnauthorizedError(
        `Farmer '${farmerId}' is not authorized to generate advisories for field '${field.id}' belonging to '${field.farmerId}'.`
      );
    }

    // 2. Retrieve Active Approved Soil Profile
    const activeSoilProfile = field.activeSoilProfile;
    if (!activeSoilProfile) {
      throw new ValidationError(
        `Field '${field.name}' (${field.id}) does not have an approved active soil profile. Upload and approve a laboratory soil test report first.`
      );
    }

    // 3. Deterministic Soil Nutrient Engine Calculation
    const nutrientCalculation = this.nutrientEngine.calculate({
      fieldId: field.id,
      cropName: parsedInput.cropName,
      cropVariety: parsedInput.cropVariety,
      targetYieldQuintalsPerHa: parsedInput.targetYieldQuintalsPerHa,
      croppingSeason: parsedInput.croppingSeason as any,
      isIrrigated: true,
      organicManureTonnesPerHa: parsedInput.organicManureTonnesPerHa || 0,
      greenManuringDone: parsedInput.greenManuringDone || false,
      previousCropLegume: parsedInput.previousCropLegume || false,
      stateOrRegion: field.location.state,
      soilParameters: activeSoilProfile.parameters,
    });

    // 4. Crop-Water Balance Assessment (FAO-56)
    let cropWaterAssessment: CropWaterOutput | undefined;
    const normalizedCropKey = parsedInput.cropName.toLowerCase();
    const isSupportedCrop = Object.keys(CROP_COEFFICIENTS).some((c) => normalizedCropKey.includes(c));

    // Determine field area in hectares (1 acre = 0.404686 hectares)
    const fieldAreaHectares = Math.round(field.areaAcres * 0.404686 * 100) / 100;

    let referenceEt0 = 4.5; // Standard default reference ET0 mm/day
    let forecastRainfall = 0.0;
    let weatherSummaryText = `Normal seasonal weather in ${field.location.district || field.location.state}.`;

    // 5. Weather Context Integration
    try {
      const locationQuery = `${field.location.district || ""}, ${field.location.state}, India`;
      const geocoding = await this.weatherClient.geocode(locationQuery);
      if (geocoding && geocoding.length > 0) {
        const topLoc = geocoding[0];
        const forecast = await this.weatherClient.getForecast({
          latitude: topLoc.latitude,
          longitude: topLoc.longitude,
          timezone: "auto",
          forecastDays: 3,
        });

        if (forecast && forecast.daily) {
          const rainSum = forecast.daily.precipitation_sum?.[0] || 0;
          forecastRainfall = rainSum;
          const maxTemp = forecast.daily.temperature_2m_max?.[0];
          const minTemp = forecast.daily.temperature_2m_min?.[0];
          weatherSummaryText = `3-day forecast for ${topLoc.name}: Max ${maxTemp}°C, Min ${minTemp}°C, Expected rainfall: ${forecastRainfall} mm.`;
        }
      }
    } catch {
      // Non-blocking fallback to seasonal defaults if weather feed is unreachable
    }

    if (isSupportedCrop) {
      const matchedCrop = (Object.keys(CROP_COEFFICIENTS).find((c) => normalizedCropKey.includes(c)) ||
        "wheat") as keyof typeof CROP_COEFFICIENTS;

      const mappedSoilType: "sandy" | "loamy" | "clayey" | "alluvial" =
        field.primarySoilType === "ALLUVIAL"
          ? "alluvial"
          : field.primaryTextureClass === "SANDY_LOAM" || field.primaryTextureClass === "SAND"
          ? "sandy"
          : field.primaryTextureClass === "CLAY" || field.primaryTextureClass === "CLAY_LOAM"
          ? "clayey"
          : "loamy";

      cropWaterAssessment = this.cropWaterEngine.calculate({
        crop: matchedCrop,
        growthStage: parsedInput.growthStage || "initial",
        referenceEvapotranspirationMmDay: referenceEt0,
        forecastRainfallMm: forecastRainfall,
        soilType: mappedSoilType,
        fieldAreaHectares: Math.max(0.1, fieldAreaHectares),
      });
    }

    // 6. Contextual Agricultural Evidence Retrieval
    const evidenceManager = new EvidenceManager(25);
    const retrievalResult = this.knowledgeRetriever.retrieveContextualEvidence(
      {
        crop: parsedInput.cropName,
        cropVariety: parsedInput.cropVariety,
        state: field.location.state,
        district: field.location.district,
        soilType: field.primarySoilType,
        growthStage: parsedInput.growthStage,
        targetYield: parsedInput.targetYieldQuintalsPerHa,
      },
      evidenceManager
    );

    // 7. Gemini Advisory Synthesis & Output Integrity Validation
    const advisory = await this.advisoryService.synthesize({
      field,
      soilProfile: activeSoilProfile,
      calculation: nutrientCalculation,
      cropWaterAssessment,
      weatherSummary: weatherSummaryText,
      evidence: retrievalResult.evidence,
      evidenceManager,
      retrievalResult,
      modelProvider: this.modelProvider,
      input: parsedInput,
    });

    // 8. Persist Generated Advisory in Repository
    await this.repository.saveAdvisory(advisory);

    return advisory;
  }
}
