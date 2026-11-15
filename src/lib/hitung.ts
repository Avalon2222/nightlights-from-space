/** Hitungan kecil yang dipakai panel dan grafik. Semua fungsi murni supaya gampang dites. */

/** Deret dijadikan indeks: nilai di posisi `dasar` = 100. Null kalau dasarnya nol atau kosong. */
export function indeks(deret: (number | null)[], dasar = 0): (number | null)[] {
  const d = deret[dasar];
  if (d == null || d <= 0) return deret.map(() => null);
  return deret.map((v) => (v == null ? null : (v / d) * 100));
}

/** Perubahan persen dari a ke b. Null kalau a nol atau salah satunya kosong. */
export function persenUbah(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || a <= 0) return null;
  return ((b - a) / a) * 100;
}

/** Rata-rata beberapa elemen pertama/terakhir: meredam naik-turun satu tahun. */
export function rataUjung(deret: number[], n: number, ujung: "awal" | "akhir"): number {
  const potong = ujung === "awal" ? deret.slice(0, n) : deret.slice(-n);
  if (potong.length === 0) return 0;
  return potong.reduce((s, v) => s + v, 0) / potong.length;
}

/**
 * Pertumbuhan persen antara rata-rata n tahun pertama dan n tahun terakhir.
 * Null kalau awalnya terlalu kecil untuk dibandingkan (di bawah `lantai`).
 */
export function tumbuhPeriode(deret: number[], n = 3, lantai = 1): number | null {
  const awal = rataUjung(deret, n, "awal");
  const akhir = rataUjung(deret, n, "akhir");
  if (awal < lantai) return null;
  return ((akhir - awal) / awal) * 100;
}

/** Laju pertumbuhan majemuk per tahun (persen) dari nilai awal ke akhir selama `tahun` tahun. */
export function lajuMajemuk(awal: number, akhir: number, tahun: number): number | null {
  if (awal <= 0 || akhir <= 0 || tahun <= 0) return null;
  return (Math.pow(akhir / awal, 1 / tahun) - 1) * 100;
}

function peringkat(nilai: number[]): number[] {
  const urut = nilai.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const hasil = new Array<number>(nilai.length);
  let i = 0;
  while (i < urut.length) {
    let j = i;
    while (j + 1 < urut.length && urut[j + 1].v === urut[i].v) j++;
    const rata = (i + j) / 2 + 1; // nilai kembar dapat peringkat rata-rata
    for (let k = i; k <= j; k++) hasil[urut[k].i] = rata;
    i = j + 1;
  }
  return hasil;
}

/** Korelasi Pearson. Null kalau datanya kurang dari 3 pasang atau salah satu sisi konstan. */
export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Korelasi peringkat Spearman: tahan terhadap pencilan seperti Jakarta. */
export function spearman(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  return pearson(peringkat(x.slice(0, n)), peringkat(y.slice(0, n)));
}

/** Regresi linear sederhana y = a + b·x. */
export function regresi(x: number[], y: number[]): { a: number; b: number } | null {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;
  const mx = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const my = y.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) * (x[i] - mx);
  }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** Batas kuantil untuk skala warna peta (mis. 5 kelas -> 4 batas). Nilai null dilewati. */
export function batasKuantil(nilai: (number | null)[], kelas: number): number[] {
  const bersih = nilai.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (bersih.length === 0) return [];
  const batas: number[] = [];
  for (let i = 1; i < kelas; i++) {
    const pos = (i / kelas) * (bersih.length - 1);
    const bawah = Math.floor(pos);
    const atas = Math.ceil(pos);
    batas.push(bersih[bawah] + (bersih[atas] - bersih[bawah]) * (pos - bawah));
  }
  return batas;
}

/** Kelas (0..batas.length) tempat sebuah nilai jatuh. */
export function kelasDari(nilai: number, batas: number[]): number {
  let k = 0;
  while (k < batas.length && nilai > batas[k]) k++;
  return k;
}

export function jepit(v: number, bawah: number, atas: number): number {
  return Math.min(atas, Math.max(bawah, v));
}
