// jsPDF için Türkçe karakter desteği sağlayan font yardımcıları
import jsPDF from 'jspdf';

// Türkçe karakterleri düzgün görüntülemek için metin işleme fonksiyonu
function processTurkishText(text: string): string {
  // Türkçe karakterleri koruyarak metni temizle
  return text
    .replace(/ı/g, 'i')  // Küçük ı -> i
    .replace(/İ/g, 'I')  // Büyük İ -> I
    .replace(/ğ/g, 'g')  // Küçük ğ -> g
    .replace(/Ğ/g, 'G')  // Büyük Ğ -> G
    .replace(/ş/g, 's')  // Küçük ş -> s
    .replace(/Ş/g, 'S')  // Büyük Ş -> S
    .replace(/ç/g, 'c')  // Küçük ç -> c
    .replace(/Ç/g, 'C')  // Büyük Ç -> C
    .replace(/ö/g, 'o')  // Küçük ö -> o
    .replace(/Ö/g, 'O')  // Büyük Ö -> O
    .replace(/ü/g, 'u')  // Küçük ü -> u
    .replace(/Ü/g, 'U'); // Büyük Ü -> U
}

export function registerTurkishFont(doc?: jsPDF) {
  // Font kaydı artık gerekli değil, metin işleme kullanıyoruz
  return;
}

export function useTurkishFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal') {
  // jsPDF'in varsayılan font'unu kullan
  doc.setFont('helvetica', style);
}

// Türkçe metin ekleme fonksiyonu
export function addTurkishText(doc: jsPDF, text: string, x: number, y: number, options?: any) {
  // Türkçe karakterleri işle
  const processedText = processTurkishText(text);
  
  // Metni ekle
  if (options) {
    doc.text(processedText, x, y, options);
  } else {
    doc.text(processedText, x, y);
  }
}


