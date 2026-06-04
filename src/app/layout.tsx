import type { Metadata } from "next";

import { SiteFooter } from "../components/SiteFooter";
import { ThemeProvider } from "../components/ThemeProvider";
import { readOptionalTextFile, readSiteSettings, storagePaths } from "../lib/fileStorage";
import "./globals.css";

export const metadata: Metadata = {
  title: "UCU BEDEN",
  description: "Local-first yaşayan şiir arşivi ve günlük üretim sistemi.",
  icons: {
    icon: "/assets/favicon.svg"
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, customCode] = await Promise.all([readSiteSettings(), readOptionalTextFile(storagePaths.customCode)]);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <html lang="tr">
      <head>
        <link rel="stylesheet" href={`${basePath}/custom.css`} />
      </head>
      <body data-theme={settings.theme}>
        <ThemeProvider theme={settings.theme}>
          {children}
          <SiteFooter showDedication={settings.showFooterDedication} />
          {customCode.trim() ? <div dangerouslySetInnerHTML={{ __html: customCode }} /> : null}
        </ThemeProvider>
      </body>
    </html>
  );
}
