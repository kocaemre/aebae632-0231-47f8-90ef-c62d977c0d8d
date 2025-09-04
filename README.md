# 🌐 TEKNOFEST Yatırım Analizi Web Uygulaması - Kapsamlı Dokümantasyon

## 📋 Proje Genel Bakış

### DEMO : https://aebae632-0231-47f8-90ef-c62d977c0d8.vercel.app/

Not : database bilgileri,gemini api key bilgilerini herkese açık bir şekilde paylaşmak verilerin güvenliği açısından risk oluşturmaktadır.

Bu bilgilerin olduğu .env dosyasına ve veritabanına erişmek için lütfen ekip üyelerimizden birine mesaj atınız : 

emrekoca2003@gmail.com
oguzhan57_erdem@outlook.com
yatogami47001@gmail.com
semi.merzi05@gmail.com

**Sekase** (Sosyo-Ekonomik Analiz Sistemi), Türkiye'nin 81 ilinin çeşitli kategorilerdeki verilerini analiz ederek yatırım potansiyelini gösteren interaktif harita uygulamasıdır. Bu platform, kullanıcıların seçtikleri kategorilere göre dinamik analiz yapmalarını ve detaylı il bilgilerini görselleştirmelerini sağlar.

### 🎯 Ana Özellikler

- ✅ **81 İl Analizi**: Türkiye'nin tüm illerinin kapsamlı veri analizi
- ✅ **İnteraktif Harita**: MapLibre GL JS ile coğrafi görselleştirme
- ✅ **Çoklu Kategori Seçimi**: 1-3 kategori arası seçim ve ağırlıklandırma
- ✅ **AI Destekli Analiz**: Google Gemini AI ile detaylı yatırım raporları
- ✅ **İl Karşılaştırması**: İki il arasında detaylı karşılaştırma analizi

- ✅ **Responsive Tasarım**: Desktop, tablet ve mobil uyumlu arayüz

## 🏗️ Teknik Mimari

### Frontend Teknolojileri

| Teknoloji | Versiyon | Açıklama |
|-----------|----------|----------|
| **Next.js** | 15.5.2 | React framework (App Router) |
| **React** | 19.1.0 | UI kütüphanesi |
| **TypeScript** | ^5 | Tip güvenliği |
| **Tailwind CSS** | ^4 | Styling framework |
| **Framer Motion** | ^12.23.12 | Animasyon kütüphanesi |
| **MapLibre GL JS** | ^5.7.0 | Harita görselleştirme |
| **Recharts** | ^3.1.2 | Grafik kütüphanesi |
| **Radix UI** | - | UI bileşen kütüphanesi |

### Backend Teknolojileri

| Teknoloji | Versiyon | Açıklama |
|-----------|----------|----------|
| **Next.js API Routes** | 15.5.2 | Backend API endpoints |
| **PostgreSQL** | - | Ana veritabanı |
| **Google Gemini AI** | ^1.16.0 | AI analiz servisi |
| **jsPDF** | ^3.0.2 | PDF oluşturma |

### Veri Kaynakları

- **PostgreSQL Veritabanı**: İl verileri, skorlar ve istatistikler
- **GeoJSON Dosyaları**: İl sınırları ve coğrafi veriler
- **Statik JSON**: İl bilgileri ve kategori tanımları

## 🗄️ Veritabanı Yapısı

### Ana Tablolar

#### 1. `provinces` - İl Bilgileri
```sql
CREATE TABLE provinces (
    province_id INTEGER PRIMARY KEY,
    province_name VARCHAR(100) NOT NULL
);
```

#### 2. `main_categories` - Ana Kategoriler
```sql
CREATE TABLE main_categories (
    category_id INTEGER PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL
);
```

