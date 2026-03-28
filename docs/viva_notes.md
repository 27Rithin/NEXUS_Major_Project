# MCA Major Project: Viva Explanation Notes

This document provides a clear, technical explanation of the core algorithmic concepts used in the NEXUS system to help you prepare for your final Viva.

---

## 1. Cross-Modal Reasoning Engine

**Question: "How does the Decision Engine determine the Priority Score?"**

**Explanation:**
The system uses "early-fusion" cross-modal reasoning. It takes inputs from three entirely different modalities: Text (Social Media NLP), Vision (Image analysis severity), and Weather data. 

Because text can be exaggerated (false positives), and images might be blurry, no single modality is trusted entirely. We use a **Weighted Sum Model**:

```python
Priority Score = (Weight_Vision * Vision_Score) + (Weight_NLP * NLP_Score) + (Weight_Weather * Weather_Score)
```

In our implementation (`backend/services/decision_engine.py`), the weights are distributed as:
- **Vision (0.4)**: Strongest indicator since visual damage is tangible proof.
- **NLP (0.3)**: High context value (people crying for help), but liable to rumors.
- **Weather (0.3)**: Provides situational context (heavy rains validate flood claims).

The total score normalizes between `0.0` and `1.0`. If the `Priority Score > 0.75` (Threshold Limit), the backend automatically triggers the Logistics Agent to generate emergency rescue parameters.

---

## 2. Logistics Agent (A* Algorithm)

**Question: "How does the route optimization avoid blocked roads?"**

**Explanation:**
The Logistics module uses a simulated conceptual implementation of the **A* (A-Star) Pathfinding Algorithm**.

1. **Heuristics**: A* extends Dijkstra's shortest path by injecting a Heuristic cost function (Euclidean distance).
   - `f(n) = g(n) + h(n)`
   - `g(n)`: Actual cost from Start node to current node.
   - `h(n)`: Estimated (Heuristic) cost to the Destination.
2. **Blocked Areas**: In a production environment (`pgRouting`), edges associated with high-severity blockages are dynamically assigned infinite weights. In our logic simulation, the agent detects intersections with predefined `LineStrings` (from PostGIS) denoting blockages and routes intermediate waypoints around them before calculating the final distance matrix array.

---

## 3. PostGIS and Spatial Database

**Question: "Why PostGIS and GeoAlchemy2 instead of standard Float columns?"**

**Explanation:**
Standard Float columns (`lat`, `lng`) are inefficient for calculating area overlaps or computing distances between two locations (which requires complex Haversine formulas in code). PostGIS provides native indexed data types (`GEOMETRY`) inside PostgreSQL.

We use `GIST` indexes on our table location columns. This allows PostgreSQL to utilize R-Trees to instantly find "all blocked roads within a 5-mile radius of the disaster point" using operations like `ST_DWithin` and `ST_Intersects` at the database layer rather than pulling all rows into Python.

---

## 4. Microservices Design in a Monolith

**Question: "You mentioned Microservices architecture, but this is a monolith?"**

**Explanation:**
This structure is frequently called a "Modular Monolith". The code inside `/backend/services/` acts as isolated bounded contexts. The `VisionAgent` does not directly share state with the `SocialAgent`. They solely communicate via the `DecisionEngine` orchestration layer. This makes it trivial to extract any single agent into its own Docker container in the future.
