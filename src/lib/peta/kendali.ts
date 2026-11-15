/**
 * Kendali peta: satu kelas yang memegang instance MapLibre dan semua lapisan data.
 * Komponen React cukup memanggil metode `atur...`; tidak ada state peta yang hidup di React.
 */

import { Map as MapLibre, addProtocol, setWorkerUrl, type GeoJSONSource, type ImageSource, type MapMouseEvent, type RasterTileSource } from "maplibre-gl";
import { muatUbinGibs, PROTOKOL, templatProtokol } from "../gibs";
import type { Kejadian, Mode, Sorotan, TampilanKejadian, Tingkat } from "../jenis";
import { WARNA_KOSONG } from "../palet";
import { workerPetaSekali } from "../workerPeta";
import { bangunGaya, BATAS_UBIN, ID_LABEL_PERTAMA, ID_LAPISAN_LABEL, WARNA_DARAT } from "./gaya";

export type Kamera = [number, number, number];

export interface PenanganPeta {
  /** klik pada wilayah (mode wilayah); null kalau klik di luar wilayah mana pun */
  saatKlikWilayah?(kode: string | null): void;
  saatArahWilayah?(kode: string | null, titik: { x: number; y: number } | null): void;
  saatKlikSorotan?(id: string): void;
  saatGerak?(kamera: Kamera): void;
}

const idCahaya = (tahun: number) => `cahaya-${tahun}`;
const SUMBER_WILAYAH: Record<Tingkat, string> = { provinsi: "provinsi", kabupaten: "kabupaten" };
/** berapa tahun di kiri-kanan tahun aktif yang ubinnya ikut dimuat supaya geser slider terasa instan */
const JENDELA_PRAMUAT = 1;

let protokolTerpasang = false;

/** kotak yang memuat seluruh Indonesia, dipakai tampilan awal dan tombol pulang */
export const KOTAK_INDONESIA: [number, number, number, number] = [95.2, -10.8, 141.0, 5.9];

/** Ruang layar yang tertutup panel: kiri di layar lebar, bawah di ponsel. */
export function bantalanLayar(lebar: number, tinggi: number) {
  if (lebar >= 1024) return { top: 80, bottom: 110, left: 410, right: 30 };
  // lembar bawah 42% tinggi layar + garis waktu di atasnya
  return { top: 100, bottom: Math.round(tinggi * 0.42) + 76, left: 10, right: 10 };
}

/** Opasitas dua lapisan saat menyilang: tidak pernah meredup di tengah seperti silang linear biasa. */
export function opasitasSilang(pecahan: number): [number, number] {
  const f = Math.min(1, Math.max(0, pecahan));
  return [1 - f * f, 1 - (1 - f) * (1 - f)];
}

/** Kotak [barat, selatan, timur, utara] -> empat sudut untuk sumber gambar MapLibre. */
export function sudutKotak([b, s, t, u]: [number, number, number, number]): [[number, number], [number, number], [number, number], [number, number]] {
  return [
    [b, u],
    [t, u],
    [t, s],
    [b, s],
  ];
}

export function poligonKotak([b, s, t, u]: [number, number, number, number]): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [b, s],
        [t, s],
        [t, u],
        [b, u],
        [b, s],
      ],
    ],
  };
}

export class KendaliPeta {
  readonly peta: MapLibre;
  private tahun: number[];
  private posisi = 0;
  private mode: Mode = "timelapse";
  private harian: string | null = null;
  private pramuatSemua = false;
  private tingkat: Tingkat = "provinsi";
  private warnaTerpasang: Record<Tingkat, Set<string>> = { provinsi: new Set(), kabupaten: new Set() };
  private terpilih: { tingkat: Tingkat; kode: string } | null = null;
  private diarah: { tingkat: Tingkat; kode: string } | null = null;
  private kejadianAktif: string | null = null;
  private penangan: PenanganPeta;
  private siap = false;
  private antre: (() => void)[] = [];

  private constructor(peta: MapLibre, tahun: number[], penangan: PenanganPeta) {
    this.peta = peta;
    this.tahun = tahun;
    this.penangan = penangan;
  }

