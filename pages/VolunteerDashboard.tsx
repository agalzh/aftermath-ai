import React, { useEffect, useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth, googleProvider } from '../firebase'; 

import { CrowdLevel, Waypoint, Observation } from '../types';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { analyzeObservationClientSide } from '../utils/aiLogic';
import Dither from '../components/Dither';
import GlassSurface from '../components/GlassSurface';
import BlurText from '../components/BlurText';

const VolunteerDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  const [assignedWaypoint, setAssignedWaypoint] = useState<Waypoint | null>(null);
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>(CrowdLevel.LOW);
  const [message, setMessage] = useState('');
  const [pendingObservation, setPendingObservation] = useState<Observation | null>(null);
  const [hasActiveObservation, setHasActiveObservation] = useState(false);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const OBS_WINDOW_MS = 10 * 60 * 1000;
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(OBS_WINDOW_MS);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      alert("Google Sign-In failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAssignedWaypoint(null);
  };

  useEffect(() => {
    if (!db || !user?.email) {
      setAssignedWaypoint(null);
      return;
    }

    const q = query(collection(db, 'waypoints'));

    const unsub = onSnapshot(q, (snapshot) => {
      const matched = snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as Waypoint) }))
        .find(wp => wp.assignedEmails?.includes(user.email!));

      setAssignedWaypoint(matched || null);
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!db || !user?.email || !assignedWaypoint) {
      setPendingObservation(null);
      return;
    }

    const q = query(
      collection(db, 'observations'),
      where('waypointId', '==', assignedWaypoint.id),
      where('volunteerEmail', '==', user.email),
      where('status', '==', 'PENDING')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const pendingObs = snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as Observation) }))
        .find(o => o.status === 'PENDING');

      setPendingObservation(pendingObs || null);
    });

    return () => unsub();
  }, [assignedWaypoint, user]);

  useEffect(() => {
    if (!timerStart && (imageBase64 || message)) {
      setTimerStart(Date.now());
    }
  }, [imageBase64, message]);

  useEffect(() => {
    if (!timerStart) return;
    const i = setInterval(() => {
      const elapsed = Date.now() - timerStart;
      setTimeLeft(OBS_WINDOW_MS - elapsed);
    }, 1000);
    return () => clearInterval(i);
  }, [timerStart]);

  const handleSubmitObservation = async () => {
    if (!user || !user.email) {
      alert('You must be logged in');
      return;
    }

    if (!assignedWaypoint) {
      alert('No waypoint assigned to you yet.');
      return;
    }

    try {

      const docRef = await addDoc(collection(db, 'observations'), {
        imageBase64,
        waypointId: assignedWaypoint.id,
        volunteerEmail: user.email,
        crowdLevel,
        message,
        status: 'NEW',
        aiStatus: 'PENDING', 

        createdAt: serverTimestamp() || new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      analyzeObservationClientSide(docRef.id);

      console.log('🟢 Observation submitted');
      setTimerStart(null);
      setTimeLeft(OBS_WINDOW_MS);
      setCrowdLevel(CrowdLevel.LOW);
      setMessage('');
      setImageBase64(null);

      alert("Observation sent!");

    } catch (err) {
      console.error('❌ Failed to submit observation', err);
      alert("Failed to send observation.");
    }
  };

  if (!user || user.isAnonymous) {
    return (
      <div className="relative w-full h-screen bg-black overflow-auto flex flex-col items-center justify-center font-sans">

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
        <div className="relative z-10 w-full max-w-sm px-4 pointer-events-none">
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
            className="p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="w-full">
              {}
              <div className="text-center mb-5">
                <BlurText
                  text="VOLUNTEER ACCESS"
                  delay={150}
                  className="text-3xl font-black tracking-tighter text-white drop-shadow-lg mb-2 justify-center"
                />
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-[0.2em] leading-relaxed">
                  Sign in to receive waypoint assignments and report incidents.
                </p>
              </div>

              {}
              {}
              <button
                onClick={handleGoogleLogin}
                className="group relative w-full flex items-center justify-center gap-3 py-4 px-4 border border-white/10 text-sm font-bold rounded-xl text-white bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] pointer-events-auto"
              >
                {}
                <svg className="w-5 h-5 drop-shadow-md" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="tracking-widest">SIGN IN WITH GOOGLE</span>
              </button>

            </div>
          </GlassSurface>
        </div>
      </div>
    );
  }

  if (user.email === "admin@aftermath.com") {

    alert("Session already started, open a new instance in private window");
    window.location.href = "/";
    return null; 

  }

  return (
    <div className="relative w-full h-full bg-[#050505] text-zinc-200 font-sans selection:bg-white/20 overflow-y-auto overflow-x-hidden">

      {}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
        <Dither
          waveColor={[0.6, 0.6, 0.6]}
          disableAnimation={false}
          enableMouseInteraction={false}
          colorNum={2}
          waveAmplitude={0.05}
          waveSpeed={0.01}
        />
      </div>

      {}
      {}
      <div className=''>
        <div className="relative z-10 md:w-2/4 w-md mx-auto pt-28 px-4 flex flex-col gap-6">

          <GlassSurface
            width="100%"
            height="auto"
            borderRadius={24}
            displace={20}
            distortionScale={-120}
            redOffset={2}
            greenOffset={4}
            blueOffset={8}
            brightness={50}
            opacity={0.4}
            mixBlendMode="normal"
            className="shadow-2xl border border-white/5"
          >
            {}
            <div className="p-6 md:p-8 space-y-8 w-full">

              {}
              <div className="flex flex-col items-center justify-center border-b border-white/5 pb-6">
                <BlurText
                  text="FIELD OPERATIONS"
                  delay={150}
                  className="text-3xl font-black tracking-tighter text-white uppercase drop-shadow-lg text-center"
                />
              </div>

              {}
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                    Volunteer ID
                  </span>
                  <span className="text-sm font-medium text-white tracking-tight font-mono break-all">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 rounded border border-red-500/20 text-red-400 text-[10px] font-medium tracking-wider hover:bg-red-500/10 transition-colors uppercase"
                >
                  Logout
                </button>
              </div>

              {}
              <div className={`transition-all duration-500 ${!assignedWaypoint ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-[15px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                    Current Assignment
                  </h2>
                </div>

                <div className="bg-black/20 border border-white/5 rounded-2xl p-5">
                  <div className="text-xl font-medium text-white tracking-tight">
                    {assignedWaypoint ? assignedWaypoint.name : 'Standby for assignment...'}
                  </div>

                  {}
                  {timerStart && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-mono">
                      <span className="text-zinc-500 uppercase tracking-wider">Time Remaining</span>
                      <span className={timeLeft > 0 ? 'text-zinc-300' : 'text-red-500'}>
                        {timeLeft > 0 ? `${Math.ceil(timeLeft / 60000)} MIN` : 'EXPIRED'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {}
              {pendingObservation && (
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5">
                  <p className="text-[9px] font-bold text-orange-500 uppercase tracking-[0.2em] mb-2">
                    Priority Message
                  </p>
                  <p className="text-sm text-zinc-300 mb-4 font-light leading-relaxed">
                    {pendingObservation.instruction}
                  </p>
                  <button
                    onClick={async () => {
                      if (!pendingObservation.id) return;
                      await updateDoc(doc(db, 'observations', pendingObservation.id), { status: 'ACKNOWLEDGED' });
                    }}
                    className="w-full py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              )}

              {}
              <div className={`space-y-6 ${!assignedWaypoint ? 'opacity-30 pointer-events-none grayscale' : ''}`}>

                {}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {}
                <div className="space-y-3">
                  <label className="text-[15px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                    Evidence
                  </label>
                  <label className="block w-full aspect-[16/9] rounded-2xl bg-black/20 border border-dashed border-zinc-700 hover:border-zinc-500 cursor-pointer transition-all relative overflow-hidden group">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (re) => {
                          const img = new Image();
                          img.src = re.target?.result as string;
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const scale = 800 / img.width;
                            canvas.width = 800;
                            canvas.height = img.height * scale;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                            setImageBase64(canvas.toDataURL('image/jpeg', 0.7));
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    {imageBase64 ? (
                      <>
                        <img src={imageBase64} alt="Evidence" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                        <button
                          onClick={(e) => { e.preventDefault(); setImageBase64(null); }}
                          className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-red-500/50 transition"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                        <div className="p-3 rounded-full bg-white/5 ring-1 ring-white/10">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Tap to Capture</span>
                      </div>
                    )}
                  </label>
                </div>

                {}
                <div className="grid grid-cols-1 gap-6">

                  {}
                  <div className="space-y-3">
                    <label className="text-[15px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                      Crowd Density
                    </label>
                    <div className="relative group">
                      <select
                        className="w-full bg-black/20 border border-white/10 text-zinc-200 px-4 py-4 rounded-xl text-xs font-medium uppercase tracking-wide appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                        value={crowdLevel}
                        onChange={(e) => setCrowdLevel(e.target.value as CrowdLevel)}
                      >
                        {Object.values(CrowdLevel).map((level) => (
                          <option key={level} value={level} className="bg-black text-zinc-400">
                            {level}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="space-y-3">
                    <label className="text-[15px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                      Field Notes
                    </label>
                    <textarea
                      className="w-full bg-black/20 border border-white/10 text-zinc-200 px-4 py-4 rounded-xl text-sm focus:outline-none focus:border-white/30 transition-colors resize-none placeholder-zinc-700 font-light"
                      rows={3}
                      placeholder="Brief description..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                </div>

                {}
                <button
                  onClick={handleSubmitObservation}
                  disabled={!assignedWaypoint}
                  className="w-full py-4 bg-zinc-100 hover:bg-white text-black text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:shadow-none transition-all duration-300"
                >
                  Submit Report
                </button>

              </div>
            </div>
          </GlassSurface>

          <p className="text-center text-[9px] text-zinc-800 font-mono tracking-[0.3em] uppercase opacity-50 pb-8">
            Secure Uplink Active
          </p>
        </div>
      </div>
    </div>
  );
};

export default VolunteerDashboard;