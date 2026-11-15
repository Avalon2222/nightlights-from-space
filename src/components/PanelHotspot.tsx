"use client";

import { ArrowLeft } from "lucide-react";
import { angka } from "@/lib/format";
import { rataUjung } from "@/lib/hitung";
import type { Sorotan } from "@/lib/jenis";
import { Angka, Catatan, Judul, LegendaCahaya, Sub } from "./Bagian";
import { GrafikGaris, Sparkline } from "./Grafik";

interface Props {
  daftar: Sorotan[];
  tahun: number[];
  i: number;
  terpilih: string | null;
  saatPilih(id: string | null): void;
}

/** Berapa kali lipat cahaya tiga tahun terakhir dibanding tiga tahun pertama. Null kalau awalnya gelap total. */
export function kelipatan(cahaya: number[]): number | null {
  const awal = rataUjung(cahaya, 3, "awal");
  const akhir = rataUjung(cahaya, 3, "akhir");
  if (awal < 1) return null;
  return akhir / awal;
}

function teksKelipatan(k: number | null): string {
  if (k == null) return "dari gelap";
  if (k >= 10) return `${angka(k)}×`;
  return `${angka(k, 1)}×`;
}

export default function PanelHotspot({ daftar, tahun, i, terpilih, saatPilih }: Props) {
  const s = daftar.find((x) => x.id === terpilih);
  if (s) {
    const iMulai = tahun.indexOf(s.mulai);
    return (
      <div>
        <button type="button" className="chip mb-3" onClick={() => saatPilih(null)}>
          <ArrowLeft size={14} aria-hidden /> Semua hotspot
        </button>
        <Judul kecil={s.lokasi}>{s.judul}</Judul>
        <Catatan>{s.catatan}</Catatan>
        <div className="mt-3">
          <LegendaCahaya />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Angka label={`Cahaya ${tahun[i]}`} nilai={angka(s.cahaya[i])} catatan="radiance × km² di dalam kotak" warna="var(--emas)" />
          <Angka label="Kelipatan" nilai={teksKelipatan(kelipatan(s.cahaya))} catatan={`${tahun[0]}–${tahun[2]} ke ${tahun[tahun.length - 3]}–${tahun[tahun.length - 1]}: ${angka(rataUjung(s.cahaya, 3, "awal"))} → ${angka(rataUjung(s.cahaya, 3, "akhir"))}`} />
          <Angka label="Luas terang" nilai={`${angka(s.luasTerang[i], 1)} km²`} catatan={`dari ${angka(s.luasTerang[0], 1)} km² di ${tahun[0]}`} />
          <Angka label="Piksel paling terang" nilai={angka(s.puncak[i], 1)} catatan="nW/cm²/sr" />
        </div>
        <Sub>Cahaya per tahun</Sub>
        <GrafikGaris judul={`Total cahaya tahunan di ${s.judul}`} x={tahun} tanda={i} seri={[{ nama: "Total cahaya di dalam kotak", warna: "#ffb35c", nilai: s.cahaya }]} dariNol />
        <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-samar">
          {iMulai >= 0 ? `Pembangunan mulai sekitar ${s.mulai}. ` : ""}Geser garis waktu di bawah untuk melihat kotaknya menyala tahun demi tahun.
        </p>
      </div>
    );
  }
  return (
    <div>
      <Judul kecil="Hotspot pembangunan">Tempat yang tiba-tiba menyala</Judul>
      <Catatan>
        Ibu kota baru di tengah hutan, smelter nikel di teluk yang dulu gelap, bandara di bekas sawah. Cahaya sering jadi tanda pertama
        yang bisa diukur dari luar, jauh sebelum angka resminya terbit.
      </Catatan>
      <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
        {daftar.map((x) => (
          <li key={x.id}>
            <button type="button" className="baris-pilih !border-garis !bg-white/[0.03]" onClick={() => saatPilih(x.id)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{x.judul}</span>
                <span className="block truncate text-[11.5px] text-redup">{x.lokasi}</span>
              </span>
              <Sparkline nilai={x.cahaya} tanda={i} />
              <span className="angka w-[58px] flex-none text-right text-[12.5px] text-emas">{teksKelipatan(kelipatan(x.cahaya))}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-samar">
        Angka di kanan = cahaya tiga tahun terakhir dibanding tiga tahun pertama. Kotak kuning di peta menandai area yang dihitung.
      </p>
    </div>
  );
}
