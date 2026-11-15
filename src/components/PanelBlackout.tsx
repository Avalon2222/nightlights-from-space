"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import { angka, hariRelatif, tanggal } from "@/lib/format";
import type { Kejadian, TampilanKejadian } from "@/lib/jenis";
import { Angka, Catatan, Judul, LegendaCahaya, LegendaSelisih, Sub } from "./Bagian";
import { GrafikHarian } from "./Grafik";

interface Props {
  daftar: Kejadian[];
  terpilih: string | null;
  tampilan: TampilanKejadian;
  saatPilih(id: string | null): void;
  saatTampilan(t: TampilanKejadian): void;
}

export interface Sinyal {
  label: string;
  warna: string;
}

/** Seberapa jelas jejak padamnya di data, dari titik terendah median 3 malam (garis dasar = 100). */
export function sinyal(terendah: number): Sinyal {
  if (terendah < 60) return { label: "sinyal kuat", warna: "var(--turun)" };
  if (terendah < 85) return { label: "sinyal sedang", warna: "var(--aksen)" };
  if (terendah < 95) return { label: "sinyal lemah", warna: "var(--redup)" };
  return { label: "tidak terlihat", warna: "var(--samar)" };
}

const TAMPILAN: { id: TampilanKejadian; label: string }[] = [
  { id: "sebelum", label: "Sebelum" },
  { id: "sesudah", label: "Sesudah" },
  { id: "selisih", label: "Selisih" },
];

function Rinci({ k, tampilan, saatTampilan, saatKembali }: { k: Kejadian; tampilan: TampilanKejadian; saatTampilan(t: TampilanKejadian): void; saatKembali(): void }) {
  const sg = sinyal(k.terendah.indeks);
  const [a, b] = k.rentangSesudah;
  return (
    <div>
      <button type="button" className="chip mb-3" onClick={saatKembali}>
        <ArrowLeft size={14} aria-hidden /> Semua kejadian
      </button>
      <Judul kecil={`${tanggal(k.tanggal)} · ${k.lokasi}`}>{k.judul}</Judul>
      <Catatan>{k.ringkas}</Catatan>

      <div className="mt-3 flex gap-1.5" role="group" aria-label="Citra yang ditampilkan">
        {TAMPILAN.map((t) => (
          <button key={t.id} type="button" className="chip flex-1" aria-pressed={tampilan === t.id} onClick={() => saatTampilan(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="m-0 mb-2 mt-2 text-[11.5px] leading-relaxed text-redup">
        {tampilan === "sebelum"
          ? "Median 30 malam sebelum kejadian: kondisi normal."
          : tampilan === "sesudah"
            ? `Median malam ${hariRelatif(a)}${b > a ? ` sampai ${hariRelatif(b)}` : ""}.`
            : "Sesudah dikurangi sebelum: merah muda = cahaya yang hilang."}
      </p>
      {tampilan === "selisih" ? <LegendaSelisih /> : <LegendaCahaya />}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Angka label="Titik terendah" nilai={angka(k.terendah.indeks)} catatan={`dari 100, pada ${hariRelatif(k.terendah.hari)} (median 3 malam)`} warna={sg.warna} />
        <Angka
          label="Kembali ke 90"
          nilai={k.terendah.indeks >= 90 ? "–" : k.hariPulih == null ? "belum" : hariRelatif(k.hariPulih)}
          catatan={k.terendah.indeks >= 90 ? "tidak pernah turun di bawah 90" : k.hariPulih == null ? "sampai akhir pantauan H+75" : "malam pertama median ≥ 90"}
        />
      </div>

      <Sub>Cahaya malam demi malam</Sub>
      <GrafikHarian judul={`Indeks cahaya harian ${k.judul}, 30 malam sebelum sampai 75 malam sesudah; 100 adalah kondisi normal`} deret={k.deret} rentangSesudah={k.rentangSesudah} />
      <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-samar">
        Indeks = total cahaya piksel yang biasanya terang ({angka(k.luasTerangKm2)} km²) dibanding garis dasar. Deret yang datar persis
        berarti malam-malam itu berawan dan nilainya masih isian dari pengamatan cerah terakhir.
      </p>
      <a href={k.sumber} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-emas underline-offset-2 hover:underline">
        Latar kejadian <ExternalLink size={12} aria-hidden />
      </a>
    </div>
  );
}

export default function PanelBlackout({ daftar, terpilih, tampilan, saatPilih, saatTampilan }: Props) {
  const k = daftar.find((x) => x.id === terpilih);
  if (k) return <Rinci k={k} tampilan={tampilan} saatTampilan={saatTampilan} saatKembali={() => saatPilih(null)} />;
  return (
    <div>
      <Judul kecil="Blackout dan bencana">Saat lampu padam, satelit ikut mencatat</Judul>
      <Catatan>
        {daftar.length} kejadian, diukur dengan cara yang sama: cahaya 30 malam sebelum dibanding malam-malam sesudahnya. Sebagian jejaknya
        gamblang, sebagian nyaris tak terlihat, dan dua-duanya layak ditunjukkan.
      </Catatan>
      <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
        {daftar.map((x) => {
          const sg = sinyal(x.terendah.indeks);
          return (
            <li key={x.id}>
              <button type="button" className="baris-pilih !items-start !border-garis !bg-white/[0.03]" onClick={() => saatPilih(x.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium leading-snug">{x.judul}</span>
                  <span className="mt-0.5 block text-[11.5px] text-redup">
                    {tanggal(x.tanggal, true)} · {x.lokasi}
                  </span>
                </span>
                <span className="flex-none text-right">
                  <span className="angka block text-[15px]" style={{ color: sg.warna }}>
                    {angka(x.terendah.indeks)}
                  </span>
                  <span className="block text-[10.5px]" style={{ color: sg.warna }}>
                    {sg.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-samar">
        Angka di kanan = titik terendah indeks cahaya dalam 30 malam setelah kejadian (100 = normal). Satelit lewat sekitar pukul
        01.30 waktu setempat dan tidak menembus awan, jadi padam singkat atau padam di musim hujan sering lolos.
      </p>
    </div>
  );
}
