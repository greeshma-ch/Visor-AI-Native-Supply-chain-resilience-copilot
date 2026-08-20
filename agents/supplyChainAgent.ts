/**
 * VISOR Supply Chain Impact Agent
 * Uses a single focused Groq call to extract supply chain impacts from evidence.
 * Does NOT assign risk levels — only extracts evidence and impacts.
 */

import Groq from 'groq-sdk';
import { SupplyChainAgentOutput, Supplier, NewsAgentOutput, WeatherAgentOutput } from '../types';
import { createLogger, withTelemetry } from '../lib/logger';
import { groqCircuit } from '../lib/circuitBreaker';

const logger = createLogger('SupplyChainAgent');

let groq: Groq;
const getGroq = () => {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  return groq;
};

/** Safe JSON parser with fallback */
const parseJson = (raw: string, fallback: any): any => {
  if (!raw || !raw.trim()) return fallback;
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1) cleaned = cleaned.substring(first, last + 1);
  try { return JSON.parse(cleaned); } catch { return fallback; }
};

/**
 * Run the Supply Chain Impact Agent.
 * - Receives structured inputs from News and Weather agents
 * - Makes a single focused Groq call to extract impacts
 * - Does NOT assign risk levels
 * - Returns structured impact data
 */
export const runSupplyChainAgent = async (
  suppliers: Supplier[],
  newsOutput: NewsAgentOutput,
  weatherOutput: WeatherAgentOutput
): Promise<SupplyChainAgentOutput> => {
  // If no evidence at all, return empty impacts
  if (newsOutput.disruptions.length === 0 && weatherOutput.alerts.length === 0) {
    return {
      impacts: suppliers.map(s => ({
        supplierId: s.id,
        supplierName: s.name,
        bottleneck: 'No active disruptions detected',
        estimatedDelay: '0h',
        affectedOperations: [],
        cascadeRisk: 'Low' as const,
      })),
      evidenceSummary: 'No active disruptions detected across monitored supplier network.',
    };
  }

  // Build focused evidence summary for the LLM
  const newsEvidence = newsOutput.disruptions.map(d =>
    `[${d.severity}] ${d.title} at ${d.location}: ${d.summary} (confidence: ${d.confidence}%)`
  ).join('\n');

  const weatherEvidence = weatherOutput.alerts.map(a =>
    `[${a.severity}] ${a.condition} in ${a.location}: ${a.supplyChainImpact} (wind: ${a.windSpeed}m/s, temp: ${a.temperature}°C)`
  ).join('\n');

  const supplierList = suppliers.map(s =>
    `${s.name} (ID: ${s.id}, Category: ${s.category}, Location: ${s.location})`
  ).join('\n');

  const systemPrompt = `You are a supply chain logistics analyst. Analyze the provided evidence and identify specific operational impacts on the listed suppliers.

CRITICAL RULES:
1. ONLY reference impacts that are directly supported by the provided evidence.
2. Do NOT invent or synthesize disruptions.
3. If a supplier has no matching evidence, set bottleneck to "No active disruptions" and delay to "0h".
4. Be specific about HOW each event affects the supplier's operations.

Respond ONLY with valid JSON, no markdown:
{
  "impacts": [
    {
      "supplierId": "string (exact supplier ID from the list)",
      "supplierName": "string",
      "bottleneck": "Specific operational bottleneck based on evidence (2 sentences max)",
      "estimatedDelay": "e.g. 0h, 12h-24h, 48h+",
      "affectedOperations": ["specific operations like 'inbound shipping', 'warehouse', 'air freight'"],
      "cascadeRisk": "High" | "Medium" | "Low"
    }
  ],
  "evidenceSummary": "2-3 sentence summary of the overall supply chain situation"
}`;

  const userPrompt = `SUPPLIERS:\n${supplierList}\n\nNEWS EVIDENCE:\n${newsEvidence || 'No news disruptions detected.'}\n\nWEATHER EVIDENCE:\n${weatherEvidence || 'No weather alerts active.'}`;

  try {
    const { result } = await withTelemetry(logger, 'analyze-impacts', async () => {
      return await groqCircuit.execute(async () => {
        const res = await getGroq().chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1, // Low temperature for deterministic output
          max_tokens: 2048,
        });

        const raw = res.choices[0]?.message?.content || '{}';
        const parsed = parseJson(raw, { impacts: [], evidenceSummary: '' });

        // Validate: filter out impacts with supplier IDs that don't exist
        const validSupplierIds = new Set(suppliers.map(s => s.id));
        const validImpacts = (parsed.impacts || []).filter((imp: any) =>
          validSupplierIds.has(imp.supplierId)
        );

        // Ensure all suppliers have an entry
        const impactedIds = new Set(validImpacts.map((imp: any) => imp.supplierId));
        for (const s of suppliers) {
          if (!impactedIds.has(s.id)) {
            validImpacts.push({
              supplierId: s.id,
              supplierName: s.name,
              bottleneck: 'No active disruptions detected',
              estimatedDelay: '0h',
              affectedOperations: [],
              cascadeRisk: 'Low',
            });
          }
        }

        return {
          impacts: validImpacts,
          evidenceSummary: parsed.evidenceSummary || 'Supply chain impact analysis complete.',
        };
      }, () => {
        // Circuit breaker fallback — deterministic
        logger.warn('circuit-fallback', 'Groq circuit open, using deterministic fallback');
        return {
          impacts: suppliers.map(s => ({
            supplierId: s.id,
            supplierName: s.name,
            bottleneck: 'AI analysis temporarily unavailable — using evidence-based assessment',
            estimatedDelay: newsOutput.disruptions.length > 0 ? '12h-24h (estimated)' : '0h',
            affectedOperations: ['Assessment pending'],
            cascadeRisk: (newsOutput.disruptions.length > 0 ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
          })),
          evidenceSummary: 'Deterministic fallback — Groq API temporarily unavailable.',
        };
      });
    });

    return result;
  } catch (error: any) {
    logger.error('agent-failed', `Supply chain agent failed: ${error.message}`);
    return {
      impacts: suppliers.map(s => ({
        supplierId: s.id,
        supplierName: s.name,
        bottleneck: 'Analysis unavailable',
        estimatedDelay: '0h',
        affectedOperations: [],
        cascadeRisk: 'Low' as const,
      })),
      evidenceSummary: `Analysis failed: ${error.message}`,
    };
  }
};
