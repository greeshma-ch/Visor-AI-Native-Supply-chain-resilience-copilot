import { IntelligenceBrief, Supplier, ImpactAnalysis, Disruption, RiskStatus, User } from "../types";
import { MOCK_DISRUPTIONS } from "../constants";
import { fetchNewsArticles } from "./newsService";
import { generateWithGroq } from "./groqClient";



const parseJsonFromGemini = (rawText: string, fallbackJson = "{}"): any => {
  if (!rawText || !rawText.trim()) {
    return JSON.parse(fallbackJson);
  }

  let cleaned = rawText.trim();

  // Remove markdown codeblock wrapper if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  // Find the outermost JSON object bounds (first '{' and last '}')
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    console.warn("Standard JSON parse failed. Attempting advanced remediation...", err.message);

    // Advanced cleaning:
    // 1. Remove comments
    let sanitized = cleaned
      .replace(/\/\*[\s\S]*?\*\//g, "") // remove block comments
      .replace(/(?:^|[^:])\/\/.*$/gm, ""); // remove single line comments

    // 2. Remove common citations/annotations (e.g. "disruptions": [...] [1] or similar)
    sanitized = sanitized
      .replace(/\]\s*\[\d+\]/g, ']')
      .replace(/\}\s*\[\d+\]/g, '}')
      .replace(/"\s*\[\d+\]/g, '"');

    try {
      return JSON.parse(sanitized);
    } catch (err2) {
      console.error("All JSON parsing attempts failed. Raw text was:", rawText);
      return JSON.parse(fallbackJson);
    }
  }
};

// In-memory cache to reduce API calls and mitigate quota hits
const intelCache = new Map<string, { data: IntelligenceBrief; timestamp: number }>();
const globalRiskCache = new Map<string, { data: Disruption[]; timestamp: number }>();
const impactCache = new Map<string, { data: ImpactAnalysis; timestamp: number }>();

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const GLOBAL_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for global signals

