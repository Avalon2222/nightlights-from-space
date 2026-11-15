"""Alat bersama untuk mengambil ubin Black Marble dari NASA GIBS.

Lapisan yang dipakai: VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance, yaitu rendering
harian produk NASA Black Marble VNP46A2 (radiance malam yang sudah dikoreksi bulan, atmosfer,
BRDF, dan diisi-celah saat berawan). GIBS menyajikannya sebagai PNG berpalet 8-bit di zoom 8
(sekitar 600 m per piksel). Tiap indeks palet mewakili satu rentang radiance, jadi nilainya
bisa dikembalikan ke nW/cm²/sr lewat colormap resmi (scripts/colormap_dnb.xml).

Batasnya: rentang paling atas adalah "38,2 ke atas", jadi inti kota yang sangat terang terpotong
di 38,2 nW/cm²/sr.
"""

from __future__ import annotations

import io
import math
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import requests
from PIL import Image

LAPISAN = "VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance"
URL_UBIN = (
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/"
    + LAPISAN
    + "/default/{tanggal}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png"
)
ZOOM = 8
UKURAN = 256
# kotak Indonesia + tetangga dekat di zoom 8
X_MIN, X_MAX = 195, 228
Y_MIN, Y_MAX = 123, 135
LEBAR = (X_MAX - X_MIN + 1) * UKURAN
TINGGI = (Y_MAX - Y_MIN + 1) * UKURAN
NILAI_POTONG = 38.2

AKAR = Path(__file__).resolve().parent.parent
CACHE = AKAR / "cache" / "gibs"
OLAH = AKAR / "cache" / "olah"

_lokal = threading.local()


def sesi() -> requests.Session:
    if not hasattr(_lokal, "s"):
        s = requests.Session()
        s.headers["User-Agent"] = "nightlights-from-space/1.0 (data pipeline)"
        _lokal.s = s
    return _lokal.s


def muat_lut() -> np.ndarray:
    """Indeks palet -> radiance tengah rentang (nW/cm²/sr). Indeks 0 = tanpa data (NaN)."""
    xml = (Path(__file__).parent / "colormap_dnb.xml").read_text(encoding="utf-8")
    lut = np.full(256, np.nan, dtype=np.float32)
    pola = re.compile(r'value="\[([-\d.]+),([-\d.]+)[\)\]]"[^>]*ref="(\d+)"')
    for a, b, ref in pola.findall(xml):
        a, b, ref = float(a), float(b), int(ref)
        if ref == 0:
            continue
        lut[ref] = NILAI_POTONG if b > 1000 else (a + b) / 2
    return lut


def lon_ke_px(lon: float | np.ndarray) -> float | np.ndarray:
    """Bujur -> kolom piksel di mosaik (bisa pecahan)."""
    return (lon + 180.0) / 360.0 * (2**ZOOM) * UKURAN - X_MIN * UKURAN


def lat_ke_px(lat: float | np.ndarray) -> float | np.ndarray:
    lat_r = np.radians(lat)
    y = (1 - np.log(np.tan(lat_r) + 1 / np.cos(lat_r)) / math.pi) / 2
    return y * (2**ZOOM) * UKURAN - Y_MIN * UKURAN


def px_ke_lat(py: float | np.ndarray) -> float | np.ndarray:
    y = (py + Y_MIN * UKURAN) / ((2**ZOOM) * UKURAN)
    return np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * y))))


def px_ke_lon(px: float | np.ndarray) -> float | np.ndarray:
    return (px + X_MIN * UKURAN) / ((2**ZOOM) * UKURAN) * 360.0 - 180.0


def luas_piksel_km2() -> np.ndarray:
    """Luas tiap baris piksel (km²), satu nilai per baris mosaik."""
    lat = px_ke_lat(np.arange(TINGGI) + 0.5)
    sisi = 40075.016686 / ((2**ZOOM) * UKURAN) * np.cos(np.radians(lat))
    return (sisi * sisi).astype(np.float64)


