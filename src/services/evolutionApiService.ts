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
 * Default Arabic message templates for all automated WhatsApp notifications
 */
export const DEFAULT_WHATSAPP_TEMPLATES = {
  invoiceTemplate: `مرحباً أستاذ {clientName} 🌸
شكراً لزيارتكم {salonName}.
تم إصدار وتوثيق فاتورتكم بنجاح:
📄 رقم الفاتورة: #{invoiceId}
📅 التاريخ: {date}
✂️ الخدمات: {services}
💰 الإجمالي: {total} {currency}
💵 المسدد: {paid} {currency}
{remainingText}
نسعد بخدمتكم دائماً وتشريفكم لنا! ✨`,

  bookingTemplate: `أهلاً بك أستاذ {clientName} 🌸
تم تأكيد حجز موعدك بنجاح في {salonName}:
🎫 رقم الحجز: #{bookingId}
📅 الموعد: {date} الساعة {time}
✂️ الخدمات: {services}
💈 الموظف: {employeeName}
📍 الفرع: {branchName}
يرجى التكرم بالحضور قبل الموعد بـ 10 دقائق. نتطلع لزيارتكم! ✨`,

  advanceTemplate: `السلام عليكم يا أستاذ {employeeName} 💼
إشعار مالي من إدارة {salonName}:
تم تسجيل صرف سلفة نقدية لحسابكم:
💵 المبلغ: {amount} {currency}
📅 التاريخ: {date}
🏦 الخزينة: {treasury}
{notesText}
نسأل الله لك البركة والتوفيق.`,

  reminderTemplate: `تذكير بموعد حجزكم القادم ⏰
مرحباً أستاذ {clientName}،
نود تذكيركم بلطف بموعد حجزكم في {salonName}:
📅 التاريخ: {date} الساعة {time}
✂️ الخدمات: {services}
📍 الفرع: {branchName}
يسعدنا تشريفكم وفي انتظاركم بكل حب! 💇‍♂️✨`,

  ownerTomorrowTemplate: `تقرير حجوزات ومواعيد الغد 📋
مساء الخير أستاذ {ownerName}،
ملخص جدول مواعيد وحجوزات الغد ({date}) لفرع ({branchName}) في {salonName}:
📊 إجمالي الحجوزات: {bookingsCount} حجز
تفاصيل الحجوزات:
{details}
نتمنى لكم يوماً عملياً موفقاً وناجحاً! 🌟`,

  birthdayTemplate: `كل عام وأنتم بخير أستاذ {clientName} 🎉🎂
أسرة {salonName} تتمنى لكم عاماً سعيداً مليئاً بالصحة والنجاح!
وبهذه المناسبة السعيدة، يسرنا تقديم هدية خاصة لك:
🎁 خصم خاص على جميع خدمات الصالون خلال أسبوع ميلادك
بانتظار تشريفكم للاحتفال معكم! 🎈`,

  reactivationTemplate: `اشتقنا لزيارتك أستاذ {clientName} 🌸
مرت فترة منذ زيارتكم الأخيرة لـ {salonName} ونفتقد حضوركم الكريم!
يسعدنا أن نقدم لكم هذا العرض الحصري الخاص لزيارتكم القادمة:
{offer}
احجز موعدك الآن وشرفنا في أقرب وقت. نتشرف بلقائكم دائماً! ✨`
};

/**
 * Helper to interpolate template tags like {clientName}, {total}, etc.
 */
export function interpolateTemplate(template: string, vars: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
  }).trim();
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

/**
 * Security: Validates external API endpoints to prevent Server-Side Request Forgery (SSRF)
 * Blocks internal VPC/VPS subnets, loopback, and cloud metadata endpoints in production.
 */
