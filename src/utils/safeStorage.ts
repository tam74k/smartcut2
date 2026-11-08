import { AppSettings } from '../types';

/**
 * Clean up transient or bloated cache keys from localStorage when quota is tight
 */
export function evictExcessStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // 1. Remove dangling smartcut_extra_* or demo keys
      if (k.startsWith('smartcut_extra_') || k.startsWith('smartcut_demo_')) {
        keysToRemove.push(k);
      }
      // 2. Remove large transient caches
      else if (
        k === 'smartcut_invoices_cache' ||
        k === 'smartcut_transactions' ||
        k === 'smartcut_bookings' ||
        k === 'smartcut_last_print_job' ||
        k === 'smartcut_manager_ai_history_gemini' ||
        k === 'smartcut_fingerprint_logs'
      ) {
        keysToRemove.push(k);
      }
    }

    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch (_) {}
    });

    // 3. Clean bloated base64 logo from cached smartcut_app_settings if present
    try {
      const s = localStorage.getItem('smartcut_app_settings');
      if (s && s.length > 30000) {
        const parsed = JSON.parse(s);
        if (parsed.logoUrl && parsed.logoUrl.startsWith('data:') && parsed.logoUrl.length > 5000) {
          delete parsed.logoUrl;
          localStorage.setItem('smartcut_app_settings', JSON.stringify(parsed));
        }
      }
    } catch (_) {}
  } catch (err) {
    console.warn('evictExcessStorage warning:', err);
  }
}

/**
 * Compress an image data URL to ensure small file size (max ~30-50 KB)
 */
export function compressImageToDataUrl(
  file: File, 
  maxWidth = 260, 
  maxHeight = 260, 
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('الملف المختار ليس صورة صالحة'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('فشل معالجة الصورة'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Draw transparent/white background for crisp display
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to webp or jpeg for extreme compression
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        let compressed = canvas.toDataURL(outputType, quality);

        // If png is still large, fallback to jpeg
        if (outputType === 'image/png' && compressed.length > 60000) {
          compressed = canvas.toDataURL('image/jpeg', 0.8);
        }

        resolve(compressed);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Resilient localStorage setter with automatic eviction and quota overflow fallback
 */
// Run automatic cleanup once on load to relieve existing quota pressure
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    evictExcessStorage();
  }
} catch (_) {}

export const safeStorage = {
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      console.warn(`localStorage.setItem exceeded quota on key "${key}", running storage eviction...`, e?.message);
      evictExcessStorage();

      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr: any) {
        console.warn(`localStorage.setItem retry failed on key "${key}":`, retryErr?.message);

        // If the key is smartcut_app_settings, try stripping large base64 logo from localStorage copy
        if (key === 'smartcut_app_settings' || key.startsWith('smartcut_branch_settings_')) {
          try {
            const parsed = JSON.parse(value);
            if (parsed.logoUrl && parsed.logoUrl.startsWith('data:')) {
              delete parsed.logoUrl;
              localStorage.setItem(key, JSON.stringify(parsed));
              return true;
            }
          } catch (_) {}
        }
        return false;
      }
    }
  },

  setAppSettings(settings: AppSettings): boolean {
    if (!settings) return false;
    try {
      // Create a clean copy for localStorage
      let storageCopy = { ...settings };
      // If logoUrl is a gigantic base64 string (> 25KB), strip it from local cache to prevent quota error
      if (storageCopy.logoUrl && storageCopy.logoUrl.startsWith('data:') && storageCopy.logoUrl.length > 25000) {
        storageCopy = { ...storageCopy, logoUrl: '' };
      }
      return this.setItem('smartcut_app_settings', JSON.stringify(storageCopy));
    } catch (err) {
      console.warn('safeStorage.setAppSettings exception:', err);
      return false;
    }
  },

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }
};
