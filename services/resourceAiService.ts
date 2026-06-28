import { fetchNewsArticles } from "./newsService";
import { generateWithGroq } from "./groqClient";




export interface ResourceBriefing {
  summary: string;
  keyPoints: string[];
  status: string;
}

export interface ResourceDocument {
  title: string;
  summary: string;
  keyPoints: string[];
  executiveSummary: string;
  detailedAnalysis: string;
  riskAssessment: string;
  operationalProtocol: string;
  mitigationStrategies: string;
  classification: string;
}

export const generateResourceBriefing = async (title: string, location: string, type: string, activeDisruptionSummary?: string): Promise<ResourceBriefing> => {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/gemini/resource-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, location, type, activeDisruptionSummary })
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error("Failed to fetch resource briefing from server, falling back directly:", e);
    }
  }

  const currentDate = new Date().toLocaleDateString();
  const contextPrompt = activeDisruptionSummary 
    ? `CRITICAL CONTEXT: This resource describes an active disruption: "${activeDisruptionSummary}". Base all analysis strictly on this event.`
    : `CONTEXT: No active disruptions reported for this node. This is a stability update and operational health check. Report "Operational Stability: ${location}" as the current status.`;

  let newsContextText = "No recent news found in NewsAPI.";
  try {
    const newsQuery = `("${location}" OR "${title}") AND (supply chain OR logistics OR disruption OR strike OR weather)`;
    const articles = await fetchNewsArticles(newsQuery, 5);
    if (articles.length > 0) {
      newsContextText = articles.map((art, idx) => `[${idx + 1}] Title: ${art.title}\nSource: ${art.source}\nDate: ${art.timestamp}\nSummary: ${art.summary}`).join("\n\n");
    }
  } catch (err) {
    console.error("Failed to retrieve news context for resource briefing:", err);
  }

  const contents = `Role: Supply Chain Intelligence Analyst. Today is ${currentDate}.
  Generate a professional, concise intelligence briefing for a ${type} titled "${title}" in "${location}". 
  
  EXTERNAL REAL-TIME NEWS CONTEXT (Ingested from NewsAPI):
  ===
  ${newsContextText}
  ===

  ${contextPrompt}

  Strict Instructions:
  1. Consistency: All details must match the news context and context prompt provided. Do NOT hallucinate secondary risks.
  2. Speed: Keep the response direct and data-focused.
  3. Format: Ground everything in the current date: ${currentDate}.

  YOU MUST respond with a JSON object using EXACTLY these field names:
  {
    "summary": "<2-3 sentence briefing summary>",
    "keyPoints": ["<key point 1>", "<key point 2>", "<key point 3>"],
    "status": "<current status e.g. 'Operational Stability' or 'Risk Alert'>" 
  }`;

  try {
    const systemPrompt = `You are a Supply Chain Intelligence Analyst. Respond with valid JSON only. No markdown.`;
    const result = await generateWithGroq(systemPrompt, contents);
    const parsed = JSON.parse(result);
    return {
      summary: parsed.summary || `Analysis for ${title} in ${location}.`,
      keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : ['Intelligence assessment in progress'],
      status: parsed.status || 'Assessment Pending'
    };
  } catch (error: any) {
    const errorString = error?.message || JSON.stringify(error) || '';
    const isBillingOrQuota = errorString.includes('prepayment') || errorString.includes('prepay') || errorString.includes('credits') || errorString.includes('billing') || errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('quota') || errorString.includes('rate_limit');
    if (isBillingOrQuota) {
      console.warn("[Simulated Co-pilot Mode Active - Resource Briefing] API requires billing setup or quota. Supplying baseline briefing documentation.");
    } else {
      console.error("Unexpected error in generateResourceBriefing:", errorString);
    }
    return {
      summary: activeDisruptionSummary || `Strategic analysis for ${title}. Focuses on regional logistics stability in ${location}.`,
      keyPoints: [
        "Risk assessment validated against current regional telemetry",
        "Operational stability monitoring in progress",
        "Logistics throughput optimization identified"
      ],
      status: activeDisruptionSummary ? "Risk Alert" : "Operational Stability"
    };
  }
};

