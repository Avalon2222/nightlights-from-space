import { describe, expect, it, vi } from "vitest";

// modul peta mengimpor maplibre-gl yang butuh browser; di sini cukup fungsi murninya
vi.mock("maplibre-gl", () => ({ Map: class {}, addProtocol: () => undefined, setWorkerUrl: () => undefined }));

import nilaiAbu from "@/lib/gibsNilai.json";
import { jepitTanggal, TANGGAL_AWAL_GIBS, tanggalTerakhirGibs, templatProtokol, uraiProtokol, urlUbinGibs, warnaiUlang } from "@/lib/gibs";
import { kebijakanKonten, SUMBER_LUAR } from "@/lib/keamanan";
import { tabelAbuKeWarna, warnaCahaya } from "@/lib/palet";
import { BATAS_UBIN, bangunGaya, ID_LABEL_PERTAMA } from "@/lib/peta/gaya";
import { bantalanLayar, KOTAK_INDONESIA, opasitasSilang, poligonKotak, sudutKotak } from "@/lib/peta/kendali";

describe("protokol gibs", () => {
  it("templat dan pengurainya saling cocok", () => {
    const url = templatProtokol("2021-04-08").replace("{z}", "8").replace("{x}", "215").replace("{y}", "134");
    expect(uraiProtokol(url)).toEqual({ tanggal: "2021-04-08", z: 8, x: 215, y: 134 });
  });

  it("menolak url yang bentuknya lain", () => {
    expect(uraiProtokol("gibs://2021-4-8/8/1/1")).toBeNull();
    expect(uraiProtokol("https://contoh.id/8/1/1")).toBeNull();
    expect(uraiProtokol("gibs://2021-04-08/8/1/1/../../x")).toBeNull();
  });

  it("url GIBS memakai urutan baris lalu kolom (z/y/x)", () => {
    expect(urlUbinGibs("2021-04-08", 8, 215, 134)).toMatch(/\/default\/2021-04-08\/GoogleMapsCompatible_Level8\/8\/134\/215\.png$/);
  });

  it("host GIBS diizinkan CSP untuk fetch dan gambar", () => {
    const host = new URL(urlUbinGibs("2021-04-08", 8, 1, 1)).origin;
    expect(SUMBER_LUAR.sambung).toContain(host);
    expect(kebijakanKonten()).toContain(host);
  });

  it("tanggal dijepit ke rentang yang tersedia", () => {
    expect(jepitTanggal("2010-01-01", "2026-11-01")).toBe(TANGGAL_AWAL_GIBS);
    expect(jepitTanggal("2030-01-01", "2026-11-01")).toBe("2026-11-01");
    expect(jepitTanggal("2020-05-05", "2026-11-01")).toBe("2020-05-05");
  });

  it("tanggal terakhir = dua minggu sebelum hari ini (UTC)", () => {
    expect(tanggalTerakhirGibs(new Date("2026-11-15T03:00:00Z"))).toBe("2026-11-01");
  });
});

describe("tabel tingkat abu GIBS", () => {
  it("punya 256 entri, 180 di antaranya warna palet", () => {
    expect(nilaiAbu).toHaveLength(256);
    expect(nilaiAbu.filter((v) => v > 0)).toHaveLength(180);
  });

  it("radiance naik bersama tingkat abu dan mentok di 38,2", () => {
    const terisi = nilaiAbu.map((v, g) => [g, v]).filter(([, v]) => v > 0);
    for (let i = 1; i < terisi.length; i++) expect(terisi[i][1]).toBeGreaterThanOrEqual(terisi[i - 1][1]);
    expect(nilaiAbu[255]).toBe(38.2);
    expect(nilaiAbu[7]).toBe(0.05);
  });
});

