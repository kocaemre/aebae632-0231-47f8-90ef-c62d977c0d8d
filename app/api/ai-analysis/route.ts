import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Gemini AI client'ını başlat
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
});

export async function POST(request: NextRequest) {
  try {
    // API key kontrolü
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Gemini AI API key tanımlanmamış. Lütfen .env.local dosyasında GEMINI_API_KEY değişkenini tanımlayın.'
      }, { status: 500 });
    }

    const body = await request.json();
    const { ilAdi, kategoriAdi, ilVerileri, secilenSektor, type, data } = body;

    // İl karşılaştırması için farklı işlem
    if (type === 'il_karsilastirma') {
      return await handleIlKarsilastirma(data);
    }

    if (!ilAdi || !kategoriAdi || !ilVerileri) {
      return NextResponse.json({
        success: false,
        message: 'Gerekli parametreler eksik'
      }, { status: 400 });
    }

    // Kategori sayısını belirle
    const kategoriSayisi = Object.keys(ilVerileri.kategori_skorlari || {}).length;
    const isMergeMode = ilVerileri.is_merge_mode || kategoriSayisi > 1;
    
    // İl verilerini analiz etmek için prompt hazırla
      const prompt = `
Sen bir yatırım analisti ve Türkiye'deki illerin ekonomik potansiyelini değerlendiren bir uzmansın.
Aşağıdaki verileri analiz ederek ${ilAdi} ili için ${isMergeMode ? 'seçilen kategoriler' : kategoriAdi} analizinde detaylı bir yatırım raporu hazırla.

⚠️ KRİTİK UYARI: 
1. Aşağıdaki verilerdeki tüm skorlar gerçek değerlerdir
2. 0 olan skorlar gerçekten 0'dır, eksik veri değildir
3. ASLA "eksik veri", "veri eksikliği", "bulunmaması" gibi ifadeler kullanma
4. Sadece mevcut verilerle analiz yap, eksik olanları görmezden gel
5. Pozitif ve yapıcı bir ton kullan
6. ASLA "Weighted Average Model", "Harmonik Düzeltme", "Çoklu Kategori Analizi projesi" gibi teknik terimler kullanma

İl Bilgileri:
- İl Adı: ${ilAdi}
- Analiz Türü: ${isMergeMode ? 'Çoklu Kategori Analizi' : 'Tek Kategori Analizi'}
- Sektör: ${secilenSektor === 'kamu' ? 'Kamu' : 'Özel'}
- Yüzölçümü: ${ilVerileri.yuzolcumu || 'Bilinmiyor'} km²
- Nüfus: ${ilVerileri.nufus || 'Bilinmiyor'}

${isMergeMode ? `
Seçilen Kategoriler ve Skorları:
${Object.entries(ilVerileri.kategori_skorlari || {}).map(([kategori, skor]) => 
  `- ${kategori}: ${((Number(skor) || 0) * 100).toFixed(1)}%`
).join('\n')}

Kategori Ağırlıkları:
${ilVerileri.kategoriAgirliklar ? Object.entries(ilVerileri.kategoriAgirliklar).map(([kategori, agirlik]) => 
  `- ${kategori}: ${((Number(agirlik) || 0) * 100).toFixed(1)}%`
).join('\n') : 'Eşit ağırlık'}

Kategori Detayları:
${ilVerileri.categoryScores ? Object.entries(ilVerileri.categoryScores).map(([kategoriId, scores]: [string, any]) => {
  // Çoklu kategori modunda kategori ismini category_scores'dan al
  const kategoriAdi = scores?.category_name || `Kategori ${kategoriId}`;
  return `
${kategoriAdi}:
  - Mevcut Durum: ${((scores?.current_status_score || 0) * 100).toFixed(1)}%
  - Trend: ${((scores?.trend_score || 0) * 100).toFixed(1)}%
  - Çekicilik: ${((scores?.attractiveness_score || 0) * 100).toFixed(1)}%
  - Öncelik: ${((scores?.priority_score || 0) * 100).toFixed(1)}%
  - Ağırlık: ${((scores?.weight || 0) * 100).toFixed(1)}%`;
}).join('\n') : 'Detay verisi mevcut değil'}
` : `
Tek Kategori Analizi - ${kategoriAdi}:
- Kategori Skoru: ${(ilVerileri.kategori_skorlari?.[kategoriAdi] * 100 || ilVerileri.genel_skor * 100 || 0).toFixed(1)}%

