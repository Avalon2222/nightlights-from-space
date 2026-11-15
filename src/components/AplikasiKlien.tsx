"use client";

import dynamic from "next/dynamic";

// peta butuh WebGL dan window, jadi aplikasinya cuma dirender di browser
const Aplikasi = dynamic(() => import("@/components/Aplikasi"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-bg" />,
});

export default function AplikasiKlien() {
  return <Aplikasi />;
}
