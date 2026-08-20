
export enum RiskStatus {
  STABLE = 'STABLE',
  CAUTION = 'CAUTION',
  RISKY = 'RISKY'
}

export type Role = 'Admin' | 'Manager' | 'Analyst' | 'Viewer';

export interface User {
  id?: string;
  email?: string;
  company: string;
  role: Role;
  accessKey?: string;
  hqLocation?: string;
  hqCoordinates?: [number, number];
  sectors?: string[];
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  location: string;
  coordinates: [number, number];
  status: RiskStatus;
  contactEmail: string;
  lastUpdated: string;
  /** Supplier criticality for risk weighting */
  criticality?: 'critical' | 'important' | 'standard';
}

export interface Disruption {
  id: string;
  title: string;
  type: 'Weather' | 'Strike' | 'Incident' | 'Logistics';
  severity: 'High' | 'Medium' | 'Low';
  location: string;
  timestamp: string;
  summary: string;
  impactedSuppliers: string[];
  weatherIcon?: string;
  sourceUrl?: string;
  verificationStatus?: 'verified' | 'unverified' | 'AI-synthesized';
  /** Confidence score 0-100 for this disruption signal */
  confidence?: number;
  /** Source credibility score 0-1 */
  sourceCredibility?: number;
}

export interface IntelligenceBrief {
  supplierId: string;
  summary: string;
  vectorSummary: string;
  weatherStatus: string;
  todayFeed: { title: string; status: RiskStatus; insight: string }[];
  recentFeed: { title: string; status: RiskStatus; insight: string }[];
  suggestedStatus: RiskStatus;
  historicalContext: string;
  recommendations: string[];
  mitigationSteps: string[];
  confidenceScore: number;
  alternativeSuppliers: string[];
  lastUpdated: string;
  sources: { title: string; uri: string }[];
  impactAnalysis?: ImpactAnalysis;
  /** Deterministic risk score with full breakdown */
  riskScore?: RiskScore;
  /** Confidence metrics for all signals */
  confidenceMetrics?: import('./lib/confidenceEngine').ConfidenceMetrics;
}

export interface ImpactAnalysis {
  bottleneck: string;
  estDelay: string;
  strategicAction: string;
}

export type View = 'DASHBOARD' | 'REGISTRY' | 'INTELLIGENCE' | 'MAP' | 'FEED' | 'SETTINGS' | 'RESOURCES';

// ─── Agentic Architecture Types ──────────────────────────────────

/** Structured output from the News Intelligence Agent */
export interface NewsAgentOutput {
  articles: Array<{
    title: string;
    summary: string;
    source: string;
    sourceCredibility: number;
    publishedAt: string;
    url: string;
    relevanceScore: number;
  }>;
  disruptions: Array<{
    title: string;
    type: Disruption['type'];
    severity: Disruption['severity'];
    location: string;
    summary: string;
    confidence: number;
    sourceUrls: string[];
    verificationStatus: 'verified' | 'AI-synthesized';
  }>;
  apiAvailable: boolean;
  error?: string;
}

/** Structured output from the Weather Intelligence Agent */
export interface WeatherAgentOutput {
  alerts: Array<{
    location: string;
    condition: string;
    severity: 'High' | 'Medium' | 'Low';
    temperature: number;
    windSpeed: number;
    humidity: number;
    description: string;
    icon: string;
    impactedSupplierIds: string[];
    supplyChainImpact: string;
  }>;
  currentConditions: Record<string, {
    temp: number;
    description: string;
    windSpeed: number;
    humidity: number;
    pressure: number;
    icon: string;
  }>;
  apiAvailable: boolean;
  error?: string;
}

/** Structured output from the Supply Chain Impact Agent */
export interface SupplyChainAgentOutput {
  impacts: Array<{
    supplierId: string;
    supplierName: string;
    bottleneck: string;
    estimatedDelay: string;
    affectedOperations: string[];
    cascadeRisk: 'High' | 'Medium' | 'Low';
  }>;
  evidenceSummary: string;
}

/** Deterministic risk score with full breakdown */
export interface RiskScore {
  score: number;              // 0-100
  level: RiskStatus;          // STABLE | CAUTION | RISKY
  breakdown: {
    severity: number;         // 0-30 (weight: 0.30)
    supplierCriticality: number; // 0-25 (weight: 0.25)
    geographicProximity: number; // 0-20 (weight: 0.20)
    confidence: number;       // 0-15 (weight: 0.15)
    eventDuration: number;    // 0-10 (weight: 0.10)
  };
  evidence: {
    newsSignals: string[];
    weatherSignals: string[];
    disruptionMatches: string[];
  };
  explanation: string;
}

/** Structured output from the Executive Briefing Agent */
export interface BriefingAgentOutput {
  vectorSummary: string;
  weatherStatus: string;
  historicalContext: string;
  todayFeed: Array<{ title: string; status: RiskStatus; insight: string }>;
  recentFeed: Array<{ title: string; status: RiskStatus; insight: string }>;
  mitigationSteps: string[];
  alternativeSuppliers: string[];
}

/** Complete orchestrated result from the Agent Coordinator */
export interface CoordinatorResult {
  newsOutput: NewsAgentOutput;
  weatherOutput: WeatherAgentOutput;
  supplyChainOutput: SupplyChainAgentOutput;
  riskScore: RiskScore;
  briefing: BriefingAgentOutput;
  confidenceMetrics: import('./lib/confidenceEngine').ConfidenceMetrics;
  latencyMs: number;
  traceId: string;
}

/** Supplier criticality derivation from category */
export const getSupplierCriticality = (supplier: Supplier): 'critical' | 'important' | 'standard' => {
  if (supplier.criticality) return supplier.criticality;
  
  const criticalCategories = ['Semiconductors', 'Pharmaceuticals'];
  const importantCategories = ['Automotive', 'Electronics', 'Logistics'];

  if (criticalCategories.includes(supplier.category)) return 'critical';
  if (importantCategories.includes(supplier.category)) return 'important';
  return 'standard';
};
