"""Ubah berkas HDF5 Black Marble (hasil scripts/ambil_laads.py) jadi komposit di grid mosaik zoom 8.

Berkas aslinya berupa ubin 10° x 10° dengan piksel 15 detik busur (sekitar 460 m) di grid lintang-bujur.
Di sini 18 ubin dijahit, lalu tiap piksel dimasukkan ke piksel Web Mercator zoom 8 yang memuatnya dan
dirata-rata. Piksel sumber lebih rapat dari piksel tujuan, jadi tidak ada lubang, dan rata-rata menjaga
total cahaya per wilayah.

  - tahunan (VNP46A4): lapisan AllAngle_Composite_Snow_Free (semua sudut pandang, bebas salju)
  - tahun berjalan (VNP46A3): median dari komposit bulanan yang sudah terbit

Pakai:
    python scripts/komposit_laads.py --dari 2012 --sampai 2025
    python scripts/komposit_laads.py --bulanan 2026
Hasil: cache/olah/komposit_{tahun}.npy dan sampel_{tahun}.json (bentuknya sama dengan jalur GIBS)
"""

from __future__ import annotations

import argparse
import calendar
import datetime as dt
import json
import re
from pathlib import Path

import numpy as np

import gibs
from ambil_laads import CACHE

LAPISAN = "AllAngle_Composite_Snow_Free"
GRUP = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields"
PIKSEL = 2400  # per ubin 10 derajat
H_MIN, H_MAX, V_MIN, V_MAX = 27, 32, 8, 10
BARAT, UTARA = -180 + H_MIN * 10, 90 - V_MIN * 10


def baca_ubin(berkas: Path) -> np.ndarray:
    import h5py

    with h5py.File(berkas, "r") as f:
        d = f[GRUP][LAPISAN]
        a = d[...].astype(np.float32)
        skala = float(np.ravel(d.attrs.get("scale_factor", 1.0))[0])
        geser = float(np.ravel(d.attrs.get("add_offset", 0.0))[0])
        kosong = d.attrs.get("_FillValue")
    buruk = ~np.isfinite(a) | (a < 0)
    if kosong is not None:
        buruk |= a == np.float32(np.ravel(kosong)[0])
    a = a * skala + geser
    a[buruk] = np.nan
    return a


def jahit(folder: Path) -> np.ndarray:
    """Mosaik lintang-bujur (baris dari utara) untuk satu folder berkas; NaN = tanpa data."""
    mosaik = np.full(((V_MAX - V_MIN + 1) * PIKSEL, (H_MAX - H_MIN + 1) * PIKSEL), np.nan, dtype=np.float32)
    ada = 0
    for berkas in sorted(folder.glob("*.h5")):
        m = re.search(r"\.h(\d{2})v(\d{2})\.", berkas.name)
        if not m:
            continue
        h, v = int(m.group(1)), int(m.group(2))
        if not (H_MIN <= h <= H_MAX and V_MIN <= v <= V_MAX):
            continue
        mosaik[(v - V_MIN) * PIKSEL : (v - V_MIN + 1) * PIKSEL, (h - H_MIN) * PIKSEL : (h - H_MIN + 1) * PIKSEL] = baca_ubin(berkas)
        ada += 1
    if ada == 0:
        raise FileNotFoundError(f"tidak ada berkas .h5 di {folder}")
    return mosaik


def indeks_tujuan() -> tuple[np.ndarray, np.ndarray]:
    """Untuk tiap kolom dan baris mosaik sumber: kolom dan baris piksel tujuan (-1 = di luar)."""
    langkah = 10.0 / PIKSEL
    lon = BARAT + (np.arange((H_MAX - H_MIN + 1) * PIKSEL) + 0.5) * langkah
    lat = UTARA - (np.arange((V_MAX - V_MIN + 1) * PIKSEL) + 0.5) * langkah
    kolom = np.floor(gibs.lon_ke_px(lon)).astype(np.int64)
    baris = np.floor(gibs.lat_ke_px(lat)).astype(np.int64)
    kolom[(kolom < 0) | (kolom >= gibs.LEBAR)] = -1
    baris[(baris < 0) | (baris >= gibs.TINGGI)] = -1
    return kolom, baris


def ke_mercator(mosaik: np.ndarray, kolom: np.ndarray, baris: np.ndarray) -> np.ndarray:
    """Rata-rata piksel sumber per piksel tujuan."""
    pakai_b = baris >= 0
    pakai_k = kolom >= 0
    sumber = mosaik[pakai_b][:, pakai_k]
    tujuan = (baris[pakai_b][:, None] * gibs.LEBAR + kolom[pakai_k][None, :]).ravel()
    nilai = sumber.ravel()
    sah = np.isfinite(nilai)
    n = gibs.LEBAR * gibs.TINGGI
    jumlah = np.bincount(tujuan[sah], weights=nilai[sah], minlength=n)
    banyak = np.bincount(tujuan[sah], minlength=n)
    with np.errstate(invalid="ignore", divide="ignore"):
        hasil = (jumlah / banyak).astype(np.float32)
    hasil[banyak == 0] = np.nan
    return hasil.reshape(gibs.TINGGI, gibs.LEBAR)


def simpan(tahun: int, komposit: np.ndarray, sampel: list[str]) -> None:
    gibs.OLAH.mkdir(parents=True, exist_ok=True)
    np.save(gibs.OLAH / f"komposit_{tahun}.npy", komposit.astype(np.float32))
    (gibs.OLAH / f"sampel_{tahun}.json").write_text(json.dumps(sampel))
    print(f"{tahun}: {len(sampel)} bulan, maks {np.nanmax(komposit):.0f}, tanpa data {np.isnan(komposit).mean():.1%}", flush=True)


def akhir_bulan(tahun: int, bulan: int) -> str:
    return dt.date(tahun, bulan, calendar.monthrange(tahun, bulan)[1]).isoformat()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dari", type=int)
    ap.add_argument("--sampai", type=int)
    ap.add_argument("--bulanan", type=int)
    args = ap.parse_args()
    kolom, baris = indeks_tujuan()

    if args.dari and args.sampai:
        for tahun in range(args.dari, args.sampai + 1):
            komposit = ke_mercator(jahit(CACHE / "VNP46A4" / str(tahun) / "001"), kolom, baris)
            simpan(tahun, komposit, [akhir_bulan(tahun, b) for b in range(1, 13)])

    if args.bulanan:
        tahun = args.bulanan
        tumpukan, sampel = [], []
        for folder in sorted((CACHE / "VNP46A3" / str(tahun)).iterdir()):
            if not folder.is_dir() or not any(folder.glob("*.h5")):
                continue
            tanggal = dt.date(tahun, 1, 1) + dt.timedelta(days=int(folder.name) - 1)
            # bulan yang belum habis sudah punya berkas, tapi isinya baru sebagian malam: lewati
            if dt.date.fromisoformat(akhir_bulan(tahun, tanggal.month)) >= dt.date.today():
                continue
            tumpukan.append(ke_mercator(jahit(folder), kolom, baris))
            sampel.append(akhir_bulan(tahun, tanggal.month))
        if not tumpukan:
            raise SystemExit(f"belum ada komposit bulanan {tahun} di cache")
        simpan(tahun, np.nanmedian(np.stack(tumpukan), axis=0), sampel)


if __name__ == "__main__":
    main()
