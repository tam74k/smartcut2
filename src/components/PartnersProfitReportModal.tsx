import React from 'react';
import { AppSettings, Partner } from '../types';
import { handlePrintReceipt } from '../utils/print';
import { Printer, X, Download, PieChart as PieIcon, Award } from 'lucide-react';

export interface PartnerProfitReportRow {
  partnerId: string;
  partnerName: string;
  phone: string;
  status: string;
  capitalShare: number;
  sharePercentage: number;
  grossProfitShare: number;
  drawingsDeducted: number;
  priorDebitDeducted: number;
  netPayableAmount: number;
  carriedDebitBalance: number;
}

interface PartnersProfitReportModalProps {
  settings: AppSettings;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  distributableProfitPool: number;
  rows: PartnerProfitReportRow[];
  onClose: () => void;
}

export function PartnersProfitReportModal({
  settings,
  periodLabel,
  periodStart,
  periodEnd,
  distributableProfitPool,
  rows,
  onClose
}: PartnersProfitReportModalProps) {
  const printElementId = `partners-profit-report-${periodLabel.replace(/\s+/g, '-')}`;

  const handlePrint = () => {
    handlePrintReceipt(printElementId, true, 'a4'); // Landscape for rich columns
  };

  const totalCapital = rows.reduce((s, r) => s + r.capitalShare, 0);
  const totalGrossProfit = rows.reduce((s, r) => s + r.grossProfitShare, 0);
  const totalDrawings = rows.reduce((s, r) => s + r.drawingsDeducted, 0);
  const totalNetPayable = rows.reduce((s, r) => s + r.netPayableAmount, 0);
  const totalCarriedDebit = rows.reduce((s, r) => s + r.carriedDebitBalance, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              📊
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-800">تقرير توزيع أرباح الشركاء والمستثمرين والتسويات السنوية</h3>
              <p className="text-[11px] text-slate-400 font-normal">تقرير مالي ختامي يوضح نصيب كل شريك، المسحوبات المخصومة، وصافي المستحق والمديونيات ({periodLabel})</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer size={15} />
              <span>طباعة التقرير (A4 أفقي)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Report Canvas */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 flex justify-center">
          <div 
            id={printElementId} 
            className="w-full max-w-[280mm] bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 text-slate-800 font-sans text-xs"
          >
            {/* Header */}
            <div className="flex justify-between items-start pb-6 border-b-2 border-slate-900">
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {settings.salonName || 'صالون سمارت كت للرجال'}
                </h1>
                <p className="text-xs text-slate-500 font-medium">سجل تجاري / ترخيص: {settings.commercialRegister || settings.taxNumber || '1010789456'}</p>
                <div className="inline-block mt-2 px-3 py-1 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-[11px] font-black">
                  📑 تقرير الأرباح والتسويات الختامية المعتمد للشركاء
                </div>
              </div>

              <div className="text-left space-y-1">
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Logo" className="h-12 object-contain ml-auto mb-2" />
                )}
                <div className="text-[11px] text-slate-400">تاريخ الإصدار:</div>
                <div className="font-mono font-bold text-xs text-slate-800">{new Date().toLocaleString('ar-SA')}</div>
                <div className="font-mono text-[11px] text-emerald-700 font-black">{periodLabel}</div>
              </div>
            </div>

            {/* General Metrics Banner */}
            <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-1">صافي أرباح الصالون الموزعة</span>
                <span className="text-sm font-black font-mono text-emerald-700">
                  {distributableProfitPool.toLocaleString()} {settings.currency}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-1">إجمالي رأس المال</span>
                <span className="text-sm font-black font-mono text-slate-900">
                  {totalCapital.toLocaleString()} {settings.currency}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-1">إجمالي مسحوبات الشركاء</span>
                <span className="text-sm font-black font-mono text-rose-600">
                  -{totalDrawings.toLocaleString()} {settings.currency}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-1">صافي المبالغ المستحقة للصرف</span>
                <span className="text-sm font-black font-mono text-indigo-700">
                  +{totalNetPayable.toLocaleString()} {settings.currency}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 mb-1">المديونيات المرحلة (أرصدة مدينة)</span>
                <span className="text-sm font-black font-mono text-amber-700">
                  {totalCarriedDebit.toLocaleString()} {settings.currency}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[11px]">
                    <th className="p-2.5 rounded-tr-lg">#</th>
                    <th className="p-2.5">الشريك</th>
                    <th className="p-2.5">حالة الشريك</th>
                    <th className="p-2.5 text-center">رأس المال المساهم</th>
                    <th className="p-2.5 text-center">النسبة %</th>
                    <th className="p-2.5 text-center text-emerald-300">نصيب الربح الإجمالي</th>
                    <th className="p-2.5 text-center text-rose-300">المسحوبات المخصومة</th>
                    <th className="p-2.5 text-center text-indigo-300">صافي المستحق للصرف</th>
                    <th className="p-2.5 rounded-tl-lg text-center text-amber-300">رصيد مدين مرحل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                  {rows.map((r, idx) => (
                    <tr key={r.partnerId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-slate-900">
                        <div>{r.partnerName}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">{r.phone}</div>
                      </td>
                      <td className="p-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          r.status === 'exited' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {r.status === 'active' ? 'نشط' : r.status === 'exited' ? 'منسحب' : 'في طور التخارج'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                        {r.capitalShare.toLocaleString()}
                      </td>
                      <td className="p-2.5 text-center font-mono font-black text-amber-700">
                        {r.sharePercentage}%
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                        +{r.grossProfitShare.toLocaleString()}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-rose-600">
                        -{r.drawingsDeducted.toLocaleString()}
                      </td>
                      <td className="p-2.5 text-center font-mono font-black text-indigo-700">
                        {r.netPayableAmount > 0 ? `+${r.netPayableAmount.toLocaleString()}` : '0.00'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-black text-amber-800">
                        {r.carriedDebitBalance > 0 ? `⚠️ ${r.carriedDebitBalance.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-xs text-slate-900">
                    <td colSpan={3} className="p-3 text-right">المجموع الكلي:</td>
                    <td className="p-3 text-center font-mono">{totalCapital.toLocaleString()}</td>
                    <td className="p-3 text-center font-mono">100.0%</td>
                    <td className="p-3 text-center font-mono text-emerald-700">+{totalGrossProfit.toLocaleString()}</td>
                    <td className="p-3 text-center font-mono text-rose-700">-{totalDrawings.toLocaleString()}</td>
                    <td className="p-3 text-center font-mono text-indigo-800">+{totalNetPayable.toLocaleString()}</td>
                    <td className="p-3 text-center font-mono text-amber-800">{totalCarriedDebit.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signatures */}
            <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
              <div className="space-y-10">
                <span className="font-bold text-slate-600">إعداد / المدير المالي</span>
                <div className="border-b border-dashed border-slate-400 w-44 mx-auto"></div>
              </div>
              <div className="space-y-10">
                <span className="font-bold text-slate-600">المراجع القانوني المعتمد</span>
                <div className="border-b border-dashed border-slate-400 w-44 mx-auto"></div>
              </div>
              <div className="space-y-10">
                <span className="font-bold text-slate-600">اعتماد الشركاء والإدارة</span>
                <div className="border-b border-dashed border-slate-400 w-44 mx-auto"></div>
              </div>
            </div>

            {/* Note */}
            <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
              تم استخراج تقرير توزيع الأرباح تلقائياً وفق نسب الملكية ومعادلات التسوية الصارمة • صالون {settings.salonName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
