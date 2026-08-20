/**
 * VISOR API Client (Frontend → Server)
 * All requests have AbortController timeouts and structured error handling.
 */

import { IntelligenceBrief, Supplier, ImpactAnalysis, Disruption, User, RiskScore } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

/** Execute a fetch with AbortController timeout */
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 20000): Promise<Response> => {
  const fullUrl = url.startsWith('/api') ? `${API_BASE_URL}${url}` : url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Request to ${fullUrl} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
};

export const generateGlobalRiskSignals = async (
  user: User,
  suppliers: Supplier[]
): Promise<{ disruptions: Disruption[]; supplierRiskScores: Record<string, RiskScore> }> => {
  try {
    const res = await fetchWithTimeout("/api/ai/global-risk-signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, suppliers }),
    }, 20000);

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      return { disruptions: data, supplierRiskScores: {} };
    }
    return {
      disruptions: data.disruptions || [],
      supplierRiskScores: data.supplierRiskScores || {}
    };
  } catch (e: any) {
    console.error("[apiClient] generateGlobalRiskSignals failed:", e.message);
    return { disruptions: [], supplierRiskScores: {} };
  }
};

export const generateSupplierIntelligence = async (
  supplier: Supplier,
  weatherData?: any,
  isSimulated: boolean = false,
  relevantDisruptions: Disruption[] = [],
  allSuppliers: Supplier[] = []
): Promise<IntelligenceBrief | null> => {
  try {
    const res = await fetchWithTimeout("/api/ai/supplier-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier, weatherData, isSimulated, relevantDisruptions, allSuppliers: allSuppliers.length > 0 ? allSuppliers : [supplier] }),
    }, 20000);

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error("[apiClient] generateSupplierIntelligence failed:", e.message);
    return null;
  }
};

export const generateImpactAnalysis = async (
  supplier: Supplier,
  isSimulated: boolean
): Promise<ImpactAnalysis | null> => {
  try {
    const res = await fetchWithTimeout("/api/ai/impact-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier, isSimulated }),
    }, 20000);

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error("[apiClient] generateImpactAnalysis failed:", e.message);
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
    const res = await fetchWithTimeout("/api/ai/resource-briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, type, activeDisruptionSummary }),
    }, 20000);

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error("[apiClient] generateResourceBriefing failed:", e.message);
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
    const res = await fetchWithTimeout("/api/ai/resource-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, type, activeDisruptionSummary }),
    }, 20000);

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error("[apiClient] generateResourceDocument failed:", e.message);
    return { title: "Unavailable", summary: "", keyPoints: [], classification: "UNCLASSIFIED" };
  }
};

export const checkGroqConnection = async (): Promise<{ success: boolean; message: string; modelUsed?: string }> => {
  try {
    const res = await fetchWithTimeout("/api/ai/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, 10000);

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error("[apiClient] checkGroqConnection failed:", e.message);
    return { success: false, message: e?.message || "Connection failed" };
  }
};
