"""Tes untuk jalur data resmi (HDF5 dari NASA LAADS). Tidak ada yang menyentuh jaringan."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import ambil_laads  # noqa: E402
import gibs  # noqa: E402
import komposit_laads as kl  # noqa: E402


class TestDaftarUbin:
    def test_delapan_belas_ubin_menutup_indonesia(self):
        assert len(ambil_laads.UBIN) == 18
        assert "h27v08" in ambil_laads.UBIN and "h32v10" in ambil_laads.UBIN
        # mosaik sumber harus lebih luas dari grid peta di semua sisi
        barat, timur = gibs.px_ke_lon(0), gibs.px_ke_lon(gibs.LEBAR)
        utara, selatan = gibs.px_ke_lat(0), gibs.px_ke_lat(gibs.TINGGI)
        assert kl.BARAT <= barat and timur <= -180 + (kl.H_MAX + 1) * 10
        assert kl.UTARA >= utara and selatan >= 90 - (kl.V_MAX + 1) * 10

    def test_hanya_berkas_h5_di_kotak_indonesia(self, monkeypatch):
        isi = [
            {"name": "VNP46A4.A2023001.h28v09.002.2025162082424.h5", "size": 1},
            {"name": "VNP46A4.A2023001.h10v04.002.2025162082424.h5", "size": 1},
            {"name": "VNP46A4.A2023001.h28v09.002.2025162082424.h5.xml", "size": 1},
        ]
        monkeypatch.setattr(ambil_laads, "daftar", lambda produk, jalur: isi)
        assert [b["name"] for b in ambil_laads.berkas_indonesia("VNP46A4", "2023/001")] == [isi[0]["name"]]


class TestToken:
    def test_dibaca_dari_lingkungan(self, monkeypatch):
        monkeypatch.setenv("EARTHDATA_TOKEN", "abc.def")
        assert ambil_laads.token() == "abc.def"

    def test_tanpa_token_berhenti_dengan_pesan(self, monkeypatch, tmp_path):
        monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
        monkeypatch.setattr(gibs, "AKAR", tmp_path)
        with pytest.raises(SystemExit, match="EARTHDATA_TOKEN"):
            ambil_laads.token()

    def test_dibaca_dari_env_local(self, monkeypatch, tmp_path):
        monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
        monkeypatch.setattr(gibs, "AKAR", tmp_path)
        (tmp_path / ".env.local").write_text('# catatan\nEARTHDATA_TOKEN="xyz"\n', encoding="utf-8")
        assert ambil_laads.token() == "xyz"


class TestRegrid:
    def test_nilai_rata_tetap_dan_tidak_ada_lubang(self):
        kolom, baris = kl.indeks_tujuan()
        sumber = np.full(((kl.V_MAX - kl.V_MIN + 1) * kl.PIKSEL, (kl.H_MAX - kl.H_MIN + 1) * kl.PIKSEL), 7.0, dtype=np.float32)
        hasil = kl.ke_mercator(sumber, kolom, baris)
        assert hasil.shape == (gibs.TINGGI, gibs.LEBAR)
        assert not np.isnan(hasil).any()
        assert hasil.min() == pytest.approx(7.0) and hasil.max() == pytest.approx(7.0)

    def test_titik_terang_jatuh_di_lokasi_yang_benar(self):
        kolom, baris = kl.indeks_tujuan()
        sumber = np.zeros(((kl.V_MAX - kl.V_MIN + 1) * kl.PIKSEL, (kl.H_MAX - kl.H_MIN + 1) * kl.PIKSEL), dtype=np.float32)
        lon, lat = 106.8, -6.2  # Jakarta
        langkah = 10.0 / kl.PIKSEL
        sumber[int((kl.UTARA - lat) / langkah), int((lon - kl.BARAT) / langkah)] = 900.0
        hasil = kl.ke_mercator(sumber, kolom, baris)
        y, x = np.unravel_index(np.argmax(hasil), hasil.shape)
        # titik uji ada di tepi piksel sumber, jadi toleransinya satu setengah piksel tujuan
        assert abs(x - gibs.lon_ke_px(lon)) <= 1.5 and abs(y - gibs.lat_ke_px(lat)) <= 1.5
        # tidak terpotong di batas GIBS
        assert hasil.max() > gibs.NILAI_POTONG

    def test_piksel_tanpa_data_tidak_ikut_dirata_rata(self):
        kolom, baris = kl.indeks_tujuan()
        sumber = np.full(((kl.V_MAX - kl.V_MIN + 1) * kl.PIKSEL, (kl.H_MAX - kl.H_MIN + 1) * kl.PIKSEL), np.nan, dtype=np.float32)
        sumber[::2, ::2] = 4.0
        hasil = kl.ke_mercator(sumber, kolom, baris)
        assert np.nanmax(hasil) == pytest.approx(4.0)
        assert np.nanmin(hasil) == pytest.approx(4.0)

    def test_akhir_bulan(self):
        assert kl.akhir_bulan(2024, 2) == "2024-02-29"
        assert kl.akhir_bulan(2026, 10) == "2026-10-31"
