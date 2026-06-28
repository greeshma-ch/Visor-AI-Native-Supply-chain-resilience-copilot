
import React, { useState, useEffect } from 'react';
import { View, Supplier, User, RiskStatus, Disruption } from './types';
import { MOCK_DISRUPTIONS, MOCK_SUPPLIERS } from './constants';
import { fetchWeatherAlerts } from './services/weatherService';
import { generateGlobalRiskSignals } from './services/apiClient';
import { resolveSupplierStatus } from './lib/riskEngine';
import Layout from './components/Layout';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import RegistryView from './views/RegistryView';
import IntelligenceView from './views/IntelligenceView';
import MapView from './views/MapView';
import FeedView from './views/FeedView';
import SettingsView from './views/SettingsView';
import ResourcesView from './views/ResourcesView';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';

const App: React.FC = () => {
  const [view, setView] = useState<View>('DASHBOARD');
  const [direction, setDirection] = useState(0); // 1 for right, -1 for left

  const viewOrder: View[] = ['DASHBOARD', 'REGISTRY', 'MAP', 'FEED', 'RESOURCES', 'SETTINGS'];

  const handleViewChange = (newView: View) => {
    const oldIndex = viewOrder.indexOf(view);
    const newIndex = viewOrder.indexOf(newView);
    if (oldIndex !== -1 && newIndex !== -1) {
      setDirection(newIndex > oldIndex ? 1 : -1);
    }
    setView(newView);
  };

  const handleSwipe = (offset: number, velocity: number) => {
    const currentIndex = viewOrder.indexOf(view);
    if (currentIndex === -1) return;

    // Faster threshold: 30% of typical screen width (~100-150px) or high velocity
    const threshold = 80;
    const isFastSwipe = Math.abs(velocity) > 500;

    if ((offset < -threshold || (velocity < -500 && offset < -20)) && currentIndex < viewOrder.length - 1) {
      handleViewChange(viewOrder[currentIndex + 1]);
    } else if ((offset > threshold || (velocity > 500 && offset > 20)) && currentIndex > 0) {
      handleViewChange(viewOrder[currentIndex - 1]);
    }
  };

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('vs_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.sectors) parsed.sectors = ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive'];
      // Ensure all features are available
      return parsed;
    }
    return null;
  });
  
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<RiskStatus | 'ALL'>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('vs_suppliers');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return MOCK_SUPPLIERS;
      }
    }
    return MOCK_SUPPLIERS;
  });

  useEffect(() => {
    localStorage.setItem('vs_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);
  const [simulatedRiskyNodes, setSimulatedRiskyNodes] = useState<string[]>([]);
  const [manualStatusOverrides, setManualStatusOverrides] = useState<Record<string, RiskStatus>>(() => {
    const saved = localStorage.getItem('vs_manual_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('vs_manual_overrides', JSON.stringify(manualStatusOverrides));
  }, [manualStatusOverrides]);

  const [disruptions, setDisruptions] = useState<Disruption[]>(MOCK_DISRUPTIONS);
  const [resourceContext, setResourceContext] = useState<{ title: string; sources: { title: string; uri: string }[] } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeSuppliers = React.useMemo(() => {
    return suppliers.map(s => {
      // Manual overrides from AI/User sync take highest precedence
      if (manualStatusOverrides[s.id]) {
        return { ...s, status: manualStatusOverrides[s.id] };
      }
      const { status } = resolveSupplierStatus(s, disruptions, simulatedRiskyNodes);
      return { ...s, status };
    });
  }, [suppliers, simulatedRiskyNodes, disruptions, manualStatusOverrides]);

  const isInitialMount = React.useRef(true);

  const withTimeout = <T extends unknown>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

  const refreshDisruptions = async () => {
    if (isRefreshing || !user) return;
    setIsRefreshing(true);
    try {
      const [dynamicDisruptions, weatherAlerts] = await Promise.all([
        withTimeout(generateGlobalRiskSignals(user, suppliers), 25000).catch(() => []),
        fetchWeatherAlerts(suppliers)
      ]);
      
      // Combine, filter invalid entries, and remove duplicates by title and location
      const combined = [...dynamicDisruptions, ...weatherAlerts]
        .filter(v => v && v.title && v.location)
        .filter((v, i, a) => 
          a.findIndex(t => t.title === v.title && t.location === v.location) === i
        );

      // Prioritization Logic: High > Medium > Low, then by recent timestamp
      const severityMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const sorted = combined.sort((a, b) => {
        const severityA = severityMap[a.severity as keyof typeof severityMap] || 0;
        const severityB = severityMap[b.severity as keyof typeof severityMap] || 0;
        
        if (severityA !== severityB) {
          return severityB - severityA;
        }
        
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setDisruptions(sorted);
      
      if (dynamicDisruptions.length > 0 || weatherAlerts.length > 0) {
        // Only show toast if it's not the initial automatic refresh or if it's a manual resync
        toast.success("Intelligence Refreshed", {
          description: `Synchronized with ${combined.length} real-time risk signals.`,
          id: 'refresh-toast' // Use a fixed ID to prevent duplicates
        });
      }
    } catch (error) {
      console.error("Refresh Error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user && isInitialMount.current) {
      refreshDisruptions();
      isInitialMount.current = false;
    }
    
    // Immediate resync on view change or user initialization if not already done
    if (user && !isRefreshing && disruptions.length === MOCK_DISRUPTIONS.length) {
       refreshDisruptions();
    }

    // Synchronize every 2 minutes
    const interval = setInterval(refreshDisruptions, 120000);
    return () => clearInterval(interval);
  }, [suppliers.length, user]);

  const handleAuthComplete = (userData: User) => {
    setUser(userData);
    localStorage.setItem('vs_session', JSON.stringify(userData));
  };

  const updateSectors = (newSectors: string[]) => {
    if (user) {
      const updatedUser = { ...user, sectors: newSectors };
      setUser(updatedUser);
      localStorage.setItem('vs_session', JSON.stringify(updatedUser));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vs_session');
    setUser(null);
  };

  const updateSupplierStatus = (supplierId: string, newStatus: RiskStatus) => {
    setManualStatusOverrides(prev => ({ ...prev, [supplierId]: newStatus }));
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, status: newStatus, lastUpdated: new Date().toISOString() } : s));
    if (selectedSupplier?.id === supplierId) {
      setSelectedSupplier(prev => prev ? { ...prev, status: newStatus, lastUpdated: new Date().toISOString() } : null);
    }
  };

  const navigateToSupplierIntelligence = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
  };

  const toggleNodeSimulation = (supplierId: string) => {
    setSimulatedRiskyNodes(prev => {
      const isSimulated = prev.includes(supplierId);
      const next = isSimulated 
        ? prev.filter(id => id !== supplierId) 
        : [...prev, supplierId];
      
      toast.info(isSimulated ? "Node Restored" : "Node Compromised", {
        id: `sim-${supplierId}`,
        description: isSimulated 
          ? "Supplier has been removed from the crisis simulation."
          : "Supplier has been flagged as RISKY for simulation purposes."
      });
      
      return next;
    });
  };

  const handleAddSupplier = (newSupplier: Supplier) => {
    setSuppliers(prev => [newSupplier, ...prev]);
    toast.success("Supplier Integrated", {
      description: `${newSupplier.name} has been added to the global registry and map analytics.`
    });
  };

  if (!user) {
    return <AuthView onComplete={handleAuthComplete} />;
  }

  const renderView = () => {
    switch (view) {
      case 'DASHBOARD':
        return (
          <DashboardView 
            user={user}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onNavigateToRegistry={() => setView('REGISTRY')}
            onNavigateToFeed={() => setView('FEED')}
            onNavigateToResource={(title) => {
              setResourceContext({ title, sources: [] });
              setView('RESOURCES');
            }}
            disruptions={disruptions}
            suppliers={activeSuppliers}
            isRefreshing={isRefreshing}
            onResync={refreshDisruptions}
          />
        );
      case 'REGISTRY':
        return (
          <RegistryView 
            user={user}
            updateSectors={updateSectors}
            suppliers={activeSuppliers}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onSelectSupplier={navigateToSupplierIntelligence} 
            onAddSupplier={handleAddSupplier}
          />
        );
      case 'MAP':
        return (
          <MapView 
            suppliers={activeSuppliers}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            onSelectSupplier={navigateToSupplierIntelligence}
            hqLocation={user.hqCoordinates || [37.7749, -122.4194]}
            disruptions={disruptions}
          />
        );
      case 'FEED':
        return (
          <FeedView 
            user={user} 
            categoryFilter={categoryFilter} 
            onNavigateToResources={(title) => {
              setResourceContext({ title, sources: [] });
              setView('RESOURCES');
            }} 
            disruptions={disruptions} 
            suppliers={activeSuppliers} 
            simulatedRiskyNodes={simulatedRiskyNodes}
            isRefreshing={isRefreshing}
          />
        );
      case 'SETTINGS':
        return <SettingsView user={user} onLogout={handleLogout} />;
      case 'RESOURCES':
        return (
          <ResourcesView 
            user={user}
            onBack={() => {
              setResourceContext(null);
              setView('DASHBOARD');
            }} 
            context={resourceContext}
            disruptions={disruptions}
            suppliers={activeSuppliers}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
    <Layout 
      activeView={view} 
      onViewChange={handleViewChange} 
      onLogout={handleLogout}
      user={user}
      categoryFilter={categoryFilter}
      onCategoryFilterChange={setCategoryFilter}
    >
      <div className="relative h-full overflow-hidden flex flex-col">
        {/* Main Application Content - Responsive Padding */}
        <motion.div 
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => handleSwipe(info.offset.x, info.velocity.x)}
          className={`flex-1 ${view === 'MAP' ? 'overflow-hidden' : 'overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 sm:py-8 lg:py-10'} custom-scrollbar ${selectedSupplier ? 'opacity-20 blur-md scale-[0.98] pointer-events-none' : 'opacity-100 scale-100'}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={view}
              initial={{ x: direction > 0 ? 50 : -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -50 : 50, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Intelligence View Overlay */}
        <AnimatePresence>
          {selectedSupplier && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 300, restDelta: 0.5 }}
              className="fixed inset-0 z-50 bg-[#070b14]/90 backdrop-blur-xl overflow-y-auto shadow-2xl"
            >
              <div className="max-w-[1600px] mx-auto p-4 sm:p-6 md:p-10 min-h-full">
                <IntelligenceView 
                  user={user}
                  supplier={activeSuppliers.find(s => s.id === selectedSupplier.id) || selectedSupplier} 
                  onBack={() => setSelectedSupplier(null)}
                  onUpdateStatus={(status) => updateSupplierStatus(selectedSupplier.id, status)}
                  onNavigateToResources={(context) => {
                      if (context) setResourceContext(context);
                      setSelectedSupplier(null);
                      setView('RESOURCES');
                  }}
                  isSimulated={simulatedRiskyNodes.includes(selectedSupplier.id)}
                  onToggleSimulation={() => toggleNodeSimulation(selectedSupplier.id)}
                  disruptions={disruptions}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
    <Toaster position="top-right" theme="dark" richColors />
  </>
  );
};

export default App;
