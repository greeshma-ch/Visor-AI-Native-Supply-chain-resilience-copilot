/**
 * VISOR Geographic Matcher
 * Replaces fragile string-based location matching with normalized geographic matching.
 * Uses Haversine formula for coordinate proximity + normalized name matching.
 */

/** Known aliases for countries and regions */
const COUNTRY_ALIASES: Record<string, string[]> = {
  'united states': ['usa', 'us', 'united states of america', 'america'],
  'united kingdom': ['uk', 'britain', 'great britain', 'england'],
  'netherlands': ['holland', 'the netherlands', 'nl'],
  'south korea': ['korea', 'republic of korea'],
  'taiwan': ['republic of china', 'roc'],
  'vietnam': ['viet nam'],
  'germany': ['deutschland'],
  'japan': ['nippon'],
  'switzerland': ['schweiz', 'suisse'],
  'uae': ['united arab emirates'],
};

/** Known region groupings for supply chain impact analysis */
const REGION_GROUPS: Record<string, string[]> = {
  'east asia': ['taiwan', 'japan', 'south korea', 'china', 'hong kong'],
  'southeast asia': ['vietnam', 'indonesia', 'singapore', 'thailand', 'malaysia', 'philippines'],
  'south china sea': ['vietnam', 'taiwan', 'philippines', 'china', 'hong kong'],
  'western europe': ['germany', 'netherlands', 'france', 'belgium', 'switzerland', 'austria'],
  'northern europe': ['norway', 'sweden', 'denmark', 'finland', 'iceland'],
  'north america': ['united states', 'canada', 'mexico'],
};

/**
 * Normalize a location string for comparison.
 * Strips whitespace, lowercases, resolves common aliases.
 */
export const normalizeLocation = (loc: string): string[] => {
  const parts = loc.toLowerCase().split(',').map(p => p.trim()).filter(Boolean);
  const normalized: string[] = [];

  for (const part of parts) {
    normalized.push(part);

    // Check aliases
    for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
      if (part === canonical || aliases.includes(part)) {
        normalized.push(canonical);
        normalized.push(...aliases);
      }
    }
  }

  return [...new Set(normalized)];
};

/**
 * Haversine formula: calculate distance in km between two coordinate pairs.
 */
export const haversineDistance = (
  coord1: [number, number],
  coord2: [number, number]
): number => {
  const R = 6371; // Earth's radius in km
  const toRad = (deg: number) => deg * (Math.PI / 180);

  const dLat = toRad(coord2[0] - coord1[0]);
  const dLon = toRad(coord2[1] - coord1[1]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1[0])) * Math.cos(toRad(coord2[0])) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if two locations match using normalized name comparison.
 * Returns a match score 0-1 (0 = no match, 1 = exact match).
 */
export const matchLocations = (
  supplierLocation: string,
  disruptionLocation: string,
  supplierCoords?: [number, number],
  disruptionCoords?: [number, number]
): number => {
  const supplierParts = normalizeLocation(supplierLocation);
  const disruptionParts = normalizeLocation(disruptionLocation);

  // Check for region group matches
  for (const [region, countries] of Object.entries(REGION_GROUPS)) {
    const disruptionInRegion = disruptionParts.some(dp => dp === region || countries.includes(dp));
    const supplierInRegion = supplierParts.some(sp => countries.includes(sp));
    if (disruptionInRegion && supplierInRegion) {
      return 0.7; // Regional match
    }
  }

  // Check for exact part matches
  let bestMatch = 0;
  for (const sp of supplierParts) {
    for (const dp of disruptionParts) {
      if (sp === dp) {
        bestMatch = Math.max(bestMatch, 1.0); // Exact match
      } else if (sp.length > 3 && dp.length > 3) {
        // Only do containment check for longer strings to avoid false positives
        // (e.g., "ho" matching "ho chi minh")
        if (sp.includes(dp) || dp.includes(sp)) {
          // Only accept containment for strings > 5 chars to prevent "chi" matching "chicago"
          const shorter = sp.length < dp.length ? sp : dp;
          if (shorter.length >= 5) {
            bestMatch = Math.max(bestMatch, 0.8);
          }
        }
      }
    }
  }

  // Coordinate-based proximity as a fallback/supplement
  if (supplierCoords && disruptionCoords && bestMatch < 0.5) {
    const distance = haversineDistance(supplierCoords, disruptionCoords);
    if (distance < 100) bestMatch = Math.max(bestMatch, 0.9);      // Within 100km
    else if (distance < 500) bestMatch = Math.max(bestMatch, 0.6);  // Within 500km
    else if (distance < 1000) bestMatch = Math.max(bestMatch, 0.3); // Within 1000km
  }

  return bestMatch;
};

/**
 * Get the geographic proximity score for risk weighting.
 * Returns 0-100 where 100 = exact same location.
 */
export const getProximityScore = (
  supplierCoords: [number, number],
  disruptionCoords?: [number, number],
  supplierLocation?: string,
  disruptionLocation?: string
): number => {
  // If we have coordinates, use Haversine
  if (disruptionCoords) {
    const distance = haversineDistance(supplierCoords, disruptionCoords);
    if (distance < 50) return 100;
    if (distance < 200) return 85;
    if (distance < 500) return 65;
    if (distance < 1000) return 45;
    if (distance < 3000) return 25;
    return 10;
  }

  // Fallback to name matching
  if (supplierLocation && disruptionLocation) {
    return Math.round(matchLocations(supplierLocation, disruptionLocation) * 100);
  }

  return 0;
};
