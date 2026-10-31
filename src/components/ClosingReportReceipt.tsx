import React, { useMemo } from 'react';
import { AppSettings, Transaction, Invoice, Treasury, Employee, FingerprintLog } from '../types';
import { calculateFingerprintProcessedDate } from '../services/db';
import { resolveMainTreasury, getTransactionTargetTreasuryId, getTreasuryLabel } from '../utils/treasury';

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

export const isZeroingOrClosingTrx = (t: any): boolean => {
  if (!t) return false;
  if (t.isZeroing || t.isShiftZeroing || t.isClosing || t.subCategory === 'shift_zeroing') return true;
  const desc = String(t.description || '').toLowerCase();
  const cat = String(t.category || '').toLowerCase();
  const id = String(t.id || '').toUpperCase();
  
  if (id.startsWith('TRX-OUT-') && desc.includes('تصفير')) return true;
  if (id.startsWith('TRX-IN-') && desc.includes('تصفير')) return true;
  
  return (
    desc.includes('تصفير') ||
    desc.includes('نقل الرصيد') ||
    desc.includes('نقل رصيد') ||
    desc.includes('ترحيل رصيد') ||
    desc.includes('تحويل تصفير') ||
    desc.includes('إغلاق وردية') ||
    desc.includes('اغلاق وردية') ||
    desc.includes('إغلاق الخزائن') ||
    desc.includes('اغلاق الخزائن') ||
    cat === 'shift_zeroing' ||
    cat === 'zeroing' ||
    cat.includes('تصفير')
  );
};

