"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ArrowLeft, TrendingUp, MapPin, BarChart3, PieChart, Info, Target, Star, Calendar, Award, Zap, Users, Loader2, Settings } from "lucide-react";
import jsPDF from 'jspdf';
import { registerTurkishFont, useTurkishFont, addTurkishText } from '@/lib/pdf';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Pie, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Area, AreaChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from "recharts";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { IlDetay } from "@/lib/types";
import maplibregl from 'maplibre-gl';

// GeoJSON il adından API il adına dönüştürme
function getApiIlAdi(geoJsonIlAdi: string): string {
  const mapping: { [key: string]: string } = {
    'Afyon': 'Afyonkarahisar',
    'Kahramanmaraş': 'Kahramanmaraş',
    'Şanlıurfa': 'Şanlıurfa',
    'Zonguldak': 'Zonguldak'
  };
  
  return mapping[geoJsonIlAdi] || geoJsonIlAdi;
}

// API il adından GeoJSON il adına dönüştürme
function getGeoJsonIlAdi(apiIlAdi: string): string {
  const reverseMapping: { [key: string]: string } = {
    'Afyonkarahisar': 'Afyon',
    'Kahramanmaraş': 'Kahramanmaraş',
    'Şanlıurfa': 'Şanlıurfa', 
    'Zonguldak': 'Zonguldak'
  };
  
  return reverseMapping[apiIlAdi] || apiIlAdi;
}

// Skor bazında renk hesaplama fonksiyonu (8 seviye - keskin farklar)
function getSkorColor(skor: number): string {
  // 0-1 arası skor değerini 8 seviye kırmızı tonlamasına çevir
  // YÜKSEK SKOR = KOYU KIRMIZI, DÜŞÜK SKOR = AÇIK/ŞEFFAF
  
  // Debug için log ekle
  if (Math.random() < 0.01) { // %1 ihtimalle log at (spam önlemek için)
    console.log(`🎨 Renk hesaplaması (8 seviye): skor=${skor} -> renk=${
      skor >= 0.875 ? '#7F1D1D' : 
      skor >= 0.75 ? '#991B1B' : 
      skor >= 0.625 ? '#B91C1C' : 
      skor >= 0.5 ? '#DC2626' : 
      skor >= 0.375 ? '#EF4444' : 
      skor >= 0.25 ? '#F87171' : 
      skor >= 0.125 ? '#FCA5A5' : '#FEE2E2'
    }`);
  }
  
  // 8 seviye renk gradasyonu (0-1 arası skor için)
  if (skor >= 0.875) return '#7F1D1D'; // En koyu kırmızı (87.5%+)
  if (skor >= 0.75) return '#991B1B';  // Çok koyu kırmızı (75-87.5%)
  if (skor >= 0.625) return '#B91C1C'; // Koyu kırmızı (62.5-75%)
  if (skor >= 0.5) return '#DC2626';   // Orta koyu kırmızı (50-62.5%)
  if (skor >= 0.375) return '#EF4444'; // Orta kırmızı (37.5-50%)
  if (skor >= 0.25) return '#F87171';  // Açık kırmızı (25-37.5%)
  if (skor >= 0.125) return '#FCA5A5'; // Çok açık kırmızı (12.5-25%)
  return '#FEE2E2'; // En açık pembe-kırmızı (0-12.5%)
}

