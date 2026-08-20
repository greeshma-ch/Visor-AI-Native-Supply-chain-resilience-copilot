/**
 * VISOR Executive Briefing Agent
 * Single focused Groq call to generate executive briefing from all agent outputs.
 * Does NOT re-analyze or re-score risks — only synthesizes the narrative.
 */

import Groq from 'groq-sdk';
import { BriefingAgentOutput, Supplier, RiskScore, NewsAgentOutput, WeatherAgentOutput, SupplyChainAgentOutput, RiskStatus } from '../types';
import { createLogger, withTelemetry } from '../lib/logger';
import { groqCircuit } from '../lib/circuitBreaker';

const logger = createLogger('BriefingAgent');

let groq: Groq;
const getGroq = () => {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  return groq;
};

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
 * Generate deterministic fallback briefing when Groq is unavailable.
 */
const generateDeterministicBriefing = (
  supplier: Supplier,
  riskScore: RiskScore,
  newsOutput: NewsAgentOutput,
  weatherOutput: WeatherAgentOutput,
  supplyChainOutput: SupplyChainAgentOutput,
  alternativeCandidates: string[] = []
): BriefingAgentOutput => {
  const impact = supplyChainOutput.impacts.find(i => i.supplierId === supplier.id);
  const conditions = weatherOutput.currentConditions[supplier.location];

  const weatherStatus = conditions
    ? `Current conditions at ${supplier.location}: ${conditions.description}, ${conditions.temp}°C, wind ${conditions.windSpeed}m/s.`
    : 'Weather data unavailable for this location.';

  const todayFeed = newsOutput.disruptions
    .filter(d => d.location === supplier.location || d.location === 'Global')
    .slice(0, 3)
    .map(d => ({
      title: d.title,
      status: (d.severity === 'High' ? RiskStatus.RISKY : d.severity === 'Medium' ? RiskStatus.CAUTION : RiskStatus.STABLE),
      insight: d.summary,
    }));

  return {
    vectorSummary: `${supplier.name} (${supplier.category}) at ${supplier.location} — Risk score: ${riskScore.score}/100 (${riskScore.level}). ${impact?.bottleneck || 'No active disruptions detected.'} ${supplyChainOutput.evidenceSummary}`,
    weatherStatus,
    historicalContext: `${supplier.location} is a ${supplier.category} hub with known supply chain dependencies. Current risk assessment is based on ${newsOutput.disruptions.length} news signals and ${weatherOutput.alerts.length} weather alerts.`,
    todayFeed: todayFeed.length > 0 ? todayFeed : [{ title: 'Operational Stability', status: riskScore.level, insight: 'No significant disruptions detected for this supplier node.' }],
    recentFeed: [],
    mitigationSteps: riskScore.level === RiskStatus.RISKY
      ? ['Activate backup supplier channels immediately', 'Increase safety stock for critical components', 'Contact supplier for status update']
      : riskScore.level === RiskStatus.CAUTION
        ? ['Monitor situation closely for escalation', 'Review contingency plans', 'Pre-alert backup suppliers']
        : ['Continue standard monitoring', 'No immediate action required'],
    alternativeSuppliers: alternativeCandidates,
  };
};

/**
 * Compute alternative supplier candidates from the registry.
 * Same category, exclude current supplier, max 3.
 */
const computeAlternativeCandidates = (
  supplier: Supplier,
  allSuppliers: Supplier[]
): string[] => {
  return allSuppliers
    .filter(s => s.id !== supplier.id && s.category === supplier.category)
    .slice(0, 3)
    .map(s => `${s.name} (${s.location})`);
};

/**
 * Run the Executive Briefing Agent.
 * - Receives structured outputs from ALL other agents
 * - Makes a single focused Groq call to generate the executive narrative
 * - Falls back to deterministic briefing if Groq fails
 */
