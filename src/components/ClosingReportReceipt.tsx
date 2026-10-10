import React, { useMemo } from 'react';
import { AppSettings, Transaction, Invoice, Treasury, Booking } from '../types';
import { isMatchingTreasury, getTreasuryLabel } from '../utils/treasury';

export function ClosingReportReceipt({
  settings,
  transactions,
  invoices,
  bookings = [],
  dateLabel,
  initialCash = 0,
  userName,
  shiftCode,
  openedByUserName,
  openedAt,
  closedByUserName,
  closedAt,
  expectedCash,
  actualCash,
  cashDifference,
  transferredAmount,
  mainTreasuryName
}: {
  settings: AppSettings,
  transactions: Transaction[],
  invoices: Invoice[],
  bookings?: Booking[],
  dateLabel: string,
  initialCash?: number,
  userName?: string,
  shiftCode?: string,
  openedByUserName?: string,
  openedAt?: string,
  closedByUserName?: string,
  closedAt?: string,
  expectedCash?: number,
  actualCash?: number,
  cashDifference?: number,
  transferredAmount?: number,
  mainTreasuryName?: string
}) {
  const effectiveUserName = userName || settings.ownerName || 'المسؤول';

  // Construct comprehensive treasuries list ensuring Cash / Main treasury and all utilized treasuries are included
  const allTreasuries: Treasury[] = useMemo(() => {
    let list: Treasury[] = (settings.treasuries && settings.treasuries.length > 0)
      ? [...settings.treasuries]
      : [
          { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
          { id: 'cash', name: 'كاش (الدرج)', isMain: false },
          { id: 'card', name: 'شبكة / فيزا', isMain: false }
        ];

    const hasMain = list.some(t => t.id === 'main' || t.isMain);
    const hasCash = list.some(t => t.id === 'cash');

    if (!hasMain) {
      list.unshift({ id: 'main', name: 'الخزنة الرئيسية', isMain: true });
    }
    if (!hasCash) {
      list.push({ id: 'cash', name: 'كاش (الدرج)', isMain: false });
    }

    const knownIds = new Set(list.map(t => t.id));
    transactions.forEach(t => {
      const tId = t.treasury || (t as any).treasuryId;
      if (tId && !knownIds.has(tId)) {
        knownIds.add(tId);
        list.push({ 
          id: tId, 
          name: tId === 'card' ? 'شبكة / مدى' : tId === 'bank_transfer' ? 'تحويل بنكي' : `خزينة (${tId})`,
          isMain: false
        });
      }
    });

    invoices.forEach(inv => {
      const pms = (inv.paymentMethods && inv.paymentMethods.length > 0)
        ? inv.paymentMethods
        : [{ treasuryId: inv.treasuryId || inv.paymentMethod }];
      pms.forEach((pm: any) => {
        const pmId = pm.treasuryId;
        if (pmId && pmId !== 'cashback' && pmId !== 'remedy_free' && !knownIds.has(pmId)) {
          knownIds.add(pmId);
          list.push({
            id: pmId,
            name: pmId === 'card' ? 'شبكة / مدى' : pmId === 'bank_transfer' ? 'تحويل بنكي' : `خزينة (${pmId})`,
            isMain: false
          });
        }
      });
    });

    return list;
  }, [settings.treasuries, transactions, invoices]);

  const hasCashTreasury = useMemo(() => allTreasuries.some(t => t.id === 'cash'), [allTreasuries]);
  const hasMainTreasury = useMemo(() => allTreasuries.some(t => t.id === 'main' || t.isMain), [allTreasuries]);

  const isMatchingTreasuryLocal = (tId: string | undefined, targetId: string) => {
    return isMatchingTreasury(tId, targetId, allTreasuries);
  };

  const getTreasuryLabelLocal = (tId: string | undefined) => {
    return getTreasuryLabel(tId, allTreasuries);
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
        label: getTreasuryLabelLocal(tId),
        desc: t.description
      });
    });
    unrecordedBookingAdvances.forEach(adv => {
      list.push({
        id: adv.id,
        amount: adv.amount,
        treasuryId: adv.treasuryId,
        label: getTreasuryLabelLocal(adv.treasuryId),
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
    const tTrx = transactions.filter(t => isMatchingTreasuryLocal(t.treasury || (t as any).treasuryId, treasuryId));

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
      const matched = methods.filter((pm: any) => isMatchingTreasuryLocal(pm.treasuryId, treasuryId));
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
      .filter(adv => isMatchingTreasuryLocal(adv.treasuryId, treasuryId))
      .reduce((s, x) => s + x.amount, 0);
    const bookingAdvances = trxAdvances + unrecordedAdvSum;

    const income = sales + bookingAdvances;

    const expenses = tTrx.filter(t => t.type === 'out' && (t.category === 'expense' || t.category === 'مصروفات')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const salaries = tTrx.filter(t => t.type === 'out' && (t.category === 'salary' || t.category === 'رواتب')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const advances = tTrx.filter(t => {
      if (t.type !== 'out' && (t.type as string) !== 'expense') return false;
      const cat = (t.category || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const expCat = ((t as any).expenseCategory || '').toLowerCase();
      return (
        cat === 'hr_advance' ||
        cat === 'staff_advance' ||
        cat === 'advance' ||
        cat.includes('سلف') ||
        expCat.includes('سلف') ||
        desc.includes('سلفة') ||
        desc.includes('سلف')
      );
    }).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const purchases = tTrx.filter(t => t.type === 'out' && (t.category === 'purchase' || t.category === 'مشتريات')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const supplierPayments = tTrx.filter(t => t.type === 'out' && (t.category === 'supplier_payment' || t.category === 'supplier' || t.category === 'سداد مورد')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const commissions = tTrx.filter(t => t.type === 'out' && (t.category === 'commission' || t.category === 'عمولة')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    const transfersIn = tTrx.filter(t => t.type === 'in' && t.category === 'transfer').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const transfersOut = tTrx.filter(t => t.type === 'out' && t.category === 'transfer').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const withdrawals = tTrx.filter(t => t.type === 'out' && (t.category === 'withdrawal' || t.category === 'سحب')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const deposits = tTrx.filter(t => t.type === 'in' && (t.category === 'deposit' || t.category === 'إيداع')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const recordedInitialCash = tTrx.filter(t => t.type === 'in' && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const isCashDrawer = treasuryId === 'cash' || (!hasCashTreasury && (treasuryId === 'main' || allTreasuries.find(t => t.id === treasuryId)?.isMain));
    const initialCashSum = recordedInitialCash > 0 ? recordedInitialCash : (isCashDrawer ? (Number(initialCash) || 0) : 0);

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
        <h2 className="text-xl font-bold mb-1">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-lg font-black border-y border-black py-1 my-1">تقرير إغلاق وتسليم الوردية (Z-Report)</h1>
        {shiftCode && (
          <div className="my-1.5">
            <span className="bg-slate-900 text-white font-mono font-bold text-xs px-2.5 py-1 rounded inline-block">
              كود الوردية: {shiftCode}
            </span>
          </div>
        )}
        <p className="text-xs mt-1 font-bold">تاريخ: {dateLabel}</p>
        {openedByUserName && (
          <p className="text-xs text-gray-800">
            فتح الوردية: {openedByUserName} {openedAt ? `(${new Date(openedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })})` : ''}
          </p>
        )}
        <p className="text-xs text-gray-800">
          إغلاق الوردية: {closedByUserName || effectiveUserName} {closedAt ? `(${new Date(closedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })})` : ''}
        </p>
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
              {!treasury.isMain && treasury.id !== 'main' && stats.net > 0 && (
                <div className="text-[10px] text-emerald-800 bg-emerald-50 rounded p-1 mt-1 text-center font-bold">
                  🔄 سيتم تصفير هذا الصافي ونقله تلقائياً إلى الخزينة الرئيسية
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* قسم مطابقة النقدية وتسليم العهدة للكاشير */}
      {(expectedCash !== undefined || actualCash !== undefined) && (
        <div className="my-4 p-3 bg-slate-50 border-2 border-black rounded-lg text-xs space-y-1.5">
          <div className="font-black text-center border-b border-black pb-1 mb-1.5 text-sm">
            💵 مطابقة النقدية (الكاش) وتسليم العهدة
          </div>
          {expectedCash !== undefined && (
            <div className="flex justify-between font-bold">
              <span>الكاش المتوقع بالدرج:</span>
              <span className="font-mono">{expectedCash.toFixed(2)} {settings.currency}</span>
            </div>
          )}
          {actualCash !== undefined && (
            <div className="flex justify-between font-bold">
              <span>الكاش الفعلي المعدود:</span>
              <span className="font-mono">{actualCash.toFixed(2)} {settings.currency}</span>
            </div>
          )}
          {cashDifference !== undefined && (
            <div className={`flex justify-between font-black border-t border-dashed border-black pt-1 ${
              Math.abs(cashDifference) < 0.01 
                ? 'text-emerald-700' 
                : cashDifference < 0 
                  ? 'text-red-700' 
                  : 'text-blue-700'
            }`}>
              <span>الفارق (العجز / الزيادة):</span>
              <span className="font-mono dir-ltr" dir="ltr">
                {Math.abs(cashDifference) < 0.01 
                  ? '0.00 (متطابق تماماً ✓)' 
                  : cashDifference < 0 
                    ? `عجز: ${Math.abs(cashDifference).toFixed(2)} -` 
                    : `زيادة: +${cashDifference.toFixed(2)}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* قسم تصفير الوردية والترحيل للخزينة الرئيسية */}
      {transferredAmount !== undefined && transferredAmount > 0 && (
        <div className="my-3 p-2.5 bg-emerald-50 border border-emerald-400 rounded-lg text-xs text-emerald-900 text-center font-bold">
          <div>🔄 تم تصفير رصيد الوردية وترحيله بالكامل</div>
          <div className="text-sm font-black font-mono mt-0.5">
            {transferredAmount.toFixed(2)} {settings.currency} ⬅️ {mainTreasuryName || 'الخزينة الرئيسية'}
          </div>
        </div>
      )}

      {/* توقيعات التسليم والتسلم */}
      <div className="grid grid-cols-2 gap-2 mt-5 pt-3 border-t border-black border-dashed text-[11px] text-center">
        <div>
          <p className="font-bold">مسلّم الوردية</p>
          <p className="text-[10px] text-gray-600 mt-0.5">({closedByUserName || effectiveUserName})</p>
          <div className="h-7 border-b border-gray-400 mt-1"></div>
        </div>
        <div>
          <p className="font-bold">مستلم الوردية</p>
          <p className="text-[10px] text-gray-600 mt-0.5">(الكاشير المستلم)</p>
          <div className="h-7 border-b border-gray-400 mt-1"></div>
        </div>
      </div>

      <div className="text-center mt-6 text-xs border-t border-black pt-2">
        <p>تم استخراج التقرير من النظام</p>
        <p>{new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}

