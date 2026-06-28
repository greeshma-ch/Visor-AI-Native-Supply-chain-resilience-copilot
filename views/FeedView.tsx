
import React from 'react';
import { User, Disruption, Supplier } from '../types';
import { Bell, Cloud, Ship, Zap, Info, Clock, ExternalLink, Archive, Sun, CloudRain, CloudLightning, CloudSnow, Wind, Lock } from 'lucide-react';
import { resolveSupplierStatus } from '../lib/riskEngine';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import Skeleton from '../components/Skeleton';

interface FeedViewProps {
  user: User;
  categoryFilter: string;
  onNavigateToResources: (title: string, sources?: { title: string; uri: string }[]) => void;
  disruptions: Disruption[];
  suppliers: Supplier[];
  simulatedRiskyNodes?: string[];
  isRefreshing?: boolean;
}

const FeedView: React.FC<FeedViewProps> = ({ user, categoryFilter, onNavigateToResources, disruptions, suppliers, simulatedRiskyNodes = [], isRefreshing }) => {
  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInMs = now.getTime() - then.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    
    const diffInHours = Math.floor(diffInMins / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    return then.toLocaleDateString();
  };

  const typeIcons = {
    Weather: Cloud,
    Strike: Zap,
    Incident: Info,
    Logistics: Ship,
  };

  const getWeatherIcon = (iconCode?: string) => {
    if (!iconCode) return Cloud;
    
    // Map OpenWeatherMap icon codes to Lucide icons
    if (iconCode.startsWith('01')) return Sun;
    if (iconCode.startsWith('02') || iconCode.startsWith('03') || iconCode.startsWith('04')) return Cloud;
    if (iconCode.startsWith('09') || iconCode.startsWith('10')) return CloudRain;
    if (iconCode.startsWith('11')) return CloudLightning;
    if (iconCode.startsWith('13')) return CloudSnow;
    if (iconCode.startsWith('50')) return Wind;
    
    return Cloud;
  };

  const finalFeed = React.useMemo(() => {
    const relevantSuppliers = suppliers.filter(s => categoryFilter === 'ALL' || s.category === categoryFilter);

    return relevantSuppliers.map(s => {
      const isSimulated = simulatedRiskyNodes.includes(s.id);
      const { status, matchingDisruptions } = resolveSupplierStatus(s, disruptions, simulatedRiskyNodes);
      
      const filteredDisruptions = matchingDisruptions.filter(d => 
        categoryFilter === 'ALL' || d.type === categoryFilter || d.type === 'Logistics' || d.type === 'Weather'
      );

      if (isSimulated) {
        return {
          id: `sim-${s.id}`,
          title: `CRITICAL ALERT: Simulation Override`,
          type: 'Strike' as const, // Use Zap icon
          severity: 'High' as const,
          location: s.location,
          timestamp: new Date().toISOString(),
          summary: `System-level crisis simulation triggered for ${s.name}. All operational telemetry is currently bypassed to evaluate emergency response protocols and alternative node viability.`,
          impactedSuppliers: [s.id],
          verificationStatus: 'verified' as const
        };
      }

      if (filteredDisruptions.length > 0) {
        // Pick highest severity from relevant ones
        const severityMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return filteredDisruptions.reduce((prev, curr) => {
          const pVal = severityMap[prev.severity as keyof typeof severityMap] || 0;
          const cVal = severityMap[curr.severity as keyof typeof severityMap] || 0;
          return cVal > pVal ? curr : prev;
        });
      }

      // Generate stability signal if no disruptions match the resolution engine
      return {
        id: `stable-${s.id}`,
        title: `Node Operational: ${s.name}`,
        type: 'Logistics' as const,
        severity: 'Low' as const,
        location: s.location,
        timestamp: s.lastUpdated || new Date().toISOString(),
        summary: `AI Intelligence confirms nominal operational heartbeat for ${s.name}. Regional telemetry and logistics pipelines are functioning within established performance benchmarks.`,
        impactedSuppliers: [s.id],
        verificationStatus: 'verified' as const
      };
    }).sort((a, b) => {
      const severityMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const sA = severityMap[a.severity as keyof typeof severityMap] || 0;
      const sB = severityMap[b.severity as keyof typeof severityMap] || 0;
      if (sA !== sB) return sB - sA;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [suppliers, disruptions, categoryFilter]);

  const handleAccessArchival = () => {
    toast.info("Establishing encrypted handshake with VISOR Archival Vault... Accessing historical logistics metadata (2018-2023).");
    onNavigateToResources("VISOR ARCHIVAL VAULT");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight leading-none uppercase">Predictive Risk Signals</h2>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`} />
            <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest leading-none">
              {isRefreshing ? 'Syncing Real-time Feed...' : `Live Intelligence • ${finalFeed.length} Strategic Nodes Monitored`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full h-fit">
          <Clock size={12} className="text-slate-500" />
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Last Refreshed: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isRefreshing ? (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div 
                key={i} 
                className="bg-[#0a0f1c] p-6 sm:p-8 rounded-[2rem] border border-white/5 shadow-sm animate-pulse flex flex-col h-full min-h-[350px]"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 shadow-lg" />
                  <div className="p-2 bg-white/5 rounded-xl w-8 h-8" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-2 w-16 bg-white/10 rounded" />
                    <div className="h-2 w-20 bg-white/10 rounded" />
                  </div>
                  <div className="h-6 w-3/4 bg-white/10 rounded mb-4" />
                  <div className="p-4 bg-white/[0.02] rounded-2xl mb-6 border border-white/5">
                    <div className="h-3 w-full bg-white/5 rounded mb-2" />
                    <div className="h-3 w-5/6 bg-white/5 rounded mb-2" />
                    <div className="h-3 w-4/6 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="flex flex-col gap-4 border-t border-white/5 pt-6">
                  <div className="h-2 w-12 bg-white/5 rounded mb-1" />
                  <div className="h-4 w-24 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </>
        ) : finalFeed.map((alert) => {
          const Icon = alert.type === 'Weather' ? getWeatherIcon(alert.weatherIcon) : (typeIcons[alert.type] || Info);
          const iconColor = alert.type === 'Weather' && alert.weatherIcon ? (
            alert.weatherIcon.startsWith('01') ? 'text-amber-400' :
            alert.weatherIcon.startsWith('09') || alert.weatherIcon.startsWith('10') ? 'text-blue-500' :
            alert.weatherIcon.startsWith('11') ? 'text-amber-500' :
            alert.weatherIcon.startsWith('13') ? 'text-slate-200' :
            'text-blue-400'
          ) : 'text-white';

          const displayTitle = alert.title === "Operational Stability" 
            ? `Operational Stability: ${alert.location}` 
            : alert.title;

          return (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={alert.id} 
              onClick={() => onNavigateToResources(displayTitle)}
              className="bg-[#0a0f1c] p-6 sm:p-8 rounded-[2rem] border border-white/5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform group-hover:scale-110 ${
                  alert.severity === 'High' ? 'bg-rose-600 shadow-rose-900/20' : 
                  alert.severity === 'Medium' ? 'bg-amber-600 shadow-amber-900/20' :
                  'bg-blue-600 shadow-blue-900/20'
                } ${iconColor}`}>
                  <Icon size={20} />
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                    alert.severity === 'High' ? 'bg-rose-500/20 text-rose-400' : 
                    alert.severity === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {alert.severity}
                  </span>
                  {alert.verificationStatus === 'verified' && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                      <Zap size={8} /> Verified
                    </span>
                  )}
                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1">
                    <Clock size={12} className="text-slate-600" /> {getRelativeTime(alert.timestamp)}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white tracking-tight leading-tight mb-4 group-hover:text-blue-400 transition-colors uppercase">{displayTitle}</h3>
                
                <div className="p-4 bg-white/[0.02] rounded-2xl mb-6 border border-white/5 shadow-inner group-hover:bg-white/[0.04] transition-colors relative overflow-hidden">
                  {alert.sourceUrl && (
                    <a 
                      href={alert.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-blue-500/20 rounded-lg text-slate-500 hover:text-blue-400 transition-all z-10"
                      title="View Source Feed"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                  <p className="text-slate-400 text-[11px] leading-relaxed font-medium line-clamp-3">
                    "{alert.summary}"
                  </p>
                </div>

                <div className="mb-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap size={10} className="text-blue-400" />
                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Reasoning Synthesis</span>
                  </div>
                  <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                    <p className="text-[9px] text-slate-500 italic leading-snug">
                      {alert.severity === 'High' 
                        ? "AI Flagged: Critical alignment of regional telemetry and news sentiment indicates high propagation risk across identified nodes."
                        : alert.severity === 'Medium'
                          ? "AI Analysis: Moderate volatility detected in regional logistics corridors. Operational variance suggests potential downstream impact."
                          : "AI Observation: Telemetry suggests standard seasonal variance. Monitoring for escalation triggers."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-white/5 pt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Impact Zone</span>
                  <span className="text-xs font-extrabold text-white uppercase truncate">{alert.location}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Nodes Affected</span>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const directlyImpacted = alert.impactedSuppliers;
                      const geographicallyImpacted = suppliers
                        .filter(s => {
                          if (directlyImpacted.includes(s.id) || directlyImpacted.includes(s.name)) return false;
                          if (!alert.location) return false;
                          const supplierParts = s.location.toLowerCase().split(',').map(p => p.trim());
                          const alertParts = alert.location.toLowerCase().split(',').map(p => p.trim());
                          return supplierParts.some(rp => alertParts.some(dp => dp.includes(rp) || rp.includes(dp)));
                        })
                        .map(s => s.id);
                      
                      const allImpactedIds = [...directlyImpacted, ...geographicallyImpacted];

                      if (allImpactedIds.length === 0) {
                        return <span className="text-[9px] font-black text-slate-500 uppercase italic">Monitoring Regional Perimeters</span>;
                      }

                      return allImpactedIds.map((id) => {
                        const supplier = suppliers.find(s => s.id === id);
                        const displayName = supplier ? supplier.name : id.toUpperCase();
                        return (
                          <div 
                            key={id} 
                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-black text-slate-300 shadow-sm hover:bg-white/10 transition-colors" 
                            title={`Supplier: ${displayName}`}
                          >
                            {displayName}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {finalFeed.length === 0 && (
        <div className="py-20 text-center bg-white/[0.03] rounded-[2.5rem] border border-dashed border-white/10">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No signals detected in this channel.</p>
        </div>
      )}

      <div className="text-center pt-8 relative">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAccessArchival}
          className="px-8 py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all shadow-xl flex items-center gap-3 mx-auto bg-white text-slate-900 hover:bg-slate-100"
        >
          <Archive size={16} /> Access Archival Data
        </motion.button>
      </div>
    </div>
  );
};

export default FeedView;
