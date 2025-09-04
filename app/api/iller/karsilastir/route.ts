import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Karşılaştırma API çağrısı başladı');
    
    const { il1_id, il2_id, kategori } = await request.json();
    console.log('📝 Gelen parametreler:', { il1_id, il2_id, kategori });

    if (!il1_id || !il2_id || !kategori) {
      return NextResponse.json({
        success: false,
        message: 'İl ID\'leri ve kategori gerekli'
      }, { status: 400 });
    }

    // Her iki ilin verilerini direkt database'den al
    console.log('🔍 İl verileri çekiliyor:', { il1_id, il2_id, kategori });
    
    let il1Data, il2Data, il1Indicators, il2Indicators;
    
    try {
      [il1Data, il2Data, il1Indicators, il2Indicators] = await Promise.all([
        // Investment scores
        query(`
          SELECT 
            p.province_id as il_kodu,
            p.province_name as il_adi,
            s.category_id,
            s.current_status_score,
            s.trend_score,
            s.attractiveness_score,
            s.priority_score,
            (s.current_status_score + s.trend_score + s.attractiveness_score + s.priority_score) / 4 as ortalama_skor
          FROM provinces p
          LEFT JOIN investment_scores s ON p.province_id = s.province_id
          WHERE p.province_id = $1 
          AND s.year = (SELECT MAX(year) FROM investment_scores WHERE province_id = $1)
          AND s.category_id = $2
        `, [il1_id, kategori]),
        query(`
          SELECT 
            p.province_id as il_kodu,
            p.province_name as il_adi,
            s.category_id,
            s.current_status_score,
            s.trend_score,
            s.attractiveness_score,
            s.priority_score,
            (s.current_status_score + s.trend_score + s.attractiveness_score + s.priority_score) / 4 as ortalama_skor
          FROM provinces p
          LEFT JOIN investment_scores s ON p.province_id = s.province_id
          WHERE p.province_id = $1 
          AND s.year = (SELECT MAX(year) FROM investment_scores WHERE province_id = $1)
          AND s.category_id = $2
        `, [il2_id, kategori]),
        // Provincial data for il1
        query(`
          SELECT 
            pd.indicator_id,
            i.indicator_name,
            pd.value,
            i.unit
          FROM provincial_data pd
          JOIN indicators i ON pd.indicator_id = i.indicator_id
          WHERE pd.province_id = $1 
          AND i.category_id = $2
        `, [il1_id, kategori]),
        // Provincial data for il2
        query(`
          SELECT 
            pd.indicator_id,
            i.indicator_name,
            pd.value,
            i.unit
          FROM provincial_data pd
          JOIN indicators i ON pd.indicator_id = i.indicator_id
          WHERE pd.province_id = $1 
          AND i.category_id = $2
        `, [il2_id, kategori])
      ]);
      
      console.log('✅ Database sorguları başarılı:', { 
        il1_rows: il1Data.rows.length, 
        il2_rows: il2Data.rows.length,
        il1_indicators: il1Indicators.rows.length,
        il2_indicators: il2Indicators.rows.length
      });
      
    } catch (dbError) {
      console.error('❌ Database sorgu hatası:', dbError);
      return NextResponse.json({
        success: false,
        message: 'Database bağlantı hatası',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

    if (!il1Data.rows.length || !il2Data.rows.length) {
      console.error('❌ İl verileri bulunamadı:', { il1_rows: il1Data.rows.length, il2_rows: il2Data.rows.length });
      return NextResponse.json({
        success: false,
        message: 'İl verileri bulunamadı'
      }, { status: 404 });
    }

    // Investment scores'ları hazırla
    const il1InvestmentScores = il1Data.rows[0] ? {
      current_status_score: il1Data.rows[0].current_status_score,
      trend_score: il1Data.rows[0].trend_score,
      attractiveness_score: il1Data.rows[0].attractiveness_score,
      priority_score: il1Data.rows[0].priority_score,
      ortalama_skor: il1Data.rows[0].ortalama_skor
    } : {};

    const il2InvestmentScores = il2Data.rows[0] ? {
      current_status_score: il2Data.rows[0].current_status_score,
      trend_score: il2Data.rows[0].trend_score,
      attractiveness_score: il2Data.rows[0].attractiveness_score,
      priority_score: il2Data.rows[0].priority_score,
      ortalama_skor: il2Data.rows[0].ortalama_skor
    } : {};

    // Indicator verilerini hazırla
    const il1IndicatorData = {};
    const il2IndicatorData = {};
    
    il1Indicators.rows.forEach(row => {
      il1IndicatorData[row.indicator_name] = {
        value: row.value,
        unit: row.unit
      };
    });
    
    il2Indicators.rows.forEach(row => {
      il2IndicatorData[row.indicator_name] = {
        value: row.value,
        unit: row.unit
      };
    });

    const il1 = {
      il_kodu: il1Data.rows[0]?.il_kodu,
      il_adi: il1Data.rows[0]?.il_adi,
      investment_scores: il1InvestmentScores,
      indicators: il1IndicatorData
    };
    
    const il2 = {
      il_kodu: il2Data.rows[0]?.il_kodu,
      il_adi: il2Data.rows[0]?.il_adi,
      investment_scores: il2InvestmentScores,
      indicators: il2IndicatorData
    };
    
    console.log('✅ İl verileri alındı:', { il1: il1.il_adi, il2: il2.il_adi });

    // Kategoriye göre karşılaştırma yap
    const farklar = calculateDifferences(il1, il2, kategori);
    
    // Genel sonuç oluştur
    const genel_sonuc = generateGeneralResult(il1, il2, kategori, farklar);
    
    // AI analizi için veri hazırla
    const aiAnalizi = await generateAIAnalysisDirect(il1, il2, kategori, farklar);

    return NextResponse.json({
      success: true,
      data: {
        farklar,
        genel_sonuc,
        ai_analizi: aiAnalizi
      }
    });

  } catch (error) {
    console.error('❌ Karşılaştırma hatası:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    return NextResponse.json({
      success: false,
      message: 'Karşılaştırma sırasında hata oluştu',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

function calculateDifferences(il1: any, il2: any, kategori: string) {
  const farklar: { [key: string]: any } = {};

  // Investment scores karşılaştırması
  const investmentScoreFields = ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'];
  
  investmentScoreFields.forEach(alan => {
    const il1_deger = il1.investment_scores?.[alan] || 0;
    const il2_deger = il2.investment_scores?.[alan] || 0;
    const fark = il1_deger - il2_deger;
    const yuzde_fark = il2_deger !== 0 ? (fark / il2_deger) * 100 : 0;
    
    let daha_iyi: 'il1' | 'il2' | 'esit';
    if (Math.abs(fark) < 0.01) {
      daha_iyi = 'esit';
    } else if (fark > 0) {
      daha_iyi = 'il1';
    } else {
      daha_iyi = 'il2';
    }

    farklar[alan] = {
      il1_deger: il1_deger,
      il2_deger: il2_deger,
      fark: fark,
      yuzde_fark: yuzde_fark,
      daha_iyi: daha_iyi
    };
  });

  // Indicator verileri karşılaştırması
  const allIndicators = new Set([
    ...Object.keys(il1.indicators || {}),
    ...Object.keys(il2.indicators || {})
  ]);

  allIndicators.forEach(indicatorName => {
    const il1_deger = il1.indicators?.[indicatorName]?.value || 0;
    const il2_deger = il2.indicators?.[indicatorName]?.value || 0;
    const fark = il1_deger - il2_deger;
    const yuzde_fark = il2_deger !== 0 ? (fark / il2_deger) * 100 : 0;
    
    let daha_iyi: 'il1' | 'il2' | 'esit';
    if (Math.abs(fark) < 0.01) {
      daha_iyi = 'esit';
    } else if (fark > 0) {
      daha_iyi = 'il1';
    } else {
      daha_iyi = 'il2';
    }

    farklar[indicatorName] = {
      il1_deger: il1_deger,
      il2_deger: il2_deger,
      fark: fark,
      yuzde_fark: yuzde_fark,
      daha_iyi: daha_iyi,
      unit: il1.indicators?.[indicatorName]?.unit || il2.indicators?.[indicatorName]?.unit || ''
    };
  });

  return farklar;
}

function getKategoriAlanlari(kategori: string): string[] {
  // Kategori ID'sine göre alanları döndür
  const kategoriAlanlari: { [key: string]: string[] } = {
    '1': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '2': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '3': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '4': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '5': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '6': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '7': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '8': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '9': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'],
    '10': ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor']
  };

  return kategoriAlanlari[kategori] || ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'];
}

function generateGeneralResult(il1: any, il2: any, kategori: string, farklar: any): string {
  const kategoriAdlari: { [key: string]: string } = {
    'egitim': 'Eğitim',
    'saglik': 'Sağlık',
    'sanayi': 'Sanayi',
    'tarim': 'Tarım ve Hayvancılık'
  };

  const kategoriAdi = kategoriAdlari[kategori] || kategori;
  
  // Hangi ilin daha iyi olduğunu hesapla
  let il1Kazanma = 0;
  let il2Kazanma = 0;
  
  Object.values(farklar).forEach((fark: any) => {
    if (fark.daha_iyi === 'il1') il1Kazanma++;
    else if (fark.daha_iyi === 'il2') il2Kazanma++;
  });

  let genelSonuc = '';
  
  if (il1Kazanma > il2Kazanma) {
    genelSonuc = `${il1.il_adi}, ${kategoriAdi} kategorisinde ${il2.il_adi}'ye göre daha güçlü bir performans sergiliyor. ${il1Kazanma} alanda önde olan ${il1.il_adi}, bu sektörde daha gelişmiş bir altyapıya sahip.`;
  } else if (il2Kazanma > il1Kazanma) {
    genelSonuc = `${il2.il_adi}, ${kategoriAdi} kategorisinde ${il1.il_adi}'ye göre daha güçlü bir performans sergiliyor. ${il2Kazanma} alanda önde olan ${il2.il_adi}, bu sektörde daha gelişmiş bir altyapıya sahip.`;
  } else {
    genelSonuc = `${il1.il_adi} ve ${il2.il_adi} arasında ${kategoriAdi} kategorisinde dengeli bir rekabet var. Her iki il de farklı alanlarda güçlü yanlar sergiliyor.`;
  }

  return genelSonuc;
}

async function generateAIAnalysisDirect(il1: any, il2: any, kategori: string, farklar: any): Promise<string> {
  // Multiple API keys for fallback
  const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY // Fallback to original
  ].filter(key => key && key.trim() !== '');

  if (apiKeys.length === 0) {
    console.error('❌ Hiçbir Gemini API key bulunamadı');
    return 'AI servisi yapılandırılmamış. Lütfen daha sonra tekrar deneyin.';
  }

  // Try each API key until one works
  for (let i = 0; i < apiKeys.length; i++) {
    try {
      console.log(`🤖 Gemini AI key ${i + 1}/${apiKeys.length} deneniyor...`);
      
      // Gemini AI client'ını başlat
      const ai = new GoogleGenAI({
        apiKey: apiKeys[i] || ''
      });

    // Kategori ID'sini kategori adına çevir
    const kategoriAdlari: { [key: string]: string } = {
      '1': 'Çevre ve Enerji',
      '2': 'Eğitim ve Kültür',
      '3': 'İnşaat ve Konut',
      '4': 'İstihdam ve İşsizlik',
      '5': 'Nüfus ve Demografi',
      '6': 'Sağlık ve Sosyal Koruma',
      '7': 'Sanayi',
      '8': 'Tarım ve Hayvancılık',
      '9': 'Ulaştırma ve Haberleşme',
      '10': 'Ulusal Hesaplar',
      // String versiyonları da
      'egitim': 'Eğitim ve Kültür',
      'saglik': 'Sağlık ve Sosyal Koruma',
      'sanayi': 'Sanayi',
      'tarim': 'Tarım ve Hayvancılık'
    };

    const kategoriAdi = kategoriAdlari[kategori] || kategori;

    // Investment score indicator isimlerini al
    const indicatorIsimleri: { [key: string]: string } = {
      'current_status_score': 'Mevcut Durum Skoru',
      'trend_score': 'Trend Skoru',
      'attractiveness_score': 'Çekicilik Skoru',
      'priority_score': 'Öncelik Skoru',
      'ortalama_skor': 'Ortalama Skor',
      // Eski indicator isimleri de (fallback için)
      'universite_sayisi': 'Üniversite Sayısı',
      'ogrenci_sayisi': 'Öğrenci Sayısı',
      'ogretmen_sayisi': 'Öğretmen Sayısı',
      'okuryazarlik_orani': 'Okuryazarlık Oranı (%)',
      'hastane_sayisi': 'Hastane Sayısı',
      'doktor_sayisi': 'Doktor Sayısı',
      'saglik_calisani_sayisi': 'Sağlık Çalışanı Sayısı',
      'nufus': 'Nüfus',
      'nufus_artis_hizi': 'Nüfus Artış Hızı (%)',
      'genc_nufus_orani': 'Genç Nüfus Oranı (%)',
      'fabrika_sayisi': 'Fabrika Sayısı',
      'sanayi_ciro': 'Sanayi Ciro (TL)',
      'calisan_sayisi': 'Çalışan Sayısı',
      'tarim_alani': 'Tarım Alanı (hektar)',
      'hayvan_sayisi': 'Hayvan Sayısı',
      'tarim_uretim': 'Tarım Üretimi (ton)',
      'yol_uzunlugu': 'Yol Uzunluğu (km)',
      'arac_sayisi': 'Araç Sayısı',
      'ulasim_hizmeti': 'Ulaşım Hizmeti Sayısı',
      'gsyh': 'GSYH (TL)',
      'kisi_basi_gelir': 'Kişi Başı Gelir (TL)',
      'istihdam_orani': 'İstihdam Oranı (%)',
      'isizlik_orani': 'İşsizlik Oranı (%)'
    };

      const prompt = `
Sen bir yatırım analisti ve Türkiye'deki illerin ekonomik potansiyelini değerlendiren bir uzmansın.
Aşağıdaki verileri analiz ederek ${il1.il_adi} ve ${il2.il_adi} illeri arasında ${kategoriAdi} kategorisinde detaylı bir karşılaştırma analizi hazırla.

⚠️ KRİTİK UYARI: 
1. Aşağıdaki verilerdeki tüm değerler gerçek değerlerdir
2. 0 olan değerler gerçekten 0'dır, eksik veri değildir
3. ASLA "eksik veri", "veri eksikliği", "bulunmaması" gibi ifadeler kullanma
4. Sadece mevcut verilerle analiz yap, eksik olanları görmezden gel
5. Pozitif ve yapıcı bir ton kullan

📊 KULLANILAN METRİKLER VE ANLAMLARI:
- Mevcut Durum Skoru: İlin şu anki performans seviyesi (0-100 arası)
- Trend Skoru: İlin gelecekteki potansiyeli ve büyüme eğilimi (0-100 arası)
- Çekicilik Skoru: İlin yatırım çekiciliği ve cazibesi (0-100 arası)
- Öncelik Skoru: İlin yatırım önceliği ve aciliyeti (0-100 arası)
- Ortalama Skor: Tüm metriklerin ortalaması, genel performans (0-100 arası)
Karşılaştırma Verileri:

${il1.il_adi} İli ${kategoriAdi} Investment Skorları:
${Object.entries(il1.investment_scores || {}).map(([key, value]: [string, any]) => 
  `- ${indicatorIsimleri[key] || key.replace(/_/g, ' ')}: ${value}`
).join('\n')}

${il1.il_adi} İli ${kategoriAdi} Indicator Verileri:
${Object.entries(il1.indicators || {}).map(([indicatorName, data]: [string, any]) => 
  `- ${indicatorName}: ${data.value} ${data.unit || ''}`
).join('\n')}

${il2.il_adi} İli ${kategoriAdi} Investment Skorları:
${Object.entries(il2.investment_scores || {}).map(([key, value]: [string, any]) => 
  `- ${indicatorIsimleri[key] || key.replace(/_/g, ' ')}: ${value}`
).join('\n')}

${il2.il_adi} İli ${kategoriAdi} Indicator Verileri:
${Object.entries(il2.indicators || {}).map(([indicatorName, data]: [string, any]) => 
  `- ${indicatorName}: ${data.value} ${data.unit || ''}`
).join('\n')}

Detaylı Fark Analizi:

Investment Skorları Karşılaştırması:
${Object.entries(farklar).filter(([key]) => ['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'].includes(key)).map(([key, fark]: [string, any]) => `
${indicatorIsimleri[key] || key.replace(/_/g, ' ')}:
  - ${il1.il_adi}: ${fark.il1_deger}
  - ${il2.il_adi}: ${fark.il2_deger}
  - Fark: ${fark.fark > 0 ? '+' : ''}${fark.fark} (${fark.yuzde_fark > 0 ? '+' : ''}${fark.yuzde_fark.toFixed(1)}%)
  - Daha İyi: ${fark.daha_iyi === 'il1' ? il1.il_adi : fark.daha_iyi === 'il2' ? il2.il_adi : 'Eşit'}
`).join('\n')}

Indicator Verileri Karşılaştırması:
${Object.entries(farklar).filter(([key]) => !['current_status_score', 'trend_score', 'attractiveness_score', 'priority_score', 'ortalama_skor'].includes(key)).map(([key, fark]: [string, any]) => `
${key}:
  - ${il1.il_adi}: ${fark.il1_deger} ${fark.unit || ''}
  - ${il2.il_adi}: ${fark.il2_deger} ${fark.unit || ''}
  - Fark: ${fark.fark > 0 ? '+' : ''}${fark.fark} (${fark.yuzde_fark > 0 ? '+' : ''}${fark.yuzde_fark.toFixed(1)}%)
  - Daha İyi: ${fark.daha_iyi === 'il1' ? il1.il_adi : fark.daha_iyi === 'il2' ? il2.il_adi : 'Eşit'}
`).join('\n')}

Lütfen aşağıdaki formatda detaylı bir karşılaştırma analizi hazırla:

## 📊 ${il1.il_adi} vs ${il2.il_adi} - ${kategoriAdi} Karşılaştırması

### 🎯 Genel Değerlendirme
[İki il arasındaki genel durum ve ${kategoriAdi} kategorisindeki performans farkları hakkında 2-3 paragraf]

### 📈 Güçlü Yönler Analizi
[Her iki ilin ${kategoriAdi} kategorisindeki güçlü yönleri - 3-4 madde]

### 🔍 Detaylı Karşılaştırma
[Her bir metrik için detaylı karşılaştırma - 4-5 madde]

### 🚀 Yatırım Fırsatları
[Her iki il için ${kategoriAdi} kategorisinde yatırım fırsatları - 3-4 madde]

### 💡 Stratejik Öneriler
[${kategoriAdi} kategorisinde hangi ilin daha avantajlı olduğu ve neden - 4-5 madde]

### 🎯 Sonuç ve Tavsiye
[Genel değerlendirme ve hangi ilin ${kategoriAdi} kategorisinde daha iyi olduğu konusunda net tavsiye]

Raporu Türkçe olarak hazırla ve profesyonel bir ton kullan. Verileri objektif bir şekilde analiz et ve somut öneriler sun.

YASAK KELİMELER: "eksik", "bulunmaması", "mevcut değil", "veri eksikliği", "yetersiz", "sınırlı"
Bu kelimeleri ASLA kullanma! Sadece pozitif ve yapıcı yorumlar yap.

ÖNEMLİ UYARILAR:
- Sadece mevcut verilerle analiz yap
- Pozitif ve yapıcı yorumlar yap
- VERİLERİ DİKKATLİ OKU: Tüm değerler gerçek verilerdir
- Eğer bir değer 0 ise, bu gerçekten 0 demektir
- İki il arasında objektif karşılaştırma yap

📈 ANALİZ TALİMATLARI:
- Her metriği (Mevcut Durum Skoru, Trend Skoru, Çekicilik Skoru, Öncelik Skoru, Ortalama Skor) ayrı ayrı analiz et
- Skor farklarını yorumla ve hangi ilin neden daha iyi olduğunu açıkla
- Yüksek skorların ne anlama geldiğini ve yatırım açısından önemini belirt
- Düşük skorların bile pozitif yönlerini bul ve gelişim fırsatları olarak sun
- Her iki il için de somut yatırım önerileri ver
- ${kategoriAdi} kategorisine özel yatırım stratejileri öner
`;

      console.log('🤖 Gemini AI il karşılaştırması başlatılıyor...', { il1: il1.il_adi, il2: il2.il_adi, kategori, keyIndex: i + 1 });

      // Gemini AI'dan analiz iste
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        }
      });

      const analysisText = response.text;

      console.log(`✅ Gemini AI il karşılaştırması tamamlandı (Key ${i + 1})`);

      return analysisText;

    } catch (error) {
      console.error(`❌ Gemini AI key ${i + 1} hatası:`, error);
      
      // Eğer son key ise, hata mesajını döndür
      if (i === apiKeys.length - 1) {
        // Gemini AI overload hatası
        if (error instanceof Error && error.message.includes('overloaded')) {
          return 'Tüm AI servisleri şu anda aşırı yüklü. Lütfen birkaç dakika sonra tekrar deneyin.';
        }
        
        // Diğer hatalar
        return 'AI analizi şu anda mevcut değil. Lütfen daha sonra tekrar deneyin.';
      }
      
      // Başka key'ler varsa, bir sonrakini dene
      console.log(`🔄 Key ${i + 1} başarısız, bir sonraki key deneniyor...`);
      continue;
    }
  }
  
  // Bu noktaya ulaşırsa, tüm key'ler başarısız oldu
  return 'AI analizi şu anda mevcut değil. Lütfen daha sonra tekrar deneyin.';
}