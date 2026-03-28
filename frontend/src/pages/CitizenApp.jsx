import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, MapPin, Activity, Radio, VolumeX, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '../components/useToast';
import { config } from '../config/env';

const CitizenApp = () => {
    const MotionButton = motion.button;
    const MotionDiv = motion.div;
    const [sending, setSending] = useState(false);
    const [silentMode, setSilentMode] = useState(false);
    const [sosResponse, setSosResponse] = useState(null);
    const [backendOnline, setBackendOnline] = useState(false);
    const [systemStatus, setSystemStatus] = useState("unknown");
    const [wasOffline, setWasOffline] = useState(false);
    const [dispatchInfo, setDispatchInfo] = useState(null);
    const { addToast } = useToast();

    const flushSOSQueue = useCallback(() => {
        const queue = JSON.parse(localStorage.getItem('nexus_sos_queue') || '[]');
        if (queue.length === 0) return;

        addToast(`Sending ${queue.length} queued SOS requests...`, "info");

        let successCount = 0;
        Promise.all(queue.map(payload => {
            return fetch(`${config.API_URL}/ingestion/sos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => {
                if(res.ok) successCount++;
            }).catch(() => {});
        })).then(() => {
            if (successCount > 0) {
                addToast(`Successfully sent ${successCount} queued SOS requests.`, "success", 8000);
            }
            localStorage.setItem('nexus_sos_queue', '[]');
        });
    }, [addToast]);

    // WebSocket Listener for Real-time Dispatch Updates
    useEffect(() => {
        let ws;
        const connectWS = () => {
            console.log("[NEXUS] Connecting to Mission Control WS:", config.WS_URL);
            ws = new WebSocket(config.WS_URL);
            
            ws.onopen = () => {
                console.log("[OK] Connected to NEXUS Mission Control.");
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log("[DATA] Received WS Event:", msg.type, msg.data);
                    
                    if (msg.type === "UNIT_DISPATCHED") {
                        // In a real app, check if msg.data.event_id matches our sosResponse.id
                        setDispatchInfo(msg.data);
                        addToast(`🚨 ${msg.data.status}: ${msg.data.unit_type} arriving in ~${msg.data.eta_mins}m`, "info", 10000);
                    }
                } catch (err) {
                    console.error("[ERROR] WS Parse Error", err);
                }
            };

            ws.onerror = (err) => {
                console.error("[ERROR] WebSocket connection failed:", err);
            };

            ws.onclose = () => {
                console.warn("[WARN] WS Disconnected. Retrying in 5s...");
                setTimeout(connectWS, 5000); // Reconnect loop
            };
        };

        if (backendOnline) connectWS();
        return () => { if (ws) ws.close(); };
    }, [backendOnline, addToast]);

    useEffect(() => {
        let isMounted = true;
        let timer;
        let failCount = 0;

        const checkHealth = async () => {
            try {
                const res = await fetch(`${config.API_URL}/health`);
                const data = await res.json();

                if (!isMounted) return;

                setBackendOnline(data.status === "healthy");
                setSystemStatus(data.status); // New state for deep health
                
                if (data.status === "healthy") {
                    failCount = 0;
                } else {
                    failCount++;
                }
            } catch {
                if (!isMounted) return;
                setBackendOnline(false);
                setSystemStatus("down");
                failCount++;
            }

            // True exponential backoff: 5s, 10s, 20s, 30s
            const nextInterval = Math.min(5000 * Math.pow(2, failCount), 30000);
            timer = setTimeout(checkHealth, nextInterval);
        };

        checkHealth();

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        if (!backendOnline) {
            if (!wasOffline) setWasOffline(true);
        } else if (backendOnline && wasOffline) {
            addToast("Connection restored. System back online.", "success");
            setWasOffline(false);
            flushSOSQueue(); // Flush queue as soon as API is back
        }
    }, [addToast, backendOnline, wasOffline, flushSOSQueue]);


    useEffect(() => {
        if (navigator.onLine) flushSOSQueue();
        window.addEventListener('online', flushSOSQueue);
        return () => window.removeEventListener('online', flushSOSQueue);
    }, [flushSOSQueue]);

    const processSOS = (payload, isSilent) => {
        if (!navigator.onLine) {
            const queue = JSON.parse(localStorage.getItem('nexus_sos_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('nexus_sos_queue', JSON.stringify(queue));
            if (!isSilent) addToast("SOS Queued. Will transmit when network returns.", "error", 8000);
            setSending(false);
            if (isSilent && navigator.vibrate) navigator.vibrate(200);
            return;
        }

        fetch(`${config.API_URL}/ingestion/sos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 500) {
                    addToast(`SERVER ERROR: ${data.detail || "Persistence failed"}. SOS queued locally.`, "error", 10000);
                }
                throw new Error(data.detail || "SOS Failed");
            }
            return data;
        })
        .then(data => {
            setSending(false);
            if (!isSilent) {
                setSosResponse(data);
                const toastType = data.severity === 'CRITICAL' ? 'error' : (data.severity === 'MEDIUM' ? 'warning' : 'success');
                addToast(data.status_message || "Rescue Request Received.", toastType, 5000);
            }
            if (isSilent && navigator.vibrate) navigator.vibrate(200);
        })
        .catch((err) => {
            setSending(false);
            const queue = JSON.parse(localStorage.getItem('nexus_sos_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('nexus_sos_queue', JSON.stringify(queue));
            
            const errorMsg = err.message === "Failed to fetch" 
                ? "NO NETWORK: SOS secured in storage for auto-transmission."
                : `SYSTEM ERROR: ${err.message}. Queued locally.`;
                
            if (!isSilent) addToast(errorMsg, "warning", 8000);
            if (isSilent && navigator.vibrate) navigator.vibrate(200);
        });
    };

    const playSOSBeep = () => {
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
    };

    const handleSOS = () => {
        setSending(true);
        playSOSBeep();
        setTimeout(() => {
            const mockLat = 13.63 + (Math.random() - 0.5) * 0.1;
            const mockLng = 79.42 + (Math.random() - 0.5) * 0.1;
            processSOS({
                lat: mockLat,
                lng: mockLng,
                description: "Emergency activated via Citizen App SOS",
                device_id: "DEVICE-APP-998"
            }, false);
        }, 1500);
    };

    const getSeverityConfig = (sev) => {
        switch(sev) {
            case 'CRITICAL': return { color: '#ef4444', label: 'Critical', icon: ShieldAlert, tone: 'Action (Help coming)' };
            case 'MEDIUM': return { color: '#f97316', label: 'Medium', icon: AlertTriangle, tone: 'Monitoring' };
            case 'LOW': return { color: '#22c55e', label: 'Low', icon: CheckCircle2, tone: 'Safe' };
            default: return { color: '#94a3b8', label: 'Undefined', icon: Info, tone: 'Evaluating' };
        }
    };

    return (
        <div className="h-screen w-full bg-slate-950 flex flex-col font-sans relative text-slate-200 overflow-hidden">
            {/* Header */}
            <header className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur justify-between flex items-center z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="text-red-500" size={24} />
                    <h1 className="text-xl font-bold tracking-tight text-white">NEXUS Citizen</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${backendOnline ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20' : 'text-red-400 bg-red-400/10 border-red-500/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                        API {backendOnline ? 'Online' : 'Offline'}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-500/20">
                        <Radio size={14} className="animate-pulse" /> Live
                    </div>
                </div>
            </header>

            {/* Alert Banner */}
            {systemStatus === "initializing" && (
                <div className="bg-amber-500/20 border-b border-amber-500/30 p-4 text-center z-10 animate-pulse">
                    <p className="text-amber-400 font-black flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                        <Activity size={16} /> 
                        DATABASE INITIALIZING... SYSTEM SYNCING
                    </p>
                </div>
            )}
            {!backendOnline && systemStatus !== "initializing" && (
                <div className="bg-red-500/20 border-b border-red-500/30 p-4 text-center z-10 animate-pulse">
                    <p className="text-red-400 font-black flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                        <AlertTriangle size={16} /> 
                        {navigator.onLine 
                            ? "RECONNECTING TO SERVER..." 
                            : "NO INTERNET CONNECTION"}
                    </p>
                </div>
            )}
            <div className="bg-red-500/10 border-b border-red-500/20 p-4 text-center z-10 shrink-0">
                <p className="text-red-400 font-semibold flex items-center justify-center gap-2 text-sm">
                    <Activity size={16} /> EMERGENCY STATE ACTIVE
                </p>
            </div>

            {/* Content */}
            <main className="flex-1 w-full overflow-y-auto flex flex-col items-center pt-8 pb-20 px-6 z-10 relative">
                <AnimatePresence mode="wait">
                    {!sosResponse ? (
                        <MotionDiv 
                            key="sos-trigger"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="flex flex-col items-center"
                        >
                            <p className="text-slate-400 text-center mb-8 max-w-xs text-sm">
                                Press and hold the SOS button below if you are in immediate danger. Your location will be auto-transmitted.
                            </p>

                            <div className="relative">
                                <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping blur-xl"></div>
                                <div className="absolute -inset-4 bg-red-500/10 rounded-full blur-2xl animate-pulse"></div>
                                <MotionButton
                                    whileTap={{ scale: 0.9 }}
                                    whileHover={{ scale: 1.05 }}
                                    onClick={handleSOS}
                                    disabled={sending}
                                    className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center gap-4 border-8 
                                                transition-all duration-300 shadow-[0_0_50px_rgba(239,68,68,0.4)]
                                                ${sending ? 'bg-red-800 border-red-900' : 'bg-red-600 hover:bg-red-500 border-red-700'} 
                                                text-white font-bold tracking-widest`}
                                >
                                    {sending ? <Activity className="animate-spin" size={64} /> : (
                                        <>
                                            <span className="text-6xl drop-shadow-md">SOS</span>
                                            <span className="text-xs font-medium tracking-tight bg-black/20 px-4 py-1.5 rounded-full uppercase">Tap for Rescue</span>
                                        </>
                                    )}
                                </MotionButton>
                            </div>
                        </MotionDiv>
                    ) : (
                        <MotionDiv 
                            key="sos-result"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-6"
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <h2 className="text-xl font-bold text-white">Execution Status</h2>
                                <div 
                                    className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                                    style={{ 
                                        backgroundColor: `${getSeverityConfig(sosResponse.severity).color}20`, 
                                        color: getSeverityConfig(sosResponse.severity).color, 
                                        border: `1px solid ${getSeverityConfig(sosResponse.severity).color}40` 
                                    }}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: getSeverityConfig(sosResponse.severity).color }}></div>
                                    {sosResponse.severity}
                                </div>
                            </div>

                            {/* Live Dispatch Feedback — TOP PRIORITY */}
                            {dispatchInfo && (
                                <MotionDiv 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-gradient-to-br from-blue-600/20 to-cyan-600/10 border border-blue-500/40 p-5 rounded-2xl flex flex-col gap-3 shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                                >
                                    <div className="flex items-center gap-2">
                                        <Radio size={16} className="text-blue-400 animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">RESCUE DETAILS ON THE WAY</span>
                                    </div>
                                    <p className="text-sm font-bold text-white leading-relaxed">
                                        {dispatchInfo.status}
                                    </p>
                                    <div className="flex items-center justify-between text-[11px] text-blue-200/80 font-medium bg-blue-500/10 p-3 rounded-xl">
                                        <span>Unit: <span className="text-white uppercase font-bold">{dispatchInfo.unit_icon || '🚑'} {dispatchInfo.unit_type}</span></span>
                                        <span>ETA: <span className="text-white font-bold text-base">{dispatchInfo.eta_mins} MIN</span></span>
                                    </div>
                                    <div className="w-full bg-blue-500/20 h-1.5 rounded-full overflow-hidden mt-1">
                                        <motion.div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" 
                                            initial={{ width: "0%" }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 15, repeat: Infinity }}
                                        />
                                    </div>
                                </MotionDiv>
                            )}

                            <div className="grid grid-cols-1 gap-4 text-sm">
                                <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                                    <MapPin size={20} className="text-cyan-400" />
                                    <div>
                                        <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">📍 Location</span>
                                        <span className="text-white font-mono">{sosResponse.location?.lat?.toFixed(2) || '0.00'}, {sosResponse.location?.lng?.toFixed(2) || '0.00'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                                    <ShieldAlert size={20} style={{ color: getSeverityConfig(sosResponse.severity).color }} />
                                    <div>
                                        <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">⚠️ Severity</span>
                                        <span className="font-bold uppercase" style={{ color: getSeverityConfig(sosResponse.severity).color }}>{sosResponse.severity || 'LOW'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                                    <Activity size={20} className="text-emerald-400" />
                                    <div>
                                        <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">📊 Confidence</span>
                                        <span className="text-white font-bold">{Math.round((sosResponse.confidence || 0) * 100)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/30 p-5 rounded-2xl border-l-4" style={{ borderColor: getSeverityConfig(sosResponse.severity).color }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] uppercase font-bold tracking-tighter" style={{ color: getSeverityConfig(sosResponse.severity).color }}>
                                        {sosResponse.severity === 'CRITICAL' ? '🔴' : (sosResponse.severity === 'MEDIUM' ? '🟠' : '🟢')} Status:
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-200">
                                    {dispatchInfo ? dispatchInfo.status : sosResponse.status_message}
                                </p>
                            </div>

                            <button onClick={() => { setSosResponse(null); setDispatchInfo(null); }} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors border border-slate-700">
                                Back to Control
                            </button>
                        </MotionDiv>
                    )}
                </AnimatePresence>

                {/* Shared Footer UI */}
                <div className="w-full max-w-sm mt-8 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <ShieldAlert size={16} className="text-amber-400" /> Auto-Detected Protocol
                        </h3>
                        <ul className="text-xs text-slate-300 space-y-2.5">
                            <li className="flex items-start gap-2"><span className="text-cyan-400 font-bold">1.</span> Move to high ground immediately.</li>
                            <li className="flex items-start gap-2"><span className="text-cyan-400 font-bold">2.</span> Use emergency stairwells. No elevators.</li>
                            <li className="flex items-start gap-2"><span className="text-cyan-400 font-bold">3.</span> Conserve battery. Use SMS over Voice.</li>
                        </ul>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <VolumeX className={silentMode ? "text-red-400" : "text-slate-500"} size={20} />
                            <div className="text-left">
                                <span className="text-sm font-bold block text-white">Silent Distress Mode</span>
                                <span className="text-[11px] text-slate-400 leading-tight">Triggers on 5x power presses or shake.</span>
                            </div>
                        </div>
                        <button onClick={() => setSilentMode(!silentMode)} className={`w-12 h-6 rounded-full transition-colors relative ${silentMode ? 'bg-red-500' : 'bg-slate-700'}`}>
                            <MotionDiv className="w-4 h-4 rounded-full bg-white absolute top-1" animate={{ left: silentMode ? '26px' : '4px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CitizenApp;
