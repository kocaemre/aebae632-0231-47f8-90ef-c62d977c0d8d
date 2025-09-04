"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { motion, AnimatePresence } from "framer-motion";
import { Kategori } from "@/lib/types";
// import kategorilerData from "@/data/kategoriler.json"; // Artık API'den alacağız
import { CheckCircle2, CircleCheck, Plus, ArrowRight, Loader2, GitCompare } from "lucide-react";

interface KategoriSectionProps {
  onAnaliziBaslat: (kategoriler: string[], agirliklar?: {[key: string]: number}) => void; // Çoklu kategori seçimi
  onKarsilastirmaBaslat?: (kategori: string) => void; // İl karşılaştırma için
}

export function KategoriSection({ onAnaliziBaslat, onKarsilastirmaBaslat }: KategoriSectionProps) {
  const [secilenKategoriler, setSecilenKategoriler] = useState<string[]>([]); // Çoklu kategori
  const [kategoriAgirliklar, setKategoriAgirliklar] = useState<{[key: string]: number}>({});
  const [agirlikInputlari, setAgirlikInputlari] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [kategoriYukleniyor, setKategoriYukleniyor] = useState(true);

  // Kategorileri API'den yükle
  useEffect(() => {
    const fetchKategoriler = async () => {
      try {
        setKategoriYukleniyor(true);
        const response = await fetch('/api/kategoriler');
        const data = await response.json();
        
        if (data.success) {
          setKategoriler(data.data);
        } else {
          console.error('Kategoriler yüklenemedi:', data.message);
        }
      } catch (error) {
        console.error('Kategoriler API hatası:', error);
      } finally {
        setKategoriYukleniyor(false);
      }
    };

    fetchKategoriler();
  }, []);

  const handleKategoriToggle = (kategoriId: string) => {
    setSecilenKategoriler(prev => {
      if (prev.includes(kategoriId)) {
        // Kategori zaten seçili, kaldır
        const yeniListe = prev.filter(k => k !== kategoriId);
        // Ağırlıkları da güncelle
        const yeniAgirliklar = { ...kategoriAgirliklar };
        delete yeniAgirliklar[kategoriId];
        const yeniInputlar = { ...agirlikInputlari };
        delete yeniInputlar[kategoriId];
        setKategoriAgirliklar(yeniAgirliklar);
        setAgirlikInputlari(yeniInputlar);
        
        // Kalan kategoriler için eşit ağırlık dağıt
        if (yeniListe.length > 0) {
          const eslitAgirlik = 1 / yeniListe.length;
          const guncelAgirliklar: {[key: string]: number} = {};
          yeniListe.forEach(k => {
            guncelAgirliklar[k] = eslitAgirlik;
          });
          setKategoriAgirliklar(guncelAgirliklar);
          const guncelInputlar: {[key: string]: string} = {};
          yeniListe.forEach(k => {
            guncelInputlar[k] = String(Math.round(eslitAgirlik * 100));
          });
          setAgirlikInputlari(guncelInputlar);
        }
        
        return yeniListe;
      } else if (prev.length < 3) {
        // Yeni kategori ekle (max 3)
        const yeniListe = [...prev, kategoriId];
        
        // Eşit ağırlık dağıt
        const eslitAgirlik = 1 / yeniListe.length;
        const guncelAgirliklar: {[key: string]: number} = {};
        yeniListe.forEach(k => {
          guncelAgirliklar[k] = eslitAgirlik;
        });
        setKategoriAgirliklar(guncelAgirliklar);
        const guncelInputlar: {[key: string]: string} = {};
        yeniListe.forEach(k => {
          guncelInputlar[k] = String(Math.round(eslitAgirlik * 100));
        });
        setAgirlikInputlari(guncelInputlar);
        
        return yeniListe;
      } else {
        // 3 kategori limiti
        alert("En fazla 3 kategori seçebilirsiniz!");
        return prev;
      }
    });
  };

  const handleAgirlikDegisimi = (kategoriId: string, yeniAgirlik: number) => {
    setKategoriAgirliklar(prev => {
      const currentWeights = { ...prev };
      const otherCategoryIds = secilenKategoriler.filter(k => k !== kategoriId);
      const maxPer = otherCategoryIds.length === 1 ? 0.75 : 0.5;
      const clampedCurrent = Math.min(Math.max(yeniAgirlik, 0.25), maxPer);

      if (otherCategoryIds.length === 0) {
        currentWeights[kategoriId] = clampedCurrent;
        setAgirlikInputlari(prevInput => ({ ...prevInput, [kategoriId]: String(Math.round(clampedCurrent * 100)) }));
        return currentWeights;
      }

      // Dengeleyiciyi belirle ve kalanları hesapla
      const balancerId = otherCategoryIds[otherCategoryIds.length - 1];
      const restIds = otherCategoryIds.filter(k => k !== balancerId);
      const sumRest = restIds.reduce((s, k) => s + (currentWeights[k] ?? 0), 0);

      currentWeights[kategoriId] = clampedCurrent;
      let balancer = 1 - (clampedCurrent + sumRest);
      const balMax = maxPer;
      if (balancer < 0.25) balancer = 0.25;
      if (balancer > balMax) balancer = balMax;
      currentWeights[balancerId] = balancer;

      // Küçük toplam sapmasını balancer ile düzelt
      const total = Object.values(currentWeights).reduce((a, b) => a + b, 0);
      if (Math.abs(total - 1) > 1e-6) {
        const diff = 1 - total;
        const newBal = Math.min(Math.max(currentWeights[balancerId] + diff, 0.25), balMax);
        currentWeights[balancerId] = newBal;
      }

      setAgirlikInputlari(prevInput => ({
        ...prevInput,
        [kategoriId]: String(Math.round(clampedCurrent * 100)),
        [balancerId]: String(Math.round(currentWeights[balancerId] * 100))
      }));

      return currentWeights;
    });
  };

  const handleAnalizBaslat = async () => {
    if (secilenKategoriler.length > 0) {
      setIsLoading(true);
      
      // Yumuşak bir yükleme animasyonu için bekleme
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Dengelemeyi burada yap: son kategori balancer olsun
      const ids = [...secilenKategoriler];
      const maxPer = ids.length === 2 ? 0.75 : 0.5;
      const result: {[key: string]: number} = {};
      // İlk n-1'i mevcut değerlerinden clamp et
      for (let i = 0; i < ids.length; i++) {
        if (i === ids.length - 1) break;
        const id = ids[i];
        const val = kategoriAgirliklar[id] ?? 0.25;
        result[id] = Math.min(Math.max(val, 0.25), maxPer);
      }
      if (ids.length === 1) {
        result[ids[0]] = 1;
      } else {
        const balancerId = ids[ids.length - 1];
        let sumRest = Object.keys(result).reduce((s, k) => s + result[k], 0);
        let bal = 1 - sumRest;
        const balMax = maxPer;
        if (bal < 0.25) {
          // Eksik: diğerlerinden azaltıp balancer'ı 0.25'e sabitle
          const deficit = 0.25 - bal;
          // Azaltılabilir toplam
          const reducibles = ids.slice(0, -1).filter(id => result[id] > 0.25);
          let remaining = deficit;
          reducibles.forEach(id => {
            if (remaining <= 0) return;
            const canReduce = Math.min(result[id] - 0.25, remaining);
            result[id] -= canReduce;
            remaining -= canReduce;
          });
          sumRest = Object.keys(result).reduce((s, k) => s + result[k], 0);
          bal = 1 - sumRest;
        } else if (bal > balMax) {
          // Fazla: diğerlerine dağıt
          const excess = bal - balMax;
          const increasables = ids.slice(0, -1).filter(id => result[id] < maxPer);
          let remaining = excess;
          increasables.forEach(id => {
            if (remaining <= 0) return;
            const canInc = Math.min(maxPer - result[id], remaining);
            result[id] += canInc;
            remaining -= canInc;
          });
          sumRest = Object.keys(result).reduce((s, k) => s + result[k], 0);
          bal = 1 - sumRest;
        }
        // Son clamp
        result[balancerId] = Math.min(Math.max(bal, 0.25), balMax);
        // Son bir normalize (küçük kayan noktalar için)
        const total = Object.values(result).reduce((s, v) => s + v, 0) + result[balancerId];
        const finalTotal = Object.values(result).reduce((s, v) => s + v, 0) + result[balancerId];
        if (Math.abs(finalTotal - 1) > 1e-6) {
          // basitçe balancer'a farkı ekle/çıkar, cap içinde kalıyorsa
          const diff = 1 - finalTotal;
          const newBal = Math.min(Math.max(result[balancerId] + diff, 0.25), maxPer);
          result[balancerId] = newBal;
        }
      }
      onAnaliziBaslat(secilenKategoriler, result);
    }
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black py-12 px-4 relative overflow-hidden">
      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 mx-auto mb-6"
              >
                <Loader2 className="w-16 h-16 text-blue-400" />
              </motion.div>
              <motion.h3
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-2xl font-bold text-white mb-2"
              >
                Analiz Hazırlanıyor
              </motion.h3>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="text-gray-300 text-lg"
              >
                Seçtiğiniz kategoriler için detaylı rapor oluşturuluyor...
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-green-500/5" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
      
      <motion.div 
        className="max-w-7xl mx-auto relative z-10"
        animate={{ 
          opacity: isLoading ? 0.3 : 1,
          scale: isLoading ? 0.95 : 1
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Başlık Bölümü */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >

          
          <motion.h2 
            className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-100 to-gray-300 mb-4 tracking-tight leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Hangi alanlarda
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-green-400">
              analiz yapmak istiyorsunuz?
            </span>
          </motion.h2>
          
          <motion.p 
            className="text-lg md:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto font-medium"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            İlgilendiğiniz sektörleri seçin, size özel detaylı yatırım analizini hazırlayalım
          </motion.p>
        </motion.div>

        {/* Kategori Kartları */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-12"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          {kategoriYukleniyor ? (
            // Yükleme için placeholder kartlar
            Array.from({ length: 6 }, (_, index) => (
              <motion.div
                key={`loading-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group"
              >
                <Card className="bg-gradient-to-br from-gray-800/40 via-gray-900/60 to-black/80 border border-gray-700/50 h-full">
                  <CardContent className="p-4">
                    <div className="animate-pulse">
                      <div className="w-8 h-8 bg-gray-700 rounded-lg mx-auto mb-3"></div>
                      <div className="h-3 bg-gray-700 rounded mb-2"></div>
                      <div className="h-2 bg-gray-700 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            kategoriler.map((kategori, index) => {
              const isSelected = secilenKategoriler.includes(kategori.id);
              const selectionIndex = secilenKategoriler.indexOf(kategori.id);
            
            return (
              <motion.div
                key={kategori.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 + index * 0.1 }}
                whileHover={{ 
                  scale: 1.02, 
                  y: -8,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                className="group"
              >
                <Card 
                  className={`relative cursor-pointer transition-all duration-300 h-full overflow-hidden border-2 ${
                    isSelected 
                      ? 'border-blue-400/60 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-blue-500/20 shadow-xl shadow-blue-500/20' 
                      : 'border-gray-700/50 bg-gradient-to-br from-gray-800/40 via-gray-900/60 to-black/80 hover:border-gray-600/60 hover:shadow-lg hover:shadow-gray-500/10'
                  }`}
                  onClick={() => handleKategoriToggle(kategori.id)}
                >
                  {/* Seçim İndikatörü */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute top-2 right-2 z-10"
                      >
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white text-xs font-bold">{selectionIndex + 1}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Background Gradient Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-900/20 group-hover:to-gray-800/30 transition-all duration-300" />
                  
                  <CardContent className="p-4 relative z-10">
                    {/* Icon */}
                    <motion.div 
                      className="text-3xl mb-3 flex justify-center"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.2 }}
                    >
                      {kategori.icon}
                    </motion.div>
                    
                    {/* Başlık */}
                    <h3 className="text-lg font-bold text-white mb-2 text-center group-hover:text-blue-100 transition-colors">
                      {kategori.ad}
                    </h3>
                    
                    {/* Açıklama */}
                    <p className="text-gray-300 text-xs leading-relaxed text-center group-hover:text-gray-200 transition-colors">
                      {kategori.aciklama}
                    </p>
                    
                    {/* Hover Effect */}
                    <motion.div
                      className="absolute bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      initial={{ y: 10 }}
                      whileHover={{ y: 0 }}
                    >
                      <Plus className={`h-4 w-4 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
          )}
        </motion.div>

        {/* Ağırlık Ayarları - Sadece çoklu seçimde görünür */}
        <AnimatePresence>
          {secilenKategoriler.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <div className="max-w-2xl mx-auto">
                <motion.div 
                  className="bg-gradient-to-br from-gray-800/40 via-gray-900/60 to-black/80 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm"
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <h3 className="text-xl font-bold text-white mb-4 text-center">
                    🎯 Kategori Öncelik Ağırlıkları
                  </h3>
                  <p className="text-gray-300 text-sm text-center mb-6">
                    Her kategorinin analiz üzerindeki etkisini belirleyin
                  </p>
                  
                  {/* Toplam dağılım durum çubuğu */}
                  <div className="mb-5">
                    <div className="w-full h-3 bg-gray-800 rounded-md overflow-hidden border border-gray-700/50">
                      <div className="flex w-full h-full">
                        {secilenKategoriler.map((kategoriId) => {
                          const oran = (kategoriAgirliklar[kategoriId] ?? 0) * 100;
                          const renkler = [
                            'bg-blue-500',
                            'bg-purple-500',
                            'bg-green-500'
                          ];
                          const renkIndex = secilenKategoriler.indexOf(kategoriId) % renkler.length;
                          return (
                            <div key={`bar-${kategoriId}`} className={`${renkler[renkIndex]}`} style={{ width: `${Math.max(0, Math.round(oran))}%` }} />
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Dağılım</span>
                      <span>%{Math.round(Object.values(kategoriAgirliklar).reduce((s, v) => s + v, 0) * 100)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {secilenKategoriler.map((kategoriId, index) => {
                      const kategori = kategoriler.find(k => k.id === kategoriId);
                      const agirlik = kategoriAgirliklar[kategoriId] || 0;
                      const currentInput = agirlikInputlari[kategoriId] ?? String(Math.round(agirlik * 100));
                      // Maksimum: 2 kategoride %75, 3 kategoride %50
                      const otherIds = secilenKategoriler.filter(k => k !== kategoriId);
                      const allowedMax = otherIds.length === 1 ? 0.75 : 0.5;
                      
                      return (
                        <motion.div
                          key={kategoriId}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <h4 className="text-white font-semibold">{kategori?.ad}</h4>
                                <p className="text-gray-400 text-xs">{kategori?.aciklama}</p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-2 select-none">
                              <span className="text-blue-400 font-bold text-lg pointer-events-none">{Math.round(agirlik * 100)}%</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Input
                              value={currentInput}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                setAgirlikInputlari(prev => ({ ...prev, [kategoriId]: raw }));
                              }}
                              onBlur={(e) => {
                                const val = parseInt((agirlikInputlari[kategoriId] ?? '0') || '0', 10);
                                const normalized = isNaN(val) ? 0 : Math.max(25, Math.min(Math.round(allowedMax * 100), val));
                                handleAgirlikDegisimi(kategoriId, normalized / 100);
                              }}
                              className="w-20 h-9 text-right pr-2 bg-gray-900 border-gray-700 text-blue-300"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="%"
                            />
                            <span className="text-blue-400 font-bold text-sm pointer-events-none select-none">%</span>
                            <div className="ml-auto text-xs text-gray-400">min 25, max {Math.round(allowedMax * 100)}</div>
                          </div>
                          
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{Math.round(agirlik * 100)}%</span>
                            <span>→ {agirlikInputlari[kategoriId] ?? Math.round(agirlik * 100)}%</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  
                  {/* Toplam kontrol */}
                  <div className="mt-4 p-3 bg-gray-700/30 rounded-lg border border-gray-600/30">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Toplam Ağırlık:</span>
                      <span className={`font-bold ${
                        Math.abs(Object.values(kategoriAgirliklar).reduce((sum, val) => sum + val, 0) - 1) < 0.01
                          ? 'text-green-400'
                          : 'text-yellow-400'
                      }`}>
                        {Math.round(Object.values(kategoriAgirliklar).reduce((sum, val) => sum + val, 0) * 100)}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Seçim Özeti ve Aksiyon Bölümü */}
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.3 }}
        >


          {/* Butonlar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.7 }}
            className="flex flex-col sm:flex-row gap-4 items-center justify-center"
          >
            {/* Analiz Başlat Butonu */}
            <Button
              onClick={handleAnalizBaslat}
              disabled={
                secilenKategoriler.length === 0 ||
                isLoading ||
                kategoriYukleniyor ||
                (secilenKategoriler.length > 1 && (Object.values(kategoriAgirliklar).reduce((sum, val) => sum + val, 0) > 1.0001))
              }
              size="lg"
              className={`group relative px-10 py-4 text-lg font-bold rounded-full transition-all duration-300 transform ${
                secilenKategoriler.length > 0 && !isLoading && !kategoriYukleniyor
                  ? 'bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 hover:from-blue-500 hover:via-blue-600 hover:to-purple-500 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 border-0'
                  : 'bg-gray-800/60 text-gray-500 cursor-not-allowed border border-gray-700/50 backdrop-blur-sm'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Analiz Hazırlanıyor...
                </span>
              ) : kategoriYukleniyor ? (
                <span className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Kategoriler Yükleniyor...
                </span>
              ) : secilenKategoriler.length > 0 ? (
                <>
                  <span className="flex items-center gap-3">
                    {secilenKategoriler.length === 1 
                      ? 'Detaylı Analizi Başlat' 
                      : `${secilenKategoriler.length} Kategori ile Analizi Başlat`
                    }
                    <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse rounded-full" />
                </>
              ) : (
                <span className="flex items-center gap-3">
                  Bir kategori seçin
                  <CircleCheck className="h-6 w-6 opacity-50" />
                </span>
              )}
            </Button>

            {/* 2 İli Karşılaştır Butonu - Sadece tek kategori seçildiğinde görünür */}
            <AnimatePresence>
              {secilenKategoriler.length === 1 && onKarsilastirmaBaslat && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 20 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Button
                    onClick={() => onKarsilastirmaBaslat(secilenKategoriler[0])}
                    disabled={isLoading || kategoriYukleniyor}
                    size="lg"
                    variant="outline"
                    className="group relative px-8 py-4 text-lg font-bold rounded-full transition-all duration-300 transform border-2 border-green-500/60 bg-gradient-to-r from-green-600/20 via-green-700/10 to-green-600/20 hover:from-green-500/30 hover:via-green-600/20 hover:to-green-500/30 text-green-400 hover:text-green-300 shadow-xl shadow-green-500/20 hover:shadow-green-500/40 hover:scale-105 backdrop-blur-sm"
                  >
                    <span className="flex items-center gap-3">
                      <GitCompare className="h-6 w-6 group-hover:rotate-12 transition-transform" />
                      2 İli Karşılaştır
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse rounded-full" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bilgilendirme */}
          <AnimatePresence>
            {secilenKategoriler.length === 0 && !kategoriYukleniyor && (
              <motion.p 
                className="text-gray-400 text-lg mt-6 font-medium"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                Kapsamlı analiz için yukarıdaki kategorilerden 1-3 arası kategori seçin
              </motion.p>
            )}
            {secilenKategoriler.length > 0 && (
              <motion.p 
                className="text-blue-400 text-lg mt-6 font-medium"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {secilenKategoriler.length === 1 
                  ? `${kategoriler.find(k => k.id === secilenKategoriler[0])?.ad} kategorisi seçildi`
                  : `${secilenKategoriler.length} kategori seçildi (${secilenKategoriler.map(id => kategoriler.find(k => k.id === id)?.ad).join(', ')})`
                } - Analizi başlatabilirsiniz
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </section>
  );
}