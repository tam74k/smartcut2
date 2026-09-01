import { AppSettings } from '../types';

export interface EvolutionSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EvolutionInstanceStatus {
  connected: boolean;
  state?: string;
  phone?: string;
  qrCode?: string;
  error?: string;
}

/**
 * Normalizes phone numbers with country prefix if needed
 */
export function formatWhatsAppNumber(phone: string, defaultCountry: string = 'المملكة العربية السعودية'): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  
  if (cleaned.startsWith('05') && (defaultCountry.includes('السعودية') || defaultCountry === 'SAR')) {
    cleaned = '966' + cleaned.substring(1);
  } else if (cleaned.startsWith('01') && (defaultCountry.includes('مصر') || defaultCountry === 'EGP')) {
    cleaned = '20' + cleaned.substring(1);
  } else if (cleaned.startsWith('05') && (defaultCountry.includes('الإمارات') || defaultCountry === 'AED')) {
    cleaned = '971' + cleaned.substring(1);
  }
  return cleaned;
}

export const EvolutionApiService = {
  /**
   * Resolves the Evolution API server URL (from salon settings, platform settings, or fallback)
   */
  getBaseUrl(settings: AppSettings): string {
    if (settings.evolutionApiUrl && settings.evolutionApiUrl.trim()) {
      return settings.evolutionApiUrl.trim().replace(/\/+$/, '');
    }
    try {
      const savedPlatformUrl = localStorage.getItem('smartcut_platform_evolution_url');
      if (savedPlatformUrl && savedPlatformUrl.trim()) {
        return savedPlatformUrl.trim().replace(/\/+$/, '');
      }
    } catch (e) {}
    return 'http://localhost:8080';
  },

  /**
   * Resolves the active instance name for a salon and specific branch
   */
  getInstanceName(settings: AppSettings, branchId?: string): string | null {
    if (branchId && settings.evolutionBranchInstances && settings.evolutionBranchInstances[branchId]) {
      return settings.evolutionBranchInstances[branchId];
    }
    return settings.evolutionInstanceName || settings.waInstantName || null;
  },

  /**
   * Checks if Evolution API is properly configured for this salon
   */
  isConfigured(settings: AppSettings, branchId?: string): boolean {
    const instance = this.getInstanceName(settings, branchId);
    const key = settings.evolutionApiKey || settings.waApiKey;
    return !!(instance && key);
  },

  /**
   * Checks the connection state of the salon's Evolution API instance
   */
  async checkConnection(settings: AppSettings, branchId?: string): Promise<EvolutionInstanceStatus> {
    if (!this.isConfigured(settings, branchId)) {
      return { connected: false, error: 'الرجاء إدخال اسم الجلسة (Instance Name) ومفتاح API (API Key)' };
    }

    const instance = this.getInstanceName(settings, branchId)!;
    const apiKey = settings.evolutionApiKey || settings.waApiKey || '';
    const baseUrl = this.getBaseUrl(settings);

    try {
      const res = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        headers: {
          'apikey': apiKey
        }
      });

      if (!res.ok) {
        return { connected: false, error: `فشل فحص الحالة من السيرفر (${res.status})` };
      }

      const data = await res.json();
      const state = data?.instance?.state || data?.state;
      return {
        connected: state === 'open' || state === 'connected',
        state: state || 'unknown',
        phone: data?.instance?.owner || data?.owner
      };
    } catch (err: any) {
      return { connected: false, error: err?.message || 'تعذر الاتصال بالسيرفر، تأكد من صحة اسم الجلسة والمفتاح' };
    }
  },

  /**
   * Sends a WhatsApp text message strictly through the salon's dedicated instance
   */
  async sendTextMessage(
    settings: AppSettings,
    phone: string,
    message: string,
    branchId?: string
  ): Promise<EvolutionSendResult> {
    if (!this.isConfigured(settings, branchId)) {
      return { success: false, error: 'لم يتم ربط وتفعيل حساب Evolution API لهذا الصالون بعد' };
    }

    const instance = this.getInstanceName(settings, branchId)!;
    const apiKey = settings.evolutionApiKey || settings.waApiKey || '';
    const baseUrl = this.getBaseUrl(settings);
    const formattedPhone = formatWhatsAppNumber(phone, settings.country);

    try {
      const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
          options: {
            delay: 1200,
            presence: 'composing'
          }
        })
      });

      const data = await res.json();
      if (res.ok && (data?.key?.id || data?.status === 'SUCCESS' || data?.messageId)) {
        return { success: true, messageId: data?.key?.id || data?.messageId };
      } else {
        return { success: false, error: data?.message || data?.error || 'فشل إرسال الرسالة عبر Evolution API' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطأ في الاتصال بسيرفر الواتساب' };
    }
  }
};