Kategori Performans Detayları:
${ilVerileri.categoryPerformance && Array.isArray(ilVerileri.categoryPerformance) ? ilVerileri.categoryPerformance.map((cat: any) => 
  `- ${cat.category || kategoriAdi}:
    * Çekicilik Skoru: ${(Number(cat.attractivenessScore) || 0).toFixed(1)}%
    * Öncelik Skoru: ${(Number(cat.priorityScore) || 0).toFixed(1)}%`
).join('\n') : 'Performans verisi mevcut değil'}

Yatırım Skorları:
${ilVerileri.investmentScores && Array.isArray(ilVerileri.investmentScores) ? ilVerileri.investmentScores.map((inv: any) => 
  `- ${inv.category || kategoriAdi}:
    * Mevcut Durum: ${(Number(inv.scores?.current_status) || 0).toFixed(1)}%
    * Trend: ${(Number(inv.scores?.trend) || 0).toFixed(1)}%
    * Çekicilik: ${(Number(inv.scores?.attractiveness) || 0).toFixed(1)}%
    * Öncelik: ${(Number(inv.scores?.priority) || 0).toFixed(1)}%`
).join('\n') : 'Yatırım skoru verisi mevcut değil'}

Yıllık Trend Verileri:
${ilVerileri.yearlyTrend && Array.isArray(ilVerileri.yearlyTrend) ? ilVerileri.yearlyTrend.map((trend: any) => 
  `- ${trend.year}: ${(trend.score || 0).toFixed(1)}%`
).join('\n') : 'Trend verisi mevcut değil'}
`}

Temel İstatistikler:
${ilVerileri.basicStats ? Object.entries(ilVerileri.basicStats).map(([key, value]) => 
  `- ${key}: ${value}`
).join('\n') : 'Veri mevcut değil'}

Genel Skorlar:
${ilVerileri.compositeScores ? Object.entries(ilVerileri.compositeScores).map(([key, value]) => 
  `- ${key}: ${((Number(value) || 0) * 100).toFixed(1)}%`
).join('\n') : 'Veri mevcut değil'}

${ilVerileri.avantajlar && Array.isArray(ilVerileri.avantajlar) ? `
Avantajlar:
${ilVerileri.avantajlar.map((av: string) => `- ${av || 'Bilinmeyen avantaj'}`).join('\n')}
` : ''}

${ilVerileri.projeler && Array.isArray(ilVerileri.projeler) ? `
Mevcut Projeler:
${ilVerileri.projeler.map((proje: any) => 
  `- ${proje?.ad || 'Bilinmeyen proje'}: ${proje?.durum || 'Bilinmeyen durum'} (Bütçe: ${proje?.butce || 'Bilinmeyen'})`
).join('\n')}
` : ''}

Lütfen aşağıdaki formatda detaylı bir analiz raporu hazırla:

${isMergeMode ? `
## 📊 ${ilAdi} İli Seçilen Kategoriler Yatırım Analizi

### 🎯 Genel Değerlendirme
[İlin genel durumu ve seçilen kategorilerdeki potansiyeli hakkında 2-3 paragraf]

### 📈 Kategori Bazında Güçlü Yönler
[Her kategori için avantajları - kategori sayısına göre 2-3 madde]

### 🔄 Kategori Arası Sinerji ve Etkileşim
[Kategoriler arasındaki pozitif ve negatif etkileşimler - 3-4 madde]

### 🚀 Entegre Yatırım Fırsatları
[Seçilen kategoriler yaklaşımıyla yatırım yapılabilecek alanlar - 4-5 madde]

