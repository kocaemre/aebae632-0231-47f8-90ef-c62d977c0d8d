import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('Kategoriler getiriliyor...');
    
    // Ana kategorileri getir
    const result = await query(`
      SELECT 
        category_id as id,
        category_name as ad
      FROM main_categories 
      ORDER BY category_id
    `);

    const kategoriler = result.rows.map(row => ({
      id: row.id.toString(),
      ad: row.ad,
      aciklama: getKategoriAciklama(row.ad),
      icon: getKategoriIcon(row.ad),
      renk: getKategoriRenk(row.ad),
      aktif: false
    }));

    return NextResponse.json({
      success: true,
      data: kategoriler
    });

  } catch (error) {
    console.error('Kategoriler API Hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'Kategoriler getirilemedi',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}

// Kategori açıklamalarını map et
function getKategoriAciklama(kategoriAd: string): string {
  const aciklamalar: { [key: string]: string } = {
    'Çevre ve Enerji': 'Yenilenebilir enerji potansiyeli ve çevresel sürdürülebilirlik',
    'Eğitim ve Kültür': 'Okul sayısı, eğitim kalitesi, ve kültürel etkinlikler',
    'İnşaat ve Konut': 'Yapı ruhsatları ve inşaat sektörü potansiyeli',
    'İstihdam ve İşsizlik': 'İşgücü piyasası, istihdam oranları ve iş imkanları',
    'Nüfus ve Demografi': 'Nüfus yapısı, göç eğilimleri ve demografik veriler',
    'Sağlık ve Sosyal Koruma': 'Hastane sayısı, doktor sayısı ve sağlık hizmetleri altyapısı',
    'Sanayi': 'Şehrin girişim potansiyeli',
    'Tarım ve Hayvancılık': 'Tarımsal alan, üretim miktarı, hayvan sayısı',
    'Ulaştırma ve Haberleşme': 'Ulaşım ağı, yol refahı ve yol güvenliği',
    'Ulusal Hesaplar': 'GSYH, kişi başı gelir ve ekonomik göstergeler'
  };
  
  return aciklamalar[kategoriAd] || 'Detaylı analiz ve yatırım potansiyeli değerlendirmesi';
}

// Kategori ikonlarını map et
function getKategoriIcon(kategoriAd: string): string {
  const ikonlar: { [key: string]: string } = {
    'Çevre ve Enerji': '⚡',
    'Eğitim ve Kültür': '📚',
    'İnşaat ve Konut': '🏗️',
    'İstihdam ve İşsizlik': '👥',
    'Nüfus ve Demografi': '👨‍👩‍👧‍👦',
    'Sağlık ve Sosyal Koruma': '🏥',
    'Sanayi': '🏭',
    'Tarım ve Hayvancılık': '🌱',
    'Ulaştırma ve Haberleşme': '🚛',
    'Ulusal Hesaplar': '💰'
  };
  
  return ikonlar[kategoriAd] || '📊';
}

// Kategori renklerini map et
function getKategoriRenk(kategoriAd: string): string {
  const renkler: { [key: string]: string } = {
    'Çevre ve Enerji': '#84CC16',
    'Eğitim ve Kültür': '#3B82F6',
    'İnşaat ve Konut': '#F97316',
    'İstihdam ve İşsizlik': '#8B5CF6',
    'Nüfus ve Demografi': '#06B6D4',
    'Sağlık ve Sosyal Koruma': '#EF4444',
    'Sanayi': '#8B5CF6',
    'Tarım ve Hayvancılık': '#10B981',
    'Ulaştırma ve Haberleşme': '#F59E0B',
    'Ulusal Hesaplar': '#FBBF24'
  };
  
  return renkler[kategoriAd] || '#6B7280';
}
