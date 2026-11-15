import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3187);

/**
 * Smoke test di browser sungguhan terhadap hasil `npm run build`.
 * Empat ukuran layar: ponsel 360, 390, dan 412 px, plus desktop 1440 px.
 */
const ponsel = (lebar: number, tinggi: number) => ({ viewport: { width: lebar, height: tinggi }, hasTouch: true, isMobile: true });

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    locale: "id-ID",
    // peta butuh WebGL; di mesin tanpa GPU pakai SwiftShader
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [
    { name: "ponsel-360", use: ponsel(360, 740) },
    { name: "ponsel-390", use: ponsel(390, 844) },
    { name: "ponsel-412", use: ponsel(412, 915) },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
