import { describe, expect, it } from "vitest";
import { OpenMeteoClient, RateLimitError } from "../../src/agentic/weather/openMeteoClient";
import { createWeatherLookupTool } from "../../src/agentic/tools/builtins/openMeteoWeather";

describe("OpenMeteoClient and Weather Tool", () => {
  const mockGeocodingResponse = {
    results: [
      {
        id: 1,
        name: "Ludhiana",
        latitude: 30.901,
        longitude: 75.8573,
        country: "India",
        admin1: "Punjab",
        timezone: "Asia/Kolkata",
      },
      {
        id: 2,
        name: "Ludhiana East",
        latitude: 30.91,
        longitude: 75.89,
        country: "India",
        admin1: "Punjab",
        timezone: "Asia/Kolkata",
      },
    ],
  };

  const mockWeatherResponse = {
    latitude: 30.901,
    longitude: 75.8573,
    timezone: "Asia/Kolkata",
    current: {
      time: "2026-11-23T12:00",
      temperature_2m: 24.5,
      relative_humidity_2m: 55,
      precipitation: 0.0,
      rain: 0.0,
      wind_speed_10m: 8.5,
      wind_direction_10m: 180,
      weather_code: 1,
    },
    daily: {
      time: ["2026-11-23", "2026-11-24", "2026-11-25"],
      temperature_2m_max: [25.0, 26.0, 24.0],
      temperature_2m_min: [12.0, 13.0, 11.5],
      precipitation_sum: [0.0, 2.5, 0.0],
      precipitation_probability_max: [10, 45, 5],
      wind_speed_10m_max: [12.0, 15.0, 10.0],
      sunrise: ["06:50", "06:51", "06:52"],
      sunset: ["17:30", "17:30", "17:29"],
      et0_fao_evapotranspiration: [3.2, 3.5, 3.1],
    },
    hourly: {
      time: ["2026-11-23T00:00", "2026-11-23T01:00"],
      temperature_2m: [14.0, 13.5],
      relative_humidity_2m: [70, 72],
      precipitation: [0.0, 0.0],
      precipitation_probability: [0, 0],
      wind_speed_10m: [5.0, 4.5],
      et0_fao_evapotranspiration: [0.1, 0.1],
    },
  };

  it("resolves location and fetches normalized weather data", async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("geocoding-api.open-meteo.com")) {
        return new Response(JSON.stringify(mockGeocodingResponse), { status: 200 });
      }
      if (urlStr.includes("api.open-meteo.com/v1/forecast")) {
        return new Response(JSON.stringify(mockWeatherResponse), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const client = new OpenMeteoClient({ fetchFn: mockFetch as any });
    const weather = await client.resolveAndFetchWeather({ location: "Ludhiana" });

    expect(weather.locationName).toBe("Ludhiana");
    expect(weather.adminRegion).toBe("Punjab");
    expect(weather.coordinates.latitude).toBe(30.901);
    expect(weather.currentConditions?.temperatureC).toBe(24.5);
    expect(weather.currentConditions?.weatherDescription).toBe("Mainly clear");
    expect(weather.dailyForecast).toHaveLength(3);
    expect(weather.dailyForecast[0].et0EvapotranspirationMm).toBe(3.2);
    expect(weather.dataCompleteness.isAmbiguousLocation).toBe(true);
    expect(weather.dataCompleteness.alternativeLocations).toHaveLength(1);
  });

  it("handles missing locations by throwing a ValidationError", async () => {
    const mockFetch = async () => new Response(JSON.stringify({ results: [] }), { status: 200 });
    const client = new OpenMeteoClient({ fetchFn: mockFetch as any });

    await expect(client.resolveAndFetchWeather({ location: "UnknownNonexistentCity" })).rejects.toThrow(
      /could not be resolved/
    );
  });

  it("handles rate limiting (HTTP 429) cleanly with RateLimitError", async () => {
    const mockFetch = async () =>
      new Response("Rate limit exceeded", {
        status: 429,
        headers: { "retry-after": "10" },
      });

    const client = new OpenMeteoClient({ fetchFn: mockFetch as any, maxRetries: 0 });
    await expect(client.geocode("Ludhiana")).rejects.toThrow(RateLimitError);
  });

  it("retries on retryable 500 server errors and succeeds when server recovers", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Internal Server Error", { status: 502 });
      }
      return new Response(JSON.stringify(mockGeocodingResponse), { status: 200 });
    };

    const client = new OpenMeteoClient({ fetchFn: mockFetch as any, maxRetries: 2 });
    const result = await client.geocode("Ludhiana");
    expect(result).toHaveLength(2);
    expect(callCount).toBe(2);
  });

  it("integrates with the weatherLookupTool contract", async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("geocoding")) return new Response(JSON.stringify(mockGeocodingResponse));
      return new Response(JSON.stringify(mockWeatherResponse));
    };

    const tool = createWeatherLookupTool(new OpenMeteoClient({ fetchFn: mockFetch as any }));
    const output = await tool.execute({ location: "Ludhiana", days: 3 });

    expect(output.locationName).toBe("Ludhiana");
    expect(output.provider).toContain("Open-Meteo");
    expect(output.dailyForecast.length).toBeGreaterThan(0);
  });
});
