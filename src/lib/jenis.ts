/** Bentuk data di public/data/*.json (dibuat oleh scripts/bangun_data.py dan scripts/kejadian.py). */

export interface DeretWilayah {
  kode: string;
  nama: string;
  luasKm2: number;
  /** jumlah radiance x luas piksel terang, per tahun */
  cahaya: number[];
  /** luas piksel terang (km²), per tahun */
  luasTerang: number[];
}

export interface Provinsi extends DeretWilayah {
  penduduk: (number | null)[];
  /** persen rumah tangga dengan penerangan utama listrik PLN (BPS, Susenas) */
  pln: (number | null)[];
  pdrb: { tahun: number; berlaku: number; konstan: number } | null;
}

export interface Kabupaten extends DeretWilayah {
  prov: string;
  penduduk2020: number;
}

export interface Statistik {
  dibuat: string;
  tahun: number[];
  sampel: { jumlah: number; pertama: string; terakhir: string }[];
  ambang: number;
  /** batas atas radiance kalau sumbernya terpotong; null = tidak terpotong */
  potong: number | null;
  nasional: { cahaya: number[]; luasTerang: number[]; penduduk: number[]; pln: (number | null)[] };
  provinsi: Provinsi[];
  kabupaten: Kabupaten[];
}

export type JenisKejadian = "gempa" | "siklon" | "blackout" | "banjir";

export interface Kejadian {
  id: string;
  judul: string;
  tanggal: string;
  jenis: JenisKejadian;
  lokasi: string;
  ringkas: string;
  sumber: string;
  /** [barat, selatan, timur, utara], pas di tepi piksel citra */
  kotak: [number, number, number, number];
  /** [hari relatif terhadap kejadian, indeks cahaya (garis dasar = 100)] */
  deret: [number, number][];
  terendah: { hari: number; indeks: number };
  hariPulih: number | null;
  luasTerangKm2: number;
  rentangSesudah: [number, number];
}

export interface Sorotan {
  id: string;
  judul: string;
  lokasi: string;
  mulai: number;
  kotak: [number, number, number, number];
  pusat: [number, number];
  catatan: string;
  cahaya: number[];
  luasTerang: number[];
  puncak: number[];
}

export type Mode = "timelapse" | "perubahan" | "wilayah" | "blackout" | "hotspot" | "tentang";
export const SEMUA_MODE: Mode[] = ["timelapse", "perubahan", "wilayah", "blackout", "hotspot", "tentang"];

export type Tingkat = "provinsi" | "kabupaten";
export type Metrik = "tumbuh" | "perKapita" | "terang" | "pln";
export const SEMUA_METRIK: Metrik[] = ["tumbuh", "perKapita", "terang", "pln"];

export type TampilanKejadian = "sebelum" | "sesudah" | "selisih";
