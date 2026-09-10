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

export interface CompressedServiceImageResult {
  blob: Blob;
  dataUrl: string;
  fileSizeKb: number;
  fileName: string;
  error?: string;
}

/**
 * دالة متقدمة لضغط وتصغير حجم صور الخدمات لتقليل العبء على قاعدة البيانات والسيرفر
 * يتم تصغير الأبعاد إلى أقصى حد 500x500 بكسل وضغط الجودة بصيغة WebP/JPEG للحصول على حجم فائق الصغر (15 - 50 كيلوبايت)
 */
export async function compressServiceImage(file: File): Promise<CompressedServiceImageResult> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({
        blob: new Blob([]),
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
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // الحد الأقصى لأبعاد صورة الخدمة 500 بكسل (حجم مثالي لشاشات العرض والبطاقات والطباعة)
        const maxDimension = 500;
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
          const rawBlob = dataUrlToBlob(e.target?.result as string);
          resolve({
            blob: rawBlob,
            dataUrl: e.target?.result as string,
            fileSizeKb: Math.round(file.size / 1024),
            fileName: file.name
          });
          return;
        }

        // تحسين نقاء الرسم
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // محاولة الضغط بصيغة WebP أولاً، والرجوع إلى JPEG إذا لم تكن مدعومة
        let mimeType = 'image/webp';
        let quality = 0.8;
        let compressedDataUrl = canvas.toDataURL(mimeType, quality);

        if (!compressedDataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          compressedDataUrl = canvas.toDataURL(mimeType, quality);
        }

        // إذا كان الحجم الناتج كبيراً، نقلل الجودة تدريجياً حتى يصبح أقل من 80 كيلوبايت
        while (compressedDataUrl.length > 80 * 1024 * 1.33 && quality > 0.4) {
          quality -= 0.1;
          compressedDataUrl = canvas.toDataURL(mimeType, quality);
        }

        const blob = dataUrlToBlob(compressedDataUrl);
        const estimatedKb = Math.round(blob.size / 1024);

        const cleanBaseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const extension = mimeType === 'image/webp' ? 'webp' : 'jpg';
        const finalFileName = `${cleanBaseName}.${extension}`;

        resolve({
          blob,
          dataUrl: compressedDataUrl,
          fileSizeKb: estimatedKb,
          fileName: finalFileName
        });
      };

      img.onerror = () => {
        resolve({
          blob: new Blob([]),
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
        blob: new Blob([]),
        dataUrl: '',
        fileSizeKb: 0,
        fileName: file.name,
        error: 'خطأ أثناء تحميل ملف الصورة'
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * تحويل Data URL إلى Blob نقي لرفعه مباشرة إلى Supabase Storage
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error('Failed to convert dataUrl to Blob:', e);
    return new Blob([]);
  }
}
