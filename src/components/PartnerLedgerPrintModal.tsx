import React from 'react';
import { AppSettings, Partner } from '../types';
import { handlePrintReceipt } from '../utils/print';
import { Printer, X, Download, ShieldCheck, TrendingUp, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export interface PartnerLedgerEntry {
  id: string;
  date: string;
  type: 'initial_capital' | 'capital_increase' | 'drawing' | 'profit_dividend' | 'exit_installment';
  typeLabelAr: string;
  description: string;
  debit: number;   // مدين (سحوبات، تقليل رأس مال)
  credit: number;  // دائن (إيداع رأس مال، أرباح مستحقة)
  runningBalance: number;
}

interface PartnerLedgerPrintModalProps {
  settings: AppSettings;
  partner: Partner;
  periodStart: string;
  periodEnd: string;
  entries: PartnerLedgerEntry[];
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  onClose: () => void;
}

export function PartnerLedgerPrintModal({
  settings,
  partner,
  periodStart,
  periodEnd,
  entries,
  openingBalance,
  totalCredits,
  totalDebits,
  closingBalance,
  onClose
}: PartnerLedgerPrintModalProps) {
  const printElementId = `partner-ledger-report-${partner.id}`;

  const handlePrint = () => {
    handlePrintReceipt(printElementId, false, 'a4');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              ⚖️
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-800">كشف حساب شريك مالي معتمد (Partner Financial Ledger)</h3>
              <p className="text-[11px] text-slate-400 font-normal">عرض وطباعة كشف الحساب التراكمي للشركاء وفق معايير الحسابات المالية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer size={15} />
              <span>طباعة كشف الحساب (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable View */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 flex justify-center">
          <div 
            id={printElementId} 
            className="w-full max-w-[210mm] bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 text-slate-800 font-sans text-xs"
            style={{ minHeight: '297mm' }}
          >
            {/* 1. Official Header */}
            <div className="flex justify-between items-start pb-6 border-b-2 border-slate-900">
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {settings.salonName || 'صالون سمارت كت للرجال'}
                </h1>
                <p className="text-xs text-slate-500 font-medium">سجل تجاري / ترخيص: {settings.commercialRegister || settings.taxNumber || '1010789456'}</p>
                <p className="text-xs text-slate-500 font-medium">العنوان: {settings.address || 'المملكة العربية السعودية'}</p>
                <div className="inline-block mt-2 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-black">
                  🏛️ كشف حساب الشركاء وحصص رأس المال والأرباح
                </div>
              </div>

              <div className="text-left space-y-1">
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Logo" className="h-12 object-contain ml-auto mb-2" />
                )}
                <div className="text-[11px] text-slate-400">تاريخ الاستخراج:</div>
                <div className="font-mono font-bold text-xs text-slate-800">{new Date().toLocaleString('ar-SA')}</div>
                <div className="text-[10px] text-slate-400 font-mono">ID: {partner.id}</div>
              </div>
            </div>

            {/* 2. Partner Metadata Card */}
            <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">اسم الشريك / المستثمر:</span>
                <strong className="text-sm font-black text-slate-900">{partner.name}</strong>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">رقم الهاتف / الهوية:</span>
                <span className="font-mono font-bold text-slate-700">{partner.phone} {partner.idNumber ? `| ${partner.idNumber}` : ''}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">نسبة الملكية في رأس المال:</span>
                <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-black text-xs">
                  {partner.sharePercentage}%
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">الفترة المشمولة بالكشف:</span>
                <span className="font-mono font-bold text-slate-700">{periodStart} إلى {periodEnd}</span>
              </div>
            </div>

            {/* 3. Summary Balance Indicators */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="block text-[10px] font-bold text-slate-500 mb-1">الرصيد الافتتاحي</span>
                <span className="text-xs font-black font-mono text-slate-700">
                  {openingBalance.toLocaleString()} {settings.currency}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-center">
                <span className="block text-[10px] font-bold text-emerald-800 mb-1">إجمالي الدائن (+)</span>
                <span className="text-xs font-black font-mono text-emerald-700">
                  +{totalCredits.toLocaleString()} {settings.currency}
                </span>
              </div>
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 text-center">
                <span className="block text-[10px] font-bold text-rose-800 mb-1">إجمالي المدين (-)</span>
                <span className="text-xs font-black font-mono text-rose-700">
                  -{totalDebits.toLocaleString()} {settings.currency}
                </span>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-center">
                <span className="block text-[10px] font-bold text-indigo-800 mb-1">الرصيد الختامي الصافي</span>
                <span className={`text-xs font-black font-mono ${closingBalance >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                  {closingBalance.toLocaleString()} {settings.currency}
                </span>
              </div>
            </div>

            {/* 4. Detailed Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[11px]">
                    <th className="p-2.5 rounded-tr-lg">#</th>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">نوع الحركة</th>
                    <th className="p-2.5">البيان والتفاصيل</th>
                    <th className="p-2.5 text-center text-rose-300">مدين (-)</th>
                    <th className="p-2.5 text-center text-emerald-300">دائن (+)</th>
                    <th className="p-2.5 rounded-tl-lg text-center">الرصيد التراكمي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/80 font-bold">
                    <td className="p-2.5 text-center font-mono text-slate-400">-</td>
                    <td className="p-2.5 font-mono text-slate-500">{periodStart}</td>
                    <td className="p-2.5 text-slate-700">رصيد افتتاحي مرحل</td>
                    <td className="p-2.5 text-slate-500">رصيد ما قبل بداية الفترة</td>
                    <td className="p-2.5 text-center text-slate-400 font-mono">-</td>
                    <td className="p-2.5 text-center text-slate-400 font-mono">-</td>
                    <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                      {openingBalance.toLocaleString()} {settings.currency}
                    </td>
                  </tr>

                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد حركات مالية مسجلة للشريك خلال هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    entries.map((item, idx) => (
                      <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-mono text-slate-600">{item.date?.split('T')[0]}</td>
                        <td className="p-2.5 font-bold text-slate-800">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                            item.debit > 0 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {item.typeLabelAr}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 max-w-xs">{item.description}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-rose-600">
                          {item.debit > 0 ? `-${item.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-600">
                          {item.credit > 0 ? `+${item.credit.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-black text-slate-900">
                          {item.runningBalance.toLocaleString()} {settings.currency}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-xs text-slate-900">
                    <td colSpan={4} className="p-3 text-right">الإجماليات والحساب الختامي:</td>
                    <td className="p-3 text-center font-mono text-rose-700">-{totalDebits.toLocaleString()}</td>
                    <td className="p-3 text-center font-mono text-emerald-700">+{totalCredits.toLocaleString()}</td>
                    <td className="p-3 text-center font-mono text-indigo-800">{closingBalance.toLocaleString()} {settings.currency}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. Signatures & Official Stamp Footer */}
            <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
              <div className="space-y-10">
                <span className="font-bold text-slate-600">توقيع الشريك / المستثمر</span>
                <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
              </div>
              <div className="space-y-10">
                <span className="font-bold text-slate-600">المحاسب المالي</span>
                <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
              </div>
              <div className="space-y-10">
                <span className="font-bold text-slate-600">اعتماد إدارة الصالون والختم</span>
                <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
              </div>
            </div>

            {/* 6. Footer Legal Note */}
            <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
              تم إصدار هذا الكشف آلياً بواسطة نظام Smart Cut لإدارة الصالونات وحصص الشركاء • يعتمد بعد توقيع الطرفين
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
