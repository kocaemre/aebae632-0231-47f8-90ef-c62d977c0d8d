import { NextRequest, NextResponse } from 'next/server';
import { query, getTableStructure } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Database schema kontrolü başlatılıyor...');
    
    // Tablo yapılarını kontrol et
    const [provincesStructure, indicatorsStructure, provincialDataStructure] = await Promise.all([
      getTableStructure('provinces'),
      getTableStructure('indicators'),
      getTableStructure('provincial_data')
    ]);
    
    // Örnek veri çek
    const sampleProvinces = await query('SELECT * FROM provinces LIMIT 3');
    const sampleIndicators = await query('SELECT * FROM indicators LIMIT 3');
    const sampleProvincialData = await query('SELECT * FROM provincial_data LIMIT 3');
    
    return NextResponse.json({
      success: true,
      message: 'Database schema bilgileri',
      data: {
        tables: {
          provinces: {
            structure: provincesStructure,
            sample_data: sampleProvinces.rows
          },
          indicators: {
            structure: indicatorsStructure,
            sample_data: sampleIndicators.rows
          },
          provincial_data: {
            structure: provincialDataStructure,
            sample_data: sampleProvincialData.rows
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Schema check hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'Schema check hatası',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