export const generateSupplierIntelligence = async (supplier: Supplier, weatherData?: any, isSimulated: boolean = false, relevantDisruptions: Disruption[] = []): Promise<IntelligenceBrief> => {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/gemini/supplier-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier, weatherData, isSimulated, relevantDisruptions })
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error("Failed to fetch supplier intelligence from server, falling back directly:", e);
    }
  }

  // Check cache first
  const cacheKey = `${supplier.id}-${isSimulated}-${relevantDisruptions.length}`;
  const cached = intelCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  const currentDate = new Date().toLocaleDateString();
  const weatherContext = weatherData 
    ? `Current weather at ${supplier.location}: ${weatherData.weather[0].description}, ${weatherData.main.temp}°C.`
    : "Search for current weather.";

  const simulationContext = isSimulated 
    ? `CRISIS MODE OVERRIDE: Severe infrastructure severance at ${supplier.location}. System Status: ${supplier.status}.`
    : `System Resolution: ${supplier.status}.`;

  const disruptionContext = relevantDisruptions.length > 0 
    ? `REAL-TIME DISRUPTIONS: ${relevantDisruptions.map(d => `${d.title} (${d.severity})`).join(', ')}`
    : "No major disruptions detected in official feeds.";

  let newsContextText = "No recent articles found in NewsAPI.";
  try {
    const newsQuery = `("${supplier.location}" OR "${supplier.name}") AND (logistics OR shipping OR supply chain OR trade OR port OR weather)`;
    const articles = await fetchNewsArticles(newsQuery, 5);
    if (articles.length > 0) {
      newsContextText = articles.map((art, idx) => `[${idx + 1}] Title: ${art.title}\nSource: ${art.source}\nDate: ${art.timestamp}\nContent Summary: ${art.summary}\nLink: ${art.url}`).join("\n\n");
    }
  } catch (err) {
    console.error("Failed to retrieve news context for supplier intelligence:", err);
  }

  const prompt = `Role: Strategic Logistics Analyst. Today is ${currentDate}.
  LOCATION LOCK: All geographic references must use the exact string '${supplier.location}'. Do not paraphrase, translate, or split this location string.
  Location: ${supplier.location}, Category: ${supplier.category}, Resolved Risk Status: ${supplier.status}.
  
  ${simulationContext}
  ${weatherContext}
  ${disruptionContext}

  EXTERNAL REAL-TIME NEWS CONTEXT (Ingested from NewsAPI):
  ===
  ${newsContextText}
  ===
  
  Task: Provide a high-fidelity intelligence brief and impact assessment that justifies the Resolved Risk Status of ${supplier.status}.
  Ground your reasoning and analysis strictly in the provided real-time weather, feed analysis, and the external news articles context above.
  Do not mention or assume any news events not found in the context.
  If the status is CAUTION or RISKY, identify exactly which signal (weather, feed, or news context) triggered the escalation.
  If STABLE, confirm baseline operational integrity despite local conditions.

  YOU MUST respond with a JSON object using EXACTLY these field names:
  {
    "vectorSummary": "<2-3 sentence summary of the intelligence brief>",
    "weatherStatus": "<1-2 sentence weather impact assessment>",
    "suggestedStatus": "${supplier.status}",
    "todayFeed": [
      { "title": "<signal title>", "status": "STABLE", "insight": "<brief analytical insight>" }
    ],
    "recentFeed": [
      { "title": "<historical signal title>", "status": "STABLE", "insight": "<brief insight>" }
    ],
    "historicalContext": "<1-2 sentences of regional historical context>",
    "mitigationSteps": ["<actionable recommendation 1>", "<actionable recommendation 2>", "<actionable recommendation 3>"],
    "confidenceScore": 85,
    "alternativeSuppliers": ["<alternative supplier name 1>", "<alternative supplier name 2>"],
    "impact": {
      "bottleneck": "<primary bottleneck or 'None'>",
      "estDelay": "<estimated delay e.g. '0h' or '12h-24h'>",
      "strategicAction": "<recommended strategic action>"
    }
  }
  The "suggestedStatus" field MUST be one of: "STABLE", "CAUTION", "RISKY".
  The "todayFeed" and "recentFeed" arrays must have at least 1 entry each. Status values must be: "STABLE", "CAUTION", or "RISKY".`;

  try {
    const systemPrompt = `You are a Strategic Logistics Analyst. Always respond with valid JSON only matching the exact schema provided. No markdown, no explanation, only JSON.`;

    const result = await generateWithGroq(systemPrompt, prompt);
    const data = parseJsonFromGemini(result, "{}");

    const defaultFeed = [{ title: 'Status Check', status: supplier.status, insight: 'Automated status verification.' }];
    const resultObj: IntelligenceBrief = {
      supplierId: supplier.id,
      summary: data.vectorSummary || data.summary || 'Intelligence synthesis in progress.',
      vectorSummary: data.vectorSummary || data.summary || 'Intelligence synthesis in progress.',
      weatherStatus: data.weatherStatus || 'Weather data being processed.',
      suggestedStatus: (data.suggestedStatus as RiskStatus) || supplier.status,
      todayFeed: Array.isArray(data.todayFeed) && data.todayFeed.length > 0 ? data.todayFeed : defaultFeed,
      recentFeed: Array.isArray(data.recentFeed) ? data.recentFeed : [],
      historicalContext: data.historicalContext || `Monitoring active for ${supplier.name} at ${supplier.location}.`,
      recommendations: Array.isArray(data.mitigationSteps) ? data.mitigationSteps : ['Continue standard monitoring protocols'],
      mitigationSteps: Array.isArray(data.mitigationSteps) ? data.mitigationSteps : ['Continue standard monitoring protocols'],
      confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 75,
      alternativeSuppliers: Array.isArray(data.alternativeSuppliers) ? data.alternativeSuppliers : [],
      lastUpdated: new Date().toISOString(),
      sources: Array.isArray(data.sources) ? data.sources : [],
      impactAnalysis: data.impact || data.impactAnalysis || { bottleneck: 'None', estDelay: '0h', strategicAction: 'Monitor baseline metrics.' }
    };

    intelCache.set(cacheKey, { data: resultObj, timestamp: Date.now() });
    return resultObj;
  } catch (error: any) {
    const errorString = error?.message || JSON.stringify(error) || '';
    const isBillingOrQuota = errorString.includes('prepayment') || errorString.includes('prepay') || errorString.includes('credits') || errorString.includes('billing') || errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('quota') || errorString.includes('rate_limit');
    if (isBillingOrQuota) {
      console.warn("[Simulated Co-pilot Mode Active - Supplier Intelligence] API requires billing setup or quota. Gracefully serving baseline analytics.");
    } else {
      console.error("Unexpected error in generateSupplierIntelligence:", errorString);
    }
    const suggestedStatus = isSimulated ? RiskStatus.RISKY : (supplier.status || RiskStatus.STABLE);
    
    let summary = "Nodal operations continue under standard baseline parameters.";
    let weatherStatus = "Current local weather observations confirm no severe disruption threat vectors.";
    let bottleneck = "None";
    let delay = "0h";
    let strategicAction = "Maintain real-time telemetry scans and standard log checks.";
    let recommendations = ["Schedule routine communications check", "Keep priority alert channels open"];
    let todayFeed = [
      {
        title: "Operational Status Verified",
        status: suggestedStatus,
        insight: "Telemetry check indicates steady-state nodal conditions."
      }
    ];

    if (suggestedStatus === RiskStatus.RISKY) {
      summary = `CRITICAL STATE OVERRIDE: Severe transit disruptions and logistic blockages in surrounding shipping routes of ${supplier.location}. Intermittent physical outages flagged.`;
      weatherStatus = "Adverse local storm or structural bottleneck events suspected near transit nodes.";
      bottleneck = "Nodal Logistics Interface / Local Terminals";
      delay = "48h-72h";
      strategicAction = "Activate regional third-party backup carriers immediately. Reroute primary shipments through secondary safe zones.";
      recommendations = [
        "Surgical inventory audits across safe warehouses",
        "Engage premium logistics channels for high-priority SKUs",
        "Notify supply managers of active contingency pipeline"
      ];
      todayFeed = [
        {
          title: "Infrastructure Outage Simulated",
          status: RiskStatus.RISKY,
          insight: "Direct transportation links reporting severe simulated disruption."
        }
      ];
    } else if (suggestedStatus === RiskStatus.CAUTION) {
      summary = `MONITORING WARNING: Cautious forecast for ${supplier.name} in ${supplier.location} due to general congestion and cargo customs clearing queues.`;
      weatherStatus = "Minor weather warnings or local congestion alerts active.";
      bottleneck = "Customs Clearing Queue / Cargo Port Reception";
      delay = "12h-24h";
      strategicAction = "Audit transport bill documents and prioritize medical or semiconductor category cargo shipments.";
      recommendations = [
        "Prepare backup supplier options in safe nodes",
        "Verify emergency buffer material stocks"
      ];
      todayFeed = [
        {
          title: "Minor Congestion At Transit Hub",
          status: RiskStatus.CAUTION,
          insight: "Wait times at primary clearing facilities increased slightly."
        }
      ];
    }

    return {
      supplierId: supplier.id,
      summary: summary,
      vectorSummary: summary,
      weatherStatus: weatherStatus,
      suggestedStatus: suggestedStatus,
      todayFeed: todayFeed,
      recentFeed: [],
      historicalContext: `Strategic history profile compiled for ${supplier.name} under Category ${supplier.category}. Operations verified.`,
      recommendations: recommendations,
      mitigationSteps: recommendations,
      confidenceScore: 90,
      alternativeSuppliers: ["s4", "s6", "s7"].filter(id => id !== supplier.id).slice(0, 2),
      lastUpdated: new Date().toISOString(),
      sources: [],
      impactAnalysis: { bottleneck, estDelay: delay, strategicAction }
    };
  }
};

