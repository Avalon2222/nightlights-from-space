"""Rakit berkas yang dibaca aplikasi dari CSV di data/ dan komposit di cache/.

Keluaran:
  - public/data/statistik.json   deret tahunan nasional, 38 provinsi, 514 kabupaten/kota
  - public/data/sorotan.json     deret tahunan titik pembangunan baru (kalau komposit tersedia)
  - src/lib/gibsNilai.json       tingkat abu ubin GIBS (0..255) -> radiance, untuk mode harian
  - data/ringkasan_provinsi.csv, data/hotspot_tahunan.csv, data/kejadian_padam.csv
                                 tabel rapi untuk dipakai di luar aplikasi (satu baris per provinsi-tahun, dst.)
"""

from __future__ import annotations

import csv
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path

import numpy as np

import gibs

DATA = gibs.AKAR / "data"
PUBLIK = gibs.AKAR / "public" / "data"
AMBANG = 1.0


def baca(nama: str) -> list[dict]:
    with (DATA / nama).open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def bulat(x: float, n: int = 1) -> float:
    return round(float(x), n)


def statistik() -> dict:
    nasional = baca("cahaya_nasional.csv")
    tahun = [int(r["tahun"]) for r in nasional]
    pos = {t: i for i, t in enumerate(tahun)}

    pln: dict[str, list] = defaultdict(lambda: [None] * len(tahun))
    for r in baca("listrik_pln_provinsi.csv"):
        if int(r["tahun"]) in pos:
            pln[r["kode_prov"]][pos[int(r["tahun"])]] = float(r["persen_rt_pln"])
    penduduk: dict[str, list] = defaultdict(lambda: [None] * len(tahun))
    for r in baca("penduduk_provinsi.csv"):
        if int(r["tahun"]) in pos:
            penduduk[r["kode_prov"]][pos[int(r["tahun"])]] = int(r["penduduk"])
    pdrb = {r["kode_prov"]: {"tahun": int(r["tahun"]), "berlaku": float(r["pdrb_berlaku_miliar"]), "konstan": float(r["pdrb_konstan2010_miliar"])} for r in baca("pdrb_provinsi.csv")}

    kab = baca("kabupaten.csv")
    luas_prov: dict[str, float] = defaultdict(float)
    for k in kab:
        luas_prov[k["kode_prov"]] += float(k["luas_km2"])

    prov: dict[str, dict] = {}
    for r in baca("cahaya_provinsi.csv"):
        p = prov.setdefault(
            r["kode_prov"],
            {"kode": r["kode_prov"], "nama": r["provinsi"], "luasKm2": bulat(luas_prov[r["kode_prov"]], 0), "cahaya": [0.0] * len(tahun), "luasTerang": [0.0] * len(tahun)},
        )
        p["cahaya"][pos[int(r["tahun"])]] = bulat(r["cahaya"], 0)
        p["luasTerang"][pos[int(r["tahun"])]] = bulat(r["luas_terang_km2"], 0)
    for kode, p in prov.items():
        p["penduduk"] = penduduk[kode]
        p["pln"] = pln[kode]
        p["pdrb"] = pdrb.get(kode)

    kabupaten: dict[str, dict] = {
        k["kode"]: {"kode": k["kode"], "nama": k["nama"], "prov": k["kode_prov"], "penduduk2020": int(k["penduduk_2020"]), "luasKm2": bulat(k["luas_km2"], 0), "cahaya": [0.0] * len(tahun), "luasTerang": [0.0] * len(tahun)}
        for k in kab
    }
    for r in baca("cahaya_kabupaten.csv"):
        k = kabupaten[r["kode"]]
        k["cahaya"][pos[int(r["tahun"])]] = bulat(r["cahaya"], 0)
        k["luasTerang"][pos[int(r["tahun"])]] = bulat(r["luas_terang_km2"], 0)

    total_penduduk = [sum(penduduk[k][i] for k in prov) for i in range(len(tahun))]
    return {
        "dibuat": dt.date.today().isoformat(),
        "tahun": tahun,
        "sampel": [{"jumlah": int(r["jumlah_sampel"]), "pertama": r["sampel_pertama"], "terakhir": r["sampel_terakhir"]} for r in nasional],
        "ambang": AMBANG,
        "potong": None,
        "nasional": {
            "cahaya": [bulat(r["cahaya"], 0) for r in nasional],
            "luasTerang": [bulat(r["luas_terang_km2"], 0) for r in nasional],
            "penduduk": total_penduduk,
            "pln": pln["00"],
        },
        "provinsi": sorted(prov.values(), key=lambda p: p["kode"]),
        "kabupaten": sorted(kabupaten.values(), key=lambda k: k["kode"]),
    }


