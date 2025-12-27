import React from 'react';
import { UserRole } from '../types';
import GlassSurface from './GlassSurface';

interface LayoutProps {
  children: React.ReactNode;
  userRole?: UserRole;
  onLogoClick?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, userRole, onLogoClick }) => {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black font-san">

      {}
      {}
      <div className="absolute top-4 left-4 right-4 z-50 h-20 pointer-events-none">

        {}
        {}
        <GlassSurface
          width="100%"
          height={80}
          borderRadius={20}
          displace={15}
          distortionScale={-150}
          redOffset={5}
          greenOffset={15}
          blueOffset={25}
          brightness={60}
          opacity={0.6} 

          mixBlendMode="screen"
          className="shadow-lg"
        >
          {}
          {}
          <div className="w-full h-full flex justify-between items-center px-6">

            {}
            <div
              className={`flex items-center gap-2 ${onLogoClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={onLogoClick}
            >

              {}
              <h1 className="text-lg font-bold text-white tracking-tight">
                Aftermath <span className="text-gray-500">AI</span>
              </h1>
            </div>

            {}
            {userRole && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                  {userRole}
                </span>
              </div>
            )}
          </div>
        </GlassSurface>
      </div>

      {}
      {}
      <main className="absolute inset-0 w-full h-full overflow-hidden">
        {children}
      </main>

    </div>
  );
};

export default Layout;