  static async buat(wadah: HTMLElement, tahun: number[], penangan: PenanganPeta, kamera: Kamera | null): Promise<KendaliPeta> {
    setWorkerUrl(await workerPetaSekali());
    if (!protokolTerpasang) {
      addProtocol(PROTOKOL, async (permintaan, pembatal) => ({ data: await muatUbinGibs(permintaan.url, pembatal.signal) }));
      protokolTerpasang = true;
    }
    const peta = new MapLibre({
      container: wadah,
      style: bangunGaya(),
      // tanpa kamera dari URL: seluruh Indonesia dipaskan ke bagian layar yang tidak tertutup panel
      ...(kamera ? { center: [kamera[0], kamera[1]] as [number, number], zoom: kamera[2] } : { bounds: KOTAK_INDONESIA }),
      minZoom: 2.2,
      maxZoom: 11,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
      fadeDuration: 0,
      canvasContextAttributes: { antialias: false, preserveDrawingBuffer: true },
    });
    peta.touchZoomRotate.disableRotation();
    peta.keyboard.disableRotation();
    const k = new KendaliPeta(peta, tahun, penangan);
    // geser tampilan awal ke bagian layar yang tidak tertutup panel
    if (!kamera) peta.fitBounds([KOTAK_INDONESIA.slice(0, 2), KOTAK_INDONESIA.slice(2)] as [[number, number], [number, number]], { padding: bantalanLayar(wadah.clientWidth, wadah.clientHeight), duration: 0 });
    peta.on("load", () => k.pasang());
    return k;
  }

  /** Jalankan sekarang kalau lapisan sudah terpasang, kalau belum tunggu event load. */
  private nanti(fn: () => void) {
    if (this.siap) fn();
    else this.antre.push(fn);
  }

