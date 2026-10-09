import React, { useState, useMemo, useEffect } from 'react';
import { 
  AppSettings, Invoice, Transaction, Booking, Employee, Client, Branch, AppUser, UserRole, Partner, PartnerTransaction 
} from '../types';
import { AuthService, ROLE_LABELS } from '../services/auth';
import { DB } from '../services/db';
import { 
  Smartphone, DollarSign, Users, Calendar, Clock, CheckCircle2, AlertTriangle, 
  XCircle, UserCheck, UserX, Plus, RefreshCw, Send, ChevronDown, ArrowUpRight, 
  TrendingUp, TrendingDown, Wallet, CreditCard, Banknote, Building2, Shield, Eye, Lock,
  Receipt, Sparkles, Check, X, Phone, User, Store, Filter, Award, ChevronRight, ArrowRight,
  PieChart, BarChart3, Activity, Percent, Crown, Briefcase, FileBarChart, Layers, Edit2, Trash2, ArrowDownRight,
  MessageCircle, Search, Scissors, Copy, ChevronUp
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

// 1. Interactive Circular Donut Chart for Treasuries and Payment Methods
function PaymentMethodsDonutChart({
  revenueStats,
  currency,
  onViewAll,
  customSlices,
  title = 'توزيع حركة الخزائن والمقبوضات'
}: {
  revenueStats: any;
  currency: string;
  onViewAll?: () => void;
  customSlices?: PaymentSlice[];
  title?: string;
}) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const defaultSlices: PaymentSlice[] = [
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

  const rawSlices: PaymentSlice[] = customSlices && customSlices.length > 0 ? customSlices : defaultSlices;
  const total = rawSlices.reduce((sum, s) => sum + (s.amount > 0 ? s.amount : 0), 0) || revenueStats.totalRevenue || 0;
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
          <span>{title}</span>
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

export type OwnerPeriod = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'all' | 'custom';

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
  onNavigateScreen?: (screenName: string) => void;
  standalone?: boolean;
  onLogout?: () => void;
  expenses?: any[];
  purchases?: any[];
  supplierPayments?: any[];
  partners?: Partner[];
  setPartners?: (updater: Partner[] | ((prev: Partner[]) => Partner[])) => void;
  partnerTransactions?: PartnerTransaction[];
  setPartnerTransactions?: (updater: PartnerTransaction[] | ((prev: PartnerTransaction[]) => PartnerTransaction[])) => void;
  setTransactions?: (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  shiftData?: { isOpen: boolean; date: string; initialCash?: number };
  fingerprintLogs?: any[];
}

const isStaffAdvance = (t: any) => {
  const isOut = t.type === 'out' || (t.type as string) === 'expense';
  if (!isOut) return false;
  const cat = (t.category || '').toLowerCase();
  const expCat = ((t as any).expenseCategory || '').toLowerCase();
  const desc = (t.description || '').toLowerCase();
  return (
    cat === 'staff_advance' ||
    cat === 'hr_advance' ||
    cat === 'advance' ||
    cat.includes('سلف') ||
    expCat.includes('سلف') ||
    desc.includes('سلفة') ||
    desc.includes('سلف')
  );
};

const isStaffSalary = (t: any) => {
  const isOut = t.type === 'out' || (t.type as string) === 'expense';
  if (!isOut) return false;
  const cat = (t.category || '').toLowerCase();
  const expCat = ((t as any).expenseCategory || '').toLowerCase();
  const desc = (t.description || '').toLowerCase();
  const id = (t.id || '');
  return (
    id.startsWith('TRX-SAL-') ||
    cat === 'salaries' ||
    cat === 'salary' ||
    cat.includes('رواتب') ||
    cat.includes('راتب') ||
    expCat.includes('رواتب') ||
    expCat.includes('راتب') ||
    desc.includes('صرف راتب') ||
    desc.includes('مسير رواتب')
  );
};

const isSupplierOrPurchase = (t: any) => {
  const isOut = t.type === 'out' || (t.type as string) === 'expense';
  if (!isOut) return false;
  const cat = (t.category || '').toLowerCase();
  const id = (t.id || '');
  return id.startsWith('TRX-SUP-') || cat === 'supplier_payment' || cat === 'purchase' || cat.includes('مورد');
};

const isPartnerWithdrawal = (t: any) => {
  const isOut = t.type === 'out' || (t.type as string) === 'expense';
  if (!isOut) return false;
  const cat = (t.category || '').toLowerCase();
  const id = (t.id || '');
  return id.startsWith('TRX-PARTNER-') || cat === 'profit_share' || cat.includes('شريك');
};

const isOperatingExpense = (t: any) => {
  const isOut = t.type === 'out' || (t.type as string) === 'expense';
  if (!isOut) return false;
  if (isStaffAdvance(t)) return false;
  if (isStaffSalary(t)) return false;
  if (isSupplierOrPurchase(t)) return false;
  if (isPartnerWithdrawal(t)) return false;
  return true;
};

const isBookingAdvanceTrx = (t: any) => {
  if (t.type !== 'in') return false;
  const cat = (t.category || '').toLowerCase();
  const desc = (t.description || '').toLowerCase();
  if (cat === 'booking_advance' || cat === 'مقدم حجز' || cat === 'عربون حجز' || cat === 'عربون' || cat === 'حجز') return true;
  if (cat === 'advance' && !desc.includes('سلف')) return true;
  if (desc.includes('مقدم حجز') || desc.includes('عربون حجز') || desc.includes('عربون') || desc.includes('دفعة مقدمة')) return true;
  return false;
};

// استخراج التاريخ الفعلي لسداد مقدم الحجز (تاريخ الدفعة الفعلي أو تاريخ الوردية أو تاريخ الإنشاء) دون الاعتماد على موعد تنفيذ الحجز المستقبلي
const getAdvanceEffectiveDate = (adv: any, b: any): string => {
  const shiftDateVal = adv?.shiftDate || (adv as any)?.shift_date || b?.shiftDate || (b as any)?.shift_date;
  if (shiftDateVal && typeof shiftDateVal === 'string' && shiftDateVal.trim()) {
    return shiftDateVal.includes('T') ? shiftDateVal.split('T')[0].trim() : shiftDateVal.split(' ')[0].trim();
  }
  const advDate = adv?.paymentDate || (adv as any)?.payment_date || adv?.date;
  if (advDate && typeof advDate === 'string' && advDate.trim()) {
    const cleanAdv = advDate.includes('T') ? advDate.split('T')[0].trim() : advDate.split(' ')[0].trim();
    if (new Date(cleanAdv).getTime() <= Date.now() + 86400000) {
      return cleanAdv;
    }
  }
  const created = (b as any)?.createdAt || (b as any)?.created_at;
  if (created && typeof created === 'string' && created.trim()) {
    const cleanCreated = created.includes('T') ? created.split('T')[0].trim() : created.split(' ')[0].trim();
    if (new Date(cleanCreated).getTime() <= Date.now() + 86400000) {
      return cleanCreated;
    }
  }
  if (advDate && typeof advDate === 'string' && advDate.trim()) {
    return advDate.includes('T') ? advDate.split('T')[0].trim() : advDate.split(' ')[0].trim();
  }
  // الموعد المجدول كحل أخير فقط إذا كان في الماضي أو اليوم وليس موعداً مستقبلياً
  const scheduled = b?.date;
  if (scheduled && typeof scheduled === 'string' && scheduled.trim()) {
    const cleanSched = scheduled.includes('T') ? scheduled.split('T')[0].trim() : scheduled.split(' ')[0].trim();
    if (new Date(cleanSched).getTime() <= Date.now() + 86400000) {
      return cleanSched;
    }
  }
  return new Date().toISOString().split('T')[0];
};

// أدوات مساعدة لقراءة تفاصيل الحجوزات ومقدمات الحجز والخدمات بدقة عالية
const getBookingTotalAdvances = (b: any): number => {
  const advances = (b.advancePayments && Array.isArray(b.advancePayments))
    ? b.advancePayments
    : (typeof b.advance_payments === 'string'
      ? (() => { try { return JSON.parse(b.advance_payments); } catch { return []; } })()
      : []);
  const sum = advances.reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);
  if (sum > 0) return sum;
  return Number(b.advancePayment || 0);
};

const getBookingAdvancesList = (b: any): any[] => {
  const advances = (b.advancePayments && Array.isArray(b.advancePayments))
    ? b.advancePayments
    : (typeof b.advance_payments === 'string'
      ? (() => { try { return JSON.parse(b.advance_payments); } catch { return []; } })()
      : []);
  const effectiveCreationDate = (b as any)?.createdAt || (b as any)?.created_at || b?.date || '';
  if (advances.length > 0) {
    return advances.map((a: any, idx: number) => ({
      id: a.id || `${b.id}-adv-${idx}`,
      amount: Number(a.amount) || 0,
      treasuryId: a.treasuryId,
      treasuryName: a.treasuryName,
      date: a.date ? (a.date.includes('T') ? a.date.split('T')[0].trim() : a.date.split(' ')[0].trim()) : (effectiveCreationDate.includes('T') ? effectiveCreationDate.split('T')[0].trim() : effectiveCreationDate),
      time: a.time,
      paymentMethod: a.paymentMethod || a.payment_method || 'cash',
      notes: a.notes
    }));
  }
  if (Number(b.advancePayment || 0) > 0) {
    return [{
      id: `adv-${b.id || 'legacy'}`,
      amount: Number(b.advancePayment),
      date: effectiveCreationDate.includes('T') ? effectiveCreationDate.split('T')[0].trim() : effectiveCreationDate,
      paymentMethod: b.paymentMethod || 'cash',
      notes: b.notes
    }];
  }
  return [];
};

// مطابقة حركة مالية بحجز بطريقة آمنة وصارمة تمنع المطابقة العشوائية
const findBookingForAdvanceTrx = (t: any, allBookings: any[]): any | null => {
  if (!allBookings || allBookings.length === 0) return null;

  // 1. مطابقة مباشرة بمعرف الحجز bookingId
  const tBookingId = (t.bookingId || (t as any).booking_id || '').trim();
  if (tBookingId) {
    const byId = allBookings.find(b => b.id === tBookingId || b.bookingCode === tBookingId);
    if (byId) return byId;
  }

  const desc = (t.description || '').trim();
  if (!desc) return null;

  // 2. مطابقة بكود الحجز (يشترط أن يكون الكود حرفين فأكثر)
  const byCode = allBookings.find(b => {
    const code = (b.bookingCode || '').trim();
    return code.length >= 2 && desc.includes(code);
  });
  if (byCode) return byCode;

  // 3. مطابقة بمعرف الحجز داخل الوصف (يشترط ألا يقل عن 4 أحرف)
  const byBookingIdInDesc = allBookings.find(b => {
    const id = (b.id || '').trim();
    return id.length >= 4 && desc.includes(id);
  });
  if (byBookingIdInDesc) return byBookingIdInDesc;

  // 4. مطابقة برقم هاتف العميل (يشترط ألا يقل عن 7 أرقام)
  const byPhone = allBookings.find(b => {
    const phone = (b.phone || b.clientPhone || '').trim();
    return phone.length >= 7 && desc.includes(phone);
  });
  if (byPhone) return byPhone;

  // 5. مطابقة باسم العميل (يشترط ألا يقل الاسم عن 3 أحرف منعاً للمطابقة العشوائية)
  const byName = allBookings.find(b => {
    const name = (b.clientName || '').trim();
    return name.length >= 3 && desc.includes(name);
  });
  if (byName) return byName;

  return null;
};

// استخراج اسم العميل من نص الوصف عند عدم العثور على الحجز المقترن
const extractClientFromDesc = (desc: string): string => {
  if (!desc) return 'عميل حجز';
  const clientMatch = desc.match(/العميل\s*:\s*([^,\n\r\-]+)/);
  if (clientMatch && clientMatch[1]?.trim()) {
    return clientMatch[1].trim();
  }
  const clean = desc.replace(/^(دفعة\s*مقدمة\s*(\/|\-)?\s*)?(مقدم|عربون)\s*حجز\s*[:-]?\s*/i, '').trim();
  return clean || 'عميل حجز';
};

// استخراج كود الحجز من نص الوصف
const extractBookingCodeFromDesc = (desc: string): string => {
  if (!desc) return 'حجز';
  const codeMatch = desc.match(/#(B-[\w-]+|\d+)/i) || desc.match(/\b(B-\d+)\b/i);
  if (codeMatch && codeMatch[1]) {
    return codeMatch[1].startsWith('#') ? codeMatch[1] : `#${codeMatch[1]}`;
  }
  return 'حجز';
};

// فحص عدم التكرار بين الدفعة المقدمة وسجلات المعاملات المالية المباشرة
const isAdvanceAlreadyInTrx = (adv: any, b: any, periodAdvTrx: any[]): boolean => {
  const advAmt = Number(adv.amount) || 0;
  if (advAmt <= 0) return false;

  return periodAdvTrx.some(t => {
    const tAmt = Number(t.amount) || 0;
    if (Math.abs(tAmt - advAmt) > 0.01) return false;

    // تطابق المعرف المباشر
    if (adv.id && t.id && (t.id === adv.id || t.id.includes(adv.id))) return true;

    // تطابق معرف الحجز
    const tBookingId = (t.bookingId || (t as any).booking_id || '').trim();
    if (tBookingId && (tBookingId === b.id || (b.bookingCode && tBookingId === b.bookingCode))) return true;

    const desc = (t.description || '').trim();
    if (desc) {
      if (b.bookingCode && b.bookingCode.trim().length >= 2 && desc.includes(b.bookingCode.trim())) return true;
      if (b.id && b.id.trim().length >= 4 && desc.includes(b.id.trim())) return true;
      if (b.clientName && b.clientName.trim().length >= 3 && desc.includes(b.clientName.trim())) return true;
    }
    return false;
  });
};

const getBookingTotalAmount = (b: any): number => {
  if (b.totalAmount !== undefined && b.totalAmount !== null && Number(b.totalAmount) > 0) {
    return Number(b.totalAmount);
  }
  if (b.services && Array.isArray(b.services) && b.services.length > 0) {
    return b.services.reduce((s: number, srv: any) => s + (Number(srv.price) || 0), 0);
  }
  return Number(b.price || 0);
};

const getBookingServicesNames = (b: any): string => {
  if (b.services && Array.isArray(b.services) && b.services.length > 0) {
    return b.services.map((s: any) => s.serviceName || s.name).filter(Boolean).join(' + ');
  }
  return b.serviceName || 'خدمة صالون';
};

const getBookingEmployeeNames = (b: any): string => {
  if (b.services && Array.isArray(b.services) && b.services.length > 0) {
    const names = Array.from(new Set(b.services.map((s: any) => s.employeeName).filter(Boolean)));
    if (names.length > 0) return names.join('، ');
  }
  return b.employeeName || '-';
};

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
  expenses = [],
  purchases = [],
  supplierPayments = [],
  partners = [],
  setPartners,
  partnerTransactions = [],
  setPartnerTransactions,
  setTransactions,
  onRefresh,
  isRefreshing: externalRefreshing = false,
  shiftData,
  fingerprintLogs = []
}: OwnerExecutivePortalProps) {
  const currency = settings.currency || 'SAR';
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'profit_equation' | 'partners' | 'finance' | 'attendance' | 'bookings' | 'users'>('overview');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Period & Date Range Filter
  const [period, setPeriod] = useState<OwnerPeriod>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Bookings Filter & Search State
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'created_in_period' | 'scheduled_in_period' | 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'with_advance'>('all');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Finance Revenues Tab Filter (الكل، فواتير، مقدمات حجز)
  const [financeRevenueFilter, setFinanceRevenueFilter] = useState<'all' | 'invoices' | 'advances'>('all');

  // Finance Outflows Tab Filter (الكل، مصروفات تشغيلية، سلف، رواتب)
  const [financeOutflowFilter, setFinanceOutflowFilter] = useState<'all' | 'expenses' | 'salaries' | 'advances'>('all');

  // Salon Treasuries State (Synchronized with Supabase DB)
  const [liveTreasuries, setLiveTreasuries] = useState<Treasury[]>(() => {
    return (settings.treasuries && settings.treasuries.length > 0) ? settings.treasuries : [];
  });

  useEffect(() => {
    if (settings.treasuries && settings.treasuries.length > 0) {
      setLiveTreasuries(settings.treasuries);
    }
  }, [settings.treasuries]);

  useEffect(() => {
    async function loadDbSettings() {
      if (!settings.salonId) return;
      try {
        const dbSettings = await DB.fetchSettings(settings.salonId);
        if (dbSettings?.treasuries && Array.isArray(dbSettings.treasuries) && dbSettings.treasuries.length > 0) {
          setLiveTreasuries(dbSettings.treasuries);
        }
      } catch (e) {
        console.warn('Error fetching settings from DB in owner portal:', e);
      }
    }
    loadDbSettings();
  }, [settings.salonId]);

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
    const localToday = now.toLocaleDateString('en-CA');
    const todayStr = (shiftData?.isOpen && shiftData?.date) ? shiftData.date : localToday;

    if (period === 'all') {
      return { start: '2000-01-01', end: '2099-12-31', label: 'كامل المدة (الكل)' };
    }
    if (period === 'today') {
      return { 
        start: todayStr, 
        end: todayStr, 
        label: (shiftData?.isOpen && shiftData?.date) 
          ? `الوردية المفتوحة (${todayStr})` 
          : `اليوم (${todayStr})` 
      };
    }
    if (period === 'yesterday') {
      const y = new Date(Date.now() - 86400000);
      const yStr = y.toLocaleDateString('en-CA');
      return { start: yStr, end: yStr, label: 'أمس' };
    }
    if (period === 'this_week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { start: d.toLocaleDateString('en-CA'), end: todayStr, label: 'آخر 7 أيام' };
    }
    if (period === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
      return { start: startOfMonth, end: todayStr, label: 'هذا الشهر' };
    }
    if (period === 'last_month') {
      const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-CA');
      const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString('en-CA');
      return { start: startOfLast, end: endOfLast, label: 'الشهر السابق' };
    }
    return {
      start: customStartDate || todayStr,
      end: customEndDate || todayStr,
      label: `${customStartDate} إلى ${customEndDate}`
    };
  }, [period, customStartDate, customEndDate, shiftData]);

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

  const matchesActiveBranch = (itemBranchId?: string) => {
    if (isAllBranches || branches.length <= 1 || !activeBranchId || activeBranchId === 'all') return true;
    if (!itemBranchId) return true;
    if (itemBranchId === activeBranchId) return true;
    if (isMainBranch && (itemBranchId === mainBranchId || itemBranchId === 'b-main')) return true;
    return false;
  };

  const isDateInSelectedPeriod = (dateVal?: any) => {
    if (!dateVal) return false;
    if (period === 'all') return true;
    let cleanDate = '';
    if (typeof dateVal === 'string') {
      cleanDate = dateVal.includes('T') ? dateVal.split('T')[0] : dateVal.split(' ')[0];
    } else if (typeof dateVal === 'number' || dateVal instanceof Date) {
      try {
        cleanDate = new Date(dateVal).toLocaleDateString('en-CA');
      } catch {
        cleanDate = String(dateVal);
      }
    } else {
      cleanDate = String(dateVal);
    }
    const d = cleanDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || cleanDate;

    if (period === 'today') {
      // إذا كانت الوردية مفتوحة، الارتباط حصرياً بتاريخ الوردية المفتوحة وليس تاريخ اليوم
      if (shiftData?.isOpen && shiftData?.date) {
        const targetShift = shiftData.date.split('T')[0].trim();
        return d === targetShift;
      }
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const utcToday = now.toISOString().split('T')[0];
      return d === localToday || d === utcToday;
    }

    return d >= dateRange.start && d <= dateRange.end;
  };

  // 1. Financial Filtering & Calculations for Selected Period (Filtered by active branch / all branches)
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const isBranchMatch = matchesActiveBranch(inv.branchId);
      if (!isBranchMatch || inv.status === 'cancelled') return false;

      // عندما تكون الفترة هي اليوم وهناك وردية مفتوحة، الارتباط حصراً بتاريخ الوردية المفتوحة ومقارنته بتاريخ الفاتورة الفعلي
      if (period === 'today' && shiftData?.isOpen && shiftData?.date) {
        const targetShift = shiftData.date.split('T')[0].trim();
        const invDateOnly = (inv.date || inv.shiftDate || (inv as any).shift_date || '').split('T')[0].split(' ')[0].trim();
        return invDateOnly === targetShift;
      }

      const invDate = (inv.date || inv.shiftDate || (inv as any).shift_date || '').split('T')[0].split(' ')[0].trim();
      return isDateInSelectedPeriod(invDate);
    });
  }, [invoices, dateRange, activeBranchId, isMainBranch, isAllBranches, period, shiftData]);

  const todayInvoices = filteredInvoices; // Backward compatibility alias

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isBranchMatch = matchesActiveBranch((t as any).branchId);
      if (!isBranchMatch) return false;

      // عندما تكون الفترة هي اليوم وهناك وردية مفتوحة، الارتباط حصراً بتاريخ الوردية المفتوحة ومقارنته بتاريخ المعاملة الفعلي
      if (period === 'today' && shiftData?.isOpen && shiftData?.date) {
        const targetShift = shiftData.date.split('T')[0].trim();
        const tDateOnly = (t.date || t.shiftDate || (t as any).shift_date || '').split('T')[0].split(' ')[0].trim();
        return tDateOnly === targetShift;
      }

      const tDate = (t.date || t.shiftDate || (t as any).shift_date || '').split('T')[0].split(' ')[0].trim();
      return isDateInSelectedPeriod(tDate);
    });
  }, [transactions, dateRange, activeBranchId, isMainBranch, period, shiftData]);

  const todayTransactions = filteredTransactions;

  // قائمة مقدمات الحجز المحصلة خلال الفترة مع كافة بياناتها التفصيلية بدقة متناهية
  const bookingAdvancesList = useMemo(() => {
    const list: Array<{
      id: string;
      bookingId: string;
      bookingCode: string;
      clientName: string;
      clientPhone: string;
      amount: number;
      date: string;
      time: string;
      paymentMethod: string;
      treasuryName: string;
      servicesSummary: string;
      notes?: string;
    }> = [];

    const periodAdvTrx = filteredTransactions.filter(isBookingAdvanceTrx);

    // 1. من سجل المعاملات المالية المباشرة لمقدمات الحجز خلال الفترة
    periodAdvTrx.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (amt <= 0) return;
      const targetId = t.treasury || (t as any).treasuryId || '';
      const treasuryObj = (settings.treasuries || []).find(tr => tr.id === targetId || tr.name === targetId);
      const matchedBooking = findBookingForAdvanceTrx(t, bookings || []);

      list.push({
        id: t.id,
        bookingId: matchedBooking?.id || (t.bookingId || (t as any).booking_id || ''),
        bookingCode: matchedBooking?.bookingCode || extractBookingCodeFromDesc(t.description || ''),
        clientName: matchedBooking?.clientName || extractClientFromDesc(t.description || ''),
        clientPhone: matchedBooking?.phone || matchedBooking?.clientPhone || '',
        amount: amt,
        date: t.date?.split('T')[0] || t.shiftDate || (t as any).shift_date || '',
        time: t.date?.split('T')[1]?.substring(0, 5) || matchedBooking?.time || '',
        paymentMethod: t.paymentMethod || treasuryObj?.name || 'نقدي',
        treasuryName: treasuryObj?.name || t.treasury || 'الخزنة',
        servicesSummary: matchedBooking ? getBookingServicesNames(matchedBooking) : (t.description || 'مقدم حجز'),
        notes: t.notes || matchedBooking?.notes
      });
    });

    // 2. من سجل الحجوزات المسجلة (فقط الحجوزات التي تم سداد مقدمها أو إنشاؤها خلال الفترة المحددة)
    (bookings || []).forEach(b => {
      if (b.status === 'cancelled' || !matchesActiveBranch((b as any).branchId)) return;
      const advances = getBookingAdvancesList(b);

      advances.forEach((adv: any, idx: number) => {
        const advDate = getAdvanceEffectiveDate(adv, b);
        if (isDateInSelectedPeriod(advDate)) {
          const amt = Number(adv.amount) || 0;
          if (amt <= 0) return;
          const already = isAdvanceAlreadyInTrx(adv, b, periodAdvTrx);
          if (!already) {
            const targetId = adv.treasuryId || adv.paymentMethod || 'cash';
            const treasuryObj = (settings.treasuries || []).find(tr => tr.id === targetId || tr.name === targetId);
            list.push({
              id: adv.id || `${b.id}-adv-${idx}`,
              bookingId: b.id,
              bookingCode: b.bookingCode || `#${b.id.substring(0, 6)}`,
              clientName: b.clientName || 'عميل حجز',
              clientPhone: b.phone || b.clientPhone || '',
              amount: amt,
              date: advDate,
              time: adv.time || b.time || '',
              paymentMethod: adv.paymentMethod || treasuryObj?.name || 'نقدي',
              treasuryName: treasuryObj?.name || adv.treasuryName || 'الخزنة',
              servicesSummary: getBookingServicesNames(b),
              notes: adv.notes || b.notes
            });
          }
        }
      });
    });

    return list;
  }, [filteredTransactions, bookings, settings.treasuries, dateRange, activeBranchId]);

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
      const rawNet = (inv.netAmount !== undefined && inv.netAmount !== null) ? Number(inv.netAmount) : 0;
      const rawTotal = (inv.total !== undefined && inv.total !== null) ? Number(inv.total) : 0;
      const rawPaid = ((inv as any).paid !== undefined && (inv as any).paid !== null) ? Number((inv as any).paid) : 0;
      const net = rawNet > 0 ? rawNet : (rawTotal > 0 ? rawTotal : rawPaid);
      totalRevenue += net;

      // Check payments array, paymentMethods, or single method
      const splits = (inv.paymentMethods && inv.paymentMethods.length > 0)
        ? inv.paymentMethods
        : ((inv as any).payments && (inv as any).payments.length > 0)
          ? (inv as any).payments
          : null;

      if (splits && splits.length > 0) {
        splits.forEach((p: any) => {
          const amt = Number(p.amount) || 0;
          const targetId = p.treasuryId || p.treasury || p.method || '';
          const treasuryObj = (settings.treasuries || []).find(t => t.id === targetId || t.name === targetId);
          const descriptor = `${targetId} ${treasuryObj?.name || ''} ${treasuryObj?.type || ''}`.toLowerCase();

          if (descriptor.includes('mada') || descriptor.includes('شبكة') || descriptor.includes('مدى') || descriptor.includes('pos') || descriptor.includes('card')) {
            card += amt;
          } else if (descriptor.includes('visa') || descriptor.includes('فيزا') || descriptor.includes('credit') || descriptor.includes('ماستر') || descriptor.includes('master')) {
            credit += amt;
          } else if (descriptor.includes('bank') || descriptor.includes('تحويل') || descriptor.includes('بنك') || descriptor.includes('transfer')) {
            bankTransfer += amt;
          } else if (descriptor.includes('tamara') || descriptor.includes('tabby') || descriptor.includes('تابي') || descriptor.includes('تمارا')) {
            tabTamara += amt;
          } else if (descriptor.includes('cash') || descriptor.includes('نقدي') || descriptor.includes('كاش')) {
            cash += amt;
          } else {
            other += amt;
          }
        });
      } else {
        const method = (inv.paymentMethod || (inv as any).treasury || '').toLowerCase();
        const treasuryObj = (settings.treasuries || []).find(t => t.id === method || t.name === method);
        const descriptor = `${method} ${treasuryObj?.name || ''} ${treasuryObj?.type || ''}`.toLowerCase();

        if (descriptor.includes('mada') || descriptor.includes('شبكة') || descriptor.includes('مدى') || descriptor.includes('pos') || descriptor.includes('card')) {
          card += net;
        } else if (descriptor.includes('visa') || descriptor.includes('فيزا') || descriptor.includes('credit') || descriptor.includes('ماستر') || descriptor.includes('master')) {
          credit += net;
        } else if (descriptor.includes('bank') || descriptor.includes('تحويل') || descriptor.includes('بنك') || descriptor.includes('transfer')) {
          bankTransfer += net;
        } else if (descriptor.includes('tamara') || descriptor.includes('tabby') || descriptor.includes('تابي') || descriptor.includes('تمارا')) {
          tabTamara += net;
        } else {
          cash += net; // Default fallback
        }
      }
    });

    // مقدمات وعربون الحجز المحصلة ضمن الفترة من القائمة الموحدة
    bookingAdvancesList.forEach(adv => {
      const amt = Number(adv.amount) || 0;
      if (amt <= 0) return;
      totalRevenue += amt;
      const descriptor = `${adv.treasuryName || ''} ${adv.paymentMethod || ''}`.toLowerCase();
      if (descriptor.includes('mada') || descriptor.includes('شبكة') || descriptor.includes('مدى') || descriptor.includes('pos') || descriptor.includes('card')) {
        card += amt;
      } else if (descriptor.includes('visa') || descriptor.includes('فيزا') || descriptor.includes('credit') || descriptor.includes('ماستر') || descriptor.includes('master')) {
        credit += amt;
      } else if (descriptor.includes('bank') || descriptor.includes('تحويل') || descriptor.includes('بنك') || descriptor.includes('transfer')) {
        bankTransfer += amt;
      } else {
        cash += amt;
      }
    });

    // 1. Operating Expenses (excluding salaries, advances, supplier payments, partner shares)
    const directExpenseTx = filteredTransactions.filter(isOperatingExpense);
    const customExpenses = (expenses || []).filter(e => {
      const expDate = (e.date || e.shiftDate || (e as any).shift_date || '').split('T')[0].split(' ')[0].trim();
      const inPeriod = isDateInSelectedPeriod(expDate);
      const isBranchMatch = matchesActiveBranch(e.branchId);
      return inPeriod && isBranchMatch;
    });
    const sumCustom = customExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const sumDirect = directExpenseTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalExpenses = Math.max(sumCustom, sumDirect);

    // 2. Staff Salaries Disbursed
    let totalSalaries = 0;
    const activeStaff = employees.filter(e => matchesActiveBranch((e as any).branchId));
    activeStaff.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        if (isDateInSelectedPeriod(rec.date) && rec.type === 'salary') {
          totalSalaries += Number(rec.amount) || 0;
        }
      });
    });
    const trxSalaries = filteredTransactions.filter(isStaffSalary);
    if (totalSalaries === 0) {
      totalSalaries = trxSalaries.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    } else {
      trxSalaries.forEach(t => {
        const amt = Number(t.amount) || 0;
        const alreadyCounted = activeStaff.some(emp => 
          (emp.financialRecords || []).some((rec: any) => 
            rec.type === 'salary' && 
            Math.abs((Number(rec.amount) || 0) - amt) < 0.01 &&
            isDateInSelectedPeriod(rec.date)
          )
        );
        if (!alreadyCounted) totalSalaries += amt;
      });
    }

    // 3. Staff Advances
    let totalAdvances = 0;
    activeStaff.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        const isSal = rec.id?.startsWith('FIN-SAL-') || rec.note?.includes('مسير رواتب') || rec.note?.includes('تم استلام صافي الراتب');
        if (isDateInSelectedPeriod(rec.date) && rec.type === 'advance' && !isSal) {
          totalAdvances += Number(rec.amount) || 0;
        }
      });
    });
    const trxAdvances = filteredTransactions.filter(isStaffAdvance);
    if (totalAdvances === 0) {
      totalAdvances = trxAdvances.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    } else {
      trxAdvances.forEach(t => {
        const amt = Number(t.amount) || 0;
        const alreadyCounted = activeStaff.some(emp => 
          (emp.financialRecords || []).some((rec: any) => 
            rec.type === 'advance' && 
            Math.abs((Number(rec.amount) || 0) - amt) < 0.01 &&
            isDateInSelectedPeriod(rec.date)
          )
        );
        if (!alreadyCounted) totalAdvances += amt;
      });
    }

    const totalOutflows = totalExpenses + totalSalaries + totalAdvances;
    const netProfit = totalRevenue - totalOutflows;
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
      totalSalaries,
      totalAdvances,
      totalOutflows,
      netProfit,
      invoiceCount: filteredInvoices.length,
      avgTicket
    };
  }, [filteredInvoices, filteredTransactions, bookings, settings.treasuries, activeBranchId, isMainBranch, isAllBranches, period, dateRange, employees, expenses, bookingAdvancesList]);

  // ---- حسابات وأرصدة الخزائن المسجلة في النظام (Registered Treasuries Balances & Stats) ----
  const treasuryStats = useMemo(() => {
    const definedTreasuries = (liveTreasuries && liveTreasuries.length > 0)
      ? liveTreasuries
      : (settings.treasuries && settings.treasuries.length > 0)
        ? settings.treasuries
        : [
            { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
            { id: 'cash', name: 'كاش (الدرج)', isMain: false },
            { id: 'card', name: 'شبكة / فيزا', isMain: false }
          ];

    const palette = [
      { color: '#10B981', hoverColor: '#34D399', textColor: 'text-emerald-400', bgBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: Banknote },
      { color: '#0EA5E9', hoverColor: '#38BDF8', textColor: 'text-sky-400', bgBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/30', icon: CreditCard },
      { color: '#8B5CF6', hoverColor: '#A78BFA', textColor: 'text-purple-400', bgBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: Building2 },
      { color: '#F59E0B', hoverColor: '#FBBF24', textColor: 'text-amber-400', bgBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Wallet },
      { color: '#EC4899', hoverColor: '#F472B6', textColor: 'text-pink-400', bgBadge: 'bg-pink-500/20 text-pink-300 border-pink-500/30', icon: Smartphone },
      { color: '#14B8A6', hoverColor: '#2DD4BF', textColor: 'text-teal-400', bgBadge: 'bg-teal-500/20 text-teal-300 border-teal-500/30', icon: Wallet }
    ];

    const stats = definedTreasuries.map((t, idx) => {
      // Period transactions for this treasury
      const periodTrxs = filteredTransactions.filter(trx => trx.treasury === t.id || (trx as any).treasuryId === t.id);
      // All lifetime transactions for this treasury
      const allTrxs = transactions.filter(trx => trx.treasury === t.id || (trx as any).treasuryId === t.id);

      // Inflows in period
      const totalIn = periodTrxs.filter(trx => trx.type === 'in').reduce((sum, trx) => sum + (Number(trx.amount) || 0), 0);
      // Outflows in period
      const totalOut = periodTrxs.filter(trx => trx.type === 'out').reduce((sum, trx) => sum + (Number(trx.amount) || 0), 0);
      const periodBalance = totalIn - totalOut;

      // Lifetime balance
      const lifetimeIn = allTrxs.filter(trx => trx.type === 'in').reduce((sum, trx) => sum + (Number(trx.amount) || 0), 0);
      const lifetimeOut = allTrxs.filter(trx => trx.type === 'out').reduce((sum, trx) => sum + (Number(trx.amount) || 0), 0);
      const lifetimeBalance = lifetimeIn - lifetimeOut;

      // Invoices collected for this treasury in the period
      let invoicesCollected = 0;
      filteredInvoices.forEach(inv => {
        const rawNet = (inv.netAmount !== undefined && inv.netAmount !== null) ? Number(inv.netAmount) : 0;
        const rawTotal = (inv.total !== undefined && inv.total !== null) ? Number(inv.total) : 0;
        const rawPaid = ((inv as any).paid !== undefined && (inv as any).paid !== null) ? Number((inv as any).paid) : 0;
        const net = rawNet > 0 ? rawNet : (rawTotal > 0 ? rawTotal : rawPaid);

        const splits = (inv.paymentMethods && inv.paymentMethods.length > 0)
          ? inv.paymentMethods
          : ((inv as any).payments && (inv as any).payments.length > 0)
            ? (inv as any).payments
            : null;

        if (splits && splits.length > 0) {
          splits.forEach((p: any) => {
            const targetId = p.treasuryId || p.treasury || p.method || '';
            if (targetId === t.id || targetId === t.name) {
              invoicesCollected += Number(p.amount) || 0;
            }
          });
        } else {
          const m = inv.paymentMethod || (inv as any).treasury || '';
          if (m === t.id || m === t.name || (!m && (t.id === 'cash' || t.name.includes('كاش')))) {
            invoicesCollected += net;
          }
        }
      });

      // إضافة مقدمات وعربون الحجز المحصلة في هذه الخزينة من القائمة الموحدة
      const advancesForTreasury = bookingAdvancesList.filter(adv => {
        const target = adv.treasuryName || adv.paymentMethod || '';
        return target === t.id || target === t.name || (t.id === 'cash' && (target === 'نقدي' || target === 'cash' || target.includes('كاش')));
      });
      invoicesCollected += advancesForTreasury.reduce((sum, adv) => sum + (Number(adv.amount) || 0), 0);

      const style = palette[idx % palette.length];

      return {
        treasury: t,
        id: t.id,
        name: t.name,
        isMain: Boolean(t.isMain),
        totalIn,
        totalOut,
        periodBalance,
        lifetimeBalance,
        invoicesCollected,
        color: style.color,
        hoverColor: style.hoverColor,
        textColor: style.textColor,
        bgBadge: style.bgBadge,
        icon: t.isMain ? Building2 : (t.id === 'card' || t.name.includes('شبكة') || t.name.includes('فيزا')) ? CreditCard : (t.name.includes('انستاباي') || t.name.includes('فودافون') || t.name.includes('محفظة')) ? Smartphone : Banknote
      };
    });

    // Generate donut slices for treasuries (based on invoicesCollected, totalIn, or positive period balance)
    const slices: PaymentSlice[] = stats.map(s => {
      const displayAmount = s.invoicesCollected > 0 ? s.invoicesCollected : (s.totalIn > 0 ? s.totalIn : (s.periodBalance > 0 ? s.periodBalance : 0));
      return {
        id: s.id,
        name: s.name,
        amount: displayAmount,
        color: s.color,
        hoverColor: s.hoverColor,
        textColor: s.textColor,
        bgBadge: s.bgBadge,
        icon: s.icon
      };
    });

    const totalPeriodTreasuryIn = stats.reduce((sum, s) => sum + s.totalIn, 0);
    const totalPeriodTreasuryOut = stats.reduce((sum, s) => sum + s.totalOut, 0);
    const totalLifetimeTreasuryBalance = stats.reduce((sum, s) => sum + s.lifetimeBalance, 0);
    const totalInvoicesCollected = stats.reduce((sum, s) => sum + s.invoicesCollected, 0);

    return {
      list: stats,
      slices,
      totalPeriodTreasuryIn,
      totalPeriodTreasuryOut,
      totalLifetimeTreasuryBalance,
      totalInvoicesCollected
    };
  }, [liveTreasuries, settings.treasuries, filteredTransactions, transactions, filteredInvoices, bookings, activeBranchId, isMainBranch, isAllBranches, period, dateRange]);

  // ---- معادلة صافي الربح الدقيقة (Net Profit Equation Analysis) ----
  // صافي الربح = إجمالي الدخل من الفواتير - جميع المصروفات - الرواتب - السلف - (المسدد في المشتريات + دفعات الموردين) - عمولات الموظفين
  const netProfitData = useMemo(() => {
    // 1. Gross Invoiced Income
    const grossInvoicesIncome = filteredInvoices.reduce((sum, inv) => {
      const rawPaid = ((inv as any).paid !== undefined && (inv as any).paid !== null) ? Number((inv as any).paid) : 0;
      const rawTotal = (inv.total !== undefined && inv.total !== null) ? Number(inv.total) : 0;
      const rawNet = (inv.netAmount !== undefined && inv.netAmount !== null) ? Number(inv.netAmount) : 0;
      const paid = (inv.paidAmount !== undefined && Number(inv.paidAmount) > 0)
        ? Number(inv.paidAmount)
        : (rawPaid > 0 ? rawPaid : (rawTotal > 0 ? rawTotal : rawNet));
      return sum + paid;
    }, 0);

    // 1.b Booking Advances (مقدمات وعربون الحجز المحصلة من القائمة الموحدة)
    const totalBookingAdvances = bookingAdvancesList.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const bookingAdvancesCount = bookingAdvancesList.length;

    const grossIncome = grossInvoicesIncome + totalBookingAdvances;

    // 2. All Expenses (Operating Expenses)
    const directExpenseTx = filteredTransactions.filter(isOperatingExpense);
    const customExpenses = (expenses || []).filter(e => {
      const expDate = (e.date || e.shiftDate || (e as any).shift_date || '').split('T')[0].split(' ')[0].trim();
      const inPeriod = isDateInSelectedPeriod(expDate);
      const isBranchMatch = matchesActiveBranch(e.branchId);
      return inPeriod && isBranchMatch;
    });

    const sumCustom = customExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const sumDirect = directExpenseTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalExpenses = Math.max(sumCustom, sumDirect);

    // 3. Salaries Disbursed & Advances
    let totalSalaries = 0;
    let totalAdvances = 0;

    const activeStaff = employees.filter(e => matchesActiveBranch((e as any).branchId));
    activeStaff.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        if (isDateInSelectedPeriod(rec.date)) {
          if (rec.type === 'salary') totalSalaries += Number(rec.amount) || 0;
          if (rec.type === 'advance') {
            const isSal = rec.id?.startsWith('FIN-SAL-') || rec.note?.includes('مسير رواتب') || rec.note?.includes('تم استلام صافي الراتب');
            if (!isSal) totalAdvances += Number(rec.amount) || 0;
          }
        }
      });
    });

    const trxSalaries = filteredTransactions.filter(isStaffSalary);
    if (totalSalaries === 0) {
      totalSalaries = trxSalaries.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    } else {
      trxSalaries.forEach(t => {
        const amt = Number(t.amount) || 0;
        const alreadyCounted = activeStaff.some(emp => 
          (emp.financialRecords || []).some((rec: any) => 
            rec.type === 'salary' && 
            Math.abs((Number(rec.amount) || 0) - amt) < 0.01 &&
            isDateInSelectedPeriod(rec.date)
          )
        );
        if (!alreadyCounted) {
          totalSalaries += amt;
        }
      });
    }

    const trxAdvances = filteredTransactions.filter(isStaffAdvance);
    if (totalAdvances === 0) {
      totalAdvances = trxAdvances.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    } else {
      trxAdvances.forEach(t => {
        const amt = Number(t.amount) || 0;
        const alreadyCounted = activeStaff.some(emp => 
          (emp.financialRecords || []).some((rec: any) => 
            rec.type === 'advance' && 
            Math.abs((Number(rec.amount) || 0) - amt) < 0.01 &&
            isDateInSelectedPeriod(rec.date)
          )
        );
        if (!alreadyCounted) {
          totalAdvances += amt;
        }
      });
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
      { 
        id: 'invoices_income', 
        label: 'إيرادات فواتير المبيعات المسددة', 
        amount: grossInvoicesIncome, 
        type: 'plus', 
        percent: grossIncome > 0 ? (grossInvoicesIncome / grossIncome) * 100 : 100, 
        note: `${filteredInvoices.length} فاتورة مبيعات مسددة بالكامل (${grossInvoicesIncome.toFixed(0)} ${currency})` 
      },
      { 
        id: 'booking_advances', 
        label: 'مقدم حجز (مقدمات وعربون الحجوزات المحصلة)', 
        amount: totalBookingAdvances, 
        type: 'plus', 
        percent: grossIncome > 0 ? (totalBookingAdvances / grossIncome) * 100 : 0, 
        note: `${bookingAdvancesCount} دفعة مقدم حجز محصلة (${totalBookingAdvances.toFixed(0)} ${currency})` 
      },
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
      grossInvoicesIncome,
      totalBookingAdvances,
      bookingAdvancesCount,
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
  }, [filteredInvoices, filteredTransactions, bookings, expenses, purchases, supplierPayments, employees, dateRange, matchesActiveBranch, currency, bookingAdvancesList]);

  // ---- مقارنة أداء ومصروفات وصافي أرباح الفروع (Branch Performance Comparison) ----
  const branchComparisonData = useMemo(() => {
    return (branches || []).map(br => {
      const isBrMatch = (bId?: string) => bId ? bId === br.id : (br.isMain || br.id === 'b-main');
      
      const brInvoices = invoices.filter(inv => isBrMatch(inv.branchId) && isDateInSelectedPeriod(inv.date) && inv.status !== 'cancelled');
      const brInvoicesGross = brInvoices.reduce((s, inv) => {
        const rawPaid = ((inv as any).paid !== undefined && (inv as any).paid !== null) ? Number((inv as any).paid) : 0;
        const rawTotal = (inv.total !== undefined && inv.total !== null) ? Number(inv.total) : 0;
        const rawNet = (inv.netAmount !== undefined && inv.netAmount !== null) ? Number(inv.netAmount) : 0;
        const paid = (inv.paidAmount !== undefined && Number(inv.paidAmount) > 0)
          ? Number(inv.paidAmount)
          : (rawPaid > 0 ? rawPaid : (rawTotal > 0 ? rawTotal : rawNet));
        return s + paid;
      }, 0);

      // Branch booking advances from unified bookingAdvancesList
      const brBookingAdvancesList = bookingAdvancesList.filter(adv => {
        const b = (bookings || []).find(x => x.id === adv.bookingId);
        if (b) return isBrMatch((b as any).branchId);
        const t = (transactions || []).find(x => x.id === adv.id);
        if (t) return isBrMatch((t as any).branchId);
        return isBrMatch((adv as any).branchId);
      });
      const brBookingAdvances = brBookingAdvancesList.reduce((s, a) => s + (Number(a.amount) || 0), 0);

      const brGross = brInvoicesGross + brBookingAdvances;

      const brDirectExpTx = (transactions || []).filter(t => 
        isBrMatch((t as any).branchId) && 
        isOperatingExpense(t) && 
        (isDateInSelectedPeriod(t.date) || (t.shiftDate && isDateInSelectedPeriod(t.shiftDate)) || ((t as any).shift_date && isDateInSelectedPeriod((t as any).shift_date)))
      );
      const brCustomExp = (expenses || []).filter(e => {
        const inPeriod = isDateInSelectedPeriod(e.date) || 
          (e.shiftDate && isDateInSelectedPeriod(e.shiftDate)) || 
          ((e as any).shift_date && isDateInSelectedPeriod((e as any).shift_date));
        return inPeriod && isBrMatch(e.branchId);
      });
      const brExp = Math.max(
        brCustomExp.reduce((s, e) => s + (Number(e.amount) || 0), 0),
        brDirectExpTx.reduce((s, t) => s + (Number(t.amount) || 0), 0)
      );

      const brStaff = employees.filter(e => isBrMatch((e as any).branchId));
      let brSalaries = 0;
      let brAdvances = 0;
      let brCommissions = 0;

      brStaff.forEach(emp => {
        (emp.financialRecords || []).forEach((rec: any) => {
          if (isDateInSelectedPeriod(rec.date)) {
            if (rec.type === 'salary') brSalaries += Number(rec.amount) || 0;
            if (rec.type === 'advance') {
              const isSal = rec.id?.startsWith('FIN-SAL-') || rec.note?.includes('مسير رواتب') || rec.note?.includes('تم استلام صافي الراتب');
              if (!isSal) brAdvances += Number(rec.amount) || 0;
            }
            if (rec.type === 'commission' || rec.type === 'service_commission') brCommissions += Number(rec.amount) || 0;
          }
        });
      });

      const brSalTrx = (transactions || []).filter(t => 
        isBrMatch(t.branchId) && 
        isStaffSalary(t) && 
        (isDateInSelectedPeriod(t.date) || (t.shiftDate && isDateInSelectedPeriod(t.shiftDate)))
      );
      if (brSalaries === 0) {
        brSalaries = brSalTrx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      } else {
        brSalTrx.forEach(t => {
          const amt = Number(t.amount) || 0;
          const already = brStaff.some(emp => 
            (emp.financialRecords || []).some((rec: any) => 
              rec.type === 'salary' && 
              Math.abs((Number(rec.amount) || 0) - amt) < 0.01 && 
              isDateInSelectedPeriod(rec.date)
            )
          );
          if (!already) brSalaries += amt;
        });
      }

      const brAdvTrx = (transactions || []).filter(t => 
        isBrMatch(t.branchId) && 
        isStaffAdvance(t) && 
        (isDateInSelectedPeriod(t.date) || (t.shiftDate && isDateInSelectedPeriod(t.shiftDate)))
      );
      if (brAdvances === 0) {
        brAdvances = brAdvTrx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      } else {
        brAdvTrx.forEach(t => {
          const amt = Number(t.amount) || 0;
          const already = brStaff.some(emp => 
            (emp.financialRecords || []).some((rec: any) => 
              rec.type === 'advance' && 
              Math.abs((Number(rec.amount) || 0) - amt) < 0.01 && 
              isDateInSelectedPeriod(rec.date)
            )
          );
          if (!already) brAdvances += amt;
        });
      }

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
  }, [branches, invoices, transactions, bookings, expenses, purchases, supplierPayments, employees, dateRange]);

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

  // ---- معالجات الشركاء (Partner Handlers - Bound to Supabase DB) ----
  const handleSavePartner = async (e: React.FormEvent) => {
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
      try {
        await DB.savePartner(updatedPartner, settings.salonId);
      } catch (err) {
        console.warn('DB.savePartner error:', err);
      }
    } else {
      const newPartner: Partner = {
        id: 'PRT-' + Math.random().toString(36).substring(2, 9),
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
      try {
        await DB.savePartner(newPartner, settings.salonId);
      } catch (err) {
        console.warn('DB.savePartner error:', err);
      }
    }

    setShowAddPartnerModal(false);
    setEditingPartner(null);
    setPartnerFormData({ name: '', phone: '', idNumber: '', capitalShare: 0, notes: '' });
  };

  const handleRecordPartnerTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerForTx || partnerTxData.amount <= 0) return;

    const newTx: PartnerTransaction = {
      id: 'PTX-' + Math.random().toString(36).substring(2, 9),
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
    try {
      await DB.savePartnerTransaction(newTx, settings.salonId);
    } catch (err) {
      console.warn('DB.savePartnerTransaction error:', err);
    }

    if (setTransactions) {
      const treasuryTx: Transaction = {
        id: 'TX-PRT-' + Math.random().toString(36).substring(2, 9),
        branchId: activeBranchId === 'all' ? branches[0]?.id : activeBranchId,
        date: new Date().toISOString(),
        type: partnerTxData.type === 'deposit' ? 'income' : 'expense',
        category: 'الشركاء والأرباح',
        amount: Number(partnerTxData.amount),
        paymentMethod: 'cash',
        treasury: 'main',
        description: `${partnerTxData.type === 'profit_share' ? 'صرف أرباح للشريك' : partnerTxData.type === 'withdrawal' ? 'مسحوبات الشريك' : 'إيداع شريك'}: ${selectedPartnerForTx.name} - ${partnerTxData.notes || ''}`
      };
      setTransactions(prev => [treasuryTx, ...prev]);
      try {
        await DB.saveTransaction(treasuryTx, settings.salonId);
      } catch (err) {
        console.warn('DB.saveTransaction error:', err);
      }
    }

    setShowPartnerTxModal(false);
    setSelectedPartnerForTx(null);
    setPartnerTxData({ type: 'profit_share', amount: 0, notes: '' });
  };

  // 2. Staff Attendance & Delays for Selected Period (Bound to Real Supabase Fingerprint Logs)
  const attendanceStats = useMemo(() => {
    const activeStaff = employees.filter(e => !e.isBlacklisted && e.isActive !== false);
    const targetDateStr = (period === 'today' && shiftData?.isOpen && shiftData?.date)
      ? shiftData.date.split('T')[0].trim()
      : (dateRange.start || new Date().toLocaleDateString('en-CA'));
    const targetDateObj = new Date(targetDateStr + 'T12:00:00');
    const dayNameEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][targetDateObj.getDay()];

    const records = activeStaff.map(emp => {
      let scheduledCheckIn = emp.checkInTime || '09:00';
      if (emp.shiftScheduleHistory && emp.shiftScheduleHistory.length > 0) {
        const sorted = [...emp.shiftScheduleHistory].sort((a, b) => a.date.localeCompare(b.date));
        const activeSched = sorted.filter(s => s.date <= (dateRange.end || dateRange.start)).pop() || sorted[0];
        if (activeSched?.checkInTime) {
          scheduledCheckIn = activeSched.checkInTime;
        }
      }
      const scheduledParts = scheduledCheckIn.split(':').map(Number);
      const schedMin = (scheduledParts[0] || 9) * 60 + (scheduledParts[1] || 0);

      // Check if employee is on leave or weekly off
      const isLeave = emp.leaveRecords?.some(l => targetDateStr >= l.startDate && targetDateStr <= l.endDate);
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

      // Check REAL fingerprint logs for this employee in selected period
      const empLogs = (fingerprintLogs || []).filter(log => {
        const matchesEmp = log.employeeId === emp.id || 
          log.employee_id === emp.id || 
          (emp.fingerprintCode && (log.fingerprintCode === emp.fingerprintCode || log.fingerprint_code === emp.fingerprintCode));
        if (!matchesEmp) return false;

        const logDateStr = (log.timestamp || log.created_at || '').split('T')[0].trim();
        if (period === 'today' && shiftData?.isOpen && shiftData?.date) {
          return logDateStr === targetDateStr;
        }
        return isDateInSelectedPeriod(logDateStr);
      });

      // Find earliest check-in log in period (exclude check_out logs)
      const checkInLogs = empLogs.filter(l => l.type !== 'check_out' && l.log_type !== 'check_out');
      const firstCheckIn = checkInLogs.length > 0
        ? checkInLogs.sort((a, b) => (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || ''))[0]
        : null;

      if (firstCheckIn) {
        const checkInIso = firstCheckIn.timestamp || firstCheckIn.created_at || '';

        // Extract literal wall-clock time string (HH:mm) directly from string.
        let checkInTimeStr = '09:00';
        if (checkInIso.includes('T')) {
          checkInTimeStr = checkInIso.split('T')[1].substring(0, 5);
        } else if (checkInIso.includes(' ')) {
          checkInTimeStr = checkInIso.split(' ')[1].substring(0, 5);
        } else {
          try {
            const d = new Date(checkInIso);
            if (!isNaN(d.getTime())) {
              checkInTimeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
          } catch {}
        }

        const [actualH, actualM] = checkInTimeStr.split(':').map(Number);
        const actualMin = (actualH || 0) * 60 + (actualM || 0);
        const delayMin = Math.max(0, actualMin - schedMin);
        const isLate = delayMin > 5; // allow 5 mins grace

        return {
          emp,
          status: isLate ? ('late' as const) : ('present' as const),
          label: isLate ? `متأخر (${delayMin} د)` : 'حاضر منتظم (بصمة)',
          checkIn: checkInTimeStr,
          delayMin,
          sales: empPeriodSales
        };
      }

      // If no fingerprint log, but staff has active sales in invoices, mark present via invoice activity
      if (empPeriodSales > 0) {
        return {
          emp,
          status: 'present' as const,
          label: 'حاضر (مبيعات فواتير)',
          checkIn: scheduledCheckIn,
          delayMin: 0,
          sales: empPeriodSales
        };
      }

      // Absent (no fingerprint, no sales, not on leave)
      return {
        emp,
        status: 'absent' as const,
        label: 'لم يسجل حضور',
        checkIn: null,
        delayMin: 0,
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
  }, [employees, dateRange, filteredInvoices, fingerprintLogs, period, shiftData]);

  // 3. Bookings & Clients for Selected Period (Created in Period & Scheduled in Period)
  const bookingsStats = useMemo(() => {
    const targetShift = (period === 'today' && shiftData?.isOpen && shiftData?.date) ? shiftData.date.split('T')[0].trim() : null;

    // 1. Bookings created during the selected period
    const createdInPeriodList = bookings.filter(b => {
      const isBranchMatch = matchesActiveBranch((b as any).branchId);
      if (!isBranchMatch) return false;

      const bCreatedDate = ((b as any).createdAt || (b as any).created_at || b.shiftDate || '').split('T')[0].split(' ')[0].trim();
      if (targetShift) {
        return bCreatedDate === targetShift;
      }

      return isDateInSelectedPeriod(bCreatedDate);
    });

    // 2. Bookings scheduled for the selected period (appointment date)
    const scheduledInPeriodList = bookings.filter(b => {
      const isBranchMatch = matchesActiveBranch((b as any).branchId);
      if (!isBranchMatch) return false;

      const schedDate = (b.date || '').split('T')[0].split(' ')[0].trim();
      if (targetShift) {
        return schedDate === targetShift;
      }

      return isDateInSelectedPeriod(schedDate);
    });

    // 3. Bookings with advance payment collected in the selected period
    const advancePaidInPeriodList = bookings.filter(b => {
      if (b.status === 'cancelled' || !matchesActiveBranch((b as any).branchId)) return false;
      const advances = getBookingAdvancesList(b);
      return advances.some(a => {
        const aDate = getAdvanceEffectiveDate(a, b);
        if (targetShift) {
          return aDate === targetShift;
        }
        return isDateInSelectedPeriod(aDate);
      });
    });

    // Unified unique list of bookings relevant to the period (created in period OR scheduled in period OR advance paid in period)
    const periodMap = new Map<string, any>();
    scheduledInPeriodList.forEach(b => periodMap.set(b.id, b));
    createdInPeriodList.forEach(b => periodMap.set(b.id, b));
    advancePaidInPeriodList.forEach(b => periodMap.set(b.id, b));
    const periodList = Array.from(periodMap.values());

    const completed = periodList.filter(b => b.status === 'completed').length;
    const confirmed = periodList.filter(b => b.status === 'confirmed').length;
    const pending = periodList.filter(b => b.status === 'pending').length;
    const cancelled = periodList.filter(b => b.status === 'cancelled').length;

    // حساب القيم المالية للحجوزات ومقدمات الحجز المحصلة
    let totalValue = 0;
    periodList.forEach(b => {
      totalValue += getBookingTotalAmount(b);
    });

    // إجمالي مقدمات الحجز المحصلة فعلياً خلال الفترة
    const totalAdvances = bookingAdvancesList.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const bookingsWithAdvanceCount = periodList.filter(b => {
      const advances = getBookingAdvancesList(b);
      const hasAdvanceInPeriod = advances.some(a => isDateInSelectedPeriod(getAdvanceEffectiveDate(a, b)));
      return hasAdvanceInPeriod || getBookingTotalAdvances(b) > 0;
    }).length;

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
      createdInPeriodCount: createdInPeriodList.length,
      scheduledInPeriodCount: scheduledInPeriodList.length,
      advancePaidInPeriodCount: advancePaidInPeriodList.length,
      createdInPeriodList,
      scheduledInPeriodList,
      advancePaidInPeriodList,
      completed,
      confirmed,
      pending,
      cancelled,
      periodList,
      todayList: periodList,
      totalValue,
      totalAdvances,
      remainingBalance: Math.max(0, totalValue - totalAdvances),
      bookingsWithAdvanceCount,
      totalClientsServed: clientIds.size || filteredInvoices.length
    };
  }, [bookings, dateRange, activeBranchId, filteredInvoices, bookingAdvancesList]);

  // قائمة الإيرادات الموحدة (فواتير المبيعات + مقدمات الحجز)
  const combinedRevenues = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'invoice' | 'booking_advance';
      label: string;
      code: string;
      clientName: string;
      clientPhone?: string;
      amount: number;
      paymentMethod: string;
      date: string;
      time: string;
      details: string;
      timestamp: number;
    }> = [];

    // 1. فواتير المبيعات
    (filteredInvoices || []).forEach(inv => {
      const invDate = inv.date?.split('T')[0] || '';
      const invTime = inv.date?.split('T')[1]?.substring(0, 5) || '';
      const timeVal = inv.date ? new Date(inv.date).getTime() : 0;
      items.push({
        id: inv.id,
        kind: 'invoice',
        label: 'فاتورة مبيعات',
        code: `#${inv.invoiceNumber}`,
        clientName: inv.clientName || 'عميل نقدي',
        clientPhone: inv.clientPhone,
        amount: Number(inv.netAmount || inv.total || 0),
        paymentMethod: inv.paymentMethod || 'نقدي',
        date: invDate,
        time: invTime,
        details: `${inv.items?.length || 1} عناصر / خدمات`,
        timestamp: timeVal
      });
    });

    // 2. مقدمات الحجز
    bookingAdvancesList.forEach(adv => {
      const timeVal = adv.date ? new Date(`${adv.date}T${adv.time || '12:00'}`).getTime() : 0;
      items.push({
        id: adv.id,
        kind: 'booking_advance',
        label: 'مقدم حجز',
        code: adv.bookingCode.startsWith('#') ? adv.bookingCode : `#${adv.bookingCode}`,
        clientName: adv.clientName,
        clientPhone: adv.clientPhone,
        amount: adv.amount,
        paymentMethod: adv.paymentMethod,
        date: adv.date,
        time: adv.time,
        details: `حجز: ${adv.servicesSummary}`,
        timestamp: timeVal
      });
    });

    // ترتيب تنازلي حسب التاريخ والوقت
    return items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [filteredInvoices, bookingAdvancesList]);

  // Unified Outflows Journal (Operating Expenses, Staff Salaries, Staff Advances)
  const combinedOutflows = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'expense' | 'salary' | 'advance';
      label: string;
      title: string;
      recipientOrCategory: string;
      amount: number;
      paymentMethodOrTreasury: string;
      date: string;
      time: string;
      notes: string;
      timestamp: number;
    }> = [];

    // Helper to extract clean date & time
    const parseDateTime = (dStr?: string) => {
      if (!dStr) return { date: '', time: '', ts: 0 };
      const d = dStr.includes('T') ? dStr.split('T')[0] : dStr.split(' ')[0];
      const t = dStr.includes('T') ? dStr.split('T')[1]?.substring(0, 5) || '' : (dStr.split(' ')[1]?.substring(0, 5) || '');
      const ts = new Date(dStr).getTime() || 0;
      return { date: d, time: t, ts };
    };

    // 1. Operating Expenses
    const directExpenseTx = filteredTransactions.filter(isOperatingExpense);
    const customExpenses = (expenses || []).filter(e => {
      const inPeriod = isDateInSelectedPeriod(e.date) || 
        (e.shiftDate && isDateInSelectedPeriod(e.shiftDate)) || 
        ((e as any).shift_date && isDateInSelectedPeriod((e as any).shift_date));
      const isBranchMatch = matchesActiveBranch(e.branchId);
      return inPeriod && isBranchMatch;
    });

    if (customExpenses.length > 0) {
      customExpenses.forEach(exp => {
        const { date, time, ts } = parseDateTime(exp.date || (exp as any).createdAt);
        items.push({
          id: exp.id || `EXP-${Math.random()}`,
          kind: 'expense',
          label: 'مصروف تشغيلي',
          title: exp.title || exp.category || 'مصروف تشغيلي',
          recipientOrCategory: exp.category || 'عام',
          amount: Number(exp.amount) || 0,
          paymentMethodOrTreasury: (exp as any).treasuryName || (exp as any).paymentMethod || 'نقدي',
          date,
          time,
          notes: exp.notes || exp.description || '',
          timestamp: ts
        });
      });
    } else {
      directExpenseTx.forEach(tx => {
        const { date, time, ts } = parseDateTime(tx.date);
        items.push({
          id: tx.id,
          kind: 'expense',
          label: 'مصروف تشغيلي',
          title: tx.category || 'مصروف تشغيلي',
          recipientOrCategory: tx.category || 'مصروفات',
          amount: Number(tx.amount) || 0,
          paymentMethodOrTreasury: (tx as any).treasuryName || tx.paymentMethod || 'نقدي',
          date,
          time,
          notes: tx.description || '',
          timestamp: ts
        });
      });
    }

    // 2. Staff Salaries
    const activeStaff = employees.filter(e => matchesActiveBranch((e as any).branchId));
    const addedSalaryKeys = new Set<string>();

    activeStaff.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        if (isDateInSelectedPeriod(rec.date) && rec.type === 'salary') {
          const { date, time, ts } = parseDateTime(rec.date);
          const amt = Number(rec.amount) || 0;
          const key = `${emp.name}_${amt}_${date}`;
          addedSalaryKeys.add(key);
          items.push({
            id: rec.id || `SAL-${emp.id}-${date}`,
            kind: 'salary',
            label: 'مسير رواتب',
            title: `راتب: ${emp.name}`,
            recipientOrCategory: emp.name,
            amount: amt,
            paymentMethodOrTreasury: (rec as any).treasuryName || (rec as any).paymentMethod || 'نقدي',
            date,
            time,
            notes: rec.note || 'صرف راتب شهري للموظف',
            timestamp: ts
          });
        }
      });
    });

    const trxSalaries = filteredTransactions.filter(isStaffSalary);
    trxSalaries.forEach(tx => {
      const { date, time, ts } = parseDateTime(tx.date);
      const amt = Number(tx.amount) || 0;
      const matchedEmp = activeStaff.find(e => tx.description?.includes(e.name));
      const empName = matchedEmp ? matchedEmp.name : (tx.description?.split(' ')[1] || 'موظف');
      const key = `${empName}_${amt}_${date}`;
      if (!addedSalaryKeys.has(key)) {
        addedSalaryKeys.add(key);
        items.push({
          id: tx.id,
          kind: 'salary',
          label: 'مسير رواتب',
          title: `راتب: ${empName}`,
          recipientOrCategory: empName,
          amount: amt,
          paymentMethodOrTreasury: (tx as any).treasuryName || tx.paymentMethod || 'نقدي',
          date,
          time,
          notes: tx.description || 'صرف راتب',
          timestamp: ts
        });
      }
    });

    // 3. Staff Advances
    const addedAdvanceKeys = new Set<string>();
    activeStaff.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        const isSal = rec.id?.startsWith('FIN-SAL-') || rec.note?.includes('مسير رواتب') || rec.note?.includes('تم استلام صافي الراتب');
        if (isDateInSelectedPeriod(rec.date) && rec.type === 'advance' && !isSal) {
          const { date, time, ts } = parseDateTime(rec.date);
          const amt = Number(rec.amount) || 0;
          const key = `${emp.name}_${amt}_${date}`;
          addedAdvanceKeys.add(key);
          items.push({
            id: rec.id || `ADV-${emp.id}-${date}`,
            kind: 'advance',
            label: 'سلفة موظف',
            title: `سلفة: ${emp.name}`,
            recipientOrCategory: emp.name,
            amount: amt,
            paymentMethodOrTreasury: (rec as any).treasuryName || (rec as any).paymentMethod || 'نقدي',
            date,
            time,
            notes: rec.note || 'صرف سلفة للموظف',
            timestamp: ts
          });
        }
      });
    });

    const trxAdvances = filteredTransactions.filter(isStaffAdvance);
    trxAdvances.forEach(tx => {
      const { date, time, ts } = parseDateTime(tx.date);
      const amt = Number(tx.amount) || 0;
      const matchedEmp = activeStaff.find(e => tx.description?.includes(e.name));
      const empName = matchedEmp ? matchedEmp.name : (tx.description?.split(' ')[1] || 'موظف');
      const key = `${empName}_${amt}_${date}`;
      if (!addedAdvanceKeys.has(key)) {
        addedAdvanceKeys.add(key);
        items.push({
          id: tx.id,
          kind: 'advance',
          label: 'سلفة موظف',
          title: `سلفة: ${empName}`,
          recipientOrCategory: empName,
          amount: amt,
          paymentMethodOrTreasury: (tx as any).treasuryName || tx.paymentMethod || 'نقدي',
          date,
          time,
          notes: tx.description || 'صرف سلفة',
          timestamp: ts
        });
      }
    });

    return items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [filteredTransactions, expenses, employees, activeBranchId, isMainBranch, isAllBranches, period, dateRange]);

  // الحجوزات المصفاة في تبويب الحجوزات
  const filteredBookingsList = useMemo(() => {
    let list = bookingsStats.periodList;

    if (bookingStatusFilter === 'created_in_period') {
      list = bookingsStats.createdInPeriodList;
    } else if (bookingStatusFilter === 'scheduled_in_period') {
      list = bookingsStats.scheduledInPeriodList;
    } else if (bookingStatusFilter === 'with_advance') {
      list = list.filter(b => {
        const advances = getBookingAdvancesList(b);
        const hasAdvanceInPeriod = advances.some(a => isDateInSelectedPeriod(getAdvanceEffectiveDate(a, b)));
        return hasAdvanceInPeriod || getBookingTotalAdvances(b) > 0;
      });
    } else if (bookingStatusFilter !== 'all') {
      list = list.filter(b => b.status === bookingStatusFilter);
    }

    if (bookingSearchQuery.trim()) {
      const q = bookingSearchQuery.trim().toLowerCase();
      list = list.filter(b => {
        const name = (b.clientName || '').toLowerCase();
        const phone = (b.phone || b.clientPhone || '').toLowerCase();
        const code = (b.bookingCode || b.id || '').toLowerCase();
        const services = getBookingServicesNames(b).toLowerCase();
        const barber = getBookingEmployeeNames(b).toLowerCase();
        const notes = (b.notes || '').toLowerCase();
        const intNotes = (b.internalNotes || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || code.includes(q) || services.includes(q) || barber.includes(q) || notes.includes(q) || intNotes.includes(q);
      });
    }

    return [...list].sort((a, b) => {
      if (bookingStatusFilter === 'created_in_period') {
        const createdA = (a as any).createdAt || (a as any).created_at || a.shiftDate || (a.advancePayments && a.advancePayments[0]?.paymentDate) || '';
        const createdB = (b as any).createdAt || (b as any).created_at || b.shiftDate || (b.advancePayments && b.advancePayments[0]?.paymentDate) || '';
        return new Date(createdB).getTime() - new Date(createdA).getTime();
      }
      const dateA = `${a.date}T${a.time || '00:00'}`;
      const dateB = `${b.date}T${b.time || '00:00'}`;
      return dateB.localeCompare(dateA);
    });
  }, [bookingsStats, bookingStatusFilter, bookingSearchQuery]);

  // Load Users from Supabase on mount
  useEffect(() => {
    async function loadDbUsers() {
      try {
        const dbUsers = await DB.fetchUsers(settings.salonId);
        if (dbUsers && dbUsers.length > 0) {
          setUsers(dbUsers);
        }
      } catch (e) {
        console.warn('Error fetching users from DB in owner portal:', e);
      }
    }
    loadDbUsers();
  }, [settings.salonId]);

  // Quick live refresh
  const handleLiveRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setLastRefreshed(new Date());
      try {
        const dbUsers = await DB.fetchUsers(settings.salonId);
        if (dbUsers && dbUsers.length > 0) {
          setUsers(dbUsers);
        } else {
          setUsers(AuthService.getUsers());
        }
      } catch {
        setUsers(AuthService.getUsers());
      }
    } catch (e) {
      console.warn('Error refreshing owner portal data:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-fetch real data on mount if empty
  React.useEffect(() => {
    if (invoices.length === 0 && onRefresh) {
      onRefresh();
    }
  }, [invoices.length, onRefresh]);

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
• عدد الفواتير: ${revenueStats.invoiceCount} (${netProfitData.grossInvoicesIncome.toLocaleString()} ${currency})
• مقدم حجز: ${netProfitData.totalBookingAdvances.toLocaleString()} ${currency} (${netProfitData.bookingAdvancesCount} دفعة مقدمة)
• الصافي: *${revenueStats.netProfit.toLocaleString()} ${currency}*

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

  // Toggle user active status (bound to Supabase DB)
  const handleToggleUserActive = async (targetUser: AppUser) => {
    const newActiveState = !targetUser.active;
    const updatedUser: AppUser = { ...targetUser, active: newActiveState };
    const updatedUsers = users.map(u => u.id === targetUser.id ? updatedUser : u);
    setUsers(updatedUsers);
    AuthService.saveUsers(updatedUsers);
    try {
      await DB.saveUser(updatedUser, settings.salonId);
    } catch (err) {
      console.warn('DB.saveUser error:', err);
    }
  };

  // Add new user (bound to Supabase DB)
  const handleAddUser = async (e: React.FormEvent) => {
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
    try {
      await DB.saveUser(newUser, settings.salonId);
    } catch (err) {
      console.warn('DB.saveUser error:', err);
    }

    setUserFormSuccess(`تمت إضافة المستخدم (${newUser.name}) بنجاح!`);
    setNewUserForm({ name: '', username: '', phone: '', role: 'cashier', password: '' });
    setTimeout(() => {
      setShowAddUserModal(false);
      setUserFormSuccess('');
    }, 1200);
  };

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 select-none overflow-y-auto overflow-x-hidden">
      
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

            {/* Refresh Button */}
            <button
              onClick={handleLiveRefresh}
              title="تحديث البيانات لحظياً من قاعدة البيانات"
              className={`p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer ${
                isRefreshing || Boolean(externalRefreshing) ? 'animate-spin text-amber-400' : ''
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
              {shiftData?.isOpen && shiftData?.date ? `الوردية المفتوحة (${shiftData.date.split('T')[0].trim()})` : 'اليوم'}
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
              onClick={() => setPeriod('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                period === 'all' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              كامل المدة (الكل)
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

        {/* SHIFT STATUS BANNER */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-bold">حالة وردية العمل:</span>
            {shiftData?.isOpen && shiftData?.date ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-black text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>وردية مفتوحة بتاريخ: <strong className="font-mono text-emerald-200">{shiftData.date.split('T')[0].trim()}</strong></span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>الوردية مغلقة (يتم عرض تاريخ اليوم: {new Date().toLocaleDateString('en-CA')})</span>
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            مصدر الأرقام: <strong className="text-amber-300 font-mono">{dateRange.label}</strong>
          </div>
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
            
            {/* Top 4 Quick Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Total Revenue Today */}
              <div 
                onClick={() => setActiveSubTab('finance')}
                className="bg-gradient-to-br from-slate-900 to-slate-800/90 p-4 rounded-2xl border border-slate-700/80 shadow-lg relative overflow-hidden cursor-pointer hover:border-emerald-500 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400">
                    {period === 'today' && shiftData?.isOpen && shiftData?.date ? `إيراد الوردية (${shiftData.date.split('T')[0].trim()})` : 'إيراد اليوم'}
                  </span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <DollarSign size={15} />
                  </div>
                </div>
                <div className="text-xl font-black text-white tracking-tight">
                  {revenueStats.totalRevenue.toLocaleString()} <span className="text-xs font-normal text-emerald-400">{currency}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-semibold">
                  <span>
                    {revenueStats.invoiceCount} فاتورة
                    {netProfitData.bookingAdvancesCount > 0 && ` + ${netProfitData.bookingAdvancesCount} مقدم حجز`}
                  </span>
                  <span className="text-emerald-400 group-hover:translate-x-[-2px] transition-transform">تفاصيل ‹</span>
                </div>
              </div>

              {/* 2. Staff Attendance Today */}
              <div 
                onClick={() => setActiveSubTab('attendance')}
                className="bg-gradient-to-br from-slate-900 to-slate-800/90 p-4 rounded-2xl border border-slate-700/80 shadow-lg relative overflow-hidden cursor-pointer hover:border-amber-500 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400">
                    {period === 'today' && shiftData?.isOpen && shiftData?.date ? 'حضور الكادر (الوردية)' : 'حضور الكادر'}
                  </span>
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
                  <span className="text-[11px] font-bold text-slate-400">
                    {period === 'today' && shiftData?.isOpen && shiftData?.date ? 'عملاء الوردية' : 'عملاء اليوم'}
                  </span>
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

              {/* 4. Bookings Today / Period */}
              <div 
                onClick={() => setActiveSubTab('bookings')}
                className="bg-gradient-to-br from-slate-900 to-slate-800/90 p-4 rounded-2xl border border-slate-700/80 shadow-lg relative overflow-hidden cursor-pointer hover:border-purple-500 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400">حجوزات الفترة</span>
                  <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Calendar size={15} />
                  </div>
                </div>
                <div className="text-xl font-black text-white tracking-tight">
                  {bookingsStats.totalBookings} <span className="text-xs font-normal text-purple-400">حجز</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-semibold">
                  <span className="text-purple-300">
                    ⚡ {bookingsStats.createdInPeriodCount} أُنشئت | 📅 {bookingsStats.scheduledInPeriodCount} موعد
                  </span>
                  <span className="text-purple-400 group-hover:translate-x-[-2px] transition-transform">عرض ‹</span>
                </div>
              </div>
            </div>

            {/* Outflows Integration Banner (المصروفات • الرواتب • السلف) */}
            <div 
              onClick={() => setActiveSubTab('finance')}
              className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 p-4 rounded-2xl border border-slate-800 hover:border-rose-500/50 transition-all cursor-pointer shadow-md group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                    <TrendingDown size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-white">منظومة المنصرفات والالتزامات ({dateRange.label})</h4>
                      <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold">
                        ربط محاسبي دقيق
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      تكامل فوري بين المصروفات التشغيلية، ومسيرات الرواتب المنصرفة، وسلف الكادر
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block mb-0.5">مصروفات تشغيلية</span>
                    <span className="font-mono font-black text-rose-400">
                      {revenueStats.totalExpenses.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">{currency}</span>
                    </span>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block mb-0.5">رواتب منصرفة</span>
                    <span className="font-mono font-black text-amber-400">
                      {revenueStats.totalSalaries.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">{currency}</span>
                    </span>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block mb-0.5">سلف الموظفين</span>
                    <span className="font-mono font-black text-sky-400">
                      {revenueStats.totalAdvances.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">{currency}</span>
                    </span>
                  </div>
                  <div className="bg-rose-950/30 p-2.5 rounded-xl border border-rose-500/30">
                    <span className="text-[10px] text-rose-300 block mb-0.5 font-bold">إجمالي المنصرفات</span>
                    <span className="font-mono font-black text-rose-300">
                      -{revenueStats.totalOutflows.toLocaleString()} <span className="text-[9px] font-normal text-rose-400/80">{currency}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Interactive Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Circular Donut Pie Chart: Revenue by Registered Treasuries & Payment Methods */}
              <PaymentMethodsDonutChart 
                revenueStats={revenueStats} 
                currency={currency}
                customSlices={treasuryStats.slices}
                title="توزيع حركة الخزائن وطرق الدفع المحصلة"
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
              {/* Recent Revenues & Booking Advances Quick List */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Receipt size={15} className="text-emerald-400" />
                    <span>أحدث الإيرادات ومقدمات الحجز ({dateRange.label})</span>
                  </h3>
                  <button 
                    onClick={() => setActiveSubTab('finance')}
                    className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    عرض الكل ‹
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {combinedRevenues.slice(0, 5).map(item => (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                        item.kind === 'booking_advance'
                          ? 'bg-purple-950/20 border-purple-500/30'
                          : 'bg-slate-800/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {item.kind === 'booking_advance' ? (
                          <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                            مقدم حجز
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                            فاتورة
                          </span>
                        )}
                        <div>
                          <p className="font-bold text-white text-xs">{item.clientName || 'عميل نقدي'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{item.code} {item.time ? `• ${item.time}` : ''}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-mono font-black text-emerald-400 text-xs">+{item.amount.toLocaleString()} {currency}</p>
                        <p className="text-[10px] text-slate-400">{item.paymentMethod || 'نقدي'}</p>
                      </div>
                    </div>
                  ))}
                  {combinedRevenues.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">لا توجد إيرادات مسجلة لهذه الفترة حتى الآن</p>
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
                    صافي الربح = إجمالي الدخل المحصل (فواتير + مقدمات حجز) - جميع المصروفات - الرواتب - السلف - (المسدد في المشتريات + دفعات الموردين) - عمولات الموظفين
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
              
              {/* 1. Invoiced & Booking Advances Income (+) */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-emerald-500/30 shadow-md border-r-4 border-r-emerald-500">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400">1. إجمالي الإيرادات المحصلة (+)</span>
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <TrendingUp size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {netProfitData.grossIncome.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                </div>
                <div className="text-[9px] text-slate-400 font-bold mt-1 space-y-0.5">
                  <p>• فواتير: {netProfitData.grossInvoicesIncome.toLocaleString()} {currency} ({netProfitData.invoicesCount})</p>
                  <p className="text-purple-300 font-extrabold">• مقدم حجز: {netProfitData.totalBookingAdvances.toLocaleString()} {currency} ({netProfitData.bookingAdvancesCount})</p>
                </div>
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
                                onClick={async () => {
                                  if (confirm(`هل أنت متأكد من حذف الشريك (${p.partner.name})؟`)) {
                                    setPartners(prev => prev.filter(item => item.id !== p.partner.id));
                                    try {
                                      await DB.deletePartner(p.partner.id);
                                    } catch (err) {
                                      console.warn('DB.deletePartner error:', err);
                                    }
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-emerald-400 mb-1">صافي الإيراد الفعلي ({dateRange.label})</p>
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    {revenueStats.netProfit.toLocaleString()} <span className="text-sm font-normal text-emerald-300">{currency}</span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-300">
                    <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-md font-bold">
                      فواتير: {netProfitData.grossInvoicesIncome.toLocaleString()} {currency} ({netProfitData.invoicesCount})
                    </span>
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/35 px-2 py-0.5 rounded-md font-bold">
                      مقدم حجز: {netProfitData.totalBookingAdvances.toLocaleString()} {currency} ({netProfitData.bookingAdvancesCount})
                    </span>
                  </div>
                </div>
                <div className="text-left text-xs text-slate-300 space-y-1 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  <p>إجمالي الإيرادات: <span className="font-mono font-bold text-emerald-400">+{revenueStats.totalRevenue.toLocaleString()} {currency}</span></p>
                  <p className="text-rose-400">المصروفات: <span className="font-mono font-bold">-{revenueStats.totalExpenses.toLocaleString()} {currency}</span></p>
                </div>
              </div>
            </div>

            {/* Donut Chart: Registered Treasuries Flow */}
            <PaymentMethodsDonutChart 
              revenueStats={revenueStats} 
              currency={currency} 
              customSlices={treasuryStats.slices}
              title={`توزيع التدفق المالي للخزائن المسجلة (${dateRange.label})`}
            />

            {/* 1. البطاقات الفعلية للخزائن المسجلة في النظام */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <Wallet size={16} className="text-emerald-400" />
                  <span>الخزائن المسجلة في النظام ({treasuryStats.list.length})</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  إجمالي رصيد الخزائن التراكمي: <strong className="text-emerald-400">{treasuryStats.totalLifetimeTreasuryBalance.toLocaleString()} {currency}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {treasuryStats.list.map(tStat => {
                  const Icon = tStat.icon;
                  return (
                    <div 
                      key={tStat.id} 
                      className={`p-4 rounded-2xl border transition-all ${
                        tStat.isMain 
                          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-amber-500/40 shadow-lg shadow-amber-500/5' 
                          : 'bg-slate-900 border-slate-800 shadow-md hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                            style={{ backgroundColor: `${tStat.color}20`, color: tStat.color }}
                          >
                            <Icon size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-black text-white">{tStat.name}</p>
                              {tStat.isMain && (
                                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                                  رئيسية 🏦
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono">#{tStat.id}</p>
                          </div>
                        </div>

                        <div className="text-left">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${tStat.bgBadge}`}>
                            {tStat.periodBalance >= 0 ? '+' : ''}{tStat.periodBalance.toLocaleString()} {currency}
                          </span>
                        </div>
                      </div>

                      {/* Treasury Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                        <div className="bg-slate-800/40 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block mb-0.5">وارد الفترة (+)</span>
                          <span className="font-mono font-bold text-emerald-400">+{tStat.totalIn.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-800/40 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block mb-0.5">صادر الفترة (-)</span>
                          <span className="font-mono font-bold text-rose-400">-{tStat.totalOut.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">الرصيد التراكمي الفعلي:</span>
                        <span className={`font-mono font-black text-sm ${tStat.lifetimeBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                          {tStat.lifetimeBalance.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. تحليل طرق الدفع والخزائن المحصلة في فواتير الفترة */}
            <div className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <CreditCard size={16} className="text-sky-400" />
                  <span>تحليل طرق الدفع والخزائن المحصلة في فواتير الفترة ({dateRange.label})</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  إجمالي المحصل: <strong className="text-white">{revenueStats.totalRevenue.toLocaleString()} {currency}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {treasuryStats.list.map(tStat => {
                  const Icon = tStat.icon;
                  const collectedAmt = tStat.invoicesCollected;
                  const pct = revenueStats.totalRevenue > 0 
                    ? Math.round((collectedAmt / revenueStats.totalRevenue) * 100) 
                    : 0;
                  return (
                    <div 
                      key={tStat.id} 
                      className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: `${tStat.color}20`, color: tStat.color }}
                        >
                          <Icon size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-300">{tStat.name}</p>
                            {tStat.isMain && (
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] font-black px-1.5 py-0.2 rounded">رئيسية</span>
                            )}
                          </div>
                          <p className="text-lg font-black text-white mt-0.5">
                            {collectedAmt.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <span 
                          className="text-xs font-bold px-2 py-0.5 rounded-lg border font-mono"
                          style={{ borderColor: `${tStat.color}40`, color: tStat.color, backgroundColor: `${tStat.color}15` }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Expenses */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-rose-900/40 shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <TrendingUp size={20} className="rotate-180" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-rose-400">مصروفات الفترة</p>
                      <p className="text-lg font-black text-rose-300 mt-0.5">-{revenueStats.totalExpenses.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Unified Revenues Journal (Invoices + Booking Advances) */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-emerald-400" />
                  <h3 className="text-xs font-black text-white">
                    حركات الإيراد المحصلة ({dateRange.label})
                  </h3>
                </div>

                {/* Filter Tabs: الكل | فواتير | مقدمات حجز */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setFinanceRevenueFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      financeRevenueFilter === 'all'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الكل ({combinedRevenues.length})
                  </button>
                  <button
                    onClick={() => setFinanceRevenueFilter('invoices')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      financeRevenueFilter === 'invoices'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    فواتير ({filteredInvoices.length})
                  </button>
                  <button
                    onClick={() => setFinanceRevenueFilter('advances')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      financeRevenueFilter === 'advances'
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'text-purple-300/80 hover:text-purple-200'
                    }`}
                  >
                    مقدم حجز ({bookingAdvancesList.length})
                  </button>
                </div>
              </div>

              {/* Subtotal Banner for Filtered View */}
              <div className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl mb-3 border border-slate-800/80 text-[11px]">
                <span className="text-slate-400">
                  {financeRevenueFilter === 'all' && 'إجمالي المحصل من الفواتير ومقدمات الحجز:'}
                  {financeRevenueFilter === 'invoices' && 'إجمالي مبيعات الفواتير المسددة:'}
                  {financeRevenueFilter === 'advances' && 'إجمالي مقبوضات مقدمات الحجز (مقدم حجز):'}
                </span>
                <span className="font-mono font-black text-emerald-400">
                  {financeRevenueFilter === 'all' && `${revenueStats.totalRevenue.toLocaleString()} ${currency}`}
                  {financeRevenueFilter === 'invoices' && `${netProfitData.grossInvoicesIncome.toLocaleString()} ${currency}`}
                  {financeRevenueFilter === 'advances' && `${netProfitData.totalBookingAdvances.toLocaleString()} ${currency}`}
                </span>
              </div>

              <div className="divide-y divide-slate-800 text-xs max-h-80 overflow-y-auto scrollbar-thin">
                {combinedRevenues
                  .filter(r => {
                    if (financeRevenueFilter === 'invoices') return r.kind === 'invoice';
                    if (financeRevenueFilter === 'advances') return r.kind === 'booking_advance';
                    return true;
                  })
                  .map(rev => (
                    <div 
                      key={rev.id} 
                      className={`py-3 flex items-center justify-between px-2.5 rounded-xl transition-colors hover:bg-slate-800/40 ${
                        rev.kind === 'booking_advance' ? 'bg-purple-950/15 border border-purple-500/20 my-1' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {rev.kind === 'booking_advance' ? (
                          <div className="flex flex-col items-center">
                            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-black px-2 py-0.5 rounded-md whitespace-nowrap">
                              مقدم حجز
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                              فاتورة
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-white text-xs">{rev.clientName || 'عميل نقدي'}</p>
                            <span className="text-[10px] text-slate-400 font-mono font-semibold">{rev.code}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {rev.details} • {rev.date} {rev.time ? `(${rev.time})` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <p className={`font-mono font-black text-sm ${rev.kind === 'booking_advance' ? 'text-purple-300' : 'text-emerald-400'}`}>
                          +{rev.amount.toLocaleString()} <span className="text-[10px] font-normal">{currency}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">{rev.paymentMethod || 'نقدي'}</p>
                      </div>
                    </div>
                  ))}

                {combinedRevenues.filter(r => {
                  if (financeRevenueFilter === 'invoices') return r.kind === 'invoice';
                  if (financeRevenueFilter === 'advances') return r.kind === 'booking_advance';
                  return true;
                }).length === 0 && (
                  <p className="text-center py-8 text-slate-500 text-xs">لا توجد حركات إيراد مسجلة مطابقة للفترة المحددة</p>
                )}
              </div>
            </div>

            {/* Unified Outflows Journal (Operating Expenses, Staff Salaries, Staff Advances) */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} className="text-rose-400" />
                  <div>
                    <h3 className="text-xs font-black text-white">
                      سجل المنصرفات والسلف والرواتب ({dateRange.label})
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      ربط محاسبي موحد للمصروفات ومسيرات الرواتب وسلف الكادر
                    </p>
                  </div>
                </div>

                {/* Filter Tabs: الكل | مصروفات تشغيلية | رواتب | سلف */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setFinanceOutflowFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      financeOutflowFilter === 'all'
                        ? 'bg-rose-500 text-slate-950 shadow-sm font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الكل ({combinedOutflows.length})
                  </button>
                  <button
                    onClick={() => setFinanceOutflowFilter('expenses')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      financeOutflowFilter === 'expenses'
                        ? 'bg-rose-500 text-slate-950 shadow-sm font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    مصروفات ({combinedOutflows.filter(o => o.kind === 'expense').length})
                  </button>
                  <button
                    onClick={() => setFinanceOutflowFilter('salaries')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      financeOutflowFilter === 'salaries'
                        ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                        : 'text-amber-300/80 hover:text-amber-200'
                    }`}
                  >
                    رواتب ({combinedOutflows.filter(o => o.kind === 'salary').length})
                  </button>
                  <button
                    onClick={() => setFinanceOutflowFilter('advances')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      financeOutflowFilter === 'advances'
                        ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                        : 'text-sky-300/80 hover:text-sky-200'
                    }`}
                  >
                    سلف ({combinedOutflows.filter(o => o.kind === 'advance').length})
                  </button>
                </div>
              </div>

              {/* Subtotal Banner for Filtered View */}
              <div className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl mb-3 border border-slate-800/80 text-[11px]">
                <span className="text-slate-400">
                  {financeOutflowFilter === 'all' && 'إجمالي المنصرفات والسلف والرواتب المنفذة:'}
                  {financeOutflowFilter === 'expenses' && 'إجمالي المصروفات التشغيلية المعتمدة:'}
                  {financeOutflowFilter === 'salaries' && 'إجمالي الرواتب المنصرفة للكادر:'}
                  {financeOutflowFilter === 'advances' && 'إجمالي سلف الموظفين المسددة:'}
                </span>
                <span className="font-mono font-black text-rose-400">
                  {financeOutflowFilter === 'all' && `-${revenueStats.totalOutflows.toLocaleString()} ${currency}`}
                  {financeOutflowFilter === 'expenses' && `-${revenueStats.totalExpenses.toLocaleString()} ${currency}`}
                  {financeOutflowFilter === 'salaries' && `-${revenueStats.totalSalaries.toLocaleString()} ${currency}`}
                  {financeOutflowFilter === 'advances' && `-${revenueStats.totalAdvances.toLocaleString()} ${currency}`}
                </span>
              </div>

              {/* List of Outflows */}
              <div className="divide-y divide-slate-800 text-xs max-h-80 overflow-y-auto scrollbar-thin">
                {combinedOutflows
                  .filter(o => {
                    if (financeOutflowFilter === 'expenses') return o.kind === 'expense';
                    if (financeOutflowFilter === 'salaries') return o.kind === 'salary';
                    if (financeOutflowFilter === 'advances') return o.kind === 'advance';
                    return true;
                  })
                  .map(outflow => (
                    <div 
                      key={outflow.id} 
                      className="py-3 flex items-center justify-between px-2.5 rounded-xl transition-colors hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-2.5">
                        {outflow.kind === 'expense' && (
                          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black px-2 py-0.5 rounded-md whitespace-nowrap">
                            مصروف تشغيلي
                          </span>
                        )}
                        {outflow.kind === 'salary' && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-md whitespace-nowrap">
                            راتب شهري
                          </span>
                        )}
                        {outflow.kind === 'advance' && (
                          <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[9px] font-black px-2 py-0.5 rounded-md whitespace-nowrap">
                            سلفة موظف
                          </span>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-white text-xs">{outflow.title}</p>
                            <span className="text-[10px] text-slate-400 font-medium">({outflow.recipientOrCategory})</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {outflow.date} {outflow.time ? `(${outflow.time})` : ''} 
                            {outflow.notes ? ` • ${outflow.notes}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <p className="font-mono font-black text-sm text-rose-400">
                          -{outflow.amount.toLocaleString()} <span className="text-[10px] font-normal">{currency}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">{outflow.paymentMethodOrTreasury}</p>
                      </div>
                    </div>
                  ))}

                {combinedOutflows.filter(o => {
                  if (financeOutflowFilter === 'expenses') return o.kind === 'expense';
                  if (financeOutflowFilter === 'salaries') return o.kind === 'salary';
                  if (financeOutflowFilter === 'advances') return o.kind === 'advance';
                  return true;
                }).length === 0 && (
                  <p className="text-center py-8 text-slate-500 text-xs">لا توجد حركات منصرفات أو سلف أو رواتب مطابقة للفترة المحددة</p>
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
            
            {/* 1. Executive Bookings KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 text-center">
              <div 
                onClick={() => setBookingStatusFilter('all')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  bookingStatusFilter === 'all' ? 'bg-purple-950/40 border-purple-500/60 ring-1 ring-purple-500/30' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <p className="text-xl font-black text-white">{bookingsStats.totalBookings}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">مجموع الحجوزات</p>
              </div>

              <div 
                onClick={() => setBookingStatusFilter('created_in_period')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  bookingStatusFilter === 'created_in_period' ? 'bg-purple-950/40 border-purple-400 ring-1 ring-purple-500/40' : 'bg-slate-900 border-purple-500/30 hover:border-purple-400/50'
                }`}
              >
                <p className="text-xl font-black text-purple-300">{bookingsStats.createdInPeriodCount}</p>
                <p className="text-[10px] font-bold text-purple-300 mt-0.5">⚡ أُنشئت بالفترة</p>
              </div>

              <div 
                onClick={() => setBookingStatusFilter('scheduled_in_period')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  bookingStatusFilter === 'scheduled_in_period' ? 'bg-sky-950/40 border-sky-400 ring-1 ring-sky-500/40' : 'bg-slate-900 border-sky-500/30 hover:border-sky-400/50'
                }`}
              >
                <p className="text-xl font-black text-sky-400">{bookingsStats.scheduledInPeriodCount}</p>
                <p className="text-[10px] font-bold text-sky-300 mt-0.5">📅 مواعيد بالفترة</p>
              </div>

              <div 
                onClick={() => setBookingStatusFilter('completed')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  bookingStatusFilter === 'completed' ? 'bg-emerald-950/40 border-emerald-400 ring-1 ring-emerald-500/40' : 'bg-slate-900 border-emerald-500/30 hover:border-emerald-400/50'
                }`}
              >
                <p className="text-xl font-black text-emerald-400">{bookingsStats.completed}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">مكتملة ✓</p>
              </div>

              <div 
                onClick={() => setBookingStatusFilter('confirmed')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  bookingStatusFilter === 'confirmed' ? 'bg-blue-950/40 border-blue-400 ring-1 ring-blue-500/40' : 'bg-slate-900 border-blue-500/30 hover:border-blue-400/50'
                }`}
              >
                <p className="text-xl font-black text-blue-400">{bookingsStats.confirmed}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">مؤكدة 📅</p>
              </div>

              <div 
                onClick={() => setBookingStatusFilter('pending')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  bookingStatusFilter === 'pending' ? 'bg-amber-950/40 border-amber-400 ring-1 ring-amber-500/40' : 'bg-slate-900 border-amber-500/30 hover:border-amber-400/50'
                }`}
              >
                <p className="text-xl font-black text-amber-400">{bookingsStats.pending}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">معلقة ⏳</p>
              </div>

              <div 
                onClick={() => setBookingStatusFilter('cancelled')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  bookingStatusFilter === 'cancelled' ? 'bg-rose-950/40 border-rose-400 ring-1 ring-rose-500/40' : 'bg-slate-900 border-rose-500/30 hover:border-rose-400/50'
                }`}
              >
                <p className="text-xl font-black text-rose-400">{bookingsStats.cancelled}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">ملغاة ✕</p>
              </div>

              <div 
                onClick={() => setBookingStatusFilter('with_advance')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all bg-purple-950/10 ${
                  bookingStatusFilter === 'with_advance' ? 'border-purple-400 ring-1 ring-purple-500/40' : 'border-purple-500/40 hover:border-purple-400/60'
                }`}
              >
                <p className="text-xl font-black text-purple-300 font-mono">
                  {bookingsStats.totalAdvances.toLocaleString()}
                  <span className="text-[10px] font-normal text-purple-400 mr-1">{currency}</span>
                </p>
                <p className="text-[10px] font-bold text-purple-300 mt-0.5 flex items-center justify-center gap-1">
                  <span>مقدم حجز 💰</span>
                </p>
              </div>

              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <p className="text-xl font-black text-slate-200 font-mono">
                  {bookingsStats.remainingBalance.toLocaleString()}
                  <span className="text-[10px] font-normal text-slate-400 mr-1">{currency}</span>
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">المتبقي للتحصيل</p>
              </div>
            </div>

            {/* 2. Search & Filter Bar */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={bookingSearchQuery}
                    onChange={(e) => setBookingSearchQuery(e.target.value)}
                    placeholder="ابحث باسم العميل، الهاتف، كود الحجز (B-xxx)، الخدمة، الحلاق، أو الملاحظات..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  {bookingSearchQuery && (
                    <button
                      onClick={() => setBookingSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Counter Badge */}
                <div className="text-left shrink-0 text-xs text-slate-400">
                  عرض <strong className="text-white font-mono">{filteredBookingsList.length}</strong> من أصل <strong className="text-white font-mono">{bookingsStats.totalBookings}</strong> حجز
                </div>
              </div>

              {/* Status Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  onClick={() => setBookingStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bookingStatusFilter === 'all'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  الكل ({bookingsStats.totalBookings})
                </button>

                <button
                  onClick={() => setBookingStatusFilter('created_in_period')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    bookingStatusFilter === 'created_in_period'
                      ? 'bg-purple-500 text-slate-950 font-black border-purple-400 shadow-md shadow-purple-500/30'
                      : 'bg-purple-950/30 text-purple-300 border-purple-500/30 hover:bg-purple-900/40'
                  }`}
                >
                  ⚡ أُنشئت بالفترة ({bookingsStats.createdInPeriodCount})
                </button>

                <button
                  onClick={() => setBookingStatusFilter('scheduled_in_period')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    bookingStatusFilter === 'scheduled_in_period'
                      ? 'bg-sky-500 text-slate-950 font-black border-sky-400 shadow-md shadow-sky-500/30'
                      : 'bg-sky-950/30 text-sky-300 border-sky-500/30 hover:bg-sky-900/40'
                  }`}
                >
                  📅 مواعيد بالفترة ({bookingsStats.scheduledInPeriodCount})
                </button>

                <button
                  onClick={() => setBookingStatusFilter('confirmed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bookingStatusFilter === 'confirmed'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  مؤكدة ({bookingsStats.confirmed})
                </button>

                <button
                  onClick={() => setBookingStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bookingStatusFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  معلقة ({bookingsStats.pending})
                </button>

                <button
                  onClick={() => setBookingStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bookingStatusFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  مكتملة ({bookingsStats.completed})
                </button>

                <button
                  onClick={() => setBookingStatusFilter('cancelled')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bookingStatusFilter === 'cancelled'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  ملغاة ({bookingsStats.cancelled})
                </button>

                <button
                  onClick={() => setBookingStatusFilter('with_advance')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    bookingStatusFilter === 'with_advance'
                      ? 'bg-purple-500 text-slate-950 font-black border-purple-400 shadow-md shadow-purple-500/20'
                      : 'bg-purple-950/30 text-purple-300 border-purple-500/30 hover:bg-purple-900/40'
                  }`}
                >
                  بها مقدم حجز 💰 ({bookingsStats.bookingsWithAdvanceCount})
                </button>
              </div>
            </div>

            {/* 3. Comprehensive Bookings Cards List */}
            <div className="space-y-3">
              {filteredBookingsList.map(b => {
                const totalAmt = getBookingTotalAmount(b);
                const advanceAmt = getBookingTotalAdvances(b);
                const remainingAmt = Math.max(0, totalAmt - advanceAmt);
                const advancesList = getBookingAdvancesList(b);
                const isExpanded = expandedBookingId === b.id;
                const cleanPhone = (b.phone || b.clientPhone || '').replace(/\D/g, '');
                const branchObj = (branches || []).find(br => br.id === (b as any).branchId);
                const branchName = branchObj ? branchObj.name : '';

                // فحص تواريخ الإنشاء وموعد الحجز
                const createdRaw = (b as any).createdAt || (b as any).created_at;
                let createdDateFormatted = '';
                let isCreatedInPeriod = false;
                let isScheduledInPeriod = false;

                if (createdRaw) {
                  isCreatedInPeriod = isDateInSelectedPeriod(createdRaw);
                  try {
                    const cd = new Date(createdRaw);
                    if (!isNaN(cd.getTime())) {
                      createdDateFormatted = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')} ${String(cd.getHours()).padStart(2, '0')}:${String(cd.getMinutes()).padStart(2, '0')}`;
                    } else {
                      createdDateFormatted = String(createdRaw).substring(0, 16);
                    }
                  } catch {
                    createdDateFormatted = String(createdRaw).substring(0, 16);
                  }
                }
                isScheduledInPeriod = isDateInSelectedPeriod(b.date);
                const isAdvancePaidInPeriod = advancesList.some((a: any) => isDateInSelectedPeriod(getAdvanceEffectiveDate(a, b)));

                return (
                  <div 
                    key={b.id} 
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg hover:border-slate-700 transition-all space-y-3"
                  >
                    {/* Top Row: Code, Badges, Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Booking Code */}
                        <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-slate-950 text-purple-300 border border-purple-500/30">
                          {b.bookingCode ? (b.bookingCode.startsWith('#') ? b.bookingCode : `#${b.bookingCode}`) : `#${b.id.substring(0, 6)}`}
                        </span>

                        {/* Badges for Created in Period & Scheduled in Period */}
                        {isCreatedInPeriod && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-500/25 text-purple-200 border border-purple-400/40 flex items-center gap-1 shadow-sm">
                            <span>⚡</span>
                            <span>أُنشئ بالفترة</span>
                          </span>
                        )}
                        {isScheduledInPeriod && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center gap-1">
                            <span>📅</span>
                            <span>موعد بالفترة</span>
                          </span>
                        )}
                        {isAdvancePaidInPeriod && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 flex items-center gap-1 shadow-sm">
                            <span>💰</span>
                            <span>عربون مسدد بالفترة</span>
                          </span>
                        )}

                        {/* Branch badge if available */}
                        {branchName && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                            <Building2 size={11} className="text-amber-400" />
                            <span>{branchName}</span>
                          </span>
                        )}

                        {/* Booking Source badge */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/60">
                          {b.source === 'online' ? '🌐 أونلاين' : b.source === 'phone' ? '📞 اتصال' : '💻 كاشير'}
                        </span>

                        {/* Queue number if exists */}
                        {b.queueNumber && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            الدور #{b.queueNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Advance Badge */}
                        {advanceAmt > 0 ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                            <span>مقدم حجز:</span>
                            <span className="font-mono text-white">{advanceAmt.toLocaleString()}</span>
                            <span>{currency}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-800">
                            بدون مقدم
                          </span>
                        )}

                        {/* Status Badge */}
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                          b.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          b.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          b.status === 'cancelled' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                          'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {b.status === 'completed' && <span>مكتمل ✓</span>}
                          {b.status === 'confirmed' && <span>مؤكد 📅</span>}
                          {b.status === 'pending' && <span>معلق ⏳</span>}
                          {b.status === 'cancelled' && <span>ملغي ✕</span>}
                        </span>
                      </div>
                    </div>

                    {/* Middle Section: Client Info + Date/Time */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                      
                      {/* Client Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-purple-400 shrink-0" />
                          <h4 className="text-sm font-black text-white">{b.clientName || 'عميل بدون اسم'}</h4>
                        </div>

                        {/* Phone and Actions */}
                        {(b.phone || b.clientPhone) && (
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span className="text-slate-400 font-mono text-[11px]">{b.phone || b.clientPhone}</span>
                            
                            {/* WhatsApp Button */}
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-[10px] font-bold transition-all"
                                title="مراسلة العميل عبر واتساب"
                              >
                                <MessageCircle size={12} />
                                <span>واتساب</span>
                              </a>
                            )}

                            {/* Call Button */}
                            <a
                              href={`tel:${b.phone || b.clientPhone}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 text-[10px] font-bold transition-all"
                              title="اتصال هاتفي"
                            >
                              <Phone size={12} />
                              <span>اتصال</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Date & Time Badge */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                            <Calendar size={14} className="text-purple-400" />
                            <span>موعد الحجز: {b.date}</span>
                          </div>
                          <div className="w-px h-4 bg-slate-700 hidden sm:block"></div>
                          <div className="flex items-center gap-1.5 text-purple-300 font-mono font-bold">
                            <Clock size={14} className="text-purple-400" />
                            <span>{b.time || '--:--'}</span>
                          </div>
                        </div>

                        {createdDateFormatted && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 sm:border-r sm:pr-2.5 sm:border-slate-800">
                            <span className="text-purple-400 font-bold">⚡ وُثّق:</span>
                            <span className="font-mono text-slate-300">{createdDateFormatted}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Services and Assigned Staff */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                        <span className="flex items-center gap-1">
                          <Scissors size={13} className="text-amber-400" />
                          <span>الخدمات المحجوزة:</span>
                        </span>
                        <span>الحلاق/الموظف: <strong className="text-slate-200">{getBookingEmployeeNames(b)}</strong></span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {b.services && Array.isArray(b.services) && b.services.length > 0 ? (
                          b.services.map((srv: any, idx: number) => (
                            <div 
                              key={idx} 
                              className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-200 font-bold flex items-center gap-2"
                            >
                              <span>{srv.serviceName || srv.name || 'خدمة'}</span>
                              <span className="font-mono text-emerald-400 text-[11px]">
                                {(Number(srv.price) || 0).toLocaleString()} {currency}
                              </span>
                              {srv.employeeName && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({srv.employeeName})
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-200 font-bold">
                            {b.serviceName || 'خدمة صالون'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Breakdown Box */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">إجمالي الحجز</span>
                        <span className="font-mono font-black text-white text-sm">
                          {totalAmt.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span>
                        </span>
                      </div>

                      <div className="border-r border-l border-slate-800">
                        <span className="text-[10px] text-purple-300 font-bold block mb-0.5">مقدم حجز محصل</span>
                        <span className="font-mono font-black text-purple-300 text-sm">
                          {advanceAmt > 0 ? `+${advanceAmt.toLocaleString()}` : '0'} <span className="text-[10px] font-normal text-purple-400">{currency}</span>
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-amber-300 font-bold block mb-0.5">المتبقي عند الحضور</span>
                        <span className={`font-mono font-black text-sm ${remainingAmt > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {remainingAmt.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{currency}</span>
                        </span>
                      </div>
                    </div>

                    {/* Client Notes & Internal Admin Notes */}
                    {(b.notes || b.internalNotes) && (
                      <div className="space-y-1.5 pt-1">
                        {/* Client Notes */}
                        {b.notes && (
                          <div className="text-xs bg-slate-800/50 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2 text-slate-300">
                            <MessageCircle size={14} className="text-blue-400 mt-0.5 shrink-0" />
                            <div>
                              <strong className="text-blue-300 block text-[11px] mb-0.5">ملاحظات العميل:</strong>
                              <p className="leading-relaxed">{b.notes}</p>
                            </div>
                          </div>
                        )}

                        {/* Internal Admin Notes (Private & Confidential) */}
                        {b.internalNotes && (
                          <div className="text-xs bg-amber-950/20 p-2.5 rounded-xl border border-amber-500/30 flex items-start gap-2 text-amber-200">
                            <Lock size={14} className="text-amber-400 mt-0.5 shrink-0" />
                            <div>
                              <strong className="text-amber-400 block text-[11px] mb-0.5">ملاحظات الإدارة الداخلية (سرية):</strong>
                              <p className="leading-relaxed text-amber-100">{b.internalNotes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expandable Details Button */}
                    {advancesList.length > 0 && (
                      <div className="pt-1">
                        <button
                          onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
                          className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          <span>{isExpanded ? 'إخفاء تفاصيل دفعات مقدم الحجز' : `عرض تفاصيل دفعات مقدم الحجز (${advancesList.length})`}</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">دفعات مقدم الحجز المسددة:</p>
                            <div className="space-y-1.5">
                              {advancesList.map((adv: any, aIdx: number) => (
                                <div key={aIdx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900 border border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                    <span className="font-bold text-white">دفعة #{aIdx + 1}</span>
                                    <span className="text-[10px] text-slate-400">({adv.date || b.date})</span>
                                    {adv.notes && <span className="text-[10px] text-slate-400">- {adv.notes}</span>}
                                  </div>
                                  <div className="text-left font-mono font-bold text-purple-300">
                                    +{(Number(adv.amount) || 0).toLocaleString()} {currency}
                                    <span className="text-[10px] text-slate-400 font-sans mr-1">({adv.paymentMethod || 'نقدي'})</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Created By Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
                      <span>
                        سُجل بواسطة: <strong className="text-slate-400">{b.createdByName || b.createdBy || 'النظام'}</strong>
                      </span>
                      {b.createdAt && (
                        <span>بتاريخ: {b.createdAt.split('T')[0]}</span>
                      )}
                    </div>

                  </div>
                );
              })}

              {filteredBookingsList.length === 0 && (
                <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
                  <Calendar size={36} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-bold text-slate-400">لا توجد حجوزات مطابقة للفترة المحددة أو خيارات التصفية</p>
                  {(bookingSearchQuery || bookingStatusFilter !== 'all') && (
                    <button
                      onClick={() => { setBookingSearchQuery(''); setBookingStatusFilter('all'); }}
                      className="text-xs text-purple-400 hover:underline font-bold mt-1 cursor-pointer"
                    >
                      إعادة ضبط التصفية وعرض الكل
                    </button>
                  )}
                </div>
              )}
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
