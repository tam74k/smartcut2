import React from 'react';
import { AppSettings, Employee } from '../types';
import { printHtml } from '../utils/print';

export interface FinancialVoucherData {
  voucherType: 'salary' | 'advance' | 'penalty' | 'bonus' | 'commission_payout';
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
  payrollPeriod?: string;
}

export function ThermalFinancialVoucher({
  settings,
  data
}: {
  settings: AppSettings;
  data: FinancialVoucherData;
}) {
  const is58 = settings.paperSize === '58mm';
  const isSalary = data.voucherType === 'salary';
  const isAdvance = data.voucherType === 'advance';
  const isPenalty = data.voucherType === 'penalty';
  const isBonus = data.voucherType === 'bonus';
  const isCommission = data.voucherType === 'commission_payout';

  const title = isSalary
    ? 'سند صرف راتب شهري'
    : isCommission
    ? 'سند صرف عمولة مستحقة'
    : isAdvance 
    ? 'سند صرف سلفة نقدية' 
    : isPenalty 
    ? 'سند تسجيل خصم وجزاء' 
    : 'سند تسجيل مكافأة وحافز';

  const maxWidthClass = is58 ? 'max-w-[48mm]' : 'max-w-[65mm]';

  return (
    <div 
      id="print-financial-voucher" 
      className={`w-full ${maxWidthClass} mx-auto bg-white p-2 text-slate-900 text-xs font-sans box-border`}
      style={{ direction: 'rtl', textAlign: 'right' }}
    >
      {/* Salon Header with Logo */}
      <div className="text-center pb-2 mb-2 border-b-2 border-slate-900">
        {settings.logoUrl && (
          <img 
            src={settings.logoUrl} 
            alt="Logo" 
            className="h-9 mx-auto object-contain mb-1" 
          />
        )}
        <h2 className="text-xs sm:text-sm font-black tracking-tight leading-tight">{settings.salonName || 'SMART CUT'}</h2>
        <div className="mt-1 inline-block bg-slate-900 text-white px-2.5 py-0.5 rounded text-[10px] font-black">
          {title}
        </div>
      </div>

      {/* Metadata Bar */}
      <div className="my-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9.5px] space-y-1">
        <div className="flex justify-between items-center gap-1">
          <span className="text-slate-600 font-bold whitespace-nowrap">رقم السند:</span>
          <span className="font-mono font-black text-slate-900 text-left ltr break-all">{data.voucherNumber}</span>
        </div>
        <div className="flex justify-between items-center gap-1">
          <span className="text-slate-600 font-bold whitespace-nowrap">التاريخ والوقت:</span>
          <span className="font-mono text-slate-800 text-left ltr whitespace-nowrap text-[9px]">{data.date}</span>
        </div>
        <div className="flex justify-between items-center gap-1">
          <span className="text-slate-600 font-bold whitespace-nowrap">المستخدم:</span>
          <span className="text-slate-800 font-bold text-left truncate">{data.issuedBy}</span>
        </div>
      </div>

      {/* Employee Details */}
      <div className="p-1.5 border border-dashed border-slate-300 rounded-lg text-[10px] space-y-1 mb-1.5">
        <div className="flex justify-between items-center gap-1">
          <span className="text-slate-600 font-bold whitespace-nowrap">اسم الموظف:</span>
          <span className="font-black text-slate-900 text-left break-words">{data.employeeName}</span>
        </div>
        <div className="flex justify-between items-center gap-1 text-[9.5px]">
          <span className="text-slate-600 whitespace-nowrap">كود البصمة:</span>
          <span className="font-mono font-bold text-indigo-700 ltr">#{data.employeeCode}</span>
        </div>
        <div className="flex justify-between items-center gap-1 text-[9.5px]">
          <span className="text-slate-600 whitespace-nowrap">المسمى الوظيفي:</span>
          <span className="text-slate-800 text-left">{data.employeeRole}</span>
        </div>
      </div>

      {/* Amount Box */}
      <div className={`p-2 rounded-xl text-center space-y-0.5 mb-1.5 border ${
        isSalary ? 'bg-emerald-50 border-emerald-300 text-emerald-950' :
        isCommission ? 'bg-indigo-50 border-indigo-300 text-indigo-950' :
        isAdvance ? 'bg-amber-50 border-amber-300 text-amber-950' :
        isPenalty ? 'bg-rose-50 border-rose-300 text-rose-950' :
        'bg-emerald-50 border-emerald-300 text-emerald-950'
      }`}>
        <p className="text-[9.5px] font-bold">
          {isSalary ? 'صافي الراتب المصروف' : isCommission ? 'مبلغ العمولة المنصرف' : isAdvance ? 'المبلغ المنصرف للموظف' : isPenalty ? 'قيمة الخصم المستقطع' : 'قيمة المكافأة'}
        </p>
        <h3 className="text-sm sm:text-base font-black font-mono">
          {data.amount !== undefined && data.amount > 0 
            ? `${data.amount.toFixed(2)} ${settings.currency}` 
            : data.days 
            ? `خصم ${data.days} يوم من الراتب` 
            : '0.00'}
        </h3>
      </div>

      {/* Statement / Details */}
      <div className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9.5px] space-y-1 mb-2">
        {data.treasuryName && (
          <div className="flex justify-between items-center gap-1">
            <span className="text-slate-600 font-bold whitespace-nowrap">الخزنة المنصرف منها:</span>
            <span className="font-bold text-slate-800 text-left truncate">{data.treasuryName}</span>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-600 font-bold">البيان والسبب:</span>
          <p className="font-bold text-slate-900 bg-white p-1 rounded border border-slate-200 text-[10px] leading-tight break-words">
            {data.note || 'لا توجد ملاحظات إضافية'}
          </p>
        </div>
      </div>

      {/* Signatures */}
      <div className="pt-2 border-t-2 border-slate-900 grid grid-cols-2 gap-2 text-[8.5px] text-center text-slate-700">
        <div className="space-y-4">
          <p className="font-black leading-tight">توقيع المستلم / المقر</p>
          <div className="border-b border-dashed border-slate-400 w-16 mx-auto"></div>
        </div>
        <div className="space-y-4">
          <p className="font-black leading-tight">توقيع المسؤول / المحاسب</p>
          <div className="border-b border-dashed border-slate-400 w-16 mx-auto"></div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="mt-2 text-center text-[7.5px] text-slate-400 border-t border-slate-100 pt-1">
        <p>تم استخراج هذا السند إلكترونياً ويعد وثيقة مالية رسمية</p>
      </div>
    </div>
  );
}

/**
 * Direct print helper for 80mm/58mm thermal financial voucher
 */
export function printThermalFinancialVoucher(settings: AppSettings, data: FinancialVoucherData) {
  const is58 = settings.paperSize === '58mm';
  const voucherMaxWidth = is58 ? '48mm' : '65mm';
  const isSalary = data.voucherType === 'salary';
  const isAdvance = data.voucherType === 'advance';
  const isPenalty = data.voucherType === 'penalty';
  const isBonus = data.voucherType === 'bonus';
  const isCommission = data.voucherType === 'commission_payout';

  const title = isSalary
    ? 'سند صرف راتب شهري'
    : isCommission
    ? 'سند صرف عمولة مستحقة'
    : isAdvance 
    ? 'سند صرف سلفة نقدية' 
    : isPenalty 
    ? 'سند تسجيل خصم وجزاء' 
    : 'سند تسجيل مكافأة وحافز';

  const logoHtml = settings.logoUrl 
    ? `<img src="${settings.logoUrl}" alt="Logo" style="height: 36px; max-width: 120px; margin: 0 auto 3px; object-fit: contain; display: block;" />` 
    : '';

  const amountDisplay = data.amount !== undefined && data.amount > 0
    ? `${data.amount.toFixed(2)} ${settings.currency}`
    : data.days
    ? `خصم ${data.days} يوم من الراتب`
    : '0.00';

  const treasuryHtml = data.treasuryName ? `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; gap: 4px;">
      <span style="color: #64748b; font-weight: bold; white-space: nowrap;">الخزنة المنصرف منها:</span>
      <span style="font-weight: bold; color: #1e293b; text-align: left; word-break: break-word;">${data.treasuryName}</span>
    </div>
  ` : '';

  const html = `
    <div style="width: 100%; max-width: ${voucherMaxWidth}; margin: 0 auto; background: #fff; padding: 4px 6px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; direction: rtl; text-align: right; box-sizing: border-box;">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-bottom: 5px;">
        ${logoHtml}
        <h2 style="margin: 0; font-size: 13px; font-weight: 900; line-height: 1.2;">${settings.salonName || 'SMART CUT'}</h2>
        <div style="display: inline-block; background: #0f172a; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 900; margin-top: 3px;">
          ${title}
        </div>
      </div>

      <!-- Metadata -->
      <div style="margin: 4px 0; padding: 4px 5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 9.5px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; gap: 4px;">
          <span style="color: #64748b; font-weight: bold; white-space: nowrap;">رقم السند:</span>
          <span style="font-family: monospace; font-weight: 900; color: #0f172a; direction: ltr; unicode-bidi: embed; font-size: 9px; word-break: break-all;">${data.voucherNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; gap: 4px;">
          <span style="color: #64748b; font-weight: bold; white-space: nowrap;">التاريخ والوقت:</span>
          <span style="font-family: monospace; color: #334155; direction: ltr; unicode-bidi: embed; font-size: 8.5px; white-space: nowrap;">${data.date}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
          <span style="color: #64748b; font-weight: bold; white-space: nowrap;">المستخدم:</span>
          <span style="color: #334155; font-weight: bold; text-align: left; word-break: break-word;">${data.issuedBy}</span>
        </div>
      </div>

      <!-- Employee Info -->
      <div style="padding: 4px 5px; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 9.5px; margin-bottom: 4px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; gap: 4px;">
          <span style="color: #64748b; font-weight: bold; white-space: nowrap;">اسم الموظف:</span>
          <span style="font-weight: 900; color: #0f172a; text-align: left; word-break: break-word;">${data.employeeName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; margin-bottom: 2px; gap: 4px;">
          <span style="color: #64748b; white-space: nowrap;">كود البصمة:</span>
          <span style="font-family: monospace; font-weight: bold; color: #4338ca; direction: ltr;">#${data.employeeCode}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; gap: 4px;">
          <span style="color: #64748b; white-space: nowrap;">المسمى الوظيفي:</span>
          <span style="color: #334155; text-align: left;">${data.employeeRole}</span>
        </div>
      </div>

      <!-- Amount Box -->
      <div style="padding: 6px 4px; border-radius: 8px; text-align: center; margin-bottom: 4px; border: 1px solid #cbd5e1; background: ${isSalary ? '#f0fdf4' : isCommission ? '#eef2ff' : isAdvance ? '#fffbeb' : isPenalty ? '#fff1f2' : '#f0fdf4'}; box-sizing: border-box;">
        <p style="margin: 0; font-size: 9.5px; font-weight: bold; color: #475569;">
          ${isSalary ? 'صافي الراتب المصروف' : isCommission ? 'مبلغ العمولة المنصرف' : isAdvance ? 'المبلغ المنصرف للموظف' : isPenalty ? 'قيمة الخصم المستقطع' : 'قيمة المكافأة'}
        </p>
        <h3 style="margin: 2px 0 0; font-size: 15px; font-weight: 900; font-family: monospace; color: ${isSalary ? '#166534' : isCommission ? '#3730a3' : isAdvance ? '#92400e' : isPenalty ? '#9f1239' : '#166534'};">
          ${amountDisplay}
        </h3>
      </div>

      <!-- Statement / Reason -->
      <div style="padding: 4px 5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 9.5px; margin-bottom: 5px; box-sizing: border-box;">
        ${treasuryHtml}
        <div style="margin-top: 2px;">
          <span style="color: #64748b; font-weight: bold; display: block; margin-bottom: 2px;">البيان والسبب:</span>
          <div style="font-weight: bold; color: #0f172a; background: #fff; padding: 3px 5px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 9.5px; word-break: break-word;">
            ${data.note || 'سند مسجل بالنظام'}
          </div>
        </div>
      </div>

      <!-- Signatures -->
      <div style="padding-top: 5px; border-top: 2px solid #0f172a; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; text-align: center; font-size: 8.5px; color: #334155; box-sizing: border-box;">
        <div style="padding: 0 2px;">
          <p style="margin: 0 0 18px; font-weight: 900; line-height: 1.2;">توقيع المستلم / المقر</p>
          <div style="border-bottom: 1px dashed #94a3b8; width: 75%; margin: 0 auto;"></div>
        </div>
        <div style="padding: 0 2px;">
          <p style="margin: 0 0 18px; font-weight: 900; line-height: 1.2;">توقيع المسؤول / المحاسب</p>
          <div style="border-bottom: 1px dashed #94a3b8; width: 75%; margin: 0 auto;"></div>
        </div>
      </div>

      <div style="margin-top: 4px; text-align: center; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 2px;">
        تم استخراج هذا السند إلكترونياً ويعد وثيقة مالية رسمية
      </div>
    </div>
  `;

  printHtml(html, title, settings.paperSize || '80mm');
}
