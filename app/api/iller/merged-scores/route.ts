import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kategorilerParam = searchParams.get('kategoriler');
    const agirliklarParam = searchParams.get('agirliklar');
    const sektor = searchParams.get('sektor') || 'kamu'; // default: kamu
    
    console.log('🎯 Merge API çağrıldı:', { kategorilerParam, agirliklarParam, sektor });
    
    if (!kategorilerParam) {
      return NextResponse.json({
        success: false,
        message: 'Kategoriler parametresi gerekli'
      }, { status: 400 });
    }

    // Kategorileri ve ağırlıkları parse et
    const kategoriler = kategorilerParam.split(',').map(k => parseInt(k.trim()));
    let agirliklar: { [key: number]: number } = {};
    
    if (agirliklarParam) {
      const agirlikDegerleri = agirliklarParam.split(',').map(a => parseFloat(a.trim()));
      kategoriler.forEach((k, index) => {
        agirliklar[k] = agirlikDegerleri[index] || (1 / kategoriler.length);
      });
    } else {
      // Eşit ağırlık dağıt
      const eslitAgirlik = 1 / kategoriler.length;
      kategoriler.forEach(k => {
        agirliklar[k] = eslitAgirlik;
      });
    }

    console.log('📊 Kategoriler (Harita API):', kategoriler);
    console.log('⚖️ Ağırlıklar (Harita API):', agirliklar);
    console.log('🏢 Sektör (Harita API):', sektor);

    // Sektöre göre skor alanını belirle
    const skorAlani = sektor === 'kamu' ? 'priority_score' : 'attractiveness_score';
    
    // Weighted Average Model (Merge Algoritması)
    // Her il için ayrı ayrı hesaplama yap (il detay API ile aynı mantık)
    const allProvincesResult = await query('SELECT province_id, province_name FROM provinces ORDER BY province_id');
    
    const mergedData = [];
    
    const toNum = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : Math.max(0, Math.min(1, n));
    };

    for (const province of allProvincesResult.rows) {
      // Fallbacksız hesap
      let tw = 0, ws = 0;
      const kategoriSkorlari: { [key: string]: number } = {};
      const weightedSkorlar: { [key: string]: number } = {};

      for (const kategoriId of kategoriler) {
        const res = await query(`
          SELECT 
            AVG(${skorAlani}) / 100.0 as s,
            AVG(priority_score) / 100.0 as pr,
            AVG(attractiveness_score) / 100.0 as at
          FROM investment_scores 
          WHERE province_id = $1 AND category_id = $2
          AND year = (SELECT MAX(year) FROM investment_scores WHERE category_id = $2)
        `, [province.province_id, kategoriId]);
        const s = toNum(res.rows[0]?.s);
        const useScore = s;
        if (useScore !== null) {
          kategoriSkorlari[kategoriId.toString()] = useScore;
          const w = agirliklar[kategoriId];
          weightedSkorlar[kategoriId.toString()] = useScore * w;
          tw += w; ws += useScore * w;
        }
      }

      const mergedScore = tw > 0 ? (ws / tw) : 0;
      mergedData.push({
        province_id: province.province_id,
        province_name: province.province_name,
        genel_skor: Math.max(0, Math.min(1, mergedScore)),
        kategori_skorlari: kategoriSkorlari,
        merge_details: {
          kategoriler: kategoriler,
          agirliklar: agirliklar,
          sektor: sektor,
          algorithm: 'Weighted Average Model',
          weighted_scores: weightedSkorlar,
          simple_weighted_average: mergedScore
        }
      });
    }
    
    // Skorlara göre sırala
    mergedData.sort((a, b) => b.genel_skor - a.genel_skor);



    console.log('✅ Merge tamamlandı:', mergedData.length, 'il işlendi');
    console.log('📈 İlk 3 il örneği:', mergedData.slice(0, 3).map(il => ({
      name: il.province_name,
      score: il.genel_skor.toFixed(3),
      score_percentage: (il.genel_skor * 100).toFixed(1) + '%',
      categories: il.kategori_skorlari
    })));
    
    // Debug: Kocaeli için detaylı log
    const debugIl = mergedData.find(il => il.province_name === 'Kocaeli');
    if (debugIl) {
      console.log('🔍 DEBUG - Kocaeli ili detayları (Harita API):', {
        province_id: debugIl.province_id,
        name: debugIl.province_name,
        genel_skor: debugIl.genel_skor,
        genel_skor_yuzde: (debugIl.genel_skor * 100).toFixed(1) + '%',
        kategori_skorlari: debugIl.kategori_skorlari,
        merge_details: debugIl.merge_details
      });
    }

    return NextResponse.json({
      success: true,
      data: mergedData,
      merge_info: {
        total_provinces: mergedData.length,
        categories_count: kategoriler.length,
        sektor: sektor,
        weights: agirliklar,
        algorithm: 'Weighted Average Model'
      }
    });

  } catch (error) {
    console.error('❌ Merge API Hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'Merge skorları hesaplanamadı',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}