export function validateExternalUrl(inputUrl: string): { isValid: boolean; error?: string } {
  if (!inputUrl || !inputUrl.trim()) {
    return { isValid: false, error: 'رابط خادم Evolution API غير محدد' };
  }
  try {
    const parsed = new URL(inputUrl.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, error: 'بروتوكول الرابط غير آمن، يجب أن يبدأ بـ http:// أو https://' };
    }

    const host = parsed.hostname.toLowerCase().trim();
    const isDev = Boolean(
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ||
      (import.meta as any)?.env?.DEV
    );

    // Block cloud metadata services unconditionally
    if (host === '169.254.169.254' || host === 'metadata.google.internal') {
      return { isValid: false, error: 'تم حظر الرابط لأسباب أمنية (Cloud Metadata blocked)' };
    }

    // In production, block internal private IP ranges & loopbacks
    if (!isDev) {
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host.endsWith('.internal') ||
        host.endsWith('.local')
      ) {
        return { isValid: false, error: 'تم حظر الرابط لأسباب أمنية (Localhost/Loopback blocked in production)' };
      }

      // Check RFC 1918 private IPv4 subnets
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return { isValid: false, error: 'تم حظر الرابط لأسباب أمنية (Private subnet blocked)' };
      }
      const match172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
      if (match172) {
        const secondOctet = parseInt(match172[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) {
          return { isValid: false, error: 'تم حظر الرابط لأسباب أمنية (Private subnet blocked)' };
        }
      }
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'صيغة رابط Evolution API غير صالحة' };
  }
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
   * Resolves the active instance name strictly for the salon and specific branch
   * Security & Multi-Tenancy: Strictly avoids cross-salon instance leakage
   */
  getInstanceName(settings: AppSettings, branchId?: string): string | null {
    if (!settings.salonId) return null;
    if (branchId && settings.evolutionBranchInstances && settings.evolutionBranchInstances[branchId]) {
      return settings.evolutionBranchInstances[branchId];
    }
    return settings.evolutionInstanceName || settings.waInstantName || null;
  },

  /**
   * Checks if Evolution API is properly configured for this salon
   */
  isConfigured(settings: AppSettings, branchId?: string): boolean {
    if (settings.whatsappEnabled === false) return false;
    const instance = this.getInstanceName(settings, branchId);
    const key = settings.evolutionApiKey || settings.waApiKey;
    return !!(instance && key);
  },

  /**
   * Checks the connection state of the salon's Evolution API instance
   */
  async checkConnection(settings: AppSettings, branchId?: string): Promise<EvolutionInstanceStatus> {
    if (settings.whatsappEnabled === false) {
      return { connected: false, error: 'خدمة رسائل الواتساب معطلة حالياً في إعدادات النظام. يرجى تفعيلها أولاً.' };
    }
    if (!this.isConfigured(settings, branchId)) {
      return { connected: false, error: 'الرجاء إدخال اسم الجلسة (Instance Name) ومفتاح API (API Key)' };
    }

    const instance = this.getInstanceName(settings, branchId)!;
    const apiKey = settings.evolutionApiKey || settings.waApiKey || '';
    const baseUrl = this.getBaseUrl(settings);

    const validation = validateExternalUrl(baseUrl);
    if (!validation.isValid) {
      return { connected: false, error: validation.error || 'عنوان السيرفر غير مصرح به' };
    }

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
    if (settings.whatsappEnabled === false) {
      return { success: false, error: 'خدمة الواتساب معطلة حالياً في الإعدادات' };
    }
    if (!this.isConfigured(settings, branchId)) {
      return { success: false, error: 'لم يتم ربط وتفعيل حساب Evolution API لهذا الصالون بعد' };
    }

    const instance = this.getInstanceName(settings, branchId)!;
    const apiKey = settings.evolutionApiKey || settings.waApiKey || '';
    const baseUrl = this.getBaseUrl(settings);
    const formattedPhone = formatWhatsAppNumber(phone, settings.country);

    const validation = validateExternalUrl(baseUrl);
    if (!validation.isValid) {
      return { success: false, error: validation.error || 'عنوان السيرفر غير مصرح به' };
    }

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
  },

  /**
   * 1. إرسال الفاتورة للعميل تلقائياً
   */
  async sendInvoiceWhatsApp(settings: AppSettings, invoice: any, branchId?: string): Promise<EvolutionSendResult> {
    if (settings.whatsappEnabled === false) return { success: false, error: 'الواتساب معطل' };
    if (!settings.whatsappSettings?.sendInvoiceToClient) return { success: false, error: 'إرسال الفواتير للعملاء غير مفعل' };
    const phone = invoice.clientPhone || invoice.phone;
    if (!phone || phone.length < 7 || phone === '0000000000') return { success: false, error: 'رقم هاتف العميل غير مسجل أو غير صالح' };

    const servicesList = Array.isArray(invoice.items) 
      ? invoice.items.map((it: any) => it.serviceName || it.name || 'خدمة').join('، ')
      : 'خدمات متنوعة';

    const remaining = Number(invoice.remaining ?? 0);
    const remainingText = remaining > 0.01 ? `⏳ المتبقي (آجل): ${remaining.toFixed(2)} ${settings.currency || 'ر.س'}` : '';

    const template = settings.whatsappSettings?.invoiceTemplate || DEFAULT_WHATSAPP_TEMPLATES.invoiceTemplate;
    const message = interpolateTemplate(template, {
      clientName: invoice.clientName || 'عميلنا العزيز',
      invoiceId: invoice.invoiceNumber || invoice.id,
      date: (invoice.date || new Date().toISOString()).split('T')[0],
      services: servicesList,
      total: Number(invoice.total || 0).toFixed(2),
      paid: Number(invoice.paid || 0).toFixed(2),
      remaining: remaining.toFixed(2),
      remainingText,
      currency: settings.currency || 'ر.س',
      salonName: settings.salonName || 'صالون سمارت كت'
    });

    return this.sendTextMessage(settings, phone, message, branchId || invoice.branchId);
  },

  /**
   * 2. إرسال تأكيد الحجز للعميل تلقائياً
   */
  async sendBookingConfirmationWhatsApp(settings: AppSettings, booking: any, branchId?: string): Promise<EvolutionSendResult> {
    if (settings.whatsappEnabled === false) return { success: false, error: 'الواتساب معطل' };
    if (!settings.whatsappSettings?.sendBookingToClient) return { success: false, error: 'إرسال تأكيد الحجز للعملاء غير مفعل' };
    const phone = booking.phone;
    if (!phone || phone.length < 7) return { success: false, error: 'رقم هاتف العميل غير صالح' };

    const servicesList = Array.isArray(booking.services)
      ? booking.services.map((s: any) => s.serviceName || s.name || 'خدمة').join('، ')
      : 'خدمات الحجز';

    const branchObj = settings.branches?.find(b => b.id === (branchId || booking.branchId));
    const branchName = branchObj?.name || 'الفرع الرئيسي';

    const template = settings.whatsappSettings?.bookingTemplate || DEFAULT_WHATSAPP_TEMPLATES.bookingTemplate;
    const message = interpolateTemplate(template, {
      clientName: booking.clientName || 'عميلنا العزيز',
      bookingId: booking.bookingCode || booking.queueNumber || booking.id,
      date: booking.date,
      time: booking.time,
      services: servicesList,
      employeeName: booking.employeeName || 'حسب التوفر',
      branchName,
      salonAddress: branchObj?.address || settings.address || '',
      salonName: settings.salonName || 'صالون سمارت كت'
    });

    return this.sendTextMessage(settings, phone, message, branchId || booking.branchId);
  },

  /**
   * 3. إرسال إشعار السلفة للموظف تلقائياً
   */
  async sendAdvanceWhatsApp(
    settings: AppSettings,
    employee: any,
    advanceData: { amount: number; date: string; treasuryName: string; note?: string },
    branchId?: string
  ): Promise<EvolutionSendResult> {
    if (settings.whatsappEnabled === false) return { success: false, error: 'الواتساب معطل' };
    if (!settings.whatsappSettings?.sendAdvanceToEmployee) return { success: false, error: 'إرسال السلف للموظفين غير مفعل' };
    const phone = employee.phone;
    if (!phone || phone.length < 7) return { success: false, error: 'رقم هاتف الموظف غير مسجل' };

    const template = settings.whatsappSettings?.advanceTemplate || DEFAULT_WHATSAPP_TEMPLATES.advanceTemplate;
    const notesText = advanceData.note ? `📝 ملاحظات: ${advanceData.note}` : '';
    const message = interpolateTemplate(template, {
      employeeName: employee.name,
      amount: Number(advanceData.amount || 0).toFixed(2),
      date: advanceData.date,
      treasury: advanceData.treasuryName || 'الخزينة',
      notesText,
      currency: settings.currency || 'ر.س',
      salonName: settings.salonName || 'صالون سمارت كت'
    });

    return this.sendTextMessage(settings, phone, message, branchId || employee.branchId);
  },

  /**
   * 4. تذكير العميل قبل موعد الحجز
   */
  async sendBookingReminderWhatsApp(settings: AppSettings, booking: any, branchId?: string): Promise<EvolutionSendResult> {
    if (settings.whatsappEnabled === false) return { success: false, error: 'الواتساب معطل' };
    if (!settings.whatsappSettings?.sendBookingReminderToClient) return { success: false, error: 'تذكير المواعيد للعملاء غير مفعل' };
    const phone = booking.phone;
    if (!phone || phone.length < 7) return { success: false, error: 'رقم هاتف العميل غير صالح' };

    const servicesList = Array.isArray(booking.services)
      ? booking.services.map((s: any) => s.serviceName || s.name || 'خدمة').join('، ')
      : 'خدمات الحجز';

    const branchObj = settings.branches?.find(b => b.id === (branchId || booking.branchId));
    const branchName = branchObj?.name || 'الفرع الرئيسي';

    const template = settings.whatsappSettings?.reminderTemplate || DEFAULT_WHATSAPP_TEMPLATES.reminderTemplate;
    const message = interpolateTemplate(template, {
      clientName: booking.clientName || 'عميلنا العزيز',
      date: booking.date,
      time: booking.time,
      services: servicesList,
      branchName,
      salonName: settings.salonName || 'صالون سمارت كت'
    });

    return this.sendTextMessage(settings, phone, message, branchId || booking.branchId);
  },

  /**
   * 5. إرسال ملخص حجوزات الغد للمالك
   */
  async sendTomorrowBookingsToOwnerWhatsApp(settings: AppSettings, tomorrowBookings: any[], ownerPhone?: string, branchId?: string): Promise<EvolutionSendResult> {
    if (settings.whatsappEnabled === false) return { success: false, error: 'الواتساب معطل' };
    if (!settings.whatsappSettings?.sendTomorrowBookingsToOwner) return { success: false, error: 'إرسال حجوزات الغد للمالك غير مفعل' };
    const phone = ownerPhone || settings.phone;
    if (!phone || phone.length < 7) return { success: false, error: 'رقم هاتف المالك غير مسجل' };

    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const details = tomorrowBookings.length > 0
      ? tomorrowBookings.map((b, i) => `${i + 1}. ⏰ ${b.time} - ${b.clientName} (${Array.isArray(b.services) ? b.services.map((s: any) => s.serviceName || s.name).join('، ') : 'خدمات'})`).join('\n')
      : 'لا توجد حجوزات مسجلة للغد حتى الآن.';

    const branchObj = settings.branches?.find(b => b.id === branchId);
    const branchName = branchObj?.name || 'كافة الفروع';

    const template = settings.whatsappSettings?.ownerTomorrowTemplate || DEFAULT_WHATSAPP_TEMPLATES.ownerTomorrowTemplate;
    const message = interpolateTemplate(template, {
      ownerName: 'المالك / المدير',
      date: tomorrowStr,
      bookingsCount: tomorrowBookings.length,
      branchName,
      details,
      salonName: settings.salonName || 'صالون سمارت كت'
    });

    return this.sendTextMessage(settings, phone, message, branchId);
  },

  /**
   * 6. إرسال تهنئة مخصصة بأعياد الميلاد
   */
  async sendBirthdayWhatsApp(settings: AppSettings, client: any, customDiscount?: number, branchId?: string): Promise<EvolutionSendResult> {
    if (settings.whatsappEnabled === false) return { success: false, error: 'الواتساب معطل' };
    if (!settings.whatsappSettings?.sendBirthdayGreeting) return { success: false, error: 'تهنئة أعياد الميلاد غير مفعلة' };
    const phone = client.phone;
    if (!phone || phone.length < 7) return { success: false, error: 'رقم هاتف العميل غير صالح' };

    const template = settings.whatsappSettings?.birthdayTemplate || DEFAULT_WHATSAPP_TEMPLATES.birthdayTemplate;
    const message = interpolateTemplate(template, {
      clientName: client.name || 'عميلنا العزيز',
      discount: customDiscount || 20,
      salonName: settings.salonName || 'صالون سمارت كت'
    });

    return this.sendTextMessage(settings, phone, message, branchId);
  },

  /**
   * 7. إرسال عروض خاصة للعملاء المنقطعين
   */
  async sendReactivationOfferWhatsApp(settings: AppSettings, client: any, offerText?: string, branchId?: string): Promise<EvolutionSendResult> {
    if (settings.whatsappEnabled === false) return { success: false, error: 'الواتساب معطل' };
    if (!settings.whatsappSettings?.sendReactivationOffers) return { success: false, error: 'عروض العملاء المنقطعين غير مفعلة' };
    const phone = client.phone;
    if (!phone || phone.length < 7) return { success: false, error: 'رقم هاتف العميل غير صالح' };

    const template = settings.whatsappSettings?.reactivationTemplate || DEFAULT_WHATSAPP_TEMPLATES.reactivationTemplate;
    const message = interpolateTemplate(template, {
      clientName: client.name || 'عميلنا العزيز',
      offer: offerText || 'خصم 15% على جميع الباقات والخدمات عند زيارتكم القادمة',
      phone: settings.phone || '',
      salonName: settings.salonName || 'صالون سمارت كت'
    });

    return this.sendTextMessage(settings, phone, message, branchId);
  }
};
