
import React, { useState } from 'react';
import { User, View } from '../types';
import { CreditCard, Users, Shield, Bell, HardDrive, Cpu, AlertCircle, CheckCircle2, ArrowRight, Lock, Database, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsViewProps {
  user: User;
  onLogout: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onLogout }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [groundingEnabled, setGroundingEnabled] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [teamMembers, setTeamMembers] = useState([
    { name: 'Sarah Connor', role: 'ADMIN', email: 'sarah@global.com' },
    { name: 'John Doe', role: 'ANALYST', email: 'john@global.com' },
  ]);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    
    // Simulate API delay
    setTimeout(() => {
      const name = inviteEmail.split('@')[0];
      const newMember = {
        name: name.charAt(0).toUpperCase() + name.slice(1).replace('.', ' '),
        role: 'VIEWER' as any,
        email: inviteEmail
      };
      setTeamMembers([...teamMembers, newMember]);
      setInviteEmail('');
      setIsInviting(false);
      toast.success(`Invitation protocol initiated.`, {
        description: `${inviteEmail} granted Viewer access.`
      });
    }, 1200);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">System Configuration</h2>
          <p className="text-slate-500 font-medium mt-1 text-xs sm:text-base uppercase tracking-widest">Manage global infrastructure, team governance, and intelligence protocols.</p>
        </div>
        <button 
          onClick={onLogout}
          className="px-6 py-3 bg-rose-600/10 border border-rose-500/20 text-rose-500 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-rose-600 hover:text-white transition-all w-full sm:w-auto"
        >
          Terminate Session
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
        {/* User Profile Summary */}
        <div className="lg:col-span-1 space-y-6 sm:space-y-8">
          <div className="bg-[#0a0f1c] p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-6">
              <UserCircle size={48} className="text-blue-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">{user.company}</h3>
            <div className="px-3 py-1 bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full mb-6 shadow-lg shadow-blue-900/40">
              Enterprise Verified
            </div>
            
            <div className="w-full space-y-3 pt-6 border-t border-white/5">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                <span>Access Role</span>
                <span className="text-white">{user.role}</span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                <span>HQ Node</span>
                <span className="text-white">{user.hqLocation || 'Global'}</span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                <span>Security Level</span>
                <span className="text-emerald-500">Maximum</span>
              </div>
            </div>
          </div>

          {/* Engine Parameters */}
          <div className="bg-[#0a0f1c] p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 sm:space-y-10">
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
              <Cpu size={28} className="text-amber-500" /> Engine Parameters
            </h3>
            <div className="space-y-8 sm:space-y-10">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-extrabold text-white uppercase tracking-tight">Real-time Grounding</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-widest">Cross-reference live news.</p>
                </div>
                <button 
                  onClick={() => setGroundingEnabled(!groundingEnabled)}
                  className={`w-12 h-6 flex-shrink-0 rounded-full relative p-1 transition-all ${groundingEnabled ? 'bg-blue-600 shadow-lg shadow-blue-900/40' : 'bg-slate-800'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 ${groundingEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-extrabold text-white uppercase tracking-tight">Push Alerts</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-widest">Direct protocol updates.</p>
                </div>
                <button 
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`w-12 h-6 flex-shrink-0 rounded-full relative p-1 transition-all ${notificationsEnabled ? 'bg-blue-600 shadow-lg shadow-blue-900/40' : 'bg-slate-800'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Authorization Grid & Governance */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          <div className="bg-[#0a0f1c] p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col h-full">
            <h3 className="text-lg sm:text-xl font-black text-white mb-6 sm:mb-8 flex items-center gap-3 uppercase tracking-tight">
              <Users size={28} className="text-emerald-500" /> Team Governance
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {teamMembers.map((member, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex-shrink-0 flex items-center justify-center font-black">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-white truncate">{member.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium truncate">{member.email}</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[8px] font-black text-slate-400 px-2 py-1 bg-white/5 rounded-md tracking-[0.2em]">{member.role}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Authorize New Operational Node</p>
              <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="email"
                  required
                  placeholder="Operational contact email..."
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white placeholder:text-slate-600"
                />
                <button 
                  type="submit"
                  disabled={isInviting}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                >
                  {isInviting ? 'Authorizing...' : 'Authorize'}
                </button>
              </form>
            </div>

            {/* Compliance Summary */}
            <div className="mt-10 pt-10 border-t border-white/5">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-6">Security & Isolation Protocols</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: Shield, label: 'SOC2-II', color: 'text-rose-500' },
                  { icon: Lock, label: 'AES-256', color: 'text-blue-500' },
                  { icon: Database, label: 'GDPR-ISO', color: 'text-emerald-500' },
                  { icon: CheckCircle2, label: 'FIPS 140-2', color: 'text-amber-500' }
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                    <item.icon size={20} className={item.color} />
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
