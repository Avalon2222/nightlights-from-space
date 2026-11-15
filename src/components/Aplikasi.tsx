"use client";

import { ChevronDown, ChevronUp, History, Home, Info, Map as IkonPeta, Sparkles, TrendingUp, ZapOff, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { muatData, type Data } from "@/lib/data";
import { jepitTanggal, tanggalTerakhirGibs } from "@/lib/gibs";
import { kelasDari } from "@/lib/hitung";
import { SEMUA_MODE, type Metrik, type Mode, type TampilanKejadian, type Tingkat } from "@/lib/jenis";
import { batasMetrik, METRIK, nilaiSemua } from "@/lib/metrik";
import { KELAS_DUA_ARAH, KELAS_URUT, WARNA_KOSONG } from "@/lib/palet";
import { KendaliPeta, type Kamera } from "@/lib/peta/kendali";
import type { Tempat } from "@/lib/tempat";
import { bacaHash, tulisHash } from "@/lib/urlState";
import GarisWaktu from "./GarisWaktu";
import PanelBlackout from "./PanelBlackout";
import PanelHotspot from "./PanelHotspot";
import PanelPerubahan from "./PanelPerubahan";
import PanelTentang from "./PanelTentang";
import PanelTimelapse from "./PanelTimelapse";
import PanelWilayah, { formatMetrik } from "./PanelWilayah";

const INFO_MODE: Record<Mode, { label: string; ikon: LucideIcon }> = {
  timelapse: { label: "Time-lapse", ikon: History },
  perubahan: { label: "Perubahan", ikon: TrendingUp },
  wilayah: { label: "Wilayah", ikon: IkonPeta },
  blackout: { label: "Blackout", ikon: ZapOff },
  hotspot: { label: "Hotspot", ikon: Sparkles },
  tentang: { label: "Tentang", ikon: Info },
};

/** lama satu tahun saat diputar, dan lama silang saat slider digeser (ms) */
const MS_PER_TAHUN = 1150;
const MS_SILANG = 320;
const MS_JEDA_AKHIR = 1600;

function tingkatDariKode(kode: string | null, cadangan: Tingkat): Tingkat {
  if (!kode) return cadangan;
  return kode.length === 2 ? "provinsi" : "kabupaten";
}

export default function Aplikasi() {
  const awal = useMemo(() => bacaHash(typeof window === "undefined" ? "" : window.location.hash), []);
  const wadahRef = useRef<HTMLDivElement>(null);
  const kendaliRef = useRef<KendaliPeta | null>(null);
  const kameraRef = useRef<Kamera | null>(awal.kamera);
  const posisiRef = useRef(0);
  const rafRef = useRef(0);
  const mainRef = useRef(false);

  const [data, setData] = useState<Data | null>(null);
  const [gagal, setGagal] = useState(false);
  const [petaSiap, setPetaSiap] = useState(false);
  const [mode, setMode] = useState<Mode>(awal.mode);
  const [i, setI] = useState(0);
  const [harian, setHarian] = useState<string | null>(awal.harian);
  const [tingkat, setTingkat] = useState<Tingkat>(tingkatDariKode(awal.wilayah, awal.tingkat));
  const [metrik, setMetrik] = useState<Metrik>(awal.metrik);
  const [wilayah, setWilayah] = useState<string | null>(awal.wilayah);
  const [kejadianId, setKejadianId] = useState<string | null>(awal.kejadian);
  const [tampilan, setTampilan] = useState<TampilanKejadian>(awal.tampilan);
  const [sorotanId, setSorotanId] = useState<string | null>(awal.sorotan);
  const [main, setMain] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [lembar, setLembar] = useState(true);
  const [arah, setArah] = useState<{ kode: string; x: number; y: number } | null>(null);
  const [versiUrl, setVersiUrl] = useState(0);

  const maksHarian = useMemo(() => tanggalTerakhirGibs(), []);
  const s = data?.statistik ?? null;
  const tahun = useMemo(() => s?.tahun ?? [], [s]);
  const garisWaktuTampil = (mode === "timelapse" && !harian) || mode === "wilayah" || mode === "hotspot";

  // ------------------------------------------------------------------ data + peta
  useEffect(() => {
    let batal = false;
    muatData()
      .then((d) => {
        if (batal) return;
        const idx = awal.tahun != null ? d.statistik.tahun.indexOf(awal.tahun) : -1;
        const mulai = idx >= 0 ? idx : d.statistik.tahun.length - 1;
        posisiRef.current = mulai;
        setI(mulai);
        setData(d);
      })
      .catch(() => !batal && setGagal(true));
    return () => {
      batal = true;
    };
  }, [awal.tahun]);

  useEffect(() => {
    if (!data || !wadahRef.current || kendaliRef.current) return;
    let batal = false;
    let dibuat: KendaliPeta | null = null;
    KendaliPeta.buat(wadahRef.current, data.statistik.tahun, {}, kameraRef.current)
      .then((k) => {
        if (batal) return k.hapus();
        dibuat = k;
        kendaliRef.current = k;
        (window as unknown as { __peta?: unknown }).__peta = k.peta;
        k.aturPosisi(posisiRef.current);
        k.peta.once("idle", () => !batal && setPetaSiap(true));
        // jaga-jaga kalau peta dasar lambat: aplikasi tetap dibuka
        window.setTimeout(() => !batal && setPetaSiap(true), 6000);
      })
      .catch(() => !batal && setGagal(true));
    return () => {
      batal = true;
      window.cancelAnimationFrame(rafRef.current);
      dibuat?.hapus();
      kendaliRef.current = null;
    };
  }, [data]);

  // ------------------------------------------------------------------ animasi
  const berhenti = useCallback(() => {
    mainRef.current = false;
    window.cancelAnimationFrame(rafRef.current);
    setMain(false);
    setMemuat(false);
    kendaliRef.current?.aturPramuat(false);
  }, []);

  const keTahun = useCallback(
    (idx: number) => {
      if (mainRef.current) berhenti();
      window.cancelAnimationFrame(rafRef.current);
      setI(idx);
      const k = kendaliRef.current;
      if (!k) {
        posisiRef.current = idx;
        return;
      }
      const dari = posisiRef.current;
      // lompat jauh tidak disilang: tahun-tahun di antaranya belum tentu sudah dimuat
      if (Math.abs(idx - dari) > 1.01 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        posisiRef.current = idx;
        k.aturPosisi(idx);
        return;
      }
      const mulai = performance.now();
      const langkah = (kini: number) => {
        const f = Math.min(1, (kini - mulai) / MS_SILANG);
        posisiRef.current = dari + (idx - dari) * f;
        k.aturPosisi(posisiRef.current);
        if (f < 1) rafRef.current = window.requestAnimationFrame(langkah);
      };
      rafRef.current = window.requestAnimationFrame(langkah);
    },
    [berhenti],
  );

  const putar = useCallback(async () => {
    const k = kendaliRef.current;
    if (!k || tahun.length < 2) return;
    mainRef.current = true;
    setMain(true);
    setMemuat(true);
    k.aturPramuat(true);
    await k.tungguUbin();
    if (!mainRef.current) return;
    setMemuat(false);
    const akhir = tahun.length - 1;
    if (posisiRef.current >= akhir - 0.01) posisiRef.current = 0;
    const diam = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lalu = performance.now();
    let jeda = 0;
    const langkah = (kini: number) => {
      if (!mainRef.current) return;
      const dt = Math.min(100, kini - lalu);
      lalu = kini;
      if (jeda > 0) {
        jeda -= dt;
        if (jeda <= 0) posisiRef.current = 0;
      } else {
        posisiRef.current = Math.min(akhir, posisiRef.current + dt / MS_PER_TAHUN);
        if (posisiRef.current >= akhir) jeda = MS_JEDA_AKHIR;
      }
      // tanpa animasi halus: lompat per tahun
      k.aturPosisi(diam ? Math.floor(posisiRef.current) : posisiRef.current);
      setI((lama) => {
        const baru = Math.round(posisiRef.current);
        return baru === lama ? lama : baru;
      });
      rafRef.current = window.requestAnimationFrame(langkah);
    };
    rafRef.current = window.requestAnimationFrame(langkah);
  }, [tahun.length]);

  const gantiMain = useCallback(() => {
    if (mainRef.current) {
      berhenti();
      // rapikan ke tahun terdekat
      const bulat = Math.round(posisiRef.current);
      posisiRef.current = bulat;
      kendaliRef.current?.aturPosisi(bulat);
      setI(bulat);
    } else void putar();
  }, [berhenti, putar]);

  // ------------------------------------------------------------------ sinkron ke peta
  useEffect(() => {
    if (!petaSiap) return;
    kendaliRef.current?.aturMode(mode);
  }, [mode, petaSiap]);

  useEffect(() => {
    if (!garisWaktuTampil && mainRef.current) berhenti();
  }, [garisWaktuTampil, berhenti]);

  useEffect(() => {
    if (!petaSiap) return;
    kendaliRef.current?.aturHarian(harian ? jepitTanggal(harian, maksHarian) : null);
  }, [harian, maksHarian, petaSiap]);

  const nilai = useMemo(() => (s && mode === "wilayah" ? nilaiSemua(s, tingkat, metrik, i) : []), [s, mode, tingkat, metrik, i]);
  const batas = useMemo(() => batasMetrik(metrik, nilai), [metrik, nilai]);

  useEffect(() => {
    const k = kendaliRef.current;
    if (!petaSiap || !k || mode !== "wilayah") return;
    const palet = METRIK[metrik].duaArah ? KELAS_DUA_ARAH : KELAS_URUT;
    const warna = new Map<string, string>();
    for (const n of nilai) warna.set(n.kode, n.nilai == null ? WARNA_KOSONG : palet[kelasDari(n.nilai, batas)]);
    k.aturTingkat(tingkat);
    k.aturWarnaWilayah(tingkat, warna);
  }, [nilai, batas, metrik, tingkat, mode, petaSiap]);

  useEffect(() => {
    if (!petaSiap) return;
    kendaliRef.current?.aturWilayahTerpilih(tingkat, wilayah && tingkatDariKode(wilayah, tingkat) === tingkat ? wilayah : null);
  }, [wilayah, tingkat, petaSiap]);

  const kejadian = useMemo(() => data?.kejadian.find((x) => x.id === kejadianId) ?? null, [data, kejadianId]);
  useEffect(() => {
    const k = kendaliRef.current;
    if (!petaSiap || !k) return;
    k.aturKejadian(mode === "blackout" ? kejadian : null, tampilan);
  }, [kejadian, tampilan, mode, petaSiap]);

  useEffect(() => {
    if (!petaSiap || !data) return;
    kendaliRef.current?.aturSorotan(data.sorotan, sorotanId);
  }, [data, sorotanId, petaSiap]);

  // penangan event peta selalu memakai state terbaru
  useEffect(() => {
    kendaliRef.current?.aturPenangan({
      saatKlikWilayah: (kode) => setWilayah(kode),
      saatArahWilayah: (kode, titik) => setArah(kode && titik ? { kode, x: titik.x, y: titik.y } : null),
      saatKlikSorotan: (id) => {
        const bersih = id.replace(/-titik$/, "");
        setSorotanId(bersih);
        const sr = data?.sorotan.find((x) => x.id === bersih);
        if (sr) kendaliRef.current?.terbangKeKotak(sr.kotak, 10);
      },
      saatGerak: (kamera) => {
        kameraRef.current = kamera;
        setVersiUrl((v) => v + 1);
      },
    });
  }, [data, petaSiap]);

  // tautan yang langsung menunjuk kejadian, hotspot, atau wilayah: terbang ke sana sekali saat peta siap
  const sudahTerbangAwal = useRef(false);
  useEffect(() => {
    const k = kendaliRef.current;
    if (!petaSiap || !data || !k || sudahTerbangAwal.current) return;
    sudahTerbangAwal.current = true;
    if (awal.kamera) return;
    if (awal.mode === "blackout" && awal.kejadian) {
      const kj = data.kejadian.find((x) => x.id === awal.kejadian);
      if (kj) k.terbangKeKotak(kj.kotak, 10);
    } else if (awal.mode === "hotspot" && awal.sorotan) {
      const sr = data.sorotan.find((x) => x.id === awal.sorotan);
      if (sr) k.terbangKeKotak(sr.kotak, 10);
    } else if (awal.mode === "wilayah" && awal.wilayah) {
      void k.terbangKeWilayah(awal.wilayah.length === 2 ? "provinsi" : "kabupaten", awal.wilayah);
    }
  }, [petaSiap, data, awal]);

  // ------------------------------------------------------------------ URL
  useEffect(() => {
    if (!s) return;
    const hash = tulisHash({ mode, tahun: i === s.tahun.length - 1 ? null : s.tahun[i], harian: mode === "timelapse" ? harian : null, tingkat, metrik, wilayah, kejadian: kejadianId, tampilan, sorotan: sorotanId, kamera: kameraRef.current });
    const id = window.setTimeout(() => window.history.replaceState(null, "", hash || window.location.pathname), 250);
    return () => window.clearTimeout(id);
  }, [s, mode, i, harian, tingkat, metrik, wilayah, kejadianId, tampilan, sorotanId, versiUrl]);

  // ------------------------------------------------------------------ aksi
  const pilihMode = useCallback((m: Mode) => {
    setMode(m);
    setLembar(true);
    setArah(null);
  }, []);

  const pilihWilayah = useCallback((kode: string | null, terbang?: boolean) => {
    setWilayah(kode);
    if (kode && terbang) void kendaliRef.current?.terbangKeWilayah(kode.length === 2 ? "provinsi" : "kabupaten", kode);
  }, []);

  const pilihTingkat = useCallback((t: Tingkat) => {
    setTingkat(t);
    setWilayah(null);
    setArah(null);
    setMetrik((m) => (t === "kabupaten" && METRIK[m].hanyaProvinsi ? "tumbuh" : m));
  }, []);

  const keKabupaten = useCallback((kode: string) => {
    setMode("wilayah");
    setTingkat("kabupaten");
    setMetrik((m) => (METRIK[m].hanyaProvinsi ? "tumbuh" : m));
    setWilayah(kode);
    void kendaliRef.current?.terbangKeWilayah("kabupaten", kode);
  }, []);

  const pilihKejadian = useCallback(
    (id: string | null) => {
      setKejadianId(id);
      const k = data?.kejadian.find((x) => x.id === id);
      if (!k || !s) return;
      setTampilan("sesudah");
      const idx = s.tahun.indexOf(Number(k.tanggal.slice(0, 4)));
      if (idx >= 0) {
        posisiRef.current = idx;
        kendaliRef.current?.aturPosisi(idx);
        setI(idx);
      }
      kendaliRef.current?.terbangKeKotak(k.kotak, 10);
    },
    [data, s],
  );

  const pilihSorotan = useCallback(
    (id: string | null) => {
      setSorotanId(id);
      const sr = data?.sorotan.find((x) => x.id === id);
      if (sr) kendaliRef.current?.terbangKeKotak(sr.kotak, 10);
    },
    [data],
  );

  const lompat = useCallback((t: Tempat) => kendaliRef.current?.terbangKe(t.pusat, window.innerWidth < 640 ? t.zoom - 0.9 : t.zoom), []);

  // pintasan papan ketik: spasi = putar/jeda, panah kiri/kanan = ganti tahun (kalau fokus tidak di kontrol lain)
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (!garisWaktuTampil || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el && el !== document.body && !(el instanceof HTMLCanvasElement)) return;
      if (e.key === " ") {
        e.preventDefault();
        gantiMain();
      } else if (el === document.body && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        keTahun(Math.min(tahun.length - 1, Math.max(0, Math.round(posisiRef.current) + (e.key === "ArrowRight" ? 1 : -1))));
      }
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [garisWaktuTampil, gantiMain, keTahun, tahun.length]);

  // ------------------------------------------------------------------ tampilan
  const siap = Boolean(s && petaSiap);
  const infoArah = arah && mode === "wilayah" ? nilai.find((n) => n.kode === arah.kode) : null;
  const Ikon = INFO_MODE[mode].ikon;

  return (
    <main className="relative h-full w-full overflow-hidden" data-siap={siap ? "1" : "0"} data-mode={mode}>
      {/* MapLibre memberi wadahnya position: relative, jadi ukuran layar penuh dipegang pembungkus ini */}
      <div className="absolute inset-0">
        <div ref={wadahRef} className="h-full w-full" role="application" aria-label="Peta cahaya malam Indonesia. Geser untuk menjelajah, cubit atau gulir untuk memperbesar." />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(3,5,11,0.55) 100%)" }} />

      {garisWaktuTampil && s ? (
        <div aria-hidden className="angka pointer-events-none absolute right-5 top-[70px] hidden select-none text-[84px] font-semibold leading-none text-white/[0.13] lg:block">
          {tahun[i]}
        </div>
      ) : null}

      <header role="banner" className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-2 sm:p-3 lg:flex-row lg:items-center">
        <div className="kaca pointer-events-auto flex items-center gap-2.5 self-start rounded-2xl py-1.5 pl-2 pr-3.5">
          <button type="button" className="tombol-ikon !h-9 !w-9 !border-aksen/40" aria-label="Kembali ke tampilan seluruh Indonesia" onClick={() => kendaliRef.current?.pulang()}>
            <Home size={16} aria-hidden className="text-emas" />
          </button>
          <div className="leading-none">
            <p className="m-0 text-[14.5px] font-semibold tracking-[0.02em]">
              NIGHTLIGHTS <span className="font-normal text-emas">from space</span>
            </p>
            <p className="m-0 mt-1 text-[10.5px] tracking-[0.08em] text-samar">INDONESIA SETELAH GELAP · NASA BLACK MARBLE</p>
          </div>
        </div>
        <nav aria-label="Mode tampilan" className="kaca gulung-x pointer-events-auto flex max-w-full gap-1 self-start rounded-2xl p-1">
          {SEMUA_MODE.map((m) => {
            const I = INFO_MODE[m].ikon;
            return (
              <button key={m} type="button" className="chip !border-transparent" aria-pressed={mode === m} onClick={() => pilihMode(m)}>
                <I size={14} aria-hidden />
                {INFO_MODE[m].label}
              </button>
            );
          })}
        </nav>
      </header>

      {infoArah && arah ? (
        <div role="status" className="kaca-padat pointer-events-none absolute z-30 hidden max-w-[240px] rounded-lg px-2.5 py-1.5 text-[12px] lg:block" style={{ left: arah.x + 14, top: arah.y + 14 }}>
          <span className="block font-medium">{infoArah.nama}</span>
          <span className="text-redup">
            {METRIK[metrik].pendek}: <span className="angka text-emas">{formatMetrik(metrik, infoArah.nilai)}</span>
          </span>
        </div>
      ) : null}

      {garisWaktuTampil && s ? (
        <div className={`absolute inset-x-2 z-20 transition-[bottom] duration-200 lg:inset-x-auto lg:bottom-8 lg:left-[408px] lg:right-3 ${lembar ? "bottom-[calc(42dvh+8px)]" : "bottom-[62px]"}`}>
          <div className="mx-auto max-w-[860px]">
            <GarisWaktu tahun={tahun} indeks={i} main={main} memuat={memuat} cahaya={s.nasional.cahaya} saatGeser={keTahun} saatMain={gantiMain} />
          </div>
        </div>
      ) : null}

      <aside
        aria-label={`Panel ${INFO_MODE[mode].label}`}
        className={`kaca-padat absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl transition-[height] duration-200 lg:inset-x-auto lg:bottom-3 lg:left-3 lg:top-[72px] lg:!h-auto lg:w-[384px] lg:rounded-2xl ${lembar ? "h-[42dvh]" : "h-[54px]"}`}
      >
        <button type="button" className="flex h-[54px] w-full flex-none items-center gap-2 px-4 text-left lg:hidden" aria-expanded={lembar} aria-controls="isi-panel" onClick={() => setLembar((v) => !v)}>
          <Ikon size={16} aria-hidden className="text-emas" />
          <span className="flex-1 text-[14px] font-medium">{INFO_MODE[mode].label}</span>
          <span className="text-[11.5px] text-samar">{lembar ? "kecilkan" : "buka panel"}</span>
          {lembar ? <ChevronDown size={18} aria-hidden /> : <ChevronUp size={18} aria-hidden />}
        </button>
        <div id="isi-panel" className={`gulung min-h-0 flex-1 px-4 pb-5 lg:block lg:p-4 ${lembar ? "" : "hidden"}`}>
          {!s || !data ? (
            <p className="m-0 py-6 text-[13px] text-redup">{gagal ? "Data gagal dimuat. Coba muat ulang halaman." : "Memuat data…"}</p>
          ) : mode === "timelapse" ? (
            <PanelTimelapse s={s} i={i} harian={harian} maksHarian={maksHarian} saatHarian={setHarian} saatLompat={lompat} />
          ) : mode === "perubahan" ? (
            <PanelPerubahan s={s} saatPilihKabupaten={keKabupaten} />
          ) : mode === "wilayah" ? (
            <PanelWilayah s={s} i={i} tingkat={tingkat} metrik={metrik} wilayah={wilayah && tingkatDariKode(wilayah, tingkat) === tingkat ? wilayah : null} saatTingkat={pilihTingkat} saatMetrik={setMetrik} saatWilayah={pilihWilayah} />
          ) : mode === "blackout" ? (
            <PanelBlackout daftar={data.kejadian} terpilih={kejadianId} tampilan={tampilan} saatPilih={pilihKejadian} saatTampilan={setTampilan} />
          ) : mode === "hotspot" ? (
            <PanelHotspot daftar={data.sorotan} tahun={tahun} i={i} terpilih={sorotanId} saatPilih={pilihSorotan} />
          ) : (
            <PanelTentang s={s} />
          )}
        </div>
      </aside>

      {siap ? null : (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-bg px-6 text-center" role="status" aria-live="polite">
          <p className="m-0 text-[22px] font-semibold tracking-[0.04em]">
            NIGHTLIGHTS <span className="font-normal text-emas">from space</span>
          </p>
          <p className="m-0 mt-3 text-[13px] text-redup">{gagal ? "Gagal memuat. Periksa koneksi lalu muat ulang halaman." : "Menunggu malam turun di atas Nusantara…"}</p>
        </div>
      )}
    </main>
  );
}
