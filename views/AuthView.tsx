import React, { useState } from 'react';
import { ArrowRight, Building2, UserCircle, Key, Globe, ChevronDown, Mail, Lock, Loader2, Sparkles } from 'lucide-react';
import Logo from '../components/Logo';
import { User, Role } from '../types';
import { GLOBAL_HUBS, getCityCoords } from '../constants';
import { motion } from 'motion/react';
import { signInWithPassword, signUpWithPassword, fetchUserProfile, isSupabaseConfigured } from '../lib/supabaseClient';

interface AuthViewProps {
  onComplete: (user: User) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onComplete }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState<Role | ''>('Analyst');
  const [hqLocation, setHqLocation] = useState('San Francisco');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim() || !password.trim()) {
      setError("Please provide both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      if (!isSupabaseConfigured) {
        // Offline / Demo fallback when Supabase env vars are not configured
        const fallbackUser: User = {
          id: 'demo-user-id',
          email,
          company: company.trim() || 'Global Logistics Corp',
          role: (role as Role) || 'Analyst',
          hqLocation: hqLocation.trim() || 'San Francisco',
          hqCoordinates: getCityCoords(hqLocation || 'San Francisco'),
          sectors: ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive']
        };
        onComplete(fallbackUser);
        return;
      }

      if (authMode === 'signup') {
        if (!company.trim() || !role || !hqLocation.trim()) {
          setError("All profile fields are required for creating an account.");
          setIsLoading(false);
          return;
        }

        const data = await signUpWithPassword(email, password, {
          company: company.trim(),
          role: role as Role,
          hqLocation: hqLocation.trim(),
          hqCoordinates: getCityCoords(hqLocation),
          sectors: ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive']
        });

        if (data.session && data.user) {
          const newUser: User = {
            id: data.user.id,
            email: data.user.email,
            company: company.trim(),
            role: role as Role,
            hqLocation: hqLocation.trim(),
            hqCoordinates: getCityCoords(hqLocation),
            sectors: ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive']
          };
          onComplete(newUser);
        } else {
          setMessage("Account created! If email confirmation is enabled on your Supabase project, check your inbox to confirm your email.");
        }
      } else {
        // Sign In
        const data = await signInWithPassword(email, password);
        if (data.user) {
          // Fetch existing profile
          const profile = await fetchUserProfile(data.user.id);
          const loggedUser: User = profile || {
            id: data.user.id,
            email: data.user.email,
            company: data.user.user_metadata?.company || 'Enterprise Logistics',
            role: (data.user.user_metadata?.role as Role) || 'Analyst',
            hqLocation: data.user.user_metadata?.hqLocation || 'San Francisco',
            hqCoordinates: data.user.user_metadata?.hqCoordinates || getCityCoords('San Francisco'),
            sectors: data.user.user_metadata?.sectors || ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive']
          };
          onComplete(loggedUser);
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    const demoUser: User = {
      id: 'demo-user-id',
      email: 'demo@visor.network',
      company: 'Apex Supply Chain Partners',
      role: 'Analyst',
      hqLocation: 'San Francisco',
      hqCoordinates: getCityCoords('San Francisco'),
      sectors: ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive']
    };
    onComplete(demoUser);
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-2 sm:p-4 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-md bg-[#0a0f1c] rounded-[2rem] shadow-2xl border border-white/5 overflow-hidden animate-in zoom-in-95 duration-500 my-auto">
        <div className="p-6 sm:p-8 text-center bg-blue-600/5 border-b border-white/5">
          <Logo className="justify-center mb-1" />
          <p className="text-blue-500/60 mt-1 text-[10px] font-black uppercase tracking-[0.3em]">AI-Native Supply Chain Resilience Copilot</p>
          
          {error && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[11px] text-rose-400 font-medium">{error}</p>
            </div>
          )}

          {message && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[11px] text-emerald-400 font-medium">{message}</p>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/5 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => { setAuthMode('signin'); setError(null); setMessage(null); }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${authMode === 'signin' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/10' : 'text-slate-500 hover:text-slate-400'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('signup'); setError(null); setMessage(null); }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${authMode === 'signup' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/10' : 'text-slate-500 hover:text-slate-400'}`}
          >
            Create Account
          </button>
        </div>

        <motion.form 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05
              }
            }
          }}
          onSubmit={handleSubmit} 
          className="p-6 sm:p-8 space-y-4 sm:space-y-5"
        >
          <motion.div variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Mail size={14} /> Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@enterprise.com"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white placeholder:text-slate-700 text-sm"
            />
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Lock size={14} /> Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white placeholder:text-slate-700 text-sm"
            />
          </motion.div>

          {authMode === 'signup' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Building2 size={14} /> Enterprise Domain
                </label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Global Logistics Corp"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white placeholder:text-slate-700 text-sm"
                />
              </div>

              <div className="space-y-2">
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
              </div>

              <div className="space-y-2">
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
                    <option value="Admin" className="bg-[#0a0f1c]">Administrator</option>
                    <option value="Manager" className="bg-[#0a0f1c]">Operations Manager</option>
                    <option value="Analyst" className="bg-[#0a0f1c]">Supply Chain Analyst</option>
                    <option value="Viewer" className="bg-[#0a0f1c]">Guest Viewer</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </>
          )}

          <motion.button
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            whileHover={{ scale: 1.02, backgroundColor: '#3b82f6' }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
            type="submit"
            className="w-full py-3.5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-xl shadow-[0_0_25px_rgba(37,99,235,0.25)] flex items-center justify-center gap-3 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Authenticating...
              </>
            ) : authMode === 'signin' ? (
              <>
                Sign In to Workspace <ArrowRight size={16} />
              </>
            ) : (
              <>
                Create Account <ArrowRight size={16} />
              </>
            )}
          </motion.button>

          <div className="relative flex items-center justify-center pt-2">
            <div className="border-t border-white/10 w-full"></div>
            <span className="bg-[#0a0f1c] px-3 text-[10px] uppercase font-bold text-slate-600 tracking-widest absolute">or</span>
          </div>

          <motion.button
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={handleDemoAccess}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles size={14} className="text-amber-400" /> Explore Demo Workspace
          </motion.button>

          <p className="text-center text-[9px] text-slate-600 font-medium tracking-wide">
            {isSupabaseConfigured ? 'Secured with Supabase Auth & PostgreSQL Row-Level Security' : 'Demo Mode (Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud auth)'}
          </p>
        </motion.form>
      </div>
    </div>
  );
};

export default AuthView;
