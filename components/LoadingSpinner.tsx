import React from 'react';
import Dither from './Dither';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#050505] font-sans">
      
      {/* 1. BACKGROUND: SUBTLE NOISE (Continuity) */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <Dither
          waveColor={[0.6, 0.6, 0.6]}
          disableAnimation={false}
          enableMouseInteraction={false}
          colorNum={2}
          waveAmplitude={0.05}
          waveSpeed={0.01}
        />
      </div>

      {/* 2. LOADER CONTENT */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        
        {/* Minimalist Spinner */}
        <div className="relative">
          {/* Track */}
          <div className="w-12 h-12 rounded-full border-[3px] border-white/5"></div>
          {/* Moving Indicator */}
          <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-[3px] border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
        </div>

        {/* Technical Label */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">
            System Loading
          </span>
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest animate-pulse">
            Please Wait...
          </span>
        </div>

      </div>
    </div>
  );
};

export default LoadingSpinner;