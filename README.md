# FRA Claims Regulation (SIH 12508)

A full-stack web application for FRA Claims Regulation with:
- Backend: Python + Flask (API server)
- Frontend: React + Vite + Leaflet.js

## Prerequisites
- Python 3.8+
- Node.js 18+ and npm

## Project Structure
- `backend/`: Flask API
- `frontend/`: Vite React app
- `infra/`: infra placeholders

## Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# configure env
cp .env .env.local 2>/dev/null || true
# run dev server
python wsgi.py
# or with gunicorn
# gunicorn -w 2 -b 0.0.0.0:5001 wsgi:app
```

Default backend env (`backend/.env`):
```
FLASK_ENV=development
PORT=5001
CORS_ORIGINS=http://localhost:5173
```

## Frontend Setup
```bash
cd frontend
npm install
# set backend API base
echo "VITE_API_BASE=http://localhost:5001/api" > .env.local
npm run dev
```
Vite will print local and network URLs (default `http://localhost:5173`).

## Features
- WebGIS interactive map (Leaflet + OSM tiles) with served GeoJSON layers
- Decision Support (protected recommendations endpoint)
- AI Insights (protected metrics)
- Dashboard (protected summary)
- Auth (JWT demo: admin/admin123) with refresh tokens
- About + health check

## API Endpoints
- `GET /health`
- `POST /api/auth/login` (returns access + refresh tokens)
- `POST /api/auth/refresh` (use refresh token in Authorization header)
- `GET /api/map/layers`
- `GET /api/decisions/recommendations`
- `GET /api/ai/insights`
- `GET /api/dashboard/summary`
- `GET /api/map/geojson/:layer_id` (states, fra_claims)

### Roles
- `admin`: full access, can view AI insights
- `officer`: access to map, dashboard, recommendations

RBAC is enforced server-side via role checks. Demo users:
- admin: `admin@example.com` / `+911234567890` (password: `admin123`)
- officer: `officer@example.com` / `+919876543210` (password: `officer123`)

### Refresh Tokens
- Backend issues `access_token` (2h) and `refresh_token` (7d)
- Use `POST /api/auth/refresh` with `Authorization: Bearer <refresh_token>` to obtain a new access token
- Frontend auto-refreshes on 401 and retries the failed request

## Notes
- Adjust `VITE_API_BASE` in `frontend/.env.local` for different backend hosts.
- CORS origins can be set via `CORS_ORIGINS` in backend `.env`.

### Official Boundary Data (GADM/NIC)
- Place official GeoJSON files in `backend/app/assets/` with these names:
  - `india.geojson`, `mh.geojson`, `mp.geojson`, `od.geojson`, `tr.geojson`
- Endpoints will serve them automatically:
  - `GET /api/map/geojson/india|mh|mp|od|tr`
- Keep properties like `name` and `state_code` for consistent display.

## Deployment (Docker Compose)
```bash
docker compose build
docker compose up -d
```
- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5001`

Set a strong secret: `export SECRET_KEY=your-secret && docker compose up -d`.