// MapLibre GL Harita Komponenti
function TurkeyMap({ onIlClick, ilSkorlari, tamamenHazir, secilenSektor, onRenklerUygulandi, onMapReady, disableFocusLock }: { 
  onIlClick: (ilAdi: string) => void;
  ilSkorlari: { [key: string]: number };
  tamamenHazir: boolean;
  secilenSektor: 'kamu' | 'ozel';
  onRenklerUygulandi?: () => void;
  onMapReady?: (resetFunction: () => void) => void;
  disableFocusLock?: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentViewRef = useRef<{center: [number, number], zoom: number} | null>(null);
  const focusLockDisabled = useRef<boolean>(false); // Ağırlık değişimi sırasında focus lock'ı devre dışı bırak

  // disableFocusLock prop'unu effect ile dinle
  useEffect(() => {
    focusLockDisabled.current = disableFocusLock || false;
  }, [disableFocusLock]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log('MapLibre haritası başlatılıyor...');

    // MapLibre haritasını başlat
    try {
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: [
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm'
            }
          ]
        },
        center: [35.0, 39.0], // Türkiye merkez koordinatları
        zoom: 5.5,
        maxZoom: 12,
        minZoom: 4,
        pitch: 0,
        bearing: 0
      });

      console.log('MapLibre haritası başarıyla oluşturuldu');
    } catch (error) {
      console.error('MapLibre harita oluşturulurken hata:', error);
      return;
    }

    // Harita yüklenme olayını dinle
    // Popup'ı başlat
    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'custom-popup'
    });

    // Style ve kaynak değişikliklerini dinle - renkleri korumak için
    mapRef.current.on('styledata', () => {
      console.log('🔄 Style değişti, renkleri korumaya çalışıyorum...');
    });

    mapRef.current.on('sourcedata', () => {
      console.log('🔄 Source data değişti...');
    });

    mapRef.current.on('load', () => {
      console.log('🗺️ MapLibre haritası yüklendi');
      console.log('Mevcut layerlar:', mapRef.current!.getStyle().layers?.map(l => l.id));
      // setMapLoaded burada değil, GeoJSON yüklendikten sonra yapılacak

      // Türkiye il sınırları ekle - Style yüklendikten sonra
      const loadGeoJSON = () => {
                console.log('GeoJSON verisi yükleniyor...');
          fetch('/data/turkey-provinces.geojson')
        .then(response => {
          console.log('GeoJSON response:', response.status);
          return response.json();
        })
        .then(data => {
          console.log('GeoJSON verisi yüklendi:', data);
          if (!mapRef.current) return;

            // Style'ın yüklenip yüklenmediğini kontrol et
            if (!mapRef.current.isStyleLoaded()) {
              console.log('Style henüz yüklenmedi, bekleniyor...');
              mapRef.current.once('styledata', () => loadGeoJSON());
              return;
            }

          // İl sınırları source'u ekle (zaten varsa ekleme)
          if (!mapRef.current.getSource('turkiye-iller')) {
            mapRef.current.addSource('turkiye-iller', {
              type: 'geojson',
              data: data
            });
          }

          // İl sınırları layer'ı ekle - initial gri renk (zaten varsa ekleme)
          if (!mapRef.current.getLayer('iller-fill')) {
            mapRef.current.addLayer({
              id: 'iller-fill',
              type: 'fill',
              source: 'turkiye-iller',
              paint: {
                'fill-color': '#6B7280', // Initial gri renk - skorlar gelene kadar
                'fill-opacity': 0.7
              }
            });
          }

          // İl sınırları çizgisi ekle (zaten varsa ekleme)
          if (!mapRef.current.getLayer('iller-outline')) {
            mapRef.current.addLayer({
              id: 'iller-outline',
              type: 'line',
              source: 'turkiye-iller',
              paint: {
               'line-color': '#000000',
                'line-width': 1,
                'line-opacity': 0.8
              }
            });
          }

          // Hover efekti için layer ekle (zaten varsa ekleme)
          if (!mapRef.current.getLayer('iller-hover')) {
            mapRef.current.addLayer({
              id: 'iller-hover',
              type: 'fill',
              source: 'turkiye-iller',
              paint: {
                'fill-color': '#FFFFFF',
                'fill-opacity': 0.2
              },
              filter: ['==', 'name', '']
            });
          }

          // Mouse move eventi - hover efekti ve popup
          mapRef.current.on('mousemove', 'iller-fill', (e) => {
            if (!mapRef.current || !e.features || e.features.length === 0) return;
            
            const feature = e.features[0];
            const geoJsonIlAdi = feature.properties?.name || 'Bilinmiyor';
            const apiIlAdi = getApiIlAdi(geoJsonIlAdi);
            
                         // Gerçek skoru al; skorlar henüz yüklenmemişse popup gösterme
             const skorValue = ilSkorlari[apiIlAdi];
             if (typeof skorValue !== 'number' || Number.isNaN(skorValue) || Object.keys(ilSkorlari).length === 0) {
               return;
             }
             const gercekSkor = Math.max(0, Math.min(1, skorValue));
            const skorYuzde = Math.round(gercekSkor * 100);
            const renk = getSkorColor(gercekSkor);

            // Cursor'u pointer yap
            mapRef.current.getCanvas().style.cursor = 'pointer';
            
            // Hover efektini göster
            mapRef.current.setFilter('iller-hover', ['==', 'name', geoJsonIlAdi]);

            // Popup göster
            popup.current
              .setLngLat(e.lngLat)
              .setHTML(`
                <div class="bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-gray-700">
                  <div class="font-semibold text-lg">${apiIlAdi}</div>
                  <div class="text-gray-300 text-sm">Yatırım Skoru: %${skorYuzde}</div>
                  <div class="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div class="h-2 rounded-full" style="width: ${skorYuzde}%; background-color: ${renk}"></div>
                  </div>
                </div>
              `)
              .addTo(mapRef.current);
          });

          // Mouse leave eventi
          mapRef.current.on('mouseleave', 'iller-fill', () => {
            if (!mapRef.current) return;
            mapRef.current.getCanvas().style.cursor = '';
            mapRef.current.setFilter('iller-hover', ['==', 'name', '']);
            if (popup.current) {
              popup.current.remove();
            }
          });

          // Click eventi - il detaylarını göster
          mapRef.current.on('click', 'iller-fill', async (e) => {
            if (e.features && e.features[0]) {
              const feature = e.features[0];
              const geoJsonIlAdi = feature.properties.name;
              const apiIlAdi = getApiIlAdi(geoJsonIlAdi);
              
              // İl geometrisinin merkezini hesapla ve haritayı oraya focus et
              if (feature.geometry && feature.geometry.type === 'Polygon') {
                const coordinates = feature.geometry.coordinates[0];
                let minLng = Infinity, maxLng = -Infinity;
                let minLat = Infinity, maxLat = -Infinity;
                
                // Bounding box hesapla
                coordinates.forEach((coord: [number, number]) => {
                  const [lng, lat] = coord;
                  minLng = Math.min(minLng, lng);
                  maxLng = Math.max(maxLng, lng);
                  minLat = Math.min(minLat, lat);
                  maxLat = Math.max(maxLat, lat);
                });
                
                // Merkez koordinatları
                const centerLng = (minLng + maxLng) / 2;
                const centerLat = (minLat + maxLat) / 2;
                
                // Zoom seviyesini il büyüklüğüne göre ayarla
                const latDiff = maxLat - minLat;
                const lngDiff = maxLng - minLng;
                const maxDiff = Math.max(latDiff, lngDiff);
                
                let zoomLevel = 8; // Default zoom
                if (maxDiff < 0.5) zoomLevel = 9;       // Küçük iller (ör: Yalova)
                else if (maxDiff < 1) zoomLevel = 8.5;  // Orta boyut iller
                else if (maxDiff < 2) zoomLevel = 8;    // Büyük iller  
                else zoomLevel = 7.5;                   // Çok büyük iller (ör: Konya)
                
                console.log(`🎯 ${geoJsonIlAdi} iline focus yapılıyor: [${centerLng.toFixed(3)}, ${centerLat.toFixed(3)}] zoom: ${zoomLevel}`);
                
                // Mevcut görünümü sakla
                currentViewRef.current = {
                  center: [centerLng, centerLat],
                  zoom: zoomLevel
                };
                
                // Smooth animation ile focus et
                mapRef.current.flyTo({
                  center: [centerLng, centerLat],
                  zoom: zoomLevel,
                  duration: 1500, // 1.5 saniye animasyon
                  curve: 1.2,     // Smooth curve
                  easing: (t) => t * (2 - t) // Ease-out effect
                });
              }
              
              // İl adını ID'ye çevir
              console.log('🔍 İl tıklandı:', geoJsonIlAdi, '→ API adı:', apiIlAdi);
              try {
                const apiUrl = `/api/iller/by-name?name=${encodeURIComponent(apiIlAdi)}`;
                console.log('📡 API isteği:', apiUrl);
                const response = await fetch(apiUrl);
                console.log('📡 Response status:', response.status, response.statusText);
                
                if (!response.ok) {
                  console.error('❌ API isteği başarısız:', response.status, response.statusText);
                  onIlClick(apiIlAdi);
                  return;
                }
                
                const data = await response.json();
                console.log('📨 API yanıtı:', data);
                
                if (data.success && data.data && data.data.length > 0 && data.data[0].il_kodu) {
                  console.log('✅ İl ID bulundu:', data.data[0].il_kodu);
                  onIlClick(data.data[0].il_kodu.toString());
                } else {
                  console.error('❌ İl ID bulunamadı:', apiIlAdi, 'API yanıtı:', data);
                  // Fallback olarak il adını direkt kullan
                  onIlClick(apiIlAdi);
                }
              } catch (error) {
                console.error('💥 İl ID çevirme hatası:', error);
                // Fallback olarak il adını direkt kullan  
                onIlClick(apiIlAdi);
              }
            }
          });

          // Map yükleme tamamlandı
          console.log('✅ Harita kurulumu tamamlandı. 81 il yüklendi.');
          
          // Reset fonksiyonunu parent'a aktar
          const resetMapView = () => {
            if (mapRef.current) {
              // Focus'u temizle
              currentViewRef.current = null;
              
              mapRef.current.flyTo({
                center: [35.0, 39.0], // Türkiye merkez koordinatları
                zoom: 5.5,
                duration: 1200,
                curve: 1.2,
                easing: (t) => t * (2 - t)
              });
            }
          };
          
          if (onMapReady) {
            onMapReady(resetMapView);
          }
          
          // GeoJSON feature'larının name property'lerini kontrol et
          const source = mapRef.current.getSource('turkiye-iller');
          if (source && 'serialize' in source) {
            const sourceData = (source as any)._data;
            if (sourceData && sourceData.features) {
              console.log('📋 İlk 10 GeoJSON il adı:', 
                sourceData.features.slice(0, 10).map((f: any) => f.properties?.name)
              );
            }
          }
          
          // Artık harita gerçekten hazır - mapLoaded'i true yap
          setMapLoaded(true);
          console.log('🚀 mapLoaded = true yapıldı');
        })
        .catch(error => {
          console.error('GeoJSON verisi yüklenirken hata:', error);
        });
      };

      // Style yüklü mü kontrol et ve loadGeoJSON'ı çağır
      if (mapRef.current.isStyleLoaded()) {
        loadGeoJSON();
      } else {
        mapRef.current.once('styledata', loadGeoJSON);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [onIlClick]);

  // İl skorları güncellendiğinde renkleri güncelle
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || Object.keys(ilSkorlari).length === 0) {
      console.log('❌ Renk güncelleme koşulları sağlanmadı:', {
        mapRef: !!mapRef.current,
        mapLoaded,
        skorSayisi: Object.keys(ilSkorlari).length
      });
      return;
    }

    console.log('🎨 Harita renkleri güncelleniyor, skor sayısı:', Object.keys(ilSkorlari).length);
    console.log('📊 İlk 5 skor:', Object.entries(ilSkorlari).slice(0, 5));

    // Style ve layer yüklenme durumunu kontrol et
    if (!mapRef.current.isStyleLoaded() || !mapRef.current.getLayer('iller-fill')) {
      console.log('⏳ Style veya layer henüz yüklenmedi, bekleniyor...');
      
      const checkAndUpdate = () => {
        if (mapRef.current && mapRef.current.isStyleLoaded() && mapRef.current.getLayer('iller-fill') && Object.keys(ilSkorlari).length > 0) {
          console.log('✅ Style ve layer hazır, renkleri güncelliyorum...');
          updateMapColors();
        }
      };
      
      mapRef.current.once('styledata', checkAndUpdate);
      mapRef.current.once('sourcedata', checkAndUpdate);
      return;
    }

    updateMapColors();

    function updateMapColors() {
      if (!mapRef.current) return;

      console.log('Renk güncelleme fonksiyonu çağrıldı, skor sayısı:', Object.keys(ilSkorlari).length);

      // MapLibre expression oluştur
      const colorExpression: any = ['case'];
      let expressionCount = 0;
      
      Object.entries(ilSkorlari).forEach(([apiIlAdi, skor]) => {
        const renk = getSkorColor(skor);
        const geoJsonIlAdi = getGeoJsonIlAdi(apiIlAdi);
        
        // Her iki format için de expression ekle (güvenlik için)
        // 1. API il adı ile
        colorExpression.push(['==', ['get', 'name'], apiIlAdi]);
        colorExpression.push(renk);
        expressionCount++;
        
        // 2. GeoJSON il adı ile (eğer farklıysa)
        if (geoJsonIlAdi !== apiIlAdi) {
          colorExpression.push(['==', ['get', 'name'], geoJsonIlAdi]);
          colorExpression.push(renk);
          expressionCount++;
          console.log(`📝 İkili mapping: ${apiIlAdi} -> ${geoJsonIlAdi}`);
        }
        
        console.log(`🎨 ${apiIlAdi}: skor=${skor.toFixed(3)}, renk=${renk}`);
        
        // İlk 3 il için detaylı debug
        if (['Adana', 'Adıyaman', 'Afyonkarahisar'].includes(apiIlAdi)) {
          console.log(`🔍 ${apiIlAdi} detay:`, {
            skor: skor,
            renk: renk,
            geoJsonAdi: geoJsonIlAdi,
            expression_entries: expressionCount
          });
        }
      });
      
      // Varsayılan renk ekle
      colorExpression.push('#6B7280');

      try {
        // Layer'ın var olduğunu sağlam kontrol et
        const layer = mapRef.current.getLayer('iller-fill');
        const source = mapRef.current.getSource('turkiye-iller');
        
        console.log('🔍 Layer kontrolü:', {
          layerExists: !!layer,
          sourceExists: !!source,
          mapLoaded: mapLoaded
        });
        
        if (!layer) {
          console.error('❌ iller-fill layer bulunamadı!');
          console.log('📋 Mevcut layerlar:', mapRef.current.getStyle().layers?.map(l => l.id));
          return;
        }
        
        if (!source) {
          console.error('❌ turkiye-iller source bulunamadı!');
          return;
        }
        
        console.log('🔧 Color Expression örnek:', colorExpression.slice(0, 10));
        console.log('🔧 Expression uzunluğu:', colorExpression.length);
        console.log('🔧 Expression entry sayısı:', expressionCount);
        console.log('🔧 Beklenen entry sayısı:', Object.keys(ilSkorlari).length * 2);
        
        // Expression'ı uygula
        console.log('🔧 Expression uygulanıyor...');
        mapRef.current.setPaintProperty('iller-fill', 'fill-color', colorExpression);
        console.log('✅ Expression başarıyla uygulandı!');
        
        // Haritayı yeniden çiz
        mapRef.current.triggerRepaint();
        
        // Renkler uygulandığını parent'a bildir
        console.log('📞 Ana useEffect: onRenklerUygulandi callback çağrılıyor...');
        onRenklerUygulandi?.();
        console.log('✅ Ana useEffect: Callback çağrıldı');
        
      } catch (error) {
        console.error('❌ Harita renkleri güncellenirken hata:', error);
        console.error('Error details:', error);
      }
    }
  }, [ilSkorlari, mapLoaded, onRenklerUygulandi]);
  
  // İl skorları için ayrı bir effect - force update + sürekli kontrol
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || Object.keys(ilSkorlari).length === 0) return;

    console.log('🔄 Force renk güncellemesi ve sürekli kontrol başlatılıyor');
    
    // Renk uygulama fonksiyonu
    const applyColors = () => {
      if (!mapRef.current || !mapRef.current.getLayer('iller-fill')) return;
      
          const colorExpression: any = ['case'];
          
          Object.entries(ilSkorlari).forEach(([apiIlAdi, skor]) => {
            const renk = getSkorColor(skor);
        const geoJsonIlAdi = getGeoJsonIlAdi(apiIlAdi);
            
        // Her iki format için de expression ekle
            colorExpression.push(['==', ['get', 'name'], apiIlAdi]);
            colorExpression.push(renk);
            
        // GeoJSON il adı ile (eğer farklıysa)
        if (geoJsonIlAdi !== apiIlAdi) {
          colorExpression.push(['==', ['get', 'name'], geoJsonIlAdi]);
              colorExpression.push(renk);
            }
          });
          
          colorExpression.push('#6B7280');
          
          try {
            mapRef.current.setPaintProperty('iller-fill', 'fill-color', colorExpression);
        console.log('🎉 Renk başarıyla uygulandı!');
        
        // Başarılı olduğunda callback'i çağır
        if (onRenklerUygulandi) {
          onRenklerUygulandi();
          console.log('✅ Callback tetiklendi - loading kapanacak');
        }
        
        return true;
          } catch (error) {
        console.error('❌ Renk uygulama hatası:', error);
        return false;
      }
    };

    // İlk uygulama - daha hızlı
    setTimeout(() => applyColors(), 100);
    
    // Birkaç kez daha deneyelim, emin olmak için
    setTimeout(() => applyColors(), 300);
    setTimeout(() => applyColors(), 600);
    
    // Sürekli kontrol - her 3 saniyede renklerin hala doğru olup olmadığını kontrol et
    const intervalId = setInterval(() => {
      try {
        if (mapRef.current && mapRef.current.getLayer('iller-fill') && Object.keys(ilSkorlari).length > 0) {
          // Mevcut rengi kontrol et
          const currentColor = mapRef.current.getPaintProperty('iller-fill', 'fill-color');
          
          // Eğer varsayılan griye dönmüşse, renkleri yeniden uygula
          if (currentColor === '#6B7280' || !currentColor || typeof currentColor === 'string') {
            console.log('🔄 Renkler kaybolmuş, yeniden uygulanıyor...');
            applyColors();
            onRenklerUygulandi?.();
          }
        }
      } catch (error) {
        console.error('⚠️ Interval renk kontrolü hatası:', error);
      }
    }, 3000); // 3 saniye interval

    return () => {
      clearInterval(intervalId);
    };
  }, [ilSkorlari, mapLoaded]);

  // Harita boyut değişimini handle et - immediate resize için
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        // Immediate resize - debounce kaldırıldı
        mapRef.current.resize();
        
        // Resize sonrası görünümü ve renkleri kontrol et
        setTimeout(() => {
          if (mapRef.current) {
            // Eğer focus'lanmış bir görünüm varsa onu koru (ağırlık değişimi sırasında değil)
            if (currentViewRef.current && !focusLockDisabled.current) {
              const currentMapCenter = mapRef.current.getCenter();
              const currentMapZoom = mapRef.current.getZoom();
              
              // Eğer harita mevcut focus'tan farklı bir yerdeyse tekrar focus et
              const centerDiff = Math.abs(currentMapCenter.lng - currentViewRef.current.center[0]) + 
                                Math.abs(currentMapCenter.lat - currentViewRef.current.center[1]);
              const zoomDiff = Math.abs(currentMapZoom - currentViewRef.current.zoom);
              
              if (centerDiff > 0.1 || zoomDiff > 0.2) {
                console.log('🔄 Resize sonrası focus korunuyor:', currentViewRef.current);
                mapRef.current.setCenter(currentViewRef.current.center);
                mapRef.current.setZoom(currentViewRef.current.zoom);
              }
            }
            
            // Renkleri kontrol et
            if (Object.keys(ilSkorlari).length > 0) {
              const layer = mapRef.current.getLayer('iller-fill');
              if (layer) {
                const currentColor = mapRef.current.getPaintProperty('iller-fill', 'fill-color');
                if (currentColor === '#6B7280' || !currentColor || typeof currentColor === 'string') {
                  console.log('🔄 Resize sonrası renkler kaybolmuş, yeniden uygulanıyor...');
                  // Burada renk yeniden uygulanacak interval tarafından
                }
              } else {
                console.log('⚠️ Resize sonrası layer bulunamadı');
              }
            }
          }
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    
    // ResizeObserver ekle - immediate reaction için
    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          if (mapRef.current) {
            // Immediate resize without timeout
            mapRef.current.resize();
            
            // Focus'u koru (ağırlık değişimi sırasında değil)
            setTimeout(() => {
              if (mapRef.current && currentViewRef.current && !focusLockDisabled.current) {
                const currentMapCenter = mapRef.current.getCenter();
                const currentMapZoom = mapRef.current.getZoom();
                
                const centerDiff = Math.abs(currentMapCenter.lng - currentViewRef.current.center[0]) + 
                                  Math.abs(currentMapCenter.lat - currentViewRef.current.center[1]);
                const zoomDiff = Math.abs(currentMapZoom - currentViewRef.current.zoom);
                
                if (centerDiff > 0.1 || zoomDiff > 0.2) {
                  console.log('🔄 ResizeObserver: focus korunuyor');
                  mapRef.current.setCenter(currentViewRef.current.center);
                  mapRef.current.setZoom(currentViewRef.current.zoom);
                }
              }
            }, 50);
          }
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden bg-gradient-to-br from-gray-900 to-black">
      {/* Harita Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* Loading Overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <div className="ml-4 flex flex-col space-y-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '500ms' }}></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                </div>
              </div>
            </div>
            <p className="text-white text-lg font-medium">Türkiye haritası yükleniyor...</p>
            <p className="text-gray-400 text-sm mt-2">İl sınırları ve coğrafi veriler hazırlanıyor</p>
            
            {/* Map Loading Progress Bar */}
            <div className="mt-4 w-64 mx-auto">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renk Lejandı - Sol Alt */}
      {mapLoaded && (
        <div className="absolute bottom-4 left-4">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
          <h4 className="text-white text-sm font-semibold mb-2">
            {secilenSektor === 'kamu' ? '🏛️ Kamu Sektörü' : '🏢 Özel Sektör'} Skoru
          </h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: getSkorColor(0.94) }}></div>
                 <span className="text-xs text-gray-300">En Yüksek (87.5%+)</span>
            </div>
            <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: getSkorColor(0.81) }}></div>
                 <span className="text-xs text-gray-300">Çok Yüksek (75-87.5%)</span>
            </div>
            <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: getSkorColor(0.69) }}></div>
                 <span className="text-xs text-gray-300">Yüksek (62.5-75%)</span>
            </div>
            <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: getSkorColor(0.56) }}></div>
                 <span className="text-xs text-gray-300">Orta Yüksek (50-62.5%)</span>
            </div>
            <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: getSkorColor(0.44) }}></div>
                 <span className="text-xs text-gray-300">Orta (37.5-50%)</span>
            </div>
             <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: getSkorColor(0.31) }}></div>
                 <span className="text-xs text-gray-300">Orta Düşük (25-37.5%)</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: getSkorColor(0.19) }}></div>
                 <span className="text-xs text-gray-300">Düşük (12.5-25%)</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: getSkorColor(0.06) }}></div>
                 <span className="text-xs text-gray-300">En Düşük (0-12.5%)</span>
             </div>
           </div>
          </div>
        </div>
      )}

      {/* Yatırım Tavsiyeleri Paneli - Sağ Alt */}
      {mapLoaded && Object.keys(ilSkorlari).length > 0 && (
        <div className="absolute bottom-4 right-4">
          <div className="bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50 max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              {secilenSektor === 'kamu' ? (
                <>
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                    <span className="text-green-400 text-sm">🏛️</span>
                  </div>
                  <h4 className="text-green-300 text-sm font-semibold">Kamu Sektörü Yatırım Tavsiyeleri</h4>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                    <span className="text-orange-400 text-sm">🏢</span>
                  </div>
                  <h4 className="text-orange-300 text-sm font-semibold">Özel Sektör Yatırım Tavsiyeleri</h4>
                </>
              )}
            </div>
            
            <div className="space-y-2 text-xs text-gray-300">
              {secilenSektor === 'kamu' ? (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span><strong className="text-purple-300">Düşük skorlu bölgeler:</strong> Altyapı yatırımlarına öncelik verin</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span><strong className="text-blue-300">Orta skorlu bölgeler:</strong> Eğitim ve sağlık tesisleri geliştirin</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span><strong className="text-green-300">Koyu kırmızı bölgeler:</strong> Temel kamu hizmetlerini güçlendirin</span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-700">
                    <p className="text-xs text-gray-400 italic">
                      💡 Kamu yatırımları uzun vadeli kalkınma odaklı planlanmalıdır
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span><strong className="text-green-300">Koyu kırmızı bölgeler:</strong> Yüksek getiri potansiyeli, hemen yatırım yapın</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span><strong className="text-orange-300">Orta skorlu bölgeler:</strong> Orta vadeli stratejik yatırım planlayın</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span><strong className="text-red-300">Düşük skorlu bölgeler:</strong> Risk analizi yapın, alternatifler değerlendirin</span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-700">
                    <p className="text-xs text-gray-400 italic">
                      💰 Özel sektör için ROI ve pazar potansiyeli kritik faktörlerdir
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sağ üst bilgi paneli ve kontroller */}
      {mapLoaded && (
        <div className="absolute top-4 right-4 space-y-3">
          {/* Hızlı Bilgi Kartı */}
          {Object.keys(ilSkorlari).length > 0 && (
            <div className="bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50 max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                {secilenSektor === 'kamu' ? (
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                    <span className="text-green-400 text-xs">🏛️</span>
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center">
                    <span className="text-orange-400 text-xs">🏢</span>
                  </div>
                )}
                <h5 className="text-white text-xs font-medium">Yatırım Stratejisi</h5>
              </div>
              
              <div className="text-xs text-gray-300 space-y-1">
                {secilenSektor === 'kamu' ? (
                  <>
                    <p><span className="text-green-400">✓</span> Sosyal fayda odaklı</p>
                    <p><span className="text-blue-400">✓</span> Uzun vadeli planlama</p>
                    <p><span className="text-purple-400">✓</span> Bölgesel kalkınma</p>
                  </>
                ) : (
                  <>
                    <p><span className="text-green-400">✓</span> Kar maksimizasyonu</p>
                    <p><span className="text-orange-400">✓</span> Hızlı geri dönüş</p>
                    <p><span className="text-red-400">✓</span> Pazar potansiyeli</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex flex-col gap-2">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="w-10 h-10 bg-black/80 backdrop-blur-sm border border-gray-700/50 rounded text-white hover:bg-gray-800/80 transition-colors"
          >
            +
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="w-10 h-10 bg-black/80 backdrop-blur-sm border border-gray-700/50 rounded text-white hover:bg-gray-800/80 transition-colors"
          >
            −
          </button>
          </div>
        </div>
      )}


    </div>
  );
}

// Indicator Detay Component
function IndicatorDetayComponent({ 
  ilId, 
  kategoriId, 
  kategoriAdi 
}: { 
  ilId: number; 
  kategoriId: string; 
  kategoriAdi: string; 
}) {
  const [indicatorData, setIndicatorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndicators = async () => {
      if (!ilId || !kategoriId) return;
      
      try {
        setLoading(true);
        console.log('🔍 Indicator verileri alınıyor:', { ilId, kategoriId });
        
        const response = await fetch(`/api/iller/${ilId}/indicators?kategori=${kategoriId}`);
        const data = await response.json();
        
        console.log('📊 Indicator API yanıtı:', data);
        
        if (data.success) {
          setIndicatorData(data.data);
        } else {
          console.error('❌ Indicator verisi alınamadı:', data.message);
          setIndicatorData(null);
        }
      } catch (error) {
        console.error('💥 Indicator API hatası:', error);
        setIndicatorData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchIndicators();
  }, [ilId, kategoriId]);

  const getIndicatorColor = (indicatorName: string) => {
    if (indicatorName.includes('GSYH') || indicatorName.includes('Gelir')) return 'text-blue-400';
    if (indicatorName.includes('İşsizlik') || indicatorName.includes('Ölüm')) return 'text-red-400';
    if (indicatorName.includes('Nüfus') || indicatorName.includes('Doktor')) return 'text-green-400';
    if (indicatorName.includes('Eğitim') || indicatorName.includes('Okul')) return 'text-purple-400';
    if (indicatorName.includes('Sağlık') || indicatorName.includes('Hastane')) return 'text-emerald-400';
    if (indicatorName.includes('Girişim') || indicatorName.includes('İmalat')) return 'text-orange-400';
    if (indicatorName.includes('Tarım') || indicatorName.includes('Üretim')) return 'text-lime-400';
    return 'text-gray-300';
  };

  return (
    <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Info className="w-5 h-5 text-indigo-400" />
          <span>Detaylı Göstergeler - {kategoriAdi}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Göstergeler yükleniyor...</p>
          </div>
        ) : indicatorData && indicatorData.indicators.length > 0 ? (
          <div className="space-y-3">
            {/* Özet Bilgiler */}
            <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <div className="text-sm text-indigo-300 mb-1">
                📊 {indicatorData.category.name} Kategorisi
              </div>
              <div className="text-xs text-gray-400">
                Toplam {indicatorData.total_indicators} gösterge • 
                {indicatorData.indicators_with_data} tanesi veri içeriyor
              </div>
            </div>

            {/* Indicator Listesi */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {indicatorData.indicators.map((indicator: any, index: number) => (
                <div key={indicator.indicator_id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm text-gray-300 mb-1 font-medium">
                      {indicator.indicator_name}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>ID: {indicator.indicator_id}</span>
                      <span>•</span>
                      <span>Birim: {indicator.unit}</span>
                      {indicator.year && (
                        <>
                          <span>•</span>
                          <span>{indicator.year}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${getIndicatorColor(indicator.indicator_name)}`}>
                      {indicator.formatted_value}
                    </div>
                    {indicator.value === null && (
                      <div className="text-xs text-gray-500">Veri yok</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Bu kategori için gösterge verisi bulunamadı</p>
            <p className="text-sm mt-2">Kategori ID: {kategoriId}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// İl Detay Modal'ı
function IlDetayModal({
  isOpen,
  onClose,
  ilKodu,
  secilenKategoriler
}: {
  isOpen: boolean;
  onClose: () => void;
  ilKodu: string | null;
  secilenKategoriler: string[];
}) {
  const [ilDetay, setIlDetay] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ilKodu && isOpen) {
      setLoading(true);
      // API çağrısı simülasyonu
      setTimeout(() => {
        fetch(`/api/iller/${ilKodu}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setIlDetay(data.data);
            }
          })
          .catch(err => {
            console.error('İl detayları alınamadı:', err);
          })
          .finally(() => setLoading(false));
      }, 1000);
    }
  }, [ilKodu, isOpen]);

  if (!ilDetay || loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-gray-700/50">
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <Loader2 className="animate-spin w-16 h-16 text-blue-400 mx-auto" />
              <div className="space-y-2">
                <p className="text-white text-xl font-semibold">İl verileri yükleniyor...</p>
                <p className="text-gray-400 text-sm">Detaylı analiz sonuçları hazırlanıyor</p>
              </div>
              <div className="flex items-center justify-center space-x-1 text-blue-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Kategori skorları için pie chart verisi
  const pieData = secilenKategoriler.map(kategori => ({
    name: kategori === 'egitim' ? 'Eğitim' :
          kategori === 'saglik' ? 'Sağlık' :
          kategori === 'sanayi' ? 'Sanayi' : 'Tarım',
    value: ilDetay.kategori_skorlari[kategori as keyof typeof ilDetay.kategori_skorlari] * 100,
    fill: kategori === 'egitim' ? '#3B82F6' :
          kategori === 'saglik' ? '#EF4444' :
          kategori === 'sanayi' ? '#8B5CF6' : '#10B981'
  }));

  // İstatistikler için bar chart verisi
  const barData = [
    { name: 'Üniversite', value: ilDetay.istatistikler.egitim.universite_sayisi },
    { name: 'Doktor', value: ilDetay.istatistikler.saglik.doktor_sayisi },
    { name: 'Fabrika', value: ilDetay.istatistikler.sanayi.fabrika_sayisi },
    { name: 'Tarım Alanı', value: ilDetay.istatistikler.tarim.tarimsal_alan / 1000 } // km²'ye çevir
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-gray-700/50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-purple-100 flex items-center gap-3">
            <MapPin className="h-8 w-8 text-blue-400" />
            {ilDetay.il_adi} - {ilDetay.is_merge_mode ? 'Çoklu Kategori Analizi' : 'Yatırım Analizi'}
            {ilDetay.is_merge_mode && (
              <span className="text-sm font-normal bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full">
                {Object.keys(ilDetay.categoryScores || {}).length} Kategori
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* Genel Skor Kartı */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-purple-500/10 border border-blue-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-100 flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {ilDetay.is_merge_mode ? 'Merge Skoru' : 'Genel Skor'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-400 mb-2">
                  {(ilDetay.genel_skor * 100).toFixed(0)}%
                </div>
                {ilDetay.is_merge_mode && ilDetay.ranking && (
                  <div className="text-sm text-blue-300 mb-2">
                    {ilDetay.total_provinces || 81} il içinde {ilDetay.ranking}. sırada
                  </div>
                )}
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                    style={{ width: `${ilDetay.genel_skor * 100}%` }}
                  />
                </div>
                {ilDetay.is_merge_mode && (
                  <div className="text-xs text-gray-400 mt-2">
                    Weighted Average Model
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-green-500/10 border border-emerald-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-emerald-100 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {ilDetay.is_merge_mode ? 'En Güçlü Kategori' : 'En Yüksek Kategori'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ilDetay.is_merge_mode && ilDetay.categoryScores ? (
                  <>
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                      {(Object.entries(ilDetay.categoryScores)
                        .sort(([,a], [,b]) => (b as any).raw_score - (a as any).raw_score)[0]?.[1] as any)?.category_name || 'Hesaplanıyor'}
                </div>
                <div className="text-sm text-emerald-300">
                      {(((Object.entries(ilDetay.categoryScores)
                        .sort(([,a], [,b]) => (b as any).raw_score - (a as any).raw_score)[0]?.[1] as any)?.raw_score || 0) * 100).toFixed(0)}% skor
                </div>
                    <div className="text-xs text-emerald-400 mt-1">
                      Ağırlık: {(((Object.entries(ilDetay.categoryScores)
                        .sort(([,a], [,b]) => (b as any).raw_score - (a as any).raw_score)[0]?.[1] as any)?.weight || 0) * 100).toFixed(0)}%
                    </div>
                  </>
                ) : (
                  <>
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                  {Object.entries(ilDetay.kategori_skorlari || {}).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] === 'egitim' ? 'Eğitim' :
                   Object.entries(ilDetay.kategori_skorlari || {}).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] === 'saglik' ? 'Sağlık' :
                   Object.entries(ilDetay.kategori_skorlari || {}).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] === 'sanayi' ? 'Sanayi' : 'Tarım'}
                </div>
                <div className="text-sm text-emerald-300">
                  {((Math.max(...(Object.values(ilDetay.kategori_skorlari || {}) as number[])) || 0) * 100).toFixed(0)}% skor
                </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 via-purple-600/5 to-pink-500/10 border border-purple-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-100 flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  İstatistikler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Plaka:</span>
                    <span className="text-white font-semibold">{ilDetay.plaka_no}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">İl Kodu:</span>
                    <span className="text-white font-semibold">{ilDetay.il_kodu}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grafikler */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pie Chart - Kategori Skorları */}
            <Card className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Kategori Bazlı Skor Dağılımı
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Skor']}
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#f9fafb'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar Chart - İstatistikler */}
            <Card className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Temel İstatistikler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#f9fafb'
                      }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Öneriler */}
          <Card className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-red-500/10 border border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-amber-100 flex items-center gap-2">
                <Star className="h-5 w-5" />
                Yatırım Önerileri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {ilDetay.oneriler.map((oner, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-amber-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-200">{oner}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// SearchParams kullanan bileşeni ayrı fonksiyona çıkar
function HaritaContent() {
  const searchParams = useSearchParams();
  const [secilenKategori, setSecilenKategori] = useState<string>(''); // Eski tek kategori (backward compatibility)
  const [secilenKategoriler, setSecilenKategoriler] = useState<string[]>([]); // Yeni çoklu kategori
  const [kategoriAgirliklar, setKategoriAgirliklar] = useState<{[key: string]: number}>({});
  const [geciciKategoriAgirliklar, setGeciciKategoriAgirliklar] = useState<{[key: string]: number}>({});
  const [geciciAgirlikInputlari, setGeciciAgirlikInputlari] = useState<{[key: string]: string}>({});
  const [agPopupOpen, setAgPopupOpen] = useState<boolean>(false);
  const [kategoriAdi, setKategoriAdi] = useState<string>('');
  const [kategoriIsimleri, setKategoriIsimleri] = useState<{[key: string]: string}>({});
  const [focusLockDisabled, setFocusLockDisabled] = useState<boolean>(false); // Ağırlık değişimi sırasında harita focus'ını devre dışı bırak
  const [secilenSektor, setSecilenSektor] = useState<'kamu' | 'ozel'>('kamu'); // default: kamu
  const [apiHatasi, setApiHatasi] = useState<string | null>(null);
  const [ilSkorlari, setIlSkorlari] = useState<{ [key: string]: number }>({});
  const [skorlarYuklendi, setSkorlarYuklendi] = useState(false);
  const [tamamenHazir, setTamamenHazir] = useState(false);
  const [secilenIl, setSecilenIl] = useState<any | null>(null);
  const [modalAcik, setModalAcik] = useState(false);
  const [ilDetayYukleniyor, setIlDetayYukleniyor] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapResetFunction, setMapResetFunction] = useState<(() => void) | null>(null);

  useEffect(() => {
    // Yeni format: çoklu kategoriler
    const kategorilerParam = searchParams.get('kategoriler');
    const agirliklarParam = searchParams.get('agirliklar');
    // Eski format: tek kategori (backward compatibility)
    const kategoriParam = searchParams.get('kategori');
    
    let aktivKategoriler: string[] = [];
    let aktivAgirliklar: {[key: string]: number} = {};
    
    if (kategorilerParam) {
      // Çoklu kategori modu
      aktivKategoriler = kategorilerParam.split(',');
      
      if (agirliklarParam) {
        const agirlikDegerleri = agirliklarParam.split(',').map(parseFloat);
        aktivKategoriler.forEach((k, index) => {
          aktivAgirliklar[k] = agirlikDegerleri[index] || (1 / aktivKategoriler.length);
        });
      } else {
        // Eşit ağırlık dağıt
        const eslitAgirlik = 1 / aktivKategoriler.length;
        aktivKategoriler.forEach(k => {
          aktivAgirliklar[k] = eslitAgirlik;
        });
      }
      
      setSecilenKategoriler(aktivKategoriler);
      setKategoriAgirliklar(aktivAgirliklar);
      setSecilenKategori(''); // Tek kategoriyi temizle
      
      console.log('🎯 Çoklu kategori modu:', aktivKategoriler, aktivAgirliklar);
      
    } else if (kategoriParam) {
      // Tek kategori modu (backward compatibility)
      aktivKategoriler = [kategoriParam];
      aktivAgirliklar = { [kategoriParam]: 1.0 };
      
      setSecilenKategori(kategoriParam);
      setSecilenKategoriler(aktivKategoriler);
      setKategoriAgirliklar(aktivAgirliklar);
      
      console.log('📊 Tek kategori modu:', kategoriParam);
    }
    
    if (aktivKategoriler.length > 0) {
      setSkorlarYuklendi(false);
      setTamamenHazir(false);
      setApiHatasi(null); // Hata durumunu temizle
      
      // Kategori adlarını al
      fetch('/api/kategoriler')
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Kategori isimlerini map'e kaydet
            const isimMap: {[key: string]: string} = {};
            aktivKategoriler.forEach(id => {
              const kategori = data.data.find((k: any) => k.id === id);
              isimMap[id] = kategori ? kategori.ad : `Kategori ${id}`;
            });
            setKategoriIsimleri(isimMap);
            
            if (aktivKategoriler.length === 1) {
              // Tek kategori adı
              const kategori = data.data.find((k: any) => k.id === aktivKategoriler[0]);
            if (kategori) {
              setKategoriAdi(kategori.ad);
              }
            } else {
              // Çoklu kategori adları
              const kategoriAdlari = aktivKategoriler.map(id => {
                const kategori = data.data.find((k: any) => k.id === id);
                return kategori ? kategori.ad : `Kategori ${id}`;
              });
              setKategoriAdi(kategoriAdlari.join(' + '));
            }
          }
        })
        .catch(error => console.error('Kategori adı alınamadı:', error));
      
      // İl skorlarını al
      if (aktivKategoriler.length === 1) {
        // Tek kategori - mevcut API
        console.log('📡 Tek kategori API isteği:', `kategori=${aktivKategoriler[0]}&sektor=${secilenSektor}`);
        fetch(`/api/iller?kategori=${aktivKategoriler[0]}&sektor=${secilenSektor}`)
          .then(response => {
            console.log('📡 API yanıt durumu:', response.status);
            return response.json();
          })
        .then(data => {
            console.log('📡 API yanıt verisi:', data);
                  if (data.success) {
          const skorlar: { [key: string]: number } = {};
          data.data.forEach((il: any) => {
                const skor = Math.max(0, Math.min(1, parseFloat(il.genel_skor || 0.5)));
                skorlar[il.province_name] = skor;
          });
              
              console.log('🎯 İl skorları işlendi:', Object.keys(skorlar).length, 'il');
          setIlSkorlari(skorlar);
          setSkorlarYuklendi(true);
              setApiHatasi(null);
            } else {
              console.error('❌ API hatası:', data.message);
              setApiHatasi(`Database bağlantı hatası: ${data.message}`);
              setSkorlarYuklendi(false);
              setTamamenHazir(false);
            }
          })
          .catch(error => {
            console.error('❌ İl skorları API hatası:', error);
            setApiHatasi(`Network bağlantı hatası: ${error.message}`);
            setSkorlarYuklendi(false);
            setTamamenHazir(false);
          });
      } else {
        // Çoklu kategori - yeni merge API
        const kategorilerStr = aktivKategoriler.join(',');
        const agirliklarStr = aktivKategoriler.map(k => aktivAgirliklar[k]).join(',');
        
        console.log('🎯 Merge API isteği:', `kategoriler=${kategorilerStr}&agirliklar=${agirliklarStr}&sektor=${secilenSektor}`);
        
        fetch(`/api/iller/merged-scores?kategoriler=${kategorilerStr}&agirliklar=${agirliklarStr}&sektor=${secilenSektor}`)
          .then(response => {
            console.log('📡 Merge API yanıt durumu:', response.status);
            return response.json();
          })
          .then(data => {
            console.log('📡 Merge API yanıt verisi:', data);
            if (data.success) {
              const skorlar: { [key: string]: number } = {};
              data.data.forEach((il: any) => {
                const raw = Number(il.genel_skor);
                const skor = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
                skorlar[il.province_name] = skor;
              });
              
              console.log('🎯 Merge skorları işlendi:', Object.keys(skorlar).length, 'il');
              console.log('📊 Merge bilgileri:', data.merge_info);
              console.log('📈 En yüksek 5 skor:', 
                Object.entries(skorlar)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 5)
                  .map(([il, skor]) => `${il}: ${(skor * 100).toFixed(1)}%`)
              );
              
              setIlSkorlari(skorlar);
              setSkorlarYuklendi(true);
              setApiHatasi(null);
            } else {
              console.error('❌ Merge API hatası:', data.message);
              setApiHatasi(`Çoklu kategori analizi hatası: ${data.message}`);
              setSkorlarYuklendi(false);
              setTamamenHazir(false);
            }
          })
          .catch(error => {
            console.error('❌ Merge API bağlantı hatası:', error);
            setApiHatasi(`Network bağlantı hatası: ${error.message}`);
            setSkorlarYuklendi(false);
            setTamamenHazir(false);
          });
      }
    }
  }, [searchParams, secilenSektor]);
  
  // Sektör değişim handler
  const handleSektorDegisimi = (yeniSektor: 'kamu' | 'ozel') => {
    setSecilenSektor(yeniSektor);
    setSkorlarYuklendi(false);
    setTamamenHazir(false);
  };

  // Sidebar açılıp kapanırken harita resize et - smooth animation için
  useEffect(() => {
    if (!modalAcik) return;

    // Animasyon boyunca sürekli resize tetikle
    let animationId: number;
    let startTime = Date.now();
    const animationDuration = 600; // ms - animasyon süresiyle sync

    const smoothResize = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed < animationDuration) {
        window.dispatchEvent(new Event('resize'));
        animationId = requestAnimationFrame(smoothResize);
      } else {
        // Final resize
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }
    };

    // İlk resize
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      smoothResize();
    }, 50);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [modalAcik]);

  const handleIlClick = useCallback(async (ilIdOrName: string) => {
    try {
      // Çoklu kategori seçiminde loading state'i başlat
      const isMultiCategory = secilenKategoriler.length > 1;
      if (isMultiCategory) {
        setIlDetayYukleniyor(true);
      }
      
      let ilId = ilIdOrName;
      
      // Eğer string bir sayı değilse (il adıysa), ID'ye çevir
      if (isNaN(parseInt(ilIdOrName))) {
        const nameResponse = await fetch(`/api/iller/by-name?name=${encodeURIComponent(ilIdOrName)}`);
        const nameData = await nameResponse.json();
        
        if (nameData.success) {
          ilId = nameData.data.province_id.toString();
        } else {
          console.error('İl ID bulunamadı:', ilIdOrName);
          return;
        }
      }
      
      // Çoklu kategori mi tek kategori mi kontrol et (yukarıda zaten tanımlandı)
      if (isMultiCategory) {
        // Çoklu kategori - Merge Analytics API kullan
        const kategorilerStr = secilenKategoriler.join(',');
        const agirliklarStr = secilenKategoriler.map(k => kategoriAgirliklar[k]).join(',');
        
        console.log('🎯 Merge Analytics API çağrılıyor:', { ilId, kategorilerStr, agirliklarStr, secilenSektor });
        
        const mergeAnalyticsResponse = await fetch(
          `/api/iller/${ilId}/merged-analytics?kategoriler=${kategorilerStr}&agirliklar=${agirliklarStr}&sektor=${secilenSektor}`
        );
        const mergeData = await mergeAnalyticsResponse.json();
        
        if (mergeData.success) {
          const data = mergeData.data;
          
          // Merge verilerini UI formatına çevir
          const mergeFormattedData = {
            id: data.province.id,
            il_adi: data.province.name,
            genel_skor: data.scores.merged_score, // API'den gelen sektöre göre hesaplanmış skor
            is_merge_mode: true,
            merge_info: data.merge_info,
            
            // Merge için özel composite scores
            compositeScores: {
              mevcut_durum: data.composite_scores.current_status,
              trend: data.composite_scores.trend_score,
              potansiyel: data.composite_scores.potential_score
            },
            
            // Kategori bazlı skorlar (radar chart için)
            categoryScores: data.category_scores,
            
            // Ranking bilgisi
            ranking: data.scores.ranking,
            total_provinces: data.scores.total_provinces,
            
            // Merge detay bilgileri
            merge_details: data.detailed_breakdown,
            
            // Mock istatistikler (gerçek API'de implement edilecek)
            istatistikler: {
              merge_algorithm: {
                weighted_average: data.detailed_breakdown.weighted_average,
                harmonic_mean: data.detailed_breakdown.harmonic_mean,
                algorithm_type: data.detailed_breakdown.algorithm_type
              }
            },
            
            // Merge önerileri
            oneriler: [
              `${Object.keys(data.category_scores).length} kategori birleşik analizi tamamlandı`,
              `En güçlü kategori: ${(Object.entries(data.category_scores).sort(([,a], [,b]) => (b as any).raw_score - (a as any).raw_score)[0]?.[1] as any)?.category_name || 'Hesaplanıyor'}`,
              `Genel yatırım skoru: ${(data.scores.merged_score * 100).toFixed(1)}%`
            ],
            
            // Projeler (merge için özel)
            projeler: [
              { ad: "Çoklu Kategori Analizi", durum: "Aktif", butce: `${Object.keys(data.category_scores).length} Kategori` },
              { ad: "Weighted Average Model", durum: "Çalışıyor", butce: "Algorithm" },
              { ad: "Harmonik Düzeltme", durum: "Hazır", butce: "Real-time" }
            ]
          };
          
          setSecilenIl(mergeFormattedData);
          setModalAcik(true);
          setIlDetayYukleniyor(false); // Loading state'i kapat
          
          console.log('✅ Merge detayları yüklendi:', mergeFormattedData);
          
        } else {
          console.error('Merge analytics verileri alınamadı:', mergeData.message);
        }
        
      } else {
        // Tek kategori - Mevcut Analytics API kullan
        const analyticsResponse = await fetch(`/api/iller/${ilId}/analytics`);
        const analyticsData = await analyticsResponse.json();
        
        if (analyticsData.success) {
          const analytics = analyticsData.data.analytics;
          const province = analyticsData.data.province;
          
          // Gerçek verilerden UI formatına çevir
          const realData = {
            id: province.id,
            il_adi: province.name,
            is_merge_mode: false,
            
            // Genel skor - seçilen kategorinin sektöre göre skoru
            genel_skor: (() => {
              const kategori = analytics.categoryPerformance.find(c => c.categoryId.toString() === secilenKategori);
              if (!kategori) return 0.5;
              const skor = secilenSektor === 'kamu' ? kategori.priorityScore : kategori.attractivenessScore;
              return skor / 100;
            })(),
            
            // Investment Scores -> Sektörler (radar chart için)
            investmentScores: analytics.investmentScores,
            
            // Kategori Performance (bar chart için)
            categoryPerformance: analytics.categoryPerformance,
            
            // Yıllık Trend (line chart için) 
            yearlyTrend: analytics.yearlyTrend,
            
            // Temel istatistikler (KPI cards için)
            basicStats: analytics.basicStats,
            
            // Composite scores (Column chart için) - seçilen kategoriden al
            compositeScores: (() => {
              const kategori = analytics.categoryPerformance.find(c => c.categoryId.toString() === secilenKategori);
              const investmentScore = analytics.investmentScores.find(inv => inv.categoryId.toString() === secilenKategori);
              
              // Eğer investmentScores'da veri yoksa yearlyTrend'den al
              let currentStatus, trend;
              if (investmentScore?.scores) {
                currentStatus = investmentScore.scores.current_status;
                trend = investmentScore.scores.trend;
              } else {
                // yearlyTrend'den en son yılın verisini al
                const yearlyData = analytics.yearlyTrend[secilenKategori];
                if (yearlyData && yearlyData.data && yearlyData.data.length > 0) {
                  const latestData = yearlyData.data[yearlyData.data.length - 1];
                  currentStatus = latestData.current_status;
                  trend = latestData.trend;
                }
              }
              
              console.log('🔍 DEBUG - Tekli Kategori Skorları:', {
                secilenKategori,
                investmentScore: investmentScore,
                yearlyData: analytics.yearlyTrend[secilenKategori],
                currentStatus,
                trend,
                current_status_normalized: (currentStatus || 50) / 100,
                trend_normalized: (trend || 50) / 100
              });
              
              return {
                mevcut_durum: (currentStatus || 50) / 100,
                trend: (trend || 50) / 100,
                potansiyel: (kategori?.attractivenessScore || 50) / 100 // Özel sektör çekicilik skoru
              };
            })(),
            
            // Mock veriler geçici olarak korunuyor
            avantajlar: [
              "Database'den gerçek veriler",
              "Yatırım skorları analizi",
              "Çok yıllı trend verisi"
          ],
          projeler: [
              { ad: "Gerçek Veri Analizi", durum: "Aktif", butce: "Database" },
              { ad: "Investment Scores", durum: "Çalışıyor", butce: "API" },
              { ad: "Kategori Analizi", durum: "Hazır", butce: "Real-time" }
            ]
          };
          
          console.log('🎯 Gerçek analytics verisi yüklendi:', realData);
          setSecilenIl(realData);
          setModalAcik(true);
          setIlDetayYukleniyor(false); // Loading state'i kapat
      } else {
          console.error('Analytics verileri alınamadı:', analyticsData.message);
        }
      }
    } catch (error) {
      console.error('İl detayları yüklenirken hata:', error);
      setIlDetayYukleniyor(false); // Hata durumunda da loading state'i kapat
    }
  }, [secilenKategoriler, kategoriAgirliklar, secilenSektor]);

  // Sektör değişiminde harita skorlarını yeniden yükle
  useEffect(() => {
    if (secilenKategoriler.length > 0) {
      // Sektör değiştiğinde skorları yeniden yükle
      setSkorlarYuklendi(false);
      setTamamenHazir(false);
      setIlSkorlari({});
      
      // Skorları yeniden yükle
      const loadScores = async () => {
        try {
          if (secilenKategoriler.length === 1) {
            // Tek kategori
            const response = await fetch(`/api/iller?kategori=${secilenKategoriler[0]}&sektor=${secilenSektor}`);
            const data = await response.json();
            
            if (data.success) {
              const skorlar: { [key: string]: number } = {};
              data.data.forEach((il: any) => {
                const skor = Math.max(0, Math.min(1, parseFloat(il.genel_skor || 0.5)));
                skorlar[il.province_name] = skor;
              });
              setIlSkorlari(skorlar);
              setSkorlarYuklendi(true);
              setApiHatasi(null);
            }
          } else {
            // Çoklu kategori
            const kategorilerStr = secilenKategoriler.join(',');
            const agirliklarStr = secilenKategoriler.map(k => kategoriAgirliklar[k]).join(',');
            
            const response = await fetch(`/api/iller/merged-scores?kategoriler=${kategorilerStr}&agirliklar=${agirliklarStr}&sektor=${secilenSektor}`);
            const data = await response.json();
            
            if (data.success) {
              const skorlar: { [key: string]: number } = {};
              data.data.forEach((il: any) => {
                const raw = Number(il.genel_skor);
                const skor = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
                skorlar[il.province_name] = skor;
              });
              setIlSkorlari(skorlar);
              setSkorlarYuklendi(true);
              setApiHatasi(null);
            }
          }
        } catch (error) {
          console.error('Sektör değişim skor yükleme hatası:', error);
          setApiHatasi('Skorlar yüklenemedi');
        }
      };
      
      loadScores();
    }
  }, [secilenSektor]);

  const handleModalKapat = () => {
    setModalAcik(false);
    setIlDetayYukleniyor(false); // Modal kapatılırken loading state'i de temizle
    
    // Haritayı genel görünüme geri döndür
    if (mapResetFunction) {
      setTimeout(() => {
        mapResetFunction();
      }, 300); // Modal kapatma animasyonu başladıktan sonra
    }
    
    // Animasyon tamamlandıktan sonra secilenIl'i temizle (600ms - animation süresiyle sync)
    setTimeout(() => {
      setSecilenIl(null);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900/90 via-black/90 to-gray-900/90 backdrop-blur-sm border-b border-gray-800/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center space-x-2 text-gray-300 hover:text-white hover:bg-gray-800/50">
                <ArrowLeft className="w-4 h-4" />
                <span>Ana Sayfa</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-300">
                Türkiye Yatırım Haritası
              </h1>
              <div className="space-y-1">
              <p className="text-sm text-gray-400">
                {secilenKategoriler.length > 0 
                  ? `${secilenKategoriler.length} kategori analiz ediliyor` 
                  : 'Kategori seçilmedi'
                }
              </p>
                {secilenKategoriler.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {secilenKategoriler.length === 1
                      ? (secilenSektor === 'kamu' 
                          ? '📋 Kamu sektörü için altyapı ve kalkınma odaklı analiz' 
                          : '💼 Özel sektör için karlılık ve pazar potansiyeli analizi'
                        )
                      : (secilenSektor === 'kamu'
                          ? '🎯 Kamu sektörü için çoklu kategori bileşik analizi'
                          : '🚀 Özel sektör için çoklu kategori yatırım analizi'
                        )
                    }
                  </p>
                )}
            </div>
          </div>
            </div>
            
                    {/* Sektör Toggle - Header Ortası */}
          {secilenKategoriler.length > 0 && (
              <div className="flex items-center bg-gray-800/60 border border-gray-700/50 rounded-lg p-1">
                <button
                  onClick={() => handleSektorDegisimi('kamu')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    secilenSektor === 'kamu'
                      ? 'bg-green-500/20 text-green-200 border border-green-400/50'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
                >
                  🏛️ Kamu Sektörü
                </button>
                <button
                  onClick={() => handleSektorDegisimi('ozel')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    secilenSektor === 'ozel'
                      ? 'bg-orange-500/20 text-orange-200 border border-orange-400/50'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
                >
                  🏢 Özel Sektör
                </button>
              </div>
            )}

          {/* Ağırlıklandırma Popup - Çoklu Kategori İçin */}
          {secilenKategoriler.length > 1 && (
            <Popover open={agPopupOpen} onOpenChange={setAgPopupOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-gray-800/60 border-gray-700/50 text-gray-200 hover:bg-gray-700/70 hover:text-white"
                  onClick={() => {
                    // Popup açılırken mevcut ağırlıkları geçici state'e kopyala
                    const copy = { ...kategoriAgirliklar };
                    setGeciciKategoriAgirliklar(copy);
                    const inputs: {[key: string]: string} = {};
                    secilenKategoriler.forEach(k => { inputs[k] = String(Math.round((copy[k] ?? 0) * 100)); });
                    setGeciciAgirlikInputlari(inputs);
                    setAgPopupOpen(true);
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Ağırlıklandırma
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-gray-900/95 border-gray-700/50 backdrop-blur-sm">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-white">Kategori Ağırlıkları</h4>
                    <p className="text-sm text-gray-400">
                      Kategorilerin analiz üzerindeki etkisini ayarlayın
                    </p>
                  </div>
                  
                  {/* Toplam dağılım durum çubuğu */}
                  <div>
                    <div className="w-full h-2 bg-gray-800 rounded-md overflow-hidden border border-gray-700/50">
                      <div className="flex w-full h-full">
                        {secilenKategoriler.map((kid) => {
                          const oran = (geciciKategoriAgirliklar[kid] ?? 0) * 100;
                          const renkler = ['bg-blue-500','bg-purple-500','bg-green-500'];
                          const renkIndex = secilenKategoriler.indexOf(kid) % renkler.length;
                          return <div key={`pbar-${kid}`} className={renkler[renkIndex]} style={{ width: `${Math.max(0, Math.round(oran))}%` }} />;
                        })}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Dağılım</span>
                      <span>%{Math.round(Object.values(geciciKategoriAgirliklar).reduce((s, v) => s + v, 0) * 100)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {secilenKategoriler.map((kategoriId) => {
                      const agirlik = geciciKategoriAgirliklar[kategoriId] || 0;
                      const draftPctStr = geciciAgirlikInputlari[kategoriId];
                      const draftPct = draftPctStr !== undefined && draftPctStr !== '' ? parseInt(draftPctStr, 10) : Math.round(agirlik * 100);
                      const kategoriAdi = kategoriIsimleri[kategoriId] || `Kategori ${kategoriId}`;
                      const otherIds = secilenKategoriler.filter(k => k !== kategoriId);
                      // Maksimum: 2 kategoride %75, 3 kategoride %50
                      const allowedMax = otherIds.length === 1 ? 0.75 : 0.5;
                      return (
                        <div key={kategoriId} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-200 max-w-48 truncate">
                              {kategoriAdi}
                            </div>
                            <div className="text-blue-400 font-bold text-sm select-none pointer-events-none">
                              {isNaN(draftPct) ? Math.round(agirlik * 100) : draftPct}%
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Input
                              value={geciciAgirlikInputlari[kategoriId] ?? String(Math.round(agirlik * 100))}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                setGeciciAgirlikInputlari(prev => ({ ...prev, [kategoriId]: raw }));
                              }}
                              onBlur={() => {
                                const otherIds = secilenKategoriler.filter(k => k !== kategoriId);
                                const maxPer = otherIds.length === 1 ? 0.75 : 0.5;
                                const allowedMaxPct = Math.round(maxPer * 100);
                                const val = parseInt((geciciAgirlikInputlari[kategoriId] ?? '0') || '0', 10);
                                const normalizedPct = isNaN(val) ? 0 : Math.max(25, Math.min(allowedMaxPct, val));
                                const yeniAgirlik = normalizedPct / 100;
                                // Sadece popup state'ini güncelle; haritayı tetikleme
                                setGeciciKategoriAgirliklar(prev => {
                                  const g = { ...prev };
                                  const others = secilenKategoriler.filter(k => k !== kategoriId);
                                  if (others.length === 0) { g[kategoriId] = yeniAgirlik; return g; }
                                  const balId = others[others.length - 1];
                                  const rest = others.filter(k => k !== balId);
                                  const sumR = rest.reduce((s, k) => s + (g[k] ?? 0), 0);
                                  g[kategoriId] = Math.min(Math.max(yeniAgirlik, 0.25), maxPer);
                                  let balVal = 1 - (g[kategoriId] + sumR);
                                  if (balVal < 0.25) balVal = 0.25;
                                  if (balVal > maxPer) balVal = maxPer;
                                  g[balId] = balVal;
                                  // Normalize son kontrol
                                  const total = Object.values(g).reduce((a, b) => a + b, 0);
                                  if (total > 1.0001) {
                                    const diff = total - 1;
                                    // diğerlerinden sırayla düşür
                                    const reducibles = others.filter(id => id !== balId).concat([balId]);
                                    let remaining = diff;
                                    reducibles.forEach(id => {
                                      if (remaining <= 0) return;
                                      const limitMin = 0.25;
                                      const canReduce = Math.min((g[id] ?? 0) - limitMin, remaining);
                                      if (canReduce > 0) {
                                        g[id] -= canReduce;
                                        remaining -= canReduce;
                                      }
                                    });
                                  }
                                  // Draft inputları yeni değerlere senkronize et
                                  const inputs: {[key: string]: string} = {};
                                  secilenKategoriler.forEach(k => {
                                    inputs[k] = String(Math.round((g[k] ?? 0) * 100));
                                  });
                                  setGeciciAgirlikInputlari(inputs);
                                  return g;
                                });
                              }}
                              className="w-20 h-8 text-right pr-2 bg-gray-900 border-gray-700 text-blue-300"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                            <span className="text-blue-400 font-bold text-sm select-none pointer-events-none">%</span>
                            <div className="ml-auto text-xs text-gray-400">min 25, max {Math.round(allowedMax * 100)}</div>
                          </div>
                          
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>→ {isNaN(draftPct) ? Math.round(agirlik * 100) : draftPct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700/50">
                    <div className="text-xs text-gray-400">
                      Toplam: {Math.round(Object.values(geciciKategoriAgirliklar).reduce((sum, val) => sum + val, 0) * 100)}%
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                        onClick={() => {
                          // İptal - geçici state'i temizle
                          setGeciciKategoriAgirliklar({});
                        }}
                      >
                        İptal
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={Object.values(geciciKategoriAgirliklar).reduce((s, v) => s + v, 0) > 1.0001}
                        onClick={() => {
                          // Focus lock'ı devre dışı bırak
                          setFocusLockDisabled(true);

                          // Dengelemeyi şimdi yap: son kategori balancer
                          const ids = [...secilenKategoriler];
                          const maxPer = ids.length === 2 ? 0.75 : 0.5;
                          const result: {[key: string]: number} = {};
                          for (let i = 0; i < ids.length; i++) {
                            if (i === ids.length - 1) break;
                            const id = ids[i];
                            const val = geciciKategoriAgirliklar[id] ?? 0.25;
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
                              const deficit = 0.25 - bal;
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
                            result[balancerId] = Math.min(Math.max(bal, 0.25), balMax);
                            const finalTotal = Object.values(result).reduce((s, v) => s + v, 0);
                            const diff = 1 - finalTotal;
                            if (Math.abs(diff) > 1e-6) {
                              const newBal = Math.min(Math.max(result[balancerId] + diff, 0.25), maxPer);
                              result[balancerId] = newBal;
                            }
                          }

                          // Uygula - gerçek state'i güncelle ve URL'yi değiştir
                          setKategoriAgirliklar({ ...result });

                          // URL'yi güncelle
                          const newParams = new URLSearchParams(window.location.search);
                          newParams.set('kategoriler', ids.join(','));
                          const agirlikValues = ids.map(k => (result[k] || 0).toFixed(3));
                          newParams.set('agirliklar', agirlikValues.join(','));
                          newParams.set('sektor', secilenSektor);

                          const newUrl = `${window.location.pathname}?${newParams.toString()}`;
                          window.history.pushState({}, '', newUrl);

                          // Haritayı yeniden yükle
                          setSkorlarYuklendi(false);
                          setTamamenHazir(false);
                          setApiHatasi(null);

                          // 2 saniye sonra focus lock'ı tekrar aktif et
                          setTimeout(() => {
                            setFocusLockDisabled(false);
                          }, 2000);

                          // Popup'ı kapat
                          setAgPopupOpen(false);
                        }}
                      >
                        Uygula
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <div className="flex items-center space-x-4">
            <div className="flex gap-2">
              {secilenKategoriler.length > 0 && (
                <span
                  className="px-3 py-1 bg-blue-500/20 border border-blue-400/50 rounded-full text-sm text-blue-200 font-medium"
                >
                  {secilenKategoriler.length === 1 
                    ? `📊 ${kategoriAdi || `Kategori ${secilenKategoriler[0]}`}`
                    : `🎯 ${secilenKategoriler.length} Kategori: ${kategoriAdi}`
                  }
                </span>
              )}
            </div>
            

          </div>
        </div>
      </header>

      {/* Ana İçerik - Harita ve Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Harita Alanı */}
        <motion.div
          initial={{ width: "100%" }}
          animate={{ 
            width: secilenIl && modalAcik ? "50%" : "100%" 
          }}
          transition={{ 
            type: "tween",
            ease: [0.25, 0.1, 0.25, 1],
            duration: 0.6
          }}
          className="relative"
        >
          <motion.div 
            className="w-full h-full p-6"
            animate={{
              scale: secilenIl && modalAcik ? 0.98 : 1,
              opacity: secilenIl && modalAcik ? 0.9 : 1
            }}
            transition={{ 
              type: "spring",
              damping: 20,
              stiffness: 200,
              duration: 0.6
            }}
          >
            <div className="w-full relative" style={{ height: 'calc(100vh - 120px)' }}>
              {/* İl Detay Loading Overlay - Sadece çoklu kategori seçiminde */}
              {ilDetayYukleniyor && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-gray-900/95 border border-gray-700 rounded-xl p-8 max-w-md mx-4 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <h3 className="text-white text-lg font-semibold mb-2">
                      Çoklu Kategori Analizi
                    </h3>
                    <p className="text-gray-300 text-sm mb-4">
                      {secilenKategoriler.length} kategori birleştiriliyor ve ağırlıklı skorlar hesaplanıyor...
                    </p>
                    <div className="text-xs text-gray-400">
                      Bu işlem birkaç saniye sürebilir
                    </div>
                  </div>
                </div>
              )}

              {useMemo(() => (
                Object.keys(ilSkorlari).length > 0 ? (
                  <TurkeyMap 
                    onIlClick={handleIlClick} 
                    ilSkorlari={ilSkorlari} 
                    tamamenHazir={tamamenHazir} 
                    secilenSektor={secilenSektor}
                    onRenklerUygulandi={() => setTamamenHazir(true)}
                    onMapReady={setMapResetFunction}
                    disableFocusLock={focusLockDisabled}
                  />
                ) : null
              ), [handleIlClick, ilSkorlari, tamamenHazir, secilenSektor, focusLockDisabled])}
              
              {/* Skor Yükleme Animasyonu veya Hata Durumu */}
              {secilenKategoriler.length > 0 && !tamamenHazir && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50"
                >
                  <div className="text-center max-w-md mx-auto">
                    {apiHatasi ? (
                      // Hata Durumu
                      <>
                        <div className="flex items-center justify-center mb-4">
                          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-red-400 text-lg font-medium mb-2">
                          Database Bağlantı Hatası
                        </p>
                        <p className="text-gray-300 text-sm mb-4">
                          {apiHatasi}
                        </p>
                        <button
                          onClick={() => window.location.reload()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          Sayfayı Yenile
                        </button>
                      </>
                    ) : (
                      // Loading Durumu
                      <>
                    <div className="flex items-center justify-center mb-4">
                      <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                    <p className="text-white text-lg font-medium">
                      {skorlarYuklendi ? 'Harita renklendiriliyor...' : 'Skorlar yükleniyor...'}
                    </p>
                    <p className="text-gray-300 text-sm mt-2">
                      {skorlarYuklendi 
                        ? 'Renk uygulaması tamamlanıyor'
                        : (kategoriAdi ? `${kategoriAdi} kategori skorları alınıyor` : 'Kategori skorları hesaplanıyor')
                      }
                    </p>
                    
                    {/* Sade Progress Bar */}
                    <div className="mt-4 w-48 mx-auto">
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
          
          {/* Overlay efekti sidebar açıkken */}
          <AnimatePresence>
            {secilenIl && modalAcik && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-black/10 pointer-events-none z-10"
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Sidebar - Yandan Çıkan Panel */}
        <AnimatePresence mode="wait">
          {secilenIl && modalAcik && (
            <ModalContent 
              secilenIl={secilenIl}
              secilenSektor={secilenSektor}
              secilenKategoriler={secilenKategoriler}
              secilenKategori={secilenKategori}
              kategoriAdi={kategoriAdi}
              ilSkorlari={ilSkorlari}
              skorlarYuklendi={skorlarYuklendi}
              onClose={handleModalKapat}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Modal Content Component - Sektör değişimini dinleyen ayrı component
function ModalContent({ 
  secilenIl, 
  secilenSektor, 
  secilenKategoriler, 
  secilenKategori, 
  kategoriAdi,
  ilSkorlari, 
  skorlarYuklendi,
  onClose 
}: {
  secilenIl: any;
  secilenSektor: 'kamu' | 'ozel';
  secilenKategoriler: string[];
  secilenKategori: string;
  kategoriAdi: string;
  ilSkorlari: { [key: string]: number };
  skorlarYuklendi: boolean;
  onClose: () => void;
}) {
  // Sektör değişiminde genel skoru güncelle
  const [guncelGenelSkor, setGuncelGenelSkor] = useState<number>(secilenIl.genel_skor);
  
  // AI Analiz state'leri
  const [aiAnalizYukleniyor, setAiAnalizYukleniyor] = useState(false);
  const [aiAnalizSonucu, setAiAnalizSonucu] = useState<string | null>(null);
  const [aiAnalizHatasi, setAiAnalizHatasi] = useState<string | null>(null);
  const [aiAnalizTamamlandi, setAiAnalizTamamlandi] = useState(false);
  
  useEffect(() => {
    if (secilenIl.is_merge_mode) {
      // Merge modunda sektöre göre skoru hesapla
      if (secilenIl.categoryScores) {
        let totalScore = 0;
        let totalWeight = 0;
        
        Object.entries(secilenIl.categoryScores).forEach(([kategoriId, scoreData]: [string, any]) => {
          const skor = secilenSektor === 'kamu' ? scoreData.priority_score : scoreData.attractiveness_score;
          totalScore += skor * scoreData.weight;
          totalWeight += scoreData.weight;
        });
        
        setGuncelGenelSkor(totalWeight > 0 ? totalScore / totalWeight : secilenIl.genel_skor);
      } else {
        setGuncelGenelSkor(secilenIl.genel_skor);
      }
    } else {
      // Tek kategori modunda sektöre göre skoru hesapla
      const kategori = secilenIl.categoryPerformance?.find((c: any) => c.categoryId.toString() === secilenKategori);
      if (kategori) {
        const skor = secilenSektor === 'kamu' ? kategori.priorityScore : kategori.attractivenessScore;
        setGuncelGenelSkor(skor / 100);
      } else {
        setGuncelGenelSkor(secilenIl.genel_skor);
      }
    }
  }, [secilenSektor, secilenIl, secilenKategori]);

  // AI Analiz fonksiyonu
  const handleAiAnaliz = async () => {
    try {
      setAiAnalizYukleniyor(true);
      setAiAnalizHatasi(null);
      setAiAnalizSonucu(null);

      console.log('🤖 AI analizi başlatılıyor...', {
        ilAdi: secilenIl.il_adi,
        kategoriAdi,
        sektor: secilenSektor,
        ilVerileri: secilenIl
      });

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ilAdi: secilenIl.il_adi,
          kategoriAdi,
          ilVerileri: secilenIl,
          secilenSektor
        })
      });

      const data = await response.json();

      if (data.success) {
        setAiAnalizSonucu(data.data.analiz);
        setAiAnalizTamamlandi(true);
        console.log('✅ AI analizi tamamlandı');
        
        // Rapor bölümüne otomatik scroll
        setTimeout(() => {
          const raporElement = document.querySelector('[data-ai-rapor]');
          if (raporElement) {
            raporElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          }
        }, 500);
        
        // 3 saniye sonra toast'ı kapat
        setTimeout(() => {
          setAiAnalizTamamlandi(false);
        }, 3000);
      } else {
        setAiAnalizHatasi(data.message || 'AI analizi sırasında hata oluştu');
        console.error('❌ AI analiz hatası:', data.message);
      }
    } catch (error) {
      console.error('❌ AI analiz hatası:', error);
      setAiAnalizHatasi('AI analizi sırasında beklenmeyen bir hata oluştu');
    } finally {
      setAiAnalizYukleniyor(false);
    }
  };

  return (
            <motion.div
              initial={{ x: '100%', opacity: 0, scale: 0.95 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: '100%', opacity: 0, scale: 0.95 }}
              transition={{
                type: "tween",
                ease: [0.25, 0.1, 0.25, 1],
                duration: 0.6
              }}
              className="w-1/2 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 border-l border-gray-700 overflow-y-auto shadow-2xl relative"
              style={{ height: 'calc(100vh - 120px)' }}
            >
              {/* AI Analiz Tamamlandı Toast */}
              {aiAnalizTamamlandi && (
                <motion.div
                  initial={{ y: -100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -100, opacity: 0 }}
                  className="absolute top-4 left-4 right-4 z-50"
                >
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-lg shadow-lg border border-green-500/20">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">AI Analizi Tamamlandı!</h3>
                        <p className="text-green-100 text-sm">Detaylı rapor hazırlandı. Aşağı kaydırarak görüntüleyebilirsiniz.</p>
                      </div>
                      <button
                        onClick={() => setAiAnalizTamamlandi(false)}
                        className="flex-shrink-0 text-green-200 hover:text-white transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
              {/* Sidebar Header */}
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-6 z-10">
                <div className="flex items-center justify-between">
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center space-x-3"
                  >
                    <MapPin className="w-8 h-8 text-blue-400" />
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {secilenIl.il_adi}
                      </h2>
                      <p className="text-gray-400 text-sm">Yatırım Analizi</p>
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                  >
                    <Button
                      onClick={onClose}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white hover:bg-gray-800/50 hover:scale-110 transition-all duration-200"
                    >
                      <motion.span
                        whileHover={{ rotate: 90 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        ✕
                      </motion.span>
                    </Button>
                  </motion.div>
                </div>
              </div>

                            {/* Sidebar Content - Yeni Düzen */}
              <div className="p-6 space-y-6">
                
                {/* 1. SIRADA: Yatırım Skoru */}
                <motion.div
                  initial={{ y: 30, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", damping: 20, stiffness: 300 }}
                >
                  <Card className="bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-purple-500/10 border border-blue-500/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-blue-100 flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Yatırım Skoru - {kategoriAdi}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          {!skorlarYuklendi ? (
                            <div className="flex items-center space-x-3">
                              <div className="animate-spin w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full"></div>
                              <span className="text-blue-400 text-2xl font-medium">Skorlar yükleniyor...</span>
                            </div>
                          ) : (
                            <motion.div 
                              key={`score-${secilenSektor}-${guncelGenelSkor}`}
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ 
                                type: "spring", 
                                damping: 20, 
                                stiffness: 400,
                                duration: 0.5
                              }}
                              className="text-4xl font-bold text-blue-400"
                            >
                              {(() => {
                                // Seçili sektöre göre doğru skoru göster
                                const secilenKategoriData = secilenIl.yearlyTrend && secilenIl.yearlyTrend[secilenKategori] 
                                  ? secilenIl.yearlyTrend[secilenKategori].data[secilenIl.yearlyTrend[secilenKategori].data.length - 1] // En son yıl
                                  : null;
                                
                                const skor = secilenKategoriData 
                                  ? (secilenSektor === 'kamu' ? secilenKategoriData.priority : secilenKategoriData.attractiveness)
                                  : guncelGenelSkor * 100;
                                  
                                return Math.round(skor);
                              })()}/100
                            </motion.div>
                          )}
                          <div className="text-gray-300 text-sm">
                            {secilenSektor === 'kamu' ? 'Kamu Sektörü Öncelik' : 'Özel Sektör Çekicilik'}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Award className="w-6 h-6 text-yellow-400" />
                          {!skorlarYuklendi ? (
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                              <span className="text-yellow-400 text-sm font-medium">Sıralama hesaplanıyor...</span>
                            </div>
                          ) : (
                            <motion.span 
                              key={`${secilenSektor}-${guncelGenelSkor}`}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ 
                                type: "spring", 
                                damping: 15, 
                                stiffness: 300,
                                duration: 0.6
                              }}
                              className="text-yellow-400 text-sm font-medium"
                            >
                              {(() => {
                                const secilenKategoriData = secilenIl.yearlyTrend && secilenIl.yearlyTrend[secilenKategori] 
                                  ? secilenIl.yearlyTrend[secilenKategori].data[secilenIl.yearlyTrend[secilenKategori].data.length - 1] 
                                  : null;
                                
                                const skor = secilenKategoriData 
                                  ? (secilenSektor === 'kamu' ? secilenKategoriData.priority : secilenKategoriData.attractiveness) / 100
                                  : guncelGenelSkor;

                                // Tüm illerin skorlarını al ve sırala
                                const tumSkorlar = Object.values(ilSkorlari).sort((a, b) => b - a);
                                const mevcutSkor = Math.round(skor * 100) / 100;
                                let sira = 1;
                                
                                // Mevcut ilin sırasını bul
                                for (let i = 0; i < tumSkorlar.length; i++) {
                                  if (Math.round(tumSkorlar[i] * 100) / 100 > mevcutSkor) {
                                    sira = i + 2; // Kendinden yüksek olanların sayısı + 1
                                  } else {
                                    break;
                                  }
                                }
                                
                                return `${sira}/${Object.keys(ilSkorlari).length || 81}`;
                              })()}
                            </motion.span>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        {!skorlarYuklendi ? (
                          <div className="h-3 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full animate-pulse"></div>
                        ) : (
                          <motion.div
                            key={`progress-${secilenSektor}-${guncelGenelSkor}`}
                            initial={{ width: 0, opacity: 0.7 }}
                            animate={{ 
                              width: `${(() => {
                                const secilenKategoriData = secilenIl.yearlyTrend && secilenIl.yearlyTrend[secilenKategori] 
                                  ? secilenIl.yearlyTrend[secilenKategori].data[secilenIl.yearlyTrend[secilenKategori].data.length - 1] 
                                  : null;
                                
                                const skor = secilenKategoriData 
                                  ? (secilenSektor === 'kamu' ? secilenKategoriData.priority : secilenKategoriData.attractiveness)
                                  : guncelGenelSkor * 100;
                                  
                                return Math.min(skor, 100); // Max 100%
                              })()}%`,
                              opacity: 1
                            }}
                            transition={{ 
                              delay: 0.3, 
                              duration: 0.8,
                              type: "spring",
                              damping: 20,
                              stiffness: 300
                            }}
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
                          />
                        )}
                      </div>
                      
                      <div className="mt-3 text-xs text-gray-400">
                        Seçilen kategori için {secilenSektor === 'kamu' ? 'kamu yatırım önceliği' : 'özel sektör yatırım çekiciliği'} skoru
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* 2. SIRADA: Bileşik Skorlar - Column Graph */}
                <motion.div
                  initial={{ y: 30, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", damping: 20, stiffness: 300 }}
                >
                  <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center space-x-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        <span>Bileşik Skorlar Analizi</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                                                // Composite scores verisini kullan
                        let compositeScores = secilenIl.compositeScores;
                        
                        // Merge mode'da sektöre göre composite scores hesapla
                        if (secilenIl.is_merge_mode && secilenIl.categoryScores) {
                          let mevcutDurum = 0, trend = 0, potansiyel = 0;
                          let totalWeight = 0;
                          
                          Object.entries(secilenIl.categoryScores).forEach(([kategoriId, scoreData]: [string, any]) => {
                            const weight = scoreData.weight;
                            const cs = scoreData.current_status;
                            const tr = scoreData.trend_score;
                            const pot = (secilenSektor === 'kamu' ? scoreData.priority_score : scoreData.attractiveness_score);
                            if (typeof cs === 'number') { mevcutDurum += cs * weight; totalWeight += weight; }
                            if (typeof tr === 'number') { trend += tr * weight; }
                            if (typeof pot === 'number') { potansiyel += pot * weight; }
                          });
                          
                          if (totalWeight > 0) {
                            compositeScores = {
                              mevcut_durum: mevcutDurum / totalWeight,
                              trend: trend / totalWeight,
                              potansiyel: potansiyel / totalWeight
                            };
                          }
                        } else if (!secilenIl.is_merge_mode) {
                          // Tek kategori modunda potansiyel skor özel sektör çekicilik skoru
                          const kategori = secilenIl.categoryPerformance?.find((c: any) => c.categoryId.toString() === secilenKategori);
                          if (kategori && compositeScores) {
                            compositeScores = {
                              ...compositeScores,
                              potansiyel: (kategori.attractivenessScore || 50) / 100 // Özel sektör çekicilik skoru
                            };
                          }
                        }
                        
                        if (!compositeScores) {
                          return (
                            <div className="text-center py-8 text-gray-400">
                              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>Bu kategori için bileşik skor verisi bulunamadı</p>
                          </div>
                          );
                        }

                        const bileşikSkorlar = [
                          { 
                            name: secilenSektor === 'kamu' ? 'Kamu Öncelik' : 'Özel Çekicilik', 
                            value: guncelGenelSkor * 100, 
                            fill: secilenSektor === 'kamu' ? '#3B82F6' : '#EF4444'
                          },
                          { name: 'Mevcut Durum', value: compositeScores.mevcut_durum * 100, fill: '#10B981' },
                          { name: 'Trend Skoru', value: compositeScores.trend * 100, fill: '#F59E0B' },
                          { 
                            name: 'Potansiyel', 
                            value: compositeScores.potansiyel * 100, 
                            fill: '#8B5CF6'
                          }
                        ];

                        return (
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={bileşikSkorlar} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                              <YAxis stroke="#9CA3AF" fontSize={12} />
                              <RechartsTooltip
                            contentStyle={{ 
                              backgroundColor: '#1F2937', 
                              border: '1px solid #374151',
                                  borderRadius: '8px',
                                  color: '#f9fafb'
                                }}
                                formatter={(value: number) => [
                                  <span style={{ color: '#f9fafb' }}>{value.toFixed(1)}</span>, 
                                  <span style={{ color: '#f9fafb' }}>Skor</span>
                                ]}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                            </BarChart>
                      </ResponsiveContainer>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* 3. SIRADA: Indicator Detayları */}
                <motion.div
                  initial={{ y: 30, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", damping: 20, stiffness: 300 }}
                >
                  {secilenIl.is_merge_mode ? (
                    // Merge mode - çoklu kategori göstergeleri
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-white mb-4">📊 Çoklu Kategori Göstergeleri</h3>
                      {Object.entries(secilenIl.categoryScores || {}).map(([kategoriId, scoreData]: [string, any]) => (
                        <div key={kategoriId} className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                          <h4 className="text-md font-medium text-gray-200 mb-3">
                            {scoreData.category_name} (Ağırlık: {(scoreData.weight * 100).toFixed(0)}%)
                          </h4>
                          <IndicatorDetayComponent 
                            ilId={secilenIl.id} 
                            kategoriId={kategoriId} 
                            kategoriAdi={scoreData.category_name}
                          />
                      </div>
                      ))}
                      </div>
                  ) : (
                    // Tek kategori mode
                    <IndicatorDetayComponent 
                      ilId={secilenIl.id} 
                      kategoriId={secilenKategori} 
                      kategoriAdi={kategoriAdi}
                    />
                  )}
                </motion.div>

                {/* 4. SIRADA: Rapor Oluştur Butonu */}
                <motion.div
                  initial={{ y: 30, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", damping: 20, stiffness: 300 }}
                >
                  <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-green-500/10 border border-emerald-500/20">
                    <CardHeader>
                      <CardTitle className="text-emerald-100 flex items-center space-x-2">
                        <Star className="w-5 h-5" />
                        <span>AI Destekli Rapor</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center space-y-4">
                        <p className="text-gray-300 text-sm">
                          {secilenIl.il_adi} ili için {kategoriAdi} kategorisinde detaylı yatırım raporu oluşturun
                        </p>
                        
                        <Button 
                          className={`w-full font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                            aiAnalizSonucu 
                              ? 'bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 hover:from-green-500 hover:via-green-600 hover:to-emerald-500 shadow-green-500/25' 
                              : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-green-600 hover:from-emerald-500 hover:via-emerald-600 hover:to-green-500 shadow-emerald-500/25'
                          }`}
                          onClick={handleAiAnaliz}
                          disabled={aiAnalizYukleniyor}
                        >
                          <div className="flex items-center gap-2">
                            {aiAnalizYukleniyor ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>AI Analiz Ediliyor...</span>
                              </>
                            ) : aiAnalizSonucu ? (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Rapor Hazır - Yeniden Analiz Et</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-5 h-5" />
                                <span>Detaylı Rapor Oluştur</span>
                              </>
                            )}
                          </div>
                        </Button>
                        
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>• AI destekli analiz ve öneriler</p>
                          <p>• Sektörel karşılaştırmalar</p>
                          <p>• Yatırım fırsatları haritası</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* AI Analiz Sonuçları */}
                {(aiAnalizSonucu || aiAnalizHatasi) && (
                  <motion.div
                    initial={{ y: 30, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", damping: 20, stiffness: 300 }}
                    className="mt-6"
                    data-ai-rapor
                  >
                    <Card className="bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-indigo-500/10 border border-blue-500/20">
                      <CardHeader>
                        <CardTitle className="text-blue-100 flex items-center space-x-2">
                          <Zap className="w-5 h-5" />
                          <span>AI Analiz Raporu</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {aiAnalizHatasi ? (
                          <div className="text-center py-8">
                            <div className="text-red-400 mb-4">
                              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </div>
                            <p className="text-red-300 font-semibold mb-2">Analiz Hatası</p>
                            <p className="text-gray-400 text-sm">{aiAnalizHatasi}</p>
                            <Button 
                              onClick={handleAiAnaliz}
                              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
                              size="sm"
                            >
                              Tekrar Dene
                            </Button>
                          </div>
                        ) : aiAnalizSonucu ? (
                          <div className="space-y-4">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
                              <div className="flex items-center space-x-2 text-green-300">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-semibold">Analiz Tamamlandı</span>
                              </div>
                              <p className="text-green-200 text-sm mt-1">
                                {secilenIl.il_adi} ili için {kategoriAdi} kategorisinde detaylı analiz hazırlandı
                              </p>
                            </div>
                            
                            <div className="prose prose-invert prose-sm max-w-none">
                              <div 
                                className="text-gray-300 leading-relaxed whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ 
                                  __html: aiAnalizSonucu
                                    .replace(/\n/g, '<br>')
                                    .replace(/^#+\s*/gm, '') // Tüm # sembollerini kaldır
                                    .replace(/## (.*?)/g, '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>')
                                    .replace(/### (.*?)/g, '<h3 class="text-lg font-semibold text-blue-300 mt-4 mb-2">$1</h3>')
                                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                                    .replace(/\*(.*?)\*/g, '<em class="text-gray-200">$1</em>')
                                    .replace(/• (.*?)(?=<br>|$)/g, '<li class="ml-4">$1</li>')
                                    .replace(/(<li.*?<\/li>)/g, '<ul class="list-disc list-inside space-y-1 my-2">$1</ul>')
                                }}
                              />
                            </div>
                            
                            <div className="flex space-x-3 pt-4 border-t border-gray-700">
                              <Button 
                                onClick={() => {
                                  // HTML raporu oluştur
                                  const htmlContent = `
                                    <!DOCTYPE html>
                                    <html lang="tr">
                                    <head>
                                      <meta charset="UTF-8">
                                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                      <title>${secilenIl.il_adi} İli Yatırım Analizi</title>
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
                                          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
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
                                          color: #059669;
                                          font-size: 20px;
                                          font-weight: bold;
                                          margin-bottom: 20px;
                                          border-bottom: 2px solid #059669;
                                          padding-bottom: 10px;
                                        }
                                        .paragraph {
                                          margin-bottom: 15px;
                                          text-align: justify;
                                        }
                                        .heading {
                                          color: #059669;
                                          font-weight: bold;
                                          font-size: 16px;
                                          margin: 20px 0 10px 0;
                                          border-left: 4px solid #059669;
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
                                          .header { background: #3b82f6 !important; }
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="header">
                                        <h1>${secilenIl.il_adi} İli Yatırım Analizi</h1>
                                        <div class="subtitle">
                                          Kategori: ${kategoriAdi} | Sektör: ${secilenSektor === 'kamu' ? 'Kamu' : 'Özel'}
                                        </div>
                                        <div class="subtitle">
                                          Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}
                                        </div>
                                      </div>
                                      
                                      <div class="content">
                                        <div class="analysis-title">Yapay Zeka Analizi</div>
                                        <div class="analysis-content">
                                          ${aiAnalizSonucu
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
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                size="sm"
                              >
                                📄 Raporu Yazdır (HTML)
                              </Button>
                              <Button 
                                onClick={() => {
                                  setAiAnalizSonucu(null);
                                  setAiAnalizHatasi(null);
                                }}
                                variant="outline"
                                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                                size="sm"
                              >
                                ✕ Kapat
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

              </div>
            </motion.div>
  );
}

// Ana bileşen - Suspense ile wrap eder
export default function HaritaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white text-lg">Harita yükleniyor...</p>
          <p className="text-gray-400 text-sm mt-2">Parametreler hazırlanıyor</p>
        </div>
      </div>
    }>
      <HaritaContent />
    </Suspense>
  );
}
