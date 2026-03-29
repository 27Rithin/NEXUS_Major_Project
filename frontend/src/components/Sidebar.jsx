import React, { useState, useEffect, useMemo, memo } from 'react';
import { AlertTriangle, Crosshair, Map as MapIcon, ShieldAlert, Loader2, CheckCircle2, Clock, Navigation, Filter, BarChart2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DisasterTypeConfig } from '../config/disasterTypes';
import { config } from '../config/env';
import { useToast } from './useToast';
import { useWebSocket } from '../hooks/useWebSocket';

const Sidebar = memo(function Sidebar({
    events,
    setEvents,
    setWsStatus,
    selectedEvent,
    setSelectedEvent,
    onDispatch,
    onSuggestDispatch,
    onClearRoute,
    onTriggerAI,
    userRole,
    activeRoute
}) {
    const MotionDiv = motion.div;
    void MotionDiv;

    const { addToast } = useToast();
    const [selectedUnit, setSelectedUnit] = useState('Ambulance');
    const [dispatchStatus, setDispatchStatus] = useState({}); // tracking per event
    const [filterCategory, setFilterCategory] = useState('All');
    const [pendingDispatch, setPendingDispatch] = useState({});
    const [sortMode, setSortMode] = useState('Priority');

    const [now, setNow] = useState(() => Date.now());

    const handleWSMessage = useCallback((message) => {
        if (message.type === 'new_incident') {
            const newEvent = message.data;
            const isSOS = newEvent.category === 'SOS';
            const isSimulated = newEvent.title?.startsWith('Simulated:');
            
            if (!isSimulated) {
                addToast(
                    `NEW ${isSOS ? 'SOS' : 'INCIDENT'}: ${newEvent.title || 'Emergency Signal'}`,
                    isSOS ? "error" : "success",
                    isSOS ? 15000 : 5000
                );
            }

            setEvents((prev) => {
                if (prev.find(e => e.id === newEvent.id)) return prev;
                return [newEvent, ...prev];
            });

            if (isSOS) {
                setFilterCategory('All');
                setSelectedEvent(newEvent);
                const header = document.querySelector('.telemetry-header');
                if (header) {
                    header.classList.add('animate-pulse', 'bg-red-500/20');
                    setTimeout(() => header.classList.remove('animate-pulse', 'bg-red-500/20'), 3000);
                }
            }
        }
    }, [addToast, setEvents, setSelectedEvent]);

    const { status: wsStatusVal } = useWebSocket(import.meta.env.VITE_WS_URL || config.WS_URL, handleWSMessage);

    useEffect(() => {
        if (setWsStatus) setWsStatus(wsStatusVal);
    }, [wsStatusVal, setWsStatus]);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 10_000);
        return () => clearInterval(id);
    }, []);

    // State for override coordinates
    const [overrideCoords, setOverrideCoords] = useState({});
    const [overrideErrors, setOverrideErrors] = useState({});

    // Extract unique categories from current events for filter buttons
    const eventList = useMemo(() => (Array.isArray(events) ? events : []), [events]);
    const availableCategories = useMemo(() => {
        const cats = new Set(eventList.filter(e => e && e.category).map(e => e.category));
        return ['All', ...Array.from(cats)].sort();
    }, [eventList]);

    // Apply filter and sort events
    const filteredAndSortedEvents = useMemo(() => {
        let filtered = eventList.filter(e => e !== null);
        if (filterCategory !== 'All') {
            filtered = filtered.filter(e => e.category === filterCategory);
        }
            return [...filtered].sort((a, b) => {
                // RULE 1: Pending SOS events ALWAYS at the very top
                const aIsSosPending = a.category === 'SOS' && a.status === 'Pending';
                const bIsSosPending = b.category === 'SOS' && b.status === 'Pending';
                if (aIsSosPending && !bIsSosPending) return -1;
                if (!aIsSosPending && bIsSosPending) return 1;

                if (sortMode === 'Priority') return (b.priority_score || 0) - (a.priority_score || 0);
                if (sortMode === 'Severity') {
                    const sMap = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
                    return (sMap[b.severity_level] || 0) - (sMap[a.severity_level] || 0);
                }
                if (sortMode === 'Newest') {
                    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return timeB - timeA;
                }
                return 0;
            }).slice(0, 50);
    }, [eventList, filterCategory, sortMode]);

    // Helper to extract coordinates from event securely
    const getEventCoords = (event) => {
        if (!event) return { lat: 0, lng: 0 };
        // Priority 1: Nested location object (current standard)
        if (event.location && (event.location.lat !== undefined || event.location.y !== undefined)) {
            return {
                lat: event.location.lat ?? event.location.y ?? 0,
                lng: event.location.lng ?? event.location.x ?? 0
            };
        }
        // Priority 2: Flat properties (legacy or mismatched payload)
        if (event.lat !== undefined && event.lng !== undefined) {
            return { lat: event.lat, lng: event.lng };
        }
        return { lat: 0, lng: 0 };
    };

    // Initialize or get override coords
    const getCoordsState = (event) => {
        if (overrideCoords[event.id]) return overrideCoords[event.id];
        return getEventCoords(event);
    };

    const handleCoordChange = (eventId, field, value) => {
        setOverrideCoords(prev => ({
            ...prev,
            [eventId]: {
                ...getCoordsState(eventList.find(e => e.id === eventId)),
                [field]: value
            }
        }));

        // Validation
        const numVal = parseFloat(value);
        let error = null;
        if (isNaN(numVal)) {
            error = "Invalid number";
        } else if (field === 'lat' && (numVal < -90 || numVal > 90)) {
            error = "Must be between -90 and 90";
        } else if (field === 'lng' && (numVal < -180 || numVal > 180)) {
            error = "Must be between -180 and 180";
        }

        setOverrideErrors(prev => ({
            ...prev,
            [eventId]: { ...prev[eventId], [field]: error }
        }));
    };

    const resetCoords = (event) => {
        setOverrideCoords(prev => {
            const next = { ...prev };
            delete next[event.id];
            return next;
        });
        setOverrideErrors(prev => {
            const next = { ...prev };
            delete next[event.id];
            return next;
        });
    };

    const handleDispatchClick = async (e, event, unit) => {
        e.stopPropagation();
        setDispatchStatus(prev => ({ ...prev, [event.id]: 'loading' }));
        try {
            const coords = getCoordsState(event);
            await onDispatch(event.id, unit, coords.lat, coords.lng);
            setDispatchStatus(prev => ({ ...prev, [event.id]: 'success' }));
            setTimeout(() => setDispatchStatus(prev => ({ ...prev, [event.id]: null })), 3000);
        } catch (err) {
            console.error(err);
            setDispatchStatus(prev => ({ ...prev, [event.id]: null }));
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
        exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
    };

    return (
        <div className="w-96 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex flex-col gap-3">
                <div className="flex items-center justify-between telemetry-header transition-colors duration-500 rounded-lg p-1">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-cyan-400" />
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            Active Telemetry
                            <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{eventList.length}</span>
                        </h3>
                    </div>
                </div>

                {/* Category Filters */}
                {availableCategories.length > 1 && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-700/50 mt-1">
                        {availableCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border transition-all ${filterCategory === cat
                                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                {cat} {cat !== 'All' && `(${eventList.filter(e => e && e.category === cat).length})`}
                            </button>
                        ))}
                    </div>
                )}

                {/* Sort Controls */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50 mt-2">
                    <span className="text-xs text-slate-400 font-medium">Sort by:</span>
                    {['Priority', 'Severity', 'Newest'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setSortMode(mode)}
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded transition-all ${sortMode === mode
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/50'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {filteredAndSortedEvents.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm text-center"
                    >
                        <MapIcon className="mb-2 opacity-50" size={24} />
                        <p>{eventList.length > 0 ? 'No incidents match this filter.' : 'Monitoring streams...\nAwaiting incident detection.'}</p>
                    </motion.div>
                ) : (
                    <motion.div
                        className="space-y-3"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        <AnimatePresence>
                            {filteredAndSortedEvents.map(event => {
                                const isSelected = selectedEvent?.id === event.id;
                                const score = event.priority_score || 0;
                                const severity = event.severity_level || 'LOW';
                                const isSOS = event.category === 'SOS';

                                // Color styling based on severity (Green, Yellow, Orange, Red)
                                let statusColor = "bg-green-500/10 text-green-400 border-green-500/20";
                                let badgePulse = "";
                                let glowEffect = "";

                                if (event.status === 'Resolved') {
                                    statusColor = "bg-green-500/10 text-green-400 border-green-500/20";
                                } else {
                                    if (isSOS || severity === 'CRITICAL') {
                                        statusColor = "bg-red-500/10 text-red-400 border-red-500/20";
                                        badgePulse = "animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                                        glowEffect = "shadow-[0_0_15px_rgba(239,68,68,0.3)]";
                                    } else if (severity === 'HIGH' || severity === 'MEDIUM') {
                                        statusColor = "bg-orange-500/10 text-orange-400 border-orange-500/20";
                                        glowEffect = "shadow-[0_0_10px_rgba(249,115,22,0.2)]";
                                    } else {
                                        statusColor = "bg-green-500/10 text-green-400 border-green-500/20";
                                        glowEffect = "shadow-[0_0_5px_rgba(34,197,94,0.1)]";
                                    }
                                }

                                const currentDispatchStatus = dispatchStatus[event.id];
                                const currentCoords = getCoordsState(event);

                                // Logic for "JUST IN" badge (within 60s of creation)
                                const isNew = event.created_at && (now - new Date(event.created_at).getTime() < 60000);

                                const currentErrors = overrideErrors[event.id] || {};
                                const hasErrors = !!currentErrors.lat || !!currentErrors.lng;

                                return (
                                    <motion.div
                                        key={event.id}
                                        layout
                                        initial="hidden"
                                        animate="show"
                                        exit="exit"
                                        variants={itemVariants}
                                        whileHover={!isSelected ? { scale: 1.01, backgroundColor: "rgba(30, 41, 59, 1)" } : {}}
                                        className={`rounded-xl border backdrop-blur-md bg-slate-800/80 transition-all duration-300 cursor-pointer overflow-hidden
                                            ${isSelected ? 'ring-2 ring-cyan-500 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : `border-slate-700/50 hover:border-slate-500/50 ${glowEffect}`}
                                            ${isSOS ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}
                                         `}
                                        onClick={() => setSelectedEvent(event)}
                                    >
                                        <div className="p-4 relative">
                                            {isNew && (
                                                <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg animate-bounce shadow-lg z-10">
                                                    JUST IN
                                                </div>
                                            )}
                                            
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col gap-1 max-w-[70%]">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-sm font-bold text-white leading-tight truncate">{event.title}</h4>
                                                        {isSOS && <span className="bg-red-500 text-[8px] text-white px-1.5 py-0.5 rounded font-black animate-pulse">SOS</span>}
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {formatTime(event.created_at)}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-semibold">
                                                            <MapPin size={10} />
                                                            {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${statusColor} ${badgePulse} tracking-tighter uppercase`}>
                                                        {severity}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed border-l-2 border-slate-700 pl-3">
                                                {event.description}
                                            </p>

                                            {isSOS && event.status_message && (
                                                <div className="mb-4 bg-red-500/10 border border-red-500/20 p-2 rounded text-[10px] text-red-300 font-medium leading-normal animate-pulse">
                                                    {event.status_message}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5 text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-slate-700/50">
                                                        <Crosshair size={12} className="text-cyan-400" />
                                                        PRIO: <span className="text-white">{score.toFixed(1)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-slate-700/50">
                                                        <BarChart2 size={12} className="text-indigo-400" />
                                                        CONF: <span className="text-white">{Math.round((event.confidence_score || 0) * 100)}%</span>
                                                    </div>
                                                </div>
                                                <div className="text-slate-500 px-2 py-1">
                                                    {event.category}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Dispatch Action Area */}
                                        <AnimatePresence>
                                            {isSelected && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="bg-slate-900/80 border-t border-slate-700/50 p-4"
                                                >
                                                    {/* Execution Status Panel */}
                                                    <div className="mb-4 bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
                                                        <div className="bg-slate-700/50 px-3 py-2 border-b border-slate-600 flex justify-between items-center">
                                                            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Execution Status</span>
                                                            <div className={`w-2 h-2 rounded-full animate-pulse ${severity === 'CRITICAL' ? 'bg-red-500' : severity === 'MEDIUM' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                                                        </div>
                                                        <div className="p-3 space-y-3">
                                                            <div className="grid grid-cols-1 gap-2">
                                                                <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700/30">
                                                                    <MapPin size={14} className="text-cyan-400" />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Location</span>
                                                                        <span className="text-[11px] text-white font-mono">{currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700/30">
                                                                    <ShieldAlert size={14} className={severity === 'CRITICAL' ? 'text-red-400' : severity === 'MEDIUM' ? 'text-orange-400' : 'text-green-400'} />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Severity</span>
                                                                        <span className={`text-[11px] font-bold uppercase ${severity === 'CRITICAL' ? 'text-red-400' : severity === 'MEDIUM' ? 'text-orange-400' : 'text-green-400'}`}>{severity}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700/30">
                                                                    <BarChart2 size={14} className="text-emerald-400" />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Confidence</span>
                                                                        <span className="text-[11px] text-white font-black">{Math.round((event.confidence_score || 0) * 100)}%</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className={`p-2.5 rounded border-l-4 ${severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500' : severity === 'MEDIUM' ? 'bg-orange-500/10 border-orange-500' : 'bg-green-500/10 border-green-500'}`}>
                                                                <div className="text-[9px] uppercase font-black mb-1 flex items-center gap-1" style={{ color: severity === 'CRITICAL' ? '#ef4444' : severity === 'MEDIUM' ? '#f97316' : '#22c55e' }}>
                                                                    {severity === 'CRITICAL' ? '🔴' : severity === 'MEDIUM' ? '🟠' : '🟢'} Status:
                                                                </div>
                                                                <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                                                                    {event.status_message || "Situation under evaluation."}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {event.status === 'Pending' && (
                                                        <div className="mb-4 bg-slate-800/80 p-3 rounded border border-indigo-500/30">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <ShieldAlert size={14} className="text-indigo-400" />
                                                                <span className="text-xs text-slate-200 font-bold uppercase tracking-wider">AI Verification Step</span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onTriggerAI(event.id); }}
                                                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded transition-colors shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                                                            >
                                                                Run Cross-Modal Reasoning
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Incident Lifecycle Timeline (New Micro-Improvement) */}
                                                    <div className="mb-4 bg-slate-900/40 p-3 rounded-xl border border-white/5 shadow-inner">
                                                        <div className="flex items-center gap-1.5 mb-3 border-b border-white/5 pb-2">
                                                            <Activity size={12} className="text-emerald-400" />
                                                            <span className="text-[10px] uppercase font-black text-slate-300 tracking-widest">Mission Lifecycle</span>
                                                        </div>
                                                        <div className="relative flex justify-between items-start px-2">
                                                            {/* Timeline Connecting Line */}
                                                            <div className="absolute top-2 left-4 right-4 h-0.5 bg-slate-800 z-0">
                                                                <motion.div 
                                                                    initial={{ width: 0 }}
                                                                    animate={{ 
                                                                        width: event.status === 'Resolved' ? '100%' : 
                                                                               event.status === 'In Progress' ? '75%' : 
                                                                               event.status !== 'Pending' ? '50%' : 
                                                                               (event.xai_breakdown ? '25%' : '0%') 
                                                                    }}
                                                                    className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500"
                                                                />
                                                            </div>

                                                            {[
                                                                { label: 'Signal', icon: '📡', active: true, done: true },
                                                                { label: 'Logic', icon: '🧠', active: !!event.xai_breakdown, done: !!event.xai_breakdown },
                                                                { label: 'Dispatch', icon: '⚡', active: event.status !== 'Pending', done: event.status !== 'Pending' },
                                                                { label: 'Transit', icon: '🚑', active: event.status === 'In Progress', done: event.status === 'Resolved' },
                                                                { label: 'Arrived', icon: '🏁', active: event.status === 'Resolved', done: event.status === 'Resolved' }
                                                            ].map((step, idx) => (
                                                                <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] transition-all duration-500 
                                                                        ${step.done ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                                                                          step.active ? 'bg-blue-500 animate-pulse' : 'bg-slate-800 border border-slate-700'}`}>
                                                                        {step.done ? '✓' : step.icon}
                                                                    </div>
                                                                    <span className={`text-[8px] font-black uppercase tracking-tighter ${step.active || step.done ? 'text-white' : 'text-slate-600'}`}>
                                                                        {step.label}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* AI Explanation Layer (Restored) */}
                                                    <div className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700/50 shadow-inner">
                                                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/5">
                                                            <div className="flex items-center gap-1.5">
                                                                <BarChart2 size={12} className="text-cyan-400" />
                                                                <span className="text-[10px] uppercase font-black text-slate-300 tracking-widest">AI Reasoning Breakdown</span>
                                                            </div>
                                                            <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-400/10 px-1.5 rounded">REL: {((event.confidence_score || 0) * 100).toFixed(0)}%</span>
                                                        </div>
                                                        <div className="space-y-2 mb-2 pt-1">
                                                            {[
                                                                { label: 'NLP (Social)', key: 'nlp_contribution', color: 'bg-indigo-500', icon: '💬' },
                                                                { label: 'Vision (AI)', key: 'vision_contribution', color: 'bg-purple-500', icon: '👁️' },
                                                                { label: 'Weather', key: 'weather_contribution', color: 'bg-cyan-500', icon: '☁️' },
                                                                { label: 'IoT Sensors', key: 'sensor_contribution', color: 'bg-amber-500', icon: '📡' }
                                                            ].map(item => {
                                                                const val = event.xai_breakdown?.[item.key] ?? 
                                                                    (item.key === 'nlp_contribution' ? 40 : 
                                                                     item.key === 'vision_contribution' ? 30 : 
                                                                     item.key === 'weather_contribution' ? 20 : 10);
                                                                return (
                                                                    <div key={item.key} className="flex flex-col gap-1">
                                                                        <div className="flex justify-between items-center text-[9px] font-bold">
                                                                            <span className="text-slate-400 flex items-center gap-1">
                                                                                <span>{item.icon}</span> {item.label}
                                                                            </span>
                                                                            <span className="text-white">{val}%</span>
                                                                        </div>
                                                                        <div className="bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                                            <motion.div 
                                                                                initial={{ width: 0 }}
                                                                                animate={{ width: `${val}%` }}
                                                                                className={`h-full ${item.color} shadow-[0_0_8px_rgba(255,255,255,0.2)]`}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <p className="text-[9px] text-slate-500 font-medium leading-tight border-t border-white/5 pt-2 mt-1">
                                                            <span className="text-cyan-500 font-black mr-1">ANALYSIS:</span>
                                                            Priority modulated by {event.category || 'Unknown'} baseline risk and multi-modal verification.
                                                        </p>
                                                    </div>

                                                    {event.status !== 'Resolved' && (
                                                        <>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <ShieldAlert size={14} className="text-cyan-400" />
                                                                <span className="text-xs text-slate-200 font-bold uppercase tracking-wider">Dispatch Authorization</span>
                                                            </div>

                                                            {userRole === 'Responder' || userRole === 'Admin' ? (
                                                                <div className="flex flex-col gap-2">
                                                                    {event.status === 'In Progress' && activeRoute ? (
                                                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between items-center bg-slate-800/80 p-2 rounded border border-cyan-500/30">
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-xs text-slate-400 flex items-center gap-1"><Navigation size={12} /> Route Distance</span>
                                                                                <span className="text-sm font-bold text-cyan-400">{activeRoute.estimated_time_mins * 0.8} km</span>
                                                                            </div>
                                                                            <div className="flex flex-col gap-1 text-right">
                                                                                <span className="text-xs text-slate-400 flex items-center gap-1 justify-end"><Clock size={12} /> ETA</span>
                                                                                <span className="text-sm font-bold text-yellow-400">{activeRoute.estimated_time_mins} mins</span>
                                                                            </div>
                                                                        </motion.div>
                                                                    ) : event.status === 'Resolved' ? (
                                                                        <div className="flex items-center justify-center p-2 bg-green-500/20 border border-green-500/30 rounded text-green-400 text-sm font-bold">
                                                                            <CheckCircle2 size={16} className="mr-2" /> Mission Completed
                                                                        </div>
                                                                    ) : null}

                                                                    {event.status !== 'Resolved' && (
                                                                        <div className="flex flex-col gap-3 mt-2">
                                                                            {/* Override Fields */}
                                                                            <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                                                                                <div className="flex justify-between items-center mb-1">
                                                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Target Coordinates</span>
                                                                                    {overrideCoords[event.id] && (
                                                                                        <button onClick={(e) => { e.stopPropagation(); resetCoords(event); }} className="text-[10px] text-cyan-400 hover:text-cyan-300">
                                                                                            Reset to Auto
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex gap-2">
                                                                                    <div className="flex-1 text-left">
                                                                                        <input
                                                                                            type="number" step="any"
                                                                                            value={currentCoords.lat}
                                                                                            onChange={e => handleCoordChange(event.id, 'lat', e.target.value)}
                                                                                            onClick={e => e.stopPropagation()}
                                                                                            className={`w-full bg-slate-900 border text-xs text-white px-2 py-1 rounded focus:outline-none ${currentErrors.lat ? 'border-red-500' : 'border-slate-600 focus:border-cyan-500'}`}
                                                                                            placeholder="Lat"
                                                                                        />
                                                                                        {currentErrors.lat && <span className="text-[9px] text-red-500 text-left block mt-0.5">{currentErrors.lat}</span>}
                                                                                    </div>
                                                                                    <div className="flex-1 text-left">
                                                                                        <input
                                                                                            type="number" step="any"
                                                                                            value={currentCoords.lng}
                                                                                            onChange={e => handleCoordChange(event.id, 'lng', e.target.value)}
                                                                                            onClick={e => e.stopPropagation()}
                                                                                            className={`w-full bg-slate-900 border text-xs text-white px-2 py-1 rounded focus:outline-none ${currentErrors.lng ? 'border-red-500' : 'border-slate-600 focus:border-cyan-500'}`}
                                                                                            placeholder="Lng"
                                                                                        />
                                                                                        {currentErrors.lng && <span className="text-[9px] text-red-500 text-left block mt-0.5">{currentErrors.lng}</span>}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex gap-2">
                                                                                <select
                                                                                    value={selectedUnit}
                                                                                    onChange={e => setSelectedUnit(e.target.value)}
                                                                                    disabled={currentDispatchStatus === 'loading' || currentDispatchStatus === 'success' || event.status === 'In Progress'}
                                                                                    className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500 flex-1 transition-colors disabled:opacity-50"
                                                                                >
                                                                                    <option value="Ambulance">Ambulance</option>
                                                                                    <option value="Fire Engine">Fire Engine</option>
                                                                                    <option value="Drone">Scout Drone</option>
                                                                                    <option value="Boat">Rescue Boat</option>

                                                                                </select>
                                                                                <motion.button
                                                                                    whileHover={(currentDispatchStatus !== 'loading' && currentDispatchStatus !== 'success' && event.status !== 'In Progress' && !hasErrors) ? { scale: 1.05 } : {}}
                                                                                    whileTap={(currentDispatchStatus !== 'loading' && currentDispatchStatus !== 'success' && event.status !== 'In Progress' && !hasErrors) ? { scale: 0.95 } : {}}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (currentDispatchStatus === 'success' || event.status === 'In Progress') return;
                                                                                        const coords = getCoordsState(event);
                                                                                        onSuggestDispatch(event.id, selectedUnit, coords.lat, coords.lng);
                                                                                        setPendingDispatch(prev => ({ ...prev, [event.id]: true }));
                                                                                    }}
                                                                                    disabled={currentDispatchStatus === 'loading' || currentDispatchStatus === 'success' || event.status === 'In Progress' || hasErrors}
                                                                                    className={`flex items-center justify-center min-w-[110px] text-white text-xs font-bold px-3 py-1.5 rounded-md transition-all shadow-lg ${currentDispatchStatus === 'success' || event.status === 'In Progress' ? 'bg-green-600 hover:bg-green-500 shadow-green-900/50' :
                                                                                        'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50'
                                                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                                                >
                                                                                    {currentDispatchStatus === 'success' || event.status === 'In Progress' ? (
                                                                                        <><CheckCircle2 size={14} className="mr-1" /> Dispatched ✓</>
                                                                                    ) : (
                                                                                        "Suggest Dispatch"
                                                                                    )}
                                                                                </motion.button>
                                                                            </div>
                                                                            {/* Human in the loop confirmation */}
                                                                            <AnimatePresence>
                                                                                {pendingDispatch[event.id] && currentDispatchStatus !== 'success' && event.status !== 'In Progress' && (
                                                                                    <motion.div
                                                                                        initial={{ opacity: 0, y: -10 }}
                                                                                        animate={{ opacity: 1, y: 0 }}
                                                                                        exit={{ opacity: 0, y: -10 }}
                                                                                        className="mt-2 bg-slate-900/60 p-3 rounded-md border border-cyan-500/30"
                                                                                    >
                                                                                        <p className="text-xs text-slate-300 mb-2 leading-tight">
                                                                                            <strong className="text-cyan-400">AI Suggestion:</strong> Deploy <span className="text-white font-bold">{selectedUnit}</span> to <span className="text-white font-mono">{parseFloat(currentCoords.lat).toFixed(4)}, {parseFloat(currentCoords.lng).toFixed(4)}</span>. Please confirm action.
                                                                                        </p>
                                                                                        <div className="flex gap-2">
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setPendingDispatch(prev => ({ ...prev, [event.id]: false }));
                                                                                                    handleDispatchClick(e, event, selectedUnit);
                                                                                                }}
                                                                                                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold py-1.5 rounded transition-colors shadow-[0_0_10px_rgba(22,163,74,0.3)] flex items-center justify-center gap-1"
                                                                                                disabled={currentDispatchStatus === 'loading'}
                                                                                            >
                                                                                                {currentDispatchStatus === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <><CheckCircle2 size={12} /> CONFIRM MAPPING</>}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setPendingDispatch(prev => ({ ...prev, [event.id]: false }));
                                                                                                    onClearRoute();
                                                                                                }}
                                                                                                className="flex-1 bg-slate-700 hover:bg-red-500/80 text-white text-[10px] font-bold py-1.5 rounded transition-colors"
                                                                                                disabled={currentDispatchStatus === 'loading'}
                                                                                            >
                                                                                                CANCEL
                                                                                            </button>
                                                                                        </div>
                                                                                    </motion.div>
                                                                                )}
                                                                            </AnimatePresence>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-red-400 bg-red-900/20 py-2 px-3 rounded-md border border-red-900/50 flex items-center gap-2">
                                                                    <AlertTriangle size={14} />
                                                                    Access Denied: Responder clearance required.
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        </div>
    );
});

const formatTime = (isoString) => {
    if (!isoString) return "Just now";
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return "Recent";
    }
};

export default Sidebar;
