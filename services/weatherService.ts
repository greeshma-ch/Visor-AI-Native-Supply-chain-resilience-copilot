import { Disruption, Supplier } from '../types';

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0) {
      console.warn(`Weather Service Error: ${error.message}. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const fetchWeatherAlerts = async (suppliers: Supplier[]): Promise<Disruption[]> => {
  console.log(`Attempting to fetch weather alerts for ${suppliers.length} suppliers...`);
  try {
    const locations = suppliers.map(s => ({
      lat: s.coordinates[0],
      lon: s.coordinates[1],
      name: s.location,
      supplierIds: [s.id]
    }));

    return await withRetry(async () => {
      console.log('Sending POST request to /api/weather/alerts with locations:', locations);
      const response = await fetch('/api/weather/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ locations }),
      });

      console.log(`Weather alerts response: ${response.status} ${response.statusText}`);
      
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        if (contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || `Weather API Error ${response.status}`);
        } else {
          const text = await response.text();
          console.error(`Weather API returned ${response.status} (non-JSON):`, text.substring(0, 200));
          throw new Error(`Weather system returned ${response.status}. Expected JSON but got ${contentType.split(';')[0]}`);
        }
      }

      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Expected JSON but got:', contentType, text.substring(0, 100));
        throw new Error('Invalid response format (HTML received instead of JSON). This usually indicates a routing issue or server error.');
      }

      const data = await response.json();
      console.log(`Successfully fetched ${data.length} weather alerts`);
      return data;
    });
  } catch (error: any) {
    console.error('Weather service fatal error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause
    });
    return [];
  }
};

export const fetchCurrentWeather = async (lat: number, lon: number): Promise<any> => {
  try {
    return await withRetry(async () => {
      const response = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || `Current Weather API Error ${response.status}`);
        }
        throw new Error(`Current weather failed with ${response.status}`);
      }

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid JSON response from current weather service');
      }

      return await response.json();
    });
  } catch (error) {
    console.error('Current weather service error after retries:', error);
    return null;
  }
};
