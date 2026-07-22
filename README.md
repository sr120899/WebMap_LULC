# WebMap LULC — Bangkok Land Use / Land Cover Change Platform

A web map application for detecting and visualizing Land Use / Land Cover (LULC) change in
Bangkok between any two years (2016–2026), built on Google Earth Engine's **Dynamic World V1**
dataset. Users pick two years (T1/T2), and the app computes a per-pixel land-cover crosstab and
renders both years as swipeable map layers with area statistics in km² and ไร่ (rai).

## Features

- Interactive Leaflet map with a T1/T2 swipe (split) comparison
- Multiple basemaps: OpenStreetMap, Light (CartoDB Positron), Dark (CartoDB Dark Matter), Satellite (Esri)
- Change-detection statistics: total / changed / unchanged area, top land-cover transitions
- Full Dynamic World V1 legend (9 classes) with Thai and English labels
- Bangkok AOI boundary embedded in the repo (no upload step needed)

## Architecture

```
frontend/   Vite + vanilla JS + Leaflet — the map UI
backend/    FastAPI + earthengine-api — runs the GEE pipeline, serves tile URLs & stats
```

The backend authenticates to Earth Engine with a service account, computes a per-pixel mode
composite of Dynamic World for each requested year, and returns:
- an XYZ tile URL per year (rendered directly by the browser via `ee.Image.getMapId`)
- a change-detection crosstab (`ee.Reducer.frequencyHistogram`) with area stats

This keeps all raster processing server-side/GEE-side — the frontend only ever receives tile
URLs and small JSON payloads.

## Prerequisites

| Tool | Version used in this repo |
| --- | --- |
| Node.js | 24.x |
| npm | 11.x |
| Python | 3.14.x |
| A Google Earth Engine service account | with access to the target GCP project |

## Getting started

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
cp .env.example .env   # then fill in EE_SERVICE_ACCOUNT_KEY and EE_PROJECT_ID
python -m uvicorn main:app --reload --port 8000
```

Environment variables (`backend/.env`):

| Variable | Description |
| --- | --- |
| `EE_SERVICE_ACCOUNT_KEY` | Path to the GCP service account JSON key (relative to `backend/`) |
| `EE_PROJECT_ID` | GCP project ID registered for Earth Engine |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |

### Frontend

```bash
cd frontend
npm install
npm run dev
```

By default the frontend expects the API at `http://localhost:8000` (see `frontend/.env`,
`VITE_API_BASE_URL`).

## API endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/aoi` | Bangkok boundary as GeoJSON |
| `GET /api/legend` | LULC class list (value, name, color) + supported year range |
| `GET /api/change?t1={year}&t2={year}` | Tile URLs for both years + change-detection stats |

## Project structure

```
backend/
  data/bangkok_aoi.geojson   Bangkok boundary (source: geoBoundaries, OSM-derived)
  ee_pipeline.py             Earth Engine logic (AOI, composites, change detection, tiles)
  main.py                    FastAPI app and routes
  requirements.txt
frontend/
  src/main.js                App entry point — map, sidebar, API wiring
  src/api.js                 Backend API client
  src/icons.js                Inline SVG icon set
  src/style.css
  index.html
```

## Known limitations

- **Earth Engine compute quota**: if the linked GCP project exceeds its non-commercial Earth
  Engine quota, tile requests can be throttled and some tiles may fail to load in the browser.
  Register the project for expanded non-commercial use or enable billing to lift this.
- The Bangkok AOI is a fixed boundary; there is no shapefile-upload UI (matches the MVP scope).

## License

No license specified yet.
