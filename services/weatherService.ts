/**
 * VISOR Weather Service (Client-Side)
 * Fetches weather alerts through the server proxy.
 * Reduced retry latency, AbortController timeout, graceful degradation.
 */

import { Disruption, Supplier } from '../types';

const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 500): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0) {
      console.warn(`Weather retry: ${error.message}. Retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5); // Gentler backoff: 500ms → 750ms → done
    }
    throw error;
  }
};

export const fetchWeatherAlerts = async (suppliers: Supplier[]): Promise<Disruption[]> => {
  try {
    const locations = suppliers.map(s => ({
      lat: s.coordinates[0],
      lon: s.coordinates[1],
      name: s.location,
      supplierIds: [s.id]
    }));

    return await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      try {
        const response = await fetch('/api/weather/alerts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ locations }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const contentType = response.headers.get('content-type') || '';
        if (!response.ok) {
          if (contentType.includes('application/json')) {
            const error = await response.json();
            throw new Error(error.error || `Weather API Error ${response.status}`);
          } else {
            throw new Error(`Weather system returned ${response.status}`);
          }
        }

        if (!contentType.includes('application/json')) {
          throw new Error('Invalid response format from weather service');
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } finally {
        clearTimeout(timeout);
      }
    });
  } catch (error: any) {
    console.error('Weather service error:', error.message);
    return []; // Graceful degradation
  }
};

export const fetchCurrentWeather = async (lat: number, lon: number): Promise<any> => {
  try {
    return await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      try {
        const response = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const contentType = response.headers.get('content-type');

        if (!response.ok) {
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            throw new Error(error.error || `Current Weather API Error ${response.status}`);
          }
          throw new Error(`Current weather failed with ${response.status}`);
        }

        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid JSON response from weather service');
        }

        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    }, 1, 500); // Only 1 retry for current weather (less critical)
  } catch (error) {
    console.error('Current weather error:', error);
    return null;
  }
};
