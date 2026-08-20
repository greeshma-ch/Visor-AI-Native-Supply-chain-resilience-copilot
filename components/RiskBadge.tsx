
import React from 'react';
import { RiskStatus } from '../types';

interface RiskBadgeProps {
  status: RiskStatus;
  size?: 'sm' | 'md' | 'lg';
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ status, size = 'md' }) => {
  const styles = {
    [RiskStatus.STABLE]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    [RiskStatus.CAUTION]: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    [RiskStatus.RISKY]: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[9px]',
    md: 'px-2.5 py-1 text-[10px]',
    lg: 'px-4 py-1.5 text-xs',
  };

  return (
    <span className={`inline-flex items-center font-black rounded-lg border ${styles[status]} ${sizes[size]} uppercase tracking-widest`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
        status === RiskStatus.STABLE ? 'bg-emerald-500' : 
        status === RiskStatus.CAUTION ? 'bg-amber-500' : 'bg-rose-500'
      }`} />
      {status}
    </span>
  );
};

export default RiskBadge;
