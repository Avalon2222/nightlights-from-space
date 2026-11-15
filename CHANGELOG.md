# Changelog

Semua perubahan penting di Nightlights from Space dicatat di sini. Formatnya mengikuti
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versinya [Semantic Versioning](https://semver.org/).
Tiap versi baru di `package.json` otomatis jadi tag + GitHub Release lewat workflow `rilis.yml`.

## [1.1.0] - 2026-11-15

### Diubah
- **Statistik dan time-lapse pindah ke komposit resmi NASA.** Sumbernya sekarang VNP46A4 (tahunan, 2012–2025) dan
  VNP46A3 (bulanan, untuk 2026) dari NASA LAADS, dengan radiance penuh. Sebelumnya komposit dibuat sendiri dari ubin
  harian GIBS yang terpotong di 38,2 nW/cm²/sr, sehingga pertumbuhan inti kota besar terhitung terlalu kecil
  (Jakarta 19%, sekarang 30%). Semua angka di aplikasi, README, dan CSV dihitung ulang.
- Mode harian dan kejadian padam tetap memakai citra harian GIBS.

### Ditambah
- `scripts/ambil_laads.py` dan `scripts/komposit_laads.py` untuk mengunduh berkas HDF5 dan memetakannya ke grid peta.
  Butuh token NASA Earthdata di `.env.local`; jalur GIBS tanpa token (`ambil_tahunan.py`) tetap ada sebagai cadangan.

## [1.0.0] - 2026-11-15

Rilis pertama.

### Ditambah
- **Time-lapse 2012–2026** dari 15 komposit tahunan NASA Black Marble, disilang halus di MapLibre, dengan slider,
  tombol putar, dan pintasan papan ketik.
- **Mode harian live:** citra tanggal mana pun sejak 19 Januari 2012, diambil langsung dari NASA GIBS dan diwarnai
  ulang di browser lewat protokol `gibs://`.
- **Peta perubahan** 2024–2026 terhadap 2012–2014, plus daftar kabupaten/kota yang paling naik dan paling turun.
- **Peta wilayah** untuk 38 provinsi dan 514 kabupaten/kota: pertumbuhan cahaya, cahaya per kapita, persen wilayah
  terang, dan persen rumah tangga berlistrik PLN, lengkap dengan pencarian, peringkat, deret per wilayah, dan grafik
  sebar PLN vs cahaya dan PDRB vs cahaya.
- **Blackout:** enam kejadian (Seroja 2021, banjir Sumatra 2025, Lombok 2018, Palu 2018, blackout Jawa 2019, Cianjur
  2022) dengan citra sebelum, sesudah, selisih, dan deret cahaya harian.
- **Hotspot:** dua belas titik pembangunan, dari IKN dan smelter nikel sampai kebun buah naga Banyuwangi.
- Semua tampilan tersimpan di URL dan bisa dibagikan.
- Pipeline Python tanpa akun atau kunci API: unduh ubin GIBS, komposit median, koreksi latar tahunan, statistik zonal,
  ubin PNG berpalet, dan analisis kejadian.
- Tes unit dan validasi data (Vitest), smoke test browser di 360, 390, 412, dan 1440 px (Playwright), dan tes pipeline
  (pytest), semuanya jalan di CI.
