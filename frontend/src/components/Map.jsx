import React, { useEffect, useMemo, useState, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.heat';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShieldAlert, Truck, Flame, Ship, Navigation, MapPin, Flag, Building } from 'lucide-react';
import { getDisasterConfig } from '../config/disasterTypes';
import api from '../services/api';

// Fix for default Leaflet markers in React
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetina,
    iconUrl: iconUrl,
    shadowUrl: shadowUrl,
});

const DEFAULT_CENTER = [13.6288, 79.4192]; // Tirupati, Andhra Pradesh

// Heatmap Layer Component
const HeatmapLayer = memo(function HeatmapLayer({ points }) {
    const map = useMap();
    useEffect(() => {
        if (!points || points.length === 0) return;
        const heat = L.heatLayer(points, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: { 0.4: '#3b82f6', 0.6: '#06b6d4', 0.7: '#10b981', 0.8: '#f59e0b', 1.0: '#ef4444' }
        }).addTo(map);
        return () => {
            map.removeLayer(heat);
        };
    }, [map, points]);
    return null;
});

// Component to dynamically recenter map with smooth flyTo animation
const MapUpdater = memo(function MapUpdater({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom, {
                duration: 1.5,
                easeLinearity: 0.25 // Smooth easing
            });
        }
    }, [center, zoom, map]);
    return null;
});

// Component to track zoom level for icon scaling
const ZoomManager = ({ setZoom }) => {
    const map = useMap();
    useEffect(() => {
        const handleZoom = () => setZoom(map.getZoom());
        map.on('zoomend', handleZoom);
        return () => map.off('zoomend', handleZoom);
    }, [map, setZoom]);
    return null;
};

/**
 * Component for rendering a Professional Mission Route on the map.
 * Features: A* geographic path, Solid Neon aesthetic, and Radar-Blip animation.
 * 
 * @param {Object} props
 * @param {Object} props.route - The route data object returned from the Logistics Agent.
 * @returns {JSX.Element|null}
 */
