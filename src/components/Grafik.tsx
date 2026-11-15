/** Grafik SVG ringan buatan sendiri: garis multi-seri, sparkline, sebar, dan deret harian kejadian. */

import { angka } from "@/lib/format";

const L = 320;

function rentang(nilai: (number | null)[], bantalan = 0.08): [number, number] {
  const ada = nilai.filter((v): v is number => v != null && Number.isFinite(v));
  if (ada.length === 0) return [0, 1];
  let bawah = Math.min(...ada);
  let atas = Math.max(...ada);
  if (bawah === atas) {
    bawah -= 1;
    atas += 1;
  }
  const b = (atas - bawah) * bantalan;
  return [bawah - b, atas + b];
}

function jalur(titik: ([number, number] | null)[]): string {
  let d = "";
  let sambung = false;
  for (const t of titik) {
    if (!t) {
      sambung = false;
      continue;
    }
    d += `${sambung ? "L" : "M"}${t[0].toFixed(1)},${t[1].toFixed(1)}`;
    sambung = true;
  }
  return d;
}

export interface Seri {
  nama: string;
  warna: string;
  nilai: (number | null)[];
  /** sumbu kanan dipakai untuk seri berskala lain (mis. persen) */
  kanan?: boolean;
  putus?: boolean;
}

interface PropsGaris {
  x: number[];
  seri: Seri[];
  /** indeks x yang ditandai garis tegak */
  tanda?: number;
  tinggi?: number;
  judul: string;
  satuanKiri?: string;
  satuanKanan?: string;
  /** paksa rentang sumbu kanan, mis. [0, 100] untuk persen */
  rentangKanan?: [number, number];
  /** mulai sumbu kiri dari nol */
  dariNol?: boolean;
}

