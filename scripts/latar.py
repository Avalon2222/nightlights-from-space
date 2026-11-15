"""Hitung tingkat latar tiap komposit tahunan.

Latar = rata-rata radiance piksel daratan Indonesia yang gelap di semua tahun (maksimum antar
tahun di bawah 0,6 nW/cm²/sr; sekitar 89% daratan). Nilainya mestinya nol, tapi di data bergeser
0,06 sampai 0,21 dari tahun ke tahun (derau sensor, cahaya langit, perubahan pengolahan). Angka ini
dikurangkan dari komposit sebelum statistik dan ubin dibuat, supaya tahun-tahunnya sebanding.

Keluaran: cache/olah/latar.json dan data/latar_tahunan.csv
"""

from __future__ import annotations

import csv
import json

import numpy as np

import gibs

AMBANG_GELAP = 0.6


def main() -> None:
    darat = np.load(gibs.OLAH / "label_kab.npy") > 0
    tahun = gibs.tahun_tersedia()
    maks = np.zeros(darat.shape, dtype=np.float32)
    for t in tahun:
        maks = np.maximum(maks, gibs.muat_komposit(t, koreksi=False))
    gelap = darat & (maks < AMBANG_GELAP)
    latar = {t: round(float(gibs.muat_komposit(t, koreksi=False)[gelap].mean()), 3) for t in tahun}
    (gibs.OLAH / "latar.json").write_text(json.dumps({str(t): v for t, v in latar.items()}))
    with (gibs.AKAR / "data" / "latar_tahunan.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["tahun", "latar_nw_cm2_sr"])
        w.writerows(latar.items())
    print(f"piksel gelap permanen: {gelap.mean() / darat.mean():.1%} daratan")
    print(latar)


if __name__ == "__main__":
    main()
