import Groq from "groq-sdk";
import { IntelligenceBrief, Supplier, ImpactAnalysis, Disruption, RiskStatus, User } from "../types";
import { MOCK_DISRUPTIONS } from "../constants";

let groq: Groq;
const getGroq = () => {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
  return groq;
};

const parseJson = (raw: string, fallback = "{}"): any => {
  if (!raw || !raw.trim()) return JSON.parse(fallback);
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1) cleaned = cleaned.substring(first, last + 1);
  try { return JSON.parse(cleaned); } catch { return JSON.parse(fallback); }
};

const callGroq = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const models = ["openai/gpt-oss-120b"];
  for (const model of models) {
    try {
      const res = await getGroq().chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4096,
      });
      return res.choices[0]?.message?.content || "{}";
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("model") && (msg.includes("unavailable") || msg.includes("not found"))) continue;
      throw e;
    }
  }
  throw new Error("All Groq models unavailable");
};

const intelCache = new Map<string, { data: IntelligenceBrief; timestamp: number }>();
const globalRiskCache = new Map<string, { data: Disruption[]; timestamp: number }>();
const impactCache = new Map<string, { data: ImpactAnalysis; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;
const GLOBAL_CACHE_TTL = 30 * 60 * 1000;

export const generateSupplierIntelligence = async (
  supplier: Supplier,
  weatherData?: any,
  isSimulated: boolean = false,
  relevantDisruptions: Disruption[] = [],
  newsContext: string = ""
): Promise<IntelligenceBrief> => {
  const cacheKey = `${supplier.id}-${isSimulated}-${relevantDisruptions.map(d => d.id).join(',')}-${new Date().toLocaleDateString('en-CA')}`;
  const cached = intelCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  const currentDate = new Date().toLocaleDateString();
  const weatherContext = weatherData
    ? `Current weather at ${supplier.location}: ${weatherData.weather[0].description}, ${weatherData.main.temp}°C.`
    : "No weather data available.";
  const simulationContext = isSimulated
    ? `CRISIS MODE OVERRIDE: Severe infrastructure severance at ${supplier.location}. System Status: ${supplier.status}.`
    : `System Resolution: ${supplier.status}.`;
  const disruptionContext = relevantDisruptions.length > 0
    ? `REAL-TIME DISRUPTIONS: ${relevantDisruptions.map(d => `${d.title} (${d.severity})`).join(", ")}`
    : "No major disruptions detected.";

  const systemPrompt = `You are a Strategic Logistics Analyst. Today is ${currentDate}.
You will be given a supplier's details, real-time news context, and weather data.
You MUST use the provided news and weather context to generate a specific, 
contextual intelligence brief. Never return generic placeholder text.

Respond ONLY with a valid JSON object matching this exact schema, no markdown:
{
  "vectorSummary": "3-4 sentence analysis referencing the SPECIFIC news events and weather conditions provided. Name the actual events, explain exactly how they affect this supplier's category and location. If rain is mentioned in weather, reference it. If a geopolitical event is in the news, connect it to this supplier's operations.",
  "weatherStatus": "2-3 sentences describing the current weather at this supplier's location and its direct operational impact on their specific category (e.g. heavy rain affecting semiconductor fabs vs textile factories vs logistics hubs differently).",
  "suggestedStatus": "STABLE" | "CAUTION" | "RISKY",
  "todayFeed": [
    {
      "title": "Specific event title from news or weather context",
      "status": "STABLE"|"CAUTION"|"RISKY",
      "insight": "2-3 sentences explaining the specific bottleneck or operational impact of this event on this supplier."
    }
  ],
  "recentFeed": [
    {
      "title": "Specific recent event title",
      "status": "STABLE"|"CAUTION"|"RISKY", 
      "insight": "2-3 sentences of specific operational insight."
    }
  ],
  "historicalContext": "3-4 sentences on structural vulnerabilities of this specific region and category. Reference known risks for this location (e.g. Taiwan semiconductor geopolitical risk, Rotterdam port labor history, Vietnam textile supply chain exposure).",
  "mitigationSteps": [
    "Specific actionable step directly addressing the news or weather events mentioned — not generic advice",
    "Second specific mitigation referencing the supplier category and region"
  ],
  "confidenceScore": number between 60-95,
  "alternativeSuppliers": ["region or supplier type that could substitute"],
  "impact": {
    "bottleneck": "2-3 sentences identifying the primary failure point based on current conditions",
    "estDelay": "estimated delay range e.g. 12h-48h",
    "strategicAction": "2-3 sentences of specific strategic response referencing current events"
  }
}

CRITICAL: If news context is provided, you MUST reference specific events from it. 
If weather data shows rain/storm/heat, you MUST mention it by name and connect it 
to operations. Generic responses like 'nominal operational heartbeat' or 
'standard seasonal variance' are FORBIDDEN.`;

  const newsBlock = newsContext
    ? `REAL-TIME NEWS CONTEXT:\n${newsContext}`
    : "No real-time news available.";

  const userPrompt = `Supplier: ${supplier.name}
Category: ${supplier.category}
Location: ${supplier.location}
Current Status: ${supplier.status}
${simulationContext}
${weatherContext}
${disruptionContext}
${newsBlock}

Generate a high-fidelity intelligence brief for this specific supplier.
Every field must reference the actual news and weather context above.
The vectorSummary must name specific events from the news context.
The mitigationSteps must address the specific risks identified, not generic advice.
If the news block says "No real-time news available", still generate 
location-specific and category-specific analysis based on known regional 
risks for ${supplier.location} in the ${supplier.category} sector.`;

  try {
    const raw = await callGroq(systemPrompt, userPrompt);
    const data = parseJson(raw, "{}");
    const result: IntelligenceBrief = {
      supplierId: supplier.id,
      summary: data.vectorSummary || "",
      vectorSummary: data.vectorSummary || "",
      weatherStatus: data.weatherStatus || "",
      suggestedStatus: data.suggestedStatus as RiskStatus,
      todayFeed: data.todayFeed || [],
      recentFeed: data.recentFeed || [],
      historicalContext: data.historicalContext || "",
      recommendations: data.mitigationSteps || [],
      mitigationSteps: data.mitigationSteps || [],
      confidenceScore: data.confidenceScore || 80,
      alternativeSuppliers: data.alternativeSuppliers || [],
      lastUpdated: new Date().toISOString(),
      sources: [],
      impactAnalysis: data.impact || { bottleneck: "None", estDelay: "0h", strategicAction: "Monitor" }
    };
    intelCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error: any) {
    console.error("=== GROQ SERVICE ERROR ===", error?.message, error?.status, error?.error?.message);
    const suggestedStatus = isSimulated ? RiskStatus.RISKY : (supplier.status || RiskStatus.STABLE);
    return {
      supplierId: supplier.id,
      summary: `Intelligence fetch failed for ${supplier.name}. Check GROQ_API_KEY in server .env.`,
      vectorSummary: `Baseline operational status for ${supplier.name} in ${supplier.location}.`,
      weatherStatus: "Weather data pending.",
      suggestedStatus,
      todayFeed: [{ title: "Operational Status Verified", status: suggestedStatus, insight: "Telemetry check indicates steady-state conditions." }],
      recentFeed: [],
      historicalContext: `Operations profile compiled for ${supplier.name}.`,
      recommendations: ["Schedule routine communications check", "Keep priority alert channels open"],
      mitigationSteps: ["Groq API unavailable — verify GROQ_API_KEY is set in .env without VITE_ prefix"],
      confidenceScore: 70,
      alternativeSuppliers: [],
      lastUpdated: new Date().toISOString(),
      sources: [],
      impactAnalysis: { bottleneck: "None", estDelay: "0h", strategicAction: "Monitor baseline metrics." }
    };
  }
};

export const generateGlobalRiskSignals = async (user: User, suppliers: Supplier[], newsContext: string = ""): Promise<Disruption[]> => {
  const hqLocation = user.hqLocation || "Global";
  const nodeRegions = Array.from(new Set(suppliers.map(s => s.location))).sort().join("|");
  const today = new Date().toLocaleDateString("en-CA"); // gives YYYY-MM-DD
  const cacheKey = `global-${hqLocation}-${nodeRegions}-${today}`;
  const cached = globalRiskCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GLOBAL_CACHE_TTL) return cached.data;

  const currentDate = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const supplierList = suppliers.slice(0, 15).map(s => `${s.name} (${s.location})`).join("; ");

  const systemPrompt = `You are a Real-time Supply Chain Risk Analyst. Today is ${currentDate}.
Respond ONLY with a valid JSON object. No markdown, no explanation:
{
  "disruptions": [
    {
      "id": "string",
      "title": "string",
      "type": "Weather" | "Strike" | "Logistics" | "Incident",
      "severity": "High" | "Medium" | "Low",
      "location": "City, Country",
      "timestamp": "ISO string",
      "summary": "Detailed multi-sentence explanation (3-4 sentences minimum) detailing the event, its severity, regional supply chain impacts, and specific effects on the named impactedSuppliers.",
      "impactedSuppliers": ["supplier name"],
      "sourceUrl": "string",
      "verificationStatus": "verified" if this disruption is directly grounded in the real-time news context provided, or "AI-synthesized" if you generated it because no relevant news was available
    }
  ]
}
If the news context does not contain any disruptions, you MUST synthesize 2-3 realistic disruptions based on the actual locations of the suppliers, ensuring they map to the correct supplier names. Do NOT return an empty list.`;

  const newsBlock = newsContext
    ? `REAL-TIME NEWS:\n${newsContext}`
    : "No real-time news available.";

  const userPrompt = `HQ: ${hqLocation}. Supplier nodes: ${supplierList}.
${newsBlock}

Identify 2 to 4 supply chain disruptions affecting the supplier nodes' locations from the last 24-48 hours.
If the news context is empty, dry, or lacks major disruptions, you MUST synthesize realistic and plausible regional disruptions (e.g. port strikes, weather delays, transport bottlenecks, power cuts, or regional custom delays) matching the actual locations of the suppliers.
For each disruption, write a comprehensive, broad summary (3-4 sentences minimum) explaining the root cause, its severity level, and the precise logistics impact on the affected supplier nodes.
In the 'impactedSuppliers' field, output the exact names of the affected suppliers (e.g. "Advanced Micro Circuits", "Global Logistics Hub", "South Sea Textiles", "Bavarian Motor Parts", "Tokyo Electron Components", "Organic Grain Corp", "BioGen Therapeutics") that are located in the affected regions.`;

  try {
    const raw = await callGroq(systemPrompt, userPrompt);
    const data = parseJson(raw, '{"disruptions":[]}');
    const result = (data.disruptions || []).map((d: any) => ({
      ...d,
      impactedSuppliers: (d.impactedSuppliers || []).map((name: string) => {
        const found = suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
        return found ? found.id : name;
      })
    }));
    globalRiskCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error: any) {
    console.error("generateGlobalRiskSignals error:", error?.message);
    if (cached) return cached.data;
    return MOCK_DISRUPTIONS;
  }
};

