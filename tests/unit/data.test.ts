import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sinyal } from "@/components/PanelBlackout";
import { kelipatan } from "@/components/PanelHotspot";
import { selisihKabupaten } from "@/components/PanelPerubahan";
import { formatMetrik } from "@/components/PanelWilayah";
import type { Kejadian, Sorotan, Statistik } from "@/lib/jenis";
import { batasMetrik, METRIK, nilaiSemua, tahunPlnTerakhir } from "@/lib/metrik";
import { KELAS_DUA_ARAH, KELAS_URUT } from "@/lib/palet";

const publik = (...bagian: string[]) => join(process.cwd(), "public", ...bagian);
const baca = <T>(nama: string) => JSON.parse(readFileSync(publik("data", nama), "utf-8")) as T;

const s = baca<Statistik>("statistik.json");
const kejadian = baca<Kejadian[]>("kejadian.json");
const sorotan = baca<Sorotan[]>("sorotan.json");
const n = s.tahun.length;

describe("statistik.json", () => {
  it("tahunnya berurutan dari 2012 dan tiap tahun punya sampel", () => {
    expect(s.tahun[0]).toBe(2012);
    s.tahun.forEach((t, i) => expect(t).toBe(2012 + i));
    expect(s.sampel).toHaveLength(n);
    for (const x of s.sampel) expect(x.jumlah).toBeGreaterThanOrEqual(12);
  });

  it("38 provinsi dan 514 kabupaten/kota dengan kode unik", () => {
    expect(s.provinsi).toHaveLength(38);
    expect(s.kabupaten).toHaveLength(514);
    expect(new Set(s.provinsi.map((p) => p.kode)).size).toBe(38);
    expect(new Set(s.kabupaten.map((k) => k.kode)).size).toBe(514);
  });

  it("semua deret sepanjang jumlah tahun, tanpa NaN atau nilai negatif", () => {
    const cek = (deret: (number | null)[]) => {
      expect(deret).toHaveLength(n);
      for (const v of deret) if (v != null) expect(Number.isFinite(v) && v >= 0).toBe(true);
    };
    for (const d of [s.nasional.cahaya, s.nasional.luasTerang, s.nasional.penduduk, s.nasional.pln]) cek(d);
    for (const p of s.provinsi) for (const d of [p.cahaya, p.luasTerang, p.penduduk, p.pln]) cek(d);
    for (const k of s.kabupaten) for (const d of [k.cahaya, k.luasTerang]) cek(d);
  });

  it("nasional = jumlah provinsi = jumlah kabupaten", () => {
    for (let i = 0; i < n; i++) {
      const prov = s.provinsi.reduce((t, p) => t + p.cahaya[i], 0);
      const kab = s.kabupaten.reduce((t, k) => t + k.cahaya[i], 0);
      expect(Math.abs(prov - s.nasional.cahaya[i])).toBeLessThan(40);
      expect(Math.abs(kab - s.nasional.cahaya[i])).toBeLessThan(300);
    }
  });

  it("tiap kabupaten menunjuk provinsi yang ada, dan luas terang tidak melebihi luas wilayah", () => {
    const prov = new Set(s.provinsi.map((p) => p.kode));
    for (const k of s.kabupaten) {
      expect(prov.has(k.prov)).toBe(true);
      expect(k.penduduk2020).toBeGreaterThan(0);
      expect(Math.max(...k.luasTerang)).toBeLessThanOrEqual(k.luasKm2 + 1);
    }
  });

  it("persen PLN di antara 0 dan 100, dan nasional naik dari 2012", () => {
    for (const p of s.provinsi) for (const v of p.pln) if (v != null) expect(v > 0 && v <= 100).toBe(true);
    const iAkhir = tahunPlnTerakhir(s);
    expect(s.tahun[iAkhir]).toBeGreaterThanOrEqual(2025);
    expect(s.nasional.pln[iAkhir] as number).toBeGreaterThan(s.nasional.pln[0] as number);
  });

  it("penduduk nasional masuk akal (240–300 juta) dan terus naik", () => {
    expect(s.nasional.penduduk[0]).toBeGreaterThan(240e6);
    expect(s.nasional.penduduk[n - 1]).toBeLessThan(300e6);
    for (let i = 1; i < n; i++) expect(s.nasional.penduduk[i]).toBeGreaterThan(s.nasional.penduduk[i - 1]);
  });

  it("semua provinsi punya PDRB", () => {
    for (const p of s.provinsi) {
      expect(p.pdrb).not.toBeNull();
      expect(p.pdrb!.berlaku).toBeGreaterThan(p.pdrb!.konstan);
    }
  });

  it("cahaya nasional sekarang lebih dari dua kali 2012", () => {
    expect(s.nasional.cahaya[n - 1]).toBeGreaterThan(2 * s.nasional.cahaya[0]);
  });
});

