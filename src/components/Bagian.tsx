/** Potongan UI kecil yang dipakai semua panel. */

import type { ReactNode } from "react";
import { gradien, SATUAN, TITIK_CAHAYA, TITIK_NAIK, TITIK_TURUN } from "@/lib/palet";

export function Judul({ kecil, children }: { kecil: string; children: ReactNode }) {
  return (
    <header className="mb-3">
      <p className="label-kecil m-0">{kecil}</p>
      <h2 className="m-0 mt-1 text-[19px] font-semibold leading-tight text-teks">{children}</h2>
    </header>
  );
}

export function Angka({ label, nilai, catatan, warna }: { label: string; nilai: string; catatan?: string; warna?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-garis bg-white/[0.03] px-3 py-2.5">
      <p className="label-kecil m-0 truncate">{label}</p>
      <p className="angka m-0 mt-1 truncate text-[20px] font-medium leading-none" style={warna ? { color: warna } : undefined}>
        {nilai}
      </p>
      {catatan ? <p className="m-0 mt-1.5 text-[11px] leading-snug text-redup">{catatan}</p> : null}
    </div>
  );
}

export function Catatan({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[12px] leading-relaxed text-redup">{children}</p>;
}

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="label-kecil m-0 mb-2 mt-5">{children}</h3>;
}

/** Legenda warna cahaya (skala log). */
export function LegendaCahaya() {
  const ujung = TITIK_CAHAYA[TITIK_CAHAYA.length - 1][0];
  const posisi = (v: number) => ((Math.log10(v) - Math.log10(TITIK_CAHAYA[0][0])) / (Math.log10(ujung) - Math.log10(TITIK_CAHAYA[0][0]))) * 100;
  return (
    <div aria-label={`Legenda: radiance cahaya malam dalam ${SATUAN}, dari gelap ke terang`} role="img">
      <div className="h-2.5 w-full rounded-full border border-garis" style={{ background: `${gradien(TITIK_CAHAYA)}, #0b1120` }} />
      <div className="angka relative mt-1 h-3.5 text-[10px] text-samar">
        {[1, 3, 10].map((v) => (
          <span key={v} className="absolute -translate-x-1/2" style={{ left: `${posisi(v)}%` }}>
            {v}
          </span>
        ))}
        <span className="absolute left-0">gelap</span>
        <span className="absolute right-0">38+ {SATUAN}</span>
      </div>
    </div>
  );
}

/** Legenda peta perubahan: meredup di kiri, bertambah di kanan. */
export function LegendaSelisih() {
  const turun = [...TITIK_TURUN].reverse();
  return (
    <div aria-label="Legenda: merah muda berarti meredup, hijau toska berarti bertambah terang" role="img">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-garis bg-[#0b1120]">
        <div className="h-full flex-1" style={{ background: `linear-gradient(to right, ${turun.map(([, w]) => `rgba(${w[0]},${w[1]},${w[2]},${(w[3] / 255).toFixed(2)})`).join(", ")})` }} />
        <div className="h-full flex-1" style={{ background: gradien(TITIK_NAIK) }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-samar">
        <span className="text-turun">meredup</span>
        <span>tetap</span>
        <span className="text-naik">bertambah terang</span>
      </div>
    </div>
  );
}

export function LegendaKelas({ warna, batas, format }: { warna: string[]; batas: number[]; format(v: number): string }) {
  return (
    <div role="img" aria-label="Legenda kelas warna peta wilayah">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-garis">
        {warna.map((w) => (
          <div key={w} className="h-full flex-1" style={{ background: w }} />
        ))}
      </div>
      <div className="angka relative mt-1 h-3.5 text-[10px] text-samar">
        {batas.map((b, i) => (
          <span key={i} className="absolute -translate-x-1/2" style={{ left: `${((i + 1) / warna.length) * 100}%` }}>
            {format(b)}
          </span>
        ))}
      </div>
    </div>
  );
}
