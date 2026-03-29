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
    if (!l) return '#64748B'; // Professional Slate Gray
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
    <div className={`relative flex items-center justify-center ${isSOS ? 'animate-sos scale-125 z-[1000]' : ''}`}>
      {/* GLOW SHADOW */}
      <div 
        className="absolute inset-0 rounded-full blur-[10px]" 
        style={{ backgroundColor: color, opacity: 0.4 }}
      />
      {/* MAIN ICON BODY */}
      <div 
        className={`relative p-2 rounded-xl border-2 shadow-2xl transition-all flex items-center justify-center bg-[#0B0F19]/90`}
        style={{ borderColor: color, color: color, zIndex: isSOS ? 1001 : 1 }}
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
                color: '#3B82F6',
                weight: 12,
                opacity: 0.15,
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
                color: '#3B82F6',
                weight: 4,
                opacity: 0.9,
                lineJoin: 'round',
                lineCap: 'round',
                dashArray: '2, 12'
              }}
            >
                <Popup className="nexus-popup">
                    <div className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2 text-nexus-blue">
                            <Navigation size={18} className="animate-pulse" />
                            <span className="text-sm font-orbitron font-black italic">EN ROUTE</span>
                        </div>
                        <div className="bg-black/40 p-2 rounded-lg border border-nexus-blue/20">
                            <div className="text-[10px] font-orbitron font-bold text-slate-500 uppercase tracking-widest">ETA // PREDICTED</div>
                            <div className="text-2xl font-orbitron font-black text-white tracking-widest leading-none mt-1 italic">
                                {activeRoute.estimated_time_mins || 8.5} <span className="text-[10px] ml-1">MIN</span>
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
