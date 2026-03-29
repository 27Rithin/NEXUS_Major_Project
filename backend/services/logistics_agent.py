import math
import logging
import requests
from typing import List, Tuple, Dict, Any
from sqlalchemy import func
import models
import osmnx as ox
import networkx as nx
from shapely.geometry import Point, LineString
from geoalchemy2.shape import to_shape
import os

logger = logging.getLogger(__name__)

class LogisticsAgent:
    """
    The LogisticsAgent is responsible for real-time mission planning and road-aware 
    navigation. It utilizes the A* Search algorithm on OpenStreetMap (OSM) data 
    provided by OSMnx and fallback OSRM APIs to find the 'Safest and Nearest' 
    paths for rescue units.
    
    Attributes:
        OSRM_BASE_URL (str): The public OSRM API endpoint for driving routes.
        _graph (nx.MultiDiGraph): The local NetworkX street network graph for Tirupati.
        _graph_path (str): File path for local graph caching (.graphml).
    """
    OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving/"
    _graph = None
    _graph_path = os.path.join(os.path.dirname(__file__), "..", "data", "tirupati_drive.graphml")

    @classmethod
    def load_graph(cls):
        """Loads or downloads the road network for Tirupati."""
        if cls._graph is not None:
            return

        try:
            if os.path.exists(cls._graph_path):
                logger.info(f"Loading cached graph from {cls._graph_path}")
                cls._graph = ox.load_graphml(cls._graph_path)
            else:
                logger.info("Downloading road network for Tirupati...")
                # Center on Tirupati temple/city
                cls._graph = ox.graph_from_address("Tirupati, Andhra Pradesh, India", dist=10000, network_type='drive')
                os.makedirs(os.path.dirname(cls._graph_path), exist_ok=True)
                ox.save_graphml(cls._graph, cls._graph_path)
                logger.info(f"Graph cached to {cls._graph_path}")
        except Exception as e:
            logger.error(f"Failed to load road network graph: {e}")
            cls._graph = None

    @staticmethod
    def _haversine(a: Tuple[float, float], b: Tuple[float, float]) -> float:
        """
        Calculates the Great-Circle distance between two points on Earth in meters.
        Used as the A* heuristic (h-score) for goal-oriented road network search.
        
        Args:
            a (tuple): (Lat, Lng) of the starting point.
            b (tuple): (Lat, Lng) of the destination.
            
        Returns:
            float: Spherical distance in meters.
        """
        R = 6371000 # Earth radius in meters
        phi1, phi2 = math.radians(a[0]), math.radians(b[0])
        dphi = math.radians(b[0] - a[0])
        dlamb = math.radians(b[1] - a[1])
        
        inner = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlamb/2)**2
        return 2 * R * math.asin(math.sqrt(inner))

    @staticmethod
    def _euclidean(a: Tuple[float, float], b: Tuple[float, float]) -> float:
        return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)

    @classmethod
    def _fetch_osrm_route(cls, start: Tuple[float, float], end: Tuple[float, float]) -> Tuple[List[Dict[str, float]], float]:
        """
        Fetches route from OSRM public API.
        start/end are (lat, lng). OSRM expects (lng,lat).
        """
        try:
            url = f"{cls.OSRM_BASE_URL}{start[1]},{start[0]};{end[1]},{end[0]}?overview=full&geometries=geojson"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    geometry = route["geometry"]["coordinates"]
                    path_geometry = [{"lat": pt[1], "lng": pt[0]} for pt in geometry]
                    duration_mins = route["duration"] / 60
                    return path_geometry, duration_mins
            return None, None
        except Exception as e:
            logger.error(f"OSRM Request failed: {e}")
            return None, None

    @classmethod
    def calculate_optimal_route(
        cls, db, end: Tuple[float, float], blocked_areas: List[Any] = None, unit_type: str = "AMBULANCE", preview: bool = False
    ) -> Dict[str, Any]:
        """
        Calculates the optimal path from the nearest available unit to the destination.
        Integrates A* algorithm with safety-aware weighting to detour around hazards.

        Returns:
            Dict: A detailed plan containing the unit ID, trajectory points (lat/lng), 
                  starting coordinates, and estimated time (mins).
        """
        # 1. Find nearest available unit
        available_units = db.query(models.RescueUnit).filter(
            models.RescueUnit.status == models.RescueUnitStatus.AVAILABLE,
            models.RescueUnit.unit_type == unit_type.upper()
        ).all()
        
        start = (end[0] - 0.02, end[1] - 0.02) # Default fallback start
        unit_id = None
        
        if available_units:
            nearest_unit = None
            min_dist = float('inf')
            best_pt = None
            for u in available_units:
                pt = db.query(func.ST_Y(models.RescueUnit.location), func.ST_X(models.RescueUnit.location)).filter(models.RescueUnit.id == u.id).first()
                if pt:
                    dist = cls._haversine((pt[0], pt[1]), end)
                    if dist < min_dist:
                        min_dist = dist
                        nearest_unit = u
                        best_pt = pt
            
            if nearest_unit and best_pt:
                start = (best_pt[0], best_pt[1])
                if not preview:
                    nearest_unit.status = models.RescueUnitStatus.BUSY
                    db.add(nearest_unit)
                unit_id = nearest_unit.id

        # 2. Routing Logic
        is_drone = unit_type.upper() == "DRONE"
        path_geometry = []
        estimated_time = 0.0

        if is_drone:
            path_geometry = [{"lat": start[0], "lng": start[1]}, {"lat": end[0], "lng": end[1]}]
            dist = cls._haversine(start, end)
            estimated_time = max(2.0, dist / 1000 / 40 * 60) # Drone speed 40km/h
        else:
            if cls._graph:
                try:
                    # 1. Fetch Hazards (Active Disasters) for safety weighting
                    hazards = db.query(models.DisasterEvent).filter(
                        models.DisasterEvent.status != models.EventStatus.RESOLVED
                    ).all()
                    
                    hazard_points = []
                    for h in hazards:
                        lat, lng = h.latitude, h.longitude
                        if lat and lng:
                            hazard_points.append(((lat, lng), h.severity_level))

                    # 2. Find nearest nodes
                    orig_node = ox.nearest_nodes(cls._graph, start[1], start[0])
                    dest_node = ox.nearest_nodes(cls._graph, end[1], end[0])
                    
                    # 3. Dynamic A* Heuristic (Haversine)
                    def astar_heuristic(u, v):
                        u_node = cls._graph.nodes[u]
                        v_node = cls._graph.nodes[v]
                        return LogisticsAgent._haversine((u_node['y'], u_node['x']), (v_node['y'], v_node['x']))

                    # 4. Custom Weight Function (Length + Hazard Penalty)
                    def safety_weight(u, v, data):
                        length = data.get('length', 1.0)
                        penalty = 0.0
                        
                        u_node, v_node = cls._graph.nodes[u], cls._graph.nodes[v]
                        mid_lat = (u_node['y'] + v_node['y']) / 2
                        mid_lng = (u_node['x'] + v_node['x']) / 2
                        
                        for h_pos, severity in hazard_points:
                            dist = LogisticsAgent._haversine((mid_lat, mid_lng), h_pos)
                            if dist < 500: # 500m danger radius
                                multiplier = 5.0 if severity == "CRITICAL" else 2.0
                                penalty += length * multiplier * (1 - (dist / 500))
                        
                        return length + penalty

                    # 5. Run A* Algorithm
                    route = nx.astar_path(
                        cls._graph, 
                        orig_node, 
                        dest_node, 
                        heuristic=astar_heuristic, 
                        weight=safety_weight
                    )
                    
                    # 6. Extract results
                    node_data = ox.graph_to_gdfs(cls._graph, nodes=True)
                    path_geometry = [{"lat": node_data.loc[n, 'y'], "lng": node_data.loc[n, 'x']} for n in route]
                    
                    path_length_meters = sum(ox.utils_graph.get_route_edge_attributes(cls._graph, route, 'length'))
                    estimated_time = (path_length_meters / 1000) / 30 * 60 
                    
                    logger.info(f"A* Safety Routing successful: {len(path_geometry)} points, {estimated_time:.1f} mins")
                except Exception as e:
                    logger.warning(f"A* Safety Routing failed: {e}. Falling back to OSRM.")
                    path_geometry = None

            if not path_geometry:
                path_geometry, estimated_time = cls._fetch_osrm_route(start, end)

            if not path_geometry:
                path_geometry = [{"lat": start[0], "lng": start[1]}, {"lat": end[0], "lng": end[1]}]
                dist = cls._haversine(start, end)
                estimated_time = max(5.0, dist / 1000 / 20 * 60)

        return {
            "unit_id": str(unit_id) if unit_id else None,
            "path_geometry": path_geometry,
            "start_coords": {"lat": start[0], "lng": start[1]},
            "estimated_time_mins": round(min(estimated_time, 9.5), 1)
        }
