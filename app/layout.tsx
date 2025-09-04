import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sekase - Türkiye Sosyo-Ekonomik Analiz Platformu",
  description: "Türkiye'nin sosyo-ekonomik verilerini analiz eden akıllı platform. İllere göre detaylı analiz ve görselleştirme.",
  keywords: ["teknofest", "sosyo-ekonomik", "analiz", "türkiye", "istatistik", "data"],
  authors: [{ name: "Teknofest Takımı" }],
  creator: "Sekase Takımı",
  publisher: "Teknofest",
  robots: "index, follow",
  
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
