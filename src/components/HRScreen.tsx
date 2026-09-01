import React, { useState, useMemo } from 'react';
import { AppSettings, Employee, Invoice, Transaction, Booking, ServiceItem, Product, HRSettings, FingerprintLog, SalaryHistoryEntry } from '../types';
import { 
  Calendar, Clock, CheckCircle, AlertTriangle, Printer, User, Filter, 
  RotateCcw, Sparkles, Plus, CheckSquare, Square, FileText, Ban, ShieldAlert,
  ChevronLeft, ChevronRight, Download, DollarSign, Award, ArrowUpRight, Check, X, Wallet,
  Edit, Trash2, TrendingUp, History, Percent
} from 'lucide-react';

import { ThermalSalarySlip, SalarySlipSummary } from './ThermalSalarySlip';
import { printHtml } from '../utils/print';
import { printThermalFinancialVoucher } from './ThermalFinancialVoucher';
import { calculateEmployeeCommission, getCommissionModelLabel } from '../utils/commissionHelper';
import { DB } from '../services/db';

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

  // Salary History Viewer Modal State
  const [showSalaryHistoryModal, setShowSalaryHistoryModal] = useState(false);
  const [historyEmpFilter, setHistoryEmpFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

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
    maxPermissionHours: 2,
    weeklyOffPaid: true
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

        dayInvoices.forEach(inv => {
          inv.items?.forEach(item => {
            if (item.employeeId === emp.id) {
              const itemTotal = (item.price || 0) * (item.quantity || 1);
              workRevenue += itemTotal;
            }
          });
        });

        const commissionAmount = (emp.salaryType === 'commission_only' || emp.allowDualCommission || emp.commissionRate > 0 || emp.commissionModel === 'tiered_brackets')
          ? calculateEmployeeCommission(emp, workRevenue)
          : 0;

        // 5. Financial records (Advances, Bonuses, Penalties, Direct Service/Referral Commissions)
        let advances = 0;
        let bonuses = 0;
        let specialPenalty = 0;
        let directCommissions = 0;

        emp.financialRecords?.filter(r => r.date?.startsWith(dateStr)).forEach(r => {
          if (r.type === 'advance') advances += (r.amount || 0);
          if (r.type === 'bonus') bonuses += (r.amount || 0);
          if (r.type === 'penalty_cash') specialPenalty += (r.amount || 0);
          if (r.type === 'penalty_days') specialPenalty += (r.days || 0) * baseDailyRate;
          if (r.type === 'commission' || r.type === 'referral_commission') directCommissions += (r.amount || 0);
        });

        const totalDailyCommission = commissionAmount + directCommissions;

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
        const dayLogs = (fingerprintLogs || []).filter(l => 
          (l.employeeId === emp.id || (emp.fingerprintCode && l.fingerprintCode === emp.fingerprintCode)) &&
          (l.timestamp && l.timestamp.startsWith(dateStr))
        ).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));


        const checkInLog = dayLogs.find(l => l.type === 'check_in') || dayLogs[0];
        const checkOutLog = dayLogs.filter(l => l.type === 'check_out').pop() || (dayLogs.length > 1 ? dayLogs[dayLogs.length - 1] : null);

        const hasManualOrDeviceLog = Boolean(checkInLog);
        const isTodayOrPast = rowDate <= now;
        const hasWork = workRevenue > 0;

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
            absenceDeduction = dailyRate;
          }
        } else if (isWeeklyOff && !hasManualOrDeviceLog && !hasWork) {
          status = 'weekly_off';
          statusLabel = 'عطلة أسبوعية';
          if (!hrConfig.weeklyOffPaid) {
            absenceDeduction = dailyRate;
          }
        } else if (hasManualOrDeviceLog || hasWork) {
          // Present via fingerprint or registered work
          status = 'regular';
          statusLabel = 'حضور';

          const inTimeStr = checkInLog 
            ? (checkInLog.timestamp.includes('T') ? checkInLog.timestamp.split('T')[1].substring(0, 5) : checkInLog.timestamp.split(' ')[1]?.substring(0, 5) || '09:00')
            : scheduledCheckIn;
          
          checkIn = `${inTimeStr}:00`;

          const outTimeStr = checkOutLog && checkOutLog !== checkInLog
            ? (checkOutLog.timestamp.includes('T') ? checkOutLog.timestamp.split('T')[1].substring(0, 5) : checkOutLog.timestamp.split(' ')[1]?.substring(0, 5))
            : (hasManualOrDeviceLog && checkInLog.type === 'check_out' ? inTimeStr : null);

          if (outTimeStr) {
            checkOut = `${outTimeStr}:00`;
          }

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
                absenceDeduction = dailyRate;
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
          const totalSchedOutMin = schedOutParts[0] * 60 + (schedOutParts[1] || 0);

          if (outTimeStr) {
            const outParts = outTimeStr.split(':').map(Number);
            const actualOutMin = outParts[0] * 60 + (outParts[1] || 0);
            const durationMin = Math.max(0, actualOutMin - actualInMin);
            const wH = Math.floor(durationMin / 60);
            const wM = durationMin % 60;
            workedHoursFormatted = `${String(wH).padStart(2, '0')}:${String(wM).padStart(2, '0')}:00`;

            if (actualOutMin > totalSchedOutMin) {
              const rawOt = actualOutMin - totalSchedOutMin;
              const otGrace = hrConfig.overtimeGraceMinutes ?? 30;
              if (rawOt > otGrace) {
                overtimeMinutes = rawOt;
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
          absenceDeduction = dailyRate;
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
        if (status === 'absent' || status === 'unpaid_leave' || status === 'terminated') {
          earnedDaily = 0;
        }

        const netDaily = isTerminated ? 0 : (
          earnedDaily + 
          overtimeAmount + 
          bonuses + 
          totalDailyCommission - 
          delayDeduction - 
          permissionDeduction -
          specialPenalty - 
          advances - 
          absenceDeduction
        );

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
          isDelayForgiven,
          netDaily
        });
      });
    });


    return rows;
  }, [activeEmployees, selectedEmpId, viewMode, dateRangeList, selectedMonth, overrides, invoices, hrConfig]);

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

    const earnedBaseSalary = empRows
      .filter(r => r.status === 'regular' || r.status === 'paid_leave' || (r.status === 'weekly_off' && hrConfig.weeklyOffPaid))
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
      permissionDeduction: 0,
      advancesDeduction: empRows.reduce((sum, r) => sum + r.advances, 0),
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

  const handlePrintRowVoucher = (row: DayTimesheetRow, type: 'advance' | 'penalty' | 'bonus', amount: number) => {
    printThermalFinancialVoucher(settings, {
      voucherType: type,
      voucherNumber: `${type.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      date: `${row.dateStr} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
      employeeName: row.employeeName,
      employeeCode: row.fingerprintCode || row.employee.id,
      employeeRole: row.employee.role,
      amount,
      note: type === 'advance' ? 'سلفة نقدية مسجلة بالتايم شيت' : type === 'penalty' ? 'خصم وجزاء مسجل بالتايم شيت' : 'مكافأة مسجلة بالتايم شيت',
      issuedBy: currentUser?.name || 'مدير النظام'
    });
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceForm.empId || !attendanceForm.date) return;

    const targetEmp = employees.find(e => e.id === attendanceForm.empId);
    if (!targetEmp) return;

    const dateStr = attendanceForm.date;
    const inTimestamp = `${dateStr}T${attendanceForm.checkIn || '09:00'}:00`;
    const outTimestamp = attendanceForm.checkOut ? `${dateStr}T${attendanceForm.checkOut}:00` : undefined;

    // Existing logs for this employee and date
    const existingLogs = (fingerprintLogs || []).filter(l => 
      (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && l.fingerprintCode === targetEmp.fingerprintCode)) &&
      (l.timestamp && l.timestamp.startsWith(dateStr))
    );

    const checkInId = existingLogs.find(l => l.type === 'check_in')?.id || DB.generateUUID();
    const checkOutId = existingLogs.find(l => l.type === 'check_out')?.id || DB.generateUUID();

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
        notes: attendanceForm.notes || 'تسجيل يدوي / تعديل من TimeSheet'
      };
      newLogsToSave.push(outLog);
    }

    // Update in Supabase
    for (const log of newLogsToSave) {
      await DB.saveFingerprintLog(log);
    }

    // Update state
    if (setFingerprintLogs) {
      setFingerprintLogs((prev: FingerprintLog[]) => {
        const otherLogs = (prev || []).filter(l => !existingLogs.some(el => el.id === l.id));
        return [...otherLogs, ...newLogsToSave];
      });
    }

    setShowAttendanceModal(false);
  };

  const handleDeleteAttendance = async (empId: string, dateStr: string) => {
    if (!confirm('هل أنت متأكد من حذف تسجيل الحضور والانصراف لهذا اليوم وتعيينه كغياب؟')) return;
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    const logsToDelete = (fingerprintLogs || []).filter(l => 
      (l.employeeId === targetEmp.id || (targetEmp.fingerprintCode && l.fingerprintCode === targetEmp.fingerprintCode)) &&
      (l.timestamp && l.timestamp.startsWith(dateStr))
    );

    for (const l of logsToDelete) {
      await DB.deleteFingerprintLog(l.id);
    }

    if (setFingerprintLogs) {
      setFingerprintLogs((prev: FingerprintLog[]) => prev.filter(l => !logsToDelete.some(dl => dl.id === l.id)));
    }

    setShowAttendanceModal(false);
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
      const earnedBaseSalary = empRows
        .filter(r => r.status === 'regular' || r.status === 'paid_leave' || (r.status === 'weekly_off' && hrConfig.weeklyOffPaid))
        .reduce((sum, r) => sum + r.dailyRate, 0);
      const presentDaysCount = empRows.filter(r => r.status === 'regular').length;
      const totalWorkRevenue = empRows.reduce((sum, r) => sum + r.workRevenue, 0);
      const totalCommissions = empRows.reduce((sum, r) => sum + r.commissionAmount, 0);
      const totalBonuses = empRows.reduce((sum, r) => sum + r.bonuses, 0);
      const totalAdvances = empRows.reduce((sum, r) => sum + r.advances, 0);
      const totalPenalties = empRows.reduce((sum, r) => sum + r.specialPenalty, 0);
      const totalOvertimeAmount = empRows.reduce((sum, r) => sum + r.overtimeAmount, 0);
      const totalDelaysDeduction = empRows.reduce((sum, r) => sum + r.delayDeduction, 0);
      const totalAbsenceDeduction = empRows.reduce((sum, r) => sum + r.absenceDeduction, 0);
      const totalPermissionDeduction = empRows.reduce((sum, r) => sum + (r.permissionDeduction || 0), 0);

      const totalDeductions = totalAdvances + totalPenalties + totalDelaysDeduction + totalAbsenceDeduction + totalPermissionDeduction;
      const netPayable = Math.max(0, earnedBaseSalary + totalCommissions + totalBonuses + totalOvertimeAmount - totalDeductions);

      return {
        emp,
        presentDaysCount,
        earnedBaseSalary,
        totalWorkRevenue,
        totalCommissions,
        totalBonuses,
        totalAdvances,
        totalPenalties,
        totalOvertimeAmount,
        totalDeductions,
        netPayable
      };
    });
  }, [activeEmployees, dateRangeList, invoices, overrides, hrConfig, selectedMonth]);

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
              <h2 className="text-xl font-black text-slate-900">سجل الدوام والتايم شيت (Timesheet & Payroll)</h2>
              <p className="text-xs text-slate-500 mt-0.5">متابعة الحضور والانصراف بالبصمة، التأخيرات، الأوفرتايم، والرواتب</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
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
                            setAttendanceForm({
                              empId: row.employee.id,
                              date: row.dateStr,
                              checkIn: row.checkIn ? row.checkIn.substring(0, 5) : '09:00',
                              checkOut: row.checkOut ? row.checkOut.substring(0, 5) : '18:00',
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
                            {row.checkOut}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">--:--:--</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAttendanceForm({
                              empId: row.employee.id,
                              date: row.dateStr,
                              checkIn: row.checkIn ? row.checkIn.substring(0, 5) : '09:00',
                              checkOut: row.checkOut ? row.checkOut.substring(0, 5) : '18:00',
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
                      {t.name} (رصيد: {t.balance?.toFixed(2) || '0.00'} {settings.currency})
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
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">تسجيل / تعديل وقت الحضور والانصراف</h3>
                  <p className="text-[11px] text-slate-500">حفظ فوري في قاعدة البيانات لتحديث التايم شيت ومسير الرواتب</p>
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
                      {emp.name} ({emp.fingerprintCode || emp.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  التاريخ *
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
              <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100">
                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1 flex items-center gap-1">
                    <Clock size={13} className="text-emerald-600" />
                    <span>وقت الحضور *</span>
                  </label>
                  <input
                    type="time"
                    value={attendanceForm.checkIn}
                    onChange={e => setAttendanceForm({ ...attendanceForm, checkIn: e.target.value })}
                    required
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-600 outline-none shadow-2xs text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1 flex items-center gap-1">
                    <Clock size={13} className="text-slate-500" />
                    <span>وقت الانصراف</span>
                  </label>
                  <input
                    type="time"
                    value={attendanceForm.checkOut}
                    onChange={e => setAttendanceForm({ ...attendanceForm, checkOut: e.target.value })}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-600 outline-none shadow-2xs text-center"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-slate-400 w-full font-bold">خيارات سريعة:</span>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '09:00', checkOut: '18:00' })}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg cursor-pointer"
                >
                  دوام كامل (9:00 - 18:00)
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '10:00', checkOut: '19:00' })}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg cursor-pointer"
                >
                  دوام مسائي (10:00 - 19:00)
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceForm({ ...attendanceForm, checkIn: '09:00', checkOut: '14:00' })}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg cursor-pointer"
                >
                  نصف يوم (9:00 - 14:00)
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات أو سبب التعديل (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: تعديل يدوي بناءً على إذن مسبق / نسيان بصمة"
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
                  className="text-rose-600 hover:bg-rose-50 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="حذف البصمات المسجلة لهذا اليوم واعتباره غياب"
                >
                  <Trash2 size={14} />
                  <span>حذف الحضور (تعيين غياب)</span>
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
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>حفظ الحضور بالداتابيز 💾</span>
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

    </div>
  );
}