#### 3. `investment_scores` - Yatırım Skorları
```sql
CREATE TABLE investment_scores (
    province_id INTEGER REFERENCES provinces(province_id),
    category_id INTEGER REFERENCES main_categories(category_id),
    year INTEGER,
    current_status_score DECIMAL(5,2),
    trend_score DECIMAL(5,2),
    attractiveness_score DECIMAL(5,2),
    priority_score DECIMAL(5,2),
    PRIMARY KEY (province_id, category_id, year)
);
```

#### 4. `indicators` - Göstergeler
```sql
CREATE TABLE indicators (
    indicator_id INTEGER PRIMARY KEY,
    indicator_name VARCHAR(200) NOT NULL,
    category_id INTEGER REFERENCES main_categories(category_id),
    unit VARCHAR(50)
);
```

#### 5. `provincial_data` - İl Verileri
```sql
CREATE TABLE provincial_data (
    province_id INTEGER REFERENCES provinces(province_id),
    indicator_id INTEGER REFERENCES indicators(indicator_id),
    year INTEGER,
    value DECIMAL(15,2),
    PRIMARY KEY (province_id, indicator_id, year)
);
```

#### 6. `province_surface_area` - İl Yüzölçümleri
```sql
CREATE TABLE province_surface_area (
    province_id INTEGER PRIMARY KEY REFERENCES provinces(province_id),
    surface_area_km2 DECIMAL(10,2)
);
```

### Veritabanı Bağlantısı

```typescript
// lib/database.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

## 🤖 Gemini AI Entegrasyonu

### API Yapılandırması

```typescript
// app/api/ai-analysis/route.ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
});
```

### Çoklu API Key Desteği

Sistem, yüksek kullanım durumlarında otomatik fallback için çoklu API key desteği sunar:

```typescript
const apiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY // Fallback
].filter(key => key && key.trim() !== '');
```

### AI Analiz Türleri

#### 1. Tek Kategori Analizi
- Seçilen tek kategori için derinlemesine analiz
- Mevcut durum, trend, çekicilik ve öncelik skorları
- Kategoriye özel yatırım önerileri

#### 2. Çoklu Kategori Analizi
- 2-3 kategori arası ağırlıklı analiz
- Kategoriler arası sinerji ve etkileşim analizi
- Entegre yatırım fırsatları

#### 3. İl Karşılaştırması
- İki il arasında detaylı karşılaştırma
- Metrik bazında fark analizi
- Objektif değerlendirme ve tavsiyeler

### Prompt Mühendisliği

AI analizleri için özel olarak tasarlanmış prompt'lar:

```typescript
const prompt = `
Sen bir yatırım analisti ve Türkiye'deki illerin ekonomik potansiyelini değerlendiren bir uzmansın.
Aşağıdaki verileri analiz ederek ${ilAdi} ili için ${kategoriAdi} analizinde detaylı bir yatırım raporu hazırla.

⚠️ KRİTİK UYARI: 
1. Aşağıdaki verilerdeki tüm skorlar gerçek değerlerdir
2. 0 olan skorlar gerçekten 0'dır, eksik veri değildir
3. ASLA "eksik veri", "veri eksikliği", "bulunmaması" gibi ifadeler kullanma
4. Sadece mevcut verilerle analiz yap, eksik olanları görmezden gel
5. Pozitif ve yapıcı bir ton kullan
`;
```

## 🔌 API Endpoints

### 1. Kategoriler API

**Endpoint:** `GET /api/kategoriler`

**Açıklama:** Mevcut kategori listesini döner

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "ad": "Çevre ve Enerji",
      "aciklama": "Yenilenebilir enerji potansiyeli ve çevresel sürdürülebilirlik",
      "icon": "⚡",
      "renk": "#84CC16",
      "aktif": false
    }
  ]
}
```

### 2. İller API

**Endpoint:** `GET /api/iller`

**Parametreler:**
- `kategori`: Kategori ID'si (zorunlu)
- `sektor`: 'kamu' veya 'ozel' (varsayılan: 'kamu')