describe("metrik wilayah", () => {
  it("tiap metrik memberi nilai untuk semua provinsi, dan batas kelasnya urut", () => {
    for (const m of Object.values(METRIK)) {
      const nilai = nilaiSemua(s, "provinsi", m.id, tahunPlnTerakhir(s));
      expect(nilai).toHaveLength(38);
      expect(nilai.filter((x) => x.nilai != null).length).toBeGreaterThanOrEqual(36);
      const batas = batasMetrik(m.id, nilai);
      expect(batas).toHaveLength((m.duaArah ? KELAS_DUA_ARAH : KELAS_URUT).length - 1);
      for (let i = 1; i < batas.length; i++) expect(batas[i]).toBeGreaterThanOrEqual(batas[i - 1]);
    }
  });

  it("PLN tidak tersedia di tingkat kabupaten", () => {
    expect(nilaiSemua(s, "kabupaten", "pln", 0).every((x) => x.nilai == null)).toBe(true);
    expect(nilaiSemua(s, "kabupaten", "terang", n - 1).every((x) => x.induk)).toBe(true);
  });

  it("format per metrik", () => {
    expect(formatMetrik("tumbuh", 123.4)).toBe("+123%");
    expect(formatMetrik("perKapita", 2.871)).toBe("2,87");
    expect(formatMetrik("pln", 98.46)).toBe("98,5%");
    expect(formatMetrik("terang", null)).toBe("–");
  });

  it("selisih kabupaten: mayoritas bertambah terang", () => {
    const d = selisihKabupaten(s);
    expect(d).toHaveLength(514);
    expect(d.filter((x) => x.selisih > 0).length).toBeGreaterThan(450);
  });
});

describe("kejadian.json", () => {
  it("tiap kejadian lengkap dan punya tiga citra", () => {
    expect(kejadian.length).toBeGreaterThanOrEqual(5);
    for (const k of kejadian) {
      expect(k.id).toMatch(/^[a-z0-9-]+$/);
      expect(k.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(k.ringkas.length).toBeGreaterThan(60);
      expect(k.sumber).toMatch(/^https:\/\//);
      expect(k.kotak[0]).toBeLessThan(k.kotak[2]);
      expect(k.kotak[1]).toBeLessThan(k.kotak[3]);
      expect(k.deret.length).toBeGreaterThan(60);
      expect(k.deret.some((d) => d[0] < 0) && k.deret.some((d) => d[0] > 30)).toBe(true);
      expect(k.terendah.hari).toBeGreaterThanOrEqual(0);
      expect(k.terendah.hari).toBeLessThanOrEqual(30);
      for (const t of ["sebelum", "sesudah", "selisih"]) expect(existsSync(publik("kejadian", `${k.id}_${t}.png`))).toBe(true);
      expect(s.tahun).toContain(Number(k.tanggal.slice(0, 4)));
    }
  });

  it("Palu dan Cianjur ada di daftar; Seroja tercatat sebagai sinyal kuat", () => {
    const id = kejadian.map((k) => k.id);
    expect(id).toContain("palu-2018");
    expect(id).toContain("cianjur-2022");
    expect(sinyal(kejadian.find((k) => k.id === "seroja-2021")!.terendah.indeks).label).toBe("sinyal kuat");
  });

  it("label sinyal mengikuti titik terendah", () => {
    expect(sinyal(20).label).toBe("sinyal kuat");
    expect(sinyal(70).label).toBe("sinyal sedang");
    expect(sinyal(90).label).toBe("sinyal lemah");
    expect(sinyal(99).label).toBe("tidak terlihat");
  });
});

describe("sorotan.json", () => {
  it("tiap hotspot punya deret sepanjang jumlah tahun dan kotak yang wajar", () => {
    expect(sorotan.length).toBeGreaterThanOrEqual(8);
    for (const x of sorotan) {
      for (const d of [x.cahaya, x.luasTerang, x.puncak]) expect(d).toHaveLength(n);
      expect(x.pusat[0]).toBeGreaterThan(x.kotak[0]);
      expect(x.pusat[0]).toBeLessThan(x.kotak[2]);
      expect(Math.max(...x.puncak)).toBeLessThanOrEqual(s.potong + 0.01);
    }
  });

  it("IKN dan Morowali memang menyala: naik lebih dari 20 kali", () => {
    for (const id of ["ikn", "imip"]) {
      const k = kelipatan(sorotan.find((x) => x.id === id)!.cahaya);
      expect(k).not.toBeNull();
      expect(k as number).toBeGreaterThan(20);
    }
  });

  it("kelipatan null kalau awalnya gelap total", () => {
    expect(kelipatan([0, 0, 0, 5, 50, 500])).toBeNull();
    expect(kelipatan([10, 10, 10, 20, 20, 20])).toBe(2);
  });
});

describe("ubin", () => {
  it("tiap tahun punya ubin dari zoom 2 sampai 8, begitu juga peta selisih", () => {
    for (const folder of [...s.tahun.map(String), "selisih"]) {
      expect(existsSync(publik("ubin", folder, "2", "3", "1.png"))).toBe(true);
      expect(existsSync(publik("ubin", folder, "8", "204", "132.png"))).toBe(true);
      expect(existsSync(publik("ubin", folder, "8", "228", "135.png"))).toBe(true);
    }
  });

  it("batas wilayah untuk peta tersedia", () => {
    for (const [nama, jumlah] of [
      ["provinsi.geojson", 38],
      ["kabupaten.geojson", 514],
    ] as const) {
      const g = JSON.parse(readFileSync(publik("data", nama), "utf-8")) as { features: { properties: { kode: string; nama: string } }[] };
      expect(g.features).toHaveLength(jumlah);
      expect(g.features.every((f) => f.properties.kode && f.properties.nama)).toBe(true);
    }
  });
});
