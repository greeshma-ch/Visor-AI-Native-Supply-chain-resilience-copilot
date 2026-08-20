
import React, { useState } from 'react';
import { MOCK_SUPPLIERS, CATEGORIES, GLOBAL_HUBS, getCityCoords } from '../constants';
import { Supplier, RiskStatus, User } from '../types';
import RiskBadge from '../components/RiskBadge';
import { Search, ChevronRight, MapPin, Mail, Filter, Plus, X, Building2, Globe, Tag, ChevronDown, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface RegistryViewProps {
  user: User;
  updateSectors: (sectors: string[]) => void;
  suppliers: Supplier[];
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  statusFilter: RiskStatus | 'ALL';
  onStatusFilterChange: (s: RiskStatus | 'ALL') => void;
  onSelectSupplier: (supplier: Supplier) => void;
  onAddSupplier: (supplier: Supplier) => void;
}

// GLOBAL_HUBS moved to constants.tsx

const RegistryView: React.FC<RegistryViewProps> = ({ 
  user,
  updateSectors,
  suppliers,
  categoryFilter, 
  onCategoryFilterChange,
  statusFilter, 
  onStatusFilterChange, 
  onSelectSupplier,
  onAddSupplier
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'SECTOR' | 'STATUS' | null>(null);
  const [newSupplierLocation, setNewSupplierLocation] = useState('');

  const sectors = user.sectors || ['Logistics'];

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleAddSupplier = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    
    const locationName = newSupplierLocation || formData.get('location') as string;
    const coords = getCityCoords(locationName);
    
    const newSupplier: Supplier = {
      id: `s${Date.now()}`,
      name: formData.get('name') as string,
      location: locationName,
      coordinates: coords as [number, number],
      status: RiskStatus.STABLE,
      category: formData.get('category') as string,
      contactEmail: formData.get('email') as string,
      lastUpdated: new Date().toISOString()
    };

    onAddSupplier(newSupplier);
    setIsAddModalOpen(false);
    setNewSupplierLocation('');
  };

  const handleAddSector = (sector: string) => {
    if (!sectors.includes(sector)) {
      updateSectors([...sectors, sector]);
    }
    setActiveDropdown(null);
  };

  const handleRemoveSector = (sector: string) => {
    if (sectors.length > 1) {
      const newSectors = sectors.filter(s => s !== sector);
      updateSectors(newSectors);
      if (categoryFilter === sector) {
        onCategoryFilterChange('ALL');
      }
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex-shrink-0">
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">Node Registry</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
            <p className="text-slate-500 font-medium text-[10px] uppercase tracking-widest whitespace-nowrap">
              Syndicating insights for {suppliers.length} active global partners.
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
          <div className="relative min-w-[200px] sm:min-w-[240px] flex-1 lg:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text"
              placeholder="Search registry..."
              className="w-full pl-10 pr-4 h-11 bg-[#0a0f1c] border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white text-xs font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAddModalOpen(true)}
            className="h-11 px-6 bg-blue-600 text-white border border-blue-500/50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={18} /> <span>Add Supplier</span>
          </motion.button>

          {/* Sector Filters Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setActiveDropdown(activeDropdown === 'SECTOR' ? null : 'SECTOR')}
              className={`h-11 px-4 bg-[#0a0f1c] border rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
                activeDropdown === 'SECTOR' ? 'border-blue-500 text-white' : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              Sector: <span className="text-white">{categoryFilter}</span> <ChevronDown size={14} className={`transition-transform duration-200 ${activeDropdown === 'SECTOR' ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'SECTOR' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-[#0a0f1c] border border-white/10 rounded-xl shadow-2xl z-50 p-2 overflow-hidden"
                  >
                    <div className="space-y-1">
                      <button
                        onClick={() => { onCategoryFilterChange('ALL'); setActiveDropdown(null); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          categoryFilter === 'ALL' 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        ALL
                      </button>
                      {sectors.map((s) => (
                        <div key={s} className="flex items-center gap-1 group/item">
                          <button
                            onClick={() => { onCategoryFilterChange(s); setActiveDropdown(null); }}
                            className={`flex-1 text-left px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                              categoryFilter === s 
                                ? 'bg-blue-600/20 text-blue-400' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            {s}
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveSector(s); }}
                            className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-400/5"
                            title="Remove Sector"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <div className="pt-2 mt-2 border-t border-white/5">
                        <p className="px-3 py-1 text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Add Sector</p>
                        <div className="grid grid-cols-1 gap-1">
                          {CATEGORIES.filter(c => !sectors.includes(c)).map(c => (
                            <button
                              key={c}
                              onClick={() => handleAddSector(c)}
                              className="w-full text-left px-3 py-2 rounded-lg text-[9px] font-bold text-slate-500 hover:bg-white/5 hover:text-white transition-all"
                            >
                              + {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Status Filter Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setActiveDropdown(activeDropdown === 'STATUS' ? null : 'STATUS')}
              className={`h-11 px-4 bg-[#0a0f1c] border rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
                activeDropdown === 'STATUS' ? 'border-blue-500 text-white' : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              Status: <span className="text-white">{statusFilter}</span> <ChevronDown size={14} className={`transition-transform duration-200 ${activeDropdown === 'STATUS' ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'STATUS' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-32 bg-[#0a0f1c] border border-white/10 rounded-xl shadow-2xl z-50 p-1 overflow-hidden"
                  >
                    {(['ALL', RiskStatus.STABLE, RiskStatus.CAUTION, RiskStatus.RISKY] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => { onStatusFilterChange(f); setActiveDropdown(null); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          statusFilter === f 
                            ? 'bg-blue-600/10 text-blue-400' 
                            : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Responsive Table / Card View */}
      <div className="bg-[#0a0f1c] rounded-[2rem] border border-white/5 shadow-xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/[0.02] border-b border-white/5">
              <tr>
                <th className="px-6 sm:px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Supplier Profile</th>
                <th className="px-6 sm:px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Asset Class</th>
                <th className="px-6 sm:px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Geography</th>
                <th className="px-6 sm:px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Risk Status</th>
                <th className="px-6 sm:px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filteredSuppliers.map((supplier) => (
                <motion.tr 
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                  key={supplier.id}
                  onClick={() => onSelectSupplier(supplier)}
                  className="transition-colors cursor-pointer group"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center font-black text-blue-400 group-hover:scale-105 transition-transform">
                        {supplier.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-extrabold text-white text-sm">{supplier.name}</p>
                        <p className="text-[10px] font-medium mt-0.5 text-slate-500">
                          {supplier.contactEmail || 'Contact not listed'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/5">
                      {supplier.category}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                      <MapPin size={16} className="text-slate-600" /> {supplier.location}
                    </p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col items-start gap-1">
                      <RiskBadge status={supplier.status} size="sm" />
                      <div className="flex items-center gap-1 text-[7px] font-black text-blue-500 uppercase tracking-widest">
                        <Zap size={8} /> AI-Verified
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden grid grid-cols-1 gap-4 p-4">
          {filteredSuppliers.map((supplier) => (
            <div 
              key={supplier.id} 
              onClick={() => onSelectSupplier(supplier)}
              className="p-6 bg-white/5 rounded-3xl border border-white/10 active:bg-white/10 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center font-black text-blue-400 flex-shrink-0">
                  {supplier.name.charAt(0)}
                </div>
                <RiskBadge status={supplier.status} size="sm" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-base truncate mb-1">{supplier.name}</h4>
                <div className="flex flex-col gap-1 text-[10px] text-slate-500 uppercase font-black tracking-widest">
                  <span className="flex items-center gap-1.5"><MapPin size={12} /> {supplier.location}</span>
                  <span className="flex items-center gap-1.5"><Tag size={12} /> {supplier.category}</span>
                  <span className="flex items-center gap-1.5 text-blue-400/80 lowercase font-medium tracking-normal"><Mail size={12} /> {supplier.contactEmail || 'No contact provided'}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Node ID: {supplier.id.toUpperCase()}</span>
                <ChevronRight size={16} className="text-blue-400" />
              </div>
            </div>
          ))}
        </div>

        {filteredSuppliers.length === 0 && (
          <div className="p-16 sm:p-24 text-center">
            <div className="inline-flex p-4 sm:p-6 bg-white/5 rounded-full mb-4 sm:mb-6">
              <Search size={48} className="text-slate-700" />
            </div>
            <p className="text-slate-500 font-bold text-base sm:text-lg px-6">No partners match current intelligence filters.</p>
            <button 
              onClick={() => { setSearchTerm(''); onStatusFilterChange('ALL'); }}
              className="mt-4 text-blue-400 font-bold text-xs sm:text-sm hover:underline underline-offset-4"
            >
              Reset Global Filters
            </button>
          </div>
        )}
      </div>

      {/* Add Supplier Modal Overlay */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0a0f1c] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xl font-bold text-white">Register New Supplier</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar">
              <form onSubmit={handleAddSupplier} className="p-6 sm:p-8 space-y-6 pb-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Building2 size={16} /> Supplier Name
                  </label>
                  <input required name="name" type="text" placeholder="e.g. Quantum Components Ltd" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Globe size={16} /> Region
                    </label>
                    <div className="relative">
                      <input 
                        list="registry-hubs"
                        required 
                        name="location"
                        value={newSupplierLocation}
                        onChange={(e) => setNewSupplierLocation(e.target.value)}
                        placeholder="Search global hub..." 
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all text-xs" 
                      />
                      <datalist id="registry-hubs">
                        {GLOBAL_HUBS.map((h, i) => (
                          <option key={i} value={h.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Tag size={16} /> Asset Class
                    </label>
                    <div className="relative">
                      <select required name="category" defaultValue="" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none cursor-pointer text-xs">
                        <option value="" disabled className="bg-[#0a0f1c]">Select Class</option>
                        {CATEGORIES.map(c => (
                          <option key={c} value={c} className="bg-[#0a0f1c]">{c}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <ChevronRight size={14} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Mail size={16} /> Operational Contact
                  </label>
                  <input name="email" type="email" placeholder="ops@supplier.com" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all" />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl transition-all">
                  Finalize Node Registry
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistryView;
