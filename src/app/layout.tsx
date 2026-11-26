import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Ethiopic } from "next/font/google";
import "./globals.css";
import { getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { EnvBanner } from "@/components/layout/env-banner";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const ethiopic = Noto_Sans_Ethiopic({ variable: "--font-ethiopic", subsets: ["ethiopic"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "HelpSmart — Find help. Live smarter.", template: "%s · HelpSmart" },
  description: "Ethiopia's trusted service marketplace. Discover verified local professionals for your home, family and business.",
  applicationName: "HelpSmart",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#103D35",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getT();
  return (
    <html lang={locale} className={`${inter.variable} ${ethiopic.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-trust focus:px-4 focus:py-2 focus:text-white">
          {t("nav.skip")}
        </a>
        <EnvBanner />
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
