
import { Supplier, Disruption, RiskStatus } from '../types';

export const resolveSupplierStatus = (
  supplier: Supplier,
  disruptions: Disruption[],
  simulatedRiskyNodes: string[]
): { status: RiskStatus; matchingDisruptions: Disruption[] } => {
  // Priority 1: Simulation
  if (simulatedRiskyNodes.includes(supplier.id)) {
    return { status: RiskStatus.RISKY, matchingDisruptions: [] };
  }

  // Find all matching disruptions (Direct ID match or Region match)
  const matching = disruptions.filter(d => {
    const isDirectlyImpacted = d.impactedSuppliers.includes(supplier.id) || d.impactedSuppliers.includes(supplier.name);
    if (isDirectlyImpacted) return true;

    if (!d.location) return false;
    const sLoc = supplier.location.toLowerCase();
    const dLoc = d.location.toLowerCase();
    
    const supplierParts = sLoc.split(',').map(p => p.trim().toLowerCase());
    const disruptionParts = dLoc.split(',').map(p => p.trim().toLowerCase());
    
    return supplierParts.some(rp => 
      disruptionParts.some(dp => 
        dp.includes(rp) || rp.includes(dp) ||
        dp.replace(/\s+/g, '') === rp.replace(/\s+/g, '')
      )
    );
  });

  if (matching.length === 0) {
    return { status: RiskStatus.STABLE, matchingDisruptions: [] };
  }

  // Resolve highest severity
  const severityMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
  const highest = matching.reduce((prev, curr) => {
    const pVal = severityMap[prev.severity as keyof typeof severityMap] || 0;
    const cVal = severityMap[curr.severity as keyof typeof severityMap] || 0;
    return cVal > pVal ? curr : prev;
  });

  const status = highest.severity === 'High' ? RiskStatus.RISKY : 
                 highest.severity === 'Medium' ? RiskStatus.CAUTION : 
                 RiskStatus.STABLE;

  return { status, matchingDisruptions: matching };
};