def ambil_ubin(tanggal: str, x: int, y: int, coba: int = 5) -> bytes | None:
    """Unduh satu ubin (dengan cache di disk). None kalau tanggal itu tidak tersedia."""
    berkas = CACHE / tanggal / f"{x}_{y}.png"
    if berkas.exists():
        isi = berkas.read_bytes()
        return isi or None
    url = URL_UBIN.format(tanggal=tanggal, z=ZOOM, x=x, y=y)
    for i in range(coba):
        try:
            r = sesi().get(url, timeout=40)
            if r.status_code == 200 and r.content[:4] == b"\x89PNG":
                berkas.parent.mkdir(parents=True, exist_ok=True)
                berkas.write_bytes(r.content)
                return r.content
            if r.status_code in (400, 404):
                berkas.parent.mkdir(parents=True, exist_ok=True)
                berkas.write_bytes(b"")
                return None
        except requests.RequestException:
            pass
        time.sleep(1.5 * (i + 1))
    # server terus menolak (biasanya 5xx untuk tanggal yang datanya bolong): anggap ubin ini tanpa
    # data untuk kali ini saja, tanpa menulis penanda kosong, supaya dicoba lagi di lain waktu
    print(f"  lewati ubin {tanggal} {x},{y}: server tidak memberi PNG", flush=True)
    return None


def ubin_ke_indeks(isi: bytes | None) -> np.ndarray:
    if not isi:
        return np.zeros((UKURAN, UKURAN), dtype=np.uint8)
    im = Image.open(io.BytesIO(isi))
    if im.mode != "P":
        # ubin di tepi sapuan yang datanya bolong kadang datang sebagai RGBA/LA tanpa palet:
        # isinya tidak bisa dipetakan ke radiance, jadi dianggap tanpa data
        return np.zeros((UKURAN, UKURAN), dtype=np.uint8)
    return np.asarray(im, dtype=np.uint8)


def ambil_mosaik(
    tanggal: str,
    x0: int = X_MIN,
    x1: int = X_MAX,
    y0: int = Y_MIN,
    y1: int = Y_MAX,
    pekerja: int = 24,
) -> np.ndarray:
    """Mosaik indeks palet (uint8) untuk satu tanggal dan satu kotak ubin."""
    daftar = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    hasil = np.zeros(((y1 - y0 + 1) * UKURAN, (x1 - x0 + 1) * UKURAN), dtype=np.uint8)

    def kerja(xy: tuple[int, int]) -> None:
        x, y = xy
        a = ubin_ke_indeks(ambil_ubin(tanggal, x, y))
        hasil[(y - y0) * UKURAN : (y - y0 + 1) * UKURAN, (x - x0) * UKURAN : (x - x0 + 1) * UKURAN] = a

    with ThreadPoolExecutor(pekerja) as ex:
        list(ex.map(kerja, daftar))
    return hasil


def kotak_ubin(barat: float, selatan: float, timur: float, utara: float) -> tuple[int, int, int, int]:
    """Kotak lon/lat -> rentang ubin zoom 8 (x0, x1, y0, y1)."""
    n = 2**ZOOM
    x0 = int((barat + 180) / 360 * n)
    x1 = int((timur + 180) / 360 * n)

    def ty(lat: float) -> int:
        r = math.radians(lat)
        return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)

    return x0, x1, ty(utara), ty(selatan)


def muat_komposit(tahun: int, koreksi: bool = True) -> np.ndarray:
    """Komposit tahunan (float32, NaN jadi 0). Dengan koreksi: dikurangi latar tahun itu.

    Tingkat latar (rata-rata radiance daratan yang selalu gelap) bergeser dari tahun ke tahun,
    antara 0,06 dan 0,21 nW/cm²/sr. Tanpa dikurangi, pergeseran sekecil itu sudah cukup menggeser
    piksel redup melewati ambang terang. Angkanya dihitung scripts/latar.py.
    """
    import json

    a = np.nan_to_num(np.load(OLAH / f"komposit_{tahun}.npy").astype(np.float32), nan=0.0)
    if koreksi:
        latar = json.loads((OLAH / "latar.json").read_text())
        a = np.clip(a - latar[str(tahun)], 0, None)
    return a


def tahun_tersedia() -> list[int]:
    return sorted(int(p.stem.split("_")[1]) for p in OLAH.glob("komposit_*.npy"))
