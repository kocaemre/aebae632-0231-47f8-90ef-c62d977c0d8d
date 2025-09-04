import { NextRequest, NextResponse } from 'next/server';
import { testConnection, getTables } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Database connection test başlatılıyor...');
    
    // Bağlantı testi
    const connectionTest = await testConnection();
    
    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        message: 'Database bağlantı hatası',
        error: connectionTest.error,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL,
          DB_HOST: process.env.DB_HOST ? 'SET' : 'NOT_SET',
          DB_USER: process.env.DB_USER ? 'SET' : 'NOT_SET',
          DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'NOT_SET',
          DB_NAME: process.env.DB_NAME ? 'SET' : 'NOT_SET',
        }
      }, { status: 500 });
    }
    
    // Tablo listesi
    const tables = await getTables();
    
    return NextResponse.json({
      success: true,
      message: 'Database bağlantısı başarılı',
      data: {
        connection: connectionTest.data,
        tables: tables.map(t => t.table_name),
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL,
          DB_HOST: process.env.DB_HOST ? 'SET' : 'NOT_SET',
          DB_USER: process.env.DB_USER ? 'SET' : 'NOT_SET',
          DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'NOT_SET',
          DB_NAME: process.env.DB_NAME ? 'SET' : 'NOT_SET',
        }
      }
    });

  } catch (error) {
    console.error('❌ Database test hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'Database test hatası',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}