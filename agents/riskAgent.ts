/**
 * VISOR Risk Assessment Agent
 * PURE DETERMINISTIC — No LLM calls.
 * Computes weighted risk scores from evidence with full explainability.
 *
 * Risk classification:
 *   STABLE  = 0-39
 *   CAUTION = 40-69
 *   RISKY   = 70-100
 *
 * Weights:
 *   Severity:              0.30 (max 30 points)
 *   Supplier Criticality:  0.25 (max 25 points)
 *   Geographic Proximity:  0.20 (max 20 points)
 *   Confidence:            0.15 (max 15 points)
 *   Event Duration:        0.10 (max 10 points)
 */

import { RiskScore, RiskStatus, Supplier, Disruption, NewsAgentOutput, WeatherAgentOutput, SupplyChainAgentOutput, getSupplierCriticality } from '../types';
import { matchLocations, getProximityScore } from '../lib/geoMatcher';
import { createLogger } from '../lib/logger';

const logger = createLogger('RiskAgent');

/** Default duration estimates by disruption type (hours) */
const DURATION_DEFAULTS: Record<string, number> = {
  'Strike': 48,
  'Weather': 24,
  'Incident': 12,
  'Logistics': 36,
};

/** Parse estimated delay string to hours */
const parseDelayHours = (delay: string): number => {
  if (!delay || delay === '0h') return 0;
  const match = delay.match(/(\d+)/);
  return match ? parseInt(match[1]) : 12;
};

/** Compute severity sub-score (0-30) */
const computeSeverityScore = (
  disruptions: Array<{ severity: string; confidence?: number }>,
  weatherAlerts: Array<{ severity: string }>
): { score: number; explanation: string } => {
  const allSeverities = [
    ...disruptions.map(d => d.severity),
    ...weatherAlerts.map(a => a.severity),
  ];

  if (allSeverities.length === 0) {
    return { score: 0, explanation: 'No active disruptions' };
  }

  const severityValues: Record<string, number> = { 'High': 30, 'Medium': 18, 'Low': 8 };
  const maxSeverity = Math.max(...allSeverities.map(s => severityValues[s] || 0));
  
  // Bonus for multiple concurrent disruptions
  const concurrencyBonus = Math.min((allSeverities.length - 1) * 3, 6);
  const score = Math.min(maxSeverity + concurrencyBonus, 30);

  const highCount = allSeverities.filter(s => s === 'High').length;
  const medCount = allSeverities.filter(s => s === 'Medium').length;

  return {
    score,
    explanation: `${allSeverities.length} active signal(s): ${highCount} high, ${medCount} medium severity`,
  };
};

/** Compute supplier criticality sub-score (0-25) */
const computeCriticalityScore = (supplier: Supplier): { score: number; explanation: string } => {
  const criticality = getSupplierCriticality(supplier);
  const scores: Record<string, number> = {
    'critical': 25,
    'important': 15,
    'standard': 8,
  };

  return {
    score: scores[criticality],
    explanation: `${supplier.category} supplier classified as ${criticality}`,
  };
};

/** Compute geographic proximity sub-score (0-20) */
const computeProximityScore = (
  supplier: Supplier,
  disruptions: Array<{ location: string }>,
  weatherAlerts: Array<{ location: string }>
): { score: number; explanation: string } => {
  const allLocations = [
    ...disruptions.map(d => d.location),
    ...weatherAlerts.map(a => a.location),
  ];

  if (allLocations.length === 0) {
    return { score: 0, explanation: 'No disruptions to measure proximity' };
  }

  let maxProximity = 0;
  let closestLocation = '';

  for (const loc of allLocations) {
    const match = matchLocations(supplier.location, loc, supplier.coordinates);
    if (match > maxProximity) {
      maxProximity = match;
      closestLocation = loc;
    }
  }

  const score = Math.round(maxProximity * 20);
  return {
    score,
    explanation: maxProximity > 0.7
      ? `Direct proximity to disruption at ${closestLocation} (${Math.round(maxProximity * 100)}% match)`
      : maxProximity > 0.3
        ? `Regional proximity to disruption at ${closestLocation} (${Math.round(maxProximity * 100)}% match)`
        : 'No nearby disruptions detected',
  };
};

/** Compute confidence sub-score (0-15) */
const computeConfidenceSubScore = (
  disruptions: Array<{ confidence?: number }>,
  newsAvailable: boolean,
  weatherAvailable: boolean
): { score: number; explanation: string } => {
  if (!newsAvailable && !weatherAvailable) {
    return { score: 3, explanation: 'Both news and weather APIs unavailable — low evidence confidence' };
  }

  const factors: string[] = [];
  let score = 0;

  if (newsAvailable) { score += 5; factors.push('News data available'); }
  if (weatherAvailable) { score += 5; factors.push('Weather data available'); }

  // Boost for high-confidence disruptions
  const avgConfidence = disruptions.length > 0
    ? disruptions.reduce((sum, d) => sum + (d.confidence || 50), 0) / disruptions.length
    : 0;

  if (avgConfidence > 70) { score += 5; factors.push(`High evidence confidence (${Math.round(avgConfidence)}%)`); }
  else if (avgConfidence > 40) { score += 3; factors.push(`Moderate evidence confidence (${Math.round(avgConfidence)}%)`); }

  return { score: Math.min(score, 15), explanation: factors.join('; ') };
};

