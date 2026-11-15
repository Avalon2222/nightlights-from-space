import { describe, expect, it } from "vitest";
import { batasKuantil, indeks, jepit, kelasDari, lajuMajemuk, pearson, persenUbah, rataUjung, regresi, spearman, tumbuhPeriode } from "@/lib/hitung";

describe("indeks", () => {
  it("menjadikan nilai dasar 100", () => {
    expect(indeks([50, 100, 75])).toEqual([100, 200, 150]);
    expect(indeks([50, 100, 75], 1)).toEqual([50, 100, 75]);
  });

  it("null kalau dasarnya nol atau kosong", () => {
    expect(indeks([0, 10])).toEqual([null, null]);
    expect(indeks([null, 10])).toEqual([null, null]);
  });

  it("meneruskan null di tengah deret", () => {
    expect(indeks([10, null, 20])).toEqual([100, null, 200]);
  });
});

describe("persenUbah", () => {
  it("menghitung naik dan turun", () => {
    expect(persenUbah(100, 150)).toBe(50);
    expect(persenUbah(200, 100)).toBe(-50);
  });

  it("null kalau awalnya nol atau ada yang kosong", () => {
    expect(persenUbah(0, 10)).toBeNull();
    expect(persenUbah(null, 10)).toBeNull();
    expect(persenUbah(10, undefined)).toBeNull();
  });
});

describe("rataUjung dan tumbuhPeriode", () => {
  const deret = [10, 20, 30, 40, 50, 60];

  it("merata-rata n elemen di ujung", () => {
    expect(rataUjung(deret, 3, "awal")).toBe(20);
    expect(rataUjung(deret, 3, "akhir")).toBe(50);
    expect(rataUjung([], 3, "awal")).toBe(0);
  });

  it("tumbuh antara tiga tahun pertama dan terakhir", () => {
    expect(tumbuhPeriode(deret)).toBe(150);
  });

  it("null kalau awalnya di bawah lantai (dari gelap tidak bisa dipersenkan)", () => {
    expect(tumbuhPeriode([0, 0, 0, 100, 200, 300])).toBeNull();
    expect(tumbuhPeriode([2, 2, 2, 100, 200, 300], 3, 5)).toBeNull();
  });
});

describe("lajuMajemuk", () => {
  it("dua kali lipat dalam setahun = 100% per tahun", () => {
    expect(lajuMajemuk(100, 200, 1)).toBeCloseTo(100);
    expect(lajuMajemuk(100, 121, 2)).toBeCloseTo(10);
  });

  it("null untuk masukan tak wajar", () => {
    expect(lajuMajemuk(0, 10, 3)).toBeNull();
    expect(lajuMajemuk(10, 20, 0)).toBeNull();
  });
});

describe("korelasi", () => {
  it("pearson 1 untuk garis lurus naik, -1 untuk turun", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
  });

  it("null kalau kurang dari tiga pasang atau salah satu sisi konstan", () => {
    expect(pearson([1, 2], [1, 2])).toBeNull();
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNull();
  });

  it("spearman tetap 1 untuk hubungan monoton yang tidak lurus", () => {
    expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 1000])).toBeCloseTo(1);
  });

  it("spearman memberi peringkat rata-rata untuk nilai kembar", () => {
    const r = spearman([1, 2, 2, 3], [1, 2, 2, 3]);
    expect(r).toBeCloseTo(1);
  });
});

describe("regresi", () => {
  it("menemukan kemiringan dan titik potong", () => {
    const g = regresi([0, 1, 2, 3], [1, 3, 5, 7]);
    expect(g?.a).toBeCloseTo(1);
    expect(g?.b).toBeCloseTo(2);
  });

  it("null kalau x konstan", () => {
    expect(regresi([2, 2, 2], [1, 2, 3])).toBeNull();
  });
});

describe("kelas warna", () => {
  it("batas kuantil membagi rata", () => {
    expect(batasKuantil([1, 2, 3, 4, 5], 4)).toEqual([2, 3, 4]);
  });

  it("melewati null dan kosong", () => {
    expect(batasKuantil([null, 10, null, 20], 2)).toEqual([15]);
    expect(batasKuantil([null], 5)).toEqual([]);
  });

  it("kelasDari menaruh nilai di kelas yang benar", () => {
    const batas = [0, 10, 20];
    expect(kelasDari(-5, batas)).toBe(0);
    expect(kelasDari(0, batas)).toBe(0);
    expect(kelasDari(5, batas)).toBe(1);
    expect(kelasDari(15, batas)).toBe(2);
    expect(kelasDari(99, batas)).toBe(3);
  });
});

describe("jepit", () => {
  it("menjaga nilai di dalam rentang", () => {
    expect(jepit(5, 0, 3)).toBe(3);
    expect(jepit(-1, 0, 3)).toBe(0);
    expect(jepit(2, 0, 3)).toBe(2);
  });
});
