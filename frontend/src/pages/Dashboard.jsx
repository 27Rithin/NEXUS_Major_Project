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

  // Simple Restoration: Basic Health Check
  useEffect(() => {
    const checkPing = async () => {
        try {
            const res = await api.get('ping');
            setApiHealth(res.status === 200 ? 'healthy' : 'offline');
        } catch {
            setApiHealth('offline');
        }
    };
    checkPing();
    const inv = setInterval(checkPing, 30000);
    return () => clearInterval(inv);
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await EventService.getEvents();
      if (data) setEvents(data);
    } catch (error) {
      console.warn("Telemetry lag:", error.message);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const inv = setInterval(fetchEvents, 15000);
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

  const handleDispatch = async (eventId, unitType, overrideLat = null, overrideLng = null) => {
    setLoading(true);
    try {
      await EventService.dispatchUnit(eventId, unitType, "Dispatched via Dashboard", overrideLat, overrideLng);
      addToast(`Successfully dispatched ${unitType} to Incident!`, "success");
      await fetchEvents();
    } catch (error) {
      addToast(error.message || "Failed to dispatch unit.", "error");
    }
    setLoading(false);
  };

  const handleSuggestDispatch = async (eventId, unitType, lat, lng) => {
    try {
      const data = await EventService.suggestDispatch(eventId, unitType, lat, lng);
      setActiveRoute(data);
    } catch (error) {
      addToast("Failed to fetch suggested route", "error");
    }
  };

  const handleSimulateDisaster = async () => {
    setLoading(true);
    try {
        await api.post('ingestion/simulate?count=10');
        addToast(`Simulated 10 disaster events.`, "success");
        await fetchEvents();
    } catch (e) { addToast("Simulation failed", "error"); }
    setLoading(false);
  };

  const handleSimulateSocial = async () => {
    setLoading(true);
    try {
        await AgentService.simulateSocialPost();
        addToast(`Social media stream ingested.`, "success");
        await fetchEvents();
    } catch (e) { addToast("Social ingestion failed", "error"); }
    setLoading(false);
  };

  // Metrics
  const eventList = Array.isArray(events) ? events : [];
  const activeIncidents = eventList.filter(e => e && e.status !== 'Resolved').length;
  const criticalAlerts = eventList.filter(e => e && e.severity_level === 'CRITICAL').length;
  const unitsDeployed = eventList.filter(e => e && e.status === 'In Progress').length;
  const avgResponseTime = "3m"; // Match Image 3 styling

  return (
    <div className="flex flex-col h-screen bg-[#050B18] overflow-hidden font-sans">
      {/* HEADER (MATCHES IMAGE 3) */}
      <nav className="h-16 bg-[#0B1525] border-b border-slate-800/80 flex items-center justify-between px-6 z-20 shrink-0 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1 px-2 border-2 border-cyan-400 bg-cyan-400/10 rounded flex items-center gap-1">
              <Shield size={18} className="text-cyan-400" />
              <div className="w-[2px] h-4 bg-cyan-400/50" />
              <Globe size={18} className="text-cyan-400" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-white">NEXUS NODE <span className="text-cyan-400">v2.0</span></h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-[10px] font-black tracking-widest text-emerald-400">LIVE MONITORING</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <button onClick={() => setShowHeatmap(!showHeatmap)} className="text-[10px] font-bold text-slate-400 border border-slate-800 bg-slate-900/50 px-4 py-2 rounded-lg hover:text-white hover:border-slate-600 transition-all">
                $ RISK HEATMAP
            </button>
            <button onClick={handleSimulateDisaster} className="flex items-center gap-2 text-[10px] font-bold text-white border border-cyan-500/50 bg-cyan-600/20 px-4 py-2 rounded-lg hover:bg-cyan-500/30 transition-all">
                <Activity size={12} /> SIMULATE DISASTERS
            </button>
            <button onClick={handleSimulateSocial} className="flex items-center gap-2 text-[10px] font-bold text-white border border-indigo-500/50 bg-indigo-600/20 px-4 py-2 rounded-lg hover:bg-indigo-500/30 transition-all">
                <Activity size={12} /> SIMULATE SOCIAL STREAM
            </button>
            <div className="w-[1px] h-6 bg-slate-800" />
            <div className="text-[11px] font-black flex items-center gap-2">
                <span className="text-slate-500 uppercase">OPR:</span>
                <span className="text-white">Admin</span>
                <span className="text-cyan-400">[Admin]</span>
            </div>
            <button onClick={logout} className="flex items-center gap-2 text-[11px] font-black text-slate-500 hover:text-white transition-colors ml-4">
                DISCONNECT <LogOut size={14} />
            </button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          events={events}
          setSelectedEvent={setSelectedEvent}
          selectedEvent={selectedEvent}
          onSuggestDispatch={handleSuggestDispatch}
          onDispatch={handleDispatch}
          activeRoute={activeRoute}
        />

        <div className="flex-1 relative">
          {/* STATS OVERLAY (MATCHES IMAGE 3) */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] flex gap-4 w-full px-8 justify-center pointer-events-none">
            <div className="bg-[#0B1525]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-2xl min-w-[200px]">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                    <Activity size={24} className="text-blue-400" />
                </div>
                <div>
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Incidents</h5>
                    <p className="text-2xl font-black text-white leading-none mt-1">{activeIncidents}</p>
                </div>
            </div>
            <div className="bg-[#0B1525]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-2xl min-w-[200px]">
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                    <AlertOctagon size={24} className="text-red-400" />
                </div>
                <div>
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Critical Alerts</h5>
                    <p className="text-2xl font-black text-white leading-none mt-1">{criticalAlerts}</p>
                </div>
            </div>
            <div className="bg-[#0B1525]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-2xl min-w-[200px]">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                    <Send size={24} className="text-emerald-400" />
                </div>
                <div>
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Units Deployed</h5>
                    <p className="text-2xl font-black text-white leading-none mt-1">{unitsDeployed}</p>
                </div>
            </div>
            <div className="bg-[#0B1525]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-2xl min-w-[200px]">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
                    <Activity size={24} className="text-purple-400" />
                </div>
                <div>
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Avg Response Time</h5>
                    <p className="text-2xl font-black text-white leading-none mt-1">{avgResponseTime}</p>
                </div>
            </div>
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
