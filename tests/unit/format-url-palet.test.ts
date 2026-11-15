import { describe, expect, it } from "vitest";
import { angka, geserHari, hariRelatif, persen, persenTanda, ringkas, STRIP, tanggal } from "@/lib/format";
import { css, gradien, tabelAbuKeWarna, TITIK_CAHAYA, TITIK_NAIK, TITIK_TURUN, warnaCahaya } from "@/lib/palet";
import { bacaHash, KEADAAN_AWAL, tulisHash } from "@/lib/urlState";

describe("format", () => {
  it("angka gaya Indonesia: titik ribuan, koma desimal", () => {
    expect(angka(1234567)).toBe("1.234.567");
    expect(angka(12.345, 1)).toBe("12,3");
    expect(angka(2.5, 2)).toBe("2,50");
  });

  it("nilai kosong atau NaN tampil sebagai strip", () => {
    expect(angka(null)).toBe(STRIP);
    expect(angka(Number.NaN)).toBe(STRIP);
    expect(persen(undefined)).toBe(STRIP);
    expect(persenTanda(Number.POSITIVE_INFINITY)).toBe(STRIP);
    expect(ringkas(null)).toBe(STRIP);
    expect(tanggal("bukan-tanggal")).toBe(STRIP);
  });

  it("ringkas memilih satuan", () => {
    expect(ringkas(1_600_000)).toBe("1,6 juta");
    expect(ringkas(45_300)).toBe("45,3 ribu");
    expect(ringkas(2_400_000_000)).toBe("2,4 miliar");
    expect(ringkas(950)).toBe("950");
  });

  it("persen bertanda memakai minus tipografi dan tidak menulis +0", () => {
    expect(persenTanda(12.4)).toBe("+12%");
    expect(persenTanda(-3.6)).toBe("−4%");
    expect(persenTanda(0.2)).toBe("0%");
    expect(persenTanda(-0.04, 1)).toBe("0,0%");
  });

  it("tanggal dan geser hari memakai UTC", () => {
    expect(tanggal("2018-09-28")).toBe("28 September 2018");
    expect(geserHari("2024-02-28", 2)).toBe("2024-03-01");
    expect(geserHari("2021-01-01", -1)).toBe("2020-12-31");
  });

  it("hari relatif", () => {
    expect(hariRelatif(0)).toBe("H+0");
    expect(hariRelatif(12)).toBe("H+12");
    expect(hariRelatif(-3)).toBe("H−3");
  });
});

describe("palet", () => {
  it("titik palet urut naik dan alfanya tidak pernah turun", () => {
    for (const titik of [TITIK_CAHAYA, TITIK_NAIK, TITIK_TURUN]) {
      for (let i = 1; i < titik.length; i++) {
        expect(titik[i][0]).toBeGreaterThan(titik[i - 1][0]);
        expect(titik[i][1][3]).toBeGreaterThanOrEqual(titik[i - 1][1][3]);
      }
    }
  });

  it("di bawah ambang tampil transparan, di atas ujung dijepit", () => {
    expect(warnaCahaya(0)[3]).toBe(0);
    expect(warnaCahaya(0.1)[3]).toBe(0);
    expect(warnaCahaya(500)).toEqual(TITIK_CAHAYA[TITIK_CAHAYA.length - 1][1]);
  });

  it("makin terang makin buram dan makin putih", () => {
    const a = warnaCahaya(1);
    const b = warnaCahaya(10);
    expect(b[3]).toBeGreaterThan(a[3]);
    expect(b[1]).toBeGreaterThan(a[1]);
  });

  it("tepat di titik palet = warna titik itu", () => {
    for (const [nilai, warna] of TITIK_CAHAYA.slice(1)) expect(warnaCahaya(nilai)).toEqual(warna);
  });

  it("gradien CSS dimulai di 0% dan berakhir di 100%", () => {
    const g = gradien(TITIK_CAHAYA);
    expect(g).toMatch(/^linear-gradient\(to right, /);
    expect(g).toContain(" 0.0%");
    expect(g).toContain(" 100.0%");
    expect(css([255, 0, 0, 255])).toBe("rgba(255, 0, 0, 1.00)");
  });

  it("tabel abu ke warna: abu yang bukan palet GIBS transparan", () => {
    const nilai = new Array<number>(256).fill(0);
    nilai[200] = 16.8;
    const tabel = tabelAbuKeWarna(nilai);
    expect(tabel.length).toBe(1024);
    expect(tabel[100 * 4 + 3]).toBe(0);
    expect(Array.from(tabel.slice(800, 804))).toEqual(warnaCahaya(16.8));
  });
});

describe("keadaan URL", () => {
  it("hash kosong = keadaan awal, dan keadaan awal tidak menulis apa-apa", () => {
    expect(bacaHash("")).toEqual(KEADAAN_AWAL);
    expect(tulisHash(KEADAAN_AWAL)).toBe("");
  });

  it("bolak-balik untuk tiap mode", () => {
    const contoh = [
      { ...KEADAAN_AWAL, mode: "wilayah" as const, tahun: 2019, tingkat: "kabupaten" as const, metrik: "terang" as const, wilayah: "3510" },
      { ...KEADAAN_AWAL, mode: "blackout" as const, kejadian: "seroja-2021", tampilan: "selisih" as const },
      { ...KEADAAN_AWAL, mode: "hotspot" as const, sorotan: "ikn", tahun: 2022 },
      { ...KEADAAN_AWAL, harian: "2021-04-08", kamera: [123.6, -10.1, 7] as [number, number, number] },
    ];
    for (const k of contoh) expect(bacaHash(tulisHash(k))).toEqual(k);
  });

  it("koma di kamera tidak di-encode supaya tautannya enak dibaca", () => {
    expect(tulisHash({ ...KEADAAN_AWAL, kamera: [110.5, -7.25, 6.5] })).toBe("#c=110.500,-7.250,6.50");
  });

  it("menolak nilai ngawur dari URL", () => {
    const k = bacaHash("#m=hapus-semua&t=1999&h=2021-99-99&w=abc&k=<script>&v=lain&s=../../etc&c=999,0,3&x=rahasia");
    expect(k).toEqual(KEADAAN_AWAL);
  });

  it("kode wilayah dua digit = provinsi, empat digit = kabupaten", () => {
    expect(bacaHash("#m=wilayah&w=53").wilayah).toBe("53");
    expect(bacaHash("#m=wilayah&w=5371").wilayah).toBe("5371");
    expect(bacaHash("#m=wilayah&w=537").wilayah).toBeNull();
  });
});
