export interface ShareImageMeta {
  title: string;
  text: string;
}

// navigator.share({files}) — same availability-check/try-catch-swallows-cancellation pattern as
// PetDetailPage.tsx's own handleShare, extended to file sharing (canShare's files check is what
// that plain-URL share didn't need). Desktop Safari/Firefox don't support file sharing at all,
// so they fall through to a synthesized <a download> click instead.
export async function shareOrDownloadImage(blob: Blob, filename: string, meta: ShareImageMeta): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: meta.title, text: meta.text });
    } catch {
      // User cancelled the native share sheet — not an error.
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
