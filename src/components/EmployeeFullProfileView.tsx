import React, { useState, useMemo } from 'react';
import { 
  AppSettings, Employee, Invoice, Transaction, FingerprintLog 
} from '../types';
import { 
  ArrowRight, Calendar, Clock, DollarSign, Gift, Banknote, 
  TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, XCircle, 
  CalendarRange, Phone, Mail, Award, Scissors, FileText, 
  Sparkles, Check, X, ShieldAlert, BarChart3, PieChart, 
  Timer, Layers, ChevronLeft, ChevronRight, User, Eye, ShieldCheck, Target
} from 'lucide-react';
import { calculateEmployeeCommission, getCommissionModelLabel } from '../utils/commissionHelper';
import { calculateEmployeeTargetCommission } from '../utils/targetCalculationHelper';
import { getActiveShiftDate, getEffectiveDateOnly } from '../utils/shiftDate';

interface EmployeeFullProfileViewProps {
  employee: Employee;
  settings: AppSettings;
  invoices?: Invoice[];
  transactions?: Transaction[];
  fingerprintLogs?: FingerprintLog[];
  onBack: () => void;
  onOpenActionModal?: (empId: string, type: 'advance' | 'penalty' | 'bonus' | 'leave' | 'salary_increase' | 'shift_schedule' | 'permission' | 'end_of_service') => void;
  onEditEmployee?: (emp: Employee) => void;
  onUnbanBlacklist?: (empId: string) => void;
}

