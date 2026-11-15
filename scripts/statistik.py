"""Statistik cahaya per kabupaten/kota, provinsi, dan nasional untuk tiap tahun.

Dua ukuran, dua-duanya hanya menghitung piksel yang radiansnya >= AMBANG:
  - cahaya        : jumlah radiance x luas piksel (nW/cm²/sr x km²), sering disebut "sum of lights"
  - luas_terang   : luas piksel terang (km²)
Komposit sudah dikurangi latar tahunan (lihat scripts/latar.py).

Radiance dari GIBS terpotong di 38,2 nW/cm²/sr, jadi "cahaya" di inti kota besar terhitung
terlalu rendah; "luas_terang" tidak terpengaruh.

Keluaran: data/cahaya_kabupaten.csv, data/cahaya_provinsi.csv, data/cahaya_nasional.csv
"""

from __future__ import annotations

import csv
import json

import numpy as np

import gibs
from wilayah import PROVINSI

AMBANG = 1.0
DATA = gibs.AKAR / "data"


def muat_kabupaten() -> list[dict]:
    with (DATA / "kabupaten.csv").open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def zonal(komposit: np.ndarray, label: np.ndarray, luas_baris: np.ndarray, n: int) -> tuple[np.ndarray, np.ndarray]:
    """(cahaya, luas_terang) per label 1..n."""
    a = np.nan_to_num(komposit.astype(np.float32), nan=0.0)
    terang = (a >= AMBANG) & (label > 0)
    luas = np.broadcast_to(luas_baris[:, None], a.shape)
    lab = label[terang].astype(np.int64)
    cahaya = np.bincount(lab, weights=(a[terang] * luas[terang]), minlength=n + 1)[1:]
    luas_terang = np.bincount(lab, weights=luas[terang], minlength=n + 1)[1:]
    return cahaya, luas_terang


def tahun_tersedia() -> list[int]:
    return sorted(int(p.stem.split("_")[1]) for p in gibs.OLAH.glob("komposit_*.npy"))


def main() -> None:
    kab = muat_kabupaten()
    n = len(kab)
    label = np.load(gibs.OLAH / "label_kab.npy")
    luas_baris = gibs.luas_piksel_km2()
    luas_wilayah = np.bincount(label[label > 0].astype(np.int64), weights=np.broadcast_to(luas_baris[:, None], label.shape)[label > 0], minlength=n + 1)[1:]
    tahun = tahun_tersedia()

    baris_kab, prov, nasional = [], {}, []
    for t in tahun:
        komposit = gibs.muat_komposit(t)
        cahaya, luas = zonal(komposit, label, luas_baris, n)
        sampel = json.loads((gibs.OLAH / f"sampel_{t}.json").read_text())
        for i, k in enumerate(kab):
            baris_kab.append([k["kode"], t, round(float(cahaya[i]), 1), round(float(luas[i]), 1)])
            p = prov.setdefault((k["kode_prov"], t), [0.0, 0.0])
            p[0] += float(cahaya[i])
            p[1] += float(luas[i])
        nasional.append([t, round(float(cahaya.sum()), 1), round(float(luas.sum()), 1), len(sampel), sampel[0], sampel[-1]])
        print(t, f"cahaya {cahaya.sum():,.0f}  luas terang {luas.sum():,.0f} km²", flush=True)

    with (DATA / "cahaya_kabupaten.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["kode", "tahun", "cahaya", "luas_terang_km2"])
        w.writerows(baris_kab)
    with (DATA / "cahaya_provinsi.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["kode_prov", "provinsi", "tahun", "cahaya", "luas_terang_km2"])
        for (kode, t), (c, l) in sorted(prov.items()):
            w.writerow([kode, PROVINSI[kode], t, round(c, 1), round(l, 1)])
    with (DATA / "cahaya_nasional.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["tahun", "cahaya", "luas_terang_km2", "jumlah_sampel", "sampel_pertama", "sampel_terakhir"])
        w.writerows(nasional)
    # luas wilayah menurut raster (sudah termasuk pelebaran pesisir), dipakai untuk persen wilayah terang
    with (DATA / "kabupaten.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["kode", "nama", "kode_prov", "provinsi", "penduduk_2020", "luas_km2"])
        for i, k in enumerate(kab):
            w.writerow([k["kode"], k["nama"], k["kode_prov"], k["provinsi"], k["penduduk_2020"], round(float(luas_wilayah[i]), 1)])


if __name__ == "__main__":
    main()
