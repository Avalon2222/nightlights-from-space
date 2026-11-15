"""Tes untuk skrip pipeline data. Tidak ada yang menyentuh jaringan."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import gibs  # noqa: E402
import kejadian  # noqa: E402
import palet  # noqa: E402
import pembanding  # noqa: E402
import statistik  # noqa: E402
import ubin  # noqa: E402
import wilayah  # noqa: E402


class TestGibs:
    def test_lut_punya_180_rentang_dan_mentok_di_batas(self):
        lut = gibs.muat_lut()
        assert np.isfinite(lut).sum() == 180
        assert np.isnan(lut[0])
        assert lut[1] == pytest.approx(0.05)
        assert lut[180] == pytest.approx(gibs.NILAI_POTONG)
        terisi = lut[1:181]
        assert (np.diff(terisi) >= 0).all()

    def test_piksel_dan_koordinat_bolak_balik(self):
        for lon, lat in [(95.3, 5.5), (106.8, -6.2), (140.7, -2.5), (123.6, -10.2)]:
            assert gibs.px_ke_lon(gibs.lon_ke_px(lon)) == pytest.approx(lon)
            assert gibs.px_ke_lat(gibs.lat_ke_px(lat)) == pytest.approx(lat)

    def test_pojok_mosaik_adalah_piksel_nol(self):
        barat = gibs.X_MIN / 256 * 360 - 180
        assert gibs.lon_ke_px(barat) == pytest.approx(0)
        assert 0 < gibs.lat_ke_px(0.0) < gibs.TINGGI

    def test_kotak_ubin_jakarta(self):
        x0, x1, y0, y1 = gibs.kotak_ubin(106.6, -6.45, 107.1, -6.05)
        assert (x0, x1) == (203, 204)
        assert y0 == y1 == 132

    def test_luas_piksel_sekitar_sepertiga_km_persegi(self):
        luas = gibs.luas_piksel_km2()
        assert luas.shape == (gibs.TINGGI,)
        assert 0.33 < luas.min() < luas.max() < 0.38

    def test_ubin_tanpa_palet_dianggap_tanpa_data(self):
        import io

        from PIL import Image

        penyangga = io.BytesIO()
        Image.new("RGBA", (256, 256), (10, 200, 3, 255)).save(penyangga, format="PNG")
        assert not gibs.ubin_ke_indeks(penyangga.getvalue()).any()
        assert not gibs.ubin_ke_indeks(None).any()


class TestPalet:
    def test_gelap_transparan_terang_penuh(self):
        idx = palet.indeks_cahaya(np.array([[0.0, 0.1, 0.31, 5.0, 38.2, 500.0, np.nan]], dtype=np.float32))[0]
        assert idx[0] == idx[1] == idx[6] == 0
        assert 0 < idx[2] < idx[3] < idx[4]
        assert idx[4] == idx[5] == 255

    def test_selisih_memisahkan_naik_dan_turun(self):
        idx = palet.indeks_selisih(np.array([[0.0, 0.2, 3.0, -3.0, 100.0, -100.0]], dtype=np.float32))[0]
        assert idx[0] == idx[1] == 0
        assert 1 <= idx[2] <= 127
        assert 128 <= idx[3] <= 254
        assert idx[4] == 127 and idx[5] == 254

    def test_png_bisa_dibaca_lagi_dengan_transparansi(self, tmp_path):
        from PIL import Image

        a = np.zeros((256, 256), dtype=np.float32)
        a[100:120, 100:120] = 20
        palet.simpan_cahaya(a, tmp_path / "u.png")
        rgba = np.asarray(Image.open(tmp_path / "u.png").convert("RGBA"))
        assert rgba[0, 0, 3] == 0
        assert rgba[110, 110, 3] == 255 and rgba[110, 110, 0] > 200


class TestUbin:
    def test_perkecil_meratakan_ke_ubin_genap(self):
        a = np.ones((gibs.UKURAN, gibs.UKURAN), dtype=np.float32)
        kecil, x0, y0 = ubin.perkecil(a, 195, 123, ubin.gabung_cahaya)
        # (195, 123) ganjil dua-duanya: ditambah bantalan di kiri dan atas
        assert (x0, y0) == (97, 61)
        assert kecil.shape == (gibs.UKURAN, gibs.UKURAN)
        assert kecil[:128, :128].max() == 0
        assert kecil[128:, 128:].min() == 1

    def test_gabung_cahaya_menjaga_titik_kecil(self):
        a = np.zeros((4, 4), dtype=np.float32)
        a[0, 0] = 8
        blok = a.reshape(2, 2, 2, 2)
        assert ubin.gabung_cahaya(blok)[0, 0] == pytest.approx(0.5 * 2 + 0.5 * 8)

    def test_gabung_selisih_menjaga_tanda(self):
        a = np.zeros((2, 2), dtype=np.float32)
        a[0, 0] = -6
        hasil = ubin.gabung_selisih(a.reshape(1, 2, 1, 2))
        assert hasil[0, 0] < 0


class TestWilayah:
    def test_pemekaran_papua(self):
        assert wilayah.kode_provinsi("ID94", "Merauke") == "93"
        assert wilayah.kode_provinsi("ID94", "Mimika") == "94"
        assert wilayah.kode_provinsi("ID94", "Jayawijaya") == "95"
        assert wilayah.kode_provinsi("ID94", "Kota Jayapura") == "91"
        assert wilayah.kode_provinsi("ID91", "Kota Sorong") == "96"
        assert wilayah.kode_provinsi("ID91", "Manokwari") == "92"
        assert wilayah.kode_provinsi("ID32", "Bogor") == "32"

    def test_ada_38_provinsi(self):
        assert len(wilayah.PROVINSI) == 38
        anggota = wilayah.PAPUA_SELATAN | wilayah.PAPUA_TENGAH | wilayah.PAPUA_PEGUNUNGAN | wilayah.PAPUA_BARAT_DAYA
        assert len(anggota) == 4 + 8 + 8 + 6

    def test_raster_label_melebar_ke_pesisir(self):
        kotak = [[106.0, -6.0], [106.2, -6.0], [106.2, -6.2], [106.0, -6.2], [106.0, -6.0]]
        label = wilayah.raster_label([{"geometry": {"type": "Polygon", "coordinates": [kotak]}}])
        x, y = int(gibs.lon_ke_px(106.1)), int(gibs.lat_ke_px(-6.1))
        assert label[y, x] == 1
        tepi = int(gibs.lon_ke_px(106.2))
        assert label[y, tepi + 2] == 1  # dua piksel di luar garis masih ikut
        assert label[y, tepi + 6] == 0


class TestStatistik:
    def test_zonal_hanya_menghitung_piksel_terang(self):
        label = np.zeros((4, 4), dtype=np.int16)
        label[:2] = 1
        label[2:] = 2
        komposit = np.array([[5, 0.5, 0, 0], [2, 0, 0, 0], [0.9, 0.9, 0, 0], [40, 0, 0, np.nan]], dtype=np.float32)
        luas = np.full(4, 0.5)
        cahaya, terang = statistik.zonal(komposit, label, luas, 2)
        assert cahaya.tolist() == pytest.approx([3.5, 20.0])
        assert terang.tolist() == pytest.approx([1.0, 0.5])


class TestPembanding:
    def test_nama_provinsi_bps_dikenali(self):
        assert pembanding.kode_dari_nama("Sumatera   Utara") == "12"
        assert pembanding.kode_dari_nama("KEP. BANGKA BELITUNG") == "19"
        assert pembanding.kode_dari_nama("DI YOGYAKARTA") == "34"
        assert pembanding.kode_dari_nama("PAPUA BARAT DAYA") == "96"
        assert pembanding.kode_dari_nama("Atlantis") is None

    def test_json_tertanam(self):
        halaman = 'x\\"tahun\\":[{\\"val\\":125,\\"label\\":\\"2025\\"}],\\"datacontent\\":{\\"11008701250\\":99.49}y'
        assert pembanding.json_tertanam(halaman, "tahun")[0]["label"] == "2025"
        assert pembanding.json_tertanam(halaman, "datacontent") == {"11008701250": 99.49}
        with pytest.raises(KeyError):
            pembanding.json_tertanam(halaman, "tidak_ada")

    def test_tabel_statis(self):
        halaman = "\\u003ctr\\u003e\\u003ctd class=a\\u003eAceh\\u003c/td\\u003e\\r\\n\\u003ctd\\u003e95.20\\u003c/td\\u003e\\u003c/tr\\u003e"
        assert pembanding.tabel_statis(halaman) == [["Aceh", "95.20"]]

    def test_csv_keluaran_konsisten(self):
        import csv

        data = gibs.AKAR / "data"
        with (data / "listrik_pln_provinsi.csv").open(encoding="utf-8") as f:
            pln = list(csv.DictReader(f))
        assert {r["kode_prov"] for r in pln} - {"00"} <= set(wilayah.PROVINSI)
        assert all(0 < float(r["persen_rt_pln"]) <= 100 for r in pln)
        assert {int(r["tahun"]) for r in pln} >= set(range(2012, 2026))
        with (data / "penduduk_provinsi.csv").open(encoding="utf-8") as f:
            penduduk = list(csv.DictReader(f))
        assert len({r["kode_prov"] for r in penduduk}) == 38
        total_2020 = sum(int(r["penduduk"]) for r in penduduk if r["tahun"] == "2020")
        assert total_2020 == pytest.approx(270_203_917, rel=0.001)


class TestKejadian:
    def test_potong_pas_di_tepi_piksel(self):
        ubin_kotak = gibs.kotak_ubin(123.45, -10.4, 124.1, -9.95)
        sy, sx, pas = kejadian.potong([123.45, -10.4, 124.1, -9.95], (ubin_kotak[0], ubin_kotak[1], ubin_kotak[2], ubin_kotak[3]))
        assert pas[0] <= 123.45 and pas[2] >= 124.1
        assert pas[1] <= -10.4 and pas[3] >= -9.95
        assert sy.stop > sy.start and sx.stop > sx.start
        # tepi kotak hasil jatuh tepat di batas piksel
        assert float(gibs.lon_ke_px(pas[0])) == pytest.approx(round(float(gibs.lon_ke_px(pas[0]))), abs=1e-6)
