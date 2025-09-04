"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Search, 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Loader2,
  GitCompare,
  Brain,
  BarChart3
} from "lucide-react";
import { Il, Kategori } from "@/lib/types";
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import { registerTurkishFont, useTurkishFont } from '@/lib/pdf';

interface IlKarsilastirma {
  il1: Il | null;
  il2: Il | null;
  kategori: string;
  karsilastirmaSonuclari?: {
    farklar: {
      [key: string]: {
        il1_deger: number;
        il2_deger: number;
        fark: number;
        yuzde_fark: number;
        daha_iyi: 'il1' | 'il2' | 'esit';
      };
    };
    genel_sonuc: string;
    ai_analizi?: string;
  };
}

function KarsilastirContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kategori = searchParams.get('kategori');
  
  const [karsilastirma, setKarsilastirma] = useState<IlKarsilastirma>({
    il1: null,
    il2: null,
    kategori: kategori || ''
  });
  
  const [arama1, setArama1] = useState("");
  const [arama2, setArama2] = useState("");
  const [ilOnerileri1, setIlOnerileri1] = useState<Il[]>([]);
  const [ilOnerileri2, setIlOnerileri2] = useState<Il[]>([]);
  const [kategoriBilgisi, setKategoriBilgisi] = useState<Kategori | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [karsilastirmaYapiliyor, setKarsilastirmaYapiliyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);

  // Kategori bilgisini yükle
  useEffect(() => {
    const fetchKategoriBilgisi = async () => {
      try {
        const response = await fetch('/api/kategoriler');
        const data = await response.json();
        if (data.success) {
          // Kategori ID'sini string olarak kontrol et
          const kategoriData = data.data.find((k: Kategori) => {
            const kId = k.id.toString();
            const searchId = kategori || '';
            return kId === searchId;
          });
          setKategoriBilgisi(kategoriData || null);
          console.log('Kategori bulundu:', kategoriData);
        }
      } catch (error) {
        console.error('Kategori bilgisi yüklenemedi:', error);
      }
    };

    if (kategori) {
      console.log('Kategori ID:', kategori);
      fetchKategoriBilgisi();
    }
  }, [kategori]);

  // İl arama fonksiyonu
  const handleIlArama = async (arama: string, setOneriler: (iller: Il[]) => void) => {
    if (arama.length < 2) {
      setOneriler([]);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/iller/by-name?q=${encodeURIComponent(arama)}`);
      const data = await response.json();
      
      if (data.success) {
        setOneriler(data.data.slice(0, 5)); // İlk 5 öneri
      } else {
        setOneriler([]);
      }
    } catch (error) {
      console.error('İl arama hatası:', error);
      setOneriler([]);
    } finally {
      setIsLoading(false);
    }
  };

  // İl seçimi
  const handleIlSec = (il: any, setter: 'il1' | 'il2') => {
    const ilData: Il = {
      il_kodu: il.il_kodu,
      il_adi: il.il_adi,
      plaka_no: il.plaka_no,
      merkez_koordinat: [il.longitude, il.latitude]
    };
    
    setKarsilastirma(prev => ({
      ...prev,
      [setter]: ilData
    }));
    
    if (setter === 'il1') {
      setArama1(il.il_adi);
      setIlOnerileri1([]);
    } else {
      setArama2(il.il_adi);
      setIlOnerileri2([]);
    }
  };

  // Karşılaştırma yap
  const handleKarsilastir = async () => {
    if (!karsilastirma.il1 || !karsilastirma.il2 || !karsilastirma.kategori) {
      return;
    }

    setKarsilastirmaYapiliyor(true);
    setHataMesaji(null);
    
    try {
      console.log('🚀 Karşılaştırma başlatılıyor:', {
        il1: karsilastirma.il1?.il_adi,
        il2: karsilastirma.il2?.il_adi,
        kategori: karsilastirma.kategori
      });
      
      const response = await fetch('/api/iller/karsilastir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          il1_id: karsilastirma.il1.il_kodu,
          il2_id: karsilastirma.il2.il_kodu,
          kategori: karsilastirma.kategori
        }),
      });

      console.log('📡 API Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 API Response data:', data);
      
      if (data.success) {
        console.log('✅ API başarılı, veri:', data.data);
        setKarsilastirma(prev => ({
          ...prev,
          karsilastirmaSonuclari: data.data
        }));
        console.log('✅ State güncellendi');
      } else {
        console.error('❌ Karşılaştırma hatası:', data.message);
        setHataMesaji(data.message || 'Karşılaştırma sırasında bir hata oluştu');
      }
    } catch (error) {
      console.error('❌ Karşılaştırma API hatası:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          setHataMesaji('Sunucuya bağlanırken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.');
        } else if (error.message.includes('HTTP 500')) {
          setHataMesaji('Sunucu hatası. Lütfen birkaç dakika sonra tekrar deneyin.');
        } else {
          setHataMesaji(`Hata: ${error.message}`);
        }
      } else {
        setHataMesaji('Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setKarsilastirmaYapiliyor(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900/80 to-black/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Geri Dön
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <GitCompare className="h-6 w-6 text-green-400" />
                  İl Karşılaştırması
                </h1>
                {kategoriBilgisi && (
                  <p className="text-gray-400 mt-1">
                    {kategoriBilgisi.icon} {kategoriBilgisi.ad} kategorisinde karşılaştırma
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* İl Seçimi Bölümü */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"
        >
          {/* İl 1 Seçimi */}
          <Card className="bg-gradient-to-br from-gray-800/40 via-gray-900/60 to-black/80 border border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-400" />
                İl 1
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input
                  value={arama1}
                  onChange={(e) => {
                    setArama1(e.target.value);
                    handleIlArama(e.target.value, setIlOnerileri1);
                  }}
                  placeholder="İl adı yazın..."
                  className="bg-gray-900/50 border-gray-700 text-white placeholder-gray-400"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                
                {/* Öneriler */}
                <AnimatePresence>
                  {ilOnerileri1.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10"
                    >
                      {ilOnerileri1.map((il) => (
                        <button
                          key={il.il_kodu}
                          onClick={() => handleIlSec(il, 'il1')}
                          className="w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                        >
                          <div className="text-white font-medium">{il.il_adi}</div>
                          <div className="text-gray-400 text-sm">Plaka: {il.plaka_no}</div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {karsilastirma.il1 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg"
                >
                  <div className="text-blue-400 font-medium">{karsilastirma.il1.il_adi}</div>
                  <div className="text-blue-300 text-sm">Plaka: {karsilastirma.il1.plaka_no}</div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* İl 2 Seçimi */}
          <Card className="bg-gradient-to-br from-gray-800/40 via-gray-900/60 to-black/80 border border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-400" />
                İl 2
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input
                  value={arama2}
                  onChange={(e) => {
                    setArama2(e.target.value);
                    handleIlArama(e.target.value, setIlOnerileri2);
                  }}
                  placeholder="İl adı yazın..."
                  className="bg-gray-900/50 border-gray-700 text-white placeholder-gray-400"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                
                {/* Öneriler */}
                <AnimatePresence>
                  {ilOnerileri2.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10"
                    >
                      {ilOnerileri2.map((il) => (
                        <button
                          key={il.il_kodu}
                          onClick={() => handleIlSec(il, 'il2')}
                          className="w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                        >
                          <div className="text-white font-medium">{il.il_adi}</div>
                          <div className="text-gray-400 text-sm">Plaka: {il.plaka_no}</div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {karsilastirma.il2 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg"
                >
                  <div className="text-purple-400 font-medium">{karsilastirma.il2.il_adi}</div>
                  <div className="text-purple-300 text-sm">Plaka: {karsilastirma.il2.plaka_no}</div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Karşılaştır Butonu */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-8"
        >
          <Button
            onClick={handleKarsilastir}
            disabled={!karsilastirma.il1 || !karsilastirma.il2 || karsilastirmaYapiliyor}
            size="lg"
            className="px-8 py-4 text-lg font-bold rounded-full bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 hover:from-green-500 hover:via-green-600 hover:to-emerald-500 text-white shadow-xl shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 transition-all duration-300"
          >
            {karsilastirmaYapiliyor ? (
              <span className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                Karşılaştırılıyor...
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <GitCompare className="h-6 w-6" />
                Karşılaştırmayı Başlat
              </span>
            )}
          </Button>
        </motion.div>

        {/* Hata Mesajı */}
        {hataMesaji && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-br from-red-900/40 via-red-800/60 to-red-900/80 border border-red-700/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-red-400">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="font-medium">Hata:</span>
                  <span>{hataMesaji}</span>
                </div>
                <div className="mt-2 text-red-300 text-sm">
                  Lütfen birkaç dakika sonra tekrar deneyin.
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Karşılaştırma Sonuçları */}
        <AnimatePresence>
          {karsilastirma.karsilastirmaSonuclari && (
            console.log('Render ediliyor - karsilastirmaSonuclari:', karsilastirma.karsilastirmaSonuclari),
            console.log('Render ediliyor - farklar:', karsilastirma.karsilastirmaSonuclari.farklar),
            console.log('Farklar var mı?', !!karsilastirma.karsilastirmaSonuclari.farklar),
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              

              

              {/* Indicator Karşılaştırma Tablosu */}
              {karsilastirma.karsilastirmaSonuclari.farklar && (
                <Card className="bg-gradient-to-br from-gray-800/40 via-gray-900/60 to-black/80 border border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-400" />
                      Indicator Karşılaştırması
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left py-3 px-4 text-gray-300 font-medium">Indicator</th>
                            <th className="text-center py-3 px-4 text-blue-400 font-medium">
                              {karsilastirma.il1?.il_adi}
                            </th>
                            <th className="text-center py-3 px-4 text-purple-400 font-medium">
                              {karsilastirma.il2?.il_adi}
                            </th>
                            <th className="text-center py-3 px-4 text-gray-300 font-medium">Fark</th>
                            <th className="text-center py-3 px-4 text-gray-300 font-medium">% Fark</th>
                            <th className="text-center py-3 px-4 text-gray-300 font-medium">Daha İyi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(karsilastirma.karsilastirmaSonuclari.farklar).map(([indicatorName, data]: [string, any]) => {
                            const isInvestmentScore = ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'].includes(indicatorName);
                            
                            // Indicator isimlerini Türkçe'ye çevir
                            const indicatorDisplayName = isInvestmentScore ? 
                              indicatorName === 'current_status_score' ? 'Mevcut Durum Skoru' :
                              indicatorName === 'trend_score' ? 'Trend Skoru' :
                              indicatorName === 'attractiveness_score' ? 'Çekicilik Skoru' :
                              indicatorName === 'priority_score' ? 'Öncelik Skoru' :
                              indicatorName === 'ortalama_skor' ? 'Ortalama Skor' :
                              indicatorName.replace(/_/g, ' ')
                              : indicatorName;

                            const getBetterIcon = (dahaIyi: string) => {
                              if (dahaIyi === 'il1') return <TrendingUp className="h-4 w-4 text-blue-400" />;
                              if (dahaIyi === 'il2') return <TrendingUp className="h-4 w-4 text-purple-400" />;
                              return <Minus className="h-4 w-4 text-gray-400" />;
                            };

                            const getBetterText = (dahaIyi: string) => {
                              if (dahaIyi === 'il1') return karsilastirma.il1?.il_adi;
                              if (dahaIyi === 'il2') return karsilastirma.il2?.il_adi;
                              return 'Eşit';
                            };

                            const formatValue = (value: any, unit?: string) => {
                              // Değeri number'a çevir
                              const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                              
                              if (isInvestmentScore) {
                                return numValue.toFixed(1);
                              }
                              if (typeof numValue === 'number' && !isNaN(numValue)) {
                                if (numValue >= 1000000) {
                                  return `${(numValue / 1000000).toFixed(1)}M`;
                                } else if (numValue >= 1000) {
                                  return `${(numValue / 1000).toFixed(1)}K`;
                                }
                                return numValue.toFixed(1);
                              }
                              return value?.toString() || '0';
                            };

                            return (
                              <tr key={indicatorName} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                <td className="py-3 px-4 text-gray-300 font-medium">
                                  {indicatorDisplayName}
                                  {data.unit && !isInvestmentScore && (
                                    <span className="text-gray-500 text-xs ml-1">({data.unit})</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center text-blue-400 font-medium">
                                  {formatValue(data.il1_deger, data.unit)}
                                </td>
                                <td className="py-3 px-4 text-center text-purple-400 font-medium">
                                  {formatValue(data.il2_deger, data.unit)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`font-medium ${
                                    data.fark > 0 ? 'text-green-400' : 
                                    data.fark < 0 ? 'text-red-400' : 
                                    'text-gray-400'
                                  }`}>
                                    {data.fark > 0 ? '+' : ''}{formatValue(data.fark, data.unit)}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`font-medium ${
                                    data.yuzde_fark > 0 ? 'text-green-400' : 
                                    data.yuzde_fark < 0 ? 'text-red-400' : 
                                    'text-gray-400'
                                  }`}>
                                    {data.yuzde_fark > 0 ? '+' : ''}{data.yuzde_fark.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    {getBetterIcon(data.daha_iyi)}
                                    <span className="text-gray-300 text-xs">
                                      {getBetterText(data.daha_iyi)}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Analizi */}
              {karsilastirma.karsilastirmaSonuclari.ai_analizi && (
                <Card className="bg-gradient-to-br from-gray-800/40 via-gray-900/60 to-black/80 border border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Brain className="h-5 w-5 text-green-400" />
                      Yapay Zeka Analizi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert prose-lg max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-xl font-bold text-green-400 mb-3 mt-5">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-lg font-semibold text-blue-400 mb-2 mt-4">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="text-gray-300 mb-4 leading-relaxed">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                              {children}
                            </ul>
                          ),
                          li: ({ children }) => (
                            <li className="text-gray-300 leading-relaxed">
                              {children}
                            </li>
                          ),
                          strong: ({ children }) => (
                            <strong className="text-white font-semibold">
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => (
                            <em className="text-gray-200 italic">
                              {children}
                            </em>
                          ),
                        }}
                      >
                        {karsilastirma.karsilastirmaSonuclari.ai_analizi}
                      </ReactMarkdown>
                    </div>
                    
                    {/* PDF İndirme Butonu */}
                    <div className="mt-6 pt-4 border-t border-gray-700">
                      <Button 
                        onClick={() => {
                          // HTML raporu oluştur
                          const htmlContent = `
                            <!DOCTYPE html>
                            <html lang="tr">
                            <head>
                              <meta charset="UTF-8">
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                              <title>${karsilastirma.il1?.il_adi} vs ${karsilastirma.il2?.il_adi} Karşılaştırma Analizi</title>
                              <style>
                                @page {
                                  margin: 2cm;
                                  size: A4;
                                }
                                body {
                                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                  line-height: 1.6;
                                  color: #333;
                                  max-width: 800px;
                                  margin: 0 auto;
                                  background: #f8f9fa;
                                }
                                .header {
                                  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                                  color: white;
                                  padding: 30px;
                                  border-radius: 10px;
                                  margin-bottom: 30px;
                                  text-align: center;
                                }
                                .header h1 {
                                  margin: 0;
                                  font-size: 28px;
                                  font-weight: bold;
                                }
                                .header .subtitle {
                                  margin: 10px 0 0 0;
                                  font-size: 16px;
                                  opacity: 0.9;
                                }
                                .content {
                                  background: white;
                                  padding: 30px;
                                  border-radius: 10px;
                                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                                }
                                .analysis-title {
                                  color: #8b5cf6;
                                  font-size: 20px;
                                  font-weight: bold;
                                  margin-bottom: 20px;
                                  border-bottom: 2px solid #8b5cf6;
                                  padding-bottom: 10px;
                                }
                                .paragraph {
                                  margin-bottom: 15px;
                                  text-align: justify;
                                }
                                .heading {
                                  color: #8b5cf6;
                                  font-weight: bold;
                                  font-size: 16px;
                                  margin: 20px 0 10px 0;
                                  border-left: 4px solid #8b5cf6;
                                  padding-left: 15px;
                                }
                                .footer {
                                  margin-top: 40px;
                                  padding-top: 20px;
                                  border-top: 1px solid #e5e7eb;
                                  font-size: 12px;
                                  color: #6b7280;
                                  text-align: center;
                                }
                                @media print {
                                  body { background: white; }
                                  .header { background: #8b5cf6 !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h1>${karsilastirma.il1?.il_adi} vs ${karsilastirma.il2?.il_adi}</h1>
                                <div class="subtitle">Karşılaştırma Analizi</div>
                                <div class="subtitle">
                                  Kategori: ${kategoriBilgisi?.ad || 'Bilinmeyen'} | Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}
                                </div>
                              </div>
                              
                              <div class="content">
                                <div class="analysis-title">Yapay Zeka Karşılaştırma Analizi</div>
                                <div class="analysis-content">
                                  ${(karsilastirma.karsilastirmaSonuclari.ai_analizi || '')
                                    .replace(/##\s*/g, '<div class="heading">')
                                    .replace(/###\s*/g, '<div class="heading">')
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                    .replace(/\n\n/g, '</div><div class="paragraph">')
                                    .replace(/\n/g, '<br>')
                                    .split('\n')
                                    .map(p => p.trim() ? `<div class="paragraph">${p}</div>` : '')
                                    .join('')
                                  }
                                </div>
                                
                                <div class="footer">
                                  <p>Bu rapor yapay zeka tarafından oluşturulmuştur.</p>
                                  <p>Teknofest Yatırım Analiz Platformu</p>
                                </div>
                              </div>
                            </body>
                            </html>
                          `;
                          
                          // Yeni pencerede aç
                          const newWindow = window.open('', '_blank');
                          newWindow.document.write(htmlContent);
                          newWindow.document.close();
                          
                          // Yazdırma seçeneği sun
                          setTimeout(() => {
                            newWindow.print();
                          }, 500);
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        📄 Raporu Yazdır (HTML)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Loading component for Suspense fallback
function KarsilastirLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-4" />
            <p className="text-gray-300">Sayfa yükleniyor...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function KarsilastirPage() {
  return (
    <Suspense fallback={<KarsilastirLoading />}>
      <KarsilastirContent />
    </Suspense>
  );
}
