import type { Pet } from '@/modules/pets/types/pet.types';

const WIDTH = 1080;
const HEIGHT = 1920;

// "Zaginął"/"Odnaleziony" — the two states this share graphic is ever generated for (Flow 1's
// share button on an active/missing listing, Flow 4's celebration prompt on a just-resolved
// one). Other statuses never reach this (paused/found rows don't get a share affordance).
function overlayText(status: Pet['status']): string {
  return status === 'resolved' ? 'ODNALEZIONY' : 'ZAGINĄŁ';
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Nie udało się wczytać zdjęcia'));
    img.src = src;
  });
}

// Draws pet.photoUrls[0] (a base64 data URL — see photo.service.ts — never a cross-origin URL,
// so drawImage never taints the canvas) scaled/cropped to fill a 9:16 canvas, with a bottom
// gradient + bold status text overlay, then exports a PNG blob for shareOrDownloadImage.ts.
export async function generateShareImage(pet: Pet): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context nie jest dostępny');

  const photoUrl = pet.photoUrls[0];
  if (photoUrl) {
    const img = await loadImage(photoUrl);
    const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    ctx.drawImage(img, (WIDTH - drawWidth) / 2, (HEIGHT - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = '#E5E5E5';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  const gradient = ctx.createLinearGradient(0, HEIGHT * 0.55, 0, HEIGHT);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45);

  ctx.textAlign = 'left';
  ctx.fillStyle = pet.status === 'resolved' ? '#4ADE80' : '#FF6B4A';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(overlayText(pet.status), 60, HEIGHT - 160);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 88px sans-serif';
  const name = pet.name ?? pet.species;
  ctx.fillText(name, 60, HEIGHT - 70);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Nie udało się wygenerować obrazu'))), 'image/png');
  });
}
