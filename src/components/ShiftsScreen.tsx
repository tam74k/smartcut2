import React, { useState, useEffect, useMemo } from 'react';
import { 
  AppSettings, 
  Invoice, 
  Transaction, 
  Branch, 
  Employee, 
  AppUser, 
  WorkShift, 
  FingerprintLog 
} from '../types';
import { 
  CalendarClock, 
  Search, 
  Printer, 
  Download, 
  RefreshCw, 
  Clock, 
  User, 
  Wallet, 
  Eye, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Layers,
  Banknote,
  Calendar
} from 'lucide-react';
import { DB } from '../services/db';
import { ClosingReportReceipt } from './ClosingReportReceipt';
import { handlePrintReceipt } from '../utils/print';
import { exportToExcel } from '../utils/exportExcel';
import { formatInvoiceDateTimeDisplay } from '../utils/timezone';
import { resolveMainTreasury, getTransactionTargetTreasuryId } from '../utils/treasury';

interface ShiftsScreenProps {
  settings: AppSettings;
  invoices: Invoice[];
  transactions: Transaction[];
  employees?: Employee[];
  fingerprintLogs?: FingerprintLog[];
  branches?: Branch[];
  activeBranchId?: string;
  currentUser?: AppUser | null;
  shiftData?: {
    isOpen: boolean;
    date: string;
    initialCash: number;
    shiftCode?: string;
    shiftId?: string;
    [key: string]: any;
  };
}