### 💡 Stratejik Öneriler
[${secilenSektor === 'kamu' ? 'Kamu' : 'Özel'} sektör için seçilen kategoriler stratejisi - 4-5 madde]

### 🎯 Sonuç ve Entegre Tavsiye
[Genel değerlendirme ve seçilen kategoriler yatırım tavsiyesi]
` : `
## 📊 ${ilAdi} İli ${kategoriAdi} Kategorisi Yatırım Analizi

### 🎯 Genel Değerlendirme
[İlin genel durumu ve ${kategoriAdi} potansiyeli hakkında 2-3 paragraf]

### 📈 Güçlü Yönler
[İlin ${kategoriAdi} kategorisindeki avantajları - 3-4 madde]

### 🚀 Yatırım Fırsatları
[${kategoriAdi} kategorisinde yatırım yapılabilecek alanlar - 3-4 madde]

### 💡 Stratejik Öneriler
[${secilenSektor === 'kamu' ? 'Kamu' : 'Özel'} sektör için ${kategoriAdi} önerileri - 3-4 madde]

### 🎯 Sonuç ve Tavsiye
[Genel değerlendirme ve ${kategoriAdi} yatırım tavsiyesi]
`}

Raporu Türkçe olarak hazırla ve profesyonel bir ton kullan. Verileri objektif bir şekilde analiz et ve somut öneriler sun. 

YASAK KELİMELER: "eksik", "bulunmaması", "mevcut değil", "veri eksikliği", "yetersiz", "sınırlı", "Weighted Average Model", "Harmonik Düzeltme", "Çoklu Kategori Analizi projesi"
Bu kelimeleri ASLA kullanma! Sadece pozitif ve yapıcı yorumlar yap.

ÖNEMLİ UYARILAR:
- Sadece mevcut verilerle analiz yap
- Pozitif ve yapıcı yorumlar yap
- VERİLERİ DİKKATLİ OKU: Performans skorları 0-100 arasında
- Eğer bir skor 0 ise, bu gerçekten 0 demektir
- ASLA teknik jargon veya alakasız terimler kullanma

${isMergeMode ? 'Seçilen kategoriler analizinde kategoriler arası etkileşimleri ve sinerjileri vurgula.' : 'Tek kategori analizinde o kategoriye odaklan ve derinlemesine analiz yap.'}
`;

      console.log('🤖 Gemini AI analizi başlatılıyor...', { ilAdi, kategoriAdi });
  console.log('📊 İl verileri yapısı:', JSON.stringify(ilVerileri, null, 2));
  console.log('🔍 CategoryPerformance detayı:', JSON.stringify(ilVerileri.categoryPerformance, null, 2));
  console.log('🔍 InvestmentScores detayı:', JSON.stringify(ilVerileri.investmentScores, null, 2));
  
  // Veri yapısını kontrol et - SQL'den gelen veriler zaten mevcut
  console.log('🔍 Mevcut veri alanları:');
  console.log('- categoryPerformance:', !!ilVerileri.categoryPerformance);
  console.log('- investmentScores:', !!ilVerileri.investmentScores);
  console.log('- yearlyTrend:', !!ilVerileri.yearlyTrend);
  
  console.log('🔧 Düzeltilmiş veri yapısı:', JSON.stringify(ilVerileri, null, 2));
  
  // AI'ye gönderilecek prompt'u kontrol et
  console.log('📝 AI prompt baslangici:');
  console.log('Kategori Performans Detaylari:');
  console.log(ilVerileri.categoryPerformance && Array.isArray(ilVerileri.categoryPerformance) ? ilVerileri.categoryPerformance.map((cat: any) => 
    `- ${cat.categoryName || kategoriAdi}:
    * Performans Skoru: ${(Number(cat.performanceScore) || 0).toFixed(1)}%
    * Cekicilik Skoru: ${(Number(cat.attractivenessScore) || 0).toFixed(1)}%
    * Oncelik Skoru: ${(Number(cat.priorityScore) || 0).toFixed(1)}%`
  ).join('\n') : 'Performans verisi mevcut degil');

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

    console.log('✅ Gemini AI analizi tamamlandı');

    return NextResponse.json({
      success: true,
      data: {
        ilAdi,
        kategoriAdi,
        sektor: secilenSektor,
        analiz: analysisText,
        olusturmaTarihi: new Date().toISOString(),
        model: 'gemini-2.0-flash'
      }
    });

  } catch (error) {
    console.error('❌ Gemini AI analiz hatası:', error);
    
    return NextResponse.json({
      success: false,
      message: 'AI analizi sırasında hata oluştu',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}

async function handleIlKarsilastirma(data: any) {
  try {
    const { il1, il2, kategori, farklar } = data;

    const kategoriAdlari: { [key: string]: string } = {
      'egitim': 'Eğitim',
      'saglik': 'Sağlık',
      'sanayi': 'Sanayi',
      'tarim': 'Tarım ve Hayvancılık'
    };

    const kategoriAdi = kategoriAdlari[kategori] || kategori;

    const prompt = `
Sen bir yatırım analisti ve Türkiye'deki illerin ekonomik potansiyelini değerlendiren bir uzmansın.
Aşağıdaki verileri analiz ederek ${il1.ad} ve ${il2.ad} illeri arasında ${kategoriAdi} kategorisinde detaylı bir karşılaştırma analizi hazırla.

⚠️ KRİTİK UYARI: 
1. Aşağıdaki verilerdeki tüm değerler gerçek değerlerdir
2. 0 olan değerler gerçekten 0'dır, eksik veri değildir
3. ASLA "eksik veri", "veri eksikliği", "bulunmaması" gibi ifadeler kullanma
4. Sadece mevcut verilerle analiz yap, eksik olanları görmezden gel
5. Pozitif ve yapıcı bir ton kullan

Karşılaştırma Verileri:

${il1.ad} İli ${kategoriAdi} Verileri:
${Object.entries(il1.veriler).map(([key, veri]: [string, any]) => 
  `- ${key.replace(/_/g, ' ')}: ${veri.deger} ${veri.daha_iyi ? '(Güçlü)' : ''}`
).join('\n')}

${il2.ad} İli ${kategoriAdi} Verileri:
${Object.entries(il2.veriler).map(([key, veri]: [string, any]) => 
  `- ${key.replace(/_/g, ' ')}: ${veri.deger} ${veri.daha_iyi ? '(Güçlü)' : ''}`
).join('\n')}

Detaylı Fark Analizi:
${Object.entries(farklar).map(([key, fark]: [string, any]) => `
${key.replace(/_/g, ' ')}:
  - ${il1.ad}: ${fark.il1_deger}
  - ${il2.ad}: ${fark.il2_deger}
  - Fark: ${fark.fark > 0 ? '+' : ''}${fark.fark} (${fark.yuzde_fark > 0 ? '+' : ''}${fark.yuzde_fark.toFixed(1)}%)
  - Daha İyi: ${fark.daha_iyi === 'il1' ? il1.ad : fark.daha_iyi === 'il2' ? il2.ad : 'Eşit'}
`).join('\n')}

Lütfen aşağıdaki formatda detaylı bir karşılaştırma analizi hazırla:

## 📊 ${il1.ad} vs ${il2.ad} - ${kategoriAdi} Karşılaştırması

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
`;

    console.log('🤖 Gemini AI il karşılaştırması başlatılıyor...', { il1: il1.ad, il2: il2.ad, kategori });

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

    console.log('✅ Gemini AI il karşılaştırması tamamlandı');

    return NextResponse.json({
      success: true,
      analysis: analysisText
    });

  } catch (error) {
    console.error('❌ Gemini AI il karşılaştırması hatası:', error);
    
    return NextResponse.json({
      success: false,
      message: 'AI analizi sırasında hata oluştu',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}
