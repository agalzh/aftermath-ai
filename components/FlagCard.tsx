import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Observation } from '../types';
import { useState } from 'react';
import { User } from 'firebase/auth';
import GlassSurface from './GlassSurface';

export default function FlagCard({ obs, urgent = false, user }: { obs: Observation; urgent?: boolean; user: User | null }) {
    const [instruction, setInstruction] = useState('');

    return (
        <div className="relative w-full mb-4 group">

            {}
            <div className="absolute inset-0 rounded-xl overflow-hidden z-0">
                <GlassSurface
                    width="100%"
                    height="100%"
                    borderRadius={12}
                    displace={urgent ? 25 : 10}
                    distortionScale={urgent ? -200 : -100}
                    redOffset={urgent ? 30 : 5}
                    greenOffset={urgent ? 0 : 15}
                    blueOffset={urgent ? 0 : 25}
                    brightness={urgent ? 50 : 70}
                    opacity={0.6}
                    mixBlendMode="normal"
                    className={urgent ? "border border-red-500/30" : "border border-white/10"}
                />
            </div>

            {}
            <div className="relative z-10 p-4 text-white">

                {}
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full tracking-wider uppercase border ${
                                urgent 
                                ? 'bg-red-500/20 text-red-200 border-red-500/50 shadow-[0_0_10px_rgba(220,38,38,0.4)]' 
                                : 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50'
                            }`}>
                                {obs.crowdLevel}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                                {obs.createdAt?.toDate?.().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1 truncate max-w-[200px]">
                            {obs.volunteerEmail}
                        </p>
                    </div>

                    {obs.status === 'ACKNOWLEDGED' && (
                        <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-1 rounded border border-green-500/30 flex items-center gap-1">
                            <span>✅</span> Ack
                        </span>
                    )}
                </div>

                {}
                {obs.imageBase64 && (
                    <div className="mb-3 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                        <img
                            src={obs.imageBase64}
                            alt="Evidence"
                            className="w-full h-32 object-cover opacity-90 hover:opacity-100 hover:scale-105 transition-all duration-500 cursor-pointer"
                            onClick={() => window.open(obs.imageBase64, '_blank')}
                        />
                    </div>
                )}

                {}
                {obs.message && (
                    <div className="mb-3 bg-black/20 p-2.5 rounded-lg border border-white/5">
                        <p className="italic text-xs text-zinc-300 leading-relaxed">"{obs.message}"</p>
                    </div>
                )}

                {}

                {}
                {obs.aiStatus === "PROCESSING" && (
                    <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2 animate-pulse">
                        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-blue-300 font-medium">AI Analyzing...</span>
                    </div>
                )}

                {}
                {obs.aiStatus === 'DONE' && obs.aiInsight && (
                    <div className="mb-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 border-b border-indigo-500/20 flex justify-between items-center bg-indigo-500/10">
                            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">✨ Gemini Insight</span>
                            <span className="text-[10px] font-bold text-white bg-indigo-600/50 px-1.5 rounded">{obs.aiInsight.risk}</span>
                        </div>

                        <div className="p-3">
                            <p className="text-xs text-indigo-100/80 mb-3 leading-snug">{obs.aiInsight.summary}</p>
                            <div className="space-y-1.5">
                                {obs.aiInsight.actions.map((action, i) => (
                                    <button
                                        key={i}
                                        className="w-full text-left text-[11px] bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1.5 rounded hover:bg-indigo-500/40 text-indigo-200 transition-colors flex items-center gap-2 group/btn"
                                        onClick={() => setInstruction(action)}
                                    >
                                        <span className="text-indigo-400 group-hover/btn:text-white transition-colors">↳</span> 
                                        {action}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {}
                {obs.aiStatus === 'FAILED' && (
                    <div className="mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center justify-center gap-2 shadow-[inset_0_0_10px_rgba(220,38,38,0.2)]">
                        <span className="text-[10px] text-red-400 font-bold tracking-wide uppercase">
                            ⚠️ AI Unavailable — Manual Control Active
                        </span>
                    </div>
                )}

                {}
                {(obs.aiStatus === 'FAILED' || obs.aiStatus === 'DONE' || !obs.aiStatus) && (
                    <div className="space-y-2">
                        <textarea
                            className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-zinc-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none resize-none transition-all"
                            placeholder="Type instruction..."
                            rows={2}
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            disabled={obs.status === 'RESOLVED'}
                        />

                        <div className='flex gap-2'>
                            <button
                                className="flex-1 bg-cyan-600/80 hover:bg-cyan-500 text-white border border-cyan-400/30 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all shadow-[0_0_10px_rgba(8,145,178,0.2)] disabled:opacity-30 disabled:shadow-none"
                                disabled={obs.status === 'RESOLVED' || !instruction}
                                onClick={async () => {
                                    if (!user) return alert("Please log in first");
                                    await updateDoc(doc(db, 'observations', obs.id), {
                                        instruction,
                                        status: 'PENDING',
                                        adminEmail: user.email,
                                        updatedAt: serverTimestamp()
                                    });
                                    await addDoc(collection(db, 'auditLogs'), {
                                        observationId: obs.id,
                                        action: 'ADMIN_SENT',
                                        adminEmail: user.email,
                                        message: instruction,
                                        createdAt: serverTimestamp()
                                    });
                                    setInstruction('');
                                }}
                            >
                                Send Order
                            </button>

                            <button
                                className="flex-1 bg-white/5 hover:bg-green-500/20 border border-white/10 hover:border-green-500/50 text-zinc-400 hover:text-green-300 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-20"
                                disabled={obs.status !== 'ACKNOWLEDGED'} 
                                onClick={async () => {
                                    if (!user) return alert("Please log in first");
                                    if(confirm("Confirm resolution?")) {
                                        await updateDoc(doc(db, 'observations', obs.id), {
                                            status: 'RESOLVED',
                                            resolvedBy: user.email,
                                            resolvedAt: serverTimestamp()
                                        });
                                        await addDoc(collection(db, 'auditLogs'), {
                                            observationId: obs.id,
                                            action: 'RESOLVED',
                                            adminEmail: user.email,
                                            createdAt: serverTimestamp()
                                        });
                                    }
                                }}
                            >
                                Resolve
                            </button>
                        </div>
                    </div>
                )}

                {}
                <div className="mt-3 pt-2 border-t border-white/5 flex justify-between">
                    <span className="text-[9px] text-zinc-300 font-mono">ID: {obs.id.slice(0,6)}</span>
                    <span className="text-[9px] text-zinc-400">{obs.status || 'NEW'}</span>
                </div>
            </div>
        </div>
    );
}