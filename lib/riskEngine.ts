/**
 * VISOR Risk Engine — Deterministic Status Resolution
 * Uses geographic matching and weighted scoring to determine supplier status.
 * LLMs NEVER directly assign final risk levels.
 */

import { Supplier, Disruption, RiskStatus, RiskScore, getSupplierCriticality } from '../types';
import { matchLocations, getProximityScore } from './geoMatcher';

/**
 * Resolve a supplier's risk status deterministically.
 * Uses normalized geographic matching instead of substring comparison.
 */
export const resolveSupplierStatus = (
  supplier: Supplier,
  disruptions: Disruption[],
  simulatedRiskyNodes: string[]
): { status: RiskStatus; matchingDisruptions: Disruption[]; riskScore?: RiskScore } => {
  // Priority 1: Simulation override
  if (simulatedRiskyNodes.includes(supplier.id)) {
    return {
      status: RiskStatus.RISKY,
      matchingDisruptions: [],
      riskScore: {
        score: 95,
        level: RiskStatus.RISKY,
        breakdown: { severity: 30, supplierCriticality: 25, geographicProximity: 20, confidence: 10, eventDuration: 10 },
        evidence: { newsSignals: [], weatherSignals: [], disruptionMatches: ['Crisis simulation active'] },
        explanation: 'Crisis simulation mode — supplier manually flagged as RISKY for testing.',
      },
    };
  }

  // Find all matching disruptions using normalized geo-matching
  const matching = disruptions.filter(d => {
    // Direct ID or name match
    const isDirectlyImpacted = d.impactedSuppliers.includes(supplier.id) || d.impactedSuppliers.includes(supplier.name);
    if (isDirectlyImpacted) return true;

    if (!d.location) return false;

    // Use geographic matcher (handles aliases, prevents false positives)
    const matchScore = matchLocations(supplier.location, d.location, supplier.coordinates);
    return matchScore >= 0.5; // Only accept matches with 50%+ confidence
  });

  if (matching.length === 0) {
    return {
      status: RiskStatus.STABLE,
      matchingDisruptions: [],
      riskScore: {
        score: 5,
        level: RiskStatus.STABLE,
        breakdown: { severity: 0, supplierCriticality: 0, geographicProximity: 0, confidence: 5, eventDuration: 0 },
        evidence: { newsSignals: [], weatherSignals: [], disruptionMatches: [] },
        explanation: 'No matching disruptions detected — supplier is operationally stable.',
      },
    };
  }

  // Compute weighted risk score
  const severityMap: Record<string, number> = { 'High': 30, 'Medium': 18, 'Low': 8 };
  const maxSeverity = Math.max(...matching.map(d => severityMap[d.severity] || 0));
  const concurrencyBonus = Math.min((matching.length - 1) * 3, 6);
  const severityScore = Math.min(maxSeverity + concurrencyBonus, 30);

  // Supplier criticality
  const criticality = getSupplierCriticality(supplier);
  const criticalityScores: Record<string, number> = { 'critical': 25, 'important': 15, 'standard': 8 };
  const criticalityScore = criticalityScores[criticality];

  // Geographic proximity (best match)
  const bestProximity = Math.max(...matching.map(d =>
    matchLocations(supplier.location, d.location, supplier.coordinates)
  ));
  const proximityScore = Math.round(bestProximity * 20);

  // Confidence (based on verification status)
  const verifiedCount = matching.filter(d => d.verificationStatus === 'verified').length;
  const confScore = Math.min(verifiedCount * 5 + 5, 15);

  // Duration estimate
  const durationMap: Record<string, number> = { 'Strike': 8, 'Weather': 5, 'Incident': 3, 'Logistics': 6 };
  const durationScore = Math.min(Math.max(...matching.map(d => durationMap[d.type] || 3)), 10);

  // Total
  const totalScore = Math.min(severityScore + criticalityScore + proximityScore + confScore + durationScore, 100);

  const level: RiskStatus = totalScore >= 70 ? RiskStatus.RISKY
    : totalScore >= 40 ? RiskStatus.CAUTION
    : RiskStatus.STABLE;

  const riskScore: RiskScore = {
    score: totalScore,
    level,
    breakdown: {
      severity: severityScore,
      supplierCriticality: criticalityScore,
      geographicProximity: proximityScore,
      confidence: confScore,
      eventDuration: durationScore,
    },
    evidence: {
      newsSignals: matching.filter(d => d.type !== 'Weather').map(d => `[${d.severity}] ${d.title}`),
      weatherSignals: matching.filter(d => d.type === 'Weather').map(d => `[${d.severity}] ${d.title}`),
      disruptionMatches: matching.map(d => `${d.title} at ${d.location}`),
    },
    explanation: `Risk score: ${totalScore}/100 → ${level}. ${matching.length} disruption(s) match this supplier's location.`,
  };

  return { status: level, matchingDisruptions: matching, riskScore };
};
