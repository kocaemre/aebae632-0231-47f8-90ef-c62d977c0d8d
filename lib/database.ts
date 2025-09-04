import { Pool } from 'pg';

// PostgreSQL bağlantı yapılandırması
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Vercel için daha uzun timeout
});

// Bağlantı testi
export async function testConnection() {
  try {
    console.log('Bağlantı detayları:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      passwordLength: process.env.DB_PASSWORD?.length || 0,
      passwordPreview: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.substring(0, 3) + '...' : 'NOT_SET'
    });
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Veritabanı bağlantısı başarılı:', result.rows[0]);
    client.release();
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error('Veritabanı bağlantı hatası:', error);
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Hata detayı:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Tablo listesini getir
export async function getTables() {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    client.release();
    return result.rows;
  } catch (error) {
    console.error('Tablo listesi alınırken hata:', error);
    return [];
  }
}

// Tablo yapısını getir
export async function getTableStructure(tableName: string) {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    client.release();
    return result.rows;
  } catch (error) {
    console.error(`${tableName} tablo yapısı alınırken hata:`, error);
    return [];
  }
}

// Genel sorgu fonksiyonu
export async function query(text: string, params?: any[]) {
  try {
    const client = await pool.connect();
    const result = await client.query(text, params);
    client.release();
    return result;
  } catch (error) {
    console.error('SQL sorgu hatası:', error);
    throw error;
  }
}

export default pool;

