import React, { useEffect } from 'react';
import { Booking, AppSettings } from '../types';
import { Printer, X } from 'lucide-react';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize';
import { generateCode39Svg } from '../utils/printQueueSlip';

interface BookingReceiptModalProps {
  booking: Booking | null;
  settings: AppSettings;
  onClose: () => void;
  onPrint: (b: Booking) => void;
}

export function formatTime12h(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (trimmed.includes('ص') || trimmed.includes('م') || /am|pm/i.test(trimmed)) return trimmed;
  const parts = trimmed.split(':');
  if (parts.length < 2) return trimmed;
  let h = parseInt(parts[0], 10);
  const m = parts[1].slice(0, 2);
  if (isNaN(h)) return trimmed;
  const ampm = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function formatDateTime12h(isoOrDateStr?: string): string {
  if (!isoOrDateStr) return '';
  try {
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return isoOrDateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours24 = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours24 >= 12 ? 'م' : 'ص';
    const hours12 = hours24 % 12 || 12;
    return `${year}/${month}/${day} ${hours12}:${mins} ${ampm}`;
  } catch {
    return isoOrDateStr;
  }
}

export function BookingReceiptModal({ booking, settings, onClose, onPrint }: BookingReceiptModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' || e.key === 'F8') {
        if (booking) onPrint(booking);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [booking, onClose, onPrint]);

  if (!booking) return null;

  const servicesList = booking.services || [];
  const grossServices = servicesList.reduce((sum, s) => sum + ((Number(s.price) || 0) * (Math.max(1, Number(s.quantity) || 1))), 0);
  const lineDiscounts = servicesList.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);
  const hasLineDiscounts = lineDiscounts > 0;

  let generalDiscount = 0;
  if (!hasLineDiscounts) {
    if (booking.discountType === 'percentage' && Number(booking.discountValue) > 0) {
      generalDiscount = (grossServices * Number(booking.discountValue)) / 100;
    } else if (booking.discountType === 'fixed' && Number(booking.discountValue) > 0) {
      generalDiscount = Math.min(grossServices, Number(booking.discountValue));
    } else if (Number(booking.discountAmount) > 0) {
      generalDiscount = Math.min(grossServices, Number(booking.discountAmount));
    }
  }

  const totalDiscounts = lineDiscounts + generalDiscount;
  const netTotal = Math.max(0, grossServices - totalDiscounts);
  const advances = (booking.advancePayments || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const remaining = Math.max(0, netTotal - advances);

  const barcodeCode = booking.id || 'B000000';
  const barcodeSvg = generateCode39Svg(barcodeCode, 20);
  const salonTitle = settings.salonName || 'صالون سمارت كت';
  const cleanAddress = (settings.address || '')
    .replace(/جمهورية مصر العربية/g, '')
    .replace(/مصر/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,\s*|\s*,\s*$/g, '')
    .trim();

  const createdDateTimeStr = formatDateTime12h(booking.createdAt || booking.date);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 px-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">معاينة إيصال الحجز</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {booking.id} • {booking.clientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
            title="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body: Thermal Paper Style */}
        <div className="p-3 sm:p-5 bg-slate-100/90 overflow-y-auto flex justify-center">
          <div className="bg-white p-3.5 rounded-xl shadow-xs border border-black w-full max-w-[300px] text-black font-sans space-y-1 text-[11px] font-bold select-text">
            {/* Salon Header */}
            <div className="text-center space-y-0.5">
              {settings.logoUrl && (
                <img src={settings.logoUrl} alt="Logo" className="max-h-10 mx-auto mb-1" />
              )}
              <h2 className="text-base font-bold text-black">{salonTitle}</h2>
              <div className="inline-block border border-black px-2 py-0.5 font-bold text-[11px] text-black mt-0.5">
                إيصال حجز مؤكد
              </div>
            </div>

            {/* Barcode section */}
            <div className="text-center py-0.5 bg-white">
              <div className="max-w-[170px] mx-auto" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
              <div className="font-mono text-[11px] font-bold tracking-wider text-black mt-0.5">
                {barcodeCode}
              </div>
            </div>

            {/* Info list on single lines */}
            <div className="space-y-0.5 text-[11px] font-bold text-black border-y border-dashed border-black py-1 leading-tight">
              <div className="flex justify-between gap-2 whitespace-nowrap">
                <span className="truncate">العميل: {booking.clientName}</span>
                <span>التاريخ: {booking.date}</span>
              </div>
              <div className="flex justify-between gap-2 whitespace-nowrap">
                <span>الهاتف: <span className="font-mono">{booking.phone}</span></span>
                <span>الوقت: {formatTime12h(booking.time)}</span>
              </div>
              {booking.location && (
                <div className="flex justify-between gap-2 whitespace-nowrap">
                  <span>المكان: {booking.location}</span>
                </div>
              )}
            </div>

            {/* Services & Products Table */}
            <div className="space-y-0.5 text-[11px] font-bold text-black">
              <div className="border-b border-black pb-0.5 flex justify-between font-bold text-black">
                <span>البند (خدمة / منتج)</span>
                <span>السعر</span>
              </div>
              <div className="divide-y divide-dotted divide-black">
                {servicesList.map(s => {
                  const isProd = s.type === 'product';
                  const qty = Math.max(1, Number(s.quantity) || 1);
                  const lineDisc = Number(s.discount) || 0;
                  const lineFinal = Math.max(0, ((Number(s.price) || 0) * qty) - lineDisc);
                  return (
                    <div key={s.id} className="py-0.5 flex justify-between items-center whitespace-nowrap gap-1.5 font-bold text-black">
                      <div className="truncate">
                        <span>{s.serviceName}</span>
                        {qty > 1 && <span> (×{qty})</span>}
                        {isProd && (
                          <span className="text-[9px] border border-black px-1 py-0 mr-1">
                            منتج
                          </span>
                        )}
                        {lineDisc > 0 && (
                          <span className="text-[9px] mr-1">
                            [خصم: -${lineDisc.toFixed(2)}]
                          </span>
                        )}
                      </div>
                      <div className="text-left font-mono flex-shrink-0 text-black">
                        {lineFinal.toFixed(2)} {settings.currency}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals Section */}
            <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[11px] font-bold text-black leading-tight">
              {totalDiscounts > 0 && (
                <div className="flex justify-between whitespace-nowrap">
                  <span>إجمالي البنود:</span>
                  <span className="font-mono">{grossServices.toFixed(2)} {settings.currency}</span>
                </div>
              )}
              {lineDiscounts > 0 && (
                <div className="flex justify-between whitespace-nowrap">
                  <span>خصم البنود:</span>
                  <span className="font-mono">-{lineDiscounts.toFixed(2)} {settings.currency}</span>
                </div>
              )}
              {generalDiscount > 0 && (
                <div className="flex justify-between whitespace-nowrap">
                  <span>خصم الحجز ({booking.discountType === 'percentage' ? (booking.discountValue || 0) + '%' : 'مبلغ'}):</span>
                  <span className="font-mono">-{generalDiscount.toFixed(2)} {settings.currency}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-black border-y border-dashed border-black py-0.5 whitespace-nowrap">
                <span>الصافي الإجمالي:</span>
                <span className="font-mono">{netTotal.toFixed(2)} {settings.currency}</span>
              </div>
              {advances > 0 && (
                <div className="space-y-0.5 pt-0.5">
                  <div className="flex justify-between whitespace-nowrap">
                    <span>المدفوع مقدماً:</span>
                    <span className="font-mono">-{advances.toFixed(2)} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black border-t border-black pt-0.5 whitespace-nowrap">
                    <span>المتبقي للتحصيل:</span>
                    <span className="font-mono">{remaining.toFixed(2)} {settings.currency}</span>
                  </div>
                  <div className="p-1 rounded-sm text-[10px] space-y-0.5 mt-0.5 border border-black text-black">
                    <span className="block mb-0.5 font-bold">تفاصيل الدفعات المقدمة:</span>
                    {(booking.advancePayments || []).map((adv, i) => (
                      <div key={adv.id || i} className="flex justify-between whitespace-nowrap font-mono text-black font-bold">
                        <span>• دفعة {i + 1} ({adv.treasuryName || 'نقداً'}):</span>
                        <span>{Number(adv.amount || 0).toFixed(2)} {settings.currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Creation date & time on single line */}
            <div className="flex justify-between border-t border-dashed border-black pt-1 mt-1 text-[10px] font-bold text-black whitespace-nowrap">
              <span>تاريخ ووقت إنشاء الحجز:</span>
              <span className="font-mono">{createdDateTimeStr}</span>
            </div>

            {/* Salon Notes */}
            {settings.bookingNotes && (
              <div className="p-1 border border-dashed border-black text-center text-[10px] font-bold whitespace-pre-wrap text-black">
                {settings.bookingNotes}
              </div>
            )}

            {/* Multi-line address & contact phones directly beneath */}
            {(cleanAddress || settings.phone) && (
              <div className="pt-1 border-t border-dashed border-black text-center text-[10px] font-bold text-black space-y-0.5">
                {cleanAddress && (
                  <div className="break-words leading-tight">
                    العنوان: {cleanAddress}
                  </div>
                )}
                {settings.phone && (
                  <div className="break-words font-mono font-bold" dir="ltr">
                    هاتف: {settings.phone}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
          >
            إغلاق (Esc)
          </button>
          <button
            type="button"
            onClick={() => onPrint(booking)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Printer size={16} />
            <span>طباعة الإيصال فوراً (F8 / Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