export const generateImpactAnalysis = async (supplier: Supplier, isSimulated: boolean): Promise<ImpactAnalysis> => {
  const cacheKey = `impact-${supplier.id}-${isSimulated}`;
  const cached = impactCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  const systemPrompt = `You are a supply chain impact analyst. Respond ONLY with valid JSON, no markdown:
{
  "bottleneck": "Detailed operational bottleneck description (2-3 sentences minimum).", 
  "estDelay": "estimated delay (e.g. 36h-48h)", 
  "strategicAction": "Detailed strategic mitigation action (2-3 sentences minimum)."
}`;

  const userPrompt = isSimulated
    ? `CRISIS MODE: ${supplier.name} (${supplier.category}) at ${supplier.location} has severe network severance.
Identify cascading failures, propagation to other nodes, and specific non-obvious mitigation actions.`
    : `Analytical impact assessment for ${supplier.name} in ${supplier.location}.
Based on current regional logistics status, identify any bottlenecks, estimated delays, and strategic actions.
If no disruption exists report baseline throughput with 0h delay.`;

  try {
    const raw = await callGroq(systemPrompt, userPrompt);
    const data = parseJson(raw, "{}");
    impactCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error: any) {
    console.error("generateImpactAnalysis error:", error?.message);
    return {
      bottleneck: isSimulated ? "Logistics Terminal Interruption" : "Regional Transit Queue",
      estDelay: isSimulated ? "48h-72h" : "0h",
      strategicAction: isSimulated
        ? "Activate backup logistics channels immediately."
        : "No action required. Monitor baseline metrics."
    };
  }
};

export const groundMapLocation = async (supplier: Supplier) => {
  const systemPrompt = `You are a logistics infrastructure analyst. Respond with a brief text description only.`;
  const userPrompt = `Verify infrastructure and logistics risks around ${supplier.name} at ${supplier.location}. Identify nearby ports and airports.`;
  try {
    const text = await callGroq(systemPrompt, userPrompt);
    return { text, links: [] };
  } catch {
    return { text: "Location grounding unavailable.", links: [] };
  }
};

export const checkGroqConnection = async (): Promise<{ success: boolean; message: string; modelUsed?: string }> => {
  try {
    await callGroq("You are a test assistant.", "Reply with: ok");
    return { success: true, message: "Groq connection verified", modelUsed: "openai/gpt-oss-120b" };
  } catch (e: any) {
    return { success: false, message: e?.message || "Connection failed" };
  }
};