**Açıklama:** Seçilen kategori için tüm illerin skorlarını döner

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "province_id": 1,
      "province_name": "Adana",
      "genel_skor": 0.75,
      "kategori_skorlari": {
        "1": 0.75
      }
    }
  ]
}
```

### 3. İl Detay API

**Endpoint:** `GET /api/iller/[id]`

**Açıklama:** Belirli bir ilin detaylı bilgilerini döner

**Response:**
```json
{
  "success": true,
  "data": {
    "il_kodu": "1",
    "il_adi": "Adana",
    "plaka_no": "1",
    "genel_skor": 0.75,
    "kategori_skorlari": {
      "1": 0.8,
      "2": 0.7
    },
    "istatistikler": {
      "egitim": {
        "universite_sayisi": 5,
        "ogrenci_sayisi": 25000,
        "ogretmen_sayisi": 2000,
        "okuryazarlik_orani": 95.5
      }
    },
    "oneriler": [
      "Adana için stratejik yatırım önerileri",
      "Bölgesel avantajları değerlendirilebilir"
    ]
  }
}
```

### 4. Merge Scores API

**Endpoint:** `GET /api/iller/merged-scores`

**Parametreler:**
- `kategoriler`: Virgülle ayrılmış kategori ID'leri
- `agirliklar`: Virgülle ayrılmış ağırlık değerleri
- `sektor`: 'kamu' veya 'ozel'

**Açıklama:** Çoklu kategori için ağırlıklı skorları hesaplar

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "province_id": 1,
      "province_name": "Adana",
      "genel_skor": 0.78,
      "kategori_skorlari": {
        "1": 0.8,
        "2": 0.75
      },
      "merge_details": {
        "kategoriler": [1, 2],
        "agirliklar": { "1": 0.6, "2": 0.4 },
        "sektor": "kamu",
        "algorithm": "Weighted Average Model"
      }
    }
  ]
}
```

### 5. AI Analiz API

**Endpoint:** `POST /api/ai-analysis`

**Request Body:**
```json
{
  "ilAdi": "Adana",
  "kategoriAdi": "Eğitim",
  "ilVerileri": { /* il detay verileri */ },
  "secilenSektor": "kamu",
  "type": "il_karsilastirma", // opsiyonel
  "data": { /* karşılaştırma verileri */ } // opsiyonel
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ilAdi": "Adana",
    "kategoriAdi": "Eğitim",
    "sektor": "kamu",
    "analiz": "## 📊 Adana İli Eğitim Kategorisi Yatırım Analizi\n\n### 🎯 Genel Değerlendirme\n...",
    "olusturmaTarihi": "2024-01-15T10:30:00.000Z",
    "model": "gemini-2.0-flash"
  }
}
```

### 6. İl Karşılaştırma API

**Endpoint:** `POST /api/iller/karsilastir`

**Request Body:**
```json
{
  "il1_id": 1,
  "il2_id": 2,
  "kategori": "1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "farklar": {
      "current_status_score": {
        "il1_deger": 85.5,
        "il2_deger": 78.2,
        "fark": 7.3,
        "yuzde_fark": 9.3,
        "daha_iyi": "il1"
      }
    },
    "genel_sonuc": "Adana, Eğitim kategorisinde Ankara'ya göre daha güçlü...",
    "ai_analizi": "## 📊 Adana vs Ankara - Eğitim Karşılaştırması\n\n### 🎯 Genel Değerlendirme\n..."
  }
}
```

## 🎨 Frontend Bileşenleri

### 1. Ana Sayfa (`app/page.tsx`)

Ana sayfa iki ana bileşenden oluşur:

#### Hero Section
- WebGL shader efektleri
- Gradient arka plan
- Animasyonlu başlık ve açıklama
- "Araştırmaya Başla" butonu

#### Kategori Section
- Dinamik kategori kartları
- Çoklu seçim desteği (max 3)
- Ağırlık ayarlama sistemi
- Analiz başlatma butonu

### 2. Harita Sayfası (`app/harita/page.tsx`)

