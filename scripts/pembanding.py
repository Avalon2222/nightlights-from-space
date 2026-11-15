"""Kumpulkan data pembanding per provinsi: listrik PLN, penduduk, PDRB.

Sumber:
  - BPS, tabel statis "Persentase Rumah Tangga menurut Provinsi dan Sumber Penerangan Listrik PLN,
    1993-2022" (Susenas) -> 2012-2022
  - BPS, tabel dinamis variabel 87 (judul sama) -> 2023, 2024 (disalin dari halaman, lihat
    data/sumber/bps_pln_2023_2024.csv) dan 2025 (tertanam di HTML halaman)
  - Wikipedia "2020 Indonesian census" (mengutip BPS) -> penduduk SP2010 dan SP2020 per provinsi
  - BPS, proyeksi pertengahan 2025 per provinsi (dari repo follow-the-money) dan COD-PS 2020 per
    kabupaten (untuk memecah Papua ke enam provinsi)
  - BPS, tabel dinamis variabel 286 "[Seri 2010] Produk Domestik Regional Bruto" -> PDRB 2025

Keluaran: data/listrik_pln_provinsi.csv, data/penduduk_provinsi.csv, data/pdrb_provinsi.csv
"""

from __future__ import annotations

import csv
import html
import json
import re
from pathlib import Path

import requests

import gibs
from wilayah import PROVINSI

DATA = gibs.AKAR / "data"
SUMBER = DATA / "sumber"
CACHE = gibs.AKAR / "cache" / "sumber"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"}

URL_PLN_STATIS = "https://www.bps.go.id/id/statistics-table/1/MTU1NSMx/persentase-rumah-tangga-menurut-provinsi-dan-sumber-penerangan-listrik-pln-1993-2021.html"
URL_PLN_DINAMIS = "https://www.bps.go.id/id/statistics-table/2/ODcjMg==/persentase-rumah-tangga-dengan-sumber-penerangan-listrik-pln--persen-.html"
URL_PDRB = "https://www.bps.go.id/id/statistics-table/2/Mjg2IzI=/-seri-2010--produk-domestik-regional-bruto---milyar-rupiah-.html"
URL_SENSUS = "https://en.wikipedia.org/w/api.php?action=parse&page=2020_Indonesian_census&prop=wikitext&format=json&formatversion=2"

TAHUN_AWAL, TAHUN_AKHIR = 2012, 2026

NAMA_KE_KODE = {re.sub(r"[^A-Z]", "", v.upper()): k for k, v in PROVINSI.items()}
NAMA_KE_KODE.update({"KEPBANGKABELITUNG": "19", "KEPRIAU": "21", "DAERAHISTIMEWAYOGYAKARTA": "34", "BANGKABELITUNG": "19"})
INGGRIS = {
    "Aceh": "11", "North Sumatra": "12", "West Sumatra": "13", "Riau": "14", "Jambi": "15", "South Sumatra": "16",
    "Bengkulu": "17", "Lampung": "18", "Bangka Belitung": "19", "Riau Islands": "21", "Jakarta": "31",
    "West Java": "32", "Central Java": "33", "Yogyakarta": "34", "Special Region of Yogyakarta": "34", "East Java": "35", "Banten": "36", "Bali": "51",
    "West Nusa Tenggara": "52", "East Nusa Tenggara": "53", "West Kalimantan": "61", "Central Kalimantan": "62",
    "South Kalimantan": "63", "East Kalimantan": "64", "North Kalimantan": "65", "North Sulawesi": "71",
    "Central Sulawesi": "72", "South Sulawesi": "73", "Southeast Sulawesi": "74", "Gorontalo": "75",
    "West Sulawesi": "76", "Maluku": "81", "North Maluku": "82", "West Papua": "92", "Papua": "91",
}
# provinsi hasil pemekaran 2022 -> provinsi induknya
INDUK = {"93": "91", "94": "91", "95": "91", "96": "92"}


def kode_dari_nama(nama: str) -> str | None:
    return NAMA_KE_KODE.get(re.sub(r"[^A-Z]", "", nama.upper()))


def halaman(url: str, nama: str) -> str:
    berkas = CACHE / nama
    if not berkas.exists():
        berkas.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(url, headers=UA, timeout=90)
        r.raise_for_status()
        berkas.write_text(r.text, encoding="utf-8")
    return berkas.read_text(encoding="utf-8")