  private pasang() {
    const m = this.peta;
    const asal = window.location.origin;

    for (const tingkat of ["provinsi", "kabupaten"] as Tingkat[]) {
      m.addSource(SUMBER_WILAYAH[tingkat], { type: "geojson", data: `${asal}/data/${tingkat}.geojson`, promoteId: "kode" });
      m.addLayer(
        {
          id: `${tingkat}-isi`,
          type: "fill",
          source: SUMBER_WILAYAH[tingkat],
          layout: { visibility: "none" },
          paint: { "fill-color": ["to-color", ["feature-state", "warna"], WARNA_KOSONG], "fill-opacity": 0.82 },
        },
        ID_LABEL_PERTAMA,
      );
    }

    for (const t of this.tahun) {
      m.addSource(idCahaya(t), {
        type: "raster",
        tiles: [`${asal}/ubin/${t}/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 8,
        bounds: BATAS_UBIN,
        attribution: 'Cahaya malam: <a href="https://blackmarble.gsfc.nasa.gov/" target="_blank" rel="noopener">NASA Black Marble</a> via GIBS',
      });
      m.addLayer(
        { id: idCahaya(t), type: "raster", source: idCahaya(t), layout: { visibility: "none" }, paint: { "raster-opacity": 0, "raster-fade-duration": 0, "raster-opacity-transition": { duration: 0, delay: 0 } } },
        ID_LABEL_PERTAMA,
      );
    }

    m.addSource("selisih", { type: "raster", tiles: [`${asal}/ubin/selisih/{z}/{x}/{y}.png`], tileSize: 256, minzoom: 2, maxzoom: 8, bounds: BATAS_UBIN });
    m.addLayer({ id: "selisih", type: "raster", source: "selisih", layout: { visibility: "none" }, paint: { "raster-fade-duration": 200 } }, ID_LABEL_PERTAMA);

    m.addSource("kejadian-kotak", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    m.addLayer({ id: "kejadian-latar", type: "fill", source: "kejadian-kotak", layout: { visibility: "none" }, paint: { "fill-color": WARNA_DARAT, "fill-opacity": 0.96 } }, ID_LABEL_PERTAMA);

    for (const tingkat of ["provinsi", "kabupaten"] as Tingkat[]) {
      m.addLayer(
        {
          id: `${tingkat}-garis`,
          type: "line",
          source: SUMBER_WILAYAH[tingkat],
          layout: { visibility: "none" },
          paint: {
            "line-color": ["case", ["boolean", ["feature-state", "pilih"], false], "#ffffff", ["boolean", ["feature-state", "arah"], false], "#ffd98a", "rgba(255, 255, 255, 0.22)"],
            "line-width": ["case", ["boolean", ["feature-state", "pilih"], false], 2.2, ["boolean", ["feature-state", "arah"], false], 1.6, 0.5],
          },
        },
        ID_LABEL_PERTAMA,
      );
    }

    m.addLayer({ id: "kejadian-garis", type: "line", source: "kejadian-kotak", layout: { visibility: "none" }, paint: { "line-color": "#ffd98a", "line-width": 1.2, "line-dasharray": [2, 2] } }, ID_LABEL_PERTAMA);

    m.addSource("sorotan", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" });
    m.addLayer(
      {
        id: "sorotan-garis",
        type: "line",
        source: "sorotan",
        layout: { visibility: "none" },
        paint: { "line-color": ["case", ["boolean", ["feature-state", "pilih"], false], "#ffffff", "#ffd98a"], "line-width": ["case", ["boolean", ["feature-state", "pilih"], false], 2, 1.1] },
      },
      ID_LABEL_PERTAMA,
    );
    m.addLayer(
      {
        id: "sorotan-titik",
        type: "circle",
        source: "sorotan",
        maxzoom: 7,
        layout: { visibility: "none" },
        paint: { "circle-radius": 6, "circle-color": "rgba(255, 217, 138, 0.18)", "circle-stroke-color": "#ffd98a", "circle-stroke-width": 1.4 },
      },
      ID_LABEL_PERTAMA,
    );

    m.on("moveend", () => {
      const c = m.getCenter();
      this.penangan.saatGerak?.([c.lng, c.lat, m.getZoom()]);
    });
    m.on("click", (e) => this.klik(e));
    m.on("mousemove", (e) => this.arah(e));
    m.on("mouseout", () => this.setArah(null, null));

    // di layar sempit atribusi dibuka lewat tombol (i) saja supaya tidak menutupi peta
    if (m.getContainer().clientWidth < 1024) m.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");

    this.siap = true;
    this.terapkan();
    for (const fn of this.antre.splice(0)) fn();
  }

  private klik(e: MapMouseEvent) {
    if (this.mode === "wilayah") {
      const f = this.peta.queryRenderedFeatures(e.point, { layers: [`${this.tingkat}-isi`] })[0];
      this.penangan.saatKlikWilayah?.(f ? String(f.id) : null);
    } else if (this.mode === "hotspot") {
      const r = 10;
      const f = this.peta.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ["sorotan-garis", "sorotan-titik"] })[0];
      if (f) this.penangan.saatKlikSorotan?.(String(f.id));
    }
  }

  private arah(e: MapMouseEvent) {
    if (this.mode !== "wilayah") return;
    const f = this.peta.queryRenderedFeatures(e.point, { layers: [`${this.tingkat}-isi`] })[0];
    this.setArah(f ? String(f.id) : null, f ? { x: e.point.x, y: e.point.y } : null);
  }

  private setArah(kode: string | null, titik: { x: number; y: number } | null) {
    const lama = this.diarah;
    if (lama && (lama.kode !== kode || lama.tingkat !== this.tingkat)) {
      this.peta.setFeatureState({ source: SUMBER_WILAYAH[lama.tingkat], id: lama.kode }, { arah: false });
      this.diarah = null;
    }
    if (kode && !this.diarah) {
      this.peta.setFeatureState({ source: SUMBER_WILAYAH[this.tingkat], id: kode }, { arah: true });
      this.diarah = { tingkat: this.tingkat, kode };
    }
    this.peta.getCanvas().style.cursor = kode ? "pointer" : "";
    this.penangan.saatArahWilayah?.(kode, titik);
  }

  /** Terapkan semua visibilitas dan opasitas dari keadaan sekarang. */
  private terapkan() {
    if (!this.siap) return;
    const m = this.peta;
    const modeTahunan = !(this.mode === "timelapse" && this.harian);
    // seberapa terang lapisan tahunan di tiap mode
    const kuat = !modeTahunan ? 0 : this.mode === "perubahan" ? 0.28 : this.mode === "blackout" ? 0.45 : 1;
    const bawah = Math.floor(this.posisi);
    const [opBawah, opAtas] = opasitasSilang(this.posisi - bawah);
    this.tahun.forEach((t, i) => {
      const op = i === bawah ? opBawah : i === bawah + 1 ? opAtas : 0;
      const dekat = Math.abs(i - Math.round(this.posisi)) <= JENDELA_PRAMUAT;
      const tampil = kuat > 0 && (op > 0 || this.pramuatSemua || dekat);
      m.setLayoutProperty(idCahaya(t), "visibility", tampil ? "visible" : "none");
      m.setPaintProperty(idCahaya(t), "raster-opacity", op * kuat);
    });

    this.pasangHarian();
    m.setLayoutProperty("selisih", "visibility", this.mode === "perubahan" ? "visible" : "none");
    for (const tingkat of ["provinsi", "kabupaten"] as Tingkat[]) {
      const tampil = this.mode === "wilayah" && tingkat === this.tingkat ? "visible" : "none";
      m.setLayoutProperty(`${tingkat}-isi`, "visibility", tampil);
      m.setLayoutProperty(`${tingkat}-garis`, "visibility", tampil);
    }
    const kejadian = this.mode === "blackout" && this.kejadianAktif ? "visible" : "none";
    m.setLayoutProperty("kejadian-latar", "visibility", kejadian);
    m.setLayoutProperty("kejadian-garis", "visibility", kejadian);
    if (m.getLayer("kejadian-citra")) m.setLayoutProperty("kejadian-citra", "visibility", kejadian);
    const sorotan = this.mode === "hotspot" ? "visible" : "none";
    m.setLayoutProperty("sorotan-garis", "visibility", sorotan);
    m.setLayoutProperty("sorotan-titik", "visibility", sorotan);
  }

  private pasangHarian() {
    const m = this.peta;
    const aktif = this.mode === "timelapse" && this.harian;
    const sumber = m.getSource("harian") as RasterTileSource | undefined;
    if (!aktif) {
      if (m.getLayer("harian")) m.setLayoutProperty("harian", "visibility", "none");
      return;
    }
    const ubin = [templatProtokol(this.harian!)];
    if (!sumber) {
      m.addSource("harian", { type: "raster", tiles: ubin, tileSize: 256, minzoom: 2, maxzoom: 8, bounds: BATAS_UBIN, attribution: "Harian: NASA GIBS (VNP46A2)" });
      m.addLayer({ id: "harian", type: "raster", source: "harian", paint: { "raster-fade-duration": 150 } }, "selisih");
    } else {
      if (sumber.tiles?.[0] !== ubin[0]) sumber.setTiles(ubin);
      m.setLayoutProperty("harian", "visibility", "visible");
    }
  }

  // ---------------------------------------------------------------- API publik

  aturPenangan(p: PenanganPeta) {
    this.penangan = p;
  }

  aturMode(mode: Mode) {
    this.mode = mode;
    if (mode !== "wilayah" && this.siap) this.setArah(null, null);
    this.terapkan();
  }

  /** Posisi di garis waktu: indeks tahun, boleh pecahan saat animasi. */
  aturPosisi(posisi: number) {
    this.posisi = Math.min(this.tahun.length - 1, Math.max(0, posisi));
    this.terapkan();
  }

  /** Muat ubin semua tahun (dipakai sebelum dan selama animasi diputar). */
  aturPramuat(semua: boolean) {
    if (this.pramuatSemua === semua) return;
    this.pramuatSemua = semua;
    this.terapkan();
  }

  /** Selesai begitu ubin semua lapisan yang tampil sudah dimuat (atau waktu tunggu habis). */
  tungguUbin(batasMs = 6000): Promise<void> {
    return new Promise((selesai) => {
      const m = this.peta;
      const habis = window.setTimeout(selesai, batasMs);
      const cek = () => {
        if (m.areTilesLoaded()) {
          window.clearTimeout(habis);
          selesai();
        } else m.once("idle", cek);
      };
      // beri satu frame supaya permintaan ubin baru sempat terdaftar
      window.requestAnimationFrame(() => (m.loaded() && m.areTilesLoaded() ? cek() : m.once("idle", cek)));
    });
  }

  aturHarian(tanggal: string | null) {
    this.harian = tanggal;
    this.terapkan();
  }

  aturTingkat(tingkat: Tingkat) {
    this.tingkat = tingkat;
    this.terapkan();
  }

  /** Warnai wilayah: kode -> warna CSS. Kode yang tidak disebut kembali ke warna kosong. */
  aturWarnaWilayah(tingkat: Tingkat, warna: Map<string, string>) {
    this.nanti(() => {
      const sumber = SUMBER_WILAYAH[tingkat];
      const lama = this.warnaTerpasang[tingkat];
      for (const kode of lama) if (!warna.has(kode)) this.peta.setFeatureState({ source: sumber, id: kode }, { warna: WARNA_KOSONG });
      for (const [kode, w] of warna) this.peta.setFeatureState({ source: sumber, id: kode }, { warna: w });
      this.warnaTerpasang[tingkat] = new Set(warna.keys());
    });
  }

  aturWilayahTerpilih(tingkat: Tingkat, kode: string | null) {
    this.nanti(() => {
      if (this.terpilih) this.peta.setFeatureState({ source: SUMBER_WILAYAH[this.terpilih.tingkat], id: this.terpilih.kode }, { pilih: false });
      this.terpilih = kode ? { tingkat, kode } : null;
      if (kode) this.peta.setFeatureState({ source: SUMBER_WILAYAH[tingkat], id: kode }, { pilih: true });
    });
  }

  /** Terbang ke wilayah memakai kotak pembatas geometrinya di sumber GeoJSON. */
  async terbangKeWilayah(tingkat: Tingkat, kode: string) {
    const sumber = this.peta.getSource(SUMBER_WILAYAH[tingkat]) as GeoJSONSource | undefined;
    if (!sumber) return;
    const data = (await sumber.getData()) as GeoJSON.FeatureCollection;
    const f = data.features.find((x) => x.properties?.kode === kode);
    if (!f) return;
    let b = 180;
    let s = 90;
    let t = -180;
    let u = -90;
    const telusur = (c: unknown) => {
      if (Array.isArray(c) && typeof c[0] === "number") {
        b = Math.min(b, c[0]);
        t = Math.max(t, c[0]);
        s = Math.min(s, c[1] as number);
        u = Math.max(u, c[1] as number);
      } else if (Array.isArray(c)) c.forEach(telusur);
    };
    telusur((f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates);
    this.terbangKeKotak([b, s, t, u], tingkat === "provinsi" ? 8 : 10);
  }

  aturKejadian(k: Kejadian | null, tampilan: TampilanKejadian) {
    this.nanti(() => {
      const m = this.peta;
      this.kejadianAktif = k?.id ?? null;
      if (k) {
        const url = `${window.location.origin}/kejadian/${k.id}_${tampilan}.png`;
        const sudut = sudutKotak(k.kotak);
        (m.getSource("kejadian-kotak") as GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: poligonKotak(k.kotak) });
        const citra = m.getSource("kejadian-citra") as ImageSource | undefined;
        if (citra) citra.updateImage({ url, coordinates: sudut });
        else {
          m.addSource("kejadian-citra", { type: "image", url, coordinates: sudut });
          m.addLayer({ id: "kejadian-citra", type: "raster", source: "kejadian-citra", paint: { "raster-fade-duration": 0 } }, "provinsi-garis");
        }
      }
      this.terapkan();
    });
  }

  aturSorotan(daftar: Sorotan[], terpilih: string | null) {
    this.nanti(() => {
      const m = this.peta;
      const fitur: GeoJSON.Feature[] = daftar.flatMap((s) => [
        { type: "Feature", properties: { id: s.id, judul: s.judul }, geometry: poligonKotak(s.kotak) },
        { type: "Feature", properties: { id: `${s.id}-titik`, judul: s.judul, titik: 1 }, geometry: { type: "Point", coordinates: s.pusat } },
      ]);
      (m.getSource("sorotan") as GeoJSONSource).setData({ type: "FeatureCollection", features: fitur });
      m.setFilter("sorotan-titik", ["==", ["get", "titik"], 1]);
      m.setFilter("sorotan-garis", ["!", ["has", "titik"]]);
      m.removeFeatureState({ source: "sorotan" });
      if (terpilih) m.setFeatureState({ source: "sorotan", id: terpilih }, { pilih: true });
    });
  }

  aturLabel(tampil: boolean) {
    this.nanti(() => {
      for (const id of ID_LAPISAN_LABEL) this.peta.setLayoutProperty(id, "visibility", tampil ? "visible" : "none");
    });
  }

  terbangKeKotak(kotak: [number, number, number, number], zoomMaks = 9.5, bantalan?: { top: number; bottom: number; left: number; right: number }) {
    this.peta.fitBounds(
      [
        [kotak[0], kotak[1]],
        [kotak[2], kotak[3]],
      ],
      { padding: bantalan ?? this.bantalan(), maxZoom: zoomMaks, duration: 1400, essential: false },
    );
  }

  terbangKe(pusat: [number, number], zoom: number) {
    this.peta.flyTo({ center: pusat, zoom, padding: this.bantalan(), duration: 1400, essential: false });
  }

  pulang() {
    this.terbangKeKotak(KOTAK_INDONESIA, 6);
  }

  private bantalan() {
    return bantalanLayar(this.peta.getContainer().clientWidth, this.peta.getContainer().clientHeight);
  }

  hapus() {
    this.peta.remove();
  }
}
