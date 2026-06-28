
import React, { useState } from 'react';
import { ArrowRight, Building2, UserCircle, Key, Globe, ChevronDown } from 'lucide-react';
import Logo from '../components/Logo';
import { User, Role } from '../types';
import { GLOBAL_HUBS, getCityCoords } from '../constants';
import { motion } from 'motion/react';

interface AuthViewProps {
  onComplete: (user: User) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onComplete }) => {
  const [company, setCompany] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [hqLocation, setHqLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validateAccessKey = (key: string) => {
    // Demo Mode: Allow any password-length string (e.g. 6+ chars)
    return key.length >= 6;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!company.trim() || !accessKey.trim() || !role || !hqLocation.trim()) {
      setError("Strategic parameters incomplete. All fields are required for initialization.");
      return;
    }

    if (!validateAccessKey(accessKey)) {
      setError("Protocol mismatch. Access Key must be at least 6 characters for demo authorization.");
      return;
    }

    onComplete({ 
      company, 
      accessKey, 
      role: role as Role, 
      sectors: ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive'], 
      hqLocation,
      hqCoordinates: getCityCoords(hqLocation)
    });
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-2 sm:p-4 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-md bg-[#0a0f1c] rounded-[2rem] shadow-2xl border border-white/5 overflow-hidden animate-in zoom-in-95 duration-500 my-auto">
        <div className="p-6 sm:p-8 text-center bg-blue-600/5 border-b border-white/5">
          <Logo className="justify-center mb-1" />
          <p className="text-blue-500/60 mt-1 text-[10px] font-black uppercase tracking-[0.3em]">AI-Native Supply Chain Resilience Copilot</p>
          {error && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">{error}</p>
            </div>
          )}
        </div>

        <motion.form 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          onSubmit={handleSubmit} 
          className="p-6 sm:p-8 space-y-4 sm:space-y-5"
        >
          <motion.div variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Building2 size={14} /> Enterprise Domain
            </label>
            <input
              type="text"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Global Logistics"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white placeholder:text-slate-700 text-sm"
            />
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Key size={14} /> Access Protocol
            </label>
            <input
              type="password"
              required
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="e.g. 12345678"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white text-sm"
            />
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Globe size={14} /> Global Headquarters
            </label>
            <div className="relative">
              <input
                list="global-cities"
                type="text"
                required
                value={hqLocation}
                onChange={(e) => setHqLocation(e.target.value)}
                placeholder="Search or enter city..."
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white placeholder:text-slate-700 text-sm"
              />
              <datalist id="global-cities">
                {GLOBAL_HUBS.map((hub) => (
                  <option key={hub.name} value={hub.name} />
                ))}
              </datalist>
            </div>
          </motion.div>


          <motion.div variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <UserCircle size={14} /> Operational Role
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                required
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none text-white text-sm cursor-pointer"
              >
                <option value="" disabled className="bg-[#0a0f1c] text-slate-500">Select Role...</option>
                <option value="Admin" className="bg-[#0a0f1c]">Administrator</option>
                <option value="Manager" className="bg-[#0a0f1c]">Operations Manager</option>
                <option value="Analyst" className="bg-[#0a0f1c]">Supply Chain Analyst</option>
                <option value="Viewer" className="bg-[#0a0f1c]">Guest Viewer</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={14} />
              </div>
            </div>
          </motion.div>

          <motion.button
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            whileHover={{ scale: 1.02, backgroundColor: '#3b82f6' }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full py-3.5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-xl shadow-[0_0_25px_rgba(37,99,235,0.25)] flex items-center justify-center gap-3 transition-all"
          >
            Authorize Session <ArrowRight size={16} />
          </motion.button>

          <motion.p variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="text-center text-[7px] text-slate-700 font-black uppercase tracking-[0.4em] mt-2">
            Encrypted Node Access Protocol
          </motion.p>
        </motion.form>
      </div>
    </div>
  );
};

export default AuthView;
