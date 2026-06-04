import type { Metadata } from "next";

import { SiteFooter } from "../components/SiteFooter";
import { ThemeProvider } from "../components/ThemeProvider";
import { readSiteSettings } from "../lib/fileStorage";
import "./globals.css";

export const metadata: Metadata = {
  title: "UCU BEDEN",
  description: "Local-first yaşayan şiir arşivi ve günlük üretim sistemi.",
  icons: {
    icon: "/assets/favicon.svg"
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await readSiteSettings();

  return (
    <html lang="tr">
      <body data-theme={settings.theme}>
        <ThemeProvider theme={settings.theme}>
          {children}
          <SiteFooter showDedication={settings.showFooterDedication} />
        </ThemeProvider>
      </body>
    </html>
  );
}