/** Compute event duration sub-score (0-10) */
const computeDurationScore = (
  disruptions: Array<{ type?: string }>,
  impacts: Array<{ estimatedDelay: string }>
): { score: number; explanation: string } => {
  if (disruptions.length === 0) {
    return { score: 0, explanation: 'No active events' };
  }

  // Use impact delay estimates if available
  const maxDelay = Math.max(
    ...impacts.map(i => parseDelayHours(i.estimatedDelay)),
    ...disruptions.map(d => DURATION_DEFAULTS[d.type || 'Logistics'] || 12)
  );

  let score: number;
  let explanation: string;

  if (maxDelay >= 72) { score = 10; explanation = `Extended disruption expected (${maxDelay}h+)`; }
  else if (maxDelay >= 48) { score = 8; explanation = `Significant delay expected (${maxDelay}h)`; }
  else if (maxDelay >= 24) { score = 5; explanation = `Moderate delay expected (${maxDelay}h)`; }
  else if (maxDelay >= 12) { score = 3; explanation = `Minor delay possible (${maxDelay}h)`; }
  else { score = 1; explanation = `Minimal duration impact (${maxDelay}h)`; }

  return { score, explanation };
};

/**
 * Run the Risk Assessment Agent.
 * PURE DETERMINISTIC — no LLM involved.
 * Computes weighted risk score from all evidence with full explainability.
 */
export const runRiskAgent = (
  supplier: Supplier,
  newsOutput: NewsAgentOutput,
  weatherOutput: WeatherAgentOutput,
  supplyChainOutput: SupplyChainAgentOutput,
  isSimulated: boolean = false
): RiskScore => {
  // Find disruptions relevant to this supplier
  const relevantDisruptions = newsOutput.disruptions.filter(d =>
    matchLocations(supplier.location, d.location, supplier.coordinates) > 0.3
  );

  const relevantAlerts = weatherOutput.alerts.filter(a =>
    a.impactedSupplierIds.includes(supplier.id) ||
    matchLocations(supplier.location, a.location, supplier.coordinates) > 0.3
  );

  // When simulated, inject a synthetic disruption so the SAME weighted formula scores it
  if (isSimulated) {
    const syntheticDisruption = { severity: 'High' as const, location: supplier.location, type: 'Strike' as const, title: 'Simulated Crisis Event', summary: 'Synthetic disruption injected for crisis simulation', confidence: 90, sourceUrls: [] as string[], verificationStatus: 'AI-synthesized' as const };
    relevantDisruptions.push(syntheticDisruption);
    const syntheticAlert = { severity: 'High' as const, location: supplier.location, condition: 'Crisis Simulation', temperature: 0, windSpeed: 0, humidity: 0, description: 'Simulated crisis alert', icon: '', impactedSupplierIds: [supplier.id], supplyChainImpact: 'Simulated high-impact disruption to supplier operations' };
    relevantAlerts.push(syntheticAlert);
  }

  const supplierImpact = supplyChainOutput.impacts.find(i => i.supplierId === supplier.id);
  const relevantImpacts = supplierImpact ? [supplierImpact] : [];

  // Compute all sub-scores
  const severity = computeSeverityScore(relevantDisruptions, relevantAlerts);
  const criticality = computeCriticalityScore(supplier);
  const proximity = computeProximityScore(supplier, relevantDisruptions, relevantAlerts);
  const confidence = computeConfidenceSubScore(
    relevantDisruptions,
    newsOutput.apiAvailable,
    weatherOutput.apiAvailable
  );
  const duration = computeDurationScore(
    relevantDisruptions,
    relevantImpacts
  );

  // Compute total score
  const totalScore = Math.min(
    severity.score + criticality.score * (severity.score > 0 ? 1 : 0.2) + proximity.score + confidence.score + duration.score,
    100
  );

  // Note: criticality only fully contributes if there's at least some severity signal
  // Otherwise a "critical" supplier with zero disruptions shouldn't score 25

  // Classify
  const level: RiskStatus = totalScore >= 70 ? RiskStatus.RISKY
    : totalScore >= 40 ? RiskStatus.CAUTION
    : RiskStatus.STABLE;

  // Build evidence chain
  const newsSignals = relevantDisruptions.map(d => `[${d.severity}] ${d.title} (${d.confidence}% confidence)`);
  const weatherSignals = relevantAlerts.map(a => `[${a.severity}] ${a.condition} in ${a.location}: ${a.supplyChainImpact}`);
  const disruptionMatches = relevantImpacts.map(i => `${i.bottleneck} — Delay: ${i.estimatedDelay}`);

  // Build human-readable explanation
  const explanationLines = [];
  if (isSimulated) {
    explanationLines.push('⚠ SIMULATED CRISIS MODE — scores below reflect an injected synthetic disruption and do not represent live conditions.');
  }
  explanationLines.push(
    `Risk score: ${totalScore}/100 → ${level}`,
    `Severity: ${severity.score}/30 — ${severity.explanation}`,
    `Criticality: ${criticality.score}/25 — ${criticality.explanation}`,
    `Proximity: ${proximity.score}/20 — ${proximity.explanation}`,
    `Confidence: ${confidence.score}/15 — ${confidence.explanation}`,
    `Duration: ${duration.score}/10 — ${duration.explanation}`,
  );
  const explanation = explanationLines.join('\n');

  logger.info('risk-computed', `${supplier.name}: ${totalScore}/100 (${level})${isSimulated ? ' [SIMULATED]' : ''}`, {
    supplierId: supplier.id,
    score: totalScore,
    level,
  });

  return {
    score: totalScore,
    level,
    breakdown: {
      severity: severity.score,
      supplierCriticality: criticality.score,
      geographicProximity: proximity.score,
      confidence: confidence.score,
      eventDuration: duration.score,
    },
    evidence: {
      newsSignals,
      weatherSignals,
      disruptionMatches,
    },
    explanation,
  };
};
