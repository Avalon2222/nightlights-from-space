// Ambil tangkapan layar aplikasi dengan Playwright (dipakai untuk README dan cek tampilan).
// Pakai: node scripts/potret.mjs <url> <keluaran.png> [lebar] [tinggi] [skala] [tunggu_ms]
import { chromium } from "@playwright/test";

const [url, keluar, lebar = "1440", tinggi = "900", skala = "1", tunggu = "2500"] = process.argv.slice(2);
if (!url || !keluar) {
  console.error("pakai: node scripts/potret.mjs <url> <keluaran.png> [lebar] [tinggi] [skala] [tunggu_ms]");
  process.exit(1);
}

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const halaman = await browser.newPage({ viewport: { width: Number(lebar), height: Number(tinggi) }, deviceScaleFactor: Number(skala), locale: "id-ID" });
const galat = [];
halaman.on("console", (m) => m.type() === "error" && galat.push(m.text()));
halaman.on("pageerror", (e) => galat.push(String(e)));
await halaman.goto(url, { waitUntil: "domcontentloaded" });
await halaman.waitForSelector('main[data-siap="1"]', { timeout: 60000 });
await halaman.evaluate(
  () =>
    new Promise((selesai) => {
      const m = window.__peta;
      const habis = setTimeout(selesai, 15000);
      const cek = () => (m.loaded() && m.areTilesLoaded() ? (clearTimeout(habis), selesai()) : m.once("idle", cek));
      cek();
    }),
);
await halaman.waitForTimeout(Number(tunggu));
await halaman.screenshot({ path: keluar });
if (galat.length) console.log("galat console:\n" + galat.join("\n"));
await browser.close();
console.log("tersimpan:", keluar);
