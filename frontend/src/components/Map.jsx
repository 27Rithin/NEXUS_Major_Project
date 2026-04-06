import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToStaticMarkup } from 'react-dom/server';
import { 
  Shield, MapPin, Activity, Navigation, Radio, 
  Flame, Droplets, Heart, Car, AlertOctagon,
  ShieldAlert, Send, Clock, LocateFixed
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CUSTOM HIGH-FIDELITY ICONS ---
const createCustomIcon = (category, severity_level, isSOS = false) => {
  const getIconColor = (level) => {
    const l = level?.toUpperCase();
    if (!l) return '#64748B'; 
    if (l === 'CRITICAL') return '#EF4444';
    if (l === 'HIGH' || l === 'MEDIUM') return '#F97316';
    return '#22C55E';
  };

  const getIcon = (cat) => {
    const c = cat?.toUpperCase();
    if (c === 'FIRE') return <Flame size={20} />;
    if (c === 'FLOOD') return <Droplets size={20} />;
    if (c === 'MEDICAL') return <Heart size={20} />;
    if (c === 'ACCIDENT') return <Car size={20} />;
    if (c === 'SOS' || isSOS) return <ShieldAlert size={isSOS ? 32 : 24} />;
    return <AlertOctagon size={20} />;
  };

  const color = getIconColor(severity_level);
  const iconMarkup = renderToStaticMarkup(
    <div className={`relative flex items-center justify-center ${isSOS ? 'animate-pulse-sos scale-125 z-[1000]' : ''}`}>
      {/* HOLOGRAPHIC BEACON */}
      <div 
        className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-[2px] h-[50px] origin-bottom animate-pulse"
        style={{ 
          background: `linear-gradient(to top, ${color}, transparent)`,
          boxShadow: `0 0 15px ${color}`
        }}
      />
      {/* GLOW SHADOW */}
      <div 
        className={`absolute inset-0 rounded-full blur-[15px] opacity-60`}
        style={{ backgroundColor: color }}
      />
      {/* MAIN ICON BODY */}
      <div 
        className={`relative p-2.5 rounded-2xl border-2 shadow-2xl transition-smooth flex items-center justify-center bg-[#0B0F19]/90 backdrop-blur-xl`}
        style={{ borderColor: color, color: color, zIndex: isSOS ? 1001 : 1, boxShadow: `0 0 20px ${color}40` }}
      >
        {getIcon(category)}
      </div>
    </div>
  );

  return L.divIcon({
    html: iconMarkup,
    className: 'custom-leaflet-icon',
    iconSize: isSOS ? [64, 64] : [48, 48],
    iconAnchor: [24, 24],
  });
};

const VehicleIcon = (type) => {
    const ut = type?.toUpperCase();
    let IconComp = Send;
    if ("FIRE" in ut || "ENGINE" in ut) IconComp = Flame;
    else if ("AMBULANCE" in ut || "MEDICAL" in ut) IconComp = Heart;

    const iconMarkup = renderToStaticMarkup(
        <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-nexus-blue rounded-full blur-[8px] opacity-60 animate-pulse" />
            <div className="relative p-2 bg-nexus-blue rounded-full border-2 border-white/20 text-white shadow-lg">
                <IconComp size={16} />
            </div>
        </div>
    );
    return L.divIcon({ html: iconMarkup, className: 'vehicle-icon', iconSize: [32, 32], iconAnchor: [16, 16] });
};

// --- MAP AUTO-CENTERING CONTROLLER ---
const MapController = ({ selectedEvent }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedEvent && selectedEvent.location) {
      map.flyTo([selectedEvent.location.lat, selectedEvent.location.lng], 16, { animate: true, duration: 1.5 });
    }
  }, [selectedEvent, map]);
  return null;
};

