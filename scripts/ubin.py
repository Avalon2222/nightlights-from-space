"""Potong komposit jadi ubin XYZ (PNG berpalet, transparan di area gelap) untuk MapLibre.

Zoom 8 = resolusi asli (~600 m). Zoom di bawahnya diperkecil dua kali berturut-turut dengan
campuran rata-rata dan maksimum, supaya kampung kecil tidak hilang saat peta dijauhkan.

Pakai:
    python scripts/ubin.py               # semua tahun yang kompositnya ada + peta selisih
Hasil: public/ubin/{tahun}/{z}/{x}/{y}.png dan public/ubin/selisih/{z}/{x}/{y}.png
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import numpy as np

import gibs
import palet

Z_MIN = 2
KELUAR = gibs.AKAR / "public" / "ubin"
PERIODE_AWAL = (2012, 2013, 2014)
N_AKHIR = 3


def perkecil(a: np.ndarray, x0: int, y0: int, fungsi) -> tuple[np.ndarray, int, int]:
    """Turun satu zoom. (x0, y0) = indeks ubin pojok kiri atas di zoom asal."""
    u = gibs.UKURAN
    kiri, atas = (x0 % 2) * u, (y0 % 2) * u
    kanan = (-(a.shape[1] + kiri)) % (2 * u)
    bawah = (-(a.shape[0] + atas)) % (2 * u)
    a = np.pad(a, ((atas, bawah), (kiri, kanan)), constant_values=0)
    t, l = a.shape
    blok = a.reshape(t // 2, 2, l // 2, 2)
    return fungsi(blok), x0 // 2, y0 // 2


def gabung_cahaya(blok: np.ndarray) -> np.ndarray:
    return 0.5 * blok.mean(axis=(1, 3)) + 0.5 * blok.max(axis=(1, 3))


def gabung_selisih(blok: np.ndarray) -> np.ndarray:
    rata = blok.mean(axis=(1, 3))
    r = blok.reshape(blok.shape[0], blok.shape[2], 4) if False else blok.transpose(0, 2, 1, 3).reshape(blok.shape[0], blok.shape[2], 4)
    ekstrem = np.take_along_axis(r, np.abs(r).argmax(axis=2)[..., None], axis=2)[..., 0]
    return 0.5 * rata + 0.5 * ekstrem


def tulis_piramida(a: np.ndarray, folder: Path, simpan, gabung) -> int:
    if folder.exists():
        shutil.rmtree(folder)
    x0, y0, jumlah = gibs.X_MIN, gibs.Y_MIN, 0
    a = np.nan_to_num(a.astype(np.float32), nan=0.0)
    u = gibs.UKURAN
    for z in range(gibs.ZOOM, Z_MIN - 1, -1):
        if z < gibs.ZOOM:
            a, x0, y0 = perkecil(a, x0, y0, gabung)
        for ty in range(a.shape[0] // u):
            for tx in range(a.shape[1] // u):
                tujuan = folder / str(z) / str(x0 + tx)
                tujuan.mkdir(parents=True, exist_ok=True)
                simpan(a[ty * u : (ty + 1) * u, tx * u : (tx + 1) * u], tujuan / f"{y0 + ty}.png")
                jumlah += 1
    return jumlah


def tahun_tersedia() -> list[int]:
    return sorted(int(p.stem.split("_")[1]) for p in gibs.OLAH.glob("komposit_*.npy"))


def rata(tahun: tuple[int, ...] | list[int]) -> np.ndarray:
    return np.mean([gibs.muat_komposit(t) for t in tahun], axis=0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tahun", type=int, nargs="*")
    args = ap.parse_args()
    semua = tahun_tersedia()
    for tahun in args.tahun or semua:
        a = gibs.muat_komposit(tahun)
        n = tulis_piramida(a, KELUAR / str(tahun), palet.simpan_cahaya, gabung_cahaya)
        print(tahun, n, "ubin", flush=True)
    akhir = semua[-N_AKHIR:]
    if not args.tahun and set(PERIODE_AWAL) <= set(semua) and akhir[0] > PERIODE_AWAL[-1]:
        selisih = rata(akhir) - rata(PERIODE_AWAL)
        n = tulis_piramida(selisih, KELUAR / "selisih", palet.simpan_selisih, gabung_selisih)
        print("selisih", PERIODE_AWAL, "->", akhir, n, "ubin")
        (KELUAR / "selisih" / "periode.json").write_text(json.dumps({"awal": list(PERIODE_AWAL), "akhir": akhir}))


if __name__ == "__main__":
    main()
