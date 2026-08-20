
import React, { useState } from 'react';
import { View, Role, User } from '../types';
import { CATEGORIES } from '../constants';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Map as MapIcon, 
  Bell, 
  Settings, 
  LogOut,
  ChevronRight,
  Menu,
  X,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Building2
} from 'lucide-react';
import Logo from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  user: User;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeView, 
  onViewChange, 
  onLogout, 
  user,
  categoryFilter,
  onCategoryFilterChange
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const companyName = user.company;
  const sectors = user.sectors || ['Logistics'];

  const menuItems = [
    { id: 'DASHBOARD' as View, label: 'Overview', icon: LayoutDashboard },
    { id: 'REGISTRY' as View, label: 'Data Registry', icon: Users },
    { id: 'MAP' as View, label: 'Map Analytics', icon: MapIcon },
    { id: 'FEED' as View, label: 'Alerts', icon: Bell },
    { id: 'RESOURCES' as View, label: 'Resource Center', icon: BookOpen },
    { id: 'SETTINGS' as View, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#070b14] overflow-hidden text-slate-100">
      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative z-40 h-full bg-[#080c18] border-r border-white/5 flex flex-col transition-all duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'w-20' : 'w-72'}
      `}>
        <div className={`flex items-center border-b border-white/5 h-20 shrink-0 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'justify-between p-6'}`}>
          <Logo collapsed={isCollapsed} />
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.96 }}
              key={item.id}
              onClick={() => {
                onViewChange(item.id);
                setIsMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                activeView === item.id 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <item.icon size={22} className={activeView === item.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-200'} />
              {!isCollapsed && <span className="font-semibold text-sm">{item.label}</span>}
              {activeView === item.id && !isCollapsed && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-auto shadow-[0_0_10px_rgba(96,165,250,0.8)]" />}
            </motion.button>
          ))}

          {!isCollapsed && (
            <div className="pt-10">
              <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Layers size={10} /> Filters
              </p>
              <div className="space-y-1">
                <button 
                  onClick={() => onCategoryFilterChange('ALL')}
                  className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    categoryFilter === 'ALL' ? 'text-blue-400 bg-blue-400/5' : 'text-slate-500 hover:bg-white/5'
                  }`}
                >
                  All Regions
                </button>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => onCategoryFilterChange(cat)}
                    className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      categoryFilter === cat ? 'text-blue-400 bg-blue-400/5' : 'text-slate-500 hover:bg-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/5 shrink-0">
          <div className={`p-4 bg-white/5 rounded-2xl mb-4 transition-all ${isCollapsed ? 'p-2' : ''}`}>
            {!isCollapsed && <p className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Enterprise</p>}
            <p className={`text-sm font-bold text-slate-200 truncate ${isCollapsed ? 'text-center' : ''}`}>{companyName}</p>
          </div>
          <button 
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-rose-400 hover:bg-rose-400/5 rounded-xl transition-all font-bold text-sm ${isCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#070b14]">
        <header className="h-20 bg-[#080c18] border-b border-white/5 flex items-center justify-between px-6 sm:px-10 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile/Tablet Toggle */}
            <button 
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
            >
              {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Desktop Toggle */}
            <button 
              className="hidden lg:block p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <Logo collapsed={true} className="mr-4 lg:hidden scale-75" />
              <span className="text-slate-500 text-[10px] sm:text-xs font-black uppercase tracking-widest hidden sm:block">Network</span>
              <ChevronRight size={14} className="text-slate-700 hidden sm:block" />
              <span className="text-blue-400 font-black text-xs sm:text-sm uppercase tracking-widest truncate max-w-[120px] sm:max-w-none">
                {activeView === 'MAP' ? 'Map' : activeView.replace('_', ' ')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-6 px-4 py-2 border border-dashed border-blue-500/30 rounded-2xl bg-blue-500/5">
              <div className="hidden sm:flex flex-col text-right">
                <p className="text-sm font-bold text-slate-200">Session Active</p>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Feed Linked</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-900/40 flex-shrink-0 flex items-center justify-center">
                <Building2 size={20} className="text-white" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