describe("warnaiUlang", () => {
  const tabel = tabelAbuKeWarna(nilaiAbu);

  it("abu terang jadi warna palet, tanpa data jadi transparan", () => {
    const piksel = new Uint8ClampedArray([
      255, 255, 255, 255, // paling terang
      0, 0, 160, 255, // biru penanda tanpa data
      200, 200, 200, 0, // alfa nol
      7, 7, 7, 255, // gelap (0,05): di bawah ambang tampil
    ]);
    warnaiUlang(piksel, tabel);
    expect(Array.from(piksel.slice(0, 4))).toEqual(warnaCahaya(38.2));
    expect(piksel[7]).toBe(0);
    expect(piksel[11]).toBe(0);
    expect(piksel[15]).toBe(0);
  });
});

describe("gaya peta", () => {
  const gaya = bangunGaya();

  it("lapisan label ada dan berada paling atas", () => {
    const id = gaya.layers.map((l) => l.id);
    expect(id).toContain(ID_LABEL_PERTAMA);
    expect(gaya.layers.slice(id.indexOf(ID_LABEL_PERTAMA)).every((l) => l.type === "symbol")).toBe(true);
  });

  it("semua host di gaya diizinkan CSP", () => {
    const csp = kebijakanKonten();
    // hanya alamat yang diambil skrip (ubin dan font); tautan di teks atribusi dibuka pengguna sendiri
    const alamat = [gaya.glyphs ?? "", ...Object.values(gaya.sources).flatMap((sumber) => ("url" in sumber && sumber.url ? [sumber.url] : []))];
    expect(alamat.length).toBeGreaterThanOrEqual(2);
    for (const a of alamat) expect(csp).toContain(new URL(a).origin);
  });

  it("batas ubin ada di dalam jangkauan ubin zoom 8 yang dibuat", () => {
    const [b, s, t, u] = BATAS_UBIN;
    expect(b).toBeGreaterThan((195 / 256) * 360 - 180);
    expect(t).toBeLessThan((229 / 256) * 360 - 180);
    expect(u).toBeLessThan(7.02);
    expect(s).toBeGreaterThan(-11.18);
    for (const v of [KOTAK_INDONESIA[0], KOTAK_INDONESIA[2]]) {
      expect(v).toBeGreaterThanOrEqual(b);
      expect(v).toBeLessThanOrEqual(t);
    }
  });
});

describe("bantuan kendali peta", () => {
  it("silang: ujungnya bersih, tengahnya tidak meredup", () => {
    expect(opasitasSilang(0)).toEqual([1, 0]);
    expect(opasitasSilang(1)).toEqual([0, 1]);
    const [a, b] = opasitasSilang(0.5);
    // dua lapisan buram ditumpuk: gabungannya harus tetap nyaris penuh
    expect(1 - (1 - a) * (1 - b)).toBeGreaterThan(0.9);
    expect(opasitasSilang(-3)).toEqual([1, 0]);
    expect(opasitasSilang(7)).toEqual([0, 1]);
  });

  it("sudut kotak urut kiri-atas, kanan-atas, kanan-bawah, kiri-bawah", () => {
    expect(sudutKotak([100, -8, 110, -6])).toEqual([
      [100, -6],
      [110, -6],
      [110, -8],
      [100, -8],
    ]);
  });

  it("poligon kotak tertutup", () => {
    const p = poligonKotak([100, -8, 110, -6]).coordinates[0];
    expect(p).toHaveLength(5);
    expect(p[0]).toEqual(p[4]);
  });

  it("bantalan: panel di kiri untuk layar lebar, di bawah untuk ponsel", () => {
    expect(bantalanLayar(1440, 900).left).toBeGreaterThan(380);
    const hp = bantalanLayar(360, 740);
    expect(hp.left).toBeLessThan(20);
    expect(hp.bottom).toBeGreaterThan(740 * 0.42);
    // masih harus ada ruang peta yang tersisa di ponsel terkecil
    expect(740 - hp.top - hp.bottom).toBeGreaterThan(150);
  });
});
