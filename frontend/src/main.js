import "./style.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { fetchAoi, fetchLegend, fetchChange } from "./api.js";
import { icons } from "./icons.js";

const BANGKOK_CENTER = [13.7563, 100.5018];

// Icon shown per LULC class in the "Main Change Transitions" list (grouped by category, not 1:1).
const CLASS_ICON = {
  0: icons.droplet, // water
  1: icons.leaf, // trees
  2: icons.leaf, // grass
  3: icons.leaf, // flooded vegetation
  4: icons.leaf, // crops
  5: icons.leaf, // shrub and scrub
  6: icons.building, // built
  7: icons.circleDot, // bare ground
  8: icons.snowflake, // snow and ice
};

const yearT1Select = document.querySelector("#year-t1");
const yearT2Select = document.querySelector("#year-t2");
const processBtn = document.querySelector("#process-btn");
const statusEl = document.querySelector("#status");
const progressTrack = document.querySelector("#progress-track");
const statsSection = document.querySelector("#stats");
const statCardsEl = document.querySelector("#stat-cards");
const transitionsListEl = document.querySelector("#transitions-list");
const legendListEl = document.querySelector("#legend-list");
const swipeSlider = document.querySelector("#swipe-slider");
const swipeLabelT1 = document.querySelector("#swipe-label-t1");
const swipeLabelT2 = document.querySelector("#swipe-label-t2");
const brandIcon = document.querySelector("#brand-icon");

brandIcon.innerHTML = icons.logo();

let legendClasses = [];

// ---- Map setup ----------------------------------------------------------

const map = L.map("map", { zoomControl: false }).setView(BANGKOK_CENTER, 11);
L.control.zoom({ position: "topleft" }).addTo(map);

const basemaps = {
  OpenStreetMap: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }),
  "Light (Positron)": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 19,
  }),
  "Dark (Dark Matter)": L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 19,
  }),
  "Satellite (Esri)": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri", maxZoom: 19 }
  ),
};

basemaps["Light (Positron)"].addTo(map);
L.control.layers(basemaps, null, { position: "topleft" }).addTo(map);

const FullscreenControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd() {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control fullscreen-control");
    const link = L.DomUtil.create("a", "", container);
    link.href = "#";
    link.title = "Fullscreen";
    link.innerHTML = icons.expand();
    L.DomEvent.on(link, "click", (e) => {
      L.DomEvent.stop(e);
      const el = document.querySelector("#map-container");
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen();
      }
    });
    return container;
  },
});
new FullscreenControl().addTo(map);

map.createPane("t1Pane");
map.createPane("t2Pane");
map.getPane("t1Pane").style.zIndex = 350;
map.getPane("t2Pane").style.zIndex = 360;

let t1Layer = null;
let t2Layer = null;

function applySwipe() {
  const pct = swipeSlider.value;
  map.getPane("t2Pane").style.clipPath = `inset(0 0 0 ${pct}%)`;
}
swipeSlider.addEventListener("input", applySwipe);

function renderLegend(classes) {
  legendListEl.innerHTML = classes
    .map(
      (cls) =>
        `<li><span class="swatch" style="background:${cls.color}"></span>${cls.name_th} <span class="legend-en">(${cls.name})</span></li>`
    )
    .join("");
}

// ---- Status / progress ----------------------------------------------------

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setLoading(isLoading) {
  progressTrack.hidden = !isLoading;
  processBtn.disabled = isLoading;
}

// ---- Data loading -----------------------------------------------------

async function loadAoi() {
  const geojson = await fetchAoi();
  const aoiLayer = L.geoJSON(geojson, {
    style: { color: "#0f172a", weight: 2, fill: false },
  }).addTo(map);
  map.fitBounds(aoiLayer.getBounds(), { padding: [16, 16] });
}

async function loadLegend() {
  const { classes, min_year, max_year } = await fetchLegend();
  legendClasses = classes;

  for (const select of [yearT1Select, yearT2Select]) {
    select.innerHTML = "";
    for (let year = min_year; year <= max_year; year++) {
      const opt = document.createElement("option");
      opt.value = year;
      opt.textContent = year;
      select.appendChild(opt);
    }
  }
  yearT1Select.value = Math.max(min_year, max_year - 3);
  yearT2Select.value = max_year;
  updateSwipeLabels();

  renderLegend(classes);
}

