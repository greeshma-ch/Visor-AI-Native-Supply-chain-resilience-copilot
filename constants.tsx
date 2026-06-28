
import { RiskStatus, Supplier, Disruption, IntelligenceBrief } from './types';

export const CATEGORIES = [
  'Electronics',
  'Semiconductors',
  'Automotive',
  'Pharmaceuticals',
  'Textiles',
  'F&B',
  'Logistics'
];

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 's1',
    name: 'Advanced Micro Circuits',
    category: 'Semiconductors',
    location: 'Taiwan, Hsinchu',
    coordinates: [24.78, 120.99],
    status: RiskStatus.STABLE,
    contactEmail: 'logistics@amc-taiwan.com',
    lastUpdated: '2026-04-15T10:00:00Z'
  },
  {
    id: 's2',
    name: 'Global Logistics Hub',
    category: 'Logistics',
    location: 'Netherlands, Rotterdam',
    coordinates: [51.92, 4.47],
    status: RiskStatus.CAUTION,
    contactEmail: 'ops@glh-rotterdam.nl',
    lastUpdated: '2026-04-15T08:30:00Z'
  },
  {
    id: 's3',
    name: 'South Sea Textiles',
    category: 'Textiles',
    location: 'Vietnam, Ho Chi Minh',
    coordinates: [10.82, 106.62],
    status: RiskStatus.RISKY,
    contactEmail: 'sales@southsea-tex.vn',
    lastUpdated: '2026-04-15T14:15:00Z'
  },
  {
    id: 's4',
    name: 'Bavarian Motor Parts',
    category: 'Automotive',
    location: 'Germany, Munich',
    coordinates: [48.13, 11.58],
    status: RiskStatus.STABLE,
    contactEmail: 'procurement@bmp-ag.de',
    lastUpdated: '2026-04-14T09:00:00Z'
  },
  {
    id: 's5',
    name: 'Tokyo Electron Components',
    category: 'Electronics',
    location: 'Japan, Tokyo',
    coordinates: [35.67, 139.65],
    status: RiskStatus.CAUTION,
    contactEmail: 'support@tokyo-el.jp',
    lastUpdated: '2026-04-15T11:00:00Z'
  },
  {
    id: 's6',
    name: 'Organic Grain Corp',
    category: 'F&B',
    location: 'USA, Chicago',
    coordinates: [41.87, -87.62],
    status: RiskStatus.STABLE,
    contactEmail: 'orders@organic-grain.com',
    lastUpdated: '2026-04-15T16:45:00Z'
  },
  {
    id: 's7',
    name: 'BioGen Therapeutics',
    category: 'Pharmaceuticals',
    location: 'Switzerland, Zurich',
    coordinates: [47.37, 8.54],
    status: RiskStatus.STABLE,
    contactEmail: 'supply-chain@biogen-tx.ch',
    lastUpdated: '2026-04-15T09:00:00Z'
  }
];

export const MOCK_DISRUPTIONS: Disruption[] = [
  {
    id: 'd1',
    title: 'Port Strike in Rotterdam',
    type: 'Strike',
    severity: 'High',
    location: 'Netherlands, Rotterdam',
    timestamp: '2026-04-15T06:00:00Z',
    summary: 'Ongoing union strikes at major terminals causing 48-hour vessel delays.',
    impactedSuppliers: ['s2']
  },
  {
    id: 'd2',
    title: 'Typhoon Ewan Alert',
    type: 'Weather',
    severity: 'Medium',
    location: 'Vietnam, Taiwan, South China Sea',
    timestamp: '2026-04-15T18:00:00Z',
    summary: 'Expected heavy rainfall and strong winds affecting regional shipping routes.',
    impactedSuppliers: ['s3', 's1']
  },
  {
    id: 'd3',
    title: 'Semiconductor Shortage Spike',
    type: 'Logistics',
    severity: 'High',
    location: 'Taiwan, Japan, East Asia',
    timestamp: '2026-04-15T09:00:00Z',
    summary: 'Sudden demand spike in consumer electronics straining existing chip allocations.',
    impactedSuppliers: ['s1', 's5']
  }
];

