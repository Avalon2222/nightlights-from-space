/** Metrik peta wilayah: nilai per provinsi atau kabupaten/kota untuk satu tahun. */

import { batasKuantil, tumbuhPeriode } from "./hitung";
import type { Kabupaten, Metrik, Provinsi, Statistik, Tingkat } from "./jenis";

export interface InfoMetrik {
  id: Metrik;
  label: string;
  pendek: string;
  satuan: string;
  /** skala dua arah (merah turun, hijau naik) atau urut (gelap ke terang) */
  duaArah: boolean;
  /** hanya ada di tingkat provinsi */
  hanyaProvinsi?: boolean;
  keterangan: string;
}

export const METRIK: Record<Metrik, InfoMetrik> = {
  tumbuh: {
    id: "tumbuh",
    label: "Pertumbuhan cahaya",
    pendek: "Tumbuh",
    satuan: "%",
    duaArah: true,
    keterangan: "Perubahan total cahaya antara rata-rata tiga tahun pertama dan tiga tahun terakhir.",
  },
  perKapita: {
    id: "perKapita",
    label: "Cahaya per 1.000 penduduk",
    pendek: "Per kapita",
    satuan: "",
    duaArah: false,
    keterangan: "Total cahaya dibagi penduduk. Kabupaten/kota memakai penduduk 2020.",
  },
  terang: {
    id: "terang",
    label: "Wilayah terang",
    pendek: "Terang",
    satuan: "%",
    duaArah: false,
    keterangan: "Persen luas wilayah yang radiansnya di atas ambang terang.",
  },
  pln: {
    id: "pln",
    label: "Rumah tangga berlistrik PLN",
    pendek: "PLN",
    satuan: "%",
    duaArah: false,
    hanyaProvinsi: true,
    keterangan: "Persen rumah tangga dengan penerangan utama listrik PLN (BPS, Susenas).",
  },
};

export function nilaiProvinsi(p: Provinsi, metrik: Metrik, i: number): number | null {
  switch (metrik) {
    case "tumbuh":
      return tumbuhPeriode(p.cahaya, 3, 5);
    case "perKapita": {
      const penduduk = p.penduduk[i];
      return penduduk ? (p.cahaya[i] / penduduk) * 1000 : null;
    }
    case "terang":
      return p.luasKm2 > 0 ? (p.luasTerang[i] / p.luasKm2) * 100 : null;
    case "pln":
      return p.pln[i] ?? null;
  }
}

export function nilaiKabupaten(k: Kabupaten, metrik: Metrik, i: number): number | null {
  switch (metrik) {
    case "tumbuh":
      return tumbuhPeriode(k.cahaya, 3, 5);
    case "perKapita":
      return k.penduduk2020 > 0 ? (k.cahaya[i] / k.penduduk2020) * 1000 : null;
    case "terang":
      return k.luasKm2 > 0 ? (k.luasTerang[i] / k.luasKm2) * 100 : null;
    case "pln":
      return null;
  }
}

export interface NilaiWilayah {
  kode: string;
  nama: string;
  induk?: string;
  nilai: number | null;
}

export function nilaiSemua(s: Statistik, tingkat: Tingkat, metrik: Metrik, i: number): NilaiWilayah[] {
  if (tingkat === "provinsi") return s.provinsi.map((p) => ({ kode: p.kode, nama: p.nama, nilai: nilaiProvinsi(p, metrik, i) }));
  const namaProv = new Map(s.provinsi.map((p) => [p.kode, p.nama]));
  return s.kabupaten.map((k) => ({ kode: k.kode, nama: k.nama, induk: namaProv.get(k.prov), nilai: nilaiKabupaten(k, metrik, i) }));
}

/**
 * Batas kelas warna (4 batas = 5 kelas). Metrik dua arah: kelas pertama untuk yang turun (di bawah 0),
 * empat kelas sisanya membagi rata wilayah yang naik.
 */
export function batasMetrik(metrik: Metrik, nilai: NilaiWilayah[]): number[] {
  if (METRIK[metrik].duaArah) {
    const naik = nilai.map((n) => n.nilai).filter((v): v is number => v != null && v >= 0);
    return [0, ...batasKuantil(naik, 4)];
  }
  return batasKuantil(
    nilai.map((n) => n.nilai),
    5,
  );
}

/** Indeks tahun terakhir yang punya angka PLN (data BPS telat setahun dari citra). */
export function tahunPlnTerakhir(s: Statistik): number {
  for (let i = s.tahun.length - 1; i >= 0; i--) if (s.nasional.pln[i] != null) return i;
  return 0;
}
