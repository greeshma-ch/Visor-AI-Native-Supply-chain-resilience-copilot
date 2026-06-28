
import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ collapsed = false, className = '' }) => {
  return (
    <div className={`flex items-center gap-3 select-none group/logo ${className}`}>
      <div className="relative flex-shrink-0">
        <svg 
          width={collapsed ? "40" : "48"} 
          height={collapsed ? "40" : "48"} 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 filter drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]"
        >
          <defs>
            <pattern id="hexGrid" width="10" height="17.32" patternUnits="userSpaceOnUse">
              <path 
                d="M5 0L10 2.88675V8.66025L5 11.547L0 8.66025V2.88675L5 0Z" 
                stroke="#00F0FF" 
                strokeWidth="0.5" 
                fill="none" 
                opacity="0.15"
              />
            </pattern>
            <linearGradient id="scanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00FF85" stopOpacity="0" />
              <stop offset="50%" stopColor="#00FF85" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00FF85" stopOpacity="0" />
            </linearGradient>
            <filter id="neonEmeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Hexagonal Grid Background Layer */}
          <path 
            d="M5 50C5 30 25 15 50 15C75 15 95 30 95 50C95 70 75 85 50 85C25 85 5 70 5 50Z" 
            fill="url(#hexGrid)" 
            className="opacity-40"
          />

          {/* Main Eye Structure (Cyber Cyan) */}
          <path 
            d="M5 50C5 30 25 15 50 15C75 15 95 30 95 50C95 70 75 85 50 85C25 85 5 70 5 50ZM90 50C90 32 72 20 50 20C28 20 10 32 10 50C10 68 28 80 50 80C72 80 90 68 90 50Z" 
            fill="#00F0FF" 
            className="filter drop-shadow-[0_0_3px_rgba(0,240,255,0.8)]"
          />

          {/* Target Reticle (Pupil) */}
          <g className="reticle-group">
            <motion.circle 
              cx="50" cy="50" r="12" 
              stroke="#00F0FF" strokeWidth="1.5" 
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.circle 
              cx="50" cy="50" r="6" 
              fill="#00F0FF"
              animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Crosshairs */}
            <path d="M50 34V42M50 58V66M34 50H42M58 50H66" stroke="#00F0FF" strokeWidth="1" />
          </g>

          {/* Vertical Scan-Line (Neon Emerald) */}
          <motion.g
            animate={{ 
              translateY: ["0%", "45%", "0%", "-45%", "0%"]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          >
            <motion.rect 
              x="8" y="49.5" width="84" height="1.5" 
              fill="#00FF85" 
              filter="url(#neonEmeraldGlow)"
              className="group-hover/logo:animate-pulse"
              style={{
                boxShadow: "0 0 10px #00FF85"
              }}
              whileHover={{
                filter: "url(#neonEmeraldGlow) brightness(1.5)",
                scaleY: [1, 1.5, 0.8, 1.2, 1],
                opacity: [1, 0.8, 1, 0.5, 1]
              }}
            />
            {/* Glow sweep */}
            <rect x="10" y="40" width="80" height="20" fill="url(#scanGradient)" opacity="0.1" />
          </motion.g>
        </svg>

        {/* Outer Tech-Frame / Glow */}
        <div className="absolute -inset-2 bg-cyan-500/10 rounded-full blur-xl group-hover/logo:bg-emerald-500/20 transition-all duration-700 opacity-60" />
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          <span className="font-black text-2xl tracking-[0.25em] text-white whitespace-nowrap uppercase italic leading-none flex items-center gap-1">
            VISOR
            <motion.span 
              className="w-1.5 h-1.5 rounded-full bg-[#00FF85] shadow-[0_0_8px_#00FF85]"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </span>
          <span 
            className="text-[6px] font-black tracking-[0.3em] text-white/60 uppercase mt-1 relative"
            style={{ 
              textShadow: '0.5px 0 rgba(239, 68, 68, 0.5), -0.5px 0 rgba(6, 182, 212, 0.5)'
            }}
          >
            AI-Native Supply Chain Resilience Copilot
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