function updateSwipeLabels() {
  swipeLabelT1.textContent = `T1 · ${yearT1Select.value}`;
  swipeLabelT2.textContent = `T2 · ${yearT2Select.value}`;
}
yearT1Select.addEventListener("change", updateSwipeLabels);
yearT2Select.addEventListener("change", updateSwipeLabels);

function classNameTh(value) {
  return legendClasses.find((c) => c.value === value)?.name_th ?? "Unknown";
}

function renderStats(result) {
  const { stats, matrix } = result;
  statCardsEl.innerHTML = `
    <div class="stat-card">
      <span class="stat-icon">${icons.box()}</span>
      <div class="stat-body">
        <span class="stat-label">Total Area</span>
        <span class="stat-value">${stats.total_area_sqkm.toLocaleString()} ตร.กม.</span>
        <span class="stat-sub">${stats.total_area_rai.toLocaleString()} ไร่</span>
      </div>
    </div>
    <div class="stat-card highlight">
      <span class="stat-icon">${icons.trendUp()}</span>
      <div class="stat-body">
        <span class="stat-label">Change Area <strong>(${stats.changed_pct}%)</strong></span>
        <span class="stat-value">${stats.changed_area_sqkm.toLocaleString()} ตร.กม.</span>
        <span class="stat-sub">${stats.changed_area_rai.toLocaleString()} ไร่</span>
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">${icons.ban()}</span>
      <div class="stat-body">
        <span class="stat-label">No Change Area</span>
        <span class="stat-value">${stats.unchanged_area_sqkm.toLocaleString()} ตร.กม.</span>
        <span class="stat-sub">${stats.unchanged_area_rai.toLocaleString()} ไร่</span>
      </div>
    </div>
  `;

  const topTransitions = matrix.filter((row) => row.from !== row.to).slice(0, 6);
  transitionsListEl.innerHTML = topTransitions.length
    ? topTransitions
        .map((row) => {
          const iconFn = CLASS_ICON[row.to] ?? icons.circleDot;
          const color = legendClasses.find((c) => c.value === row.to)?.color ?? "#94a3b8";
          return `<li>
            <span class="transition-icon" style="color:${color}">${iconFn()}</span>
            <span>${classNameTh(row.from)} &rarr; ${classNameTh(row.to)}</span>
            <strong>${row.area_rai.toLocaleString()} ไร่</strong>
          </li>`;
        })
        .join("")
    : "<li>ไม่พบการเปลี่ยนแปลงที่มีนัยสำคัญ</li>";

  statsSection.hidden = false;
}

async function process() {
  const t1 = Number(yearT1Select.value);
  const t2 = Number(yearT2Select.value);

  if (t1 === t2) {
    setStatus("กรุณาเลือกปี T1 และ T2 ให้ต่างกัน", true);
    return;
  }

  setLoading(true);
  setStatus(`Comparing ${t1} to ${t2}... (อาจใช้เวลาถึง 30 วินาที)`);

  try {
    const result = await fetchChange(t1, t2);

    if (t1Layer) map.removeLayer(t1Layer);
    if (t2Layer) map.removeLayer(t2Layer);

    t1Layer = L.tileLayer(result.tile_url_t1, { pane: "t1Pane", maxZoom: 19 }).addTo(map);
    t2Layer = L.tileLayer(result.tile_url_t2, { pane: "t2Pane", maxZoom: 19 }).addTo(map);
    applySwipe();
    updateSwipeLabels();

    renderStats(result);
    setStatus(`เปรียบเทียบ ${t1} กับ ${t2} เรียบร้อย`);
  } catch (err) {
    setStatus(`เกิดข้อผิดพลาด: ${err.message}`, true);
  } finally {
    setLoading(false);
  }
}

processBtn.addEventListener("click", process);

async function init() {
  try {
    await Promise.all([loadAoi(), loadLegend()]);
    setStatus('เลือกปีแล้วกด "Run Change Detection" เพื่อเริ่มต้น');
  } catch (err) {
    setStatus(`เชื่อมต่อ backend ไม่ได้: ${err.message}`, true);
  }
}

init();
