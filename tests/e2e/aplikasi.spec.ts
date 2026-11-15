import { expect, test } from "@playwright/test";
import { buka, pantau, pikselTerang, pilihMode, ponsel, tanpaNama, terpotong, tungguUbin } from "./bantu";

const JUDUL: [string, RegExp][] = [
  ["Perubahan", /Di mana lampu bertambah/],
  ["Wilayah", /Siapa yang makin terang/],
  ["Blackout", /Saat lampu padam/],
  ["Hotspot", /Tempat yang tiba-tiba menyala/],
  ["Tentang", /Dari piksel satelit/],
  ["Time-lapse", /Indonesia setelah gelap/],
];

test("terbuka bersih: cahaya tergambar, tidak ada galat, tidak ada yang terpotong", async ({ page }) => {
  const masalah = pantau(page);
  await buka(page);
  await tungguUbin(page);
  expect(await pikselTerang(page)).toBeGreaterThan(300);
  expect(masalah).toEqual([]);
  expect(await tanpaNama(page)).toEqual([]);
  expect(await terpotong(page, 'header [aria-label^="Kembali"], section[aria-label="Garis waktu"] button, section[aria-label="Garis waktu"] input')).toEqual([]);
  // halaman tidak boleh bisa digeser ke samping
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("garis waktu: geser tahun, lalu putar dan jeda", async ({ page }) => {
  await buka(page);
  const tahun = page.getByTestId("tahun-aktif");
  await expect(tahun).toHaveText("2026");
  await page.getByLabel("Pilih tahun").fill("3");
  await expect(tahun).toHaveText("2015");
  await expect(page).toHaveURL(/t=2015/);

  await page.getByRole("button", { name: "Putar time-lapse" }).click();
  await expect(tahun).not.toHaveText("2015", { timeout: 30_000 });
  await page.getByRole("button", { name: "Jeda time-lapse" }).click();
  await expect(page.getByRole("button", { name: "Putar time-lapse" })).toBeVisible();
  const berhentiDi = await tahun.textContent();
  await page.waitForTimeout(1500);
  await expect(tahun).toHaveText(berhentiDi ?? "");
});

test("tiap mode punya panelnya sendiri", async ({ page }) => {
  const masalah = pantau(page);
  await buka(page);
  for (const [nama, judul] of JUDUL) {
    await pilihMode(page, nama);
    await expect(page.getByRole("heading", { level: 2, name: judul })).toBeVisible();
  }
  expect(masalah).toEqual([]);
});

test("wilayah: pilih dari peringkat, ganti tingkat dan metrik", async ({ page }) => {
  await buka(page);
  await pilihMode(page, "Wilayah");
  const pertama = page.getByTestId("peringkat").getByRole("button").first();
  const nama = (await pertama.locator("span.block").first().textContent()) ?? "";
  await pertama.click();
  await expect(page.getByTestId("nama-wilayah")).toHaveText(nama);
  await expect(page).toHaveURL(/w=\d{2}(&|$)/);

  await page.getByRole("button", { name: "514 kabupaten/kota" }).click();
  await expect(page.getByTestId("nama-wilayah")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Metrik peta" }).getByRole("button", { name: "PLN" })).toBeDisabled();
  await page.getByRole("searchbox").fill("morowali");
  await page.getByTestId("peringkat").getByRole("button", { name: /^.*Morowali\b(?! Utara)/ }).first().click();
  await expect(page.getByTestId("nama-wilayah")).toContainText("Morowali");
  await expect(page).toHaveURL(/g=kab/);
});

test("blackout: buka kejadian, ganti citra, deret harian tampil", async ({ page }) => {
  const masalah = pantau(page);
  await buka(page);
  await pilihMode(page, "Blackout");
  await page.getByRole("button", { name: /Siklon tropis Seroja/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Siklon tropis Seroja" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Indeks cahaya harian/ })).toBeVisible();
  const selisih = page.getByRole("group", { name: "Citra yang ditampilkan" }).getByRole("button", { name: "Selisih" });
  await selisih.click();
  await expect(selisih).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/k=seroja-2021.*v=selisih/);
  await page.getByRole("button", { name: "Semua kejadian" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /Saat lampu padam/ })).toBeVisible();
  expect(masalah).toEqual([]);
});

test("hotspot: IKN punya deret tahunan", async ({ page }) => {
  await buka(page);
  await pilihMode(page, "Hotspot");
  await page.getByRole("button", { name: /IKN Nusantara/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "IKN Nusantara" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Total cahaya tahunan di IKN/ })).toBeVisible();
  await expect(page).toHaveURL(/s=ikn/);
});

test("tautan dalam membuka tampilan yang sama", async ({ page }) => {
  await buka(page, "/#m=blackout&k=palu-2018&v=sebelum");
  await expect(page.getByRole("heading", { level: 2, name: /Palu/ })).toBeVisible();
  await expect(page.getByRole("group", { name: "Citra yang ditampilkan" }).getByRole("button", { name: "Sebelum" })).toHaveAttribute("aria-pressed", "true");

  await buka(page, "/#m=wilayah&t=2018&g=kab&x=terang&w=3510");
  await page.reload();
  await expect(page.locator('main[data-siap="1"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("nama-wilayah")).toHaveText("Banyuwangi");
  await expect(page.getByTestId("tahun-aktif")).toHaveText("2018");
});

test("mode harian menampilkan pemilih tanggal", async ({ page }) => {
  await buka(page);
  await page.getByRole("button", { name: "Harian (live NASA)" }).click();
  const tanggal = page.getByLabel("Tanggal lintasan (UTC)");
  await expect(tanggal).toBeVisible();
  const awal = await tanggal.inputValue();
  await page.getByRole("button", { name: "Sehari sebelumnya" }).click();
  await expect(tanggal).not.toHaveValue(awal);
  await expect(page.getByRole("button", { name: "Sehari sesudahnya" })).toBeEnabled();
  await expect(page.getByTestId("tahun-aktif")).toHaveCount(0);
  await page.getByRole("button", { name: "Komposit tahunan" }).click();
  await expect(page.getByTestId("tahun-aktif")).toBeVisible();
});

test("ponsel: panel bisa dikecilkan dan dibuka lagi", async ({ page }) => {
  test.skip(!ponsel(page), "lembar bawah hanya ada di layar sempit");
  await buka(page);
  const tuas = page.getByRole("button", { name: /kecilkan|buka panel/ });
  await expect(tuas).toHaveAttribute("aria-expanded", "true");
  await tuas.click();
  await expect(tuas).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  // garis waktu ikut turun dan tetap utuh di layar
  expect(await terpotong(page, 'section[aria-label="Garis waktu"]')).toEqual([]);
  await tuas.click();
  await expect(page.getByRole("heading", { level: 2, name: /Indonesia setelah gelap/ })).toBeVisible();
});
