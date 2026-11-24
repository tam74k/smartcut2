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

export const isLegacyCorruptZeroingTrx = (t: any): boolean => {
  if (!t) return false;
  if (t.isZeroing || t.isShiftZeroing || (t as any).is_zeroing) return true;
  const sub = String(t.subCategory || (t as any).sub_category || '').toLowerCase();
  if (sub === 'shift_zeroing' || sub === 'closing_sweep') return true;
  const desc = String(t.description || '').toLowerCase();
  if (desc.includes('تصفير خزينة') || desc.includes('تحويل تصفير') || desc.includes('تصفير وردية') || desc.includes('نقل الرصيد بالكامل')) return true;
  return false;
};

export const isZeroingOrClosingTrx = (t: any): boolean => {
  if (!t) return false;
  if (isLegacyCorruptZeroingTrx(t)) return true;
  if (t.isShiftSweep || t.subCategory === 'shift_sweep' || (t as any).sub_category === 'shift_sweep') return true;
  const id = String(t.id || '').toUpperCase();
  if (id.startsWith('TRX-SWP-OUT-') || id.startsWith('TRX-SWP-IN-')) return true;
  // التحويلات التشغيلية الحقيقية بين الخزائن ليست تصفير وردية
  if (id.startsWith('TRX-TRF-OUT-') || id.startsWith('TRX-TRF-IN-')) return false;

  if (t.isZeroing || t.isShiftZeroing || t.isClosing || t.subCategory === 'shift_zeroing' || (t as any).sub_category === 'shift_zeroing') return true;
  const desc = String(t.description || t.notes || '').toLowerCase();
  const cat = String(t.category || (t as any).expenseCategory || (t as any).expense_category || '').toLowerCase();
  const title = String(t.title || '').toLowerCase();

  const isTransfer = title === 'transfer' || cat === 'transfer' || t.type === 'transfer' || desc.includes('تحويل إلى') || desc.includes('تحويل الى') || desc.includes('تحويل من');

  const isZeroing = (
    desc.includes('تصفير') ||
    desc.includes('تفريغ') ||
    desc.includes('نقل الرصيد بالكامل') ||
    desc.includes('ترحيل رصيد') ||
    desc.includes('تحويل تصفير') ||
    desc.includes('إغلاق وردية') ||
    desc.includes('اغلاق وردية') ||
    desc.includes('إغلاق الخزائن') ||
    desc.includes('اغلاق الخزائن') ||
    desc.includes('إغلاق الوردية') ||
    desc.includes('اغلاق الوردية') ||
    desc.includes('إقفال') ||
    desc.includes('اقفال') ||
    title.includes('تصفير') ||
    title.includes('تفريغ') ||
    cat === 'shift_zeroing' ||
    cat === 'zeroing' ||
    cat === 'clearing' ||
    cat.includes('تصفير') ||
    cat.includes('تفريغ')
  );

  if (isTransfer && !isZeroing) {
    return false;
  }

  if (id.startsWith('TRX-OUT-') && isZeroing) return true;
  if (id.startsWith('TRX-IN-') && isZeroing) return true;

  return isZeroing;
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
  shiftId,
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
  shiftId?: string,
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
    const id = String(t.id || '').toUpperCase();
    if (id.startsWith('TRX-TRF-OUT-') || id.startsWith('TRX-TRF-IN-')) return true;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || t.notes || '').toLowerCase();
    const title = (t.title || '').toLowerCase();
    return (
      cat === 'transfer' || 
      cat.includes('transfer') || 
      cat.includes('تحويل') || 
      title.includes('transfer') ||
      title.includes('تحويل') ||
      desc.includes('تحويل إلى') || 
      desc.includes('تحويل الى') || 
      desc.includes('تحويل من') ||
      desc.includes('تحويل بين الخزائن')
    );
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
  const targetShiftId = (shiftId || '').trim();

  // تصفية الفواتير بدقة طبقاً لكود أو معرف الوردية الحالي
  const effectiveInvoices = useMemo(() => {
    if (!targetShiftCode && !targetShiftId) return invoices.filter(inv => inv.status !== 'cancelled');
    const matched = invoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      const invCode = (inv.shiftCode || (inv as any).shift_code || '').trim();
      const invShiftId = (inv.shiftId || (inv as any).shift_id || '').trim();
      if (targetShiftCode && (invCode === targetShiftCode || invShiftId === targetShiftCode)) return true;
      if (targetShiftId && (invCode === targetShiftId || invShiftId === targetShiftId)) return true;
      return false;
    });
    return matched.length > 0 ? matched : invoices.filter(inv => inv.status !== 'cancelled');
  }, [invoices, targetShiftCode, targetShiftId]);

  // التحقق مما إذا كانت الحركة المالية عبارة عن دفعة مقدمة / عربون حجز
  const isBookingDepositTrx = (t: any): boolean => {
    if (t.type !== 'in') return false;
    const cat = String(t.category || '').toLowerCase();
    const desc = String(t.description || '').toLowerCase();
    return (
      cat === 'مقدم حجز' || 
      cat === 'booking_advance' || 
      cat === 'advance' ||
      cat === 'deposit' ||
      cat.includes('عربون') ||
      cat.includes('مقدم') ||
      Boolean(t.bookingId || (t as any).booking_id) ||
      desc.includes('عربون') ||
      desc.includes('دفعة مقدمة') ||
      desc.includes('مقدم حجز')
    );
  };

  // تصفية الحركات المالية بدقة طبقاً لكود أو معرف الوردية الحالي مع استبعاد حركات الإغلاق والتصفير نهائياً
  const effectiveTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (isZeroingOrClosingTrx(t)) return false;
      if (!targetShiftCode && !targetShiftId) return true;
      const tCode = (t.shiftCode || (t as any).shift_code || '').trim();
      const tShiftId = (t.shiftId || (t as any).shift_id || '').trim();
      const desc = String(t.description || '');

      // 1. مطابقة كود الوردية أو معرف الوردية
      if (targetShiftCode && (tCode === targetShiftCode || tShiftId === targetShiftCode || desc.includes(targetShiftCode))) return true;
      if (targetShiftId && (tCode === targetShiftId || tShiftId === targetShiftId || desc.includes(targetShiftId))) return true;

      // 2. مطابقة التاريخ إذا كانت الحركة تخص تاريخ الوردية ولا تخص وردية أخرى
      const tShiftDate = t.shiftDate || (t as any).shift_date || (t.date ? t.date.split('T')[0] : '');
      if (dateLabel && tShiftDate === dateLabel && !tCode && !tShiftId) {
        return true;
      }

      return false;
    });
  }, [transactions, targetShiftCode, targetShiftId, dateLabel]);

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

    // فحص ما إذا كانت الحركة المالية تتبع فاتورة
    const isTrxLinkedToInvoice = (t: any): boolean => {
      const tInvId = (t as any).invoiceId || (t as any).invoice_id;
      if (tInvId) return true;
      const cleanId = String(t.id || '').toUpperCase();
      if (cleanId.startsWith('TRX-INV-') || cleanId.includes('INV-')) return true;
      const desc = String(t.description || '').toUpperCase();
      if (desc.includes('فاتورة') || desc.includes('INV-')) return true;
      return effectiveInvoices.some(inv => {
        const cleanInvId = inv.id.replace(/^INV-+/i, '').trim().toUpperCase();
        return cleanInvId ? (cleanId.includes(cleanInvId) || desc.includes(cleanInvId)) : false;
      });
    };

    // مبيعات الفواتير المحصلة في هذه الخزينة من واقع فواتير الوردية الفعلية
    const rawInvoiceSales = isMain ? 0 : effectiveInvoices.reduce((sum, inv) => {
      if (inv.status === 'cancelled') return sum;
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

    // أي حركات فواتير مسجلة في tTrx إذا كانت الفاتورة نفسها غير محملة في effectiveInvoices
    const unlistedInvoiceTrxSales = isMain ? 0 : tTrx.filter(t => 
      t.type === 'in' && 
      !isBookingDepositTrx(t) && 
      isTrxLinkedToInvoice(t) && 
      !effectiveInvoices.some(inv => {
        const cleanInvId = inv.id.replace(/^INV-+/i, '').trim().toUpperCase();
        const tInvId = (t as any).invoiceId || (t as any).invoice_id;
        return (tInvId && tInvId === inv.id) || (cleanInvId && String(t.id || '').toUpperCase().includes(cleanInvId));
      })
    ).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const invoiceSales = rawInvoiceSales + unlistedInvoiceTrxSales;

    const recordedBookingDepositsList = isMain ? [] : tTrx.filter(t => isBookingDepositTrx(t));
    const bookingDeposits = recordedBookingDepositsList.reduce((s, x) => s + (Number(x.amount) || 0), 0);

    // مبيعات أخرى: فقط الحركات النقدية الإيرادية التي لا تتبع أي فاتورة وليست عربون حجز
    const otherSales = isMain ? 0 : tTrx.filter(t => 
      t.type === 'in' && 
      !isBookingDepositTrx(t) && 
      !isTrxLinkedToInvoice(t) && 
      (t.category === 'sales' || t.category === 'مبيعات')
    ).reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const recordedSales = bookingDeposits + otherSales;
    const income = invoiceSales + recordedSales;

    // البقشيش المصروف
    const tips = isMain ? 0 : tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isTipTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    // العمولات الفورية
    const commissions = isMain ? 0 : tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isCommissionTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    // التحويل من خزينة أخرى (تحويلات تشغيلية حقيقية فقط وليس إغلاق)
    const incomingTransfersList = isMain ? [] : tTrx.filter(t => t.type === 'in' && isRealTransferTrx(t));
    const transfersIn = incomingTransfersList.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    
    // التحويل إلى خزينة أخرى (تحويلات تشغيلية حقيقية فقط وليس إغلاق)
    const outgoingTransfersList = tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isRealTransferTrx(t));
    const transfersOut = outgoingTransfersList.reduce((s, x) => s + (Number(x.amount) || 0), 0);

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
      income, invoiceSales, bookingDeposits, bookingDepositsList: recordedBookingDepositsList, otherSales,
      expenses, commissions, tips, transfersIn, transfersOut, initialCashSum, net, isMain,
      incomingTransfersList, outgoingTransfersList
    };
  };

  // إجمالي مبيعات الفواتير المحصلة فعلياً بكافة الخزائن
  const totalCollectedInvoiceSales = useMemo(() => {
    const mainTreasury = resolveMainTreasury(settings.treasuries);
    return allReportTreasuries.reduce((acc, t) => {
      const isMain = t.isMain || t.id === 'main' || t.id === mainTreasury.id;
      if (isMain) return acc;
      return acc + getStats(t.id).invoiceSales;
    }, 0);
  }, [allReportTreasuries, effectiveTransactions, effectiveInvoices]);

  // إجمالي مبالغ عربين ومقدمات الحجز المحصلة فعلياً بكافة الخزائن في هذه الوردية
  const totalCollectedBookingDeposits = useMemo(() => {
    const mainTreasury = resolveMainTreasury(settings.treasuries);
    return allReportTreasuries.reduce((acc, t) => {
      const isMain = t.isMain || t.id === 'main' || t.id === mainTreasury.id;
      if (isMain) return acc;
      return acc + getStats(t.id).bookingDeposits;
    }, 0);
  }, [allReportTreasuries, effectiveTransactions, effectiveInvoices]);

  // قائمة جميع حركات عربين الحجز في الوردية
  const allBookingDepositsList = useMemo(() => {
    return effectiveTransactions.filter(isBookingDepositTrx);
  }, [effectiveTransactions]);

  // إجمالي الدخل المحصل الفعلي بالخزائن في هذه الوردية (فواتير + عربين حجز + مبيعات أخرى)
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
  const totalGrossSales = totalCollectedInvoiceSales + totalDeferredSales + totalCashbackUsed;

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
        <div className="flex justify-between border-b border-black border-solid pb-1 mb-1 font-bold text-black">
          <span>عدد الفواتير:</span>
          <span className="text-black font-mono">{invoiceCount}</span>
        </div>
        <div className="flex justify-between border-b border-black border-solid pb-1 mb-1 font-bold text-black">
          <span>إجمالي مبيعات الفواتير:</span>
          <span className="text-black font-mono">{totalGrossSales.toFixed(2)}</span>
        </div>
        {totalCollectedBookingDeposits > 0 && (
          <div className="flex justify-between border-b border-black border-solid pb-1 mb-1 font-bold text-black bg-slate-50 px-1 rounded">
            <span>عربين ومقدمات الحجز ({allBookingDepositsList.length}):</span>
            <span className="text-black font-mono">+{totalCollectedBookingDeposits.toFixed(2)}</span>
          </div>
        )}
        {totalCashbackUsed > 0 && (
          <div className="flex justify-between border-b border-black border-solid pb-1 mb-1 font-bold text-black">
            <span>مسدد من الكاش باك:</span>
            <span className="text-black font-mono">{totalCashbackUsed.toFixed(2)}</span>
          </div>
        )}
        {totalDeferredSales > 0 && (
          <div className="flex justify-between border-b border-black border-solid pb-1 mb-1 font-bold text-black">
            <span>المبيعات الآجلة (المتبقي الآجل):</span>
            <span className="text-black font-mono">{totalDeferredSales.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-b border-black border-solid pb-1 mb-1 font-bold text-black">
          <span>المحصل الفعلي بالخزائن (فواتير + عربين):</span>
          <span className="text-black font-mono">{totalCollectedSales.toFixed(2)}</span>
        </div>
        {initialCash > 0 && (
          <div className="flex justify-between border-b border-black border-solid pb-1 mb-1 font-bold text-black">
            <span>العهدة الافتتاحية:</span>
            <span className="text-black font-mono">{initialCash}</span>
          </div>
        )}
      </div>

      {attendanceStats && (
        <div className="mb-4 border-b border-black border-solid pb-3 text-black">
          <div className="font-bold text-center border-y border-black border-solid py-1 mb-2 bg-white text-black">
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

        // ترتيب الخزائن بحيث تظهر الخزينة الرئيسية أولاً دائماً في الأعلى إن وجدت
        visibleTreasuries.sort((a, b) => {
          const isMainA = a.isMain || a.id === 'main' || a.id === mainTreasury.id;
          const isMainB = b.isMain || b.id === 'main' || b.id === mainTreasury.id;
          if (isMainA && !isMainB) return -1;
          if (!isMainA && isMainB) return 1;
          return 0;
        });

        if (visibleTreasuries.length === 0) {
          return (
            <div className="text-center py-4 my-2 border-y border-black border-solid text-xs text-black font-bold">
              لا توجد حركات مالية مسجلة بالخزائن خلال هذه الوردية
            </div>
          );
        }

        return visibleTreasuries.map(treasury => {
          const stats = getStats(treasury.id);
          const isMain = treasury.isMain || treasury.id === 'main' || treasury.id === mainTreasury.id;

          if (isMain) {
            return (
              <div key={treasury.id} className="mb-6 text-black border-b border-black pb-4">
                <h3 className="font-bold text-center border-y border-black border-solid py-1 mb-2 bg-white text-black text-sm">
                  {treasury.name} (الخزينة الرئيسية)
                </h3>
                
                <div className="space-y-1.5 text-xs text-black">
                  {/* سطور التحويلات المسحوبة من الخزينة الرئيسية بالسالب مع الوصف */}
                  {stats.outgoingTransfersList && stats.outgoingTransfersList.length > 0 ? (
                    stats.outgoingTransfersList.map((tx: any, idx: number) => {
                      const desc = tx.description || 'تحويل إلى خزينة أخرى';
                      const amt = Number(tx.amount) || 0;
                      return (
                        <div key={tx.id || idx} className="flex justify-between text-black font-semibold">
                          <span>{desc}:</span>
                          <span dir="ltr" className="text-black font-mono font-bold">-{amt.toFixed(2)}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex justify-between text-black font-semibold">
                      <span>تحويل إلى الخزائن الأخرى:</span>
                      <span dir="ltr" className="text-black font-mono font-bold">-{stats.transfersOut.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold border-t border-black border-solid pt-1.5 mt-2 text-sm text-black">
                    <span>إجمالي المسحوب من الرئيسية:</span>
                    <span dir="ltr" className="text-black font-mono font-bold">-{stats.transfersOut.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={treasury.id} className="mb-6 text-black border-b border-black pb-4">
              <h3 className="font-bold text-center border-y border-black border-solid py-1 mb-2 bg-white text-black text-sm">
                {treasury.name}
              </h3>
              
              <div className="space-y-1.5 text-xs text-black">
                {stats.initialCashSum > 0 && (
                  <div className="flex justify-between font-bold text-black border border-black mb-1 p-1">
                    <span>العهدة الافتتاحية:</span>
                    <span className="text-black font-mono">{stats.initialCashSum.toFixed(2)}</span>
                  </div>
                )}

                {/* سطر فيه المبلغ المحول من الخزينة الرئيسية والوصف تحويل من الخزينة الرئيسية */}
                {stats.incomingTransfersList && stats.incomingTransfersList.length > 0 ? (
                  stats.incomingTransfersList.map((tx: any, idx: number) => {
                    const desc = tx.description || 'تحويل من الخزينة الرئيسية';
                    const amt = Number(tx.amount) || 0;
                    return (
                      <div key={tx.id || idx} className="flex justify-between text-black font-bold bg-slate-50 p-1 border border-black/30 rounded">
                        <span>{desc}:</span>
                        <span dir="ltr" className="text-black font-mono font-bold">+{amt.toFixed(2)}</span>
                      </div>
                    );
                  })
                ) : (stats.transfersIn > 0 && (
                  <div className="flex justify-between text-black font-bold bg-slate-50 p-1 border border-black/30 rounded">
                    <span>تحويل من الخزينة الرئيسية:</span>
                    <span dir="ltr" className="text-black font-mono font-bold">+{stats.transfersIn.toFixed(2)}</span>
                  </div>
                ))}

                {stats.invoiceSales > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>مبيعات الفواتير:</span>
                    <span className="text-black font-mono">+{stats.invoiceSales.toFixed(2)}</span>
                  </div>
                )}
                {stats.bookingDeposits > 0 && (
                  <div className="border border-black/40 rounded p-1.5 bg-slate-50/80 my-1">
                    <div className="flex justify-between text-black font-bold">
                      <span>مقدمات وعربون الحجز ({stats.bookingDepositsList.length}):</span>
                      <span className="text-black font-mono">+{stats.bookingDeposits.toFixed(2)}</span>
                    </div>
                    {stats.bookingDepositsList.map((tx: any, idx: number) => (
                      <div key={tx.id || idx} className="flex justify-between text-[11px] text-slate-700 pr-2 pt-0.5 border-t border-black/10 mt-0.5">
                        <span className="truncate max-w-[200px]" title={tx.description}>{tx.description || 'عربون حجز'}</span>
                        <span className="font-mono font-bold shrink-0">+{Number(tx.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {stats.otherSales > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>مبيعات أخرى:</span>
                    <span className="text-black font-mono">+{stats.otherSales.toFixed(2)}</span>
                  </div>
                )}
                {stats.income > 0 && stats.invoiceSales > 0 && stats.bookingDeposits > 0 && (
                  <div className="flex justify-between text-black font-bold border-t border-dotted border-black/30 pt-1">
                    <span>إجمالي الدخل المحصل:</span>
                    <span className="text-black font-mono font-black">+{stats.income.toFixed(2)}</span>
                  </div>
                )}
                {stats.expenses > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>المصروفات:</span>
                    <span dir="ltr" className="text-black font-mono">-{stats.expenses.toFixed(2)}</span>
                  </div>
                )}
                {stats.tips > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>البقشيش المصروف:</span>
                    <span dir="ltr" className="text-black font-mono">-{stats.tips.toFixed(2)}</span>
                  </div>
                )}
                {stats.commissions > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>العمولات الفورية:</span>
                    <span dir="ltr" className="text-black font-mono">-{stats.commissions.toFixed(2)}</span>
                  </div>
                )}
                {stats.outgoingTransfersList && stats.outgoingTransfersList.length > 0 ? (
                  stats.outgoingTransfersList.map((tx: any, idx: number) => {
                    const desc = tx.description || 'تحويل إلى خزينة أخرى';
                    const amt = Number(tx.amount) || 0;
                    return (
                      <div key={tx.id || idx} className="flex justify-between text-black font-semibold">
                        <span>{desc}:</span>
                        <span dir="ltr" className="text-black font-mono font-bold">-{amt.toFixed(2)}</span>
                      </div>
                    );
                  })
                ) : (stats.transfersOut > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>التحويل إلى خزينة أخرى:</span>
                    <span dir="ltr" className="text-black font-mono">-{stats.transfersOut.toFixed(2)}</span>
                  </div>
                ))}
                
                <div className="flex justify-between font-bold border-t border-black border-solid pt-1.5 mt-2 text-sm text-black">
                  <span>الصافي:</span>
                  <span dir="ltr" className={`font-mono font-black ${stats.net >= 0 ? 'text-black' : 'text-rose-700'}`}>
                    {stats.net >= 0 ? `+${stats.net.toFixed(2)}` : `-${Math.abs(stats.net).toFixed(2)}`}
                  </span>
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
