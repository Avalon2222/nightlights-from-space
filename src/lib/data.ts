/** Muat tiga berkas data ringkas. Ubin dan GeoJSON diambil sendiri oleh peta. */

import type { Kejadian, Sorotan, Statistik } from "./jenis";

export interface Data {
  statistik: Statistik;
  kejadian: Kejadian[];
  sorotan: Sorotan[];
}

async function ambil<T>(jalur: string): Promise<T> {
  const res = await fetch(jalur);
  if (!res.ok) throw new Error(`${jalur}: ${res.status}`);
  return (await res.json()) as T;
}

export async function muatData(): Promise<Data> {
  const [statistik, kejadian, sorotan] = await Promise.all([ambil<Statistik>("/data/statistik.json"), ambil<Kejadian[]>("/data/kejadian.json"), ambil<Sorotan[]>("/data/sorotan.json")]);
  return { statistik, kejadian, sorotan };
}
