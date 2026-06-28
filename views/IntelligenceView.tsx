
import React, { useState, useEffect } from 'react';
import { Supplier, IntelligenceBrief, RiskStatus, User, ImpactAnalysis, Disruption } from '../types';
import { generateSupplierIntelligence } from '../services/apiClient';
import { fetchCurrentWeather } from '../services/weatherService';
import RiskBadge from '../components/RiskBadge';
import Skeleton from '../components/Skeleton';
import { 
  ArrowLeft, 
  ArrowRight,
  RefreshCw, 
  CloudSun, 
  Newspaper, 
  History, 
  Lightbulb, 
  Users,
  Mail,
  ExternalLink,
  Globe,
  Zap,
  ShieldAlert,
  Calendar,
  Thermometer,
  Wind,
  Droplets,
  Lock,
  Check,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { toast } from 'sonner';

interface IntelligenceViewProps {
  user: User;
  supplier: Supplier;
  onBack: () => void;
  onUpdateStatus: (status: RiskStatus) => void;
  onNavigateToResources: (context?: { title: string; sources: { title: string; uri: string }[] }) => void;
  isSimulated?: boolean;
  onToggleSimulation: () => void;
  disruptions: Disruption[];
}

const IntelligenceView: React.FC<IntelligenceViewProps> = ({ 
  user, 
  supplier, 
  onBack, 
  onUpdateStatus, 
  onNavigateToResources, 
  isSimulated, 
  onToggleSimulation,
  disruptions 
}) => {
  const [brief, setBrief] = useState<IntelligenceBrief | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImpactExpanded, setIsImpactExpanded] = useState(false);
  const [mitigationSuccess, setMitigationSuccess] = useState(false);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState(false);

  // The supplier prop already comes from activeSuppliers in App.tsx, which is reconciled
  const resolvedStatus = supplier.status;
  
  const relevantDisruptions = React.useMemo(() => 
    disruptions.filter(d => {
      if (!d.location) return false;
      const sLoc = supplier.location.toLowerCase();
      const dLoc = d.location.toLowerCase();
      const supplierParts = sLoc.split(',').map(p => p.trim());
      const disruptionParts = dLoc.split(',').map(p => p.trim());
      return supplierParts.some(rp => disruptionParts.some(dp => dp.includes(rp) || rp.includes(dp)));
    }),
    [supplier.location, disruptions]
  );

  // Background Fetching - optimized with parallel execution and bundled AI calls
  const fetchIntelligence = async () => {
    setLoading(true);
    setImpactLoading(true);
    setError(null);
    try {
      // Start weather fetch immediately
      const weatherPromise = fetchCurrentWeather(supplier.coordinates[0], supplier.coordinates[1]);
      
      // Start intelligence and impact analysis combined call
      // We don't await weather here to allow the AI to start immediately if needed (using search grounding)
      // but typically we'll have weather data for the prompt shortly
      const weatherData = await weatherPromise;
      setWeather(weatherData);

      const intelData = await generateSupplierIntelligence(supplier, weatherData, !!isSimulated, relevantDisruptions);
      
      setImpactError(false);
      setBrief(intelData);
      
      if (intelData.impactAnalysis) {
        setImpactAnalysis(intelData.impactAnalysis);
      }
    } catch (err) {
      if (!brief) setError("Failed to generate intelligence brief. Check your API key and network connection.");
    } finally {
      setLoading(false);
      setImpactLoading(false);
    }
  };

  const handleSyncStatus = () => {
    if (brief?.suggestedStatus) {
      onUpdateStatus(brief.suggestedStatus);
      toast.success(`Registry updated: ${supplier.name} status set to ${brief.suggestedStatus}`);
    }
  };

  useEffect(() => {
    setBrief(null);
    setImpactAnalysis(null);
    fetchIntelligence();
  }, [supplier.id, isSimulated]);

  if (error) {
    return (
      <div className="p-8 sm:p-12 bg-rose-500/5 rounded-3xl border border-rose-500/10 flex flex-col items-center text-center max-w-lg mx-auto">
        <ShieldAlert size={48} className="text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-white">Analysis Interrupted</h3>
        <p className="text-slate-500 mt-2 text-sm">{error}</p>
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={fetchIntelligence}
          className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20"
        >
          Retry Analysis
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
          >
            <ArrowLeft size={24} />
          </motion.button>
          <div className="flex flex-col min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-white truncate max-w-[200px] sm:max-w-none">{supplier.name}</h2>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Mail size={12} className="text-slate-600" /> {supplier.contactEmail || 'No contact provided'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:ml-auto">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleSimulation}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
              isSimulated 
                ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]' 
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            <Zap size={14} className={isSimulated ? 'animate-pulse' : ''} />
            {isSimulated ? 'Crisis Mode Active' : 'Trigger Crisis Simulation'}
          </motion.button>
          <div className="h-10 w-[1px] bg-white/5 mx-2 hidden sm:block" />
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Node Integrity</span>
            <RiskBadge status={resolvedStatus} size="md" />
          </div>
          <AnimatePresence>
            {loading ? (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col items-end border-l border-white/10 pl-4 min-w-[120px]"
              >
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">
                  {isSimulated ? 'Calibrating Scenario...' : 'Processing Signals...'}
                </span>
                <Skeleton className="h-6 w-24" />
              </motion.div>
            ) : brief?.suggestedStatus && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col items-end border-l border-white/10 pl-4"
              >
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">{isSimulated ? 'Strategic Threat Level' : 'AI Assessment'}</span>
                <div className="flex items-center gap-2">
                  <RiskBadge status={brief.suggestedStatus} size="md" />
                  {brief.suggestedStatus === resolvedStatus ? (
                    <div className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                      <Check size={10} /> Synchronized
                    </div>
                  ) : (
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSyncStatus}
                      className="flex items-center gap-1 text-[8px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 hover:bg-amber-500/20 transition-colors shadow-sm"
                    >
                      <RefreshCw size={10} /> Sync Registry
                    </motion.button>
                  )}
                </div>
                <p className="text-[9px] font-medium text-slate-600 mt-1 opacity-60">
                  {weather?.weather?.[0]?.main || 'N/A'} + {brief?.todayFeed?.[0]?.status || 'N/A'} = {brief?.suggestedStatus}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button 
            whileHover={{ rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={fetchIntelligence}
            className="p-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl hover:text-white transition-all shadow-sm self-end"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </motion.button>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-6 mb-6 relative overflow-hidden">
        {isSimulated && (
          <div className="absolute top-0 right-0 px-3 py-1 bg-rose-600 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl z-10 animate-pulse">
            Crisis Mode Active
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Predictive Impact Assessment</h4>
          <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[7px] font-black text-blue-400 uppercase tracking-widest animate-pulse">Running Simulation</div>
        </div>
        <motion.button 
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsImpactExpanded(!isImpactExpanded)}
          className="text-blue-400 text-xs font-black uppercase tracking-widest hover:text-blue-300 transition-colors flex items-center gap-2"
        >
          <Zap size={12} /> {isImpactExpanded ? 'Deactivate' : 'Activate'} Deep Impact Synthesis
        </motion.button>
        
        <AnimatePresence>
          {isImpactExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-6 overflow-hidden"
            >
              {impactLoading ? (
                <div className="space-y-6 py-4">
                  <div className="flex items-center gap-3 text-slate-500 text-xs italic mb-4">
                    <RefreshCw size={14} className="animate-spin" /> Calculating impact vectors...
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ) : impactError ? (
                <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl text-rose-500 text-xs font-medium">
                  Failed to generate impact analysis. Please retry.
                </div>
              ) : impactAnalysis ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{isSimulated ? 'Primary Disruption Vector' : 'Bottleneck'}</p>
                    <p className="text-sm font-bold text-white">{impactAnalysis.bottleneck}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Est. Delay</p>
                    <p className="text-sm font-bold text-white">{impactAnalysis.estDelay}</p>
                  </div>
                  <div className="space-y-1 relative">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{isSimulated ? 'Crisis Contingency' : 'Strategic Action'}</p>
                    <p className="text-sm font-bold text-white">{impactAnalysis.strategicAction}</p>
                  </div>
                  <div className="sm:col-span-3 pt-4 border-t border-white/5 relative">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setMitigationSuccess(true);
                        toast.success("Mitigation Protocol Executed", {
                          description: "Strategic actions have been dispatched to regional logistics teams."
                        });
                      }}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        mitigationSuccess 
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      {mitigationSuccess ? 'Success' : 'Execute Mitigation'}
                    </motion.button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0a0f1c] p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/5 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <RefreshCw size={18} className="text-blue-500" /> Intelligence Synthesis Vectors
              </h3>
              {!loading && brief?.suggestedStatus && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Signal:</span>
                  <RiskBadge status={brief.suggestedStatus} size="sm" />
                </div>
              )}
            </div>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
              </div>
            ) : (
              <p className="text-slate-400 leading-relaxed text-sm sm:text-base">
                {brief?.summary}
              </p>
            )}
          </motion.section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0a0f1c] p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/5"
            >
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CloudSun size={16} className="text-amber-500" /> Weather Matrix
              </h4>
              
              {loading && !weather ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              ) : weather ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                        <img 
                          src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`} 
                          alt={weather.weather[0].description}
                          className="w-8 h-8"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{Math.round(weather.main.temp)}°C</p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{weather.weather[0].description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Feels Like</p>
                      <p className="text-sm font-bold text-white">{Math.round(weather.main.feels_like)}°C</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                    <div className="flex flex-col items-center p-2 bg-white/5 rounded-xl">
                      <Wind size={14} className="text-slate-400 mb-1" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Wind</span>
                      <span className="text-xs font-bold text-white">{weather.wind.speed}m/s</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-white/5 rounded-xl">
                      <Droplets size={14} className="text-blue-400 mb-1" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Humidity</span>
                      <span className="text-xs font-bold text-white">{weather.main.humidity}%</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-white/5 rounded-xl">
                      <Thermometer size={14} className="text-rose-400 mb-1" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pressure</span>
                      <span className="text-xs font-bold text-white">{weather.main.pressure}hPa</span>
                    </div>
                  </div>
                  
                  <div className="text-slate-400 text-xs leading-relaxed mt-4 italic">
                    AI Analysis: {loading ? <Skeleton className="h-3 w-32 inline-block" /> : brief?.weatherStatus}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{brief?.weatherStatus}</p>
              )}
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#0a0f1c] p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/5"
            >
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <History size={16} className="text-indigo-500" /> Regional Archive
              </h4>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-[80%]" />
                </div>
              ) : (
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{brief?.historicalContext}</p>
              )}
            </motion.div>
          </div>

          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#0a0f1c] p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/5 shadow-sm"
          >
            <h3 className="text-base sm:text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Newspaper size={18} className="text-emerald-500" /> {isSimulated ? 'Tactical Signal Analysis' : 'Intelligence Stream'}
            </h3>
            
            <div className="space-y-8">
              {loading ? (
                <div className="space-y-6">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <>
                  {/* Today's Feed */}
                  {brief?.todayFeed && brief.todayFeed.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={14} className="text-blue-500" /> {isSimulated ? 'Live Disruption Monitoring' : "Today's Briefing"}
                      </h4>
                      <div className="space-y-3">
                        {brief.todayFeed.map((item, i) => (
                          <div key={i} className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-slate-200 font-bold text-sm leading-tight">{item.title}</p>
                              <RiskBadge status={item.status} size="sm" />
                            </div>
                            <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                              <Lightbulb size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                              <p className="text-slate-400 text-xs leading-relaxed italic">
                                <span className="font-bold text-slate-300">Insight:</span> {item.insight}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Feed */}
                  {brief?.recentFeed && brief.recentFeed.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <History size={14} className="text-indigo-500" /> Recent Intelligence
                      </h4>
                      <div className="space-y-3">
                        {brief.recentFeed.map((item, i) => (
                          <div key={i} className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-slate-300 font-medium text-sm leading-tight">{item.title}</p>
                              <RiskBadge status={item.status} size="sm" />
                            </div>
                            <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                              <Lightbulb size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                              <p className="text-slate-500 text-xs leading-relaxed italic">
                                <span className="font-bold text-slate-400">Insight:</span> {item.insight}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!brief?.todayFeed?.length && !brief?.recentFeed?.length) && (
                    <div className="text-center py-8">
                      <p className="text-slate-500 text-sm italic">No recent intelligence signals detected for this node.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.section>
        </div>

        <div className="space-y-6 sm:space-y-8">
          <section className="bg-gradient-to-br from-indigo-700 to-blue-600 p-6 sm:p-8 rounded-3xl shadow-2xl text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap size={80} />
            </div>
            <h3 className="text-base sm:text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
              <Lightbulb size={18} className="text-blue-200" /> Copilot Mitigation Plan
            </h3>
            <div className="space-y-6 relative z-10">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full bg-white/10" />
                  <Skeleton className="h-10 w-full bg-white/10" />
                </div>
              ) : (
                (brief?.recommendations || []).map((rec, i) => {
                  // Heuristic for impact estimation based on recommendation type and simulation state
                  let impactValue = "";
                  let impactColor = "";

                  if (i === 0) {
                    impactValue = isSimulated ? "95% Crisis Mitigation" : "85% Risk Neutralization";
                    impactColor = "bg-emerald-400/20 text-emerald-300";
                  } else if (i === 1) {
                    impactValue = isSimulated ? "-24h Potential Downtime" : "-12h Expected Latency";
                    impactColor = "bg-amber-400/20 text-amber-200";
                  } else {
                    impactValue = isSimulated ? "Strategic Reserve Activation" : "Node Resilience Uplift";
                    impactColor = "bg-blue-400/20 text-blue-200";
                  }

                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex gap-3 text-xs sm:text-sm">
                        <span className="font-bold text-blue-200 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <p className="text-blue-50 leading-relaxed font-semibold">{rec}</p>
                      </div>
                      <div className="ml-7 flex items-center gap-2">
                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-white/10 ${impactColor}`}>
                          Impact: {impactValue}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-2">
               {(() => {
                 const confidenceVal = brief?.confidenceScore !== undefined ? brief.confidenceScore : 92;
                 const normalizedConfidence = confidenceVal <= 1 
                   ? Math.round(confidenceVal * 100) 
                   : (confidenceVal <= 10 ? Math.round(confidenceVal * 10) : Math.round(confidenceVal));
                 return (
                   <>
                     <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest opacity-70">AI-Simulated confidence score: {normalizedConfidence}%</p>
                     <div className="flex items-center gap-1">
                       {[1,2,3,4,5].map(v => {
                         const filled = v <= Math.round(normalizedConfidence / 20);
                         return <div key={v} className={`h-0.5 flex-1 rounded-full ${filled ? 'bg-white' : 'bg-white/20'}`} />;
                       })}
                     </div>
                   </>
                 );
               })()}
            </div>
          </section>

          <section className="bg-[#0a0f1c] p-6 sm:p-8 rounded-3xl border border-white/5">
            <h3 className="text-base sm:text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Users size={18} className="text-slate-500" /> Alternative Nodes
            </h3>
            <div className="space-y-2 relative">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                (brief?.alternativeSuppliers || []).map((alt, i) => (
                  <motion.button 
                    whileHover={{ x: 5 }}
                    key={i} 
                    onClick={() => onNavigateToResources({
                      title: `Intelligence for ${supplier.name}`,
                      sources: brief?.sources || []
                    })}
                    className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-between text-xs sm:text-sm transition-colors group"
                  >
                    <span className="font-bold text-slate-300 group-hover:text-white">{alt}</span>
                    <ExternalLink size={16} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </motion.button>
                ))
              )}
            </div>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-3xl border border-dashed border-white/10 group">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Globe size={14} className="text-blue-500 group-hover:animate-pulse" /> Verification Evidence Signals
              </h4>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigateToResources({
                  title: `Verification Sources: ${supplier.name}`,
                  sources: brief?.sources || []
                })}
                className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
              >
                Deep Trace <ArrowRight size={16} />
              </motion.button>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full opacity-30" />
                  <Skeleton className="h-12 w-full opacity-30" />
                </div>
              ) : (
                (brief?.sources || []).slice(0, 3).map((source, i) => (
                  <motion.a 
                    whileHover={{ scale: 1.01 }}
                    key={i}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-left relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Signal {i + 1}</span>
                      <ExternalLink size={12} className="text-slate-600 group-hover:text-blue-400" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-300 group-hover:text-white line-clamp-1">{source.title}</span>
                  </motion.a>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceView;
