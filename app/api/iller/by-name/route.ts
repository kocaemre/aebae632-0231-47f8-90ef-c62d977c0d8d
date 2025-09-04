import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q') || searchParams.get('name');
    
    if (!searchQuery || searchQuery.length < 2) {
      return NextResponse.json({
        success: false,
        message: 'En az 2 karakter gerekli'
      }, { status: 400 });
    }

    console.log('İl arama yapılıyor, sorgu:', searchQuery);
    
    // İl adına göre arama yap
    const result = await query(`
      SELECT 
        province_id as il_kodu,
        province_name as il_adi,
        province_id as plaka_no,
        0 as longitude,
        0 as latitude
      FROM provinces 
      WHERE LOWER(province_name) ILIKE LOWER($1)
      ORDER BY 
        CASE 
          WHEN LOWER(province_name) = LOWER($1) THEN 1
          WHEN LOWER(province_name) LIKE LOWER($1) || '%' THEN 2
          ELSE 3
        END,
        province_name
      LIMIT 10
    `, [`%${searchQuery}%`]);

    return NextResponse.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('İl arama API hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'İl arama yapılamadı',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}
