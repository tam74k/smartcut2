import React, { useState, useMemo, useEffect } from 'react';
import { 
  AppSettings, Employee, Invoice, Transaction, Booking, ServiceItem, Product, 
  HRSettings, FingerprintLog, SalaryHistoryEntry, ShiftScheduleEntry, EmployeeFinancialRecord,
  EmployeeLeaveRecord 
} from '../types';
import { 
  Calendar, Clock, CheckCircle, AlertTriangle, Printer, User, Filter, 
  RotateCcw, Sparkles, Plus, CheckSquare, Square, FileText, Ban, ShieldAlert,
  ChevronLeft, ChevronRight, Download, DollarSign, Award, ArrowUpRight, Check, X, Wallet,
  Edit, Trash2, TrendingUp, History, Percent, Coins, Palmtree, RefreshCw
} from 'lucide-react';

import { ThermalSalarySlip, SalarySlipSummary } from './ThermalSalarySlip';
import { printHtml } from '../utils/print';
import { printThermalFinancialVoucher } from './ThermalFinancialVoucher';
import { calculateEmployeeCommission, getCommissionModelLabel } from '../utils/commissionHelper';
import { DB } from '../services/db';

// Helper to reliably match date strings (YYYY-MM-DD) across ISO strings, space-delimited timestamps, and local timezone
const isSameDay = (ts?: string, targetDateStr?: string): boolean => {
  if (!ts || !targetDateStr) return false;
  if (ts.startsWith(targetDateStr)) return true;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return false;
    const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return localDateStr === targetDateStr;
  } catch {
    return false;
  }
};

const extractTime = (ts?: string): string | null => {
  if (!ts) return null;
  if (ts.includes('T')) {
    return ts.split('T')[1].substring(0, 5);
  }
  const parts = ts.split(' ');
  return parts[1] ? parts[1].substring(0, 5) : null;
};

