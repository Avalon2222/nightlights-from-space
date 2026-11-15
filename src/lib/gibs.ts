/**
 * Mode harian: ubin Black Marble harian langsung dari NASA GIBS, diwarnai ulang di browser.
 *
 * GIBS mengirim PNG abu-abu berpalet (tiap tingkat abu = satu rentang radiance). Supaya tampilannya
 * sama dengan komposit tahunan, tiap ubin digambar ke kanvas, tingkat abunya dipetakan ke palet
 * kita, lalu dikembalikan ke MapLibre sebagai PNG lewat protokol khusus `gibs://`.
 */

import nilaiAbu from "./gibsNilai.json";
import { tabelAbuKeWarna } from "./palet";

export const LAPISAN_GIBS = "VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance";
export const TANGGAL_AWAL_GIBS = "2012-01-19";
/** GIBS biasanya telat sekitar dua minggu dari hari ini untuk produk ini */
export const JEDA_HARI_GIBS = 14;
export const PROTOKOL = "gibs";

export function urlUbinGibs(tanggal: string, z: number, x: number, y: number): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAPISAN_GIBS}/default/${tanggal}/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`;
}

/** Templat ubin untuk sumber raster MapLibre. */
export function templatProtokol(tanggal: string): string {
  return `${PROTOKOL}://${tanggal}/{z}/{x}/{y}`;
}

export function uraiProtokol(url: string): { tanggal: string; z: number; x: number; y: number } | null {
  const m = /^gibs:\/\/(\d{4}-\d{2}-\d{2})\/(\d+)\/(\d+)\/(\d+)$/.exec(url);
  if (!m) return null;
  return { tanggal: m[1], z: Number(m[2]), x: Number(m[3]), y: Number(m[4]) };
}

/** Warnai ulang piksel RGBA abu-abu (di tempat) memakai tabel 256 x 4. */
export function warnaiUlang(piksel: Uint8ClampedArray, tabel: Uint8ClampedArray): void {
  for (let i = 0; i < piksel.length; i += 4) {
    // piksel tanpa data di GIBS transparan (alfa 0) atau biru (0,0,160)
    const abu = piksel[i + 3] === 0 || piksel[i] !== piksel[i + 2] ? 0 : piksel[i];
    const j = abu * 4;
    piksel[i] = tabel[j];
    piksel[i + 1] = tabel[j + 1];
    piksel[i + 2] = tabel[j + 2];
    piksel[i + 3] = tabel[j + 3];
  }
}

let tabel: Uint8ClampedArray | null = null;

/** Ambil satu ubin GIBS dan kembalikan sebagai PNG yang sudah diwarnai. */
export async function muatUbinGibs(url: string, sinyal: AbortSignal): Promise<ArrayBuffer> {
  const u = uraiProtokol(url);
  if (!u) throw new Error(`url gibs tidak dikenal: ${url}`);
  const res = await fetch(urlUbinGibs(u.tanggal, u.z, u.x, u.y), { signal: sinyal });
  if (!res.ok) throw new Error(`GIBS ${res.status}`);
  const gambar = await createImageBitmap(await res.blob());
  const kanvas = new OffscreenCanvas(gambar.width, gambar.height);
  const ctx = kanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("kanvas 2D tidak tersedia");
  ctx.drawImage(gambar, 0, 0);
  gambar.close();
  const data = ctx.getImageData(0, 0, kanvas.width, kanvas.height);
  tabel ??= tabelAbuKeWarna(nilaiAbu as number[]);
  warnaiUlang(data.data, tabel);
  ctx.putImageData(data, 0, 0);
  const png = await kanvas.convertToBlob({ type: "image/png" });
  return png.arrayBuffer();
}

/** Tanggal terakhir yang kemungkinan besar sudah tersedia di GIBS. */
export function tanggalTerakhirGibs(sekarang = new Date()): string {
  const t = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), sekarang.getUTCDate() - JEDA_HARI_GIBS));
  return t.toISOString().slice(0, 10);
}

export function jepitTanggal(iso: string, maks: string): string {
  if (iso < TANGGAL_AWAL_GIBS) return TANGGAL_AWAL_GIBS;
  if (iso > maks) return maks;
  return iso;
}
