import React from 'react';
import { AppSettings, Employee } from '../types';
import { printHtml } from '../utils/print';

export interface FinancialVoucherData {
  voucherType: 'advance' | 'penalty' | 'bonus';
  voucherNumber: string;
  date: string;
  employeeName: string;
  employeeCode: string;
  employeeRole: string;
  amount?: number;
  days?: number;
  treasuryName?: string;
  note: string;
  issuedBy: string;
}

export function ThermalFinancialVoucher({
  settings,
  data
}: {
  settings: AppSettings;
  data: FinancialVoucherData;
}) {
  const isAdvance = data.voucherType === 'advance';
  const isPenalty = data.voucherType === 'penalty';
  const isBonus = data.voucherType === 'bonus';

  const title = isAdvance 
    ? 'سند صرف سلفة نقدية' 
    : isPenalty 
    ? 'سند تسجيل خصم وجزاء' 
    : 'سند تسجيل مكافأة وحافز';

  return (
    <div id="print-financial-voucher" className="w-[78mm] max-w-[78mm] bg-white p-2.5 text-slate-900 text-xs font-sans">
      {/* Salon Header with Logo */}
      <div className="text-center pb-2 border-b-2 border-slate-900">
        {settings.logoUrl && (
          <img 
            src={settings.logoUrl} 
            alt="Logo" 
            className="h-10 mx-auto object-contain mb-1" 
          />
        )}
        <h2 className="text-sm font-black tracking-tight">{settings.salonName || 'SMART CUT'}</h2>
        <div className="mt-1 inline-block bg-slate-900 text-white px-2.5 py-0.5 rounded text-[11px] font-black">
          {title}
        </div>
      </div>

      {/* Metadata Bar */}
      <div className="my-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-600 font-bold">رقم السند:</span>
          <span className="font-mono font-black text-slate-900">{data.voucherNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 font-bold">التاريخ والوقت:</span>
          <span className="font-mono text-slate-800">{data.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 font-bold">المستخدم:</span>
          <span className="text-slate-800 font-bold">{data.issuedBy}</span>
        </div>
      </div>

      {/* Employee Details */}
      <div className="p-2 border border-dashed border-slate-300 rounded-lg text-[11px] space-y-1 mb-2">
        <div className="flex justify-between">
          <span className="text-slate-600 font-bold">اسم الموظف:</span>
          <span className="font-black text-slate-900">{data.employeeName}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-slate-600">كود البصمة:</span>
          <span className="font-mono font-bold text-indigo-700">#{data.employeeCode}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-slate-600">المسمى الوظيفي:</span>
          <span className="text-slate-800">{data.employeeRole}</span>
        </div>
      </div>

      {/* Amount Box */}
      <div className={`p-2.5 rounded-xl text-center space-y-0.5 mb-2 border ${
        isAdvance ? 'bg-amber-50 border-amber-300 text-amber-950' :
        isPenalty ? 'bg-rose-50 border-rose-300 text-rose-950' :
        'bg-emerald-50 border-emerald-300 text-emerald-950'
      }`}>
        <p className="text-[10px] font-bold">
          {isAdvance ? 'المبلغ المنصرف للموظف' : isPenalty ? 'قيمة الخصم المستقطع' : 'قيمة المكافأة'}
        </p>
        <h3 className="text-base font-black font-mono">
          {data.amount !== undefined && data.amount > 0 
            ? `${data.amount.toFixed(2)} ${settings.currency}` 
            : data.days 
            ? `خصم ${data.days} يوم من الراتب` 
            : '0.00'}
        </h3>
      </div>

      {/* Statement / Details */}
      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] space-y-1 mb-3">
        {data.treasuryName && (
          <div className="flex justify-between">
            <span className="text-slate-600 font-bold">الخزنة المنصرف منها:</span>
            <span className="font-bold text-slate-800">{data.treasuryName}</span>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-600 font-bold">البيان والسبب:</span>
          <p className="font-bold text-slate-900 bg-white p-1 rounded border border-slate-200 text-[11px] leading-tight">
            {data.note || 'لا توجد ملاحظات إضافية'}
          </p>
        </div>
      </div>

      {/* Signatures */}
      <div className="pt-2 border-t-2 border-slate-900 grid grid-cols-2 gap-2 text-[9px] text-center text-slate-700">
        <div className="space-y-6">
          <p className="font-black">توقيع الموظف المستلم / المقر</p>
          <div className="border-b border-dashed border-slate-400 w-24 mx-auto"></div>
        </div>
        <div className="space-y-6">
          <p className="font-black">توقيع المسؤول / المحاسب</p>
          <div className="border-b border-dashed border-slate-400 w-24 mx-auto"></div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="mt-3 text-center text-[8px] text-slate-400 border-t border-slate-100 pt-1">
        <p>تم استخراج هذا السند إلكترونياً ويعد وثيقة مالية رسمية</p>
      </div>
    </div>
  );
}

/**
 * Direct print helper for 80mm thermal financial voucher
 */
export function printThermalFinancialVoucher(settings: AppSettings, data: FinancialVoucherData) {
  const isAdvance = data.voucherType === 'advance';
  const isPenalty = data.voucherType === 'penalty';
  const isBonus = data.voucherType === 'bonus';

  const title = isAdvance 
    ? 'سند صرف سلفة نقدية' 
    : isPenalty 
    ? 'سند تسجيل خصم وجزاء' 
    : 'سند تسجيل مكافأة وحافز';

  const logoHtml = settings.logoUrl 
    ? `<img src="${settings.logoUrl}" alt="Logo" style="height: 38px; margin: 0 auto 4px; object-fit: contain;" />` 
    : '';

  const amountDisplay = data.amount !== undefined && data.amount > 0
    ? `${data.amount.toFixed(2)} ${settings.currency}`
    : data.days
    ? `خصم ${data.days} يوم من الراتب`
    : '0.00';

  const treasuryHtml = data.treasuryName ? `
    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
      <span style="color: #64748b; font-weight: bold;">الخزنة المنصرف منها:</span>
      <span style="font-weight: bold; color: #1e293b;">${data.treasuryName}</span>
    </div>
  ` : '';

  const html = `
    <div style="width: 78mm; max-width: 78mm; background: #fff; padding: 6px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; direction: rtl; text-align: right; box-sizing: border-box;">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">
        ${logoHtml}
        <h2 style="margin: 0; font-size: 14px; font-weight: 900;">${settings.salonName || 'SMART CUT'}</h2>
        <div style="display: inline-block; background: #0f172a; color: #fff; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 900; margin-top: 4px;">
          ${title}
        </div>
      </div>

      <!-- Metadata -->
      <div style="margin: 6px 0; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span style="color: #64748b; font-weight: bold;">رقم السند:</span>
          <span style="font-family: monospace; font-weight: 900; color: #0f172a;">${data.voucherNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span style="color: #64748b; font-weight: bold;">التاريخ والوقت:</span>
          <span style="font-family: monospace; color: #334155;">${data.date}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b; font-weight: bold;">المستخدم:</span>
          <span style="color: #334155; font-weight: bold;">${data.issuedBy}</span>
        </div>
      </div>

      <!-- Employee Info -->
      <div style="padding: 6px; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 11px; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #64748b; font-weight: bold;">اسم الموظف:</span>
          <span style="font-weight: 900; color: #0f172a;">${data.employeeName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
          <span style="color: #64748b;">كود البصمة:</span>
          <span style="font-family: monospace; font-weight: bold; color: #4338ca;">#${data.employeeCode}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px;">
          <span style="color: #64748b;">المسمى الوظيفي:</span>
          <span style="color: #334155;">${data.employeeRole}</span>
        </div>
      </div>

      <!-- Amount Box -->
      <div style="padding: 8px; border-radius: 8px; text-align: center; margin-bottom: 6px; border: 1px solid #cbd5e1; background: ${isAdvance ? '#fffbeb' : isPenalty ? '#fff1f2' : '#f0fdf4'};">
        <p style="margin: 0; font-size: 10px; font-weight: bold; color: #475569;">
          ${isAdvance ? 'المبلغ المنصرف للموظف' : isPenalty ? 'قيمة الخصم المستقطع' : 'قيمة المكافأة'}
        </p>
        <h3 style="margin: 2px 0 0; font-size: 16px; font-weight: 900; font-family: monospace; color: ${isAdvance ? '#92400e' : isPenalty ? '#9f1239' : '#166534'};">
          ${amountDisplay}
        </h3>
      </div>

      <!-- Statement / Reason -->
      <div style="padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; margin-bottom: 8px;">
        ${treasuryHtml}
        <div style="margin-top: 2px;">
          <span style="color: #64748b; font-weight: bold; display: block; margin-bottom: 2px;">البيان والسبب:</span>
          <div style="font-weight: bold; color: #0f172a; background: #fff; padding: 4px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 10px;">
            ${data.note || 'سند مسجل بالنظام'}
          </div>
        </div>
      </div>

      <!-- Signatures -->
      <div style="padding-top: 6px; border-top: 2px solid #0f172a; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; text-align: center; font-size: 9px; color: #334155;">
        <div>
          <p style="margin: 0 0 22px; font-weight: 900;">توقيع الموظف المستلم / المقر</p>
          <div style="border-bottom: 1px dashed #94a3b8; width: 70%; margin: 0 auto;"></div>
        </div>
        <div>
          <p style="margin: 0 0 22px; font-weight: 900;">توقيع المسؤول / المحاسب</p>
          <div style="border-bottom: 1px dashed #94a3b8; width: 70%; margin: 0 auto;"></div>
        </div>
      </div>

      <div style="margin-top: 6px; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 3px;">
        تم استخراج هذا السند إلكترونياً ويعد وثيقة مالية رسمية
      </div>
    </div>
  `;

  printHtml(html, title);
}