const NexusMap = ({ events, selectedEvent, activeRoute, onSelectEvent }) => {
  const [mapReady, setMapReady] = useState(false);

  // CartoDB Dark Matter fits the 'NEXUS BLACK' aesthetic perfectly
  const mapStyle = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[13.6288, 79.4192]} 
        zoom={13} 
        style={{ width: '100%', height: '100%', background: '#0B0F19' }}
        zoomControl={false}
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={mapStyle}
        />

        <MapController selectedEvent={selectedEvent} />

        {/* --- INCIDENT MARKERS --- */}
        <AnimatePresence>
          {events.map((event) => (
            <Marker
              key={event.id}
              position={[event.location.lat, event.location.lng]}
              icon={createCustomIcon(event.category, event.severity_level, event.category?.toUpperCase() === 'SOS')}
              eventHandlers={{
                click: () => onSelectEvent(event),
              }}
            >
              <Popup className="nexus-popup">
                <div className="p-1 min-w-[200px]">
                   <h3 className="text-[11px] font-orbitron font-black text-white uppercase tracking-tighter mb-2 border-b border-white/5 pb-1 flex items-center gap-2">
                       <Shield size={14} className="text-nexus-blue" /> {event.title || 'UNKNOWN SIGNAL'}
                   </h3>
                   <div className="space-y-2">
                       <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-white/5">
                            <span className="text-[9px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">Severity</span>
                            <span className={`text-[10px] font-orbitron font-black uppercase tracking-widest 
                                ${!event.severity_level ? 'text-slate-500' :
                                  event.severity_level === 'CRITICAL' ? 'text-nexus-red' : 
                                  event.severity_level === 'MEDIUM' ? 'text-nexus-orange' : 'text-nexus-green'}`}>
                                {event.severity_level || 'ANALYZING...'}
                            </span>
                       </div>
                       <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed opacity-80">
                           {event.description || 'Analysis pending...'}
                       </p>
                   </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </AnimatePresence>

        {/* --- NEON ROUTE VISUAL --- */}
        {activeRoute && activeRoute.path_geometry && (
          <>
            {/* NEON OUTER GLOW */}
            <Polyline
              positions={activeRoute.path_geometry}
              pathOptions={{
                color: '#22D3EE',
                weight: 12,
                opacity: 0.2,
                lineJoin: 'round',
                lineCap: 'round',
                dashArray: '1, 15',
                className: 'animate-pulse'
              }}
            />
            {/* MAIN ROUTE LINE */}
            <Polyline
              positions={activeRoute.path_geometry}
              pathOptions={{
                color: '#22D3EE',
                weight: 4,
                opacity: 0.9,
                lineJoin: 'round',
                lineCap: 'round',
                dashArray: '2, 10',
                className: 'animate-route-flow' // Custom CSS for flowing dash
              }}
            >
                <Popup className="nexus-popup glass-card">
                    <div className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3 text-nexus-blue">
                            <Navigation size={20} className="animate-pulse" />
                            <span className="text-sm font-orbitron font-black italic tracking-widest">TACTICAL INTERCEPT</span>
                        </div>
                        <div className="bg-black/60 p-3 rounded-2xl border border-nexus-blue/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                            <div className="text-[10px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">PREDICTED ARRIVAL // ETA</div>
                            <div className="text-3xl font-orbitron font-black text-white tracking-widest leading-none mt-2 italic shadow-nexus">
                                {activeRoute.estimated_time_mins || 8.5} <span className="text-[10px] ml-1 text-nexus-blue">MIN</span>
                            </div>
                        </div>
                    </div>
                </Popup>
            </Polyline>

            {/* RESCUE VEHICLE ICON */}
            {activeRoute.path_geometry.length > 0 && (
                <Marker 
                    position={activeRoute.path_geometry[0]} 
                    icon={VehicleIcon(activeRoute.unit_type || 'AMBULANCE')} 
                />
            )}
          </>
        )}

        {/* UI OVERLAYS */}
        <div className="absolute bottom-10 right-10 z-[1000] flex flex-col gap-3">
             <button onClick={() => { if (selectedEvent) onSelectEvent(selectedEvent); }} className="w-12 h-12 bg-nexus-blue rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all border-2 border-white/20">
                <LocateFixed size={24} className="text-white" />
             </button>
        </div>

      </MapContainer>
    </div>
  );
};

export default NexusMap;