const formatTime12h = (timeStr?: string): string => {
  if (!timeStr) return '';
  const clean = timeStr.replace(' (+1)', '').substring(0, 5);
  const parts = clean.split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const period = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const getNextDateStr = (dateStr: string): string => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface DayTimesheetRow {
  dateStr: string; // YYYY-MM-DD
  dayNameArabic: string;
  employee: Employee;
  fingerprintCode: string;
  employeeName: string;
  dailyRate: number;
  checkIn: string | null;
  checkOut: string | null;
  status: 'regular' | 'absent' | 'weekly_off' | 'paid_leave' | 'unpaid_leave' | 'terminated';
  statusLabel: string;
  hasManualOrDeviceLog?: boolean;
  permissionStart?: string;
  permissionEnd?: string;
  permissionMinutes: number;
  permissionExcusedMinutes?: number;
  permissionDeductedMinutes?: number;
  permissionDeduction: number;
  workedHoursFormatted: string;
  delayMinutes: number;

  delayDeduction: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  isOvertimeApproved: boolean;
  specialPenalty: number;
  absenceDeduction: number;
  advances: number;
  bonuses: number;
  workRevenue: number;
  commissionAmount: number;
  openingCommission?: number;
  commissionPaid: number;
  isDelayForgiven: boolean;
  netDaily: number;
}

export function HRScreen({ 
  settings, 
  employees, 
  setEmployees,
  invoices = [],
  transactions = [],
  setTransactions,
  bookings = [],
  currentUser,
  fingerprintLogs = [],
  setFingerprintLogs
}: { 
  settings: AppSettings;
  employees: Employee[]; 
  setEmployees: (e: Employee[]) => void;
  invoices?: Invoice[];
  transactions?: Transaction[];
  setTransactions?: (t: Transaction[]) => void;
  bookings?: Booking[];
  currentUser?: any;
  fingerprintLogs?: FingerprintLog[];
  setFingerprintLogs?: React.Dispatch<React.SetStateAction<FingerprintLog[]>> | ((logs: FingerprintLog[] | ((prev: FingerprintLog[]) => FingerprintLog[])) => void);
}) {
  const activeEmployees = employees.filter(e => !e.isBlacklisted);
  
  // View mode: 'single_employee' | 'single_day'
  const [viewMode, setViewMode] = useState<'single_employee' | 'single_day'>('single_employee');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(activeEmployees[0]?.id || '');

  // Synchronize selectedEmpId whenever activeEmployees changes if currently unset or invalid
  useEffect(() => {
    if ((!selectedEmpId || !activeEmployees.some(e => e.id === selectedEmpId)) && activeEmployees.length > 0) {
      setSelectedEmpId(activeEmployees[0].id);
    }
  }, [activeEmployees, selectedEmpId]);

  // Fallback internal logs state to guarantee resilience if prop is missing or setter is undefined
  const [localLogs, setLocalLogs] = useState<FingerprintLog[]>(fingerprintLogs || []);

  useEffect(() => {
    if (fingerprintLogs && fingerprintLogs.length > 0) {
      setLocalLogs(fingerprintLogs);
    }
  }, [fingerprintLogs]);

  const effectiveFingerprintLogs = useMemo(() => {
    return (fingerprintLogs && fingerprintLogs.length > 0) ? fingerprintLogs : localLogs;
  }, [fingerprintLogs, localLogs]);
  
  // Date filters
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);
  const [startDate, setStartDate] = useState(`${currentYearMonth}-01`);
  const [endDate, setEndDate] = useState(`${currentYearMonth}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`);
  const [selectedSingleDay, setSelectedSingleDay] = useState(now.toISOString().split('T')[0]);

  // Delay forgiveness & Overtime overrides local state (keyed by employeeId + date)
  const [overrides, setOverrides] = useState<{ [key: string]: { isDelayForgiven?: boolean; isOvertimeApproved?: boolean } }>({});
  
  // Print Modal State
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [activeSlipSummary, setActiveSlipSummary] = useState<SalarySlipSummary | null>(null);

  // Manual Attendance Modal
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    empId: selectedEmpId || activeEmployees[0]?.id || '',
    date: selectedSingleDay,
    checkIn: '09:00',
    checkOut: '18:00',
    isNextDayCheckout: false,
    status: 'regular',
    notes: ''
  });

  // Salary Increment Modal State
  const [showSalaryIncrementModal, setShowSalaryIncrementModal] = useState(false);
  const [incrementMode, setIncrementMode] = useState<'single' | 'bulk'>('single');
  const [targetEmpId, setTargetEmpId] = useState<string>(activeEmployees[0]?.id || '');
  const [selectedEmpIdsForBulk, setSelectedEmpIdsForBulk] = useState<string[]>(activeEmployees.map(e => e.id));
  const [incrementType, setIncrementType] = useState<'fixed' | 'percentage'>('percentage');
  const [incrementValue, setIncrementValue] = useState<number | ''>(10);
  const [effectiveDate, setEffectiveDate] = useState<string>(now.toISOString().split('T')[0]);
  const [incrementReason, setIncrementReason] = useState<string>('ترقية / علاوة سنوية');
  const [approvedBy, setApprovedBy] = useState<string>(currentUser?.name || 'مدير النظام');

  const [historyEmpFilter, setHistoryEmpFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [showSalaryHistoryModal, setShowSalaryHistoryModal] = useState(false);

  // Auto-Refresh & Manual Refresh State
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Fetch / Sync fingerprint logs directly from Supabase with auto-refresh every 10s and visibility change
  const refreshFingerprintLogs = async (showLoadingState = false) => {
    const sId = settings.salonId;
    if (!sId) return;

    if (showLoadingState) setIsRefreshingLogs(true);
    try {
      // 1. Fetch fresh fingerprint logs for the salon
      const logs = await DB.fetchFingerprintLogs(sId);
      if (logs && Array.isArray(logs)) {
        if (setFingerprintLogs) {
          setFingerprintLogs(logs);
        }
        setLocalLogs(logs);
      }

      // 2. Fetch fresh employees to update any changes (leaves, shifts, base salary)
      const freshEmployees = await DB.fetchEmployees(sId);
      if (freshEmployees && Array.isArray(freshEmployees) && freshEmployees.length > 0) {
        setEmployees(freshEmployees);
      }

      const nowTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(nowTime);
    } catch (err) {
      console.warn('[HRScreen] Error refreshing fingerprint logs:', err);
    } finally {
      if (showLoadingState) setIsRefreshingLogs(false);
    }
  };

  useEffect(() => {
    const sId = settings.salonId;
    if (!sId) return;

    let isSubscribed = true;

    // Initial fetch on mount or salonId change
    refreshFingerprintLogs();

    // Periodic auto-sync every 10 seconds
    const intervalId = setInterval(() => {
      if (!document.hidden && isSubscribed) {
        refreshFingerprintLogs();
      }
    }, 10000);

    // Visibility API: Refresh immediately when tab/window becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden && isSubscribed) {
        refreshFingerprintLogs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.salonId]);

  const handleApplySalaryIncrement = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(incrementValue);
    if (!val || val <= 0) {
      alert('الرجاء إدخال قيمة زيادة صالحة أكبر من صفر');
      return;
    }

    const targetIds = incrementMode === 'single' ? [targetEmpId] : selectedEmpIdsForBulk;
    if (targetIds.length === 0) {
      alert('الرجاء اختيار موظف واحد على الأقل لتطبيق الزيادة');
      return;
    }

    const updatedEmployeesList: Employee[] = [];
    const newEmployees = employees.map(emp => {
      if (!targetIds.includes(emp.id)) return emp;

      const currentBase = Number(emp.baseSalary) || 0;
      let increaseAmt = 0;
      let increasePct = 0;

      if (incrementType === 'percentage') {
        increasePct = val;
        increaseAmt = (currentBase * val) / 100;
      } else {
        increaseAmt = val;
        increasePct = currentBase > 0 ? (val / currentBase) * 100 : 0;
      }

      const newBase = currentBase + increaseAmt;
      const newHistoryEntry: SalaryHistoryEntry = {
        id: 'INC-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        date: effectiveDate,
        previousSalary: currentBase,
        newSalary: newBase,
        increaseAmount: increaseAmt,
        increasePercentage: Number(increasePct.toFixed(2)),
        increaseType: incrementType,
        reason: incrementReason.trim() || 'زيادة راتب معتمدة',
        approvedBy: approvedBy.trim() || currentUser?.name || 'مدير النظام',
        createdAt: new Date().toISOString()
      };

      const updatedEmp: Employee = {
        ...emp,
        baseSalary: newBase,
        salaryHistory: [...(emp.salaryHistory || []), newHistoryEntry]
      };

      updatedEmployeesList.push(updatedEmp);
      return updatedEmp;
    });

    setEmployees(newEmployees);

    // Save each updated employee to Supabase
    for (const emp of updatedEmployeesList) {
      await DB.saveEmployee(emp);
    }

    alert(`✅ تم تطبيق وحفظ زيادة الراتب بنجاح لـ (${updatedEmployeesList.length}) موظف، وتوثيق كافة الحركات في قاعدة البيانات وسجل تاريخ الزيادات.`);
    setShowSalaryIncrementModal(false);
  };



  // Effective HR settings
  const hrConfig: HRSettings = settings.hrSettings || {
    overtimeRateType: '1.5x',
    overtimeGraceMinutes: 30,
    delayTier1Deduction: 5,
    delayTier2Deduction: 15,
    delayTier3Deduction: 25,
    delayTier4Deduction: 50,
    delayAbsenceThresholdHours: 2,
    maxMonthlyPermissions: 2,
    maxMonthlyPermissionHours: 2,
    weeklyOffPaid: true,
    weeklyOffPaidType: 'paid',
    absenceDeductionDays: 1
  };

  const getDaysInMonth = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };

  /**
   * Calculates the active monthly salary of an employee on a specific date
   * by inspecting their salaryHistory progression.
   */
  const getActiveSalaryForDate = (emp: Employee, targetDateStr: string): number => {
    if (emp.salaryType === 'commission_only') return 0;
    
    const history = emp.salaryHistory;
    if (!history || history.length === 0) {
      return emp.baseSalary || 0;
    }

    // Sort salary history entries chronologically ascending
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

    // Find the latest increment effective on or before targetDateStr
    let activeSalary: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].date <= targetDateStr) {
        activeSalary = sorted[i].newSalary;
      }
    }

    if (activeSalary !== null && activeSalary > 0) {
      return activeSalary;
    }

    // If targetDateStr is before the first recorded increment, active salary was previousSalary of the first record
    if (sorted[0] && sorted[0].previousSalary > 0) {
      return sorted[0].previousSalary;
    }

    return emp.baseSalary || 0;
  };

  /**
   * Calculates the scheduled check-in and check-out time of an employee on a specific date
   * by inspecting their shiftScheduleHistory progression.
   */
  const getScheduledShiftForDate = (emp: Employee, targetDateStr: string) => {
    const history = emp.shiftScheduleHistory;
    if (!history || history.length === 0) {
      return {
        checkInTime: emp.checkInTime || '09:00',
        checkOutTime: emp.checkOutTime || '18:00',
        weeklyDaysOff: emp.weeklyDaysOff || ['Friday']
      };
    }

    // Sort shift schedule history entries chronologically ascending
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

    // Find the latest shift modification effective on or before targetDateStr
    let activeSchedule: ShiftScheduleEntry | null = null;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].date <= targetDateStr) {
        activeSchedule = sorted[i];
      }
    }

    if (activeSchedule) {
      return {
        checkInTime: activeSchedule.checkInTime || emp.checkInTime || '09:00',
        checkOutTime: activeSchedule.checkOutTime || emp.checkOutTime || '18:00',
        weeklyDaysOff: activeSchedule.weeklyDaysOff || emp.weeklyDaysOff || ['Friday']
      };
    }

    // If targetDateStr is before the first recorded shift modification, active schedule was previousCheckInTime / previousCheckOutTime of the first record
    if (sorted[0]) {
      return {
        checkInTime: sorted[0].previousCheckInTime || emp.checkInTime || '09:00',
        checkOutTime: sorted[0].previousCheckOutTime || emp.checkOutTime || '18:00',
        weeklyDaysOff: sorted[0].weeklyDaysOff || emp.weeklyDaysOff || ['Friday']
      };
    }

    return {
      checkInTime: emp.checkInTime || '09:00',
      checkOutTime: emp.checkOutTime || '18:00',
      weeklyDaysOff: emp.weeklyDaysOff || ['Friday']
    };
  };

  const getDayNameArabic = (date: Date) => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  };

  const getDayNameEnglish = (date: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Build Date Range
  const dateRangeList = useMemo(() => {
    if (viewMode === 'single_day') {
      return [selectedSingleDay];
    }
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [viewMode, startDate, endDate, selectedSingleDay]);

  // Main Calculation Engine for Rows
  const timesheetRows: DayTimesheetRow[] = useMemo(() => {
    const rows: DayTimesheetRow[] = [];
    const targetEmployees = viewMode === 'single_employee' 
      ? activeEmployees.filter(e => e.id === selectedEmpId)
      : activeEmployees;

    targetEmployees.forEach(emp => {
      const isCommissionOnly = emp.salaryType === 'commission_only';
      let accumulatedPermissionMinutes = 0;
      const maxMonthlyPermissionMinutes = (hrConfig.maxMonthlyPermissionHours ?? 2) * 60;

      // Sort dates chronologically to ensure accurate monthly permission accumulation
      const sortedDates = [...dateRangeList].sort((a, b) => a.localeCompare(b));

      sortedDates.forEach(dateStr => {
        const rowDate = new Date(dateStr);
        const dayNameAr = getDayNameArabic(rowDate);
        const dayNameEn = getDayNameEnglish(rowDate);
        const key = `${emp.id}_${dateStr}`;
        const override = overrides[key] || {};

        // Active shift schedule on that specific date
        const shiftSchedule = getScheduledShiftForDate(emp, dateStr);
        const scheduledCheckIn = shiftSchedule.checkInTime;
        const scheduledCheckOut = shiftSchedule.checkOutTime;

        // Calculate days in the specific month of dateStr & active salary on that exact date
        const rowMonthDays = new Date(rowDate.getFullYear(), rowDate.getMonth() + 1, 0).getDate();
        const activeMonthlySalary = getActiveSalaryForDate(emp, dateStr);
        const baseDailyRate = isCommissionOnly ? 0 : (activeMonthlySalary > 0 ? activeMonthlySalary / rowMonthDays : 0);

        // 1. Check End of Service
        const isTerminated = emp.endOfService?.terminationDate && dateStr >= emp.endOfService.terminationDate;
        
        // 2. Check Leaves
        const leave = emp.leaveRecords?.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
        const isWeeklyOff = (shiftSchedule.weeklyDaysOff || emp.weeklyDaysOff || ['Friday']).includes(dayNameEn);

        // 3. Permissions on this date & Monthly Accumulator
        const permission = emp.permissionRecords?.find(p => p.date === dateStr);
        const permissionMinutes = permission ? (Number(permission.durationMinutes) || 0) : 0;
        let permissionExcusedMinutes = 0;
        let permissionDeductedMinutes = 0;
        let permissionDeduction = 0;

        if (permissionMinutes > 0) {
          if (permission?.isExcused) {
            permissionExcusedMinutes = permissionMinutes;
            permissionDeductedMinutes = 0;
            permissionDeduction = 0;
          } else {
            const remainingFreeMinutes = Math.max(0, maxMonthlyPermissionMinutes - accumulatedPermissionMinutes);
            permissionExcusedMinutes = Math.min(permissionMinutes, remainingFreeMinutes);
            permissionDeductedMinutes = Math.max(0, permissionMinutes - permissionExcusedMinutes);
            accumulatedPermissionMinutes += permissionMinutes;

            if (permissionDeductedMinutes > 0 && baseDailyRate > 0) {
              // Rate per minute based on 8-hour workday
              const minuteRate = (baseDailyRate / 8) / 60;
              permissionDeduction = permissionDeductedMinutes * minuteRate;
            }
          }
        }

        // 4. Invoices & Sales on this date
        const dayInvoices = invoices.filter(inv => inv.date?.startsWith(dateStr));
        let workRevenue = 0;
        let invoiceReferralCommission = 0;

        dayInvoices.forEach(inv => {
          inv.items?.forEach(item => {
            if (item.employeeId === emp.id) {
              const itemTotal = (item.price || 0) * (item.quantity || 1);
              workRevenue += itemTotal;
            }
            if ((item.referralEmployeeId && item.referralEmployeeId === emp.id) || (!item.referralEmployeeId && item.referralEmployeeName && item.referralEmployeeName === emp.name)) {
              const qty = item.quantity || 1;
              const refComm = (item.referralCommissionAmount !== undefined && item.referralCommissionAmount > 0)
                ? (item.referralCommissionAmount * qty)
                : 0;
              invoiceReferralCommission += refComm;
            }
          });
        });

        const executionCommission = (emp.salaryType === 'commission_only' || emp.allowDualCommission || emp.commissionRate > 0 || emp.commissionModel === 'tiered_brackets')
          ? calculateEmployeeCommission(emp, workRevenue)
          : 0;

        // 5. Financial records (Advances, Bonuses, Penalties, Direct Service/Referral Commissions, Paid Commissions)
        let advances = 0;
        let bonuses = 0;
        let specialPenalty = 0;
        let directCommissions = 0;
        let financialReferralCommissions = 0;
        let commissionPaid = 0;

        emp.financialRecords?.filter(r => r.date?.startsWith(dateStr)).forEach(r => {
          if (r.type === 'advance') advances += (r.amount || 0);
          if (r.type === 'bonus') bonuses += (r.amount || 0);
          if (r.type === 'penalty_cash') specialPenalty += (r.amount || 0);
          if (r.type === 'penalty_days') specialPenalty += (r.days || 0) * baseDailyRate;
          if (r.type === 'commission') directCommissions += (r.amount || 0);
          if (r.type === 'referral_commission') financialReferralCommissions += (r.amount || 0);
          if (r.type === 'commission_payout') commissionPaid += (r.amount || 0);
        });

        // Combine referral commissions (avoid double-counting if recorded in both invoice item & financial records)
        const totalReferralCommission = Math.max(invoiceReferralCommission, financialReferralCommissions);
        const totalDailyCommission = executionCommission + totalReferralCommission + directCommissions;

        // Determine Status, Attendance, Delays, Overtime
        let status: DayTimesheetRow['status'] = 'regular';
        let statusLabel = 'حضور';
        let checkIn: string | null = null;
        let checkOut: string | null = null;
        let workedHoursFormatted = '--:--:--';
        let delayMinutes = 0;
        let delayDeduction = 0;
        let overtimeMinutes = 0;
        let overtimeAmount = 0;
        let absenceDeduction = 0;
        const dailyRate = isTerminated ? 0 : baseDailyRate;

        // Check actual fingerprint / attendance logs for this employee on dateStr
        const dayLogs = (effectiveFingerprintLogs || []).filter(l => 
          (l.employeeId === emp.id || (emp.fingerprintCode && l.fingerprintCode === emp.fingerprintCode)) &&
          isSameDay(l.timestamp, dateStr)
        ).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        // Also check if there is an early-morning check_out on the NEXT day (belonging to overnight shift)
        const nextDateStr = getNextDateStr(dateStr);
        const nextDayEarlyCheckOut = (effectiveFingerprintLogs || []).find(l => 
          (l.employeeId === emp.id || (emp.fingerprintCode && l.fingerprintCode === emp.fingerprintCode)) &&
          l.type === 'check_out' &&
          isSameDay(l.timestamp, nextDateStr) &&
          (() => {
            const time = extractTime(l.timestamp);
            if (!time) return false;
            const hour = Number(time.split(':')[0]);
            return hour < 10; // Early morning hours (00:00 - 09:59)
          })()
        );

        // Get check_in log and check_out log accurately
        const checkInLogs = dayLogs.filter(l => l.type === 'check_in');
        const checkOutLogs = dayLogs.filter(l => l.type === 'check_out');

        const checkInLog = checkInLogs[checkInLogs.length - 1] || (dayLogs.length > 0 && !checkOutLogs.includes(dayLogs[0]) ? dayLogs[0] : null);
        let checkOutLog = checkOutLogs[checkOutLogs.length - 1] || (dayLogs.length > 1 && dayLogs[dayLogs.length - 1] !== checkInLog ? dayLogs[dayLogs.length - 1] : null);

        // If no checkout found on same day, use the next day early checkout if available
        let isNextDayLog = false;
        if (!checkOutLog && nextDayEarlyCheckOut) {
          checkOutLog = nextDayEarlyCheckOut;
          isNextDayLog = true;
        }

        const hasManualOrDeviceLog = Boolean(checkInLog || checkOutLog);
        const todayIsoStr = new Date().toISOString().split('T')[0];
        const isTodayOrPast = dateStr <= todayIsoStr;
        const hasWork = workRevenue > 0;

        const isWeeklyOffPaid = hrConfig.weeklyOffPaidType ? (hrConfig.weeklyOffPaidType === 'paid') : (hrConfig.weeklyOffPaid !== false);
        const absenceMultiplier = typeof hrConfig.absenceDeductionDays === 'number' ? hrConfig.absenceDeductionDays : 1;

        if (isTerminated) {
          status = 'terminated';
          statusLabel = 'إنهاء خدمة';
        } else if (leave) {
          if (leave.type === 'paid') {
            status = 'paid_leave';
            statusLabel = 'إجازة براتب';
          } else {
            status = 'unpaid_leave';
            statusLabel = 'إجازة بدون راتب';
            absenceDeduction = 0;
          }
        } else if (isWeeklyOff && !hasManualOrDeviceLog) {
          status = 'weekly_off';
          statusLabel = 'عطلة أسبوعية';
          if (!isWeeklyOffPaid) {
            absenceDeduction = 0;
          }
        } else if (hasManualOrDeviceLog) {
          // Present via fingerprint or registered attendance
          status = 'regular';
          statusLabel = 'حضور';

          const inTimeStr = extractTime(checkInLog?.timestamp) || scheduledCheckIn;
          checkIn = `${inTimeStr}:00`;

          const outTimeStr = extractTime(checkOutLog?.timestamp);

          // Scheduled vs Actual check in
          const schedParts = scheduledCheckIn.split(':').map(Number);
          const totalSchedMin = schedParts[0] * 60 + (schedParts[1] || 0);

          const inParts = inTimeStr.split(':').map(Number);
          const actualInMin = inParts[0] * 60 + (inParts[1] || 0);

          // Delay calculation based on customized HR settings
          if (actualInMin > totalSchedMin) {
            const rawDelay = actualInMin - totalSchedMin;
            const delayGrace = hrConfig.delayGraceMinutes ?? 15;
            const absenceThresholdMin = (hrConfig.delayAbsenceThresholdHours || 2) * 60;
            const isDelayFixed = hrConfig.delayDeductionType === 'fixed_amount';

            if (rawDelay > delayGrace) {
              delayMinutes = rawDelay;
              if (delayMinutes >= absenceThresholdMin) {
                status = 'absent';
                statusLabel = `تأخير (${delayMinutes} د - غياب)`;
                absenceDeduction = dailyRate * absenceMultiplier;
              } else if (delayMinutes >= (hrConfig.delayTier4StartMin ?? 61)) {
                const tierVal = hrConfig.delayTier4Deduction ?? 50;
                delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                statusLabel = `تأخير (${delayMinutes} د)`;
              } else if (delayMinutes >= (hrConfig.delayTier3StartMin ?? 46)) {
                const tierVal = hrConfig.delayTier3Deduction ?? 25;
                delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                statusLabel = `تأخير (${delayMinutes} د)`;
              } else if (delayMinutes >= (hrConfig.delayTier2StartMin ?? 31)) {
                const tierVal = hrConfig.delayTier2Deduction ?? 15;
                delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                statusLabel = `تأخير (${delayMinutes} د)`;
              } else if (delayMinutes >= (hrConfig.delayTier1StartMin ?? 15)) {
                const tierVal = hrConfig.delayTier1Deduction ?? 5;
                delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                statusLabel = `تأخير (${delayMinutes} د)`;
              }
            }
          }

          // Check out & Overtime calculation based on customized HR settings
          const schedOutParts = scheduledCheckOut.split(':').map(Number);
          let totalSchedOutMin = schedOutParts[0] * 60 + (schedOutParts[1] || 0);

          if (outTimeStr) {
            const outParts = outTimeStr.split(':').map(Number);
            let actualOutMin = outParts[0] * 60 + (outParts[1] || 0);

            // Crossing midnight detection:
            // 1. If log was recorded on next date (isNextDayLog)
            // 2. Or if actual checkout time is less than or equal to check-in time (e.g. In 13:00, Out 02:00)
            const isOvernight = isNextDayLog || (actualOutMin <= actualInMin);
            if (isOvernight) {
              actualOutMin += 1440; // Add 24 hours (1440 minutes)
              checkOut = `${outTimeStr}:00 (+1)`;
            } else {
              checkOut = `${outTimeStr}:00`;
            }

            // If scheduled checkout crosses midnight (e.g. schedOut <= schedIn)
            if (totalSchedOutMin <= totalSchedMin) {
              totalSchedOutMin += 1440;
            }

            const durationMin = Math.max(0, actualOutMin - actualInMin);
            const hours = Math.floor(durationMin / 60);
            const mins = durationMin % 60;
            workedHoursFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;

            // Overtime calculation
            if (actualOutMin > totalSchedOutMin) {
              const rawOvertime = actualOutMin - totalSchedOutMin;
              const otGrace = hrConfig.overtimeGraceMinutes ?? 30;

              if (rawOvertime >= otGrace) {
                overtimeMinutes = rawOvertime;
                if (hrConfig.overtimeRateType === 'custom_fixed_amount') {
                  const fixedHourlyRate = Number(hrConfig.customOvertimeHourlyRate) || 25;
                  overtimeAmount = fixedHourlyRate * (overtimeMinutes / 60);
                } else if (hrConfig.overtimeRateType === '2x') {
                  const hourlyRate = dailyRate > 0 ? (dailyRate / 8) : 25;
                  overtimeAmount = hourlyRate * 2 * (overtimeMinutes / 60);
                } else if (hrConfig.overtimeRateType === '1.5x') {
                  const hourlyRate = dailyRate > 0 ? (dailyRate / 8) : 25;
                  overtimeAmount = hourlyRate * 1.5 * (overtimeMinutes / 60);
                } else {
                  const hourlyRate = dailyRate > 0 ? (dailyRate / 8) : 25;
                  overtimeAmount = hourlyRate * 1.0 * (overtimeMinutes / 60);
                }
              }
            }
          } else {
            workedHoursFormatted = '08:00:00';
          }
        } else if (isTodayOrPast) {
          status = 'absent';
          statusLabel = 'غياب بدون إذن';
          absenceDeduction = dailyRate * absenceMultiplier;
        } else {
          status = 'regular';
          statusLabel = 'دوام مجدول';
        }

        // Apply Delay Forgiveness
        const isDelayForgiven = override.isDelayForgiven !== undefined ? override.isDelayForgiven : false;
        if (isDelayForgiven) {
          delayDeduction = 0;
        }

        // Apply Overtime Approval (default approved)
        const isOvertimeApproved = override.isOvertimeApproved !== undefined ? override.isOvertimeApproved : true;
        if (!isOvertimeApproved) {
          overtimeAmount = 0;
        }

        // Net Daily Calculation
        let earnedDaily = dailyRate;
        if (status === 'unpaid_leave' || status === 'terminated' || (status === 'weekly_off' && !isWeeklyOffPaid)) {
          earnedDaily = 0;
        }

        let netDaily = isTerminated ? 0 : (
          earnedDaily + 
          overtimeAmount + 
          bonuses + 
          totalDailyCommission - 
          delayDeduction - 
          permissionDeduction -
          specialPenalty - 
          advances - 
          absenceDeduction -
          commissionPaid
        );

        if (status === 'absent') {
          // As per rule: Any day without attendance is absent.
          // Net must NEVER be positive: it is either 0 (if absence deduction is 1 day),
          // or negative (if absence deduction is >= 2 days, or if advances/penalties exist).
          const baseAbsentNet = dailyRate - absenceDeduction;
          netDaily = Math.min(0, baseAbsentNet - advances - specialPenalty - commissionPaid);
        }

        rows.push({
          dateStr,
          dayNameArabic: dayNameAr,
          employee: emp,
          fingerprintCode: emp.fingerprintCode || '13',
          employeeName: emp.name,
          dailyRate,
          checkIn,
          checkOut,
          status,
          statusLabel,
          permissionStart: permission?.startTime,
          permissionEnd: permission?.endTime,
          permissionMinutes,
          permissionExcusedMinutes,
          permissionDeductedMinutes,
          permissionDeduction,
          workedHoursFormatted,
          delayMinutes,
          delayDeduction,
          overtimeMinutes,
          overtimeAmount,
          isOvertimeApproved,
          specialPenalty,
          absenceDeduction,
          advances,
          bonuses,
          workRevenue,
          commissionAmount: totalDailyCommission,
          openingCommission: totalReferralCommission,
          commissionPaid,
          isDelayForgiven,
          netDaily
        });
      });
    });


    return rows;
  }, [activeEmployees, selectedEmpId, viewMode, dateRangeList, selectedMonth, overrides, invoices, hrConfig, effectiveFingerprintLogs]);

  // Overall Totals
  const totals = useMemo(() => {
    return timesheetRows.reduce((acc, row) => ({
      dailyRateSum: acc.dailyRateSum + row.dailyRate,
      delayMinutesSum: acc.delayMinutesSum + row.delayMinutes,
      delayDeductionSum: acc.delayDeductionSum + row.delayDeduction,
      permissionMinutesSum: acc.permissionMinutesSum + row.permissionMinutes,
      permissionDeductionSum: acc.permissionDeductionSum + (row.permissionDeduction || 0),
      overtimeMinutesSum: acc.overtimeMinutesSum + row.overtimeMinutes,
      overtimeAmountSum: acc.overtimeAmountSum + row.overtimeAmount,
      absenceDeductionSum: acc.absenceDeductionSum + row.absenceDeduction,
      specialPenaltySum: acc.specialPenaltySum + row.specialPenalty,
      advancesSum: acc.advancesSum + row.advances,
      bonusesSum: acc.bonusesSum + row.bonuses,
      workRevenueSum: acc.workRevenueSum + row.workRevenue,
      commissionSum: acc.commissionSum + row.commissionAmount,
      commissionPaidSum: acc.commissionPaidSum + (row.commissionPaid || 0),
      netSum: acc.netSum + row.netDaily
    }), {
      dailyRateSum: 0,
      delayMinutesSum: 0,
      delayDeductionSum: 0,
      permissionMinutesSum: 0,
      permissionDeductionSum: 0,
      overtimeMinutesSum: 0,
      overtimeAmountSum: 0,
      absenceDeductionSum: 0,
      specialPenaltySum: 0,
      advancesSum: 0,
      bonusesSum: 0,
      workRevenueSum: 0,
      commissionSum: 0,
      commissionPaidSum: 0,
      netSum: 0
    });
  }, [timesheetRows]);

  const toggleDelayForgive = (rowKey: string, currentVal: boolean) => {
    setOverrides(prev => ({
      ...prev,
      [rowKey]: {
        ...prev[rowKey],
        isDelayForgiven: !currentVal
      }
    }));
  };

  const handleOpenSalarySlip = (targetEmp?: Employee) => {
    const emp = targetEmp || activeEmployees.find(e => e.id === selectedEmpId) || activeEmployees[0];
    if (!emp) return;

    const empRows = timesheetRows.filter(r => r.employee.id === emp.id);
    const presentDays = empRows.filter(r => r.status === 'regular').length;
    const absenceDays = empRows.filter(r => r.status === 'absent').length;
    const paidLeaveDays = empRows.filter(r => r.status === 'paid_leave').length;
    const unpaidLeaveDays = empRows.filter(r => r.status === 'unpaid_leave').length;
    const weeklyOffDays = empRows.filter(r => r.status === 'weekly_off').length;

    const isWeeklyOffPaid = hrConfig.weeklyOffPaidType ? (hrConfig.weeklyOffPaidType === 'paid') : (hrConfig.weeklyOffPaid !== false);
    const earnedBaseSalary = empRows
      .filter(r => r.status === 'regular' || r.status === 'paid_leave' || r.status === 'absent' || (r.status === 'weekly_off' && isWeeklyOffPaid))
      .reduce((sum, r) => sum + r.dailyRate, 0);

    const summary: SalarySlipSummary = {
      employee: emp,
      periodLabel: viewMode === 'single_day' ? selectedSingleDay : `${startDate} إلى ${endDate}`,
      monthlySalary: emp.baseSalary || 0,
      dailyRate: emp.baseSalary > 0 ? emp.baseSalary / getDaysInMonth(selectedMonth) : 0,
      earnedBaseSalary,
      presentDays,
      absenceDays,
      paidLeaveDays,
      unpaidLeaveDays,
      weeklyOffDays,
      totalWorkRevenue: empRows.reduce((sum, r) => sum + r.workRevenue, 0),
      commissionsEarned: empRows.reduce((sum, r) => sum + r.commissionAmount, 0),
      overtimeMinutes: empRows.reduce((sum, r) => sum + r.overtimeMinutes, 0),
      overtimeAmount: empRows.reduce((sum, r) => sum + r.overtimeAmount, 0),
      delayMinutes: empRows.reduce((sum, r) => sum + r.delayMinutes, 0),
      delayDeduction: empRows.reduce((sum, r) => sum + r.delayDeduction, 0),
      absenceDeduction: empRows.reduce((sum, r) => sum + r.absenceDeduction, 0),
      permissionDeduction: empRows.reduce((sum, r) => sum + (r.permissionDeduction || 0), 0),
      advancesDeduction: empRows.reduce((sum, r) => sum + r.advances, 0),
      commissionsPaid: empRows.reduce((sum, r) => sum + (r.commissionPaid || 0), 0),
      bonusesAdded: empRows.reduce((sum, r) => sum + r.bonuses, 0),
      specialPenalties: empRows.reduce((sum, r) => sum + r.specialPenalty, 0),
      netPayable: empRows.reduce((sum, r) => sum + r.netDaily, 0)
    };

    setActiveSlipSummary(summary);
    setShowSlipModal(true);
  };

  const handlePrintSlip = () => {
    const printContent = document.getElementById('print-salary-slip');
    if (printContent) {
      printHtml(printContent.innerHTML, `قسيمة_راتب_${activeSlipSummary?.employee.name}`);
    }
  };

  const handlePrintRowVoucher = (row: DayTimesheetRow, type: 'advance' | 'penalty' | 'bonus' | 'commission_payout', amount: number, customNote?: string) => {
    printThermalFinancialVoucher(settings, {
      voucherType: type,
      voucherNumber: `${type === 'commission_payout' ? 'COMM' : type.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      date: `${row.dateStr} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
      employeeName: row.employeeName,
      employeeCode: row.fingerprintCode || row.employee.id,
      employeeRole: row.employee.role,
      amount,
      note: customNote || (type === 'advance' ? 'سلفة نقدية مسجلة بالتايم شيت' : type === 'penalty' ? 'خصم وجزاء مسجل بالتايم شيت' : type === 'commission_payout' ? 'سند صرف عمولة مسجلة بالتايم شيت' : 'مكافأة مسجلة بالتايم شيت'),
      issuedBy: currentUser?.name || 'مدير النظام'
    });
  };

  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceForm.empId || !attendanceForm.date) {
      alert('الرجاء اختيار الموظف والتاريخ المستهدف.');
      return;
    }

    const targetEmp = employees.find(e => e.id === attendanceForm.empId);
    if (!targetEmp) {
      alert('لم يتم العثور على بيانات الموظف المحدد.');
      return;
    }

    setIsSavingAttendance(true);
    try {
      const dateStr = attendanceForm.date;
      const nextDateStr = getNextDateStr(dateStr);
      const inTimestamp = `${dateStr}T${attendanceForm.checkIn || '09:00'}:00`;
      
      // If next day checkout toggle is active, record outTimestamp on the next date
      let outTimestamp: string | undefined;
      if (attendanceForm.checkOut) {
        const outDate = attendanceForm.isNextDayCheckout ? nextDateStr : dateStr;
        outTimestamp = `${outDate}T${attendanceForm.checkOut}:00`;
      }

      // Existing logs for this employee and date
      const sameDayLogs = (effectiveFingerprintLogs || []).filter(l => 
        (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && l.fingerprintCode === targetEmp.fingerprintCode)) &&
        isSameDay(l.timestamp, dateStr)
      );

      // Also find any next-day early checkout log (00:00 - 09:59) for this employee
      const nextDayEarlyCheckOut = (effectiveFingerprintLogs || []).filter(l => 
        (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && l.fingerprintCode === targetEmp.fingerprintCode)) &&
        l.type === 'check_out' &&
        isSameDay(l.timestamp, nextDateStr) &&
        (() => {
          const time = extractTime(l.timestamp);
          if (!time) return false;
          const hour = Number(time.split(':')[0]);
          return hour < 10;
        })()
      );

      const existingLogs = [...sameDayLogs, ...nextDayEarlyCheckOut];

      const generateId = () => (DB.generateUUID ? DB.generateUUID() : 'FP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7));

      const checkInId = sameDayLogs.find(l => l.type === 'check_in')?.id || generateId();
      const checkOutId = (attendanceForm.isNextDayCheckout ? nextDayEarlyCheckOut[0]?.id : sameDayLogs.find(l => l.type === 'check_out')?.id) || generateId();

      const inLog: FingerprintLog = {
        id: checkInId,
        salonId: targetEmp.salonId || settings.salonId,
        branchId: targetEmp.branchId || (settings as any).branchId,
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        fingerprintCode: targetEmp.fingerprintCode || 'FP-' + targetEmp.id.slice(0, 4),
        timestamp: inTimestamp,
        type: 'check_in',
        status: 'manual',
        notes: attendanceForm.notes || 'تسجيل يدوي / تعديل من TimeSheet'
      };

      const newLogsToSave: FingerprintLog[] = [inLog];

      if (outTimestamp) {
        const outLog: FingerprintLog = {
          id: checkOutId,
          salonId: targetEmp.salonId || settings.salonId,
          branchId: targetEmp.branchId || (settings as any).branchId,
          employeeId: targetEmp.id,
          employeeName: targetEmp.name,
          fingerprintCode: targetEmp.fingerprintCode || 'FP-' + targetEmp.id.slice(0, 4),
          timestamp: outTimestamp,
          type: 'check_out',
          status: 'manual',
          notes: attendanceForm.notes || (attendanceForm.isNextDayCheckout ? 'انصراف بعد منتصف الليل (+1 يوم)' : 'تسجيل يدوي / تعديل من TimeSheet')
        };
        newLogsToSave.push(outLog);
      }

      // 1. Delete any old logs from DB that are no longer in newLogsToSave (e.g. if checkout was removed or moved to next day)
      for (const oldLog of existingLogs) {
        if (!newLogsToSave.some(nl => nl.id === oldLog.id)) {
          await DB.deleteFingerprintLog(oldLog.id);
        }
      }

      // 2. Save each log to Supabase
      for (const log of newLogsToSave) {
        await DB.saveFingerprintLog(log);
      }

      // 3. Update local state & parent state
      const updateFn = (prev: FingerprintLog[]) => {
        const otherLogs = (prev || []).filter(l => !existingLogs.some(el => el.id === l.id));
        return [...otherLogs, ...newLogsToSave];
      };

      if (setFingerprintLogs) {
        setFingerprintLogs(updateFn);
      }
      setLocalLogs(updateFn);

      setShowAttendanceModal(false);
      alert('✅ تم حفظ وتحديث التايم شيت بنجاح في قاعدة البيانات.');
    } catch (err: any) {
      console.error('Error in handleSaveAttendance:', err);
      alert('حدث خطأ أثناء حفظ التايم شيت: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleDeleteAttendance = async (empId: string, dateStr: string) => {
    if (!confirm('هل أنت متأكد من حذف تسجيل الحضور والانصراف لهذا اليوم وتعيينه كغياب؟')) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const nextDateStr = getNextDateStr(dateStr);
    const sameDayLogs = (effectiveFingerprintLogs || []).filter(l => 
      (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && l.fingerprintCode === targetEmp.fingerprintCode)) &&
      isSameDay(l.timestamp, dateStr)
    );
    const nextDayEarlyCheckOut = (effectiveFingerprintLogs || []).filter(l => 
      (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && l.fingerprintCode === targetEmp.fingerprintCode)) &&
      l.type === 'check_out' &&
      isSameDay(l.timestamp, nextDateStr) &&
      (() => {
        const time = extractTime(l.timestamp);
        if (!time) return false;
        const hour = Number(time.split(':')[0]);
        return hour < 10;
      })()
    );

    const logsToDelete = [...sameDayLogs, ...nextDayEarlyCheckOut];

    for (const l of logsToDelete) {
      await DB.deleteFingerprintLog(l.id);
    }

    const deleteFn = (prev: FingerprintLog[]) => prev.filter(l => !logsToDelete.some(dl => dl.id === l.id));
    if (setFingerprintLogs) {
      setFingerprintLogs(deleteFn);
    }
    setLocalLogs(deleteFn);

    setShowAttendanceModal(false);
    alert('✅ تم حذف تسجيل الحضور لهذا اليوم واعتباره كغياب.');
  };


  // Commission Payout State & Handlers
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commEmpId, setCommEmpId] = useState('');
  const [commAmount, setCommAmount] = useState<number | ''>('');
  const [commDate, setCommDate] = useState(now.toISOString().split('T')[0]);
  const [commTreasuryId, setCommTreasuryId] = useState(settings.treasuries[0]?.id || '');
  const [commNote, setCommNote] = useState('صرف عمولة مستحقة');
  const [isSavingCommissionPayout, setIsSavingCommissionPayout] = useState(false);

  const handleOpenCommissionModal = (targetEmpId?: string) => {
    const defaultEmpId = targetEmpId || (viewMode === 'single_employee' && selectedEmpId) || activeEmployees[0]?.id || '';
    setCommEmpId(defaultEmpId);
    setCommDate(now.toISOString().split('T')[0]);
    setCommTreasuryId(settings.treasuries[0]?.id || '');
    setCommNote('صرف عمولة مستحقة');
    setCommAmount('');
    setShowCommissionModal(true);
  };

  const selectedCommEmp = useMemo(() => {
    return employees.find(e => e.id === commEmpId);
  }, [employees, commEmpId]);

  const commStats = useMemo(() => {
    if (!selectedCommEmp) return { earnedCommissions: 0, paidCommissions: 0, unpaidCommissions: 0 };
    const empRows = timesheetRows.filter(r => r.employee.id === selectedCommEmp.id);
    const earned = empRows.reduce((sum, r) => sum + r.commissionAmount, 0);
    const paid = (selectedCommEmp.financialRecords || [])
      .filter(r => r.type === 'commission_payout')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    const unpaid = Math.max(0, earned - paid);
    return { earnedCommissions: earned, paidCommissions: paid, unpaidCommissions: unpaid };
  }, [selectedCommEmp, timesheetRows]);

  const handleDisburseCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commEmpId) {
      alert('الرجاء اختيار الموظف المستحق للعمولة');
      return;
    }
    const targetEmp = employees.find(e => e.id === commEmpId);
    if (!targetEmp) {
      alert('الموظف غير موجود');
      return;
    }
    const amountVal = Number(commAmount);
    if (!amountVal || amountVal <= 0) {
      alert('الرجاء إدخال مبلغ صحيح لصرف العمولة');
      return;
    }
    if (!commTreasuryId) {
      alert('الرجاء اختيار الخزينة المنصرف منها العمولة');
      return;
    }

    setIsSavingCommissionPayout(true);
    try {
      const treasuryName = settings.treasuries.find(t => t.id === commTreasuryId)?.name || 'الخزينة الرئيسية';
      const voucherNum = `COMM-${Math.floor(100000 + Math.random() * 900000)}`;

      // 1. Create financial transaction
      const trx: Transaction = {
        id: 'TRX-COMM-' + Math.random().toString(36).substring(2, 9),
        date: `${commDate}T${new Date().toTimeString().split(' ')[0]}`,
        type: 'out',
        amount: amountVal,
        category: 'commissions',
        description: `صرف عمولة للموظف (${targetEmp.name}) - ${commNote}`,
        treasury: commTreasuryId,
        salonId: settings.salonId,
        branchId: settings.branchId
      };

      if (DB.saveTransaction) {
        await DB.saveTransaction(trx);
      }
      if (setTransactions && transactions) {
        setTransactions([...transactions, trx]);
      }

      // 2. Add EmployeeFinancialRecord to target employee
      const finRecord: EmployeeFinancialRecord = {
        id: 'FIN-COMM-' + Math.random().toString(36).substring(2, 9),
        date: commDate,
        type: 'commission_payout',
        amount: amountVal,
        treasuryId: commTreasuryId,
        note: commNote || `صرف عمولة للموظف (${targetEmp.name})`
      };

      const updatedTargetEmp: Employee = {
        ...targetEmp,
        financialRecords: [...(targetEmp.financialRecords || []), finRecord]
      };

      if (DB.saveEmployee) {
        await DB.saveEmployee(updatedTargetEmp);
      }

      setEmployees(employees.map(e => e.id === targetEmp.id ? updatedTargetEmp : e));

      // 3. Print 80mm thermal voucher
      printThermalFinancialVoucher(settings, {
        voucherType: 'commission_payout',
        voucherNumber: voucherNum,
        date: `${commDate} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
        employeeName: targetEmp.name,
        employeeCode: targetEmp.fingerprintCode || targetEmp.id,
        employeeRole: targetEmp.role,
        amount: amountVal,
        treasuryName: treasuryName,
        note: commNote || `صرف عمولة مستحقة`,
        issuedBy: currentUser?.name || 'مدير النظام'
      });

      setShowCommissionModal(false);
      setCommAmount('');
      alert(`✅ تم صرف وتوثيق العمولة للموظف (${targetEmp.name}) بقيمة ${amountVal.toFixed(2)} ${settings.currency} بنجاح وطباعة إيصال الصرف للتوقيع.`);
    } catch (err: any) {
      console.error('Error in handleDisburseCommission:', err);
      alert('حدث خطأ أثناء صرف العمولة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingCommissionPayout(false);
    }
  };

  // Leave Management State & Handlers
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showLeavesListModal, setShowLeavesListModal] = useState(false);
  const [leaveEmpId, setLeaveEmpId] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState(now.toISOString().split('T')[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(now.toISOString().split('T')[0]);
  const [leaveType, setLeaveType] = useState<'paid' | 'unpaid'>('paid');
  const [leaveReason, setLeaveReason] = useState('إجازة اعتيادية سنوية');
  const [isSavingLeave, setIsSavingLeave] = useState(false);

  const handleOpenLeaveModal = (targetEmpId?: string) => {
    const defaultEmpId = targetEmpId || (viewMode === 'single_employee' && selectedEmpId) || activeEmployees[0]?.id || '';
    setLeaveEmpId(defaultEmpId);
    setLeaveStartDate(now.toISOString().split('T')[0]);
    setLeaveEndDate(now.toISOString().split('T')[0]);
    setLeaveType('paid');
    setLeaveReason('إجازة اعتيادية سنوية');
    setShowLeaveModal(true);
  };

  const leaveDaysCount = useMemo(() => {
    if (!leaveStartDate || !leaveEndDate) return 1;
    const s = new Date(leaveStartDate);
    const e = new Date(leaveEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24));
    return Math.max(1, diff + 1);
  }, [leaveStartDate, leaveEndDate]);

  const selectedLeaveEmp = useMemo(() => {
    return employees.find(e => e.id === leaveEmpId);
  }, [employees, leaveEmpId]);

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmpId) {
      alert('الرجاء اختيار الموظف');
      return;
    }
    if (!leaveStartDate || !leaveEndDate) {
      alert('الرجاء تحديد تاريخ بداية ونهاية الإجازة');
      return;
    }
    if (leaveStartDate > leaveEndDate) {
      alert('تاريخ نهاية الإجازة لا يمكن أن يكون قبل تاريخ البداية');
      return;
    }

    const targetEmp = employees.find(e => e.id === leaveEmpId);
    if (!targetEmp) {
      alert('الموظف غير موجود');
      return;
    }

    try {
      setIsSavingLeave(true);

      const newLeaveRecord: EmployeeLeaveRecord = {
        id: 'LEV-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        type: leaveType,
        daysCount: leaveDaysCount,
        reason: leaveReason.trim() || (leaveType === 'paid' ? 'إجازة مدفوعة الأجر' : 'إجازة بدون أجر'),
        note: leaveReason.trim() || (leaveType === 'paid' ? 'إجازة مدفوعة الأجر' : 'إجازة بدون أجر'),
        createdAt: new Date().toISOString(),
        approvedBy: currentUser?.name || 'مدير النظام'
      };

      const updatedEmp: Employee = {
        ...targetEmp,
        leaveRecords: [...(targetEmp.leaveRecords || []), newLeaveRecord]
      };

      if (DB.saveEmployee) {
        await DB.saveEmployee(updatedEmp);
      }

      setEmployees(employees.map(e => e.id === targetEmp.id ? updatedEmp : e));
      setShowLeaveModal(false);

      const totalValue = leaveType === 'paid' 
        ? ((targetEmp.baseSalary || 0) / 30 * leaveDaysCount).toFixed(2)
        : '0.00';

      alert(`🏖️ تم تسجيل وتطبيق الإجازة بنجاح!\n• الموظف: ${targetEmp.name}\n• المدة: ${leaveDaysCount} يوم (من ${leaveStartDate} إلى ${leaveEndDate})\n• النوع: ${leaveType === 'paid' ? 'مدفوعة الأجر (يتم احتساب الراتب)' : 'بدون أجر (خصم اليومية دون جزاء غياب)'}\n• تم توزيعها تلقائياً على التايم شيت.`);
    } catch (err: any) {
      console.error('Error saving leave:', err);
      alert('حدث خطأ أثناء تسجيل الإجازة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingLeave(false);
    }
  };

  const handleDeleteLeave = async (empId: string, leaveId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء وحذف هذه الإجازة؟ سيتم إعادة احتساب أيامها في التايم شيت كأيام عمل/غياب طبيعية.')) return;

    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    try {
      const updatedEmp: Employee = {
        ...targetEmp,
        leaveRecords: (targetEmp.leaveRecords || []).filter(l => l.id !== leaveId)
      };

      if (DB.saveEmployee) {
        await DB.saveEmployee(updatedEmp);
      }

      setEmployees(employees.map(e => e.id === targetEmp.id ? updatedEmp : e));
      alert('✅ تم حذف الإجازة بنجاح وإعادة ضبط التايم شيت.');
    } catch (err: any) {
      console.error('Error deleting leave:', err);
      alert('حدث خطأ أثناء حذف الإجازة: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  // Batch Salary Disbursement State
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [disbursementTreasuryId, setDisbursementTreasuryId] = useState(settings.treasuries[0]?.id || '');
  const [disbursementDate, setDisbursementDate] = useState(now.toISOString().split('T')[0]);
  const [disbursementNote, setDisbursementNote] = useState(`مسير رواتب شهر ${selectedMonth}`);
  const [selectedDisbursementEmpIds, setSelectedDisbursementEmpIds] = useState<string[]>([]);

  // Payroll Disbursement Calculations for the active range
  const payrollDisbursementData = useMemo(() => {
    return activeEmployees.map(emp => {
      const empRows = timesheetRows.filter(r => r.employee.id === emp.id);
      const isWeeklyOffPaid = hrConfig.weeklyOffPaidType ? (hrConfig.weeklyOffPaidType === 'paid') : (hrConfig.weeklyOffPaid !== false);
      const earnedBaseSalary = empRows
        .filter(r => r.status === 'regular' || r.status === 'paid_leave' || r.status === 'absent' || (r.status === 'weekly_off' && isWeeklyOffPaid))
        .reduce((sum, r) => sum + r.dailyRate, 0);
      const presentDaysCount = empRows.filter(r => r.status === 'regular').length;
      const totalWorkRevenue = empRows.reduce((sum, r) => sum + r.workRevenue, 0);
      const totalCommissions = empRows.reduce((sum, r) => sum + r.commissionAmount, 0);
      const totalCommissionsPaid = empRows.reduce((sum, r) => sum + (r.commissionPaid || 0), 0);
      const totalBonuses = empRows.reduce((sum, r) => sum + r.bonuses, 0);
      const totalAdvances = empRows.reduce((sum, r) => sum + r.advances, 0);
      const totalPenalties = empRows.reduce((sum, r) => sum + r.specialPenalty, 0);
      const totalOvertimeAmount = empRows.reduce((sum, r) => sum + r.overtimeAmount, 0);
      const totalDelaysDeduction = empRows.reduce((sum, r) => sum + r.delayDeduction, 0);
      const totalAbsenceDeduction = empRows.reduce((sum, r) => sum + r.absenceDeduction, 0);
      const totalPermissionDeduction = empRows.reduce((sum, r) => sum + (r.permissionDeduction || 0), 0);

      const totalDeductions = totalAdvances + totalPenalties + totalDelaysDeduction + totalAbsenceDeduction + totalPermissionDeduction + totalCommissionsPaid;
      const netPayable = Math.max(0, earnedBaseSalary + totalCommissions + totalBonuses + totalOvertimeAmount - totalDeductions);

      return {
        emp,
        presentDaysCount,
        earnedBaseSalary,
        totalWorkRevenue,
        totalCommissions,
        totalCommissionsPaid,
        totalBonuses,
        totalAdvances,
        totalPenalties,
        totalOvertimeAmount,
        totalDeductions,
        netPayable
      };
    });
  }, [activeEmployees, timesheetRows, hrConfig]);

  const handleOpenDisbursementModal = () => {
    setSelectedDisbursementEmpIds(activeEmployees.map(e => e.id));
    setDisbursementDate(now.toISOString().split('T')[0]);
    setDisbursementTreasuryId(settings.treasuries[0]?.id || '');
    setShowDisbursementModal(true);
  };

  const handleDisburseSalaries = (targetEmpIds: string[]) => {
    if (!targetEmpIds || targetEmpIds.length === 0) {
      alert('الرجاء تحديد موظف واحد على الأقل لصرف راتبه');
      return;
    }
    if (!disbursementTreasuryId) {
      alert('الرجاء اختيار الخزينة المنصرف منها الرواتب');
      return;
    }

    const treasuryName = settings.treasuries.find(t => t.id === disbursementTreasuryId)?.name || 'الخزنة';
    const targets = payrollDisbursementData.filter(d => targetEmpIds.includes(d.emp.id) && d.netPayable > 0);

    if (targets.length === 0) {
      alert('لا توجد مبالغ مستحقة للصرف للموظفين المحددين');
      return;
    }

    // 1. Create financial transactions for treasury deduction
    const newTrxs: Transaction[] = [];
    let updatedEmployees = [...employees];

    targets.forEach(item => {
      const trx: Transaction = {
        id: 'TRX-SAL-' + Math.random().toString(36).substring(2, 9),
        date: `${disbursementDate}T${new Date().toTimeString().split(' ')[0]}`,
        type: 'out',
        amount: item.netPayable,
        category: 'salaries',
        description: `صرف راتب الموظف (${item.emp.name}) عن فترة (${startDate} إلى ${endDate}) - ${disbursementNote}`,
        treasury: disbursementTreasuryId
      };
      newTrxs.push(trx);

      // Record disbursement voucher on employee
      const finRecord: EmployeeFinancialRecord = {
        id: 'FIN-SAL-' + Math.random().toString(36).substring(2, 9),
        date: disbursementDate,
        type: 'advance',
        amount: item.netPayable,
        treasuryId: disbursementTreasuryId,
        note: `مسير رواتب: تم استلام صافي الراتب (${item.netPayable.toFixed(2)} ${settings.currency}) عن فترة ${startDate} إلى ${endDate}`
      };

      updatedEmployees = updatedEmployees.map(e => {
        if (e.id === item.emp.id) {
          return {
            ...e,
            financialRecords: [...(e.financialRecords || []), finRecord]
          };
        }
        return e;
      });

      // Print Thermal Salary Slip Receipt for Employee to Sign
      printThermalFinancialVoucher(settings, {
        voucherType: 'advance',
        voucherNumber: `SAL-${Math.floor(100000 + Math.random() * 900000)}`,
        date: `${disbursementDate} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
        employeeName: item.emp.name,
        employeeCode: item.emp.fingerprintCode || item.emp.id,
        employeeRole: item.emp.role,
        amount: item.netPayable,
        treasuryName: treasuryName,
        note: `مسير رواتب معتمد عن فترة (${startDate} إلى ${endDate}) | الراتب المستحق: ${item.earnedBaseSalary.toFixed(2)} + العمولات: ${item.totalCommissions.toFixed(2)} - المستقطعات والسلف: ${item.totalDeductions.toFixed(2)}`,
        issuedBy: currentUser?.name || 'مدير النظام'
      });
    });

    if (setTransactions && transactions) {
      setTransactions([...transactions, ...newTrxs]);
    }
    setEmployees(updatedEmployees);

    setShowDisbursementModal(false);
    alert(`✅ تم صرف وتوثيق رواتب (${targets.length}) موظف بنجاح بقيمة إجمالية ${targets.reduce((s, t) => s + t.netPayable, 0).toFixed(2)} ${settings.currency} وطباعة إيصالات الاستلام للتوقيع.`);
  };

  return (
    <div className="w-full flex flex-col font-sans pb-10" dir="rtl">
      
      {/* Top Main Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
              <Clock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">سجل الدوام والتايم شيت (Timesheet & Payroll)</h2>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>تحديث تلقائي حي</span>
                  {lastSyncTime && <span className="font-mono text-slate-400">({lastSyncTime})</span>}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">متابعة الحضور والانصراف بالبصمة، التأخيرات، الأوفرتايم، والرواتب مع التزامن الفوري</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => refreshFingerprintLogs(true)}
            disabled={isRefreshingLogs}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            title="تحديث فوري للبصمات والبيانات من السحابة"
          >
            <RefreshCw size={14} className={isRefreshingLogs ? 'animate-spin text-indigo-600' : 'text-slate-600'} />
            <span>{isRefreshingLogs ? 'جارٍ المزامنة...' : 'تحديث الآن 🔄'}</span>
          </button>
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('single_employee')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'single_employee' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              موظف خلال مدة
            </button>
            <button
              onClick={() => setViewMode('single_day')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'single_day' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              يوم واحد لجميع الموظفين
            </button>
          </div>

          <button
            onClick={() => {
              setAttendanceForm({
                empId: selectedEmpId || activeEmployees[0]?.id || '',
                date: selectedSingleDay || now.toISOString().split('T')[0],
                checkIn: '09:00',
                checkOut: '18:00',
                isNextDayCheckout: false,
                status: 'regular',
                notes: ''
              });
              setShowAttendanceModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>تسجيل / تعديل حضور ⏱️</span>
          </button>

          <button
            onClick={() => {
              setTargetEmpId(selectedEmpId || activeEmployees[0]?.id || '');
              setSelectedEmpIdsForBulk(activeEmployees.map(e => e.id));
              setIncrementValue(10);
              setIncrementType('percentage');
              setEffectiveDate(now.toISOString().split('T')[0]);
              setIncrementReason('ترقية / علاوة سنوية');
              setApprovedBy(currentUser?.name || 'مدير النظام');
              setShowSalaryIncrementModal(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
          >
            <TrendingUp size={15} />
            <span>تسجيل زيادة راتب 📈</span>
          </button>

          <button
            onClick={() => setShowSalaryHistoryModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <History size={15} className="text-indigo-600" />
            <span>سجل الزيادات 📜</span>
          </button>

          <button
            onClick={() => handleOpenLeaveModal()}
            className="bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all cursor-pointer"
          >
            <Palmtree size={15} />
            <span>تسجيل إجازة 🏖️</span>
          </button>

          <button
            onClick={() => setShowLeavesListModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar size={15} className="text-sky-600" />
            <span>سجل الإجازات 📋</span>
          </button>

          <button
            onClick={() => handleOpenCommissionModal()}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-600/20 transition-all cursor-pointer"
          >
            <Coins size={15} />
            <span>صرف عمولة 💵</span>
          </button>

          <button
            onClick={handleOpenDisbursementModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <DollarSign size={16} />
            <span>صرف مسير الرواتب 💰</span>
          </button>

          <button
            onClick={() => handleOpenSalarySlip()}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Printer size={15} />
            <span>قسيمة الراتب (80mm)</span>
          </button>
        </div>
      </div>


      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
        {viewMode === 'single_employee' ? (
          <>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">اختر الموظف:</label>
              <select
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-slate-800 outline-none"
              >
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} (كود: {emp.fingerprintCode || emp.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">من تاريخ:</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:border-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">إلى تاريخ:</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:border-slate-800 outline-none"
              />
            </div>
            <div className="flex items-end h-full pt-4">
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl w-full text-center">
                إجمالي الأيام: {dateRangeList.length} يوم
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">اختر يوم العرض:</label>
              <input
                type="date"
                value={selectedSingleDay}
                onChange={e => setSelectedSingleDay(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-slate-800 outline-none"
              />
            </div>
            <div className="md:col-span-2 flex items-end h-full pt-4">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-xl w-full text-center border border-indigo-100">
                عرض تقرير يوم {selectedSingleDay} لكافة الموظفين ({activeEmployees.length} موظف)
              </span>
            </div>
          </>
        )}
      </div>

      {/* Main Timesheet Table (Full Vertical Expansion till End) */}
      <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-center text-xs border-collapse whitespace-nowrap">
            {/* Header */}
            <thead className="bg-slate-900 text-white font-black sticky top-0 z-10 text-[11px]">
              <tr>
                <th className="p-2.5 border-l border-slate-800">كود</th>
                <th className="p-2.5 border-l border-slate-800">الاسم</th>
                <th className="p-2.5 border-l border-slate-800">التاريخ</th>
                <th className="p-2.5 border-l border-slate-800">اليومية</th>
                <th className="p-2.5 border-l border-slate-800">حضور</th>
                <th className="p-2.5 border-l border-slate-800">انصراف</th>
                <th className="p-2.5 border-l border-slate-800">الحالة</th>
                <th className="p-2.5 border-l border-slate-800">بداية إذن</th>
                <th className="p-2.5 border-l border-slate-800">نهاية إذن</th>
                <th className="p-2.5 border-l border-slate-800">دقائق إذن</th>
                <th className="p-2.5 border-l border-slate-800">خصم إذن</th>
                <th className="p-2.5 border-l border-slate-800">ساعات العمل</th>
                <th className="p-2.5 border-l border-slate-800">دقائق التأخير</th>
                <th className="p-2.5 border-l border-slate-800">خصم تأخير</th>
                <th className="p-2.5 border-l border-slate-800">وقت إضافي</th>
                <th className="p-2.5 border-l border-slate-800">مبلغ أوفرتايم</th>
                <th className="p-2.5 border-l border-slate-800">خصم خاص</th>
                <th className="p-2.5 border-l border-slate-800">خصم غياب</th>
                <th className="p-2.5 border-l border-slate-800">سلف</th>
                <th className="p-2.5 border-l border-slate-800">مكافأة</th>
                <th className="p-2.5 border-l border-slate-800">شغل الموظف</th>
                <th className="p-2.5 border-l border-slate-800">نسبة الموظف</th>
                <th className="p-2.5 border-l border-slate-800 bg-amber-950/40 text-amber-200 font-black">عمولات مصروفة</th>
                <th className="p-2.5 border-l border-slate-800 bg-slate-950 font-black">الصافي</th>
                <th className="p-2.5">مسامحة تأخير</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-200">
              {timesheetRows.map((row, idx) => {
                const key = `${row.employee.id}_${row.dateStr}`;
                const isOff = row.status === 'weekly_off';
                const isAbsent = row.status === 'absent';
                const isTerminated = row.status === 'terminated';
                const isLeave = row.status === 'paid_leave' || row.status === 'unpaid_leave';

                return (
                  <tr 
                    key={idx}
                    className={`hover:bg-slate-50 transition-colors ${
                      isTerminated ? 'bg-slate-200/70 text-slate-500' :
                      isOff ? 'bg-emerald-50/40 text-emerald-950' : 
                      isAbsent ? 'bg-rose-50/40' : 
                      isLeave ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    {/* 1. Code */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-slate-700">
                      {row.fingerprintCode}
                    </td>

                    {/* 2. Name */}
                    <td className="p-2 border-l border-slate-200 font-bold text-slate-900 text-right pr-3">
                      {row.employeeName}
                    </td>

                    {/* 3. Date */}
                    <td className="p-2 border-l border-slate-200 font-mono text-[11px] text-slate-600">
                      {row.dateStr.split('-').reverse().join('/')}
                    </td>

                    {/* 4. Daily rate */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-slate-800">
                      {row.dailyRate > 0 ? row.dailyRate.toFixed(2) : '-'}
                    </td>

                    {/* 5. Check-In */}
                    <td className="p-2 border-l border-slate-200">
                      <div className="flex items-center justify-center gap-1 group/btn">
                        {row.checkIn ? (
                          <span className="font-mono text-emerald-700 font-bold flex items-center gap-1">
                            <Clock size={12} className="text-emerald-500" />
                            {row.checkIn}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold">🔴 غياب</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const cleanIn = row.checkIn ? row.checkIn.substring(0, 5) : '09:00';
                            const cleanOut = row.checkOut ? row.checkOut.replace(' (+1)', '').substring(0, 5) : '18:00';
                            const isOvernight = Boolean(row.checkOut?.includes('(+1)')) || (Boolean(row.checkOut) && cleanOut <= cleanIn);
                            setAttendanceForm({
                              empId: row.employee.id,
                              date: row.dateStr,
                              checkIn: cleanIn,
                              checkOut: cleanOut,
                              isNextDayCheckout: isOvernight,
                              status: row.status === 'absent' ? 'absent' : 'regular',
                              notes: ''
                            });
                            setShowAttendanceModal(true);
                          }}
                          className="hover:text-indigo-600 transition-colors p-0.5 rounded hover:bg-slate-200 text-slate-400 cursor-pointer"
                          title="تعديل وقت الحضور والانصراف لهذا الموظف"
                        >
                          <Edit size={12} />
                        </button>
                      </div>
                    </td>

                    {/* 6. Check-Out */}
                    <td className="p-2 border-l border-slate-200">
                      <div className="flex items-center justify-center gap-1 group/btn">
                        {row.checkOut ? (
                          <span className="font-mono text-slate-700 font-semibold flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            <span>{row.checkOut.replace(' (+1)', '')}</span>
                            {row.checkOut.includes('(+1)') && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold" title="انصراف في اليوم التالي (بعد منتصف الليل)">
                                🌙 +1
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">--:--:--</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const cleanIn = row.checkIn ? row.checkIn.substring(0, 5) : '09:00';
                            const cleanOut = row.checkOut ? row.checkOut.replace(' (+1)', '').substring(0, 5) : '18:00';
                            const isOvernight = Boolean(row.checkOut?.includes('(+1)')) || (Boolean(row.checkOut) && cleanOut <= cleanIn);
                            setAttendanceForm({
                              empId: row.employee.id,
                              date: row.dateStr,
                              checkIn: cleanIn,
                              checkOut: cleanOut,
                              isNextDayCheckout: isOvernight,
                              status: row.status === 'absent' ? 'absent' : 'regular',
                              notes: ''
                            });
                            setShowAttendanceModal(true);
                          }}
                          className="hover:text-indigo-600 transition-colors p-0.5 rounded hover:bg-slate-200 text-slate-400 cursor-pointer"
                          title="تعديل وقت الحضور والانصراف لهذا الموظف"
                        >
                          <Edit size={12} />
                        </button>
                      </div>
                    </td>


                    {/* 7. Status */}
                    <td className="p-2 border-l border-slate-200">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        isTerminated ? 'bg-slate-400 text-white' :
                        isOff ? 'bg-emerald-100 text-emerald-800' :
                        isAbsent ? 'bg-rose-100 text-rose-800' :
                        isLeave ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {row.statusLabel}
                      </span>
                    </td>

                    {/* 8. Permission Start */}
                    <td className="p-2 border-l border-slate-200 font-mono text-slate-500">
                      {row.permissionStart || '-'}
                    </td>

                    {/* 9. Permission End */}
                    <td className="p-2 border-l border-slate-200 font-mono text-slate-500">
                      {row.permissionEnd || '-'}
                    </td>

                    {/* 9.1 Permission Minutes */}
                    <td className="p-2 border-l border-slate-200 font-mono text-xs">
                      {row.permissionMinutes > 0 ? (
                        <span className={row.permissionDeduction > 0 ? 'text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded' : 'text-slate-600 font-semibold'}>
                          {row.permissionMinutes} د
                        </span>
                      ) : '-'}
                    </td>

                    {/* 9.2 Permission Deduction */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-rose-600">
                      {row.permissionDeduction > 0 ? row.permissionDeduction.toFixed(2) : '-'}
                    </td>

                    {/* 10. Worked Hours */}
                    <td className="p-2 border-l border-slate-200 font-mono font-semibold text-slate-700">
                      {row.workedHoursFormatted}
                    </td>

                    {/* 11. Delay Minutes */}
                    <td className={`p-2 border-l border-slate-200 font-mono font-bold ${
                      row.delayMinutes > 0 ? 'bg-rose-100 text-rose-700' : 'text-slate-400'
                    }`}>
                      {row.delayMinutes > 0 ? row.delayMinutes : 0}
                    </td>

                    {/* 12. Delay Deduction */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-rose-600">
                      {row.delayDeduction > 0 ? row.delayDeduction.toFixed(2) : '-'}
                    </td>

                    {/* 13. Overtime Minutes */}
                    <td className={`p-2 border-l border-slate-200 font-mono font-bold ${
                      row.overtimeMinutes > 0 ? 'text-blue-700' : 'text-slate-400'
                    }`}>
                      {row.overtimeMinutes > 0 ? row.overtimeMinutes : 0}
                    </td>

                    {/* 14. Overtime Amount */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-blue-600">
                      {row.overtimeAmount > 0 ? row.overtimeAmount.toFixed(2) : '-'}
                    </td>

                    {/* 15. Special Penalty */}
                    <td className="p-2 border-l border-slate-200 font-mono text-rose-600 font-bold">
                      {row.specialPenalty > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePrintRowVoucher(row, 'penalty', row.specialPenalty)}
                          className="hover:underline flex items-center justify-center gap-1 mx-auto text-rose-600 cursor-pointer"
                          title="طباعة إيصال خصم 80mm"
                        >
                          <Printer size={11} className="opacity-60" />
                          <span>{row.specialPenalty.toFixed(2)}</span>
                        </button>
                      ) : '-'}
                    </td>

                    {/* 16. Absence Deduction */}
                    <td className="p-2 border-l border-slate-200 font-mono text-rose-600 font-bold">
                      {row.absenceDeduction > 0 ? row.absenceDeduction.toFixed(2) : '-'}
                    </td>

                    {/* 17. Advances */}
                    <td className="p-2 border-l border-slate-200 font-mono text-amber-700 font-bold">
                      {row.advances > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePrintRowVoucher(row, 'advance', row.advances)}
                          className="hover:underline flex items-center justify-center gap-1 mx-auto text-amber-700 cursor-pointer"
                          title="طباعة إيصال سلفة 80mm"
                        >
                          <Printer size={11} className="opacity-60" />
                          <span>{row.advances.toFixed(2)}</span>
                        </button>
                      ) : '-'}
                    </td>

                    {/* 18. Bonuses */}
                    <td className="p-2 border-l border-slate-200 font-mono text-emerald-700 font-bold">
                      {row.bonuses > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePrintRowVoucher(row, 'bonus', row.bonuses)}
                          className="hover:underline flex items-center justify-center gap-1 mx-auto text-emerald-700 cursor-pointer"
                          title="طباعة إيصال مكافأة 80mm"
                        >
                          <Printer size={11} className="opacity-60" />
                          <span>{row.bonuses.toFixed(2)}</span>
                        </button>
                      ) : '-'}
                    </td>

                    {/* 19. Employee Work Revenue */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-slate-800">
                      {row.workRevenue > 0 ? row.workRevenue.toFixed(0) : '-'}
                    </td>

                    {/* 20. Employee Commission */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-emerald-600">
                      {row.commissionAmount > 0 ? row.commissionAmount.toFixed(2) : '0'}
                    </td>

                    {/* 20.1 Paid Commissions */}
                    <td className="p-2 border-l border-slate-200 font-mono text-rose-600 font-bold bg-amber-50/30">
                      {row.commissionPaid > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePrintRowVoucher(row, 'commission_payout', row.commissionPaid, 'سند صرف عمولة مسجلة بالتايم شيت')}
                          className="hover:underline flex items-center justify-center gap-1 mx-auto text-rose-600 cursor-pointer"
                          title="طباعة إيصال صرف عمولة 80mm"
                        >
                          <Printer size={11} className="opacity-60" />
                          <span>{row.commissionPaid.toFixed(2)}</span>
                        </button>
                      ) : '-'}
                    </td>

                    {/* 21. Net Daily */}
                    <td className={`p-2 border-l border-slate-200 font-mono font-black text-xs ${
                      row.netDaily < 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-900 bg-slate-50'
                    }`}>
                      {row.netDaily.toFixed(2)}
                    </td>

                    {/* 22. Forgive Delay Checkbox */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleDelayForgive(key, row.isDelayForgiven)}
                        className="text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                        title={row.isDelayForgiven ? 'تمت المسامحة (إلغاء الخصم)' : 'تفعيل المسامحة عن التأخير'}
                      >
                        {row.isDelayForgiven ? (
                          <CheckSquare size={16} className="text-emerald-600 mx-auto" />
                        ) : (
                          <Square size={16} className="text-slate-300 mx-auto" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer Summary Row (Exact as in reference image) */}
            <tfoot className="bg-slate-200 font-black text-slate-900 border-t-2 border-slate-400 sticky bottom-0 text-[11px]">
              <tr>
                <td colSpan={3} className="p-2.5 text-center bg-slate-300 font-black border-l border-slate-400">
                  المجموع الكلي ({timesheetRows.length} سجل)
                </td>
                <td className="p-2.5 font-mono border-l border-slate-400">{totals.dailyRateSum.toFixed(2)}</td>
                <td colSpan={5} className="p-2.5 text-center text-slate-500 border-l border-slate-400">--</td>
                <td className="p-2.5 font-mono text-slate-700 border-l border-slate-400">{totals.permissionMinutesSum > 0 ? `${totals.permissionMinutesSum} د` : '--'}</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{totals.permissionDeductionSum > 0 ? totals.permissionDeductionSum.toFixed(2) : '--'}</td>
                <td className="p-2.5 text-center text-slate-500 border-l border-slate-400">--</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{totals.delayMinutesSum} د</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{totals.delayDeductionSum.toFixed(2)}</td>
                <td className="p-2.5 font-mono text-blue-700 border-l border-slate-400">{totals.overtimeMinutesSum} د</td>
                <td className="p-2.5 font-mono text-blue-700 border-l border-slate-400">{totals.overtimeAmountSum.toFixed(2)}</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{totals.specialPenaltySum.toFixed(2)}</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{totals.absenceDeductionSum.toFixed(2)}</td>
                <td className="p-2.5 font-mono text-amber-800 border-l border-slate-400">{totals.advancesSum.toFixed(2)}</td>
                <td className="p-2.5 font-mono text-emerald-800 border-l border-slate-400">{totals.bonusesSum.toFixed(2)}</td>
                <td className="p-2.5 font-mono text-slate-900 border-l border-slate-400">{totals.workRevenueSum.toFixed(2)}</td>
                <td className="p-2.5 font-mono text-emerald-800 border-l border-slate-400">{totals.commissionSum.toFixed(2)}</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400 bg-amber-100/60 font-bold">
                  {totals.commissionPaidSum > 0 ? totals.commissionPaidSum.toFixed(2) : '--'}
                </td>
                <td className="p-2.5 font-mono text-emerald-900 bg-emerald-200 text-sm font-black border-l border-slate-400">
                  {totals.netSum.toFixed(2)} {settings.currency}
                </td>
                <td className="p-2.5 text-center text-slate-400">--</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Salary Slip Modal (80mm preview and print) */}
      {showSlipModal && activeSlipSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                <Printer size={16} />
                قسيمة الراتب 80mm
              </h3>
              <button onClick={() => setShowSlipModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* The 80mm Thermal Component */}
            <div className="border border-slate-200 rounded-2xl p-2 bg-slate-50 shadow-inner flex justify-center">
              <ThermalSalarySlip settings={settings} summary={activeSlipSummary} />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handlePrintSlip}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer size={14} />
                <span>طباعة القسيمة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH SALARY DISBURSEMENT MODAL */}
      {showDisbursementModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150" dir="rtl">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
                  <DollarSign size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    كشف ومسير صرف رواتب الموظفين (Salary Disbursement)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الفترة المعتمدة: من <strong className="text-slate-800 font-mono">{startDate}</strong> إلى <strong className="text-slate-800 font-mono">{endDate}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDisbursementModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Treasury Selection & Date Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Wallet size={14} className="text-emerald-600" />
                  <span>الخزينة المنصرف منها الرواتب *</span>
                </label>
                <select
                  value={disbursementTreasuryId}
                  onChange={e => setDisbursementTreasuryId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-emerald-600 outline-none"
                >
                  {settings.treasuries.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (رصيد: {((t as any).balance ?? 0).toFixed(2)} {settings.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar size={14} className="text-indigo-600" />
                  <span>تاريخ الصرف الفعلي *</span>
                </label>
                <input
                  type="date"
                  value={disbursementDate}
                  onChange={e => setDisbursementDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  البيان والملاحظات
                </label>
                <input
                  type="text"
                  value={disbursementNote}
                  onChange={e => setDisbursementNote(e.target.value)}
                  placeholder="صرف رواتب الشهر..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* Payroll Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={selectedDisbursementEmpIds.length === activeEmployees.length}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedDisbursementEmpIds(activeEmployees.map(emp => emp.id));
                            } else {
                              setSelectedDisbursementEmpIds([]);
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                      </th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">أيام العمل</th>
                      <th className="p-3">الراتب المستحق</th>
                      <th className="p-3">العمولات المحققة</th>
                      <th className="p-3">المكافآت (+)</th>
                      <th className="p-3">السلف والخصومات (-)</th>
                      <th className="p-3 text-emerald-800">الصافي المستحق للصرف</th>
                      <th className="p-3 text-center">إجراء فردي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payrollDisbursementData.map(item => {
                      const isSelected = selectedDisbursementEmpIds.includes(item.emp.id);

                      return (
                        <tr 
                          key={item.emp.id} 
                          className={`hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedDisbursementEmpIds([...selectedDisbursementEmpIds, item.emp.id]);
                                } else {
                                  setSelectedDisbursementEmpIds(selectedDisbursementEmpIds.filter(id => id !== item.emp.id));
                                }
                              }}
                              className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{item.emp.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              #{item.emp.fingerprintCode || item.emp.id} | {item.emp.role}
                            </div>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-700">
                            {item.presentDaysCount} يوم
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {item.earnedBaseSalary.toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-700">
                            +{item.totalCommissions.toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-700">
                            +{item.totalBonuses.toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-bold text-rose-700">
                            -{item.totalDeductions.toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-black text-emerald-800 text-sm">
                            {item.netPayable.toFixed(2)} {settings.currency}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDisburseSalaries([item.emp.id])}
                              disabled={item.netPayable <= 0}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 mx-auto cursor-pointer shadow-xs"
                            >
                              <Check size={13} />
                              <span>صرف وإيصال</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary & Bulk Action Footer */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-wrap gap-4 text-xs">
                <div>
                  <span className="text-slate-500">عدد الموظفين المحددين: </span>
                  <strong className="text-slate-900 font-mono font-black">{selectedDisbursementEmpIds.length}</strong>
                </div>
                <div>
                  <span className="text-slate-500">إجمالي صافي المبالغ المطلوب صرفها: </span>
                  <strong className="text-emerald-700 font-mono font-black text-base">
                    {payrollDisbursementData
                      .filter(d => selectedDisbursementEmpIds.includes(d.emp.id))
                      .reduce((sum, d) => sum + d.netPayable, 0)
                      .toFixed(2)} {settings.currency}
                  </strong>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowDisbursementModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleDisburseSalaries(selectedDisbursementEmpIds)}
                  disabled={selectedDisbursementEmpIds.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <DollarSign size={16} />
                  <span>اعتماد وصرف رواتب المحددين دفعة واحدة</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Attendance Check-in / Check-out Manual & Edit Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in max-h-[92vh] overflow-y-auto custom-scrollbar" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">تسجيل / تعديل وقت دوام هذا اليوم</h3>
                  <p className="text-[11px] text-slate-500">تعديل موعد الحضور أو الانصراف الفعلي لهذا اليوم، إضافة وقت، أو حذفه لتعيين اليوم كغياب</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAttendanceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الموظف *
                </label>
                <select
                  value={attendanceForm.empId}
                  onChange={e => setAttendanceForm({ ...attendanceForm, empId: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-600 focus:bg-white outline-none"
                >
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.fingerprintCode ? `كود: ${emp.fingerprintCode}` : emp.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تاريخ اليوم المستهدف *
                </label>
                <input
                  type="date"
                  value={attendanceForm.date}
                  onChange={e => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-600 focus:bg-white outline-none"
                />
              </div>

              {/* Times Grid */}
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-indigo-950 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock size={13} className="text-emerald-600" />
                        <span>ساعة الحضور *</span>
                      </span>
                    </label>
                    <input
                      type="time"
                      value={attendanceForm.checkIn}
                      onChange={e => {
                        const newIn = e.target.value;
                        const willBeOvernight = attendanceForm.checkOut && newIn ? attendanceForm.checkOut <= newIn : attendanceForm.isNextDayCheckout;
                        setAttendanceForm({ ...attendanceForm, checkIn: newIn, isNextDayCheckout: willBeOvernight });
                      }}
                      required
                      className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-600 outline-none shadow-2xs text-center"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                        <Clock size={13} className="text-slate-500" />
                        <span>ساعة الانصراف</span>
                      </label>
                      {attendanceForm.checkOut && (
                        <button
                          type="button"
                          onClick={() => setAttendanceForm({ ...attendanceForm, checkOut: '', isNextDayCheckout: false })}
                          className="text-[10px] text-rose-600 hover:underline cursor-pointer font-bold"
                          title="إلغاء تسجيل الانصراف"
                        >
                          مسح ✕
                        </button>
                      )}
                    </div>
                    <input
                      type="time"
                      value={attendanceForm.checkOut || ''}
                      onChange={e => {
                        const newOut = e.target.value;
                        // Auto-toggle isNextDayCheckout if checkOut is earlier than or equal to checkIn (e.g. In 13:00, Out 02:00)
                        const autoOvernight = Boolean(newOut && attendanceForm.checkIn && newOut <= attendanceForm.checkIn);
                        setAttendanceForm({ 
                          ...attendanceForm, 
                          checkOut: newOut,
                          isNextDayCheckout: autoOvernight ? true : attendanceForm.isNextDayCheckout 
                        });
                      }}
                      placeholder="--:--"
                      className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-600 outline-none shadow-2xs text-center"
                    />
                  </div>
                </div>

                {/* Next-Day (+1) Checkout Toggle & Live Hours Preview */}
                {attendanceForm.checkOut && (
                  <div className="pt-2 border-t border-indigo-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={attendanceForm.isNextDayCheckout}
                        onChange={e => setAttendanceForm({ ...attendanceForm, isNextDayCheckout: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-indigo-300 cursor-pointer"
                      />
                      <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
                        <span>🌙 انصراف في اليوم التالي (بعد منتصف الليل +1 يوم)</span>
                      </span>
                    </label>

                    {/* Calculated Live Working Hours Preview */}
                    {(() => {
                      const inParts = attendanceForm.checkIn.split(':').map(Number);
                      const outParts = attendanceForm.checkOut.split(':').map(Number);
                      const inMin = (inParts[0] || 0) * 60 + (inParts[1] || 0);
                      let outMin = (outParts[0] || 0) * 60 + (outParts[1] || 0);
                      if (attendanceForm.isNextDayCheckout || outMin <= inMin) {
                        outMin += 1440;
                      }
                      const totalDiff = Math.max(0, outMin - inMin);
                      const hrs = Math.floor(totalDiff / 60);
                      const mins = totalDiff % 60;
                      return (
                        <span className="bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-xs font-mono font-black text-indigo-700 shadow-2xs">
                          ساعات العمل: {hrs} س {mins > 0 ? `و ${mins} د` : ''}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-slate-400 w-full font-bold">خيارات سريعة وتعبئة جاهزة:</span>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '13:00', checkOut: '02:00', isNextDayCheckout: true })}
                  className="text-[10px] font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                >
                  <span>🌙 شفت ليلي (1:00 ظ - 2:00 ص) [13 ساعة]</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '16:00', checkOut: '02:00', isNextDayCheckout: true })}
                  className="text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                >
                  <span>🌙 شفت سهرة (4:00 ع - 2:00 ص) [10 ساعات]</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '09:00', checkOut: '18:00', isNextDayCheckout: false })}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                >
                  دوام كامل (9:00 - 18:00)
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '10:00', checkOut: '19:00', isNextDayCheckout: false })}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                >
                  دوام مسائي (10:00 - 19:00)
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '09:00', checkOut: '14:00', isNextDayCheckout: false })}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                >
                  نصف يوم (9:00 - 14:00)
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '09:00', checkOut: '', isNextDayCheckout: false })}
                  className="text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                >
                  حضور فقط بدون انصراف
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات أو سبب التعديل (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: تعديل يدوي بناءً على إذن مسبق / نسيان بصمة..."
                  value={attendanceForm.notes || ''}
                  onChange={e => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-indigo-600 focus:bg-white outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDeleteAttendance(attendanceForm.empId, attendanceForm.date)}
                  className="text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="حذف البصمات المسجلة لهذا اليوم واعتباره غياب"
                >
                  <Trash2 size={14} />
                  <span>حذف وقت اليوم (تعيين غياب) 🗑️</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAttendanceModal(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAttendance}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>{isSavingAttendance ? 'جاري الحفظ...' : 'حفظ وتحديث التايم شيت 💾'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📈 MODAL: SALARY INCREMENT (تسجيل وتطبيق زيادة راتب) */}
      {showSalaryIncrementModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black shadow-md shadow-purple-600/20">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تسجيل وتطبيق زيادة في الراتب (Salary Increment)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تطبيق زيادة لموظف محدد أو تطبيق نسبة مئوية لمجموعة من الموظفين مع حفظ السجل الكامل في قاعدة البيانات
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowSalaryIncrementModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplySalaryIncrement} className="space-y-4">
              {/* Application Mode Toggle */}
              <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIncrementMode('single')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    incrementMode === 'single' ? 'bg-white text-purple-950 shadow-xs border border-purple-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User size={14} />
                  <span>زيادة لموظف واحد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIncrementMode('bulk')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    incrementMode === 'bulk' ? 'bg-white text-purple-950 shadow-xs border border-purple-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Percent size={14} />
                  <span>زيادة جماعية لمجموعة موظفين</span>
                </button>
              </div>

              {/* Single Employee Selection */}
              {incrementMode === 'single' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اختر الموظف المستحق للزيادة *</label>
                  <select
                    value={targetEmpId}
                    onChange={e => setTargetEmpId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-600"
                  >
                    {activeEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} — الراتب الحالي: {emp.baseSalary?.toFixed(2) || '0.00'} {settings.currency}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Bulk Employee Selection */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">حدد الموظفين المشمولين بالزيادة *</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedEmpIdsForBulk.length === activeEmployees.length) {
                          setSelectedEmpIdsForBulk([]);
                        } else {
                          setSelectedEmpIdsForBulk(activeEmployees.map(e => e.id));
                        }
                      }}
                      className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
                    >
                      {selectedEmpIdsForBulk.length === activeEmployees.length ? 'إلغاء تحديد الكل' : 'تحديد جميع الموظفين'}
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1.5 bg-slate-50">
                    {activeEmployees.map(emp => {
                      const isChecked = selectedEmpIdsForBulk.includes(emp.id);
                      return (
                        <label key={emp.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 cursor-pointer hover:bg-purple-50/50 text-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedEmpIdsForBulk(prev => prev.filter(id => id !== emp.id));
                                } else {
                                  setSelectedEmpIdsForBulk(prev => [...prev, emp.id]);
                                }
                              }}
                              className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                            />
                            <span className="font-bold text-slate-800">{emp.name}</span>
                          </div>
                          <span className="font-mono text-slate-500 text-[11px]">
                            الراتب: {emp.baseSalary?.toFixed(2) || '0.00'} {settings.currency}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    تم تحديد {selectedEmpIdsForBulk.length} من أصل {activeEmployees.length} موظف
                  </p>
                </div>
              )}

              {/* Increment Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/60 p-4 rounded-2xl border border-purple-100">
                <div>
                  <label className="block text-xs font-bold text-purple-950 mb-1">نوع الزيادة *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIncrementType('percentage')}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        incrementType === 'percentage'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-purple-900 border border-purple-200'
                      }`}
                    >
                      نسبة مئوية (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncrementType('fixed')}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        incrementType === 'fixed'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-purple-900 border border-purple-200'
                      }`}
                    >
                      مبلغ ثابت ({settings.currency})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-950 mb-1">
                    {incrementType === 'percentage' ? 'نسبة الزيادة المئوية (%) *' : `مبلغ الزيادة (${settings.currency}) *`}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0.1}
                      step="any"
                      required
                      value={incrementValue}
                      onChange={e => setIncrementValue(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={incrementType === 'percentage' ? 'مثال: 10' : 'مثال: 500'}
                      className="w-full bg-white border border-purple-300 rounded-xl px-3.5 py-2 text-xs font-mono font-black text-purple-950 outline-none focus:border-purple-600 text-left shadow-2xs"
                    />
                    <span className="absolute left-3 top-2 text-xs font-black text-purple-600">
                      {incrementType === 'percentage' ? '%' : settings.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Effective Date & Approved By & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ سريان الزيادة *</label>
                  <input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسؤول المعتمد للزيادة</label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={e => setApprovedBy(e.target.value)}
                    placeholder="مدير النظام..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب وملاحظات الزيادة</label>
                <input
                  type="text"
                  value={incrementReason}
                  onChange={e => setIncrementReason(e.target.value)}
                  placeholder="مثال: ترقية سنوية / تعديل سلم الرواتب / مكافأة تميز..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-600"
                />
              </div>

              {/* Live Preview Summary Card */}
              {incrementMode === 'single' ? (() => {
                const emp = activeEmployees.find(e => e.id === targetEmpId);
                const currentBase = Number(emp?.baseSalary) || 0;
                const val = Number(incrementValue) || 0;
                const incAmt = incrementType === 'percentage' ? (currentBase * val) / 100 : val;
                const newBase = currentBase + incAmt;

                return (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3.5 rounded-2xl border border-purple-200 text-xs space-y-2">
                    <div className="font-black text-purple-950 flex items-center justify-between border-b border-purple-200/60 pb-1.5">
                      <span>المعاينة قبل التطبيق للموظف ({emp?.name || '-'}):</span>
                      <span className="text-purple-700 font-mono">+{incAmt.toFixed(2)} {settings.currency}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2 rounded-xl border border-purple-100">
                        <span className="text-slate-500 block text-[10px]">الراتب الحالي</span>
                        <span className="font-mono font-bold text-slate-800">{currentBase.toFixed(2)}</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-purple-100">
                        <span className="text-purple-600 block text-[10px]">مقدار الزيادة</span>
                        <span className="font-mono font-black text-purple-700">+{incAmt.toFixed(2)}</span>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                        <span className="text-emerald-700 block text-[10px] font-bold">الراتب الجديد</span>
                        <span className="font-mono font-black text-emerald-800 text-sm">{newBase.toFixed(2)} {settings.currency}</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-purple-50/70 p-3 rounded-2xl border border-purple-200 text-xs">
                  <div className="font-black text-purple-950 mb-1">
                    ملخص الزيادة الجماعية:
                  </div>
                  <p className="text-[11px] text-purple-900 leading-relaxed">
                    سيتم تطبيق زيادة مقدارها <strong className="font-mono">{incrementValue} {incrementType === 'percentage' ? '%' : settings.currency}</strong> على <strong className="text-purple-950 font-bold">{selectedEmpIdsForBulk.length}</strong> موظف ابتداءً من تاريخ <strong className="font-mono">{effectiveDate}</strong> مع حفظ السجلات في قاعدة البيانات.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSalaryIncrementModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs transition-colors shadow-md shadow-purple-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check size={15} />
                  <span>اعتماد وتطبيق زيادة الراتب وحفظها 💾</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📜 MODAL: FULL SALARY HISTORY VIEWER (سجل وتاريخ زيادات الرواتب بالكامل) */}
      {showSalaryHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
                  <History size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    سجل وتاريخ زيادات الرواتب (Salary Progression History)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الاطلاع على جميع حركات الزيادات السابقة والرواتب ومقدار التعديل والمسؤول المعتمد مع حفظ تسلسلها الزمني
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowSalaryHistoryModal(false);
                    setShowSalaryIncrementModal(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>+ تسجيل زيادة جديدة</span>
                </button>
                <button 
                  onClick={() => setShowSalaryHistoryModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">فلترة حسب الموظف:</label>
                <select
                  value={historyEmpFilter}
                  onChange={e => setHistoryEmpFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="all">جميع الموظفين ({employees.length})</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">بحث سريع:</label>
                <input
                  type="text"
                  placeholder="ابحث بالاسم، السبب، أو المعتمد..."
                  value={historySearchQuery}
                  onChange={e => setHistorySearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* History Table */}
            {(() => {
              const allHistoryEntries = employees.flatMap(emp => 
                (emp.salaryHistory || []).map((sh, idx) => ({
                  ...sh,
                  employeeId: emp.id,
                  employeeName: emp.name,
                  key: `${emp.id}-${sh.id || idx}`
                }))
              ).filter(item => {
                if (historyEmpFilter !== 'all' && item.employeeId !== historyEmpFilter) return false;
                if (historySearchQuery.trim()) {
                  const q = historySearchQuery.toLowerCase();
                  const matchName = item.employeeName?.toLowerCase().includes(q);
                  const matchReason = item.reason?.toLowerCase().includes(q);
                  const matchAppr = item.approvedBy?.toLowerCase().includes(q);
                  if (!matchName && !matchReason && !matchAppr) return false;
                }
                return true;
              }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

              const totalIncAmount = allHistoryEntries.reduce((sum, item) => sum + (item.newSalary - item.previousSalary), 0);

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                    <span>عدد حركات الزيادة المسجلة: <strong className="text-slate-900">{allHistoryEntries.length}</strong></span>
                    <span>مجموع مبالغ الزيادات: <strong className="text-emerald-700 font-mono">+{totalIncAmount.toFixed(2)} {settings.currency}</strong></span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="p-3">م</th>
                            <th className="p-3">الموظف</th>
                            <th className="p-3">تاريخ سريان الزيادة</th>
                            <th className="p-3">الراتب السابق</th>
                            <th className="p-3">مقدار الزيادة</th>
                            <th className="p-3">الراتب الجديد</th>
                            <th className="p-3">السبب / الملاحظات</th>
                            <th className="p-3">المعتمد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allHistoryEntries.map((item, idx) => {
                            const diff = item.newSalary - item.previousSalary;
                            const pct = item.previousSalary > 0 ? ((diff / item.previousSalary) * 100).toFixed(1) : '100';

                            return (
                              <tr key={item.key} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
                                    {item.employeeName?.charAt(0) || 'م'}
                                  </div>
                                  <span>{item.employeeName}</span>
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-700">{item.date}</td>
                                <td className="p-3 font-mono text-slate-500">{item.previousSalary?.toFixed(2)} {settings.currency}</td>
                                <td className="p-3 font-mono font-black text-purple-700">
                                  +{diff.toFixed(2)} {settings.currency}
                                  <span className="text-[10px] text-purple-500 font-semibold mr-1">({pct}%)</span>
                                </td>
                                <td className="p-3 font-mono font-black text-emerald-700 text-sm">
                                  {item.newSalary?.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                                </td>
                                <td className="p-3 text-slate-600">{item.reason || '-'}</td>
                                <td className="p-3 font-bold text-slate-700">
                                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                                    {item.approvedBy || 'مدير النظام'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {allHistoryEntries.length === 0 && (
                            <tr>
                              <td colSpan={8} className="p-10 text-center text-slate-400 font-bold">
                                لا توجد حركات زيادات رواتب مسجلة حتى الآن
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSalaryHistoryModal(false)}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMISSION PAYOUT MODAL */}
      {showCommissionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black shadow-md shadow-amber-600/20">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">سند صرف عمولة موظف</h3>
                  <p className="text-xs text-slate-500">صرف عمولة مجمعة أو يومية أو جزء منها مع خصمها من الخزينة</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowCommissionModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDisburseCommission} className="space-y-4">
              {/* Employee selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموظف المستحق *</label>
                <select
                  value={commEmpId}
                  onChange={e => setCommEmpId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-600"
                  required
                >
                  <option value="">-- اختر الموظف --</option>
                  {activeEmployees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} (كود: {e.fingerprintCode || e.id} | نسبة: {e.commissionRate}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Commission Stats Preview for this employee */}
              {selectedCommEmp && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-slate-500 font-bold">إجمالي المستحق</p>
                    <p className="font-mono font-black text-slate-800 mt-0.5">{commStats.earnedCommissions.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-slate-500 font-bold">المصروف سابقاً</p>
                    <p className="font-mono font-black text-rose-600 mt-0.5">{commStats.paidCommissions.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-slate-500 font-bold">المتبقي للصرف</p>
                    <p className="font-mono font-black text-emerald-700 mt-0.5">{commStats.unpaidCommissions.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Amount to pay */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">المبلغ المراد صرفه ({settings.currency}) *</label>
                  {commStats.unpaidCommissions > 0 && (
                    <button
                      type="button"
                      onClick={() => setCommAmount(commStats.unpaidCommissions)}
                      className="text-[10px] font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                    >
                      صرف كامل المتبقي ({commStats.unpaidCommissions.toFixed(2)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={commAmount}
                  onChange={e => setCommAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="أدخل مبلغ العمولة المصروفة..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black font-mono text-slate-900 outline-none focus:border-amber-600"
                  required
                />
              </div>

              {/* Date & Treasury */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الصرف *</label>
                  <input
                    type="date"
                    value={commDate}
                    onChange={e => setCommDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الخزينة المنصرف منها *</label>
                  <select
                    value={commTreasuryId}
                    onChange={e => setCommTreasuryId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-600"
                    required
                  >
                    {settings.treasuries.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} (رصيد: {((t as any).balance ?? 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان / الملاحظات</label>
                <input
                  type="text"
                  value={commNote}
                  onChange={e => setCommNote(e.target.value)}
                  placeholder="مثال: صرف عمولة أسبوعية، أو عمولة خدمات اليوم"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCommissionModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingCommissionPayout}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Coins size={14} />
                  <span>{isSavingCommissionPayout ? 'جارٍ الصرف...' : 'تأكيد وصرف العمولة 💵'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Registration Modal (إدارة وتسجيل إجازة) */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Palmtree size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">تسجيل إجازة موظف</h3>
                  <p className="text-xs text-slate-500">حساب عدد الأيام والأثر المالي وتوزيعها على التايم شيت</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="space-y-4">
              {/* Target Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموظف *</label>
                <select
                  value={leaveEmpId}
                  onChange={e => setLeaveEmpId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-600"
                  required
                >
                  <option value="">-- اختر الموظف --</option>
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} (كود: {emp.fingerprintCode || emp.id} | راتب: {emp.baseSalary?.toFixed(2) || '0.00'} {settings.currency})
                    </option>
                  ))}
                </select>
              </div>

              {/* Start & End Date Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ البداية (من) *</label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={e => setLeaveStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ النهاية (إلى) *</label>
                  <input
                    type="date"
                    value={leaveEndDate}
                    onChange={e => setLeaveEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-600"
                    required
                  />
                </div>
              </div>

              {/* Live Calculated Days Badge */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-sky-600" />
                  <span className="text-xs font-bold text-sky-950">إجمالي مدة الإجازة المحسوبة:</span>
                </div>
                <span className="text-sm font-black font-mono text-sky-700 bg-white px-3 py-1 rounded-xl border border-sky-100 shadow-2xs">
                  {leaveDaysCount} {leaveDaysCount === 1 ? 'يوم واحد' : leaveDaysCount === 2 ? 'يومان' : `${leaveDaysCount} أيام`}
                </span>
              </div>

              {/* Leave Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة احتساب الإجازة (الأثر المالي) *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveType('paid')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
                      leaveType === 'paid'
                        ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-600 ring-offset-1'
                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>مدفوعة الأجر (براتب) 🟢</span>
                    <span className="text-[10px] font-normal opacity-90">يستحق راتب الأيام بالكامل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveType('unpaid')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
                      leaveType === 'unpaid'
                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-600 ring-offset-1'
                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>بدون أجر (بدون راتب) 🟡</span>
                    <span className="text-[10px] font-normal opacity-90">خصم اليومية دون جزاء غياب</span>
                  </button>
                </div>
              </div>

              {/* Live Financial Impact Details Box */}
              {selectedLeaveEmp && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>أجر اليوم للموظف:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {((selectedLeaveEmp.baseSalary || 0) / 30).toFixed(2)} {settings.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>الأثر المالي المتوقع في التايم شيت:</span>
                    <span className={`font-mono font-bold ${leaveType === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {leaveType === 'paid' 
                        ? `+${(((selectedLeaveEmp.baseSalary || 0) / 30) * leaveDaysCount).toFixed(2)} ${settings.currency} (مدفوع)`
                        : `0.00 ${settings.currency} (غير مدفوع مع إعفاء من جزاء الغياب)`
                      }
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    {leaveType === 'paid' 
                      ? 'ℹ️ سيتم إدراج الأيام في التايم شيت بحالة "إجازة براتب"، ولا يتم تطبيق أي خصومات غياب أو تأخير عليها.'
                      : 'ℹ️ سيتم إدراج الأيام في التايم شيت بحالة "إجازة بدون راتب"، ولا يتم احتساب راتب ولا جزاء غياب (الصافي = 0).'
                    }
                  </div>
                </div>
              )}

              {/* Reason / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السبب / نوع وتفاصيل الإجازة</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="مثال: إجازة سنوية اعتيادية / إجازة مرضية / ظرف عائلي خاص"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-600"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingLeave}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-sky-600 hover:bg-sky-700 flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Palmtree size={14} />
                  <span>{isSavingLeave ? 'جارٍ الحفظ...' : 'تأكيد واعتماد الإجازة 🏖️'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leaves History & Cancellation Modal (سجل الإجازات) */}
      {showLeavesListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">سجل إجازات الموظفين المسجلة</h3>
                  <p className="text-xs text-slate-500">عرض جميع الإجازات الحالية والسابقة مع إمكانية الإلغاء أو الحذف</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeavesListModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {(() => {
                const allLeaves: { emp: Employee; leave: EmployeeLeaveRecord }[] = [];
                employees.forEach(e => {
                  (e.leaveRecords || []).forEach(l => {
                    allLeaves.push({ emp: e, leave: l });
                  });
                });

                if (allLeaves.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400">
                      <Palmtree size={48} className="mx-auto mb-2 opacity-30" />
                      <p className="font-bold text-sm">لا توجد أي إجازات مسجلة حالياً</p>
                      <p className="text-xs mt-1">يمكنك إضافة إجازة جديدة بالضغط على زر "تسجيل إجازة 🏖️"</p>
                    </div>
                  );
                }

                // Sort newest start date first
                allLeaves.sort((a, b) => b.leave.startDate.localeCompare(a.leave.startDate));

                return allLeaves.map(({ emp, leave }) => {
                  const s = new Date(leave.startDate);
                  const e = new Date(leave.endDate);
                  const days = leave.daysCount || Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);

                  return (
                    <div
                      key={leave.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">{emp.name}</span>
                          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            كود: {emp.fingerprintCode || emp.id}
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            leave.type === 'paid' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {leave.type === 'paid' ? 'مدفوعة الأجر' : 'بدون أجر'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                          <span className="font-bold">الفترة:</span>
                          <span className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {leave.startDate}
                          </span>
                          <span>إلى</span>
                          <span className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {leave.endDate}
                          </span>
                          <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                            ({days} {days === 1 ? 'يوم' : days === 2 ? 'يومان' : 'أيام'})
                          </span>
                        </div>

                        {leave.note && (
                          <div className="text-[11px] text-slate-500">
                            <span className="font-semibold">السبب:</span> {leave.note}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteLeave(emp.id, leave.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>إلغاء الإجازة</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-3">
              <button
                type="button"
                onClick={() => {
                  setShowLeavesListModal(false);
                  handleOpenLeaveModal();
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>إضافة إجازة جديدة</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLeavesListModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


