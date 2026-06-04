import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "UCU BEDEN",
  description: "Local-first yaşayan şiir arşivi ve günlük üretim sistemi."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
