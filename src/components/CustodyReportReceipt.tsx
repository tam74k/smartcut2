import React from 'react';
import { AppSettings, Transaction } from '../types';
import { Wallet, Calendar, User, Clock } from 'lucide-react';

export function CustodyReportReceipt({
  settings,
  transactions,
  dateLabel,
  userName = 'الكاشير'
}: {
  settings: AppSettings;
  transactions: Transaction[];
  dateLabel: string;
  userName?: string;
}) {
  const custodyTrxs = transactions.filter(
    t => t.category === 'عهدة افتتاحية' || t.category === 'initial_cash'
  );

  const totalCustody = custodyTrxs.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div id="print-custody-receipt" className="w-[80mm] max-w-[80mm] bg-white p-3 text-slate-900 text-xs font-sans">
      {/* Header */}
      <div className="text-center pb-2 border-b border-dashed border-slate-300">
        <h2 className="text-sm font-black tracking-tight">{settings.salonName || 'SMART CUT'}</h2>
        <p className="text-[10px] text-slate-500 font-bold mt-0.5">تقرير العهد الافتتاحية اليومية</p>
        <p className="text-[9px] text-slate-400 mt-0.5">الفترة: {dateLabel}</p>
      </div>

      {/* Summary Box */}
      <div className="my-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-center">
        <p className="text-[10px] text-slate-500 font-bold">إجمالي مبالغ العهد المسجلة</p>
        <h3 className="text-base font-black text-slate-900 my-0.5">
          {totalCustody.toFixed(2)} <span className="text-[10px] font-normal">{settings.currency}</span>
        </h3>
        <p className="text-[9px] text-slate-400">عدد الورديات المفتوحة: {custodyTrxs.length}</p>
      </div>

      {/* Custody Entries */}
      <div className="space-y-2 my-2">
        <div className="text-[10px] font-bold text-slate-700 border-b border-slate-200 pb-1 flex justify-between">
          <span>تفاصيل العهد</span>
          <span>المبلغ</span>
        </div>

        {custodyTrxs.map((trx, idx) => (
          <div key={trx.id || idx} className="text-[10px] border-b border-dashed border-slate-100 pb-1.5 space-y-0.5">
            <div className="flex justify-between items-center font-bold">
              <span className="text-slate-800">وردية: {trx.shiftDate || trx.date.split('T')[0]}</span>
              <span className="font-black text-slate-900 font-mono">+{trx.amount.toFixed(2)} {settings.currency}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[9px]">
              <span>المستخدم: {trx.userName || trx.createdBy || userName}</span>
              <span>{settings.treasuries.find(t => t.id === trx.treasury)?.name || 'كاش الدرج'}</span>
            </div>
            <div className="text-[8px] text-slate-400 font-mono">
              الوقت: {new Date(trx.date).toLocaleTimeString('ar-SA')} | السند: {trx.id}
            </div>
          </div>
        ))}

        {custodyTrxs.length === 0 && (
          <p className="text-center text-slate-400 py-3 text-[10px]">لا توجد عهد مسجلة في هذه الفترة</p>
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-400">
        <p>تم استخراج التقرير بواسطة: {userName}</p>
        <p>{new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}
