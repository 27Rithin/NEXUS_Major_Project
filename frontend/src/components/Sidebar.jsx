import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Shield, AlertTriangle, Clock, MapPin, 
  Send, ChevronRight, Filter, Zap, Info, ShieldAlert,
  Flame, Droplets, Heart, Car, AlertOctagon,
  ChevronDown, Search, Radio, MoreHorizontal, MousePointer2
} from 'lucide-react';

const Sidebar = ({ 
  events, 
  setSelectedEvent, 
  selectedEvent, 
  onSuggestDispatch,
  onDispatch,
  onTriggerAI,
  activeRoute
}) => {
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchesCategory = filterCategory === 'ALL' || e.category?.toUpperCase() === filterCategory;
      const matchesSearch = e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           e.category?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [events, filterCategory, searchTerm]);

  const categories = ['ALL', 'SOS', 'FIRE', 'FLOOD', 'MEDICAL', 'ACCIDENT', 'HAZARD'];

  const getSeverityStyle = (level) => {
    const l = level?.toUpperCase();
    if (l === 'CRITICAL') return 'border-nexus-red/40 glow-critical text-nexus-red';
    if (l === 'HIGH' || l === 'MEDIUM') return 'border-nexus-orange/40 glow-medium text-nexus-orange';
    return 'border-nexus-green/40 glow-low text-nexus-green';
  };

  const getCategoryIcon = (cat) => {
    const c = cat?.toUpperCase();
    if (c === 'FIRE') return <Flame size={14} />;
    if (c === 'FLOOD') return <Droplets size={14} />;
    if (c === 'MEDICAL') return <Heart size={14} />;
    if (c === 'ACCIDENT') return <Car size={14} />;
    if (c === 'SOS') return <ShieldAlert size={14} />;
    return <AlertOctagon size={14} />;
  };

  return (
    <div className="w-[420px] bg-[#0B1525] border-r border-white/5 flex flex-col h-full z-10 shadow-[20px_0_50px_rgba(0,0,0,0.5)]">
      {/* Sidebar Header (Orbitron) */}
      <div className="p-6 border-b border-white/5 bg-[#0D1525]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-nexus-blue/10 flex items-center justify-center border border-nexus-blue/20">
                <Activity size={18} className="text-nexus-blue" />
             </div>
             <div>
                <h2 className="text-sm font-orbitron font-black text-white uppercase tracking-[0.2em] leading-none mb-1">Active Telemetry</h2>
                <p className="text-[9px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">{filteredEvents.length} Signals Tracked</p>
             </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-nexus-blue shadow-[0_0_8px_#3B82F6] animate-pulse" />
              <span className="text-[9px] font-orbitron font-black text-nexus-blue uppercase tracking-widest">Live Feed</span>
          </div>
        </div>

        <div className="relative group mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-nexus-blue transition-colors" size={14} />
          <input 
            type="text" 
            placeholder="Search incident signatures..." 
            className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-[11px] font-medium text-slate-300 focus:outline-none focus:border-nexus-blue/50 focus:bg-black/60 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-orbitron font-black uppercase tracking-widest border transition-all shrink-0 ${filterCategory === cat ? 'bg-nexus-blue border-nexus-blue text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 bg-[#0B0F19]">
        <AnimatePresence mode="popLayout">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <motion.div 
                key={event.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setSelectedEvent(event)}
                className={`glass-panel p-4 rounded-2xl cursor-pointer transition-all border group relative overflow-hidden ${selectedEvent?.id === event.id ? 'bg-nexus-blue/10 border-nexus-blue/40 shadow-2xl ring-1 ring-nexus-blue/20' : 'hover:bg-white/5 border-white/5'} ${getSeverityStyle(event.severity_level)}`}
              >
                {selectedEvent?.id === event.id && (
                    <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-nexus-blue shadow-[4px_0_15px_rgba(59,130,246,0.8)]" />
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-black/40 rounded-lg group-hover:scale-110 transition-transform">
                      {getCategoryIcon(event.category)}
                    </div>
                    <div>
                      <h3 className="text-[11px] font-orbitron font-black text-white uppercase tracking-tight leading-none mb-1">{event.title || 'Unknown Signal'}</h3>
                      <div className="flex items-center gap-2 text-[9px] text-slate-500 font-bold tracking-widest">
                         <MapPin size={10} /> {event.location?.lat?.toFixed(4)}, {event.location?.lng?.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[8px] font-orbitron font-black tracking-widest uppercase italic border border-white/5 ${event.severity_level ? 'bg-black/40' : 'bg-slate-500/20 text-slate-500'}`}>
                    {event.severity_level || 'ANALYZING...'}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-medium mb-4 leading-relaxed line-clamp-2 italic opacity-80 group-hover:opacity-100 transition-opacity">
                  {event.description}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                   <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                         <span className="text-[8px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">Priority</span>
                         <span className="text-[10px] font-orbitron font-black text-white italic">{event.priority_score?.toFixed(1) || '0.0'}</span>
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[8px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">Confidence</span>
                         <span className="text-[10px] font-orbitron font-black text-white italic">{Math.round((event.confidence_score || 0) * 100)}%</span>
                      </div>
                   </div>

                   <button onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }} className="p-2 hover:bg-nexus-blue/20 rounded-lg text-slate-400 hover:text-nexus-blue transition-all">
                      <ChevronRight size={16} />
                   </button>
                </div>

                {/* Event Detail View Expansion */}
                {selectedEvent?.id === event.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 pt-4 border-t border-white/5 space-y-4">
                     <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <h4 className="text-[9px] font-orbitron font-black text-nexus-blue uppercase tracking-widest mb-2 flex items-center gap-2">
                           <Shield size={12} /> AI Reason Breakdown
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed italic font-medium">
                           {event.status_message || "System currently analyzing multi-modal data signatures..."}
                        </p>
                     </div>

                     <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSuggestDispatch(event.id, 'Ambulance', event.location.lat, event.location.lng); }}
                          className="flex-1 py-2 bg-nexus-blue/10 border border-nexus-blue/40 rounded-xl text-[9px] font-orbitron font-black text-white uppercase tracking-widest hover:bg-nexus-blue transition-all flex items-center justify-center gap-2"
                        >
                           <Zap size={10} className="fill-white" /> Suggest Dispatch
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDispatch(event.id, 'Ambulance', event.location.lat, event.location.lng); }}
                          className="px-4 py-2 bg-emerald-600/10 border border-emerald-600/40 rounded-xl text-[9px] font-orbitron font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                           <Send size={10} /> Dispatch
                        </button>
                     </div>
                  </motion.div>
                )}
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center opacity-30">
               <Radio size={48} className="text-slate-500 mb-4 animate-pulse" />
               <p className="text-xs font-orbitron font-black text-slate-500 uppercase tracking-widest">Passive Mode // Awaiting Trigger</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Sidebar;