def sorotan(tahun: list[int]) -> list[dict]:
    daftar = json.loads((DATA / "sorotan.json").read_text(encoding="utf-8"))
    luas_baris = gibs.luas_piksel_km2()
    komposit = {t: gibs.muat_komposit(t) for t in tahun}
    hasil = []
    for s in daftar:
        barat, selatan, timur, utara = s["kotak"]
        x0, x1 = int(gibs.lon_ke_px(barat)), int(np.ceil(gibs.lon_ke_px(timur)))
        y0, y1 = int(gibs.lat_ke_px(utara)), int(np.ceil(gibs.lat_ke_px(selatan)))
        luas = np.broadcast_to(luas_baris[y0:y1, None], (y1 - y0, x1 - x0))
        cahaya, terang, puncak = [], [], []
        for t in tahun:
            a = komposit[t][y0:y1, x0:x1]
            m = a >= AMBANG
            cahaya.append(bulat((a[m] * luas[m]).sum(), 1))
            terang.append(bulat(luas[m].sum(), 1))
            puncak.append(bulat(a.max(), 1))
        hasil.append({**s, "pusat": [bulat((barat + timur) / 2, 4), bulat((selatan + utara) / 2, 4)], "cahaya": cahaya, "luasTerang": terang, "puncak": puncak})
    return hasil


def nilai_gibs() -> list[float]:
    """Tingkat abu (R=G=B) di ubin GIBS -> radiance tengah rentang. 0 = bukan warna palet."""
    xml = (Path(__file__).parent / "colormap_dnb.xml").read_text(encoding="utf-8")
    hasil = [0.0] * 256
    for abu, a, b in re.findall(r'rgb="(\d+),\d+,\d+" transparent="false"[^>]*value="\[([-\d.]+),([-\d.]+)[\)\]]"', xml):
        a, b = float(a), float(b)
        hasil[int(abu)] = gibs.NILAI_POTONG if b > 1000 else round((a + b) / 2, 2)
    return hasil


def tulis_csv(nama: str, kepala: list[str], baris: list[list]) -> None:
    with (DATA / nama).open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(kepala)
        w.writerows(baris)


def tabel_rapi(s: dict) -> None:
    """Tabel siap pakai: gabungan cahaya, listrik PLN, dan penduduk per provinsi-tahun, plus hotspot dan kejadian."""
    baris = []
    for p in s["provinsi"]:
        for i, t in enumerate(s["tahun"]):
            penduduk = p["penduduk"][i]
            baris.append([
                p["kode"], p["nama"], t, p["cahaya"][i], p["luasTerang"][i],
                round(p["luasTerang"][i] / p["luasKm2"] * 100, 2) if p["luasKm2"] else "",
                "" if p["pln"][i] is None else p["pln"][i], penduduk,
                round(p["cahaya"][i] / penduduk * 1000, 3) if penduduk else "",
            ])
    tulis_csv("ringkasan_provinsi.csv", ["kode_prov", "provinsi", "tahun", "cahaya", "luas_terang_km2", "persen_wilayah_terang", "persen_rt_pln", "penduduk", "cahaya_per_1000_penduduk"], baris)

    sorotan_json = PUBLIK / "sorotan.json"
    if sorotan_json.exists():
        baris = [[x["id"], x["judul"], x["lokasi"], t, x["cahaya"][i], x["luasTerang"][i]] for x in json.loads(sorotan_json.read_text(encoding="utf-8")) for i, t in enumerate(s["tahun"])]
        tulis_csv("hotspot_tahunan.csv", ["id", "hotspot", "lokasi", "tahun", "cahaya", "luas_terang_km2"], baris)

    kejadian_json = PUBLIK / "kejadian.json"
    if kejadian_json.exists():
        baris = [
            [k["id"], k["judul"], k["tanggal"], k["jenis"], k["lokasi"], k["terendah"]["indeks"], k["terendah"]["hari"], "" if k["hariPulih"] is None else k["hariPulih"], k["luasTerangKm2"]]
            for k in json.loads(kejadian_json.read_text(encoding="utf-8"))
        ]
        tulis_csv("kejadian_padam.csv", ["id", "kejadian", "tanggal", "jenis", "lokasi", "indeks_terendah", "hari_terendah", "hari_pulih", "luas_terang_km2"], baris)


def main() -> None:
    PUBLIK.mkdir(parents=True, exist_ok=True)
    s = statistik()
    (PUBLIK / "statistik.json").write_text(json.dumps(s, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("statistik:", len(s["tahun"]), "tahun,", len(s["provinsi"]), "provinsi,", len(s["kabupaten"]), "kabupaten/kota")
    if all((gibs.OLAH / f"komposit_{t}.npy").exists() for t in s["tahun"]):
        sr = sorotan(s["tahun"])
        (PUBLIK / "sorotan.json").write_text(json.dumps(sr, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        for x in sr:
            print("  ", x["id"], x["cahaya"])
    (gibs.AKAR / "src" / "lib" / "gibsNilai.json").write_text(json.dumps(nilai_gibs()), encoding="utf-8")
    tabel_rapi(s)


if __name__ == "__main__":
    main()
