import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const ilId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const kategoriId = searchParams.get('kategori');
    
    console.log('İl indicator detayları getiriliyor:', { ilId, kategoriId });
    
    if (!kategoriId) {
      return NextResponse.json({
        success: false,
        message: 'Kategori ID gerekli'
      }, { status: 400 });
    }

    // İl temel bilgilerini al
    const ilResult = await query(`
      SELECT province_id, province_name 
      FROM provinces 
      WHERE province_id = $1
    `, [ilId]);

    if (ilResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'İl bulunamadı'
      }, { status: 404 });
    }

    // Kategorinin indicatorlerini ve o il için değerlerini al
    const indicatorResult = await query(`
      SELECT 
        i.indicator_id,
        i.indicator_name,
        i.unit,
        pd.value,
        pd.year
      FROM indicators i
      LEFT JOIN provincial_data pd ON i.indicator_id = pd.indicator_id 
        AND pd.province_id = $1 
        AND pd.year = (
          SELECT MAX(year) 
          FROM provincial_data pd2 
          WHERE pd2.indicator_id = i.indicator_id 
          AND pd2.province_id = $1
        )
      WHERE i.category_id = $2
      ORDER BY i.indicator_name
    `, [ilId, kategoriId]);

    // Kategori adını al
    const kategoriResult = await query(`
      SELECT category_name 
      FROM main_categories 
      WHERE category_id = $1
    `, [kategoriId]);

    const indicators = indicatorResult.rows.map(row => ({
      indicator_id: row.indicator_id,
      indicator_name: row.indicator_name,
      unit: row.unit || 'Birim belirtilmemiş',
      value: row.value ? parseFloat(row.value) : null,
      year: row.year || null,
      formatted_value: formatValue(row.value, row.unit)
    }));

    return NextResponse.json({
      success: true,
      data: {
        province: {
          id: ilResult.rows[0].province_id,
          name: ilResult.rows[0].province_name
        },
        category: {
          id: parseInt(kategoriId),
          name: kategoriResult.rows[0]?.category_name || 'Kategori bulunamadı'
        },
        indicators: indicators,
        total_indicators: indicators.length,
        indicators_with_data: indicators.filter(i => i.value !== null).length
      }
    });

  } catch (error) {
    console.error('İl indicator detayları API hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'İl indicator detayları getirilemedi',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}

// Değer formatlama fonksiyonu
function formatValue(value: string | number | null, unit: string | null): string {
  if (value === null || value === undefined) return 'Veri yok';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return 'Geçersiz veri';
  
  if (!unit) return numValue.toLocaleString('tr-TR');
  
  // Birim tipine göre formatlama
  if (unit.includes('TL') || unit.includes('₺')) {
    if (numValue >= 1000000000) return `₺${(numValue / 1000000000).toFixed(1)}B`;
    if (numValue >= 1000000) return `₺${(numValue / 1000000).toFixed(1)}M`;
    if (numValue >= 1000) return `₺${(numValue / 1000).toFixed(0)}K`;
    return `₺${numValue.toLocaleString('tr-TR')}`;
  }
  
  if (unit.includes('%')) {
    return `%${numValue.toFixed(1)}`;
  }
  
  if (unit.includes('kişi') || unit.includes('adet')) {
    if (numValue >= 1000000) return `${(numValue / 1000000).toFixed(1)}M`;
    if (numValue >= 1000) return `${(numValue / 1000).toFixed(0)}K`;
    return numValue.toLocaleString('tr-TR');
  }
  
  if (unit.includes('km') || unit.includes('m²')) {
    return `${numValue.toLocaleString('tr-TR')} ${unit}`;
  }
  
  // Varsayılan format
  return `${numValue.toLocaleString('tr-TR')} ${unit}`;
}
