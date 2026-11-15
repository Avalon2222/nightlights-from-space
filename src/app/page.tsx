import AplikasiKlien from "@/components/AplikasiKlien";

export default function Halaman() {
  return (
    <>
      {/* judul + ringkasan ikut di HTML server, jadi mesin pencari dan pembaca layar tetap dapat isinya */}
      <h1 className="sr-only">Nightlights from Space: cahaya malam Indonesia dari orbit, 2012–2026</h1>
      <p className="sr-only">
        Peta interaktif cahaya malam Indonesia dari data NASA Black Marble: time-lapse tahunan 2012–2026, pertumbuhan
        cahaya per provinsi dan kabupaten dibanding rumah tangga berlistrik PLN dan penduduk, jejak padam setelah
        bencana, dan titik pembangunan baru seperti IKN dan kawasan smelter nikel.
      </p>
      <AplikasiKlien />
    </>
  );
}
