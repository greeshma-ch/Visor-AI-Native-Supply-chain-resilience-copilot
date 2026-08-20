/**
 * VISOR Weather Intelligence Agent
 * Fetches weather data, maps conditions to supply chain impact deterministically.
 * Handles API failures with graceful degradation.
 */

import fetch from 'node-fetch';
import { WeatherAgentOutput, Supplier } from '../types';
import { createLogger, withTelemetry } from '../lib/logger';
import { weatherCircuit } from '../lib/circuitBreaker';
import { weatherCache } from '../lib/cache';

const logger = createLogger('WeatherAgent');

/** Deterministic mapping from weather conditions to supply chain impact */
const DISRUPTIVE_CONDITIONS: Record<string, { severity: 'High' | 'Medium' | 'Low'; impact: string }> = {
  'Thunderstorm': { severity: 'High', impact: 'Severe weather disrupting port operations, air freight, and road logistics' },
  'Tornado': { severity: 'High', impact: 'Extreme weather emergency — all logistics operations suspended' },
  'Squall': { severity: 'High', impact: 'Sudden violent winds disrupting maritime and air operations' },
  'Snow': { severity: 'Medium', impact: 'Snow conditions causing road and rail delays, potential airport closures' },
  'Dust': { severity: 'Medium', impact: 'Dust storms reducing visibility and disrupting air cargo operations' },
  'Sand': { severity: 'Medium', impact: 'Sandstorm conditions affecting surface transport and air operations' },
  'Ash': { severity: 'High', impact: 'Volcanic ash disrupting air freight corridors' },
  'Rain': { severity: 'Low', impact: 'Rain may cause minor delays in surface transport' },
  'Drizzle': { severity: 'Low', impact: 'Light precipitation with minimal logistics impact' },
  'Fog': { severity: 'Medium', impact: 'Reduced visibility affecting port, air, and road operations' },
  'Mist': { severity: 'Low', impact: 'Light mist with minor visibility impacts' },
  'Haze': { severity: 'Low', impact: 'Haze conditions with minimal operational impact' },
};

/** Check if conditions warrant a supply chain alert */
const isDisruptive = (data: any): { disruptive: boolean; severity: 'High' | 'Medium' | 'Low'; impact: string } => {
  const condition = data.weather?.[0]?.main || '';
  const mapped = DISRUPTIVE_CONDITIONS[condition];

  // Check for extreme conditions even if not in the primary map
  if (mapped) {
    // Heavy rain: escalate severity
    if (condition === 'Rain' && data.rain?.['1h'] > 10) {
      return { disruptive: true, severity: 'Medium', impact: 'Heavy rainfall (>10mm/h) disrupting surface transport and warehouse operations' };
    }
    if (condition === 'Rain' && data.rain?.['1h'] > 25) {
      return { disruptive: true, severity: 'High', impact: 'Extreme rainfall (>25mm/h) — flash flood risk, logistics suspended' };
    }
    if (mapped.severity === 'Low') {
      return { disruptive: false, severity: 'Low', impact: mapped.impact };
    }
    return { disruptive: true, severity: mapped.severity, impact: mapped.impact };
  }

  // Extreme temperature check
  const temp = data.main?.temp;
  if (temp !== undefined) {
    if (temp > 45) return { disruptive: true, severity: 'High', impact: 'Extreme heat (>45°C) — worker safety risk, cold-chain integrity compromised' };
    if (temp > 40) return { disruptive: true, severity: 'Medium', impact: 'Extreme heat (>40°C) — potential cold-chain disruption and reduced outdoor operations' };
    if (temp < -20) return { disruptive: true, severity: 'Medium', impact: 'Extreme cold (<-20°C) — diesel gelling risk, road and rail delays' };
  }

  // High wind check
  const wind = data.wind?.speed;
  if (wind !== undefined && wind > 20) {
    return { disruptive: true, severity: 'High', impact: `Dangerously high winds (${wind}m/s) — crane operations suspended, maritime delays` };
  }
  if (wind !== undefined && wind > 15) {
    return { disruptive: true, severity: 'Medium', impact: `Strong winds (${wind}m/s) — potential delays in maritime and air operations` };
  }

  return { disruptive: false, severity: 'Low', impact: 'Normal weather conditions' };
};

