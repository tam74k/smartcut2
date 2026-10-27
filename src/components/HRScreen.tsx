import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  AppSettings, Employee, Invoice, Transaction, Booking, ServiceItem, Product, 
  HRSettings, FingerprintLog, SalaryHistoryEntry, ShiftScheduleEntry, EmployeeFinancialRecord,
  EmployeeLeaveRecord, EmployeePermissionRecord 
} from '../types';
import { 
  Calendar, Clock, CheckCircle, AlertTriangle, Printer, User, Filter, 
  RotateCcw, Sparkles, Plus, CheckSquare, Square, FileText, Ban, ShieldAlert,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, DollarSign, Award, ArrowUpRight, Check, X, Wallet,
  Edit, Trash2, TrendingUp, TrendingDown, History, Percent, Coins, Palmtree, RefreshCw, DoorOpen, Timer,
  ShieldCheck, Briefcase, Maximize2, Minimize2, FileSpreadsheet, Search,
  Moon, Sun, Save, SlidersHorizontal, Banknote, Users
} from 'lucide-react';

import { ThermalSalarySlip, SalarySlipSummary } from './ThermalSalarySlip';
import { printHtml } from '../utils/print';
import { printThermalFinancialVoucher } from './ThermalFinancialVoucher';
import { calculateEmployeeCommission, getCommissionModelLabel, calculateEmployeeTotalCommission } from '../utils/commissionHelper';
import { calculateEmployeeTargetCommission } from '../utils/targetCalculationHelper';
import { DB, calculateFingerprintProcessedDate, getFingerprintProcessedDate } from '../services/db';
import { getActiveShiftDate, getEffectiveDateTime, getEffectiveDateOnly } from '../utils/shiftDate';
import { AuthService } from '../services/auth';
import { BiometricImportModal } from './BiometricImportModal';

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
  if (parts.length > 1) {
    return parts[1].substring(0, 5);
  }
  return null;
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

