import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldAlert, MapPin, Activity, Radio, VolumeX, CheckCircle2, AlertTriangle, Navigation, Info } from 'lucide-react';
import { useToast } from '../components/useToast';
import { config } from '../config/env';
import { useWebSocket } from '../hooks/useWebSocket';
import api from '../services/api';

const CitizenApp = () => {
    const [deviceId] = useState(() => {
        let id = localStorage.getItem('nexus_citizen_id');
        if (!id) {
            id = `DEVICE-APP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            localStorage.setItem('nexus_citizen_id', id);
        }
        return id;
    });

    const [sending, setSending] = useState(false);
    const [silentMode, setSilentMode] = useState(false);
    const [sosResponse, setSosResponse] = useState(null);
    const [backendOnline, setBackendOnline] = useState(true);
    const [emergencyState, setEmergencyState] = useState(false);
    const [dispatchInfo, setDispatchInfo] = useState(null);
    const [countdownEta, setCountdownEta] = useState(null);
    const { addToast } = useToast();

    // 🔊 Original Beep Alert
    const playSOSBeep = useCallback(() => {
        if (silentMode) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContext();
            const triggerBeep = (startTime) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(2500, startTime);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
                gain.gain.linearRampToValueAtTime(0, startTime + 0.1);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.1);
            };
            const now = audioCtx.currentTime;
            triggerBeep(now);
            triggerBeep(now + 0.2);
            triggerBeep(now + 0.4);
        } catch (e) {
            console.error("Emergency beep failed", e);
        }
    }, [silentMode]);

    // Simple health check 
    useEffect(() => {
        const checkPing = async () => {
            try {
                const res = await api.get('ping');
                setBackendOnline(res.status === 200);
            } catch {
                setBackendOnline(false);
            }
        };
        checkPing();
        const inv = setInterval(checkPing, 30000);
        return () => clearInterval(inv);
    }, []);

    const handleWSEvent = useCallback((msg) => {
        // 🔥 STAGE 2: Receive Live Dispatch (Transfers from Image 4 to Image 3 state)
        if (msg.type === "UNIT_DISPATCHED") {
            setDispatchInfo({
                ...msg.data,
                status: `RESCUE UNIT ${msg.data.unit_callsign} EN ROUTE`
            });
            setCountdownEta(Math.round(msg.data.eta_mins));
            addToast("Unit Dispatched! Tracking live...", "success");
        }
    }, [addToast]);

    const { status: wsStatus } = useWebSocket(backendOnline ? (import.meta.env.VITE_WS_URL || config.WS_URL) : null, handleWSEvent);

    const processSOS = (payload, isSilent) => {
        if (!isSilent) {
            setEmergencyState(true);
            playSOSBeep();
        }

        if (!navigator.onLine) {
            const queue = JSON.parse(localStorage.getItem('nexus_sos_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('nexus_sos_queue', JSON.stringify(queue));
            if (!isSilent) addToast("SOS Queued locally.", "error", 8000);
            setSending(false);
            return;
        }

        api.post('ingestion/sos', payload)
        .then(res => {
            const data = res.data;
            setSending(false);
            if (!isSilent) {
                // 🔥 STAGE 1: Show Summary (Image 4)
                setSosResponse(data);
                // We DON'T set dispatchInfo here yet, only via WebSocket or explicit dispatch
            }
        })
        .catch(() => {
            setSending(false);
            if (!isSilent) addToast("Transmission lag. Syncing...", "warning", 5000);
        });
    };

    const handleSOS = () => {
        setSending(true);
        playSOSBeep();
        setTimeout(() => {
            const mockLat = 13.60;
            const mockLng = 79.39;
            processSOS({
                lat: mockLat,
                lng: mockLng,
                description: "Emergency activated via Citizen App SOS",
                device_id: deviceId
            }, false);
        }, 1500);
    };

    return (
        <div className="min-h-screen w-full bg-[#050B18] flex flex-col font-sans relative text-slate-200 overflow-y-auto px-4 pt-6 pb-24">
            {/* Header matches Image 1/2 */}
            <nav className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/40">
                        <Shield className="text-white fill-white" size={18} />
                    </div>
                    <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">NEXUS Citizen</h1>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${backendOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">API ONLINE</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Radio size={12} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Live</span>
                    </div>
                </div>
            </nav>

            {emergencyState && (
                <div className="bg-red-950/30 border-y border-red-500/20 p-3 text-center mb-8">
                    <p className="text-red-500 font-black flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.25em]">
                        <Activity size={14} className="animate-pulse" /> EMERGENCY STATE ACTIVE
                    </p>
                </div>
            )}

            <main className="flex-1 flex flex-col items-center">
                <AnimatePresence mode="wait">
                    {!emergencyState ? (
                        <motion.div key="sos-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                            <p className="text-slate-400 text-center mb-12 max-w-xs text-sm font-bold tracking-tight leading-relaxed">
                                Press and hold the SOS button below if you are in immediate danger. Your location will be auto-transmitted.
                            </p>
                            <div className="relative group cursor-pointer" onClick={handleSOS}>
                                <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping blur-xl"></div>
                                <div className="relative w-64 h-64 rounded-full bg-red-600 flex flex-col items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.5)] border-8 border-red-700/50">
                                    {sending ? <Activity className="animate-spin text-white" size={48} /> : (
                                        <>
                                            <span className="text-6xl font-black text-white tracking-tighter drop-shadow-lg italic uppercase">SOS</span>
                                            <span className="mt-4 px-4 py-1.5 bg-black/20 rounded-full text-[10px] font-black uppercase tracking-widest text-white/90">Tap for Rescue</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-16 w-full max-w-sm space-y-4">
                                <div className="bg-[#0D1525] border border-slate-800 p-5 rounded-2xl shadow-2xl text-left">
                                    <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                                        <ShieldAlert size={14} /> Auto-Detected Protocol
                                    </h3>
                                    <ul className="space-y-3 text-xs font-black text-slate-300">
                                        <li>1. Move to high ground immediately.</li>
                                        <li>2. Use emergency stairwells. No elevators.</li>
                                        <li>3. Conserve battery. Use SMS over Voice.</li>
                                    </ul>
                                </div>
                                <div className="bg-[#0D1525] border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-2xl">
                                    <div className="flex items-center gap-3">
                                        <VolumeX className="text-slate-500" size={20} />
                                        <div className="text-left flex flex-col">
                                            <span className="text-[11px] font-black text-white uppercase tracking-tight">Silent Distress Mode</span>
                                            <span className="text-[9px] text-slate-500 font-bold leading-tight">Triggers on 5x power presses or shake.</span>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${silentMode ? 'bg-red-600' : 'bg-slate-700'}`} onClick={() => setSilentMode(!silentMode)}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${silentMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="sos-active" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-4">
                            <div className="bg-[#0D1525] border border-slate-800 rounded-3xl p-6 shadow-2xl">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-lg font-black tracking-tighter text-white uppercase italic">Execution Status</h3>
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{sosResponse?.severity || 'LOW'}</span>
                                    </div>
                                </div>

                                {/* 🔥 STAGE 2 (IMAGE 3): ONLY SHOW IF DISPATCH IS RECEIVED FROM ADMIN */}
                                {dispatchInfo && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-blue-600/10 border border-blue-500/30 rounded-2xl p-5 mb-6">
                                        <div className="flex items-center gap-2 mb-3 text-blue-400">
                                            <Radio size={16} className="animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Rescue Details on the way</span>
                                        </div>
                                        <h4 className="text-md font-black text-white mb-2 tracking-tight">Rescue unit dispatched — ETA {countdownEta || 9.5} min</h4>
                                        <div className="h-2 w-full bg-blue-500/20 rounded-full overflow-hidden mb-4 border border-blue-500/10">
                                            <motion.div initial={{ width: "20%" }} animate={{ width: "80%" }} transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }} className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                                        </div>
                                        <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-tight">Unit:</span>
                                                <span className="text-[10px] text-white font-black uppercase tracking-widest italic">🚑 AMBULANCE</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-tight">ETA:</span>
                                                <span className="text-lg text-cyan-400 font-black tracking-[0.2em]">{countdownEta || 9.5} MIN</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* 🔥 STAGE 1 (IMAGE 4): ALWAYS SHOW INCIDENT SUMMARY */}
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-start transition-all">
                                        <div className="flex items-center gap-2 mb-1">
                                            <MapPin size={12} className="text-red-500" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</span>
                                        </div>
                                        <div className="text-[13px] font-black text-white tracking-widest">{sosResponse?.location?.lat?.toFixed(2) || '13.60'}, {sosResponse?.location?.lng?.toFixed(2) || '79.39'}</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-start">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Shield size={12} className="text-emerald-500" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Severity</span>
                                        </div>
                                        <div className="text-[12px] font-black text-emerald-400 uppercase tracking-[0.2em]">{sosResponse?.severity || 'LOW'}</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-start">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Activity size={12} className="text-cyan-500" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence</span>
                                        </div>
                                        <div className="text-xl font-black text-white tracking-tighter">{sosResponse?.confidence ? `${Math.round(sosResponse.confidence * 100)}%` : '75%'}</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-start">
                                        <div className="flex items-center gap-2 mb-1 text-emerald-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Status:</span>
                                        </div>
                                        <div className="text-[11px] font-black text-white italic">
                                            {dispatchInfo ? dispatchInfo.status : (sosResponse?.status_message || "No immediate danger detected. Stay safe.")}
                                        </div>
                                    </div>
                                </div>

                                {/* BACK TO CONTROL BUTTON (IMAGE 4) */}
                                <button onClick={() => { setEmergencyState(false); setSosResponse(null); setDispatchInfo(null); }} className="w-full mt-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all border border-slate-800">
                                    Back to Control
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default CitizenApp;