export function GrafikGaris({ x, seri, tanda, tinggi = 150, judul, satuanKiri = "", satuanKanan = "", rentangKanan, dariNol }: PropsGaris) {
  const m = { kiri: 34, kanan: seri.some((s) => s.kanan) ? 34 : 8, atas: 10, bawah: 20 };
  const w = L - m.kiri - m.kanan;
  const h = tinggi - m.atas - m.bawah;
  const [kMin, kMaks] = rentang(seri.filter((s) => !s.kanan).flatMap((s) => s.nilai));
  // sumbu kiri selalu dari nol: deret cahaya dibaca sebagai besaran, bukan selisih
  const [k0, k1] = dariNol ? [0, kMaks] : [kMin, kMaks];
  const [r0, r1] = rentangKanan ?? rentang(seri.filter((s) => s.kanan).flatMap((s) => s.nilai));
  const px = (i: number) => m.kiri + (x.length <= 1 ? w / 2 : (i / (x.length - 1)) * w);
  const py = (v: number, kanan?: boolean) => m.atas + h - ((v - (kanan ? r0 : k0)) / ((kanan ? r1 : k1) - (kanan ? r0 : k0))) * h;
  const garisY = [0, 0.5, 1];
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${L} ${tinggi}`} className="block h-auto w-full" role="img" aria-label={judul}>
        {garisY.map((f) => (
          <g key={f}>
            <line x1={m.kiri} x2={L - m.kanan} y1={m.atas + h * (1 - f)} y2={m.atas + h * (1 - f)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x={m.kiri - 5} y={m.atas + h * (1 - f) + 3} textAnchor="end" fontSize="9" fill="#7682a0" className="angka">
              {angka(k0 + (k1 - k0) * f)}
              {satuanKiri}
            </text>
            {seri.some((s) => s.kanan) ? (
              <text x={L - m.kanan + 5} y={m.atas + h * (1 - f) + 3} fontSize="9" fill="#7fb4ff" className="angka">
                {angka(r0 + (r1 - r0) * f)}
                {satuanKanan}
              </text>
            ) : null}
          </g>
        ))}
        {x.map((label, i) =>
          i === 0 || i === x.length - 1 || (x.length > 8 && i === Math.floor((x.length - 1) / 2)) ? (
            <text key={label} x={px(i)} y={tinggi - 5} textAnchor={i === 0 ? "start" : i === x.length - 1 ? "end" : "middle"} fontSize="9" fill="#7682a0" className="angka">
              {label}
            </text>
          ) : null,
        )}
        {tanda != null && tanda >= 0 && tanda < x.length ? <line x1={px(tanda)} x2={px(tanda)} y1={m.atas} y2={m.atas + h} stroke="rgba(255,217,138,0.55)" strokeWidth="1" strokeDasharray="3 3" /> : null}
        {seri.map((s) => (
          <g key={s.nama}>
            <path d={jalur(s.nilai.map((v, i) => (v == null ? null : [px(i), py(v, s.kanan)])))} fill="none" stroke={s.warna} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.putus ? "4 3" : undefined} />
            {tanda != null && s.nilai[tanda] != null ? <circle cx={px(tanda)} cy={py(s.nilai[tanda] as number, s.kanan)} r="3.2" fill={s.warna} stroke="#03050b" strokeWidth="1.2" /> : null}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-redup">
        {seri.map((s) => (
          <span key={s.nama} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-[3px] w-3 rounded" style={{ background: s.warna }} />
            {s.nama}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function Sparkline({ nilai, warna = "#ffb35c", tanda, lebar = 72, tinggi = 22 }: { nilai: number[]; warna?: string; tanda?: number; lebar?: number; tinggi?: number }) {
  const [a, b] = rentang(nilai, 0.1);
  const px = (i: number) => 1 + (nilai.length <= 1 ? 0 : (i / (nilai.length - 1)) * (lebar - 2));
  const py = (v: number) => tinggi - 2 - ((v - a) / (b - a)) * (tinggi - 4);
  return (
    <svg width={lebar} height={tinggi} viewBox={`0 0 ${lebar} ${tinggi}`} aria-hidden className="flex-none">
      <path d={jalur(nilai.map((v, i) => [px(i), py(v)]))} fill="none" stroke={warna} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {tanda != null && nilai[tanda] != null ? <circle cx={px(tanda)} cy={py(nilai[tanda])} r="2.4" fill="#fff7e6" /> : null}
    </svg>
  );
}

export interface TitikSebar {
  kode: string;
  nama: string;
  x: number;
  y: number;
}

interface PropsSebar {
  titik: TitikSebar[];
  judul: string;
  labelX: string;
  labelY: string;
  logX?: boolean;
  logY?: boolean;
  terpilih?: string | null;
  garis?: { a: number; b: number } | null;
  saatPilih?(kode: string): void;
  tinggi?: number;
}

export function GrafikSebar({ titik, judul, labelX, labelY, logX, logY, terpilih, garis, saatPilih, tinggi = 190 }: PropsSebar) {
  const m = { kiri: 12, kanan: 10, atas: 10, bawah: 22 };
  const w = L - m.kiri - m.kanan;
  const h = tinggi - m.atas - m.bawah;
  const tx = (v: number) => (logX ? Math.log10(v) : v);
  const ty = (v: number) => (logY ? Math.log10(v) : v);
  const layak = titik.filter((t) => Number.isFinite(tx(t.x)) && Number.isFinite(ty(t.y)));
  const [x0, x1] = rentang(layak.map((t) => tx(t.x)));
  const [y0, y1] = rentang(layak.map((t) => ty(t.y)));
  const px = (v: number) => m.kiri + ((tx(v) - x0) / (x1 - x0)) * w;
  const py = (v: number) => m.atas + h - ((ty(v) - y0) / (y1 - y0)) * h;
  const pilih = layak.find((t) => t.kode === terpilih);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${L} ${tinggi}`} className="block h-auto w-full" role="img" aria-label={judul}>
        <rect x={m.kiri} y={m.atas} width={w} height={h} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
        {garis ? (
          <line
            x1={m.kiri}
            x2={m.kiri + w}
            y1={m.atas + h - ((garis.a + garis.b * x0 - y0) / (y1 - y0)) * h}
            y2={m.atas + h - ((garis.a + garis.b * x1 - y0) / (y1 - y0)) * h}
            stroke="rgba(255,217,138,0.5)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        ) : null}
        {layak.map((t) => (
          <circle
            key={t.kode}
            cx={px(t.x)}
            cy={py(t.y)}
            r={t.kode === terpilih ? 5 : 3.4}
            fill={t.kode === terpilih ? "#fff7e6" : "rgba(255,179,92,0.75)"}
            stroke={t.kode === terpilih ? "#ffb35c" : "rgba(3,5,11,0.8)"}
            strokeWidth={t.kode === terpilih ? 2 : 0.8}
            style={saatPilih ? { cursor: "pointer" } : undefined}
            onClick={saatPilih ? () => saatPilih(t.kode) : undefined}
          >
            <title>{t.nama}</title>
          </circle>
        ))}
        {pilih ? (
          <text x={Math.min(L - 60, Math.max(m.kiri + 4, px(pilih.x) + 8))} y={Math.max(m.atas + 10, py(pilih.y) - 8)} fontSize="10" fill="#fff7e6">
            {pilih.nama}
          </text>
        ) : null}
        <text x={m.kiri + w / 2} y={tinggi - 6} textAnchor="middle" fontSize="9.5" fill="#98a3b8">
          {labelX} →
        </text>
        <text x={m.kiri + 4} y={m.atas + 11} fontSize="9.5" fill="#98a3b8">
          ↑ {labelY}
        </text>
      </svg>
    </figure>
  );
}