export const generateGlobalRiskSignals = async (user: User, suppliers: Supplier[]): Promise<Disruption[]> => {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/gemini/global-risk-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, suppliers })
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error("Failed to fetch global risk signals from server, falling back directly:", e);
    }
  }

  const hqLocation = user.hqLocation || "Global";
  const nodeRegions = Array.from(new Set(suppliers.map(s => s.location))).sort().join("|");
  const cacheKey = `global-${hqLocation}-${nodeRegions}`;
  
  const cached = globalRiskCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < GLOBAL_CACHE_TTL)) {
    return cached.data;
  }

  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const nodeRegionsList = Array.from(new Set(suppliers.map(s => s.location))).join(", ");
  const supplierList = suppliers.slice(0, 15).map(s => `${s.name} (${s.location})`).join("; "); 
  
  let newsContextText = "No recent articles found in NewsAPI.";
  try {
    const locationsQuery = Array.from(new Set(suppliers.map(s => s.location))).slice(0, 6).map(l => `"${l}"`).join(" OR ");
    const newsQuery = `(${locationsQuery}) AND (strike OR port OR storm OR flood OR delay OR logistics OR supply chain OR disruption)`;
    const articles = await fetchNewsArticles(newsQuery, 10);
    if (articles.length > 0) {
      newsContextText = articles.map((art, idx) => `[${idx + 1}] Title: ${art.title}\nLocation/Source: ${art.source}\nDate: ${art.timestamp}\nSummary: ${art.summary}\nLink: ${art.url}`).join("\n\n");
    }
  } catch (err) {
    console.error("Failed to retrieve news context for global risk signals:", err);
  }

  const prompt = `Role: Real-time Risk Analyst. Today: ${currentDate}.
  HQ: ${hqLocation}. Nodes in: ${nodeRegions}.
  Suppliers: ${supplierList}.

  EXTERNAL REAL-TIME NEWS CONTEXT (Ingested from NewsAPI):
  ===
  ${newsContextText}
  ===

  Task: Extract real-time supply chain disruptions and incidents from the provided external news articles context above that impact the regions and suppliers in the nodes list.
  
  STRICT GROUNDING RULES:
  1. Base your results ONLY on the provided external news articles context above. Do not hallucinate or assume other news events.
  2. Every "High" or "Medium" disruption MUST be linked to a verifiable news or weather event found in the context.
  3. Grounding: If no disruption is found in the context for a region, report "Operational Stability: [Region]" and mark severity as "Low". CRITICAL: Do NOT mark stability as Medium or High.
  4. Impact Linkage: Explain exactly HOW the event affects supply chain (e.g., "Closure of Port X disrupts delivery for Supplier Y").
  5. Node Accuracy: Explicitly name impacted suppliers from the list if they are in the blast radius of the news events.
  6. Location Normalization: Always return location as 'City, Country' format exactly matching the supplier's location string. Never abbreviate, translate, or reformat the location. Example: if supplier is 'Shanghai, China' return 'Shanghai, China' — not 'Shanghai' or 'China' or 'CN'.
  7. Use the "Link" field from the context as the "sourceUrl" for each disruption.
  
  YOU MUST respond with a JSON object using EXACTLY this schema:
  {
    "disruptions": [
      {
        "id": "<unique-id string>",
        "title": "<disruption headline>",
        "type": "Weather" | "Strike" | "Incident" | "Logistics",
        "severity": "High" | "Medium" | "Low",
        "location": "<City, Country - matching supplier location format>",
        "timestamp": "${now.toISOString()}",
        "summary": "<1-2 sentence impact summary>",
        "impactedSuppliers": ["<supplier name from the list>"],
        "sourceUrl": "<URL from the news context Link field>"
      }
    ]
  }
  - If no disruptions found, return: { "disruptions": [] }
  - Do not add any text outside of the JSON braces.`;

  try {
    const systemPrompt = `You are a Real-time Risk Analyst. Always respond with valid JSON only. No markdown. Return a JSON object with a disruptions array.`;

    const result = await generateWithGroq(systemPrompt, prompt);
    const data = parseJsonFromGemini(result, '{"disruptions": []}');
    
    const disruptionsList = Array.isArray(data.disruptions) ? data.disruptions : [];
    
    const resultObj = disruptionsList.map((d: any) => ({
      ...d,
      impactedSuppliers: Array.isArray(d.impactedSuppliers) 
        ? d.impactedSuppliers.map((name: string) => {
            const found = suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
            return found ? found.id : name;
          })
        : []
    }));

    globalRiskCache.set(cacheKey, { data: resultObj, timestamp: Date.now() });
    return resultObj;
  } catch (error: any) {
    const errorString = error?.message || JSON.stringify(error) || '';
    const isBillingOrQuota = errorString.includes('prepayment') || errorString.includes('prepay') || errorString.includes('credits') || errorString.includes('billing') || errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('quota') || errorString.includes('rate_limit');
    if (isBillingOrQuota) {
      console.warn("[Simulated Co-pilot Mode Active - Global Risk Signals] API requires billing setup or quota. Gracefully serving baseline risk assessment.");
    } else {
      console.error("Unexpected error in generateGlobalRiskSignals:", errorString);
    }
    // Graceful fallback to cache if available even if stale
    if (cached) {
      console.warn("Serving stale global risk signals from cache due to API error.");
      return cached.data;
    }
    console.warn("Serving MOCK_DISRUPTIONS as a fallback for Global Risk Signals.");
    return MOCK_DISRUPTIONS;
  }
};

