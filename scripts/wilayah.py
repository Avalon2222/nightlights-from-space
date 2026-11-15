"""Siapkan batas wilayah: 514 kabupaten/kota dan 38 provinsi.

Masukan (diunduh otomatis ke data/sumber/ kalau belum ada):
  - geoBoundaries IDN ADM2 (asal: BPS lewat OCHA/HDX, CC BY 3.0 IGO)
  - COD-PS Indonesia 2020 (proyeksi penduduk BPS per kabupaten/kota, lewat UNFPA/HDX)

Keluaran:
  - data/kabupaten.csv            kode, nama, kode_prov, provinsi, penduduk_2020
  - cache/olah/label_kab.npy      raster label di grid mosaik zoom 8 (0 = luar wilayah)
  - cache/olah/kab_mentah.geojson batas + properti, bahan untuk mapshaper (lihat scripts/sederhanakan.sh)
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageDraw

import gibs

SUMBER = gibs.AKAR / "data" / "sumber"
URL_BATAS = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson"
URL_PENDUDUK = "https://data.humdata.org/dataset/7e00297b-7b5b-4a98-932d-509f298fd8a8/resource/8f6f09d2-95f7-42dc-b6f1-aead319607f3/download/idn_admpop_adm2_2020_v3.csv"

# kode provinsi mengikuti Kemendagri (sama dengan repo follow-the-money)
PROVINSI = {
    "11": "Aceh", "12": "Sumatera Utara", "13": "Sumatera Barat", "14": "Riau", "15": "Jambi",
    "16": "Sumatera Selatan", "17": "Bengkulu", "18": "Lampung", "19": "Kepulauan Bangka Belitung",
    "21": "Kepulauan Riau", "31": "DKI Jakarta", "32": "Jawa Barat", "33": "Jawa Tengah",
    "34": "DI Yogyakarta", "35": "Jawa Timur", "36": "Banten", "51": "Bali",
    "52": "Nusa Tenggara Barat", "53": "Nusa Tenggara Timur", "61": "Kalimantan Barat",
    "62": "Kalimantan Tengah", "63": "Kalimantan Selatan", "64": "Kalimantan Timur",
    "65": "Kalimantan Utara", "71": "Sulawesi Utara", "72": "Sulawesi Tengah",
    "73": "Sulawesi Selatan", "74": "Sulawesi Tenggara", "75": "Gorontalo", "76": "Sulawesi Barat",
    "81": "Maluku", "82": "Maluku Utara", "91": "Papua", "92": "Papua Barat",
    "93": "Papua Selatan", "94": "Papua Tengah", "95": "Papua Pegunungan", "96": "Papua Barat Daya",
}

# pemekaran Papua 2022: kabupaten -> provinsi baru
PAPUA_SELATAN = {"Merauke", "Boven Digoel", "Mappi", "Asmat"}
PAPUA_TENGAH = {"Nabire", "Paniai", "Mimika", "Puncak Jaya", "Puncak", "Dogiyai", "Intan Jaya", "Deiyai"}
PAPUA_PEGUNUNGAN = {"Jayawijaya", "Pegunungan Bintang", "Yahukimo", "Tolikara", "Mamberamo Tengah", "Yalimo", "Lanny Jaya", "Nduga"}
PAPUA_BARAT_DAYA = {"Kota Sorong", "Sorong", "Sorong Selatan", "Raja Ampat", "Tambrauw", "Maybrat"}

BUKAN_WILAYAH = {"Danau", "Danau Toba", "Hutan", "Waduk Cirata", "Wadung Kedungombo"}


def kode_provinsi(pcode_adm1: str, nama_kab: str) -> str:
    """Kode provinsi 38 dari kode BPS 2020 (34 provinsi) + nama kabupaten."""
    kode = pcode_adm1[2:]
    if kode == "94":  # Papua lama
        if nama_kab in PAPUA_SELATAN:
            return "93"
        if nama_kab in PAPUA_TENGAH:
            return "94"
        if nama_kab in PAPUA_PEGUNUNGAN:
            return "95"
        return "91"
    if kode == "91":  # Papua Barat lama
        return "96" if nama_kab in PAPUA_BARAT_DAYA else "92"
    return kode


def kunci(nama: str) -> str:
    return nama.lower().replace(" ", "").replace("-", "").replace(".", "")


def unduh(url: str, tujuan: Path) -> Path:
    if not tujuan.exists():
        tujuan.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(url, timeout=300)
        r.raise_for_status()
        tujuan.write_bytes(r.content)
    return tujuan


def muat_kabupaten() -> list[dict]:
    """Daftar kabupaten/kota (urut kode) berikut geometri mentahnya."""
    batas = json.loads(unduh(URL_BATAS, gibs.AKAR / "cache" / "sumber" / "gb_adm2_simplified.geojson").read_text(encoding="utf-8"))
    penduduk = {}
    with unduh(URL_PENDUDUK, SUMBER / "penduduk_adm2_2020.csv").open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            penduduk[kunci(r["ADM2_EN"])] = r
    hasil = []
    for fitur in batas["features"]:
        nama = fitur["properties"]["shapeName"]
        if nama in BUKAN_WILAYAH:
            continue
        p = penduduk[kunci(nama)]
        kp = kode_provinsi(p["ADM1_PCODE"], nama)
        hasil.append(
            {
                "kode": p["ADM2_PCODE"][2:],
                "nama": nama,
                "kode_prov": kp,
                "provinsi": PROVINSI[kp],
                "penduduk_2020": int(p["T_TL"]),
                "geometry": fitur["geometry"],
            }
        )
    hasil.sort(key=lambda k: k["kode"])
    return hasil


def cincin(geometri: dict):
    """Semua cincin poligon: (luar, [lubang...])."""
    polys = geometri["coordinates"] if geometri["type"] == "MultiPolygon" else [geometri["coordinates"]]
    for poly in polys:
        yield poly[0], poly[1:]


def raster_label(kab: list[dict]) -> np.ndarray:
    """Label kabupaten (1..n) per piksel mosaik; pesisir dilebarkan 3 piksel (~2 km).

    Batasnya versi sederhana dan cahaya kota pesisir sering "tumpah" ke laut, jadi piksel laut
    yang menempel daratan ikut dihitung ke kabupaten terdekat.
    """
    gambar = Image.new("I", (gibs.LEBAR, gibs.TINGGI), 0)
    pena = ImageDraw.Draw(gambar)
    for i, k in enumerate(kab, start=1):
        for luar, lubang in cincin(k["geometry"]):
            a = np.asarray(luar, dtype=np.float64)
            titik = list(zip(gibs.lon_ke_px(a[:, 0]).tolist(), gibs.lat_ke_px(a[:, 1]).tolist()))
            if len(titik) >= 3:
                pena.polygon(titik, fill=i)
            for lb in lubang:
                b = np.asarray(lb, dtype=np.float64)
                tb = list(zip(gibs.lon_ke_px(b[:, 0]).tolist(), gibs.lat_ke_px(b[:, 1]).tolist()))
                if len(tb) >= 3:
                    pena.polygon(tb, fill=0)
    label = np.asarray(gambar, dtype=np.int32).astype(np.int16)
    for _ in range(3):
        kosong = label == 0
        tetangga = np.zeros_like(label)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            geser = np.roll(label, (dy, dx), axis=(0, 1))
            tetangga = np.where((tetangga == 0) & (geser > 0), geser, tetangga)
        label = np.where(kosong, tetangga, label)
    return label


def main() -> None:
    kab = muat_kabupaten()
    print(len(kab), "kabupaten/kota,", len({k["kode_prov"] for k in kab}), "provinsi")
    (gibs.AKAR / "data").mkdir(exist_ok=True)
    with (gibs.AKAR / "data" / "kabupaten.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["kode", "nama", "kode_prov", "provinsi", "penduduk_2020"])
        for k in kab:
            w.writerow([k["kode"], k["nama"], k["kode_prov"], k["provinsi"], k["penduduk_2020"]])
    gibs.OLAH.mkdir(parents=True, exist_ok=True)
    label = raster_label(kab)
    np.save(gibs.OLAH / "label_kab.npy", label)
    print("piksel berlabel:", int((label > 0).sum()))
    mentah = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"kode": k["kode"], "nama": k["nama"], "kode_prov": k["kode_prov"], "provinsi": k["provinsi"]},
                "geometry": k["geometry"],
            }
            for k in kab
        ],
    }
    (gibs.OLAH / "kab_mentah.geojson").write_text(json.dumps(mentah), encoding="utf-8")


if __name__ == "__main__":
    main()
