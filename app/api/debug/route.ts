import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Environment variables kontrolü
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_URL: process.env.VERCEL_URL,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      GEMINI_API_KEY_EXISTS: !!process.env.GEMINI_API_KEY,
      GEMINI_API_KEY_1_EXISTS: !!process.env.GEMINI_API_KEY_1,
      GEMINI_API_KEY_2_EXISTS: !!process.env.GEMINI_API_KEY_2,
      GEMINI_API_KEY_3_EXISTS: !!process.env.GEMINI_API_KEY_3,
      // API key'lerin ilk 10 karakterini göster (güvenlik için)
      GEMINI_API_KEY_PREFIX: process.env.GEMINI_API_KEY?.substring(0, 10) + '...',
      GEMINI_API_KEY_1_PREFIX: process.env.GEMINI_API_KEY_1?.substring(0, 10) + '...',
      GEMINI_API_KEY_2_PREFIX: process.env.GEMINI_API_KEY_2?.substring(0, 10) + '...',
      GEMINI_API_KEY_3_PREFIX: process.env.GEMINI_API_KEY_3?.substring(0, 10) + '...',
    };

    return NextResponse.json({
      success: true,
      message: 'Debug bilgileri',
      data: envCheck,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug endpoint hatası:', error);
    return NextResponse.json({
      success: false,
      message: 'Debug endpoint hatası',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
