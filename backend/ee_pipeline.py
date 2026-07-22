import json
import os
from pathlib import Path

import ee

DATA_DIR = Path(__file__).parent / "data"
AOI_PATH = DATA_DIR / "bangkok_aoi.geojson"

DYNAMIC_WORLD_COLLECTION = "GOOGLE/DYNAMICWORLD/V1"

# Official Dynamic World V1 class labels and palette
# https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1
LULC_CLASSES = [
    {"value": 0, "name": "Water", "name_th": "แหล่งน้ำ", "color": "#419BDF"},
    {"value": 1, "name": "Trees", "name_th": "ป่าไม้/ต้นไม้", "color": "#397D49"},
    {"value": 2, "name": "Grass", "name_th": "ทุ่งหญ้า", "color": "#88B053"},
    {"value": 3, "name": "Flooded vegetation", "name_th": "พืชพื้นที่น้ำท่วมถึง", "color": "#7A87C6"},
    {"value": 4, "name": "Crops", "name_th": "พื้นที่เกษตรกรรม", "color": "#E49635"},
    {"value": 5, "name": "Shrub and scrub", "name_th": "ไม้พุ่ม", "color": "#DFC35A"},
    {"value": 6, "name": "Built area", "name_th": "พื้นที่ก่อสร้าง/เมือง", "color": "#C4281B"},
    {"value": 7, "name": "Bare ground", "name_th": "พื้นที่ว่างเปล่า", "color": "#A59B8F"},
    {"value": 8, "name": "Snow and ice", "name_th": "หิมะและน้ำแข็ง", "color": "#B39FE1"},
]

_CLASS_BY_VALUE = {c["value"]: c for c in LULC_CLASSES}

_VIS_PALETTE = [c["color"] for c in LULC_CLASSES]
_VIS_PARAMS = {"min": 0, "max": 8, "palette": _VIS_PALETTE}

_initialized = False


def init_ee():
    """Authenticate and initialize Earth Engine using a service account key.
    Cached at module level so repeated calls are cheap (mirrors @st.cache_resource in the plan).
    """
    global _initialized
    if _initialized:
        return

    key_path = os.environ["EE_SERVICE_ACCOUNT_KEY"]
    key_path = str((Path(__file__).parent / key_path).resolve())

    with open(key_path, encoding="utf-8") as f:
        key_data = json.load(f)

    credentials = ee.ServiceAccountCredentials(key_data["client_email"], key_path)
    ee.Initialize(credentials, project=os.environ.get("EE_PROJECT_ID"))
    _initialized = True


def build_aoi() -> ee.Geometry:
    """Bangkok boundary, embedded in the repo (see plan section 4, step 1)."""
    with open(AOI_PATH, encoding="utf-8") as f:
        fc = json.load(f)
    geometry = fc["features"][0]["geometry"]
    return ee.Geometry(geometry)


_districts_geojson = None


def build_district_aoi(name_en: str) -> ee.Geometry:
    """One Bangkok khet (district) boundary, looked up by its English name."""
    global _districts_geojson
    if _districts_geojson is None:
        with open(DATA_DIR / "bangkok_districts.geojson", encoding="utf-8") as f:
            _districts_geojson = json.load(f)

    for feature in _districts_geojson["features"]:
        if feature["properties"]["name_en"] == name_en:
            return ee.Geometry(feature["geometry"])
    raise ValueError(f"unknown district: {name_en}")


def build_composite(year: int, aoi: ee.Geometry) -> ee.Image:
    """Per-pixel mode of Dynamic World's 'label' band over one calendar year, clipped to the AOI."""
    dw = (
        ee.ImageCollection(DYNAMIC_WORLD_COLLECTION)
        .filterDate(f"{year}-01-01", f"{year + 1}-01-01")
        .filterBounds(aoi)
        .select("label")
    )
    composite = dw.reduce(ee.Reducer.mode()).rename("label")
    return composite.clip(aoi)


def get_tile_url(image: ee.Image, vis_params: dict | None = None) -> str:
    map_id = image.getMapId(vis_params or _VIS_PARAMS)
    return map_id["tile_fetcher"].url_format


def detect_change(img_t1: ee.Image, img_t2: ee.Image, aoi: ee.Geometry, scale: int = 30) -> dict:
    """Crosstab T1 -> T2 land cover classes over the AOI.

    Encodes each pixel's (t1_class, t2_class) pair as t1*10 + t2 (classes are 0-8, so this
    is collision-free) and reduces with a frequency histogram, per plan section 2.2.
    """
    transition = img_t1.multiply(10).add(img_t2).rename("transition")

    histogram = transition.reduceRegion(
        reducer=ee.Reducer.frequencyHistogram(),
        geometry=aoi,
        scale=scale,
        maxPixels=1e10,
        bestEffort=True,
    ).get("transition")

    counts: dict = histogram.getInfo() or {}
    pixel_area_sqm = scale * scale

    matrix = []
    total_pixels = 0
    changed_pixels = 0
    for code_str, count in counts.items():
        code = int(float(code_str))
        t1_class, t2_class = divmod(code, 10)
        count = int(count)
        total_pixels += count
        if t1_class != t2_class:
            changed_pixels += count
        matrix.append(
            {
                "from": t1_class,
                "to": t2_class,
                "from_name": _CLASS_BY_VALUE.get(t1_class, {}).get("name", "Unknown"),
                "to_name": _CLASS_BY_VALUE.get(t2_class, {}).get("name", "Unknown"),
                "pixels": count,
                "area_sqkm": round(count * pixel_area_sqm / 1_000_000, 4),
                "area_rai": round(count * pixel_area_sqm / 1_600, 2),
            }
        )

    matrix.sort(key=lambda row: row["pixels"], reverse=True)

    unchanged_pixels = total_pixels - changed_pixels
    return {
        "matrix": matrix,
        "stats": {
            "total_area_sqkm": round(total_pixels * pixel_area_sqm / 1_000_000, 2),
            "total_area_rai": round(total_pixels * pixel_area_sqm / 1_600, 2),
            "changed_area_sqkm": round(changed_pixels * pixel_area_sqm / 1_000_000, 2),
            "changed_area_rai": round(changed_pixels * pixel_area_sqm / 1_600, 2),
            "unchanged_area_sqkm": round(unchanged_pixels * pixel_area_sqm / 1_000_000, 2),
            "unchanged_area_rai": round(unchanged_pixels * pixel_area_sqm / 1_600, 2),
            "changed_pct": round(100 * changed_pixels / total_pixels, 2) if total_pixels else 0,
        },
    }