export function EmployeeFullProfileView({
  employee,
  settings,
  invoices = [],
  transactions = [],
  fingerprintLogs = [],
  onBack,
  onOpenActionModal,
  onEditEmployee,
  onUnbanBlacklist
}: EmployeeFullProfileViewProps) {
  // Helper to format Date to YYYY-MM-DD
  const formatYmd = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Default date range: 1st day of current month to last day of current month
  const today = new Date();
  const initialStartDate = useMemo(() => {
    return formatYmd(new Date(today.getFullYear(), today.getMonth(), 1));
  }, []);
  const initialEndDate = useMemo(() => {
    return formatYmd(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  }, []);

  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);
  const [activePreset, setActivePreset] = useState<'today' | 'yesterday' | 'this_month' | 'last_month' | 'last_30' | 'last_90' | 'custom'>('this_month');

  // Sub-tabs in the detail page
  const [activeSection, setActiveSection] = useState<'jobs' | 'attendance' | 'advances' | 'salaries' | 'overtime' | 'deductions' | 'bonuses'>('jobs');

  // Presets Handlers
  const handleApplyPreset = (preset: 'today' | 'yesterday' | 'this_month' | 'last_month' | 'last_30' | 'last_90') => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const shiftDate = getActiveShiftDate() || formatYmd(now);
      setStartDate(shiftDate);
      setEndDate(shiftDate);
    } else if (preset === 'yesterday') {
      const yDate = new Date();
      yDate.setDate(now.getDate() - 1);
      const yStr = formatYmd(yDate);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'this_month') {
      setStartDate(formatYmd(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(formatYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (preset === 'last_month') {
      setStartDate(formatYmd(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setEndDate(formatYmd(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else if (preset === 'last_30') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      setStartDate(formatYmd(past30));
      setEndDate(formatYmd(now));
    } else if (preset === 'last_90') {
      const past90 = new Date();
      past90.setDate(now.getDate() - 90);
      setStartDate(formatYmd(past90));
      setEndDate(formatYmd(now));
    }
  };

  // Target Mode state (Daily vs Monthly) & Exact Date Range
  const [targetModeOverride, setTargetModeOverride] = useState<'daily' | 'monthly' | null>(null);

  const activeTargetMode: 'daily' | 'monthly' = useMemo(() => {
    if (targetModeOverride) return targetModeOverride;
    // If the user selected a single day (e.g. today or custom single day), evaluate as daily for that day
    if (startDate === endDate) return 'daily';
    // If employee is configured with daily target
    if (employee.targetType === 'daily' || (Number(employee.dailyTargetAmount) > 0 && !(Number(employee.monthlyTargetAmount) > 0))) {
      return 'daily';
    }
    return 'monthly';
  }, [targetModeOverride, startDate, endDate, employee]);

  const targetDateRange = useMemo(() => {
    if (activeTargetMode === 'daily') {
      // If single day chosen by user, calculate for that day (اليوم المحدد للتصفية)
      if (startDate === endDate) {
        return { start: startDate, end: startDate, label: `يوم التصفية المحدد (${startDate})` };
      }
      // Otherwise use the open shift date (تاريخ الوردية المفتوحة)
      const openShiftDate = getActiveShiftDate() || getEffectiveDateOnly();
      return { start: openShiftDate, end: openShiftDate, label: `الوردية المفتوحة (${openShiftDate})` };
    } else {
      // Monthly: from 1st of the month to end of the month
      const ref = new Date(startDate || new Date());
      const y = ref.getFullYear();
      const m = ref.getMonth();
      const mStart = formatYmd(new Date(y, m, 1));
      const mEnd = formatYmd(new Date(y, m + 1, 0));
      return { start: mStart, end: mEnd, label: `من أول الشهر لنهايته (${mStart} إلى ${mEnd})` };
    }
  }, [activeTargetMode, startDate, endDate]);

  // Target & Commission Calculation
  const targetCalc = useMemo(() => {
    return calculateEmployeeTargetCommission({
      employee,
      settings,
      invoices,
      dateRange: { start: targetDateRange.start, end: targetDateRange.end },
      isDaily: activeTargetMode === 'daily'
    });
  }, [employee, settings, invoices, targetDateRange, activeTargetMode]);

  // 1. Employee's Performed Jobs / Services (from non-void invoices within range)
  const employeeJobs = useMemo(() => {
    if (!employee) return [];
    const jobs: Array<{
      id: string;
      invoiceId: string;
      invoiceDate: string;
      clientName: string;
      clientPhone?: string;
      serviceName: string;
      quantity: number;
      price: number;
      itemTotal: number;
      commissionAmount: number;
      isReferral?: boolean;
    }> = [];

    for (const inv of invoices) {
      // Exclude void or cancelled invoices
      if (inv.status === 'cancelled' || (inv as any).isVoid) continue;

      const invDateStr = (inv.date || '').split('T')[0];
      if (invDateStr < startDate || invDateStr > endDate) continue;

      for (let i = 0; i < (inv.items || []).length; i++) {
        const item = inv.items[i];
        const isTechnician = item.employeeId === employee.id || 
          (!item.employeeId && item.technicianName && item.technicianName.toLowerCase() === employee.name.toLowerCase());
        const isReferral = item.referralEmployeeId === employee.id;

        if (isTechnician) {
          const qty = item.quantity || 1;
          const price = item.price || 0;
          const itemTotal = price * qty;

          let comm = Number(item.employeeCommission ?? item.commissionAmount ?? (item as any).commission ?? 0);
          if (comm <= 0) {
            if (employee.commissionModel === 'fixed_rate' || !employee.commissionModel) {
              const rate = Number(employee.commissionRate) || 0;
              comm = itemTotal * (rate / 100);
            } else if (employee.commissionModel === 'tiered_brackets') {
              const rate = Number(employee.commissionRate) || (employee.commissionTiers?.[0]?.percentage || 0);
              comm = itemTotal * (rate / 100);
            } else if (employee.commissionModel === 'target_based') {
              const rate = Number(employee.commissionRate) || 0;
              comm = itemTotal * (rate / 100);
            }
          }

          jobs.push({
            id: `${inv.id}-${i}`,
            invoiceId: inv.id,
            invoiceDate: inv.date,
            clientName: inv.clientName || 'عميل نقدي',
            clientPhone: inv.clientPhone,
            serviceName: item.serviceName || 'خدمة',
            quantity: qty,
            price,
            itemTotal,
            commissionAmount: comm,
            isReferral: false
          });
        } else if (isReferral) {
          const qty = item.quantity || 1;
          const refComm = Number(item.referralCommissionAmount || 0) * qty;
          jobs.push({
            id: `${inv.id}-ref-${i}`,
            invoiceId: inv.id,
            invoiceDate: inv.date,
            clientName: inv.clientName || 'عميل نقدي',
            clientPhone: inv.clientPhone,
            serviceName: `${item.serviceName || 'خدمة'} (إحالة/فتح شغل)`,
            quantity: qty,
            price: item.price || 0,
            itemTotal: (item.price || 0) * qty,
            commissionAmount: refComm,
            isReferral: true
          });
        }
      }
    }

    return jobs.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }, [invoices, employee, startDate, endDate]);

  const totalJobsRevenue = useMemo(() => {
    return employeeJobs.reduce((sum, j) => sum + (j.isReferral ? 0 : j.itemTotal), 0);
  }, [employeeJobs]);

  const totalCommissionsEarned = useMemo(() => {
    return employeeJobs.reduce((sum, j) => sum + j.commissionAmount, 0);
  }, [employeeJobs]);

  // 2. Attendance & Delays Analysis
  const attendanceAnalysis = useMemo(() => {
    const code = employee.fingerprintCode;
    const scheduledCheckIn = employee.checkInTime || '09:00';
    const scheduledCheckOut = employee.checkOutTime || '18:00';

    // Filter relevant fingerprint logs
    const relevantLogs = fingerprintLogs.filter(log => {
      const isMatch = (code && log.fingerprintCode === code) || log.employeeId === employee.id;
      if (!isMatch) return false;
      const logDate = (log.timestamp || '').split('T')[0];
      return logDate >= startDate && logDate <= endDate;
    });

    // Group logs by day
    const dayMap = new Map<string, { checkIn?: string; checkOut?: string; logs: FingerprintLog[] }>();
    for (const log of relevantLogs) {
      const dateStr = (log.timestamp || '').split('T')[0];
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { logs: [] });
      }
      const entry = dayMap.get(dateStr)!;
      entry.logs.push(log);
      if (log.type === 'check_in') {
        if (!entry.checkIn || log.timestamp < entry.checkIn) entry.checkIn = log.timestamp;
      } else if (log.type === 'check_out') {
        if (!entry.checkOut || log.timestamp > entry.checkOut) entry.checkOut = log.timestamp;
      }
    }

    // Helper to calculate delay in minutes
    const getDelayMinutes = (punchInTs?: string): number => {
      if (!punchInTs) return 0;
      try {
        const d = new Date(punchInTs);
        const [schedH, schedM] = scheduledCheckIn.split(':').map(Number);
        const actualH = d.getHours();
        const actualM = d.getMinutes();
        const schedTotalMinutes = schedH * 60 + schedM;
        const actualTotalMinutes = actualH * 60 + actualM;
        const diff = actualTotalMinutes - schedTotalMinutes;
        return diff > 5 ? diff : 0; // 5 minutes grace period
      } catch {
        return 0;
      }
    };

    // Helper to calculate overtime in minutes
    const getOvertimeMinutes = (punchOutTs?: string): number => {
      if (!punchOutTs) return 0;
      try {
        const d = new Date(punchOutTs);
        const [schedH, schedM] = scheduledCheckOut.split(':').map(Number);
        const actualH = d.getHours();
        const actualM = d.getMinutes();
        const schedTotalMinutes = schedH * 60 + schedM;
        const actualTotalMinutes = actualH * 60 + actualM;
        const diff = actualTotalMinutes - schedTotalMinutes;
        return diff > 15 ? diff : 0; // 15 minutes grace period
      } catch {
        return 0;
      }
    };

    // Generate date sequence for the calendar chart
    const daysList: Array<{
      dateStr: string;
      dayNumber: number;
      dayName: string;
      status: 'present_ontime' | 'present_late' | 'absent' | 'day_off' | 'future';
      checkInTime?: string;
      checkOutTime?: string;
      delayMinutes: number;
      overtimeMinutes: number;
    }> = [];

    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    let curr = new Date(Date.UTC(sY, sM - 1, sD, 12, 0, 0));
    const end = new Date(Date.UTC(eY, eM - 1, eD, 12, 0, 0));
    const todayStr = formatYmd(new Date());

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    let totalPresentDays = 0;
    let totalLateDays = 0;
    let totalAbsentDays = 0;
    let totalDelayMinutes = 0;
    let totalOvertimeMinutes = 0;

    while (curr <= end) {
      const y = curr.getUTCFullYear();
      const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
      const d = String(curr.getUTCDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayIdx = curr.getUTCDay();
      const engDay = weekdays[dayIdx];
      const arDay = arabicDays[dayIdx];
      const isDayOff = employee.weeklyDaysOff?.includes(engDay) || false;

      const dayData = dayMap.get(dateStr);
      let status: 'present_ontime' | 'present_late' | 'absent' | 'day_off' | 'future' = 'absent';
      let delayMin = 0;
      let otMin = 0;

      if (dateStr > todayStr) {
        status = 'future';
      } else if (dayData && dayData.checkIn) {
        delayMin = getDelayMinutes(dayData.checkIn);
        otMin = getOvertimeMinutes(dayData.checkOut);
        if (delayMin > 0) {
          status = 'present_late';
          totalLateDays++;
          totalDelayMinutes += delayMin;
        } else {
          status = 'present_ontime';
        }
        totalPresentDays++;
        totalOvertimeMinutes += otMin;
      } else if (isDayOff) {
        status = 'day_off';
      } else {
        status = 'absent';
        totalAbsentDays++;
      }

      daysList.push({
        dateStr,
        dayNumber: curr.getUTCDate(),
        dayName: arDay,
        status,
        checkInTime: dayData?.checkIn ? new Date(dayData.checkIn).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : undefined,
        checkOutTime: dayData?.checkOut ? new Date(dayData.checkOut).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : undefined,
        delayMinutes: delayMin,
        overtimeMinutes: otMin
      });

      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const workingDaysCount = totalPresentDays + totalAbsentDays;
    const punctualityRate = workingDaysCount > 0 ? Math.round((totalPresentDays / workingDaysCount) * 100) : 100;

    return {
      daysList,
      totalPresentDays,
      totalLateDays,
      totalAbsentDays,
      totalDelayMinutes,
      totalOvertimeMinutes,
      punctualityRate,
      relevantLogs
    };
  }, [fingerprintLogs, employee, startDate, endDate]);

  // 3. Employee Advances (السلف)
  const employeeAdvances = useMemo(() => {
    const list: Array<{ id: string; date: string; amount: number; note: string; source: string; treasuryId?: string }> = [];

    // From employee.financialRecords
    for (const rec of (employee.financialRecords || [])) {
      if (rec.type === 'advance') {
        const d = (rec.date || '').split('T')[0];
        if (d >= startDate && d <= endDate) {
          list.push({
            id: rec.id,
            date: rec.date,
            amount: Number(rec.amount) || 0,
            note: rec.note || 'سلفة موظف',
            source: 'سجل شؤون الموظفين',
            treasuryId: rec.treasuryId
          });
        }
      }
    }

    // From transactions
    for (const t of transactions) {
      if (t.type === 'expense' && (t.category === 'سلف العاملين' || t.category === 'hr_advance')) {
        const tDate = (t.date || '').split('T')[0];
        if (tDate >= startDate && tDate <= endDate) {
          const isTargetEmp = t.employeeId === employee.id || (t.notes && t.notes.includes(employee.name));
          if (isTargetEmp && !list.some(l => l.id === t.id)) {
            list.push({
              id: t.id,
              date: t.date,
              amount: Number(t.amount) || 0,
              note: t.notes || 'سلفة من الخزينة',
              source: 'حركة خزينة',
              treasuryId: t.treasuryId
            });
          }
        }
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employee.financialRecords, transactions, employee.id, employee.name, startDate, endDate]);

  const totalAdvances = useMemo(() => {
    return employeeAdvances.reduce((sum, a) => sum + a.amount, 0);
  }, [employeeAdvances]);

  // 4. Employee Paid Salaries (الرواتب المنصرفة)
  const employeeSalaries = useMemo(() => {
    const list: Array<{ id: string; date: string; amount: number; note: string; source: string; treasuryId?: string }> = [];

    // From employee.financialRecords
    for (const rec of (employee.financialRecords || [])) {
      if (rec.type === 'salary') {
        const d = (rec.date || '').split('T')[0];
        if (d >= startDate && d <= endDate) {
          list.push({
            id: rec.id,
            date: rec.date,
            amount: Number(rec.amount) || 0,
            note: rec.note || 'مسير راتب',
            source: 'مسير الرواتب',
            treasuryId: rec.treasuryId
          });
        }
      }
    }

    // From transactions
    for (const t of transactions) {
      if (t.type === 'expense' && (t.category === 'رواتب العاملين' || t.category === 'hr_salary')) {
        const tDate = (t.date || '').split('T')[0];
        if (tDate >= startDate && tDate <= endDate) {
          const isTargetEmp = t.employeeId === employee.id || (t.notes && t.notes.includes(employee.name));
          if (isTargetEmp && !list.some(l => l.id === t.id)) {
            list.push({
              id: t.id,
              date: t.date,
              amount: Number(t.amount) || 0,
              note: t.notes || 'صرف راتب من الخزينة',
              source: 'سند صرف خزينة',
              treasuryId: t.treasuryId
            });
          }
        }
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employee.financialRecords, transactions, employee.id, employee.name, startDate, endDate]);

  const totalSalariesPaid = useMemo(() => {
    return employeeSalaries.reduce((sum, s) => sum + s.amount, 0);
  }, [employeeSalaries]);

  // 5. Employee Deductions & Penalties (الخصومات والجزاءات)
  const employeeDeductions = useMemo(() => {
    const list: Array<{ id: string; date: string; type: string; amount: number; days?: number; note: string }> = [];

    for (const rec of (employee.financialRecords || [])) {
      if (rec.type === 'penalty_cash' || rec.type === 'penalty_days') {
        const d = (rec.date || '').split('T')[0];
        if (d >= startDate && d <= endDate) {
          const amount = rec.type === 'penalty_cash' 
            ? (Number(rec.amount) || 0)
            : ((Number(rec.days) || 0) * (employee.baseSalary > 0 ? employee.baseSalary / 30 : 0));
          list.push({
            id: rec.id,
            date: rec.date,
            type: rec.type === 'penalty_cash' ? 'خصم نقدي' : `خصم أيام (${rec.days || 1} يوم)`,
            amount,
            days: rec.days,
            note: rec.note || 'جزاء إداري'
          });
        }
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employee.financialRecords, employee.baseSalary, startDate, endDate]);

  const totalDeductions = useMemo(() => {
    return employeeDeductions.reduce((sum, d) => sum + d.amount, 0);
  }, [employeeDeductions]);

  // 6. Employee Bonuses & Rewards (المكافآت والحوافز)
  const employeeBonuses = useMemo(() => {
    const list: Array<{ id: string; date: string; amount: number; note: string }> = [];

    for (const rec of (employee.financialRecords || [])) {
      if (rec.type === 'bonus') {
        const d = (rec.date || '').split('T')[0];
        if (d >= startDate && d <= endDate) {
          list.push({
            id: rec.id,
            date: rec.date,
            amount: Number(rec.amount) || 0,
            note: rec.note || 'مكافأة أداء وتميز'
          });
        }
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employee.financialRecords, startDate, endDate]);

  const totalBonuses = useMemo(() => {
    return employeeBonuses.reduce((sum, b) => sum + b.amount, 0);
  }, [employeeBonuses]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer shadow-xs"
            title="العودة لقائمة الموظفين"
          >
            <ArrowRight size={16} />
            <span>العودة لقائمة الموظفين</span>
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">{employee.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                employee.isBlacklisted
                  ? 'bg-rose-100 text-rose-800'
                  : employee.endOfService
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {employee.isBlacklisted ? 'محظور (Blacklist)' : employee.endOfService ? 'منتهي الخدمة' : 'نشط 🟢'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold">{employee.role} | كود البصمة: #{employee.fingerprintCode || 'بدون بصمة'}</p>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {employee.isBlacklisted && onUnbanBlacklist && (
            <button
              type="button"
              onClick={() => onUnbanBlacklist(employee.id)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all animate-pulse"
              title="فك الحظر وإلغاء الموظف من القائمة السوداء"
            >
              <ShieldCheck size={14} />
              <span>إلغاء الحظر (فك البلاك ليست) 🔓</span>
            </button>
          )}
          {onOpenActionModal && (
            <>
              <button
                onClick={() => onOpenActionModal(employee.id, 'advance')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              >
                <Banknote size={13} />
                <span>سلفة</span>
              </button>
              <button
                onClick={() => onOpenActionModal(employee.id, 'penalty')}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              >
                <DollarSign size={13} />
                <span>خصم</span>
              </button>
              <button
                onClick={() => onOpenActionModal(employee.id, 'bonus')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              >
                <Gift size={13} />
                <span>مكافأة</span>
              </button>
            </>
          )}
          {onEditEmployee && (
            <button
              onClick={() => onEditEmployee(employee)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              <span>تعديل البيانات</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Profile Details Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden flex items-center justify-center font-black text-2xl text-white shadow-inner shrink-0">
              {employee.avatarUrl ? (
                <img src={employee.avatarUrl} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                <span>{employee.name.charAt(0)}</span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black">{employee.name}</h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/15 text-indigo-200 border border-white/10">
                  #{employee.fingerprintCode || '13'}
                </span>
              </div>
              <div className="text-xs text-indigo-200 font-bold">{employee.role}</div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 pt-1">
                {employee.email && (
                  <span className="flex items-center gap-1 font-mono">
                    <Mail size={12} className="text-indigo-400" />
                    <span>{employee.email}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-indigo-400" />
                  <span>الدوام: {employee.checkInTime || '09:00'} - {employee.checkOutTime || '18:00'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-indigo-400" />
                  <span>العطلة: {employee.weeklyDaysOff?.join('، ') || 'الجمعة'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full md:w-auto">
            <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center">
              <div className="text-[10px] text-indigo-300 font-bold mb-0.5">نوع الراتب</div>
              <div className="text-xs font-black">
                {employee.salaryType === 'commission_only' ? 'عمولة فقط' : employee.salaryType === 'salary_plus_commission' ? 'راتب + عمولة' : 'راتب ثابت'}
              </div>
              <div className="text-[11px] font-mono font-bold text-amber-300 mt-0.5">
                {employee.salaryType === 'commission_only' ? '0.00' : `${employee.baseSalary?.toFixed(2)} ${settings.currency}`}
              </div>
            </div>
            <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center">
              <div className="text-[10px] text-indigo-300 font-bold mb-0.5">نظام العمولة</div>
              <div className="text-xs font-black text-emerald-300">
                {getCommissionModelLabel(employee)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {employee.allowDualCommission ? 'احتساب العمولتين 🛡️' : 'نظام قياسي'}
              </div>
            </div>
            <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center col-span-2 sm:col-span-1">
              <div className="text-[10px] text-indigo-300 font-bold mb-0.5">رصيد الإجازات</div>
              <div className="text-xs font-black text-blue-300">
                {employee.availableVacations || 21} يوم متبقي
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">إجازة سنوية</div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range Selector Toolbar (افتراضياً الشهر الحالي مع إمكانية التخصيص) */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={18} className="text-indigo-600 shrink-0" />
          <span className="text-xs font-black text-slate-800">نطاق التقرير والبيانات:</span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => handleApplyPreset('today')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'today'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              اليوم (الوردية)
            </button>
            <button
              onClick={() => handleApplyPreset('yesterday')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'yesterday'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              أمس
            </button>
            <button
              onClick={() => handleApplyPreset('this_month')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'this_month'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => handleApplyPreset('last_month')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'last_month'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              الشهر السابق
            </button>
            <button
              onClick={() => handleApplyPreset('last_30')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'last_30'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              آخر 30 يوماً
            </button>
            <button
              onClick={() => handleApplyPreset('last_90')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === 'last_90'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              آخر 90 يوماً
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500">من:</span>
            <input 
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setActivePreset('custom'); }}
              className="bg-transparent text-xs font-mono font-bold text-slate-800 outline-none cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500">إلى:</span>
            <input 
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setActivePreset('custom'); }}
              className="bg-transparent text-xs font-mono font-bold text-slate-800 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Target Performance Tracker Card */}
      {targetCalc.targetAmount > 0 ? (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-900/60 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black">
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                  <span>مؤشر تحقيق التارجت ({activeTargetMode === 'daily' ? 'اليومي' : 'الشهري'})</span>
                  <span className="text-[10px] font-bold text-indigo-300 bg-indigo-900/60 border border-indigo-700/60 px-2 py-0.5 rounded-full">
                    {targetCalc.policyLabel}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {activeTargetMode === 'daily' 
                    ? (startDate === endDate 
                        ? `حساب التارجت اليومي ليوم التصفية المحدد: (${targetDateRange.start})`
                        : `حساب التارجت اليومي لتاريخ الوردية المفتوحة: (${targetDateRange.start})`)
                    : `حساب التارجت الشهري من أول الشهر لنهايته: (${targetDateRange.start} إلى ${targetDateRange.end})`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Daily vs Monthly Target Switcher */}
              <div className="flex bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setTargetModeOverride('daily')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTargetMode === 'daily' 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  تارجت يومي
                </button>
                <button
                  type="button"
                  onClick={() => setTargetModeOverride('monthly')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTargetMode === 'monthly' 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  تارجت شهري
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl mb-3">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold">المستهدف المسجل</p>
              <p className="text-base font-black text-white font-mono">
                {targetCalc.targetAmount.toFixed(2)} <span className="text-[10px] text-slate-400">{settings.currency}</span>
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-emerald-400 font-bold">
                {targetCalc.policy === 1 ? 'المحقق (بعد خصم الراتب)' : 'المبيعات المحققة'}
              </p>
              <p className="text-base font-black text-emerald-400 font-mono">
                {targetCalc.achievedAmount.toFixed(2)} <span className="text-[10px] text-slate-400">{settings.currency}</span>
              </p>
            </div>

            {targetCalc.policy === 1 ? (
              <div className="text-right">
                <p className="text-[10px] text-rose-400 font-bold">
                  خصم الراتب ({targetCalc.elapsedDays || 1} يوم)
                </p>
                <p className="text-sm font-black text-rose-400 font-mono">
                  -{targetCalc.baseSalaryDeduction.toFixed(2)} <span className="text-[10px] text-slate-400">{settings.currency}</span>
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  إجمالي الأعمال: {targetCalc.totalValidSales.toFixed(2)}
                </p>
              </div>
            ) : (
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold">إجمالي الأعمال</p>
                <p className="text-sm font-black text-slate-200 font-mono">
                  {targetCalc.totalValidSales.toFixed(2)} <span className="text-[10px] text-slate-400">{settings.currency}</span>
                </p>
              </div>
            )}

            <div className="text-right">
              <p className="text-[10px] text-indigo-300 font-bold">
                عمولة التارجت ({targetCalc.targetCommissionRate}%)
              </p>
              <p className="text-base font-black text-indigo-300 font-mono">
                {targetCalc.commissionAmount > 0 ? `+${targetCalc.commissionAmount.toFixed(2)}` : '0.00'} <span className="text-[10px] text-indigo-400">{settings.currency}</span>
              </p>
            </div>
          </div>

          {/* Progress Bar & Indicators */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-indigo-300 flex items-center gap-1">
                <TrendingUp size={13} className="text-emerald-400" />
                <span>نسبة التحقيق: <strong className="text-white font-mono">{targetCalc.achievementPercentage}%</strong></span>
              </span>
              <span className="text-slate-400 text-[11px]">
                {targetCalc.remainingToTarget > 0 ? (
                  <span>متبقي لتحقيق الهدف: <strong className="text-amber-400 font-mono">{targetCalc.remainingToTarget.toFixed(2)} {settings.currency}</strong></span>
                ) : (
                  <span className="text-emerald-400 font-black">🎉 تم تحقيق وتجاوز التارجت بنجاح!</span>
                )}
              </span>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  targetCalc.achievementPercentage >= 100 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/50' 
                    : targetCalc.achievementPercentage >= 60 
                    ? 'bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500' 
                    : 'bg-gradient-to-r from-amber-500 to-indigo-500'
                }`}
                style={{ width: `${Math.min(100, targetCalc.achievementPercentage)}%` }}
              ></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 rounded-2xl p-4 border border-slate-200 text-slate-500 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-slate-400 shrink-0" />
            <span>
              لم يتم تسجيل مستهدف تارجت ({activeTargetMode === 'daily' ? 'يومي' : 'شهري'}) لهذا الموظف في بياناته.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTargetModeOverride('daily')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTargetMode === 'daily' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                تارجت يومي
              </button>
              <button
                type="button"
                onClick={() => setTargetModeOverride('monthly')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTargetMode === 'monthly' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                تارجت شهري
              </button>
            </div>
            {onEditEmployee && (
              <button
                type="button"
                onClick={() => onEditEmployee(employee)}
                className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer mr-2"
              >
                تعديل وتحديد التارجت
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Metric Summary Cards for the Selected Period */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Work / Sales */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">إجمالي دخل الأعمال</span>
            <Scissors size={15} className="text-indigo-600" />
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {totalJobsRevenue.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">من الفواتير غير الملغية ({employeeJobs.length} خدمة)</div>
        </div>

        {/* Commissions Earned */}
        <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-emerald-800">العمولات المستحقة</span>
            <Award size={15} className="text-emerald-600" />
          </div>
          <div className="text-base font-black text-emerald-900 font-mono">
            {totalCommissionsEarned.toFixed(2)} <span className="text-[10px] text-emerald-700 font-normal">{settings.currency}</span>
          </div>
          <div className="text-[10px] text-emerald-700 mt-1">أرباح عمولة الفترة المحسوبة</div>
        </div>

        {/* Attendance Days */}
        <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-blue-800">أيام الحضور الفعلي</span>
            <CheckCircle2 size={15} className="text-blue-600" />
          </div>
          <div className="text-base font-black text-blue-900 font-mono">
            {attendanceAnalysis.totalPresentDays} <span className="text-[10px] text-blue-700 font-normal">يوم</span>
          </div>
          <div className="text-[10px] text-blue-700 mt-1">نسبة الانضباط: {attendanceAnalysis.punctualityRate}%</div>
        </div>

        {/* Advances */}
        <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-amber-800">سلف الفترة</span>
            <Banknote size={15} className="text-amber-600" />
          </div>
          <div className="text-base font-black text-amber-900 font-mono">
            {totalAdvances.toFixed(2)} <span className="text-[10px] text-amber-700 font-normal">{settings.currency}</span>
          </div>
          <div className="text-[10px] text-amber-700 mt-1">مسحوبة خلال المدة ({employeeAdvances.length} سلفة)</div>
        </div>

        {/* Salaries Paid */}
        <div className="p-3.5 bg-purple-50/70 rounded-2xl border border-purple-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-purple-800">رواتب صُرفت</span>
            <DollarSign size={15} className="text-purple-600" />
          </div>
          <div className="text-base font-black text-purple-900 font-mono">
            {totalSalariesPaid.toFixed(2)} <span className="text-[10px] text-purple-700 font-normal">{settings.currency}</span>
          </div>
          <div className="text-[10px] text-purple-700 mt-1">مسلمات ومسيرات الفترة</div>
        </div>

        {/* Delays */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">إجمالي التأخيرات</span>
            <Clock size={15} className="text-amber-600" />
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {attendanceAnalysis.totalDelayMinutes} <span className="text-[10px] text-slate-400 font-normal">دقيقة</span>
          </div>
          <div className="text-[10px] text-amber-600 font-bold mt-1">في {attendanceAnalysis.totalLateDays} يوم عمل</div>
        </div>

        {/* Overtime */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">أوفر تايم إضافي</span>
            <Timer size={15} className="text-indigo-600" />
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {(attendanceAnalysis.totalOvertimeMinutes / 60).toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">ساعة</span>
          </div>
          <div className="text-[10px] text-indigo-600 font-bold mt-1">({attendanceAnalysis.totalOvertimeMinutes} دقيقة إضافية)</div>
        </div>

        {/* Deductions */}
        <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-rose-800">خصومات وجزاءات</span>
            <TrendingDown size={15} className="text-rose-600" />
          </div>
          <div className="text-base font-black text-rose-900 font-mono">
            {totalDeductions.toFixed(2)} <span className="text-[10px] text-rose-700 font-normal">{settings.currency}</span>
          </div>
          <div className="text-[10px] text-rose-700 mt-1">{employeeDeductions.length} جزاء مسجل</div>
        </div>

        {/* Bonuses */}
        <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-emerald-800">مكافآت وحوافز</span>
            <Gift size={15} className="text-emerald-600" />
          </div>
          <div className="text-base font-black text-emerald-900 font-mono">
            {totalBonuses.toFixed(2)} <span className="text-[10px] text-emerald-700 font-normal">{settings.currency}</span>
          </div>
          <div className="text-[10px] text-emerald-700 mt-1">{employeeBonuses.length} مكافأة مسجلة</div>
        </div>
      </div>

      {/* Visual Attendance & Absence Chart & Daily Timeline (رسم بياني لحضور وغياب الموظف) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" />
            <h3 className="font-black text-slate-800 text-sm">مؤشر ورسم بياني لحضور وغياب الموظف للفترة المحددة</h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-600">حاضر بالموعد ({attendanceAnalysis.daysList.filter(d => d.status === 'present_ontime').length})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-slate-600">متأخر ({attendanceAnalysis.totalLateDays})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="text-slate-600">غائب ({attendanceAnalysis.totalAbsentDays})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span className="text-slate-400">عطلة ({attendanceAnalysis.daysList.filter(d => d.status === 'day_off').length})</span>
            </span>
          </div>
        </div>

        {/* Progress Bar Representation */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-slate-600">
            <span>نسبة الالتزام والانضباط الإجمالية</span>
            <span className="font-mono text-indigo-700">{attendanceAnalysis.punctualityRate}%</span>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div 
              style={{ width: `${attendanceAnalysis.punctualityRate}%` }} 
              className="bg-gradient-to-r from-emerald-500 to-indigo-600 transition-all duration-500 rounded-full"
            ></div>
          </div>
        </div>

        {/* Daily Grid Calendar Bar (أيام الشهر) */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 mb-2">التوزيع اليومي للحضور والغياب خلال المدة:</div>
          <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-31 gap-1.5">
            {attendanceAnalysis.daysList.map((d, idx) => {
              const bgClass = 
                d.status === 'present_ontime' ? 'bg-emerald-500 text-white border-emerald-600' :
                d.status === 'present_late' ? 'bg-amber-400 text-amber-950 border-amber-500' :
                d.status === 'absent' ? 'bg-rose-500 text-white border-rose-600' :
                d.status === 'day_off' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                'bg-slate-50 text-slate-300 border-dashed border-slate-200';

              const titleText = 
                d.status === 'present_ontime' ? `${d.dateStr} (${d.dayName}): حاضر في الموعد [${d.checkInTime || ''} - ${d.checkOutTime || ''}]` :
                d.status === 'present_late' ? `${d.dateStr} (${d.dayName}): متأخر ${d.delayMinutes} دقيقة [دخول: ${d.checkInTime || ''}]` :
                d.status === 'absent' ? `${d.dateStr} (${d.dayName}): غائب` :
                d.status === 'day_off' ? `${d.dateStr} (${d.dayName}): عطلة أسبوعية` :
                `${d.dateStr}: قادم`;

              return (
                <div 
                  key={idx}
                  title={titleText}
                  className={`p-1.5 rounded-xl border flex flex-col items-center justify-center text-center cursor-help transition-transform hover:scale-105 shadow-2xs ${bgClass}`}
                >
                  <span className="text-[11px] font-black">{d.dayNumber}</span>
                  <span className="text-[8px] font-semibold truncate max-w-full opacity-90">{d.dayName.slice(0, 3)}</span>
                  {d.delayMinutes > 0 && (
                    <span className="text-[8px] font-bold bg-amber-950/20 px-1 rounded mt-0.5">+{d.delayMinutes}د</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail Section Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveSection('jobs')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSection === 'jobs'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
            }`}
          >
            <Scissors size={14} />
            <span>جدول أعمال وعمولات الموظف ({employeeJobs.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('attendance')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSection === 'attendance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
            }`}
          >
            <Clock size={14} />
            <span>سجل الحضور والتأخيرات ({attendanceAnalysis.totalLateDays} تأخير)</span>
          </button>

          <button
            onClick={() => setActiveSection('advances')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSection === 'advances'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
            }`}
          >
            <Banknote size={14} />
            <span>جدول السلف ({employeeAdvances.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('salaries')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSection === 'salaries'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
            }`}
          >
            <DollarSign size={14} />
            <span>الرواتب المنصرفة ({employeeSalaries.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('overtime')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSection === 'overtime'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
            }`}
          >
            <Timer size={14} />
            <span>أوفر تايم (إضافي)</span>
          </button>

          <button
            onClick={() => setActiveSection('deductions')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSection === 'deductions'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
            }`}
          >
            <TrendingDown size={14} />
            <span>الخصومات والجزاءات ({employeeDeductions.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('bonuses')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSection === 'bonuses'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
            }`}
          >
            <Gift size={14} />
            <span>المكافآت والحوافز ({employeeBonuses.length})</span>
          </button>
        </div>

        {/* Tab 1: JOBS & COMMISSIONS TABLE */}
        {activeSection === 'jobs' && (
          <div className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h4 className="font-black text-slate-800 text-xs">كشف أعمال وخدمات الموظف من واقع الفواتير السارية غير الملغية</h4>
                <p className="text-[11px] text-slate-400">يتم احتساب عمولة كل خدمة مباشرة وفق نموذج ونسب عمولات الموظف</p>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span>الإجمالي: <strong className="text-slate-900 font-mono">{totalJobsRevenue.toFixed(2)}</strong> {settings.currency}</span>
                <span className="text-slate-300">|</span>
                <span>العمولة: <strong className="text-emerald-700 font-mono">{totalCommissionsEarned.toFixed(2)}</strong> {settings.currency}</span>
              </div>
            </div>

            {employeeJobs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                لا توجد خدمات أو مبيعات منفذة بواسطة هذا الموظف خلال الفترة المحددة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">التاريخ والوقت</th>
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">العميل</th>
                      <th className="p-3">الخدمة / المنتج</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3">السعر</th>
                      <th className="p-3">العمولة المستحقة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeJobs.map((job, idx) => (
                      <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono text-slate-600" dir="ltr">
                          {new Date(job.invoiceDate).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-3 font-mono font-bold text-indigo-700">#{job.invoiceId}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{job.clientName}</div>
                          {job.clientPhone && <div className="text-[10px] text-slate-400 font-mono">{job.clientPhone}</div>}
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          {job.serviceName}
                          {job.isReferral && (
                            <span className="mr-1.5 px-1.5 py-0.5 rounded text-[9px] bg-purple-50 text-purple-700 font-bold">
                              إحالة
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold">{job.quantity}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">{job.itemTotal.toFixed(2)} {settings.currency}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700 bg-emerald-50/40">
                          +{job.commissionAmount.toFixed(2)} {settings.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={6} className="p-3 text-left">الإجمالي الكلي للفترة:</td>
                      <td className="p-3 font-mono text-slate-900">{totalJobsRevenue.toFixed(2)} {settings.currency}</td>
                      <td className="p-3 font-mono text-emerald-700">+{totalCommissionsEarned.toFixed(2)} {settings.currency}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: ATTENDANCE & DELAYS TABLE */}
        {activeSection === 'attendance' && (
          <div className="p-4 space-y-3">
            <div>
              <h4 className="font-black text-slate-800 text-xs">سجل الحضور اليومي والتأخيرات خلال الفترة</h4>
              <p className="text-[11px] text-slate-400">مواعيد الدوام الرسمية للموظف: من {employee.checkInTime || '09:00'} إلى {employee.checkOutTime || '18:00'}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">اليوم والتاريخ</th>
                    <th className="p-3">وقت الحضور الفعلي</th>
                    <th className="p-3">وقت الانصراف الفعلي</th>
                    <th className="p-3">التأخير (بالدقائق)</th>
                    <th className="p-3">الإضافي (أوفر تايم)</th>
                    <th className="p-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceAnalysis.daysList.filter(d => d.status !== 'future').map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        <span>{d.dayName}</span> <span className="font-mono text-slate-500 font-normal">({d.dateStr})</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {d.checkInTime || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {d.checkOutTime || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="p-3">
                        {d.delayMinutes > 0 ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-mono font-black rounded-md text-[11px]">
                            متأخر {d.delayMinutes} دقيقة
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">0</span>
                        )}
                      </td>
                      <td className="p-3">
                        {d.overtimeMinutes > 0 ? (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 font-mono font-black rounded-md text-[11px]">
                            +{d.overtimeMinutes} دقيقة
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {d.status === 'present_ontime' && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">
                            حاضر بالموعد 🟢
                          </span>
                        )}
                        {d.status === 'present_late' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">
                            متأخر 🟡
                          </span>
                        )}
                        {d.status === 'absent' && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]">
                            غائب 🔴
                          </span>
                        )}
                        {d.status === 'day_off' && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-full text-[10px]">
                            عطلة أسبوعية ⚪
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: ADVANCES TABLE */}
        {activeSection === 'advances' && (
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-black text-slate-800 text-xs">كشف سلف ومسحوبات الموظف خلال الفترة</h4>
                <p className="text-[11px] text-slate-400">إجمالي السلف المسحوبة: {totalAdvances.toFixed(2)} {settings.currency}</p>
              </div>
              {onOpenActionModal && (
                <button
                  onClick={() => onOpenActionModal(employee.id, 'advance')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Banknote size={14} />
                  <span>تسجيل سلفة جديدة</span>
                </button>
              )}
            </div>

            {employeeAdvances.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                لا توجد سلف مسجلة للموظف خلال الفترة المحددة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">المصدر / الخزنة</th>
                      <th className="p-3">البيان والملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeAdvances.map((adv, idx) => (
                      <tr key={adv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-800" dir="ltr">
                          {new Date(adv.date).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="p-3 font-mono font-black text-amber-700 text-sm">
                          {adv.amount.toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-3 text-slate-600 font-semibold">{adv.source}</td>
                        <td className="p-3 text-slate-700 font-semibold">{adv.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={2} className="p-3 text-left">إجمالي السلف:</td>
                      <td colSpan={3} className="p-3 font-mono text-amber-800 text-sm">{totalAdvances.toFixed(2)} {settings.currency}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: PAID SALARIES TABLE */}
        {activeSection === 'salaries' && (
          <div className="p-4 space-y-3">
            <div>
              <h4 className="font-black text-slate-800 text-xs">كشف الرواتب والمسيرات المصروفة للموظف خلال الفترة</h4>
              <p className="text-[11px] text-slate-400">إجمالي الرواتب المصروفة: {totalSalariesPaid.toFixed(2)} {settings.currency}</p>
            </div>

            {employeeSalaries.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                لا توجد رواتب منصرفة مسجلة للموظف خلال الفترة المحددة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">تاريخ الصرف</th>
                      <th className="p-3">الراتب الصافي المصروف</th>
                      <th className="p-3">المصدر</th>
                      <th className="p-3">البيان والتفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeSalaries.map((sal, idx) => (
                      <tr key={sal.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-800" dir="ltr">
                          {new Date(sal.date).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="p-3 font-mono font-black text-purple-700 text-sm">
                          {sal.amount.toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-3 text-slate-600 font-semibold">{sal.source}</td>
                        <td className="p-3 text-slate-700 font-semibold">{sal.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={2} className="p-3 text-left">إجمالي الرواتب المصروفة:</td>
                      <td colSpan={3} className="p-3 font-mono text-purple-800 text-sm">{totalSalariesPaid.toFixed(2)} {settings.currency}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: OVERTIME */}
        {activeSection === 'overtime' && (
          <div className="p-4 space-y-3">
            <div>
              <h4 className="font-black text-slate-800 text-xs">كشف ساعات العمل الإضافية (أوفر تايم)</h4>
              <p className="text-[11px] text-slate-400">تحسب الساعات الإضافية تلقائياً عند تسجيل الانصراف بعد موعد نهاية الدوام الرسمي</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">نهاية الدوام الرسمي</th>
                    <th className="p-3">وقت الانصراف الفعلي</th>
                    <th className="p-3">المدة الإضافية</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceAnalysis.daysList.filter(d => d.overtimeMinutes > 0).map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-bold text-slate-800">{d.dayName} ({d.dateStr})</td>
                      <td className="p-3 font-mono text-slate-600">{employee.checkOutTime || '18:00'}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{d.checkOutTime}</td>
                      <td className="p-3 font-mono font-black text-indigo-800 text-sm">
                        +{d.overtimeMinutes} دقيقة ({(d.overtimeMinutes / 60).toFixed(1)} س)
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                          إضافي موثق ✓
                        </span>
                      </td>
                    </tr>
                  ))}
                  {attendanceAnalysis.daysList.filter(d => d.overtimeMinutes > 0).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        لا توجد ساعات عمل إضافية مسجلة خلال الفترة المحددة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: DEDUCTIONS */}
        {activeSection === 'deductions' && (
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-black text-slate-800 text-xs">كشف الخصومات والجزاءات الإدارية</h4>
                <p className="text-[11px] text-slate-400">إجمالي الخصومات: {totalDeductions.toFixed(2)} {settings.currency}</p>
              </div>
              {onOpenActionModal && (
                <button
                  onClick={() => onOpenActionModal(employee.id, 'penalty')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <DollarSign size={14} />
                  <span>تسجيل خصم / جزاء</span>
                </button>
              )}
            </div>

            {employeeDeductions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                لا توجد خصومات أو جزاءات مسجلة على هذا الموظف خلال الفترة المحددة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">نوع الخصم</th>
                      <th className="p-3">القيمة المحسومة</th>
                      <th className="p-3">السبب والبيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeDeductions.map((ded, idx) => (
                      <tr key={ded.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-800" dir="ltr">
                          {new Date(ded.date).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md text-[11px]">
                            {ded.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-black text-rose-700 text-sm">
                          -{ded.amount.toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-3 text-slate-700 font-semibold">{ded.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={3} className="p-3 text-left">إجمالي الخصومات:</td>
                      <td colSpan={2} className="p-3 font-mono text-rose-800 text-sm">-{totalDeductions.toFixed(2)} {settings.currency}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: BONUSES */}
        {activeSection === 'bonuses' && (
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-black text-slate-800 text-xs">كشف المكافآت والحوافز التقديرية</h4>
                <p className="text-[11px] text-slate-400">إجمالي المكافآت: {totalBonuses.toFixed(2)} {settings.currency}</p>
              </div>
              {onOpenActionModal && (
                <button
                  onClick={() => onOpenActionModal(employee.id, 'bonus')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Gift size={14} />
                  <span>تسجيل مكافأة جديدة</span>
                </button>
              )}
            </div>

            {employeeBonuses.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                لا توجد مكافآت مسجلة للموظف خلال الفترة المحددة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">قيمة المكافأة</th>
                      <th className="p-3">المناسبة والسبب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeBonuses.map((bon, idx) => (
                      <tr key={bon.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-800" dir="ltr">
                          {new Date(bon.date).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="p-3 font-mono font-black text-emerald-700 text-sm">
                          +{bon.amount.toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-3 text-slate-700 font-semibold">{bon.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={2} className="p-3 text-left">إجمالي المكافآت:</td>
                      <td colSpan={2} className="p-3 font-mono text-emerald-800 text-sm">+{totalBonuses.toFixed(2)} {settings.currency}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
