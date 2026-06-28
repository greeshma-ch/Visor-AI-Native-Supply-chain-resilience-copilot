
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, OverlayViewF } from '@react-google-maps/api';
import { MOCK_SUPPLIERS } from '../constants';
import { Disruption, RiskStatus, Supplier } from '../types';
import { Activity, Zap, ShieldAlert, Target, Globe, ChevronDown, ChevronUp, Map as MapIcon, Layers, CloudRain, CloudLightning, Wind, Sun, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface MapViewProps {
  suppliers: Supplier[];
  categoryFilter: string;
  statusFilter: RiskStatus | 'ALL';
  onSelectSupplier: (s: Supplier) => void;
  hqLocation?: [number, number];
  disruptions?: Disruption[];
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#070b14" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#070b14" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#2563eb" }, { opacity: 0.5 }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#111827" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0a1224" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#2563eb" }, { opacity: 0.3 }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#070b14" }],
  },
];

const MapView: React.FC<MapViewProps> = ({ suppliers, categoryFilter, statusFilter, onSelectSupplier, hqLocation, disruptions = [] }) => {
  const [hovered, setHovered] = useState<Supplier | null>(null);
  const [hoveredAlert, setHoveredAlert] = useState<Disruption | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'SATELLITE' | 'WEATHER'>('SATELLITE');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  // Use a fallback for hqLocation if not provided
  const centerCoords = hqLocation || [37.7749, -122.4194];
  
  const [mapCenter, setMapCenter] = useState({ lat: centerCoords[0], lng: centerCoords[1] });
  const [mapZoom, setMapZoom] = useState(3);

  // Sync map center when hqLocation changes
  useEffect(() => {
    if (hqLocation) {
      setMapCenter({ lat: hqLocation[0], lng: hqLocation[1] });
    }
  }, [hqLocation?.[0], hqLocation?.[1]]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (process.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").replace(/"/g, "")
  });

  const onUnmount = React.useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const filteredSuppliers = React.useMemo(() => suppliers.filter(s => {
    const matchesCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesCategory && matchesStatus;
  }), [suppliers, categoryFilter, statusFilter]);

  const weatherAlerts = React.useMemo(() => disruptions.filter(d => d.type === 'Weather'), [disruptions]);

  const chartData = React.useMemo(() => {
    if (suppliers.length === 0) return [];
    
    let stable = 0;
    let caution = 0;
    let risky = 0;
    
    suppliers.forEach(s => {
      if (s.status === RiskStatus.STABLE) stable++;
      else if (s.status === RiskStatus.CAUTION) caution++;
      else if (s.status === RiskStatus.RISKY) risky++;
    });

    const total = suppliers.length;
    return [
      { name: 'Stable', value: Math.round((stable / total) * 100), color: '#10b981' },
      { name: 'Caution', value: Math.round((caution / total) * 100), color: '#f59e0b' },
      { name: 'Risky', value: Math.round((risky / total) * 100), color: '#f43f5e' },
    ];
  }, [suppliers]);

  const getWeatherIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('thunderstorm')) return <CloudLightning className="w-3 h-3 text-amber-400" />;
    if (t.includes('rain')) return <CloudRain className="w-3 h-3 text-blue-400" />;
    if (t.includes('wind')) return <Wind className="w-3 h-3 text-slate-300" />;
    return <Sun className="w-3 h-3 text-amber-200" />;
  };

  const center = React.useMemo(() => ({
    lat: centerCoords[0],
    lng: centerCoords[1]
  }), [centerCoords[0], centerCoords[1]]);

  const mapOptions = React.useMemo(() => ({
    styles: darkMapStyle,
    disableDefaultUI: true,
    zoomControl: false,
    backgroundColor: '#070b14',
    gestureHandling: 'greedy' as const,
    maxZoom: 18,
    minZoom: 2
  }), []);

  const handleMarkerClick = (s: Supplier) => {
    onSelectSupplier(s);
    if (map) {
      const newPos = { lat: s.coordinates[0], lng: s.coordinates[1] };
      map.panTo(newPos);
      map.setZoom(8);
      // We also update state to prevent snapping back on next render
      setMapCenter(newPos);
      setMapZoom(8);
    }
  };

  const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const handleMapIdle = () => {
    if (map) {
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (center) {
        setMapCenter({ lat: center.lat(), lng: center.lng() });
      }
      if (zoom !== undefined) {
        setMapZoom(zoom);
      }
    }
  };

  return (
    <div className="flex flex-col xl:flex-row h-full animate-in fade-in duration-700 bg-[#070b14] overflow-hidden">
      {/* Google Maps View */}
      <div className="h-[40%] sm:h-[50%] xl:h-full xl:flex-1 relative overflow-hidden bg-[#070b14] min-h-[200px] sm:min-h-[300px] xl:min-h-0 shrink-0">
        {!isLoaded ? (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Initializing Global Grid...</p>
             </div>
          </div>
        ) : (
          <>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={mapZoom}
              onLoad={handleMapLoad}
              onUnmount={onUnmount}
              onIdle={handleMapIdle}
              options={mapOptions}
            >
              {/* HQ Marker */}
              <MarkerF
                position={center}
                icon={{
                  path: "M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z",
                  scale: 1.5,
                  fillColor: "#2563eb",
                  fillOpacity: 1,
                  strokeColor: "white",
                  strokeWeight: 2,
                  anchor: new google.maps.Point(12, 12),
                  rotation: 0
                }}
                label={{
                  text: "HQ",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "900",
                  className: "mt-8"
                }}
              />

              {/* Connection Polylines */}
              {filteredSuppliers.map(s => {
                const isRisky = s.status === RiskStatus.RISKY;
                return (
                  <PolylineF
                    key={`line-${s.id}`}
                    path={[
                      center,
                      { lat: s.coordinates[0], lng: s.coordinates[1] }
                    ]}
                    options={{
                      strokeColor: isRisky ? '#f43f5e' : '#2563eb',
                      strokeOpacity: isRisky ? 0.6 : 0.2,
                      strokeWeight: isRisky ? 2 : 1,
                      geodesic: true,
                      icons: isRisky ? [{
                        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                        offset: '0',
                        repeat: '10px'
                      }] : []
                    }}
                  />
                );
              })}

              {/* Supplier Markers */}
              {filteredSuppliers.map(s => {
                const color = s.status === RiskStatus.RISKY ? '#f43f5e' : s.status === RiskStatus.CAUTION ? '#f59e0b' : '#10b981';
                const isRisky = s.status === RiskStatus.RISKY;
                return (
                  <MarkerF
                    key={s.id}
                    position={{ lat: s.coordinates[0], lng: s.coordinates[1] }}
                    onMouseOver={() => setHovered(s)}
                    onMouseOut={() => setHovered(null)}
                    onClick={() => handleMarkerClick(s)}
                    icon={{
                      path: isRisky 
                        ? "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" // Warning circle
                        : google.maps.SymbolPath.CIRCLE,
                      scale: isRisky ? 1.2 : 6,
                      fillColor: color,
                      fillOpacity: 1,
                      strokeColor: "white",
                      strokeWeight: isRisky ? 0 : 1,
                    }}
                  />
                );
              })}

              {/* Bespoke Overlay for Supplier Details (Node Pop-up) */}
              {hovered && (
                <OverlayViewF
                  position={{ lat: hovered.coordinates[0], lng: hovered.coordinates[1] }}
                  mapPaneName="overlayMouseTarget"
                >
                  <div 
                    className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-4 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                  >
                    {/* Shaded White Card */}
                    <div className="bg-[#f8fafc] p-2 rounded shadow-2xl flex items-center gap-2 min-w-[170px] border border-slate-200/50">
                      <div className="w-8 h-8 rounded bg-slate-200/40 flex items-center justify-center font-black text-slate-800 text-[10px] border border-slate-300/30">
                        {hovered.name.charAt(0)}
                      </div>
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="text-[11px] font-black text-black truncate leading-none mb-0.5 tracking-tight">{hovered.name}</span>
                        <span className="text-[9px] font-black text-slate-800 uppercase tracking-tighter truncate">{hovered.location}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 ml-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${hovered.status === RiskStatus.RISKY ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : hovered.status === RiskStatus.CAUTION ? 'bg-amber-500' : 'bg-green-500'}`} />
                        <span className={`text-[7px] font-black uppercase tracking-widest ${hovered.status === RiskStatus.RISKY ? 'text-red-500' : hovered.status === RiskStatus.CAUTION ? 'text-amber-500' : 'text-green-500'}`}>
                          {hovered.status}
                        </span>
                      </div>
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="w-2.5 h-2.5 bg-[#f8fafc] border-r border-b border-slate-200/50 rotate-45 mx-auto -mt-1.5 shadow-xl" />
                  </div>
                </OverlayViewF>
              )}

              {/* Weather Alert Layers (Mocked overlaying points) */}
              {activeLayer === 'WEATHER' && weatherAlerts.map(alert => {
                const firstSupplier = suppliers.find(s => alert.impactedSuppliers.includes(s.id));
                if (!firstSupplier) return null;
                return (
                  <MarkerF
                    key={alert.id}
                    position={{ lat: firstSupplier.coordinates[0] + 0.5, lng: firstSupplier.coordinates[1] + 0.5 }}
                    onMouseOver={() => setHoveredAlert(alert)}
                    onMouseOut={() => setHoveredAlert(null)}
                    icon={{
                      url: alert.weatherIcon ? `https://openweathermap.org/img/wn/${alert.weatherIcon}.png` : "",
                      scaledSize: new google.maps.Size(30, 30)
                    }}
                  />
                );
              })}
            </GoogleMap>

            {/* Weather Alert Tooltip (Absolute relative to viewport if using GoogleMap InfoWindow is restrictive) */}
            {hoveredAlert && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120%] z-[60] animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-amber-950/90 border border-amber-500/30 rounded-2xl shadow-2xl px-5 py-4 min-w-[280px] backdrop-blur-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{hoveredAlert.title}</span>
                      <span className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">{hoveredAlert.severity} Severity</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{hoveredAlert.summary}</p>
                </div>
              </div>
            )}

            {/* Overlays */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col items-start gap-2 z-20">
              <div className="bg-[#070b14]/80 backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl p-2 sm:p-3 shadow-2xl transition-all hover:bg-[#070b14]">
                <h4 className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Region</h4>
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-blue-600/20 rounded-md">
                    <Globe className="text-blue-400 w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-white tracking-tight">{categoryFilter === 'ALL' ? 'Global Grid' : categoryFilter}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setActiveLayer('SATELLITE')}
                  className={`flex items-center gap-1.5 px-2 py-1.5 backdrop-blur-xl border border-white/10 rounded-lg transition-all ${activeLayer === 'SATELLITE' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-[#070b14]/80 text-slate-400 hover:text-white'}`}
                >
                  <Layers className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Satellite</span>
                </button>
                <button 
                  onClick={() => setActiveLayer('WEATHER')}
                  className={`flex items-center gap-1.5 px-2 py-1.5 backdrop-blur-xl border border-white/10 rounded-lg transition-all ${activeLayer === 'WEATHER' ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-[#070b14]/80 text-slate-400 hover:text-white'}`}
                >
                  <CloudRain className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Weather</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Telemetry Panel */}
      <div className={`${isPanelCollapsed ? 'xl:w-16' : 'xl:w-96'} w-full bg-[#070b14]/60 backdrop-blur-2xl border-t xl:border-t-0 xl:border-l border-white/10 flex flex-col transition-all duration-500 ease-in-out shadow-2xl flex-1 xl:flex-none xl:h-full overflow-hidden relative`}>
        <div className={`flex ${isPanelCollapsed ? 'xl:flex-col xl:justify-center' : 'justify-between'} items-center p-4 sm:p-6 border-b border-white/10 bg-white/5`}>
          <div className={`flex items-center gap-3 transition-all duration-300 ${isPanelCollapsed ? 'xl:hidden' : 'opacity-100'}`}>
            <Target size={24} className="text-blue-400" />
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">Telemetry</h3>
          </div>
          <button 
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className={`p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white ${isPanelCollapsed ? 'xl:mx-auto' : ''}`}
          >
            {isPanelCollapsed ? <ChevronUp className="xl:rotate-90" /> : <ChevronDown className="xl:-rotate-90" />}
          </button>
        </div>

        <div className={`p-4 sm:p-8 space-y-6 sm:space-y-8 flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ${isPanelCollapsed ? 'xl:hidden pointer-events-none' : 'opacity-100'}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Integrity</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Feed</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/5 shadow-inner group hover:bg-white/10 transition-colors cursor-default">
              <span className="text-[9px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Active Alerts</span>
              <span className="text-xl sm:text-2xl font-black text-rose-500">{disruptions.length}</span>
            </div>
            <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/5 shadow-inner group hover:bg-white/10 transition-colors cursor-default">
              <span className="text-[9px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Weather Impact</span>
              <span className="text-xl sm:text-2xl font-black text-amber-500">{weatherAlerts.length}</span>
            </div>
          </div>

          <div className="relative h-48 sm:h-56 w-full flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={chartData}
                   innerRadius="70%"
                   outerRadius="95%"
                   paddingAngle={8}
                   dataKey="value"
                   stroke="none"
                 >
                   {chartData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                   ))}
                 </Pie>
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
               <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter">{filteredSuppliers.length}</span>
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Nodes</span>
             </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
             {chartData.map((item) => (
                <div key={item.name} className="flex justify-between items-center px-4 group cursor-default">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: item.color, color: item.color }} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-white">{item.value}%</span>
                </div>
              ))}
          </div>

          <div className="pt-6 sm:pt-8 border-t border-white/5">
             <div className="flex justify-between items-center mb-4 sm:mb-6">
               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Logs</h4>
               <button className="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:underline">View All</button>
             </div>
             <div className="space-y-4 sm:space-y-5">
               {weatherAlerts.length > 0 ? (
                 weatherAlerts.slice(0, 3).map((alert, i) => (
                   <div key={alert.id} className="flex gap-4 group cursor-pointer">
                     <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${alert.severity === 'High' ? 'text-rose-400' : 'text-amber-400'} flex-shrink-0 group-hover:bg-white/10 transition-all`}>
                       {getWeatherIcon(alert.title)}
                     </div>
                     <div className="overflow-hidden flex-1">
                       <p className="text-xs sm:text-sm font-bold text-slate-300 leading-tight truncate group-hover:text-white transition-colors">{alert.title}</p>
                       <p className="text-[9px] text-slate-500 mt-1 uppercase font-black tracking-widest">{alert.location}</p>
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="text-center py-4">
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">No active weather disruptions</p>
                 </div>
               )}
             </div>
          </div>
        </div>
        
        {isPanelCollapsed && (
          <div className="hidden xl:flex flex-col items-center gap-8 pt-10">
            <Target size={20} className="text-blue-400" />
            <Activity size={20} className="text-slate-500" />
            <ShieldAlert size={20} className="text-rose-500" />
            <Zap size={20} className="text-amber-500" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;
