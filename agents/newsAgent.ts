/**
 * VISOR News Intelligence Agent
 * Fetches, deduplicates, and scores news articles for supply chain relevance.
 * Returns structured JSON — never generates ungrounded disruptions.
 */

import fetch from 'node-fetch';
import { NewsAgentOutput, Supplier } from '../types';
import { createLogger, withTelemetry } from '../lib/logger';
import { newsCircuit } from '../lib/circuitBreaker';
import { newsCache } from '../lib/cache';
import { getSourceCredibility } from '../lib/confidenceEngine';

const logger = createLogger('NewsAgent');

/** Tier 1 sources get priority in result ordering */
const TIER1_SOURCES = new Set([
  'reuters', 'bloomberg', 'associated press', 'ap', 'financial times',
  'wall street journal', 'the new york times', 'bbc'
]);

const LOGISTICS_SOURCES = new Set([
  'supply chain dive', 'freightwaves', 'logistics management',
  'maritime executive', 'joc', 'lloyd\'s list'
]);

/**
 * Deduplicate articles by title similarity using Jaccard coefficient on word sets.
 */
const deduplicateArticles = (articles: any[]): any[] => {
  const seen: Set<string> = new Set();
  const deduped: any[] = [];

  for (const article of articles) {
    const titleWords = new Set(
      (article.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3)
    );
    
    // Check against already-accepted titles
    let isDuplicate = false;
    for (const seenTitle of seen) {
      const seenWords = new Set(seenTitle.split('|'));
      const intersection = new Set([...titleWords].filter((w: string) => seenWords.has(w)));
      const union = new Set([...titleWords, ...seenWords]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      if (jaccard > 0.5) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate && titleWords.size > 0) {
      seen.add([...titleWords].join('|'));
      deduped.push(article);
    }
  }

  return deduped;
};

/**
 * Build a focused news query from supplier locations and categories.
 */
const buildNewsQuery = (suppliers: Supplier[]): string => {
  const locations = [...new Set(suppliers.flatMap(s =>
    s.location.split(',').map(p => p.trim()).filter(Boolean)
  ))].slice(0, 6);

  const locationClause = locations.map(l => l.includes(' ') ? `"${l}"` : l).join(' OR ');
  return `("supply chain" OR "logistics" OR "shipping" OR "freight") AND (disruption OR delay OR strike OR weather OR bottleneck OR port OR typhoon OR earthquake OR flood) AND (${locationClause})`;
};

/**
 * Run the News Intelligence Agent.
 * - Fetches real articles from NewsAPI
 * - Scores source credibility
 * - Deduplicates similar articles
 * - Prioritizes tier-1 sources
 * - Returns structured output (NEVER fabricates articles)
 */
export const runNewsAgent = async (
  suppliers: Supplier[],
  apiKey?: string
): Promise<NewsAgentOutput> => {
  // Check cache
  const cacheKey = `news-${suppliers.map(s => s.id).sort().join(',')}`;
  const cached = newsCache.get(cacheKey);
  if (cached) {
    logger.info('cache-hit', 'Returning cached news results');
    return cached;
  }

  // No API key = explicit failure (NOT silent fallback)
  if (!apiKey) {
    const output: NewsAgentOutput = {
      articles: [],
      disruptions: [],
      apiAvailable: false,
      error: 'NEWS_API_KEY not configured. Add it to .env file from newsapi.org',
    };
    return output;
  }

  try {
    const result = await newsCircuit.execute(async () => {
      const { result: output } = await withTelemetry(logger, 'fetch-news', async () => {
        const query = buildNewsQuery(suppliers);
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=10&language=en&apiKey=${apiKey}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`NewsAPI returned ${response.status}: ${response.statusText}`);
        }

        const data: any = await response.json();

        if (data.status === 'error') {
          throw new Error(`NewsAPI error: ${data.message}`);
        }

        const rawArticles = data.articles || [];
        
        // Score and enrich articles
        const scoredArticles = rawArticles.map((a: any) => {
          const sourceName = a.source?.name || 'Unknown';
          const credibility = getSourceCredibility(sourceName);
          const isTier1 = TIER1_SOURCES.has(sourceName.toLowerCase());
          const isLogistics = LOGISTICS_SOURCES.has(sourceName.toLowerCase());

          return {
            title: a.title || '',
            summary: a.description || '',
            source: sourceName,
            sourceCredibility: credibility,
            publishedAt: a.publishedAt || new Date().toISOString(),
            url: a.url || '#',
            relevanceScore: (isTier1 ? 1.0 : isLogistics ? 0.9 : 0.5) * credibility,
          };
        });

        // Deduplicate
        const deduped = deduplicateArticles(scoredArticles);

        // Sort: Tier 1 first, then by relevance score
        deduped.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

        // Extract verified disruptions from articles (NOT synthesized)
        const disruptions = deduped
          .filter((a: any) => a.relevanceScore >= 0.5)
          .slice(0, 4)
          .map((a: any) => ({
            title: a.title,
            type: classifyDisruptionType(a.title, a.summary),
            severity: classifyNewsSeverity(a.title, a.summary),
            location: extractLocation(a.title, a.summary, suppliers),
            summary: a.summary,
            confidence: Math.round(a.sourceCredibility * 80 + 10), // 10-90 range
            sourceUrls: [a.url],
            verificationStatus: 'verified' as const,
          }));

        return {
          articles: deduped.slice(0, 8),
          disruptions,
          apiAvailable: true,
        };
      });

      return output;
    }, () => {
      // Circuit breaker fallback
      logger.warn('circuit-open', 'NewsAPI circuit breaker open, returning degraded output');
      const stale = newsCache.getStale(cacheKey);
      return stale || { articles: [], disruptions: [], apiAvailable: false, error: 'NewsAPI temporarily unavailable (circuit breaker)' };
    });

    // Cache the result
    newsCache.set(cacheKey, result);
    return result;

  } catch (error: any) {
    logger.error('fetch-failed', `News fetch failed: ${error.message}`);
    return {
      articles: [],
      disruptions: [],
      apiAvailable: false,
      error: `NewsAPI error: ${error.message}`,
    };
  }
};

/**
 * Classify disruption type from title/summary text.
 */
function classifyDisruptionType(title: string, summary: string): 'Weather' | 'Strike' | 'Logistics' | 'Incident' {
  const text = `${title} ${summary}`.toLowerCase();
  if (/typhoon|hurricane|storm|flood|earthquake|tornado|weather|rain|snow|drought/.test(text)) return 'Weather';
  if (/strike|union|labor|protest|walkout/.test(text)) return 'Strike';
  if (/accident|explosion|fire|collapse|incident|attack/.test(text)) return 'Incident';
  return 'Logistics';
}

/**
 * Classify severity from title/summary text.
 */
function classifyNewsSeverity(title: string, summary: string): 'High' | 'Medium' | 'Low' {
  const text = `${title} ${summary}`.toLowerCase();
  if (/severe|critical|emergency|shutdown|collapse|major|devastating|unprecedented/.test(text)) return 'High';
  if (/delay|bottleneck|disruption|warning|concern|slowdown/.test(text)) return 'Medium';
  return 'Low';
}

/**
 * Extract location from article text, matching against known supplier locations.
 */
function extractLocation(title: string, summary: string, suppliers: Supplier[]): string {
  const text = `${title} ${summary}`.toLowerCase();
  for (const supplier of suppliers) {
    const parts = supplier.location.toLowerCase().split(',').map(p => p.trim());
    for (const part of parts) {
      if (part.length > 3 && text.includes(part)) {
        return supplier.location;
      }
    }
  }
  return 'Global';
}
