import React, { useEffect } from 'react';
import { SalesReturn, AppSettings } from '../types';
import { Printer, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize';
import { generateCode39Svg } from '../utils/printQueueSlip';

interface SalesReturnVoucherModalProps {
  salesReturn: SalesReturn | null;
  settings: AppSettings;
  onClose: () => void;
}

export function formatReturnTime12h(timeStr?: string): string {
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

export function SalesReturnVoucherModal({ salesReturn, settings, onClose }: SalesReturnVoucherModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' || e.key === 'F8') {
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [salesReturn, onClose]);

  if (!salesReturn) return null;

  const salonDisplayName = (settings.salonName || (settings as any).storeName || 'صالون سمارت كت').trim();
  const cleanAddress = (settings.address || '')
    .replace(/جمهورية مصر العربية/g, '')
    .replace(/مصر/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,\s*|\s*,\s*$/g, '')
    .trim();

  const barcodeSvgHtml = generateCode39Svg(salesReturn.returnNumber || salesReturn.id, 28);
  const timeFormatted = formatReturnTime12h(salesReturn.time);

  const getReasonLabel = (reason: string, reasonText?: string) => {
    if (reasonText && reasonText.trim()) return reasonText;
    switch (reason) {
      case 'defective': return 'منتج تالف / عيب مصنعي';
      case 'wrong_order': return 'صنف خاطئ أو غير مطلوب';
      case 'customer_request': return 'رغبة العميل في الإرجاع';
      case 'service_unsatisfactory': return 'عدم الرضا عن الخدمة المقدمة';
      case 'other': return reasonText || 'أخرى';
      default: return 'مرتجع مبيعات';
    }
  };

  const getRefundMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'نقداً (كاش)';
      case 'card': return 'شبكة / بطاقة بنكية';
      case 'bank': return 'تحويل بنكي';
      case 'client_balance': return 'رصيد دائن بحساب العميل';
      default: return method;
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('sales-return-voucher-receipt')?.outerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=800,height=650');
    if (!printWindow) return;

    printWindow.document.write('<!DOCTYPE html><html dir="rtl" lang="ar"><head><title>سند مرتجع مبيعات</title>');
    printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">');
    printWindow.document.write('<style>');
    printWindow.document.write('@page { size: 80mm auto; margin: 4mm; }');
    printWindow.document.write('body { margin: 0; padding: 6px; display: flex; justify-content: center; background-color: #fff; direction: rtl; font-family: "Cairo", sans-serif; color: #000; }');
    printWindow.document.write('@media print { body { padding: 0; margin: 0; } @page { margin: 0; } }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    printWindow.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        
        {/* Modal Top Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <RotateCcw size={18} />
            </span>
            <div>
              <h3 className="font-black text-sm text-slate-800">إشعار دائن (سند مرتجع مبيعات)</h3>
              <p className="text-[11px] font-mono text-slate-500 font-bold">{salesReturn.returnNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Printable Voucher Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
          <div 
            id="sales-return-voucher-receipt"
            className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs text-xs font-sans space-y-3 text-black leading-relaxed"
            style={{ width: '100%', maxWidth: '380px', margin: '0 auto' }}
          >
            {/* Header info */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              {settings.logoUrl && (
                <img 
                  src={sanitizeUrl(settings.logoUrl)} 
                  alt="Logo" 
                  className="h-12 mx-auto mb-1.5 object-contain" 
                />
              )}
              <h2 className="font-black text-base text-black">{salonDisplayName}</h2>
              {cleanAddress && <p className="text-[10px] text-slate-600">{cleanAddress}</p>}
              {settings.phone && <p className="text-[10px] font-mono text-slate-600">هاتف: {settings.phone}</p>}
              
              <div className="mt-2 inline-block border-2 border-black px-3 py-1 font-black text-xs rounded-md bg-amber-50">
                إشعار دائن / سند مرتجع مبيعات
              </div>
            </div>

            {/* Voucher Meta Info */}
            <div className="space-y-1 py-1 border-b border-dashed border-slate-300 text-[11px]">
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">رقم سند المرتجع:</span>
                <span className="font-mono font-black text-black">{salesReturn.returnNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">الفاتورة الأصلية:</span>
                <span className="font-mono font-bold text-black">
                  {salesReturn.isGeneralReturn || (!salesReturn.originalInvoiceId && !salesReturn.originalInvoiceNumber)
                    ? 'بدون فاتورة (مرتجع عام)'
                    : `#${salesReturn.originalInvoiceNumber || salesReturn.originalInvoiceId}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">تاريخ ووقت المرتجع:</span>
                <span className="font-mono text-black font-semibold">{salesReturn.date} {timeFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">اسم العميل:</span>
                <span className="font-bold text-black">{salesReturn.clientName || 'عميل نقدي'}</span>
              </div>
              {salesReturn.clientPhone && (
                <div className="flex justify-between">
                  <span className="font-bold text-slate-700">رقم الهاتف:</span>
                  <span className="font-mono text-black">{salesReturn.clientPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">سبب الإرجاع:</span>
                <span className="font-bold text-amber-900">{getReasonLabel(salesReturn.reason, salesReturn.reasonText)}</span>
              </div>
            </div>

            {/* Returned Items Table */}
            <div className="py-1 border-b border-dashed border-slate-300">
              <table className="w-full text-right text-[11px]">
                <thead>
                  <tr className="border-b-2 border-black font-bold">
                    <th className="pb-1 text-right">الصنف المسترجع</th>
                    <th className="pb-1 text-center">الكمية</th>
                    <th className="pb-1 text-center">السعر</th>
                    <th className="pb-1 text-left">المسترد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dotted divide-slate-200">
                  {salesReturn.items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-1 font-bold text-black">
                        <div>
                          <span>{item.name}</span>
                          <span className="text-[9px] text-slate-500 mr-1 font-normal">
                            ({item.type === 'product' ? 'منتج' : 'خدمة'})
                          </span>
                        </div>
                      </td>
                      <td className="py-1 text-center font-mono font-black">{item.returnedQuantity}</td>
                      <td className="py-1 text-center font-mono">{Number(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="py-1 text-left font-mono font-black">{Number(item.netRefundAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Refund Info */}
            <div className="space-y-1.5 py-1 border-b border-dashed border-slate-300 text-xs">
              <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200 font-bold">
                <span className="text-amber-950 font-black">إجمالي المبلغ المسترد:</span>
                <span className="font-mono text-sm font-black text-rose-700">
                  {Number(salesReturn.totalRefundAmount || 0).toFixed(2)} {settings.currency}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-600 font-bold">طريقة استرداد المبلغ:</span>
                <span className="font-bold text-black">{getRefundMethodLabel(salesReturn.refundMethod)}</span>
              </div>
              {salesReturn.treasuryName && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600 font-bold">الخزينة المنصرف منها:</span>
                  <span className="font-semibold text-black">{salesReturn.treasuryName}</span>
                </div>
              )}
              {salesReturn.createdByName && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600 font-bold">الموظف المسؤول:</span>
                  <span className="font-semibold text-black">{salesReturn.createdByName}</span>
                </div>
              )}
              {salesReturn.notes && (
                <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200">
                  <span className="font-bold">ملاحظات: </span>
                  <span>{salesReturn.notes}</span>
                </div>
              )}
            </div>

            {/* Barcode Footer */}
            <div className="text-center pt-2 space-y-1">
              {barcodeSvgHtml && (
                <div 
                  className="flex justify-center"
                  dangerouslySetInnerHTML={{ __html: barcodeSvgHtml }} 
                />
              )}
              <p className="text-[9px] text-slate-500 font-bold">
                شكراً لتعاملكم معنا - يُحفظ هذا الإشعار كإثبات رسمي لمرتجع المبيعات
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            إغلاق (Esc)
          </button>
          
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Printer size={15} />
            <span>طباعة الإشعار (Enter)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
