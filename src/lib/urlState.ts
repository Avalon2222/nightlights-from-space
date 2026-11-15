/** Keadaan tampilan disimpan di hash URL supaya bisa dibagikan: #m=wilayah&t=2019&w=53 */

import { SEMUA_METRIK, SEMUA_MODE, type Metrik, type Mode, type TampilanKejadian, type Tingkat } from "./jenis";

export interface KeadaanUrl {
  mode: Mode;
  tahun: number | null;
  /** tanggal mode harian (YYYY-MM-DD) */
  harian: string | null;
  tingkat: Tingkat;
  metrik: Metrik;
  /** kode provinsi (2 digit) atau kabupaten/kota (4 digit) yang dipilih */
  wilayah: string | null;
  kejadian: string | null;
  tampilan: TampilanKejadian;
  sorotan: string | null;
  /** [bujur, lintang, zoom] */
  kamera: [number, number, number] | null;
}

export const KEADAAN_AWAL: KeadaanUrl = {
  mode: "timelapse",
  tahun: null,
  harian: null,
  tingkat: "provinsi",
  metrik: "tumbuh",
  wilayah: null,
  kejadian: null,
  tampilan: "sesudah",
  sorotan: null,
  kamera: null,
};

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_ID = /^[a-z0-9-]{1,40}$/;

export function bacaHash(hash: string): KeadaanUrl {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const k: KeadaanUrl = { ...KEADAAN_AWAL };
  const m = p.get("m");
  if (m && (SEMUA_MODE as string[]).includes(m)) k.mode = m as Mode;
  const t = Number(p.get("t"));
  if (Number.isInteger(t) && t >= 2012 && t <= 2100) k.tahun = t;
  const h = p.get("h");
  if (h && POLA_TANGGAL.test(h) && !Number.isNaN(Date.parse(h))) k.harian = h;
  if (p.get("g") === "kab") k.tingkat = "kabupaten";
  const x = p.get("x");
  if (x && (SEMUA_METRIK as string[]).includes(x)) k.metrik = x as Metrik;
  const w = p.get("w");
  if (w && /^\d{2}(\d{2})?$/.test(w)) k.wilayah = w;
  const e = p.get("k");
  if (e && POLA_ID.test(e)) k.kejadian = e;
  const v = p.get("v");
  if (v === "sebelum" || v === "sesudah" || v === "selisih") k.tampilan = v;
  const s = p.get("s");
  if (s && POLA_ID.test(s)) k.sorotan = s;
  const c = (p.get("c") ?? "").split(",").map(Number);
  if (c.length === 3 && c.every(Number.isFinite) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 85 && c[2] >= 0 && c[2] <= 22) k.kamera = [c[0], c[1], c[2]];
  return k;
}

export function tulisHash(k: KeadaanUrl): string {
  const p = new URLSearchParams();
  if (k.mode !== KEADAAN_AWAL.mode) p.set("m", k.mode);
  if (k.tahun != null) p.set("t", String(k.tahun));
  if (k.harian) p.set("h", k.harian);
  if (k.mode === "wilayah") {
    if (k.tingkat === "kabupaten") p.set("g", "kab");
    if (k.metrik !== KEADAAN_AWAL.metrik) p.set("x", k.metrik);
    if (k.wilayah) p.set("w", k.wilayah);
  }
  if (k.mode === "blackout" && k.kejadian) {
    p.set("k", k.kejadian);
    if (k.tampilan !== KEADAAN_AWAL.tampilan) p.set("v", k.tampilan);
  }
  if (k.mode === "hotspot" && k.sorotan) p.set("s", k.sorotan);
  if (k.kamera) p.set("c", `${k.kamera[0].toFixed(3)},${k.kamera[1].toFixed(3)},${k.kamera[2].toFixed(2)}`);
  const teks = p.toString().replace(/%2C/g, ",");
  return teks ? `#${teks}` : "";
}
