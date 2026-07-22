const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const fetchAoi = () => getJson("/api/aoi");
export const fetchDistricts = () => getJson("/api/districts");
export const fetchLegend = () => getJson("/api/legend");
export const fetchChange = (t1, t2, district) => {
  const params = new URLSearchParams({ t1, t2 });
  if (district) params.set("district", district);
  return getJson(`/api/change?${params.toString()}`);
};