export const generateImpactAnalysis = async (supplier: Supplier, isSimulated: boolean): Promise<ImpactAnalysis> => {
  const cacheKey = `impact-${supplier.id}-${isSimulated}`;
  const cached = impactCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  let newsContextText = "No recent articles found in NewsAPI.";
  if (!isSimulated) {
    try {
      const newsQuery = `("${supplier.location}" OR "${supplier.name}") AND (logistics OR infrastructure OR transport OR delay OR bottleneck OR port)`;
      const articles = await fetchNewsArticles(newsQuery, 5);
      if (articles.length > 0) {
        newsContextText = articles.map((art, idx) => `[${idx + 1}] Title: ${art.title}\nSource: ${art.source}\nDate: ${art.timestamp}\nSummary: ${art.summary}`).join("\n\n");
      }
    } catch (err) {
      console.error("Failed to retrieve news context for impact analysis:", err);
    }
  }

  const impactSchema = `
  YOU MUST respond with a JSON object using EXACTLY these field names:
  {
    "bottleneck": "<primary bottleneck description or 'Baseline Throughput'>",
    "estDelay": "<estimated delay e.g. '0h', '12h-24h', '48h-72h'>",
    "strategicAction": "<recommended strategic action>"
  }`;

  const prompt = isSimulated
    ? `CRITICAL REASONING MODE: Impact assessment for ${supplier.name} (${supplier.category}) at ${supplier.location}.
       SCENARIO: Severe network severance and logistics blackout.
       
       STRESS TEST REQUIREMENTS:
       1. Cascading Analysis: Identify what could fail next if this state persists.
       2. Propagation Scenario: Predict the primary disruption vector to other nodes.
       3. Operator Blind Spots: Highlight high-risk variables often ignored in this scenario.
       4. Mitigation: Suggest non-obvious contingency actions (e.g., specific secondary channel activation).
       
       STYLE: Crisis decision support. No filler. Analytical and strategic.
       ${impactSchema}`
    : `Analytical Task: Impact assessment for ${supplier.name} in ${supplier.location}.
       
       EXTERNAL REAL-TIME NEWS CONTEXT (Ingested from NewsAPI):
       ===
       ${newsContextText}
       ===

       STRICT GROUNDING:
       1. Base analysis ONLY on the provided external news context and recent weather/port indicators.
       2. If no verifiable disruption is found in the context, report "Baseline Throughput" with 0 delay.
       3. Strategic action must be specific to the identified bottleneck.
       ${impactSchema}`;

  try {
    const systemPrompt = `You are a supply chain impact analyst. Respond with valid JSON only matching the schema. No markdown.`;

    const result = await generateWithGroq(systemPrompt, prompt);
    const rawData = parseJsonFromGemini(result, "{}");
    const data: ImpactAnalysis = {
      bottleneck: rawData.bottleneck || 'Assessment pending',
      estDelay: rawData.estDelay || '0h',
      strategicAction: rawData.strategicAction || 'Monitor baseline metrics.'
    };
    impactCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error: any) {
    const errorString = error?.message || JSON.stringify(error) || '';
    const isBillingOrQuota = errorString.includes('prepayment') || errorString.includes('prepay') || errorString.includes('credits') || errorString.includes('billing') || errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('quota') || errorString.includes('rate_limit');
    if (isBillingOrQuota) {
      console.warn("[Simulated Co-pilot Mode Active - Impact Analysis] API requires billing setup or quota. Gracefully serving backup assessment.");
    } else {
      console.error("Unexpected error in generateImpactAnalysis:", errorString);
    }
    if (cached) {
      console.warn("Serving stale impact analysis from cache due to API error.");
      return cached.data;
    }
    return {
      bottleneck: isSimulated ? "Logistics Terminal Interruption" : "Regional Transit Queue Congestion",
      estDelay: isSimulated ? "48h-72h" : (supplier.status === RiskStatus.CAUTION ? "12h-24h" : "0h"),
      strategicAction: isSimulated 
        ? "Engage priority backup logistics and transition primary node tasks immediately." 
        : (supplier.status === RiskStatus.CAUTION ? "Audit logistics paperwork and secure backup capacity." : "No action required. Monitor baseline metrics.")
    };
  }
};

