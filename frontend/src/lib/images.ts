/* Shrink photos in the browser before upload.

   Phone cameras produce 3-5 MB, 12-megapixel photos; the server only keeps 2000 px for the AI. Resizing
   on the device makes uploads ~10x smaller (much faster on mobile data) and spares the server's small
   CPU the decoding. Anything the browser cannot decode (e.g. HEIC on some browsers) is sent unchanged
   and handled by the server as before. */

const MAX_EDGE = 2000; // must stay >= the size the AI needs to read small label print
const QUALITY = 0.88;
const SMALL_ENOUGH = 600 * 1024; // already-small JPEGs are sent as they are

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    // from-image applies the EXIF rotation, so the result is upright without its EXIF tag
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH && file.type === 'image/jpeg') {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export function shrinkImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(shrink));
}
