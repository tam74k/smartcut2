import React, { useMemo } from 'react';
import { AppSettings, Transaction } from '../types';

export function IncomeReportReceipt({
  settings,
  transactions,
  startDate,
  endDate,
  dateLabel,
  userName = 'أحمد محمد'
}: {
  settings: AppSettings,
  transactions: Transaction[],
  startDate: string,
  endDate: string,
  dateLabel: string,
  userName?: string
}) {
  const treasuries = settings.treasuries;

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
      const dayTrxs = transactions.filter(t => t.date.startsWith(dateStr));
      
      const getSum = (cat: string | string[], tId?: string) => {
        const cats = Array.isArray(cat) ? cat : [cat];
        return dayTrxs.filter(t => cats.includes(t.category) && (!tId || t.treasury === tId)).reduce((sum, t) => sum + t.amount, 0);
      };

      const incomeTotal = getSum('sales');
      const expensesTotal = getSum('expense');
      const advancesTotal = getSum(['staff_advance', 'hr_advance']);
      const purchasesTotal = getSum('purchase');
      const commissionsTotal = getSum('commission');
      const salariesTotal = getSum('salary');

      const incomeSplits = treasuries.map(t => getSum('sales', t.id));
      const expensesSplits = treasuries.map(t => getSum('expense', t.id));
      const advancesSplits = treasuries.map(t => getSum(['staff_advance', 'hr_advance'], t.id));
      const purchasesSplits = treasuries.map(t => getSum('purchase', t.id));
      const commissionsSplits = treasuries.map(t => getSum('commission', t.id));
      const salariesSplits = treasuries.map(t => getSum('salary', t.id));

      const net = incomeTotal - (expensesTotal + advancesTotal + purchasesTotal + commissionsTotal + salariesTotal);

      return {
        date: dateStr,
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

    // Remove rows where everything is 0? The user said "التاريخ : وهو يبدأ من تاريخ البداية حسب التحديد في الشاشة ويعطي التاريخ التالي حتى الوصول لتاريخ النهاية" - so we keep all rows.

    const totalsObj = {
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
  }, [transactions, startDate, endDate, treasuries]);

  const tCount = treasuries.length;

  return (
    <div className="w-[297mm] mx-auto bg-white text-black p-4 text-[9px] font-sans" id="print-income-receipt" style={{ direction: 'rtl' }}>
      <div className="text-center border-b border-black pb-2 mb-2">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 mx-auto mb-1 object-contain grayscale" />
        )}
        <h2 className="text-lg font-bold mb-1">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-lg font-bold">تقرير الدخل</h1>
        <p className="text-[10px] mt-1">تاريخ: {dateLabel}</p>
        <p className="text-[10px]">المستخدم: {userName}</p>
      </div>

      <div className="mb-2 overflow-hidden">
        <table className="w-full text-center border-collapse border border-black text-[8px]">
          <thead>
            <tr>
              <th className="border border-black p-1" rowSpan={2}>التاريخ</th>
              
              <th className="border border-black p-1 bg-green-50" colSpan={tCount + 1}>الدخل</th>
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