#### MapLibre GL Harita
```typescript
function TurkeyMap({ onIlClick, ilSkorlari, tamamenHazir, secilenSektor }) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'turkey-provinces': {
            type: 'geojson',
            data: '/data/turkey-provinces.geojson'
          }
        },
        layers: [
          {
            id: 'province-fill',
            type: 'fill',
            source: 'turkey-provinces',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'skor'],
                0, '#FEE2E2',
                0.125, '#FCA5A5',
                0.25, '#F87171',
                0.375, '#EF4444',
                0.5, '#DC2626',
                0.625, '#B91C1C',
                0.75, '#991B1B',
                0.875, '#7F1D1D',
                1, '#7F1D1D'
              ],
              'fill-opacity': 0.8
            }
          }
        ]
      },
      center: [35.0, 39.0],
      zoom: 5.5
    });
  }, []);
}
```

#### Bilgi Paneli
- İl detay bilgileri
- Kategori skorları
- Grafikler (Bar, Line, Pie, Radar)
- AI analiz sonuçları
- PDF export özelliği

### 3. Karşılaştırma Sayfası (`app/karsilastir/page.tsx`)

#### İl Seçimi
- Otomatik tamamlama ile il arama
- Kategori bazlı karşılaştırma
- Real-time sonuç gösterimi

#### Karşılaştırma Sonuçları
- Metrik bazında fark analizi
- AI destekli yorumlar
- Görsel grafikler

## 📊 Veri Görselleştirme

### Grafik Türleri

#### 1. Bar Chart (Kategori Karşılaştırması)
```typescript
<BarChart data={categoryData} width={400} height={300}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="name" />
  <YAxis />
  <Tooltip />
  <Bar dataKey="value" fill="#3B82F6" />
</BarChart>
```

#### 2. Line Chart (Trend Analizi)
```typescript
<LineChart data={trendData} width={400} height={300}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="year" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2} />
</LineChart>
```

#### 3. Pie Chart (Dağılım Analizi)
```typescript
<PieChart width={400} height={300}>
  <Pie
    data={pieData}
    cx={200}
    cy={150}
    labelLine={false}
    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
    outerRadius={80}
    fill="#8884d8"
    dataKey="value"
  >
    {pieData.map((entry, index) => (
      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
    ))}
  </Pie>
  <Tooltip />
</PieChart>
```

#### 4. Radar Chart (Çok Boyutlu Analiz)
```typescript
<RadarChart data={radarData} width={400} height={300}>
  <PolarGrid />
  <PolarAngleAxis dataKey="subject" />
  <PolarRadiusAxis />
  <Radar
    name="Skor"
    dataKey="A"
    stroke="#8884d8"
    fill="#8884d8"
    fillOpacity={0.6}
  />
  <Tooltip />
</RadarChart>
```

### Renk Sistemi

#### Skor Bazlı Renklendirme
```typescript
function getSkorColor(skor: number): string {
  if (skor >= 0.875) return '#7F1D1D'; // En koyu kırmızı (87.5%+)
  if (skor >= 0.75) return '#991B1B';  // Çok koyu kırmızı (75-87.5%)
  if (skor >= 0.625) return '#B91C1C'; // Koyu kırmızı (62.5-75%)
  if (skor >= 0.5) return '#DC2626';   // Orta koyu kırmızı (50-62.5%)
  if (skor >= 0.375) return '#EF4444'; // Orta kırmızı (37.5-50%)
  if (skor >= 0.25) return '#F87171';  // Açık kırmızı (25-37.5%)
  if (skor >= 0.125) return '#FCA5A5'; // Çok açık kırmızı (12.5-25%)
  return '#FEE2E2'; // En açık pembe-kırmızı (0-12.5%)
}
```

## 🎭 Animasyonlar ve Etkileşimler

### Framer Motion Kullanımı

#### Sayfa Geçişleri
```typescript
<motion.div
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8 }}
>
  {/* İçerik */}
</motion.div>
```

