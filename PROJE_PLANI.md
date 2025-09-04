# 🌐 TEKNOFEST Yatırım Analizi Web Uygulaması - Proje Planı

## 📋 Proje Genel Bakış

Türkiye'deki illerin çeşitli kategorilerdeki verilerini analiz ederek yatırım potansiyelini gösteren interaktif harita uygulaması.

## 🎯 Ana Hedefler

- ✅ İlleri yatırım skoruna göre harita üzerinde görselleştirmek
- ✅ Kullanıcının seçtiği kategorilere göre dinamik analiz
- ✅ Detaylı il bilgilerini yan panelde göstermek
- ✅ Responsive tasarım (Desktop, Tablet, Mobil)
- ✅ Modern ve kullanıcı dostu arayüz

## 🏗️ Teknik Mimarai

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Animasyonlar:** Framer Motion
- **Harita:** MapLibre GL JS
- **Grafikler:** Recharts
- **State Management:** React Context + useReducer
- **HTTP İstemcisi:** Fetch API / Axios

### Backend
- **API:** Next.js API Routes
- **Veritabanı:** PostgreSQL
- **ORM:** Prisma (isteğe bağlı)
- **Cache:** Memory Cache (Redis gelecekte)

### Veri Kaynakları
- **İstatistik Verileri:** PostgreSQL
- **Coğrafi Veriler:** Statik GeoJSON dosyası
- **İl Bilgileri:** Statik JSON dosyası

## 🎨 Tasarım Konsepti