export const formatInvoiceDateTime = (rawDate?: string): { dateStr: string; timeStr: string } => {
  if (!rawDate) return { dateStr: '--', timeStr: '--' };
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const period = hours >= 12 ? 'م' : 'ص';
      const hours12 = hours % 12 || 12;
      const timeStr = `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
      return { dateStr, timeStr };
    }
  } catch {
    // fallback below
  }
  const parts = rawDate.split('T');
  if (parts.length === 2) {
    const dStr = parts[0];
    const tParts = parts[1].split(':');
    const h = Number(tParts[0]) || 0;
    const m = Number(tParts[1]) || 0;
    const p = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    return { dateStr: dStr, timeStr: `${h12}:${String(m).padStart(2, '0')} ${p}` };
  }
  const spaceParts = rawDate.split(' ');
  if (spaceParts.length >= 2) {
    const dStr = spaceParts[0];
    const tParts = spaceParts[1].split(':');
    const h = Number(tParts[0]) || 0;
    const m = Number(tParts[1]) || 0;
    const p = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    return { dateStr: dStr, timeStr: `${h12}:${String(m).padStart(2, '0')} ${p}` };
  }
  return { dateStr: rawDate, timeStr: '--' };
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
  status: 'regular' | 'absent' | 'weekly_off' | 'paid_leave' | 'unpaid_leave' | 'terminated' | 'mission';
  statusLabel: string;
  hasManualOrDeviceLog?: boolean;
  permissionStart?: string;
  permissionEnd?: string;
  permissionType?: 'shift_start' | 'mid_shift' | 'official_mission';
  permissionMinutes: number;
  permissionExcusedMinutes?: number;
  permissionDeductedMinutes?: number;
  permissionDeduction: number;
  administrativeAction?: 'none' | 'warning' | 'penalty';
  administrativeNotes?: string;
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
  dailyTargetAmount?: number;
  dailyTargetAchieved?: number;
  dailyTargetCommission?: number;
  targetAchievementPercentage?: number;
  isDailyTargetAchieved?: boolean;
  openingCommission?: number;
  commissionPaid: number;
  isDelayForgiven: boolean;
  netDaily: number;
}

/**
 * Checks whether an employee's salary has already been disbursed for the given period/month.
 */
export const getEmployeeSalaryDisbursementRecord = (
  emp: Employee, 
  start: string, 
  end: string, 
  monthStr?: string
): { isPaid: boolean; record?: EmployeeFinancialRecord } => {
  const targetMonth = monthStr || start.slice(0, 7); // e.g. "2026-09"
  const records = emp.financialRecords || [];

  for (const r of records) {
    const isSalaryRecord = r.type === 'salary' || r.id?.startsWith('FIN-SAL-') || r.note?.includes('مسير رواتب') || r.note?.includes('تم استلام صافي الراتب');
    if (!isSalaryRecord) continue;

    // 1. Explicit period match
    if (r.payrollPeriod) {
      if (r.payrollPeriod.month && r.payrollPeriod.month === targetMonth) {
        return { isPaid: true, record: r };
      }
      if (r.payrollPeriod.startDate === start && r.payrollPeriod.endDate === end) {
        return { isPaid: true, record: r };
      }
      if (r.payrollPeriod.startDate?.startsWith(targetMonth)) {
        return { isPaid: true, record: r };
      }
    }

    // 2. Note inspection (notes contain e.g. "فترة 2026-09-01 إلى 2026-09-30" or "شهر 2026-09")
    if (r.note) {
      if (r.note.includes(targetMonth)) {
        return { isPaid: true, record: r };
      }
      if (r.note.includes(start) && r.note.includes(end)) {
        return { isPaid: true, record: r };
      }
    }

    // 3. Fallback: If record date is in targetMonth and mentions salary disbursement
    if (r.date?.startsWith(targetMonth) && (r.note?.includes('صافي الراتب') || r.id?.startsWith('FIN-SAL-') || r.note?.includes('مسير رواتب'))) {
      return { isPaid: true, record: r };
    }
  }

  return { isPaid: false };
};

export function HRScreen({ 
  settings, 
  employees, 
  setEmployees,
  services = [],
  products = [],
  invoices = [],
  transactions = [],
  setTransactions,
  bookings = [],
  currentUser,
  fingerprintLogs = [],
  setFingerprintLogs,
  shiftData,
  activeBranchId,
  isEmbedded = false
}: { 
  settings: AppSettings;
  employees: Employee[]; 
  setEmployees: (e: Employee[]) => void;
  services?: ServiceItem[];
  products?: Product[];
  invoices?: Invoice[];
  transactions?: Transaction[];
  setTransactions?: (t: Transaction[]) => void;
  bookings?: Booking[];
  currentUser?: any;
  fingerprintLogs?: FingerprintLog[];
  setFingerprintLogs?: React.Dispatch<React.SetStateAction<FingerprintLog[]>> | ((logs: FingerprintLog[] | ((prev: FingerprintLog[]) => FingerprintLog[])) => void);
  shiftData?: { isOpen: boolean; date: string; initialCash?: number };
  activeBranchId?: string;
  isEmbedded?: boolean;
}) {
  const activeEmployees = useMemo(() => {
    return employees.filter(e => !e.isBlacklisted);
  }, [employees]);
  
  // View mode: 'single_employee' | 'single_day'
  const [viewMode, setViewMode] = useState<'single_employee' | 'single_day'>('single_employee');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => activeEmployees[0]?.id || '');

  // Synchronize selectedEmpId whenever activeEmployees changes if currently unset or invalid
  useEffect(() => {
    if (activeEmployees.length > 0 && (!selectedEmpId || !activeEmployees.some(e => e.id === selectedEmpId))) {
      setSelectedEmpId(activeEmployees[0].id);
    }
  }, [activeEmployees, selectedEmpId]);

  // تصحيح تلقائي لأي سلف سابقة تم تسجيلها كرواتب بالخطأ وتحويلها إلى رواتب رسمية
  useEffect(() => {
    let hasChanges = false;
    const cleanedEmployees = employees.map(emp => {
      let empChanged = false;
      const cleanedRecords = (emp.financialRecords || []).map(r => {
        if (r.type === 'advance' && (r.id?.startsWith('FIN-SAL-') || r.note?.includes('مسير رواتب') || r.note?.includes('تم استلام صافي الراتب'))) {
          empChanged = true;
          return { ...r, type: 'salary' as const };
        }
        return r;
      });
      if (empChanged) {
        hasChanges = true;
        return { ...emp, financialRecords: cleanedRecords };
      }
      return emp;
    });

    if (hasChanges) {
      console.log('[HRScreen] Automatically cleaned up legacy salary records misclassified as advances.');
      setEmployees(cleanedEmployees);
    }
  }, [employees]);

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
  
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  // Date filters
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);
  const [startDate, setStartDate] = useState(`${currentYearMonth}-01`);
  const [endDate, setEndDate] = useState(`${currentYearMonth}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`);
  const [selectedSingleDay, setSelectedSingleDay] = useState(now.toISOString().split('T')[0]);

  // Main HR sub-tab: 'timesheet' | 'commissions' | 'advances'
  const [hrMainTab, setHrMainTab] = useState<'timesheet' | 'commissions' | 'advances'>('timesheet');

  // Commissions Section State
  const [commSelectedEmpId, setCommSelectedEmpId] = useState<string>(() => selectedEmpId || activeEmployees[0]?.id || '');
  const [commStartDate, setCommStartDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [commEndDate, setCommEndDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [commTypeFilter, setCommTypeFilter] = useState<'all' | 'execution' | 'referral'>('all');
  const [commSearchQuery, setCommSearchQuery] = useState('');

  // Keep commSelectedEmpId synchronized with active employees
  useEffect(() => {
    if (activeEmployees.length > 0 && (!commSelectedEmpId || !activeEmployees.some(e => e.id === commSelectedEmpId))) {
      setCommSelectedEmpId(activeEmployees[0].id);
    }
  }, [activeEmployees, commSelectedEmpId]);

  // Advances Section State & Filters (سجل وجدول السلف النقدية)
  const [advanceEmpFilter, setAdvanceEmpFilter] = useState<string>('all');
  const [advanceDateFrom, setAdvanceDateFrom] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [advanceDateTo, setAdvanceDateTo] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [advanceTreasuryFilter, setAdvanceTreasuryFilter] = useState<string>('all');
  const [advanceSearchQuery, setAdvanceSearchQuery] = useState('');

  // Modals for Advances (Edit & New)
  const [editingAdvance, setEditingAdvance] = useState<{
    id: string;
    employeeId: string;
    employeeName: string;
    employeeRole?: string;
    employeeCode?: string;
    amount: number;
    date: string;
    treasuryId?: string;
    treasuryName: string;
    note: string;
    rawRecord: EmployeeFinancialRecord;
    matchingTransaction?: Transaction;
  } | null>(null);

  const [editAdvanceForm, setEditAdvanceForm] = useState<{
    amount: number | '';
    date: string;
    treasuryId: string;
    note: string;
  }>({
    amount: '',
    date: '',
    treasuryId: '',
    note: ''
  });

  const [showNewAdvanceModal, setShowNewAdvanceModal] = useState(false);
  const [newAdvanceForm, setNewAdvanceForm] = useState<{
    empId: string;
    amount: number | '';
    date: string;
    treasuryId: string;
    note: string;
  }>({
    empId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    treasuryId: '',
    note: ''
  });
  const [isSavingAdvance, setIsSavingAdvance] = useState(false);

  // Granular RBAC Permission checks for HR Operations
  const canViewTimesheet = AuthService.canDo('hr_view_timesheet', currentUser);
  const canManageAttendance = AuthService.canDo('hr_manage_attendance', currentUser);
  const canDeleteAttendance = AuthService.canDo('hr_delete_attendance', currentUser);
  const canManageAdvances = AuthService.canDo('hr_manage_advances', currentUser);
  const canManageBonuses = AuthService.canDo('hr_manage_bonuses', currentUser);
  const canManagePenalties = AuthService.canDo('hr_manage_penalties', currentUser);
  const canManageLeaves = AuthService.canDo('hr_manage_leaves', currentUser);
  const canManagePermissions = AuthService.canDo('hr_manage_permissions', currentUser);
  const canForgiveDelays = AuthService.canDo('hr_approve_delays_overtime', currentUser) || AuthService.canDo('hr_forgive_delays', currentUser);
  const canApproveOvertime = AuthService.canDo('hr_approve_delays_overtime', currentUser) || AuthService.canDo('hr_approve_overtime', currentUser);
  const canSalaryIncrements = AuthService.canDo('hr_manage_salary_increments', currentUser) || AuthService.canDo('hr_salary_increments', currentUser);
  const canDisburseSalaries = AuthService.canDo('hr_disburse_payroll', currentUser) || AuthService.canDo('hr_disburse_salaries', currentUser);
  const canDisburseCommissions = AuthService.canDo('hr_manage_commissions', currentUser) || AuthService.canDo('hr_disburse_commissions', currentUser);
  const canPrintSlips = AuthService.canDo('hr_print_slips', currentUser);
  const canFingerprintSync = AuthService.canDo('hr_fingerprint_sync', currentUser);

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
          setFingerprintLogs(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(logs)) return logs;
            return prev;
          });
        }
        setLocalLogs(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(logs)) return logs;
          return prev;
        });
      }

      // 2. Fetch fresh employees to update any changes (leaves, shifts, base salary)
      const freshEmployees = await DB.fetchEmployees(sId);
      if (freshEmployees && Array.isArray(freshEmployees) && freshEmployees.length > 0) {
        setEmployees(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(freshEmployees)) {
            return freshEmployees;
          }
          return prev;
        });
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
    if (!canSalaryIncrements) {
      alert('عذراً، ليس لديك صلاحية اعتماد زيادات الرواتب.');
      return;
    }
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
        increasePercentage: Number(Number(increasePct || 0).toFixed(2)),
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

    alert(`تم تطبيق وحفظ زيادة الراتب بنجاح لـ (${updatedEmployeesList.length}) موظف، وتوثيق كافة الحركات في قاعدة البيانات وسجل تاريخ الزيادات.`);
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
    if (!startDate || !endDate) return [];
    const dates: string[] = [];
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    if (!sY || !sM || !sD || !eY || !eM || !eD) return [];

    let curr = new Date(Date.UTC(sY, sM - 1, sD, 12, 0, 0));
    const end = new Date(Date.UTC(eY, eM - 1, eD, 12, 0, 0));

    while (curr <= end) {
      const y = curr.getUTCFullYear();
      const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
      const d = String(curr.getUTCDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return dates;
  }, [viewMode, startDate, endDate, selectedSingleDay]);

  // Main Calculation Engine for Rows
  const timesheetRows: DayTimesheetRow[] = useMemo(() => {
    const rows: DayTimesheetRow[] = [];
    const targetEmpId = selectedEmpId || activeEmployees[0]?.id || '';
    const targetEmployees = viewMode === 'single_employee' 
      ? activeEmployees.filter(e => e.id === targetEmpId)
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

        // 3. Permissions on this date & Setup (7 Business Rules Cases)
        const dayPermissions = (emp.permissionRecords || []).filter(p => p.date === dateStr);
        const permission = dayPermissions[0];
        let permissionMinutes = 0;
        let permissionExcusedMinutes = 0;
        let permissionDeductedMinutes = 0;
        let permissionDeduction = 0;
        let administrativeAction: 'none' | 'warning' | 'penalty' = 'none';
        let administrativeNotes: string | undefined = undefined;

        const minuteRate = baseDailyRate > 0 ? (baseDailyRate / 8) / 60 : 0;

        // Check for official mission (الحالة 7)
        const isOfficialMission = dayPermissions.some(p => p.type === 'official_mission');

        // Total daily permission duration (excluding official missions)
        const totalDayPermissionMinutes = dayPermissions
          .filter(p => p.type !== 'official_mission')
          .reduce((sum, p) => sum + (Number(p.durationMinutes) || 0), 0);

        const maxDailyMinutes = (hrConfig.maxDailyPermissionHours ?? 4) * 60;
        const isExceededDailyLimit = totalDayPermissionMinutes > maxDailyMinutes;

        // Shift schedule times in minutes
        const schedParts = scheduledCheckIn.split(':').map(Number);
        const totalSchedMin = schedParts[0] * 60 + (schedParts[1] || 0);
        const delayGrace = hrConfig.delayGraceMinutes ?? 15;

        // Identify Shift Start Permission (الحالات 1، 2، 3، 4)
        let shiftStartPermission: EmployeePermissionRecord | undefined = undefined;
        let effectiveSchedInMin = totalSchedMin;

        for (const p of dayPermissions) {
          if (p.type === 'official_mission') continue;
          if (!p.startTime || !p.endTime) continue;
          const pStartParts = p.startTime.split(':').map(Number);
          const pStartMin = pStartParts[0] * 60 + (pStartParts[1] || 0);
          const pEndParts = p.endTime.split(':').map(Number);
          const pEndMin = pEndParts[0] * 60 + (pEndParts[1] || 0);

          const isExplicitStart = p.type === 'shift_start';
          const isTimeMatchStart = pStartMin <= (totalSchedMin + delayGrace) && pEndMin > totalSchedMin;

          if (isExplicitStart || isTimeMatchStart) {
            shiftStartPermission = p;
            if (pEndMin > effectiveSchedInMin) {
              effectiveSchedInMin = pEndMin;
            }
          }
        }

        // 4. Invoices & Sales on this date
        const dayInvoices = invoices.filter(inv => inv.date?.startsWith(dateStr));
        let workRevenue = 0;
        let invoiceExecutionCommission = 0;
        let exemptExecutionCommission = 0; // عمولات الخدمات المعفاة من التارجت (تصرف فورياً دائماً)
        let invoiceReferralCommission = 0;

        dayInvoices.forEach(inv => {
          inv.items?.forEach(item => {
            const isPerformer = (item.employeeId && item.employeeId === emp.id) || (!item.employeeId && item.technicianName && item.technicianName === emp.name);
            if (isPerformer) {
              const qty = item.quantity || 1;
              const itemTotal = (item.price || 0) * qty;
              workRevenue += itemTotal;

              const srv = (services || []).find(s => s.id === item.itemId || s.id === item.id || s.name === item.serviceName);
              const isExempt = Boolean(item.isTargetExempt ?? srv?.isTargetExempt);

              let itemComm = Number(item.employeeCommission ?? item.commissionAmount ?? (item as any).commission ?? 0);
              if (itemComm <= 0) {
                if (srv) {
                  const srvAmt = Number(srv.employeeCommissionAmount ?? srv.commissionAmount ?? 0);
                  const srvPct = Number(srv.employeeCommissionPercentage ?? srv.commissionRate ?? 0);
                  const rawBase = Number(srv.commissionableAmount ?? item.commissionableAmount ?? 0);
                  const commBase = rawBase > 0 ? rawBase : (item.price || 0);
                  if (srvAmt > 0) itemComm = srvAmt * qty;
                  else if (srvPct > 0) itemComm = (srvPct / 100) * commBase * qty;
                } else {
                  const prod = (products || []).find((p: any) => p.id === item.itemId || p.id === item.id || p.name === item.serviceName);
                  if (prod && prod.commission > 0) itemComm = prod.commission * qty;
                }
              }

              if (isExempt) {
                exemptExecutionCommission += itemComm;
              } else {
                invoiceExecutionCommission += itemComm;
              }
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

        // 5. Financial records (Advances, Bonuses, Penalties, Direct Service/Referral Commissions, Paid Commissions)
        let advances = 0;
        let bonuses = 0;
        let specialPenalty = 0;
        let directCommissions = 0;
        let financialReferralCommissions = 0;
        let commissionPaid = 0;

        emp.financialRecords?.filter(r => r.date?.startsWith(dateStr)).forEach(r => {
          const isSalaryRecord = r.type === 'salary' || (r.type === 'advance' && (r.id?.startsWith('FIN-SAL-') || r.note?.includes('مسير رواتب') || r.note?.includes('تم استلام صافي الراتب')));
          if (r.type === 'advance' && !isSalaryRecord) advances += (r.amount || 0);
          if (r.type === 'bonus') bonuses += (r.amount || 0);
          if (r.type === 'penalty_cash') specialPenalty += (r.amount || 0);
          if (r.type === 'penalty_days') specialPenalty += (r.days || 0) * baseDailyRate;
          if (r.type === 'commission') directCommissions += (r.amount || 0);
          if (r.type === 'referral_commission') financialReferralCommissions += (r.amount || 0);
          if (r.type === 'commission_payout') commissionPaid += (r.amount || 0);
        });

        const totalReferralCommission = Math.max(invoiceReferralCommission, financialReferralCommissions);

        // تحديد نظام التارجت للموظف
        const empTargetType = emp.targetType || ((Number(emp.dailyTargetAmount) > 0) ? 'daily' : ((Number(emp.monthlyTargetAmount || emp.target) > 0) ? 'monthly' : 'none'));

        let totalDailyCommission = 0;

        if (empTargetType === 'monthly') {
          // الموظف تارجته شهري:
          // لا تظهر أي عمولات مستحقة للموظف إلا على الخدمات التي لا تخضع للتارجت فقط (معفاة) + عمولة الإحالة
          totalDailyCommission = exemptExecutionCommission + totalReferralCommission;
        } else if (empTargetType === 'daily') {
          // الموظف تارجته يومي:
          // عمولة الخدمات المعفاة الفورية + عمولة الإحالة (وعمولة التارجت اليومي تضاف في خانة التارجت اليومي أدناه)
          totalDailyCommission = exemptExecutionCommission + totalReferralCommission;
        } else {
          // بدون تارجت: احتساب العمولات العادية لكامل الشغل
          const totalExecutionCommission = Math.max(invoiceExecutionCommission + exemptExecutionCommission, directCommissions);
          const commResult = calculateEmployeeTotalCommission({
            employee: emp,
            totalWork: workRevenue,
            serviceExecutionCommission: totalExecutionCommission,
            referralCommission: totalReferralCommission
          });
          totalDailyCommission = commResult.totalCommission;
        }

        const dailyRate = isTerminated ? 0 : baseDailyRate;
        const absenceMultiplier = typeof hrConfig.absenceDeductionDays === 'number' ? hrConfig.absenceDeductionDays : 1;

        // Determine Status, Attendance, Delays, Overtime
        // الحالة الافتراضية للموظف هي "غياب" واحتساب خصم الغياب آلياً بناءً على إعدادات النظام
        let status: DayTimesheetRow['status'] = 'absent';
        let statusLabel = 'غياب';
        let checkIn: string | null = null;
        let checkOut: string | null = null;
        let workedHoursFormatted = '--:--:--';
        let delayMinutes = 0;
        let delayDeduction = 0;
        let overtimeMinutes = 0;
        let overtimeAmount = 0;
        let absenceDeduction = 0;

        // Check actual fingerprint / attendance logs for this employee on dateStr using processed_date
        const dayLogs = (effectiveFingerprintLogs || []).filter(l => {
          const isEmp = (l.employeeId === emp.id || (emp.fingerprintCode && (String(l.fingerprintCode).trim() === String(emp.fingerprintCode).trim() || String((l as any).fingerprint_code).trim() === String(emp.fingerprintCode).trim())));
          if (!isEmp) return false;
          const pDate = getFingerprintProcessedDate(l);
          return pDate === dateStr || isSameDay(l.timestamp, dateStr) || (l.timestamp && l.timestamp.startsWith(dateStr));
        }).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        // Also check if there is an early-morning check_out on the NEXT day (belonging to overnight shift) as fallback
        const nextDateStr = getNextDateStr(dateStr);
        const nextDayEarlyCheckOut = (effectiveFingerprintLogs || []).find(l => {
          const isEmp = (l.employeeId === emp.id || (emp.fingerprintCode && (l.fingerprintCode === emp.fingerprintCode || (l as any).fingerprint_code === emp.fingerprintCode)));
          if (!isEmp || l.type !== 'check_out') return false;
          const pDate = getFingerprintProcessedDate(l);
          if (pDate === dateStr) return true;
          if (isSameDay(l.timestamp, nextDateStr)) {
            const time = extractTime(l.timestamp);
            if (!time) return false;
            const hour = Number(time.split(':')[0]);
            return hour <= 6;
          }
          return false;
        });

        // Exclude logs that represent absence or scheduled shift placeholder
        const validAttendanceLogs = dayLogs.filter(l => 
          !l.notes?.includes('غياب') && 
          !l.notes?.includes('دوام مجدول')
        );

        // Get check_in log and check_out log accurately
        const checkInLogs = validAttendanceLogs.filter(l => l.type === 'check_in');
        const rawCheckOutLogs = validAttendanceLogs.filter(l => l.type === 'check_out');

        const checkInLog = checkInLogs[checkInLogs.length - 1] || (validAttendanceLogs.length > 0 && !rawCheckOutLogs.includes(validAttendanceLogs[0]) ? validAttendanceLogs[0] : null);

        let checkOutLog = rawCheckOutLogs[rawCheckOutLogs.length - 1] || 
          (validAttendanceLogs.length > 1 && validAttendanceLogs[validAttendanceLogs.length - 1] !== checkInLog && !rawCheckOutLogs.includes(validAttendanceLogs[validAttendanceLogs.length - 1]) ? validAttendanceLogs[validAttendanceLogs.length - 1] : null);

        // If no checkout found in dayLogs, use the next day early checkout if available (from overnight shift)
        let isNextDayLog = false;
        if (!checkOutLog && nextDayEarlyCheckOut) {
          checkOutLog = nextDayEarlyCheckOut;
        }

        if (checkOutLog) {
          const isRawNextDay = isSameDay(checkOutLog.timestamp, nextDateStr) || (checkOutLog.timestamp && checkOutLog.timestamp.split('T')[0] === nextDateStr);
          const outTime = extractTime(checkOutLog.timestamp);
          const outHour = outTime ? Number(outTime.split(':')[0]) : 12;
          const isMidnightOut = outHour >= 0 && outHour <= 6;
          if (isRawNextDay || isMidnightOut) {
            isNextDayLog = true;
          }
        }

        // Critical safety check: A day cannot be marked as attended solely by an early-morning check_out
        // that belongs to yesterday's shift. If there is no checkInLog and checkOutLog is early morning without explicit note:
        if (!checkInLog && checkOutLog) {
          const outTime = extractTime(checkOutLog.timestamp);
          if (outTime) {
            const outHour = Number(outTime.split(':')[0]);
            const isExplicitToday = Boolean(checkOutLog.notes?.includes('(+1)') || checkOutLog.notes?.includes('بعد منتصف الليل'));
            if (outHour < 10 && !isExplicitToday) {
              checkOutLog = null;
              isNextDayLog = false;
            }
          }
        }

        const hasManualOrDeviceLog = Boolean(checkInLog || checkOutLog);
        const todayIsoStr = new Date().toISOString().split('T')[0];
        const isTodayOrPast = dateStr <= todayIsoStr;
        const hasWork = workRevenue > 0;

        const isWeeklyOffPaid = hrConfig.weeklyOffPaidType ? (hrConfig.weeklyOffPaidType === 'paid') : (hrConfig.weeklyOffPaid !== false);

        // Check for mid-shift exit without return (الحالة 6)
        const hasMidShiftPerm = dayPermissions.some(p => p.type === 'mid_shift');
        const hasNoReturnFromPermission = hasMidShiftPerm && checkOutLogs.length > 0 && checkInLogs.length <= 1;
        const isPermissionOverstayOrNoReturn = isExceededDailyLimit || hasNoReturnFromPermission;

        if (isTerminated) {
          status = 'terminated';
          statusLabel = 'إنهاء خدمة';
          absenceDeduction = 0;
        } else if (leave) {
          if (leave.type === 'paid') {
            status = 'paid_leave';
            statusLabel = 'إجازة براتب';
            absenceDeduction = 0;
          } else {
            status = 'unpaid_leave';
            statusLabel = 'إجازة بدون راتب';
            absenceDeduction = 0;
          }
        } else if (isOfficialMission) {
          // الحالة 7: مأموريات العمل الخارجية (Official Missions)
          // استثناء كامل من خصم رصيد الأذونات، واحتساب اليوم كدوام كامل مدفوع الأجر
          status = 'mission';
          statusLabel = 'مأمورية عمل رسمية';
          workedHoursFormatted = '08:00:00';
          earnedDaily = dailyRate;
          delayMinutes = 0;
          delayDeduction = 0;
          absenceDeduction = 0;
          permissionDeduction = 0;
          checkIn = checkInLog ? `${extractTime(checkInLog.timestamp)}:00` : `${scheduledCheckIn}:00`;
          checkOut = checkOutLog ? `${extractTime(checkOutLog.timestamp)}:00` : `${scheduledCheckOut}:00`;
        } else if (isPermissionOverstayOrNoReturn) {
          // الحالة 6: تجاوز الحد الأقصى اليومي (4 ساعات) أو عدم العودة بالبصمة
          permissionMinutes = totalDayPermissionMinutes;
          if (hrConfig.permissionOverstayAction === 'annual_leave' && (emp.availableVacations || 0) > 0) {
            status = 'paid_leave';
            statusLabel = isExceededDailyLimit ? 'إجازة اعتيادية (تجاوز 4س إذن)' : 'إجازة اعتيادية (عدم عودة من الإذن)';
            earnedDaily = dailyRate;
            absenceDeduction = 0;
          } else {
            status = 'absent';
            statusLabel = isExceededDailyLimit ? 'غياب بدون أجر (تجاوز حد الاستئذان اليومي)' : 'غياب بدون أجر (عدم عودة من الإذن)';
            absenceDeduction = dailyRate * absenceMultiplier;
            earnedDaily = 0;
          }
          if (checkInLog) checkIn = `${extractTime(checkInLog.timestamp)}:00`;
          if (checkOutLog) checkOut = `${extractTime(checkOutLog.timestamp)}:00`;
        } else if (isWeeklyOff && !hasManualOrDeviceLog) {
          status = 'weekly_off';
          statusLabel = 'عطلة أسبوعية';
          absenceDeduction = 0;
        } else if (hasManualOrDeviceLog) {
          // Present via fingerprint or registered attendance
          status = 'regular';
          statusLabel = 'حضور';
          absenceDeduction = 0;

          const inTimeStr = extractTime(checkInLog?.timestamp) || scheduledCheckIn;
          checkIn = `${inTimeStr}:00`;

          const outTimeStr = extractTime(checkOutLog?.timestamp);

          // Scheduled vs Actual check in
          const inParts = inTimeStr.split(':').map(Number);
          const actualInMin = inParts[0] * 60 + (inParts[1] || 0);

          const remainingFreeMinutes = Math.max(0, maxMonthlyPermissionMinutes - accumulatedPermissionMinutes);
          const isDelayFixed = hrConfig.delayDeductionType === 'fixed_amount';
          const absenceThresholdMin = (hrConfig.delayAbsenceThresholdHours || 2) * 60;

          // معالجة إذن بداية الدوام (الحالات 1، 2، 3، 4)
          if (shiftStartPermission) {
            const permDur = Number(shiftStartPermission.durationMinutes) || 0;
            const pEndParts = shiftStartPermission.endTime.split(':').map(Number);
            const permEndMin = pEndParts[0] * 60 + (pEndParts[1] || 0);
            const isOnTime = actualInMin <= permEndMin;
            const hasBalance = shiftStartPermission.isExcused || (remainingFreeMinutes >= permDur);

            if (hasBalance && isOnTime) {
              // الحالة 1: إذن ببداية الدوام مع توفر رصيد (حضور متوافق)
              if (!shiftStartPermission.isExcused) accumulatedPermissionMinutes += permDur;
              permissionMinutes += permDur;
              permissionExcusedMinutes += permDur;
              permissionDeduction = 0;
              delayMinutes = 0;
              delayDeduction = 0;
              statusLabel = 'حضور (إذن برصيد)';
            } else if (hasBalance && !isOnTime) {
              // الحالة 2: إذن ببداية الدوام مع توفر رصيد (حضور متأخر)
              if (!shiftStartPermission.isExcused) accumulatedPermissionMinutes += permDur;
              permissionMinutes += permDur;
              permissionExcusedMinutes += permDur;
              permissionDeduction = 0;

              const rawDelay = actualInMin - permEndMin;
              if (rawDelay > delayGrace) {
                delayMinutes = rawDelay;
                if (delayMinutes >= absenceThresholdMin) {
                  status = 'absent';
                  statusLabel = `تأخير بعد الإذن (${delayMinutes} د - غياب)`;
                  absenceDeduction = dailyRate * absenceMultiplier;
                } else if (delayMinutes >= (hrConfig.delayTier4StartMin ?? 61)) {
                  const tierVal = hrConfig.delayTier4Deduction ?? 50;
                  delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                  statusLabel = `تأخير بعد الإذن (${delayMinutes} د)`;
                } else if (delayMinutes >= (hrConfig.delayTier3StartMin ?? 46)) {
                  const tierVal = hrConfig.delayTier3Deduction ?? 25;
                  delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                  statusLabel = `تأخير بعد الإذن (${delayMinutes} د)`;
                } else if (delayMinutes >= (hrConfig.delayTier2StartMin ?? 31)) {
                  const tierVal = hrConfig.delayTier2Deduction ?? 15;
                  delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                  statusLabel = `تأخير بعد الإذن (${delayMinutes} د)`;
                } else if (delayMinutes >= (hrConfig.delayTier1StartMin ?? 15)) {
                  const tierVal = hrConfig.delayTier1Deduction ?? 5;
                  delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                  statusLabel = `تأخير بعد الإذن (${delayMinutes} د)`;
                }
              }
            } else if (!hasBalance && isOnTime) {
              // الحالة 3: إذن ببداية الدوام بدون رصيد (حضور متوافق)
              const freePart = Math.max(0, remainingFreeMinutes);
              const unpaidPart = permDur - freePart;
              accumulatedPermissionMinutes += freePart;
              permissionMinutes += permDur;
              permissionExcusedMinutes += freePart;
              permissionDeductedMinutes += unpaidPart;
              permissionDeduction += unpaidPart * minuteRate;
              delayMinutes = 0;
              delayDeduction = 0;
              statusLabel = `إذن غير مدفوع (${unpaidPart} د)`;
            } else {
              // الحالة 4: إذن ببداية الدوام بدون رصيد (حضور متأخر)
              const freePart = Math.max(0, remainingFreeMinutes);
              const unpaidPart = permDur - freePart;
              accumulatedPermissionMinutes += freePart;
              permissionMinutes += permDur;
              permissionExcusedMinutes += freePart;
              permissionDeductedMinutes += unpaidPart;

              const rawLate = actualInMin - permEndMin;
              permissionDeduction += unpaidPart * minuteRate;

              if (rawLate > delayGrace) {
                delayMinutes = rawLate;
                if (delayMinutes >= (hrConfig.delayTier4StartMin ?? 61)) {
                  const tierVal = hrConfig.delayTier4Deduction ?? 50;
                  delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                } else if (delayMinutes >= (hrConfig.delayTier3StartMin ?? 46)) {
                  const tierVal = hrConfig.delayTier3Deduction ?? 25;
                  delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                } else if (delayMinutes >= (hrConfig.delayTier2StartMin ?? 31)) {
                  const tierVal = hrConfig.delayTier2Deduction ?? 15;
                  delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                } else if (delayMinutes >= (hrConfig.delayTier1StartMin ?? 15)) {
                  const tierVal = hrConfig.delayTier1Deduction ?? 5;
                  delayDeduction = isDelayFixed ? tierVal : (dailyRate * tierVal / 100);
                }
              }

              // تفعيل Trigger الجزاء الإداري
              administrativeAction = 'warning';
              administrativeNotes = `إنذار إداري: تأخر وتجاوز موعد الإذن (${rawLate} د) مع نفاد الرصيد`;
              statusLabel = `تأخير وإذن بدون رصيد (${unpaidPart + delayMinutes} د - إنذار إداري)`;
            }
          } else {
            // لا يوجد إذن بداية دوام: احتساب التأخير الاعتيادي
            if (actualInMin > totalSchedMin) {
              const rawDelay = actualInMin - totalSchedMin;
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
          }

          // الحالة 5: إذن وسط الدوام (Mid-Shift Permissions)
          const midShiftPerms = dayPermissions.filter(p => p !== shiftStartPermission && p.type !== 'official_mission');
          midShiftPerms.forEach(p => {
            const dur = Number(p.durationMinutes) || 0;
            if (dur <= 0) return;
            permissionMinutes += dur;

            const currentRemFree = Math.max(0, maxMonthlyPermissionMinutes - accumulatedPermissionMinutes);
            if (p.isExcused || currentRemFree >= dur) {
              if (!p.isExcused) accumulatedPermissionMinutes += dur;
              permissionExcusedMinutes += dur;
              if (statusLabel === 'حضور') statusLabel = 'حضور (إذن وسط دوام)';
            } else {
              const freePart = Math.max(0, currentRemFree);
              const partialAbsence = dur - freePart;
              accumulatedPermissionMinutes += freePart;
              permissionExcusedMinutes += freePart;
              permissionDeductedMinutes += partialAbsence;
              permissionDeduction += partialAbsence * minuteRate;
              statusLabel += ` + غياب جزئي (${partialAbsence} د)`;
            }
          });

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
        } else {
          // فحص ما إذا تم إدخال وتحديد حالة صريحة كـ "حضور" فقط (بدون وسم دوام مجدول أو غياب)
          const hasExplicitPresence = dayLogs.some(l => l.notes?.includes('حضور') && !l.notes?.includes('دوام مجدول') && !l.notes?.includes('غياب')) || 
                                       (override as any).statusLabel === 'حضور' ||
                                       dayPermissions.some(p => p.notes?.includes('حضور') && !p.notes?.includes('دوام مجدول'));

          if (hasExplicitPresence) {
            status = 'regular';
            statusLabel = 'حضور';
            absenceDeduction = 0;
          } else {
            // الحالة هي "غياب" ويتم تطبيق خصم الغياب آلياً على جميع أيام الغياب
            status = 'absent';
            statusLabel = 'غياب';
            absenceDeduction = dailyRate * absenceMultiplier;
          }
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

        // Calculate Daily Target & Commission dynamically per salon policy & employee settings
        const dailyTargetCalc = calculateEmployeeTargetCommission({
          employee: emp,
          settings,
          invoices,
          dateRange: { start: dateStr, end: dateStr },
          isDaily: true,
          daysInMonth: rowMonthDays
        });

        const effectiveDailyTargetCommission = empTargetType === 'daily' ? dailyTargetCalc.commissionAmount : 0;

        let netDaily = isTerminated ? 0 : (
          earnedDaily + 
          overtimeAmount + 
          bonuses + 
          totalDailyCommission +
          effectiveDailyTargetCommission - 
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
          permissionStart: shiftStartPermission?.startTime || permission?.startTime,
          permissionEnd: shiftStartPermission?.endTime || permission?.endTime,
          permissionType: isOfficialMission ? 'official_mission' : (shiftStartPermission?.type || permission?.type),
          permissionMinutes,
          permissionExcusedMinutes,
          permissionDeductedMinutes,
          permissionDeduction,
          administrativeAction,
          administrativeNotes,
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
          dailyTargetAmount: empTargetType === 'daily' ? dailyTargetCalc.targetAmount : 0,
          dailyTargetAchieved: empTargetType === 'daily' ? dailyTargetCalc.totalValidSales : 0,
          dailyTargetCommission: effectiveDailyTargetCommission,
          targetAchievementPercentage: empTargetType === 'daily' ? dailyTargetCalc.achievementPercentage : 0,
          isDailyTargetAchieved: empTargetType === 'daily' ? dailyTargetCalc.isTargetAchieved : false,
          openingCommission: totalReferralCommission,
          commissionPaid,
          isDelayForgiven,
          netDaily
        });
      });
    });

    // =========================================================================
    // التوزيع العادل والذكي لصرف العمولات (Commission Payouts Allocation Engine)
    // =========================================================================
    // إذا تم صرف عمولة للموظف بتاريخ لاحق أو من زر "صرف عمولة" العام، يتم توزيعها
    // آلياً على الأيام التي حقق فيها الموظف تلك العمولات (FIFO) لتظهر كمسددة
    // وتنعكس بدقة في عمود العمولات المصروفة وتختفي أزرار الصرف من الأيام المسددة.
    targetEmployees.forEach(emp => {
      const empRows = rows.filter(r => r.employee.id === emp.id);
      if (empRows.length === 0) return;

      const empPayouts = (emp.financialRecords || []).filter(r => r.type === 'commission_payout');
      if (empPayouts.length === 0) return;

      const activeMonthStr = selectedMonth || (empRows[0]?.dateStr?.substring(0, 7) || '');

      // تصفية سندات الصرف التي تخص هذا الشهر أو الفترة المعروضة
      const relevantPayouts = empPayouts.filter(p => {
        if ((p as any).targetMonth && activeMonthStr) return (p as any).targetMonth === activeMonthStr;
        if ((p as any).targetDate) return empRows.some(r => r.dateStr === (p as any).targetDate);
        if (p.date) {
          const pDateStr = p.date.split('T')[0];
          if (activeMonthStr && pDateStr.startsWith(activeMonthStr)) return true;
          if (empRows.some(r => r.dateStr === pDateStr)) return true;
        }
        return false;
      });

      if (relevantPayouts.length === 0) return;

      // تصفير commissionPaid لجميع أيام هذا الموظف لإعادة التوزيع بدقة
      empRows.forEach(r => {
        r.commissionPaid = 0;
      });

      // 1. تخصيص السندات التي تم ربطها بيوم محدد صراحة (Target Date)
      let generalPool = 0;
      relevantPayouts.forEach(p => {
        const pAmt = Number(p.amount) || 0;
        if (pAmt <= 0) return;

        const tDate = (p as any).targetDate;
        const matchedRow = tDate ? empRows.find(r => r.dateStr === tDate) : null;
        if (matchedRow) {
          matchedRow.commissionPaid += pAmt;
        } else {
          generalPool += pAmt;
        }
      });

      // 2. توزيع المبالغ العامة (General Payouts) بالتسلسل الزمني (FIFO) على الأيام التي بها عمولة مستحقة
      empRows.forEach(r => {
        const totalComm = Number(r.commissionAmount || 0) + Number(r.dailyTargetCommission || 0);
        const needed = Math.max(0, totalComm - r.commissionPaid);
        if (needed > 0 && generalPool > 0) {
          const alloc = Math.min(needed, generalPool);
          r.commissionPaid += alloc;
          generalPool -= alloc;
        }
      });

      // 3. في حال وجود فائض مدفوع (سلفة عمولة مثلاً)، يوضع في يوم الصرف الفعلي
      if (generalPool > 0) {
        relevantPayouts.forEach(p => {
          if (generalPool <= 0) return;
          const pDate = p.date ? p.date.split('T')[0] : '';
          const targetRow = empRows.find(r => r.dateStr === pDate && !(p as any).targetDate);
          if (targetRow) {
            const extra = Math.min(Number(p.amount) || 0, generalPool);
            targetRow.commissionPaid += extra;
            generalPool -= extra;
          }
        });
      }

      // 4. إعادة احتساب الصافي اليومي (netDaily) بناءً على العمولة المصروفة المعتمدة لكل يوم
      const isWeeklyOffPaid = hrConfig.weeklyOffPaidType ? (hrConfig.weeklyOffPaidType === 'paid') : (hrConfig.isWeeklyOffPaid ?? true);
      empRows.forEach(r => {
        const totalComm = Number(r.commissionAmount || 0) + Number(r.dailyTargetCommission || 0);
        const isTerminated = r.status === 'terminated';
        let earnedDaily = r.dailyRate;
        if (r.status === 'unpaid_leave' || r.status === 'terminated' || (r.status === 'weekly_off' && !isWeeklyOffPaid)) {
          earnedDaily = 0;
        }

        if (r.status === 'absent') {
          const baseAbsentNet = r.dailyRate - r.absenceDeduction;
          r.netDaily = Math.min(0, baseAbsentNet - r.advances - r.specialPenalty - r.commissionPaid);
        } else {
          // Extra safeguard: if status is not absent, absenceDeduction MUST be 0
          r.absenceDeduction = 0;
          r.netDaily = isTerminated ? 0 : (
            earnedDaily +
            r.overtimeAmount +
            r.bonuses +
            totalComm -
            r.delayDeduction -
            (r.permissionDeduction || 0) -
            r.specialPenalty -
            r.advances -
            r.commissionPaid
          );
        }
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
      absenceDeductionSum: acc.absenceDeductionSum + (row.status === 'absent' ? (row.absenceDeduction || 0) : 0),
      specialPenaltySum: acc.specialPenaltySum + row.specialPenalty,
      advancesSum: acc.advancesSum + row.advances,
      bonusesSum: acc.bonusesSum + row.bonuses,
      workRevenueSum: acc.workRevenueSum + row.workRevenue,
      commissionSum: acc.commissionSum + row.commissionAmount,
      targetCommissionSum: acc.targetCommissionSum + (row.dailyTargetCommission || 0),
      commissionPaidSum: acc.commissionPaidSum + (row.commissionPaid || 0),
      administrativeWarningsCount: acc.administrativeWarningsCount + (row.administrativeAction === 'warning' ? 1 : 0),
      officialMissionsCount: acc.officialMissionsCount + (row.status === 'mission' ? 1 : 0),
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
      targetCommissionSum: 0,
      commissionPaidSum: 0,
      administrativeWarningsCount: 0,
      officialMissionsCount: 0,
      netSum: 0
    });
  }, [timesheetRows]);

  // ملخص إحصائيات التايم شيت (المربعات الإحصائية العلوية)
  const timesheetStats = useMemo(() => {
    // 1. أيام العمل (Target work days: regular, absent, missions, leaves - excluding weekly off)
    const workDaysCount = timesheetRows.filter(r => r.status !== 'weekly_off' && r.status !== 'terminated').length;

    // 2. حضور (Present: regular or mission)
    const presentDaysCount = timesheetRows.filter(r => r.status === 'regular' || r.status === 'mission').length;

    // 3. غياب (Absent)
    const absentDaysCount = timesheetRows.filter(r => r.status === 'absent').length;

    // 4. تأخيرات بالدقيقة (Total delay minutes)
    const delayMinutes = totals.delayMinutesSum || 0;

    // 5. خصم تأخير (Total delay deduction)
    const delayDeduction = totals.delayDeductionSum || 0;

    // 6. وقت إضافي (Overtime)
    const overtimeAmount = totals.overtimeAmountSum || 0;
    const overtimeMinutes = totals.overtimeMinutesSum || 0;

    // 7. خصومات (Special penalties + Absence deductions + Permission deductions + Advances)
    const totalDeductions = (totals.specialPenaltySum || 0) + 
                            (totals.absenceDeductionSum || 0) + 
                            (totals.permissionDeductionSum || 0) + 
                            (totals.advancesSum || 0);

    // 8. مكافآت (Total bonuses)
    const bonuses = totals.bonusesSum || 0;

    // 9. شغل الموظف (Total work revenue)
    const workRevenue = totals.workRevenueSum || 0;

    // 10. عمولات (Earned commission + Target commission)
    const commissions = (totals.commissionSum || 0) + (totals.targetCommissionSum || 0);

    // 11. صافي الراتب (Net salary sum)
    const netSalary = totals.netSum || 0;

    return {
      workDaysCount,
      presentDaysCount,
      absentDaysCount,
      delayMinutes,
      delayDeduction,
      overtimeAmount,
      overtimeMinutes,
      totalDeductions,
      bonuses,
      workRevenue,
      commissions,
      netSalary
    };
  }, [timesheetRows, totals]);

  const toggleDelayForgive = (rowKey: string, currentVal: boolean) => {
    if (!canForgiveDelays) {
      alert('عذراً، ليس لديك صلاحية مسامحة دقائق التأخير.');
      return;
    }
    setOverrides(prev => ({
      ...prev,
      [rowKey]: {
        ...prev[rowKey],
        isDelayForgiven: !currentVal
      }
    }));
  };

  const handleOpenSalarySlip = (targetEmp?: Employee) => {
    if (!canPrintSlips) {
      alert('عذراً، ليس لديك صلاحية طباعة أو استعراض قسائم الرواتب.');
      return;
    }
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

    const slipTargetCalc = calculateEmployeeTargetCommission({
      employee: emp,
      settings,
      invoices,
      dateRange: {
        start: viewMode === 'single_day' ? selectedSingleDay : startDate,
        end: viewMode === 'single_day' ? selectedSingleDay : endDate
      },
      isDaily: viewMode === 'single_day',
      daysInMonth: getDaysInMonth(selectedMonth)
    });

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
      targetBonus: slipTargetCalc.commissionAmount,
      targetPolicyLabel: slipTargetCalc.policyLabel,
      specialPenalties: empRows.reduce((sum, r) => sum + r.specialPenalty, 0),
      netPayable: viewMode === 'single_day'
        ? empRows.reduce((sum, r) => sum + r.netDaily, 0)
        : (empRows.reduce((sum, r) => sum + r.netDaily, 0) + (slipTargetCalc.commissionAmount || 0))
    };

    setActiveSlipSummary(summary);
    setShowSlipModal(true);
  };

  const handlePrintSlip = () => {
    if (!canPrintSlips) {
      alert('عذراً، ليس لديك صلاحية طباعة قسائم الرواتب.');
      return;
    }
    const printContent = document.getElementById('print-salary-slip');
    if (printContent) {
      printHtml(printContent.innerHTML, `قسيمة_راتب_${activeSlipSummary?.employee.name}`);
    }
  };

  const handlePrintRowVoucher = (row: DayTimesheetRow, type: 'advance' | 'penalty' | 'bonus' | 'commission_payout', amount: number, customNote?: string) => {
    if (!canPrintSlips) {
      alert('عذراً، ليس لديك صلاحية طباعة السندات والإيصالات.');
      return;
    }
    if (type === 'advance' && !canManageAdvances) {
      alert('عذراً، طباعة سند السلفة يتطلب صلاحية إدارة وصرف السلف النقدية (hr_manage_advances).');
      return;
    }
    if (type === 'penalty' && !canManagePenalties) {
      alert('عذراً، طباعة سند الجزاء يتطلب صلاحية إدارة الجزاءات والخصومات (hr_manage_penalties).');
      return;
    }
    if (type === 'bonus' && !canManageBonuses) {
      alert('عذراً، طباعة سند المكافأة يتطلب صلاحية إدارة المكافآت والحوافز (hr_manage_bonuses).');
      return;
    }
    if (type === 'commission_payout' && !canDisburseCommissions) {
      alert('عذراً، طباعة سند صرف العمولة يتطلب صلاحية إدارة وصرف العمولات (hr_manage_commissions).');
      return;
    }
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
    if (!canManageAttendance) {
      alert('عذراً، ليس لديك صلاحية تسجيل أو تعديل الحضور والانصراف.');
      return;
    }
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
      
      const isAbsentAction = attendanceForm.status === 'absent' || 
                             Boolean(attendanceForm.notes?.includes('غياب')) || 
                             (!attendanceForm.checkIn && !attendanceForm.checkOut);

      // Existing logs for this employee on dateStr via processedDate or raw timestamp
      const sameDayLogs = (effectiveFingerprintLogs || []).filter(l => 
        (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && (l.fingerprintCode === targetEmp.fingerprintCode || (l as any).fingerprint_code === targetEmp.fingerprintCode))) &&
        (getFingerprintProcessedDate(l) === dateStr || isSameDay(l.timestamp, dateStr))
      );

      // Also find any legacy early-checkout log on nextDateStr (00:00 - 06:00) so it can be cleaned up
      const nextDayEarlyCheckOut = (effectiveFingerprintLogs || []).filter(l => 
        (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && (l.fingerprintCode === targetEmp.fingerprintCode || (l as any).fingerprint_code === targetEmp.fingerprintCode))) &&
        l.type === 'check_out' &&
        (getFingerprintProcessedDate(l) === dateStr || (isSameDay(l.timestamp, nextDateStr) && (() => {
          const time = extractTime(l.timestamp);
          if (!time) return false;
          const hour = Number(time.split(':')[0]);
          return hour <= 6;
        })()))
      );

      const existingLogs = [...sameDayLogs, ...nextDayEarlyCheckOut];

      const generateId = () => (DB.generateUUID ? DB.generateUUID() : 'FP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7));

      const newLogsToSave: FingerprintLog[] = [];

      if (!isAbsentAction) {
        const inTimestamp = `${dateStr}T${attendanceForm.checkIn || '09:00'}:00`;
        const checkInId = sameDayLogs.find(l => l.type === 'check_in')?.id || generateId();
        const checkOutId = sameDayLogs.find(l => l.type === 'check_out')?.id || nextDayEarlyCheckOut[0]?.id || generateId();

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
          processedDate: dateStr,
          processed_date: dateStr,
          notes: attendanceForm.notes || 'تسجيل يدوي / تعديل من TimeSheet'
        };
        newLogsToSave.push(inLog);

        if (attendanceForm.checkOut) {
          const outTimestamp = `${dateStr}T${attendanceForm.checkOut}:00`;
          const isOvernight = Boolean(
            attendanceForm.isNextDayCheckout || 
            (attendanceForm.checkIn && attendanceForm.checkOut && attendanceForm.checkOut <= attendanceForm.checkIn)
          );
          const actualOutTs = (isOvernight && !outTimestamp.startsWith(nextDateStr))
            ? `${nextDateStr}T${attendanceForm.checkOut}:00`
            : outTimestamp;

          const outLog: FingerprintLog = {
            id: checkOutId,
            salonId: targetEmp.salonId || settings.salonId,
            branchId: targetEmp.branchId || (settings as any).branchId,
            employeeId: targetEmp.id,
            employeeName: targetEmp.name,
            fingerprintCode: targetEmp.fingerprintCode || 'FP-' + targetEmp.id.slice(0, 4),
            timestamp: actualOutTs,
            type: 'check_out',
            status: 'manual',
            processedDate: dateStr,
            processed_date: dateStr,
            notes: isOvernight 
              ? `${attendanceForm.notes ? attendanceForm.notes.trim() + ' - ' : ''}انصراف بعد منتصف الليل (+1 يوم)`
              : (attendanceForm.notes || 'تسجيل يدوي / تعديل من TimeSheet')
          };
          newLogsToSave.push(outLog);
        }
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

      const rowKey = `${targetEmp.id}_${dateStr}`;
      setOverrides(prev => ({
        ...prev,
        [rowKey]: {
          ...prev[rowKey],
          statusLabel: isAbsentAction ? 'غياب' : 'حضور'
        }
      }));

      setShowAttendanceModal(false);
      alert('تم حفظ وتحديث التايم شيت بنجاح في قاعدة البيانات.');
    } catch (err: any) {
      console.error('Error in handleSaveAttendance:', err);
      alert('حدث خطأ أثناء حفظ التايم شيت: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleDeleteAttendance = async (empId: string, dateStr: string) => {
    if (!canDeleteAttendance) {
      alert('عذراً، ليس لديك صلاحية حذف تسجيلات الحضور والانصراف.');
      return;
    }
    if (!confirm('هل أنت متأكد من حذف تسجيل الحضور والانصراف لهذا اليوم وتعيينه كغياب؟')) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const nextDateStr = getNextDateStr(dateStr);
    const sameDayLogs = (effectiveFingerprintLogs || []).filter(l => 
      (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && (l.fingerprintCode === targetEmp.fingerprintCode || (l as any).fingerprint_code === targetEmp.fingerprintCode))) &&
      (getFingerprintProcessedDate(l) === dateStr || isSameDay(l.timestamp, dateStr))
    );
    const nextDayEarlyCheckOut = (effectiveFingerprintLogs || []).filter(l => 
      (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && (l.fingerprintCode === targetEmp.fingerprintCode || (l as any).fingerprint_code === targetEmp.fingerprintCode))) &&
      l.type === 'check_out' &&
      (getFingerprintProcessedDate(l) === dateStr || (isSameDay(l.timestamp, nextDateStr) && (() => {
        const time = extractTime(l.timestamp);
        if (!time) return false;
        const hour = Number(time.split(':')[0]);
        return hour <= 6;
      })()))
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
    alert('تم حذف تسجيل الحضور لهذا اليوم واعتباره كغياب.');
  };


  // Commission Payout State & Handlers
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commEmpId, setCommEmpId] = useState('');
  const [commAmount, setCommAmount] = useState<number | ''>('');
  const [commDate, setCommDate] = useState(() => getEffectiveDateOnly(shiftData, activeBranchId || settings.branchId));
  const [commTargetDate, setCommTargetDate] = useState('');
  const [commTargetMonth, setCommTargetMonth] = useState('');
  const [commTreasuryId, setCommTreasuryId] = useState(settings.treasuries[0]?.id || '');
  const [commNote, setCommNote] = useState('صرف عمولة مستحقة');
  const [isSavingCommissionPayout, setIsSavingCommissionPayout] = useState(false);

  const handleOpenCommissionModal = (targetEmpId?: string, defaultAmount?: number, targetDate?: string) => {
    if (!canDisburseCommissions) {
      alert('عذراً، ليس لديك صلاحية صرف العمولات.');
      return;
    }
    const defaultEmpId = targetEmpId || (viewMode === 'single_employee' && selectedEmpId) || activeEmployees[0]?.id || '';
    setCommEmpId(defaultEmpId);
    const effectiveDate = targetDate || getEffectiveDateOnly(shiftData, activeBranchId || settings.branchId);
    setCommDate(effectiveDate);
    setCommTargetDate(targetDate || '');
    setCommTargetMonth(selectedMonth || effectiveDate.substring(0, 7));
    setCommTreasuryId(settings.treasuries[0]?.id || '');
    setCommNote(targetDate ? `صرف عمولة مستحقة عن يوم ${targetDate}` : 'صرف عمولة مستحقة');
    setCommAmount(defaultAmount !== undefined && defaultAmount > 0 ? defaultAmount : '');
    setShowCommissionModal(true);
  };

  // حساب الأرصدة الحية والدقيقة لجميع الخزائن من المعاملات والفواتير
  const treasuryBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    const knownInvoiceIds = new Set(
      transactions
        .filter(t => t.type === 'in' && ((t as any).invoiceId || (t as any).invoice_id))
        .map(t => (t as any).invoiceId || (t as any).invoice_id)
    );

    // 1. حساب صافي الحركات من المعاملات المسجلة
    transactions.forEach(t => {
      const tId = t.treasury || (t as any).treasuryId;
      if (!tId) return;
      if (balances[tId] === undefined) balances[tId] = 0;
      if (t.type === 'in') balances[tId] += Number(t.amount) || 0;
      else if (t.type === 'out') balances[tId] -= Number(t.amount) || 0;
    });

    // 2. إضافة إيرادات الفواتير المكتملة التي لم تسجل كمعاملات منفصلة
    invoices.forEach(inv => {
      if (inv.status === 'cancelled') return;
      if (!knownInvoiceIds.has(inv.id)) {
        const methods = (inv.paymentMethods && inv.paymentMethods.length > 0)
          ? inv.paymentMethods
          : [{ amount: Number(inv.total) || 0, treasuryId: (inv as any).treasuryId || (inv as any).paymentMethod || 'cash' }];

        methods.forEach((split: any) => {
          if (split.treasuryId === 'remedy_free' || split.treasuryId === 'cashback') return;
          const amt = Number(split.amount) || 0;
          if (amt <= 0) return;
          const tId = split.treasuryId || 'cash';
          if (balances[tId] === undefined) balances[tId] = 0;
          balances[tId] += amt;
        });
      }
    });

    return balances;
  }, [transactions, invoices]);

  const selectedCommEmp = useMemo(() => {
    return employees.find(e => e.id === commEmpId);
  }, [employees, commEmpId]);

  const commStats = useMemo(() => {
    if (!selectedCommEmp) return { earnedCommissions: 0, paidCommissions: 0, unpaidCommissions: 0 };
    const empRows = timesheetRows.filter(r => r.employee.id === selectedCommEmp.id);
    const earned = empRows.reduce((sum, r) => sum + (r.commissionAmount || 0) + (r.dailyTargetCommission || 0), 0);
    const paid = empRows.reduce((sum, r) => sum + (r.commissionPaid || 0), 0);
    const unpaid = Math.max(0, earned - paid);
    return { earnedCommissions: earned, paidCommissions: paid, unpaidCommissions: unpaid };
  }, [selectedCommEmp, timesheetRows]);

  const handleDisburseCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDisburseCommissions) {
      alert('عذراً، ليس لديك صلاحية صرف العمولات.');
      return;
    }
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

    const currentTreasuryBal = treasuryBalances[commTreasuryId] ?? 0;
    if (amountVal > currentTreasuryBal) {
      const tName = settings.treasuries.find(t => t.id === commTreasuryId)?.name || 'الخزينة المحددة';
      const proceed = window.confirm(
        `تنبيه: رصيد خزينة (${tName}) الحالي هو (${Number(currentTreasuryBal || 0).toFixed(2)} ${settings.currency})، وهو أقل من مبلغ العمولة المطلوب صرفه (${Number(amountVal || 0).toFixed(2)} ${settings.currency}).\n\nهل ترغب في المتابعة والصرف؟`
      );
      if (!proceed) return;
    }

    setIsSavingCommissionPayout(true);
    try {
      const treasuryName = settings.treasuries.find(t => t.id === commTreasuryId)?.name || 'الخزينة الرئيسية';
      const voucherNum = `COMM-${Math.floor(100000 + Math.random() * 900000)}`;

      // 1. Create financial transaction
      const effectiveShiftDate = getActiveShiftDate(shiftData, activeBranchId || settings.branchId);
      const nowTimeStr = new Date().toTimeString().split(' ')[0];
      const trxDate = (commDate === effectiveShiftDate)
        ? `${effectiveShiftDate}T${nowTimeStr}`
        : `${commDate}T${nowTimeStr}`;

      const trx: Transaction = {
        id: 'TRX-COMM-' + Math.random().toString(36).substring(2, 9),
        date: trxDate,
        shiftDate: (commDate === effectiveShiftDate) ? effectiveShiftDate : undefined,
        type: 'out',
        amount: amountVal,
        category: 'commissions',
        description: `صرف عمولة للموظف (${targetEmp.name}) - ${commNote}`,
        treasury: commTreasuryId,
        salonId: settings.salonId,
        branchId: activeBranchId || settings.branchId
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
        targetDate: commTargetDate || undefined,
        targetMonth: commTargetMonth || selectedMonth || commDate.substring(0, 7),
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
      alert(`تم صرف وتوثيق العمولة للموظف (${targetEmp.name}) بقيمة ${Number(amountVal || 0).toFixed(2)} ${settings.currency} بنجاح وطباعة إيصال الصرف للتوقيع.`);
    } catch (err: any) {
      console.error('Error in handleDisburseCommission:', err);
      alert('حدث خطأ أثناء صرف العمولة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingCommissionPayout(false);
    }
  };

  // =========================================================================
  // ADVANCES (السلف النقدية) COMPUTATIONS & HANDLERS
  // =========================================================================
  const allAdvancesList = useMemo(() => {
    const list: Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      employeeRole?: string;
      employeeCode?: string;
      amount: number;
      date: string;
      treasuryId?: string;
      treasuryName: string;
      note: string;
      rawRecord: EmployeeFinancialRecord;
      matchingTransaction?: Transaction;
    }> = [];

    employees.forEach(emp => {
      (emp.financialRecords || []).forEach(r => {
        const isSalaryRecord = r.type === 'salary' || 
          r.id?.startsWith('FIN-SAL-') || 
          r.note?.includes('صرف راتب') || 
          r.note?.includes('عن مسير') || 
          r.note?.includes('مسير رواتب') || 
          r.note?.includes('تم استلام صافي الراتب');

        if (r.type === 'advance' && !isSalaryRecord) {
          const treasury = settings.treasuries.find(t => t.id === r.treasuryId);
          const treasuryName = treasury?.name || 'الخزينة الرئيسية';

          const matchingTrx = transactions.find(t => 
            t.id === r.id || 
            t.id === `TRX-${r.id}` || 
            t.id === `TRX-ADV-${r.id.replace('FIN-', '')}` ||
            (t.category === 'hr_advance' && t.description?.includes(r.id)) ||
            (t.category === 'hr_advance' && (t.description?.includes(emp.name) || (emp.fingerprintCode && t.description?.includes(emp.fingerprintCode))) && Math.abs(t.amount - (r.amount || 0)) < 0.01 && (t.date?.startsWith(r.date?.split('T')[0]) || r.date?.startsWith(t.date?.substring(0, 10))))
          );

          list.push({
            id: r.id,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeRole: emp.role,
            employeeCode: emp.fingerprintCode || emp.id,
            amount: Number(r.amount) || 0,
            date: r.date || '',
            treasuryId: r.treasuryId,
            treasuryName,
            note: r.note || '',
            rawRecord: r,
            matchingTransaction: matchingTrx
          });
        }
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employees, transactions, settings.treasuries]);

  // Filtered advances
  const filteredAdvances = useMemo(() => {
    return allAdvancesList.filter(item => {
      if (advanceEmpFilter !== 'all' && item.employeeId !== advanceEmpFilter) return false;
      if (advanceTreasuryFilter !== 'all' && item.treasuryId !== advanceTreasuryFilter) return false;

      const itemDateOnly = item.date.split('T')[0].split(' ')[0];
      if (advanceDateFrom && itemDateOnly < advanceDateFrom) return false;
      if (advanceDateTo && itemDateOnly > advanceDateTo) return false;

      if (advanceSearchQuery.trim()) {
        const q = advanceSearchQuery.toLowerCase();
        const matchEmp = item.employeeName.toLowerCase().includes(q);
        const matchNote = item.note.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchRole = item.employeeRole?.toLowerCase().includes(q);
        if (!matchEmp && !matchNote && !matchId && !matchRole) return false;
      }
      return true;
    });
  }, [allAdvancesList, advanceEmpFilter, advanceTreasuryFilter, advanceDateFrom, advanceDateTo, advanceSearchQuery]);

  // Advances summary statistics
  const advancesStats = useMemo(() => {
    const totalAmount = filteredAdvances.reduce((sum, item) => sum + item.amount, 0);
    const count = filteredAdvances.length;
    const avgAmount = count > 0 ? totalAmount / count : 0;
    const uniqueEmployeesCount = new Set(filteredAdvances.map(item => item.employeeId)).size;
    return {
      totalAmount,
      count,
      avgAmount,
      uniqueEmployeesCount
    };
  }, [filteredAdvances]);

  // Edit Advance Modal Open
  const handleOpenEditAdvance = (item: (typeof allAdvancesList)[0]) => {
    if (!canManageAdvances) {
      alert('عذراً، تعديل السلف يتطلب صلاحية إدارة وصرف السلف النقدية (hr_manage_advances).');
      return;
    }
    setEditingAdvance(item);
    setEditAdvanceForm({
      amount: item.amount,
      date: item.date.split('T')[0],
      treasuryId: item.treasuryId || settings.treasuries[0]?.id || '',
      note: item.note
    });
  };

  // Save Edited Advance
  const handleSaveEditedAdvance = async () => {
    if (!editingAdvance) return;
    if (!canManageAdvances) {
      alert('عذراً، تعديل السلف يتطلب صلاحية إدارة وصرف السلف النقدية.');
      return;
    }
    const newAmount = Number(editAdvanceForm.amount);
    if (!newAmount || newAmount <= 0) {
      alert('يرجى إدخال مبلغ سلفة صحيح أكبر من صفر.');
      return;
    }
    if (!editAdvanceForm.date) {
      alert('يرجى تحديد تاريخ السلفة.');
      return;
    }
    if (!editAdvanceForm.treasuryId) {
      alert('يرجى اختيار الخزينة المنصرف منها.');
      return;
    }

    setIsSavingAdvance(true);
    try {
      const targetEmp = employees.find(e => e.id === editingAdvance.employeeId);
      if (!targetEmp) {
        alert('لم يتم العثور على الموظف.');
        return;
      }

      const updatedRecords = (targetEmp.financialRecords || []).map(r => {
        if (r.id === editingAdvance.id) {
          return {
            ...r,
            amount: newAmount,
            date: editAdvanceForm.date,
            treasuryId: editAdvanceForm.treasuryId,
            note: editAdvanceForm.note
          };
        }
        return r;
      });

      const updatedEmp: Employee = {
        ...targetEmp,
        financialRecords: updatedRecords
      };

      if (DB.saveEmployee) {
        await DB.saveEmployee(updatedEmp, settings.salonId);
      }
      setEmployees(employees.map(e => e.id === updatedEmp.id ? updatedEmp : e));

      // Update matching transaction if found
      if (editingAdvance.matchingTransaction && setTransactions && transactions) {
        const updatedTrx: Transaction = {
          ...editingAdvance.matchingTransaction,
          amount: newAmount,
          date: editAdvanceForm.date + (editingAdvance.matchingTransaction.date?.includes('T') ? 'T' + editingAdvance.matchingTransaction.date.split('T')[1] : ''),
          treasury: editAdvanceForm.treasuryId,
          description: `سلفة نقدية للموظف (${targetEmp.name}) [${editingAdvance.id}] - ${editAdvanceForm.note}`
        };

        if (DB.saveTransaction) {
          await DB.saveTransaction(updatedTrx, settings.salonId);
        }
        setTransactions(transactions.map(t => t.id === updatedTrx.id ? updatedTrx : t));
      }

      setEditingAdvance(null);
      alert('تم تعديل بيانات السلفة وتحديث السجلات المالية بنجاح.');
    } catch (err: any) {
      console.error('Error in handleSaveEditedAdvance:', err);
      alert('حدث خطأ أثناء تعديل السلفة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingAdvance(false);
    }
  };

  // Delete Advance
  const handleDeleteAdvance = async (item: (typeof allAdvancesList)[0]) => {
    if (!canManageAdvances) {
      alert('عذراً، حذف السلف يتطلب صلاحية إدارة وصرف السلف النقدية (hr_manage_advances).');
      return;
    }

    const confirmMsg = `هل أنت متأكد من حذف سلفة الموظف (${item.employeeName}) بمبلغ ${item.amount.toFixed(2)} ${settings.currency}؟\n\nسيتم حذف السجل المالي نهائياً وإلغاء الحركة المالية واسترداد المبلغ للخزينة.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSavingAdvance(true);
    try {
      const targetEmp = employees.find(e => e.id === item.employeeId);
      if (!targetEmp) {
        alert('لم يتم العثور على الموظف.');
        return;
      }

      const updatedRecords = (targetEmp.financialRecords || []).filter(r => r.id !== item.id);
      const updatedEmp: Employee = {
        ...targetEmp,
        financialRecords: updatedRecords
      };

      if (DB.saveEmployee) {
        await DB.saveEmployee(updatedEmp, settings.salonId);
      }
      setEmployees(employees.map(e => e.id === updatedEmp.id ? updatedEmp : e));

      // Delete matching transaction if found
      if (item.matchingTransaction) {
        if (DB.deleteTransaction) {
          await DB.deleteTransaction(item.matchingTransaction.id);
        }
        if (setTransactions && transactions) {
          setTransactions(transactions.filter(t => t.id !== item.matchingTransaction!.id));
        }
      }

      alert('تم حذف السلفة وإلغاء الحركة المالية بنجاح.');
    } catch (err: any) {
      console.error('Error in handleDeleteAdvance:', err);
      alert('حدث خطأ أثناء حذف السلفة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingAdvance(false);
    }
  };

  // Print Thermal Voucher for Advance
  const handlePrintAdvanceVoucher = (item: (typeof allAdvancesList)[0]) => {
    printThermalFinancialVoucher(settings, {
      voucherType: 'advance',
      voucherNumber: item.id.startsWith('FIN-') ? item.id.replace('FIN-', 'ADV-') : `ADV-${item.id}`,
      date: `${item.date} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
      employeeName: item.employeeName,
      employeeCode: item.employeeCode,
      employeeRole: item.employeeRole,
      amount: item.amount,
      treasuryName: item.treasuryName,
      note: item.note || 'سلفة نقدية على حساب الراتب',
      issuedBy: currentUser?.name || 'مدير النظام'
    });
  };

  // Create New Advance Handler
  const handleCreateNewAdvance = async () => {
    if (!canManageAdvances) {
      alert('عذراً، تسجيل سلفة جديدة يتطلب صلاحية إدارة وصرف السلف النقدية.');
      return;
    }
    if (!newAdvanceForm.empId) {
      alert('يرجى اختيار الموظف المستفيد من السلفة.');
      return;
    }
    const amt = Number(newAdvanceForm.amount);
    if (!amt || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح للسلفة أكبر من صفر.');
      return;
    }
    if (!newAdvanceForm.treasuryId) {
      alert('يرجى اختيار الخزينة المنصرف منها.');
      return;
    }

    const currentBal = treasuryBalances[newAdvanceForm.treasuryId] ?? 0;
    if (amt > currentBal) {
      const tName = settings.treasuries.find(t => t.id === newAdvanceForm.treasuryId)?.name || 'الخزينة';
      const proceed = window.confirm(
        `تنبيه: رصيد الخزينة (${tName}) الحالي هو (${Number(currentBal || 0).toFixed(2)} ${settings.currency})، وهو أقل من مبلغ السلفة المطلوب صرفه (${amt.toFixed(2)} ${settings.currency}).\n\nهل تريد المتابعة والصرف بالسالب؟`
      );
      if (!proceed) return;
    }

    setIsSavingAdvance(true);
    try {
      const targetEmp = employees.find(e => e.id === newAdvanceForm.empId);
      if (!targetEmp) {
        alert('لم يتم العثور على الموظف.');
        return;
      }

      const advId = 'FIN-ADV-' + Math.random().toString(36).substring(2, 9);
      const trxId = 'TRX-' + advId;
      const treasuryName = settings.treasuries.find(t => t.id === newAdvanceForm.treasuryId)?.name || 'الخزينة الرئيسية';
      const branchCodeToUse = settings.branches?.find(b => b.id === activeBranchId)?.code || (targetEmp as any).branchCode || 'BR-01';

      // 1. Transaction
      const trx: Transaction = {
        id: trxId,
        date: newAdvanceForm.date + 'T' + new Date().toTimeString().split(' ')[0],
        shiftDate: shiftData?.isOpen ? shiftData.date : undefined,
        type: 'out',
        amount: amt,
        category: 'hr_advance',
        description: `سلفة نقدية للموظف (${targetEmp.name}) [${advId}] - ${newAdvanceForm.note || 'سلفة نقدية على حساب الراتب'}`,
        treasury: newAdvanceForm.treasuryId,
        salonId: (targetEmp as any).salonId || settings.salonId,
        branchId: targetEmp.branchId || activeBranchId,
        branchCode: branchCodeToUse
      } as any;

      if (DB.saveTransaction) {
        await DB.saveTransaction(trx, settings.salonId);
      }
      if (setTransactions && transactions) {
        setTransactions([...transactions, trx]);
      }

      // 2. Financial record in employee
      const finRecord: EmployeeFinancialRecord = {
        id: advId,
        date: newAdvanceForm.date,
        type: 'advance',
        amount: amt,
        treasuryId: newAdvanceForm.treasuryId,
        note: newAdvanceForm.note || 'سلفة نقدية على حساب الراتب'
      };

      const updatedEmp: Employee = {
        ...targetEmp,
        financialRecords: [...(targetEmp.financialRecords || []), finRecord]
      };

      if (DB.saveEmployee) {
        await DB.saveEmployee(updatedEmp, settings.salonId);
      }
      setEmployees(employees.map(e => e.id === updatedEmp.id ? updatedEmp : e));

      // 3. Print 80mm thermal voucher
      printThermalFinancialVoucher(settings, {
        voucherType: 'advance',
        voucherNumber: `ADV-${Math.floor(100000 + Math.random() * 900000)}`,
        date: `${newAdvanceForm.date} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
        employeeName: targetEmp.name,
        employeeCode: targetEmp.fingerprintCode || targetEmp.id,
        employeeRole: targetEmp.role,
        amount: amt,
        treasuryName,
        note: newAdvanceForm.note || 'سلفة نقدية على حساب الراتب',
        issuedBy: currentUser?.name || 'مدير النظام'
      });

      setShowNewAdvanceModal(false);
      setNewAdvanceForm({
        empId: activeEmployees[0]?.id || '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        treasuryId: settings.treasuries[0]?.id || '',
        note: ''
      });
      alert(`تم تسجيل وصرف السلفة للموظف (${targetEmp.name}) بمبلغ ${amt.toFixed(2)} ${settings.currency} بنجاح وطباعة إيصال الصرف.`);
    } catch (err: any) {
      console.error('Error in handleCreateNewAdvance:', err);
      alert('حدث خطأ أثناء تسجيل السلفة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingAdvance(false);
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
    if (!canManageLeaves) {
      alert('عذراً، ليس لديك صلاحية تسجيل الإجازات.');
      return;
    }
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
    if (!canManageLeaves) {
      alert('عذراً، ليس لديك صلاحية تسجيل الإجازات.');
      return;
    }
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
        ? ((Number(targetEmp?.baseSalary || 0)) / 30 * leaveDaysCount).toFixed(2)
        : '0.00';

      alert(`تم تسجيل وتطبيق الإجازة بنجاح!\n• الموظف: ${targetEmp.name}\n• المدة: ${leaveDaysCount} يوم (من ${leaveStartDate} إلى ${leaveEndDate})\n• النوع: ${leaveType === 'paid' ? 'مدفوعة الأجر (يتم احتساب الراتب)' : 'بدون أجر (خصم اليومية دون جزاء غياب)'}\n• تم توزيعها تلقائياً على التايم شيت.`);
    } catch (err: any) {
      console.error('Error saving leave:', err);
      alert('حدث خطأ أثناء تسجيل الإجازة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingLeave(false);
    }
  };

  const handleDeleteLeave = async (empId: string, leaveId: string) => {
    if (!canManageLeaves) {
      alert('عذراً، ليس لديك صلاحية إلغاء أو حذف الإجازات.');
      return;
    }
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
      alert('تم حذف الإجازة بنجاح وإعادة ضبط التايم شيت.');
    } catch (err: any) {
      console.error('Error deleting leave:', err);
      alert('حدث خطأ أثناء حذف الإجازة: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  // Permission (إذن خروج مؤقت ومأموريات) State & Handlers
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showPermissionsListModal, setShowPermissionsListModal] = useState(false);
  const [showPayrollAuditModal, setShowPayrollAuditModal] = useState(false);
  const [permEmpId, setPermEmpId] = useState('');
  const [permDate, setPermDate] = useState(() => getEffectiveDateOnly(shiftData, activeBranchId || settings.branchId));
  const [permType, setPermType] = useState<'shift_start' | 'mid_shift' | 'official_mission'>('shift_start');
  const [permStartTime, setPermStartTime] = useState('09:00');
  const [permEndTime, setPermEndTime] = useState('11:00');
  const [permIsExcused, setPermIsExcused] = useState(true);
  const [permReason, setPermReason] = useState('إذن بداية الدوام لظرف خاص');
  const [isSavingPermission, setIsSavingPermission] = useState(false);

  const handleOpenPermissionModal = (targetEmpId?: string, targetDate?: string) => {
    if (!canManagePermissions) {
      alert('عذراً، ليس لديك صلاحية تسجيل أذونات الاستئذان.');
      return;
    }
    const defaultEmpId = targetEmpId || (viewMode === 'single_employee' && selectedEmpId) || activeEmployees[0]?.id || '';
    setPermEmpId(defaultEmpId);
    setPermDate(targetDate || (viewMode === 'single_day' && selectedSingleDay) || getEffectiveDateOnly(shiftData, activeBranchId || settings.branchId));
    setPermType('shift_start');
    setPermStartTime('09:00');
    setPermEndTime('11:00');
    setPermIsExcused(true);
    setPermReason('إذن بداية الدوام لظرف خاص');
    setShowPermissionModal(true);
  };

  const permDurationMinutes = useMemo(() => {
    if (!permStartTime || !permEndTime) return 60;
    const [startH, startM] = permStartTime.split(':').map(Number);
    const [endH, endM] = permEndTime.split(':').map(Number);
    let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (totalMinutes <= 0) totalMinutes += 24 * 60; // Cross midnight
    return Math.max(5, totalMinutes);
  }, [permStartTime, permEndTime]);

  const selectedPermEmp = useMemo(() => {
    return employees.find(e => e.id === permEmpId);
  }, [employees, permEmpId]);

  // Dynamic monthly balance remaining for selected employee in modal
  const permEmpRemainingBalance = useMemo(() => {
    if (!permEmpId || !permDate) return (hrConfig.maxMonthlyPermissionHours ?? 2) * 60;
    const emp = employees.find(e => e.id === permEmpId);
    if (!emp) return (hrConfig.maxMonthlyPermissionHours ?? 2) * 60;
    const targetMonthPrefix = permDate.substring(0, 7);
    const maxFree = (hrConfig.maxMonthlyPermissionHours ?? 2) * 60;
    let used = 0;
    (emp.permissionRecords || []).forEach(p => {
      if (p.date?.startsWith(targetMonthPrefix) && p.type !== 'official_mission' && !p.isExcused) {
        used += Number(p.durationMinutes) || 0;
      }
    });
    return Math.max(0, maxFree - used);
  }, [employees, permEmpId, permDate, hrConfig]);

  const handleSavePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePermissions) {
      alert('عذراً، ليس لديك صلاحية تسجيل أذونات الاستئذان.');
      return;
    }
    if (!permEmpId) {
      alert('الرجاء اختيار الموظف');
      return;
    }
    if (!permDate) {
      alert('الرجاء تحديد تاريخ الإذن');
      return;
    }

    const targetEmp = employees.find(e => e.id === permEmpId);
    if (!targetEmp) {
      alert('الموظف غير موجود');
      return;
    }

    try {
      setIsSavingPermission(true);

      const newPermRecord: EmployeePermissionRecord = {
        id: 'PRM-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        date: permDate,
        startTime: permStartTime,
        endTime: permEndTime,
        durationMinutes: permDurationMinutes,
        type: permType,
        isExcused: permType === 'official_mission' ? true : permIsExcused,
        status: 'approved',
        reason: permReason.trim() || (permType === 'official_mission' ? 'مأمورية عمل رسمية خارجية' : 'إذن خروج مؤقت'),
        approvedBy: currentUser?.name || 'مدير النظام',
        createdAt: new Date().toISOString()
      };

      const updatedEmp: Employee = {
        ...targetEmp,
        permissionRecords: [...(targetEmp.permissionRecords || []), newPermRecord]
      };

      if (DB.saveEmployee) {
        await DB.saveEmployee(updatedEmp);
      }

      setEmployees(employees.map(e => e.id === targetEmp.id ? updatedEmp : e));
      setShowPermissionModal(false);

      const durationHours = (Number(permDurationMinutes || 0) / 60).toFixed(1);
      const typeLabel = permType === 'official_mission' ? 'مأمورية عمل رسمية خارجية' : (permType === 'shift_start' ? 'إذن بداية الدوام' : 'إذن وسط الدوام');
      alert(`تم اعتماد وتسجيل الإذن بنجاح!\n• الموظف: ${targetEmp.name}\n• النوع: ${typeLabel}\n• التاريخ: ${permDate}\n• الفترة: من ${permStartTime} إلى ${permEndTime} (${permDurationMinutes} دقيقة / ${durationHours} ساعة)\n• المعاملة: ${permType === 'official_mission' ? 'مأمورية مدفوعة بدون استهلاك رصيد' : (permIsExcused ? 'مستثنى ومقبول (معفى من الخصم)' : 'يخضع لحساب الرصيد والخصومات')}\n• تم التحديث الفوري في التايم شيت.`);
    } catch (err: any) {
      console.error('Error saving permission:', err);
      alert('حدث خطأ أثناء تسجيل الإذن: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingPermission(false);
    }
  };

  const handleDeletePermission = async (empId: string, permId: string) => {
    if (!canManagePermissions) {
      alert('عذراً، ليس لديك صلاحية إلغاء أو حذف أذونات الاستئذان.');
      return;
    }
    if (!confirm('هل أنت متأكد من حذف هذا الإذن؟ سيتم إلغاء أثره من التايم شيت فوراً.')) return;

    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    try {
      const updatedEmp: Employee = {
        ...targetEmp,
        permissionRecords: (targetEmp.permissionRecords || []).filter(p => p.id !== permId)
      };

      if (DB.saveEmployee) {
        await DB.saveEmployee(updatedEmp);
      }

      setEmployees(employees.map(e => e.id === targetEmp.id ? updatedEmp : e));
      alert('تم حذف الإذن بنجاح وتحديث التايم شيت.');
    } catch (err: any) {
      console.error('Error deleting permission:', err);
      alert('حدث خطأ أثناء حذف الإذن: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  // Batch Salary Disbursement State
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [disbursementTreasuryId, setDisbursementTreasuryId] = useState(settings.treasuries[0]?.id || '');
  const [disbursementDate, setDisbursementDate] = useState(() => getEffectiveDateOnly(shiftData, activeBranchId || settings.branchId));
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

      // Monthly Target Calculation for payroll period
      const monthlyTargetCalc = calculateEmployeeTargetCommission({
        employee: emp,
        settings,
        invoices,
        dateRange: { start: startDate, end: endDate },
        isDaily: false,
        daysInMonth: dateRangeList.length || 30
      });
      const targetBonus = monthlyTargetCalc.commissionAmount;

      const netPayable = Math.max(0, earnedBaseSalary + totalCommissions + totalBonuses + totalOvertimeAmount + targetBonus - totalDeductions);

      const paidCheck = getEmployeeSalaryDisbursementRecord(emp, startDate, endDate, selectedMonth);

      return {
        emp,
        presentDaysCount,
        earnedBaseSalary,
        totalWorkRevenue,
        totalCommissions,
        totalCommissionsPaid,
        totalBonuses,
        targetBonus,
        targetPolicyLabel: monthlyTargetCalc.policyLabel,
        totalAdvances,
        totalPenalties,
        totalOvertimeAmount,
        totalDeductions,
        netPayable,
        isAlreadyPaid: paidCheck.isPaid,
        paidRecord: paidCheck.record
      };
    });
  }, [activeEmployees, timesheetRows, hrConfig, startDate, endDate, selectedMonth, employees]);

  const handleOpenDisbursementModal = () => {
    if (!canDisburseSalaries) {
      alert('عذراً، ليس لديك صلاحية صرف مسير الرواتب.');
      return;
    }
    // تحديد الموظفين الذين لم يتم صرف رواتبهم بعد لهذا الشهر ولهم مبالغ مستحقة
    const unpaidEmpIds = payrollDisbursementData.filter(d => !d.isAlreadyPaid && d.netPayable > 0).map(d => d.emp.id);
    setSelectedDisbursementEmpIds(unpaidEmpIds);
    setDisbursementDate(getEffectiveDateOnly(shiftData, activeBranchId || settings.branchId));
    setDisbursementTreasuryId(settings.treasuries[0]?.id || '');
    setShowDisbursementModal(true);
  };

  const handleReprintDisbursementVoucher = (item: (typeof payrollDisbursementData)[0]) => {
    if (!canPrintSlips) {
      alert('عذراً، ليس لديك صلاحية طباعة سندات الرواتب.');
      return;
    }
    const treasuryName = settings.treasuries.find(t => t.id === item.paidRecord?.treasuryId || t.id === disbursementTreasuryId)?.name || 'الخزنة';
    printThermalFinancialVoucher(settings, {
      voucherType: 'salary',
      voucherNumber: item.paidRecord?.id || `SAL-${Math.floor(100000 + Math.random() * 900000)}`,
      date: item.paidRecord?.date ? `${item.paidRecord.date} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}` : `${disbursementDate} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
      employeeName: item.emp.name,
      employeeCode: item.emp.fingerprintCode || item.emp.id,
      employeeRole: item.emp.role,
      amount: item.paidRecord?.amount ?? item.netPayable,
      treasuryName: treasuryName,
      note: item.paidRecord?.note || `إعادة طباعة سند صرف مسير رواتب شهر (${selectedMonth}) فترة (${startDate} إلى ${endDate})`,
      issuedBy: currentUser?.name || 'مدير النظام',
      payrollPeriod: `${startDate} إلى ${endDate}`
    });
  };

  const handleDisburseSalaries = async (targetEmpIds: string[]) => {
    if (!canDisburseSalaries) {
      alert('عذراً، ليس لديك صلاحية صرف مسير الرواتب.');
      return;
    }
    if (!targetEmpIds || targetEmpIds.length === 0) {
      alert('الرجاء تحديد موظف واحد على الأقل لصرف راتبه');
      return;
    }
    if (!disbursementTreasuryId) {
      alert('الرجاء اختيار الخزينة المنصرف منها الرواتب');
      return;
    }

    const treasuryName = settings.treasuries.find(t => t.id === disbursementTreasuryId)?.name || 'الخزنة';

    // 1. فحص ومنع الصرف المتكرر لنفس الشهر
    const alreadyPaidSelected = payrollDisbursementData.filter(d => targetEmpIds.includes(d.emp.id) && d.isAlreadyPaid);
    if (alreadyPaidSelected.length > 0) {
      const details = alreadyPaidSelected.map(d => `• ${d.emp.name}: تم الصرف مسبقاً بتاريخ (${d.paidRecord?.date}) بمبلغ ${d.paidRecord?.amount} ${settings.currency}`).join('\n');
      alert(`تنبيه نظام الرواتب (منع الازدواجية والتكرار):\nتم صرف راتب هذا الشهر (${selectedMonth}) مسبقاً للموظفين التاليين:\n${details}\n\nسيتم استبعادهم فوراً لمنع التكرار والصرف لمن لم يُصرف لهم فقط.`);
    }

    // ترشيح الموظفين المستحقين الذين لم يُصرف لهم راتب هذا الشهر ولهم صافي مستحق
    const targets = payrollDisbursementData.filter(d => targetEmpIds.includes(d.emp.id) && !d.isAlreadyPaid && d.netPayable > 0);

    if (targets.length === 0) {
      alert('لا توجد مبالغ مستحقة للصرف للموظفين المحددين (إما تم صرف رواتبهم مسبقاً لهذا الشهر أو صافي الراتب 0).');
      return;
    }

    // 2. إنشاء الحركات المالية لخروج الرواتب من الخزينة
    const newTrxs: Transaction[] = [];
    const effectiveShiftDate = getActiveShiftDate(shiftData, activeBranchId || settings.branchId);
    const nowTimeStr = new Date().toTimeString().split(' ')[0];
    const trxDate = (disbursementDate === effectiveShiftDate)
      ? `${effectiveShiftDate}T${nowTimeStr}`
      : `${disbursementDate}T${nowTimeStr}`;

    targets.forEach(item => {
      const trx: Transaction = {
        id: 'TRX-SAL-' + Math.random().toString(36).substring(2, 9),
        date: trxDate,
        shiftDate: (disbursementDate === effectiveShiftDate) ? effectiveShiftDate : undefined,
        type: 'out',
        amount: item.netPayable,
        category: 'salaries',
        description: `صرف راتب الموظف (${item.emp.name}) عن شهر (${selectedMonth}) الفترة (${startDate} إلى ${endDate}) - ${disbursementNote}`,
        treasury: disbursementTreasuryId,
        branchId: activeBranchId || settings.branchId,
        salonId: settings.salonId
      };
      newTrxs.push(trx);

      // طباعة سند صرف الراتب الحراري 80mm
      printThermalFinancialVoucher(settings, {
        voucherType: 'salary', // نوع السند: راتب رسمي وليس سلفة
        voucherNumber: `SAL-${Math.floor(100000 + Math.random() * 900000)}`,
        date: `${disbursementDate} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
        employeeName: item.emp.name,
        employeeCode: item.emp.fingerprintCode || item.emp.id,
        employeeRole: item.emp.role,
        amount: item.netPayable,
        treasuryName: treasuryName,
        note: `مسير رواتب معتمد عن شهر (${selectedMonth}) فترة (${startDate} إلى ${endDate}) | الراتب المستحق: ${Number(item.earnedBaseSalary || 0).toFixed(2)} + العمولات: ${Number(item.totalCommissions || 0).toFixed(2)} - المستقطعات والسلف: ${Number(item.totalDeductions || 0).toFixed(2)}`,
        issuedBy: currentUser?.name || 'مدير النظام',
        payrollPeriod: `${startDate} إلى ${endDate}`
      });
    });

    // 3. توثيق حركة صرف الراتب في الملف المالي للموظف بنوع 'salary' (وليس 'advance')
    const updatedEmployees = employees.map(e => {
      const target = targets.find(t => t.emp.id === e.id);
      if (!target) return e;

      const finRecord: EmployeeFinancialRecord = {
        id: 'FIN-SAL-' + Math.random().toString(36).substring(2, 9),
        date: disbursementDate,
        type: 'salary', // نوع الراتب الرسمي لمنع تسجيله كسلفة
        amount: target.netPayable,
        treasuryId: disbursementTreasuryId,
        note: `مسير رواتب: تم استلام صافي الراتب (${Number(target.netPayable || 0).toFixed(2)} ${settings.currency}) عن شهر (${selectedMonth}) فترة ${startDate} إلى ${endDate}`,
        payrollPeriod: { startDate, endDate, month: selectedMonth },
        periodKey: `${selectedMonth}_${target.emp.id}`
      };

      return {
        ...e,
        financialRecords: [...(e.financialRecords || []), finRecord]
      };
    });

    if (DB.saveTransaction) {
      for (const trx of newTrxs) {
        await DB.saveTransaction(trx);
      }
    }
    if (setTransactions && transactions) {
      setTransactions([...transactions, ...newTrxs]);
    }
    setEmployees(updatedEmployees);
    if (DB.saveEmployee) {
      for (const emp of updatedEmployees) {
        if (targets.some(t => t.emp.id === emp.id)) {
          await DB.saveEmployee(emp);
        }
      }
    }

    setShowDisbursementModal(false);
    alert(`تم صرف وتوثيق رواتب (${targets.length}) موظف بنجاح بقيمة إجمالية ${targets.reduce((s, t) => s + (Number(t.netPayable || 0)), 0).toFixed(2)} ${settings.currency} وطباعة إيصالات الاستلام للتوقيع.`);
  };

  if (currentUser && !canViewTimesheet) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-red-200 shadow-sm" dir="rtl">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">غير مصرح لك بالوصول لشاشة سجل الدوام والرواتب</h2>
        <p className="text-sm text-slate-500 max-w-md">ليس لديك صلاحية استعراض سجل الدوام والرواتب (hr_view_timesheet). يرجى مراجعة مدير النظام لمنحك الصلاحيات المطلوبة.</p>
      </div>
    );
  }

  // Table Horizontal & Drag-to-Scroll Refs and Helpers
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);
  const [isFullscreenTable, setIsFullscreenTable] = useState(false);
  const [isCompactDensity, setIsCompactDensity] = useState(false);

  const scrollTable = (direction: 'left' | 'right' | 'start' | 'end') => {
    if (!tableContainerRef.current) return;
    const el = tableContainerRef.current;
    if (direction === 'start') {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (direction === 'end') {
      el.scrollTo({ left: -el.scrollWidth, behavior: 'smooth' });
    } else if (direction === 'left') {
      el.scrollBy({ left: -380, behavior: 'smooth' });
    } else if (direction === 'right') {
      el.scrollBy({ left: 380, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, select, a, textarea')) return;
    if (!tableContainerRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeftPos(tableContainerRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeftPos - walk;
  };

  // =========================================================================
  // قسم ملخص وتفاصيل العمولات (Commissions Breakdown & Detailed Summary)
  // =========================================================================
  interface CommissionDetailRow {
    rowId: string;
    invoiceId: string;
    rawDate: string;
    dateStr: string;
    timeStr: string;
    clientName: string;
    clientPhone?: string;
    itemName: string;
    itemType: 'service' | 'product';
    commissionType: 'execution' | 'referral';
    commissionTypeLabel: string;
    quantity: number;
    itemPrice: number;
    itemTotal: number;
    calculationRule: string;
    earnedCommission: number;
    invoiceStatus: string;
    invoiceTotal: number;
    technicianName: string;
  }

  const detailedCommissionsData = useMemo(() => {
    const targetEmp = employees.find(e => e.id === commSelectedEmpId);
    if (!targetEmp) {
      return {
        rows: [] as CommissionDetailRow[],
        uniqueInvoicesCount: 0,
        totalRevenue: 0,
        totalEarnedCommission: 0,
        executionCommissionSum: 0,
        referralCommissionSum: 0,
        executionCount: 0,
        referralCount: 0,
        paidCommissions: 0,
        unpaidCommissions: 0,
        employee: null
      };
    }

    const rows: CommissionDetailRow[] = [];
    const uniqueInvoiceIds = new Set<string>();
    let totalRevenue = 0;
    let executionCommissionSum = 0;
    let referralCommissionSum = 0;
    let executionCount = 0;
    let referralCount = 0;

    // Filter invoices: within date range, non-cancelled, and strictly paid only
    const validInvoices = invoices.filter(inv => {
      const isCancelled = inv.status === 'cancelled' || (inv as any).is_cancelled || (inv as any).isCancelled || inv.status === 'refunded';
      if (isCancelled) return false;

      const isPaid = inv.status === 'completed' || (inv.status !== 'unpaid' && (Number((inv as any).remaining) || 0) <= 0);
      if (!isPaid) return false;

      const rawDate = inv.date || (inv as any).created_at || (inv as any).createdAt || '';
      const datePart = rawDate.split('T')[0].split(' ')[0];
      if (!datePart) return false;
      return datePart >= commStartDate && datePart <= commEndDate;
    });

    validInvoices.forEach(inv => {
      const rawDate = inv.date || (inv as any).created_at || (inv as any).createdAt || '';
      const { dateStr, timeStr } = formatInvoiceDateTime(rawDate);
      const clientName = inv.clientName || 'عميل نقدي';
      const clientPhone = inv.clientPhone || '';
      const invTotal = Number(inv.total) || 0;

      let invoiceHasMatches = false;

      (inv.items || []).forEach((item, itemIdx) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const itemTotal = price * qty;
        const itemName = item.serviceName || (item as any).name || 'خدمة / منتج';
        const itemType: 'service' | 'product' = item.type || ((products || []).some(p => p.id === item.itemId || p.id === item.id) ? 'product' : 'service');

        // 1. Check Execution Commission (عمولة تنفيذ الخدمة أو بيع المنتج)
        const isExecution = (item.employeeId && item.employeeId === targetEmp.id) || 
                            (!item.employeeId && item.technicianName && item.technicianName === targetEmp.name);

        if (isExecution) {
          let execComm = Number(item.employeeCommission ?? item.commissionAmount ?? (item as any).commission ?? 0);
          let calcRule = 'محددة بالسطر';

          if (execComm <= 0) {
            const srv = (services || []).find(s => s.id === item.itemId || s.id === item.id || s.name === item.serviceName);
            if (srv) {
              const srvAmt = Number(srv.employeeCommissionAmount ?? srv.commissionAmount ?? 0);
              const srvPct = Number(srv.employeeCommissionPercentage ?? srv.commissionRate ?? 0);
              const rawBase = Number(srv.commissionableAmount ?? item.commissionableAmount ?? 0);
              const commBase = rawBase > 0 ? (rawBase * qty) : itemTotal;
              if (srvAmt > 0) {
                execComm = srvAmt * qty;
                calcRule = `مبلغ خدمة (${srvAmt} ${settings.currency}/قطعة)`;
              } else if (srvPct > 0) {
                execComm = (srvPct / 100) * commBase;
                calcRule = rawBase > 0
                  ? `نسبة خدمة (${srvPct}%) على أساس (${commBase} ${settings.currency})`
                  : `نسبة خدمة (${srvPct}%)`;
              }
            } else {
              const prod = (products || []).find(p => p.id === item.itemId || p.id === item.id || p.name === item.serviceName);
              if (prod && Number(prod.commission) > 0) {
                execComm = Number(prod.commission) * qty;
                calcRule = `عمولة منتج (${prod.commission} ${settings.currency})`;
              }
            }
          }

          if (execComm <= 0 && targetEmp.commissionRate && Number(targetEmp.commissionRate) > 0) {
            const empRate = Number(targetEmp.commissionRate);
            const rawBase = Number(item.commissionableAmount ?? 0);
            const commBase = rawBase > 0 ? (rawBase * qty) : itemTotal;
            execComm = (empRate / 100) * commBase;
            calcRule = rawBase > 0
              ? `نسبة الموظف الثابتة (${empRate}%) على أساس (${commBase} ${settings.currency})`
              : `نسبة الموظف الثابتة (${empRate}%)`;
          }

          if (execComm > 0 || isExecution) {
            invoiceHasMatches = true;
            totalRevenue += itemTotal;
            executionCommissionSum += execComm;
            executionCount++;

            rows.push({
              rowId: `${inv.id}_exec_${item.id || itemIdx}`,
              invoiceId: inv.id,
              rawDate,
              dateStr,
              timeStr,
              clientName,
              clientPhone,
              itemName,
              itemType,
              commissionType: 'execution',
              commissionTypeLabel: 'تنفيذ خدمة / بيع',
              quantity: qty,
              itemPrice: price,
              itemTotal,
              calculationRule: calcRule,
              earnedCommission: execComm,
              invoiceStatus: 'مسددة',
              invoiceTotal: invTotal,
              technicianName: item.technicianName || targetEmp.name
            });
          }
        }

        // 2. Check Referral Commission (عمولة إحالة / فتح شغل)
        const isReferral = (item.referralEmployeeId && item.referralEmployeeId === targetEmp.id) || 
                           (!item.referralEmployeeId && item.referralEmployeeName && item.referralEmployeeName === targetEmp.name);

        if (isReferral) {
          let refComm = (item.referralCommissionAmount !== undefined && Number(item.referralCommissionAmount) > 0)
            ? (Number(item.referralCommissionAmount) * qty)
            : 0;
          let calcRule = 'محددة بالسطر';

          if (refComm <= 0) {
            const srv = (services || []).find(s => s.id === item.itemId || s.id === item.id || s.name === item.serviceName);
            if (srv && srv.referralCommissionAmount && Number(srv.referralCommissionAmount) > 0) {
              const srvRefAmt = Number(srv.referralCommissionAmount);
              if (srv.referralCommissionType === 'percentage') {
                refComm = (srvRefAmt / 100) * itemTotal;
                calcRule = `نسبة إحالة (${srvRefAmt}%)`;
              } else {
                refComm = srvRefAmt * qty;
                calcRule = `مبلغ إحالة ثابت (${srvRefAmt} ${settings.currency})`;
              }
            }
          }

          if (refComm > 0 || isReferral) {
            invoiceHasMatches = true;
            referralCommissionSum += refComm;
            referralCount++;

            rows.push({
              rowId: `${inv.id}_ref_${item.id || itemIdx}`,
              invoiceId: inv.id,
              rawDate,
              dateStr,
              timeStr,
              clientName,
              clientPhone,
              itemName,
              itemType,
              commissionType: 'referral',
              commissionTypeLabel: 'إحالة وفتح شغل',
              quantity: qty,
              itemPrice: price,
              itemTotal,
              calculationRule: calcRule,
              earnedCommission: refComm,
              invoiceStatus: 'مسددة',
              invoiceTotal: invTotal,
              technicianName: item.technicianName || 'فني آخر'
            });
          }
        }
      });

      if (invoiceHasMatches) {
        uniqueInvoiceIds.add(inv.id);
      }
    });

    // Sort rows descending by date/time
    rows.sort((a, b) => b.rawDate.localeCompare(a.rawDate));

    const totalEarnedCommission = executionCommissionSum + referralCommissionSum;

    const paidCommissions = (targetEmp.financialRecords || [])
      .filter(r => r.type === 'commission_payout')
      .filter(r => {
        const rDate = (r.targetDate || r.date || '').split('T')[0].split(' ')[0];
        if (rDate && rDate >= commStartDate && rDate <= commEndDate) return true;
        if (r.targetMonth) {
          const startMonth = commStartDate.substring(0, 7);
          const endMonth = commEndDate.substring(0, 7);
          if (r.targetMonth >= startMonth && r.targetMonth <= endMonth) return true;
        }
        return false;
      })
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const unpaidCommissions = Math.max(0, totalEarnedCommission - paidCommissions);

    return {
      rows,
      uniqueInvoicesCount: uniqueInvoiceIds.size,
      totalRevenue,
      totalEarnedCommission,
      executionCommissionSum,
      referralCommissionSum,
      executionCount,
      referralCount,
      paidCommissions,
      unpaidCommissions,
      employee: targetEmp
    };
  }, [commSelectedEmpId, commStartDate, commEndDate, invoices, services, products, employees, settings.currency]);

  // Filter commission rows based on commission type and search query
  const filteredCommissionRows = useMemo(() => {
    return detailedCommissionsData.rows.filter(row => {
      if (commTypeFilter !== 'all' && row.commissionType !== commTypeFilter) return false;
      if (commSearchQuery.trim()) {
        const q = commSearchQuery.trim().toLowerCase();
        const matchInv = row.invoiceId.toLowerCase().includes(q);
        const matchClient = row.clientName.toLowerCase().includes(q);
        const matchItem = row.itemName.toLowerCase().includes(q);
        if (!matchInv && !matchClient && !matchItem) return false;
      }
      return true;
    });
  }, [detailedCommissionsData.rows, commTypeFilter, commSearchQuery]);

  // Quick Date Range Preset Handler
  const setQuickCommPeriod = (period: 'this_month' | 'last_month' | 'last_30_days' | 'today') => {
    const today = new Date();
    if (period === 'this_month') {
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      setCommStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
      setCommEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (period === 'last_month') {
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const y = prevMonthDate.getFullYear();
      const m = prevMonthDate.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      setCommStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
      setCommEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (period === 'last_30_days') {
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 30);
      const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setCommStartDate(toDateStr(past30));
      setCommEndDate(toDateStr(today));
    } else if (period === 'today') {
      const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const todayStr = toDateStr(today);
      setCommStartDate(todayStr);
      setCommEndDate(todayStr);
    }
  };

  // Export to CSV with UTF-8 BOM
  const handleExportCommissionsCSV = () => {
    if (filteredCommissionRows.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }
    const empName = detailedCommissionsData.employee?.name || 'موظف';
    const headers = ['مسلسل', 'رقم الفاتورة', 'التاريخ', 'الوقت', 'اسم العميل', 'الخدمة / البند', 'النوع', 'القيمة', 'قاعدة الاحتساب', 'العمولة المستحقة', 'حالة الفاتورة'];
    const csvRows = [
      headers.join(','),
      ...filteredCommissionRows.map((r, i) => [
        i + 1,
        `"${r.invoiceId}"`,
        `"${r.dateStr}"`,
        `"${r.timeStr}"`,
        `"${r.clientName.replace(/"/g, '""')}"`,
        `"${r.itemName.replace(/"/g, '""')}"`,
        `"${r.commissionTypeLabel}"`,
        r.itemTotal.toFixed(2),
        `"${r.calculationRule.replace(/"/g, '""')}"`,
        r.earnedCommission.toFixed(2),
        `"${r.invoiceStatus}"`
      ].join(','))
    ];

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `عمولات_${empName}_${commStartDate}_إلى_${commEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Commissions Report
  const handlePrintCommissionsReport = () => {
    if (filteredCommissionRows.length === 0) {
      alert('لا توجد بيانات لطباعتها');
      return;
    }
    const emp = detailedCommissionsData.employee;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const rowsHtml = filteredCommissionRows.map((r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; font-weight: bold; font-family: monospace;">#${r.invoiceId}</td>
        <td style="padding: 6px 8px; text-align: center;">${r.dateStr}</td>
        <td style="padding: 6px 8px; text-align: center;">${r.timeStr}</td>
        <td style="padding: 6px 8px;">${r.clientName}</td>
        <td style="padding: 6px 8px;">${r.itemName}</td>
        <td style="padding: 6px 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; ${r.commissionType === 'execution' ? 'background: #e0f2fe; color: #0369a1;' : 'background: #fef3c7; color: #b45309;'}">
            ${r.commissionTypeLabel}
          </span>
        </td>
        <td style="padding: 6px 8px; font-family: monospace; text-align: left;">${r.itemTotal.toFixed(2)}</td>
        <td style="padding: 6px 8px; font-size: 11px; color: #475569;">${r.calculationRule}</td>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; color: #047857; text-align: left;">${r.earnedCommission.toFixed(2)} ${settings.currency}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>كشف عمولات الموظف - ${emp?.name || ''}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            * { font-family: 'Cairo', sans-serif !important; box-sizing: border-box; }
            body { margin: 15mm; color: #1e293b; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #0f172a; color: white; padding: 8px; font-size: 11px; text-align: right; }
            .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            .kpi-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; background: #f8fafc; }
            .kpi-card .val { font-size: 16px; font-weight: bold; margin-top: 4px; font-family: monospace; }
            @media print {
              body { margin: 10mm; }
              @page { size: A4 landscape; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 900;">${settings.salonName || 'Smart Cut'}</h2>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">كشف عمولات الموظف المفصل (فواتير مسددة فقط)</p>
            </div>
            <div style="text-align: left;">
              <p style="margin: 0; font-weight: bold; font-size: 14px;">الموظف: ${emp?.name || ''} (كود: ${emp?.fingerprintCode || emp?.id})</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">الفترة: من ${commStartDate} إلى ${commEndDate}</p>
            </div>
          </div>

          <div class="kpi-cards">
            <div class="kpi-card" style="border-right: 4px solid #f59e0b;">
              <div style="color: #64748b; font-size: 11px;">إجمالي العمولات المستحقة</div>
              <div class="val" style="color: #b45309;">${detailedCommissionsData.totalEarnedCommission.toFixed(2)} ${settings.currency}</div>
            </div>
            <div class="kpi-card" style="border-right: 4px solid #0284c7;">
              <div style="color: #64748b; font-size: 11px;">عمولات التنفيذ (${detailedCommissionsData.executionCount})</div>
              <div class="val" style="color: #0369a1;">${detailedCommissionsData.executionCommissionSum.toFixed(2)} ${settings.currency}</div>
            </div>
            <div class="kpi-card" style="border-right: 4px solid #8b5cf6;">
              <div style="color: #64748b; font-size: 11px;">عمولات الإحالة (${detailedCommissionsData.referralCount})</div>
              <div class="val" style="color: #6d28d9;">${detailedCommissionsData.referralCommissionSum.toFixed(2)} ${settings.currency}</div>
            </div>
            <div class="kpi-card" style="border-right: 4px solid #10b981;">
              <div style="color: #64748b; font-size: 11px;">إجمالي مبيعات الموظف (${detailedCommissionsData.uniqueInvoicesCount} فاتورة)</div>
              <div class="val" style="color: #047857;">${detailedCommissionsData.totalRevenue.toFixed(2)} ${settings.currency}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">م</th>
                <th>رقم الفاتورة</th>
                <th style="text-align: center;">التاريخ</th>
                <th style="text-align: center;">الوقت</th>
                <th>اسم العميل</th>
                <th>الخدمة / البند</th>
                <th style="text-align: center;">نوع العمولة</th>
                <th style="text-align: left;">القيمة</th>
                <th>قاعدة الاحتساب</th>
                <th style="text-align: left;">العمولة المستحقة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #e2e8f0; font-weight: bold;">
                <td colspan="7" style="padding: 8px; text-align: center;">الإجمالي العام (${filteredCommissionRows.length} بند)</td>
                <td style="padding: 8px; font-family: monospace; text-align: left;">${detailedCommissionsData.totalRevenue.toFixed(2)}</td>
                <td></td>
                <td style="padding: 8px; font-family: monospace; color: #047857; font-size: 13px; text-align: left;">${detailedCommissionsData.totalEarnedCommission.toFixed(2)} ${settings.currency}</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 25px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
            <div>طُبع بواسطة: ${currentUser?.name || 'مدير النظام'} في ${new Date().toLocaleString('ar-SA')}</div>
            <div>Smart Cut Salon Management System</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className={`w-full font-sans ${isEmbedded ? 'flex flex-col pb-10' : 'w-full h-full min-h-0 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 p-4 sm:p-6 flex flex-col'}`} dir="rtl">
      
      {/* Top HR Section Tabs (سجل الدوام والتايم شيت vs ملخص وتفاصيل العمولات) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl mb-5 w-fit border border-slate-300">
        <button
          type="button"
          onClick={() => setHrMainTab('timesheet')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            hrMainTab === 'timesheet'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock size={16} />
          <span>سجل الدوام والتايم شيت والمسير</span>
        </button>

        <button
          type="button"
          onClick={() => setHrMainTab('commissions')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            hrMainTab === 'commissions'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Coins size={16} />
          <span>ملخص وتفاصيل العمولات المستحقة</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            hrMainTab === 'commissions' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            تفصيلي
          </span>
        </button>

        <button
          type="button"
          onClick={() => setHrMainTab('advances')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            hrMainTab === 'advances'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Banknote size={16} />
          <span>جدول وسجل السلف النقدية</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            hrMainTab === 'advances' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {allAdvancesList.length}
          </span>
        </button>
      </div>

      {hrMainTab === 'timesheet' && (
        <>
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
          {/* Excel Biometric Import */}
          {canManageAttendance && (
            <button
              type="button"
              onClick={() => setShowBiometricModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="سحب حركات البصمة والتايم شيت من ملف إكسل"
            >
              <FileSpreadsheet size={14} />
              <span>سحب من إكسل</span>
            </button>
          )}

          {/* Manual Refresh Button */}
          {canFingerprintSync && (
            <button
              type="button"
              onClick={() => refreshFingerprintLogs(true)}
              disabled={isRefreshingLogs}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              title="تحديث فوري للبصمات والبيانات"
            >
              <RefreshCw size={14} className={isRefreshingLogs ? 'animate-spin text-indigo-600' : 'text-slate-600'} />
              <span>{isRefreshingLogs ? 'جارٍ المزامنة...' : 'تحديث الآن'}</span>
            </button>
          )}
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

          {/* 1. تسجيل / تعديل حضور */}
          <button
            disabled={!canManageAttendance}
            onClick={() => {
              if (!canManageAttendance) {
                alert('عذراً، لا تملك صلاحية تسجيل وتعديل الحضور والانصراف (hr_manage_attendance)');
                return;
              }
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
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all ${
              canManageAttendance
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
            }`}
            title={canManageAttendance ? 'تسجيل أو تعديل حضور' : 'لا تملك صلاحية تسجيل وتعديل الحضور (hr_manage_attendance)'}
          >
            <Plus size={15} />
            <span>تسجيل / تعديل حضور</span>
          </button>

          {/* 2. تسجيل زيادة راتب */}
          <button
            disabled={!canSalaryIncrements}
            onClick={() => {
              if (!canSalaryIncrements) {
                alert('عذراً، لا تملك صلاحية إقرار وتطبيق زيادات الرواتب (hr_manage_salary_increments)');
                return;
              }
              setTargetEmpId(selectedEmpId || activeEmployees[0]?.id || '');
              setSelectedEmpIdsForBulk(activeEmployees.map(e => e.id));
              setIncrementValue(10);
              setIncrementType('percentage');
              setEffectiveDate(now.toISOString().split('T')[0]);
              setIncrementReason('ترقية / علاوة سنوية');
              setApprovedBy(currentUser?.name || 'مدير النظام');
              setShowSalaryIncrementModal(true);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all ${
              canSalaryIncrements
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20 cursor-pointer'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
            }`}
            title={canSalaryIncrements ? 'تسجيل زيادة راتب' : 'لا تملك صلاحية زيادات الرواتب (hr_manage_salary_increments)'}
          >
            <TrendingUp size={15} />
            <span>تسجيل زيادة راتب</span>
          </button>

          <button
            onClick={() => setShowSalaryHistoryModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <History size={15} className="text-indigo-600" />
            <span>سجل الزيادات</span>
          </button>

          {/* 3. تسجيل إجازة */}
          <button
            disabled={!canManageLeaves}
            onClick={() => {
              if (!canManageLeaves) {
                alert('عذراً، لا تملك صلاحية تسجيل واعتماد الإجازات (hr_manage_leaves)');
                return;
              }
              handleOpenLeaveModal();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all ${
              canManageLeaves
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20 cursor-pointer'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
            }`}
            title={canManageLeaves ? 'تسجيل إجازة' : 'لا تملك صلاحية إدارة الإجازات (hr_manage_leaves)'}
          >
            <Palmtree size={15} />
            <span>تسجيل إجازة</span>
          </button>

          <button
            onClick={() => setShowLeavesListModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar size={15} className="text-sky-600" />
            <span>سجل الإجازات</span>
          </button>

          {/* 4. تسجيل استئذان */}
          <button
            disabled={!canManagePermissions}
            onClick={() => {
              if (!canManagePermissions) {
                alert('عذراً، لا تملك صلاحية تسجيل واعتماد أذونات الاستئذان (hr_manage_permissions)');
                return;
              }
              handleOpenPermissionModal();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all ${
              canManagePermissions
                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 cursor-pointer'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
            }`}
            title={canManagePermissions ? 'تسجيل استئذان' : 'لا تملك صلاحية إدارة الاستئذانات (hr_manage_permissions)'}
          >
            <Timer size={15} />
            <span>تسجيل استئذان</span>
          </button>

          <button
            onClick={() => setShowPermissionsListModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <DoorOpen size={15} className="text-teal-600" />
            <span>سجل الاستئذانات</span>
          </button>

          {/* 5. تدقيق الاستقطاعات والمسير */}
          {canDisburseSalaries && (
            <button
              onClick={() => setShowPayrollAuditModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              title="مراجعة وتدقيق الاستقطاعات وأرصدة الأذونات قبل اعتماد المسير"
            >
              <ShieldCheck size={15} />
              <span>تدقيق الاستقطاعات والمسير</span>
            </button>
          )}

          {/* 6. صرف عمولة - زر بارز ومميز */}
          <button
            disabled={!canDisburseCommissions}
            onClick={() => {
              if (!canDisburseCommissions) {
                alert('عذراً، لا تملك صلاحية اعتماد وصرف العمولات (hr_manage_commissions)');
                return;
              }
              handleOpenCommissionModal();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all transform active:scale-95 ${
              canDisburseCommissions
                ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white shadow-amber-500/30 ring-2 ring-amber-400/40 cursor-pointer'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
            }`}
            title={canDisburseCommissions ? 'صرف عمولة نقدية للموظف فوراً' : 'لا تملك صلاحية صرف العمولات (hr_manage_commissions)'}
          >
            <Coins size={16} className="text-amber-100" />
            <span className="text-[13px] font-black">صرف عمولة</span>
          </button>

          {/* 7. صرف مسير الرواتب */}
          <button
            disabled={!canDisburseSalaries}
            onClick={() => {
              if (!canDisburseSalaries) {
                alert('عذراً، لا تملك صلاحية فتح واعتماد وصرف مسير الرواتب (hr_disburse_payroll)');
                return;
              }
              handleOpenDisbursementModal();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all ${
              canDisburseSalaries
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
            }`}
            title={canDisburseSalaries ? 'صرف مسير الرواتب' : 'لا تملك صلاحية صرف مسير الرواتب (hr_disburse_payroll)'}
          >
            <DollarSign size={16} />
            <span>صرف مسير الرواتب</span>
          </button>

          {/* 8. قسيمة الراتب */}
          <button
            disabled={!canPrintSlips}
            onClick={() => {
              if (!canPrintSlips) {
                alert('عذراً، لا تملك صلاحية طباعة قسائم الرواتب (hr_print_slips)');
                return;
              }
              handleOpenSalarySlip();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors ${
              canPrintSlips
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
            }`}
            title={canPrintSlips ? 'قسيمة الراتب' : 'لا تملك صلاحية طباعة قسيمة الراتب (hr_print_slips)'}
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

      {/* مربعات إحصائية علوية لمجاميع التايم شيت مرتبة بنفس ترتيب أعمدة الجدول */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2.5 mb-3.5">
        {/* 1. أيام العمل */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between transition-all hover:border-slate-300">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold">أيام العمل</span>
            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Calendar size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-slate-900">{timesheetStats.workDaysCount}</span>
            <span className="text-[10px] font-bold text-slate-500">يوم</span>
          </div>
        </div>

        {/* 2. حضور */}
        <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-emerald-300">
          <div className="flex items-center justify-between text-emerald-800 mb-1.5">
            <span className="text-[11px] font-bold">حضور</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-700">
              <CheckCircle size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-emerald-700">{timesheetStats.presentDaysCount}</span>
            <span className="text-[10px] font-bold text-emerald-600">يوم</span>
          </div>
        </div>

        {/* 3. غياب */}
        <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-rose-300">
          <div className="flex items-center justify-between text-rose-800 mb-1.5">
            <span className="text-[11px] font-bold">غياب</span>
            <div className="w-6 h-6 rounded-lg bg-rose-100/80 flex items-center justify-center text-rose-700">
              <AlertTriangle size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-rose-700">{timesheetStats.absentDaysCount}</span>
            <span className="text-[10px] font-bold text-rose-600">يوم</span>
          </div>
        </div>

        {/* 4. تأخيرات بالدقيقة */}
        <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-amber-300">
          <div className="flex items-center justify-between text-amber-800 mb-1.5">
            <span className="text-[11px] font-bold">تأخيرات بالدقيقة</span>
            <div className="w-6 h-6 rounded-lg bg-amber-100/80 flex items-center justify-center text-amber-700">
              <Clock size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-amber-800">{timesheetStats.delayMinutes}</span>
            <span className="text-[10px] font-bold text-amber-600">د</span>
          </div>
        </div>

        {/* 5. خصم تأخير */}
        <div className="bg-rose-50/40 p-3 rounded-2xl border border-rose-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-rose-300">
          <div className="flex items-center justify-between text-rose-800 mb-1.5">
            <span className="text-[11px] font-bold">خصم تأخير</span>
            <div className="w-6 h-6 rounded-lg bg-rose-100/80 flex items-center justify-center text-rose-700">
              <TrendingDown size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-rose-700">{timesheetStats.delayDeduction.toFixed(2)}</span>
            <span className="text-[10px] font-bold text-rose-600">{settings.currency}</span>
          </div>
        </div>

        {/* 6. وقت إضافي */}
        <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-blue-300">
          <div className="flex items-center justify-between text-blue-800 mb-1.5">
            <span className="text-[11px] font-bold">وقت إضافي</span>
            <div className="w-6 h-6 rounded-lg bg-blue-100/80 flex items-center justify-center text-blue-700">
              <Timer size={13} />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black font-mono text-blue-700">{timesheetStats.overtimeAmount.toFixed(2)}</span>
              <span className="text-[10px] font-bold text-blue-600">{settings.currency}</span>
            </div>
            {timesheetStats.overtimeMinutes > 0 && (
              <span className="text-[10px] font-mono text-blue-500 font-bold">({timesheetStats.overtimeMinutes} د)</span>
            )}
          </div>
        </div>

        {/* 7. خصومات */}
        <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-orange-300">
          <div className="flex items-center justify-between text-orange-800 mb-1.5">
            <span className="text-[11px] font-bold">خصومات</span>
            <div className="w-6 h-6 rounded-lg bg-orange-100/80 flex items-center justify-center text-orange-700">
              <ShieldAlert size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-orange-700">{timesheetStats.totalDeductions.toFixed(2)}</span>
            <span className="text-[10px] font-bold text-orange-600">{settings.currency}</span>
          </div>
        </div>

        {/* 8. مكافآت */}
        <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-purple-300">
          <div className="flex items-center justify-between text-purple-800 mb-1.5">
            <span className="text-[11px] font-bold">مكافآت</span>
            <div className="w-6 h-6 rounded-lg bg-purple-100/80 flex items-center justify-center text-purple-700">
              <Award size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-purple-700">{timesheetStats.bonuses.toFixed(2)}</span>
            <span className="text-[10px] font-bold text-purple-600">{settings.currency}</span>
          </div>
        </div>

        {/* 9. شغل الموظف */}
        <div className="bg-teal-50/50 p-3 rounded-2xl border border-teal-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-teal-300">
          <div className="flex items-center justify-between text-teal-800 mb-1.5">
            <span className="text-[11px] font-bold">شغل الموظف</span>
            <div className="w-6 h-6 rounded-lg bg-teal-100/80 flex items-center justify-center text-teal-700">
              <Briefcase size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-teal-800">{timesheetStats.workRevenue.toFixed(2)}</span>
            <span className="text-[10px] font-bold text-teal-600">{settings.currency}</span>
          </div>
        </div>

        {/* 10. عمولات */}
        <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-200/80 shadow-2xs flex flex-col justify-between transition-all hover:border-indigo-300">
          <div className="flex items-center justify-between text-indigo-800 mb-1.5">
            <span className="text-[11px] font-bold">عمولات</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-100/80 flex items-center justify-center text-indigo-700">
              <Coins size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-indigo-700">{timesheetStats.commissions.toFixed(2)}</span>
            <span className="text-[10px] font-bold text-indigo-600">{settings.currency}</span>
          </div>
        </div>

        {/* 11. صافي الراتب */}
        <div className="bg-emerald-100/80 p-3 rounded-2xl border-2 border-emerald-400/90 shadow-xs flex flex-col justify-between transition-all hover:border-emerald-500">
          <div className="flex items-center justify-between text-emerald-950 mb-1.5">
            <span className="text-[11px] font-black">صافي الراتب</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
              <Wallet size={13} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black font-mono text-emerald-950">{timesheetStats.netSalary.toFixed(2)}</span>
            <span className="text-[10px] font-black text-emerald-800">{settings.currency}</span>
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Controller Toolbar for the Table */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-2xs mb-3 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <SlidersHorizontal size={14} className="text-indigo-600" />
            <span>شريط تحكم وتصفح الجدول (أفقياً):</span>
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            (يمكنك التمرير بالأزرار، أو السحب بالماوس يميناً ويساراً، أو الضغط على Shift مع عجلة الماوس)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Density Mode: Compact to fit entire month in one screen */}
          <button
            type="button"
            onClick={() => setIsCompactDensity(!isCompactDensity)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border ${
              isCompactDensity 
                ? 'bg-amber-100 border-amber-300 text-amber-950 font-black shadow-xs' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
            }`}
            title="تبديل حجم الصفوف ليظهر الشهر بالكامل في الشاشة دون تمرير كثير"
          >
            <span>{isCompactDensity ? 'عرض عادي واسع' : 'إظهار الشهر بالكامل (عرض مكثف)'}</span>
          </button>

          {/* Fullscreen Table Mode */}
          <button
            type="button"
            onClick={() => setIsFullscreenTable(!isFullscreenTable)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border ${
              isFullscreenTable
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md font-black'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
            }`}
            title="توسيع أو تصغير نافذة الجدول لملء الشاشة بالكامل"
          >
            {isFullscreenTable ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreenTable ? 'استعادة الحجم' : 'ملء الشاشة ⤢'}</span>
          </button>

          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <button
            type="button"
            onClick={() => scrollTable('start')}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            title="انتقال إلى أول الجدول (بيانات الموظف والتاريخ)"
          >
            <ChevronsRight size={15} />
            <span>البداية</span>
          </button>

          <button
            type="button"
            onClick={() => scrollTable('right')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            title="تمرير لليمين (نحو الحضور والإنصراف)"
          >
            <ChevronRight size={16} />
            <span>يمين</span>
          </button>

          <button
            type="button"
            onClick={() => scrollTable('left')}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            title="تمرير لليسار (نحو العمولات والخصومات والصافي)"
          >
            <span>يسار</span>
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => scrollTable('end')}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
            title="انتقال إلى نهاية الجدول (الصافي ومسامحة التأخير)"
          >
            <span>الصافي والعمليات</span>
            <ChevronsLeft size={15} />
          </button>
        </div>
      </div>

      {/* Main Timesheet Table (Full Vertical & Horizontal Scroll) */}
      <div 
        ref={tableContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        className={`w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-auto custom-scrollbar mb-8 relative select-none touch-pan-x transition-all duration-200 ${
          isFullscreenTable
            ? 'fixed inset-3 z-50 shadow-2xl p-4 flex flex-col bg-white overflow-auto border-2 border-indigo-500'
            : isCompactDensity
              ? 'min-h-[750px] max-h-[88vh]'
              : 'min-h-[850px] max-h-[92vh]'
        }`}
        style={{ cursor: isMouseDown ? 'grabbing' : 'default' }}
      >
        {isFullscreenTable && (
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <h3 className="font-black text-sm text-slate-800">سجل الدوام والتايم شيت (وضع ملء الشاشة لعرض كامل أيام الشهر)</h3>
            <button
              onClick={() => setIsFullscreenTable(false)}
              className="px-3 py-1 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
            >
              <X size={14} />
              <span>إغلاق ملء الشاشة</span>
            </button>
          </div>
        )}
        <table className={`w-full text-center border-collapse whitespace-nowrap min-w-[1600px] transition-all ${isCompactDensity ? 'text-[11px] [&_td]:!py-1 [&_th]:!py-1.5' : 'text-xs [&_td]:py-2 [&_th]:py-2.5'}`}>
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
                <th className="p-2.5 border-l border-slate-800 bg-indigo-950/40 text-indigo-200 font-black">عمولة التارجت</th>
                <th className="p-2.5 border-l border-slate-800 bg-amber-950/40 text-amber-200 font-black">عمولات مصروفة</th>
                <th className="p-2.5 border-l border-slate-800 bg-slate-950 font-black">الصافي</th>
                <th className="p-2.5">مسامحة تأخير</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-200">
              {timesheetRows.length === 0 ? (
                <tr>
                  <td colSpan={26} className="p-8 text-center text-slate-400 font-bold bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock size={24} className="text-slate-300" />
                      <span>لا توجد سجلات دوام مطابقة للفترة المحددة أو لم يتم اختيار موظف نشط</span>
                    </div>
                  </td>
                </tr>
              ) : (
                timesheetRows.map((row, idx) => {
                const key = `${row.employee.id}_${row.dateStr}`;
                const isOff = row.status === 'weekly_off';
                const isAbsent = row.status === 'absent';
                const isTerminated = row.status === 'terminated';
                const isLeave = row.status === 'paid_leave' || row.status === 'unpaid_leave';
                const isMission = row.status === 'mission';

                return (
                  <tr 
                    key={idx}
                    className={`hover:bg-slate-50 transition-colors ${
                      isTerminated ? 'bg-slate-200/70 text-slate-500' :
                      isMission ? 'bg-purple-50/50 text-purple-950' :
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
                      {Number(row.dailyRate || 0) > 0 ? Number(row.dailyRate || 0).toFixed(2) : '-'}
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
                          <span className="text-rose-500 font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                            <span>غياب</span>
                          </span>
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
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold" title="انصراف في اليوم التالي (بعد منتصف الليل)">
                                <Moon size={10} className="text-indigo-600" />
                                <span>+1</span>
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">--:--:--</span>
                        )}
                        {canManageAttendance && (
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
                        )}
                      </div>
                    </td>


                    {/* 7. Status */}
                    <td className="p-2 border-l border-slate-200">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canManageAttendance) return;
                            const cleanIn = row.checkIn ? row.checkIn.substring(0, 5) : '09:00';
                            const cleanOut = row.checkOut ? row.checkOut.replace(' (+1)', '').substring(0, 5) : '18:00';
                            const isOvernight = Boolean(row.checkOut?.includes('(+1)')) || (Boolean(row.checkOut) && cleanOut <= cleanIn);
                            setAttendanceForm({
                              empId: row.employee.id,
                              date: row.dateStr,
                              checkIn: cleanIn,
                              checkOut: cleanOut,
                              isNextDayCheckout: isOvernight,
                              status: row.status === 'absent' ? 'regular' : row.status,
                              notes: ''
                            });
                            setShowAttendanceModal(true);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                            canManageAttendance ? 'cursor-pointer' : 'cursor-default'
                          } ${
                            isTerminated ? 'bg-slate-400 text-white' :
                            isMission ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            isOff ? 'bg-emerald-100 text-emerald-800' :
                            isAbsent ? 'bg-rose-100 text-rose-800 hover:bg-rose-200' :
                            isLeave ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 shadow-2xs'
                          }`}
                          title={canManageAttendance ? `الحالة: ${row.statusLabel} - اضغط للتعديل` : `الحالة: ${row.statusLabel}`}
                        >
                          {row.statusLabel}
                        </button>
                        {row.administrativeAction === 'warning' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black" title={row.administrativeNotes}>
                            <AlertTriangle size={10} className="text-amber-700" />
                            <span>إنذار إداري</span>
                          </span>
                        )}
                      </div>
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
                      {Number(row.permissionDeduction || 0) > 0 ? Number(row.permissionDeduction || 0).toFixed(2) : '-'}
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
                      {Number(row.delayDeduction || 0) > 0 ? Number(row.delayDeduction || 0).toFixed(2) : '-'}
                    </td>

                    {/* 13. Overtime Minutes */}
                    <td className={`p-2 border-l border-slate-200 font-mono font-bold ${
                      row.overtimeMinutes > 0 ? 'text-blue-700' : 'text-slate-400'
                    }`}>
                      {row.overtimeMinutes > 0 ? row.overtimeMinutes : 0}
                    </td>

                    {/* 14. Overtime Amount */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-blue-600">
                      {Number(row.overtimeAmount || 0) > 0 ? Number(row.overtimeAmount || 0).toFixed(2) : '-'}
                    </td>

                    {/* 15. Special Penalty */}
                    <td className="p-2 border-l border-slate-200 font-mono text-rose-600 font-bold">
                      {Number(row.specialPenalty || 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePrintRowVoucher(row, 'penalty', row.specialPenalty)}
                          className="hover:underline flex items-center justify-center gap-1 mx-auto text-rose-600 cursor-pointer"
                          title="طباعة إيصال خصم 80mm"
                        >
                          <Printer size={11} className="opacity-60" />
                          <span>{Number(row.specialPenalty || 0).toFixed(2)}</span>
                        </button>
                      ) : '-'}
                    </td>

                    {/* 16. Absence Deduction */}
                    <td className="p-2 border-l border-slate-200 font-mono text-rose-600 font-bold">
                      {Number(row.absenceDeduction || 0) > 0 ? Number(row.absenceDeduction || 0).toFixed(2) : '-'}
                    </td>

                    {/* 17. Advances */}
                    <td className="p-2 border-l border-slate-200 font-mono text-amber-700 font-bold">
                      {Number(row.advances || 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePrintRowVoucher(row, 'advance', row.advances)}
                          className="hover:underline flex items-center justify-center gap-1 mx-auto text-amber-700 cursor-pointer"
                          title="طباعة إيصال سلفة 80mm"
                        >
                          <Printer size={11} className="opacity-60" />
                          <span>{Number(row.advances || 0).toFixed(2)}</span>
                        </button>
                      ) : '-'}
                    </td>

                    {/* 18. Bonuses */}
                    <td className="p-2 border-l border-slate-200 font-mono text-emerald-700 font-bold">
                      {Number(row.bonuses || 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePrintRowVoucher(row, 'bonus', row.bonuses)}
                          className="hover:underline flex items-center justify-center gap-1 mx-auto text-emerald-700 cursor-pointer"
                          title="طباعة إيصال مكافأة 80mm"
                        >
                          <Printer size={11} className="opacity-60" />
                          <span>{Number(row.bonuses || 0).toFixed(2)}</span>
                        </button>
                      ) : '-'}
                    </td>

                    {/* 19. Employee Work Revenue */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-slate-800">
                      {Number(row.workRevenue || 0) > 0 ? Number(row.workRevenue || 0).toFixed(0) : '-'}
                    </td>

                    {/* 20. Employee Commission */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold text-emerald-600">
                      <div className="flex flex-col items-center gap-1">
                        <span>{Number(row.commissionAmount || 0) > 0 ? Number(row.commissionAmount || 0).toFixed(2) : '0'}</span>
                        {canDisburseCommissions && (Number(row.commissionAmount || 0) + Number(row.dailyTargetCommission || 0) - Number(row.commissionPaid || 0)) > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenCommissionModal(
                              row.employee.id, 
                              Math.max(0, Number(row.commissionAmount || 0) + Number(row.dailyTargetCommission || 0) - Number(row.commissionPaid || 0)),
                              row.dateStr
                            )}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                            title={`صرف عمولة ${row.employee.name} فوراً عن يوم ${row.dateStr}`}
                          >
                            <Coins size={10} />
                            <span>صرف</span>
                          </button>
                        )}
                        {(Number(row.commissionAmount || 0) + Number(row.dailyTargetCommission || 0)) > 0 && (Number(row.commissionPaid || 0) >= (Number(row.commissionAmount || 0) + Number(row.dailyTargetCommission || 0))) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check size={11} className="inline ml-0.5" />
                            <span>مسددة</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 20.05. Target Commission */}
                    <td className="p-2 border-l border-slate-200 font-mono font-bold bg-indigo-50/40">
                      {row.dailyTargetCommission && Number(row.dailyTargetCommission || 0) > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="text-indigo-700 font-black">{Number(row.dailyTargetCommission || 0).toFixed(2)}</span>
                          <span className="text-[9px] text-indigo-500 font-medium">({row.targetAchievementPercentage}%)</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* 20.1 Paid Commissions */}
                    <td className="p-2 border-l border-slate-200 font-mono text-rose-600 font-bold bg-amber-50/30">
                      {Number(row.commissionPaid || 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePrintRowVoucher(row, 'commission_payout', row.commissionPaid, 'سند صرف عمولة مسجلة بالتايم شيت')}
                          className="hover:underline flex items-center justify-center gap-1 mx-auto text-rose-600 cursor-pointer"
                          title="طباعة إيصال صرف عمولة 80mm"
                        >
                          <Printer size={11} className="opacity-60" />
                          <span>{Number(row.commissionPaid || 0).toFixed(2)}</span>
                        </button>
                      ) : '-'}
                    </td>

                    {/* 21. Net Daily */}
                    <td className={`p-2 border-l border-slate-200 font-mono font-black text-xs ${
                      row.netDaily < 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-900 bg-slate-50'
                    }`}>
                      {Number(row.netDaily || 0).toFixed(2)}
                    </td>

                    {/* 22. Forgive Delay Checkbox */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleDelayForgive(key, row.isDelayForgiven)}
                        disabled={!canForgiveDelays}
                        className={`text-slate-500 hover:text-emerald-600 transition-colors ${
                          canForgiveDelays ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                        }`}
                        title={
                          !canForgiveDelays
                            ? 'ليس لديك صلاحية المسامحة عن التأخير'
                            : row.isDelayForgiven ? 'تمت المسامحة (إلغاء الخصم)' : 'تفعيل المسامحة عن التأخير'
                        }
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
              })
            )}
            </tbody>

            {/* Footer Summary Row (Exact as in reference image) */}
            <tfoot className="bg-slate-200 font-black text-slate-900 border-t-2 border-slate-400 sticky bottom-0 text-[11px]">
              <tr>
                <td colSpan={3} className="p-2.5 text-center bg-slate-300 font-black border-l border-slate-400">
                  المجموع الكلي ({timesheetRows.length} سجل)
                </td>
                <td className="p-2.5 font-mono border-l border-slate-400">{Number(totals.dailyRateSum || 0).toFixed(2)}</td>
                <td colSpan={5} className="p-2.5 text-center text-slate-500 border-l border-slate-400">--</td>
                <td className="p-2.5 font-mono text-slate-700 border-l border-slate-400">{totals.permissionMinutesSum > 0 ? `${totals.permissionMinutesSum} د` : '--'}</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{Number(totals.permissionDeductionSum || 0) > 0 ? Number(totals.permissionDeductionSum || 0).toFixed(2) : '--'}</td>
                <td className="p-2.5 text-center text-slate-500 border-l border-slate-400">--</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{totals.delayMinutesSum} د</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{Number(totals.delayDeductionSum || 0).toFixed(2)}</td>
                <td className="p-2.5 font-mono text-blue-700 border-l border-slate-400">{totals.overtimeMinutesSum} د</td>
                <td className="p-2.5 font-mono text-blue-700 border-l border-slate-400">{Number(totals.overtimeAmountSum || 0).toFixed(2)}</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{Number(totals.specialPenaltySum || 0).toFixed(2)}</td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400">{Number(totals.absenceDeductionSum || 0).toFixed(2)}</td>
                <td className="p-2.5 font-mono text-amber-800 border-l border-slate-400">{Number(totals.advancesSum || 0).toFixed(2)}</td>
                <td className="p-2.5 font-mono text-emerald-800 border-l border-slate-400">{Number(totals.bonusesSum || 0).toFixed(2)}</td>
                <td className="p-2.5 font-mono text-slate-900 border-l border-slate-400">{Number(totals.workRevenueSum || 0).toFixed(2)}</td>
                <td className="p-2.5 font-mono text-emerald-800 border-l border-slate-400">{Number(totals.commissionSum || 0).toFixed(2)}</td>
                <td className="p-2.5 font-mono text-indigo-800 border-l border-slate-400 bg-indigo-100/60 font-bold">
                  {Number(totals.targetCommissionSum || 0) > 0 ? Number(totals.targetCommissionSum || 0).toFixed(2) : '--'}
                </td>
                <td className="p-2.5 font-mono text-rose-700 border-l border-slate-400 bg-amber-100/60 font-bold">
                  {Number(totals.commissionPaidSum || 0) > 0 ? Number(totals.commissionPaidSum || 0).toFixed(2) : '--'}
                </td>
                <td className="p-2.5 font-mono text-emerald-900 bg-emerald-200 text-sm font-black border-l border-slate-400">
                  {Number(totals.netSum || 0).toFixed(2)} {settings.currency}
                </td>
                <td className="p-2.5 text-center text-slate-400">--</td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* COMMISSIONS DETAILED SECTION (قسم ملخص وتفاصيل العمولات المستحقة) */}
      {/* ========================================================================= */}
      {hrMainTab === 'commissions' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black shadow-md shadow-amber-600/20">
                  <Coins size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900">ملخص وتفاصيل العمولات المستحقة (Commissions Breakdown)</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                      فواتير مسددة وغير ملغية فقط
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    كشف تفصيلي بجميع فواتير المبيعات المنفذة والمحالة (فتح شغل) المسددة للموظف خلال الفترة المحددة
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {canDisburseCommissions && (
                <button
                  type="button"
                  onClick={() => handleOpenCommissionModal(commSelectedEmpId)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-600/20 transition-all cursor-pointer"
                  title="صرف وتسجيل دفعة عمولة رسمية للموظف"
                >
                  <Coins size={15} />
                  <span>صرف عمولة</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintCommissionsReport}
                className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                title="طباعة تقرير كشف العمولات"
              >
                <Printer size={15} />
                <span>طباعة الكشف</span>
              </button>

              <button
                type="button"
                onClick={handleExportCommissionsCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                title="تصدير كشف إكسل (CSV)"
              >
                <FileSpreadsheet size={15} />
                <span>تصدير Excel</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <User size={14} className="text-amber-600" />
                  <span>اختر الموظف:</span>
                </label>
                <select
                  value={commSelectedEmpId}
                  onChange={e => setCommSelectedEmpId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-amber-600 focus:bg-white outline-none cursor-pointer"
                >
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.role ? `(${emp.role})` : ''} - كود: {emp.fingerprintCode || emp.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar size={14} className="text-indigo-600" />
                  <span>من تاريخ:</span>
                </label>
                <input
                  type="date"
                  value={commStartDate}
                  onChange={e => setCommStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-indigo-600 focus:bg-white outline-none"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar size={14} className="text-indigo-600" />
                  <span>إلى تاريخ:</span>
                </label>
                <input
                  type="date"
                  value={commEndDate}
                  onChange={e => setCommEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-indigo-600 focus:bg-white outline-none"
                />
              </div>

              {/* Quick Period Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  فترات سريعة:
                </label>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => setQuickCommPeriod('this_month')}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer text-center"
                    title="الشهر الحالي كاملاً"
                  >
                    الشهر
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCommPeriod('last_month')}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer text-center"
                    title="الشهر السابق كاملاً"
                  >
                    السابق
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCommPeriod('last_30_days')}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer text-center"
                    title="آخر 30 يوماً"
                  >
                    30 يوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCommPeriod('today')}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer text-center"
                    title="اليوم فقط"
                  >
                    اليوم
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-bar: Employee Badge, Type Filter, and Search */}
            <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              {/* Selected Employee Commission Badge */}
              {detailedCommissionsData.employee && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">نظام العمولة المعتمد:</span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black flex items-center gap-1.5">
                    <Award size={14} className="text-amber-600" />
                    <span>{getCommissionModelLabel(detailedCommissionsData.employee)}</span>
                  </span>
                  {detailedCommissionsData.employee.role && (
                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
                      {detailedCommissionsData.employee.role}
                    </span>
                  )}
                </div>
              )}

              {/* Commission Type Filter & Search Bar */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Type Filter Buttons */}
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCommTypeFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      commTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الكل ({detailedCommissionsData.rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommTypeFilter('execution')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      commTypeFilter === 'execution' ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تنفيذ ({detailedCommissionsData.executionCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommTypeFilter('referral')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      commTypeFilter === 'referral' ? 'bg-white text-purple-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    إحالة ({detailedCommissionsData.referralCount})
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative flex-1 md:w-56">
                  <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={commSearchQuery}
                    onChange={e => setCommSearchQuery(e.target.value)}
                    placeholder="بحث برقم الفاتورة أو العميل..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-slate-800 focus:border-amber-600 focus:bg-white outline-none"
                  />
                  {commSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCommSearchQuery('')}
                      className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Card 1: Total Earned Commission */}
            <div className="bg-white p-4 rounded-2xl border-2 border-amber-300 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-[11px] font-bold">إجمالي العمولات المستحقة</span>
                <Coins size={16} />
              </div>
              <div className="text-xl font-black font-mono text-amber-950">
                {detailedCommissionsData.totalEarnedCommission.toFixed(2)}
                <span className="text-[10px] font-normal text-slate-500 mr-1">{settings.currency}</span>
              </div>
              <div className="text-[10px] font-bold text-amber-700 mt-1">
                {detailedCommissionsData.rows.length} بند عمولة بالفواتير
              </div>
            </div>

            {/* Card 2: Execution Commission */}
            <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-xs">
              <div className="flex items-center justify-between text-sky-700 mb-1">
                <span className="text-[11px] font-bold">عمولات التنفيذ</span>
                <Briefcase size={16} />
              </div>
              <div className="text-xl font-black font-mono text-sky-950">
                {detailedCommissionsData.executionCommissionSum.toFixed(2)}
                <span className="text-[10px] font-normal text-slate-500 mr-1">{settings.currency}</span>
              </div>
              <div className="text-[10px] font-bold text-sky-700 mt-1">
                {detailedCommissionsData.executionCount} خدمة/منتج تم تنفيذه
              </div>
            </div>

            {/* Card 3: Referral Commission */}
            <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs">
              <div className="flex items-center justify-between text-purple-700 mb-1">
                <span className="text-[11px] font-bold">عمولات الإحالة وفتح الشغل</span>
                <Award size={16} />
              </div>
              <div className="text-xl font-black font-mono text-purple-950">
                {detailedCommissionsData.referralCommissionSum.toFixed(2)}
                <span className="text-[10px] font-normal text-slate-500 mr-1">{settings.currency}</span>
              </div>
              <div className="text-[10px] font-bold text-purple-700 mt-1">
                {detailedCommissionsData.referralCount} إحالة وفتح شغل
              </div>
            </div>

            {/* Card 4: Total Revenue */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-[11px] font-bold">إجمالي مبيعات وخدمات الموظف</span>
                <DollarSign size={16} />
              </div>
              <div className="text-xl font-black font-mono text-emerald-950">
                {detailedCommissionsData.totalRevenue.toFixed(2)}
                <span className="text-[10px] font-normal text-slate-500 mr-1">{settings.currency}</span>
              </div>
              <div className="text-[10px] font-bold text-emerald-700 mt-1">
                {detailedCommissionsData.uniqueInvoicesCount} فاتورة مسددة
              </div>
            </div>

            {/* Card 5: Paid Commissions */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-[11px] font-bold">العمولات المنصرفة</span>
                <Wallet size={16} />
              </div>
              <div className="text-xl font-black font-mono text-slate-900">
                {detailedCommissionsData.paidCommissions.toFixed(2)}
                <span className="text-[10px] font-normal text-slate-500 mr-1">{settings.currency}</span>
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-1">
                مسجلة بسندات الصرف
              </div>
            </div>

            {/* Card 6: Remaining Unpaid Commissions */}
            <div className={`bg-white p-4 rounded-2xl border shadow-xs ${
              detailedCommissionsData.unpaidCommissions > 0 ? 'border-rose-300 bg-rose-50/20' : 'border-emerald-300 bg-emerald-50/20'
            }`}>
              <div className={`flex items-center justify-between mb-1 ${
                detailedCommissionsData.unpaidCommissions > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                <span className="text-[11px] font-bold">المتبقي للصرف</span>
                <CheckCircle size={16} />
              </div>
              <div className={`text-xl font-black font-mono ${
                detailedCommissionsData.unpaidCommissions > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {detailedCommissionsData.unpaidCommissions.toFixed(2)}
                <span className="text-[10px] font-normal text-slate-500 mr-1">{settings.currency}</span>
              </div>
              <div className={`text-[10px] font-bold mt-1 ${
                detailedCommissionsData.unpaidCommissions > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {detailedCommissionsData.unpaidCommissions > 0 ? 'مستحق للصرف' : 'تمت التسوية بالكامل'}
              </div>
            </div>
          </div>

          {/* Detailed Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-slate-700" />
                <h3 className="font-black text-sm text-slate-900">
                  سجل الفواتير وبنود العمولات المستحقة
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                  {filteredCommissionRows.length} بند
                </span>
              </div>
              <span className="text-xs text-slate-500">
                الفترة من <strong className="text-slate-700 font-mono">{commStartDate}</strong> إلى <strong className="text-slate-700 font-mono">{commEndDate}</strong>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-center w-12 border-l border-slate-200">#</th>
                    <th className="p-3 border-l border-slate-200">رقم الفاتورة</th>
                    <th className="p-3 text-center border-l border-slate-200">التاريخ</th>
                    <th className="p-3 text-center border-l border-slate-200">الوقت</th>
                    <th className="p-3 border-l border-slate-200">اسم العميل</th>
                    <th className="p-3 border-l border-slate-200">الخدمة / البند</th>
                    <th className="p-3 text-center border-l border-slate-200">نوع الاستحقاق</th>
                    <th className="p-3 text-left border-l border-slate-200">قيمة الخدمة</th>
                    <th className="p-3 border-l border-slate-200">قاعدة الاحتساب</th>
                    <th className="p-3 text-left border-l border-slate-200">العمولة المستحقة</th>
                    <th className="p-3 text-center">حالة الفاتورة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCommissionRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Coins size={36} className="text-slate-300" />
                          <p className="font-bold text-sm text-slate-600">لا توجد فواتير مسددة مستحق عليها عمولات لهذا الموظف خلال الفترة المحددة</p>
                          <p className="text-xs text-slate-400">تأكد من اختيار الموظف الصحيح ومطابقة التواريخ، أو جرب تغيير نوع الفلترة.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCommissionRows.map((row, idx) => (
                      <tr 
                        key={row.rowId} 
                        className={`hover:bg-amber-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                      >
                        <td className="p-3 text-center font-mono text-slate-400 border-l border-slate-100 font-bold">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 border-l border-slate-100">
                          #{row.invoiceId}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-700 border-l border-slate-100">
                          {row.dateStr}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-700 border-l border-slate-100">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold">
                            {row.timeStr}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-900 border-l border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-slate-400" />
                            <span>{row.clientName}</span>
                          </div>
                          {row.clientPhone && (
                            <span className="text-[10px] font-mono text-slate-400 block mr-5">
                              {row.clientPhone}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-800 border-l border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${row.itemType === 'service' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                            <span>{row.itemName}</span>
                            {row.quantity > 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 font-mono">
                                ×{row.quantity}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center border-l border-slate-100">
                          {row.commissionType === 'execution' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold">
                              <Briefcase size={12} className="text-sky-600" />
                              <span>تنفيذ خدمة</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                              <Award size={12} className="text-amber-600" />
                              <span>إحالة وفتح شغل</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-slate-800 border-l border-slate-100">
                          {row.itemTotal.toFixed(2)}
                          <span className="text-[10px] text-slate-400 mr-0.5">{settings.currency}</span>
                        </td>
                        <td className="p-3 text-slate-600 text-[11px] border-l border-slate-100">
                          {row.calculationRule}
                        </td>
                        <td className="p-3 text-left font-mono font-black text-emerald-700 text-xs border-l border-slate-100 bg-emerald-50/20">
                          {row.earnedCommission.toFixed(2)}
                          <span className="text-[10px] text-emerald-600 mr-0.5">{settings.currency}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">
                            <Check size={12} />
                            <span>مسددة</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Table Footer */}
                {filteredCommissionRows.length > 0 && (
                  <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 sticky bottom-0 text-xs">
                    <tr>
                      <td colSpan={7} className="p-3 text-center bg-slate-200 border-l border-slate-300 font-black">
                        الإجمالي العام المستحق ({filteredCommissionRows.length} بند في {detailedCommissionsData.uniqueInvoicesCount} فاتورة مسددة)
                      </td>
                      <td className="p-3 text-left font-mono font-black border-l border-slate-300 text-slate-900">
                        {detailedCommissionsData.totalRevenue.toFixed(2)} {settings.currency}
                      </td>
                      <td className="p-3 border-l border-slate-300">--</td>
                      <td className="p-3 text-left font-mono font-black text-emerald-800 border-l border-slate-300 text-sm bg-emerald-100/70">
                        {detailedCommissionsData.totalEarnedCommission.toFixed(2)} {settings.currency}
                      </td>
                      <td className="p-3 text-center text-emerald-700 font-black">
                        مسددة
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Note in Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>يحتسب هذا الكشف الفواتير المسددة بالكامل والغير ملغية فقط وفقاً للقواعد المالية المعتمدة في النظام.</span>
              </div>
              <div className="font-mono text-slate-400">
                Smart Cut HR & Commission Engine
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADVANCES SECTION (قسم جدول وسجل السلف النقدية وإدارتها) */}
      {/* ========================================================================= */}
      {hrMainTab === 'advances' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
                  <Banknote size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900">سجل وجدول السلف النقدية (Advances Register)</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                      {filteredAdvances.length} سلفة مسجلة
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    كشف شامل لجميع السلف النقدية المنصرفة للموظفين مع إمكانية التصفية، البحث، التعديل، والحذف وإعادة طباعة السندات
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action: New Advance */}
            {canManageAdvances && (
              <button
                type="button"
                onClick={() => {
                  setNewAdvanceForm({
                    empId: activeEmployees[0]?.id || '',
                    amount: '',
                    date: shiftData?.isOpen ? shiftData.date : new Date().toISOString().split('T')[0],
                    treasuryId: settings.treasuries[0]?.id || '',
                    note: ''
                  });
                  setShowNewAdvanceModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer self-stretch md:self-auto justify-center"
              >
                <Plus size={16} />
                <span>+ تسجيل سلفة جديدة</span>
              </button>
            )}
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Advances */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-[11px] font-bold">إجمالي مبالغ السلف</span>
                <DollarSign size={16} />
              </div>
              <div className="text-xl font-black font-mono text-emerald-950">
                {advancesStats.totalAmount.toFixed(2)}
                <span className="text-[10px] font-normal text-slate-500 mr-1">{settings.currency}</span>
              </div>
              <div className="text-[10px] font-bold text-emerald-700 mt-1">
                للفترة والفلاتر المحددة
              </div>
            </div>

            {/* Count of Advances */}
            <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-xs">
              <div className="flex items-center justify-between text-sky-700 mb-1">
                <span className="text-[11px] font-bold">عدد السلف المنصرفة</span>
                <FileText size={16} />
              </div>
              <div className="text-xl font-black font-mono text-sky-950">
                {advancesStats.count}
                <span className="text-[10px] font-normal text-slate-500 mr-1">سلفة</span>
              </div>
              <div className="text-[10px] font-bold text-sky-700 mt-1">
                عملية صرف موثقة
              </div>
            </div>

            {/* Average Advance */}
            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-[11px] font-bold">متوسط قيمة السلفة</span>
                <TrendingUp size={16} />
              </div>
              <div className="text-xl font-black font-mono text-amber-950">
                {advancesStats.avgAmount.toFixed(2)}
                <span className="text-[10px] font-normal text-slate-500 mr-1">{settings.currency}</span>
              </div>
              <div className="text-[10px] font-bold text-amber-700 mt-1">
                لكل عملية صرف
              </div>
            </div>

            {/* Unique Recipient Employees */}
            <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs">
              <div className="flex items-center justify-between text-purple-700 mb-1">
                <span className="text-[11px] font-bold">الموظفون المستفيدون</span>
                <Users size={16} />
              </div>
              <div className="text-xl font-black font-mono text-purple-950">
                {advancesStats.uniqueEmployeesCount}
                <span className="text-[10px] font-normal text-slate-500 mr-1">موظف</span>
              </div>
              <div className="text-[10px] font-bold text-purple-700 mt-1">
                من إجمالي {activeEmployees.length} موظف
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                <Filter size={15} className="text-emerald-600" />
                <span>فلاتر البحث والتصفية المتقدمة</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
                    setAdvanceDateFrom(`${y}-${m}-01`);
                    setAdvanceDateTo(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  الشهر الحالي
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 1);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
                    setAdvanceDateFrom(`${y}-${m}-01`);
                    setAdvanceDateTo(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  الشهر السابق
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdvanceDateFrom('');
                    setAdvanceDateTo('');
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  كل الفترات
                </button>
                {(advanceEmpFilter !== 'all' || advanceTreasuryFilter !== 'all' || advanceSearchQuery || advanceDateFrom || advanceDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceEmpFilter('all');
                      setAdvanceTreasuryFilter('all');
                      setAdvanceSearchQuery('');
                      const d = new Date();
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
                      setAdvanceDateFrom(`${y}-${m}-01`);
                      setAdvanceDateTo(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>إعادة ضبط</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Query */}
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث سريع</label>
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={advanceSearchQuery}
                    onChange={e => setAdvanceSearchQuery(e.target.value)}
                    placeholder="بحث باسم الموظف أو البيان أو رقم السند..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all"
                  />
                  {advanceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAdvanceSearchQuery('')}
                      className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Employee Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">الموظف</label>
                <select
                  value={advanceEmpFilter}
                  onChange={e => setAdvanceEmpFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">كل الموظفين ({activeEmployees.length})</option>
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role || 'موظف'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Treasury Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">الخزينة المنصرف منها</label>
                <select
                  value={advanceTreasuryFilter}
                  onChange={e => setAdvanceTreasuryFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">كل الخزائن</option>
                  {settings.treasuries.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range: From / To */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">من تاريخ</label>
                  <input
                    type="date"
                    value={advanceDateFrom}
                    onChange={e => setAdvanceDateFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    value={advanceDateTo}
                    onChange={e => setAdvanceDateTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Advances Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">رقم السند / المعرف</th>
                    <th className="p-3">تاريخ ووقت السلفة</th>
                    <th className="p-3">اسم الموظف</th>
                    <th className="p-3 text-left">مبلغ السلفة</th>
                    <th className="p-3">الخزينة المنصرف منها</th>
                    <th className="p-3">البيان والملاحظات</th>
                    <th className="p-3 text-center w-36">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <Banknote size={40} className="mx-auto mb-2 text-slate-300 opacity-60" />
                        <p className="font-bold text-sm text-slate-600">لا توجد سلف مسجلة مطابقة للفلاتر المحددة</p>
                        <p className="text-xs text-slate-400 mt-1">جرّب تغيير خيارات البحث أو تمديد نطاق التواريخ</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAdvances.map((adv, idx) => (
                      <tr key={adv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px]">
                            {adv.id}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{adv.date.split('T')[0]}</div>
                          {adv.date.includes('T') && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {adv.date.split('T')[1].substring(0, 5)}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-black text-slate-900">{adv.employeeName}</div>
                          {adv.employeeRole && (
                            <div className="text-[10px] text-slate-500">{adv.employeeRole}</div>
                          )}
                        </td>
                        <td className="p-3 text-left">
                          <span className="font-mono font-black text-emerald-800 text-sm bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {adv.amount.toFixed(2)}
                            <span className="text-[10px] font-normal text-emerald-700 mr-1">{settings.currency}</span>
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <Wallet size={13} className="text-slate-400" />
                            <span className="font-bold text-slate-700">{adv.treasuryName}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-slate-700 font-medium">
                            {adv.note || '--'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Print thermal voucher */}
                            <button
                              type="button"
                              onClick={() => handlePrintAdvanceVoucher(adv)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                              title="طباعة سند السلفة 80mm"
                            >
                              <Printer size={14} />
                            </button>

                            {/* Edit advance */}
                            {canManageAdvances && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditAdvance(adv)}
                                className="p-1.5 rounded-lg text-sky-600 hover:text-sky-800 hover:bg-sky-50 border border-sky-200 transition-colors cursor-pointer"
                                title="تعديل بيانات السلفة"
                              >
                                <Edit size={14} />
                              </button>
                            )}

                            {/* Delete advance */}
                            {canManageAdvances && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAdvance(adv)}
                                className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                                title="حذف السلفة واسترجاع المبلغ"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredAdvances.length > 0 && (
                  <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 sticky bottom-0 text-xs">
                    <tr>
                      <td colSpan={4} className="p-3 text-center bg-slate-200 border-l border-slate-300 font-black">
                        الإجمالي ({filteredAdvances.length} سلفة مسجلة)
                      </td>
                      <td className="p-3 text-left font-mono font-black text-emerald-800 border-l border-slate-300 text-sm bg-emerald-100/70">
                        {advancesStats.totalAmount.toFixed(2)} {settings.currency}
                      </td>
                      <td colSpan={3} className="p-3 text-slate-500 font-normal text-right">
                        متوسط السلفة: {advancesStats.avgAmount.toFixed(2)} {settings.currency} • المستفيدون: {advancesStats.uniqueEmployeesCount} موظف
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>يتم خصم السلف المسجلة تلقائياً من صافي راتب الموظف في مسير الرواتب الشهري، وتؤثر الحركات المالية مباشرة على رصيد الخزينة المحددة.</span>
              </div>
              <div className="font-mono text-slate-400">
                Smart Cut HR & Advances Engine
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Advance Modal */}
      {editingAdvance && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Edit size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">تعديل بيانات السلفة النقدية</h3>
                  <p className="text-[11px] text-slate-500">{editingAdvance.employeeName} ({editingAdvance.employeeRole || 'موظف'})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAdvance(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Employee Name (Locked) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموظف</label>
                <input
                  type="text"
                  disabled
                  value={`${editingAdvance.employeeName} (${editingAdvance.employeeCode || editingAdvance.employeeId})`}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>مبلغ السلفة *</span>
                  <span className="text-[10px] text-slate-400 font-normal">بالعملة المحلية ({settings.currency})</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={editAdvanceForm.amount}
                  onChange={e => setEditAdvanceForm({ ...editAdvanceForm, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-emerald-800 font-mono outline-none focus:border-emerald-600 focus:bg-white"
                  placeholder="0.00"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ السلفة *</label>
                <input
                  type="date"
                  value={editAdvanceForm.date}
                  onChange={e => setEditAdvanceForm({ ...editAdvanceForm, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white cursor-pointer"
                />
              </div>

              {/* Treasury */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الخزينة المنصرف منها *</label>
                <select
                  value={editAdvanceForm.treasuryId}
                  onChange={e => setEditAdvanceForm({ ...editAdvanceForm, treasuryId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white cursor-pointer"
                >
                  {settings.treasuries.map(t => {
                    const bal = treasuryBalances[t.id] ?? 0;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} (رصيد: {Number(bal || 0).toFixed(2)} {settings.currency})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان والملاحظات</label>
                <input
                  type="text"
                  value={editAdvanceForm.note}
                  onChange={e => setEditAdvanceForm({ ...editAdvanceForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
                  placeholder="ملاحظات أو سبب السلفة..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingAdvance(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSavingAdvance}
                onClick={handleSaveEditedAdvance}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingAdvance ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Advance Modal */}
      {showNewAdvanceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">تسجيل وصرف سلفة جديدة</h3>
                  <p className="text-[11px] text-slate-500">صرف سلفة نقدية على حساب الراتب وطباعة إيصال الصرف</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAdvanceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Employee */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموظف المستفيد *</label>
                <select
                  value={newAdvanceForm.empId}
                  onChange={e => setNewAdvanceForm({ ...newAdvanceForm, empId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white cursor-pointer"
                >
                  <option value="">-- اختر الموظف --</option>
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role || 'موظف'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>مبلغ السلفة *</span>
                  <span className="text-[10px] text-slate-400 font-normal">بالعملة المحلية ({settings.currency})</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={newAdvanceForm.amount}
                  onChange={e => setNewAdvanceForm({ ...newAdvanceForm, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-emerald-800 font-mono outline-none focus:border-emerald-600 focus:bg-white"
                  placeholder="0.00"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الصرف *</label>
                <input
                  type="date"
                  value={newAdvanceForm.date}
                  onChange={e => setNewAdvanceForm({ ...newAdvanceForm, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white cursor-pointer"
                />
              </div>

              {/* Treasury */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الخزينة المنصرف منها *</label>
                <select
                  value={newAdvanceForm.treasuryId}
                  onChange={e => setNewAdvanceForm({ ...newAdvanceForm, treasuryId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white cursor-pointer"
                >
                  {settings.treasuries.map(t => {
                    const bal = treasuryBalances[t.id] ?? 0;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} (رصيد: {Number(bal || 0).toFixed(2)} {settings.currency})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان والملاحظات</label>
                <input
                  type="text"
                  value={newAdvanceForm.note}
                  onChange={e => setNewAdvanceForm({ ...newAdvanceForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
                  placeholder="سلفة نقدية على حساب الراتب..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewAdvanceModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSavingAdvance}
                onClick={handleCreateNewAdvance}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Printer size={14} />
                <span>{isSavingAdvance ? 'جاري الصرف...' : 'صرف وطباعة السند'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salary Slip Modal (80mm preview and print) */}
      {showSlipModal && activeSlipSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                <Printer size={16} />
                قسيمة الراتب 80mm
              </h3>
              <button onClick={() => setShowSlipModal(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={16} />
              </button>
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
                <X size={16} />
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
                  {settings.treasuries.map(t => {
                    const bal = treasuryBalances[t.id] ?? 0;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} (رصيد: {Number(bal || 0).toFixed(2)} {settings.currency})
                      </option>
                    );
                  })}
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
                        {(() => {
                          const payableEmps = payrollDisbursementData.filter(d => !d.isAlreadyPaid && d.netPayable > 0);
                          const isAllPayableSelected = payableEmps.length > 0 && payableEmps.every(d => selectedDisbursementEmpIds.includes(d.emp.id));
                          return (
                            <input
                              type="checkbox"
                              checked={isAllPayableSelected}
                              disabled={payableEmps.length === 0}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedDisbursementEmpIds(payableEmps.map(emp => emp.emp.id));
                                } else {
                                  setSelectedDisbursementEmpIds([]);
                                }
                              }}
                              className="w-4 h-4 text-emerald-600 rounded cursor-pointer disabled:opacity-30"
                              title={payableEmps.length === 0 ? 'جميع الموظفين تم صرف رواتبهم مسبقاً لهذا الشهر' : 'تحديد جميع الموظفين غير المصروف لهم'}
                            />
                          );
                        })()}
                      </th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">أيام العمل</th>
                      <th className="p-3">الراتب المستحق</th>
                      <th className="p-3">العمولات المحققة</th>
                      <th className="p-3">المكافآت (+)</th>
                      <th className="p-3">السلف والخصومات (-)</th>
                      <th className="p-3 text-emerald-800">الصافي وحالة الصرف</th>
                      <th className="p-3 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payrollDisbursementData.map(item => {
                      const isSelected = selectedDisbursementEmpIds.includes(item.emp.id);

                      return (
                        <tr 
                          key={item.emp.id} 
                          className={`hover:bg-slate-50 transition-colors ${
                            item.isAlreadyPaid ? 'bg-slate-50/70 opacity-90' : isSelected ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            {item.isAlreadyPaid ? (
                              <span title={`تم صرف راتب شهر (${selectedMonth}) لهذا الموظف مسبقاً`}>
                                <Check size={16} className="text-emerald-600 mx-auto" />
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={item.netPayable <= 0}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedDisbursementEmpIds([...selectedDisbursementEmpIds, item.emp.id]);
                                  } else {
                                    setSelectedDisbursementEmpIds(selectedDisbursementEmpIds.filter(id => id !== item.emp.id));
                                  }
                                }}
                                className="w-4 h-4 text-emerald-600 rounded cursor-pointer disabled:opacity-30"
                              />
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{item.emp.name}</span>
                              {item.isAlreadyPaid && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                  <Check size={10} className="text-emerald-700" />
                                  <span>تم الصرف</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              #{item.emp.fingerprintCode || item.emp.id} | {item.emp.role}
                            </div>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-700">
                            {item.presentDaysCount} يوم
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {Number(item.earnedBaseSalary || 0).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-700">
                            +{Number(item.totalCommissions || 0).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-700">
                            +{Number(item.totalBonuses || 0).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-bold text-rose-700">
                            -{Number(item.totalDeductions || 0).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono">
                            {item.isAlreadyPaid ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs border border-emerald-300">
                                  <span>تم الصرف: {item.paidRecord?.amount !== undefined ? Number(item.paidRecord.amount || 0).toFixed(2) : Number(item.netPayable || 0).toFixed(2)} {settings.currency}</span>
                                </span>
                                <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                                  بتاريخ: {item.paidRecord?.date || '-'}
                                </div>
                              </div>
                            ) : (
                              <span className="font-black text-emerald-800 text-sm">
                                {Number(item.netPayable || 0).toFixed(2)} {settings.currency}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {item.isAlreadyPaid ? (
                              <button
                                type="button"
                                onClick={() => handleReprintDisbursementVoucher(item)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 mx-auto cursor-pointer shadow-2xs transition-colors"
                                title="إعادة طباعة سند صرف الراتب 80mm للتوقيع"
                              >
                                <Printer size={13} className="text-slate-600" />
                                <span>إعادة طباعة</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDisburseSalaries([item.emp.id])}
                                disabled={item.netPayable <= 0}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 mx-auto cursor-pointer shadow-xs"
                              >
                                <Check size={13} />
                                <span>صرف وإيصال</span>
                              </button>
                            )}
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
                      .reduce((sum, d) => sum + (Number(d.netPayable || 0)), 0)
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
                          className="text-[10px] text-rose-600 hover:underline cursor-pointer font-bold inline-flex items-center gap-0.5"
                          title="إلغاء تسجيل الانصراف"
                        >
                          <span>مسح</span>
                          <X size={10} />
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
                      <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <Moon size={13} className="text-indigo-600" />
                        <span>انصراف في اليوم التالي (بعد منتصف الليل +1 يوم)</span>
                      </span>
                    </label>

                    {/* Calculated Live Working Hours Preview */}
                    {(() => {
                      const inParts = (attendanceForm.checkIn || '00:00').split(':').map(Number);
                      const outParts = (attendanceForm.checkOut || '00:00').split(':').map(Number);
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
                  <Moon size={12} className="text-indigo-700" />
                  <span>شفت ليلي (1:00 ظ - 2:00 ص) [13 ساعة]</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '16:00', checkOut: '02:00', isNextDayCheckout: true })}
                  className="text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Moon size={12} className="text-indigo-600" />
                  <span>شفت سهرة (4:00 ع - 2:00 ص) [10 ساعات]</span>
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
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '09:00', checkOut: '18:00', isNextDayCheckout: false, notes: 'حضور' })}
                  className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Calendar size={12} className="text-emerald-700" />
                  <span>تعيين كـ "حضور" (دوام كامل)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '', checkOut: '', isNextDayCheckout: false, notes: 'غياب' })}
                  className="text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 px-2 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                >
                  <AlertTriangle size={12} className="text-rose-700" />
                  <span>تعيين كـ "غياب"</span>
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
                {canDeleteAttendance ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteAttendance(attendanceForm.empId, attendanceForm.date)}
                    className="text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                    title="حذف البصمات المسجلة لهذا اليوم واعتباره غياب"
                  >
                    <Trash2 size={14} />
                    <span>حذف وقت اليوم (تعيين غياب)</span>
                  </button>
                ) : <div />}

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
                    <span>{isSavingAttendance ? 'جاري الحفظ...' : 'حفظ وتحديث التايم شيت'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SALARY INCREMENT (تسجيل وتطبيق زيادة راتب) */}
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
                <X size={16} />
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
                        {emp.name} — الراتب الحالي: {Number(emp.baseSalary || 0).toFixed(2)} {settings.currency}
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
                            الراتب: {Number(emp.baseSalary || 0).toFixed(2)} {settings.currency}
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
                      <span className="text-purple-700 font-mono">+{Number(incAmt || 0).toFixed(2)} {settings.currency}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2 rounded-xl border border-purple-100">
                        <span className="text-slate-500 block text-[10px]">الراتب الحالي</span>
                        <span className="font-mono font-bold text-slate-800">{Number(currentBase || 0).toFixed(2)}</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-purple-100">
                        <span className="text-purple-600 block text-[10px]">مقدار الزيادة</span>
                        <span className="font-mono font-black text-purple-700">+{Number(incAmt || 0).toFixed(2)}</span>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                        <span className="text-emerald-700 block text-[10px] font-bold">الراتب الجديد</span>
                        <span className="font-mono font-black text-emerald-800 text-sm">{Number(newBase || 0).toFixed(2)} {settings.currency}</span>
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
                  <span>اعتماد وتطبيق زيادة الراتب وحفظها</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FULL SALARY HISTORY VIEWER (سجل وتاريخ زيادات الرواتب بالكامل) */}
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
                  <X size={16} />
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
                    <span>مجموع مبالغ الزيادات: <strong className="text-emerald-700 font-mono">+{Number(totalIncAmount || 0).toFixed(2)} {settings.currency}</strong></span>
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
                            const prevSal = Number(item.previousSalary || 0);
                            const newSal = Number(item.newSalary || 0);
                            const diff = newSal - prevSal;
                            const pct = prevSal > 0 ? ((diff / prevSal) * 100).toFixed(1) : '100';

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
                                <td className="p-3 font-mono text-slate-500">{prevSal.toFixed(2)} {settings.currency}</td>
                                <td className="p-3 font-mono font-black text-purple-700">
                                  +{diff.toFixed(2)} {settings.currency}
                                  <span className="text-[10px] text-purple-500 font-semibold mr-1">({pct}%)</span>
                                </td>
                                <td className="p-3 font-mono font-black text-emerald-700 text-sm">
                                  {newSal.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
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
                <X size={16} />
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
              {commTargetDate && (
                <div className="bg-amber-100/70 border border-amber-300 text-amber-900 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-amber-700" />
                    <span>مخصصة لعمولة يوم: <span className="font-mono text-amber-950 font-black">{commTargetDate}</span></span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { 
                      setCommTargetDate(''); 
                      setCommNote('صرف عمولة مستحقة'); 
                    }}
                    className="text-[10px] text-amber-800 hover:text-amber-950 underline cursor-pointer"
                  >
                    إلغاء التخصيص ليوم محدد
                  </button>
                </div>
              )}
              {selectedCommEmp && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-slate-500 font-bold">إجمالي المستحق</p>
                    <p className="font-mono font-black text-slate-800 mt-0.5">{Number(commStats.earnedCommissions || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-slate-500 font-bold">المصروف سابقاً</p>
                    <p className="font-mono font-black text-rose-600 mt-0.5">{Number(commStats.paidCommissions || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-slate-500 font-bold">المتبقي للصرف</p>
                    <p className="font-mono font-black text-emerald-700 mt-0.5">{Number(commStats.unpaidCommissions || 0).toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Amount to pay */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">المبلغ المراد صرفه ({settings.currency}) *</label>
                  {Number(commStats.unpaidCommissions || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setCommAmount(commStats.unpaidCommissions)}
                      className="text-[10px] font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                    >
                      صرف كامل المتبقي ({Number(commStats.unpaidCommissions || 0).toFixed(2)})
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
                    {settings.treasuries.map(t => {
                      const bal = treasuryBalances[t.id] ?? 0;
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} (رصيد: {Number(bal || 0).toFixed(2)} {settings.currency})
                        </option>
                      );
                    })}
                  </select>
                  {commTreasuryId && (
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">الرصيد المتاح في الخزينة:</span>
                      <span className={`font-mono font-black ${(treasuryBalances[commTreasuryId] ?? 0) > 0 ? 'text-emerald-700' : (treasuryBalances[commTreasuryId] ?? 0) < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                        {Number(treasuryBalances[commTreasuryId] || 0).toFixed(2)} {settings.currency}
                      </span>
                    </div>
                  )}
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
                  <span>{isSavingCommissionPayout ? 'جارٍ الصرف...' : 'تأكيد وصرف العمولة'}</span>
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
                      {emp.name} (كود: {emp.fingerprintCode || emp.id} | راتب: {Number(emp.baseSalary || 0).toFixed(2)} {settings.currency})
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
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>مدفوعة الأجر (براتب)</span>
                    </span>
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
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>بدون أجر (بدون راتب)</span>
                    </span>
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
                      {((Number(selectedLeaveEmp.baseSalary || 0)) / 30).toFixed(2)} {settings.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>الأثر المالي المتوقع في التايم شيت:</span>
                    <span className={`font-mono font-bold ${leaveType === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {leaveType === 'paid' 
                        ? `+${(((Number(selectedLeaveEmp.baseSalary || 0)) / 30) * leaveDaysCount).toFixed(2)} ${settings.currency} (مدفوع)`
                        : `0.00 ${settings.currency} (غير مدفوع مع إعفاء من جزاء الغياب)`
                      }
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    {leaveType === 'paid' 
                      ? 'سيتم إدراج الأيام في التايم شيت بحالة "إجازة براتب"، ولا يتم تطبيق أي خصومات غياب أو تأخير عليها.'
                      : 'سيتم إدراج الأيام في التايم شيت بحالة "إجازة بدون راتب"، ولا يتم احتساب راتب ولا جزاء غياب (الصافي = 0).'
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
                  <span>{isSavingLeave ? 'جارٍ الحفظ...' : 'تأكيد واعتماد الإجازة'}</span>
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
                      <p className="text-xs mt-1">يمكنك إضافة إجازة جديدة بالضغط على زر "تسجيل إجازة"</p>
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

                      {canManageLeaves && (
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
                      )}
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

      {/* Permission Registration Modal (تسجيل استئذان خروج مؤقت) */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <Timer size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">تسجيل إذن خروج مؤقت</h3>
                  <p className="text-xs text-slate-500">توثيق ساعات الاستئذان واحتساب الخصم في التايم شيت تلقائياً</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePermission} className="space-y-4">
              {/* Target Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموظف *</label>
                <select
                  value={permEmpId}
                  onChange={e => setPermEmpId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-600"
                  required
                >
                  <option value="">-- اختر الموظف --</option>
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} (كود: {emp.fingerprintCode || emp.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Monthly Balance Indicator */}
              {selectedPermEmp && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-600" />
                    <span className="font-bold text-indigo-950">رصيد الأذونات المتاح لهذا الشهر:</span>
                  </div>
                  <span className={`font-mono font-black px-2.5 py-1 rounded-xl border text-xs ${
                    permEmpRemainingBalance > 0 ? 'bg-white text-indigo-700 border-indigo-200' : 'bg-rose-100 text-rose-700 border-rose-300'
                  }`}>
                    {permEmpRemainingBalance} دقيقة ({(Number(permEmpRemainingBalance || 0) / 60).toFixed(1)} ساعة)
                  </span>
                </div>
              )}

              {/* Permission Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الإذن / المأمورية *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPermType('shift_start');
                      setPermStartTime('09:00');
                      setPermEndTime('11:00');
                    }}
                    className={`p-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 text-center border ${
                      permType === 'shift_start'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Sun size={14} className="mb-0.5 opacity-90" />
                    <span>بداية الدوام</span>
                    <span className="text-[10px] font-normal opacity-90">تأخير مصرح به</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPermType('mid_shift');
                      setPermStartTime('13:00');
                      setPermEndTime('15:00');
                    }}
                    className={`p-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 text-center border ${
                      permType === 'mid_shift'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Clock size={14} className="mb-0.5 opacity-90" />
                    <span>وسط الدوام</span>
                    <span className="text-[10px] font-normal opacity-90">خروج وعودة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPermType('official_mission');
                      setPermIsExcused(true);
                      setPermReason('مأمورية عمل رسمية خارجية');
                    }}
                    className={`p-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 text-center border ${
                      permType === 'official_mission'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Briefcase size={14} className="mb-0.5 opacity-90" />
                    <span>مأمورية رسمية</span>
                    <span className="text-[10px] font-normal opacity-90">معفاة من الخصم</span>
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الإذن *</label>
                <input
                  type="date"
                  value={permDate}
                  onChange={e => setPermDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-600"
                  required
                />
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وقت البدء (من) *</label>
                  <input
                    type="time"
                    value={permStartTime}
                    onChange={e => setPermStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وقت العودة (إلى) *</label>
                  <input
                    type="time"
                    value={permEndTime}
                    onChange={e => setPermEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-600"
                    required
                  />
                </div>
              </div>

              {/* Calculated Duration Badge & Warnings */}
              <div className="space-y-2">
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-teal-600" />
                    <span className="text-xs font-bold text-teal-950">مدة الإذن المحسوبة:</span>
                  </div>
                  <span className="text-sm font-black font-mono text-teal-700 bg-white px-3 py-1 rounded-xl border border-teal-100 shadow-2xs">
                    {permDurationMinutes} دقيقة ({(Number(permDurationMinutes || 0) / 60).toFixed(1)} ساعة)
                  </span>
                </div>

                {/* Case 6: Warning if duration exceeds 4 hours (240 min) */}
                {permDurationMinutes > 240 && permType !== 'official_mission' && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold flex items-start gap-2">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <span>تنبيه لائحي (تجاوز 4 ساعات): تجاوز مدة الاستئذان 4 ساعات في اليوم يترتب عليه برمجياً تحويل اليوم إلى إجازة اعتيادية أو غياب كامل وفقاً للائحة العمل.</span>
                  </div>
                )}

                {/* Case 7: Note for official mission */}
                {permType === 'official_mission' && (
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-[11px] font-bold flex items-start gap-2">
                    <Briefcase size={16} className="text-purple-600 shrink-0 mt-0.5" />
                    <span>مأمورية عمل رسمية: لن يتم خصم أي دقائق من رصيد الأذونات، ويُعتبر اليوم دواماً كاملاً مدفوع الأجر في قسيمة الراتب.</span>
                  </div>
                )}
              </div>

              {/* Excused / Unexcused Option */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة الإذن والمسامحة المالية *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPermIsExcused(true)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
                      permIsExcused
                        ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-600 ring-offset-1'
                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-300"></span>
                      <span>مقبول ومستثنى (بدون خصم)</span>
                    </span>
                    <span className="text-[10px] font-normal opacity-90">لا يتم خصم أي مبلغ من الراتب</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPermIsExcused(false)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
                      !permIsExcused
                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-600 ring-offset-1'
                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>غير مستثنى (خاضع للخصم)</span>
                    </span>
                    <span className="text-[10px] font-normal opacity-90">يخصم أجر الدقائق الزائدة</span>
                  </button>
                </div>
              </div>

              {/* Reason / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السبب / الملاحظات</label>
                <input
                  type="text"
                  value={permReason}
                  onChange={e => setPermReason(e.target.value)}
                  placeholder="مثال: مراجعة مستشفى / ظرف عائلي طارئ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-600"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPermissionModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingPermission}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-teal-600 hover:bg-teal-700 flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Timer size={14} />
                  <span>{isSavingPermission ? 'جارٍ الحفظ...' : 'تأكيد واعتماد الإذن'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions History & Cancellation Modal (سجل الاستئذانات) */}
      {showPermissionsListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <DoorOpen size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">سجل أذونات واستئذانات الموظفين</h3>
                  <p className="text-xs text-slate-500">عرض جميع الاستئذانات المسجلة مع إمكانية الحذف والإلغاء</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPermissionsListModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {(() => {
                const allPermissions: { emp: Employee; perm: EmployeePermissionRecord }[] = [];
                employees.forEach(e => {
                  (e.permissionRecords || []).forEach(p => {
                    allPermissions.push({ emp: e, perm: p });
                  });
                });

                if (allPermissions.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400">
                      <DoorOpen size={48} className="mx-auto mb-2 opacity-30" />
                      <p className="font-bold text-sm">لا توجد أي أذونات استئذان مسجلة حالياً</p>
                      <p className="text-xs mt-1">يمكنك إضافة إذن جديد بالضغط على زر "تسجيل استئذان"</p>
                    </div>
                  );
                }

                // Sort newest date first
                allPermissions.sort((a, b) => b.perm.date.localeCompare(a.perm.date));

                return allPermissions.map(({ emp, perm }) => (
                  <div
                    key={perm.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{emp.name}</span>
                        <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          كود: {emp.fingerprintCode || emp.id}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          perm.type === 'official_mission' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          perm.type === 'shift_start' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                          'bg-sky-100 text-sky-800 border border-sky-200'
                        }`}>
                          {perm.type === 'official_mission' ? 'مأمورية رسمية' : perm.type === 'shift_start' ? 'بداية الدوام' : 'وسط الدوام'}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          perm.isExcused ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {perm.isExcused ? 'مستثنى ومقبول' : 'خاضع للخصم'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                        <span className="font-bold">التاريخ:</span>
                        <span className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {perm.date}
                        </span>
                        <span className="font-bold">الوقت:</span>
                        <span className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {perm.startTime} إلى {perm.endTime}
                        </span>
                        <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                          ({perm.durationMinutes} دقيقة)
                        </span>
                      </div>

                      {perm.reason && (
                        <div className="text-[11px] text-slate-500">
                          <span className="font-semibold">السبب:</span> {perm.reason}
                        </div>
                      )}
                    </div>

                    {canManagePermissions && (
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleDeletePermission(emp.id, perm.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>حذف الإذن</span>
                        </button>
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-3">
              <button
                type="button"
                onClick={() => {
                  setShowPermissionsListModal(false);
                  handleOpenPermissionModal();
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>إضافة إذن جديد</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPermissionsListModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Deductions & Permissions Audit Modal (لوحة تدقيق ومراجعة الاستقطاعات والمسير) */}
      {showPayrollAuditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-5xl w-full shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">لوحة تدقيق ومراجعة الاستقطاعات ومسير الرواتب</h3>
                  <p className="text-xs text-slate-500">فحص وتدقيق استقطاعات الأذونات، التأخيرات، الغياب، والإنذارات الإدارية قبل اعتماد وإغلاق المسير</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayrollAuditModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold text-slate-500">ساعات الأذونات</p>
                <p className="text-base font-black text-teal-700 font-mono mt-0.5">
                  {(Number(totals.permissionMinutesSum || 0) / 60).toFixed(1)} س ({totals.permissionMinutesSum} د)
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold text-slate-500">خصم الأذونات (بدون رصيد)</p>
                <p className="text-base font-black text-rose-600 font-mono mt-0.5">
                  {Number(totals.permissionDeductionSum || 0).toFixed(2)} {settings.currency}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold text-slate-500">خصم التأخيرات</p>
                <p className="text-base font-black text-rose-600 font-mono mt-0.5">
                  {Number(totals.delayDeductionSum || 0).toFixed(2)} {settings.currency}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold text-slate-500">خصم الغياب</p>
                <p className="text-base font-black text-rose-700 font-mono mt-0.5">
                  {Number(totals.absenceDeductionSum || 0).toFixed(2)} {settings.currency}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold text-slate-500">صافي المسير المستحق</p>
                <p className="text-base font-black text-emerald-700 font-mono mt-0.5">
                  {Number(totals.netSum || 0).toFixed(2)} {settings.currency}
                </p>
              </div>
            </div>

            {/* Audit Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="bg-slate-800 text-white font-black sticky top-0">
                  <tr>
                    <th className="p-2.5 border-l border-slate-700">الموظف</th>
                    <th className="p-2.5 border-l border-slate-700">الراتب الأساسي</th>
                    <th className="p-2.5 border-l border-slate-700">أيام الحضور</th>
                    <th className="p-2.5 border-l border-slate-700">دقائق الإذن</th>
                    <th className="p-2.5 border-l border-slate-700">خصم الإذن</th>
                    <th className="p-2.5 border-l border-slate-700">خصم التأخير</th>
                    <th className="p-2.5 border-l border-slate-700">خصم الغياب</th>
                    <th className="p-2.5 border-l border-slate-700">إنذارات وجزاءات</th>
                    <th className="p-2.5">الصافي المستحق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeEmployees.map(emp => {
                    const empRows = timesheetRows.filter(r => r.employee.id === emp.id);
                    const presentCount = empRows.filter(r => r.status === 'regular' || r.status === 'mission').length;
                    const permMins = empRows.reduce((sum, r) => sum + r.permissionMinutes, 0);
                    const permDed = empRows.reduce((sum, r) => sum + r.permissionDeduction, 0);
                    const delayDed = empRows.reduce((sum, r) => sum + r.delayDeduction, 0);
                    const absenceDed = empRows.reduce((sum, r) => sum + r.absenceDeduction, 0);
                    const warningsCount = empRows.filter(r => r.administrativeAction === 'warning').length;
                    const netEmp = empRows.reduce((sum, r) => sum + r.netDaily, 0);

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors font-medium">
                        <td className="p-2 border-l border-slate-200 text-right pr-3 font-bold text-slate-900">
                          {emp.name}
                        </td>
                        <td className="p-2 border-l border-slate-200 font-mono">
                          {Number(emp.baseSalary || 0).toFixed(2)}
                        </td>
                        <td className="p-2 border-l border-slate-200 font-bold text-emerald-700">
                          {presentCount} يوم
                        </td>
                        <td className="p-2 border-l border-slate-200 font-mono text-teal-700">
                          {permMins} د
                        </td>
                        <td className={`p-2 border-l border-slate-200 font-mono font-bold ${Number(permDed || 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {Number(permDed || 0) > 0 ? `-${Number(permDed || 0).toFixed(2)}` : '-'}
                        </td>
                        <td className={`p-2 border-l border-slate-200 font-mono font-bold ${Number(delayDed || 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {Number(delayDed || 0) > 0 ? `-${Number(delayDed || 0).toFixed(2)}` : '-'}
                        </td>
                        <td className={`p-2 border-l border-slate-200 font-mono font-bold ${Number(absenceDed || 0) > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                          {Number(absenceDed || 0) > 0 ? `-${Number(absenceDed || 0).toFixed(2)}` : '-'}
                        </td>
                        <td className="p-2 border-l border-slate-200">
                          {warningsCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                              {warningsCount} إنذار
                            </span>
                          ) : (
                            <span className="text-emerald-600 text-xs">لا يوجد</span>
                          )}
                        </td>
                        <td className="p-2 font-mono font-black text-indigo-700 bg-indigo-50/40">
                          {Number(netEmp || 0).toFixed(2)} {settings.currency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-3">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Printer size={14} />
                <span>طباعة تقرير التدقيق</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPayrollAuditModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال استيراد البصمة والتايم شيت من إكسل */}
      <BiometricImportModal
        isOpen={showBiometricModal}
        onClose={() => setShowBiometricModal(false)}
        settings={settings}
        fingerprintLogs={effectiveFingerprintLogs}
        setFingerprintLogs={(newLogsOrFn) => {
          if (typeof newLogsOrFn === 'function') {
            setLocalLogs(prev => {
              const updated = newLogsOrFn(prev);
              if (setFingerprintLogs) setFingerprintLogs(updated);
              return updated;
            });
          } else {
            setLocalLogs(newLogsOrFn);
            if (setFingerprintLogs) setFingerprintLogs(newLogsOrFn);
          }
        }}
        employees={employees}
      />

    </div>
  );
}


