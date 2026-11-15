"use client";

import { Pause, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { Sparkline } from "./Grafik";

interface Props {
  tahun: number[];
  indeks: number;
  main: boolean;
  memuat: boolean;
  /** total cahaya nasional per tahun, jadi latar sparkline */
  cahaya: number[];
  saatGeser(indeks: number): void;
  saatMain(): void;
}

/** Slider tahun + tombol putar. Tahun aktif ditulis besar supaya terbaca dari jauh. */
export default function GarisWaktu({ tahun, indeks, main, memuat, cahaya, saatGeser, saatMain }: Props) {
  const isi = tahun.length > 1 ? (indeks / (tahun.length - 1)) * 100 : 0;
  return (
    <section aria-label="Garis waktu" className="kaca flex items-center gap-3 rounded-2xl px-3 py-2 sm:px-4">
      <button type="button" className="tombol-ikon !h-10 !w-10 !border-aksen/50 !bg-aksen/15 text-emas" onClick={saatMain} aria-label={main ? "Jeda time-lapse" : "Putar time-lapse"} aria-pressed={main}>
        {main ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden className="translate-x-[1px]" />}
      </button>
      <div className="flex min-w-[58px] flex-col leading-none">
        <span className="angka text-[24px] font-semibold text-emas" aria-live="polite" data-testid="tahun-aktif">
          {tahun[indeks]}
        </span>
        <span className="mt-1 text-[10px] text-samar">{memuat ? "memuat…" : main ? "berjalan" : "tahun"}</span>
      </div>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          className="geser"
          min={0}
          max={tahun.length - 1}
          step={1}
          value={indeks}
          onChange={(e) => saatGeser(Number(e.target.value))}
          aria-label="Pilih tahun"
          aria-valuetext={String(tahun[indeks])}
          style={{ "--isi": `${isi}%` } as CSSProperties}
        />
        <div className="angka -mt-0.5 flex justify-between text-[10px] text-samar" aria-hidden>
          <span>{tahun[0]}</span>
          <span className="hidden sm:inline">{tahun[Math.floor((tahun.length - 1) / 2)]}</span>
          <span>{tahun[tahun.length - 1]}</span>
        </div>
      </div>
      <div className="hidden flex-col items-end gap-0.5 md:flex" title="Total cahaya nasional per tahun">
        <Sparkline nilai={cahaya} tanda={indeks} lebar={90} tinggi={26} />
        <span className="text-[10px] text-samar">cahaya nasional</span>
      </div>
    </section>
  );
}
