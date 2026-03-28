# NEXUS – Multi-Modal Disaster Response Agent

NEXUS is an intelligent, microservices-based, full-stack application designed to aggregate and analyze multimodal disaster data (Social Media text, Drone/Satellite Imagery, and Weather APIs) to assist emergency responders in real-time.

It leverages a custom **Cross-Modal Reasoning Engine** to calculate an actionable Priority Score and automatically employs the **A* Algorithm** for logistics optimization to generate safe rescue paths avoiding blocked roads.

---

## 🏗️ System Architecture

The architecture separates the logic into distinct Agents, mimicking a distributed microservices environment while running locally as a cohesive monolith for development ease.

1. **Frontend (React + Vite, Leaflet)**: Provides an interactive dashboard map for responders to view incidents, severity levels, and route geometries.
2. **Backend (Python + FastAPI)**: A high-performance API server managing the following Intelligent Agents:
   - **Social Media Monitoring Agent**: Ingests streams and runs NLP keyword classification to determine emergency context.
   - **Vision Analysis Agent**: Analyzes uploaded visual evidence (drone imagery) using mocked YOLO/lightweight models to assess physical destruction severity.
   - **Weather Verification Agent**: Validates alerts with environmental context (e.g., assessing flood risks against current heavy rainfall data).
   - **Decision Engine**: Fuses the multi-modal data using weighted algorithms.
   - **Logistics Optimization Agent**: Uses spatial pathfinding (A*) to chart secure rescue routes.
3. **Database (PostgreSQL + PostGIS)**: Relational data storage utilizing advanced spatial extensions `GEOMETRY(Point, 4326)` for geographic computations.

---

## 🚀 Setup & Local Deployment

### Prerequisites
1. **Node.js**: Installed (v18+ recommended)
2. **Python**: Installed (v3.10+ recommended)
3. **PostgreSQL**: Installed and running locally on port 5432.
4. **PostGIS**: Extension installed on your PostgreSQL server.

### 1. Database Setup
1. Open pgAdmin or `psql` and create a database named `nexus`.
   ```sql
   CREATE DATABASE nexus;
   ```
2. Connect to the `nexus` database and execute the `database/schema.sql` file to create the tables, indexes, and enable PostGIS.
3. Execute `database/sample_data.sql` to populate some dummy data for the Viva demonstration.

### 2. Backend Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Activate your Virtual Environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   # OR
   pip install fastapi "uvicorn[standard]" sqlalchemy geoalchemy2 asyncpg psycopg2-binary python-dotenv pydantic-settings shapely
   ```
4. Start the Application:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 3. Frontend Setup
1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the dashboard via `http://localhost:5173`.
