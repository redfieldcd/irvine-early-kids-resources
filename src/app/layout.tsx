import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import { getLocale, getDictionary } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { SITE_URL, SITE_NAME } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t.meta.siteTitle,
      template: `%s | ${SITE_NAME}`,
    },
    description: t.meta.siteDescription,
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      title: t.meta.siteTitle,
      description: t.meta.siteDescription,
      url: SITE_URL,
      images: [
        {
          url: "/images/og-default.png",
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t.meta.siteTitle,
      description: t.meta.siteDescription,
      images: ["/images/og-default.png"],
    },
    alternates: {
      canonical: SITE_URL,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dictionary = await getDictionary();

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider locale={locale} dictionary={dictionary}>
          <Navbar />
          <AnalyticsProvider />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
