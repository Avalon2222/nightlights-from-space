"""Deret harian dan citra sebelum/sesudah untuk kejadian padam besar (gempa, siklon, blackout).

Untuk tiap kejadian di data/kejadian.json:
  1. unduh ubin harian Black Marble di sekitar lokasi, dari H-30 sampai H+75
  2. garis dasar = median per piksel H-30..H-1; piksel "terang" = garis dasar >= 1 nW/cm²/sr
  3. deret harian = total radiance piksel terang, dijadikan indeks (garis dasar = 100);
     titik terendah dan hari pulih dihitung dari median geser 3 malam
  4. citra sebelum = garis dasar; citra sesudah = median rentang `sesudah` di konfigurasi

Tanggal di GIBS adalah tanggal UTC lintasan satelit (sekitar 01.30 waktu setempat), jadi malam
setelah kejadian sore hari punya tanggal yang sama dengan kejadiannya.

Produk ini diisi-celah: kalau malam itu berawan, nilainya masih nilai cerah terakhir. Karena itu
penurunan baru terlihat di malam cerah pertama setelah kejadian, dan pemulihan bisa tampak telat.

Keluaran: public/kejadian/{id}_{sebelum|sesudah|selisih}.png dan public/data/kejadian.json
"""

from __future__ import annotations

import datetime as dt
import json

import numpy as np

import gibs
import palet

AMBANG = 1.0
HARI_SEBELUM, HARI_SESUDAH = 30, 75
KELUAR = gibs.AKAR / "public" / "kejadian"


def ambil_deret(tanggal: dt.date, kotak: list[float], dari: int, sampai: int) -> tuple[list[int], np.ndarray, tuple[int, int, int, int]]:
    """Tumpukan radiance harian (hari, y, x) untuk kotak [barat, selatan, timur, utara]."""
    x0, x1, y0, y1 = gibs.kotak_ubin(*kotak)
    lut = gibs.muat_lut()
    geser, tumpukan = [], []
    for g in range(dari, sampai + 1):
        tgl = (tanggal + dt.timedelta(days=g)).isoformat()
        mosaik = gibs.ambil_mosaik(tgl, x0, x1, y0, y1, pekerja=8)
        if (mosaik > 0).mean() < 0.5:
            continue
        geser.append(g)
        tumpukan.append(lut[mosaik])
    return geser, np.stack(tumpukan), (x0, x1, y0, y1)


def potong(kotak: list[float], ubin: tuple[int, int, int, int]) -> tuple[slice, slice, list[float]]:
    """Irisan piksel untuk kotak di dalam mosaik lokal + kotak lon/lat yang pas di tepi piksel."""
    x0, _x1, y0, _y1 = ubin
    barat, selatan, timur, utara = kotak
    px0 = int(np.floor(gibs.lon_ke_px(barat))) + (gibs.X_MIN - x0) * gibs.UKURAN
    px1 = int(np.ceil(gibs.lon_ke_px(timur))) + (gibs.X_MIN - x0) * gibs.UKURAN
    py0 = int(np.floor(gibs.lat_ke_px(utara))) + (gibs.Y_MIN - y0) * gibs.UKURAN
    py1 = int(np.ceil(gibs.lat_ke_px(selatan))) + (gibs.Y_MIN - y0) * gibs.UKURAN
    gx, gy = (x0 - gibs.X_MIN) * gibs.UKURAN, (y0 - gibs.Y_MIN) * gibs.UKURAN
    pas = [
        float(gibs.px_ke_lon(px0 + gx)),
        float(gibs.px_ke_lat(py1 + gy)),
        float(gibs.px_ke_lon(px1 + gx)),
        float(gibs.px_ke_lat(py0 + gy)),
    ]
    return slice(py0, py1), slice(px0, px1), pas


def olah(k: dict) -> dict:
    tanggal = dt.date.fromisoformat(k["tanggal"])
    geser, tumpukan, ubin = ambil_deret(tanggal, k["kotak"], -HARI_SEBELUM, HARI_SESUDAH)
    sy, sx, pas = potong(k["kotak"], ubin)
    tumpukan = tumpukan[:, sy, sx]
    g = np.array(geser)
    dasar = np.nanmedian(tumpukan[g < 0], axis=0)
    a, b = k.get("sesudah", [0, 5])
    sesudah = np.nanmedian(tumpukan[(g >= a) & (g <= b)], axis=0)
    terang = np.nan_to_num(dasar) >= AMBANG
    total_dasar = float(np.nansum(dasar[terang]))
    deret = []
    for i, hari in enumerate(geser):
        v = tumpukan[i][terang]
        if np.isfinite(v).mean() < 0.9:
            continue
        deret.append([hari, round(float(np.nansum(v)) / total_dasar * 100, 1)])
    # median geser 3 malam: satu malam ganjil (awan tipis, sudut pandang) tidak dihitung sebagai padam
    nilai = [d[1] for d in deret]
    halus = [float(np.median(nilai[max(0, i - 1) : i + 2])) for i in range(len(nilai))]
    setelah = [(d[0], h) for d, h in zip(deret, halus) if d[0] >= 0]
    # dicari di 30 malam pertama saja; setelah itu naik-turunnya sudah bukan soal kejadiannya
    terendah = min((d for d in setelah if d[0] <= 30), key=lambda d: d[1])
    malam_kejadian = next((d[1] for d in deret if d[0] == 0), None)
    # pulih = malam pertama setelah titik terendah saat median geser kembali >= 90
    pulih = next((hari for hari, h in setelah if hari > terendah[0] and h >= 90), None)
    KELUAR.mkdir(parents=True, exist_ok=True)
    palet.simpan_cahaya(dasar, KELUAR / f"{k['id']}_sebelum.png")
    palet.simpan_cahaya(sesudah, KELUAR / f"{k['id']}_sesudah.png")
    palet.simpan_selisih(np.nan_to_num(sesudah) - np.nan_to_num(dasar), KELUAR / f"{k['id']}_selisih.png")
    hasil = {kk: v for kk, v in k.items() if kk not in ("sesudah",)}
    hasil.update(
        {
            "kotak": [round(x, 5) for x in pas],
            "deret": deret,
            "terendah": {"hari": terendah[0], "indeks": round(terendah[1], 1)},
            "malamKejadian": malam_kejadian,
            "hariPulih": pulih,
            "luasTerangKm2": round(float((terang * gibs.luas_piksel_km2()[0]).sum()), 0),
            "rentangSesudah": [a, b],
        }
    )
    return hasil


def main() -> None:
    daftar = json.loads((gibs.AKAR / "data" / "kejadian.json").read_text(encoding="utf-8"))
    hasil = []
    for k in daftar:
        h = olah(k)
        hasil.append(h)
        print(f"{h['id']}: terendah {h['terendah']['indeks']} di H+{h['terendah']['hari']}, pulih {h['hariPulih']}, {len(h['deret'])} malam", flush=True)
    (gibs.AKAR / "public" / "data").mkdir(parents=True, exist_ok=True)
    (gibs.AKAR / "public" / "data" / "kejadian.json").write_text(json.dumps(hasil, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
