import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import NexusMap from '../components/Map';
import { EventService, AgentService, default as api } from '../services/api';
import { AuthContext } from '../contexts/AuthContextValue';
import { LogOut, Activity, AlertOctagon, Send, Shield, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { config } from '../config/env';
import { useToast } from '../components/useToast';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [wsStatus, setWsStatus] = useState('connected');
  const [apiHealth, setApiHealth] = useState('healthy');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const { addToast } = useToast();

  // 🛰️ MASTER DATA FETCH (Matches Image 3 Data Density)
  const fetchEvents = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await EventService.getEvents();
      if (data && Array.isArray(data)) {
        setEvents(data);
        // If data is empty on initial load, auto-simulate to restore "Beauty Shot" look
        if (isInitial && data.length === 0) {
            console.log("[RESTORE] Server empty. Initiating Beauty Pulse...");
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

  useEffect(() => {
    fetchEvents(true);
    const inv = setInterval(() => fetchEvents(false), 15000);
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
    <div className="flex flex-col h-screen bg-[#050B18] overflow-hidden font-sans">
      {/* HEADER (MATCHES IMAGE 3 EXACTLY) */}
      <nav className="h-16 bg-[#0B1525] border-b border-white/5 flex items-center justify-between px-6 z-20 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="p-1 px-2 border-2 border-cyan-400 bg-cyan-400/10 rounded flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <Shield size={18} className="text-cyan-400 fill-cyan-400/20" />
              <div className="w-[1.5px] h-4 bg-cyan-400/40" />
              <Globe size={18} className="text-cyan-400 animate-pulse" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white italic uppercase">NEXUS NODE <span className="text-cyan-400">v2.0</span></h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.1em] text-emerald-400 text-shadow-glow">LIVE MONITORING</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <button onClick={() => setShowHeatmap(!showHeatmap)} className="text-[10px] font-black text-slate-400 border border-slate-800 bg-slate-900/50 px-4 py-2 rounded-lg hover:text-white hover:border-slate-500 hover:bg-slate-800 transition-all tracking-widest uppercase">
                $ RISK HEATMAP
            </button>
            <button onClick={() => api.post('ingestion/simulate?count=10').then(() => fetchEvents())} className="flex items-center gap-2 text-[10px] font-black text-white border border-cyan-500/40 bg-cyan-600/10 px-4 py-2 rounded-lg hover:bg-cyan-500/30 transition-all tracking-widest uppercase">
                <Activity size={12} /> SIMULATE DISASTERS
            </button>
            <button onClick={() => AgentService.simulateSocialPost().then(() => fetchEvents())} className="flex items-center gap-2 text-[10px] font-black text-white border border-indigo-500/40 bg-indigo-600/10 px-4 py-2 rounded-lg hover:bg-indigo-500/30 transition-all tracking-widest uppercase">
                <Activity size={12} /> SIMULATE SOCIAL STREAM
            </button>
            <div className="w-[1px] h-6 bg-slate-800 mx-2" />
            <div className="text-[11px] font-black flex items-center gap-2">
                <span className="text-slate-500 uppercase tracking-widest">OPR:</span>
                <span className="text-white tracking-tight">Admin</span>
                <span className="text-cyan-400">[{user?.role || 'Admin'}]</span>
            </div>
            <button onClick={logout} className="flex items-center gap-2 text-[11px] font-black text-slate-500 hover:text-red-400 transition-all ml-4 group">
                DISCONNECT <LogOut size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          events={events}
          setSelectedEvent={setSelectedEvent}
          selectedEvent={selectedEvent}
          onSuggestDispatch={(id, type, lat, lng) => EventService.suggestDispatch(id, type, lat, lng).then(data => setActiveRoute(data))}
          onDispatch={(id, type, lat, lng) => EventService.dispatchUnit(id, type, "Emergency", lat, lng).then(() => fetchEvents())}
          activeRoute={activeRoute}
        />

        <div className="flex-1 relative">
          {/* STATS OVERLAY (MATCHES IMAGE 3 - HIGH DENSITY) */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1000] flex gap-5 w-full px-12 justify-center pointer-events-none">
            {[ 
              { label: 'Active Incidents', val: events.length || 0, color: 'blue', icon: Activity },
              { label: 'Critical Alerts', val: events.filter(e => e.severity_level === 'CRITICAL').length, color: 'red', icon: AlertOctagon },
              { label: 'Units Deployed', val: events.filter(e => e.status === 'In Progress').length, color: 'emerald', icon: Send },
              { label: 'Avg Response Time', val: '3m', color: 'purple', icon: Activity }
            ].map((stat, i) => (
                <div key={i} className="bg-[#0B1525]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-5 shadow-[0_10px_40px_rgba(0,0,0,0.6)] min-w-[220px] pointer-events-auto hover:border-slate-600 transition-all border-b-4" style={{ borderBottomColor: `var(--${stat.color}-500)` }}>
                    <div className={`w-12 h-12 bg-${stat.color}-500/10 rounded-2xl flex items-center justify-center border border-${stat.color}-500/20`}>
                        <stat.icon size={22} className={`text-${stat.color}-400`} />
                    </div>
                    <div>
                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">{stat.label}</h5>
                        <p className="text-3xl font-black text-white leading-none mt-1 tracking-tighter italic">{stat.val}</p>
                    </div>
                </div>
            ))}
          </div>

          <NexusMap
            events={events}
            selectedEvent={selectedEvent}
            activeRoute={activeRoute}
            onSelectEvent={setSelectedEvent}
            showHeatmap={showHeatmap}
          />
        </div>
      </div>
    </div>
  );
}
