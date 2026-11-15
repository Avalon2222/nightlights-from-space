/**
 * Palet warna cahaya. Titik warnanya sama persis dengan yang dipakai scripts/palet.py untuk
 * mewarnai ubin (data/palet.json), jadi legenda dan mode harian selalu cocok dengan peta.
 */

import paletJson from "../../data/palet.json";

export type Rgba = [number, number, number, number];
type Titik = [number, Rgba];

export const TITIK_CAHAYA = paletJson.cahaya as Titik[];
export const TITIK_NAIK = paletJson.selisih.naik as Titik[];
export const TITIK_TURUN = paletJson.selisih.turun as Titik[];
export const SATUAN = paletJson.satuan;

/** Warna untuk satu nilai: interpolasi linear di skala log10, dijepit di kedua ujung. */
export function warnaDari(nilai: number, titik: Titik[]): Rgba {
  if (!(nilai > titik[0][0])) return nilai === titik[0][0] ? titik[0][1] : [titik[0][1][0], titik[0][1][1], titik[0][1][2], 0];
  const akhir = titik[titik.length - 1];
  if (nilai >= akhir[0]) return akhir[1];
  const x = Math.log10(nilai);
  for (let i = 1; i < titik.length; i++) {
    if (nilai <= titik[i][0]) {
      const x0 = Math.log10(titik[i - 1][0]);
      const x1 = Math.log10(titik[i][0]);
      const t = (x - x0) / (x1 - x0);
      const a = titik[i - 1][1];
      const b = titik[i][1];
      return [0, 1, 2, 3].map((c) => Math.round(a[c] + (b[c] - a[c]) * t)) as Rgba;
    }
  }
  return akhir[1];
}

export function warnaCahaya(radiance: number): Rgba {
  return warnaDari(radiance, TITIK_CAHAYA);
}

export function css([r, g, b, a]: Rgba, alfaMin = 0): string {
  return `rgba(${r}, ${g}, ${b}, ${Math.max(alfaMin, a / 255).toFixed(2)})`;
}

/** Gradien CSS untuk batang legenda (posisi mengikuti skala log). */
export function gradien(titik: Titik[], arah = "to right"): string {
  const x0 = Math.log10(titik[0][0]);
  const x1 = Math.log10(titik[titik.length - 1][0]);
  const potong = titik.map(([nilai, warna]) => `${css(warna)} ${(((Math.log10(nilai) - x0) / (x1 - x0)) * 100).toFixed(1)}%`);
  return `linear-gradient(${arah}, ${potong.join(", ")})`;
}

/**
 * Tabel 256 x 4 byte: tingkat abu ubin GIBS -> warna palet kita.
 * `nilaiAbu[g]` = radiance untuk tingkat abu g (0 kalau g bukan warna palet GIBS).
 */
export function tabelAbuKeWarna(nilaiAbu: number[]): Uint8ClampedArray {
  const tabel = new Uint8ClampedArray(256 * 4);
  for (let g = 0; g < 256; g++) {
    const [r, gg, b, a] = nilaiAbu[g] > 0 ? warnaCahaya(nilaiAbu[g]) : [0, 0, 0, 0];
    tabel[g * 4] = r;
    tabel[g * 4 + 1] = gg;
    tabel[g * 4 + 2] = b;
    tabel[g * 4 + 3] = a;
  }
  return tabel;
}

/** Skala warna peta wilayah: dari gelap ke terang, 5 kelas. */
export const KELAS_URUT = ["#1d2440", "#3a3a78", "#7a4a9a", "#d0607a", "#ffb35c"];
/** Skala dua arah, 5 kelas: satu kelas turun (merah muda), empat kelas naik (toska makin terang). */
export const KELAS_DUA_ARAH = ["#e0527a", "#1c3b4c", "#1c6f6c", "#27ad96", "#7df5d8"];
export const WARNA_KOSONG = "#141a2c";
