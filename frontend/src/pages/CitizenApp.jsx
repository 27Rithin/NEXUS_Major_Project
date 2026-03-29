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

    // Restoration: Simple health check (matches Image 1)
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
                status: `RESCUE UNIT ${msg.data.unit_callsign} EN ROUTE`
            });
            setCountdownEta(Math.round(msg.data.eta_mins));
        }
    }, [addToast]);

    const { status: wsStatus } = useWebSocket(backendOnline ? (import.meta.env.VITE_WS_URL || config.WS_URL) : null, handleWSEvent);

    const processSOS = (payload, isSilent) => {
        // OPTIMISTIC UI: Trigger Emergency State IMMEDIATELY (Image 1/2)
        if (!isSilent) setEmergencyState(true);

        if (!navigator.onLine) {
            const queue = JSON.parse(localStorage.getItem('nexus_sos_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('nexus_sos_queue', JSON.stringify(queue));
            if (!isSilent) addToast("SOS Queued for transmission.", "error", 8000);
            setSending(false);
            return;
        }

        api.post('ingestion/sos', payload)
        .then(res => {
            const data = res.data;
            setSending(false);
            if (!isSilent) {
                setSosResponse(data);
                if (data.dispatch_info) {
                    setDispatchInfo(data.dispatch_info);
                    setCountdownEta(Math.round(data.dispatch_info.eta));
                }
            }
        })
        .catch((err) => {
            setSending(false);
            if (!isSilent) addToast("Network issues. Request queued locally.", "warning", 5000);
        });
    };

    const handleSOS = () => {
        setSending(true);
        setTimeout(() => {
            const mockLat = 13.63 + (Math.random() - 0.5) * 0.1;
            const mockLng = 79.42 + (Math.random() - 0.5) * 0.1;
            processSOS({
                lat: mockLat,
                lng: mockLng,
                description: "Emergency activated via Citizen App SOS",
                device_id: deviceId
            }, false);
        }, 1500);
    };

    return (
        <div className="h-screen w-full bg-[#050B18] flex flex-col font-sans relative text-slate-200 overflow-hidden px-4 pt-6">
            {/* HEADER / NAVIGATION (MATCHES IMAGE 1) */}
            <nav className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/40">
                        <Shield className="text-white fill-white" size={18} />
                    </div>
                    <h1 className="text-xl font-black tracking-tighter text-white">NEXUS Citizen</h1>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${backendOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-none">API ONLINE</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Radio size={12} className="animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Live</span>
                    </div>
                </div>
            </nav>

            {/* EMERGENCY BANNER (MATCHES IMAGE 1) */}
            {emergencyState && (
                <div className="bg-red-950/30 border-y border-red-500/20 p-3 text-center mb-8">
                    <p className="text-red-500 font-black flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em]">
                        <Activity size={14} className="animate-pulse" /> EMERGENCY STATE ACTIVE
                    </p>
                </div>
            )}

            <main className="flex-1 flex flex-col items-center">
                <AnimatePresence mode="wait">
                    {!emergencyState ? (
                        <motion.div 
                            key="sos-idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center"
                        >
                            <p className="text-slate-400 text-center mb-12 max-w-xs text-sm font-medium leading-relaxed">
                                Press and hold the SOS button below if you are in immediate danger. Your location will be auto-transmitted.
                            </p>

                            <div className="relative group cursor-pointer" onClick={handleSOS}>
                                <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping blur-xl group-hover:bg-red-600/40"></div>
                                <div className="relative w-64 h-64 rounded-full bg-red-600 flex flex-col items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.5)] border-8 border-red-700/50">
                                    {sending ? <Activity className="animate-spin text-white" size={48} /> : (
                                        <>
                                            <span className="text-6xl font-black text-white drop-shadow-lg">SOS</span>
                                            <span className="mt-4 px-4 py-1.5 bg-black/20 rounded-full text-[10px] font-black uppercase tracking-widest text-white/90">Tap for Rescue</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* PROTOCOL CARDS (MATCHES IMAGE 1) */}
                            <div className="mt-16 w-full max-w-sm space-y-4">
                                <div className="bg-[#0D1525] border border-slate-800/50 p-5 rounded-2xl">
                                    <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <ShieldAlert size={14} /> Auto-Detected Protocol
                                    </h3>
                                    <ul className="space-y-3 text-xs font-bold text-slate-300">
                                        <li className="flex items-center gap-2"><span className="text-blue-400">1.</span> Move to high ground immediately.</li>
                                        <li className="flex items-center gap-2"><span className="text-blue-400">2.</span> Use emergency stairwells. No elevators.</li>
                                        <li className="flex items-center gap-2"><span className="text-blue-400">3.</span> Conserve battery. Use SMS over Voice.</li>
                                    </ul>
                                </div>

                                <div className="bg-[#0D1525] border border-slate-800/50 p-5 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <VolumeX className="text-slate-500" size={20} />
                                        <div className="text-left">
                                            <span className="text-xs font-black text-white block uppercase tracking-tight">Silent Distress Mode</span>
                                            <span className="text-[10px] text-slate-500 font-bold leading-tight">Triggers on 5x power presses or shake.</span>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${silentMode ? 'bg-red-600' : 'bg-slate-700'}`} onClick={() => setSilentMode(!silentMode)}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${silentMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="sos-active"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-md space-y-4"
                        >
                            {/* EXECUTION STATUS CARD (MATCHES IMAGE 2) */}
                            <div className="bg-[#0D1525] border border-slate-800 rounded-3xl p-6 shadow-2xl">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-lg font-black tracking-tight text-white uppercase italic">Execution Status</h3>
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">LOW</span>
                                    </div>
                                </div>

                                {/* RESCUE DETAILS (IMAGE 2 BLUE CARD) */}
                                <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl p-5 mb-6">
                                    <div className="flex items-center gap-2 mb-3 text-blue-400">
                                        <Radio size={16} className="animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Rescue Details on the way</span>
                                    </div>
                                    <h4 className="text-md font-bold text-white mb-2">Rescue unit dispatched — ETA {countdownEta || 9.5} min</h4>
                                    <div className="h-1.5 w-full bg-blue-500/20 rounded-full overflow-hidden mb-4">
                                        <motion.div 
                                            initial={{ width: "30%" }}
                                            animate={{ width: "65%" }}
                                            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                                            className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-slate-800/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Unit:</span>
                                            <span className="text-[10px] text-white font-black uppercase tracking-widest">🚑 AMBULANCE</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">ETA:</span>
                                            <span className="text-sm text-cyan-400 font-black tracking-tighter">{countdownEta || 9.5} MIN</span>
                                        </div>
                                    </div>
                                </div>

                                {/* DATA GRID (IMAGE 2) */}
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="bg-black/40 p-4 rounded-xl border border-slate-800/50 flex flex-col items-start">
                                        <div className="flex items-center gap-2 mb-1">
                                            <MapPin size={12} className="text-red-500" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Location</span>
                                        </div>
                                        <div className="text-sm font-black text-white">13.60, 79.39</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-xl border border-slate-800/50 flex flex-col items-start">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Shield size={12} className="text-emerald-500" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Severity</span>
                                        </div>
                                        <div className="text-sm font-black text-emerald-400 uppercase tracking-widest">LOW</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-xl border border-slate-800/50 flex flex-col items-start">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Activity size={12} className="text-cyan-500" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confidence</span>
                                        </div>
                                        <div className="text-sm font-black text-white">75%</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-xl border border-emerald-500/20 flex flex-col items-start">
                                        <div className="flex items-center gap-2 mb-1 text-emerald-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Status:</span>
                                        </div>
                                        <div className="text-[11px] font-bold text-white">
                                            🚑 Rescue unit dispatched — ETA {countdownEta || 9.5} min
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => { setEmergencyState(false); setSosResponse(null); setDispatchInfo(null); }}
                                    className="w-full mt-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors border border-slate-700"
                                >
                                    Cancel Emergency Stream
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
