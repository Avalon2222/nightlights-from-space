// Ambil satu bingkai per tahun (bahan docs/demo.gif).
// Pakai: node scripts/potret_tahunan.mjs <url> <folder_keluaran> [lebar] [tinggi]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [url, folder, lebar = "1200", tinggi = "675"] = process.argv.slice(2);
if (!url || !folder) {
  console.error("pakai: node scripts/potret_tahunan.mjs <url> <folder_keluaran> [lebar] [tinggi]");
  process.exit(1);
}
mkdirSync(folder, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const halaman = await browser.newPage({ viewport: { width: Number(lebar), height: Number(tinggi) }, locale: "id-ID" });
await halaman.goto(url, { waitUntil: "domcontentloaded" });
await halaman.waitForSelector('main[data-siap="1"]', { timeout: 60000 });

const tungguUbin = () =>
  halaman.evaluate(
    () =>
      new Promise((selesai) => {
        const m = window.__peta;
        const habis = setTimeout(selesai, 15000);
        const cek = () => (m.loaded() && m.areTilesLoaded() ? (clearTimeout(habis), selesai()) : m.once("idle", cek));
        cek();
      }),
  );

const geser = halaman.getByLabel("Pilih tahun");
const jumlah = Number(await geser.getAttribute("max")) + 1;
for (let i = 0; i < jumlah; i++) {
  await geser.fill(String(i));
  await halaman.waitForTimeout(500);
  await tungguUbin();
  await halaman.waitForTimeout(400);
  await halaman.screenshot({ path: `${folder}/${String(i).padStart(2, "0")}.png` });
}
await browser.close();
console.log(jumlah, "bingkai di", folder);
