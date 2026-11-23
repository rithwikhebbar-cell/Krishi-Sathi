import { ToolDefinition } from "../../contracts/types";
import { SoilNutrientEngine } from "../../engines/soilNutrientEngine";
import {
  CropNutrientRequirementInput,
  CropNutrientRequirementInputSchema,
  CropNutrientOutput,
  CropNutrientOutputSchema,
} from "../../contracts/soil/nutrientTypes";

/**
 * Creates the deterministic Soil Nutrient & Fertilizer Recommendation Calculation Tool.
 * Prepared for registration as 'soil.nutrient.calculate'.
 */
export function createSoilNutrientTool(
  engine = new SoilNutrientEngine()
): ToolDefinition<CropNutrientRequirementInput, CropNutrientOutput> {
  return {
    name: "soil.nutrient.calculate",
    description:
      "Authoritative deterministic STCR-based calculation of crop-specific nutrient requirements, fertilizer doses (Urea, DAP, MOP, SSP, Zinc Sulphate), and growth-stage split schedules.",
    permission: "READ_ONLY",
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 }, // Deterministic calculation: no retries needed
    inputSchema: CropNutrientRequirementInputSchema,
    outputSchema: CropNutrientOutputSchema,
    execute: async (input) => {
      return engine.calculate(input);
    },
  };
}

export const soilNutrientTool = createSoilNutrientTool();
