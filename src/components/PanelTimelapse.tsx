"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { angka, geserHari, persen, persenTanda, tanggal } from "@/lib/format";
import { jepitTanggal, TANGGAL_AWAL_GIBS } from "@/lib/gibs";
import { indeks as jadiIndeks, persenUbah } from "@/lib/hitung";
import type { Statistik } from "@/lib/jenis";
import { TEMPAT, type Tempat } from "@/lib/tempat";
import { Angka, Catatan, Judul, LegendaCahaya, Sub } from "./Bagian";
import { GrafikGaris } from "./Grafik";

interface Props {
  s: Statistik;
  i: number;
  harian: string | null;
  maksHarian: string;
  saatHarian(tanggal: string | null): void;
  saatLompat(t: Tempat): void;
}

export default function PanelTimelapse({ s, i, harian, maksHarian, saatHarian, saatLompat }: Props) {
  const n = s.nasional;
  const tahun = s.tahun[i];
  const idxCahaya = jadiIndeks(n.cahaya);
  const parsial = i === s.tahun.length - 1 && s.sampel[i].jumlah < 22;
  const gelap = (idx: number) => s.kabupaten.filter((k) => k.luasTerang[idx] === 0).length;
  return (
    <div>
      <Judul kecil="Time-lapse · NASA Black Marble">Indonesia setelah gelap, {s.tahun[0]}–{s.tahun[s.tahun.length - 1]}</Judul>
      <Catatan>
        Tiap titik terang adalah lampu yang cukup kuat untuk terlihat dari orbit 824 km. Geser tahunnya atau tekan putar, lalu
        perhatikan mana yang menyala, melebar, atau padam.
      </Catatan>

      <div className="mt-3">
        <LegendaCahaya />
      </div>

      <div className="mt-4 flex gap-1.5" role="group" aria-label="Sumber citra">
        <button type="button" className="chip flex-1" aria-pressed={!harian} onClick={() => saatHarian(null)}>
          Komposit tahunan
        </button>
        <button type="button" className="chip flex-1" aria-pressed={Boolean(harian)} onClick={() => saatHarian(harian ?? maksHarian)}>
          Harian (live NASA)
        </button>
      </div>

      {harian ? (
        <div className="mt-3 rounded-xl border border-garis bg-white/[0.03] p-3">
          <label htmlFor="tgl-harian" className="label-kecil block">
            Tanggal lintasan (UTC)
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="tombol-ikon" aria-label="Sehari sebelumnya" disabled={harian <= TANGGAL_AWAL_GIBS} onClick={() => saatHarian(jepitTanggal(geserHari(harian, -1), maksHarian))}>
              <ChevronLeft size={18} aria-hidden />
            </button>
            <input
              id="tgl-harian"
              type="date"
              className="angka h-9 min-w-0 flex-1 rounded-lg border border-garis-kuat bg-black/40 px-2 text-[16px] text-teks [color-scheme:dark]"
              value={harian}
              min={TANGGAL_AWAL_GIBS}
              max={maksHarian}
              onChange={(e) => e.target.value && saatHarian(jepitTanggal(e.target.value, maksHarian))}
            />
            <button type="button" className="tombol-ikon" aria-label="Sehari sesudahnya" disabled={harian >= maksHarian} onClick={() => saatHarian(jepitTanggal(geserHari(harian, 1), maksHarian))}>
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-redup">
            {tanggal(harian)}. Ubin diambil langsung dari NASA GIBS dan diwarnai ulang di browser. Produk ini diisi-celah: kalau malam
            itu berawan, yang tampil pengamatan cerah terakhir. Tersedia sejak 19 Januari 2012, telat sekitar dua minggu dari hari ini.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Angka label={`Total cahaya ${tahun}`} nilai={angka(idxCahaya[i], 0)} catatan={`indeks, ${s.tahun[0]} = 100 (${persenTanda(persenUbah(n.cahaya[0], n.cahaya[i]))})`} warna="var(--emas)" />
            <Angka label="Wilayah terang" nilai={`${angka(n.luasTerang[i])} km²`} catatan={`${persenTanda(persenUbah(n.luasTerang[0], n.luasTerang[i]))} sejak ${s.tahun[0]}`} />
            <Angka label="Rumah tangga PLN" nilai={persen(n.pln[i], 1)} catatan={n.pln[i] == null ? "angka BPS belum terbit" : "penerangan utama, BPS Susenas"} warna="var(--pln)" />
            <Angka label="Cahaya per kapita" nilai={angka((n.cahaya[i] / n.penduduk[i]) * 1000, 2)} catatan="per 1.000 penduduk" />
          </div>
          {parsial ? <p className="m-0 mt-2 text-[11.5px] text-aksen">{tahun} belum genap: komposit baru sampai {tanggal(s.sampel[i].terakhir, true)}.</p> : null}
          <p className="m-0 mt-2 text-[12px] leading-relaxed text-redup">
            Kabupaten/kota tanpa satu piksel terang pun: <span className="angka text-teks">{gelap(i)}</span> di {tahun}, dari <span className="angka text-teks">{gelap(0)}</span> di {s.tahun[0]}.
          </p>

          <Sub>Cahaya vs listrik PLN</Sub>
          <GrafikGaris
            judul="Indeks total cahaya nasional dibanding persen rumah tangga berlistrik PLN per tahun"
            x={s.tahun}
            tanda={i}
            seri={[
              { nama: `Total cahaya (${s.tahun[0]} = 100)`, warna: "#ffb35c", nilai: idxCahaya },
              { nama: "Rumah tangga PLN (%)", warna: "#7fb4ff", nilai: n.pln, kanan: true },
            ]}
            satuanKanan="%"
          />
          <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-redup">
            Angka PLN sudah di atas 90% sejak awal dan sekarang mentok dekat 100%, tapi cahayanya masih terus naik. Sambungan listrik
            cuma langkah pertama; yang kelihatan dari orbit adalah seberapa banyak listrik itu benar-benar dipakai.
          </p>
        </>
      )}

      <Sub>Lompat ke</Sub>
      <div className="flex flex-wrap gap-1.5">
        {TEMPAT.map((t) => (
          <button key={t.id} type="button" className="chip" onClick={() => saatLompat(t)}>
            {t.nama}
          </button>
        ))}
      </div>
    </div>
  );
}
