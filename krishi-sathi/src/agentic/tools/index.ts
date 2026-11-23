export * from "./registry";
export * from "./builtins/openMeteoWeather";
export * from "./builtins/agriculturalKnowledge";
export * from "./builtins/cropWaterBalanceTool";
export * from "./builtins/soilNutrientTool";

import { ToolRegistry } from "./registry";
import { weatherLookupTool } from "./builtins/openMeteoWeather";
import { agriculturalKnowledgeTool } from "./builtins/agriculturalKnowledge";
import { cropWaterBalanceTool } from "./builtins/cropWaterBalanceTool";

/**
 * Creates a pre-populated ToolRegistry with standard M1.2 read-only agricultural tools:
 * - weather.lookup (Open-Meteo live observation & forecast client)
 * - crop.knowledge.lookup (SSRF-safe agricultural document retriever from ICAR/PAU/FAO)
 * - crop.water.balance (Authoritative FAO-56 deterministic crop water demand engine)
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(weatherLookupTool);
  registry.register(agriculturalKnowledgeTool);
  registry.register(cropWaterBalanceTool);
  return registry;
}