function AnimatedRoute({ route }) {
    const map = useMap();
    const [progress, setProgress] = useState(0);
    const pathCoords = useMemo(() => 
        (route.route_waypoints || route.path_geometry || []).map(p => [p.lat, p.lng]),
    [route]);
    
    const isDrone = (route.unit_type || "").toLowerCase().includes("drone");
    const durationMs = 8000;

    useEffect(() => {
        if (pathCoords.length >= 2) {
            const bounds = L.latLngBounds(pathCoords);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    }, [pathCoords, map]);

    useEffect(() => {
        let start = null;
        let animationFrame;
        let isPaused = false;

        const animate = (timestamp) => {
            if (!start) start = timestamp;

            if (!isPaused) {
                const elapsed = timestamp - start;
                const currentProgress = Math.min(elapsed / durationMs, 1);
                setProgress(currentProgress);

                if (currentProgress < 1) {
                    animationFrame = requestAnimationFrame(animate);
                } else {
                    isPaused = true;
                    setTimeout(() => {
                        isPaused = false;
                        start = null; 
                        animationFrame = requestAnimationFrame(animate);
                    }, 1500);
                }
            } else {
                animationFrame = requestAnimationFrame(animate); 
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [pathCoords]);

    if (!pathCoords || pathCoords.length < 2) return null;

    const visiblePointsCount = Math.max(2, Math.floor(pathCoords.length * progress));
    const visiblePath = pathCoords.slice(0, visiblePointsCount);
    const currentPos = visiblePath[visiblePath.length - 1];

    const polylineOptions = {
        color: '#ffffff',
        weight: isDrone ? 4 : 6,
        opacity: 0.95,
        className: 'route-line-professional',
        lineCap: 'round',
        lineJoin: 'round'
    };

    const originPos = pathCoords[0];
    const destPos = pathCoords[pathCoords.length - 1];
    const midIndex = Math.floor(pathCoords.length / 2);
    const midpoint = pathCoords[midIndex];

    const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `<div class="relative flex items-center justify-center p-0.5">
                 <div class="absolute inset-0 bg-blue-500 rounded-full vehicle-radar-blip opacity-30"></div>
                 <div style="background: white; border: 2px solid #3b82f6; width: 24px; height: 24px; border-radius: 50%; box-shadow: 0 0 15px white; position: relative; z-index: 10;">
                   <div class="absolute inset-2 bg-blue-500 rounded-full animate-pulse"></div>
                 </div>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const destIcon = L.divIcon({
        className: 'dest-marker',
        html: `<div class="relative flex items-center justify-center">
                 <div class="absolute -inset-4 rounded-full bg-red-500/30 animate-ping"></div>
                 <div class="bg-red-500 border-2 border-white w-5 h-5 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.9)]"></div>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    // Helper for specialized unit icons
    const getUnitEmoji = (type) => {
        const t = (type || "").toUpperCase();
        if (t.includes("FIRE") || t.includes("ENGINE")) return "🚒";
        if (t.includes("DRONE") || t.includes("SCOUT")) return "🛸";
        if (t.includes("BOAT")) return "🚤";
        return "🚑"; // Default Ambulance
    };

    return (
        <>
            <Polyline 
                positions={pathCoords} 
                pathOptions={{ ...polylineOptions, opacity: 0.15, weight: 12, color: '#ffffff', className: 'route-glow-foundation' }} 
            />
            <Polyline 
                positions={visiblePath} 
                pathOptions={polylineOptions}
            >
                <Tooltip sticky>
                    <div className="flex flex-col gap-1 p-1 bg-slate-900/90 backdrop-blur-md rounded border border-white/20">
                        <span className="font-bold text-white uppercase tracking-tighter text-[10px]">Unit: {route.callsign || 'Rescue'}</span>
                        <span className="text-blue-400 font-mono text-[11px]">ETA: {route.estimated_arrival_seconds ? Math.round(route.estimated_arrival_seconds / 60) : Math.round(route.estimated_time_mins || 0)} MIN</span>
                    </div>
                </Tooltip>
            </Polyline>
            
            <Marker position={midpoint} opacity={0}>
                <Tooltip permanent direction="top" className="eta-tooltip">
                    <div className="bg-slate-900/90 text-white text-[10px] font-bold px-2 py-1 rounded border border-cyan-500/50 backdrop-blur-sm shadow-xl">
                        ~{route.estimated_arrival_seconds ? Math.round(route.estimated_arrival_seconds / 60) : Math.round(route.estimated_time_mins || 0)} min
                    </div>
                </Tooltip>
            </Marker>

            <Marker position={originPos} zIndexOffset={50000} icon={L.divIcon({
                className: 'start-marker',
                html: `<div class="bg-slate-800 p-1.5 rounded border border-slate-600 shadow-lg">${getUnitEmoji(route.unit_type)}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            })}>
                <Tooltip direction="top" offset={[0, -10]} sticky className="coordinate-tooltip">
                    <div className="bg-slate-900/90 text-[10px] text-cyan-400 p-1 font-mono rounded border border-cyan-500/30">
                        UNIT: {originPos[0].toFixed(4)}, {originPos[1].toFixed(4)}
                    </div>
                </Tooltip>
            </Marker>
            
            <Marker position={destPos} zIndexOffset={50000} icon={destIcon}>
                <Tooltip direction="top" offset={[0, -5]} sticky className="coordinate-tooltip">
                    <div className="bg-slate-900/90 text-[10px] text-red-400 p-1 font-mono rounded border border-red-500/30">
                        TARGET: {destPos[0].toFixed(4)}, {destPos[1].toFixed(4)}
                    </div>
                </Tooltip>
            </Marker>
            <Marker position={currentPos} icon={vehicleIcon} zIndexOffset={1001} />
        </>
    );
}

const NexusMap = memo(function NexusMap({ events, selectedEvent, activeRoute, onSelectEvent, onTriggerAI, showHeatmap }) {
    const [zoomLevel, setZoomLevel] = useState(12);
    const center = useMemo(() => {
        if (selectedEvent?.location?.lat !== undefined && selectedEvent?.location?.lng !== undefined) {
            return [selectedEvent.location.lat, selectedEvent.location.lng];
        }
        return DEFAULT_CENTER;
    }, [selectedEvent]);

    // Create a dynamic custom SVG icon based on the Severity and DisasterType
    const getMarkerIcon = (event, currentZoom) => {
        const category = event.category || "Default";
        const config = getDisasterConfig(category);
        const IconComponent = config.icon || ShieldAlert;
        const severity = (event.severity_level || "LOW").toUpperCase();
        const isSOS = category.toUpperCase().includes("SOS");

        // 1. Severity Colors (Requirements)
        let color = "#22C55E"; // LOW -> GREEN
        let glowClass = "low-glow";

        if (severity === "CRITICAL" || isSOS) {
            color = "#EF4444"; // CRITICAL -> RED
            glowClass = isSOS ? "sos-alert" : "critical-glow";
        } else if (severity === "MEDIUM") {
            color = "#F97316"; // MEDIUM -> ORANGE
            glowClass = "medium-glow";
        }

        // 2. Zoom Level Scaling
        let baseSize = 32;
        if (currentZoom < 10) baseSize = 24;
        else if (currentZoom > 14) baseSize = 44;

        if (isSOS) baseSize *= 1.4;
        else if (severity === "CRITICAL") baseSize *= 1.2;

        const iconSize = baseSize;
        const innerIconSize = iconSize * 0.6;

        const iconHtml = renderToStaticMarkup(
            <IconComponent size={innerIconSize} color="#fff" strokeWidth={2.5} />
        );

        // Special Effects
        let specialEffects = "";
        if (category.includes("FLOOD")) {
            specialEffects = `<div class="animate-ripple" style="color: ${color}"></div>`;
        } else if (category.includes("FIRE")) {
            specialEffects = `<div class="absolute inset-0 animate-flicker" style="background: radial-gradient(circle, ${color}33 0%, transparent 70%)"></div>`;
        }

        const divHtml = `
            <div class="relative flex items-center justify-center transition-all ${glowClass}" style="width: ${iconSize}px; height: ${iconSize}px; z-index: ${isSOS ? 9999 : (severity === 'CRITICAL' ? 1000 : 1)}">
                ${specialEffects}
                <div class="absolute inset-0 rounded-full border-2" style="border-color: ${color}; background-color: ${color}1a;"></div>
                <div class="absolute inset-[10%] rounded-full flex items-center justify-center border-2 border-slate-900 shadow-xl" style="background-color: ${color};">
                    ${iconHtml}
                </div>
            </div>
        `;

        return L.divIcon({
            className: 'bg-transparent border-none',
            html: divHtml,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2],
            popupAnchor: [0, -iconSize / 2]
        });
    };

    // Calculate cluster styles dynamically based on highest severity
    const createClusterCustomIcon = function (cluster) {
        const markers = cluster.getAllChildMarkers();
        let highestSeverity = "LOW";

        markers.forEach(m => {
            const ev = m.options.event;
            const sev = (ev?.severity_level || "").toUpperCase();
            const isSOS = ev?.category?.includes("SOS");
            
            if (sev === "CRITICAL" || isSOS) highestSeverity = "CRITICAL";
            else if (sev === "MEDIUM" && highestSeverity !== "CRITICAL") highestSeverity = "MEDIUM";
        });

        const clusterClass = highestSeverity === "CRITICAL" ? "cluster-critical" : 
                            (highestSeverity === "MEDIUM" ? "cluster-medium" : "cluster-low");

        return L.divIcon({
            html: `<div class="cluster-inner ${clusterClass}">
                    <span>${markers.length}</span>
                   </div>`,
            className: 'custom-marker-cluster',
            iconSize: L.point(40, 40, true),
        });
    };

    return (
        <MapContainer
            center={DEFAULT_CENTER}
            zoom={12}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            zoomControl={false}
            zoomAnimation={true}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />

            <MapUpdater center={center} zoom={selectedEvent ? 15 : 12} />
            <ZoomManager setZoom={setZoomLevel} />

            {showHeatmap && (
                <HeatmapLayer points={events.filter(e => e.location?.lat && e.location?.lng).map(e => [e.location.lat, e.location.lng, (e.priority_score || 5) / 10])} />
            )}

            {/* Performance Clustering Layer */}
            <MarkerClusterGroup
                chunkedLoading
                iconCreateFunction={createClusterCustomIcon}
                maxClusterRadius={40}
                spiderfyOnMaxZoom={true}
            >
                {/* Render Event Markers with Draggable capabilities */}
                {events.filter(e => e.location?.lat !== undefined && e.location?.lng !== undefined).map((event) => (
                    <Marker
                        key={event.id}
                        position={[event.location.lat, event.location.lng]}
                        icon={getMarkerIcon(event, zoomLevel)}
                        event={event}
                        draggable={true}
                        zIndexOffset={event.category.includes("SOS") ? 10000 : (event.severity_level === "CRITICAL" ? 5000 : 0)}
                        eventHandlers={{
                            click: () => onSelectEvent(event),
                            dragend: async (e) => {
                                const marker = e.target;
                                const position = marker.getLatLng();
                                
                                // Call Backend to update location
                                try {
                                    const response = await api.patch(`/events/${event.id}/location`, {
                                        lat: position.lat,
                                        lng: position.lng
                                    });
                                    
                                    if (response.status === 200) {
                                        // Update local state if necessary or let WebSocket broadcast handle it
                                        onSelectEvent({ ...event, location: { lat: position.lat, lng: position.lng } });
                                    }
                                } catch (err) {
                                    console.error("Failed to update event location:", err);
                                }
                            }
                        }}
                    >
                        {/* Premium Glassmorphism Popup directly embedded on the map */}
                        <Popup className="glass-popup border-none p-0 backdrop-blur-xl" closeButton={false} minWidth={240}>
                            <div className="p-4 flex flex-col gap-3">
                                <h3 className="font-bold text-sm m-0 leading-tight text-white">{event.title}</h3>

                                <div className="text-xs text-slate-300 flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Category</span>
                                        <span style={{ color: getDisasterConfig(event.category).color }} className="font-semibold">{event.category}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Status</span>
                                        <span className="text-slate-200">{event.status}</span>
                                    </div>

                                    {/* Animated Progress Bar for Severity */}
                                    <div className="mt-1 flex flex-col gap-2">
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Priority Score</span>
                                                <span className="text-white font-bold">{(event.priority_score || 0).toFixed(1)}/10</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{
                                                        width: `${((event.priority_score || 0) / 10) * 100}%`,
                                                        backgroundColor: (event.priority_score || 0) >= 0.75 ? '#ef4444' : (event.priority_score || 0) >= 0.4 ? '#f59e0b' : '#3b82f6'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Confidence</span>
                                                <span className="text-white font-bold">{((event.confidence_score || 0) * 100).toFixed(0)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{
                                                        width: `${(event.confidence_score || 0) * 100}%`,
                                                        backgroundColor: (event.confidence_score || 0) >= 0.7 ? '#10b981' : (event.confidence_score || 0) >= 0.4 ? '#f59e0b' : '#ef4444'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Embedded Action Button */}
                                {event.status === 'Pending' && onTriggerAI && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onTriggerAI(event.id); }}
                                        className="mt-2 w-full bg-indigo-600/90 hover:bg-indigo-500 text-white text-[11px] font-bold py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                                    >
                                        <ShieldAlert size={14} /> Run Cross-Modal Reasoning
                                    </button>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MarkerClusterGroup>

            {/* Render Active Animated Route if any */}
            {activeRoute && (activeRoute.route_waypoints || activeRoute.path_geometry) && (
                <AnimatedRoute
                    key={activeRoute.id || `${activeRoute.unit_type || 'unit'}:${(activeRoute.route_waypoints || activeRoute.path_geometry)?.length || 0}`}
                    route={activeRoute}
                />
            )}
        </MapContainer>
    );
});

export default NexusMap;
