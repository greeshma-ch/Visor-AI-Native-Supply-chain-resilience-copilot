import { IntelligenceBrief, Supplier, ImpactAnalysis, Disruption, User } from "../types";

// In production (Vercel), set VITE_API_URL to your Render backend URL.
// In dev, falls back to the same origin (Express serves both).
const BASE_URL = (import.meta as any).env?.VITE_API_URL || "";

const apiFetch = (path: string, options: RequestInit) =>
  fetch(`${BASE_URL}${path}`, options);

export const generateGlobalRiskSignals = async (
  user: User,
  suppliers: Supplier[]
): Promise<Disruption[]> => {
  try {
    const res = await apiFetch("/api/gemini/global-risk-signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, suppliers }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    return data.disruptions || data || [];
  } catch (e) {
    console.error("[apiClient] generateGlobalRiskSignals failed:", e);
    return [];
  }
};

export const generateSupplierIntelligence = async (
  supplier: Supplier,
  weatherData?: any,
  isSimulated: boolean = false,
  relevantDisruptions: Disruption[] = []
): Promise<IntelligenceBrief | null> => {
  try {
    const res = await apiFetch("/api/gemini/supplier-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier, weatherData, isSimulated, relevantDisruptions }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[apiClient] generateSupplierIntelligence failed:", e);
    return null;
  }
};

export const generateImpactAnalysis = async (
  supplier: Supplier,
  isSimulated: boolean
): Promise<ImpactAnalysis | null> => {
  try {
    const res = await apiFetch("/api/gemini/impact-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier, isSimulated }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[apiClient] generateImpactAnalysis failed:", e);
    return null;
  }
};

export const generateResourceBriefing = async (
  title: string,
  location: string,
  type: string,
  activeDisruptionSummary?: string
): Promise<any> => {
  try {
    const res = await apiFetch("/api/gemini/resource-briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, type, activeDisruptionSummary }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[apiClient] generateResourceBriefing failed:", e);
    return { summary: "Unavailable", keyPoints: [], status: "Error" };
  }
};

export const generateResourceDocument = async (
  title: string,
  location: string,
  type: string,
  activeDisruptionSummary?: string
): Promise<any> => {
  try {
    const res = await apiFetch("/api/gemini/resource-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, type, activeDisruptionSummary }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[apiClient] generateResourceDocument failed:", e);
    return { title: "Unavailable", summary: "", keyPoints: [], classification: "UNCLASSIFIED" };
  }
};
