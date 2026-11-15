import type { MetadataRoute } from "next";
import { URL_SITUS } from "@/lib/situs";

// situsnya satu halaman; semua tampilan lain disimpan di hash URL, jadi cukup satu entri
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: URL_SITUS, changeFrequency: "monthly", priority: 1 }];
}
