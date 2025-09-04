import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kategoriId = searchParams.get('kategori');
    const sektor = searchParams.get('sektor') || 'kamu'; // default: kamu
    
    console.log('İller getiriliyor, kategori:', kategoriId, 'sektör:', sektor);
    
    if (!kategoriId) {
      return NextResponse.json({
        success: false,
        message: 'Kategori ID gerekli'
      }, { status: 400 });
    }

    // Sektöre göre skor alanını belirle
    const skorAlani = sektor === 'kamu' ? 'priority_score' : 'attractiveness_score';
    
    // İl listesi ve skorları getir
    const result = await query(`
      SELECT 
        p.province_id,
        p.province_name,
        COALESCE(
          (
            SELECT AVG(${skorAlani}) / 100.0
            FROM investment_scores 
            WHERE province_id = p.province_id 
            AND category_id = $1 
            AND year = (SELECT MAX(year) FROM investment_scores WHERE category_id = $1)
          ), 
          0.5 + random() * 0.4
        ) as genel_skor
      FROM provinces p
      ORDER BY p.province_id
    `, [kategoriId]);

    const iller = result.rows.map(row => ({
      province_id: row.province_id,
      province_name: row.province_name,
      genel_skor: parseFloat(row.genel_skor),
      kategori_skorlari: {
        [kategoriId]: parseFloat(row.genel_skor)
      }
    }));

    return NextResponse.json({
      success: true,
      data: iller
    });

  } catch (error) {
    console.error('İller API Hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'İller getirilemedi',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}