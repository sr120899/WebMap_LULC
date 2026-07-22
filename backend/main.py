import json
import os
from contextlib import asynccontextmanager
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

import ee_pipeline as pipeline
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

MIN_YEAR = 2016  # Dynamic World V1 coverage starts mid-2015
MAX_YEAR = 2026

_aoi = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    pipeline.init_ee()
    global _aoi
    _aoi = pipeline.build_aoi()
    yield


app = FastAPI(title="WebMap LULC API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _validate_year(year: int):
    if not (MIN_YEAR <= year <= MAX_YEAR):
        raise HTTPException(400, f"year must be between {MIN_YEAR} and {MAX_YEAR}")


@lru_cache(maxsize=64)
def _get_aoi(district: str | None):
    if not district:
        return _aoi
    try:
        return pipeline.build_district_aoi(district)
    except ValueError as e:
        raise HTTPException(400, str(e))


@lru_cache(maxsize=128)
def _composite_tile_url(year: int, district: str | None = None) -> str:
    composite = pipeline.build_composite(year, _get_aoi(district))
    return pipeline.get_tile_url(composite)


@lru_cache(maxsize=128)
def _change_result(t1: int, t2: int, district: str | None = None) -> dict:
    aoi = _get_aoi(district)
    img_t1 = pipeline.build_composite(t1, aoi)
    img_t2 = pipeline.build_composite(t2, aoi)
    return pipeline.detect_change(img_t1, img_t2, aoi)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/aoi")
def get_aoi():
    with open(pipeline.AOI_PATH, encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/districts")
def get_districts():
    with open(pipeline.DATA_DIR / "bangkok_districts.geojson", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/legend")
def get_legend():
    return {"classes": pipeline.LULC_CLASSES, "min_year": MIN_YEAR, "max_year": MAX_YEAR}


@app.get("/api/tile-url")
def tile_url(year: int):
    _validate_year(year)
    try:
        return {"year": year, "tile_url": _composite_tile_url(year)}
    except Exception as e:
        raise HTTPException(502, f"Earth Engine error: {e}")


@app.get("/api/change")
def change(t1: int, t2: int, district: str | None = None):
    _validate_year(t1)
    _validate_year(t2)
    if t1 == t2:
        raise HTTPException(400, "t1 and t2 must differ")
    try:
        result = _change_result(t1, t2, district)
        return {
            "t1": t1,
            "t2": t2,
            "district": district,
            "tile_url_t1": _composite_tile_url(t1, district),
            "tile_url_t2": _composite_tile_url(t2, district),
            **result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Earth Engine error: {e}")
