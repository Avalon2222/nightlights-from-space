/**
 * Gaya peta dasar: sengaja nyaris kosong supaya cahayanya yang bicara.
 * Vektor dari OpenFreeMap (gratis, tanpa kunci): garis pantai, batas negara dan provinsi,
 * jalan utama saat didekatkan, dan nama tempat.
 */

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

export const WARNA_DARAT = "#0b1120";
export const WARNA_LAUT = "#03050b";
const FONT = ["Noto Sans Regular"];
const FONT_TEBAL = ["Noto Sans Bold"];
const NAMA = ["coalesce", ["get", "name:id"], ["get", "name:latin"], ["get", "name"]] as unknown as string;

/** id lapisan pertama di atas semua lapisan cahaya; lapisan data disisipkan sebelum ini */
export const ID_LABEL_PERTAMA = "label-laut";

/** area yang punya ubin cahaya (tepi ubin zoom 8, dirapatkan sedikit ke dalam) */
export const BATAS_UBIN: [number, number, number, number] = [94.23, -11.17, 142.02, 7.0];

const dasar: LayerSpecification[] = [
  { id: "latar", type: "background", paint: { "background-color": WARNA_DARAT } },
  { id: "laut", type: "fill", source: "ofm", "source-layer": "water", paint: { "fill-color": WARNA_LAUT } },
  {
    id: "jalan",
    type: "line",
    source: "ofm",
    "source-layer": "transportation",
    minzoom: 8,
    filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]],
    paint: { "line-color": "#1b2740", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 12, 1.4] },
  },
  {
    id: "batas-provinsi",
    type: "line",
    source: "ofm",
    "source-layer": "boundary",
    minzoom: 4,
    filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
    paint: { "line-color": "#1c2740", "line-width": 0.7, "line-dasharray": [3, 2] },
  },
  {
    id: "batas-negara",
    type: "line",
    source: "ofm",
    "source-layer": "boundary",
    filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
    paint: { "line-color": "#3a4a68", "line-width": 1 },
  },
];

const label: LayerSpecification[] = [
  {
    id: ID_LABEL_PERTAMA,
    type: "symbol",
    source: "ofm",
    "source-layer": "water_name",
    minzoom: 4,
    filter: ["in", ["get", "class"], ["literal", ["sea", "ocean"]]],
    layout: { "text-field": NAMA, "text-font": FONT, "text-size": 11, "text-letter-spacing": 0.18, "text-transform": "uppercase", "text-max-width": 7 },
    paint: { "text-color": "#33415e", "text-halo-color": WARNA_LAUT, "text-halo-width": 1 },
  },
  {
    id: "label-negara",
    type: "symbol",
    source: "ofm",
    "source-layer": "place",
    maxzoom: 6,
    filter: ["==", ["get", "class"], "country"],
    layout: { "text-field": NAMA, "text-font": FONT_TEBAL, "text-size": 11, "text-letter-spacing": 0.22, "text-transform": "uppercase", "text-max-width": 7 },
    paint: { "text-color": "#5a6885", "text-halo-color": WARNA_LAUT, "text-halo-width": 1.2 },
  },
  {
    id: "label-kota",
    type: "symbol",
    source: "ofm",
    "source-layer": "place",
    minzoom: 4.5,
    filter: [
      "all",
      ["in", ["get", "class"], ["literal", ["city", "town"]]],
      ["<=", ["coalesce", ["get", "rank"], 20], ["step", ["zoom"], 3, 5.5, 5, 6.5, 8, 7.5, 12, 9, 20]],
    ],
    layout: {
      "text-field": NAMA,
      "text-font": FONT,
      "text-size": ["interpolate", ["linear"], ["zoom"], 4.5, 10, 9, 13],
      "text-anchor": "top",
      "text-offset": [0, 0.5],
      "text-max-width": 8,
      "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
    },
    paint: { "text-color": "#aab6cc", "text-halo-color": "rgba(3, 5, 11, 0.85)", "text-halo-width": 1.4 },
  },
];

export function bangunGaya(): StyleSpecification {
  return {
    version: 8,
    name: "nightlights",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      ofm: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' },
    },
    layers: [...dasar, ...label],
  };
}

export const ID_LAPISAN_LABEL = label.map((l) => l.id);
