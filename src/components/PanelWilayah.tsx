"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { angka, persen, persenTanda, ringkas } from "@/lib/format";
import { indeks as jadiIndeks, pearson, regresi, spearman } from "@/lib/hitung";
import { SEMUA_METRIK, type Metrik, type Statistik, type Tingkat } from "@/lib/jenis";
import { batasMetrik, METRIK, nilaiSemua, tahunPlnTerakhir, type NilaiWilayah } from "@/lib/metrik";
import { KELAS_DUA_ARAH, KELAS_URUT } from "@/lib/palet";
import { Angka, Catatan, Judul, LegendaKelas, Sub } from "./Bagian";
import { GrafikGaris, GrafikSebar } from "./Grafik";

interface Props {
  s: Statistik;
  i: number;
  tingkat: Tingkat;
  metrik: Metrik;
  wilayah: string | null;
  saatTingkat(t: Tingkat): void;
  saatMetrik(m: Metrik): void;
  saatWilayah(kode: string | null, terbang?: boolean): void;
}

export function formatMetrik(metrik: Metrik, v: number | null): string {
  if (v == null) return "–";
  if (metrik === "tumbuh") return persenTanda(v);
  if (metrik === "perKapita") return angka(v, 2);
  return persen(v, 1);
}

function Detail({ s, i, tingkat, kode, saatTutup }: { s: Statistik; i: number; tingkat: Tingkat; kode: string; saatTutup(): void }) {
  const prov = tingkat === "provinsi" ? s.provinsi.find((p) => p.kode === kode) : undefined;
  const kab = tingkat === "kabupaten" ? s.kabupaten.find((k) => k.kode === kode) : undefined;
  const w = prov ?? kab;
  if (!w) return null;
  const idx = jadiIndeks(w.cahaya);
  const penduduk = prov ? prov.penduduk[i] : (kab?.penduduk2020 ?? null);
  const induk = kab ? s.provinsi.find((p) => p.kode === kab.prov)?.nama : null;
  return (
    <section aria-label={`Detail ${w.nama}`} className="mt-4 rounded-2xl border border-aksen/40 bg-aksen/[0.06] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="label-kecil m-0">{prov ? "Provinsi" : `Kabupaten/kota · ${induk}`}</p>
          <h3 className="m-0 mt-0.5 truncate text-[17px] font-semibold" data-testid="nama-wilayah">
            {w.nama}
          </h3>
        </div>
        <button type="button" className="tombol-ikon !h-8 !w-8" aria-label="Tutup detail wilayah" onClick={saatTutup}>
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Angka label={`Cahaya ${s.tahun[i]}`} nilai={angka(idx[i])} catatan={idx[i] == null ? "nyaris gelap di tahun awal" : `indeks, ${s.tahun[0]} = 100`} warna="var(--emas)" />
        <Angka label="Wilayah terang" nilai={persen(w.luasKm2 > 0 ? (w.luasTerang[i] / w.luasKm2) * 100 : null, 1)} catatan={`${angka(w.luasTerang[i])} dari ${angka(w.luasKm2)} km²`} />
        <Angka label={prov ? `Penduduk ${s.tahun[i]}` : "Penduduk 2020"} nilai={ringkas(penduduk)} catatan={penduduk ? `${angka((w.cahaya[i] / penduduk) * 1000, 2)} cahaya per 1.000 jiwa` : undefined} />
        {prov ? (
          <Angka label="Rumah tangga PLN" nilai={persen(prov.pln[i], 1)} catatan={prov.pln[i] == null ? "belum ada angka BPS" : "BPS Susenas"} warna="var(--pln)" />
        ) : (
          <Angka label="Total cahaya" nilai={angka(w.cahaya[i])} catatan="radiance × km²" />
        )}
      </div>
      <div className="mt-3">
        <GrafikGaris
          judul={`Deret tahunan ${w.nama}: indeks total cahaya${prov ? " dan persen rumah tangga berlistrik PLN" : ""}`}
          x={s.tahun}
          tanda={i}
          seri={[
            { nama: `Total cahaya (${s.tahun[0]} = 100)`, warna: "#ffb35c", nilai: idx[0] == null ? w.cahaya : idx },
            ...(prov ? [{ nama: "Rumah tangga PLN (%)", warna: "#7fb4ff", nilai: prov.pln, kanan: true }] : []),
          ]}
          satuanKanan="%"
        />
      </div>
      {prov?.pdrb ? (
        <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-redup">
          PDRB {prov.pdrb.tahun}: Rp {angka(prov.pdrb.berlaku / 1000, 1)} triliun (harga berlaku, BPS).
        </p>
      ) : null}
    </section>
  );
}

