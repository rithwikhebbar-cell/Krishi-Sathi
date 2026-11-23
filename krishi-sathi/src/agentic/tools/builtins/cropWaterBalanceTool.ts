import { ToolDefinition } from "../../contracts/types";
import { CropWaterDemandEngine } from "../../engines/cropWaterEngine";
import { CropWaterInput, CropWaterInputSchema, CropWaterOutput, CropWaterOutputSchema } from "../../engines/types";

/**
 * Creates the deterministic Crop Water Requirement & Irrigation Calculation Tool.
 */
export function createCropWaterBalanceTool(
  engine = new CropWaterDemandEngine()
): ToolDefinition<CropWaterInput, CropWaterOutput> {
  return {
    name: "crop.water.balance",
    description: "Authoritative deterministic FAO-56 calculation of crop water demand (ETc), effective precipitation, and net irrigation requirements in mm and Liters.",
    permission: "READ_ONLY",
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 }, // Deterministic calculation: no retries needed
    inputSchema: CropWaterInputSchema,
    outputSchema: CropWaterOutputSchema,
    execute: async (input) => {
      return engine.calculate(input);
    },
  };
}

export const cropWaterBalanceTool = createCropWaterBalanceTool();