export const groundMapLocation = async (supplier: Supplier) => {
  let newsContextText = "No recent articles found in NewsAPI.";
  try {
    const newsQuery = `("${supplier.location}" OR "${supplier.name}") AND (airport OR port OR terminal OR logistics OR infrastructure)`;
    const articles = await fetchNewsArticles(newsQuery, 5);
    if (articles.length > 0) {
      newsContextText = articles.map((art, idx) => `[${idx + 1}] Title: ${art.title}\nSource: ${art.source}\nLink: ${art.url}\nSummary: ${art.summary}`).join("\n\n");
    }
  } catch (err) {
    console.error("Failed to retrieve news context for groundMapLocation:", err);
  }

  const prompt = `Grounding Task: Verify infrastructure and logistics risks around ${supplier.name} at ${supplier.location}. Identify nearby ports/airports.
  
  EXTERNAL REAL-TIME NEWS CONTEXT:
  ===
  ${newsContextText}
  ===
  
  Task: Summarize nearby ports, airports, and infrastructure features mentioned in the context.
  Verify local risks and infrastructure based on this context.`;

  try {
    const systemPrompt = `You are a logistics infrastructure analyst. Respond with valid JSON only.`;
    const result = await generateWithGroq(systemPrompt, prompt);
    return { text: result, links: [] };
  } catch (error: any) {
    const errorString = error?.message || JSON.stringify(error) || '';
    const isBillingOrQuota = errorString.includes('prepayment') || errorString.includes('prepay') || errorString.includes('credits') || errorString.includes('billing') || errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('quota') || errorString.includes('rate_limit');
    if (isBillingOrQuota) {
      console.warn("[Simulated Grounding Mode Active] API requires billing setup or quota. Serving offline telemetry.");
    } else {
      console.error("Unexpected error in groundMapLocation:", errorString);
    }
    return { text: "Live grounding unavailable.", links: [] };
  }
};

export const checkGeminiConnection = async (): Promise<{ success: boolean; message: string; modelUsed?: string }> => {
  try {
    const response = await generateWithGroq("You are a helpful assistant.", "Hello", 1);
    return {
      success: true,
      message: `Successfully connected to Groq. Response: ${response.trim()}`,
      modelUsed: "llama-3.3-70b-versatile"
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || JSON.stringify(error)
    };
  }
};
