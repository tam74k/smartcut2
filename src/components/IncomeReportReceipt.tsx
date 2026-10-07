import React, { useMemo } from 'react';
import { AppSettings, Transaction, Booking, Invoice } from '../types';

export function IncomeReportReceipt({
  settings,
  transactions,
  bookings = [],
  invoices = [],
  startDate,
  endDate,
  dateLabel,
  userName
}: {
  settings: AppSettings,
  transactions: Transaction[],
  bookings?: Booking[],
  invoices?: Invoice[],
  startDate: string,
  endDate: string,
  dateLabel: string,
  userName?: string
}) {
  const effectiveUserName = userName || settings.ownerName || 'المسؤول';
  const treasuries = settings.treasuries || [];

  const hasCashTreasury = useMemo(() => treasuries.some(t => t.id === 'cash'), [treasuries]);
  const hasMainTreasury = useMemo(() => treasuries.some(t => t.id === 'main' || t.isMain), [treasuries]);

  const isMatchingTreasury = (tId: string | undefined, targetId: string) => {
    // 1. Direct match
    if (tId && tId === targetId) return true;

    // 2. Handling undefined / empty treasury ID
    if (!tId) {
      if (hasCashTreasury) {
        return targetId === 'cash';
      }
      if (hasMainTreasury) {
        const mainObj = treasuries.find(t => t.id === targetId && (t.isMain || t.id === 'main'));
        return Boolean(mainObj);
      }
      return targetId === treasuries[0]?.id;
    }

    // 3. Normalized cash aliases
    if (tId === 'cash' || tId === 'نقدي' || tId === 'كاش') {
      if (targetId === 'cash') return true;
      if (!hasCashTreasury && (targetId === 'main' || treasuries.find(t => t.id === targetId)?.isMain)) {
        return true;
      }
      return false;
    }

    // 4. Normalized main treasury aliases
    if (tId === 'main' || tId === 'الرئيسية' || tId === 'الخزنة الرئيسية') {
      if (targetId === 'main') return true;
      const targetObj = treasuries.find(t => t.id === targetId);
      if (targetObj?.isMain && !hasCashTreasury) return true;
      return Boolean(targetObj?.isMain && targetId !== 'cash');
    }

    // 5. Normalized card aliases
    if (targetId === 'card') {
      return tId === 'card' || tId === 'mada' || tId === 'visa' || tId === 'mastercard' || tId === 'شبكة' || tId === 'شبكة / مدى';
    }

    // 6. Normalized bank transfer aliases
    if (targetId === 'bank_transfer' || targetId === 'transfer') {
      return tId === 'bank_transfer' || tId === 'transfer' || tId === 'bank' || tId === 'تحويل بنكي';
    }

    return false;
  };

  const isBookingAdvanceTrx = (t: Transaction) => {
    if (t.type !== 'in') return false;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    if (cat === 'booking_advance' || cat === 'مقدم حجز' || cat === 'عربون حجز' || cat === 'عربون' || cat === 'مقدم') return true;
    if (cat === 'advance' && !desc.includes('سلف')) return true;
    if (desc.includes('عربون') || desc.includes('مقدم حجز') || desc.includes('دفعة مقدمة')) return true;
    return false;
  };

  const isSalesTrx = (t: Transaction) => {
    if (t.type !== 'in') return false;
    if (isBookingAdvanceTrx(t)) return false;
    const cat = (t.category || '').toLowerCase();
    return cat === 'sales' || cat === 'مبيعات' || Boolean((t as any).invoiceId);
  };

  const isStaffAdvance = (t: Transaction) => {
    const isOut = t.type === 'out' || (t.type as string) === 'expense';
    if (!isOut) return false;
    const cat = (t.category || '').toLowerCase();
    const expCat = ((t as any).expenseCategory || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return (
      cat === 'staff_advance' ||
      cat === 'hr_advance' ||
      cat === 'advance' ||
      cat.includes('سلف') ||
      expCat.includes('سلف') ||
      desc.includes('سلفة') ||
      desc.includes('سلف')
    );
  };

  const isPurchase = (t: Transaction) => {
    if (t.type !== 'out' && (t.type as string) === 'expense') return false;
    const cat = (t.category || '').toLowerCase();
    return cat === 'purchase' || cat === 'مشتريات' || cat === 'supplier_payment' || cat === 'supplier' || cat === 'سداد مورد';
  };

  const isCommission = (t: Transaction) => {
    if (t.type !== 'out' && (t.type as string) === 'expense') return false;
    const cat = (t.category || '').toLowerCase();
    return cat === 'commission' || cat === 'commission_payout' || cat === 'عمولة';
  };

  const isSalary = (t: Transaction) => {
    if (t.type !== 'out' && (t.type as string) === 'expense') return false;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return cat === 'salary' || cat === 'رواتب' || cat === 'راتب' || desc.includes('مسير رواتب');
  };

  const isExpense = (t: Transaction) => {
    if (t.type !== 'out' && (t.type as string) === 'expense') return false;
    if (isStaffAdvance(t) || isPurchase(t) || isCommission(t) || isSalary(t)) return false;
    const cat = (t.category || '').toLowerCase();
    if (cat === 'transfer' || (t.description && t.description.includes('تحويل'))) return false;
    return cat === 'expense' || cat === 'مصروفات' || cat.includes('مصروف') || Boolean((t as any).expenseCategory);
  };

  const { rows, totals } = useMemo(() => {
    const dates: string[] = [];
    const [sy, sm, sd] = startDate.split('-');
    let curr = new Date(Number(sy), Number(sm) - 1, Number(sd));
    const [ey, em, ed] = endDate.split('-');
    const endObj = new Date(Number(ey), Number(em) - 1, Number(ed));
    while (curr <= endObj) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
    }

    const rowsData = dates.map(dateStr => {
      const dayTrxs = transactions.filter(t => {
        const d = (t.date || '').split('T')[0];
        const sDate = (t.shiftDate || (t as any).shift_date || '').split('T')[0];
        return d === dateStr || sDate === dateStr;
      });

      // 1. استخراج مقدمات وعربون الحجز المسجلة في جدول الحجوزات وغير المسجلة كمعاملة
      const dayUnrecordedAdvances: { amount: number; treasuryId: string }[] = [];
      if (bookings && Array.isArray(bookings)) {
        bookings.forEach(b => {
          if (b.status === 'cancelled') return;
          const advances = (b.advancePayments && Array.isArray(b.advancePayments))
            ? b.advancePayments
            : (typeof (b as any).advance_payments === 'string'
              ? (() => { try { return JSON.parse((b as any).advance_payments); } catch { return []; } })()
              : []);

          advances.forEach((adv: any) => {
            const advDate = (adv.date || (b as any).createdAt || (b as any).created_at || b.date || '').split('T')[0].trim();
            if (advDate === dateStr) {
              const amt = Number(adv.amount) || 0;
              if (amt <= 0) return;
              const already = dayTrxs.some(t => {
                if (!isBookingAdvanceTrx(t)) return false;
                if (Math.abs((Number(t.amount) || 0) - amt) >= 0.01) return false;
                if (adv.id && t.id && (t.id === adv.id || t.id.includes(adv.id))) return true;
                const tBookingId = (t.bookingId || (t as any).booking_id || '').trim();
                if (tBookingId && (tBookingId === b.id || (b.bookingCode && tBookingId === b.bookingCode))) return true;
                const desc = (t.description || '').trim();
                if (desc) {
                  if (b.bookingCode && b.bookingCode.trim().length >= 2 && desc.includes(b.bookingCode.trim())) return true;
                  if (b.id && b.id.trim().length >= 4 && desc.includes(b.id.trim())) return true;
                  if (b.clientName && b.clientName.trim().length >= 3 && desc.includes(b.clientName.trim())) return true;
                }
                return false;
              });
              if (!already) {
                dayUnrecordedAdvances.push({
                  amount: amt,
                  treasuryId: adv.treasuryId || adv.paymentMethod || 'cash'
                });
              }
            }
          });
        });
      }

      // 2. فحص مبيعات الفواتير غير المسجلة كمعاملات منفصلة
      const dayUnrecordedInvoices: { amount: number; treasuryId: string }[] = [];
      if (invoices && Array.isArray(invoices)) {
        const knownInvoiceIds = new Set(
          dayTrxs.filter(t => (t as any).invoiceId || (t as any).invoice_id).map(t => (t as any).invoiceId || (t as any).invoice_id)
        );
        invoices.forEach(inv => {
          if (inv.status === 'cancelled' || (inv as any).is_cancelled || (inv as any).isCancelled) return;
          const invDate = (inv.date || (inv as any).createdAt || '').split('T')[0].trim();
          if (invDate === dateStr && !knownInvoiceIds.has(inv.id)) {
            const methods = (inv.paymentMethods && inv.paymentMethods.length > 0)
              ? inv.paymentMethods
              : [{ amount: Number(inv.total) || 0, treasuryId: inv.treasuryId || inv.paymentMethod || 'cash' }];
            methods.forEach((m: any) => {
              if (m.treasuryId === 'cashback' || m.treasuryId === 'remedy_free') return;
              const amt = Number(m.amount) || 0;
              if (amt > 0) {
                dayUnrecordedInvoices.push({ amount: amt, treasuryId: m.treasuryId || 'cash' });
              }
            });
          }
        });
      }

      // 3. احتساب الدخل التفصيلي (مبيعات + مقدمات حجز)
      const daySalesTrx = dayTrxs.filter(isSalesTrx);
      const dayBookingAdvTrx = dayTrxs.filter(isBookingAdvanceTrx);

      let daySalesTotal = 0;
      let dayBookingAdvTotal = 0;

      const incomeSplits = treasuries.map(t => {
        const trxSales = daySalesTrx.filter(x => isMatchingTreasury(x.treasury, t.id)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
        const unrecSales = dayUnrecordedInvoices.filter(x => isMatchingTreasury(x.treasuryId, t.id)).reduce((s, x) => s + x.amount, 0);
        const totalSalesInTreasury = trxSales + unrecSales;

        const trxAdv = dayBookingAdvTrx.filter(x => isMatchingTreasury(x.treasury, t.id)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
        const unrecAdv = dayUnrecordedAdvances.filter(x => isMatchingTreasury(x.treasuryId, t.id)).reduce((s, x) => s + x.amount, 0);
        const totalAdvInTreasury = trxAdv + unrecAdv;

        daySalesTotal += totalSalesInTreasury;
        dayBookingAdvTotal += totalAdvInTreasury;

        return totalSalesInTreasury + totalAdvInTreasury;
      });

      const incomeTotal = daySalesTotal + dayBookingAdvTotal;

      // 4. باقي البنود
      const expensesSplits = treasuries.map(t => dayTrxs.filter(x => isExpense(x) && isMatchingTreasury(x.treasury, t.id)).reduce((s, x) => s + (Number(x.amount) || 0), 0));
      const expensesTotal = expensesSplits.reduce((s, a) => s + a, 0);

      const advancesSplits = treasuries.map(t => dayTrxs.filter(x => isStaffAdvance(x) && isMatchingTreasury(x.treasury, t.id)).reduce((s, x) => s + (Number(x.amount) || 0), 0));
      const advancesTotal = advancesSplits.reduce((s, a) => s + a, 0);

      const purchasesSplits = treasuries.map(t => dayTrxs.filter(x => isPurchase(x) && isMatchingTreasury(x.treasury, t.id)).reduce((s, x) => s + (Number(x.amount) || 0), 0));
      const purchasesTotal = purchasesSplits.reduce((s, a) => s + a, 0);

      const commissionsSplits = treasuries.map(t => dayTrxs.filter(x => isCommission(x) && isMatchingTreasury(x.treasury, t.id)).reduce((s, x) => s + (Number(x.amount) || 0), 0));
      const commissionsTotal = commissionsSplits.reduce((s, a) => s + a, 0);

      const salariesSplits = treasuries.map(t => dayTrxs.filter(x => isSalary(x) && isMatchingTreasury(x.treasury, t.id)).reduce((s, x) => s + (Number(x.amount) || 0), 0));
      const salariesTotal = salariesSplits.reduce((s, a) => s + a, 0);

      const net = incomeTotal - (expensesTotal + advancesTotal + purchasesTotal + commissionsTotal + salariesTotal);

      return {
        date: dateStr,
        salesTotal: daySalesTotal,
        bookingAdvancesTotal: dayBookingAdvTotal,
        incomeTotal,
        incomeSplits,
        expensesTotal,
        expensesSplits,
        advancesTotal,
        advancesSplits,
        purchasesTotal,
        purchasesSplits,
        commissionsTotal,
        commissionsSplits,
        salariesTotal,
        salariesSplits,
        net
      };
    });

    const totalsObj = {
      totalSales: 0,
      totalBookingAdvances: 0,
      incomeTotal: 0,
      incomeSplits: new Array(treasuries.length).fill(0),
      expensesTotal: 0,
      expensesSplits: new Array(treasuries.length).fill(0),
      advancesTotal: 0,
      advancesSplits: new Array(treasuries.length).fill(0),
      purchasesTotal: 0,
      purchasesSplits: new Array(treasuries.length).fill(0),
      commissionsTotal: 0,
      commissionsSplits: new Array(treasuries.length).fill(0),
      salariesTotal: 0,
      salariesSplits: new Array(treasuries.length).fill(0),
      net: 0
    };

    rowsData.forEach(r => {
      totalsObj.totalSales += r.salesTotal;
      totalsObj.totalBookingAdvances += r.bookingAdvancesTotal;
      totalsObj.incomeTotal += r.incomeTotal;
      totalsObj.expensesTotal += r.expensesTotal;
      totalsObj.advancesTotal += r.advancesTotal;
      totalsObj.purchasesTotal += r.purchasesTotal;
      totalsObj.commissionsTotal += r.commissionsTotal;
      totalsObj.salariesTotal += r.salariesTotal;
      totalsObj.net += r.net;
      
      treasuries.forEach((_, i) => {
        totalsObj.incomeSplits[i] += r.incomeSplits[i];
        totalsObj.expensesSplits[i] += r.expensesSplits[i];
        totalsObj.advancesSplits[i] += r.advancesSplits[i];
        totalsObj.purchasesSplits[i] += r.purchasesSplits[i];
        totalsObj.commissionsSplits[i] += r.commissionsSplits[i];
        totalsObj.salariesSplits[i] += r.salariesSplits[i];
      });
    });

    return { rows: rowsData, totals: totalsObj };
  }, [transactions, bookings, invoices, startDate, endDate, treasuries]);

  const tCount = treasuries.length;

  return (
    <div className="w-max min-w-full mx-auto bg-white text-black p-4 text-[9px] font-sans print:w-[297mm] print:min-w-0 print:p-0" id="print-income-receipt" style={{ direction: 'rtl' }}>
      <div className="text-center border-b border-black pb-2 mb-3">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 mx-auto mb-1 object-contain grayscale" />
        )}
        <h2 className="text-lg font-bold mb-1">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-lg font-bold">تقرير الدخل</h1>
        <p className="text-[10px] mt-1">تاريخ: {dateLabel}</p>
        <p className="text-[10px]">المستخدم: {effectiveUserName}</p>
      </div>

      {/* ملخص يوضح اشتمال الدخل على المبيعات ومقدمات الحجز */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg mb-3 text-[10px] font-bold text-emerald-950">
        <div>🛍️ مبيعات الفواتير: <span className="font-mono font-black text-emerald-800">{totals.totalSales.toFixed(2)} {settings.currency}</span></div>
        <div>📅 مقدمات وعربون الحجز: <span className="font-mono font-black text-teal-700">+{totals.totalBookingAdvances.toFixed(2)} {settings.currency}</span></div>
        <div className="bg-emerald-600 text-white px-2.5 py-1 rounded">💰 إجمالي الدخل المحصل: <span className="font-mono font-black">{totals.incomeTotal.toFixed(2)} {settings.currency}</span></div>
      </div>

      <div className="mb-2 overflow-x-auto">
        <table className="w-full text-center border-collapse border border-black text-[8px] whitespace-nowrap">
          <thead>
            <tr>
              <th className="border border-black p-1" rowSpan={2}>التاريخ</th>
              
              <th className="border border-black p-1 bg-green-50" colSpan={tCount + 1}>الدخل (مبيعات + مقدمات حجز)</th>
              <th className="border border-black p-1 bg-red-50" colSpan={tCount + 1}>المصروفات</th>
              <th className="border border-black p-1 bg-red-50" colSpan={tCount + 1}>السلف</th>
              <th className="border border-black p-1 bg-red-50" colSpan={tCount + 1}>المشتريات</th>
              <th className="border border-black p-1 bg-red-50" colSpan={tCount + 1}>العمولات</th>
              <th className="border border-black p-1 bg-red-50" colSpan={tCount + 1}>الرواتب</th>
              
              <th className="border border-black p-1 bg-blue-50" rowSpan={2}>الصافي</th>
            </tr>
            <tr>
              {/* Income */}
              <th className="border border-black p-0.5 bg-green-50 font-bold">إجمالي</th>
              {treasuries.map(t => <th key={t.id} className="border border-black p-0.5 bg-green-50/50">{t.name}</th>)}
              {/* Expenses */}
              <th className="border border-black p-0.5 bg-red-50 font-bold">إجمالي</th>
              {treasuries.map(t => <th key={t.id} className="border border-black p-0.5 bg-red-50/50">{t.name}</th>)}
              {/* Advances */}
              <th className="border border-black p-0.5 bg-red-50 font-bold">إجمالي</th>
              {treasuries.map(t => <th key={t.id} className="border border-black p-0.5 bg-red-50/50">{t.name}</th>)}
              {/* Purchases */}
              <th className="border border-black p-0.5 bg-red-50 font-bold">إجمالي</th>
              {treasuries.map(t => <th key={t.id} className="border border-black p-0.5 bg-red-50/50">{t.name}</th>)}
              {/* Commissions */}
              <th className="border border-black p-0.5 bg-red-50 font-bold">إجمالي</th>
              {treasuries.map(t => <th key={t.id} className="border border-black p-0.5 bg-red-50/50">{t.name}</th>)}
              {/* Salaries */}
              <th className="border border-black p-0.5 bg-red-50 font-bold">إجمالي</th>
              {treasuries.map(t => <th key={t.id} className="border border-black p-0.5 bg-red-50/50">{t.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.date}>
                <td className="border border-black p-1">{new Date(r.date).toLocaleDateString('ar-SA')}</td>
                
                <td className="border border-black p-1 bg-green-50 font-bold">{r.incomeTotal.toFixed(1)}</td>
                {r.incomeSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}
                
                <td className="border border-black p-1 bg-red-50 font-bold">{r.expensesTotal.toFixed(1)}</td>
                {r.expensesSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

                <td className="border border-black p-1 bg-red-50 font-bold">{r.advancesTotal.toFixed(1)}</td>
                {r.advancesSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

                <td className="border border-black p-1 bg-red-50 font-bold">{r.purchasesTotal.toFixed(1)}</td>
                {r.purchasesSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

                <td className="border border-black p-1 bg-red-50 font-bold">{r.commissionsTotal.toFixed(1)}</td>
                {r.commissionsSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

                <td className="border border-black p-1 bg-red-50 font-bold">{r.salariesTotal.toFixed(1)}</td>
                {r.salariesSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

                <td className="border border-black p-1 bg-blue-50 font-bold" dir="ltr">{r.net.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-slate-100">
              <td className="border border-black p-1">المجموع</td>
              
              <td className="border border-black p-1 bg-green-100">{totals.incomeTotal.toFixed(1)}</td>
              {totals.incomeSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

              <td className="border border-black p-1 bg-red-100">{totals.expensesTotal.toFixed(1)}</td>
              {totals.expensesSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

              <td className="border border-black p-1 bg-red-100">{totals.advancesTotal.toFixed(1)}</td>
              {totals.advancesSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

              <td className="border border-black p-1 bg-red-100">{totals.purchasesTotal.toFixed(1)}</td>
              {totals.purchasesSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

              <td className="border border-black p-1 bg-red-100">{totals.commissionsTotal.toFixed(1)}</td>
              {totals.commissionsSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

              <td className="border border-black p-1 bg-red-100">{totals.salariesTotal.toFixed(1)}</td>
              {totals.salariesSplits.map((val, i) => <td key={i} className="border border-black p-1">{val.toFixed(1)}</td>)}

              <td className="border border-black p-1 bg-blue-100" dir="ltr">{totals.net.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="text-center mt-4 text-[8px] border-t border-black pt-1">
        <p>تم استخراج التقرير من النظام - {new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}
