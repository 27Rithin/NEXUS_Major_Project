from geoalchemy2.elements import WKTElement

def create_point(lat: float, lng: float, srid: int = 4326) -> WKTElement:
    """Creates a PostGIS Point geometry."""
    return WKTElement(f"POINT({lng} {lat})", srid=srid)

def create_linestring(coords: list[dict], srid: int = 4326) -> WKTElement:
    """Creates a PostGIS LineString geometry from a list of dicts with lat/lng."""
    points_str = ",".join([f"{p['lng']} {p['lat']}" for p in coords])
    return WKTElement(f"LINESTRING({points_str})", srid=srid)

def create_linestring_from_tuples(coords: list[tuple], srid: int = 4326) -> WKTElement:
    """Creates a PostGIS LineString geometry from a list of (lat, lng) tuples where tuple is (lat, lng)."""
    # Note: PostGIS expects "lng lat"
    points_str = ",".join([f"{lng} {lat}" for lat, lng in coords])
    return WKTElement(f"LINESTRING({points_str})", srid=srid)
