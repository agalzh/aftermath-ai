import React, { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import BlurText from '../components/BlurText';
import Dither from '../components/Dither';
import GlassSurface from '../components/GlassSurface';

interface LoginProps {
  onLoginSuccess?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnonymousLogin = async () => {
    if (!auth) { setError("System config error"); return; }
    setLoading(true);
    try {
      await signInAnonymously(auth);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col items-center justify-center font-sans">

      {}
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

      {}
      <div className="relative z-10 w-full max-w-md px-4 pointer-events-none">

        {}
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
          opacity={0.8}
          mixBlendMode="screen"

          className="p-8 sm:p-10" 
        >

          {}
          <div className="w-full"> {}

            {}
            <div className="text-center mb-10">
              {}
              <div className="mb-3 flex justify-center">
                <BlurText
                  text="AfterMath AI"
                  delay={150}
                  animateBy="words"
                  direction="top"
                  className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-lg"
                />
              </div>

              {}
              <p className="text-xs sm:text-sm text-zinc-300 font-semibold uppercase tracking-[0.2em] drop-shadow-md">
                Crowd Observation System
              </p>
            </div>

            {}
            {error && (
              <div className="flex items-center gap-2 p-4 mb-6 text-sm text-red-200 bg-red-500/20 border border-red-500/30 rounded-lg backdrop-blur-sm">
                <span>{error}</span>
              </div>
            )}

            {}
            <div className="space-y-6">
              <button
                onClick={handleAnonymousLogin}
                disabled={loading}
                className={`
                  group relative w-full flex justify-center items-center py-4 px-4 
                  text-sm font-bold rounded-xl text-white 
                  bg-white/10 hover:bg-white/20 border border-white/20
                  shadow-[0_4px_30px_rgba(0,0,0,0.1)]
                  backdrop-blur-[5px]
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-black
                  transition-all duration-300 pointer-events-auto
                  ${loading ? 'cursor-not-allowed opacity-70' : 'hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]'}
                `}
              >
                {loading ? 'Authenticating...' : 'Enter System'}
              </button>

              <p className="text-center text-[10px] text-zinc-400 mt-6 tracking-widest font-mono">
                MVP Demo Submitted for GDG SASTRA'S InnovHack
              </p>
            </div>
          </div>

        </GlassSurface>
      </div>
    </div>
  );
};

export default Login;