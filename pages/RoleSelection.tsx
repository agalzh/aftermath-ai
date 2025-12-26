import React from 'react';
import { UserRole } from '../types';
import GlassSurface from '../components/GlassSurface';
import BlurText from '../components/BlurText';
import Dither from '../components/Dither';

interface RoleSelectionProps {
  onSelectRole: (role: UserRole) => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  return (
    // 1. CONTAINER: Fills the available space from Layout
    <div className="relative w-full h-full flex items-center justify-center p-4 pointer-events-none">
      
      {/* 2. BACKGROUND: Dither Effect (Consistent with Login) */}
      <div className="absolute inset-0 z-0">
         <Dither 
           waveColor={[0.5, 0.5, 0.5]}
           disableAnimation={false}
           enableMouseInteraction={true}
           mouseRadius={0.3}
           colorNum={4}
           waveAmplitude={0.3}
           waveFrequency={3}
           waveSpeed={0.05}
         />
      </div>

      {/* 3. GLASS SURFACE WRAPPER */}
      <div className="relative z-10 w-full max-w-3xl">
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={24}
          displace={15}
          distortionScale={-150}
          redOffset={5}
          greenOffset={15}
          blueOffset={25}
          brightness={60}
          opacity={0.7}
          mixBlendMode="screen"
          className="p-8 sm:p-12"
        >
          <div className="w-full text-center">
            
            {/* Header */}
            <div className="mb-10">
              <div className="flex justify-center mb-4">
                 <BlurText 
                   text="Identity Verification" 
                   delay={150} 
                   className="text-3xl sm:text-4xl font-black tracking-tighter text-white drop-shadow-lg"
                 />
              </div>
              <p className="text-sm text-zinc-300 font-semibold uppercase tracking-[0.2em] opacity-80">
                Select your assignment clearance level
              </p>
            </div>

            {/* Role Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* --- ADMIN BUTTON --- */}
              <button
                onClick={() => onSelectRole(UserRole.ADMIN)}
                className="group relative flex flex-col items-center justify-center p-8 
                           bg-white/5 hover:bg-cyan-500/10 pointer-events-auto
                           border border-white/10 hover:border-cyan-500/50 
                           rounded-2xl transition-all duration-300 
                           hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]"
              >
                {/* Icon Circle */}
                <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-cyan-500/20 ring-1 ring-white/10 group-hover:ring-cyan-500/50 flex items-center justify-center mb-4 transition-colors duration-300 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-zinc-400 group-hover:text-cyan-400 transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                  </svg>
                </div>
                
                <span className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">Admin</span>
                <span className="text-xs text-zinc-500 mt-2 uppercase tracking-widest group-hover:text-cyan-200/60">System Control</span>
              </button>

              {/* --- VOLUNTEER BUTTON --- */}
              <button
                onClick={() => onSelectRole(UserRole.VOLUNTEER)}
                className="group relative flex flex-col items-center justify-center p-8 
                           bg-white/5 hover:bg-emerald-500/10 pointer-events-auto
                           border border-white/10 hover:border-emerald-500/50 
                           rounded-2xl transition-all duration-300 
                           hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]"
              >
                {/* Icon Circle */}
                <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-emerald-500/20 ring-1 ring-white/10 group-hover:ring-emerald-500/50 flex items-center justify-center mb-4 transition-colors duration-300 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-zinc-400 group-hover:text-emerald-400 transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                </div>

                <span className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">Volunteer</span>
                <span className="text-xs text-zinc-500 mt-2 uppercase tracking-widest group-hover:text-emerald-200/60">Field Operations</span>
              </button>

            </div>
          </div>
        </GlassSurface>
      </div>

    </div>
  );
};

export default RoleSelection;