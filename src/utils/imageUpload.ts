/**
 * Utility for handling image uploads with max 500 KB limit and automatic compression
 */

export const MAX_IMAGE_SIZE_KB = 500;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024;

export interface ProcessedImageResult {
  dataUrl: string;
  fileSizeKb: number;
  fileName: string;
  error?: string;
}

/**
 * Processes an input image file, ensuring it does not exceed 500 KB.
 * If image is oversized, compresses it using canvas while maintaining aspect ratio and quality.
 */
export async function processImageFile(file: File): Promise<ProcessedImageResult> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({
        dataUrl: '',
        fileSizeKb: 0,
        fileName: file.name,
        error: 'الملف المختار ليس صورة صالحة. يرجى اختيار ملف بصيغة JPG أو PNG أو WEBP.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // If already under 500 KB and dimensions are reasonable, return directly
        if (file.size <= MAX_IMAGE_SIZE_BYTES && img.width <= 1200) {
          resolve({
            dataUrl: e.target?.result as string,
            fileSizeKb: Math.round(file.size / 1024),
            fileName: file.name
          });
          return;
        }

        // Compress using Canvas
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const maxDimension = 1000;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: e.target?.result as string,
            fileSizeKb: Math.round(file.size / 1024),
            fileName: file.name
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try quality from 0.8 down to 0.4 until under 500 KB
        let quality = 0.85;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        while (compressedDataUrl.length > MAX_IMAGE_SIZE_BYTES * 1.33 && quality > 0.3) {
          quality -= 0.15;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const estimatedKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);

        if (estimatedKb > MAX_IMAGE_SIZE_KB) {
          resolve({
            dataUrl: '',
            fileSizeKb: estimatedKb,
            fileName: file.name,
            error: `حجم الصورة بعد الضغط (${estimatedKb} KB) يتجاوز الحد الأقصى المسموح به (500 KB). يرجى اختيار صورة أصغر.`
          });
          return;
        }

        resolve({
          dataUrl: compressedDataUrl,
          fileSizeKb: estimatedKb,
          fileName: file.name
        });
      };

      img.onerror = () => {
        resolve({
          dataUrl: '',
          fileSizeKb: 0,
          fileName: file.name,
          error: 'فشل قراءة بيانات الصورة'
        });
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        dataUrl: '',
        fileSizeKb: 0,
        fileName: file.name,
        error: 'خطأ أثناء تحميل ملف الصورة'
      });
    };

    reader.readAsDataURL(file);
  });
}
