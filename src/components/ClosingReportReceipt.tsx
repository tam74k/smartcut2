import React from 'react';
import { AppSettings, Transaction, Invoice, Treasury } from '../types';

export function ClosingReportReceipt({
  settings,
  transactions,
  invoices,
  dateLabel,
  initialCash = 0,
  userName = 'أحمد محمد'
}: {
  settings: AppSettings,
  transactions: Transaction[],
  invoices: Invoice[],
  dateLabel: string,
  initialCash?: number,
  userName?: string
}) {
  // Helper to categorize
  const getStats = (treasuryId: string) => {
    const tTrx = transactions.filter(t => t.treasury === treasuryId || t.treasury === treasuryId); // Handle both formats if there was a typo in previous code

    const income = tTrx.filter(t => t.type === 'in' && (t.category === 'sales' || t.category === 'booking_advance')).reduce((s, x) => s + x.amount, 0);
    const expenses = tTrx.filter(t => t.type === 'out' && t.category === 'expense').reduce((s, x) => s + x.amount, 0);
    const salaries = tTrx.filter(t => t.type === 'out' && t.category === 'salary').reduce((s, x) => s + x.amount, 0);
    const advances = tTrx.filter(t => t.type === 'out' && (t.category === 'hr_advance' || t.category === 'staff_advance')).reduce((s, x) => s + x.amount, 0);
    const purchases = tTrx.filter(t => t.type === 'out' && t.category === 'purchase').reduce((s, x) => s + x.amount, 0);
    const commissions = tTrx.filter(t => t.type === 'out' && t.category === 'commission').reduce((s, x) => s + x.amount, 0);
    
    const transfersIn = tTrx.filter(t => t.type === 'in' && t.category === 'transfer').reduce((s, x) => s + x.amount, 0);
    const transfersOut = tTrx.filter(t => t.type === 'out' && t.category === 'transfer').reduce((s, x) => s + x.amount, 0);
    const withdrawals = tTrx.filter(t => t.type === 'out' && t.category === 'withdrawal').reduce((s, x) => s + x.amount, 0);
    const deposits = tTrx.filter(t => t.type === 'in' && t.category === 'deposit').reduce((s, x) => s + x.amount, 0);
    const initialCashSum = tTrx.filter(t => t.type === 'in' && t.category === 'عهدة افتتاحية').reduce((s, x) => s + x.amount, 0);

    const net = (income + transfersIn + deposits + initialCashSum) - (expenses + salaries + advances + purchases + commissions + transfersOut + withdrawals);

    return {
      income, expenses, salaries, advances, purchases, commissions, transfersIn, transfersOut, withdrawals, deposits, initialCashSum, net
    };
  };

  const invoiceCount = invoices.length; // Ensure invoices passed are already filtered for the date/period!

  return (
    <div className="w-[72mm] mx-auto bg-white text-black p-4 text-sm font-sans" id="print-receipt" style={{ direction: 'rtl' }}>
      <div className="text-center border-b border-black pb-4 mb-4">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 mx-auto mb-2 object-contain grayscale" />
        )}
        <h2 className="text-xl font-bold mb-2">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-xl font-bold">تقرير إغلاق اليوم</h1>
        <p className="text-xs mt-1">تاريخ: {dateLabel}</p>
        <p className="text-xs">المستخدم: {userName}</p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
          <span>عدد الفواتير:</span>
          <span>{invoiceCount}</span>
        </div>
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
          <span>إجمالي مبيعات الفواتير:</span>
          <span>{invoices.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}</span>
        </div>
        {invoices.reduce((sum, inv) => sum + (inv.cashbackUsed || 0), 0) > 0 && (
          <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
            <span>مسدد من الكاش باك:</span>
            <span>{invoices.reduce((sum, inv) => sum + (inv.cashbackUsed || 0), 0).toFixed(2)}</span>
          </div>
        )}
        {initialCash > 0 && (
          <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
            <span>العهدة الافتتاحية:</span>
            <span>{initialCash}</span>
          </div>
        )}
      </div>

      {settings.treasuries.map(treasury => {
        const stats = getStats(treasury.id);
        
        // Skip rendering if treasury has absolutely no activity, to save space? 
        // User asked "لكل طريقة دفع على حدى" - it's better to show it if there's any activity or it's the main one.
        // Let's show all for completeness, or only those with non-zero net/income? Show all.

        return (
          <div key={treasury.id} className="mb-6">
            <h3 className="font-bold text-center border-b border-black border-dashed pb-1 mb-2 bg-gray-100">{treasury.name}</h3>
            
            <div className="space-y-1 text-xs">
              {stats.initialCashSum > 0 && (
                <div className="flex justify-between font-bold text-slate-800 bg-emerald-50 mb-1 px-1"><span>العهدة الافتتاحية:</span><span>{stats.initialCashSum.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between"><span>إجمالي الدخل:</span><span>{stats.income.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>مبالغ الإضافة (بدون تحويل):</span><span>{stats.deposits.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>مبالغ الإضافة بالتحويل:</span><span>{stats.transfersIn.toFixed(2)}</span></div>
              
              <div className="flex justify-between mt-1 text-gray-700"><span>إجمالي المصروفات:</span><span>{stats.expenses.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>إجمالي رواتب:</span><span>{stats.salaries.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>إجمالي سلف:</span><span>{stats.advances.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>إجمالي مشتروات:</span><span>{stats.purchases.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>نسب الموظفين (العمولات):</span><span>{stats.commissions.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>مبالغ السحب (بدون تحويل):</span><span>{stats.withdrawals.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>مبالغ السحب بالتحويل:</span><span>{stats.transfersOut.toFixed(2)}</span></div>
              
              <div className="flex justify-between font-bold border-t border-black border-dashed pt-1 mt-1 text-sm">
                <span>الصافي:</span>
                <span dir="ltr">{stats.net.toFixed(2)}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="text-center mt-6 text-xs border-t border-black pt-2">
        <p>تم استخراج التقرير من النظام</p>
        <p>{new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}
