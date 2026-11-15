"""Bangun komposit tahunan Black Marble untuk Indonesia dari ubin harian GIBS.

Tiap tahun diambil beberapa tanggal per bulan (default tanggal 6 dan 21). Produk harian ini sudah
diisi-celah, jadi tiap sampel = pengamatan cerah terakhir di piksel itu. Median semua sampel
dalam setahun membuang cahaya sesaat (kebakaran lahan, kapal, petir) dan menyisakan lampu yang
menetap.

Pakai:
    python scripts/ambil_tahunan.py --dari 2012 --sampai 2026
Hasil: cache/olah/komposit_{tahun}.npy (float16, nW/cm²/sr; NaN = tanpa data)
       cache/olah/sampel_{tahun}.json (tanggal yang terpakai)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import time

import numpy as np

import gibs

HARI_SAMPEL = (6, 21)
AWAL_DATA = dt.date(2012, 1, 19)


def tanggal_sampel(tahun: int, sampai: dt.date) -> list[dt.date]:
    hasil = []
    for bulan in range(1, 13):
        for hari in HARI_SAMPEL:
            t = dt.date(tahun, bulan, hari)
            if AWAL_DATA <= t <= sampai:
                hasil.append(t)
    return hasil


def ambil_dengan_cadangan(t: dt.date) -> tuple[str, np.ndarray] | None:
    """Kalau tanggal itu kosong di GIBS, geser 1–4 hari."""
    for geser in (0, 1, -1, 2, -2, 3, -3, 4, -4):
        tgl = (t + dt.timedelta(days=geser)).isoformat()
        mosaik = gibs.ambil_mosaik(tgl)
        if (mosaik > 0).mean() > 0.2:
            return tgl, mosaik
    return None


def komposit(tumpukan: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """Median per piksel dari tumpukan indeks palet (n, tinggi, lebar), abaikan indeks 0."""
    n, tinggi, lebar = tumpukan.shape
    hasil = np.full((tinggi, lebar), np.nan, dtype=np.float32)
    for y0 in range(0, tinggi, gibs.UKURAN):
        potong = lut[tumpukan[:, y0 : y0 + gibs.UKURAN, :]]
        ada = np.isfinite(potong).any(axis=0)
        med = np.full(potong.shape[1:], np.nan, dtype=np.float32)
        if ada.any():
            med[ada] = np.nanmedian(potong[:, ada], axis=0)
        hasil[y0 : y0 + gibs.UKURAN] = med
    return hasil


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dari", type=int, default=2012)
    ap.add_argument("--sampai", type=int, default=dt.date.today().year)
    ap.add_argument("--batas", default=None, help="tanggal terakhir yang dipakai (YYYY-MM-DD)")
    ap.add_argument("--ulang", action="store_true", help="bangun ulang walau komposit sudah ada")
    args = ap.parse_args()

    batas = dt.date.fromisoformat(args.batas) if args.batas else dt.date.today() - dt.timedelta(days=14)
    lut = gibs.muat_lut()
    gibs.OLAH.mkdir(parents=True, exist_ok=True)

    for tahun in range(args.dari, args.sampai + 1):
        keluar = gibs.OLAH / f"komposit_{tahun}.npy"
        if keluar.exists() and not args.ulang:
            print(tahun, "sudah ada, lewati")
            continue
        mulai = time.time()
        tumpukan, terpakai = [], []
        for t in tanggal_sampel(tahun, batas):
            dapat = ambil_dengan_cadangan(t)
            if dapat is None:
                print("  kosong:", t)
                continue
            terpakai.append(dapat[0])
            tumpukan.append(dapat[1])
            print(f"  {dapat[0]} ok ({time.time() - mulai:.0f} dtk)", flush=True)
        if not tumpukan:
            print(tahun, "tidak ada data")
            continue
        hasil = komposit(np.stack(tumpukan), lut)
        np.save(keluar, hasil.astype(np.float16))
        (gibs.OLAH / f"sampel_{tahun}.json").write_text(json.dumps(terpakai))
        print(f"{tahun}: {len(terpakai)} sampel, {time.time() - mulai:.0f} dtk", flush=True)


if __name__ == "__main__":
    main()
