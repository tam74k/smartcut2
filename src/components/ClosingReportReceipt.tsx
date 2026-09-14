import React from 'react';
import { AppSettings, Transaction, Invoice, Treasury } from '../types';

export function ClosingReportReceipt({
  settings,
  transactions,
  invoices,
  dateLabel,
  initialCash = 0,
  userName
}: {
  settings: AppSettings,
  transactions: Transaction[],
  invoices: Invoice[],
  dateLabel: string,
  initialCash?: number,
  userName?: string
}) {
  const effectiveUserName = userName || settings.ownerName || 'المسؤول';
  // Helper to categorize
  const getStats = (treasuryId: string) => {
    const tTrx = transactions.filter(t => t.treasury === treasuryId || (t as any).treasuryId === treasuryId);

    // Track invoice IDs that already exist as transactions in tTrx to avoid double counting
    const invoiceIdsInTrx = new Set(
      tTrx.filter(t => t.type === 'in' && ((t as any).invoiceId || (t as any).invoice_id))
        .map(t => (t as any).invoiceId || (t as any).invoice_id)
    );

    // Sum sales for this treasury from shift invoices not yet recorded as individual transactions
    const invoiceSales = invoices.reduce((sum, inv) => {
      if (inv.status === 'cancelled') return sum;
      if (invoiceIdsInTrx.has(inv.id)) return sum;
      const methods = inv.paymentMethods && inv.paymentMethods.length > 0
        ? inv.paymentMethods
        : [{ amount: Number(inv.total) || 0, treasuryId: inv.paymentMethod || 'cash' }];
      const matched = methods.filter((pm: any) => pm.treasuryId === treasuryId);
      return sum + matched.reduce((s: number, m: any) => s + (Number(m.amount) || 0), 0);
    }, 0);

    const recordedSales = tTrx.filter(t => t.type === 'in' && (
      t.category === 'sales' || 
      t.category === 'booking_advance' || 
      t.category === 'مبيعات' || 
      t.category === 'مقدم حجز'
    )).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const income = recordedSales + invoiceSales;
    const expenses = tTrx.filter(t => t.type === 'out' && (t.category === 'expense' || t.category === 'مصروفات')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const salaries = tTrx.filter(t => t.type === 'out' && (t.category === 'salary' || t.category === 'رواتب')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const advances = tTrx.filter(t => t.type === 'out' && (t.category === 'hr_advance' || t.category === 'staff_advance' || t.category === 'advance' || t.category === 'سلف')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const purchases = tTrx.filter(t => t.type === 'out' && (t.category === 'purchase' || t.category === 'مشتريات')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const supplierPayments = tTrx.filter(t => t.type === 'out' && (t.category === 'supplier_payment' || t.category === 'supplier' || t.category === 'سداد مورد')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const commissions = tTrx.filter(t => t.type === 'out' && (t.category === 'commission' || t.category === 'عمولة')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    const transfersIn = tTrx.filter(t => t.type === 'in' && t.category === 'transfer').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const transfersOut = tTrx.filter(t => t.type === 'out' && t.category === 'transfer').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const withdrawals = tTrx.filter(t => t.type === 'out' && (t.category === 'withdrawal' || t.category === 'سحب')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const deposits = tTrx.filter(t => t.type === 'in' && (t.category === 'deposit' || t.category === 'إيداع')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const initialCashSum = tTrx.filter(t => t.type === 'in' && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash')).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const net = (income + transfersIn + deposits + initialCashSum) - (expenses + salaries + advances + purchases + supplierPayments + commissions + transfersOut + withdrawals);

    return {
      income, expenses, salaries, advances, purchases, supplierPayments, commissions, transfersIn, transfersOut, withdrawals, deposits, initialCashSum, net
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
        <p className="text-xs">المستخدم: {effectiveUserName}</p>
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

      {(settings.treasuries || []).map(treasury => {
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
              <div className="flex justify-between text-gray-700"><span>دفعات وسداد موردين:</span><span>{stats.supplierPayments.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>نسب الموظفين (العمولات):</span><span>{stats.commissions.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>مبالغ السحب (بدون تحويل):</span><span>{stats.withdrawals.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>مبالغ السحب بالتحويل:</span><span>{stats.transfersOut.toFixed(2)}</span></div>
              
              <div className="flex justify-between font-bold border-t border-black border-dashed pt-1 mt-1 text-sm">
                <span>الصافي:</span>
                <span dir="ltr">{stats.net.toFixed(2)}</span>
              </div>
              {!treasury.isMain && stats.net > 0 && (
                <div className="text-[10px] text-emerald-800 bg-emerald-50 rounded p-1 mt-1 text-center font-bold">
                  🔄 سيتم تصفير هذا الصافي ونقله تلقائياً إلى الخزينة الرئيسية
                </div>
              )}
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
