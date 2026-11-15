# Sumber Data

Semua data di repo ini berasal dari sumber publik dan bisa dibangun ulang dengan skrip di `scripts/`.
Tidak ada yang butuh akun atau kunci API. Diunduh 15 November 2026.

## 1. Cahaya malam

| Hal | Keterangan |
|---|---|
| Produk | NASA Black Marble **VNP46A2**: *Gap-Filled BRDF-Corrected Day/Night Band Radiance*, harian, sensor VIIRS di satelit Suomi NPP |
| Diambil lewat | NASA GIBS, lapisan `VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance`, `GoogleMapsCompatible_Level8` (zoom 8, sekitar 600 m per piksel) |
| Titik akses | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{lapisan}/default/{tanggal}/GoogleMapsCompatible_Level8/8/{y}/{x}.png` |
| Cakupan | Ubin x 195–228, y 123–135 (94,2° BT – 142,0° BT; 11,2° LS – 7,0° LU), 19 Januari 2012 sampai 21 Oktober 2026 |
| Satuan | nW/cm²/sr. PNG berpalet 180 tingkat; tiap indeks dikembalikan ke nilai tengah rentangnya lewat colormap resmi (`scripts/colormap_dnb.xml`). Rentang teratas "38,2 ke atas" dicatat sebagai 38,2 |
| Lisensi | Data NASA, bebas dipakai. Kutipan: Román, M.O. dkk. (2018), *NASA's Black Marble nighttime lights product suite*, Remote Sensing of Environment 210 |

Olahan di folder ini:

- `cahaya_nasional.csv`, `cahaya_provinsi.csv`, `cahaya_kabupaten.csv`: per tahun, `cahaya` (jumlah radiance × km² piksel
  terang) dan `luas_terang_km2` (piksel dengan radiance ≥ 1 nW/cm²/sr setelah koreksi latar). `cahaya_nasional.csv` juga
  mencatat jumlah sampel dan tanggal sampel pertama dan terakhir tiap tahun.
- `ringkasan_provinsi.csv`: satu baris per provinsi-tahun, sudah digabung dengan persen rumah tangga PLN, penduduk, dan
  cahaya per 1.000 penduduk. `hotspot_tahunan.csv` dan `kejadian_padam.csv`: versi tabel dari deret hotspot dan ringkasan
  kejadian. Tiga berkas ini yang dipakai [talk-to-the-data](https://github.com/Avalon2222/talk-to-the-data).
- `latar_tahunan.csv`: tingkat latar yang dikurangkan dari komposit tiap tahun (rata-rata radiance daratan yang selalu gelap).
- `palet.json`: titik warna untuk ubin dan legenda.
- `kejadian.json`, `sorotan.json`: daftar kejadian padam dan titik pembangunan (lokasi, kotak, catatan). Deretnya
  dihitung skrip dan disimpan di `public/data/`.

## 2. Batas wilayah dan penduduk kabupaten/kota

| Hal | Keterangan |
|---|---|
| Batas | Badan Pusat Statistik (BPS) lewat OCHA/HDX, versi sederhana dari [geoBoundaries](https://www.geoboundaries.org/) IDN ADM2 (514 kabupaten/kota, kondisi 2020). Lisensi CC BY 3.0 IGO |
| Penduduk 2020 | *Indonesia - Subnational Population Statistics* (COD-PS), proyeksi BPS lewat UNFPA: <https://data.humdata.org/dataset/cod-ps-idn>. Salinan mentah di `sumber/penduduk_adm2_2020.csv` |
| Olahan | `kabupaten.csv`: kode BPS, nama, provinsi, penduduk 2020, luas menurut raster |

Catatan:

- Kode kabupaten/kota mengikuti BPS 2020. Kode provinsi mengikuti Kemendagri (11–96), sama dengan repo
  [follow-the-money](https://github.com/Avalon2222/follow-the-money).
- Empat provinsi baru di Papua (2022) dibentuk dari daftar kabupatennya, lalu dipakai untuk semua tahun supaya deretnya
  nyambung.
- Batas dilebarkan tiga piksel (sekitar 2 km) ke laut. Akibatnya luas wilayah di `kabupaten.csv` sedikit lebih besar dari
  luas resmi, terutama untuk kabupaten kepulauan.

## 3. Rumah tangga berlistrik PLN

| Hal | Keterangan |
|---|---|
| Indikator | Persentase rumah tangga menurut provinsi dengan sumber penerangan utama listrik PLN (Susenas) |
| 2012–2022 | BPS, tabel statis "Persentase Rumah Tangga menurut Provinsi dan Sumber Penerangan Listrik PLN, 1993-2022": <https://www.bps.go.id/id/statistics-table/1/MTU1NSMx/persentase-rumah-tangga-menurut-provinsi-dan-sumber-penerangan-listrik-pln-1993-2021.html>. Untuk 2012 dan 2013 dipakai kolom *backcasting* |
| 2023–2025 | BPS, tabel dinamis dengan judul sama: <https://www.bps.go.id/id/statistics-table/2/ODcjMg==/persentase-rumah-tangga-dengan-sumber-penerangan-listrik-pln--persen-.html>. Angka 2023 dan 2024 disalin dari halaman itu ke `sumber/bps_pln_2023_2024.csv`; 2025 dibaca skrip dari HTML halamannya |
| Olahan | `listrik_pln_provinsi.csv` (kode `00` = Indonesia) |

Catatan:

- Ini angka survei rumah tangga, bukan *rasio elektrifikasi* yang diterbitkan Kementerian ESDM. Keduanya sering beda
  beberapa poin.
- Provinsi-provinsi baru di Papua baru punya angka sendiri mulai 2024. Sebelum itu angka "Papua" dan "Papua Barat"
  masih wilayah lama, jadi deret keduanya patah di 2024.
- BPS dan Kemendagri memberi nomor berbeda untuk provinsi di Papua; skrip mencocokkannya lewat nama.

## 4. Penduduk provinsi

| Hal | Keterangan |
|---|---|
| Sensus 2010 dan 2020 | BPS, diambil dari tabel di artikel Wikipedia "2020 Indonesian census": <https://en.wikipedia.org/wiki/2020_Indonesian_census> |
| Proyeksi 2025 | BPS, pertengahan 2025 per 38 provinsi (`sumber/penduduk_provinsi_2025.csv`, dari repo follow-the-money) |
| Olahan | `penduduk_provinsi.csv`: 2012–2026, interpolasi geometris antara tiga titik itu (2026 diteruskan dengan laju 2020–2025) |

Papua, Papua Barat, dan Kalimantan Timur di sensus masih wilayah sebelum pemekaran. Angkanya dibagi ke provinsi baru
menurut porsi penduduk 2025 (Papua) dan 2020 (Kalimantan Utara).

## 5. PDRB provinsi

| Hal | Keterangan |
|---|---|
| Sumber | BPS, "[Seri 2010] Produk Domestik Regional Bruto (Milyar Rupiah)": <https://www.bps.go.id/id/statistics-table/2/Mjg2IzI=/-seri-2010--produk-domestik-regional-bruto---milyar-rupiah-.html> |
| Olahan | `pdrb_provinsi.csv`: tahun terbaru di halaman itu (2025), harga berlaku dan harga konstan 2010 |

## 6. Peta dasar

Garis pantai, batas, jalan utama, dan nama tempat dari OpenStreetMap, disajikan [OpenFreeMap](https://openfreemap.org)
dengan skema OpenMapTiles. Diambil browser saat aplikasi dibuka; tidak ada salinannya di repo.
