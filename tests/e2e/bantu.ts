import { expect, type Page } from "@playwright/test";

/** Kumpulkan pelanggaran CSP dan galat skrip selama halaman dipakai. */
export function pantau(page: Page): string[] {
  const masalah: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) masalah.push(m.text());
  });
  page.on("pageerror", (e) => masalah.push(String(e)));
  return masalah;
}

/** Buka aplikasi dan tunggu sampai data dan peta siap. */
export async function buka(page: Page, jalur = "/") {
  await page.goto(jalur);
  await expect(page.locator('main[data-siap="1"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("banner")).toBeVisible();
}

export const ponsel = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

export async function pilihMode(page: Page, nama: string) {
  await page.getByRole("navigation", { name: "Mode tampilan" }).getByRole("button", { name: nama }).click();
  await expect(page.locator("main")).toHaveAttribute("data-mode", /.+/);
}

/** Elemen yang terlihat tapi keluar dari layar (terpotong) dihitung gagal. */
export async function terpotong(page: Page, pemilih: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const lebar = document.documentElement.clientWidth;
    const tinggi = document.documentElement.clientHeight;
    const hasil: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const k = el.getBoundingClientRect();
      if (k.width === 0 || k.height === 0) continue;
      if (k.left < -0.5 || k.top < -0.5 || k.right > lebar + 0.5 || k.bottom > tinggi + 0.5) hasil.push(`${el.getAttribute("aria-label") ?? el.textContent} @ ${Math.round(k.left)}..${Math.round(k.right)} x ${Math.round(k.top)}..${Math.round(k.bottom)}`);
    }
    return hasil;
  }, pemilih);
}

/** Tombol dan tautan tanpa nama yang bisa dibaca pembaca layar. */
export async function tanpaNama(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hasil: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], a[href], input, select"))) {
      const nama = (el.getAttribute("aria-label") ?? "").trim() || (el.textContent ?? "").trim() || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.getAttribute("title");
      if (!nama) hasil.push(el.outerHTML.slice(0, 160));
    }
    return hasil;
  });
}

/** Jumlah piksel terang di kanvas peta: bukti lapisan cahaya benar-benar tergambar. */
export async function pikselTerang(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const m = (window as unknown as { __peta: { getCanvas(): HTMLCanvasElement; triggerRepaint(): void; once(e: string, f: () => void): void } }).__peta;
    m.triggerRepaint();
    await new Promise<void>((selesai) => m.once("render", () => selesai()));
    const kanvas = m.getCanvas();
    const gl = (kanvas.getContext("webgl2") ?? kanvas.getContext("webgl")) as WebGLRenderingContext;
    const px = new Uint8Array(kanvas.width * kanvas.height * 4);
    gl.readPixels(0, 0, kanvas.width, kanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let terang = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] > 120) terang++;
    return terang;
  });
}

export async function tungguUbin(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((selesai) => {
        const m = (window as unknown as { __peta: { loaded(): boolean; areTilesLoaded(): boolean; once(e: string, f: () => void): void } }).__peta;
        const habis = setTimeout(selesai, 20_000);
        const cek = () => {
          if (m.loaded() && m.areTilesLoaded()) {
            clearTimeout(habis);
            selesai();
          } else m.once("idle", cek);
        };
        cek();
      }),
  );
}