export const GLOBAL_HUBS = [
  { name: 'Tokyo, Japan', coords: [35.6762, 139.6503] as [number, number] },
  { name: 'Shanghai, China', coords: [31.2304, 121.4737] as [number, number] },
  { name: 'Berlin, Germany', coords: [52.5200, 13.4050] as [number, number] },
  { name: 'San Francisco, USA', coords: [37.7749, -122.4194] as [number, number] },
  { name: 'Singapore', coords: [1.3521, 103.8198] as [number, number] },
  { name: 'Mumbai, India', coords: [19.0760, 72.8777] as [number, number] },
  { name: 'London, UK', coords: [51.5074, -0.1278] as [number, number] },
  { name: 'Seoul, South Korea', coords: [37.5665, 126.9780] as [number, number] },
  { name: 'Sydney, Australia', coords: [-33.8688, 151.2093] as [number, number] },
  { name: 'São Paulo, Brazil', coords: [-23.5505, -46.6333] as [number, number] },
  { name: 'Dubai, UAE', coords: [25.2048, 55.2708] as [number, number] },
  { name: 'Amsterdam, Netherlands', coords: [52.3676, 4.9041] as [number, number] },
  { name: 'Toronto, Canada', coords: [43.6532, -79.3832] as [number, number] },
  { name: 'Rotterdam, Netherlands', coords: [51.9225, 4.47917] as [number, number] },
  { name: 'Ho Chi Minh City, Vietnam', coords: [10.8231, 106.6297] as [number, number] },
  { name: 'Hsinchu, Taiwan', coords: [24.8138, 120.9675] as [number, number] },
  { name: 'Bangalore, India', coords: [12.9716, 77.5946] as [number, number] },
  { name: 'Munich, Germany', coords: [48.1351, 11.5820] as [number, number] },
  { name: 'Chicago, USA', coords: [41.8781, -87.6298] as [number, number] },
  { name: 'Paris, France', coords: [48.8566, 2.3522] as [number, number] },
  { name: 'New York, USA', coords: [40.7128, -74.0060] as [number, number] },
  { name: 'Hong Kong', coords: [22.3193, 114.1694] as [number, number] },
  { name: 'Frankfurt, Germany', coords: [50.1109, 8.6821] as [number, number] },
  { name: 'Melbourne, Australia', coords: [-37.8136, 144.9631] as [number, number] },
  { name: 'Mexico City, Mexico', coords: [19.4326, -99.1332] as [number, number] },
  { name: 'Istanbul, Turkey', coords: [41.0082, 28.9784] as [number, number] },
  { name: 'Jakarta, Indonesia', coords: [-6.2088, 106.8456] as [number, number] },
  { name: 'Madrid, Spain', coords: [40.4168, -3.7038] as [number, number] },
  { name: 'Zurich, Switzerland', coords: [47.3769, 8.5417] as [number, number] },
  { name: 'Johannesburg, South Africa', coords: [-26.2041, 28.0473] as [number, number] },
];

export const getCityCoords = (cityName: string): [number, number] => {
  const hub = GLOBAL_HUBS.find(h => h.name === cityName);
  return hub ? hub.coords : [37.7749, -122.4194]; // Default to SF
};

export const HISTORICAL_ARCHIVE_2024 = [
  { id: 202401, title: '2024 Global Logistics Whitepaper', type: 'PDF', date: 'May 2024', category: 'reports', location: 'Global' },
  { id: 202402, title: 'Taiwan Semiconductor Cluster Analysis', type: 'Report', date: 'May 2024', category: 'reports', location: 'Taiwan' },
  { id: 202403, title: 'Maritime Trade Disruption Protocol', type: 'Manual', date: 'Apr 2024', category: 'handbooks', location: 'Maritime' },
  { id: 202404, title: 'Reuters Supply Chain Index 2024', type: 'Link', date: 'Jun 2024', category: 'reports', url: 'https://www.reuters.com', location: 'Global' },
  { id: 202405, title: 'South China Sea Security Brief', type: 'Report', date: 'May 2024', category: 'reports', location: 'South China Sea' },
  { id: 202406, title: 'CASE STUDY: 2024 Rotterdam Port Strike', type: 'Report', date: 'May 2024', category: 'reports', location: 'Rotterdam' },
  { id: 202407, title: 'CASE STUDY: Typhoon Ewan Impact Analysis', type: 'Report', date: 'May 2024', category: 'reports', location: 'South China Sea' },
];