export const runBriefingAgent = async (
  supplier: Supplier,
  riskScore: RiskScore,
  newsOutput: NewsAgentOutput,
  weatherOutput: WeatherAgentOutput,
  supplyChainOutput: SupplyChainAgentOutput,
  isSimulated: boolean = false,
  allSuppliers: Supplier[] = []
): Promise<BriefingAgentOutput> => {
  const impact = supplyChainOutput.impacts.find(i => i.supplierId === supplier.id);
  const conditions = weatherOutput.currentConditions[supplier.location];

  // Compute alternative candidates from the real registry
  const alternativeCandidates = computeAlternativeCandidates(supplier, allSuppliers);
  const alternativesBlock = alternativeCandidates.length > 0
    ? `\nAVAILABLE ALTERNATIVE SUPPLIERS (same category, from registry — select ONLY from this list):\n${alternativeCandidates.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : '\nNo alternative suppliers available in the registry for this category.';

  const systemPrompt = `You are a supply chain executive briefing writer. Generate a concise intelligence briefing from the pre-analyzed evidence below. 

CRITICAL RULES:
1. DO NOT reassess risk levels — use the provided risk score.
2. ONLY reference specific events from the evidence provided.
3. Keep each field concise (2-3 sentences max).
4. The todayFeed items MUST reference actual events from the evidence.
5. For alternativeSuppliers, ONLY select from the provided list of available alternatives. Do NOT invent supplier names.

Respond ONLY with valid JSON:
{
  "vectorSummary": "3-4 sentence analysis referencing specific events from the evidence",
  "weatherStatus": "2-3 sentences about current weather impact on operations",
  "historicalContext": "2-3 sentences on regional vulnerabilities",
  "todayFeed": [{"title": "string", "status": "STABLE|CAUTION|RISKY", "insight": "string"}],
  "recentFeed": [{"title": "string", "status": "STABLE|CAUTION|RISKY", "insight": "string"}],
  "mitigationSteps": ["Specific actionable step based on the evidence"],
  "alternativeSuppliers": ["Only names from the provided alternatives list"]
}`;

  const userPrompt = `SUPPLIER: ${supplier.name} (${supplier.category}) at ${supplier.location}
RISK SCORE: ${riskScore.score}/100 (${riskScore.level})
RISK EXPLANATION: ${riskScore.explanation}
${isSimulated ? 'MODE: CRISIS SIMULATION ACTIVE' : ''}

NEWS EVIDENCE (${newsOutput.disruptions.length} signals):
${newsOutput.disruptions.map(d => `- [${d.severity}] ${d.title}: ${d.summary}`).join('\n') || 'No news disruptions.'}

WEATHER:
${conditions ? `${conditions.description}, ${conditions.temp}°C, wind ${conditions.windSpeed}m/s` : 'No weather data.'}
${weatherOutput.alerts.filter(a => a.impactedSupplierIds.includes(supplier.id)).map(a => `- [${a.severity}] ${a.condition}: ${a.supplyChainImpact}`).join('\n') || 'No weather alerts.'}

SUPPLY CHAIN IMPACT:
${impact ? `Bottleneck: ${impact.bottleneck}\nDelay: ${impact.estimatedDelay}\nCascade Risk: ${impact.cascadeRisk}` : 'No impact detected.'}
${alternativesBlock}

Generate a concise executive briefing. Every statement must be traceable to the evidence above.`;

  try {
    const { result } = await withTelemetry(logger, 'generate-briefing', async () => {
      return await groqCircuit.execute(async () => {
        const res = await getGroq().chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.15,
          max_tokens: 1536,
        });

        const raw = res.choices[0]?.message?.content || '{}';
        const parsed = parseJson(raw, null);

        if (!parsed || !parsed.vectorSummary) {
          logger.warn('parse-failed', 'Briefing response failed validation, using fallback');
          return generateDeterministicBriefing(supplier, riskScore, newsOutput, weatherOutput, supplyChainOutput, alternativeCandidates);
        }

        // Validate status values in todayFeed/recentFeed
        const validStatuses = new Set(['STABLE', 'CAUTION', 'RISKY']);
        if (parsed.todayFeed) {
          parsed.todayFeed = parsed.todayFeed.map((item: any) => ({
            ...item,
            status: validStatuses.has(item.status) ? item.status : riskScore.level,
          }));
        }
        if (parsed.recentFeed) {
          parsed.recentFeed = parsed.recentFeed.map((item: any) => ({
            ...item,
            status: validStatuses.has(item.status) ? item.status : RiskStatus.STABLE,
          }));
        }

        // If LLM returned no alternatives but we have candidates, use registry candidates
        if ((!parsed.alternativeSuppliers || parsed.alternativeSuppliers.length === 0) && alternativeCandidates.length > 0) {
          parsed.alternativeSuppliers = alternativeCandidates;
        }

        return parsed as BriefingAgentOutput;
      }, () => {
        logger.warn('circuit-fallback', 'Groq circuit open, using deterministic briefing');
        return generateDeterministicBriefing(supplier, riskScore, newsOutput, weatherOutput, supplyChainOutput, alternativeCandidates);
      });
    });

    return result;
  } catch (error: any) {
    logger.error('agent-failed', `Briefing agent failed: ${error.message}`);
    return generateDeterministicBriefing(supplier, riskScore, newsOutput, weatherOutput, supplyChainOutput, alternativeCandidates);
  }
};

