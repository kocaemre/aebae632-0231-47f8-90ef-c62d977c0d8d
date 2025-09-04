// Temel Tipler
export interface Il {
  il_kodu: string;
  il_adi: string;
  plaka_no: string;
  merkez_koordinat: [number, number]; // [longitude, latitude]
  geometry?: GeoJSON.Geometry;
}

export interface IlDetay extends Il {
  genel_skor: number;
  kategori_skorlari: KategoriSkorlari;
  istatistikler: IlIstatistikleri;
  oneriler: string[];
  
  // Merge mode için ek alanlar
  is_merge_mode?: boolean;
  ranking?: number;
  total_provinces?: number;
  categoryScores?: { [key: string]: CategoryScore };
  merge_info?: MergeInfo;
  merge_details?: MergeDetails;
  compositeScores?: CompositeScores;
}

export interface CategoryScore {
  category_name: string;
  raw_score: number;
  priority_score: number;
  attractiveness_score: number;
  weight: number;
  weighted_score: number;
}

export interface MergeInfo {
  categories: number[];
  weights: { [key: number]: number };
  algorithm: string;
  sector: string;
}

export interface MergeDetails {
  weighted_average: number;
  harmonic_mean: number;
  algorithm_type: string;
}

export interface CompositeScores {
  mevcut_durum: number;
  trend: number;
  potansiyel: number;
}

export interface KategoriSkorlari {
  egitim: number;
  saglik: number;
  sanayi: number;
  tarim: number;
}

export interface IlIstatistikleri {
  egitim: EgitimIstatistikleri;
  saglik: SaglikIstatistikleri;
  sanayi: SanayiIstatistikleri;
  tarim: TarimIstatistikleri;
}

export interface EgitimIstatistikleri {
  universite_sayisi: number;
  ogrenci_sayisi: number;
  ogretmen_sayisi: number;
  okuryazarlik_orani: number;
}

export interface SaglikIstatistikleri {
  hastane_sayisi: number;
  doktor_sayisi: number;
  kisi_basina_doktor: number;
  yotak_sayisi: number;
}

export interface SanayiIstatistikleri {
  fabrika_sayisi: number;
  isci_sayisi: number;
  ihracat_degeri: number;
  sanayi_uretimi: number;
}

export interface TarimIstatistikleri {
  tarimsal_alan: number;
  uretim_miktari: number;
  hayvan_sayisi: number;
  ciftci_sayisi: number;
}

export interface Kategori {
  id: string;
  ad: string;
  aciklama: string;
  icon: string;
  renk: string;
  aktif: boolean;
}

export interface HaritaState {
  secilenKategoriler: string[];
  secilenIl: string | null;
  yakınlasmaYapildi: boolean;
  panelAcik: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Chart veri tipleri
export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface TrendData {
  yil: number;
  deger: number;
}

// Coğrafi veri tipleri
export interface GeoFeature {
  type: "Feature";
  properties: {
    il_kodu: string;
    il_adi: string;
    skor: number;
  };
  geometry: GeoJSON.Geometry;
}

export interface GeoData {
  type: "FeatureCollection";
  features: GeoFeature[];
}

// Form tipleri
export interface KategoriSecimForm {
  kategoriler: string[];
}

// Color mapping için
export interface ColorScale {
  min: number;
  max: number;
  colors: string[];
}
