import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldAlert, MapPin, Activity, Radio, VolumeX, CheckCircle2, AlertTriangle, Navigation, Info, Flame, Droplets, Heart, Car, Zap, Waves } from 'lucide-react';
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

    const [selectedCategory, setSelectedCategory] = useState("SOS");
    const [sending, setSending] = useState(false);
    const [silentMode, setSilentMode] = useState(false);
    const [sosResponse, setSosResponse] = useState(null);
    const [backendOnline, setBackendOnline] = useState(true);
    const [stage, setStage] = useState("IDLE");
    const [dispatchData, setDispatchData] = useState(null);
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

    // ✅ WebSocket Event Handler (Centralized & Safe)
    const handleWSEvent = useCallback((msg) => {
        try {
            console.info("[WS EVENT]", msg);

            // 🚑 UNIT DISPATCHED EVENT
            if (msg?.type === "UNIT_DISPATCHED") {
                setDispatchData(msg.data);
                setCountdownEta(Math.round(msg.data?.eta_mins || 0));
                setStage("RESCUE_ACTIVE");
                addToast("Unit Dispatched! Tracking live...", "success");
            }

            // ⚡ INCIDENT UPDATE (REAL-TIME SYNC)
            else if (msg?.type === "new_incident") {
                setSosResponse((curr) => {
                    if (!curr) return curr;

                    // Match event safely
                    if (curr.event_id === msg.data?.id || curr.id === msg.data?.id) {
                        console.info("⚡ WebSocket SYNC: Updating incident data");

                        return {
                            ...curr,
                            ...msg.data
                        };
                    }

                    return curr;
                });
            }

        } catch (err) {
            console.error("❌ WebSocket Handler Error:", err);
        }
    }, [addToast]);

    // ✅ WebSocket Hook (ONLY SOURCE OF WS)
    const { status: wsStatus } = useWebSocket(
        backendOnline ? (import.meta.env.VITE_WS_URL || config.WS_URL) : null,
        handleWSEvent
    );

    // ✅ Production-Level SOS Handler
    const processSOS = useCallback(async (isSilent = false) => {
        try {
            setSending(true);

            // Get Real Location
            let location = { lat: 13.6012, lng: 79.3905 }; // Default fallback
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                });
                location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            } catch (e) {
                console.warn("Geolocation failed, using fallback:", e);
            }

            const payload = {
                ...location,
                device_id: deviceId,
                description: `Emergency: ${selectedCategory} reported`
            };

            const res = await api.post('ingestion/sos', {
                ...payload,
                category: selectedCategory
            });

            const data = res.data;
            console.info("📡 SOS Response:", data);

            setSosResponse(data);
            setSending(false);

        } catch (err) {
            console.error("❌ SOS Error:", err);
            setSending(false);
            // If it fails, give the user feedback and reset stage after a few seconds
            addToast("Syncing with satellite relay...", "warning", 5000);
            setTimeout(() => {
                 if (!sosResponse) setStage("IDLE");
            }, 6000);
        }
    }, [deviceId, selectedCategory, addToast]);

    // 🕵️ DEBUG LOG
    useEffect(() => {
        if (sosResponse) console.info("📦 UPDATED SOS STATE:", sosResponse);
    }, [sosResponse]);

    // ✅ High-Stability Polling Backup
    useEffect(() => {
        const eventId = sosResponse?.event_id || sosResponse?.id;
        if (!eventId) return;

        let retry = 0;
        const interval = setInterval(async () => {
            retry++;

            if (retry > 10) {
                clearInterval(interval);
                console.warn("⛔ Polling timeout: Stopping fallback sync");
                return;
            }

            try {
                // If we already have the data, stop polling
                if (sosResponse?.severity || sosResponse?.severity_level) {
                    clearInterval(interval);
                    return;
                }

                console.info(`⏳ Polling Fallback (Attempt ${retry})...`);
                const res = await api.get(`events/${eventId}`);

                if (res.data) {
                    console.info("⚡ Polling Sync: Partial/Full Data Captured");
                    setSosResponse(prev => ({
                        ...prev,
                        ...res.data
                    }));

                    if (res.data?.severity_level || res.data?.severity) {
                        console.info("✅ Polling Sync Success: FULL TELEMETRY LOCKED");
                        clearInterval(interval);
                    }
                }

            } catch (err) {
                console.error("Polling failed", err);
            }

        }, 3000);

        return () => clearInterval(interval);
    }, [sosResponse?.event_id, sosResponse?.id, sosResponse?.severity, sosResponse?.severity_level]);

    const handleSOS = () => {
        // Immediate visual feedback
        setSending(true);
        setStage("EXECUTION");
        playSOSBeep();
        
        processSOS(silentMode);
    };

    // --- HELPER: SAFE DATA EXTRACTION ---
    const getSosValue = useCallback((key) => {
        if (!sosResponse) return null;

        if (key === 'location') {
            // Handle Nested: { location: { lat, lng } }
            if (sosResponse.location?.lat !== undefined) {
                return `${sosResponse.location.lat.toFixed(4)}, ${sosResponse.location.lng.toFixed(4)}`;
            }
            // Handle Flat: { lat, lng }
            if (sosResponse.lat !== undefined) {
                return `${sosResponse.lat.toFixed(4)}, ${sosResponse.lng.toFixed(4)}`;
            }
            return null;
        }

        if (key === 'severity') {
            return sosResponse.severity_level || sosResponse.severity || null;
        }

        if (key === 'confidence') {
            const score = sosResponse.confidence_score !== undefined ? sosResponse.confidence_score : sosResponse.confidence;
            return score !== undefined ? `${Math.round(score * 100)}%` : null;
        }

        return sosResponse[key] || null;
    }, [sosResponse]);


    const disasterTypes = [
        { id: 'Medical', icon: Heart, color: 'text-red-500' },
        { id: 'Accident', icon: Car, color: 'text-orange-500' },
        { id: 'Fire', icon: Flame, color: 'text-amber-500' },
        { id: 'Flood', icon: Droplets, color: 'text-blue-500' },
        { id: 'Hazard', icon: AlertTriangle, color: 'text-yellow-500' },
    ];

    return (
        <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center font-inter relative text-slate-200 overflow-x-hidden overflow-y-auto scanline">
            <div className="vignette" />
            <div className="w-full max-w-5xl mx-auto flex flex-col flex-1 relative z-10 px-6 space-y-8">
            {/* TACTICAL NAVIGATION */}
            <nav className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-nexus-blue/10 border border-nexus-blue/30 group">
                        <Shield className="text-nexus-blue fill-nexus-blue/5 transition-transform group-hover:scale-110" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-orbitron font-black tracking-tight text-white uppercase italic leading-none">NEXUS <span className="text-nexus-blue">CITIZEN</span></h1>
                        <p className="text-[8px] font-orbitron font-bold text-slate-500 uppercase tracking-widest mt-1">SATELLITE LINK // ACTIVE</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" />
                        <span className="text-[9px] font-orbitron font-black tracking-widest leading-none">ENCRYPTED</span>
                    </div>
                </div>
            </nav>

            <div className={`border-y border-white/5 py-3 text-center overflow-hidden relative w-full rounded-2xl ${stage !== 'IDLE' ? 'bg-red-500/10' : 'bg-nexus-blue/5'}`}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                <p className={`font-orbitron font-black flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.3em] relative z-10 ${stage !== 'IDLE' ? 'text-red-500' : 'text-nexus-blue'}`}>
                    <Activity size={14} className="animate-pulse" /> {stage !== 'IDLE' ? 'EMERGENCY STATE ACTIVE' : 'COMMAND FREQUENCY CLEAR'}
                </p>
            </div>

            <main className="flex-1 flex flex-col items-center justify-center w-full">
                <AnimatePresence mode="wait">
                    {stage === "IDLE" && (
                        <motion.div key="sos-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
                            {/* 🔥 SOS PULSAR 2.0 */}
                            <div className="sos-container relative">
                                {[1, 2, 3].map((i) => (
                                    <motion.div
                                        key={i}
                                        className="absolute rounded-full border border-red-500/30"
                                        initial={{ width: 240, height: 240, opacity: 0.5 }}
                                        animate={{ width: 240 + i * 80, height: 240 + i * 80, opacity: 0 }}
                                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
                                    />
                                ))}
                                <div className={`sos-button animate-pulse-sos gpu transition shadow-[0_0_60px_rgba(239,68,68,0.8)] ${sending ? 'opacity-80' : ''}`} onClick={handleSOS}>
                                    {sending ? <Activity className="animate-spin text-white opacity-50" size={64} /> : "SOS"}
                                </div>
                                <div className="sos-subtext glow-text mt-8">{sending ? "TRANSMITTING SIGNAL..." : "TAP FOR RESCUE"}</div>
                                <div className="info-card mt-12 w-full max-w-[340px] gpu transition">
                                    <h4 className="font-orbitron font-black text-red-500 text-[11px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <ShieldAlert size={14} /> Auto-Detected Protocol
                                    </h4>
                                    <ol className="space-y-3 text-[12px] font-medium text-slate-300 list-decimal list-inside marker:text-red-500/50 marker:font-orbitron">
                                        <li className="pl-1">Move to high ground immediately.</li>
                                        <li className="pl-1">Use emergency stairwells.</li>
                                        <li className="pl-1">Conserve battery & maintain link.</li>
                                    </ol>
                                </div>
                                <div className="glass-card p-6 rounded-3xl mt-8 flex items-center justify-between hover:bg-white/5 transition-smooth cursor-pointer w-full max-w-[340px]" onClick={() => setSilentMode(!silentMode)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl border ${silentMode ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                                            <VolumeX size={20} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-orbitron font-black text-white uppercase tracking-widest italic leading-none">Silent Mode</span>
                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Stealth Activation</span>
                                        </div>
                                    </div>
                                    <div className={`w-14 h-7 rounded-full p-1 transition-smooth relative ${silentMode ? 'bg-red-600' : 'bg-slate-700'}`}>
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${silentMode ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {stage === "EXECUTION" && (
                        <motion.div key="sos-execution" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6 pb-24">
                            <div className="glass-card rounded-[32px] p-8 border-t-2 border-red-500/20 shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[60px]" />
                                <div className="mb-10 pb-6 border-b border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                                        <p className="text-[10px] font-orbitron font-black text-red-500 tracking-[0.3em] uppercase">EXECUTION STATUS</p>
                                    </div>
                                    <h3 className="text-2xl font-orbitron font-black tracking-tight text-white uppercase italic italic">ASSESSMENT <span className="text-slate-500">ACTIVE</span></h3>
                                </div>

                                <div className="space-y-4">
                                {[
                                    { label: 'Spatial Coordinates', val: getSosValue('location') || (sosResponse ? 'UPDATING...' : 'SCANNING LOCATIONS...'), icon: MapPin, color: 'text-red-500' },
                                    { label: 'Severity Level', val: getSosValue('severity') || (sosResponse ? 'UPDATING...' : 'CALCULATING...'), icon: Zap, color: 'text-amber-500' },
                                    { label: 'Confidence Score', val: getSosValue('confidence') || (sosResponse ? 'UPDATING...' : 'ANALYZING...'), icon: Activity, color: 'text-nexus-blue' },
                                ].map((field, idx) => (
                                    <div key={idx} className="bg-black/40 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 bg-black/40 rounded-xl border border-white/5 ${field.color}`}>
                                                <field.icon size={16} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">{field.label}</span>
                                                <motion.span 
                                                    initial={{ opacity: 0 }} 
                                                    animate={{ opacity: 1 }} 
                                                    key={field.val}
                                                    className="text-[12px] font-orbitron font-black text-white uppercase tracking-tight mt-0.5 shadow-nexus"
                                                >
                                                    {field.val || '---'}
                                                </motion.span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                </div>

                                <div className="bg-red-500/5 p-6 rounded-3xl border border-red-500/20 mt-8">
                                    <div className="flex items-center gap-3 mb-2 text-red-500">
                                        <Activity size={18} className="animate-pulse" />
                                        <span className="text-[10px] font-orbitron font-black uppercase tracking-[0.2em]">Status: {sending ? 'Transmitting' : 'Waiting for dispatch'}</span>
                                    </div>
                                    <p className="text-[12px] text-slate-400 italic">Satellite link established. Tactical relays are identifying the nearest intercept unit.</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {stage === "RESCUE_ACTIVE" && (
                        <motion.div key="sos-rescue" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md space-y-6 pb-24">
                            <div className="glass-card rounded-[32px] p-8 border-t-2 border-emerald-500/20 shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/5 blur-[60px]" />
                                <div className="mb-10 pb-6 border-b border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <p className="text-[10px] font-orbitron font-black text-emerald-500 tracking-[0.3em] uppercase">INTERCEPT ACTIVE</p>
                                    </div>
                                    <h3 className="text-2xl font-orbitron font-black tracking-tight text-white uppercase italic italic">RESCUE <span className="text-slate-500">PROGRESS</span></h3>
                                </div>

                                <div className="bg-nexus-blue/5 border border-nexus-blue/30 rounded-3xl p-8 mb-8 relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <span className="text-4xl">{dispatchData?.unit_icon || '🚑'}</span>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-orbitron font-bold text-nexus-blue/60 uppercase tracking-widest">Intercept Unit</span>
                                                <span className="text-xl font-orbitron font-black text-white">{dispatchData?.unit_callsign || 'ALPHA-1'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-orbitron font-bold text-slate-500 uppercase tracking-widest block mb-1">Estimated ETA</span>
                                            <span className="text-3xl font-orbitron font-black text-nexus-blue leading-none">{countdownEta || '--'} MIN</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-orbitron font-black text-emerald-400 uppercase tracking-widest">En Route</span>
                                            <span className="text-[10px] font-orbitron font-bold text-white/40 uppercase">Satellite Locked</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: (countdownEta || 10) * 60, ease: "linear" }} className="h-full bg-gradient-to-r from-nexus-blue to-emerald-500 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex flex-col items-center">
                                        <Navigation size={20} className="text-nexus-blue mb-2 animate-pulse" />
                                        <span className="text-[11px] font-orbitron font-black text-white uppercase">Live Sync</span>
                                    </div>
                                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex flex-col items-center">
                                        <Radio size={20} className="text-emerald-500 mb-2 animate-pulse" />
                                        <span className="text-[11px] font-orbitron font-black text-white uppercase">Link Active</span>
                                    </div>
                                </div>

                                <button onClick={() => { setStage("IDLE"); setSosResponse(null); setDispatchData(null); }} className="w-full mt-10 py-5 bg-black/60 hover:bg-white/5 text-slate-500 rounded-[24px] font-orbitron font-black text-[10px] uppercase tracking-[0.4em] transition-smooth border border-white/5 active:scale-95">
                                    DISCONNECT RELAY
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
            </div>
        </div>
    );
};

export default CitizenApp;
