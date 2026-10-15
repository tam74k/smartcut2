import React, { useMemo } from 'react';
import { AppSettings, Transaction, Invoice, Treasury, Employee, FingerprintLog } from '../types';
import { calculateFingerprintProcessedDate } from '../services/db';

function extractDatesFromLabel(label: string): string[] {
  const matches = label.match(/\d{4}-\d{2}-\d{2}/g);
  if (!matches || matches.length === 0) return [new Date().toISOString().split('T')[0]];
  if (matches.length === 1) return [matches[0]];
  const dStart = new Date(matches[0]);
  const dEnd = new Date(matches[1]);
  const dates: string[] = [];
  const curr = new Date(dStart);
  while (curr <= dEnd && dates.length < 62) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates.length > 0 ? dates : [matches[0]];
}

export function ClosingReportReceipt({
  settings,
  transactions,
  invoices,
  dateLabel,
  initialCash = 0,
  userName,
  shiftCode,
  fingerprintLogs = [],
  employees = [],
  attendanceSummary
}: {
  settings: AppSettings,
  transactions: Transaction[],
  invoices: Invoice[],
  dateLabel: string,
  initialCash?: number,
  userName?: string,
  shiftCode?: string,
  fingerprintLogs?: FingerprintLog[],
  employees?: Employee[],
  attendanceSummary?: {
    presentStaffCount: number;
    totalWorkedMinutes: number;
    totalDelayMinutes: number;
    totalOvertimeMinutes: number;
  }
}) {
  const effectiveUserName = userName || settings.ownerName || 'المسؤول';

  // Attendance & Biometric Summary Calculation
  const attendanceStats = useMemo(() => {
    if (attendanceSummary) {
      const wh = Math.floor(attendanceSummary.totalWorkedMinutes / 60);
      const wm = attendanceSummary.totalWorkedMinutes % 60;
      const oh = Math.floor(attendanceSummary.totalOvertimeMinutes / 60);
      const om = attendanceSummary.totalOvertimeMinutes % 60;
      return {
        presentStaffCount: attendanceSummary.presentStaffCount,
        totalWorkedMinutes: attendanceSummary.totalWorkedMinutes,
        workedHoursStr: `${wh} ساعة ${wm > 0 ? `و ${wm} د` : ''}`,
        totalDelayMinutes: attendanceSummary.totalDelayMinutes,
        totalOvertimeMinutes: attendanceSummary.totalOvertimeMinutes,
        overtimeHoursStr: `${oh} ساعة ${om > 0 ? `و ${om} د` : ''}`
      };
    }

    let allEmployees: Employee[] = employees && employees.length > 0 ? employees : [];
    if (allEmployees.length === 0) {
      try {
        const savedEmp = localStorage.getItem('smartcut_employees');
        if (savedEmp) allEmployees = JSON.parse(savedEmp);
      } catch {}
    }

    let allLogs: FingerprintLog[] = fingerprintLogs && fingerprintLogs.length > 0 ? fingerprintLogs : [];
    if (allLogs.length === 0) {
      try {
        const savedLogs = localStorage.getItem('smartcut_fingerprint_logs');
        if (savedLogs) allLogs = JSON.parse(savedLogs);
      } catch {}
    }

    if (allEmployees.length === 0 || allLogs.length === 0) {
      return null;
    }

    const targetDates = extractDatesFromLabel(dateLabel);
    const presentEmpIds = new Set<string>();
    let totalWorkedMinutes = 0;
    let totalDelayMinutes = 0;
    let totalOvertimeMinutes = 0;

    targetDates.forEach(dateStr => {
      allEmployees.forEach(emp => {
        const dayLogs = allLogs.filter(l => {
          const isEmp = l.employeeId === emp.id || (emp.fingerprintCode && (l.fingerprintCode === emp.fingerprintCode || (l as any).fingerprint_code === emp.fingerprintCode));
          if (!isEmp) return false;
          const pDate = (l as any).processedDate || calculateFingerprintProcessedDate(l.timestamp, l.type);
          return pDate === dateStr || (l.timestamp && l.timestamp.startsWith(dateStr));
        }).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        if (dayLogs.length === 0) return;

        presentEmpIds.add(emp.id);

        const checkInLogs = dayLogs.filter(l => l.type === 'check_in');
        const checkOutLogs = dayLogs.filter(l => l.type === 'check_out');

        const inLog = checkInLogs[0] || dayLogs[0];
        const outLog = checkOutLogs[checkOutLogs.length - 1] || (dayLogs.length > 1 ? dayLogs[dayLogs.length - 1] : null);

        const schedIn = (emp as any).shiftSchedule?.checkInTime || (emp as any).checkInTime || '09:00';
        const schedOut = (emp as any).shiftSchedule?.checkOutTime || (emp as any).checkOutTime || '17:00';

        const schedInParts = schedIn.split(':').map(Number);
        const schedInMin = (schedInParts[0] || 9) * 60 + (schedInParts[1] || 0);

        const schedOutParts = schedOut.split(':').map(Number);
        let schedOutMin = (schedOutParts[0] || 17) * 60 + (schedOutParts[1] || 0);
        if (schedOutMin <= schedInMin) schedOutMin += 1440;

        let actualInMin = schedInMin;
        if (inLog && inLog.timestamp) {
          const t = inLog.timestamp.includes('T') ? inLog.timestamp.split('T')[1] : inLog.timestamp.split(' ')[1] || '';
          if (t) {
            const p = t.split(':').map(Number);
            actualInMin = (p[0] || 0) * 60 + (p[1] || 0);
          }
        }

        if (actualInMin > schedInMin + 15) {
          totalDelayMinutes += (actualInMin - schedInMin);
        }

        if (outLog && outLog.timestamp && outLog !== inLog) {
          const t = outLog.timestamp.includes('T') ? outLog.timestamp.split('T')[1] : outLog.timestamp.split(' ')[1] || '';
          if (t) {
            const p = t.split(':').map(Number);
            let actualOutMin = (p[0] || 0) * 60 + (p[1] || 0);
            if (actualOutMin <= actualInMin) actualOutMin += 1440;

            const worked = Math.max(0, actualOutMin - actualInMin);
            totalWorkedMinutes += worked;

            if (actualOutMin > schedOutMin + 30) {
              totalOvertimeMinutes += (actualOutMin - schedOutMin);
            }
          }
        } else {
          totalWorkedMinutes += 480;
        }
      });
    });

    if (presentEmpIds.size === 0) return null;

    const wh = Math.floor(totalWorkedMinutes / 60);
    const wm = totalWorkedMinutes % 60;
    const oh = Math.floor(totalOvertimeMinutes / 60);
    const om = totalOvertimeMinutes % 60;

    return {
      presentStaffCount: presentEmpIds.size,
      totalWorkedMinutes,
      workedHoursStr: `${wh} ساعة ${wm > 0 ? `و ${wm} د` : ''}`,
      totalDelayMinutes,
      totalOvertimeMinutes,
      overtimeHoursStr: `${oh} ساعة ${om > 0 ? `و ${om} د` : ''}`
    };
  }, [dateLabel, employees, fingerprintLogs, attendanceSummary]);
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

    const isTipTrx = (t: any) => {
      const cat = (t.category || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const id = (t.id || '').toLowerCase();
      return (
        id.startsWith('trx-tip') ||
        cat === 'صرف بقشيش فوري' ||
        cat === 'صرف بقشيش موظفين' ||
        cat === 'صرف بقشيش' ||
        cat === 'بقشيش' ||
        cat === 'إكرامية' ||
        cat === 'إكراميات' ||
        cat === 'tip' ||
        cat === 'tips' ||
        cat === 'tip_payout' ||
        desc.includes('بقشيش') ||
        desc.includes('إكرام')
      );
    };

    const tips = tTrx.filter(t => t.type === 'out' && isTipTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const expenses = tTrx.filter(t => t.type === 'out' && !isTipTrx(t) && (t.category === 'expense' || t.category === 'مصروفات')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const salaries = tTrx.filter(t => t.type === 'out' && (t.category === 'salary' || t.category === 'رواتب')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const advances = tTrx.filter(t => t.type === 'out' && (t.category === 'hr_advance' || t.category === 'staff_advance' || t.category === 'advance' || t.category === 'سلف')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const purchases = tTrx.filter(t => t.type === 'out' && (t.category === 'purchase' || t.category === 'مشتريات')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const supplierPayments = tTrx.filter(t => t.type === 'out' && (t.category === 'supplier_payment' || t.category === 'supplier' || t.category === 'سداد مورد')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const commissions = tTrx.filter(t => t.type === 'out' && (
      t.category === 'commission' || 
      t.category === 'commissions' || 
      t.category === 'commission_payout' || 
      t.category === 'عمولة' || 
      t.category === 'عمولات' || 
      t.category === 'صرف عمولة' ||
      (t.description && (t.description.includes('صرف عمولة') || t.description.includes('عمولة فورية')))
    )).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    const transfersIn = tTrx.filter(t => t.type === 'in' && t.category === 'transfer').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const transfersOut = tTrx.filter(t => t.type === 'out' && t.category === 'transfer').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const withdrawals = tTrx.filter(t => t.type === 'out' && (t.category === 'withdrawal' || t.category === 'سحب')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const deposits = tTrx.filter(t => t.type === 'in' && (t.category === 'deposit' || t.category === 'إيداع')).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const initialCashSum = tTrx.filter(t => t.type === 'in' && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash')).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const net = (income + transfersIn + deposits + initialCashSum) - (expenses + salaries + advances + purchases + supplierPayments + commissions + tips + transfersOut + withdrawals);

    return {
      income, expenses, salaries, advances, purchases, supplierPayments, commissions, tips, transfersIn, transfersOut, withdrawals, deposits, initialCashSum, net
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
        {shiftCode && (
          <p className="text-xs font-bold font-mono text-black mt-0.5">كود الوردية: {shiftCode}</p>
        )}
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
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
          <span>المحصل الفعلي بالخزائن (كاش / شبكة):</span>
          <span>{(invoices.reduce((sum, inv) => sum + inv.total, 0) - invoices.reduce((sum, inv) => sum + (inv.cashbackUsed || 0), 0)).toFixed(2)}</span>
        </div>
        {initialCash > 0 && (
          <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold">
            <span>العهدة الافتتاحية:</span>
            <span>{initialCash}</span>
          </div>
        )}
      </div>

      {attendanceStats && (
        <div className="mb-4 border-b border-black border-dashed pb-3">
          <div className="font-bold text-center border-b border-black border-dashed pb-1 mb-2 bg-gray-100">
            ملخص حضور وبصمة الوردية
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>الموظفون الحاضرون:</span>
              <span className="font-bold">{attendanceStats.presentStaffCount} موظف</span>
            </div>
            <div className="flex justify-between">
              <span>إجمالي ساعات العمل:</span>
              <span className="font-mono font-bold">{attendanceStats.workedHoursStr}</span>
            </div>
            <div className="flex justify-between">
              <span>إجمالي دقائق التأخير:</span>
              <span className={`font-mono font-bold ${attendanceStats.totalDelayMinutes > 0 ? 'text-red-700' : ''}`}>
                {attendanceStats.totalDelayMinutes} دقيقة
              </span>
            </div>
            <div className="flex justify-between">
              <span>ساعات العمل الإضافي:</span>
              <span className="font-mono font-bold text-emerald-700">{attendanceStats.overtimeHoursStr}</span>
            </div>
          </div>
        </div>
      )}

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
              {stats.tips > 0 && (
                <div className="flex justify-between text-gray-700"><span>إكراميات وبقشيش (الدرج):</span><span>{stats.tips.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-gray-700"><span>مبالغ السحب (بدون تحويل):</span><span>{stats.withdrawals.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-700"><span>مبالغ السحب بالتحويل:</span><span>{stats.transfersOut.toFixed(2)}</span></div>
              
              <div className="flex justify-between font-bold border-t border-black border-dashed pt-1 mt-1 text-sm">
                <span>الصافي:</span>
                <span dir="ltr">{stats.net.toFixed(2)}</span>
              </div>
              {!treasury.isMain && stats.net > 0 && (
                <div className="text-[10px] text-emerald-800 bg-emerald-50 rounded p-1 mt-1 text-center font-bold">
                  سيتم تصفير هذا الصافي ونقله تلقائياً إلى الخزينة الرئيسية
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
