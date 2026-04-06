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

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 bg-[#0B0F19] virtual-section">
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
                className={`card p-5 rounded-3xl cursor-pointer transition gpu border group relative overflow-hidden ${selectedEvent?.id === event.id ? 'border-nexus-blue/60 bg-nexus-blue/5 shadow-[0_0_30px_rgba(34,211,238,0.1)]' : 'hover:bg-white/5 border-white/5'} ${
                    event.severity_level?.toUpperCase() === 'CRITICAL' ? 'glow-critical' : 
                    event.severity_level?.toUpperCase() === 'HIGH' || event.severity_level?.toUpperCase() === 'MEDIUM' ? 'glow-medium' : 
                    'glow-low'
                }`}
              >
                {selectedEvent?.id === event.id && (
                    <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1.5 bg-nexus-blue shadow-[0_0_15px_rgba(34,211,238,1)]" />
                )}
                
                {/* Status Indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 bg-black/40 rounded-full border border-white/10">
                    <div className={`w-1.5 h-1.5 rounded-full ${event.status === 'Resolved' ? 'bg-nexus-green' : 'bg-red-500 animate-pulse'} shadow-sm`} />
                    <span className="text-[7px] font-orbitron font-black text-white/60 uppercase tracking-widest">{event.status === 'Resolved' ? 'Secured' : 'Active'}</span>
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-2.5 bg-black/40 rounded-2xl border border-white/5 transition-transform group-hover:scale-110 ${
                    event.severity_level?.toUpperCase() === 'CRITICAL' ? 'text-nexus-red' : 
                    event.severity_level?.toUpperCase() === 'HIGH' || event.severity_level?.toUpperCase() === 'MEDIUM' ? 'text-nexus-orange' : 
                    'text-nexus-green'
                  }`}>
                    {getCategoryIcon(event.category)}
                  </div>
                  <div className="pr-12">
                     <h3 className="text-[12px] font-orbitron font-black text-white uppercase tracking-tight leading-none mb-1.5">{event.title || 'Unknown Signal'}</h3>
                     <div className="flex items-center gap-2 text-[9px] text-slate-500 font-bold tracking-widest">
                        <MapPin size={10} className="text-nexus-blue" /> {event.location?.lat?.toFixed(4)}, {event.location?.lng?.toFixed(4)}
                     </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-medium mb-5 leading-relaxed italic opacity-85 line-clamp-2">
                  {event.description}
                </p>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5">
                        <Zap size={14} className="text-nexus-blue" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[8px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">Priority</span>
                         <span className="text-[12px] font-orbitron font-black text-white italic">{event.priority_score?.toFixed(1) || '0.0'}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-3 border-l border-white/5 pl-4">
                      <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5">
                        <ShieldAlert size={14} className="text-nexus-blue" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[8px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">Confidence</span>
                         <span className="text-[12px] font-orbitron font-black text-white italic">{Math.round((event.confidence_score || 0) * 100)}%</span>
                      </div>
                   </div>
                </div>

                {/* Event Detail View Expansion */}
                {selectedEvent?.id === event.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-5 space-y-4">
                     <div className="bg-black/50 p-4 rounded-2xl border border-white/10 ring-1 ring-nexus-blue/10">
                        <h4 className="text-[9px] font-orbitron font-black text-nexus-blue uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                           <Shield size={12} className="fill-nexus-blue/20" /> Tactical Intelligence Breakdown
                        </h4>
                        <p className="text-[10px] text-slate-300 leading-relaxed italic font-medium border-l-2 border-nexus-blue/30 pl-3">
                           {event.status_message || "System currently analyzing multi-modal data signatures... Stand by."}
                        </p>
                     </div>

                     <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSuggestDispatch(event.id, 'Ambulance', event.location.lat, event.location.lng); }}
                          className="flex-1 py-3 bg-nexus-blue/10 border border-nexus-blue/40 rounded-2xl text-[9px] font-orbitron font-black text-white uppercase tracking-widest hover:bg-nexus-blue hover:text-black hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all flex items-center justify-center gap-2"
                        >
                           Suggest Dispatch
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDispatch(event.id, 'Ambulance', event.location.lat, event.location.lng); }}
                          className="px-6 py-3 bg-emerald-600/10 border border-emerald-600/40 rounded-2xl text-[9px] font-orbitron font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-600 hover:text-white hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all flex items-center justify-center gap-2"
                        >
                           Deploy
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