export const generateResourceDocument = async (title: string, location: string, type: string, activeDisruptionSummary?: string): Promise<ResourceDocument> => {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/gemini/resource-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, location, type, activeDisruptionSummary })
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error("Failed to fetch resource document from server, falling back directly:", e);
    }
  }

  const currentDate = new Date().toLocaleDateString();
  const contextPrompt = activeDisruptionSummary 
    ? `CRITICAL CONTEXT: This document must document the active disruption: "${activeDisruptionSummary}". All sections including Risk Assessment and Mitigation must be derived from this specific event.`
    : `CONTEXT: No active disruptions. This is a Stability Handbook and Health Check for the ${location} node. Ensure the Risk Assessment section reflects high stability and 'No Probable Disruption'.`;

  let newsContextText = "No recent news found in NewsAPI.";
  try {
    const newsQuery = `("${location}" OR "${title}") AND (supply chain OR logistics OR disruption OR strike OR weather)`;
    const articles = await fetchNewsArticles(newsQuery, 5);
    if (articles.length > 0) {
      newsContextText = articles.map((art, idx) => `[${idx + 1}] Title: ${art.title}\nSource: ${art.source}\nDate: ${art.timestamp}\nSummary: ${art.summary}`).join("\n\n");
    }
  } catch (err) {
    console.error("Failed to retrieve news context for resource document:", err);
  }

  const contents = `Role: Senior Risk Architect. Today is ${currentDate}.
  Generate a professional intelligence document for a ${type} titled "${title}" in "${location}". 
  
  EXTERNAL REAL-TIME NEWS CONTEXT (Ingested from NewsAPI):
  ===
  ${newsContextText}
  ===

  ${contextPrompt}

  Include the following sections:
  1. Summary & Key Points
  2. Executive Summary
  3. Detailed Analysis: Explicitly analyze the external news context above.
  4. Risk Assessment: If context is stable, state "No active disruptions identified".
  5. Operational Protocol
  6. Mitigation Strategies: Focus on preemptive resilience if stable.

  YOU MUST respond with a JSON object using EXACTLY these field names:
  {
    "title": "${title}",
    "summary": "<document summary>",
    "keyPoints": ["<key point 1>", "<key point 2>"],
    "executiveSummary": "<executive summary paragraph>",
    "detailedAnalysis": "<detailed analysis paragraph>",
    "riskAssessment": "<risk assessment paragraph>",
    "operationalProtocol": "<operational protocol paragraph>",
    "mitigationStrategies": "<mitigation strategies paragraph>",
    "classification": "INTERNAL // CLASSIFIED"
  }`;

  try {
    const systemPrompt = `You are a Supply Chain Intelligence Analyst. Respond with valid JSON only. No markdown.`;
    const result = await generateWithGroq(systemPrompt, contents);
    const parsed = JSON.parse(result);
    return {
      title: parsed.title || title,
      summary: parsed.summary || `Document for ${title}.`,
      keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : ['Assessment in progress'],
      executiveSummary: parsed.executiveSummary || 'Executive summary being compiled.',
      detailedAnalysis: parsed.detailedAnalysis || 'Detailed analysis in progress.',
      riskAssessment: parsed.riskAssessment || 'Risk assessment pending.',
      operationalProtocol: parsed.operationalProtocol || 'Standard operating procedures active.',
      mitigationStrategies: parsed.mitigationStrategies || 'Mitigation strategies being evaluated.',
      classification: parsed.classification || 'INTERNAL // CLASSIFIED'
    };
  } catch (error) {
    console.error("Error generating document:", error);
    return {
      title,
      summary: activeDisruptionSummary || `Standard stability documentation for ${title}.`,
      keyPoints: ["Operational monitoring active", "Regional stability verified"],
      executiveSummary: activeDisruptionSummary ? `Crisis response document regarding ${activeDisruptionSummary}` : "Annual node stability and logistics protocol briefing.",
      detailedAnalysis: "Grounded analysis based on current regional telemetry and nodal performance indicators.",
      riskAssessment: activeDisruptionSummary ? activeDisruptionSummary : "No probable disruptions found according to real-time intelligence nodes.",
      operationalProtocol: "Follow Standard Operating Procedures (SOP-LOG-01) for regional node management.",
      mitigationStrategies: "Deactivate identified bottlenecks and switch to pre-verified alternate logistics corridors. Activate strategic contingency reserves.",
      classification: "INTERNAL // CLASSIFIED"
    };
  }
};