### Renk Paleti
- **Ana Renkler:** Mavi tonları (#0066CC, #004499)
- **Vurgu Renkleri:** Turuncu (#FF6600)
- **Nötr Renkler:** Gri tonları (#F8F9FA, #6C757D)
- **Başarı:** Yeşil (#28A745)
- **Uyarı:** Sarı (#FFC107)

### Tipografi
- **Ana Font:** Inter (modern, okunabilir)
- **Başlıklar:** Kalın (600-700)
- **Gövde Metni:** Normal (400)

### Animasyonlar
- **Sayfa Geçişleri:** Fade + Slide
- **Hover Efektleri:** Scale + Shadow
- **Panel Açılması:** Slide from right
- **Harita Etkileşimleri:** Smooth transitions

## 📱 Sayfa Yapısı & Akış

### 1. Ana Sayfa (`/`)
**Amaç:** Kullanıcıyı karşılamak ve kategori seçimi yaptırmak

**Bileşenler:**
- Hero Section (Büyük başlık + açıklama + "Araştırmaya Başla" butonu)
- Kategori Seçim Bölümü (Smooth scroll ile açılır)
- Kategori Kartları (Checkbox'lı)
- "Analizi Başlat" butonu

**Akış:**
1. Kullanıcı sayfaya girer
2. "Araştırmaya Başla" butonuna tıklar
3. Sayfa aşağı kayar, kategoriler görünür
4. Kategorileri seçer
5. "Analizi Başlat" → Harita sayfasına yönlendirilir

**Kategoriler:**
- 📚 Eğitim
- 🏭 Sanayi
- 🌱 Tarım ve hayvancılık
- 🏛️ Sağlık
,


### 2. Harita Sayfası (`/harita`)
**Amaç:** İlleri harita üzerinde göstermek ve detaylı analiz yapmak

**Layout:**
```
Desktop: [Harita 70%] [Panel 30%]
Tablet:  [Harita Üst] [Panel Alt]
Mobil:   [Tam Ekran Harita] [Slide-up Panel]
```

**Bileşenler:**
- Harita Komponenti (MapLibre)
- Bilgi Paneli (Yan/Alt)
- Kategori Filtreleri (Üst bar)
- Skor Legendi

## 🗺️ Harita Özellikleri

### Görselleştirme
- **İl Sınırları:** GeoJSON ile çizim
- **Renklendirme:** Skorlara göre gradient (açık → koyu)
- **Renk Skalası:** 
  - Düşük skor (0-0.3): Açık kırmızı
  - Orta skor (0.3-0.7): Sarı/Turuncu
  - Yüksek skor (0.7-1.0): Koyu yeşil

### Etkileşimler
- **Hover:** İl adı + genel skor tooltip
- **Click:** Yan panel açılması + detay veriler
- **Zoom:** Mouse wheel ile yakınlaştırma
- **Pan:** Drag ile hareket

### Animasyonlar
- **Sayfa Yüklenme:** İller sırayla beliriyor
- **Hover:** Hafif yükselme + gölge
- **Seçim:** Seçilen il vurgulanıyor
- **Panel:** Smooth slide-in/out

## 📊 Bilgi Paneli İçeriği

### Üst Bölüm
- **İl Adı:** Büyük başlık
- **Genel Skor:** Büyük sayı + progress bar
- **Plaka Kodu:** Alt bilgi

### Kategori Detayları
Her seçilen kategori için:
- **Kategori Adı:** Icon + başlık
- **Skor:** Progress bar
- **Ana Metrikler:** 3-4 önemli veri
- **Mini Grafik:** Trend gösterimi

### Grafikler
- **Bar Chart:** Kategorilerin karşılaştırması
- **Line Chart:** Zaman serisi verileri (varsa)
- **Pie Chart:** Alt kategori dağılımları

### Öneriler Bölümü
- **AI Önerileri:** "Bu ile uygun sektörler"
- **Güçlü Yönler:** Top 3 kategori
- **Gelişim Alanları:** En düşük skorlu kategoriler

## 🛠️ Geliştirme Aşamaları

### Faz 1: Temel Altyapı (1-2 gün)
- [x] Next.js proje kurulumu
- [ ] Tailwind CSS konfigürasyonu
- [ ] Temel klasör yapısı oluşturma
- [ ] PostgreSQL bağlantısı
- [ ] Statik veri dosyalarını bulma/hazırlama

### Faz 2: Ana Sayfa (1 gün)
- [ ] Hero section tasarımı
- [ ] Kategori seçim komponenti
- [ ] Smooth scroll animasyonu
- [ ] Form validasyonu
- [ ] Routing implementasyonu

### Faz 3: Harita Altyapısı (2-3 gün)
- [ ] MapLibre entegrasyonu
- [ ] GeoJSON verilerini yükleme
- [ ] Temel harita gösterimi
- [ ] İl sınırlarını çizme
- [ ] Renklendirme sistemi

### Faz 4: Harita Etkileşimleri (2 gün)
- [ ] Hover efektleri
- [ ] Click event'leri
- [ ] Tooltip komponenti
- [ ] Zoom/Pan optimizasyonu
- [ ] Performans iyileştirmeleri

### Faz 5: Bilgi Paneli (2-3 gün)
- [ ] Panel tasarımı ve layout
- [ ] API endpoint'leri (/api/iller/[id])
- [ ] Veri getirme ve state yönetimi
- [ ] Grafik komponentleri
- [ ] Loading states

### Faz 6: Responsive Tasarım (1-2 gün)
- [ ] Tablet layout'u
- [ ] Mobil layout'u
- [ ] Breakpoint optimizasyonları
- [ ] Touch gesture'ları

### Faz 7: Animasyonlar & Polish (1-2 gün)
- [ ] Framer Motion entegrasyonu
- [ ] Sayfa geçiş animasyonları
- [ ] Hover/click animasyonları
- [ ] Loading animasyonları

### Faz 8: Test & Optimizasyon (1 gün)
- [ ] Cross-browser test
- [ ] Performance optimizasyonu
- [ ] Error handling
- [ ] Final polish

## 📁 Klasör Yapısı

```
/Users/0xemrek/Desktop/teknofest/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx              # Ana sayfa
│   ├── harita/
│   │   └── page.tsx          # Harita sayfası
│   └── api/
│       └── iller/
│           └── [id]/
│               └── route.ts  # İl detay API
├── components/
│   ├── ui/                   # Temel UI komponentleri
│   ├── harita/              # Harita spesifik komponentler
│   ├── panels/              # Panel komponentleri
│   └── shared/              # Ortak komponentler
├── lib/
│   ├── database.ts          # PostgreSQL bağlantısı
│   ├── utils.ts             # Yardımcı fonksiyonlar
│   └── types.ts             # TypeScript türleri
├── data/
│   ├── iller.json           # İl bilgileri
│   ├── il-sinirlari.geojson # Coğrafi sınırlar
│   └── kategoriler.json     # Kategori tanımları
├── hooks/
│   ├── useHarita.ts         # Harita state'i
│   └── useApi.ts            # API çağrıları
└── public/
    ├── icons/               # Kategori iconları
    └── images/              # Görsel assets
```

## 🎨 Komponent Hiyerarşisi

### Ana Sayfa
```
HomePage
├── HeroSection
│   ├── Title
│   ├── Description
│   └── ActionButton
└── KategoriSection
    ├── KategoriCard[]
    ├── SelectionSummary
    └── StartAnalysisButton
```

### Harita Sayfası
```
HaritaPage
├── Header
│   ├── Logo
│   ├── KategoriFilters
│   └── Settings
├── MapContainer
│   ├── MapLibreMap
│   ├── Tooltip
│   └── Legend
└── BilgiPaneli
    ├── IlHeader
    ├── SkorGostergesi
    ├── KategoriDetaylari[]
    ├── Grafikler
    └── Oneriler
```

## 🔌 API Endpoints

### `GET /api/iller`
Tüm illerin temel bilgilerini döner
```json
{
  "iller": [
    {
      "il_kodu": "01",
      "il_adi": "Adana",
      "genel_skor": 0.75,
      "kategori_skorlari": {...}
    }
  ]
}
```

### `GET /api/iller/[il_kodu]`
Belirli bir ilin detaylı bilgilerini döner
```json
{
  "il_kodu": "01",
  "il_adi": "Adana",
  "plaka_no": "01",
  "genel_skor": 0.75,
  "kategoriler": {
    "egitim": {
      "skor": 0.8,
      "metrikler": {...},
      "grafik_verisi": [...]
    }
  },
  "oneriler": [...]
}
```

### `GET /api/kategoriler`
Mevcut kategori listesini döner

## 🎯 Performans Hedefleri

- **İlk Yüklenme:** < 3 saniye
- **Harita Render:** < 1 saniye  
- **Panel Açılma:** < 0.5 saniye
- **Hover Response:** < 100ms
- **Lighthouse Score:** > 90

## 🔄 Git Workflow

1. **Feature branches:** `feature/harita-komponenti`
2. **Commit format:** `feat: harita hover efektleri eklendi`
3. **Pull requests** her büyük özellik için
4. **Main branch** her zaman deploy edilebilir durumda

## 🚀 Gelecek Özellikler (v2.0)

- 🔄 İl karşılaştırma modu
- 📤 Analiz sonuçlarını paylaşma
- 🌙 Dark/Light mode
- 📱 PWA desteği
- 🔍 Gelişmiş filtreleme
- 📊 Excel export
- 🤖 AI tabanlı yatırım önerileri
- 📈 Zaman serisi analizi

---

## ✅ Başlamaya Hazır!

Bu plan doğrultusunda geliştirmeye başlayabiliriz. İlk olarak temel altyapıyı kurarak başlayalım! 🚀
