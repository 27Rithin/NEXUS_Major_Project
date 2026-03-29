import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import NexusMap from '../components/Map';
import { EventService, AgentService, default as api } from '../services/api';
import { AuthContext } from '../contexts/AuthContextValue';
import { LogOut, Activity, AlertOctagon, Send, Shield, Globe, Zap, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { config } from '../config/env';
import { useToast } from '../components/useToast';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const { user, logout } = useContext(AuthContext);
  const { addToast } = useToast();

  const fetchEvents = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await EventService.getEvents();
      if (data && Array.isArray(data)) {
        setEvents(data);
        if (isInitial && data.length === 0) {
            console.log("[RECLAMATION] Triggering Beauty Shot Seed Data...");
            await api.post('ingestion/simulate?count=15');
            const refreshed = await EventService.getEvents();
            if (refreshed) setEvents(refreshed);
        }
      }
    } catch (error) {
      console.warn("TELEMETRY LAG:", error.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // 🛰️ WebSocket Listener (Instant SOS Alerts on Dashboard)
  const handleWSMessage = useCallback((msg) => {
    if (msg.type === "new_incident") {
      addToast(`🔴 NEW SOS RECEIVED: ${msg.data.severity_level}`, "error", 10000);
      
      // 🔥 AUTO-FOCUS LOGIC: Select the new incident immediately to center the map
      setSelectedEvent(msg.data);
      fetchEvents(); 
    }
  }, [addToast, fetchEvents]);

  useWebSocket(config.WS_URL, handleWSMessage);

  useEffect(() => {
    fetchEvents(true);
    const inv = setInterval(() => fetchEvents(false), 8000);
    return () => clearInterval(inv);
  }, [fetchEvents]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (selectedEvent) {
        try {
          const routeData = await EventService.getRoute(selectedEvent.id);
          setActiveRoute(routeData);
        } catch (error) {
          setActiveRoute(null);
        }
      } else {
        setActiveRoute(null);
      }
    };
    fetchRoute();
  }, [selectedEvent]);

  return (
    <div className="flex flex-col h-screen bg-[#0B0F19] overflow-hidden font-inter text-slate-200">
      {/* HEADER MATCHING IMAGE 2/3 */}
      <nav className="h-16 glass-panel border-b border-white/5 flex items-center justify-between px-6 z-20 shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => fetchEvents(true)}>
            <div className="w-9 h-9 bg-nexus-blue/20 rounded-lg flex items-center justify-center border border-nexus-blue/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <Shield size={22} className="text-nexus-blue fill-nexus-blue/20" />
            </div>
            <h1 className="text-2xl font-orbitron font-black tracking-tighter text-white uppercase italic">NEXUS NODE <span className="text-nexus-blue">v2.0</span></h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-nexus-green shadow-[0_0_10px_#22C55E] animate-pulse" />
            <span className="text-[10px] font-orbitron font-black tracking-[0.2em] text-nexus-green uppercase">Live Monitoring</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl text-[10px] font-orbitron font-black text-slate-400 hover:text-white transition-all tracking-widest border border-white/5">
                <Search size={14} /> GLOBAL SEARCH
            </button>
            <button onClick={() => api.post('ingestion/simulate?count=10').then(() => fetchEvents())} className="flex items-center gap-2 text-[10px] font-orbitron font-black text-white bg-nexus-blue/20 border border-nexus-blue/40 px-4 py-2 rounded-lg hover:bg-nexus-blue/40 transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                <Zap size={14} className="fill-white" /> SIMULATE DISASTERS
            </button>
            <div className="w-[1px] h-6 bg-white/5 mx-2" />
            <div className="text-[11px] font-orbitron font-black flex items-center gap-3">
                <span className="text-slate-500 uppercase tracking-widest">OPR //</span>
                <span className="text-white uppercase leading-none">{user?.name || 'Admin'}</span>
                <div className="px-2 py-0.5 bg-nexus-blue text-[9px] text-black rounded font-black tracking-tighter uppercase italic">{user?.role || 'Admin'}</div>
            </div>
            <button onClick={logout} className="p-2 hover:bg-red-500/10 hover:text-nexus-red rounded-lg transition-all text-slate-500">
                <LogOut size={18} />
            </button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          events={events}
          setEvents={setEvents}
          setSelectedEvent={setSelectedEvent}
          selectedEvent={selectedEvent}
          onSuggestDispatch={(id, type, lat, lng) => EventService.suggestDispatch(id, type, lat, lng).then(data => setActiveRoute(data))}
          onDispatch={(id, type, lat, lng) => EventService.dispatchUnit(id, type, "Emergency", lat, lng).then(() => fetchEvents())}
          onTriggerAI={(id) => api.post(`ai/reason/${id}`).then(() => fetchEvents())}
          onClearRoute={() => setActiveRoute(null)}
          activeRoute={activeRoute}
        />

        <div className="flex-1 relative">
          {/* STATS HUD OVERLAY (Orbitron Fonts) */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1000] flex gap-5 w-full px-12 justify-center pointer-events-none">
            {[ 
              { label: 'Active Incidents', val: events.length || 0, color: 'blue', icon: Activity, glow: 'blue-500' },
              { label: 'Critical Alerts', val: events.filter(e => e.severity_level === 'CRITICAL').length, color: 'red', icon: AlertOctagon, glow: 'red-500' },
              { label: 'Units Deployed', val: events.filter(e => e.status === 'In Progress').length, color: 'emerald', icon: Send, glow: 'emerald-500' },
              { label: 'Avg Response Time', val: '3m', color: 'purple', icon: Activity, glow: 'purple-500' }
            ].map((stat, i) => (
                <div key={i} className="glass-panel rounded-2xl p-4 flex items-center gap-5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] min-w-[210px] pointer-events-auto border-b-4 border-nexus-blue/30" style={{ borderBottomColor: `rgba(var(--${stat.color}-500-rgb), 0.5)` }}>
                    <div className={`w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5`}>
                        <stat.icon size={22} className={`text-${stat.color}-500`} />
                    </div>
                    <div>
                        <h5 className="text-[10px] font-orbitron font-black text-slate-500 uppercase tracking-widest">{stat.label}</h5>
                        <p className="text-3xl font-orbitron font-black text-white leading-none mt-1 tracking-tighter italic drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{stat.val}</p>
                    </div>
                </div>
            ))}
          </div>

          <NexusMap
            events={events}
            selectedEvent={selectedEvent}
            activeRoute={activeRoute}
            onSelectEvent={setSelectedEvent}
          />
        </div>
      </div>
    </div>
  );
}
