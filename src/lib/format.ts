/** Format angka dan tanggal gaya Indonesia. */

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const ANGKA1 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ANGKA2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TANGGAL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const TANGGAL_PENDEK = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const STRIP = "–";

export function angka(v: number | null | undefined, desimal: 0 | 1 | 2 = 0): string {
  if (v == null || !Number.isFinite(v)) return STRIP;
  return (desimal === 2 ? ANGKA2 : desimal === 1 ? ANGKA1 : ANGKA).format(v);
}

/** 1.234.567 -> "1,2 juta"; 12.345 -> "12,3 ribu". */
export function ringkas(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return STRIP;
  const mutlak = Math.abs(v);
  if (mutlak >= 1e9) return `${ANGKA1.format(v / 1e9)} miliar`;
  if (mutlak >= 1e6) return `${ANGKA1.format(v / 1e6)} juta`;
  if (mutlak >= 1e4) return `${ANGKA1.format(v / 1e3)} ribu`;
  return ANGKA.format(v);
}

/** Persen dengan tanda: "+12,3%" atau "−4,0%". */
export function persenTanda(v: number | null | undefined, desimal: 0 | 1 = 0): string {
  if (v == null || !Number.isFinite(v)) return STRIP;
  const teks = (desimal === 1 ? ANGKA1 : ANGKA).format(Math.abs(v));
  if (Math.abs(v) < (desimal === 1 ? 0.05 : 0.5)) return `${teks}%`;
  return `${v > 0 ? "+" : "−"}${teks}%`;
}

export function persen(v: number | null | undefined, desimal: 0 | 1 | 2 = 1): string {
  if (v == null || !Number.isFinite(v)) return STRIP;
  return `${angka(v, desimal)}%`;
}

export function tanggal(iso: string, pendek = false): string {
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return STRIP;
  return (pendek ? TANGGAL_PENDEK : TANGGAL).format(t);
}

/** Geser tanggal ISO sekian hari (UTC). */
export function geserHari(iso: string, hari: number): string {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + hari);
  return t.toISOString().slice(0, 10);
}

/** "H-3", "H+0", "H+12". */
export function hariRelatif(hari: number): string {
  return hari < 0 ? `H${hari}`.replace("-", "−") : `H+${hari}`;
}
