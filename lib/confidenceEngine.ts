/**
 * VISOR Confidence Engine
 * Computes confidence metrics for every signal, score, and recommendation.
 * Every metric traces back to specific evidence sources.
 */

export interface SignalConfidence {
  score: number;        // 0-100
  factors: string[];    // Human-readable factors that influenced the score
  dataQuality: 'high' | 'medium' | 'low' | 'degraded';
}

export interface ConfidenceMetrics {
  news: SignalConfidence;
  weather: SignalConfidence;
  risk: SignalConfidence;
  overall: SignalConfidence;
}

/** Source credibility tiers */
const SOURCE_CREDIBILITY: Record<string, number> = {
  // Tier 1 — Primary sources (1.0)
  'reuters': 1.0,
  'bloomberg': 1.0,
  'associated press': 1.0,
  'ap': 1.0,
  'financial times': 1.0,
  'ft': 1.0,
  'wall street journal': 1.0,
  'wsj': 1.0,
  'the new york times': 1.0,
  'bbc': 1.0,

  // Tier 2 — Major publications (0.8)
  'cnbc': 0.8,
  'the guardian': 0.8,
  'the economist': 0.8,
  'supply chain dive': 0.8,
  'logistics management': 0.8,
  'freightwaves': 0.8,
  'maritime executive': 0.8,
  'joc': 0.8,
  'lloyd\'s list': 0.8,

  // Tier 3 — Regional/industry (0.6)
  'south china morning post': 0.6,
  'nikkei': 0.6,
  'handelsblatt': 0.6,
  'les echos': 0.6,
};

/**
 * Get credibility score for a news source. Default 0.4 for unknown sources.
 */
export const getSourceCredibility = (sourceName: string): number => {
  const normalized = sourceName.toLowerCase().trim();
  return SOURCE_CREDIBILITY[normalized] ?? 0.4;
};

/**
 * Calculate news signal confidence.
 */
export const computeNewsConfidence = (
  articles: Array<{ source: string; timestamp?: string }>,
  apiAvailable: boolean
): SignalConfidence => {
  if (!apiAvailable) {
    return {
      score: 10,
      factors: ['NewsAPI unavailable — no real-time news data'],
      dataQuality: 'degraded',
    };
  }

  if (articles.length === 0) {
    return {
      score: 30,
      factors: ['No relevant articles found for query'],
      dataQuality: 'low',
    };
  }

  const factors: string[] = [];

  // Source quality
  const avgCredibility = articles.reduce((sum, a) => sum + getSourceCredibility(a.source), 0) / articles.length;
  const sourceScore = Math.round(avgCredibility * 40); // max 40 points
  factors.push(`Source credibility: ${Math.round(avgCredibility * 100)}% (${articles.length} sources)`);

  // Recency
  const now = Date.now();
  const recentCount = articles.filter(a => {
    if (!a.timestamp) return false;
    const age = now - new Date(a.timestamp).getTime();
    return age < 6 * 60 * 60 * 1000; // Within 6 hours
  }).length;
  const recencyScore = Math.round((recentCount / Math.max(articles.length, 1)) * 30); // max 30 points
  factors.push(`Recency: ${recentCount}/${articles.length} articles within 6 hours`);

  // Volume
  const volumeScore = Math.min(articles.length * 6, 30); // max 30 points
  factors.push(`Volume: ${articles.length} relevant articles`);

  const score = Math.min(sourceScore + recencyScore + volumeScore, 100);

  return {
    score,
    factors,
    dataQuality: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
  };
};

/**
 * Calculate weather signal confidence.
 */
export const computeWeatherConfidence = (
  weatherData: any | null,
  apiAvailable: boolean
): SignalConfidence => {
  if (!apiAvailable || !weatherData) {
    return {
      score: 15,
      factors: ['Weather API unavailable — using degraded assessment'],
      dataQuality: 'degraded',
    };
  }

  const factors: string[] = [];
  let score = 60; // Base score for having weather data

  // Data completeness
  if (weatherData.weather?.[0]) {
    score += 15;
    factors.push(`Weather condition: ${weatherData.weather[0].description}`);
  }
  if (weatherData.main?.temp !== undefined) {
    score += 10;
    factors.push(`Temperature: ${weatherData.main.temp}°C`);
  }
  if (weatherData.wind?.speed !== undefined) {
    score += 10;
    factors.push(`Wind: ${weatherData.wind.speed} m/s`);
  }
  if (weatherData.rain || weatherData.snow) {
    score += 5;
    factors.push('Precipitation data available');
  }

  return {
    score: Math.min(score, 100),
    factors,
    dataQuality: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
  };
};

/**
 * Calculate risk score confidence based on evidence quality.
 */
export const computeRiskConfidence = (
  newsConf: SignalConfidence,
  weatherConf: SignalConfidence,
  evidenceCount: number,
  hasDirectMatch: boolean
): SignalConfidence => {
  const factors: string[] = [];

  // Weight: news 40%, weather 25%, evidence quality 35%
  const newsContrib = newsConf.score * 0.4;
  const weatherContrib = weatherConf.score * 0.25;
  const evidenceContrib = Math.min(evidenceCount * 15, 35) * (hasDirectMatch ? 1 : 0.6);

  factors.push(`News confidence: ${newsConf.score}% (weight: 40%)`);
  factors.push(`Weather confidence: ${weatherConf.score}% (weight: 25%)`);
  factors.push(`Evidence signals: ${evidenceCount} ${hasDirectMatch ? '(direct match)' : '(indirect match)'}`);

  const score = Math.round(Math.min(newsContrib + weatherContrib + evidenceContrib, 100));

  return {
    score,
    factors,
    dataQuality: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
  };
};

/**
 * Compute overall VISOR confidence metric.
 */
export const computeOverallConfidence = (metrics: Omit<ConfidenceMetrics, 'overall'>): SignalConfidence => {
  const weights = { news: 0.35, weather: 0.25, risk: 0.40 };
  const score = Math.round(
    metrics.news.score * weights.news +
    metrics.weather.score * weights.weather +
    metrics.risk.score * weights.risk
  );

  const degraded = [metrics.news, metrics.weather, metrics.risk].filter(m => m.dataQuality === 'degraded');

  const factors = [
    `News: ${metrics.news.score}% (${metrics.news.dataQuality})`,
    `Weather: ${metrics.weather.score}% (${metrics.weather.dataQuality})`,
    `Risk: ${metrics.risk.score}% (${metrics.risk.dataQuality})`,
    degraded.length > 0 ? `⚠ ${degraded.length} signal(s) in degraded mode` : '✓ All signals operational',
  ];

  return {
    score,
    factors,
    dataQuality: degraded.length >= 2 ? 'degraded' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low',
  };
};
