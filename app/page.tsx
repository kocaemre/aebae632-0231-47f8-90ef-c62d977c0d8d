"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { HeroSection } from "@/components/shared/hero-section";
import { KategoriSection } from "@/components/shared/kategori-section";

export default function Home() {
  const kategoriRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleArastirmayaBasla = () => {
    // Smooth scroll to kategori section
    kategoriRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  const handleAnaliziBaslat = (kategoriler: string[], agirliklar?: {[key: string]: number}) => {
    // URL'e kategorileri ve ağırlıkları parametre olarak ekleyerek harita sayfasına yönlendir
    const params = new URLSearchParams();
    
    if (kategoriler.length === 1) {
      // Tek kategori - eski format
      params.set('kategori', kategoriler[0]);
    } else {
      // Çoklu kategori - yeni format
      params.set('kategoriler', kategoriler.join(','));
      if (agirliklar) {
        const agirlikDegerleri = kategoriler.map(k => agirliklar[k]?.toString() || '0');
        params.set('agirliklar', agirlikDegerleri.join(','));
      }
    }
    
    router.push(`/harita?${params.toString()}`);
  };

  const handleKarsilastirmaBaslat = (kategori: string) => {
    // İl karşılaştırma sayfasına yönlendir
    router.push(`/karsilastir?kategori=${kategori}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection onArastirmayaBasla={handleArastirmayaBasla} />
      
      {/* Kategori Section */}
      <div ref={kategoriRef}>
        <KategoriSection 
          onAnaliziBaslat={handleAnaliziBaslat} 
          onKarsilastirmaBaslat={handleKarsilastirmaBaslat}
        />
      </div>
    </div>
  );
}
