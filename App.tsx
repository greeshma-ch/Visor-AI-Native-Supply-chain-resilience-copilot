import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Supplier, User, RiskStatus, Disruption, Role, RiskScore } from './types';
import { MOCK_DISRUPTIONS, MOCK_SUPPLIERS, getCityCoords } from './constants';
import { fetchWeatherAlerts } from './services/weatherService';
import { generateGlobalRiskSignals, generateSupplierIntelligence } from './services/apiClient';
import { resolveSupplierStatus } from './lib/riskEngine';
import {
  supabase,
  signOut,
  getSupabaseSession,
  fetchUserProfile,
  upsertUserProfile,
  fetchUserSuppliers,
  seedUserSuppliersIfEmpty,
  insertUserSupplier,
  fetchUserStatusOverrides,
  upsertUserStatusOverride,
  isSupabaseConfigured
} from './lib/supabaseClient';
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
import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  const [view, setView] = useState<View>('DASHBOARD');
  const [direction, setDirection] = useState(0);

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

    const threshold = 80;

    if ((offset < -threshold || (velocity < -500 && offset < -20)) && currentIndex < viewOrder.length - 1) {
      handleViewChange(viewOrder[currentIndex + 1]);
    } else if ((offset > threshold || (velocity > 500 && offset > 20)) && currentIndex > 0) {
      handleViewChange(viewOrder[currentIndex - 1]);
    }
  };

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('vs_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.sectors) parsed.sectors = ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive'];
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<RiskStatus | 'ALL'>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierRiskScores, setSupplierRiskScores] = useState<Record<string, RiskScore>>({});

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

  const [simulatedRiskyNodes, setSimulatedRiskyNodes] = useState<string[]>([]);
  const [manualStatusOverrides, setManualStatusOverrides] = useState<Record<string, RiskStatus>>(() => {
    const saved = localStorage.getItem('vs_manual_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  // Keep localStorage updated as local read cache
  useEffect(() => {
    if (user) localStorage.setItem('vs_session', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('vs_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('vs_manual_overrides', JSON.stringify(manualStatusOverrides));
  }, [manualStatusOverrides]);

  // ─── SUPABASE INITIAL SESSION & DATA SYNC ────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Check existing session
    getSupabaseSession().then(async (session) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        const loggedUser: User = profile || {
          id: session.user.id,
          email: session.user.email,
          company: session.user.user_metadata?.company || 'Enterprise Logistics',
          role: (session.user.user_metadata?.role as Role) || 'Analyst',
          hqLocation: session.user.user_metadata?.hqLocation || 'San Francisco',
          hqCoordinates: session.user.user_metadata?.hqCoordinates || getCityCoords('San Francisco'),
          sectors: session.user.user_metadata?.sectors || ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive']
        };
        setUser(loggedUser);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        const loggedUser: User = profile || {
          id: session.user.id,
          email: session.user.email,
          company: session.user.user_metadata?.company || 'Enterprise Logistics',
          role: (session.user.user_metadata?.role as Role) || 'Analyst',
          hqLocation: session.user.user_metadata?.hqLocation || 'San Francisco',
          hqCoordinates: session.user.user_metadata?.hqCoordinates || getCityCoords('San Francisco'),
          sectors: session.user.user_metadata?.sectors || ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive']
        };
        setUser(loggedUser);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('vs_session');
        localStorage.removeItem('vs_suppliers');
        localStorage.removeItem('vs_manual_overrides');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── LOAD USER-SPECIFIC DATA FROM SUPABASE ───────────────────────
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;

    let isMounted = true;

    const loadUserData = async () => {
      try {
        // Fetch or seed suppliers in Postgres
        const dbSuppliers = await seedUserSuppliersIfEmpty(user.id!, MOCK_SUPPLIERS);
        if (isMounted && dbSuppliers && dbSuppliers.length > 0) {
          setSuppliers(dbSuppliers);
        }

        // Fetch manual status overrides in Postgres
        const dbOverrides = await fetchUserStatusOverrides(user.id!);
        if (isMounted && dbOverrides) {
          setManualStatusOverrides(dbOverrides);
        }
      } catch (err) {
        console.error("Error loading user data from Supabase:", err);
      }
    };

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const [disruptions, setDisruptions] = useState<Disruption[]>(MOCK_DISRUPTIONS);
  const [isDisruptionDataLive, setIsDisruptionDataLive] = useState(false);
  const [resourceContext, setResourceContext] = useState<{ title: string; sources: { title: string; uri: string }[] } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ref guard to prevent concurrent refreshes
  const refreshLock = useRef(false);
  const hasInitialRefreshed = useRef(false);

  const activeSuppliers = React.useMemo(() => {
    return suppliers.map(s => {
      if (manualStatusOverrides[s.id]) {
        return { ...s, status: manualStatusOverrides[s.id] };
      }
      if (s.status === RiskStatus.PENDING) {
        return s;
      }
      if (simulatedRiskyNodes.includes(s.id)) {
        return { ...s, status: RiskStatus.RISKY };
      }
      if (supplierRiskScores[s.id]?.level) {
        return { ...s, status: supplierRiskScores[s.id].level };
      }
      const { status } = resolveSupplierStatus(s, disruptions, simulatedRiskyNodes);
      return { ...s, status };
    });
  }, [suppliers, simulatedRiskyNodes, disruptions, manualStatusOverrides, supplierRiskScores]);

  const withTimeout = <T extends unknown>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

  const refreshDisruptions = useCallback(async () => {
    // Prevent concurrent refreshes with lock
    if (refreshLock.current || !user) return;
    refreshLock.current = true;
    setIsRefreshing(true);

    try {
      const [globalResult, weatherAlerts] = await Promise.all([
        withTimeout(generateGlobalRiskSignals(user, suppliers), 20000).catch(() => ({ disruptions: [], supplierRiskScores: {} })),
        fetchWeatherAlerts(suppliers)
      ]);

      const dynamicDisruptions = globalResult.disruptions || [];
      if (globalResult.supplierRiskScores && Object.keys(globalResult.supplierRiskScores).length > 0) {
        setSupplierRiskScores(prev => ({ ...prev, ...globalResult.supplierRiskScores }));
      }

      // Combine and deduplicate by title + location
      const combined = [...dynamicDisruptions, ...weatherAlerts].filter((v, i, a) =>
        a.findIndex(t => t.title === v.title && t.location === v.location) === i
      );

      // Sort: High > Medium > Low, then by recency
      const severityMap: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const sorted = combined.sort((a, b) => {
        const severityA = severityMap[a.severity] || 0;
        const severityB = severityMap[b.severity] || 0;
        if (severityA !== severityB) return severityB - severityA;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setDisruptions(sorted.length > 0 ? sorted : MOCK_DISRUPTIONS);
      setIsDisruptionDataLive(sorted.length > 0);

      if (combined.length > 0) {
        toast.success("Intelligence Refreshed", {
          description: `Synchronized with ${combined.length} real-time risk signals.`,
          id: 'refresh-toast'
        });
      }
    } catch (error) {
      console.error("Refresh Error:", error);
    } finally {
      setIsRefreshing(false);
      refreshLock.current = false;
    }
  }, [user, suppliers]);

  // Single useEffect for initial refresh — NO double-fire
  useEffect(() => {
    if (user && !hasInitialRefreshed.current) {
      hasInitialRefreshed.current = true;
      refreshDisruptions();
    }

    // Refresh every 2 minutes
    const interval = setInterval(() => {
      if (user) refreshDisruptions();
    }, 120000);
    return () => clearInterval(interval);
  }, [user, refreshDisruptions]);

  const handleAuthComplete = (userData: User) => {
    setUser(userData);
    localStorage.setItem('vs_session', JSON.stringify(userData));
  };

  const updateSectors = async (newSectors: string[]) => {
    if (user) {
      const updatedUser = { ...user, sectors: newSectors };
      setUser(updatedUser);
      localStorage.setItem('vs_session', JSON.stringify(updatedUser));
      if (user.id && isSupabaseConfigured) {
        await upsertUserProfile(updatedUser);
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
    localStorage.removeItem('vs_session');
    localStorage.removeItem('vs_suppliers');
    localStorage.removeItem('vs_manual_overrides');
    hasInitialRefreshed.current = false;
    setUser(null);
    setSuppliers(MOCK_SUPPLIERS);
    setManualStatusOverrides({});
  };

  const updateSupplierStatus = async (supplierId: string, newStatus: RiskStatus) => {
    setManualStatusOverrides(prev => ({ ...prev, [supplierId]: newStatus }));
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, status: newStatus, lastUpdated: new Date().toISOString() } : s));
    if (selectedSupplier?.id === supplierId) {
      setSelectedSupplier(prev => prev ? { ...prev, status: newStatus, lastUpdated: new Date().toISOString() } : null);
    }

    if (user?.id && isSupabaseConfigured) {
      await upsertUserStatusOverride(user.id, supplierId, newStatus);
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

  const handleAddSupplier = async (newSupplier: Supplier) => {
    setSuppliers(prev => [newSupplier, ...prev]);
    toast.success("Supplier Integrated", {
      description: `${newSupplier.name} has been added to the global registry and map analytics.`
    });

    if (user?.id && isSupabaseConfigured) {
      await insertUserSupplier(user.id, newSupplier);
    }

    // Immediately trigger background intelligence analysis for the new supplier
    generateSupplierIntelligence(newSupplier, undefined, false, disruptions, [newSupplier, ...suppliers])
      .then(intelData => {
        if (intelData) {
          if (intelData.riskScore) {
            setSupplierRiskScores(prev => ({ ...prev, [newSupplier.id]: intelData.riskScore! }));
          }
          const finalStatus =
            intelData.suggestedStatus ||
            intelData.riskScore?.level;

          if (finalStatus) {
            updateSupplierStatus(newSupplier.id, finalStatus);
          }
        }
      })
      .catch(err => {
        console.error("[App] Background analysis for new supplier failed:", err);
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
            isDisruptionDataLive={isDisruptionDataLive}
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
            isDisruptionDataLive={isDisruptionDataLive}
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
          {/* Main Application Content */}
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
                    onNavigateToResources={(context) => {
                      if (context) setResourceContext(context);
                      setSelectedSupplier(null);
                      setView('RESOURCES');
                    }}
                    isSimulated={simulatedRiskyNodes.includes(selectedSupplier.id)}
                    onToggleSimulation={() => toggleNodeSimulation(selectedSupplier.id)}
                    disruptions={disruptions}
                    suppliers={activeSuppliers}
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
