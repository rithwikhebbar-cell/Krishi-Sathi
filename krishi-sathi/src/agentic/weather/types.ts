import { z } from "zod";

export const GeocodingLocationSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevation: z.number().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  admin1: z.string().optional(), // State / Province
  admin2: z.string().optional(), // District
  timezone: z.string().optional(),
});

export type GeocodingLocation = z.infer<typeof GeocodingLocationSchema>;

export const GeocodingApiResponseSchema = z.object({
  results: z.array(GeocodingLocationSchema).optional(),
  generationtime_ms: z.number().optional(),
});

export const WeatherForecastParamsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().default("auto"),
  forecastDays: z.number().int().min(1).max(14).default(3),
  current: z.array(z.string()).optional(),
  hourly: z.array(z.string()).optional(),
  daily: z.array(z.string()).optional(),
});

export type WeatherForecastParams = z.infer<typeof WeatherForecastParamsSchema>;

export const WeatherApiResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  generationtime_ms: z.number().optional(),
  utc_offset_seconds: z.number().optional(),
  timezone: z.string().optional(),
  timezone_abbreviation: z.string().optional(),
  current: z
    .object({
      time: z.string(),
      temperature_2m: z.number().optional(),
      relative_humidity_2m: z.number().optional(),
      precipitation: z.number().optional(),
      rain: z.number().optional(),
      weather_code: z.number().optional(),
      wind_speed_10m: z.number().optional(),
      wind_direction_10m: z.number().optional(),
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string()),
      temperature_2m: z.array(z.number().nullable()).optional(),
      relative_humidity_2m: z.array(z.number().nullable()).optional(),
      precipitation_probability: z.array(z.number().nullable()).optional(),
      precipitation: z.array(z.number().nullable()).optional(),
      rain: z.array(z.number().nullable()).optional(),
      wind_speed_10m: z.array(z.number().nullable()).optional(),
      et0_fao_evapotranspiration: z.array(z.number().nullable()).optional(),
    })
    .optional(),
  daily: z
    .object({
      time: z.array(z.string()),
      temperature_2m_max: z.array(z.number().nullable()).optional(),
      temperature_2m_min: z.array(z.number().nullable()).optional(),
      precipitation_sum: z.array(z.number().nullable()).optional(),
      precipitation_probability_max: z.array(z.number().nullable()).optional(),
      wind_speed_10m_max: z.array(z.number().nullable()).optional(),
      sunrise: z.array(z.string()).optional(),
      sunset: z.array(z.string()).optional(),
      et0_fao_evapotranspiration: z.array(z.number().nullable()).optional(),
    })
    .optional(),
});

export type WeatherApiResponse = z.infer<typeof WeatherApiResponseSchema>;

export interface NormalizedWeatherData {
  locationName: string;
  adminRegion?: string;
  country?: string;
  coordinates: {
    latitude: number;
    longitude: number;
    elevationMeters?: number;
  };
  timezone: string;
  retrievedAt: string;
  provider: string;
  units: Record<string, string>;
  currentConditions?: {
    time: string;
    temperatureC: number;
    relativeHumidityPercent: number;
    precipitationMm: number;
    rainMm: number;
    windSpeedKmh: number;
    windDirectionDegrees: number;
    weatherCode: number;
    weatherDescription: string;
  };
  dailyForecast: Array<{
    date: string;
    tempMaxC: number;
    tempMinC: number;
    precipitationSumMm: number;
    precipitationProbabilityPercent: number;
    windSpeedMaxKmh: number;
    sunrise?: string;
    sunset?: string;
    et0EvapotranspirationMm?: number;
  }>;
  hourlySummary?: {
    hoursCount: number;
    avgTempC: number;
    totalPrecipitationMm: number;
    maxPrecipitationProbability: number;
    avgEt0Mm?: number;
  };
  dataCompleteness: {
    hasCurrent: boolean;
    hasDaily: boolean;
    hasHourly: boolean;
    isAmbiguousLocation: boolean;
    alternativeLocations?: Array<{ name: string; region?: string; country?: string }>;
  };
}