interface PropsHarian {
  /** [hari relatif, indeks] */
  deret: [number, number][];
  rentangSesudah: [number, number];
  judul: string;
  tinggi?: number;
}

/** Deret harian kejadian: titik = tiap malam, garis = median geser 3 malam, 100 = garis dasar. */
export function GrafikHarian({ deret, rentangSesudah, judul, tinggi = 160 }: PropsHarian) {
  const m = { kiri: 30, kanan: 8, atas: 10, bawah: 20 };
  const w = L - m.kiri - m.kanan;
  const h = tinggi - m.atas - m.bawah;
  const hari0 = deret[0]?.[0] ?? -30;
  const hari1 = deret[deret.length - 1]?.[0] ?? 75;
  const atas = Math.max(120, ...deret.map((d) => d[1])) + 5;
  const px = (hari: number) => m.kiri + ((hari - hari0) / (hari1 - hari0)) * w;
  const py = (v: number) => m.atas + h - (Math.max(0, v) / atas) * h;
  const halus = deret.map((d, i) => {
    const jendela = deret.slice(Math.max(0, i - 1), i + 2).map((x) => x[1]).sort((a, b) => a - b);
    return [d[0], jendela[Math.floor(jendela.length / 2)]] as [number, number];
  });
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${L} ${tinggi}`} className="block h-auto w-full" role="img" aria-label={judul}>
        <rect x={px(rentangSesudah[0]) - 2} y={m.atas} width={Math.max(4, px(rentangSesudah[1]) - px(rentangSesudah[0]) + 4)} height={h} fill="rgba(255,107,142,0.12)" />
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={m.kiri} x2={L - m.kanan} y1={py(v)} y2={py(v)} stroke={v === 100 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.08)"} strokeWidth="1" strokeDasharray={v === 100 ? "4 3" : undefined} />
            <text x={m.kiri - 5} y={py(v) + 3} textAnchor="end" fontSize="9" fill="#7682a0" className="angka">
              {v}
            </text>
          </g>
        ))}
        <line x1={px(0)} x2={px(0)} y1={m.atas} y2={m.atas + h} stroke="#ff6b8e" strokeWidth="1.2" />
        <text x={px(0) + 4} y={m.atas + 9} fontSize="9" fill="#ff6b8e">
          kejadian
        </text>
        {deret.map((d) => (
          <circle key={d[0]} cx={px(d[0])} cy={py(d[1])} r="1.6" fill="rgba(255,217,138,0.55)" />
        ))}
        <path d={jalur(halus.map((d) => [px(d[0]), py(d[1])]))} fill="none" stroke="#ffb35c" strokeWidth="1.8" strokeLinejoin="round" />
        {[hari0, 0, 30, 60].filter((v) => v >= hari0 && v <= hari1).map((v) => (
          <text key={v} x={px(v)} y={tinggi - 5} textAnchor={v === hari0 ? "start" : "middle"} fontSize="9" fill="#7682a0" className="angka">
            {v === 0 ? "H" : v > 0 ? `H+${v}` : `H${v}`}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-redup">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emas/60" />
          tiap malam
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-[3px] w-3 rounded bg-aksen" />
          median 3 malam
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-turun/20" />
          rentang citra sesudah
        </span>
      </figcaption>
    </figure>
  );
}
