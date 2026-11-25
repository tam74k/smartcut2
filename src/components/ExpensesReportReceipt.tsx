import React from 'react';
import { AppSettings, Transaction } from '../types';

export function ExpensesReportReceipt({
  settings,
  transactions,
  dateLabel,
  userName
}: {
  settings: AppSettings,
  transactions: Transaction[],
  dateLabel: string,
  userName?: string
}) {
  const effectiveUserName = userName || settings.ownerName || 'المسؤول';

  const isStaffAdvance = (t: Transaction) => {
    const cat = String(t.category || '').toLowerCase();
    const expCat = String((t as any).expenseCategory || (t as any).expense_category || '').toLowerCase();
    const desc = String(t.description || '').toLowerCase();
    const id = String(t.id || '').toLowerCase();
    return (
      id.startsWith('trx-adv') ||
      cat === 'staff_advance' ||
      cat === 'hr_advance' ||
      cat === 'advance' ||
      cat === 'سلفة موظف' ||
      cat.includes('سلف') ||
      expCat.includes('سلف') ||
      desc.includes('سلفة') ||
      desc.includes('سلف')
    );
  };

  const isSalary = (t: Transaction) => {
    if (isStaffAdvance(t)) return false;
    const cat = String(t.category || '').toLowerCase();
    const expCat = String((t as any).expenseCategory || (t as any).expense_category || '').toLowerCase();
    const desc = String(t.description || '').toLowerCase();
    const id = String(t.id || '').toLowerCase();
    return (
      id.startsWith('trx-sal-') ||
      cat === 'salaries' ||
      cat === 'salary' ||
      cat === 'رواتب' ||
      cat === 'راتب' ||
      cat.includes('رواتب') ||
      expCat.includes('رواتب') ||
      expCat.includes('راتب') ||
      desc.includes('صرف راتب') ||
      desc.includes('مسير رواتب')
    );
  };

  // حصر المصروفات التشغيلية فقط واستبعاد السلف والرواتب والمبيعات والتحويلات
  const expenseTransactions = transactions.filter(t => {
    if (t.type === 'in') return false;
    const isOut = t.type === 'out' || (t.type as string) === 'expense';
    if (!isOut) return false;
    if (isStaffAdvance(t)) return false;
    if (isSalary(t)) return false;
    const cat = String(t.category || '').toLowerCase();
    const expCat = String((t as any).expenseCategory || (t as any).expense_category || '').toLowerCase();
    const desc = String(t.description || '').toLowerCase();
    if (cat === 'sales' || cat === 'مبيعات' || expCat === 'sales' || expCat === 'مبيعات') return false;
    if (cat === 'booking_advance' || cat === 'مقدم حجز' || expCat === 'booking_advance' || expCat === 'مقدم حجز') return false;
    if (cat === 'transfer' || cat.includes('تحويل') || desc.includes('تحويل') || desc.includes('تصفير')) return false;
    return true;
  });

  let overallTotal = 0;
  expenseTransactions.forEach(t => {
    overallTotal += t.amount;
  });

  const getDisplayCategory = (t: Transaction) => {
    if (t.category === 'expense' && (t.expenseCategory || (t as any).expense_category)) return (t.expenseCategory || (t as any).expense_category);
    switch (t.category) {
      case 'expense': return 'مصروفات';
      case 'purchase': return 'مشتريات';
      default: return t.expenseCategory || (t as any).expense_category || t.category;
    }
  };

  const getTreasuryName = (id: string) => {
    return settings.treasuries.find(t => t.id === id)?.name || id;
  };

  return (
    <div className="w-[72mm] mx-auto bg-white text-black p-4 text-sm font-sans" id="print-expenses-receipt" style={{ direction: 'rtl' }}>
      <div className="text-center border-b border-black pb-4 mb-4">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 mx-auto mb-2 object-contain grayscale" />
        )}
        <h2 className="text-xl font-bold mb-2">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-xl font-bold">تقرير المصروفات</h1>
        <p className="text-xs mt-1">تاريخ: {dateLabel}</p>
        <p className="text-xs">المستخدم: {effectiveUserName}</p>
      </div>

      <div className="mb-4">
        <table className="w-full text-right text-[10px]">
          <thead>
            <tr className="border-b border-black border-dashed">
              <th className="pb-1 font-bold w-1/5">التاريخ</th>
              <th className="pb-1 font-bold w-1/5">البند</th>
              <th className="pb-1 font-bold w-1/5">الخزينة</th>
              <th className="pb-1 font-bold w-1/5">البيان</th>
              <th className="pb-1 font-bold w-1/5 text-left">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {expenseTransactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs">لا توجد مصروفات</td>
              </tr>
            ) : (
              expenseTransactions.map(t => (
                <tr key={t.id} className="border-b border-slate-200">
                  <td className="py-2">{new Date(t.date).toLocaleDateString('ar-SA')}</td>
                  <td className="py-2">{getDisplayCategory(t)}</td>
                  <td className="py-2">{getTreasuryName(t.treasury)}</td>
                  <td className="py-2">{t.description || '-'}</td>
                  <td className="py-2 text-left font-bold">{t.amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="border-t border-black border-dashed pt-2 mb-6">
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>إجمالي المصروفات:</span>
          <span dir="ltr">{overallTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center mt-6 text-xs border-t border-black pt-2">
        <p>تم استخراج التقرير من النظام</p>
        <p>{new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}
