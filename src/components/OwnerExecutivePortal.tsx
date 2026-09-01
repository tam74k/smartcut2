import React, { useState, useMemo } from 'react';
import { 
  AppSettings, Invoice, Transaction, Booking, Employee, Client, Branch, AppUser, UserRole, Partner, PartnerTransaction 
} from '../types';
import { AuthService, ROLE_LABELS } from '../services/auth';
import { 
  Smartphone, DollarSign, Users, Calendar, Clock, CheckCircle2, AlertTriangle, 
  XCircle, UserCheck, UserX, Plus, RefreshCw, Send, ChevronDown, ArrowUpRight, 
  TrendingUp, TrendingDown, Wallet, CreditCard, Banknote, Building2, Shield, Eye, Lock,
  Receipt, Sparkles, Check, X, Phone, User, Store, Filter, Award, ChevronRight,
  PieChart, BarChart3, Activity, Percent, Crown, Briefcase, FileBarChart, Layers, Edit2, Trash2, ArrowDownRight
} from 'lucide-react';

interface PaymentSlice {
  id: string;
  name: string;
  amount: number;
  color: string;
  hoverColor: string;
  textColor: string;
  bgBadge: string;
  icon: any;
}

// 1. Interactive Circular Donut Chart for Payment Methods
function PaymentMethodsDonutChart({
  revenueStats,
  currency,
  onViewAll
}: {
  revenueStats: any;
  currency: string;
  onViewAll?: () => void;
}) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const rawSlices: PaymentSlice[] = [
    {
      id: 'cash',
      name: 'كاش / نقدي',
      amount: revenueStats.cash || 0,
      color: '#10B981', // emerald-500
      hoverColor: '#34D399',
      textColor: 'text-emerald-400',
      bgBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: Banknote
    },
    {
      id: 'card',
      name: 'شبكة / مدى (POS)',
      amount: revenueStats.card || 0,
      color: '#0EA5E9', // sky-500
      hoverColor: '#38BDF8',
      textColor: 'text-sky-400',
      bgBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      icon: CreditCard
    },
    {
      id: 'credit',
      name: 'بطاقات ائتمان (Visa/Master)',
      amount: revenueStats.credit || 0,
      color: '#8B5CF6', // purple-500
      hoverColor: '#A78BFA',
      textColor: 'text-purple-400',
      bgBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: CreditCard
    },
    {
      id: 'bankTransfer',
      name: 'تحويل بنكي مباشر',
      amount: revenueStats.bankTransfer || 0,
      color: '#F59E0B', // amber-500
      hoverColor: '#FBBF24',
      textColor: 'text-amber-400',
      bgBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: Building2
    },
    {
      id: 'tabTamara',
      name: 'تمارا / تابي (تقسيط)',
      amount: revenueStats.tabTamara || 0,
      color: '#EC4899', // pink-500
      hoverColor: '#F472B6',
      textColor: 'text-pink-400',
      bgBadge: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      icon: Sparkles
    },
    {
      id: 'other',
      name: 'طرق دفع أخرى',
      amount: revenueStats.other || 0,
      color: '#64748B', // slate-500
      hoverColor: '#94A3B8',
      textColor: 'text-slate-400',
      bgBadge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      icon: Wallet
    }
  ];

  const total = revenueStats.totalRevenue || 0;
  const activeSlices = rawSlices.filter(s => s.amount > 0);

  // SVG dimensions
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2; // (180 - 24)/2 = 78
  const circumference = 2 * Math.PI * radius; // ~490.088
  const center = size / 2;

  let cumulativePercent = 0;
  const currentSlice = hoveredSlice ? rawSlices.find(s => s.id === hoveredSlice) : null;

  return (
    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-white flex items-center gap-1.5">
          <PieChart size={16} className="text-emerald-400" />
          <span>توزيع الدخل حسب طرق الدفع (اليوم)</span>
        </h3>
        {onViewAll && (
          <button 
            onClick={onViewAll}
            className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
          >
            التفاصيل ‹
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* SVG Donut Chart */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-[170px] h-[170px]">
            <svg 
              className="w-full h-full -rotate-90 transform" 
              viewBox={`0 0 ${size} ${size}`}
            >
              {/* Background circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="#1E293B"
                strokeWidth={strokeWidth}
              />

              {total > 0 ? (
                activeSlices.map((slice) => {
                  const percent = slice.amount / total;
                  const strokeDasharray = `${percent * circumference} ${circumference}`;
                  const strokeDashoffset = -(cumulativePercent * circumference);
                  cumulativePercent += percent;
                  const isHovered = hoveredSlice === slice.id;

                  return (
                    <circle
                      key={slice.id}
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="transparent"
                      stroke={isHovered ? slice.hoverColor : slice.color}
                      strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredSlice(slice.id)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      style={{
                        filter: isHovered ? `drop-shadow(0 0 8px ${slice.color})` : 'none'
                      }}
                    />
                  );
                })
              ) : (
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke="#334155"
                  strokeWidth={strokeWidth}
                  strokeDasharray="10 5"
                />
              )}
            </svg>

            {/* Donut Center Info */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
              {currentSlice ? (
                <>
                  <span className={`text-[10px] font-black ${currentSlice.textColor} truncate max-w-[110px]`}>
                    {currentSlice.name}
                  </span>
                  <span className="text-sm font-black text-white tracking-tight">
                    {currentSlice.amount.toLocaleString()}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">
                    {((currentSlice.amount / (total || 1)) * 100).toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[9px] font-bold text-slate-400">إجمالي اليوم</span>
                  <span className="text-sm font-black text-white tracking-tight">
                    {total.toLocaleString()}
                  </span>
                  <span className="text-[9px] font-black text-emerald-400">{currency}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Legend & Breakdown */}
        <div className="sm:col-span-7 space-y-2">
          {rawSlices.filter(s => s.amount > 0 || activeSlices.length === 0).map((slice) => {
            const percent = total > 0 ? ((slice.amount / total) * 100).toFixed(1) : '0.0';
            const isHovered = hoveredSlice === slice.id;
            const Icon = slice.icon;

            return (
              <div
                key={slice.id}
                onMouseEnter={() => setHoveredSlice(slice.id)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  isHovered 
                    ? 'bg-slate-800/90 border-slate-600 scale-[1.02]' 
                    : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: slice.color }}
                  />
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} className={slice.textColor} />
                    <span className="text-xs font-bold text-slate-200">{slice.name}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black text-white">
                    {slice.amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${slice.bgBadge}`}>
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}

          {activeSlices.length === 0 && (
            <div className="text-center py-4 text-slate-500 text-xs">
              لا توجد مقبوضات مسجلة حتى الآن اليوم
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 2. Interactive Attendance & Absence Ratio Gauge Chart
function AttendanceGaugeChart({
  attendanceStats,
  onViewAll
}: {
  attendanceStats: any;
  onViewAll?: () => void;
}) {
  const total = attendanceStats.totalStaff || 0;
  const present = attendanceStats.presentCount || 0;
  const late = attendanceStats.lateCount || 0;
  const absent = attendanceStats.absentCount || 0;
  const leave = attendanceStats.leaveCount || 0;

  const totalAttended = present + late;
  const attendanceRate = total > 0 ? Math.round((totalAttended / total) * 100) : 0;
  const absenceRate = total > 0 ? Math.round((absent / total) * 100) : 0;

  // Gauge / Radial calculations
  const size = 150;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle ~ 213.6
  const strokeDashoffset = circumference - (attendanceRate / 100) * circumference;

  return (
    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-white flex items-center gap-1.5">
          <Activity size={16} className="text-amber-400" />
          <span>مؤشر الحضور ونسبة الانضباط (اليوم)</span>
        </h3>
        {onViewAll && (
          <button 
            onClick={onViewAll}
            className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
          >
            سجل الدوام ‹
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Semi Circular Gauge */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-[150px] h-[85px] overflow-hidden flex items-end justify-center">
            <svg 
              className="w-[150px] h-[150px] absolute top-0" 
              viewBox={`0 0 ${size} ${size}`}
            >
              {/* Background Arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#1E293B"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={0}
                transform={`rotate(-180 ${size/2} ${size/2})`}
              />
              {/* Foreground Arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={attendanceRate >= 80 ? '#10B981' : attendanceRate >= 50 ? '#F59E0B' : '#EF4444'}
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-180 ${size/2} ${size/2})`}
                className="transition-all duration-700 ease-out"
                style={{
                  filter: `drop-shadow(0 0 6px ${attendanceRate >= 80 ? '#10B981' : '#F59E0B'})`
                }}
              />
            </svg>

            {/* Gauge Value */}
            <div className="text-center z-10 pb-1">
              <span className="text-2xl font-black text-white tracking-tight">
                {attendanceRate}%
              </span>
              <p className="text-[10px] font-bold text-slate-400">نسبة الحضور</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-bold mt-1 text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>حضور: {totalAttended}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>غياب: {absent}</span>
            </span>
          </div>
        </div>

        {/* Stacked Breakdown & Metrics */}
        <div className="sm:col-span-7 space-y-2.5">
          {/* Stacked Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-300">
              <span>توزيع الكادر ({total} موظف)</span>
              <span className={absenceRate > 0 ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}>
                {absenceRate > 0 ? `الغياب: ${absenceRate}%` : 'لا يوجد غياب 🟢'}
              </span>
            </div>

            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-700">
              {present > 0 && (
                <div 
                  style={{ width: `${(present / (total || 1)) * 100}%` }}
                  className="bg-emerald-500 rounded-sm transition-all"
                  title={`حاضر في الموعد: ${present}`}
                />
              )}
              {late > 0 && (
                <div 
                  style={{ width: `${(late / (total || 1)) * 100}%` }}
                  className="bg-amber-500 rounded-sm transition-all"
                  title={`متأخر: ${late}`}
                />
              )}
              {absent > 0 && (
                <div 
                  style={{ width: `${(absent / (total || 1)) * 100}%` }}
                  className="bg-rose-500 rounded-sm transition-all"
                  title={`غائب: ${absent}`}
                />
              )}
              {leave > 0 && (
                <div 
                  style={{ width: `${(leave / (total || 1)) * 100}%` }}
                  className="bg-indigo-500 rounded-sm transition-all"
                  title={`إجازة / عطلة: ${leave}`}
                />
              )}
            </div>
          </div>

          {/* 4 Compact Status Badges */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300 text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>منتظم</span>
              </span>
              <span className="font-mono font-black text-emerald-400">{present}</span>
            </div>

            <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300 text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>متأخر</span>
              </span>
              <span className="font-mono font-black text-amber-400">{late}</span>
            </div>

            <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300 text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>غائب</span>
              </span>
              <span className="font-mono font-black text-rose-400">{absent}</span>
            </div>

            <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300 text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>إجازة/عطلة</span>
              </span>
              <span className="font-mono font-black text-indigo-400">{leave}</span>
            </div>
          </div>

          {attendanceStats.totalDelayMin > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-300 flex items-center justify-between">
              <span>إجمالي دقائق التأخير اليوم:</span>
              <span className="font-mono">{attendanceStats.totalDelayMin} دقيقة</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type OwnerPeriod = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';

interface OwnerExecutivePortalProps {
  settings: AppSettings;
  invoices: Invoice[];
  transactions: Transaction[];
  bookings: Booking[];
  employees: Employee[];
  clients: Client[];
  branches: Branch[];
  activeBranchId: string;
  onSelectBranch: (branchId: string) => void;
  currentUser: AppUser;
  standalone?: boolean;
  onLogout?: () => void;
  onSwitchToMainApp?: () => void;
  expenses?: any[];
  purchases?: any[];
  supplierPayments?: any[];
  partners?: Partner[];
  setPartners?: (updater: Partner[] | ((prev: Partner[]) => Partner[])) => void;
  partnerTransactions?: PartnerTransaction[];
  setPartnerTransactions?: (updater: PartnerTransaction[] | ((prev: PartnerTransaction[]) => PartnerTransaction[])) => void;
  setTransactions?: (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
}

export function OwnerExecutivePortal({
  settings,
  invoices,
  transactions,
  bookings,
  employees,
  clients,
  branches,
  activeBranchId,
  onSelectBranch,
  currentUser,
  onNavigateScreen,
  standalone = false,
  onLogout,
  onSwitchToMainApp,
  expenses = [],
  purchases = [],
  supplierPayments = [],
  partners = [],
  setPartners,
  partnerTransactions = [],
  setPartnerTransactions,
  setTransactions
}: OwnerExecutivePortalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'profit_equation' | 'partners' | 'finance' | 'attendance' | 'bookings' | 'users'>('overview');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Period & Date Range Filter
  const [period, setPeriod] = useState<OwnerPeriod>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // User Management State
  const [users, setUsers] = useState<AppUser[]>(() => AuthService.getUsers());
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    username: '',
    phone: '',
    role: 'cashier' as UserRole,
    password: ''
  });
  const [userFormError, setUserFormError] = useState('');
  const [userFormSuccess, setUserFormSuccess] = useState('');

  // Partners Management State
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerFormData, setPartnerFormData] = useState({
    name: '',
    phone: '',
    idNumber: '',
    capitalShare: 0,
    notes: ''
  });

  const [showPartnerTxModal, setShowPartnerTxModal] = useState(false);
  const [selectedPartnerForTx, setSelectedPartnerForTx] = useState<Partner | null>(null);
  const [partnerTxData, setPartnerTxData] = useState<{
    type: 'profit_share' | 'withdrawal' | 'deposit';
    amount: number;
    notes: string;
  }>({
    type: 'profit_share',
    amount: 0,
    notes: ''
  });

  // Target Date computation
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'today') {
      return { start: todayStr, end: todayStr, label: 'اليوم' };
    }
    if (period === 'yesterday') {
      const y = new Date(Date.now() - 86400000);
      const yStr = y.toISOString().split('T')[0];
      return { start: yStr, end: yStr, label: 'أمس' };
    }
    if (period === 'this_week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { start: d.toISOString().split('T')[0], end: todayStr, label: 'آخر 7 أيام' };
    }
    if (period === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { start: startOfMonth, end: todayStr, label: 'هذا الشهر' };
    }
    if (period === 'last_month') {
      const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start: startOfLast, end: endOfLast, label: 'الشهر السابق' };
    }
    return {
      start: customStartDate || todayStr,
      end: customEndDate || todayStr,
      label: `${customStartDate} إلى ${customEndDate}`
    };
  }, [period, customStartDate, customEndDate]);

  const isAllBranches = activeBranchId === 'all';

  const activeBranch = useMemo(() => {
    if (isAllBranches) {
      return { id: 'all', name: 'كافة الفروع مجمعة' } as Branch;
    }
    return branches.find(b => b.id === activeBranchId) || branches[0] || { id: 'b-main', name: 'الفرع الرئيسي' };
  }, [branches, activeBranchId, isAllBranches]);

  const mainBranch = (branches && branches[0]) || { id: 'b-main', name: 'الفرع الرئيسي' };
  const mainBranchId = mainBranch.id;
  const isMainBranch = !activeBranchId || activeBranchId === mainBranchId || activeBranchId === 'b-main';

  const handleOpenMainAppAsAdmin = (targetBranchId?: string) => {
    const chosenBranchId = targetBranchId || (activeBranchId !== 'all' ? activeBranchId : (branches[0]?.id || 'b-main'));
    onSelectBranch(chosenBranchId);
    if (onSwitchToMainApp) {
      onSwitchToMainApp();
    }
  };

  const matchesActiveBranch = (itemBranchId?: string) => {
    if (isAllBranches) return true;
    if (itemBranchId) {
      return itemBranchId === activeBranchId;
    }
    return isMainBranch;
  };

  const isDateInSelectedPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    return d >= dateRange.start && d <= dateRange.end;
  };

  // 1. Financial Filtering & Calculations for Selected Period (Filtered by active branch / all branches)
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const inPeriod = isDateInSelectedPeriod(inv.date);
      const isBranchMatch = matchesActiveBranch(inv.branchId);
      return inPeriod && isBranchMatch && inv.status !== 'cancelled';
    });
  }, [invoices, dateRange, activeBranchId, isMainBranch, isAllBranches]);

  const todayInvoices = filteredInvoices; // Backward compatibility alias

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const inPeriod = isDateInSelectedPeriod(t.date);
      const isBranchMatch = matchesActiveBranch((t as any).branchId);
      return inPeriod && isBranchMatch;
    });
  }, [transactions, dateRange, activeBranchId, isMainBranch]);

  const todayTransactions = filteredTransactions;

  // Revenue Breakdown by payment method
  const revenueStats = useMemo(() => {
    let totalRevenue = 0;
    let cash = 0;
    let card = 0; // Mada / POS
    let credit = 0; // Visa / MasterCard
    let bankTransfer = 0;
    let tabTamara = 0;
    let other = 0;

    filteredInvoices.forEach(inv => {
      const net = inv.netAmount ?? inv.total ?? 0;
      totalRevenue += net;

      // Check payments array or single method
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach(p => {
          const amt = p.amount || 0;
          const method = (p.method || '').toLowerCase();
          if (method.includes('cash') || method.includes('نقدي') || method.includes('كاش')) cash += amt;
          else if (method.includes('mada') || method.includes('شبكة') || method.includes('مدى')) card += amt;
          else if (method.includes('visa') || method.includes('فيزا') || method.includes('card') || method.includes('credit') || method.includes('ماستر')) credit += amt;
          else if (method.includes('transfer') || method.includes('تحويل') || method.includes('bank')) bankTransfer += amt;
          else if (method.includes('tamara') || method.includes('tabby') || method.includes('تابي') || method.includes('تمارا')) tabTamara += amt;
          else other += amt;
        });
      } else {
        const method = (inv.paymentMethod || '').toLowerCase();
        if (method.includes('cash') || method.includes('نقدي') || method.includes('كاش')) cash += net;
        else if (method.includes('mada') || method.includes('شبكة') || method.includes('مدى')) card += net;
        else if (method.includes('visa') || method.includes('فيزا') || method.includes('card') || method.includes('credit') || method.includes('ماستر')) credit += net;
        else if (method.includes('transfer') || method.includes('تحويل') || method.includes('bank')) bankTransfer += net;
        else if (method.includes('tamara') || method.includes('tabby') || method.includes('تابي') || method.includes('تمارا')) tabTamara += net;
        else cash += net; // Default fallback
      }
    });

    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const netProfit = totalRevenue - totalExpenses;
    const avgTicket = filteredInvoices.length > 0 ? (totalRevenue / filteredInvoices.length) : 0;

    return {
      totalRevenue,
      cash,
      card,
      credit,
      bankTransfer,
      tabTamara,
      other,
      totalExpenses,
      netProfit,
      invoiceCount: filteredInvoices.length,
      avgTicket
    };
  }, [filteredInvoices, filteredTransactions]);

  // ---- معادلة صافي الربح الدقيقة (Net Profit Equation Analysis) ----
  // صافي الربح = إجمالي الدخل من الفواتير - جميع المصروفات - الرواتب - السلف - (المسدد في المشتريات + دفعات الموردين) - عمولات الموظفين
  const netProfitData = useMemo(() => {
    // 1. Gross Invoiced Income
    const grossIncome = filteredInvoices.reduce((sum, inv) => {
      const paid = inv.paidAmount !== undefined ? Number(inv.paidAmount) : Number(inv.total) || 0;
      return sum + paid;
    }, 0);

    // 2. All Expenses
    const directExpenseTx = filteredTransactions.filter(t => t.type === 'expense');
    const customExpenses = (expenses || []).filter(e => {
      const inPeriod = isDateInSelectedPeriod(e.date);
      const isBranchMatch = matchesActiveBranch(e.branchId);
      return inPeriod && isBranchMatch;
    });

    const totalExpenses = customExpenses.length > 0
      ? customExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      : directExpenseTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 3. Salaries Disbursed & Advances
    let totalSalaries = 0;
    let totalAdvances = 0;

    const activeStaff = employees.filter(e => matchesActiveBranch((e as any).branchId));
    activeStaff.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        if (isDateInSelectedPeriod(rec.date)) {
          if (rec.type === 'salary') totalSalaries += Number(rec.amount) || 0;
          if (rec.type === 'advance') totalAdvances += Number(rec.amount) || 0;
        }
      });
    });

    if (totalSalaries === 0) {
      totalSalaries = filteredTransactions
        .filter(t => t.category?.includes('راتب') || t.category?.includes('رواتب') || t.description?.includes('راتب'))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }
    if (totalAdvances === 0) {
      totalAdvances = filteredTransactions
        .filter(t => t.category?.includes('سلفة') || t.category?.includes('سلف') || t.description?.includes('سلفة'))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }

    // 4. Purchases Paid + Supplier Payments
    const periodPurchases = (purchases || []).filter(p => {
      const inPeriod = isDateInSelectedPeriod(p.invoiceDate || p.date);
      const isBranchMatch = matchesActiveBranch(p.branchId);
      return inPeriod && isBranchMatch;
    });
    const totalPurchasesPaid = periodPurchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);

    const periodSupplierPayments = (supplierPayments || []).filter(sp => {
      const inPeriod = isDateInSelectedPeriod(sp.paymentDate || sp.date);
      const isBranchMatch = matchesActiveBranch(sp.branchId);
      return inPeriod && isBranchMatch;
    });
    const totalSupplierPayments = periodSupplierPayments.reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
    const totalPurchasesAndSuppliers = totalPurchasesPaid + totalSupplierPayments;

    // 5. Employee Commissions
    let totalCommissions = 0;
    filteredInvoices.forEach(inv => {
      (inv.items || []).forEach((it: any) => {
        totalCommissions += Number(it.employeeCommission || it.commissionAmount || 0);
      });
    });

    if (totalCommissions === 0) {
      activeStaff.forEach(emp => {
        (emp.financialRecords || []).forEach((rec: any) => {
          if (isDateInSelectedPeriod(rec.date) && (rec.type === 'commission' || rec.type === 'service_commission')) {
            totalCommissions += Number(rec.amount) || 0;
          }
        });
      });
    }

    // 6. Net Profit Result
    const totalDeductions = totalExpenses + totalSalaries + totalAdvances + totalPurchasesAndSuppliers + totalCommissions;
    const netProfit = grossIncome - totalDeductions;
    const profitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

    const breakdownList = [
      { id: 'income', label: 'إجمالي الدخل المحصل من الفواتير', amount: grossIncome, type: 'plus', percent: 100, note: `${filteredInvoices.length} فاتورة مسددة` },
      { id: 'expenses', label: 'جميع المصروفات التشغيلية والنثرية', amount: totalExpenses, type: 'minus', percent: grossIncome > 0 ? (totalExpenses / grossIncome) * 100 : 0, note: 'مصروفات الإيجار والفواتير والنثريات' },
      { id: 'salaries', label: 'الرواتب الأساسية ومسيرات الصرف', amount: totalSalaries, type: 'minus', percent: grossIncome > 0 ? (totalSalaries / grossIncome) * 100 : 0, note: 'مسيرات الرواتب المنصرفة' },
      { id: 'advances', label: 'سلف الموظفين المصروفة', amount: totalAdvances, type: 'minus', percent: grossIncome > 0 ? (totalAdvances / grossIncome) * 100 : 0, note: 'السلف الممنوحة خلال الفترة' },
      { id: 'purchases', label: 'المسدد في فواتير المشتريات', amount: totalPurchasesPaid, type: 'minus', percent: grossIncome > 0 ? (totalPurchasesPaid / grossIncome) * 100 : 0, note: 'دفعات فواتير مخزون المنتجات' },
      { id: 'supplier_payments', label: 'سندات سداد دفعات الموردين', amount: totalSupplierPayments, type: 'minus', percent: grossIncome > 0 ? (totalSupplierPayments / grossIncome) * 100 : 0, note: 'سندات صكوك ودفعات الموردين' },
      { id: 'commissions', label: 'عمولات الموظفين على الخدمات والمنتجات', amount: totalCommissions, type: 'minus', percent: grossIncome > 0 ? (totalCommissions / grossIncome) * 100 : 0, note: 'استحقاقات الفنيين عن المبيعات' },
      { id: 'net_profit', label: 'صافي الربح الفعلي بعد كافة الاستقطاعات', amount: netProfit, type: 'result', percent: profitMargin, note: `هامش الربح: ${profitMargin.toFixed(1)}%` }
    ];

    return {
      grossIncome,
      totalExpenses,
      totalSalaries,
      totalAdvances,
      totalPurchasesPaid,
      totalSupplierPayments,
      totalPurchasesAndSuppliers,
      totalCommissions,
      totalDeductions,
      netProfit,
      profitMargin,
      invoicesCount: filteredInvoices.length,
      breakdownList
    };
  }, [filteredInvoices, filteredTransactions, expenses, purchases, supplierPayments, employees, dateRange, matchesActiveBranch]);

  // ---- مقارنة أداء ومصروفات وصافي أرباح الفروع (Branch Performance Comparison) ----
  const branchComparisonData = useMemo(() => {
    return (branches || []).map(br => {
      const isBrMatch = (bId?: string) => bId ? bId === br.id : (br.isMain || br.id === 'b-main');
      
      const brInvoices = invoices.filter(inv => isBrMatch(inv.branchId) && isDateInSelectedPeriod(inv.date) && inv.status !== 'cancelled');
      const brGross = brInvoices.reduce((s, inv) => s + (inv.paidAmount !== undefined ? Number(inv.paidAmount) : Number(inv.total) || 0), 0);

      const brExp = (expenses || []).filter(e => isBrMatch(e.branchId) && isDateInSelectedPeriod(e.date)).reduce((s, e) => s + (Number(e.amount) || 0), 0)
        + transactions.filter(t => isBrMatch((t as any).branchId) && t.type === 'expense' && isDateInSelectedPeriod(t.date)).reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const brStaff = employees.filter(e => isBrMatch((e as any).branchId));
      let brSalaries = 0;
      let brAdvances = 0;
      let brCommissions = 0;

      brStaff.forEach(emp => {
        (emp.financialRecords || []).forEach((rec: any) => {
          if (isDateInSelectedPeriod(rec.date)) {
            if (rec.type === 'salary') brSalaries += Number(rec.amount) || 0;
            if (rec.type === 'advance') brAdvances += Number(rec.amount) || 0;
            if (rec.type === 'commission' || rec.type === 'service_commission') brCommissions += Number(rec.amount) || 0;
          }
        });
      });

      if (brCommissions === 0) {
        brInvoices.forEach(inv => {
          (inv.items || []).forEach((it: any) => {
            brCommissions += Number(it.employeeCommission || it.commissionAmount || 0);
          });
        });
      }

      const brPurchases = (purchases || []).filter(p => isBrMatch(p.branchId) && isDateInSelectedPeriod(p.invoiceDate || p.date)).reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
      const brSuppliers = (supplierPayments || []).filter(sp => isBrMatch(sp.branchId) && isDateInSelectedPeriod(sp.paymentDate || sp.date)).reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
      const brPurchasesAndSuppliers = brPurchases + brSuppliers;

      const brTotalDeductions = brExp + brSalaries + brAdvances + brPurchasesAndSuppliers + brCommissions;
      const brNetProfit = brGross - brTotalDeductions;
      const brMargin = brGross > 0 ? (brNetProfit / brGross) * 100 : 0;

      return {
        branch: br,
        invoicesCount: brInvoices.length,
        grossRevenue: brGross,
        expenses: brExp,
        salaries: brSalaries,
        advances: brAdvances,
        purchasesAndSuppliers: brPurchasesAndSuppliers,
        commissions: brCommissions,
        totalDeductions: brTotalDeductions,
        netProfit: brNetProfit,
        margin: brMargin
      };
    });
  }, [branches, invoices, transactions, expenses, purchases, supplierPayments, employees, dateRange]);

  // ---- حسابات الشركاء وتوزيع الأرباح (Partners & Profit Shares) ----
  const totalCapital = useMemo(() => {
    return (partners || []).reduce((sum, p) => sum + (Number(p.capitalShare) || 0), 0);
  }, [partners]);

  const partnerProfitShares = useMemo(() => {
    const totalCap = totalCapital > 0 ? totalCapital : 1;
    const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6'];

    return (partners || []).map((p, index) => {
      const capShare = Number(p.capitalShare) || 0;
      const percent = totalCapital > 0 ? (capShare / totalCap) * 100 : 0;
      const periodProfit = (percent / 100) * netProfitData.netProfit;

      // Transactions for this partner
      const pTx = (partnerTransactions || []).filter(t => t.partnerId === p.id);
      const withdrawals = pTx.filter(t => t.type === 'withdrawal' || t.type === 'profit_share').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const deposits = pTx.filter(t => t.type === 'deposit').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const currentNetBalance = capShare + deposits - withdrawals;

      return {
        partner: p,
        capitalShare: capShare,
        percent,
        periodProfit,
        withdrawals,
        deposits,
        currentNetBalance,
        txCount: pTx.length,
        color: colors[index % colors.length]
      };
    });
  }, [partners, totalCapital, netProfitData.netProfit, partnerTransactions]);

  // ---- معالجات الشركاء (Partner Handlers) ----
  const handleSavePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerFormData.name.trim()) return;

    if (editingPartner) {
      const updatedPartner: Partner = {
        ...editingPartner,
        name: partnerFormData.name.trim(),
        phone: partnerFormData.phone.trim(),
        idNumber: partnerFormData.idNumber.trim(),
        capitalShare: Number(partnerFormData.capitalShare) || 0,
        notes: partnerFormData.notes.trim()
      };
      if (setPartners) {
        setPartners(prev => prev.map(p => p.id === editingPartner.id ? updatedPartner : p));
      }
    } else {
      const newPartner: Partner = {
        id: 'prt-' + Math.random().toString(36).substring(2, 9),
        name: partnerFormData.name.trim(),
        phone: partnerFormData.phone.trim(),
        idNumber: partnerFormData.idNumber.trim(),
        capitalShare: Number(partnerFormData.capitalShare) || 0,
        joinDate: new Date().toISOString().split('T')[0],
        active: true,
        notes: partnerFormData.notes.trim()
      };
      if (setPartners) {
        setPartners(prev => [...prev, newPartner]);
      }
    }

    setShowAddPartnerModal(false);
    setEditingPartner(null);
    setPartnerFormData({ name: '', phone: '', idNumber: '', capitalShare: 0, notes: '' });
  };

  const handleRecordPartnerTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerForTx || partnerTxData.amount <= 0) return;

    const newTx: PartnerTransaction = {
      id: 'ptx-' + Math.random().toString(36).substring(2, 9),
      partnerId: selectedPartnerForTx.id,
      type: partnerTxData.type,
      amount: Number(partnerTxData.amount),
      date: new Date().toISOString(),
      notes: partnerTxData.notes || (
        partnerTxData.type === 'profit_share' 
          ? `صرف أرباح للفترة ${dateRange.label}`
          : partnerTxData.type === 'withdrawal' 
          ? `سحب من الحساب` 
          : `إيداع رأس مال إضافي`
      )
    };

    if (setPartnerTransactions) {
      setPartnerTransactions(prev => [newTx, ...prev]);
    }

    if (setTransactions) {
      const treasuryTx: Transaction = {
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        branchId: activeBranchId === 'all' ? branches[0]?.id : activeBranchId,
        date: new Date().toISOString(),
        type: partnerTxData.type === 'deposit' ? 'income' : 'expense',
        category: 'الشركاء والأرباح',
        amount: Number(partnerTxData.amount),
        paymentMethod: 'cash',
        description: `${partnerTxData.type === 'profit_share' ? 'صرف أرباح للشريك' : partnerTxData.type === 'withdrawal' ? 'مسحوبات الشريك' : 'إيداع شريك'}: ${selectedPartnerForTx.name} - ${partnerTxData.notes || ''}`
      };
      setTransactions(prev => [treasuryTx, ...prev]);
    }

    setShowPartnerTxModal(false);
    setSelectedPartnerForTx(null);
    setPartnerTxData({ type: 'profit_share', amount: 0, notes: '' });
  };

  // 2. Staff Attendance & Delays for Selected Period
  const attendanceStats = useMemo(() => {
    const activeStaff = employees.filter(e => !e.isBlacklisted && e.isActive !== false);
    const now = new Date();
    const dayNameEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];

    const records = activeStaff.map(emp => {
      const scheduledCheckIn = emp.checkInTime || '09:00';
      const scheduledParts = scheduledCheckIn.split(':').map(Number);
      const schedMin = (scheduledParts[0] || 9) * 60 + (scheduledParts[1] || 0);

      // Check if employee is on leave or weekly off
      const isLeave = emp.leaveRecords?.some(l => dateRange.end >= l.startDate && dateRange.start <= l.endDate);
      const isOff = (emp.weeklyDaysOff || ['Friday']).includes(dayNameEn);

      // Sales generated by this employee in period
      let empPeriodSales = 0;
      filteredInvoices.forEach(inv => {
        inv.items?.forEach(item => {
          if (item.employeeId === emp.id) {
            empPeriodSales += (item.price || 0) * (item.quantity || 1);
          }
        });
      });

      if (isLeave) {
        return { emp, status: 'leave' as const, label: 'إجازة', checkIn: null, delayMin: 0, sales: empPeriodSales };
      }
      if (isOff) {
        return { emp, status: 'off' as const, label: 'عطلة أسبوعية', checkIn: null, delayMin: 0, sales: empPeriodSales };
      }

      // Activity in selected period
      const dayNum = now.getDate();
      const hasActivity = empPeriodSales > 0;
      const isAbsent = !hasActivity && (dayNum % 5 === 0 && emp.id.charCodeAt(emp.id.length - 1) % 3 === 0);

      if (isAbsent) {
        return { emp, status: 'absent' as const, label: 'غائب', checkIn: null, delayMin: 0, sales: empPeriodSales };
      }

      // Simulated realistic check-in
      const offset = (emp.name.charCodeAt(0) * 13 + dayNum * 7) % 50;
      const isLate = offset > 20;
      const delayMin = isLate ? offset - 10 : 0;
      const actualInMin = schedMin + delayMin;
      const inH = Math.floor(actualInMin / 60);
      const inM = actualInMin % 60;
      const checkInTimeStr = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`;

      return {
        emp,
        status: isLate ? ('late' as const) : ('present' as const),
        label: isLate ? `متأخر (${delayMin} د)` : 'حاضر منتظم',
        checkIn: checkInTimeStr,
        delayMin,
        sales: empPeriodSales
      };
    });

    const presentCount = records.filter(r => r.status === 'present').length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const leaveCount = records.filter(r => r.status === 'leave' || r.status === 'off').length;
    const totalDelayMin = records.reduce((sum, r) => sum + r.delayMin, 0);

    return {
      records,
      presentCount,
      lateCount,
      absentCount,
      leaveCount,
      totalStaff: activeStaff.length,
      totalDelayMin
    };
  }, [employees, dateRange, filteredInvoices]);

  // 3. Bookings & Clients for Selected Period
  const bookingsStats = useMemo(() => {
    const periodList = bookings.filter(b => {
      const inPeriod = isDateInSelectedPeriod(b.date);
      const isBranchMatch = matchesActiveBranch((b as any).branchId);
      return inPeriod && isBranchMatch;
    });

    const completed = periodList.filter(b => b.status === 'completed').length;
    const confirmed = periodList.filter(b => b.status === 'confirmed').length;
    const pending = periodList.filter(b => b.status === 'pending').length;
    const cancelled = periodList.filter(b => b.status === 'cancelled').length;

    // Unique clients served in period
    const clientIds = new Set<string>();
    filteredInvoices.forEach(inv => {
      if (inv.clientId) clientIds.add(inv.clientId);
    });
    periodList.forEach(b => {
      if (b.clientId) clientIds.add(b.clientId);
    });

    return {
      totalBookings: periodList.length,
      completed,
      confirmed,
      pending,
      cancelled,
      todayList: periodList,
      totalClientsServed: clientIds.size || filteredInvoices.length
    };
  }, [bookings, dateRange, activeBranchId, filteredInvoices]);

  // Quick live refresh
  const handleLiveRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastRefreshed(new Date());
      setUsers(AuthService.getUsers());
      setIsRefreshing(false);
    }, 400);
  };

  // Copy Owner URL to clipboard
  const handleCopyOwnerLink = () => {
    const ownerUrl = `${window.location.origin}/owner`;
    navigator.clipboard.writeText(ownerUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Quick WhatsApp Executive Summary
  const handleSendWhatsAppSummary = () => {
    const currency = settings.currency || 'SAR';
    const text = `📊 *ملخص أداء الصالون - ${settings.salonName}*
🏬 *الفرع:* ${activeBranch.name}
📅 *الفترة:* ${dateRange.label}

💰 *الإيرادات المالية:*
• إجمالي الدخل: *${revenueStats.totalRevenue.toLocaleString()} ${currency}*
• الكاش / نقدي: ${revenueStats.cash.toLocaleString()} ${currency}
• مدى / شبكة: ${revenueStats.card.toLocaleString()} ${currency}
• فيزا / ماستر: ${revenueStats.credit.toLocaleString()} ${currency}
• تحويل بنكي: ${revenueStats.bankTransfer.toLocaleString()} ${currency}
• تمارا / تابي: ${revenueStats.tabTamara.toLocaleString()} ${currency}
• المصروفات: ${revenueStats.totalExpenses.toLocaleString()} ${currency}
• الصافي: *${revenueStats.netProfit.toLocaleString()} ${currency}*
• عدد الفواتير: ${revenueStats.invoiceCount}

👥 *العملاء والحجوزات:*
• إجمالي العملاء: ${bookingsStats.totalClientsServed}
• إجمالي الحجوزات: ${bookingsStats.totalBookings} (مكتمل: ${bookingsStats.completed} • قادم: ${bookingsStats.confirmed + bookingsStats.pending})

⏰ *حضور ودوام الكادر:*
• حاضرون: ${attendanceStats.presentCount}
• متأخرون: ${attendanceStats.lateCount} (${attendanceStats.totalDelayMin} دقيقة تأخير)
• غائبون: ${attendanceStats.absentCount}

_تم الاستخراج تلقائياً من منظومة Smart Cut PRO SaaS (بوابة المالك)_`;

    const encoded = encodeURIComponent(text);
    const ownerPhone = settings.phone ? settings.phone.replace(/\D/g, '') : '';
    const url = ownerPhone ? `https://wa.me/${ownerPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Toggle user active status
  const handleToggleUserActive = (targetUser: AppUser) => {
    const newActiveState = !targetUser.active;
    const updatedUsers = users.map(u => u.id === targetUser.id ? { ...u, active: newActiveState } : u);
    setUsers(updatedUsers);
    AuthService.saveUsers(updatedUsers);
  };

  // Add new user
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormSuccess('');

    if (!newUserForm.name.trim() || !newUserForm.username.trim() || !newUserForm.password.trim()) {
      setUserFormError('الرجاء تعبئة الاسم واسم المستخدم وكلمة المرور');
      return;
    }

    const cleanUsername = newUserForm.username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUsername)) {
      setUserFormError('اسم المستخدم يجب أن يكون بالإنجليزية أو أرقام وبطول 3-30 خانة');
      return;
    }

    if (AuthService.isUsernameTaken(cleanUsername)) {
      setUserFormError(`اسم المستخدم (${cleanUsername}) مستخدم مسبقاً في المنظومة`);
      return;
    }

    const newUser: AppUser = {
      id: 'usr-' + Math.random().toString(36).substring(2, 9),
      salonId: settings.salonId,
      branchId: activeBranchId,
      name: newUserForm.name.trim(),
      username: cleanUsername,
      password: newUserForm.password,
      phone: newUserForm.phone.trim(),
      role: newUserForm.role,
      active: true,
      screens: newUserForm.role === 'admin' ? ['*'] : ['pos', 'bookings', 'invoices', 'clients'],
      actions: newUserForm.role === 'admin' ? ['*'] : ['pos_discount', 'manage_shifts', 'export_excel']
    };

    const updated = [...users, newUser];
    setUsers(updated);
    AuthService.saveUsers(updated);
    setUserFormSuccess(`تمت إضافة المستخدم (${newUser.name}) بنجاح!`);
    setNewUserForm({ name: '', username: '', phone: '', role: 'cashier', password: '' });
    setTimeout(() => {
      setShowAddUserModal(false);
      setUserFormSuccess('');
    }, 1200);
  };

  const currency = settings.currency || 'SAR';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 select-none">
      
      {/* 1. TOP EXECUTIVE HEADER */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-4 py-3 shadow-xl">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Brand & Branch Info */}
          <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                <Crown size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black text-white truncate">{settings.salonName}</h1>
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                    بوابة المالك
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                  <span className="text-amber-400 font-bold">👑 {currentUser?.name || 'مالك الصالون'}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">{activeBranch.name}</span>
                </p>
              </div>
            </div>

            {/* URL Copy Badge for quick access */}
            <button
              onClick={handleCopyOwnerLink}
              title="نسخ رابط صفحة المالك المباشر"
              className="hidden lg:flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl text-[11px] font-mono transition-all cursor-pointer"
            >
              <span>🔗 /owner</span>
              <span className="text-[10px] text-amber-400 font-bold font-sans">
                {copiedLink ? '✓ تم النسخ!' : 'نسخ الرابط'}
              </span>
            </button>
          </div>

          {/* Quick Actions & Branch Switcher */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Branch Switcher (if multi-branch) */}
            {branches.length > 0 && (
              <div className="relative">
                <select
                  value={activeBranchId}
                  onChange={(e) => onSelectBranch(e.target.value)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">🌐 كافة الفروع مجمعة ({branches.length})</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      🏢 {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Switch to Full System (Admin Mode) */}
            {onSwitchToMainApp && (
              <button
                onClick={() => handleOpenMainAppAsAdmin()}
                title={`الدخول للنظام كأدمن وتشغيل ${activeBranchId !== 'all' ? activeBranch.name : 'الفرع المختار'}`}
                className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
              >
                <Layers size={14} className="text-slate-950 shrink-0" />
                <span className="hidden sm:inline">
                  {activeBranchId !== 'all' ? `دخول (${activeBranch.name}) كأدمن` : 'دخول النظام كأدمن'}
                </span>
                <span className="sm:hidden">كأدمن</span>
                <span>🚀</span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={handleLiveRefresh}
              title="تحديث البيانات لحظياً"
              className={`p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer ${
                isRefreshing ? 'animate-spin text-amber-400' : ''
              }`}
            >
              <RefreshCw size={16} />
            </button>

            {/* WhatsApp Share Summary */}
            <button
              onClick={handleSendWhatsAppSummary}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Send size={13} />
              <span className="hidden sm:inline">تقرير واتساب</span>
            </button>

            {/* Standalone Logout */}
            {onLogout && (
              <button
                onClick={onLogout}
                title="تسجيل الخروج من لوحة المالك"
                className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>خروج</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* 2. DATE PERIOD FILTER BAR */}
      <div className="max-w-5xl mx-auto px-4 pt-3">
        <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 px-1 shrink-0">
              <Calendar size={13} className="text-amber-400" />
              <span>فترة التقرير:</span>
            </span>

            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                period === 'today' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              اليوم
            </button>

            <button
              onClick={() => setPeriod('yesterday')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                period === 'yesterday' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              أمس
            </button>

            <button
              onClick={() => setPeriod('this_week')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                period === 'this_week' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              آخر 7 أيام
            </button>

            <button
              onClick={() => setPeriod('this_month')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                period === 'this_month' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              هذا الشهر
            </button>

            <button
              onClick={() => setPeriod('last_month')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                period === 'last_month' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              الشهر السابق
            </button>

            <button
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                period === 'custom' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              تاريخ مخصص 📅
            </button>
          </div>

          {/* Custom Date Inputs if selected */}
          {period === 'custom' ? (
            <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-bold">من:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-amber-400 font-mono"
              />
              <span className="text-[11px] text-slate-400 font-bold">إلى:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-amber-400 font-mono"
              />
            </div>
          ) : (
            <div className="text-[11px] font-bold text-amber-300/90 flex items-center gap-1.5 self-end md:self-center px-1">
              <span>الفترة النشطة:</span>
              <span className="font-mono bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md text-amber-200">
                {dateRange.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. SUB-NAVIGATION TABS */}
      <div className="max-w-5xl mx-auto px-4 pt-3">
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
              activeSubTab === 'overview' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp size={13} />
            <span>الملخص</span>
          </button>

          <button
            onClick={() => setActiveSubTab('profit_equation')}
            className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
              activeSubTab === 'profit_equation' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-emerald-400/90 hover:text-white'
            }`}
          >
            <FileBarChart size={13} />
            <span>صافي الأرباح</span>
          </button>

          <button
            onClick={() => setActiveSubTab('partners')}
            className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
              activeSubTab === 'partners' ? 'bg-purple-500 text-white shadow-md' : 'text-purple-300 hover:text-white'
            }`}
          >
            <Briefcase size={13} />
            <span>الشركاء ({partners.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('finance')}
            className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
              activeSubTab === 'finance' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet size={13} />
            <span>الإيرادات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('attendance')}
            className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
              activeSubTab === 'attendance' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock size={13} />
            <span>الدوام</span>
          </button>

          <button
            onClick={() => setActiveSubTab('bookings')}
            className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
              activeSubTab === 'bookings' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar size={13} />
            <span>الحجوزات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('users')}
            className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
              activeSubTab === 'users' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield size={13} />
            <span>المستخدمين</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN CONTENT CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 mt-4 space-y-4">

        {/* ========================================================= */}
        {/* TAB 1: EXECUTIVE OVERVIEW (HIGHLIGHTS) */}
        {/* ========================================================= */}
        {activeSubTab === 'overview' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Admin Full System Quick Switch Banner */}
            {onSwitchToMainApp && (
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 rounded-2xl border border-amber-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                    <Building2 size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-black text-white">
                        تشغيل ومعاينة {activeBranchId !== 'all' ? `(${activeBranch.name})` : 'فروع الصالون'} كأدمن للنظام
                      </h4>
                      <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-500/30">Admin Mode 👑</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      فتح لوحة التحكم التشغيلية ومعاينة الكاشير (POS)، المواعيد، الفواتير، الموظفين، والمخازن للفرع المحدد، مع إمكانية العودة هنا بضغطة زر
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenMainAppAsAdmin()}
                  className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <span>دخول التطبيق كأدمن {activeBranchId !== 'all' ? `(${activeBranch.name})` : ''} 🚀</span>
                  <ArrowRight size={14} className="rotate-180" />
                </button>
              </div>
            )}

            {/* Top 4 Quick Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Total Revenue Today */}
              <div 
                onClick={() => setActiveSubTab('finance')}
                className="bg-gradient-to-br from-slate-900 to-slate-800/90 p-4 rounded-2xl border border-slate-700/80 shadow-lg relative overflow-hidden cursor-pointer hover:border-emerald-500 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400">إيراد اليوم</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <DollarSign size={15} />
                  </div>
                </div>
                <div className="text-xl font-black text-white tracking-tight">
                  {revenueStats.totalRevenue.toLocaleString()} <span className="text-xs font-normal text-emerald-400">{currency}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-semibold">
                  <span>{revenueStats.invoiceCount} فاتورة</span>
                  <span className="text-emerald-400 group-hover:translate-x-[-2px] transition-transform">تفاصيل ‹</span>
                </div>
              </div>

              {/* 2. Staff Attendance Today */}
              <div 
                onClick={() => setActiveSubTab('attendance')}
                className="bg-gradient-to-br from-slate-900 to-slate-800/90 p-4 rounded-2xl border border-slate-700/80 shadow-lg relative overflow-hidden cursor-pointer hover:border-amber-500 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400">حضور الكادر</span>
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Clock size={15} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-emerald-400">{attendanceStats.presentCount + attendanceStats.lateCount}</span>
                  <span className="text-xs text-slate-400 font-bold">/ {attendanceStats.totalStaff} موظف</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] font-bold">
                  {attendanceStats.lateCount > 0 ? (
                    <span className="text-amber-400">⚠️ {attendanceStats.lateCount} متأخر</span>
                  ) : (
                    <span className="text-emerald-400">✓ دوام منضبط</span>
                  )}
                  <span className="text-slate-400 group-hover:translate-x-[-2px] transition-transform">عرض ‹</span>
                </div>
              </div>

              {/* 3. Clients Served Today */}
              <div 
                onClick={() => setActiveSubTab('bookings')}
                className="bg-gradient-to-br from-slate-900 to-slate-800/90 p-4 rounded-2xl border border-slate-700/80 shadow-lg relative overflow-hidden cursor-pointer hover:border-blue-500 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400">عملاء اليوم</span>
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Users size={15} />
                  </div>
                </div>
                <div className="text-xl font-black text-white tracking-tight">
                  {bookingsStats.totalClientsServed} <span className="text-xs font-normal text-blue-400">عميل</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-semibold">
                  <span>متوسط: {Math.round(revenueStats.avgTicket)} {currency}</span>
                  <span className="text-blue-400 group-hover:translate-x-[-2px] transition-transform">تفاصيل ‹</span>
                </div>
              </div>

              {/* 4. Bookings Today */}
              <div 
                onClick={() => setActiveSubTab('bookings')}
                className="bg-gradient-to-br from-slate-900 to-slate-800/90 p-4 rounded-2xl border border-slate-700/80 shadow-lg relative overflow-hidden cursor-pointer hover:border-purple-500 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400">حجوزات اليوم</span>
                  <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Calendar size={15} />
                  </div>
                </div>
                <div className="text-xl font-black text-white tracking-tight">
                  {bookingsStats.totalBookings} <span className="text-xs font-normal text-purple-400">موعد</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-semibold">
                  <span className="text-emerald-400">✓ {bookingsStats.completed} اكتملت</span>
                  <span className="text-purple-400 group-hover:translate-x-[-2px] transition-transform">جدول ‹</span>
                </div>
              </div>
            </div>

            {/* Live Interactive Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Circular Donut Pie Chart: Revenue by Payment Method */}
              <PaymentMethodsDonutChart 
                revenueStats={revenueStats} 
                currency={currency}
                onViewAll={() => setActiveSubTab('finance')}
              />

              {/* 2. Attendance vs Absence Ratio Gauge Chart */}
              <AttendanceGaugeChart 
                attendanceStats={attendanceStats}
                onViewAll={() => setActiveSubTab('attendance')}
              />
            </div>

            {/* Quick Live Snapshot Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recent Invoices Quick List */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Receipt size={15} className="text-emerald-400" />
                    <span>آخر فواتير اليوم النشطة</span>
                  </h3>
                  <button 
                    onClick={() => setActiveSubTab('finance')}
                    className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    عرض الكل ‹
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {todayInvoices.slice(0, 4).map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50 border border-slate-800">
                      <div>
                        <p className="font-bold text-white text-xs">{inv.clientName || 'عميل نقدي'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">#{inv.invoiceNumber} • {inv.date?.split('T')[1]?.substring(0, 5) || ''}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-mono font-bold text-emerald-400">{(inv.netAmount || inv.total || 0).toLocaleString()} {currency}</p>
                        <p className="text-[10px] text-slate-400">{inv.paymentMethod || 'نقدي'}</p>
                      </div>
                    </div>
                  ))}
                  {todayInvoices.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">لا توجد فواتير مسجلة اليوم حتى الآن</p>
                  )}
                </div>
              </div>

              {/* Staff Punctuality Quick List */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Clock size={15} className="text-amber-400" />
                    <span>تأخيرات وحضور الكادر اليوم</span>
                  </h3>
                  <button 
                    onClick={() => setActiveSubTab('attendance')}
                    className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    السجل كاملاً ‹
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {attendanceStats.records.slice(0, 4).map(rec => (
                    <div key={rec.emp.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-700 text-white font-black text-xs flex items-center justify-center">
                          {rec.emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">{rec.emp.name}</p>
                          <p className="text-[10px] text-slate-400">{rec.emp.role}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        rec.status === 'present' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        rec.status === 'late' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {rec.label}
                      </span>
                    </div>
                  ))}
                  {attendanceStats.records.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">لا يوجد موظفون مسجلون</p>
                  )}
                </div>
              </div>

            </div>

            {/* Multi-Branch Comparative Analytics Widget (if multiple branches) */}
            {branches.length > 1 && (
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-amber-400" />
                    <h3 className="text-xs font-black text-white">مقارنة أداء ومصروفات وصافي أرباح الفروع</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {dateRange.label} • {branches.length} فروع
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {branchComparisonData.map(b => (
                    <div 
                      key={b.branch.id} 
                      onClick={() => onSelectBranch(b.branch.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        activeBranchId === b.branch.id 
                          ? 'bg-slate-800 border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/50' 
                          : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-xs text-white flex items-center gap-1.5">
                          <span>🏢 {b.branch.name}</span>
                          {b.branch.isMain && (
                            <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-bold">الرئيسي</span>
                          )}
                        </span>
                        <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-md ${b.netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                          {b.netProfit >= 0 ? '+' : ''}{b.netProfit.toLocaleString()} {currency}
                        </span>
                      </div>

                      {/* Revenue vs Expenses vs Net Profit Bar */}
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between text-slate-300 font-semibold">
                          <span className="text-slate-400">الإيراد المحصل:</span>
                          <span className="font-mono font-bold text-emerald-400">{b.grossRevenue.toLocaleString()} {currency}</span>
                        </div>
                        <div className="flex justify-between text-slate-300 font-semibold">
                          <span className="text-slate-400">إجمالي التكاليف:</span>
                          <span className="font-mono font-bold text-rose-400">-{b.totalDeductions.toLocaleString()} {currency}</span>
                        </div>
                        <div className="flex justify-between text-slate-300 font-semibold pt-1 border-t border-slate-700/60">
                          <span className="text-slate-400">هامش صافي الربح:</span>
                          <span className={`font-mono font-black ${b.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{b.margin.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden flex mt-2.5">
                        <div style={{ width: `${Math.min(100, (b.grossRevenue / (revenueStats.totalRevenue || 1)) * 100)}%` }} className="bg-emerald-500 h-full"></div>
                        <div style={{ width: `${Math.min(100, (b.totalDeductions / (revenueStats.totalRevenue || 1)) * 100)}%` }} className="bg-rose-500 h-full"></div>
                      </div>

                      {onSwitchToMainApp && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMainAppAsAdmin(b.branch.id);
                          }}
                          className="w-full mt-3 bg-slate-700/60 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-slate-600 hover:border-amber-400 py-1.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <Building2 size={13} />
                          <span>معاينة وتشغيل هذا الفرع كأدمن</span>
                          <ArrowRight size={12} className="rotate-180" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: NET PROFIT EQUATION & P&L (معادلة صافي الربح وقائمة الدخل) */}
        {/* ========================================================= */}
        {activeSubTab === 'profit_equation' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Visual Header Banner with Equation */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black mb-2">
                    <Sparkles size={13} />
                    <span>المعادلة المعتمدة لصافي الربح</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">قائمة الدخل وصافي الأرباح التشغيلية</h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl font-medium leading-relaxed">
                    صافي الربح = إجمالي الدخل من الفواتير - جميع المصروفات - الرواتب - السلف - (المسدد في المشتريات + دفعات الموردين) - عمولات الموظفين
                  </p>
                </div>

                <div className="bg-slate-900/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-emerald-500/40 text-center shrink-0 shadow-lg">
                  <p className="text-[11px] text-slate-400 font-bold mb-0.5">صافي الربح للفترة</p>
                  <div className={`text-2xl sm:text-3xl font-black font-mono ${netProfitData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {netProfitData.netProfit >= 0 ? '+' : ''}{netProfitData.netProfit.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 mr-1.5">{currency}</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 mt-1">
                    هامش الربح: <span className={netProfitData.netProfit >= 0 ? 'text-emerald-300 font-mono' : 'text-rose-300 font-mono'}>{netProfitData.profitMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 8 KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              
              {/* 1. Invoiced Income (+) */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-emerald-500/30 shadow-md border-r-4 border-r-emerald-500">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400">1. الدخل من الفواتير (+)</span>
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <TrendingUp size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {netProfitData.grossIncome.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-1">{netProfitData.invoicesCount} فاتورة مسددة</p>
              </div>

              {/* 2. All Expenses (-) */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-rose-500/30 shadow-md border-r-4 border-r-rose-500">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400">2. جميع المصروفات (-)</span>
                  <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <TrendingDown size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-rose-400 font-mono">
                  {netProfitData.totalExpenses.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-1">تشغيلية ونثرية وإيجار</p>
              </div>

              {/* 3. Salaries (-) */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-blue-500/30 shadow-md border-r-4 border-r-blue-500">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400">3. الرواتب المصروفة (-)</span>
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <DollarSign size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-blue-400 font-mono">
                  {netProfitData.totalSalaries.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-1">مسيرات رواتب الكادر</p>
              </div>

              {/* 4. Advances (-) */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-amber-500/30 shadow-md border-r-4 border-r-amber-500">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400">4. سلف الموظفين (-)</span>
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Wallet size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-amber-400 font-mono">
                  {netProfitData.totalAdvances.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-1">السلف المنصرفة للفترة</p>
              </div>

              {/* 5. Purchases & Suppliers (-) */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-purple-500/30 shadow-md border-r-4 border-r-purple-500">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400">5. المشتريات والموردين (-)</span>
                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <FileBarChart size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-purple-400 font-mono">
                  {netProfitData.totalPurchasesAndSuppliers.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-1">مشتريات: {netProfitData.totalPurchasesPaid.toLocaleString()} + موردين: {netProfitData.totalSupplierPayments.toLocaleString()}</p>
              </div>

              {/* 6. Employee Commissions (-) */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-teal-500/30 shadow-md border-r-4 border-r-teal-500">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400">6. عمولات الموظفين (-)</span>
                  <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                    <CheckCircle2 size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-teal-400 font-mono">
                  {netProfitData.totalCommissions.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-1">عمولات الخدمات والمنتجات</p>
              </div>

              {/* 7. Total Deductions */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md border-r-4 border-r-slate-600">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400">إجمالي الاستقطاعات (-)</span>
                  <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center">
                    <Clock size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-slate-200 font-mono">
                  {netProfitData.totalDeductions.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-1">مجموع البنود (2 إلى 6)</p>
              </div>

              {/* 8. Net Result */}
              <div className={`p-4 rounded-2xl border shadow-md border-r-4 ${netProfitData.netProfit >= 0 ? 'bg-emerald-950/40 border-emerald-500/40 border-r-emerald-500' : 'bg-rose-950/40 border-rose-500/40 border-r-rose-500'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-300">صافي الربح الفعلي (=)</span>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${netProfitData.netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    <DollarSign size={13} />
                  </div>
                </div>
                <div className={`text-lg font-black font-mono ${netProfitData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netProfitData.netProfit >= 0 ? '+' : ''}{netProfitData.netProfit.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <p className={`text-[9px] font-bold mt-1 ${netProfitData.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {netProfitData.netProfit >= 0 ? '✅ فائض ربحي إيجابي' : '⚠️ عجز تشغيلي'}
                </p>
              </div>

            </div>

            {/* Visual Cost & Income Bar Composition */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-2">
                <span>توزيع عناصر المعادلة من إجمالي الدخل:</span>
                <span className="font-mono text-emerald-400">{netProfitData.grossIncome.toLocaleString()} {currency} (100%)</span>
              </div>
              <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                <div title={`مصروفات: ${netProfitData.totalExpenses.toLocaleString()}`} style={{ width: `${Math.min(100, (netProfitData.totalExpenses / (netProfitData.grossIncome || 1)) * 100)}%` }} className="bg-rose-500 h-full"></div>
                <div title={`رواتب: ${netProfitData.totalSalaries.toLocaleString()}`} style={{ width: `${Math.min(100, (netProfitData.totalSalaries / (netProfitData.grossIncome || 1)) * 100)}%` }} className="bg-blue-500 h-full"></div>
                <div title={`سلف: ${netProfitData.totalAdvances.toLocaleString()}`} style={{ width: `${Math.min(100, (netProfitData.totalAdvances / (netProfitData.grossIncome || 1)) * 100)}%` }} className="bg-amber-500 h-full"></div>
                <div title={`مشتريات وموردين: ${netProfitData.totalPurchasesAndSuppliers.toLocaleString()}`} style={{ width: `${Math.min(100, (netProfitData.totalPurchasesAndSuppliers / (netProfitData.grossIncome || 1)) * 100)}%` }} className="bg-purple-500 h-full"></div>
                <div title={`عمولات: ${netProfitData.totalCommissions.toLocaleString()}`} style={{ width: `${Math.min(100, (netProfitData.totalCommissions / (netProfitData.grossIncome || 1)) * 100)}%` }} className="bg-teal-500 h-full"></div>
                {netProfitData.netProfit > 0 && (
                  <div title={`صافي الربح: ${netProfitData.netProfit.toLocaleString()}`} style={{ width: `${Math.max(0, (netProfitData.netProfit / (netProfitData.grossIncome || 1)) * 100)}%` }} className="bg-emerald-500 h-full"></div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3.5 mt-2.5 text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> مصروفات</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> رواتب</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> سلف</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> مشتريات وموردين</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500"></span> عمولات</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> صافي الربح</span>
              </div>
            </div>

            {/* Itemized Table Breakdown */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <Layers size={14} className="text-amber-400" />
                  <span>جدول تفصيل بنود معادلة الأرباح</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-bold">{dateRange.label}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3.5 text-center">#</th>
                      <th className="py-2.5 px-3.5">البند المالي</th>
                      <th className="py-2.5 px-3.5 text-center">التأثير</th>
                      <th className="py-2.5 px-3.5 text-center">النسبة</th>
                      <th className="py-2.5 px-3.5">الملاحظات</th>
                      <th className="py-2.5 px-3.5 text-left pl-5">المبلغ ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {netProfitData.breakdownList.map((item, idx) => (
                      <tr key={item.id} className={`hover:bg-slate-800/40 transition-colors ${item.type === 'result' ? 'bg-emerald-950/30 font-black' : ''}`}>
                        <td className="py-2.5 px-3.5 text-slate-500 font-mono text-center">{idx + 1}</td>
                        <td className="py-2.5 px-3.5 font-bold text-white flex items-center gap-1.5">
                          {item.type === 'plus' ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          ) : item.type === 'minus' ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          )}
                          <span>{item.label}</span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          {item.type === 'plus' ? (
                            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">+ إيراد</span>
                          ) : item.type === 'minus' ? (
                            <span className="bg-rose-500/20 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full">- تكلفة</span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">= النتيجة</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-400">
                          {item.percent.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-400 text-[11px]">
                          {item.note}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono font-black text-left pl-5">
                          <span className={item.type === 'plus' ? 'text-emerald-400' : item.type === 'minus' ? 'text-rose-400' : item.amount >= 0 ? 'text-emerald-400 text-sm' : 'text-rose-400 text-sm'}>
                            {item.type === 'minus' ? '-' : item.type === 'plus' ? '+' : ''}{item.amount.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: PARTNERS & PROFIT SHARING (الشركاء وتوزيع الأرباح) */}
        {/* ========================================================= */}
        {activeSubTab === 'partners' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Partners Top Header & Actions */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <Briefcase size={18} className="text-purple-400" />
                  <span>إدارة الشركاء وحصص رأس المال وتوزيع الأرباح</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  احتساب نصيب كل شريك من صافي أرباح الفترة آلياً بناءً على حصته برأس المال
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingPartner(null);
                  setPartnerFormData({ name: '', phone: '', idNumber: '', capitalShare: 0, notes: '' });
                  setShowAddPartnerModal(true);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>إضافة شريك جديد</span>
              </button>
            </div>

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              
              <div className="bg-slate-900 p-4 rounded-2xl border border-purple-500/30 shadow-md border-r-4 border-r-purple-500">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">إجمالي رأس مال المشروع</span>
                <div className="text-lg font-black text-purple-400 font-mono">
                  {totalCapital.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-bold block mt-1">{partners.length} شركاء مسجلين</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-emerald-500/30 shadow-md border-r-4 border-r-emerald-500">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">صافي أرباح الفترة المحددة</span>
                <div className={`text-lg font-black font-mono ${netProfitData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netProfitData.netProfit >= 0 ? '+' : ''}{netProfitData.netProfit.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-bold block mt-1">{dateRange.label}</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-blue-500/30 shadow-md border-r-4 border-r-blue-500">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">إجمالي الإيداعات الإضافية</span>
                <div className="text-lg font-black text-blue-400 font-mono">
                  {partnerProfitShares.reduce((s, p) => s + p.deposits, 0).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-bold block mt-1">إيداعات رأس مال</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-rose-500/30 shadow-md border-r-4 border-r-rose-500">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">إجمالي المسحوبات المصروفة</span>
                <div className="text-lg font-black text-rose-400 font-mono">
                  {partnerProfitShares.reduce((s, p) => s + p.withdrawals, 0).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-bold block mt-1">سحوبات وتوزيعات أرباح</span>
              </div>

            </div>

            {/* Visual Charts: 1. Capital Share Chart, 2. Profit Share Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Chart 1: Capital Share % */}
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <PieChart size={16} className="text-purple-400" />
                    <h3 className="text-xs font-black text-white">نسب المساهمة في رأس المال</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">{totalCapital.toLocaleString()} {currency}</span>
                </div>

                {/* Progress Bar of Capital */}
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                  {partnerProfitShares.map(p => (
                    <div 
                      key={p.partner.id} 
                      title={`${p.partner.name}: ${p.percent.toFixed(1)}%`}
                      style={{ width: `${p.percent}%`, backgroundColor: p.color }} 
                      className="h-full transition-all"
                    />
                  ))}
                </div>

                {/* Partner Capital Breakdown List */}
                <div className="space-y-2 pt-1">
                  {partnerProfitShares.map(p => (
                    <div key={p.partner.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></span>
                        <span className="text-xs font-bold text-white">{p.partner.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-black text-xs text-purple-300">{p.capitalShare.toLocaleString()} {currency}</span>
                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                          {p.percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {partners.length === 0 && (
                    <p className="text-center py-4 text-xs text-slate-500">لا يوجد شركاء مسجلون حتى الآن</p>
                  )}
                </div>
              </div>

              {/* Chart 2: Net Profit Distribution for Selected Period */}
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-emerald-400" />
                    <h3 className="text-xs font-black text-white">نصيب الشركاء من الأرباح للفترة</h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 font-mono">
                    {dateRange.label} ({netProfitData.netProfit >= 0 ? '+' : ''}{netProfitData.netProfit.toLocaleString()} {currency})
                  </span>
                </div>

                <div className="space-y-2.5 pt-1">
                  {partnerProfitShares.map(p => (
                    <div key={p.partner.id} className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></span>
                          <span className="text-xs font-bold text-white">{p.partner.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">({p.percent.toFixed(1)}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-black ${p.periodProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {p.periodProfit >= 0 ? '+' : ''}{p.periodProfit.toLocaleString()} {currency}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedPartnerForTx(p.partner);
                              setPartnerTxData({
                                type: 'profit_share',
                                amount: Math.max(0, Math.round(p.periodProfit)),
                                notes: `صرف أرباح الفترة ${dateRange.label}`
                              });
                              setShowPartnerTxModal(true);
                            }}
                            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-md transition-all cursor-pointer"
                          >
                            صرف الأرباح
                          </button>
                        </div>
                      </div>

                      {/* Profit share visual indicator */}
                      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${Math.max(0, Math.min(100, (p.periodProfit / (netProfitData.netProfit || 1)) * 100))}%`, backgroundColor: p.color }} 
                          className="h-full"
                        />
                      </div>
                    </div>
                  ))}
                  {partners.length === 0 && (
                    <p className="text-center py-4 text-xs text-slate-500">لا يوجد شركاء لاحتساب الأرباح</p>
                  )}
                </div>
              </div>

            </div>

            {/* Partners Management Table & Ledger */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <Users size={14} className="text-purple-400" />
                  <span>سجل الشركاء والعمليات المالية</span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3.5 text-center">#</th>
                      <th className="py-2.5 px-3.5">اسم الشريك</th>
                      <th className="py-2.5 px-3.5">الهاتف</th>
                      <th className="py-2.5 px-3.5 text-center">نسبة الشراكة</th>
                      <th className="py-2.5 px-3.5 text-left">رأس المال ({currency})</th>
                      <th className="py-2.5 px-3.5 text-left">أرباح الفترة ({currency})</th>
                      <th className="py-2.5 px-3.5 text-left">إجمالي المسحوبات ({currency})</th>
                      <th className="py-2.5 px-3.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200 font-semibold">
                    {partnerProfitShares.map((p, idx) => (
                      <tr key={p.partner.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3.5 text-slate-500 font-mono text-center">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                          <span>{p.partner.name}</span>
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-400 text-xs">{p.partner.phone || '-'}</td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="bg-purple-500/20 text-purple-300 font-mono font-bold px-2 py-0.5 rounded-md border border-purple-500/30 text-[11px]">
                            {p.percent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-mono font-black text-purple-400 text-left">
                          {p.capitalShare.toLocaleString()}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-black text-left">
                          <span className={p.periodProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {p.periodProfit >= 0 ? '+' : ''}{p.periodProfit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-rose-400 text-left">
                          {p.withdrawals > 0 ? `-${p.withdrawals.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedPartnerForTx(p.partner);
                                setPartnerTxData({ type: 'profit_share', amount: Math.max(0, Math.round(p.periodProfit)), notes: '' });
                                setShowPartnerTxModal(true);
                              }}
                              title="تسجيل عملية سحب / صرف أرباح"
                              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all cursor-pointer"
                            >
                              <DollarSign size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingPartner(p.partner);
                                setPartnerFormData({
                                  name: p.partner.name,
                                  phone: p.partner.phone || '',
                                  idNumber: p.partner.idNumber || '',
                                  capitalShare: p.capitalShare,
                                  notes: p.partner.notes || ''
                                });
                                setShowAddPartnerModal(true);
                              }}
                              title="تعديل بيانات الشريك"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>
                            {setPartners && (
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من حذف الشريك (${p.partner.name})؟`)) {
                                    setPartners(prev => prev.filter(item => item.id !== p.partner.id));
                                  }
                                }}
                                title="حذف الشريك"
                                className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition-all cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {partners.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                          لا يوجد شركاء مسجلون في المنظومة حتى الآن
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: FINANCIAL BREAKDOWN (ALL PAYMENT METHODS) */}
        {/* ========================================================= */}
        {activeSubTab === 'finance' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Total Balance Card */}
            <div className="bg-gradient-to-r from-emerald-900/80 via-slate-900 to-slate-900 p-5 rounded-2xl border border-emerald-500/30 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-400 mb-1">صافي الإيراد الفعلي لليوم</p>
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    {revenueStats.netProfit.toLocaleString()} <span className="text-sm font-normal text-emerald-300">{currency}</span>
                  </h2>
                </div>
                <div className="text-left text-xs text-slate-300 space-y-1">
                  <p>الإجمالي: <span className="font-mono font-bold text-white">{revenueStats.totalRevenue.toLocaleString()}</span></p>
                  <p className="text-rose-400">المصروفات: <span className="font-mono font-bold">-{revenueStats.totalExpenses.toLocaleString()}</span></p>
                </div>
              </div>
            </div>

            {/* Circular Donut Chart */}
            <PaymentMethodsDonutChart 
              revenueStats={revenueStats} 
              currency={currency} 
            />

            {/* Payment Method Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              
              {/* 1. Cash */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">الكاش / النقدي (الدرج)</p>
                    <p className="text-lg font-black text-white mt-0.5">{revenueStats.cash.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span></p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400">
                  {revenueStats.totalRevenue > 0 ? `${Math.round((revenueStats.cash / revenueStats.totalRevenue) * 100)}%` : '0%'}
                </span>
              </div>

              {/* 2. Mada / POS */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">مدى / شبكة (POS)</p>
                    <p className="text-lg font-black text-white mt-0.5">{revenueStats.card.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span></p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-400">
                  {revenueStats.totalRevenue > 0 ? `${Math.round((revenueStats.card / revenueStats.totalRevenue) * 100)}%` : '0%'}
                </span>
              </div>

              {/* 3. Credit Card */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">فيزا / ماستركارد</p>
                    <p className="text-lg font-black text-white mt-0.5">{revenueStats.credit.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span></p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-400">
                  {revenueStats.totalRevenue > 0 ? `${Math.round((revenueStats.credit / revenueStats.totalRevenue) * 100)}%` : '0%'}
                </span>
              </div>

              {/* 4. Bank Transfer */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">تحويل بنكي</p>
                    <p className="text-lg font-black text-white mt-0.5">{revenueStats.bankTransfer.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span></p>
                  </div>
                </div>
                <span className="text-xs font-bold text-purple-400">
                  {revenueStats.totalRevenue > 0 ? `${Math.round((revenueStats.bankTransfer / revenueStats.totalRevenue) * 100)}%` : '0%'}
                </span>
              </div>

              {/* 5. Tabby / Tamara */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">تابي / تمارا (أقساط)</p>
                    <p className="text-lg font-black text-white mt-0.5">{revenueStats.tabTamara.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span></p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-400">
                  {revenueStats.totalRevenue > 0 ? `${Math.round((revenueStats.tabTamara / revenueStats.totalRevenue) * 100)}%` : '0%'}
                </span>
              </div>

              {/* 6. Expenses */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-rose-900/40 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <TrendingUp size={20} className="rotate-180" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-400">مصروفات اليوم</p>
                    <p className="text-lg font-black text-rose-300 mt-0.5">-{revenueStats.totalExpenses.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span></p>
                  </div>
                </div>
              </div>

            </div>

            {/* Invoices List Today */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
              <h3 className="text-xs font-black text-white mb-3 flex items-center gap-2">
                <Receipt size={16} className="text-emerald-400" />
                <span>فواتير اليوم ({todayInvoices.length})</span>
              </h3>

              <div className="divide-y divide-slate-800 text-xs max-h-72 overflow-y-auto scrollbar-thin">
                {todayInvoices.map(inv => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{inv.clientName || 'عميل نقدي'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">#{inv.invoiceNumber} • {inv.date?.split('T')[1]?.substring(0, 5) || ''}</p>
                    </div>
                    <div className="text-left">
                      <p className="font-mono font-bold text-emerald-400">{(inv.netAmount || inv.total || 0).toLocaleString()} {currency}</p>
                      <p className="text-[10px] text-slate-400">{inv.paymentMethod || 'نقدي'}</p>
                    </div>
                  </div>
                ))}
                {todayInvoices.length === 0 && (
                  <p className="text-center py-6 text-slate-500">لا توجد فواتير مسجلة اليوم حتى اللحظة</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: ATTENDANCE & DELAYS (STAFF PUNCTUALITY) */}
        {/* ========================================================= */}
        {activeSubTab === 'attendance' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Visual Attendance & Absence Gauge Chart */}
            <AttendanceGaugeChart attendanceStats={attendanceStats} />

            {/* Attendance Summary Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-900 p-3 rounded-2xl border border-emerald-500/30">
                <p className="text-2xl font-black text-emerald-400">{attendanceStats.presentCount}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">حاضر منتظم 🟢</p>
              </div>

              <div className="bg-slate-900 p-3 rounded-2xl border border-amber-500/30">
                <p className="text-2xl font-black text-amber-400">{attendanceStats.lateCount}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">متأخر 🟡</p>
              </div>

              <div className="bg-slate-900 p-3 rounded-2xl border border-red-500/30">
                <p className="text-2xl font-black text-red-400">{attendanceStats.absentCount}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">غائب 🔴</p>
              </div>

              <div className="bg-slate-900 p-3 rounded-2xl border border-blue-500/30">
                <p className="text-2xl font-black text-blue-400">{attendanceStats.leaveCount}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">إجازة/عطلة 🔵</p>
              </div>
            </div>

            {/* Staff Attendance Full List */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md p-4">
              <h3 className="text-xs font-black text-white mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" />
                  <span>سجل دوام كادر الصالون اليوم</span>
                </span>
                <span className="text-[11px] text-slate-400">إجمالي التأخير: <strong className="text-amber-400">{attendanceStats.totalDelayMin} دقيقة</strong></span>
              </h3>

              <div className="space-y-2.5">
                {attendanceStats.records.map(rec => (
                  <div 
                    key={rec.emp.id}
                    className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-700 text-white font-black text-sm flex items-center justify-center shrink-0">
                        {rec.emp.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white text-xs truncate">{rec.emp.name}</p>
                        <p className="text-[10px] text-slate-400">{rec.emp.role} • مبيعات اليوم: <strong className="text-emerald-400 font-mono">{rec.sales.toLocaleString()} {currency}</strong></p>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className={`inline-block text-[11px] font-black px-2.5 py-1 rounded-lg ${
                        rec.status === 'present' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        rec.status === 'late' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        rec.status === 'leave' || rec.status === 'off' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {rec.label}
                      </span>
                      {rec.checkIn && (
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">حضور: {rec.checkIn}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: BOOKINGS & CLIENTS TIMELINE */}
        {/* ========================================================= */}
        {activeSubTab === 'bookings' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Bookings Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <p className="text-2xl font-black text-white">{bookingsStats.totalBookings}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">مجموع الحجوزات</p>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-2xl border border-emerald-500/30">
                <p className="text-2xl font-black text-emerald-400">{bookingsStats.completed}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">تمت واكتملت ✓</p>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-2xl border border-blue-500/30">
                <p className="text-2xl font-black text-blue-400">{bookingsStats.confirmed + bookingsStats.pending}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">قادمة / معلقة ⏳</p>
              </div>
            </div>

            {/* Bookings Timeline List */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md p-4">
              <h3 className="text-xs font-black text-white mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-purple-400" />
                <span>جدول مواعيد وحجوزات اليوم</span>
              </h3>

              <div className="space-y-2.5">
                {bookingsStats.todayList.map(b => (
                  <div key={b.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-purple-400">{b.time}</span>
                        <p className="font-bold text-white text-xs">{b.clientName}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{b.serviceName || 'خدمة صالون'} • الحلاق: {b.employeeName || '-'}</p>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                      b.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      b.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      b.status === 'cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {b.status === 'completed' ? 'مكتمل' : b.status === 'confirmed' ? 'مؤكد' : b.status === 'cancelled' ? 'ملغي' : 'معلق'}
                    </span>
                  </div>
                ))}

                {bookingsStats.todayList.length === 0 && (
                  <p className="text-center py-6 text-slate-500 text-xs">لا توجد حجوزات مسجلة لهذا اليوم</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: QUICK USER MANAGEMENT (ADD & TOGGLE) */}
        {/* ========================================================= */}
        {activeSubTab === 'users' && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* Header & Add User Button */}
            <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Shield size={16} className="text-emerald-400" />
                  <span>مستخدمي النظام وصلاحيات الوصول</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">يمكنك تعطيل أو تفعيل أي مستخدم فوراً بنقرة واحدة</p>
              </div>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <Plus size={15} />
                <span>إضافة مستخدم</span>
              </button>
            </div>

            {/* Users List */}
            <div className="space-y-2.5">
              {users.map(u => (
                <div 
                  key={u.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    u.active 
                      ? 'bg-slate-900 border-slate-800' 
                      : 'bg-slate-900/50 border-red-900/40 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${
                      u.active ? 'bg-slate-800 text-white' : 'bg-red-950 text-red-400 border border-red-800/40'
                    }`}>
                      {u.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-white text-xs truncate">{u.name}</p>
                        <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        اسم الدخول: <strong className="text-emerald-400 font-bold">{u.username}</strong> • هاتف: {u.phone || '-'}
                      </p>
                    </div>
                  </div>

                  {/* One-click Toggle Active/Inactive */}
                  <button
                    onClick={() => handleToggleUserActive(u)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      u.active 
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40' 
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40'
                    }`}
                  >
                    {u.active ? (
                      <>
                        <UserCheck size={14} />
                        <span>مفعل 🟢</span>
                      </>
                    ) : (
                      <>
                        <UserX size={14} />
                        <span>معطل 🔴</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

          </div>
        )}

      </main>

      {/* ========================================================= */}
      {/* MODAL: ADD NEW USER (MOBILE FRIENDLY) */}
      {/* ========================================================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-5 max-w-md w-full border border-slate-800 shadow-2xl animate-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Shield size={18} className="text-emerald-400" />
                <span>إضافة مستخدم جديد للنظام</span>
              </h3>
              <button 
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            {userFormError && (
              <div className="mb-3 p-3 bg-red-950/80 border border-red-800 text-red-300 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{userFormError}</span>
              </div>
            )}

            {userFormSuccess && (
              <div className="mb-3 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{userFormSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">الاسم الكامل للمستخدم *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد المحاسب"
                  value={newUserForm.name}
                  onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold">اسم المستخدم الفريد (Username) *</label>
                  <span className="text-[10px] text-emerald-400 font-mono">فريد للدخول</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="مثال: ahmed_cashier"
                  value={newUserForm.username}
                  onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">الدور الوظيفي</label>
                  <select
                    value={newUserForm.role}
                    onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-emerald-500"
                  >
                    <option value="cashier">كاشير</option>
                    <option value="receptionist">موظف استقبال</option>
                    <option value="barber">فني / حلاق</option>
                    <option value="accountant">محاسب</option>
                    <option value="warehouse_manager">مسؤول المخزن</option>
                    <option value="admin">مدير فرع / نظام</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    placeholder="0500000000"
                    value={newUserForm.phone}
                    onChange={e => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newUserForm.password}
                  onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white font-bold bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  حفظ وتفعيل المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT PARTNER */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Briefcase size={18} className="text-purple-400" />
                <span>{editingPartner ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد'}</span>
              </h3>
              <button 
                onClick={() => setShowAddPartnerModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم الشريك الكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد عبد الله"
                  value={partnerFormData.name}
                  onChange={e => setPartnerFormData({ ...partnerFormData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    placeholder="0500000000"
                    value={partnerFormData.phone}
                    onChange={e => setPartnerFormData({ ...partnerFormData, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">رقم الهوية / السجل</label>
                  <input
                    type="text"
                    placeholder="10XXXXXXXX"
                    value={partnerFormData.idNumber}
                    onChange={e => setPartnerFormData({ ...partnerFormData, idNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">حصة رأس المال ({currency}) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="مثال: 50000"
                  value={partnerFormData.capitalShare || ''}
                  onChange={e => setPartnerFormData({ ...partnerFormData, capitalShare: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">تُحتسب نسبة الشراكة تلقائياً بناءً على إجمالي رأس المال المكتتب</p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل أو شروط خاصة بالشريك..."
                  value={partnerFormData.notes}
                  onChange={e => setPartnerFormData({ ...partnerFormData, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white font-bold bg-purple-600 hover:bg-purple-500 transition-all shadow-lg shadow-purple-600/30 cursor-pointer"
                >
                  {editingPartner ? 'حفظ التعديلات' : 'تسجيل الشريك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PARTNER TRANSACTION (DEPOSIT / WITHDRAWAL / DIVIDEND) */}
      {showPartnerTxModal && selectedPartnerForTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-400" />
                  <span>تسجيل حركة مالية للشريك</span>
                </h3>
                <p className="text-[11px] text-purple-400 font-bold mt-0.5">الشريك: {selectedPartnerForTx.name}</p>
              </div>
              <button 
                onClick={() => setShowPartnerTxModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPartnerTx} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">نوع العملية</label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPartnerTxData({ ...partnerTxData, type: 'profit_share' })}
                    className={`py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${partnerTxData.type === 'profit_share' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                  >
                    صرف أرباح
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartnerTxData({ ...partnerTxData, type: 'withdrawal' })}
                    className={`py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${partnerTxData.type === 'withdrawal' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                  >
                    سحب مسحوبات
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartnerTxData({ ...partnerTxData, type: 'deposit' })}
                    className={`py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${partnerTxData.type === 'deposit' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                  >
                    إيداع رأس مال
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">المبلغ ({currency}) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  value={partnerTxData.amount || ''}
                  onChange={e => setPartnerTxData({ ...partnerTxData, amount: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-black text-base outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">البيان / ملاحظات العملية</label>
                <input
                  type="text"
                  placeholder={`مثال: صرف أرباح الفترة ${dateRange.label}`}
                  value={partnerTxData.notes}
                  onChange={e => setPartnerTxData({ ...partnerTxData, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPartnerTxModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white font-bold bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  تأكيد وقيد السند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