#### Hover Efektleri
```typescript
<motion.div
  whileHover={{ 
    scale: 1.02, 
    y: -8,
    transition: { duration: 0.2 }
  }}
  whileTap={{ scale: 0.98 }}
>
  {/* İçerik */}
</motion.div>
```

#### Loading Animasyonları
```typescript
<motion.div
  animate={{ rotate: 360 }}
  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
>
  <Loader2 className="w-16 h-16 text-blue-400" />
</motion.div>
```

## 📱 Responsive Tasarım

### Breakpoint Sistemi

```css
/* Tailwind CSS breakpoints */
sm: 640px   /* Küçük tablet */
md: 768px   /* Tablet */
lg: 1024px  /* Küçük desktop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Büyük desktop */
```

### Layout Adaptasyonu

#### Desktop Layout
```
[Harita 70%] [Panel 30%]
```

#### Tablet Layout
```
[Harita Üst]
[Panel Alt]
```

#### Mobil Layout
```
[Tam Ekran Harita]
[Slide-up Panel]
```

## 🔧 Geliştirme Ortamı Kurulumu

### Gereksinimler

- Node.js 18+ 
- PostgreSQL 13+
- npm veya yarn

### Kurulum Adımları

1. **Projeyi klonlayın:**
```bash
git clone <repository-url>
cd teknofest
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
```

3. **Çevre değişkenlerini ayarlayın:**
```bash
cp .env.example .env.local
```

4. **Veritabanını yapılandırın:**
```bash
# PostgreSQL'de veritabanı oluşturun
createdb teknofest_db

# Tabloları oluşturun (SQL dosyalarını çalıştırın)
psql teknofest_db < database/schema.sql
psql teknofest_db < database/data.sql
```

5. **Geliştirme sunucusunu başlatın:**
```bash
npm run dev
```

### Çevre Değişkenleri

```env
# Veritabanı
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=teknofest_db

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_KEY_1=backup_key_1
GEMINI_API_KEY_2=backup_key_2
GEMINI_API_KEY_3=backup_key_3

# Next.js
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🚀 Deployment

### Vercel Deployment

1. **Vercel CLI ile:**
```bash
npm i -g vercel
vercel
```

2. **GitHub entegrasyonu ile:**
- GitHub repository'sini Vercel'e bağlayın
- Otomatik deployment ayarlayın

### Environment Variables (Production)

Vercel dashboard'da aşağıdaki değişkenleri ayarlayın:

```env
DB_HOST=your_production_db_host
DB_PORT=5432
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
DB_NAME=your_production_db_name
GEMINI_API_KEY=your_production_gemini_key
NODE_ENV=production
```

### Database Migration

Production veritabanı için:

```bash
# Production veritabanına bağlanın
psql -h your_host -U your_user -d your_db

# Schema'yı oluşturun
\i database/schema.sql

# Verileri yükleyin
\i database/data.sql
```

## 📊 Performans Optimizasyonu

### Frontend Optimizasyonları

#### 1. Code Splitting
```typescript
// Lazy loading ile bileşen yükleme
const HaritaPage = lazy(() => import('./harita/page'));
const KarsilastirPage = lazy(() => import('./karsilastir/page'));
```

#### 2. Image Optimization
```typescript
import Image from 'next/image';

<Image
  src="/images/map-background.jpg"
  alt="Harita arka planı"
  width={800}
  height={600}
  priority
  placeholder="blur"
