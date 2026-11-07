import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AppSettings, Booking, Invoice } from '../types';
import { generateCode39Svg } from './printQueueSlip';
import { calculateInvoiceReceiptTotals } from '../components/InvoiceReceiptCard';
import { calculateBookingTotals } from '../components/BookingsScreen';

function escapeHtml(str?: string | number | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return '';
}

function formatTo12Hour(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * تحويل كود HTML إلى ملف PDF مشفر كـ Base64 داخل الذاكرة المؤقتة بالكامل
 * دون حفظ أي ملف على الجهاز أو السيرفر
 */
export async function convertHtmlToPdfBase64(htmlContent: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PDF conversion requires a browser DOM environment');
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.zIndex = '-9999';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.width = '340px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '12px';
  container.style.boxSizing = 'border-box';
  container.style.direction = 'rtl';
  container.style.fontFamily = "'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    // انتظار تحميل أو فك تشفير أي صور داخل المحتوى (مثل الشعار) قبل الالتقاط
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          if (typeof img.decode === 'function') {
            return img.decode().catch(() => {});
          }
          return new Promise(resolve => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            setTimeout(resolve, 500);
          });
        })
      );
    }

    // التقاط الـ Canvas بدقة مضاعفة (2x) لضمان وضوح نصوص الخط العربي
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false, // يجب أن تكون false لمنع تلوث الـ Canvas عند استخراج DataURL
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidthMm = 76; // عرض مناسب لإيصالات الفواتير والحراري
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [imgWidthMm, Math.max(imgHeightMm, 40)]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidthMm, imgHeightMm);
    const dataUri = pdf.output('datauristring');
    // استخراج كود Base64 الصافي بدون أي بادئة Data-URI ليقبلها سيرفر Evolution API فوراً
    return dataUri.includes('base64,') ? dataUri.split('base64,')[1].trim() : dataUri.trim();
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
}

/**
 * إنشاء تصميم HTML لإيصال الحجز المؤكد
 */
