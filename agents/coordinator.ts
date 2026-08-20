/**
 * VISOR Agent Coordinator
 * Orchestrates the multi-agent pipeline with optimal parallelism.
 *
 * Pipeline:
 *   1. News Agent + Weather Agent → parallel (Promise.all)
 *   2. Supply Chain Impact Agent → receives structured inputs from step 1
 *   3. Risk Agent → deterministic scoring (no LLM)
 *   4. Briefing Agent → single focused Groq call
 *
 * Target: total end-to-end latency under 10 seconds.
 */

import { CoordinatorResult, Supplier, User, Disruption, RiskStatus } from '../types';
import { runNewsAgent } from './newsAgent';
import { runWeatherAgent } from './weatherAgent';
import { runSupplyChainAgent } from './supplyChainAgent';
import { runRiskAgent } from './riskAgent';
import { runBriefingAgent } from './briefingAgent';
import { computeNewsConfidence, computeWeatherConfidence, computeRiskConfidence, computeOverallConfidence } from '../lib/confidenceEngine';
import { createLogger, setTraceId } from '../lib/logger';

const logger = createLogger('Coordinator');

/**
 * Run the full agent pipeline for supplier intelligence.
 * Optimized for minimal latency and maximum reliability.
 */
export const runSupplierPipeline = async (
  supplier: Supplier,
  allSuppliers: Supplier[],
  isSimulated: boolean = false
): Promise<CoordinatorResult> => {
  const traceId = setTraceId();
  const startTime = performance.now();
  logger.info('pipeline-start', `Starting pipeline for ${supplier.name}`, { supplierId: supplier.id, traceId });

  // ── Step 1: News + Weather in PARALLEL ──
  logger.info('step-1', 'Running News Agent + Weather Agent in parallel');
  const [newsOutput, weatherOutput] = await Promise.all([
    runNewsAgent(allSuppliers, process.env.NEWS_API_KEY),
    runWeatherAgent(allSuppliers, process.env.OPENWEATHER_API_KEY),
  ]);

  const step1Duration = Math.round(performance.now() - startTime);
  logger.info('step-1-complete', `Parallel intelligence complete in ${step1Duration}ms`, {
    newsArticles: newsOutput.articles.length,
    newsDisruptions: newsOutput.disruptions.length,
    weatherAlerts: weatherOutput.alerts.length,
    newsAvailable: newsOutput.apiAvailable,
    weatherAvailable: weatherOutput.apiAvailable,
  });

  // ── Step 2: Supply Chain Impact Agent ──
  logger.info('step-2', 'Running Supply Chain Impact Agent');
  const supplyChainOutput = await runSupplyChainAgent(allSuppliers, newsOutput, weatherOutput);
  const step2Duration = Math.round(performance.now() - startTime);
  logger.info('step-2-complete', `Supply chain analysis complete in ${step2Duration - step1Duration}ms`);

  // ── Step 3: Risk Agent (DETERMINISTIC — no LLM) ──
  logger.info('step-3', 'Running Risk Agent (deterministic)');
  const riskScore = runRiskAgent(supplier, newsOutput, weatherOutput, supplyChainOutput, isSimulated);
  const step3Duration = Math.round(performance.now() - startTime);
  logger.info('step-3-complete', `Risk scoring complete in ${step3Duration - step2Duration}ms: ${riskScore.score}/100 (${riskScore.level})`);

  // ── Step 4: Briefing Agent ──
  logger.info('step-4', 'Running Executive Briefing Agent');
  const briefing = await runBriefingAgent(supplier, riskScore, newsOutput, weatherOutput, supplyChainOutput, isSimulated, allSuppliers);
  const step4Duration = Math.round(performance.now() - startTime);
  logger.info('step-4-complete', `Briefing generated in ${step4Duration - step3Duration}ms`);

  // ── Confidence Metrics ──
  const newsConfidence = computeNewsConfidence(
    newsOutput.articles.map(a => ({ source: a.source, timestamp: a.publishedAt })),
    newsOutput.apiAvailable
  );
  const weatherConfidence = computeWeatherConfidence(
    weatherOutput.currentConditions[supplier.location] || null,
    weatherOutput.apiAvailable
  );
  const riskConfidence = computeRiskConfidence(
    newsConfidence,
    weatherConfidence,
    riskScore.evidence.newsSignals.length + riskScore.evidence.weatherSignals.length,
    riskScore.breakdown.geographicProximity > 10
  );
  const overallConfidence = computeOverallConfidence({
    news: newsConfidence,
    weather: weatherConfidence,
    risk: riskConfidence,
  });

  const totalDuration = Math.round(performance.now() - startTime);
  logger.info('pipeline-complete', `Pipeline complete for ${supplier.name} in ${totalDuration}ms`, {
    totalDuration,
    riskScore: riskScore.score,
    riskLevel: riskScore.level,
    overallConfidence: overallConfidence.score,
    traceId,
  });

  return {
    newsOutput,
    weatherOutput,
    supplyChainOutput,
    riskScore,
    briefing,
    confidenceMetrics: {
      news: newsConfidence,
      weather: weatherConfidence,
      risk: riskConfidence,
      overall: overallConfidence,
    },
    latencyMs: totalDuration,
    traceId,
  };
};