function Peringkat({ nilai, metrik, wilayah, saatPilih }: { nilai: NilaiWilayah[]; metrik: Metrik; wilayah: string | null; saatPilih(kode: string): void }) {
  const [bawah, setBawah] = useState(false);
  const [cari, setCari] = useState("");
  const urut = useMemo(() => nilai.filter((n) => n.nilai != null).sort((a, b) => (b.nilai as number) - (a.nilai as number)), [nilai]);
  const kata = cari.trim().toLowerCase();
  const tampil = kata ? nilai.filter((n) => n.nama.toLowerCase().includes(kata) || n.induk?.toLowerCase().includes(kata)).slice(0, 20) : (bawah ? [...urut].reverse() : urut).slice(0, 12);
  const posisi = new Map(urut.map((n, i) => [n.kode, i + 1]));
  return (
    <div>
      <div className="relative mb-2">
        <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-samar" />
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari wilayah…"
          aria-label="Cari provinsi atau kabupaten/kota"
          className="h-10 w-full rounded-xl border border-garis-kuat bg-black/40 pl-9 pr-3 text-[16px] text-teks placeholder:text-samar"
        />
      </div>
      {kata ? null : (
        <div className="mb-2 flex gap-1.5" role="group" aria-label="Urutan peringkat">
          <button type="button" className="chip flex-1" aria-pressed={!bawah} onClick={() => setBawah(false)}>
            Tertinggi
          </button>
          <button type="button" className="chip flex-1" aria-pressed={bawah} onClick={() => setBawah(true)}>
            Terendah
          </button>
        </div>
      )}
      <ol className="m-0 list-none p-0" data-testid="peringkat">
        {tampil.map((n) => (
          <li key={n.kode}>
            <button type="button" className="baris-pilih" aria-pressed={n.kode === wilayah} onClick={() => saatPilih(n.kode)}>
              <span className="angka w-7 flex-none text-[11px] text-samar">{posisi.get(n.kode) ?? "–"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{n.nama}</span>
                {n.induk ? <span className="block truncate text-[11px] text-samar">{n.induk}</span> : null}
              </span>
              <span className="angka flex-none text-[12.5px] text-emas">{formatMetrik(metrik, n.nilai)}</span>
            </button>
          </li>
        ))}
        {tampil.length === 0 ? <li className="px-2 py-3 text-[12.5px] text-redup">Tidak ada wilayah yang cocok.</li> : null}
      </ol>
    </div>
  );
}

function Analisis({ s, i, wilayah, saatPilih }: { s: Statistik; i: number; wilayah: string | null; saatPilih(kode: string): void }) {
  const iPln = Math.min(i, tahunPlnTerakhir(s));
  const pln = s.provinsi
    .filter((p) => p.pln[iPln] != null && p.penduduk[iPln])
    .map((p) => ({ kode: p.kode, nama: p.nama, x: p.pln[iPln] as number, y: (p.cahaya[iPln] / (p.penduduk[iPln] as number)) * 1000 }))
    .filter((t) => t.y > 0);
  const rhoPln = spearman(pln.map((t) => t.x), pln.map((t) => t.y));
  // provinsi yang sambungan PLN-nya sudah jenuh: seberapa jauh beda terangnya?
  const jenuh = pln.filter((t) => t.x >= 98).map((t) => t.y);
  const iAkhir = s.tahun.length - 1;
  const pdrb = s.provinsi
    .filter((p) => p.pdrb && p.cahaya[iAkhir] > 0)
    .map((p) => {
      // cahaya dicocokkan dengan tahun PDRB kalau tahunnya ada di deret
      const it = Math.max(0, s.tahun.indexOf(p.pdrb!.tahun));
      return { kode: p.kode, nama: p.nama, x: p.cahaya[it >= 0 ? it : iAkhir], y: p.pdrb!.berlaku / 1000 };
    });
  const lx = pdrb.map((t) => Math.log10(t.x));
  const ly = pdrb.map((t) => Math.log10(t.y));
  const r = pearson(lx, ly);
  const garis = regresi(lx, ly);
  const tahunPdrb = s.provinsi.find((p) => p.pdrb)?.pdrb?.tahun;
  return (
    <div>
      <Sub>Makin tersambung PLN, makin terang?</Sub>
      <GrafikSebar
        judul={`Sebaran 38 provinsi tahun ${s.tahun[iPln]}: persen rumah tangga PLN terhadap cahaya per kapita`}
        titik={pln}
        labelX={`rumah tangga PLN ${s.tahun[iPln]} (%)`}
        labelY="cahaya per 1.000 jiwa (log)"
        logY
        terpilih={wilayah}
        saatPilih={saatPilih}
      />
      <p className="m-0 mt-1.5 text-[11.5px] leading-relaxed text-redup">
        Korelasi peringkat Spearman ρ = <span className="angka text-teks">{angka(rhoPln, 2)}</span> ({pln.length} provinsi).
        {jenuh.length >= 3 ? (
          <>
            {" "}
            {jenuh.length} provinsi sudah di atas 98% tersambung, tapi cahaya per kapitanya masih terpaut <span className="angka text-teks">{angka(Math.max(...jenuh) / Math.min(...jenuh), 1)}</span> kali.
            Rasio sambungan sudah tidak membedakan; cahaya masih.
          </>
        ) : (
          " Makin banyak rumah tersambung, makin terang provinsinya per kapita."
        )}
      </p>

      <Sub>Cahaya sebagai proksi ekonomi</Sub>
      <GrafikSebar
        judul={`Sebaran 38 provinsi: total cahaya terhadap PDRB ${tahunPdrb}, keduanya skala log`}
        titik={pdrb}
        labelX={`total cahaya ${tahunPdrb} (log)`}
        labelY="PDRB, Rp triliun (log)"
        logX
        logY
        garis={garis}
        terpilih={wilayah}
        saatPilih={saatPilih}
      />
      <p className="m-0 mt-1.5 text-[11.5px] leading-relaxed text-redup">
        Korelasi log-log r = <span className="angka text-teks">{angka(r, 2)}</span>
        {garis ? (
          <>
            , elastisitas <span className="angka text-teks">{angka(garis.b, 2)}</span>: cahaya dua kali lipat sejalan dengan PDRB sekitar{" "}
            <span className="angka text-teks">{angka(Math.pow(2, garis.b), 1)}</span> kali
          </>
        ) : null}
        . Titik jauh di atas garis = ekonomi besar tapi hemat cahaya; jauh di bawah = terang tapi nilai
        tambahnya kecil.
      </p>
    </div>
  );
}

export default function PanelWilayah({ s, i, tingkat, metrik, wilayah, saatTingkat, saatMetrik, saatWilayah }: Props) {
  const info = METRIK[metrik];
  const nilai = useMemo(() => nilaiSemua(s, tingkat, metrik, i), [s, tingkat, metrik, i]);
  const batas = useMemo(() => batasMetrik(metrik, nilai), [metrik, nilai]);
  return (
    <div>
      <Judul kecil="Wilayah">Siapa yang makin terang, siapa yang tertinggal</Judul>
      <Catatan>Peta diwarnai per {tingkat === "provinsi" ? "provinsi" : "kabupaten/kota"}. Klik wilayah di peta atau di daftar untuk melihat deretnya.</Catatan>

      <div className="mt-3 flex gap-1.5" role="group" aria-label="Tingkat wilayah">
        <button type="button" className="chip flex-1" aria-pressed={tingkat === "provinsi"} onClick={() => saatTingkat("provinsi")}>
          38 provinsi
        </button>
        <button type="button" className="chip flex-1" aria-pressed={tingkat === "kabupaten"} onClick={() => saatTingkat("kabupaten")}>
          514 kabupaten/kota
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label="Metrik peta">
        {SEMUA_METRIK.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={metrik === m} disabled={Boolean(METRIK[m].hanyaProvinsi) && tingkat !== "provinsi"} onClick={() => saatMetrik(m)} style={METRIK[m].hanyaProvinsi && tingkat !== "provinsi" ? { opacity: 0.4 } : undefined}>
            {METRIK[m].pendek}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-garis bg-white/[0.03] p-3">
        <p className="m-0 text-[13px] font-medium">
          {info.label}
          {metrik === "tumbuh" ? "" : ` · ${s.tahun[i]}`}
        </p>
        <p className="m-0 mb-2 mt-1 text-[11.5px] leading-relaxed text-redup">{info.keterangan}</p>
        <LegendaKelas warna={info.duaArah ? KELAS_DUA_ARAH : KELAS_URUT} batas={batas} format={(v) => (metrik === "tumbuh" ? persenTanda(v) : metrik === "perKapita" ? angka(v, v < 10 ? 1 : 0) : angka(v, v < 10 ? 1 : 0) + "%")} />
      </div>

      {wilayah ? <Detail s={s} i={i} tingkat={tingkat} kode={wilayah} saatTutup={() => saatWilayah(null)} /> : null}

      <Sub>Peringkat</Sub>
      <Peringkat nilai={nilai} metrik={metrik} wilayah={wilayah} saatPilih={(kode) => saatWilayah(kode, true)} />

      {tingkat === "provinsi" ? <Analisis s={s} i={i} wilayah={wilayah} saatPilih={(kode) => saatWilayah(kode, true)} /> : null}
    </div>
  );
}