export function generateBookingReceiptHtml(
  booking: Booking,
  settings: AppSettings,
  branchObj?: any,
  currentUser?: any
): string {
  const totals = calculateBookingTotals(booking);
  const totalAdv = totals.advances;
  const remainingAmt = totals.remaining;
  const salonTitle = settings.salonName || 'صالون سمارت كت';
  const branchName = branchObj?.name || 'الفرع الرئيسي';
  const barcodeCode = booking.bookingCode || booking.queueNumber || booking.id || 'B000000';
  const barcodeSvg = generateCode39Svg(barcodeCode, 20);
  const currency = settings.currency || 'ر.س';

  return `
    <div style="max-width: 310px; margin: 0 auto; font-family: 'Cairo', system-ui, sans-serif; font-size: 11px; font-weight: bold; line-height: 1.4; color: #000; text-align: right; direction: rtl; background: #fff;">
      <div style="text-align: center; margin-bottom: 6px;">
        ${settings.logoUrl ? `<img src="${sanitizeUrl(settings.logoUrl)}" style="max-height: 48px; margin: 0 auto 4px; display: block;" />` : ''}
        <div style="font-size: 16px; font-weight: 800; margin: 0; color: #000;">${escapeHtml(salonTitle)}</div>
        <div style="font-size: 11px; color: #333; margin-top: 1px;">فرع: ${escapeHtml(branchName)}</div>
        <div style="display: inline-block; border: 1.5px solid #000; padding: 2px 10px; font-size: 12px; font-weight: 800; margin-top: 4px; color: #000; border-radius: 4px;">إيصال حجز مؤكد</div>
      </div>

      <!-- الباركود -->
      <div style="text-align: center; margin: 4px 0 6px; padding: 2px 0;">
        <div style="max-width: 180px; margin: 0 auto;">
          ${barcodeSvg}
        </div>
        <div style="font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #000; margin-top: 2px;">
          ${escapeHtml(barcodeCode)}
        </div>
      </div>

      <!-- بيانات الحجز والعميل -->
      <div style="border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 6px 0; margin-bottom: 6px; font-size: 11px; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; gap: 8px;">
          <span>📅 التاريخ: <b>${escapeHtml(booking.date)}</b></span>
          <span>⏰ الوقت: <b>${escapeHtml(formatTo12Hour(booking.time))}</b></span>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 8px;">
          <span>👤 العميل: <b>${escapeHtml(booking.clientName)}</b></span>
          <span>📍 المكان: <b>${escapeHtml(booking.location || 'داخل الصالون')}</b></span>
        </div>
        ${(booking.phone || booking.clientPhone) ? `
        <div style="display: flex; justify-content: space-between; gap: 8px;">
          <span>📱 الجوال: <b dir="ltr">${escapeHtml(booking.phone || booking.clientPhone || '')}</b></span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; gap: 8px; border-top: 1px solid #ddd; margin-top: 3px; padding-top: 3px;">
          <span>✂️ الموظف المختار:</span>
          <b>${escapeHtml(booking.employeeName || 'حسب التوفر')}</b>
        </div>
      </div>

      <!-- جدول الخدمات -->
      <div style="margin-bottom: 6px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 3px; font-weight: 800;">
          <span>الخدمة / البند</span>
          <span>السعر</span>
        </div>
        ${(booking.services || []).map(s => {
          const qty = Math.max(1, Number(s.quantity) || 1);
          const price = Number(s.price || 0) * qty;
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px dashed #ccc; gap: 6px;">
              <div>
                <span>${escapeHtml(s.serviceName || (s as any).name)}</span>
                ${qty > 1 ? `<span> (×${qty})</span>` : ''}
              </div>
              <div style="font-family: monospace; white-space: nowrap;">
                ${price.toFixed(2)} ${escapeHtml(currency)}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- الإجماليات والمدفوع والمتبقي -->
      <div style="border-top: 1.5px solid #000; padding-top: 4px; margin-bottom: 6px; font-size: 11px; line-height: 1.5;">
        ${totals.totalDiscounts > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>إجمالي الخدمات:</span>
            <span style="font-family: monospace;">${totals.grossServices.toFixed(2)} ${escapeHtml(currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #c00;">
            <span>الخصم:</span>
            <span style="font-family: monospace;">-${totals.totalDiscounts.toFixed(2)} ${escapeHtml(currency)}</span>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-weight: 800; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 3px 0; font-size: 12px;">
          <span>الصافي الإجمالي:</span>
          <span style="font-family: monospace;">${totals.netTotal.toFixed(2)} ${escapeHtml(currency)}</span>
        </div>

        ${totalAdv > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #008000;">
            <span>العربون المسدد:</span>
            <span style="font-family: monospace;">-${totalAdv.toFixed(2)} ${escapeHtml(currency)}</span>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 12px; margin-top: 2px;">
          <span>المتبقي عند الحضور:</span>
          <span style="font-family: monospace;">${remainingAmt.toFixed(2)} ${escapeHtml(currency)}</span>
        </div>
      </div>

      <!-- ذيل الإيصال -->
      <div style="text-align: center; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; font-size: 10px; color: #444;">
        <div>يرجى التكرم بالحضور قبل الموعد بـ 10 دقائق</div>
        <div style="margin-top: 2px; font-weight: bold; color: #000;">نسعد بخدمتكم وتشريفكم لنا دائماً ✨</div>
      </div>
    </div>
  `;
}

/**
 * إنشاء تصميم HTML لفاتورة المبيعات الصادرة من نقطة البيع
 */
export function generateInvoiceReceiptHtml(
  invoice: Invoice,
  settings: AppSettings,
  branchObj?: any,
  currentUser?: any
): string {
  const totals = calculateInvoiceReceiptTotals(invoice, settings);
  const salonTitle = settings.salonName || 'صالون سمارت كت';
  const branchName = branchObj?.name || 'الفرع الرئيسي';
  const invoiceNum = invoice.invoiceNumber || invoice.id;
  const barcodeSvg = generateCode39Svg(invoiceNum, 20);
  const currency = settings.currency || 'ر.س';
  const cashier = invoice.cashierName || invoice.createdBy || (invoice as any).created_by || currentUser?.name || 'الكاشير';

  const dateStr = (invoice.date || new Date().toISOString()).split('T')[0];
  const timeStr = invoice.time || (invoice.date?.includes('T') ? invoice.date.split('T')[1].slice(0, 5) : '');

  return `
    <div style="max-width: 310px; margin: 0 auto; font-family: 'Cairo', system-ui, sans-serif; font-size: 11px; font-weight: bold; line-height: 1.4; color: #000; text-align: right; direction: rtl; background: #fff;">
      <div style="text-align: center; margin-bottom: 6px;">
        ${settings.logoUrl ? `<img src="${sanitizeUrl(settings.logoUrl)}" style="max-height: 48px; margin: 0 auto 4px; display: block;" />` : ''}
        <div style="font-size: 16px; font-weight: 800; margin: 0; color: #000;">${escapeHtml(salonTitle)}</div>
        <div style="font-size: 11px; color: #333; margin-top: 1px;">فرع: ${escapeHtml(branchName)}</div>
        <div style="display: inline-block; border: 1.5px solid #000; padding: 2px 10px; font-size: 12px; font-weight: 800; margin-top: 4px; color: #000; border-radius: 4px;">
          ${settings.vatEnabled ? 'فاتورة ضريبية مبسطة' : 'فاتورة مبيعات'}
        </div>
      </div>

      <!-- الباركود -->
      <div style="text-align: center; margin: 4px 0 6px; padding: 2px 0;">
        <div style="max-width: 180px; margin: 0 auto;">
          ${barcodeSvg}
        </div>
        <div style="font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #000; margin-top: 2px;">
          #${escapeHtml(invoiceNum)}
        </div>
      </div>

      <!-- بيانات الفاتورة والعميل -->
      <div style="border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 6px 0; margin-bottom: 6px; font-size: 11px; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; gap: 8px;">
          <span>📅 التاريخ: <b>${escapeHtml(dateStr)}</b></span>
          ${timeStr ? `<span>⏰ الوقت: <b>${escapeHtml(formatTo12Hour(timeStr))}</b></span>` : ''}
        </div>
        <div style="display: flex; justify-content: space-between; gap: 8px;">
          <span>👤 العميل: <b>${escapeHtml(invoice.clientName || 'عميل نقدي')}</b></span>
          <span>💼 الكاشير: <b>${escapeHtml(cashier)}</b></span>
        </div>
        ${invoice.clientPhone ? `
        <div style="display: flex; justify-content: space-between; gap: 8px;">
          <span>📱 الجوال: <b dir="ltr">${escapeHtml(invoice.clientPhone)}</b></span>
        </div>
        ` : ''}
      </div>

      <!-- جدول البنود المباعة -->
      <div style="margin-bottom: 6px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 3px; font-weight: 800;">
          <span>الخدمة / المنتج</span>
          <span>الإجمالي</span>
        </div>
        ${(invoice.items || []).map((it: any) => {
          const qty = Math.max(1, Number(it.quantity) || 1);
          const price = (Number(it.price) || 0) * qty;
          const employeeName = it.employeeName || it.barberName;
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px dashed #ccc; gap: 6px;">
              <div>
                <span>${escapeHtml(it.serviceName || it.name || 'بند')}</span>
                ${qty > 1 ? `<span> (×${qty})</span>` : ''}
                ${employeeName ? `<span style="font-size: 9px; color: #555; display: block;">[الموظف: ${escapeHtml(employeeName)}]</span>` : ''}
              </div>
              <div style="font-family: monospace; white-space: nowrap;">
                ${price.toFixed(2)} ${escapeHtml(currency)}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- الإجماليات والضرائب والخصومات -->
      <div style="border-top: 1.5px solid #000; padding-top: 4px; margin-bottom: 6px; font-size: 11px; line-height: 1.5;">
        ${totals.totalDiscounts > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>المجموع قبل الخصم:</span>
            <span style="font-family: monospace;">${totals.grossItems.toFixed(2)} ${escapeHtml(currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #c00;">
            <span>الخصم:</span>
            <span style="font-family: monospace;">-${totals.totalDiscounts.toFixed(2)} ${escapeHtml(currency)}</span>
          </div>
        ` : ''}

        ${settings.vatEnabled ? `
          <div style="display: flex; justify-content: space-between;">
            <span>الأساس الخاضع للضريبة:</span>
            <span style="font-family: monospace;">${totals.baseTotal.toFixed(2)} ${escapeHtml(currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>ضريبة القيمة المضافة (${settings.vatRate || 15}%):</span>
            <span style="font-family: monospace;">${totals.vatAmt.toFixed(2)} ${escapeHtml(currency)}</span>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-weight: 800; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 3px 0; font-size: 12px;">
          <span>الصافي النهائي:</span>
          <span style="font-family: monospace;">${totals.netTotal.toFixed(2)} ${escapeHtml(currency)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; color: #008000;">
          <span>المسدد:</span>
          <span style="font-family: monospace;">${totals.actualPaid.toFixed(2)} ${escapeHtml(currency)}</span>
        </div>

        ${totals.remaining > 0.01 ? `
          <div style="display: flex; justify-content: space-between; color: #c00; font-weight: 800;">
            <span>المتبقي (آجل):</span>
            <span style="font-family: monospace;">${totals.remaining.toFixed(2)} ${escapeHtml(currency)}</span>
          </div>
        ` : ''}
      </div>

      <!-- ذيل الفاتورة -->
      <div style="text-align: center; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; font-size: 10px; color: #444;">
        <div>شكراً لزيارتكم واختياركم لنا</div>
        <div style="margin-top: 2px; font-weight: bold; color: #000;">نتشرف بلقائكم دائماً ✨</div>
      </div>
    </div>
  `;
}

/**
 * توليد ملف PDF لإيصال الحجز كـ Base64 في الذاكرة
 */
export async function generateBookingPdfBase64(
  booking: Booking,
  settings: AppSettings,
  branchObj?: any,
  currentUser?: any
): Promise<string> {
  const html = generateBookingReceiptHtml(booking, settings, branchObj, currentUser);
  return await convertHtmlToPdfBase64(html);
}

/**
 * توليد ملف PDF لفاتورة المبيعات كـ Base64 في الذاكرة
 */
export async function generateInvoicePdfBase64(
  invoice: Invoice,
  settings: AppSettings,
  branchObj?: any,
  currentUser?: any
): Promise<string> {
  const html = generateInvoiceReceiptHtml(invoice, settings, branchObj, currentUser);
  return await convertHtmlToPdfBase64(html);
}
