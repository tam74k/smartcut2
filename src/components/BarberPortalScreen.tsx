import React, { useState, useMemo } from 'react';
import { 
  Scissors, Calendar, Clock, DollarSign, Award, CheckCircle2, 
  AlertTriangle, XCircle, TrendingUp, User, Phone, Check, X, 
  RefreshCw, LogOut, ChevronDown, Sparkles, Wallet, PieChart, 
  BarChart3, Activity, Percent, ArrowUpRight, ArrowDownRight, 
  FileText, ShieldCheck, HelpCircle, EyeOff, UserCheck, UserX, 
  Briefcase, Coffee, AlertCircle, Copy, MessageCircle, Building2
} from 'lucide-react';
import { 
  Booking, Invoice, Employee, AppSettings, Branch, AppUser, 
  EmployeeFinancialRecord, EmployeeLeaveRecord 
} from '../types';
import { AuthService } from '../services/auth';

interface BarberPortalScreenProps {
  settings: AppSettings;
  currentUser: AppUser;
  employees: Employee[];
  bookings: Booking[];
  invoices: Invoice[];
  branches: Branch[];
  activeBranchId: string;
  onCompleteBooking?: (bookingId: string) => void;
  onLogout?: () => void;
}

type BarberPeriod = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';

export function BarberPortalScreen({
  settings,
  currentUser,
  employees,
  bookings,
  invoices,
  branches,
  activeBranchId,
  onCompleteBooking,
  onLogout
}: BarberPortalScreenProps) {
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'attendance' | 'financials'>('bookings');
  const [period, setPeriod] = useState<BarberPeriod>('today');
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed'>('all');
  const [selectedAdvance, setSelectedAdvance] = useState<EmployeeFinancialRecord | null>(null);
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);

  // 1. Identify the logged in Employee
  const currentEmployee = useMemo(() => {
    if (currentUser.employeeId) {
      const found = employees.find(e => e.id === currentUser.employeeId);
      if (found) return found;
    }
    // Match by name or fallback to first employee
    const matchName = employees.find(e => e.name.toLowerCase().includes(currentUser.name.toLowerCase()) || currentUser.name.toLowerCase().includes(e.name.toLowerCase()));
    if (matchName) return matchName;
    return employees[0] || {
      id: 'e-default',
      name: currentUser.name || 'فني الكوافير',
      role: 'فني حلاقة ومصفف شعر',
      baseSalary: 3000,
      commissionRate: 15,
      target: 200,
      targetType: 'daily' as const,
      availableVacations: 21,
      fingerprintCode: '101'
    };
  }, [currentUser, employees]);

  const currency = settings.currency || 'SAR';
  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  // 2. Compute Active Date Range
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (period === 'today') {
      return { start: todayStr, end: todayStr, label: 'اليوم' };
    }
    if (period === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];
      return { start: yestStr, end: yestStr, label: 'أمس' };
    }
    if (period === 'this_week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);
      return { start: weekStart.toISOString().split('T')[0], end: todayStr, label: 'آخر 7 أيام' };
    }
    if (period === 'this_month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart.toISOString().split('T')[0], end: todayStr, label: 'هذا الشهر' };
    }
    if (period === 'last_month') {
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { 
        start: prevMonthStart.toISOString().split('T')[0], 
        end: prevMonthEnd.toISOString().split('T')[0], 
        label: 'الشهر الماضي' 
      };
    }
    return { start: customStartDate, end: customEndDate, label: `من ${customStartDate} إلى ${customEndDate}` };
  }, [period, customStartDate, customEndDate]);

  // 3. Filter Bookings scheduled with this Technician
  const myBookings = useMemo(() => {
    return bookings.filter(b => {
      const hasMe = b.services?.some(s => s.technicianId === currentEmployee.id || s.technicianName === currentEmployee.name);
      return hasMe;
    });
  }, [bookings, currentEmployee]);

  const filteredBookings = useMemo(() => {
    return myBookings.filter(b => {
      const inDate = b.date >= dateRange.start && b.date <= dateRange.end;
      if (!inDate) return false;
      if (bookingFilter === 'all') return true;
      return b.status === bookingFilter;
    }).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [myBookings, dateRange, bookingFilter]);

  // Today's Bookings count
  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookingsCount = useMemo(() => {
    return myBookings.filter(b => b.date === todayStr).length;
  }, [myBookings, todayStr]);

  // 4. Performed Services & Commissions (Calculated with CLIENT PRICE STRICTLY HIDDEN)
  const performedServices = useMemo(() => {
    const list: {
      id: string;
      invoiceId: string;
      invoiceNumber?: string;
      date: string;
      time?: string;
      serviceName: string;
      commissionAmount: number;
      clientName?: string;
    }[] = [];

    invoices.forEach(inv => {
      const invDate = inv.date?.split('T')[0] || inv.createdAt?.split('T')[0] || '';
      if (invDate < dateRange.start || invDate > dateRange.end) return;

      inv.items?.forEach((item: any, idx: number) => {
        const isMyService = item.employeeId === currentEmployee.id || 
                            item.employeeName === currentEmployee.name ||
                            item.technicianName === currentEmployee.name;

        if (isMyService) {
          // Calculate commission for this item without exposing base item price
          let comm = item.commission || 0;
          if (!comm && currentEmployee.commissionRate && item.price) {
            comm = Math.round((item.price * (item.quantity || 1) * currentEmployee.commissionRate) / 100);
          }
          list.push({
            id: `${inv.id}-${idx}`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber || inv.id.slice(0, 6),
            date: invDate,
            time: inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'مساءً',
            serviceName: item.serviceName || item.name || 'خدمة صالون',
            commissionAmount: comm,
            clientName: inv.clientName || 'عميل نقدي'
          });
        }
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, currentEmployee, dateRange]);

  // Total Commission Earned in selected period
  const totalPeriodCommission = useMemo(() => {
    return performedServices.reduce((sum, s) => sum + s.commissionAmount, 0);
  }, [performedServices]);

  // All-time Commission Earned
  const allTimeCommissionEarned = useMemo(() => {
    let sum = 0;
    invoices.forEach(inv => {
      inv.items?.forEach((item: any) => {
        if (item.employeeId === currentEmployee.id || item.employeeName === currentEmployee.name || item.technicianName === currentEmployee.name) {
          let comm = item.commission || 0;
          if (!comm && currentEmployee.commissionRate && item.price) {
            comm = (item.price * (item.quantity || 1) * currentEmployee.commissionRate) / 100;
          }
          sum += comm;
        }
      });
    });
    return Math.round(sum);
  }, [invoices, currentEmployee]);

  // Commission Payouts (سجل صرف العمولات) from financial records
  const commissionPayouts = useMemo(() => {
    const records = currentEmployee.financialRecords || [];
    return records.filter(r => r.type === 'commission').sort((a, b) => b.date.localeCompare(a.date));
  }, [currentEmployee]);

  const totalCommissionPaid = useMemo(() => {
    return commissionPayouts.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [commissionPayouts]);

  // Remaining Commission Balance (الرصيد المتبقي للصرف)
  const remainingCommissionBalance = Math.max(0, allTimeCommissionEarned - totalCommissionPaid);

  // 5. Target Calculation (Daily or Monthly based on employee setting)
  const targetInfo = useMemo(() => {
    const isDaily = (currentEmployee.targetType || 'daily') === 'daily';
    const targetAmount = currentEmployee.target || (isDaily ? 300 : 5000);

    let achievedAmount = 0;
    if (isDaily) {
      // Today's commission/sales achieved
      achievedAmount = performedServices
        .filter(s => s.date === todayStr)
        .reduce((sum, s) => sum + s.commissionAmount, 0);
    } else {
      // Current month's achieved
      const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      achievedAmount = invoices.reduce((sum, inv) => {
        const invDate = inv.date?.split('T')[0] || '';
        if (invDate >= currentMonthStart && invDate <= todayStr) {
          inv.items?.forEach((item: any) => {
            if (item.employeeId === currentEmployee.id || item.employeeName === currentEmployee.name) {
              sum += item.commission || (item.price * (currentEmployee.commissionRate || 10)) / 100;
            }
          });
        }
        return sum;
      }, 0);
    }

    const percentage = targetAmount > 0 ? Math.min(100, Math.round((achievedAmount / targetAmount) * 100)) : 0;
    const remaining = Math.max(0, targetAmount - achievedAmount);

    return {
      isDaily,
      targetAmount,
      achievedAmount: Math.round(achievedAmount),
      percentage,
      remaining: Math.round(remaining)
    };
  }, [currentEmployee, performedServices, invoices, todayStr]);

  // 6. Attendance & Timesheet Metrics
  const attendanceStats = useMemo(() => {
    const daysInPeriod = Math.max(1, Math.round((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 3600 * 24)) + 1);
    
    const baseCheckIn = currentEmployee.checkInTime || '09:00';
    const baseCheckOut = currentEmployee.checkOutTime || '21:00';

    const leaves = currentEmployee.leaveRecords || [];
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    leaves.forEach(l => {
      if (l.type === 'paid') paidLeaveDays += 1;
      else if (l.type === 'unpaid') unpaidLeaveDays += 1;
    });

    const penalties = currentEmployee.financialRecords?.filter(r => r.type === 'penalty_days') || [];
    const absentDays = penalties.reduce((acc, p) => acc + (p.days || 0), 0);
    const lateDays = 0;
    const regularDays = Math.max(0, daysInPeriod - lateDays - absentDays - paidLeaveDays - unpaidLeaveDays);
    const totalDelayMinutes = 0;

    return {
      daysInPeriod,
      regularDays,
      lateDays,
      absentDays,
      paidLeaveDays,
      unpaidLeaveDays,
      totalDelayMinutes,
      baseCheckIn,
      baseCheckOut
    };
  }, [currentEmployee, dateRange]);

  // 7. Financials: Advances (السلف), Deductions (الخصومات), Rewards (المكافآت)
  const financialRecordsFiltered = useMemo(() => {
    const records = currentEmployee.financialRecords || [];
    return records.filter(r => {
      return r.date >= dateRange.start && r.date <= dateRange.end;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [currentEmployee, dateRange]);

  const advancesList = useMemo(() => {
    return financialRecordsFiltered.filter(r => r.type === 'advance');
  }, [financialRecordsFiltered]);

  const totalAdvances = useMemo(() => {
    return advancesList.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [advancesList]);

  const deductionsList = useMemo(() => {
    return financialRecordsFiltered.filter(r => r.type === 'penalty_cash' || r.type === 'penalty_days');
  }, [financialRecordsFiltered]);

  const totalDeductions = useMemo(() => {
    return deductionsList.reduce((sum, r) => sum + (r.amount || ((r.days || 0) * (currentEmployee.baseSalary / 30))), 0);
  }, [deductionsList, currentEmployee]);

  const bonusesList = useMemo(() => {
    return financialRecordsFiltered.filter(r => r.type === 'bonus');
  }, [financialRecordsFiltered]);

  const totalBonuses = useMemo(() => {
    return bonusesList.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [bonusesList]);

  // Copy portal link helper
  const handleCopyLink = () => {
    const url = `${window.location.origin}/barber`;
    navigator.clipboard?.writeText(url);
    setShowCopyFeedback(true);
    setTimeout(() => setShowCopyFeedback(false), 2500);
  };

  // Complete Booking Action
  const handleConfirmComplete = (bookingId: string) => {
    if (onCompleteBooking) {
      onCompleteBooking(bookingId);
    }
    setCompletingBookingId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20 select-none" dir="rtl">
      {/* 1. TOP EXECUTIVE BARBER HEADER */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Staff Info */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/30">
              {currentEmployee.name ? currentEmployee.name.charAt(0) : '✂️'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white leading-tight">
                  {currentEmployee.name}
                </h1>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Scissors size={10} />
                  <span>فني كوافير VIP</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                <span>{settings.salonName || 'صالون العناية'}</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">{activeBranch?.name || 'الفرع الرئيسي'}</span>
              </p>
            </div>
          </div>

          {/* Right Controls: Share Link, Branch & Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="hidden sm:flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer"
              title="نسخ رابط صفحة الفني المباشر"
            >
              {showCopyFeedback ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{showCopyFeedback ? 'تم النسخ!' : '🔗 /barber'}</span>
            </button>

            {/* Locked Branch Indicator */}
            <div 
              className="hidden sm:flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 select-none"
              title="الفرع المخصص لحسابك (مقيد لفرعك فقط)"
            >
              <Building2 size={13} className="text-emerald-400" />
              <span>{activeBranch?.name || 'الفرع المخصص'}</span>
              <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.2 rounded font-black flex items-center gap-1">
                <span>🔒 فرعك</span>
              </span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 2. DYNAMIC PERIOD FILTER SELECTOR */}
        <div className="bg-slate-900 border-t border-slate-800/80 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between overflow-x-auto scrollbar-none gap-2">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'this_week', label: 'آخر 7 أيام' },
                { id: 'this_month', label: 'هذا الشهر' },
                { id: 'last_month', label: 'الشهر الماضي' },
                { id: 'custom', label: 'تاريخ مخصص 📅' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setPeriod(item.id as BarberPeriod)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    period === item.id 
                      ? 'bg-gradient-to-r from-indigo-600 to-emerald-600 text-white shadow-md shadow-indigo-600/30' 
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-indigo-400 font-bold hidden sm:flex items-center gap-1 shrink-0">
              <Calendar size={13} />
              <span>{dateRange.label}</span>
            </div>
          </div>

          {/* Custom Date Pickers */}
          {period === 'custom' && (
            <div className="max-w-5xl mx-auto mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">من:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1 outline-none font-bold"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">إلى:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1 outline-none font-bold"
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 pt-4 space-y-4">
        {/* 3. LIVE TARGET ACHIEVED GAUGE (Daily / Monthly) */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            {/* Target Title & Type */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    {targetInfo.isDaily ? '🎯 تارجت اليوم اللحظي (Daily Target)' : '🎯 تارجت الشهر التراكمي (Monthly Target)'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {targetInfo.isDaily ? 'يتجدد تلقائياً مع بداية كل يوم عمل جديد' : 'متابعة من أول الشهر وحتى نهايته'}
                  </p>
                </div>
              </div>
            </div>

            {/* Target Counter Values */}
            <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-2xl">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold">المحقق حالياً</p>
                <p className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                  {targetInfo.achievedAmount} <span className="text-xs font-normal text-slate-400">{currency}</span>
                </p>
              </div>
              <div className="h-7 w-px bg-slate-800"></div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold">المستهدف المطلوب</p>
                <p className="text-base sm:text-lg font-black text-white font-mono">
                  {targetInfo.targetAmount} <span className="text-xs font-normal text-slate-400">{currency}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar & Percentage Gauge */}
          <div className="mt-4 space-y-1.5 relative z-10">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-indigo-300 flex items-center gap-1">
                <Activity size={13} className="text-emerald-400" />
                <span>نسبة التحقيق: <strong>{targetInfo.percentage}%</strong></span>
              </span>
              <span className="text-slate-400 text-[11px]">
                {targetInfo.remaining > 0 ? (
                  <span>متبقي لتحقيق الهدف: <strong className="text-amber-400 font-mono">{targetInfo.remaining} {currency}</strong></span>
                ) : (
                  <span className="text-emerald-400 font-black">🎉 تم تجاوز التارجت بنجاح!</span>
                )}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800 overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  targetInfo.percentage >= 100 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/50' 
                    : targetInfo.percentage >= 60 
                    ? 'bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500' 
                    : 'bg-gradient-to-r from-amber-500 to-indigo-500'
                }`}
                style={{ width: `${targetInfo.percentage}%` }}
              ></div>
            </div>
          </div>
        </section>

        {/* 4. SUMMARY KPI CARDS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* KPI 1: Commission Earned in Period */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400">عمولتي المكتسبة</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign size={14} />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
              {totalPeriodCommission} <span className="text-xs font-normal text-slate-400">{currency}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 truncate">عن: {dateRange.label}</p>
          </div>

          {/* KPI 2: Remaining Unpaid Commission Balance */}
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-indigo-300">رصيد العمولة للصرف</span>
              <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Wallet size={14} />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black text-indigo-400 font-mono">
              {remainingCommissionBalance} <span className="text-xs font-normal text-slate-400">{currency}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 truncate">جاهز للصرف</p>
          </div>

          {/* KPI 3: Services Performed */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400">الخدمات المنفذة</span>
              <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Scissors size={14} />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black text-white font-mono">
              {performedServices.length} <span className="text-xs font-normal text-blue-400">خدمة</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 truncate">خلال الفترة المختارة</p>
          </div>

          {/* KPI 4: Today's Bookings */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400">حجوزات اليوم</span>
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Calendar size={14} />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black text-purple-300 font-mono">
              {todayBookingsCount} <span className="text-xs font-normal text-slate-400">موعد</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 truncate">تاريخ {todayStr}</p>
          </div>
        </section>

        {/* 5. NAVIGATION TABS */}
        <div className="flex items-center bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'bookings', label: '📅 حجوزاتي ومواعيدي', count: filteredBookings.length },
            { id: 'services', label: '✂️ الخدمات والعمولات', count: performedServices.length },
            { id: 'attendance', label: '⏰ سجل الحضور والدوام', count: attendanceStats.daysInPeriod },
            { id: 'financials', label: '💼 السلف والمكافآت والخصومات', count: financialRecordsFiltered.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 to-emerald-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* 6. TAB CONTENT */}

        {/* ==================== TAB 1: BOOKINGS ==================== */}
        {activeTab === 'bookings' && (
          <div className="space-y-3">
            {/* Filter buttons */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'كافة المواعيد' },
                  { id: 'pending', label: 'قيد الانتظار ⏳' },
                  { id: 'confirmed', label: 'مؤكد 🟢' },
                  { id: 'completed', label: 'مكتمل ✓' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setBookingFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                      bookingFilter === f.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                إجمالي المواعيد: <strong className="text-white">{filteredBookings.length}</strong>
              </span>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                <Calendar size={36} className="mx-auto mb-2 text-slate-600 opacity-60" />
                <p className="font-bold text-sm text-slate-300">لا توجد حجوزات مجدولة في هذه الفترة</p>
                <p className="text-xs text-slate-500 mt-1">اختر فترة زمنية أخرى أو انتظر إسناد مواعيد جديدة من الاستقبال</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredBookings.map(b => {
                  const isCompleted = b.status === 'completed';
                  return (
                    <div 
                      key={b.id}
                      className={`bg-slate-900/90 border rounded-3xl p-4 transition-all shadow-lg relative ${
                        isCompleted ? 'border-slate-800/80 opacity-80' : 'border-slate-700/80 hover:border-indigo-500'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-black text-white text-sm flex items-center gap-1.5">
                            <User size={14} className="text-indigo-400" />
                            <span>{b.clientName}</span>
                          </h4>
                          {b.phone && (
                            <a
                              href={`https://wa.me/${b.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-emerald-400 font-mono hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <Phone size={11} />
                              <span dir="ltr">{b.phone}</span>
                            </a>
                          )}
                        </div>

                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                          b.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : b.status === 'confirmed'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {b.status === 'completed' ? '✓ تم تنفيذ الخدمة' : b.status === 'confirmed' ? '🟢 حجز مؤكد' : '⏳ قيد الانتظار'}
                        </span>
                      </div>

                      {/* Booking Time & Date */}
                      <div className="flex items-center gap-3 text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-2xl mb-3 border border-slate-800">
                        <div className="flex items-center gap-1 font-mono">
                          <Calendar size={13} className="text-indigo-400" />
                          <span>{b.date}</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-amber-400 font-bold">
                          <Clock size={13} />
                          <span>{b.time}</span>
                        </div>
                      </div>

                      {/* Services list in booking */}
                      <div className="space-y-1 mb-4">
                        <p className="text-[10px] text-slate-400 font-bold">الخدمات المطلوبة مع الفني:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {b.services?.map((s, idx) => (
                            <span 
                              key={idx}
                              className="bg-indigo-950/80 border border-indigo-800/60 text-indigo-200 text-xs px-2.5 py-1 rounded-xl font-bold flex items-center gap-1"
                            >
                              <Scissors size={11} className="text-indigo-400" />
                              <span>{s.serviceName}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions: Complete Service */}
                      {!isCompleted ? (
                        <button
                          onClick={() => setCompletingBookingId(b.id)}
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 px-4 rounded-2xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <CheckCircle2 size={15} />
                          <span>إنهاء الخدمة وحفظ الإنجاز ✓</span>
                        </button>
                      ) : (
                        <div className="text-center py-1.5 text-xs text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-800/40 rounded-2xl flex items-center justify-center gap-1.5">
                          <Check size={14} />
                          <span>تم إنجاز هذه الخدمة بنجاح</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: SERVICES & COMMISSIONS ==================== */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            {/* Commission Summary & Payout Balance Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 p-4 rounded-3xl border border-indigo-800/60 shadow-lg">
                <p className="text-xs text-indigo-300 font-bold mb-1">إجمالي العمولات المكتسبة (الكل)</p>
                <p className="text-2xl font-black text-white font-mono">{allTimeCommissionEarned} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                <p className="text-[10px] text-slate-400 mt-1">من كافة الخدمات المنفذة</p>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-900 p-4 rounded-3xl border border-slate-800 shadow-lg">
                <p className="text-xs text-slate-400 font-bold mb-1">إجمالي ما تم صرفه واستلامه</p>
                <p className="text-2xl font-black text-emerald-400 font-mono">{totalCommissionPaid} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                <p className="text-[10px] text-slate-400 mt-1">حسب سجلات الصرف المالية</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-950/80 to-slate-900 p-4 rounded-3xl border border-emerald-600/40 shadow-lg">
                <p className="text-xs text-emerald-300 font-bold mb-1">الرصيد المتبقي المستحق للصرف</p>
                <p className="text-2xl font-black text-emerald-400 font-mono">{remainingCommissionBalance} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                <p className="text-[10px] text-emerald-400 font-bold mt-1">جاهز للتسليم 💵</p>
              </div>
            </div>

            {/* Privacy notice banner */}
            <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl p-3 flex items-center justify-between text-xs text-indigo-300 font-semibold">
              <div className="flex items-center gap-2">
                <EyeOff size={15} className="text-indigo-400 shrink-0" />
                <span>عرض الخدمات المنفذة ومبلغ عمولتك المستحق فقط (أسعار الفواتير محجوبة ومحمية بنظام الخصوصية).</span>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md font-bold">VIP Privacy 🛡️</span>
            </div>

            {/* Performed Services Table / Cards */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Scissors size={16} className="text-indigo-400" />
                  <span>سجل الخدمات المنفذة ({performedServices.length})</span>
                </h4>
                <span className="text-xs text-emerald-400 font-bold">
                  إجمالي عمولة الفترة: {totalPeriodCommission} {currency}
                </span>
              </div>

              {performedServices.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  لا توجد خدمات مسجلة في هذه الفترة المختارة
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {performedServices.map((s, idx) => (
                    <div 
                      key={idx}
                      className="bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-extrabold text-white">{s.serviceName}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{s.date}</span>
                            <span>•</span>
                            <span className="text-slate-500">{s.time}</span>
                            <span>•</span>
                            <span className="text-slate-400">{s.clientName}</span>
                          </p>
                        </div>
                      </div>

                      {/* ONLY Commission amount shown! */}
                      <div className="text-left bg-emerald-950/60 border border-emerald-800/50 px-3 py-1.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">عمولتي</span>
                        <span className="font-black text-emerald-400 font-mono text-sm">
                          +{s.commissionAmount} {currency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commission Payouts History (سجل صرف العمولات) */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
              <h4 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Wallet size={16} className="text-emerald-400" />
                <span>سجل صرف واستلام العمولات ({commissionPayouts.length})</span>
              </h4>

              {commissionPayouts.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  لم يتم تسجيل دفعات صرف عمولات سابقة
                </div>
              ) : (
                <div className="space-y-2">
                  {commissionPayouts.map((p, idx) => (
                    <div 
                      key={idx}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <Check size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-white">صرف دفعة عمولة</p>
                          <p className="text-[10px] text-slate-400">{p.date} • {p.note || 'تم الاستلام نقداً'}</p>
                        </div>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        {p.amount} {currency}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: ATTENDANCE & TIMESHEET ==================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* Attendance Counters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-400">أيام الانتظام (بالوقت)</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <UserCheck size={14} />
                  </div>
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono">{attendanceStats.regularDays} <span className="text-xs font-normal text-slate-400">يوم</span></div>
                <p className="text-[10px] text-emerald-400/80 mt-1">حضور في الموعد</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-400">أيام التأخير</span>
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Clock size={14} />
                  </div>
                </div>
                <div className="text-xl font-black text-amber-400 font-mono">{attendanceStats.lateDays} <span className="text-xs font-normal text-slate-400">يوم</span></div>
                <p className="text-[10px] text-amber-400/80 mt-1">تأخير: {attendanceStats.totalDelayMinutes} دقيقة</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-400">أيام الغياب</span>
                  <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <UserX size={14} />
                  </div>
                </div>
                <div className="text-xl font-black text-rose-400 font-mono">{attendanceStats.absentDays} <span className="text-xs font-normal text-slate-400">يوم</span></div>
                <p className="text-[10px] text-rose-400/80 mt-1">بدون إذن مسبق</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-400">الإجازات (براتب / بدون)</span>
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Coffee size={14} />
                  </div>
                </div>
                <div className="text-xl font-black text-blue-400 font-mono">
                  {attendanceStats.paidLeaveDays + attendanceStats.unpaidLeaveDays} <span className="text-xs font-normal text-slate-400">يوم</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  براتب: {attendanceStats.paidLeaveDays} | بدون: {attendanceStats.unpaidLeaveDays}
                </p>
              </div>
            </div>

            {/* Attendance Chart & Shift Times */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Activity size={16} className="text-indigo-400" />
                  <span>سجل مواعيد الوردية وجدول الدوام</span>
                </h4>
                <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                  <span>دخول: <strong className="text-emerald-400">{attendanceStats.baseCheckIn}</strong></span>
                  <span>|</span>
                  <span>خروج: <strong className="text-amber-400">{attendanceStats.baseCheckOut}</strong></span>
                </div>
              </div>

              {/* Visual Distribution Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-300">توزيع نسبة الدوام والانضباط</span>
                  <span className="text-emerald-400">
                    {Math.round((attendanceStats.regularDays / Math.max(1, attendanceStats.daysInPeriod)) * 100)}% انضباط
                  </span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-4 p-0.5 border border-slate-800 flex overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-r-full"
                    style={{ width: `${(attendanceStats.regularDays / attendanceStats.daysInPeriod) * 100}%` }}
                    title="أيام منتظمة"
                  />
                  <div 
                    className="bg-amber-500 h-full"
                    style={{ width: `${(attendanceStats.lateDays / attendanceStats.daysInPeriod) * 100}%` }}
                    title="أيام تأخير"
                  />
                  <div 
                    className="bg-rose-500 h-full"
                    style={{ width: `${(attendanceStats.absentDays / attendanceStats.daysInPeriod) * 100}%` }}
                    title="أيام غياب"
                  />
                  <div 
                    className="bg-blue-500 h-full rounded-l-full"
                    style={{ width: `${((attendanceStats.paidLeaveDays + attendanceStats.unpaidLeaveDays) / attendanceStats.daysInPeriod) * 100}%` }}
                    title="إجازات"
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> منتظم</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> متأخر</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> غائب</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> إجازات</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: ADVANCES, BONUSES & DEDUCTIONS ==================== */}
        {activeTab === 'financials' && (
          <div className="space-y-4">
            {/* Financial Totals Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Advances Total */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg">
                <p className="text-xs text-slate-400 font-bold mb-1">إجمالي السلف المستلمة</p>
                <p className="text-2xl font-black text-amber-400 font-mono">{totalAdvances} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                <p className="text-[10px] text-slate-500 mt-1">خلال الفترة المختارة</p>
              </div>

              {/* Deductions Total */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg">
                <p className="text-xs text-slate-400 font-bold mb-1">الخصومات والجزاءات</p>
                <p className="text-2xl font-black text-rose-400 font-mono">{totalDeductions} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                <p className="text-[10px] text-slate-500 mt-1">تأخيرات أو جزاءات نقدية</p>
              </div>

              {/* Bonuses Total */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg">
                <p className="text-xs text-slate-400 font-bold mb-1">المكافآت والتحفيزات</p>
                <p className="text-2xl font-black text-emerald-400 font-mono">+{totalBonuses} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                <p className="text-[10px] text-emerald-400 font-bold mt-1">حوافز إضافية 🌟</p>
              </div>
            </div>

            {/* Advances Log with Clickable Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Wallet size={16} className="text-amber-400" />
                  <span>سجل السلف النقدية ({advancesList.length})</span>
                </h4>
                <span className="text-xs text-slate-400">انقر على أي سلفة لعرض التفاصيل الكاملة</span>
              </div>

              {advancesList.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  لا توجد سلف مسجلة خلال هذه الفترة
                </div>
              ) : (
                <div className="space-y-2">
                  {advancesList.map(adv => (
                    <div 
                      key={adv.id}
                      onClick={() => setSelectedAdvance(adv)}
                      className="bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all hover:border-amber-500/50 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                          💵
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">سلفة نقدية</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{adv.date} • {adv.note || 'طلب سلفة شخصية'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-amber-400 text-sm">
                          {adv.amount} {currency}
                        </span>
                        <span className="text-xs text-slate-500 group-hover:text-amber-400 group-hover:translate-x-[-2px] transition-all">
                          ‹
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deductions & Bonuses Log */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Deductions */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <ArrowDownRight size={16} className="text-rose-400" />
                  <span>الخصومات والجزاءات ({deductionsList.length})</span>
                </h4>

                {deductionsList.length === 0 ? (
                  <div className="py-4 text-center text-slate-500 text-xs">سجل نظيف، لا توجد خصومات 🌟</div>
                ) : (
                  <div className="space-y-2">
                    {deductionsList.map(d => (
                      <div key={d.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-rose-300">{d.note || 'خصم إداري'}</p>
                          <p className="text-[10px] text-slate-500">{d.date}</p>
                        </div>
                        <span className="font-mono font-black text-rose-400">-{d.amount || 0} {currency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bonuses */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <ArrowUpRight size={16} className="text-emerald-400" />
                  <span>المكافآت والحوافز ({bonusesList.length})</span>
                </h4>

                {bonusesList.length === 0 ? (
                  <div className="py-4 text-center text-slate-500 text-xs">لا توجد مكافآت مسجلة في هذه الفترة</div>
                ) : (
                  <div className="space-y-2">
                    {bonusesList.map(b => (
                      <div key={b.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-emerald-300">{b.note || 'مكافأة تميز'}</p>
                          <p className="text-[10px] text-slate-500">{b.date}</p>
                        </div>
                        <span className="font-mono font-black text-emerald-400">+{b.amount} {currency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: COMPLETE BOOKING CONFIRMATION */}
      {completingBookingId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-white">تأكيد إنهاء الخدمة</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                هل قمت بإنهاء الخدمة للعميل وترغب في تسجيل الإنجاز واحتساب عمولتك على الفور؟
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleConfirmComplete(completingBookingId)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                نعم، إنهاء الخدمة ✓
              </button>
              <button
                onClick={() => setCompletingBookingId(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADVANCE PAYMENT FULL DETAILS */}
      {selectedAdvance && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Wallet size={16} className="text-amber-400" />
                <span>تفاصيل السلفة النقدية</span>
              </h3>
              <button
                onClick={() => setSelectedAdvance(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center">
                <p className="text-slate-400 font-bold text-[10px]">مبلغ السلفة</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">
                  {selectedAdvance.amount} {currency}
                </p>
              </div>

              <div className="space-y-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">تاريخ الاستلام:</span>
                  <span className="text-white font-bold font-mono">{selectedAdvance.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">حالة التسوية:</span>
                  <span className="text-amber-400 font-bold">تُخصم من راتب الشهر</span>
                </div>
                {selectedAdvance.note && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-0.5">ملاحظات وسبب السلفة:</span>
                    <span className="text-slate-200 font-medium">{selectedAdvance.note}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedAdvance(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
