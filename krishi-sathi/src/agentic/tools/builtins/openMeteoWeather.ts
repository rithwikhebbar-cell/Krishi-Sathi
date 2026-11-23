import { z } from "zod";
import { ToolDefinition } from "../../contracts/types";
import { OpenMeteoClient } from "../../weather/openMeteoClient";

export const WeatherLookupInputSchema = z.object({
  location: z.string().trim().min(2, "Location must be at least 2 characters").optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  days: z.number().int().min(1).max(14).default(3),
  timezone: z.string().optional(),
}).refine(
  (data) => data.location || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either location name or both latitude and longitude must be provided." }
);

export const WeatherLookupOutputSchema = z.object({
  locationName: z.string(),
  adminRegion: z.string().optional(),
  country: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
    elevationMeters: z.number().optional(),
  }),
  timezone: z.string(),
  retrievedAt: z.string(),
  provider: z.string(),
  units: z.record(z.string(), z.string()),
  currentConditions: z
    .object({
      time: z.string(),
      temperatureC: z.number(),
      relativeHumidityPercent: z.number(),
      precipitationMm: z.number(),
      rainMm: z.number(),
      windSpeedKmh: z.number(),
      windDirectionDegrees: z.number(),
      weatherCode: z.number(),
      weatherDescription: z.string(),
    })
    .optional(),
  dailyForecast: z.array(
    z.object({
      date: z.string(),
      tempMaxC: z.number(),
      tempMinC: z.number(),
      precipitationSumMm: z.number(),
      precipitationProbabilityPercent: z.number(),
      windSpeedMaxKmh: z.number(),
      sunrise: z.string().optional(),
      sunset: z.string().optional(),
      et0EvapotranspirationMm: z.number().optional(),
    })
  ),
  hourlySummary: z
    .object({
      hoursCount: z.number(),
      avgTempC: z.number(),
      totalPrecipitationMm: z.number(),
      maxPrecipitationProbability: z.number(),
      avgEt0Mm: z.number().optional(),
    })
    .optional(),
  dataCompleteness: z.object({
    hasCurrent: z.boolean(),
    hasDaily: z.boolean(),
    hasHourly: z.boolean(),
    isAmbiguousLocation: z.boolean(),
    alternativeLocations: z
      .array(
        z.object({
          name: z.string(),
          region: z.string().optional(),
          country: z.string().optional(),
        })
      )
      .optional(),
  }),
});

export type WeatherLookupInput = z.infer<typeof WeatherLookupInputSchema>;
export type WeatherLookupOutput = z.infer<typeof WeatherLookupOutputSchema>;

/**
 * Creates the production-quality Open-Meteo weather research tool.
 * Can be initialized with a mock client or custom options for unit testing.
 */
export function createWeatherLookupTool(client = new OpenMeteoClient()): ToolDefinition<WeatherLookupInput, WeatherLookupOutput> {
  return {
    name: "weather.lookup",
    description: "Retrieves live weather conditions, numerical forecasts, precipitation probabilities, and FAO reference evapotranspiration (ET0) from Open-Meteo.",
    permission: "READ_ONLY",
    timeoutMs: 10_000,
    retryPolicy: { maxRetries: 2, backoffMs: 300 },
    inputSchema: WeatherLookupInputSchema,
    outputSchema: WeatherLookupOutputSchema,
    execute: async (input, context) => {
      return await client.resolveAndFetchWeather(input, context?.signal);
    },
  };
}

export const weatherLookupTool = createWeatherLookupTool();