/**
 * Fetch weather for a single location with circuit breaker protection.
 */
const fetchLocationWeather = async (
  lat: number,
  lon: number,
  locationName: string,
  apiKey: string
): Promise<any | null> => {
  const cacheKey = `weather-${lat.toFixed(2)}-${lon.toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await weatherCircuit.execute(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
        const response = await fetch(url, { signal: controller.signal as any });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`OpenWeather API returned ${response.status} for ${locationName}`);
        }

        const data = await response.json();
        weatherCache.set(cacheKey, data);
        return data;
      } finally {
        clearTimeout(timeout);
      }
    });
    return result;
  } catch (error: any) {
    logger.warn('fetch-failed', `Weather fetch failed for ${locationName}: ${error.message}`);
    return null;
  }
};

/**
 * Run the Weather Intelligence Agent.
 * - Fetches weather for all supplier locations in parallel
 * - Maps conditions to supply chain impact deterministically (no LLM)
 * - Returns structured alerts with severity classification
 * - Gracefully degrades when API fails
 */
export const runWeatherAgent = async (
  suppliers: Supplier[],
  apiKey?: string
): Promise<WeatherAgentOutput> => {
  if (!apiKey) {
    logger.warn('no-api-key', 'OPENWEATHER_API_KEY not configured');
    return {
      alerts: [],
      currentConditions: {},
      apiAvailable: false,
      error: 'OPENWEATHER_API_KEY not configured',
    };
  }

  try {
    const { result } = await withTelemetry(logger, 'fetch-all-weather', async () => {
      // Deduplicate locations (multiple suppliers at same coordinates)
      const uniqueLocations = new Map<string, { lat: number; lon: number; name: string; supplierIds: string[] }>();
      for (const s of suppliers) {
        const key = `${s.coordinates[0].toFixed(2)}-${s.coordinates[1].toFixed(2)}`;
        const existing = uniqueLocations.get(key);
        if (existing) {
          existing.supplierIds.push(s.id);
        } else {
          uniqueLocations.set(key, {
            lat: s.coordinates[0],
            lon: s.coordinates[1],
            name: s.location,
            supplierIds: [s.id],
          });
        }
      }

      // Fetch all weather data in parallel
      const locations = [...uniqueLocations.values()];
      const results = await Promise.all(
        locations.map(loc => fetchLocationWeather(loc.lat, loc.lon, loc.name, apiKey))
      );

      const alerts: WeatherAgentOutput['alerts'] = [];
      const currentConditions: WeatherAgentOutput['currentConditions'] = {};
      let apiAvailable = false;

      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        const data = results[i];

        if (!data) continue;
        apiAvailable = true;

        // Store current conditions
        if (data.weather?.[0] && data.main) {
          currentConditions[loc.name] = {
            temp: Math.round(data.main.temp),
            description: data.weather[0].description,
            windSpeed: data.wind?.speed ?? 0,
            humidity: data.main.humidity ?? 0,
            pressure: data.main.pressure ?? 0,
            icon: data.weather[0].icon,
          };
        }

        // Check for disruptive conditions
        const assessment = isDisruptive(data);
        if (assessment.disruptive) {
          alerts.push({
            location: loc.name,
            condition: data.weather[0]?.main || 'Unknown',
            severity: assessment.severity,
            temperature: Math.round(data.main?.temp ?? 0),
            windSpeed: data.wind?.speed ?? 0,
            humidity: data.main?.humidity ?? 0,
            description: data.weather[0]?.description || '',
            icon: data.weather[0]?.icon || '01d',
            impactedSupplierIds: loc.supplierIds,
            supplyChainImpact: assessment.impact,
          });
        }
      }

      return { alerts, currentConditions, apiAvailable };
    });

    return result;

  } catch (error: any) {
    logger.error('agent-failed', `Weather agent failed: ${error.message}`);
    return {
      alerts: [],
      currentConditions: {},
      apiAvailable: false,
      error: `Weather service error: ${error.message}`,
    };
  }
};
