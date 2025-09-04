import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: ilId } = await params;
    console.log('İl analytics isteniyor:', ilId);

    // İl adını ID'den bul (hem string isim hem numeric ID destekle)
    const ilQuery = isNaN(Number(ilId)) 
      ? `SELECT province_id, province_name FROM provinces WHERE province_name = $1`
      : `SELECT province_id, province_name FROM provinces WHERE province_id = $1`;
    
    const ilResult = await query(ilQuery, [ilId]);
    
    if (ilResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'İl bulunamadı'
      }, { status: 404 });
    }

    const il = ilResult.rows[0];
    const provinceId = il.province_id;
    const provinceName = il.province_name;

    // 1. Investment Scores (En son yıl için 4'lü skor)
    const investmentScoresQuery = await query(`
      SELECT 
        i.category_id,
        mc.category_name,
        i.current_status_score,
        i.trend_score,
        i.attractiveness_score,
        i.priority_score,
        i.year
      FROM investment_scores i
      JOIN main_categories mc ON i.category_id = mc.category_id
      WHERE i.province_id = $1
      ORDER BY i.year DESC, mc.category_name
    `, [provinceId]);

    // 2. Kategori Performans - En son yıl skorları
    const categoryPerformanceQuery = await query(`
      SELECT DISTINCT
        i.category_id,
        mc.category_name,
        i.priority_score,
        i.attractiveness_score,
        i.year
      FROM investment_scores i
      JOIN main_categories mc ON i.category_id = mc.category_id
      WHERE i.province_id = $1 
        AND i.year = (SELECT MAX(year) FROM investment_scores WHERE province_id = $1 AND category_id = i.category_id)
      ORDER BY mc.category_name
    `, [provinceId]);

    // 3. Yıllık Trend (Tüm yıllar için seçili kategorinin skorları)
    const trendQuery = await query(`
      SELECT 
        i.year,
        i.category_id,
        mc.category_name,
        i.priority_score,
        i.attractiveness_score,
        i.current_status_score,
        i.trend_score
      FROM investment_scores i
      JOIN main_categories mc ON i.category_id = mc.category_id
      WHERE i.province_id = $1
      ORDER BY i.year ASC, i.category_id
    `, [provinceId]);

    // 4. Temel İstatistikler (En son yıl)
    const basicStatsQuery = await query(`
      SELECT 
        pd.year,
        i.indicator_name,
        i.unit,
        pd.value,
        mc.category_name
      FROM provincial_data pd
      JOIN indicators i ON pd.indicator_id = i.indicator_id
      JOIN main_categories mc ON i.category_id = mc.category_id
      WHERE pd.province_id = $1 
        AND pd.year = (SELECT MAX(year) FROM provincial_data WHERE province_id = $1)
        AND i.indicator_name IN (
          'Toplam Nüfus',
          'GSYH (bin TL)', 
          'Kişi başına GSYH (TL)',
          'İşsizlik Oranı',
          'Ortalama Eğitim Süresi (yıl)',
          'Bin kişi başına düşen toplam hekim sayısı'
        )
      ORDER BY mc.category_name, i.indicator_name
    `, [provinceId]);

    // Verileri formatla
    const latestYear = Math.max(...investmentScoresQuery.rows.map(r => r.year));
    const latestInvestmentScores = investmentScoresQuery.rows.filter(r => r.year === latestYear);

    return NextResponse.json({
      success: true,
      data: {
        province: {
          id: provinceId,
          name: provinceName
        },
        analytics: {
          // 1. Investment Scores Radar Data
          investmentScores: latestInvestmentScores.map(row => ({
            category: row.category_name,
            categoryId: row.category_id,
            scores: {
              current_status: parseFloat(row.current_status_score),
              trend: parseFloat(row.trend_score),
              attractiveness: parseFloat(row.attractiveness_score),
              priority: parseFloat(row.priority_score)
            },
            year: row.year
          })),

          // 2. Kategori Performans Bar Data
          categoryPerformance: categoryPerformanceQuery.rows.map(row => ({
            category: row.category_name,
            categoryId: row.category_id,
            priorityScore: parseFloat(row.priority_score || 0),
            attractivenessScore: parseFloat(row.attractiveness_score || 0),
            year: row.year
          })),

          // 3. Yıllık Trend Line Data
          yearlyTrend: trendQuery.rows.reduce((acc, row) => {
            if (!acc[row.category_id]) {
              acc[row.category_id] = {
                categoryName: row.category_name,
                data: []
              };
            }
            acc[row.category_id].data.push({
              year: row.year,
              priority: parseFloat(row.priority_score),
              attractiveness: parseFloat(row.attractiveness_score),
              current_status: parseFloat(row.current_status_score),
              trend: parseFloat(row.trend_score)
            });
            return acc;
          }, {} as any),

          // 4. Temel İstatistikler
          basicStats: basicStatsQuery.rows.map(row => ({
            indicator: row.indicator_name,
            value: parseFloat(row.value),
            unit: row.unit,
            category: row.category_name,
            year: row.year
          }))
        }
      }
    });

  } catch (error) {
    console.error('İl Analytics API Hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'Analytics verileri alınamadı',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}
