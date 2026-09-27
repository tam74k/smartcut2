import React, { useMemo } from 'react';
import { AppSettings, Transaction, Invoice, Treasury, Booking } from '../types';

export function ClosingReportReceipt({
  settings,
  transactions,
  invoices,
  bookings = [],
  dateLabel,
  initialCash = 0,
  userName
}: {
  settings: AppSettings,
  transactions: Transaction[],
  invoices: Invoice[],
  bookings?: Booking[],
  dateLabel: string,
  initialCash?: number,
  userName?: string
}) {
  const effectiveUserName = userName || settings.ownerName || 'المسؤول';

  // Construct comprehensive treasuries list ensuring Cash / Main treasury and all utilized treasuries are included
  const allTreasuries: Treasury[] = useMemo(() => {
    const list = [...(settings.treasuries || [])];
    const hasMainOrCash = list.some(t => t.id === 'cash' || t.id === 'main' || t.isMain);
    if (!hasMainOrCash) {
      list.unshift({ id: 'cash', name: 'الخزنة الرئيسية (نقداً)', isMain: true });
    }
    const knownIds = new Set(list.map(t => t.id));
    transactions.forEach(t => {
      const tId = t.treasury || (t as any).treasuryId;
      if (tId && !knownIds.has(tId)) {
        knownIds.add(tId);
        list.push({ id: tId, name: tId === 'cash' ? 'الخزنة الرئيسية (نقداً)' : `خزينة (${tId})` });
      }
    });
    return list;
  }, [settings.treasuries, transactions]);

  const isMatchingTreasury = (tId: string | undefined, targetId: string) => {
    if (!tId) return targetId === 'cash' || targetId === 'main';
    if (tId === targetId) return true;
    if ((targetId === 'cash' || targetId === 'main') && (tId === 'cash' || tId === 'main')) return true;
    return false;
  };

  const getTreasuryLabel = (tId: string | undefined) => {
    if (!tId || tId === 'cash' || tId === 'main') return 'الخزنة الرئيسية (نقداً)';
    const found = allTreasuries.find(t => t.id === tId);
    if (found) return found.name;
    if (tId === 'card' || tId === 'mada') return 'شبكة / مدى';
    if (tId === 'bank_transfer') return 'تحويل بنكي';
    return tId;
  };

  // Helper to detect if a transaction represents a booking advance
  const isAdvanceTrx = (t: Transaction) => {
    if (t.type !== 'in') return false;
    const cat = t.category || '';
    if (cat === 'booking_advance' || cat === 'مقدم حجز' || cat === 'عربون حجز' || cat === 'عربون' || cat === 'مقدم') return true;
    if (cat === 'advance' && !t.description?.includes('سلف')) return true;
    const desc = t.description || '';
    if (desc.includes('عربون') || desc.includes('مقدم حجز') || desc.includes('دفعة مقدمة')) return true;
    return false;
  };

  const advanceTransactions = useMemo(() => {
    return transactions.filter(isAdvanceTrx);
  }, [transactions]);

  // Check if any booking advance on this date is not in advanceTransactions to prevent missing unrecorded advances
  const unrecordedBookingAdvances = useMemo(() => {
    if (!bookings || bookings.length === 0) return [];
    const advances: { id: string; amount: number; treasuryId: string; clientName: string; bookingCode?: string }[] = [];
    
    bookings.forEach(b => {
      (b.advancePayments || []).forEach(adv => {
        const advDate = adv.date || '';
        const matchesDate = dateLabel.includes(' - ')
          ? (advDate >= dateLabel.split(' - ')[0] && advDate <= dateLabel.split(' - ')[1])
          : (advDate.startsWith(dateLabel) || !advDate);
          
        if (matchesDate && Number(adv.amount) > 0) {
          const alreadyInTrx = advanceTransactions.some(t => 
            Number(t.amount) === Number(adv.amount) && (
              t.description?.includes(b.bookingCode || '') || 
              t.description?.includes(b.id || '') || 
              t.description?.includes(b.clientName || '')
            )
          );
          if (!alreadyInTrx) {
            advances.push({
              id: adv.id,
              amount: Number(adv.amount),
              treasuryId: adv.treasuryId || adv.paymentMethod || 'cash',
              clientName: b.clientName,
              bookingCode: b.bookingCode || b.id
            });
          }
        }
      });
    });
    return advances;
  }, [bookings, dateLabel, advanceTransactions]);

  // Combined list of collected advances
  const collectedAdvancesList = useMemo(() => {
    const list: { id: string; amount: number; treasuryId: string; label: string; desc?: string }[] = [];
    advanceTransactions.forEach(t => {
      const tId = t.treasury || (t as any).treasuryId || 'cash';
      list.push({
        id: t.id,
        amount: Number(t.amount) || 0,
        treasuryId: tId,
        label: getTreasuryLabel(tId),
        desc: t.description
      });
    });
    unrecordedBookingAdvances.forEach(adv => {
      list.push({
        id: adv.id,
        amount: adv.amount,
        treasuryId: adv.treasuryId,
        label: getTreasuryLabel(adv.treasuryId),
        desc: `دفعة مقدمة لحجز #${adv.bookingCode} - ${adv.clientName}`
      });
    });
    return list;
  }, [advanceTransactions, unrecordedBookingAdvances, allTreasuries]);

  const totalAdvancesCount = collectedAdvancesList.length;
  const totalAdvancesAmount = collectedAdvancesList.reduce((sum, item) => sum + item.amount, 0);

  // Group booking advances by payment method / treasury
  const advancesByPaymentMethod = useMemo(() => {
    const map: Record<string, { id: string; name: string; amount: number; count: number }> = {};
    collectedAdvancesList.forEach(item => {
      const key = item.label;
      if (!map[key]) {
        map[key] = { id: item.treasuryId, name: key, amount: 0, count: 0 };
      }
      map[key].amount += item.amount;
      map[key].count += 1;
    });
    return Object.values(map);
  }, [collectedAdvancesList]);

  // Helper to categorize per treasury
  const getStats = (treasuryId: string) => {
    const tTrx = transactions.filter(t => isMatchingTreasury(t.treasury || (t as any).treasuryId, treasuryId));

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
      const matched = methods.filter((pm: any) => isMatchingTreasury(pm.treasuryId, treasuryId));
      return sum + matched.reduce((s: number, m: any) => s + (Number(m.amount) || 0), 0);
    }, 0);

    const recordedSales = tTrx.filter(t => t.type === 'in' && (
      t.category === 'sales' || 
      t.category === 'مبيعات'
    )).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const sales = invoiceSales + recordedSales;

    // Booking advances for this treasury
    const trxAdvances = tTrx.filter(isAdvanceTrx).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const unrecordedAdvSum = unrecordedBookingAdvances
      .filter(adv => isMatchingTreasury(adv.treasuryId, treasuryId))
      .reduce((s, x) => s + x.amount, 0);
    const bookingAdvances = trxAdvances + unrecordedAdvSum;

    const income = sales + bookingAdvances;

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
      sales,
      bookingAdvances,
      income,
      expenses,
      salaries,
      advances,
      purchases,
      supplierPayments,
      commissions,
      transfersIn,
      transfersOut,
      withdrawals,
      deposits,
      initialCashSum,
      net
    };
  };

  const invoiceCount = invoices.length;
  const totalInvoicesSales = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  const totalCashbackUsed = invoices.reduce((sum, inv) => sum + (Number(inv.cashbackUsed) || 0), 0);
  const grandTotalCollections = totalInvoicesSales + totalAdvancesAmount;

  return (
    <div className="w-[72mm] mx-auto bg-white text-black p-4 text-sm font-sans" id="print-receipt" style={{ direction: 'rtl' }}>
      <div className="text-center border-b border-black pb-4 mb-4">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 mx-auto mb-2 object-contain grayscale" />
        )}
        <h2 className="text-xl font-bold mb-2">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-xl font-bold">تقرير إغلاق الوردية</h1>
        <p className="text-xs mt-1">تاريخ: {dateLabel}</p>
        <p className="text-xs">المستخدم: {effectiveUserName}</p>
      </div>

      <div className="mb-4">
        {/* إحصائيات الفواتير */}
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
          <span>عدد الفواتير:</span>
          <span className="font-mono">{invoiceCount}</span>
        </div>
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
          <span>إجمالي مبيعات الفواتير:</span>
          <span className="font-mono">{totalInvoicesSales.toFixed(2)}</span>
        </div>

        {/* إحصائيات مقدمات الحجوزات */}
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold text-emerald-900">
          <span>عدد مقدمات الحجوزات:</span>
          <span className="font-mono">{totalAdvancesCount}</span>
        </div>
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold text-emerald-900">
          <span>إجمالي مقدمات الحجوزات:</span>
          <span className="font-mono">{totalAdvancesAmount.toFixed(2)}</span>
        </div>

        {/* توزيع مقدمات الحجوزات حسب طريقة الدفع */}
        {advancesByPaymentMethod.length > 0 && (
          <div className="my-2 p-2 bg-slate-50 border border-slate-300 rounded text-xs">
            <div className="font-extrabold text-slate-800 mb-1 border-b border-slate-200 pb-1 flex justify-between">
              <span>توزيع المقدمات حسب طريقة الدفع:</span>
              <span className="text-[10px] text-slate-500 font-normal">({totalAdvancesCount} حجز)</span>
            </div>
            {advancesByPaymentMethod.map((pm, idx) => (
              <div key={idx} className="flex justify-between py-0.5 text-slate-700">
                <span>• {pm.name} ({pm.count}):</span>
                <span className="font-mono font-bold">{pm.amount.toFixed(2)} {settings.currency}</span>
              </div>
            ))}
          </div>
        )}

        {/* إجمالي المجاميع الكلية (المبيعات + مقدمات الحجوزات) */}
        <div className="flex justify-between border-y-2 border-black py-1.5 my-2 font-black text-sm bg-slate-100 px-1">
          <span>إجمالي المقبوضات (المجاميع):</span>
          <span className="font-mono font-black">{grandTotalCollections.toFixed(2)} {settings.currency}</span>
        </div>

        {totalCashbackUsed > 0 && (
          <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
            <span>مسدد من الكاش باك:</span>
            <span className="font-mono">{totalCashbackUsed.toFixed(2)}</span>
          </div>
        )}
        {initialCash > 0 && (
          <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
            <span>العهدة الافتتاحية:</span>
            <span className="font-mono">{Number(initialCash).toFixed(2)}</span>
          </div>
        )}
      </div>

      {allTreasuries.map(treasury => {
        const stats = getStats(treasury.id);

        return (
          <div key={treasury.id} className="mb-6">
            <h3 className="font-bold text-center border-b border-black border-dashed pb-1 mb-2 bg-gray-100">{treasury.name}</h3>
            
            <div className="space-y-1 text-xs">
              {stats.initialCashSum > 0 && (
                <div className="flex justify-between font-bold text-slate-800 bg-emerald-50 mb-1 px-1">
                  <span>العهدة الافتتاحية:</span>
                  <span className="font-mono">{stats.initialCashSum.toFixed(2)}</span>
                </div>
              )}

              {/* إجمالي الدخل وتفصيله بين مبيعات فواتير ومقدمات حجوزات */}
              <div className="flex justify-between font-bold border-b border-slate-200 pb-0.5">
                <span>إجمالي الدخل المحصل:</span>
                <span className="font-mono">{stats.income.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700 pr-2">
                <span>- مبيعات الفواتير:</span>
                <span className="font-mono">{stats.sales.toFixed(2)}</span>
              </div>
              {stats.bookingAdvances > 0 && (
                <div className="flex justify-between font-bold text-emerald-800 pr-2 bg-emerald-50 py-0.5 rounded">
                  <span>- مقدمات وعربون الحجوزات:</span>
                  <span className="font-mono">{stats.bookingAdvances.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between mt-1"><span>مبالغ الإضافة (بدون تحويل):</span><span className="font-mono">{stats.deposits.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>مبالغ الإضافة بالتحويل:</span><span className="font-mono">{stats.transfersIn.toFixed(2)}</span></div>
              
              <div className="flex justify-between mt-1 text-gray-700"><span>إجمالي المصروفات:</span><span className="font-mono">{stats.expenses.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>إجمالي رواتب:</span><span className="font-mono">{stats.salaries.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>إجمالي سلف:</span><span className="font-mono">{stats.advances.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>إجمالي مشتروات:</span><span className="font-mono">{stats.purchases.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>دفعات وسداد موردين:</span><span className="font-mono">{stats.supplierPayments.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>نسب الموظفين (العمولات):</span><span className="font-mono">{stats.commissions.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>مبالغ السحب (بدون تحويل):</span><span className="font-mono">{stats.withdrawals.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>مبالغ السحب بالتحويل:</span><span className="font-mono">{stats.transfersOut.toFixed(2)}</span></div>
              
              <div className="flex justify-between font-bold border-t border-black border-dashed pt-1 mt-1 text-sm">
                <span>الصافي:</span>
                <span dir="ltr" className="font-mono">{stats.net.toFixed(2)}</span>
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

