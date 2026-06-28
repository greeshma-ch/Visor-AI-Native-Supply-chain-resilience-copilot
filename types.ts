
export enum RiskStatus {
  STABLE = 'STABLE',
  CAUTION = 'CAUTION',
  RISKY = 'RISKY'
}

export type Role = 'Admin' | 'Manager' | 'Analyst' | 'Viewer';

export interface User {
  company: string;
  role: Role;
  accessKey: string;
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
  verificationStatus?: 'verified' | 'unverified';
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
}

export interface ImpactAnalysis {
  bottleneck: string;
  estDelay: string;
  strategicAction: string;
}

export type View = 'DASHBOARD' | 'REGISTRY' | 'INTELLIGENCE' | 'MAP' | 'FEED' | 'SETTINGS' | 'RESOURCES';
