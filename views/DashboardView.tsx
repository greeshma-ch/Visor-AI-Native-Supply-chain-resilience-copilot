
import React from 'react';
import { MOCK_SUPPLIERS } from '../constants';
import { RiskStatus, Supplier, Disruption, User } from '../types';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  TrendingUp,
  Clock,
  ArrowUpRight,
  Target,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import Skeleton from '../components/Skeleton';

interface DashboardViewProps {
  user: User;
  categoryFilter: string;
  statusFilter: RiskStatus | 'ALL';
  onStatusFilterChange: (status: RiskStatus | 'ALL') => void;
  onNavigateToRegistry: () => void;
  onNavigateToFeed: () => void;
  onNavigateToResource: (title: string) => void;
  disruptions: Disruption[];
  suppliers: Supplier[];
  isRefreshing?: boolean;
  onResync?: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ 
  user,
  categoryFilter, 
  statusFilter, 
  onStatusFilterChange,
  onNavigateToRegistry,
  onNavigateToFeed,
  onNavigateToResource,
  disruptions,
  suppliers,
  isRefreshing,
  onResync
}) => {
  const channelSuppliers = React.useMemo(() => suppliers.filter(s => {
    return categoryFilter === 'ALL' || s.category === categoryFilter;
  }), [suppliers, categoryFilter]);

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

  const { stableCount, cautionCount, riskyCount, totalCount, copilotScore, delta } = React.useMemo(() => {
    let stable = 0;
    let caution = 0;
    let risky = 0;
    
    channelSuppliers.forEach(s => {
      if (s.status === RiskStatus.STABLE) stable++;
      else if (s.status === RiskStatus.CAUTION) caution++;
      else if (s.status === RiskStatus.RISKY) risky++;
    });

    const total = channelSuppliers.length;
    const score = total > 0 
      ? Math.round(((stable * 100) + (caution * 60) + (risky * 20)) / total)
      : 100;

    const d = total > 0 ? (stable / total * 5).toFixed(1) : "0.0";

    return {
      stableCount: stable,
      cautionCount: caution,
      riskyCount: risky,
      totalCount: total,
      copilotScore: score,
      delta: d
    };
  }, [channelSuppliers]);

  const chartData = React.useMemo(() => [
    { name: 'Stable', value: stableCount, color: '#059669', percentage: Math.round((stableCount/totalCount)*100) || 0, id: RiskStatus.STABLE },
    { name: 'Caution', value: cautionCount, color: '#D97706', percentage: Math.round((cautionCount/totalCount)*100) || 0, id: RiskStatus.CAUTION },
    { name: 'Risky', value: riskyCount, color: '#DC2626', percentage: Math.round((riskyCount/totalCount)*100) || 0, id: RiskStatus.RISKY },
  ].filter(d => d.value > 0).map(item => ({
    ...item,
    color: statusFilter === 'ALL' || statusFilter === item.id ? item.color : `${item.color}44`
  })), [stableCount, cautionCount, riskyCount, totalCount, statusFilter]);

  const stats = React.useMemo(() => [
    { id: 'ALL', label: 'Network Total', value: totalCount, icon: Target, color: 'text-slate-600', bg: 'bg-slate-100', status: 'ALL' },
    { id: RiskStatus.RISKY, label: 'High Risk Nodes', value: riskyCount, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', status: RiskStatus.RISKY },
    { id: RiskStatus.CAUTION, label: 'Active Caution', value: cautionCount, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50', status: RiskStatus.CAUTION },
    { id: RiskStatus.STABLE, label: 'Operational Sync', value: stableCount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', status: RiskStatus.STABLE },
  ], [totalCount, riskyCount, cautionCount, stableCount]);

  const activeRegions = React.useMemo(() => Array.from(new Set(channelSuppliers.map(s => s.location))), [channelSuppliers]);

  const filteredDisruptions = React.useMemo(() => disruptions.filter(d => {
    const matchesCategory = categoryFilter === 'ALL' || d.type === categoryFilter || d.type === 'Logistics' || d.type === 'Weather';
    
    // Use part-based matching consistent with resolveSupplierStatus
    const matchesRegion = activeRegions.some(region => {
      const regionParts = region.toLowerCase().split(',').map(p => p.trim());
      const disruptionParts = d.location.toLowerCase().split(',').map(p => p.trim());
      return regionParts.some(rp => disruptionParts.some(dp => dp.includes(rp) || rp.includes(dp)));
    });
    
    return matchesCategory && matchesRegion;
  }), [disruptions, categoryFilter, activeRegions]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0a0f1c]/90 backdrop-blur-xl p-4 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl animate-in fade-in zoom-in-95 duration-200 pointer-events-none z-50 min-w-[160px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: payload[0].payload.color.length > 7 ? payload[0].payload.color.slice(0, 7) : payload[0].payload.color }} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{payload[0].name}</p>
          </div>
          <p className="text-sm font-black text-white tracking-tight">
            {payload[0].value} <span className="text-slate-500 font-bold">Nodes</span>
          </p>
          <div className="mt-2 pt-2 border-t border-white/5">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{payload[0].payload.percentage}% of Network</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">Resilience Copilot</h2>
          <div className="flex items-center gap-3 mt-2">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${isRefreshing ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
              <Activity size={10} className={isRefreshing ? 'animate-pulse' : ''} />
              {isRefreshing ? 'Telemetry Syncing' : 'Global Sync: Active'}
            </div>
            <p className="text-slate-500 font-medium flex items-center gap-2 text-xs uppercase tracking-widest">
              <Clock size={14} className="text-slate-600" /> Real-time • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • <span className="text-slate-400 font-black">{categoryFilter}</span> Channel
            </p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 sm:flex-none px-6 py-3 bg-white/5 border border-white/10 text-slate-300 font-black rounded-xl hover:bg-white/10 transition-all text-[10px] uppercase tracking-widest"
          >
            Export
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onResync}
            disabled={isRefreshing}
            className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? 'Syncing...' : 'Resync'} <TrendingUp size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat) => (
          <motion.button 
            whileHover={{ y: -5, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            key={stat.id} 
            onClick={() => onStatusFilterChange(stat.status as any)}
            className={`text-left bg-[#0a0f1c] p-6 sm:p-8 rounded-[2rem] border transition-all group relative overflow-hidden h-full ${
              statusFilter === stat.status 
                ? 'border-blue-500 shadow-xl shadow-blue-500/10' 
                : 'border-white/5 shadow-sm hover:border-white/10'
            }`}
          >
            <div className={`inline-flex p-4 sm:p-5 rounded-2xl bg-white/5 ${stat.color} mb-6 transition-transform group-hover:scale-110 shadow-inner items-center justify-center`}>
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-3xl sm:text-4xl font-black text-white mt-2 tracking-tighter">{stat.value}</h3>
            {statusFilter === stat.status && (
              <div className="absolute top-4 right-6 text-[8px] font-black text-blue-400 uppercase tracking-widest">Active Filter</div>
            )}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-10">
        <div className="xl:col-span-2 bg-[#080c18] p-6 sm:p-10 rounded-[2.5rem] border border-white/5 shadow-sm flex flex-col items-center justify-center relative overflow-hidden min-h-[500px] sm:min-h-[600px]">
          <div className="absolute top-6 sm:top-10 left-6 sm:left-10 z-10">
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Resilience Matrix</h3>
            <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1 uppercase tracking-widest">Predictive Node distribution</p>
          </div>

          <div className="absolute top-6 sm:top-10 right-6 sm:right-10 z-10 flex flex-col items-end">
            <div className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Copilot Score</div>
            {isRefreshing ? (
              <div className="flex flex-col items-end gap-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-1 w-24 rounded-full" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{copilotScore}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">/100</span>
                </div>
                <div className="h-1 w-24 bg-white/5 rounded-full mt-2 overflow-hidden shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${copilotScore}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500" 
                  />
                </div>
                <span className={`text-[7px] font-black ${parseFloat(delta) >= 2.5 ? 'text-emerald-500' : 'text-amber-500'} uppercase tracking-[0.3em] mt-1.5`}>
                  {parseFloat(delta) >= 0 ? '+' : ''}{delta} pts vs previous sync
                </span>
              </>
            )}
          </div>
          
          <div className="w-full h-[250px] sm:h-[350px] md:h-[400px] mt-12 sm:mt-16 relative">
            {isRefreshing ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-48 h-48 sm:w-64 sm:h-64">
                   <motion.div 
                     animate={{ rotate: 360 }}
                     transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                     className="absolute inset-0 rounded-full border-4 border-white/5 border-t-blue-500/40"
                   />
                   <motion.div 
                     animate={{ rotate: -360 }}
                     transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                     className="absolute inset-4 rounded-full border-4 border-white/5 border-t-indigo-500/20"
                   />
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                     <Activity size={24} className="text-blue-500 mb-2 animate-pulse" />
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Calculating<br/>Resilience</p>
                   </div>
                </div>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="65%"
                      outerRadius="90%"
                      paddingAngle={6}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={400}
                      animationEasing="ease-out"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} className="outline-none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={<CustomTooltip />} 
                      offset={20}
                      wrapperStyle={{ outline: 'none', zIndex: 100 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-4xl sm:text-6xl font-black text-white tracking-tighter">
                    {statusFilter === 'ALL' ? totalCount : channelSuppliers.filter(s => s.status === statusFilter).length}
                  </p>
                  <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-[0.2em] mt-1">
                    {statusFilter === 'ALL' ? 'Active Nodes' : `${statusFilter} Nodes`}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-6 sm:gap-10 mt-8 justify-center">
            {isRefreshing ? (
              [1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-2.5 h-2.5 rounded-full" />
                  <div>
                    <Skeleton className="h-2 w-12 mb-1" />
                    <Skeleton className="h-2 w-8" />
                  </div>
                </div>
              ))
            ) : (
              chartData.map((item, i) => (
                <button 
                  key={i} 
                  onClick={() => onStatusFilterChange(item.id as RiskStatus)}
                  className={`flex items-center gap-3 transition-all ${statusFilter !== 'ALL' && statusFilter !== item.id ? 'opacity-30 scale-95' : 'scale-100'}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color.length > 7 ? item.color.slice(0, 7) : item.color}} />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">{item.name}</p>
                    <p className="text-[10px] font-bold text-slate-500">{item.percentage}%</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#080c18] p-6 sm:p-10 rounded-[2.5rem] border border-white/5 shadow-sm overflow-hidden flex flex-col min-h-[500px] sm:min-h-[600px]">
          <div className="flex justify-between items-center mb-8 sm:mb-10">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Risk Signals</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live: Node-Synced</span>
              </div>
            </div>
            <button 
              onClick={onNavigateToFeed}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all group"
            >
              <ArrowUpRight size={18} className="text-white group-hover:text-blue-400 transition-colors" />
            </button>
          </div>
          <div className="space-y-4 sm:space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {isRefreshing ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-full p-6 rounded-[2rem] bg-white/[0.02] border border-white/5">
                    <div className="flex justify-between mb-3">
                      <div className="h-2 w-16 bg-white/10 rounded" />
                      <div className="h-2 w-12 bg-white/10 rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-full bg-white/10 rounded" />
                  </div>
                ))}
                <div className="text-center py-4">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest animate-bounce">Syncing Real-time Feed...</p>
                </div>
              </div>
            ) : filteredDisruptions.map((d) => {
              const displayTitle = d.title === "Operational Stability" 
                ? `Operational Stability: ${d.location}` 
                : d.title;

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  key={d.id}
                >
                  <motion.button 
                    whileHover={{ x: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onNavigateToResource(displayTitle)}
                    className="w-full text-left p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                        d.severity === 'High' ? 'bg-rose-500/20 text-rose-400' : 
                        d.severity === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                      }`}>
                        {d.severity} Priority
                      </span>
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={10} /> {getRelativeTime(d.timestamp)}
                      </span>
                    </div>
                    <h4 className="font-black text-white text-sm sm:text-base leading-tight mb-2 truncate group-hover:text-blue-400 transition-colors">{displayTitle}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-medium">{d.summary}</p>
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
