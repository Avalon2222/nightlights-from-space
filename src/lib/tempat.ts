/** Tempat lompat cepat di panel time-lapse. */

export interface Tempat {
  id: string;
  nama: string;
  pusat: [number, number];
  zoom: number;
}

export const TEMPAT: Tempat[] = [
  { id: "indonesia", nama: "Seluruh Indonesia", pusat: [118, -2.4], zoom: 4.1 },
  { id: "jawa", nama: "Jawa", pusat: [110.2, -7.3], zoom: 6.3 },
  { id: "jabodetabek", nama: "Jabodetabek", pusat: [106.85, -6.3], zoom: 8.4 },
  { id: "sumatra", nama: "Sumatra", pusat: [101.5, 0.2], zoom: 5.3 },
  { id: "kalimantan", nama: "Kalimantan", pusat: [114.2, -0.5], zoom: 5.6 },
  { id: "sulawesi", nama: "Sulawesi", pusat: [121.2, -2.0], zoom: 5.8 },
  { id: "bali-nusra", nama: "Bali & Nusa Tenggara", pusat: [119.5, -8.7], zoom: 6.2 },
  { id: "maluku", nama: "Maluku", pusat: [128.0, -1.5], zoom: 5.6 },
  { id: "papua", nama: "Papua", pusat: [136.5, -4.0], zoom: 5.6 },
];