def json_tertanam(s: str, kunci: str):
    """Ambil nilai JSON `"kunci": ...` dari payload Next.js yang di-escape di HTML BPS."""
    s = s.replace('\\"', '"')
    i = s.find(f'"{kunci}":')
    if i < 0:
        raise KeyError(kunci)
    j = awal = i + len(kunci) + 3
    dalam = 0
    while j < len(s):
        c = s[j]
        if c in "{[":
            dalam += 1
        elif c in "}]":
            dalam -= 1
            if dalam == 0:
                j += 1
                break
        j += 1
    return json.loads(s[awal:j])


def tabel_statis(s: str) -> list[list[str]]:
    s = s.replace("\\u003c", "<").replace("\\u003e", ">").replace("\\u0026", "&").replace("\\r\\n", " ")
    baris = re.findall(r"<tr[^>]*>(.*?)</tr>", s, flags=re.S | re.I)
    hasil = []
    for b in baris:
        sel = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", b, flags=re.S | re.I)]
        if sel:
            hasil.append(sel)
    return hasil


def listrik_pln() -> dict[tuple[str, int], float]:
    """(kode_prov, tahun) -> persen rumah tangga dengan penerangan utama listrik PLN."""
    hasil: dict[tuple[str, int], float] = {}
    tabel = tabel_statis(halaman(URL_PLN_STATIS, "bps_pln_statis.html"))
    kepala = next(b for b in tabel if b[0] == "Provinsi")
    # kolom berbintang = backcasting dengan penimbang baru; itu yang nyambung ke tahun-tahun sesudahnya
    kolom: dict[int, int] = {}
    for i, k in enumerate(kepala[1:], start=1):
        tahun = int(k.rstrip("*"))
        if k.endswith("*") or tahun not in kolom:
            kolom[tahun] = i
    for b in tabel:
        kode = kode_dari_nama(b[0]) if b[0] != "Total" else "00"
        if not kode or len(b) < len(kepala):
            continue
        for tahun, i in kolom.items():
            if tahun >= TAHUN_AWAL:
                try:
                    hasil[(kode, tahun)] = float(b[i])
                except ValueError:
                    pass
    with (SUMBER / "bps_pln_2023_2024.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            kode = "00" if r["provinsi"] == "INDONESIA" else kode_dari_nama(r["provinsi"])
            for tahun in (2023, 2024):
                if r[str(tahun)]:
                    hasil[(kode, tahun)] = float(r[str(tahun)])
    dinamis = halaman(URL_PLN_DINAMIS, "bps_pln_2025.html")
    tahun = int(json_tertanam(dinamis, "tahun")[0]["label"])
    kode_bps = peta_kode_bps(dinamis)
    for kunci, nilai in json_tertanam(dinamis, "datacontent").items():
        kode = kode_bps.get(kunci[:4])
        if kode:
            hasil[(kode, tahun)] = float(nilai)
    return hasil


def peta_kode_bps(s: str) -> dict[str, str]:
    """Kode wilayah BPS di tabel dinamis (mis. 9400) -> kode provinsi yang dipakai repo ini.

    BPS dan Kemendagri memberi nomor berbeda untuk provinsi-provinsi Papua, jadi dicocokkan lewat nama.
    """
    hasil = {}
    for v in json_tertanam(s, "vervar"):
        nama = str(v["label"])
        kode = "00" if nama.upper() == "INDONESIA" else kode_dari_nama(nama)
        if kode:
            hasil[str(v["val"])] = kode
    return hasil


def penduduk() -> dict[str, dict[int, float]]:
    """Penduduk per provinsi per tahun, diinterpolasi geometris dari SP2010, 2020, dan 2025."""
    berkas = CACHE / "wiki_sensus_2020.json"
    if not berkas.exists():
        berkas.write_text(requests.get(URL_SENSUS, headers={"User-Agent": "nightlights-data/1.0"}, timeout=60).text, encoding="utf-8")
    teks = json.loads(berkas.read_text(encoding="utf-8"))["parse"]["wikitext"]
    sp2010: dict[str, float] = {}
    sp2020: dict[str, float] = {}
    pola = re.compile(r"\|\s*\[\[(?:[^\]|]*\|)?([^\]|]+)\]\]\s*\|\|\s*([\d,]+)\s*\|\|\s*([\d,]+)")
    for nama, a, b in pola.findall(teks):
        if nama in INGGRIS:
            sp2010[INGGRIS[nama]] = float(a.replace(",", ""))
            sp2020[INGGRIS[nama]] = float(b.replace(",", ""))
    # Kalimantan Utara mekar dari Kalimantan Timur pada 2012; angka SP2010 Kaltim masih gabungan
    ada = re.search(r"\[\[North Kalimantan\]\][^\n]*\|\|\s*([\d,]+)\s*\|\|", teks)
    if ada:
        sp2020["65"] = float(ada.group(1).replace(",", ""))
        gabungan = sp2010["64"]
        sp2010["65"] = gabungan * sp2020["65"] / (sp2020["64"] + sp2020["65"])
        sp2010["64"] = gabungan - sp2010["65"]
    p2025: dict[str, float] = {}
    with (SUMBER / "penduduk_provinsi_2025.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            p2025[r["kode_bps"]] = float(r["penduduk_2025"])
    # Papua dan Papua Barat di kedua sensus masih wilayah lama: dibagi ke enam provinsi
    # menurut porsi penduduk 2025 (angka resmi pertama yang sudah per provinsi baru)
    porsi = p2025
    for induk in ("91", "92"):
        anggota = [induk] + [k for k, v in INDUK.items() if v == induk]
        total = sum(porsi[k] for k in anggota)
        lama10, lama20 = sp2010[induk], sp2020[induk]
        for k in anggota:
            sp2010[k] = lama10 * porsi[k] / total
            sp2020[k] = lama20 * porsi[k] / total
    p2020 = sp2020
    hasil: dict[str, dict[int, float]] = {}
    for kode in PROVINSI:
        titik = [(2010, sp2010[kode]), (2020, p2020[kode]), (2025, p2025[kode])]
        deret = {}
        for tahun in range(TAHUN_AWAL, TAHUN_AKHIR + 1):
            (t0, v0), (t1, v1) = (titik[0], titik[1]) if tahun <= 2020 else (titik[1], titik[2])
            deret[tahun] = v0 * (v1 / v0) ** ((tahun - t0) / (t1 - t0))
        hasil[kode] = deret
    return hasil


def pdrb() -> tuple[int, dict[str, tuple[float, float]]]:
    """PDRB tahun terbaru: kode -> (harga berlaku, harga konstan 2010), miliar rupiah."""
    s = halaman(URL_PDRB, "bps_pdrb.html")
    tahun = int(json_tertanam(s, "tahun")[0]["label"])
    isi = json_tertanam(s, "datacontent")
    hasil = {}
    for bps, kode in peta_kode_bps(s).items():
        if kode == "00":
            continue
        berlaku = isi.get(f"{bps}286530{tahun - 1900}0")
        konstan = isi.get(f"{bps}286531{tahun - 1900}0")
        if berlaku is not None and konstan is not None:
            hasil[kode] = (float(berlaku), float(konstan))
    return tahun, hasil


def main() -> None:
    pln = listrik_pln()
    with (DATA / "listrik_pln_provinsi.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["kode_prov", "provinsi", "tahun", "persen_rt_pln"])
        for (kode, tahun), v in sorted(pln.items()):
            w.writerow([kode, PROVINSI.get(kode, "Indonesia"), tahun, v])
    print("listrik PLN:", len(pln), "baris, tahun", sorted({t for _, t in pln}))

    pend = penduduk()
    with (DATA / "penduduk_provinsi.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["kode_prov", "provinsi", "tahun", "penduduk"])
        for kode, deret in pend.items():
            for tahun, v in deret.items():
                w.writerow([kode, PROVINSI[kode], tahun, round(v)])
    print("penduduk 2012:", round(sum(d[2012] for d in pend.values())), "| 2025:", round(sum(d[2025] for d in pend.values())))

    tahun, p = pdrb()
    with (DATA / "pdrb_provinsi.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["kode_prov", "provinsi", "tahun", "pdrb_berlaku_miliar", "pdrb_konstan2010_miliar"])
        for kode, (a, b) in sorted(p.items()):
            w.writerow([kode, PROVINSI[kode], tahun, a, b])
    print("PDRB", tahun, ":", len(p), "provinsi")


if __name__ == "__main__":
    main()
