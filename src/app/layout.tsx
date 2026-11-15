import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { URL_SITUS } from "@/lib/situs";
import "./globals.css";

// font di-host sendiri lewat next/font: tanpa request ke Google saat runtime, tanpa lompatan tata letak
const fontGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-grotesk" });
const fontMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-jetbrains" });

const SLOGAN = "Fifteen years of Indonesia after dark, seen from orbit.";

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITUS),
  title: "Nightlights from Space: Indonesia setelah gelap, 2012–2026",
  description:
    "Fifteen years of Indonesia after dark, seen from orbit. Time-lapse cahaya malam NASA Black Marble 2012–2026: pertumbuhan cahaya per provinsi dan kabupaten dibanding listrik PLN dan penduduk, jejak padam setelah gempa dan siklon, sampai IKN dan smelter nikel yang tiba-tiba menyala.",
  keywords: ["Indonesia", "nightlights", "cahaya malam", "VIIRS", "Black Marble", "NASA", "elektrifikasi", "PLN", "IKN", "Morowali", "MapLibre"],
  authors: [{ name: "Avalon2222", url: "https://github.com/Avalon2222" }],
  openGraph: { title: "Nightlights from Space", description: SLOGAN, url: URL_SITUS, siteName: "Nightlights from Space", type: "website", locale: "id_ID" },
  twitter: { card: "summary_large_image", title: "Nightlights from Space", description: SLOGAN },
};

export const viewport: Viewport = {
  themeColor: "#03050b",
  width: "device-width",
  initialScale: 1,
  // sengaja tanpa maximumScale: halaman boleh di-pinch-zoom (aksesibilitas); peta menangani pinch-nya sendiri
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`h-full ${fontGrotesk.variable} ${fontMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://tiles.openfreemap.org" />
      </head>
      <body className="h-full">
        {children}
        {/* Vercel Web Analytics: tanpa cookie, skripnya dari domain sendiri. Cuma dipasang di build Vercel. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