/>
```

#### 3. Memoization
```typescript
const MemoizedChart = memo(({ data }) => {
  return <BarChart data={data} />;
});
```

### Backend Optimizasyonları

#### 1. Database Connection Pooling
```typescript
const pool = new Pool({
  max: 20, // Maksimum bağlantı sayısı
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

#### 2. Query Optimization
```sql
-- Index'ler
CREATE INDEX idx_investment_scores_province_category 
ON investment_scores(province_id, category_id, year);

CREATE INDEX idx_provincial_data_province_indicator 
ON provincial_data(province_id, indicator_id, year);
```

#### 3. Caching
```typescript
// API response caching
export async function GET(request: NextRequest) {
  const cacheKey = `categories-${Date.now()}`;
  
  // Cache kontrolü
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached));
  }
  
  // Veri çekme ve cache'leme
  const data = await fetchCategories();
  await redis.setex(cacheKey, 3600, JSON.stringify(data));
  
  return NextResponse.json(data);
}
```

## 🧪 Test Stratejisi

### Unit Tests

```typescript
// __tests__/utils.test.ts
import { getSkorColor } from '@/lib/utils';

describe('getSkorColor', () => {
  test('yüksek skor için koyu renk döner', () => {
    expect(getSkorColor(0.9)).toBe('#7F1D1D');
  });
  
  test('düşük skor için açık renk döner', () => {
    expect(getSkorColor(0.1)).toBe('#FEE2E2');
  });
});
```

### Integration Tests

```typescript
// __tests__/api.test.ts
import { GET } from '@/app/api/kategoriler/route';

describe('/api/kategoriler', () => {
  test('kategorileri başarıyla döner', async () => {
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
```

### E2E Tests

```typescript
// e2e/harita.spec.ts
import { test, expect } from '@playwright/test';

test('harita sayfası yüklenir ve il tıklama çalışır', async ({ page }) => {
  await page.goto('/harita?kategori=1');
  
  // Harita yüklenmesini bekle
  await page.waitForSelector('[data-testid="turkey-map"]');
  
  // İl tıklama
  await page.click('[data-testid="province-1"]');
  
  // Panel açılmasını bekle
  await page.waitForSelector('[data-testid="info-panel"]');
  
  expect(await page.isVisible('[data-testid="info-panel"]')).toBe(true);
});
```

## 🔒 Güvenlik

### API Güvenliği

#### 1. Input Validation
```typescript
import { z } from 'zod';

const kategoriSchema = z.object({
  kategori: z.string().regex(/^\d+$/),
  sektor: z.enum(['kamu', 'ozel']).optional()
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const result = kategoriSchema.safeParse({
    kategori: searchParams.get('kategori'),
    sektor: searchParams.get('sektor')
  });
  
  if (!result.success) {
    return NextResponse.json({ error: 'Geçersiz parametreler' }, { status: 400 });
  }
}
```

#### 2. SQL Injection Koruması
```typescript
// Parametreli sorgular kullanın
const result = await query(
  'SELECT * FROM provinces WHERE province_id = $1',
  [provinceId]
);
```

#### 3. Rate Limiting
```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

export async function POST(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
}
```

### Environment Variables Güvenliği

```typescript
// Hassas bilgileri environment variables'da saklayın
const config = {
  database: {
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
  },
  ai: {
    apiKey: process.env.GEMINI_API_KEY,
  }
};
```

## 📈 Monitoring ve Analytics

### Error Tracking

```typescript
// lib/error-tracking.ts
export function trackError(error: Error, context: any) {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
  
  // Sentry veya benzeri servise gönder
  if (process.env.NODE_ENV === 'production') {
    // Sentry.captureException(error, { extra: context });
  }
}
```

### Performance Monitoring

```typescript
// lib/performance.ts
export function measurePerformance(name: string, fn: () => Promise<any>) {
  return async (...args: any[]) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`Performance: ${name} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  };
}
```

### API Usage Analytics

```typescript
// lib/analytics.ts
export function trackAPIUsage(endpoint: string, method: string, duration: number) {
  const data = {
    endpoint,
    method,
    duration,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
  };
  
  // Analytics servisine gönder
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(console.error);
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 📚 API Dokümantasyonu

### Swagger/OpenAPI Entegrasyonu

```typescript
// lib/swagger.ts
import { OpenAPIRegistry, OpenAPIGenerator } from '@asteasolutions/zod-to-openapi';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/api/kategoriler',
  tags: ['Kategoriler'],
  summary: 'Kategori listesini getirir',
  responses: {
    200: {
      description: 'Başarılı yanıt',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    ad: { type: 'string' },
                    aciklama: { type: 'string' },
                    icon: { type: 'string' },
                    renk: { type: 'string' },
                    aktif: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});
```

## 🎯 Gelecek Geliştirmeler

### Kısa Vadeli (v1.1)

- [ ] **Dark/Light Mode**: Tema değiştirme özelliği
- [ ] **Gelişmiş Filtreleme**: Tarih, skor aralığı filtreleri
- [ ] **Export Özellikleri**: Excel, CSV export
- [ ] **Kullanıcı Hesapları**: Kayıt/giriş sistemi
- [ ] **Favori İller**: Kullanıcı favori listesi

### Orta Vadeli (v1.2)

- [ ] **Real-time Veri**: Canlı veri güncellemeleri
- [ ] **Mobil Uygulama**: React Native uygulaması
- [ ] **API Rate Limiting**: Gelişmiş rate limiting
- [ ] **Caching Sistemi**: Redis entegrasyonu
- [ ] **WebSocket**: Real-time bildirimler

### Uzun Vadeli (v2.0)

- [ ] **Machine Learning**: Tahmin modelleri
- [ ] **Blockchain Entegrasyonu**: Veri doğrulama
- [ ] **AR/VR Desteği**: 3D görselleştirme
- [ ] **Çoklu Dil Desteği**: i18n entegrasyonu
- [ ] **Mikroservis Mimarisi**: Servis ayrıştırması

## 🤝 Katkıda Bulunma

### Geliştirme Süreci

1. **Fork** yapın
2. **Feature branch** oluşturun (`git checkout -b feature/amazing-feature`)
3. **Commit** yapın (`git commit -m 'Add amazing feature'`)
4. **Push** yapın (`git push origin feature/amazing-feature`)
5. **Pull Request** oluşturun

### Kod Standartları

```typescript
// ESLint konfigürasyonu
module.exports = {
  extends: ['next/core-web-vitals', '@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

### Commit Mesaj Formatı

```
feat: yeni özellik eklendi
fix: hata düzeltildi
docs: dokümantasyon güncellendi
style: kod formatı düzeltildi
refactor: kod yeniden düzenlendi
test: test eklendi
chore: build süreci güncellendi
```

## 📞 Destek ve İletişim

### Teknik Destek

- **Email**: support@teknofest.com
- **GitHub Issues**: [Repository Issues](https://github.com/teknofest/issues)
- **Discord**: [Teknofest Discord](https://discord.gg/teknofest)

### Dokümantasyon

- **API Docs**: `/api/docs`
- **Component Library**: `/storybook`
- **Design System**: `/design-system`

### Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 📋 Özet

**Sekase** projesi, modern web teknolojileri kullanarak Türkiye'nin sosyo-ekonomik verilerini analiz eden kapsamlı bir platformdur. Next.js 15, PostgreSQL, Google Gemini AI ve MapLibre GL JS gibi güncel teknolojilerle geliştirilmiş olan bu uygulama, kullanıcılara interaktif harita deneyimi, AI destekli analizler ve detaylı görselleştirmeler sunmaktadır.

Proje, modüler mimarisi, responsive tasarımı ve genişletilebilir yapısı ile gelecekteki geliştirmelere açık bir platform olarak tasarlanmıştır. Teknik dokümantasyon, API referansları ve deployment rehberleri ile geliştiricilerin kolayca katkıda bulunabileceği bir ekosistem sunmaktadır.

**Teknoloji Stack:**
- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- Backend: Next.js API Routes, PostgreSQL
- AI: Google Gemini AI
- Harita: MapLibre GL JS
- Grafikler: Recharts
- Animasyonlar: Framer Motion
- Deployment: Vercel

Bu dokümantasyon, projenin tüm teknik detaylarını, kullanım kılavuzunu ve geliştirme süreçlerini kapsamlı bir şekilde açıklamaktadır.
