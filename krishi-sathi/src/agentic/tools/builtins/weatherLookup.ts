import { z } from "zod";
import { ToolDefinition } from "../../contracts/types";

export const WeatherLookupInputSchema = z.object({
  location: z.string().trim().min(2, "Location must be at least 2 characters"),
  days: z.number().int().min(1).max(7).default(3),
});

export const WeatherLookupOutputSchema = z.object({
  location: z.string(),
  temperatureC: z.number(),
  humidityPercent: z.number(),
  conditions: z.string(),
  rainfallProbabilityPercent: z.number(),
  source: z.string(),
  fetchedAt: z.string(),
});

export type WeatherLookupInput = z.infer<typeof WeatherLookupInputSchema>;
export type WeatherLookupOutput = z.infer<typeof WeatherLookupOutputSchema>;

export const weatherLookupTool: ToolDefinition<WeatherLookupInput, WeatherLookupOutput> = {
  name: "weather.lookup",
  description: "Fetches agricultural weather data and rainfall forecasts for a given location",
  permission: "READ_ONLY",
  timeoutMs: 5000,
  retryPolicy: { maxRetries: 2, backoffMs: 200 },
  inputSchema: WeatherLookupInputSchema,
  outputSchema: WeatherLookupOutputSchema,
  execute: async (input) => {
    // Deterministic simulation based on location hash
    const locLower = input.location.toLowerCase();
    const isDry = locLower.includes("dry") || locLower.includes("desert") || locLower.includes("rajasthan");
    const isWet = locLower.includes("kerala") || locLower.includes("punjab") || locLower.includes("monsoon");

    return {
      location: input.location,
      temperatureC: isDry ? 34.5 : isWet ? 26.2 : 28.0,
      humidityPercent: isDry ? 35 : isWet ? 82 : 60,
      conditions: isDry ? "Sunny and dry" : isWet ? "Humid with moderate rain showers" : "Partly cloudy",
      rainfallProbabilityPercent: isDry ? 10 : isWet ? 75 : 30,
      source: "Open-Meteo Agricultural Archive (Deterministic Fixture)",
      fetchedAt: new Date().toISOString(),
    };
  },
};
