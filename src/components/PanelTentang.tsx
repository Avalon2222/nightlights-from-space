import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { angka, tanggal } from "@/lib/format";
import type { Statistik } from "@/lib/jenis";
import { URL_REPO } from "@/lib/situs";
import { Catatan, Judul, Sub } from "./Bagian";

function Tautan({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emas underline-offset-2 hover:underline">
      {children}
      <ExternalLink size={11} aria-hidden />
    </a>
  );
}

const butir = "m-0 mb-1.5 pl-1 text-[12.5px] leading-relaxed text-redup";

export default function PanelTentang({ s }: { s: Statistik }) {
  const akhir = s.sampel[s.sampel.length - 1];
  return (
    <div>
      <Judul kecil="Tentang · metodologi">Dari piksel satelit ke angka per kabupaten</Judul>
      <Catatan>
        Semua yang tampil di sini dihitung dari data terbuka, tanpa akun atau kunci API, dan bisa dibangun ulang dari skrip di
        repositorinya.
      </Catatan>

      <Sub>Sumber citra</Sub>
      <ul className="m-0 list-disc pl-4">
        <li className={butir}>
          <Tautan href="https://blackmarble.gsfc.nasa.gov/">NASA Black Marble</Tautan> VNP46A2: radiance malam harian dari sensor VIIRS
          Day/Night Band (satelit Suomi NPP), sudah dikoreksi cahaya bulan, atmosfer, dan sudut pandang, lalu diisi-celah saat berawan.
        </li>
        <li className={butir}>
          Diambil lewat <Tautan href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api">NASA GIBS</Tautan> di
          zoom 8, sekitar 600 m per piksel.
        </li>
        <li className={butir}>
          Komposit tahunan = median per piksel dari dua malam tiap bulan (tanggal 6 dan 21). Median membuang cahaya sesaat seperti
          kebakaran lahan, kapal, dan petir. Data terakhir: {tanggal(akhir.terakhir)}.
        </li>
      </ul>

      <Sub>Cara menghitung</Sub>
      <ul className="m-0 list-disc pl-4">
        <li className={butir}>
          Piksel dihitung <em>terang</em> kalau radiansnya ≥ {angka(s.ambang, 0)} nW/cm²/sr. Di bawah itu terlalu dekat dengan derau sensor.
        </li>
        <li className={butir}>
          <em>Total cahaya</em> = jumlah radiance × luas piksel terang (sering disebut sum of lights). <em>Wilayah terang</em> = luas
          piksel terang dibagi luas wilayah.
        </li>
        <li className={butir}>
          Batas {s.kabupaten.length} kabupaten/kota dari BPS (lewat geoBoundaries/HDX), dilebarkan sekitar 2 km ke laut supaya cahaya
          kota pesisir tidak terbuang. Provinsi = jumlah kabupatennya; enam provinsi di Papua dihitung dengan batas sekarang untuk
          semua tahun.
        </li>
        <li className={butir}>
          Kejadian padam: indeks harian terhadap median 30 malam sebelumnya, diringkas dengan median geser 3 malam.
        </li>
      </ul>

      <Sub>Data pembanding</Sub>
      <ul className="m-0 list-disc pl-4">
        <li className={butir}>
          <Tautan href="https://www.bps.go.id/id/statistics-table/2/ODcjMg==/persentase-rumah-tangga-dengan-sumber-penerangan-listrik-pln--persen-.html">BPS, Susenas</Tautan>:
          persen rumah tangga dengan penerangan utama listrik PLN per provinsi, 2012–2025.
        </li>
        <li className={butir}>
          Penduduk provinsi: Sensus 2010, Sensus 2020, dan proyeksi BPS 2025, diinterpolasi per tahun. Kabupaten/kota memakai proyeksi
          2020 (BPS lewat UNFPA/HDX).
        </li>
        <li className={butir}>
          <Tautan href="https://www.bps.go.id/id/statistics-table/2/Mjg2IzI=/-seri-2010--produk-domestik-regional-bruto---milyar-rupiah-.html">BPS</Tautan>: PDRB
          provinsi atas dasar harga berlaku.
        </li>
      </ul>

      <Sub>Yang perlu diingat</Sub>
      <ul className="m-0 list-disc pl-4">
        <li className={butir}>
          Rendering GIBS memotong radiance di {angka(s.potong, 1)} nW/cm²/sr. Inti kota besar (Jakarta, Surabaya) sudah mentok sejak
          2012, jadi pertumbuhan cahayanya terhitung terlalu kecil. Luas terang tidak terpengaruh.
        </li>
        <li className={butir}>
          Cahaya bukan listrik rumah tangga. Lampu jalan, pabrik, pelabuhan, tambang, dan suar gas ikut terhitung; desa yang baru
          tersambung dengan beberapa lampu redup bisa tetap di bawah ambang.
        </li>
        <li className={butir}>
          Peralihan lampu jalan ke LED putih mengubah warna cahaya, dan sensor VIIRS kurang peka pada biru. Sebagian &quot;meredup&quot; bisa
          berasal dari sini.
        </li>
        <li className={butir}>Satelit lewat sekitar 01.30 waktu setempat dan tidak menembus awan. Padam singkat sering tidak terekam.</li>
        <li className={butir}>Persen PLN dari BPS adalah survei rumah tangga, bukan rasio elektrifikasi versi Kementerian ESDM; angkanya bisa beda.</li>
      </ul>

      <Sub>Kode dan data</Sub>
      <p className="m-0 text-[12.5px] leading-relaxed text-redup">
        <Tautan href={URL_REPO}>github.com/Avalon2222/nightlights-from-space</Tautan>. Kode berlisensi MIT. Citra Black Marble milik
        NASA dan bebas dipakai; batas wilayah CC BY 3.0 IGO; peta dasar © OpenStreetMap lewat OpenFreeMap.
      </p>
      <p className="m-0 mt-2 text-[11.5px] text-samar">Data dibangun {tanggal(s.dibuat)}.</p>
    </div>
  );
}
