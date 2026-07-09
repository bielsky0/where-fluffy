const MAX_WIDTH = 1080;
const JPEG_QUALITY = 0.8;

// Skaluje zdjęcie do max. MAX_WIDTH szerokości i koduje jako base64 JPEG — żeby baza danych nie
// "spuchła" (patrz photo.service.ts's mock-Base64-jako-URL), kompresja musi się dziać PRZED
// zapisem do store/wysyłką, nie po. Canvas-based, więc nie wymaga żadnej dodatkowej zależności.
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context nie jest dostępny');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
