import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: provinceId } = await params;
    const { searchParams } = new URL(request.url);
    const kategorilerParam = searchParams.get('kategoriler');
    const agirliklarParam = searchParams.get('agirliklar');
    const sektor = searchParams.get('sektor') || 'kamu';

    console.log('🎯 Merge Analytics API çağrıldı:', { provinceId, kategorilerParam, agirliklarParam, sektor });

    if (!provinceId || !kategorilerParam) {
      return NextResponse.json({
        success: false,
        message: 'İl ID ve Kategoriler parametresi gerekli'
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
      const eslitAgirlik = 1 / kategoriler.length;
      kategoriler.forEach(k => {
        agirliklar[k] = eslitAgirlik;
      });
    }

    console.log('📊 Kategoriler (İl Detay API):', kategoriler);
    console.log('⚖️ Ağırlıklar (İl Detay API):', agirliklar);
    console.log('🏢 Sektör (İl Detay API):', sektor);

    // Sektöre göre skor alanını belirle
    const skorAlani = sektor === 'kamu' ? 'priority_score' : 'attractiveness_score';

    // İl temel bilgilerini al
    const provinceResult = await query(
      'SELECT province_id, province_name FROM provinces WHERE province_id = $1',
      [provinceId]
    );

    if (provinceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'İl bulunamadı'
      }, { status: 404 });
    }

    const province = provinceResult.rows[0];

    // Kategori bilgilerini al
    const categoriesResult = await query(`
      SELECT category_id, category_name 
      FROM main_categories 
      WHERE category_id = ANY($1::int[])
      ORDER BY category_id
    `, [kategoriler]);

    const categoryNames = categoriesResult.rows.reduce((acc: any, row: any) => {
      acc[row.category_id] = row.category_name;
      return acc;
    }, {});

    // Her kategori için detaylı skorları hesapla
    const categoryScores: any = {};
    const detailedScores: any = {};

    const toNum = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : Math.max(0, Math.min(1, n));
    };

    for (const kategoriId of kategoriler) {
      // Bu kategori için skorları al (fallbacksız; veri yoksa NULL kalsın)
      const scoreResult = await query(`
        SELECT 
          AVG(${skorAlani}) / 100.0 as raw_score,
          AVG(priority_score) / 100.0 as priority_score,
          AVG(attractiveness_score) / 100.0 as attractiveness_score,
          AVG(current_status_score) / 100.0 as current_status,
          AVG(trend_score) / 100.0 as trend_score
        FROM investment_scores 
        WHERE province_id = $1 
        AND category_id = $2
        AND year = (SELECT MAX(year) FROM investment_scores WHERE category_id = $2)
      `, [provinceId, kategoriId]);

      const scores = scoreResult.rows[0] || {};
      const raw = toNum(scores.raw_score);
      const pr = toNum(scores.priority_score);
      const at = toNum(scores.attractiveness_score);
      const cs = toNum(scores.current_status);
      const tr = toNum(scores.trend_score);
      
      categoryScores[kategoriId] = {
        category_name: categoryNames[kategoriId] || `Kategori ${kategoriId}`,
        raw_score: raw,
        priority_score: pr,
        attractiveness_score: at,
        weight: agirliklar[kategoriId],
        weighted_score: (raw ?? 0) * agirliklar[kategoriId]
      };

      // Detaylı skorlar (composite scores)
      // Potansiyel skorunu sektöre göre hesapla
      const potentialScore = sektor === 'kamu' ? pr : at;
      
      detailedScores[kategoriId] = {
        current_status: cs,
        trend_score: tr,
        potential_score: potentialScore
      };
    }

    // Merge skorunu hesapla (Harita API ile aynı mantık)
    // SQL query ile aynı hesaplama mantığını kullan
    // Fallbacksız: mevcut verilerle ağırlıklı ortalama
    let totalWeightForMerge = 0;
    let weightedSumForMerge = 0;
    for (const kategoriId of kategoriler) {
      const s = (sektor === 'kamu' ? categoryScores[kategoriId]?.priority_score : categoryScores[kategoriId]?.attractiveness_score);
      if (s !== null && s !== undefined) {
        totalWeightForMerge += agirliklar[kategoriId];
        weightedSumForMerge += s * agirliklar[kategoriId];
      }
    }
    const finalScore = totalWeightForMerge > 0 ? (weightedSumForMerge / totalWeightForMerge) : 0;
    
    console.log('🔍 DEBUG - İl detay merge hesaplaması:', {
      provinceId,
      provinceName: province.province_name,
      finalScore,
      finalScore_yuzde: (finalScore * 100).toFixed(1) + '%'
    });

    // Gerçek ranking hesaplaması - harita API'sindeki aynı query'yi kullan
    // Basit ranking: tüm iller için aynı hesap (fallbacksız)
    const allProvincesResult = await query('SELECT province_id, province_name FROM provinces');
    const rankingArray: { province_id: number, province_name: string, merged_score: number }[] = [];
    for (const row of allProvincesResult.rows) {
      let tw = 0, ws = 0;
      for (const kategoriId of kategoriler) {
        const res = await query(`
          SELECT AVG(${skorAlani}) / 100.0 as s
          FROM investment_scores 
          WHERE province_id = $1 AND category_id = $2
          AND year = (SELECT MAX(year) FROM investment_scores WHERE category_id = $2)
        `, [row.province_id, kategoriId]);
        const s = toNum(res.rows[0]?.s);
        if (s !== null) { tw += agirliklar[kategoriId]; ws += s * agirliklar[kategoriId]; }
      }
      const score = tw > 0 ? (ws / tw) : 0;
      rankingArray.push({ province_id: row.province_id, province_name: row.province_name, merged_score: score });
    }
    rankingArray.sort((a, b) => b.merged_score - a.merged_score);
    const currentProvinceRank = rankingArray.findIndex(r => r.province_id === parseInt(provinceId)) + 1;
    const ranking = currentProvinceRank || 1;

    // Composite scores hesapla (ağırlıklı ortalama)
    const compositeScores = {
      current_status: 0,
      trend_score: 0,
      potential_score: 0
    };

    for (const kategoriId of kategoriler) {
      const weight = agirliklar[kategoriId];
      compositeScores.current_status += detailedScores[kategoriId].current_status * weight;
      compositeScores.trend_score += detailedScores[kategoriId].trend_score * weight;
      compositeScores.potential_score += detailedScores[kategoriId].potential_score * weight;
    }

    return NextResponse.json({
      success: true,
      data: {
        province: {
          id: parseInt(provinceId),
          name: province.province_name
        },
        merge_info: {
          categories: kategoriler,
          weights: agirliklar,
          algorithm: 'Weighted Average Model',
          sector: sektor
        },
        scores: {
          merged_score: Math.max(0, Math.min(1, finalScore)),
          sector_score: sektor === 'kamu' ? finalScore : finalScore, // Aynı değer, farklı yorumlama
          ranking: ranking,
          total_provinces: rankingArray.length
        },
        category_scores: categoryScores,
        composite_scores: compositeScores,
        detailed_breakdown: {
          simple_weighted_average: finalScore, // Basit ağırlıklı ortalama
          algorithm_type: 'Simple Weighted Average Model'
        }
      }
    });

  } catch (error) {
    console.error('❌ Merge Analytics API Hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'Merge analytics verileri getirilemedi',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}