export function ClosingReportReceipt({
  settings,
  reportTitle,
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
  reportTitle?: string,
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
  const effectiveTitle = reportTitle || (shiftCode ? 'تقرير الوردية المفتوحة حالياً' : 'تقرير أعمال اليوم بالكامل');

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

  const isRealTransferTrx = (t: any): boolean => {
    if (isZeroingOrClosingTrx(t)) return false;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return cat === 'transfer' || cat.includes('transfer') || cat.includes('تحويل') || desc.includes('تحويل إلى') || desc.includes('تحويل الى') || desc.includes('تحويل من');
  };

  const isCommissionTrx = (t: any): boolean => {
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return (
      cat === 'commission' || 
      cat === 'commissions' || 
      cat === 'commission_payout' || 
      cat === 'عمولة' || 
      cat === 'عمولات' || 
      cat === 'صرف عمولة' ||
      desc.includes('صرف عمولة') || 
      desc.includes('عمولة فورية')
    );
  };

  const isTipTrx = (t: any): boolean => {
    if (t.category === 'expense' || t.category === 'مصروفات' || (t.id && String(t.id).startsWith('EXP-'))) {
      return false;
    }
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

  const targetShiftCode = (shiftCode || '').trim();

  // تصفية الفواتير بدقة طبقاً لكود الوردية الحالي وليس التاريخ (إذا تم تمرير كود الوردية)
  const effectiveInvoices = useMemo(() => {
    if (!targetShiftCode) return invoices.filter(inv => inv.status !== 'cancelled');
    const matched = invoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      const invCode = (inv.shiftCode || (inv as any).shift_code || '').trim();
      const invShiftId = (inv.shiftId || (inv as any).shift_id || '').trim();
      return invCode === targetShiftCode || invShiftId === targetShiftCode;
    });
    return matched.length > 0 ? matched : invoices.filter(inv => inv.status !== 'cancelled');
  }, [invoices, targetShiftCode]);

  // تصفية الحركات المالية بدقة طبقاً لكود الوردية الحالي مع استبعاد حركات الإغلاق والتصفير نهائياً
  const effectiveTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (isZeroingOrClosingTrx(t)) return false;
      if (!targetShiftCode) return true;
      const tCode = (t.shiftCode || (t as any).shift_code || '').trim();
      const tShiftId = (t.shiftId || (t as any).shift_id || '').trim();
      const desc = String(t.description || '');
      return tCode === targetShiftCode || tShiftId === targetShiftCode || desc.includes(targetShiftCode);
    });
  }, [transactions, targetShiftCode]);

  // قائمة ديناميكية شاملة لجميع الخزائن وطرق الدفع المستخدمة لضمان عدم إغفال أي طريقة دفع (فيزا، انستاباي، فودافون كاش، الخ)
  const allReportTreasuries = useMemo(() => {
    const list = [...(settings.treasuries || [])];
    const knownIds = new Set(list.map(t => t.id));

    // استكشاف أي خزائن مسجلة بالحركات المالية
    effectiveTransactions.forEach(t => {
      const assigned = getTransactionTargetTreasuryId(t, settings.treasuries);
      if (assigned && !knownIds.has(assigned) && assigned !== 'main') {
        knownIds.add(assigned);
        list.push({
          id: assigned,
          name: t.treasuryName || getTreasuryLabel(assigned, settings.treasuries),
          balance: 0,
          isMain: false
        });
      }
    });

    // استكشاف أي طرق دفع أو خزائن مسجلة بالفواتير
    effectiveInvoices.forEach(inv => {
      if (inv.status === 'cancelled') return;
      const methods = inv.paymentMethods && inv.paymentMethods.length > 0
        ? inv.paymentMethods
        : [{ amount: Number(inv.total) || 0, treasuryId: inv.paymentMethod || 'cash' }];
      
      methods.forEach((m: any) => {
        const mId = m.treasuryId || m.paymentMethod || m.methodId || m.method || m.id;
        if (!mId || mId === 'deferred' || mId === 'آجل' || mId === 'cashback') return;
        const assigned = getTransactionTargetTreasuryId({ treasury: mId }, settings.treasuries);
        if (assigned && !knownIds.has(assigned) && assigned !== 'main') {
          knownIds.add(assigned);
          list.push({
            id: assigned,
            name: getTreasuryLabel(assigned, settings.treasuries),
            balance: 0,
            isMain: false
          });
        }
      });
    });

    return list;
  }, [settings.treasuries, effectiveTransactions, effectiveInvoices]);

  // Helper to categorize
  const getStats = (treasuryId: string) => {
    const mainTreasury = resolveMainTreasury(settings.treasuries);
    const isMain = treasuryId === 'main' || treasuryId === mainTreasury.id || Boolean(settings.treasuries.find(t => t.id === treasuryId)?.isMain);

    // استبعاد قاطع لحركات تصفير الخزائن وإغلاق الورديات واستخدام حركات الوردية الحالية
    const tTrx = effectiveTransactions.filter(t => {
      if (isZeroingOrClosingTrx(t)) return false;
      const assigned = getTransactionTargetTreasuryId(t, settings.treasuries);
      return assigned === treasuryId;
    });

    // Track invoice IDs that already exist as transactions in tTrx to avoid double counting
    const invoiceIdsInTrx = new Set(
      tTrx.filter(t => t.type === 'in' && ((t as any).invoiceId || (t as any).invoice_id))
        .map(t => (t as any).invoiceId || (t as any).invoice_id)
    );

    // Sum sales for this treasury from shift invoices not yet recorded as individual transactions
    const invoiceSales = isMain ? 0 : effectiveInvoices.reduce((sum, inv) => {
      if (inv.status === 'cancelled') return sum;
      if (invoiceIdsInTrx.has(inv.id)) return sum;
      if (inv.status === 'deferred' && (!inv.paid || Number(inv.paid) === 0) && (!inv.paymentMethods || inv.paymentMethods.length === 0)) {
        return sum;
      }
      const methods = inv.paymentMethods && inv.paymentMethods.length > 0
        ? inv.paymentMethods
        : [{ 
            amount: (inv.paid !== undefined && inv.paid !== null && !isNaN(Number(inv.paid))) ? Number(inv.paid) : (Number(inv.total) || 0), 
            treasuryId: inv.paymentMethod || (inv as any).treasuryId || 'cash' 
          }];
      const matched = methods.filter((pm: any) => {
        const pmId = pm.treasuryId || pm.paymentMethod || pm.methodId || pm.method || pm.id;
        if (pmId === 'deferred' || pmId === 'آجل' || pmId === 'cashback') return false;
        const pmTarget = getTransactionTargetTreasuryId({ treasury: pmId }, settings.treasuries);
        return pmTarget === treasuryId;
      });
      return sum + matched.reduce((s: number, m: any) => s + (Number(m.amount) || 0), 0);
    }, 0);

    const recordedSales = isMain ? 0 : tTrx.filter(t => t.type === 'in' && (
      t.category === 'sales' || 
      t.category === 'booking_advance' || 
      t.category === 'مبيعات' || 
      t.category === 'مقدم حجز'
    )).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const income = invoiceSales + recordedSales;

    // البقشيش المصروف
    const tips = isMain ? 0 : tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isTipTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    // العمولات الفورية
    const commissions = isMain ? 0 : tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isCommissionTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    // التحويل من خزينة أخرى (تحويلات تشغيلية حقيقية فقط وليس إغلاق)
    const transfersIn = isMain ? 0 : tTrx.filter(t => t.type === 'in' && isRealTransferTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    // التحويل إلى خزينة أخرى (تحويلات تشغيلية حقيقية فقط وليس إغلاق)
    const transfersOut = tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isRealTransferTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    // المصروفات
    const expenses = isMain ? 0 : tTrx.filter(t => 
      (t.type === 'out' || (t.type as string) === 'expense') && 
      !isTipTrx(t) && 
      !isCommissionTrx(t) && 
      !isRealTransferTrx(t)
    ).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const initialCashSum = isMain ? 0 : tTrx.filter(t => t.type === 'in' && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash')).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const net = isMain 
      ? -transfersOut 
      : (income + transfersIn) - (expenses + tips + commissions + transfersOut);

    return {
      income, expenses, commissions, tips, transfersIn, transfersOut, initialCashSum, net, isMain
    };
  };

  // إجمالي المبيعات المحصلة فعلياً بكافة طرق الدفع والخزائن في هذه الوردية
  const totalCollectedSales = useMemo(() => {
    const mainTreasury = resolveMainTreasury(settings.treasuries);
    return allReportTreasuries.reduce((acc, t) => {
      const isMain = t.isMain || t.id === 'main' || t.id === mainTreasury.id;
      if (isMain) return acc;
      return acc + getStats(t.id).income;
    }, 0);
  }, [allReportTreasuries, effectiveTransactions, effectiveInvoices]);

  // إجمالي المبيعات الآجلة (المتبقي الآجل للفواتير المؤجلة أو المسددة جزئياً في هذه الوردية)
  const totalDeferredSales = useMemo(() => {
    return effectiveInvoices.reduce((sum, inv) => {
      if (inv.status === 'cancelled') return sum;
      let remaining = 0;
      if (inv.status === 'deferred') {
        if (inv.remaining !== undefined && inv.remaining !== null && !isNaN(Number(inv.remaining))) {
          remaining = Number(inv.remaining);
        } else {
          remaining = Number(inv.total) || 0;
        }
      } else if (inv.remaining !== undefined && inv.remaining !== null && !isNaN(Number(inv.remaining)) && Number(inv.remaining) > 0) {
        remaining = Number(inv.remaining);
      } else if (inv.status === 'partially_paid' || inv.paymentMethod === 'deferred' || inv.paymentMethod === 'آجل' || (inv as any).treasuryId === 'deferred') {
        const pd = Number(inv.paid) || 0;
        remaining = Math.max(0, (Number(inv.total) || 0) - pd);
      }
      return sum + remaining;
    }, 0);
  }, [effectiveInvoices]);

  // إجمالي مبالغ الكاش باك المستخدمة في فواتير هذه الوردية
  const totalCashbackUsed = useMemo(() => {
    return effectiveInvoices.reduce((sum, inv) => {
      if (inv.status === 'cancelled') return sum;
      return sum + (Number(inv.cashbackUsed) || 0);
    }, 0);
  }, [effectiveInvoices]);

  // إجمالي مبيعات الفواتير شاملاً كافة طرق الدفع + الآجل + الكاش باك
  const totalGrossSales = totalCollectedSales + totalDeferredSales + totalCashbackUsed;

  const invoiceCount = effectiveInvoices.length;

  return (
    <div className="w-[72mm] mx-auto bg-white text-black p-4 text-sm font-sans" id="print-receipt" style={{ direction: 'rtl', color: '#000000' }}>
      <div className="text-center border-b border-black pb-4 mb-4">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 mx-auto mb-2 object-contain grayscale" />
        )}
        <h2 className="text-xl font-bold mb-2 text-black">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-xl font-bold text-black">{effectiveTitle}</h1>
        {shiftCode && (
          <p className="text-xs font-bold font-mono text-black mt-0.5">كود الوردية: {shiftCode}</p>
        )}
        <p className="text-xs mt-1 text-black font-semibold">تاريخ: {dateLabel}</p>
        <p className="text-xs text-black font-semibold">المستخدم: {effectiveUserName}</p>
      </div>

      <div className="mb-4 text-black">
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold text-black">
          <span>عدد الفواتير:</span>
          <span className="text-black font-mono">{invoiceCount}</span>
        </div>
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold text-black">
          <span>إجمالي مبيعات الفواتير:</span>
          <span className="text-black font-mono">{totalGrossSales.toFixed(2)}</span>
        </div>
        {totalCashbackUsed > 0 && (
          <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold text-black">
            <span>مسدد من الكاش باك:</span>
            <span className="text-black font-mono">{totalCashbackUsed.toFixed(2)}</span>
          </div>
        )}
        {totalDeferredSales > 0 && (
          <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold text-black">
            <span>المبيعات الآجلة (المتبقي الآجل):</span>
            <span className="text-black font-mono">{totalDeferredSales.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold text-black">
          <span>المحصل الفعلي بالخزائن (كاش / شبكة):</span>
          <span className="text-black font-mono">{totalCollectedSales.toFixed(2)}</span>
        </div>
        {initialCash > 0 && (
          <div className="flex justify-between border-b border-black border-dashed pb-1 mb-1 font-bold text-black">
            <span>العهدة الافتتاحية:</span>
            <span className="text-black font-mono">{initialCash}</span>
          </div>
        )}
      </div>

      {attendanceStats && (
        <div className="mb-4 border-b border-black border-dashed pb-3 text-black">
          <div className="font-bold text-center border-y border-black border-dashed py-1 mb-2 bg-white text-black">
            ملخص حضور وبصمة الوردية
          </div>
          <div className="space-y-1 text-xs text-black">
            <div className="flex justify-between text-black">
              <span>الموظفون الحاضرون:</span>
              <span className="font-bold text-black">{attendanceStats.presentStaffCount} موظف</span>
            </div>
            <div className="flex justify-between text-black">
              <span>إجمالي ساعات العمل:</span>
              <span className="font-mono font-bold text-black">{attendanceStats.workedHoursStr}</span>
            </div>
            {attendanceStats.totalDelayMinutes > 0 && (
              <div className="flex justify-between text-black">
                <span>إجمالي دقائق التأخير:</span>
                <span className="font-mono font-bold text-black">
                  {attendanceStats.totalDelayMinutes} دقيقة
                </span>
              </div>
            )}
            {attendanceStats.totalOvertimeMinutes > 0 && (
              <div className="flex justify-between text-black">
                <span>ساعات العمل الإضافي:</span>
                <span className="font-mono font-bold text-black">{attendanceStats.overtimeHoursStr}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(() => {
        const mainTreasury = resolveMainTreasury(settings.treasuries);

        const visibleTreasuries = allReportTreasuries.filter(treasury => {
          const stats = getStats(treasury.id);
          const isMain = treasury.isMain || treasury.id === 'main' || treasury.id === mainTreasury.id;

          if (isMain) {
            // الخزينة الرئيسية: تعرض في التقرير فقط المبالغ المحولة منها إلى أي خزينة أخرى وليس الإغلاق
            return stats.transfersOut > 0;
          }

          // باقي الخزائن: تعرض فقط الخزائن التي بها أي حركة من البنود المطلوبة
          return (
            stats.income > 0 ||
            stats.expenses > 0 ||
            stats.tips > 0 ||
            stats.commissions > 0 ||
            stats.transfersIn > 0 ||
            stats.transfersOut > 0 ||
            stats.initialCashSum > 0
          );
        });

        if (visibleTreasuries.length === 0) {
          return (
            <div className="text-center py-4 my-2 border-y border-black border-dashed text-xs text-black font-bold">
              لا توجد حركات مالية مسجلة بالخزائن خلال هذه الوردية
            </div>
          );
        }

        return visibleTreasuries.map(treasury => {
          const stats = getStats(treasury.id);
          const isMain = treasury.isMain || treasury.id === 'main' || treasury.id === mainTreasury.id;

          if (isMain) {
            return (
              <div key={treasury.id} className="mb-6 text-black">
                <h3 className="font-bold text-center border-y border-black border-dashed py-1 mb-2 bg-white text-black">
                  {treasury.name} (الخزينة الرئيسية)
                </h3>
                
                <div className="space-y-1 text-xs text-black">
                  <div className="flex justify-between text-black font-semibold">
                    <span>المبالغ المحولة منها إلى الخزائن الأخرى:</span>
                    <span className="text-black font-mono">{stats.transfersOut.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-black border-dashed pt-1 mt-1 text-sm text-black">
                    <span>إجمالي المحول من الرئيسية:</span>
                    <span dir="ltr" className="text-black font-mono">{stats.transfersOut.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={treasury.id} className="mb-6 text-black">
              <h3 className="font-bold text-center border-y border-black border-dashed py-1 mb-2 bg-white text-black">
                {treasury.name}
              </h3>
              
              <div className="space-y-1 text-xs text-black">
                {stats.initialCashSum > 0 && (
                  <div className="flex justify-between font-bold text-black border border-black mb-1 p-1">
                    <span>العهدة الافتتاحية:</span>
                    <span className="text-black font-mono">{stats.initialCashSum.toFixed(2)}</span>
                  </div>
                )}
                {stats.income > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>الدخل من المبيعات:</span>
                    <span className="text-black font-mono">{stats.income.toFixed(2)}</span>
                  </div>
                )}
                {stats.expenses > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>المصروفات:</span>
                    <span className="text-black font-mono">{stats.expenses.toFixed(2)}</span>
                  </div>
                )}
                {stats.tips > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>البقشيش المصروف:</span>
                    <span className="text-black font-mono">{stats.tips.toFixed(2)}</span>
                  </div>
                )}
                {stats.commissions > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>العمولات الفورية:</span>
                    <span className="text-black font-mono">{stats.commissions.toFixed(2)}</span>
                  </div>
                )}
                {stats.transfersIn > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>التحويل من خزينة أخرى:</span>
                    <span className="text-black font-mono">{stats.transfersIn.toFixed(2)}</span>
                  </div>
                )}
                {stats.transfersOut > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>التحويل إلى خزينة أخرى:</span>
                    <span className="text-black font-mono">{stats.transfersOut.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-bold border-t border-black border-dashed pt-1 mt-1 text-sm text-black">
                  <span>الصافي:</span>
                  <span dir="ltr" className="text-black font-mono">{stats.net.toFixed(2)}</span>
                </div>
                {stats.net > 0 && (
                  <div className="text-[10px] text-black border border-black rounded p-1 mt-1 text-center font-bold">
                    سيتم تصفير هذا الصافي ونقله تلقائياً إلى الخزينة الرئيسية عند إغلاق الوردية
                  </div>
                )}
              </div>
            </div>
          );
        });
      })()}

      <div className="text-center mt-6 text-xs border-t border-black pt-2 text-black font-semibold">
        <p className="text-black">تم استخراج التقرير من النظام</p>
        <p className="text-black font-mono">{new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}
