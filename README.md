# WebMap LULC — Bangkok Land Use / Land Cover Change Platform

A web map application for detecting and visualizing Land Use / Land Cover (LULC) change in
Bangkok between any two years (2016–2026), built on Google Earth Engine's **Dynamic World V1**
dataset. Users pick two years (T1/T2), and the app computes a per-pixel land-cover crosstab and
renders both years as swipeable map layers with area statistics in km² and ไร่ (rai).

**Live**: https://sr120899.github.io/WebMap_LULC/ (frontend, GitHub Pages) · backend on Cloud Run at
`https://webmap-lulc-backend-629059650033.asia-southeast1.run.app`

## Features

- Interactive Leaflet map with a T1/T2 swipe (split) comparison
- Multiple basemaps: OpenStreetMap, Light (CartoDB Positron), Dark (CartoDB Dark Matter), Satellite (Esri)
- Change-detection statistics: total / changed / unchanged area, top land-cover transitions
- Full Dynamic World V1 legend (9 classes) with Thai and English labels
- Bangkok AOI boundary embedded in the repo (no upload step needed)
- All 50 Bangkok khet (district) boundaries — searchable by Thai/English name or by clicking the
  map, with change detection scoped to just that district when one is selected

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
| `EE_SERVICE_ACCOUNT_KEY` | Path to the GCP service account JSON key (relative to `backend/`). Omit this entirely in production (see Deployment below) — the service then authenticates via Application Default Credentials instead. |
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
| `GET /api/districts` | All 50 Bangkok khet boundaries as GeoJSON (Thai + English names) |
| `GET /api/legend` | LULC class list (value, name, color) + supported year range |
| `GET /api/change?t1={year}&t2={year}&district={name_en}` | Tile URLs for both years + change-detection stats. `district` is optional — omit it to compute over all of Bangkok, or pass a `name_en` from `/api/districts` to scope the computation to just that khet. |

## Deployment

**Backend → Cloud Run**, built straight from the Dockerfile:

```bash
gcloud run deploy webmap-lulc-backend \
  --source backend \
  --region asia-southeast1 \
  --service-account <your-ee-authorized-service-account> \
  --allow-unauthenticated \
  --set-env-vars CORS_ORIGINS=https://<your-username>.github.io \
  --memory 512Mi --timeout 180
```

No `EE_SERVICE_ACCOUNT_KEY` is set here on purpose: the container runs *as* the given service
account, so `ee_pipeline.init_ee()` picks up Application Default Credentials instead of needing a
key file baked into the image. Both auth paths route through
`earthengine-highvolume.googleapis.com`, which Google recommends for any backend serving map
tiles — in testing this cut a single-district change-detection request from ~25s to ~3.6s
compared to the standard endpoint.

**Frontend → GitHub Pages**, built with the deployed backend's URL baked in via
`frontend/.env.production`:

```bash
cd frontend
npm run build
# then push dist/ to the gh-pages branch (see git history for the exact commands used)
```

GitHub Pages itself (Settings → Pages → Deploy from a branch → `gh-pages` / `/`) has to be turned
on once through the GitHub UI or API with repo-admin credentials — it isn't something a plain
`git push` can flip on its own.

## Project structure

```
backend/
  data/bangkok_aoi.geojson       Bangkok boundary (source: geoBoundaries, OSM-derived)
  data/bangkok_districts.geojson All 50 khet boundaries (source: geoBoundaries Thailand ADM2,
                                  spatially filtered to Bangkok, Thai names added)
  ee_pipeline.py                 Earth Engine logic (AOI, composites, change detection, tiles)
  main.py                        FastAPI app and routes
  Dockerfile                     Cloud Run container build
  requirements.txt
frontend/
  src/main.js                App entry point — map, sidebar, district search, API wiring
  src/api.js                 Backend API client
  src/icons.js                Inline SVG icon set
  src/style.css
  index.html
```

## Known limitations

- **Earth Engine compute quota**: if the linked GCP project exceeds its non-commercial Earth
  Engine quota, tile requests can be throttled and some tiles may fail to load in the browser.
  Register the project for expanded non-commercial use or enable billing to lift this — it's a
  quota on the GCP project itself, independent of where the backend is hosted.
- The Bangkok AOI is a fixed boundary; there is no shapefile-upload UI (matches the MVP scope).

## License

No license specified yet.