export function ShiftsScreen({
  settings,
  invoices = [],
  transactions = [],
  employees = [],
  fingerprintLogs = [],
  branches = [],
  activeBranchId,
  currentUser,
  shiftData
}: ShiftsScreenProps) {
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [branchFilter, setBranchFilter] = useState<string>(activeBranchId || 'all');
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState<WorkShift | null>(null);

  // Helper to identify shift zeroing/closing
  const isZeroingOrClosingTrx = (t: any): boolean => {
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

  // Load shifts from DB and merge with current open shift & inferred shifts
  const loadShifts = async () => {
    setIsLoading(true);
    try {
      const dbShifts = await DB.fetchWorkShifts(settings.salonId, branchFilter !== 'all' ? branchFilter : undefined);
      let merged: WorkShift[] = Array.isArray(dbShifts) ? [...dbShifts] : [];

      // 1. Ensure current active open shift from state is included
      if (shiftData?.isOpen) {
        const activeCode = (shiftData as any)?.shiftCode || (shiftData as any)?.shift_code || `SH-${(shiftData.date || '').replace(/-/g, '')}-01`;
        const existingIdx = merged.findIndex(s => s.shiftCode === activeCode || s.id === (shiftData as any).shiftId);
        const openShiftObj: WorkShift = {
          id: (shiftData as any).shiftId || ('SHIFT-' + activeCode),
          shiftCode: activeCode,
          salonId: settings.salonId,
          branchId: activeBranchId || (shiftData as any).branchId,
          shiftDate: shiftData.date,
          openedAt: (shiftData as any).openedAt || new Date().toISOString(),
          openedByUserId: (shiftData as any).openedByUserId || currentUser?.id,
          openedByUserName: (shiftData as any).openedByUserName || currentUser?.name || 'الكاشير',
          openedByName: (shiftData as any).openedByName || (shiftData as any).openedByUserName || currentUser?.name || 'الكاشير',
          openedByRole: (shiftData as any).openedByRole || currentUser?.role || 'cashier',
          initialCash: Number(shiftData.initialCash) || 0,
          status: 'open'
        };

        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], ...openShiftObj, status: 'open' };
        } else {
          merged.unshift(openShiftObj);
        }
      }

      // 2. Discover any shiftCodes from transactions or invoices that might not be recorded in work_shifts
      const knownCodes = new Set(merged.map(s => s.shiftCode).filter(Boolean));
      const codeToMeta = new Map<string, { date: string; branchId?: string; openedBy?: string; firstTime?: string }>();

      invoices.forEach(inv => {
        const code = inv.shiftCode || (inv as any).shift_code;
        if (code && !knownCodes.has(code) && !codeToMeta.has(code)) {
          codeToMeta.set(code, {
            date: inv.shiftDate || (inv.date ? inv.date.split('T')[0] : new Date().toISOString().split('T')[0]),
            branchId: inv.branchId,
            openedBy: inv.cashierName || inv.createdBy,
            firstTime: inv.date
          });
        }
      });

      transactions.forEach(trx => {
        const code = trx.shiftCode || (trx as any).shift_code;
        if (code && !knownCodes.has(code) && !codeToMeta.has(code)) {
          codeToMeta.set(code, {
            date: trx.shiftDate || (trx.date ? trx.date.split('T')[0] : new Date().toISOString().split('T')[0]),
            branchId: trx.branchId,
            openedBy: trx.userName || trx.createdBy,
            firstTime: trx.date
          });
        }
      });

      codeToMeta.forEach((meta, code) => {
        merged.push({
          id: 'SHIFT-' + code,
          shiftCode: code,
          salonId: settings.salonId,
          branchId: meta.branchId,
          shiftDate: meta.date,
          openedAt: meta.firstTime || new Date().toISOString(),
          openedByName: meta.openedBy || 'الكاشير',
          initialCash: 0,
          status: 'closed'
        });
      });

      // Sort: open shifts first, then newest opened_at / shiftDate
      merged.sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (b.status === 'open' && a.status !== 'open') return 1;
        const dateA = a.openedAt || a.shiftDate || '';
        const dateB = b.openedAt || b.shiftDate || '';
        return dateB.localeCompare(dateA);
      });

      setShifts(merged);
    } catch (err) {
      console.error('Error loading shifts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, [settings.salonId, branchFilter]);

  // Treasury stats calculation for a specific shift
  const calculateShiftStats = (shift: WorkShift) => {
    const code = (shift.shiftCode || shift.id || '').trim();
    const mainTreasury = resolveMainTreasury(settings.treasuries);

    // 1. Matched invoices
    const shiftInvs = invoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      const invCode = (inv.shiftCode || (inv as any).shift_code || (inv as any).shiftId || '').trim();
      return invCode === code;
    });

    // 2. Matched transactions
    const shiftTrxs = transactions.filter(t => {
      if (isZeroingOrClosingTrx(t)) return false;
      const tCode = (t.shiftCode || (t as any).shift_code || (t as any).shiftId || '').trim();
      const desc = String(t.description || '');
      return tCode === code || desc.includes(code);
    });

    const invoiceIdsInTrx = new Set(
      shiftTrxs.filter(t => t.type === 'in' && ((t as any).invoiceId || (t as any).invoice_id))
        .map(t => (t as any).invoiceId || (t as any).invoice_id)
    );

    // Calculate for each registered treasury
    const treasuryTotals: Record<string, number> = {};
    (settings.treasuries || []).forEach(treasury => {
      const isMain = treasury.isMain || treasury.id === 'main' || treasury.id === mainTreasury.id;
      const tTrx = shiftTrxs.filter(t => {
        const assigned = getTransactionTargetTreasuryId(t, settings.treasuries);
        return assigned === treasury.id;
      });

      const invoiceSales = isMain ? 0 : shiftInvs.reduce((sum, inv) => {
        if (invoiceIdsInTrx.has(inv.id)) return sum;
        const methods = inv.paymentMethods && inv.paymentMethods.length > 0
          ? inv.paymentMethods
          : [{ amount: Number(inv.total) || 0, treasuryId: inv.paymentMethod || 'cash' }];
        const matched = methods.filter((pm: any) => {
          const pmTarget = getTransactionTargetTreasuryId({ treasury: pm.treasuryId || pm.paymentMethod }, settings.treasuries);
          return pmTarget === treasury.id;
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
      const tips = isMain ? 0 : tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isTipTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const commissions = isMain ? 0 : tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isCommissionTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const transfersIn = isMain ? 0 : tTrx.filter(t => t.type === 'in' && isRealTransferTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const transfersOut = tTrx.filter(t => (t.type === 'out' || (t.type as string) === 'expense') && isRealTransferTrx(t)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const expenses = isMain ? 0 : tTrx.filter(t => 
        (t.type === 'out' || (t.type as string) === 'expense') && 
        !isTipTrx(t) && 
        !isCommissionTrx(t) && 
        !isRealTransferTrx(t)
      ).reduce((s, x) => s + (Number(x.amount) || 0), 0);

      const net = isMain 
        ? -transfersOut 
        : (income + transfersIn) - (expenses + tips + commissions + transfersOut);

      treasuryTotals[treasury.id] = net;
    });

    // Determine Cash specifically (from cash drawer treasury)
    const cashTreasury = settings.treasuries.find(t => !t.isMain && (t.type === 'cash' || t.id === 'cash' || t.name.includes('كاش') || t.name.includes('درج'))) || settings.treasuries[0];
    const totalCash = cashTreasury ? (treasuryTotals[cashTreasury.id] || 0) : 0;
    const totalSales = shiftInvs.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

    return {
      shiftInvs,
      shiftTrxs,
      invoiceCount: shiftInvs.length,
      totalSales,
      totalCash,
      treasuryTotals
    };
  };

  // Filtered shifts based on search, status, and branch
  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      // 1. Status Filter
      if (statusFilter === 'open' && s.status !== 'open') return false;
      if (statusFilter === 'closed' && s.status === 'open') return false;

      // 2. Branch Filter
      if (branchFilter !== 'all' && s.branchId && s.branchId !== branchFilter) return false;

      // 3. Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const code = (s.shiftCode || s.id || '').toLowerCase();
        const date = (s.shiftDate || '').toLowerCase();
        const openedBy = (s.openedByName || s.openedByUserName || '').toLowerCase();
        const closedBy = (s.closedByName || s.closedByUserName || '').toLowerCase();
        if (!code.includes(term) && !date.includes(term) && !openedBy.includes(term) && !closedBy.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [shifts, statusFilter, branchFilter, searchTerm]);

  // Overall metrics summary
  const summaryMetrics = useMemo(() => {
    let totalShiftsCount = filteredShifts.length;
    let openShiftsCount = filteredShifts.filter(s => s.status === 'open').length;
    let grandSales = 0;
    let grandCash = 0;

    filteredShifts.forEach(s => {
      const stats = calculateShiftStats(s);
      grandSales += stats.totalSales;
      grandCash += stats.totalCash;
    });

    return {
      totalShiftsCount,
      openShiftsCount,
      grandSales,
      grandCash
    };
  }, [filteredShifts, invoices, transactions]);

  // Excel Export
  const handleExportExcel = () => {
    const headers = [
      'تاريخ الوردية',
      'كود الوردية',
      'الحالة',
      'وقت الفتح',
      'وقت الإغلاق',
      'مستخدم الفتح',
      'مستخدم الإغلاق',
      'عدد الفواتير',
      'إجمالي المبيعات',
      'إجمالي كاش',
      ...(settings.treasuries || []).map(t => `خزينة: ${t.name}`)
    ];

    const rows = filteredShifts.map(s => {
      const stats = calculateShiftStats(s);
      const isShiftOpen = s.status === 'open';
      return [
        s.shiftDate || '',
        s.shiftCode || s.id || '',
        isShiftOpen ? 'مفتوحة حالياً' : 'مغلقة',
        s.openedAt ? formatInvoiceDateTimeDisplay(s.openedAt, 'ar-EG') : '-',
        s.closedAt ? formatInvoiceDateTimeDisplay(s.closedAt, 'ar-EG') : (isShiftOpen ? 'مفتوحة حالياً' : '-'),
        s.openedByName || s.openedByUserName || 'الكاشير',
        isShiftOpen ? 'قيد العمل' : (s.closedByName || s.closedByUserName || '-'),
        stats.invoiceCount,
        stats.totalSales.toFixed(2),
        stats.totalCash.toFixed(2),
        ...(settings.treasuries || []).map(t => (stats.treasuryTotals[t.id] || 0).toFixed(2))
      ];
    });

    exportToExcel(`سجل_الورديات_${new Date().toISOString().split('T')[0]}`, 'سجل الورديات', headers, rows);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden animate-in fade-in text-black font-sans" style={{ color: '#000000' }}>
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-black shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-black text-white rounded-xl shadow-xs">
              <CalendarClock size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-black flex items-center gap-2">
                <span>سجل وعرض الورديات</span>
                <span className="text-xs font-bold text-black bg-white border border-black px-2 py-0.5 rounded-lg font-mono">
                  {filteredShifts.length} وردية
                </span>
              </h1>
              <p className="text-xs text-black mt-0.5 font-semibold">
                متابعة تواريخ وأوقات فتح وإغلاق الورديات، المستخدمين، إجماليات الكاش والخزائن، والاطلاع على التقرير التفصيلي لكل وردية
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={loadShifts}
            className="p-2 bg-white hover:bg-slate-100 text-black border border-black rounded-xl transition-all cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-white hover:bg-slate-100 text-black border border-black px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-black shadow-2xs flex flex-col justify-between text-black">
          <span className="text-[11px] font-bold text-black">إجمالي الورديات</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-black font-mono">{summaryMetrics.totalShiftsCount}</span>
            <Layers size={16} className="text-black" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-black shadow-2xs flex flex-col justify-between text-black">
          <span className="text-[11px] font-bold text-black">الورديات المفتوحة حالياً</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-black font-mono">{summaryMetrics.openShiftsCount}</span>
            <Clock size={16} className="text-black" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-black shadow-2xs flex flex-col justify-between text-black">
          <span className="text-[11px] font-bold text-black">إجمالي مبيعات الفواتير</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-black font-mono">{summaryMetrics.grandSales.toFixed(0)}</span>
            <span className="text-[10px] text-black font-bold">{settings.currency}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border-2 border-black text-black shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-black">إجمالي الكاش المحصل</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-black">
              {summaryMetrics.grandCash.toFixed(0)}
            </span>
            <span className="text-[10px] text-black font-bold">{settings.currency}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-black">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-black" />
          <input
            type="text"
            placeholder="بحث بكود الوردية، التاريخ، أو اسم المستخدم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white pr-9 pl-3 py-1.5 text-xs font-bold text-black border border-black rounded-lg outline-hidden"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {branches && branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-white border border-black text-xs font-bold text-black rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer"
            >
              <option value="all">كافة الفروع</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center border border-black rounded-lg overflow-hidden bg-white text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 transition-colors cursor-pointer ${statusFilter === 'all' ? 'bg-black text-white' : 'text-black hover:bg-slate-100'}`}
            >
              الكل
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 transition-colors cursor-pointer border-r border-black ${statusFilter === 'open' ? 'bg-black text-white' : 'text-black hover:bg-slate-100'}`}
            >
              مفتوحة
            </button>
            <button
              onClick={() => setStatusFilter('closed')}
              className={`px-3 py-1.5 transition-colors cursor-pointer border-r border-black ${statusFilter === 'closed' ? 'bg-black text-white' : 'text-black hover:bg-slate-100'}`}
            >
              مغلقة
            </button>
          </div>
        </div>
      </div>

      {/* Shifts Main Table */}
      <div className="bg-white rounded-2xl border border-black shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-black font-bold flex flex-col items-center justify-center gap-2">
            <RefreshCw size={28} className="animate-spin text-black" />
            <p className="text-sm text-black">جارٍ تحميل سجل الورديات...</p>
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="py-16 text-center text-black font-bold flex flex-col items-center justify-center gap-3">
            <CalendarClock size={40} className="text-black stroke-1" />
            <p className="text-base text-black font-bold">لا توجد ورديات مطابقة لخيارات البحث المحددة</p>
            <p className="text-xs text-black">يمكنك تعديل معايير البحث أو فتح وردية جديدة من شاشة نقطة البيع</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs text-black">
              <thead>
                <tr className="bg-white border-b-2 border-black font-black text-black">
                  <th className="py-3 px-3 text-center border-l border-black">م</th>
                  <th className="py-3 px-3 border-l border-black">تاريخ الوردية</th>
                  <th className="py-3 px-3 border-l border-black">كود الوردية</th>
                  <th className="py-3 px-3 border-l border-black">وقت الفتح</th>
                  <th className="py-3 px-3 border-l border-black">وقت الإغلاق</th>
                  <th className="py-3 px-3 border-l border-black">مستخدم الفتح</th>
                  <th className="py-3 px-3 border-l border-black">مستخدم الإغلاق</th>
                  <th className="py-3 px-3 border-l border-black text-center">إجمالي كاش</th>
                  {/* Dynamic Treasuries Headers */}
                  {(settings.treasuries || []).map(t => (
                    <th key={t.id} className="py-3 px-3 border-l border-black text-center whitespace-nowrap">
                      {t.name}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center">تفاصيل الوردية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black font-medium text-black">
                {filteredShifts.map((shift, idx) => {
                  const stats = calculateShiftStats(shift);
                  const isShiftOpen = shift.status === 'open';

                  return (
                    <tr 
                      key={shift.id || idx} 
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Index */}
                      <td className="py-3 px-3 text-center font-mono font-bold border-l border-black">
                        {idx + 1}
                      </td>

                      {/* Shift Date */}
                      <td className="py-3 px-3 font-bold border-l border-black whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-black" />
                          <span>{shift.shiftDate}</span>
                        </div>
                      </td>

                      {/* Shift Code & Status Badge */}
                      <td className="py-3 px-3 font-mono font-bold border-l border-black whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{shift.shiftCode || shift.id}</span>
                          {isShiftOpen ? (
                            <span className="text-[10px] font-black border border-black bg-white px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                              <span>نشطة</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold border border-black bg-white px-1.5 py-0.5 rounded-full">
                              مغلقة
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Open Time */}
                      <td className="py-3 px-3 font-mono border-l border-black whitespace-nowrap">
                        {shift.openedAt ? formatInvoiceDateTimeDisplay(shift.openedAt, 'ar-EG') : '-'}
                      </td>

                      {/* Close Time */}
                      <td className="py-3 px-3 font-mono border-l border-black whitespace-nowrap">
                        {isShiftOpen ? (
                          <span className="font-bold border border-black px-1.5 py-0.5 rounded text-[10px]">مفتوحة حالياً</span>
                        ) : shift.closedAt ? (
                          formatInvoiceDateTimeDisplay(shift.closedAt, 'ar-EG')
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Opened By */}
                      <td className="py-3 px-3 border-l border-black whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <User size={12} className="text-black" />
                          <span className="font-bold">{shift.openedByName || shift.openedByUserName || 'الكاشير'}</span>
                        </div>
                      </td>

                      {/* Closed By */}
                      <td className="py-3 px-3 border-l border-black whitespace-nowrap">
                        {isShiftOpen ? (
                          <span className="text-[11px] font-semibold">قيد العمل...</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <User size={12} className="text-black" />
                            <span className="font-bold">{shift.closedByName || shift.closedByUserName || '-'}</span>
                          </div>
                        )}
                      </td>

                      {/* Total Cash */}
                      <td className="py-3 px-3 text-center font-mono font-black border-l border-black whitespace-nowrap">
                        <span>{stats.totalCash.toFixed(2)}</span>
                        <span className="text-[10px] font-bold mr-1">{settings.currency}</span>
                      </td>

                      {/* Dynamic Treasuries Values */}
                      {(settings.treasuries || []).map(t => {
                        const val = stats.treasuryTotals[t.id] || 0;
                        return (
                          <td key={t.id} className="py-3 px-3 text-center font-mono font-bold border-l border-black whitespace-nowrap">
                            {val !== 0 ? val.toFixed(2) : '-'}
                          </td>
                        );
                      })}

                      {/* Action: Open Shift Details Modal */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedShiftForDetails(shift)}
                          className="bg-black hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                          title="عرض تقرير وتفاصيل هذه الوردية بالكامل"
                        >
                          <Eye size={13} />
                          <span>تفاصيل الوردية</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Full Shift Report Details for the Selected Shift */}
      {selectedShiftForDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden border-2 border-black flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-black flex items-center justify-between bg-white">
              <div>
                <h3 className="font-black text-base text-black flex items-center gap-2">
                  <CalendarClock size={18} className="text-black" />
                  <span>تقرير تفاصيل الوردية: {selectedShiftForDetails.shiftCode || selectedShiftForDetails.id}</span>
                </h3>
                <p className="text-xs text-black mt-0.5 font-semibold">
                  تاريخ: {selectedShiftForDetails.shiftDate} • الحالة: {selectedShiftForDetails.status === 'open' ? 'مفتوحة حالياً' : 'مغلقة'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedShiftForDetails(null)}
                className="text-black hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer border border-black"
                title="إغلاق النافذة"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Receipt Content Area */}
            <div className="p-4 overflow-y-auto flex justify-center bg-slate-50 flex-1">
              <div id="shift-history-modal-receipt-container" className="bg-white shadow-sm p-4 w-full rounded-2xl border border-black">
                {(() => {
                  const targetCode = (selectedShiftForDetails.shiftCode || '').trim();
                  const targetId = (selectedShiftForDetails.id || (selectedShiftForDetails as any).shiftId || '').trim();
                  const targetDate = selectedShiftForDetails.shiftDate;

                  // 1. Matched invoices for this specific shift
                  const shiftInvs = invoices.filter(inv => {
                    if (inv.status === 'cancelled') return false;
                    const invCode = (inv.shiftCode || (inv as any).shift_code || '').trim();
                    const invShiftId = (inv.shiftId || (inv as any).shift_id || '').trim();
                    if (targetCode && (invCode === targetCode || invShiftId === targetCode)) return true;
                    if (targetId && (invCode === targetId || invShiftId === targetId)) return true;
                    if (!targetCode && !targetId) return inv.shiftDate === targetDate || inv.date?.startsWith(targetDate);
                    return false;
                  });

                  // 2. Matched transactions for this specific shift
                  const shiftTrxs = transactions.filter(t => {
                    if (isZeroingOrClosingTrx(t)) return false;
                    const tCode = (t.shiftCode || (t as any).shift_code || '').trim();
                    const tShiftId = (t.shiftId || (t as any).shift_id || '').trim();
                    const desc = String(t.description || '');
                    if (targetCode && (tCode === targetCode || tShiftId === targetCode || desc.includes(targetCode))) return true;
                    if (targetId && (tCode === targetId || tShiftId === targetId)) return true;
                    if (!targetCode && !targetId) return t.shiftDate === targetDate || t.date?.startsWith(targetDate);
                    return false;
                  });

                  return (
                    <ClosingReportReceipt 
                      settings={settings}
                      reportTitle={`تقرير إغلاق الوردية (${selectedShiftForDetails.shiftCode || ''})`}
                      shiftCode={selectedShiftForDetails.shiftCode}
                      transactions={shiftTrxs}
                      invoices={shiftInvs}
                      dateLabel={selectedShiftForDetails.shiftDate}
                      initialCash={selectedShiftForDetails.initialCash || 0}
                      userName={selectedShiftForDetails.closedByName || selectedShiftForDetails.openedByName || 'المسؤول'}
                      employees={employees}
                      fingerprintLogs={fingerprintLogs}
                    />
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-white border-t border-black flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintReceipt('print-receipt', false, settings.paperSize || '80mm')}
                  className="bg-black hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Printer size={15} />
                  <span>طباعة حراري ({settings.paperSize || '80mm'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintReceipt('print-receipt', false, 'a4')}
                  className="bg-white hover:bg-slate-100 text-black border border-black px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer size={15} />
                  <span>طباعة A4</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShiftForDetails(null)}
                className="bg-white hover:bg-slate-100 text-black border border-black px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
