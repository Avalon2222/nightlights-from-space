"use client";

import { useMemo, useState } from "react";
import { angka, persenTanda } from "@/lib/format";
import { rataUjung } from "@/lib/hitung";
import type { Statistik } from "@/lib/jenis";
import { Catatan, Judul, LegendaSelisih, Sub } from "./Bagian";

interface Props {
  s: Statistik;
  saatPilihKabupaten(kode: string): void;
}

type Urut = "naik" | "turun" | "persen";

/** Selisih rata-rata tiga tahun terakhir terhadap tiga tahun pertama, per kabupaten/kota. */
export function selisihKabupaten(s: Statistik) {
  const namaProv = new Map(s.provinsi.map((p) => [p.kode, p.nama]));
  return s.kabupaten.map((k) => {
    const awal = rataUjung(k.cahaya, 3, "awal");
    const akhir = rataUjung(k.cahaya, 3, "akhir");
    return { kode: k.kode, nama: k.nama, prov: namaProv.get(k.prov) ?? "", awal, akhir, selisih: akhir - awal, persen: awal >= 20 ? ((akhir - awal) / awal) * 100 : null };
  });
}

export default function PanelPerubahan({ s, saatPilihKabupaten }: Props) {
  const [urut, setUrut] = useState<Urut>("naik");
  const semua = useMemo(() => selisihKabupaten(s), [s]);
  const daftar = useMemo(() => {
    const d = [...semua];
    if (urut === "naik") d.sort((a, b) => b.selisih - a.selisih);
    else if (urut === "turun") d.sort((a, b) => a.selisih - b.selisih);
    else return d.filter((x) => x.persen != null).sort((a, b) => (b.persen as number) - (a.persen as number)).slice(0, 12);
    return d.slice(0, 12);
  }, [semua, urut]);
  const n = s.tahun.length;
  const awal = `${s.tahun[0]}–${s.tahun[2]}`;
  const akhir = `${s.tahun[n - 3]}–${s.tahun[n - 1]}`;
  const meredup = semua.filter((x) => x.selisih < 0).length;
  return (
    <div>
      <Judul kecil="Peta perubahan">Di mana lampu bertambah, di mana meredup</Judul>
      <Catatan>
        Rata-rata {akhir} dikurangi rata-rata {awal}, piksel demi piksel. Jalan tol baru muncul sebagai garis toska, kawasan industri
        sebagai bercak terang, dan tambang atau ladang gas yang tutup berubah merah muda.
      </Catatan>
      <div className="mt-3">
        <LegendaSelisih />
      </div>
      <p className="m-0 mt-3 text-[12px] leading-relaxed text-redup">
        Dari {s.kabupaten.length} kabupaten/kota, <span className="text-naik">{s.kabupaten.length - meredup} bertambah terang</span> dan{" "}
        <span className="text-turun">{meredup} meredup</span>.
      </p>

      <Sub>Kabupaten/kota paling berubah</Sub>
      <div className="mb-2 flex gap-1.5" role="group" aria-label="Urutan daftar">
        <button type="button" className="chip flex-1" aria-pressed={urut === "naik"} onClick={() => setUrut("naik")}>
          Paling naik
        </button>
        <button type="button" className="chip flex-1" aria-pressed={urut === "persen"} onClick={() => setUrut("persen")}>
          Naik % tertinggi
        </button>
        <button type="button" className="chip flex-1" aria-pressed={urut === "turun"} onClick={() => setUrut("turun")}>
          Paling turun
        </button>
      </div>
      <ol className="m-0 list-none p-0">
        {daftar.map((d, i) => (
          <li key={d.kode}>
            <button type="button" className="baris-pilih" onClick={() => saatPilihKabupaten(d.kode)}>
              <span className="angka w-5 flex-none text-[11px] text-samar">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{d.nama}</span>
                <span className="block truncate text-[11px] text-samar">{d.prov}</span>
              </span>
              <span className="angka flex-none text-right text-[12.5px]" style={{ color: d.selisih >= 0 ? "var(--naik)" : "var(--turun)" }}>
                {urut === "persen" ? persenTanda(d.persen) : `${d.selisih >= 0 ? "+" : "−"}${angka(Math.abs(d.selisih))}`}
                <span className="block text-[10.5px] text-samar">{urut === "persen" ? `${angka(d.awal)} → ${angka(d.akhir)}` : persenTanda(d.persen)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-samar">
        Angka = total cahaya (radiance × km² piksel terang). Persen hanya dihitung kalau cahaya awalnya cukup besar untuk dibandingkan.
        Klik nama untuk terbang ke sana.
      </p>
    </div>
  );
}