/**
 * Run the global risk signals pipeline.
 * Used by the dashboard to get all disruptions across all suppliers.
 */
export const runGlobalRiskPipeline = async (
  user: User,
  suppliers: Supplier[]
): Promise<{ disruptions: Disruption[]; latencyMs: number }> => {
  const traceId = setTraceId();
  const startTime = performance.now();
  logger.info('global-pipeline-start', 'Starting global risk pipeline', { traceId, supplierCount: suppliers.length });

  // News + Weather in parallel
  const [newsOutput, weatherOutput] = await Promise.all([
    runNewsAgent(suppliers, process.env.NEWS_API_KEY),
    runWeatherAgent(suppliers, process.env.OPENWEATHER_API_KEY),
  ]);

  // Convert news disruptions to Disruption type
  const newsDisruptions: Disruption[] = newsOutput.disruptions.map((d, i) => ({
    id: `news-${Date.now()}-${i}`,
    title: d.title,
    type: d.type,
    severity: d.severity,
    location: d.location,
    timestamp: new Date().toISOString(),
    summary: d.summary,
    impactedSuppliers: suppliers
      .filter(s => {
        const parts = s.location.toLowerCase().split(',').map(p => p.trim());
        const dParts = d.location.toLowerCase().split(',').map(p => p.trim());
        return parts.some(sp => dParts.some(dp => sp.length > 3 && dp.length > 3 && (sp.includes(dp) || dp.includes(sp))));
      })
      .map(s => s.id),
    sourceUrl: d.sourceUrls[0],
    verificationStatus: d.verificationStatus,
    confidence: d.confidence,
  }));

  // Convert weather alerts to Disruption type
  const weatherDisruptions: Disruption[] = weatherOutput.alerts.map((a, i) => ({
    id: `weather-${Date.now()}-${i}`,
    title: `Weather Alert: ${a.condition} in ${a.location}`,
    type: 'Weather' as const,
    severity: a.severity,
    location: a.location,
    timestamp: new Date().toISOString(),
    summary: a.supplyChainImpact,
    impactedSuppliers: a.impactedSupplierIds,
    weatherIcon: a.icon,
    verificationStatus: 'verified' as const,
    confidence: 85,
  }));

  // Combine, deduplicate, and sort
  const allDisruptions = [...newsDisruptions, ...weatherDisruptions];

  // Sort by severity then recency
  const severityMap: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
  allDisruptions.sort((a, b) => {
    const sevDiff = (severityMap[b.severity] || 0) - (severityMap[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const latencyMs = Math.round(performance.now() - startTime);
  logger.info('global-pipeline-complete', `Global pipeline complete in ${latencyMs}ms`, {
    newsDisruptions: newsDisruptions.length,
    weatherDisruptions: weatherDisruptions.length,
    totalDisruptions: allDisruptions.length,
  });

  return { disruptions: allDisruptions, latencyMs };
};
