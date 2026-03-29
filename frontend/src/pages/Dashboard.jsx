import React, { useState, useEffect, useContext, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import NexusMap from '../components/Map';
import { EventService, AgentService, default as api } from '../services/api';
import { AuthContext } from '../contexts/AuthContextValue';
import { LogOut, Activity, AlertOctagon, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { config } from '../config/env';
import { useToast } from '../components/useToast';

export default function Dashboard() {
  const MotionDiv = motion.div;
  void MotionDiv;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting', 'connected', 'disconnected'
  const [apiHealth, setApiHealth] = useState('unknown'); // 'healthy', 'waking_up', 'degraded', 'offline'
  const [failCount, setFailCount] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [aiStatus, setAiStatus] = useState('standby');
  const { user, logout } = useContext(AuthContext);
  const { addToast } = useToast();

  const checkApiHealth = useCallback(async () => {
    try {
      const startTime = Date.now();
      // Ensure we don't have double slashes if API_URL ends in /
      const healthUrl = `${config.API_URL.replace(/\/+$/, '')}/health`;
      const res = await fetch(healthUrl);
      const latency = Date.now() - startTime;
      
      if (res.ok) {
        setFailCount(0); // Reset on success
        if (latency > 2500 && apiHealth === 'unknown') {
          setApiHealth('waking_up');
        } else {
          setApiHealth(latency > 1000 ? 'degraded' : 'healthy');
        }
      } else {
        setFailCount(prev => prev + 1);
      }
    } catch {
      setFailCount(prev => prev + 1);
    }
  }, [apiHealth]);

  useEffect(() => {
    // If we've failed 3 times in a row, then mark as offline
    if (failCount >= 3) {
      setApiHealth('offline');
    }
  }, [failCount]);

  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [checkApiHealth]);

  const fetchEvents = useCallback(async (isInitial = false) => {
    setLoading(true);
    try {
      const data = await EventService.getEvents();
      if (data) {
        setEvents(data);
        // MISSION CRITICAL RECOVERY: On restart/refresh, auto-select the highest priority active mission
        if (isInitial) {
          const activeMission = data.find(e => e.status === 'In Progress') || data.find(e => e.severity_level === 'CRITICAL');
          if (activeMission) {
            console.log("[RECOVERY] Restoring active mission state for:", activeMission.id);
            setSelectedEvent(activeMission);
          }
        }
      }
    } catch (error) {
      // Don't flip to offline immediately on telemetry error; let health check handle it
      console.warn("TELEMETRY DELAY:", error.message);
      addToast("TELEMETRY LAG: Attempting background sync...", "warning");
    }
    setLoading(false);
  }, [addToast]);

  // WebSocket logic moved to Sidebar.jsx to ensure strict real-time injection and avoid duplicates.

  useEffect(() => {
    fetchEvents(true);
  }, [fetchEvents]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (selectedEvent) {
        try {
          const routeData = await EventService.getRoute(selectedEvent.id);
          setActiveRoute(routeData);
        } catch (error) {
          // Route fetch failed — clear stale route rather than leaving old data
          console.warn('Could not fetch route for event:', selectedEvent.id, error.message);
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
      addToast(`Successfully dispatched ${unitType} to incident!`, "success");

      const refreshedEvents = await EventService.getEvents();
      if (refreshedEvents) {
        setEvents(refreshedEvents);
        setSelectedEvent(refreshedEvents.find(e => e.id === eventId) || null);
      }
    } catch (error) {
      addToast(error.message || "Failed to dispatch unit.", "error");
      throw error;
    }
    setLoading(false);
  };

  const handleSuggestDispatch = async (eventId, unitType, lat, lng) => {
    try {
      const data = await EventService.suggestDispatch(eventId, unitType, lat, lng);
      setActiveRoute(data);
    } catch (error) {
      addToast(error.message || "Failed to fetch suggested route", "error");
    }
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
  };

  const handleTriggerAI = async (eventId) => {
    setLoading(true);
    try {
      await EventService.triggerCrossModal(eventId);
      addToast(`Cross-modal Analysis complete. Priority updated.`, "success");
      await fetchEvents();
    } catch (error) {
      addToast(error.message || "Failed to trigger AI.", "error");
    }
    setLoading(false);
  };

  const handleSimulateSocial = async () => {
    setLoading(true);
    try {
      await AgentService.simulateSocialPost();
      addToast(`Social media packet ingested and analyzed.`, "success");
      await fetchEvents();
    } catch (error) {
      addToast(error.message || "Failed to simulate social stream.", "error");
    }
    setLoading(false);
  };

  const handleSimulateDisaster = async () => {
    setLoading(true);
    try {
      await api.post('ingestion/simulate?count=10');
      addToast(`Simulated 10 random disaster events.`, "success");
      await fetchEvents();
    } catch (error) {
      addToast(error.response?.data?.detail || error.message || "Failed to simulate events.", "error");
    }
    setLoading(false);
  };

  // Metrics Calculations
  const eventList = Array.isArray(events) ? events : [];
  const activeIncidents = eventList.filter(e => e && e.status !== 'Resolved').length;
  const criticalAlerts = eventList.filter(e => e && e.severity_level === 'CRITICAL').length;
  const unitsDeployed = eventList.filter(e => e && e.status === 'In Progress').length;

  // Pseudo-calculation for Average Response Time (mock or derived from events)
  const deployedEvents = eventList.filter(e => e && (e.status === 'In Progress' || e.status === 'Resolved'));
  const avgResponseTime = (deployedEvents?.length > 0) ?
    Math.round(deployedEvents.reduce((acc, curr) => acc + ((curr?.priority_score || 0) * 0.8), 0) / deployedEvents.length) + "m"
    : "N/A";

  return (
    <div className="flex flex-col h-screen bg-transparent overflow-hidden">
      {/* Top Navbar */}
      <div className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 z-20 w-full shrink-0 shadow-lg shadow-black/20">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-lg tracking-wide">
            <svg className="w-6 h-6 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">NEXUS NODE v2.0</span>
          </div>
          <div className="flex items-center gap-4 bg-slate-800/40 px-4 py-1.5 rounded-xl border border-white/5 shadow-inner">
            {/* WebSocket Health */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">WS-GATEWAY</span>
              <div className="flex items-center gap-1.5 min-w-[80px]">
                <div className={`w-1.5 h-1.5 rounded-full ${(wsStatus || 'connecting') === 'connected' ? 'bg-emerald-500 animate-pulse' : (wsStatus || 'connecting') === 'connecting' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-bold ${(wsStatus || 'connecting') === 'connected' ? 'text-emerald-400' : (wsStatus || 'connecting') === 'connecting' ? 'text-amber-400' : 'text-red-400'}`}>
                  {(wsStatus || 'connecting') === 'connected' ? 'STABLE' : (wsStatus || 'connecting') === 'connecting' ? 'SYNCING' : 'OFFLINE'}
                </span>
              </div>
            </div>
            
            <div className="w-[1px] h-6 bg-white/10" />

            {/* API Health */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">API-CORE</span>
              <div className="flex items-center gap-1.5 min-w-[70px]">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  (apiHealth || 'checking') === 'healthy' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]' :
                  (apiHealth || 'checking') === 'waking_up' ? 'bg-indigo-500 animate-pulse' :
                  (apiHealth || 'checking') === 'degraded' ? 'bg-amber-500' : 'bg-red-600'
                }`} />
                <span className={`text-[10px] font-bold ${
                  (apiHealth || 'checking') === 'healthy' ? 'text-cyan-400' :
                  (apiHealth || 'checking') === 'waking_up' ? 'text-indigo-400 font-black' :
                  (apiHealth || 'checking') === 'degraded' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {(apiHealth || 'checking') === 'healthy' ? 'OPERATIONAL' :
                   (apiHealth || 'checking') === 'waking_up' ? 'WAKING UP...' :
                   (apiHealth || 'checking') === 'degraded' ? 'DEGRADED' : 'OFFLINE'}
                </span>
              </div>
            </div>

            <div className="w-[1px] h-6 bg-white/10" />

            {/* AI Engine Health */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">NEXUS-AI</span>
              <div className="flex items-center gap-1.5 min-w-[70px]">
                <div className={`w-1.5 h-1.5 rounded-full ${(aiStatus || 'standby') === 'active' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' : 'bg-slate-500'}`} />
                <span className={`text-[10px] font-bold ${(aiStatus || 'standby') === 'active' ? 'text-purple-400' : 'text-slate-400'}`}>
                  {(aiStatus || 'standby') === 'active' ? 'COGNITIVE' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={() => setShowHeatmap(!showHeatmap)} className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-lg transition-colors border ${showHeatmap ? 'bg-orange-600/80 hover:bg-orange-500 border-orange-400 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            <span>Risk Heatmap</span>
          </button>
          <button onClick={handleSimulateDisaster} className="flex items-center space-x-2 text-xs bg-cyan-600/80 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors shadow-[0_0_10px_rgba(6,182,212,0.5)] border border-cyan-400/50">
            <Activity size={14} /> <span>Simulate Disasters</span>
          </button>
          <button onClick={handleSimulateSocial} className="flex items-center space-x-2 text-xs bg-indigo-600/80 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors shadow-[0_0_10px_rgba(79,70,229,0.5)]">
            <Activity size={14} /> <span>Simulate Social Stream</span>
          </button>
          <div className="text-xs text-slate-300 font-medium">
            OPR: <span className="text-white font-bold">{user?.name}</span> <span className="text-cyan-400">[{user?.role}]</span>
          </div>
          <button onClick={logout} className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors hover:scale-105 active:scale-95">
            <span>Disconnect</span>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-6"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]"></div>
              <h3 className="text-cyan-400 font-mono font-bold tracking-widest animate-pulse">SYNCING TELEMETRY...</h3>
            </motion.div>
          )}
        </AnimatePresence>

        <Sidebar
          events={events || []}
          setEvents={setEvents}
          setWsStatus={setWsStatus}
          selectedEvent={selectedEvent}
          setSelectedEvent={setSelectedEvent}
          onDispatch={handleDispatch}
          onSuggestDispatch={handleSuggestDispatch}
          onClearRoute={handleClearRoute}
          onTriggerAI={handleTriggerAI}
          userRole={user?.role || 'Guest'}
          activeRoute={activeRoute}
        />

        {/* Map & Metrics Container */}
        <div className="flex-1 relative flex flex-col">
          {/* Animated Operational Metrics Panel */}
          <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-4 pointer-events-none">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-lg pointer-events-auto">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Activity size={18} /></div>
              <div><div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Incidents</div><motion.div key={activeIncidents} initial={{ scale: 1.5, color: '#22d3ee' }} animate={{ scale: 1, color: '#f8fafc' }} className="text-xl font-bold">{activeIncidents}</motion.div></div>
            </motion.div>
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-lg pointer-events-auto">
              <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><AlertOctagon size={18} /></div>
              <div><div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Critical Alerts</div><motion.div key={criticalAlerts} initial={{ scale: 1.5, color: '#ef4444' }} animate={{ scale: 1, color: '#f8fafc' }} className="text-xl font-bold">{criticalAlerts}</motion.div></div>
            </motion.div>
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-lg pointer-events-auto">
              <div className="p-2 bg-green-500/20 rounded-lg text-green-400"><Send size={18} /></div>
              <div><div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Units Deployed</div><motion.div key={unitsDeployed} initial={{ scale: 1.5, color: '#10b981' }} animate={{ scale: 1, color: '#f8fafc' }} className="text-xl font-bold">{unitsDeployed}</motion.div></div>
            </motion.div>
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-lg pointer-events-auto">
              <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><Activity size={18} /></div>
              <div><div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Avg Response Time</div><motion.div key={avgResponseTime} initial={{ scale: 1.5, color: '#a855f7' }} animate={{ scale: 1, color: '#f8fafc' }} className="text-xl font-bold">{avgResponseTime}</motion.div></div>
            </motion.div>
          </div>

          <div className="flex-1 relative">
            <NexusMap
              events={events}
              selectedEvent={selectedEvent}
              activeRoute={activeRoute}
              onSelectEvent={(e) => setSelectedEvent(e)}
              onTriggerAI={handleTriggerAI}
              showHeatmap={showHeatmap}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
