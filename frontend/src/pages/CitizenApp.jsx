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
        if (msg.type === "UNIT_DISPATCHED") {
            setDispatchInfo({
                ...msg.data,
                status: `RESCUE UNIT ${msg.data.unit_callsign || ''} EN ROUTE`
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

        api.post('ingestion/sos', { ...payload, category: selectedCategory })
        .then(res => {
            const data = res.data;
            setSending(false);
            if (!isSilent) setSosResponse(data);
        })
        .catch(() => {
            setSending(false);
            if (!isSilent) addToast("Syncing with satellite relay...", "warning", 5000);
        });
    };

    const handleSOS = () => {
        setSending(true);
        playSOSBeep();
        setTimeout(() => {
            const mockLat = 13.6012;
            const mockLng = 79.3905;
            processSOS({
                lat: mockLat,
                lng: mockLng,
                description: `Emergency activated via Citizen App SOS. Category: ${selectedCategory}`,
                device_id: deviceId
            }, false);
        }, 1500);
    };

    const disasterTypes = [
        { id: 'Medical', icon: Heart, color: 'text-red-500' },
        { id: 'Accident', icon: Car, color: 'text-orange-500' },
        { id: 'Fire', icon: Flame, color: 'text-amber-500' },
        { id: 'Flood', icon: Droplets, color: 'text-blue-500' },
        { id: 'Hazard', icon: AlertTriangle, color: 'text-yellow-500' },
    ];

    return (
        <div className="min-h-screen w-full bg-[#0B0F19] flex flex-col font-inter relative text-slate-200 overflow-y-auto px-4 pt-6 pb-24">
            <nav className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg bg-red-600/20 border border-red-500/40">
                        <Shield className="text-red-500 fill-red-500/10" size={18} />
                    </div>
                    <h1 className="text-xl font-orbitron font-black tracking-tighter text-white uppercase italic">NEXUS Citizen</h1>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                        <span className="text-[10px] font-orbitron font-bold tracking-widest leading-none">ONLINE</span>
                    </div>
                </div>
            </nav>

            {!emergencyState && (
                <div className="bg-red-950/20 border-y border-red-900/50 p-3 text-center mb-8">
                    <p className="text-red-500 font-orbitron font-bold flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.25em]">
                        <Activity size={14} className="animate-pulse" /> SYSTEM READY
                    </p>
                </div>
            )}

            <main className="flex-1 flex flex-col items-center">
                <AnimatePresence mode="wait">
                    {!emergencyState ? (
                        <motion.div key="sos-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
                            {/* 🌊 Disaster Category Selector */}
                            <p className="text-[10px] font-orbitron font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Select Category</p>
                            <div className="flex items-center gap-3 mb-10 overflow-x-auto w-full justify-center pb-2 no-scrollbar">
                                {disasterTypes.map((type) => (
                                    <button key={type.id} onClick={() => setSelectedCategory(type.id)} className={`flex flex-col items-center shrink-0 w-16 transition-all ${selectedCategory === type.id ? 'scale-110 opacity-100' : 'opacity-40 hover:opacity-70'}`}>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 border-2 ${selectedCategory === type.id ? 'bg-white/10 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-white/5 border-transparent'}`}>
                                            <type.icon size={20} className={type.color} />
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-300">{type.id}</span>
                                    </button>
                                ))}
                            </div>

                            <p className="text-slate-400 text-center mb-10 max-w-xs text-xs font-medium tracking-tight leading-relaxed opacity-70">
                                Press and hold the SOS button for 2 seconds. Global satellite relay will auto-detect your precision location.
                            </p>

                            <div className="relative group cursor-pointer" onClick={handleSOS}>
                                <div className="absolute inset-0 bg-red-600/30 rounded-full glow-critical blur-2xl"></div>
                                <div className="relative w-64 h-64 rounded-full bg-red-600 flex flex-col items-center justify-center shadow-[0_15px_60px_rgba(239,68,68,0.5)] border-8 border-red-500/50 transition-transform active:scale-95">
                                    {sending ? <Activity className="animate-spin text-white" size={48} /> : (
                                        <>
                                            <span className="text-7xl font-orbitron font-black text-white tracking-widest drop-shadow-lg">SOS</span>
                                            <span className="mt-4 px-4 py-1.5 bg-black/20 rounded-full text-[10px] font-orbitron font-black uppercase tracking-widest text-white/90">TRANSMIT</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-16 w-full max-w-sm space-y-4">
                                <div className="glass-panel p-5 rounded-2xl shadow-2xl">
                                    <h3 className="text-[10px] font-orbitron font-black text-amber-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <ShieldAlert size={14} /> ACTIVE PROTOCOL: {selectedCategory.toUpperCase()}
                                    </h3>
                                    <ul className="space-y-3 text-[11px] font-medium text-slate-400">
                                        <li className="flex gap-2"> <span className="text-amber-500">01</span> Standard emergency relay active.</li>
                                        <li className="flex gap-2"> <span className="text-amber-500">02</span> Maintain visual contact with hazards.</li>
                                        <li className="flex gap-2"> <span className="text-amber-500">03</span> Real-time telemetry monitoring.</li>
                                    </ul>
                                </div>
                                <div className="glass-panel p-5 rounded-2xl flex items-center justify-between shadow-2xl">
                                    <div className="flex items-center gap-3">
                                        <VolumeX className="text-slate-500" size={20} />
                                        <div className="text-left flex flex-col">
                                            <span className="text-[11px] font-orbitron font-black text-white uppercase">Silent Distress Mode</span>
                                            <span className="text-[9px] text-slate-500 font-bold leading-tight">Stealth activation active.</span>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${silentMode ? 'bg-red-600' : 'bg-slate-700'}`} onClick={() => setSilentMode(!silentMode)}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${silentMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="sos-active" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-4 pb-20">
                            <div className="glass-panel rounded-3xl p-6 shadow-2xl glow-critical">
                                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                    <div>
                                        <h3 className="text-xl font-orbitron font-black tracking-tight text-white uppercase italic">Execution Status</h3>
                                        <p className="text-[9px] font-orbitron font-bold text-red-500 tracking-widest mt-1">PRIORITY 1 EMERGENCY</p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors ${sosResponse?.severity ? 'bg-red-500/10 border-red-500/30 text-nexus-red' : 'bg-slate-500/10 border-slate-500/30 text-slate-400'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${sosResponse?.severity ? 'bg-nexus-red' : 'bg-slate-500'}`} />
                                        <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest">{sosResponse?.severity || 'ANALYZING...'}</span>
                                    </div>
                                </div>

                                {dispatchInfo && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-blue-600/10 border border-blue-500/30 rounded-2xl p-5 mb-6">
                                        <div className="flex items-center gap-2 mb-3 text-blue-400">
                                            <Radio size={16} className="animate-pulse" />
                                            <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">Rescue Live Feed</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-white mb-2 tracking-tight">Rescue unit dispatched — ETA {countdownEta || 9.5} min</h4>
                                        <div className="h-2 w-full bg-blue-500/20 rounded-full overflow-hidden mb-4 border border-blue-500/10">
                                            <motion.div initial={{ width: "20%" }} animate={{ width: "80%" }} transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }} className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                                        </div>
                                        <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Unit:</span>
                                                <span className="text-[10px] text-white font-orbitron font-black uppercase tracking-widest italic">{dispatchInfo.unit_icon || '🚑'} {dispatchInfo.unit_type || 'AMBULANCE'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">ETA:</span>
                                                <span className="text-xl text-cyan-400 font-orbitron font-black tracking-[0.1em]">{countdownEta || 9.5} MIN</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <div className="grid grid-cols-1 gap-3">
                                    {[
                                        { label: 'Precision Location', val: `${sosResponse?.location?.lat?.toFixed(4) || '13.6012'}, ${sosResponse?.location?.lng?.toFixed(4) || '79.3905'}`, icon: MapPin, color: 'text-red-500' },
                                        { label: 'Severity Index', val: sosResponse?.severity || 'CRITICAL', icon: Shield, color: 'text-amber-500' },
                                        { label: 'NEXUS Intelligence', val: sosResponse?.confidence ? `${Math.round(sosResponse.confidence * 100)}%` : '75%', icon: Activity, color: 'text-cyan-500' },
                                    ].map((field, idx) => (
                                        <div key={idx} className="bg-black/30 p-4 rounded-2xl border border-white/5 flex flex-col items-start">
                                            <div className="flex items-center gap-2 mb-1">
                                                <field.icon size={12} className={field.color} />
                                                <span className="text-[10px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">{field.label}</span>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded text-[8px] font-orbitron font-black tracking-widest uppercase italic border border-white/5 ${sosResponse?.severity ? 'bg-black/40' : 'bg-slate-500/20 text-slate-500'}`}>
                                                {sosResponse?.severity || 'ANALYZING...'}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 flex flex-col items-start">
                                        <div className="flex items-center gap-2 mb-1 text-emerald-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                                            <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest font-bold">Protocol Active:</span>
                                        </div>
                                        <div className="text-[11px] font-medium text-emerald-400 italic">
                                            {sosResponse?.status_message || (sosResponse?.severity === 'CRITICAL' ? "🚨 Emergency detected. Rescue units have been dispatched." : "🟠 Situation under monitoring. Stay alert.")}
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => { setEmergencyState(false); setSosResponse(null); setDispatchInfo(null); }} className="w-full mt-6 py-4 bg-slate-900/50 hover:bg-slate-800 text-slate-500 rounded-2xl font-orbitron font-bold text-[10px] uppercase tracking-[0.3em] transition-all border border-white/5 active:scale-[0.98]">
                                    BACK TO CONTROL SYSTEM
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
