"""Unduh Black Marble resmi (HDF5) dari NASA LAADS DAAC untuk kotak Indonesia.

  - VNP46A4: komposit tahunan, satu berkas per ubin 10° x 10° per tahun
  - VNP46A3: komposit bulanan, dipakai untuk tahun berjalan yang belum punya komposit tahunan

Berbeda dengan ubin GIBS, berkas ini menyimpan radiance sebagai angka pecahan tanpa batas atas,
jadi inti kota besar tidak terpotong di 38,2 nW/cm²/sr. Daftar berkas bisa dibaca siapa saja,
tetapi mengunduhnya butuh token NASA Earthdata (gratis): simpan sebagai EARTHDATA_TOKEN di
variabel lingkungan atau di berkas .env.local (tidak ikut ke Git).

Pakai:
    python scripts/ambil_laads.py --dari 2012 --sampai 2025          # tahunan
    python scripts/ambil_laads.py --bulanan 2026                     # bulanan untuk satu tahun
    python scripts/ambil_laads.py --dari 2012 --sampai 2025 --daftar # hanya hitung ukuran
Hasil: cache/laads/{produk}/{tahun}/{hari}/*.h5
"""

from __future__ import annotations

import argparse
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

import gibs

API = "https://ladsweb.modaps.eosdis.nasa.gov/api/v2/content/details/allData/5200/{produk}/{jalur}?formatStr=json"
# ubin sinusoidal 10 derajat yang menutup 90-150 BT dan 20 LS-10 LU
UBIN = tuple(f"h{h:02d}v{v:02d}" for v in (8, 9, 10) for h in range(27, 33))
CACHE = gibs.AKAR / "cache" / "laads"


def token() -> str:
    t = os.environ.get("EARTHDATA_TOKEN", "")
    env = gibs.AKAR / ".env.local"
    if not t and env.exists():
        for baris in env.read_text(encoding="utf-8").splitlines():
            if baris.strip().startswith("EARTHDATA_TOKEN="):
                t = baris.split("=", 1)[1].strip().strip('"').strip("'")
    if not t:
        raise SystemExit("EARTHDATA_TOKEN belum diisi (variabel lingkungan atau .env.local)")
    return t


def daftar(produk: str, jalur: str) -> list[dict]:
    """Isi satu folder di arsip LAADS (publik, tanpa token)."""
    for i in range(4):
        r = requests.get(API.format(produk=produk, jalur=jalur), timeout=90)
        if r.ok:
            isi = r.json()
            return isi.get("content", isi) if isinstance(isi, dict) else isi
        time.sleep(3 * (i + 1))
    r.raise_for_status()
    return []


def berkas_indonesia(produk: str, jalur: str) -> list[dict]:
    return [b for b in daftar(produk, jalur) if b.get("name", "").endswith(".h5") and any(f".{u}." in b["name"] for u in UBIN)]


def unduh(b: dict, folder: Path, kunci: str) -> Path:
    tujuan = folder / b["name"]
    if tujuan.exists() and tujuan.stat().st_size == int(b["size"]):
        return tujuan
    folder.mkdir(parents=True, exist_ok=True)
    sementara = tujuan.with_suffix(".bagian")
    for i in range(5):
        try:
            with requests.get(b["downloadsLink"], headers={"Authorization": f"Bearer {kunci}"}, stream=True, timeout=180) as r:
                if r.status_code in (401, 403):
                    raise SystemExit(f"LAADS menolak token ({r.status_code}). Token kedaluwarsa atau salah.")
                r.raise_for_status()
                if "html" in r.headers.get("content-type", ""):
                    raise SystemExit("LAADS mengirim halaman login, bukan berkas. Periksa tokennya.")
                with sementara.open("wb") as f:
                    for potong in r.iter_content(1 << 20):
                        f.write(potong)
            if sementara.stat().st_size == int(b["size"]):
                sementara.replace(tujuan)
                return tujuan
        except requests.RequestException:
            pass
        time.sleep(5 * (i + 1))
    raise RuntimeError(f"gagal mengunduh {b['name']}")


def folder_bulanan(tahun: int) -> list[str]:
    """Hari-ke dalam setahun yang punya komposit bulanan (001, 032, 060, ...)."""
    return sorted(x["name"] for x in daftar("VNP46A3", str(tahun)) if x.get("name", "").isdigit())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dari", type=int)
    ap.add_argument("--sampai", type=int)
    ap.add_argument("--bulanan", type=int, help="unduh VNP46A3 untuk tahun ini")
    ap.add_argument("--daftar", action="store_true", help="hanya tampilkan jumlah dan ukuran")
    args = ap.parse_args()

    pekerjaan: list[tuple[str, str]] = []
    if args.dari and args.sampai:
        pekerjaan += [("VNP46A4", f"{t}/001") for t in range(args.dari, args.sampai + 1)]
    if args.bulanan:
        pekerjaan += [("VNP46A3", f"{args.bulanan}/{h}") for h in folder_bulanan(args.bulanan)]

    kunci = "" if args.daftar else token()
    total = 0
    for produk, jalur in pekerjaan:
        berkas = berkas_indonesia(produk, jalur)
        ukuran = sum(int(b["size"]) for b in berkas)
        total += ukuran
        print(f"{produk} {jalur}: {len(berkas)} berkas, {ukuran / 1e6:.0f} MB", flush=True)
        if args.daftar or not berkas:
            continue
        folder = CACHE / produk / jalur
        with ThreadPoolExecutor(4) as ex:
            list(ex.map(lambda b: unduh(b, folder, kunci), berkas))
    print(f"total {total / 1e9:.1f} GB")


if __name__ == "__main__":
    main()
