import { useState, useMemo } from 'react';
import { AppSettings, Booking, Invoice, Transaction, PurchaseInvoice, ItemMovement, Branch } from '../types';
import { 
  TrendingUp, Receipt, CalendarClock, ArrowUpRight, ArrowDownRight, 
  Edit2, FileText, Banknote, Eye, X, Trash2, AlertTriangle, Package,
  Bell, CheckCircle2, Check, Scissors, Calendar, Clock, User, Building2
} from 'lucide-react';
import { DashboardChartsSection } from './DashboardChartsSection';
import { AuthService } from '../services/auth';
import { DB } from '../services/db';

export function DashboardScreen({ 
  settings, 
  isShiftOpen, 
  shiftDate, 
  shiftData,
  bookings, 
  setBookings, 
  transactions, 
  setTransactions, 
  onToPOS, 
  invoices, 
  products,
  purchaseInvoices = [],
  itemMovements = [],
  activeBranchId,
  branches = [],
  employees = []
}: { 
  settings: AppSettings, 
  isShiftOpen: boolean, 
  shiftDate: string,
  shiftData?: { isOpen: boolean, date: string, initialCash: number, shiftId?: string, openedAt?: string, lastClosedAt?: string },
  bookings: Booking[],
  setBookings: (b: Booking[] | ((prev: Booking[]) => Booking[])) => void,
  transactions: Transaction[],
  setTransactions: (t: Transaction[]) => void,
  onToPOS: (b: Booking) => void,
  invoices: Invoice[],
  products: any[],
  purchaseInvoices?: PurchaseInvoice[],
  itemMovements?: ItemMovement[],
  activeBranchId?: string,
  branches?: Branch[],
  employees?: any[]
}) {
  const [advPaymentModal, setAdvPaymentModal] = useState<string | null>(null);
  const [advAmount, setAdvAmount] = useState('');
  const [advTreasury, setAdvTreasury] = useState(settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || '');
  
  const [showRevenueDetails, setShowRevenueDetails] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);

  const mainBranch = (branches && branches[0]) || { id: 'b-main', name: 'الفرع الرئيسي' };
  const mainBranchId = mainBranch.id;
  const isMainBranch = !activeBranchId || activeBranchId === mainBranchId || activeBranchId === 'b-main';

  const matchesActiveBranch = (itemBranchId?: string, itemBranchCode?: string) => {
    if (!itemBranchId && !itemBranchCode) return true; // Items without explicit branchId are visible
    if (branches.length <= 1) return true; // Single-branch salon
    if (itemBranchId === activeBranchId) return true;
    const currentBranch = branches.find(b => b.id === activeBranchId);
    if (currentBranch) {
      if (itemBranchId === currentBranch.code || itemBranchId === currentBranch.id) return true;
      if (itemBranchCode && (itemBranchCode === currentBranch.code || itemBranchCode === currentBranch.id)) return true;
    }
    if (isMainBranch && (
      itemBranchId === mainBranchId || itemBranchId === 'b-main' || itemBranchId === 'BR-01' || itemBranchId === 'BR-MAIN' ||
      itemBranchCode === 'BR-01' || itemBranchCode === 'b-main'
    )) return true;
    return false;
  };

  // Branch-specific filtering
  const branchInvoices = invoices.filter(inv => matchesActiveBranch(inv.branchId, (inv as any).branchCode));
  const branchTransactions = transactions.filter(t => matchesActiveBranch((t as any).branchId, (t as any).branchCode));
  const branchBookings = bookings.filter(b => matchesActiveBranch((b as any).branchId, (b as any).branchCode));

  // Determine Today's date accurately (Local and UTC)
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const utcToday = now.toISOString().split('T')[0];

  // تاريخ الوردية المفتوحة المستهدف حصراً
  const targetShiftDate = (isShiftOpen && (shiftData?.date || shiftDate))
    ? (shiftData?.date || shiftDate).split('T')[0].split(' ')[0].trim()
    : '';

  // دالة فحص العمليات التابعة للوردية الحالية المفتوحة حصراً طبقاً لمعرف الوردية أو تاريخها
  const matchesCurrentShift = (dateStr?: string, _createdAtStr?: string, itemShiftId?: string, itemShiftDate?: string) => {
    // 1. إذا كانت الوردية مغلقة، يجب تصفير كافة المؤشرات للبدء بنظافة كاملة (0)
    if (!isShiftOpen || !targetShiftDate) return false;

    const currentShiftId = shiftData?.shiftId || (shiftData as any)?.id;

    // 2. إذا كان معرف الوردية متوفراً، يعامل كمعيار قطعي للفصل بين ورديات نفس اليوم
    if (currentShiftId && itemShiftId) {
      return itemShiftId === currentShiftId;
    }

    // 3. إذا كان العنصر ينتمي لمعرف وردية أخرى
    if (currentShiftId && itemShiftId && itemShiftId !== currentShiftId) {
      return false;
    }

    // 4. إذا كان العنصر يحمل تاريخ وردية مطابق لتاريخ الوردية الحالية المفتوحة (توافقية للسجلات بدون shiftId)
    if (itemShiftDate && itemShiftDate.split('T')[0].split(' ')[0].trim() === targetShiftDate) {
      return true;
    }

    // 5. فحص التاريخ الفعلي للعملية ومقارنته حصراً بتاريخ الوردية المفتوحة
    const dateOnly = (dateStr || '').split('T')[0].split(' ')[0].trim();
    if (dateOnly && dateOnly === targetShiftDate) {
      return true;
    }

    return false;
  };

  // ── حجوزات موعد تنفيذها اليوم (Execution Date Today Bookings) ──
  const shiftBookings = useMemo(() => {
    // تاريخ التنفيذ المستهدف (تاريخ الوردية الحالية إن وجدت أو اليوم المحلي)
    const targetExecutionDate = targetShiftDate || localToday;
    if (!targetExecutionDate) return [];

    return branchBookings.filter(b => {
      if (b.status === 'completed' || b.status === 'cancelled') return false;
      // فحص موعد تنفيذ الحجز المجدول حصراً (Booking Scheduled Execution Date)
      const bDateOnly = (b.date || '').trim().split('T')[0].split(' ')[0].trim();
      return bDateOnly === targetExecutionDate;
    });
  }, [branchBookings, isShiftOpen, shiftDate, shiftData, localToday, targetShiftDate]);
  const pendingBookings = branchBookings.filter(b => b.status === 'pending');

  const handleConfirmBooking = async (bookingId: string) => {
    const nowIso = new Date().toISOString();
    const nowEpoch = Date.now();
    const target = bookings.find(b => b.id === bookingId);
    const updated = target ? { ...target, status: 'confirmed' as const, updatedAt: nowIso, updated_at: nowIso, _localEditedAt: nowEpoch } : null;

    setBookings((prev: Booking[]) => prev.map(b => b.id === bookingId ? { ...b, status: 'confirmed', updatedAt: nowIso, updated_at: nowIso, _localEditedAt: nowEpoch } : b));

    if (updated) {
      try {
        const stored = localStorage.getItem('smartcut_bookings');
        if (stored) {
          const list = JSON.parse(stored);
          localStorage.setItem('smartcut_bookings', JSON.stringify(list.map((b: any) => b.id === bookingId ? { ...b, ...updated } : b)));
        }
      } catch (e) {}
      await DB.saveBooking(updated, settings.salonId);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (confirm('هل أنت متأكد من إلغاء هذا الحجز؟')) {
      const nowIso = new Date().toISOString();
      const nowEpoch = Date.now();
      const target = bookings.find(b => b.id === bookingId);
      const updated = target ? { ...target, status: 'cancelled' as const, updatedAt: nowIso, updated_at: nowIso, _localEditedAt: nowEpoch } : null;

      setBookings((prev: Booking[]) => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled', updatedAt: nowIso, updated_at: nowIso, _localEditedAt: nowEpoch } : b));

      if (updated) {
        try {
          const stored = localStorage.getItem('smartcut_bookings');
          if (stored) {
            const list = JSON.parse(stored);
            localStorage.setItem('smartcut_bookings', JSON.stringify(list.map((b: any) => b.id === bookingId ? { ...b, ...updated } : b)));
          }
        } catch (e) {}
        await DB.saveBooking(updated, settings.salonId);
      }
    }
  };

  // دمج كافة الحركات المسجلة مع الفواتير المكتملة لاحتساب الأرصدة التاريخية التراكمية للخزائن بدقة
  const unifiedTransactions = useMemo(() => {
    const txList = transactions || [];
    const invList = invoices || [];
    const knownInvoiceIds = new Set(
      txList
        .filter(t => (t as any).invoiceId || (t as any).invoice_id)
        .map(t => (t as any).invoiceId || (t as any).invoice_id)
    );

    const syntheticTrxs: Transaction[] = [];
    invList.forEach(inv => {
      if (inv.status === 'cancelled' || (inv as any).is_cancelled || (inv as any).isCancelled) return;
      if (knownInvoiceIds.has(inv.id)) return;

      const methods = (inv.paymentMethods && inv.paymentMethods.length > 0)
        ? inv.paymentMethods
        : [{ amount: Number(inv.total) || 0, treasuryId: inv.treasuryId || inv.paymentMethod || 'cash' }];

      methods.forEach((split: any, idx: number) => {
        if (split.treasuryId === 'cashback' || split.treasuryId === 'remedy_free') return;
        const amt = Number(split.amount) || 0;
        if (amt <= 0) return;

        syntheticTrxs.push({
          id: `TRX-INV-${inv.id}${methods.length > 1 ? `-${idx + 1}` : ''}`,
          salonId: (inv as any).salonId || (inv as any).salon_id || settings.salonId,
          date: inv.date,
          type: 'in',
          amount: amt,
          category: 'sales',
          description: `فاتورة #${inv.invoiceNumber || inv.id.slice(-6)}`,
          treasury: split.treasuryId,
          branchId: (inv as any).branchId || (inv as any).branch_id || activeBranchId,
          invoiceId: inv.id,
        } as any);
      });
    });

    return [...txList, ...syntheticTrxs];
  }, [transactions, invoices, settings.salonId, activeBranchId]);

  // Compute stats for today based on transactions & invoices (صفر تلقائياً عند إغلاق الوردية)
  const todayTrx = useMemo(() => {
    if (!isShiftOpen) return [];
    return branchTransactions.filter(t => 
      matchesCurrentShift(
        t.date, 
        (t as any).createdAt || (t as any).created_at, 
        (t as any).shiftId,
        t.shiftDate || (t as any).shift_date
      )
    );
  }, [branchTransactions, isShiftOpen, shiftDate, shiftData]);
  
  // Pure Today's Sales Revenue (تصفير كامل عند إغلاق الوردية)
  const todayInvoices = useMemo(() => {
    if (!isShiftOpen) return [];
    return branchInvoices.filter(inv => 
      matchesCurrentShift(
        inv.date, 
        (inv as any).createdAt || (inv as any).created_at, 
        (inv as any).shiftId,
        (inv as any).shiftDate || (inv as any).shift_date
      ) && inv.status !== 'cancelled'
    );
  }, [branchInvoices, isShiftOpen, shiftDate, shiftData]);

  // مقدمات الحجز المحصلة في تاريخ اليوم/الوردية حسب الخزينة (من المعاملات ومن جدول الحجوزات)
  const getBookingAdvancesForTreasury = (matcher: (treasuryId?: string) => boolean) => {
    if (!isShiftOpen) return 0;
    const targetDate = targetShiftDate || localToday;

    // 1. من جدول المعاملات المالية المباشرة لليوم/الوردية
    const fromTrx = todayTrx.filter(t => 
      t.type === 'in' && 
      (t.category === 'مقدم حجز' || t.category === 'booking_advance' || t.category === 'advance' || (t.description && t.description.includes('مقدم حجز'))) &&
      matcher(t.treasury || (t as any).treasuryId)
    );
    const sumTrx = fromTrx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 2. من جدول الحجوزات (لأي حجز مسجل به دفعات مقدمة بتاريخ الوردية ولم تسجل في transactions)
    let fromBookingsOnly = 0;
    (branchBookings || []).forEach(b => {
      if (b.status === 'cancelled') return;
      const advances = (b.advancePayments && Array.isArray(b.advancePayments))
        ? b.advancePayments
        : (typeof (b as any).advance_payments === 'string'
          ? (() => { try { return JSON.parse((b as any).advance_payments); } catch { return []; } })()
          : []);

      advances.forEach((adv: any) => {
        // استخراج تاريخ سداد الدفعة المقدمة الفعلي
        let advDate = '';
        const rawAdvShift = (adv.shiftDate || (adv as any).shift_date || '').split('T')[0].trim();
        const rawAdvDate = (adv.paymentDate || (adv as any).payment_date || adv.date || '').split('T')[0].trim();
        const rawCreated = ((b as any).createdAt || (b as any).created_at || '').split('T')[0].trim();
        const rawBShift = (b.shiftDate || (b as any).shift_date || '').split('T')[0].trim();

        if (rawAdvShift) {
          advDate = rawAdvShift;
        } else if (rawAdvDate && new Date(rawAdvDate).getTime() <= Date.now() + 86400000) {
          advDate = rawAdvDate;
        } else if (rawCreated && new Date(rawCreated).getTime() <= Date.now() + 86400000) {
          advDate = rawCreated;
        } else if (rawBShift) {
          advDate = rawBShift;
        } else if (rawAdvDate) {
          advDate = rawAdvDate;
        } else if (b.date && new Date(b.date).getTime() <= Date.now() + 86400000) {
          advDate = (b.date || '').split('T')[0].trim();
        } else {
          advDate = localToday;
        }

        if (advDate !== targetDate) return;
        const advTreasuryId = adv.treasuryId || adv.paymentMethod || 'cash';
        if (!matcher(advTreasuryId)) return;
        const amt = Number(adv.amount) || 0;
        if (amt <= 0) return;

        const alreadyInTrx = fromTrx.some(t => 
          Math.abs((Number(t.amount) || 0) - amt) < 0.01 &&
          (t.description?.includes(b.id) || t.description?.includes(b.clientName) || (t as any).bookingId === b.id)
        );

        if (!alreadyInTrx) {
          fromBookingsOnly += amt;
        }
      });
    });

    return sumTrx + fromBookingsOnly;
  };

  // مقدمات الحجز المحصلة في الوردية الحالية إجمالياً (تُحتسب ضمن مبيعات اليوم لأنها فلوس دخلت فعلياً للمحل)
  const todayBookingAdvances = useMemo(() => {
    return getBookingAdvancesForTreasury(() => true);
  }, [todayTrx, branchBookings, isShiftOpen, shiftDate, shiftData, localToday, targetShiftDate]);

  const todaySalesRevenue = useMemo(() => {
    if (!isShiftOpen) return 0;
    const invoicesTotal = todayInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    return invoicesTotal + todayBookingAdvances;
  }, [todayInvoices, todayBookingAdvances, isShiftOpen]);

  const todayInvoicesCount = useMemo(() => {
    if (!isShiftOpen) return 0;
    return todayInvoices.length;
  }, [todayInvoices, isShiftOpen]);

  // ── فواتير الوردية الحالية المفتوحة (Current Shift Invoices) ──
  const currentShiftInvoices = useMemo(() => {
    if (!isShiftOpen || !targetShiftDate) return [];
    return branchInvoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      return matchesCurrentShift(inv.date, (inv as any).createdAt || (inv as any).created_at, (inv as any).shiftId || (inv as any).shift_id, (inv as any).shiftDate || (inv as any).shift_date);
    }).sort((a, b) => {
      const timeA = new Date(a.date || (a as any).createdAt || 0).getTime();
      const timeB = new Date(b.date || (b as any).createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [branchInvoices, isShiftOpen, shiftDate, shiftData, targetShiftDate]);

  // ── الحجوزات المنشأة خلال الوردية الحالية المفتوحة (Current Shift Reservations) ──
  const currentShiftReservations = useMemo(() => {
    if (!isShiftOpen || !targetShiftDate) return [];

    return branchBookings.filter(b => {
      if (b.status === 'cancelled') return false;
      // 1. الحجوزات التي تم إنشاؤها وتسجيلها خلال تاريخ الوردية المفتوحة
      const createdRaw = ((b as any).createdAt || (b as any).created_at || b.shiftDate || '').trim();
      const createdDateOnly = createdRaw.split('T')[0].split(' ')[0].trim();
      if (createdDateOnly === targetShiftDate) return true;

      // 2. أو الحجوزات التي تم سداد دفعة مقدمة لها خلال تاريخ الوردية المفتوحة
      const advances = (b.advancePayments && Array.isArray(b.advancePayments)) ? b.advancePayments : [];
      return advances.some((adv: any) => {
        const aDate = (adv.shiftDate || (adv as any).shift_date || adv.paymentDate || (adv as any).payment_date || adv.date || '').split('T')[0].trim();
        return aDate === targetShiftDate;
      });
    }).sort((a, b) => {
      const timeA = new Date(a.createdAt || (a as any).created_at || a.shiftDate || (a.advancePayments && a.advancePayments[0]?.paymentDate) || 0).getTime();
      const timeB = new Date(b.createdAt || (b as any).created_at || b.shiftDate || (b.advancePayments && b.advancePayments[0]?.paymentDate) || 0).getTime();
      return timeB - timeA;
    });
  }, [branchBookings, isShiftOpen, shiftDate, shiftData, targetShiftDate]);

  const shiftInvoicesTotalAmount = useMemo(() => {
    return currentShiftInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  }, [currentShiftInvoices]);

  const shiftReservationsTotalAmount = useMemo(() => {
    return currentShiftReservations.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
  }, [currentShiftReservations]);

  const shiftReservationsTotalAdvances = useMemo(() => {
    return currentShiftReservations.reduce((sum, b) => {
      const advs = b.advancePayments?.reduce((s, p) => s + (Number(p.amount) || 0), 0) || 0;
      return sum + advs;
    }, 0);
  }, [currentShiftReservations]);
  
  // Total Income (excluding opening float and transfers)
  const totalIncome = useMemo(() => {
    if (!isShiftOpen) return 0;
    return todayTrx
      .filter(t => {
        if (t.type !== 'in') return false;
        const cat = (t.category || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        if (cat === 'عهدة افتتاحية' || cat === 'initial_cash' || desc.includes('عهدة بداية') || desc.includes('رصيد افتتاحي') || desc.includes('عهدة افتتاحية')) return false;
        if (cat === 'transfer' || desc.includes('تحويل')) return false;
        return true;
      })
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [todayTrx, isShiftOpen]);
  
  // دالة فحص ما إذا كانت المعاملة تمثل سلفة موظف
  const isStaffAdvanceTrx = (t: any) => {
    const isOut = t.type === 'out' || (t.type as string) === 'expense' || (t.category && t.category.includes('سلف'));
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

  // Total Expenses (purchases, expenses, bills, operational payouts — excluding staff advances and drawer transfers)
  const totalExpense = useMemo(() => {
    if (!isShiftOpen) return 0;
    return todayTrx
      .filter(t => {
        const isOut = t.type === 'out' || (t.type as string) === 'expense' || t.category === 'expense' || t.category === 'مصروفات' || (t.category && t.category.includes('مصروف'));
        if (!isOut) return false;
        if (isStaffAdvanceTrx(t)) return false;
        const cat = (t.category || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        if (cat === 'transfer' || desc.includes('تحويل') || desc.includes('تصفير')) return false;
        return true;
      })
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [todayTrx, isShiftOpen]);
  
  // Total Advances (سلف الموظفين المصروفة خلال الوردية الحالية)
  const totalAdvancesGiven = useMemo(() => {
    if (!isShiftOpen) return 0;
    const fromTrx = todayTrx
      .filter(isStaffAdvanceTrx)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    let fromEmpRecords = 0;
    if (employees && Array.isArray(employees)) {
      employees.forEach(emp => {
        if (emp.branchId && !matchesActiveBranch(emp.branchId, (emp as any).branchCode)) return;

        (emp.financialRecords || []).forEach((r: any) => {
          const isSalaryRecord = r.type === 'salary' || (r.type === 'advance' && (r.id?.startsWith('FIN-SAL-') || r.note?.includes('مسير رواتب') || r.note?.includes('تم استلام صافي الراتب')));
          if (r.type === 'advance' && !isSalaryRecord) {
            const matchesShift = matchesCurrentShift(
              r.date, 
              (r as any).createdAt || (r as any).created_at, 
              (r as any).shiftId, 
              (r as any).shiftDate
            );
            if (matchesShift) {
              const rAmt = Number(r.amount) || 0;
              const alreadyInTrx = todayTrx.some(t => 
                isStaffAdvanceTrx(t) &&
                Math.abs((Number(t.amount) || 0) - rAmt) < 0.01 &&
                (t.id === r.id || t.id?.includes(r.id) || (t.description && (t.description.includes(emp.name) || t.description.includes('سلف'))))
              );
              if (!alreadyInTrx) {
                fromEmpRecords += rAmt;
              }
            }
          }
        });
      });
    }

    return fromTrx + fromEmpRecords;
  }, [todayTrx, employees, isShiftOpen, shiftDate, shiftData]);

  const handlePayAdvance = (booking: Booking) => {
    if (!advAmount || isNaN(Number(advAmount))) return;
    const treasury = settings.treasuries.find(t=>t.id===advTreasury);
    if(!treasury) return;

    const amount = Number(advAmount);
    
    const timePart = new Date().toTimeString().split(' ')[0] || '12:00:00';
    const effectiveDate = targetShiftDate ? `${targetShiftDate}T${timePart}` : new Date().toISOString();

    // Add to booking advances
    const newAdvance = {
      id: Math.random().toString(36).substr(2,9),
      amount,
      treasuryId: treasury.id,
      treasuryName: treasury.name,
      date: effectiveDate,
      shiftDate: targetShiftDate || undefined,
      shiftId: shiftData?.shiftId || undefined
    };
    
    setBookings(bookings.map(b => 
      b.id === booking.id ? { ...b, advancePayments: [...b.advancePayments, newAdvance] } : b
    ));

    // Add transaction
    const newTrx: Transaction = {
      id: 'TRX-' + Math.random().toString(36).substr(2,9),
      date: effectiveDate,
      type: 'in',
      amount,
      category: 'مقدم حجز',
      description: `مقدم حجز للعميل ${booking.clientName}`,
      treasury: treasury.id,
      shiftDate: targetShiftDate || undefined,
      shiftId: shiftData?.shiftId || undefined,
      branchId: booking.branchId || (booking as any).branch_id || activeBranchId
    };
    setTransactions([...transactions, newTrx]);

    setAdvPaymentModal(null);
    setAdvAmount('');
    alert(`تمت إضافة ${amount} إلى ${treasury.name}`);
  };

  const handleToInvoice = (booking: Booking) => {
    onToPOS(booking);
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking({...booking}); // Clone for editing
  };

  const saveEditBooking = async () => {
    if (!editingBooking) return;
    const servicesTotal = (editingBooking.services || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const nowIso = new Date().toISOString();
    const nowEpoch = Date.now();
    const updatedBooking: Booking = {
      ...editingBooking,
      totalAmount: servicesTotal,
      updatedAt: nowIso,
      updated_at: nowIso,
      _localEditedAt: nowEpoch,
      salonId: editingBooking.salonId || (editingBooking as any).salon_id || settings.salonId,
      branchId: editingBooking.branchId || (editingBooking as any).branch_id || activeBranchId
    };

    setBookings((prev: Booking[]) => prev.map(b => b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b));

    try {
      const stored = localStorage.getItem('smartcut_bookings');
      const list = stored ? JSON.parse(stored) : [];
      const updatedList = list.map((b: any) => b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b);
      localStorage.setItem('smartcut_bookings', JSON.stringify(updatedList));
    } catch (e) {}

    try {
      await DB.saveBooking(updatedBooking, settings.salonId);
    } catch (err) {
      console.error('Failed to save edited booking to DB from Dashboard:', err);
    }

    setEditingBooking(null);
  };

  const removeServiceFromEdit = (serviceId: string) => {
    if(editingBooking) {
      setEditingBooking({
        ...editingBooking,
        services: editingBooking.services.filter(s => s.id !== serviceId)
      });
    }
  };

  return (
    <div className="p-6 w-full h-full overflow-y-auto relative">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-slate-800">نظرة عامة (لوحة التحكم)</h2>
        {isShiftOpen && targetShiftDate ? (
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>الوردية المفتوحة: <strong className="font-mono text-emerald-900">{targetShiftDate}</strong></span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl font-medium text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span>الوردية مغلقة (تاريخ اليوم: {localToday})</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setShowRevenueDetails(!showRevenueDetails)}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
        >
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">
              {isShiftOpen && targetShiftDate ? `مبيعات الوردية (${targetShiftDate})` : 'مبيعات اليوم'} (اضغط للتفاصيل)
            </p>
            <h3 className="text-lg font-extrabold text-emerald-600 font-mono">{todaySalesRevenue.toFixed(2)} <span className="text-sm font-normal text-slate-500">{settings.currency}</span></h3>
            {todayBookingAdvances > 0 && (
              <p className="text-[11px] font-bold text-teal-600 flex items-center gap-1 mt-1">
                <span>📅 منها مقدمات حجز:</span>
                <span className="font-mono">+{todayBookingAdvances.toFixed(2)} {settings.currency}</span>
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">
              {isShiftOpen ? 'فواتير الوردية' : 'فواتير اليوم'}
            </p>
            <h3 className="text-lg font-extrabold text-slate-800">{todayInvoicesCount} <span className="text-sm font-normal text-slate-400">فاتورة</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
            <Receipt size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">
              {isShiftOpen ? 'مصروفات الوردية' : 'مصروفات اليوم'}
            </p>
            <h3 className="text-lg font-extrabold text-slate-800 font-mono">{totalExpense.toFixed(2)} <span className="text-sm font-normal text-slate-500">{settings.currency}</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <ArrowUpRight size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">{isShiftOpen ? 'سلف الوردية' : 'سلف اليوم'}</p>
            <h3 className="text-lg font-extrabold text-slate-800 font-mono">{totalAdvancesGiven.toFixed(2)} <span className="text-sm font-normal text-slate-500">{settings.currency}</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
            <ArrowDownRight size={20} />
          </div>
        </div>
      </div>

      {showRevenueDetails && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 mb-6 shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-slate-700/80 pb-3">
            <div>
              <h3 className="font-black text-base flex items-center gap-2 text-white">
                <span>تفاصيل الخزائن والإيرادات ({isShiftOpen && targetShiftDate ? `وردية: ${targetShiftDate}` : 'الوردية مغلقة - تصفير أدراج الوردية'})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">تفصيل دقيق يوضح عهدة ومبيعات الوردية، مع إظهار الرصيد الفعلي المتراكم للخزينة الرئيسية بشكل مستمر</p>
            </div>
            <button 
              onClick={() => setShowRevenueDetails(false)} 
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer self-end sm:self-auto"
            >
              <X size={18}/>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {settings.treasuries.map(t => {
              const isCash = t.id === 'cash' || t.name.includes('كاش') || t.name.includes('الدرج');
              const isMain = Boolean(t.isMain || t.id === 'main' || t.name.includes('الرئيسية'));

              // مطابقة الحركات مع الخزينة الحالية
              const matchesTreasury = (itemTId?: string) => {
                if (!itemTId) return false;
                if (itemTId === t.id) return true;
                if (isMain && (itemTId === 'main' || itemTId === 'treasury-main' || itemTId === 'primary')) return true;
                return false;
              };

              // 1. حساب الرصيد التراكمي الشامل (لجميع الفترات والتاريخ بالكامل)
              const tAllTrx = unifiedTransactions.filter(trx => matchesTreasury(trx.treasury || (trx as any).treasuryId));
              const cumulativeIn = tAllTrx.filter(trx => trx.type === 'in').reduce((sum, trx) => sum + (Number(trx.amount) || 0), 0);
              const cumulativeOut = tAllTrx.filter(trx => 
                trx.type === 'out' || 
                (trx.type as string) === 'expense' || 
                trx.category === 'expense' || 
                trx.category === 'مصروفات' || 
                trx.category?.includes('مصروف')
              ).reduce((sum, trx) => sum + (Number(trx.amount) || 0), 0);
              const cumulativeBalance = cumulativeIn - cumulativeOut;

              // 2. حركات اليوم / الوردية الحالية
              const tTrx = todayTrx.filter(trx => matchesTreasury(trx.treasury || (trx as any).treasuryId));
              const invoiceIdsInTrx = new Set(
                tTrx.filter(trx => trx.type === 'in' && ((trx as any).invoiceId || (trx as any).invoice_id))
                  .map(trx => (trx as any).invoiceId || (trx as any).invoice_id)
              );
              const unrecordedSales = todayInvoices.reduce((sum, inv) => {
                if (invoiceIdsInTrx.has(inv.id)) return sum;
                const methods = inv.paymentMethods && inv.paymentMethods.length > 0
                  ? inv.paymentMethods
                  : [{ amount: Number(inv.total) || 0, treasuryId: inv.paymentMethod || 'cash' }];
                const matched = methods.filter((m: any) => matchesTreasury(m.treasuryId));
                return sum + matched.reduce((s: number, m: any) => s + (Number(m.amount) || 0), 0);
              }, 0);

              const custody = tTrx.filter(trx => trx.type === 'in' && (trx.category === 'عهدة افتتاحية' || trx.category === 'initial_cash')).reduce((sum, trx) => sum + trx.amount, 0);
              const bookingAdvancesAmt = getBookingAdvancesForTreasury(matchesTreasury);
              const sales = tTrx.filter(trx => trx.type === 'in' && (trx.category === 'sales' || trx.category === 'مبيعات')).reduce((sum, trx) => sum + trx.amount, 0) + unrecordedSales;
              const otherIn = tTrx.filter(trx => trx.type === 'in' && trx.category !== 'عهدة افتتاحية' && trx.category !== 'initial_cash' && trx.category !== 'sales' && trx.category !== 'مبيعات' && trx.category !== 'مقدم حجز' && trx.category !== 'booking_advance' && trx.category !== 'advance' && !(trx.description && trx.description.includes('مقدم حجز'))).reduce((sum, trx) => sum + trx.amount, 0);
              const income = custody + sales + bookingAdvancesAmt + otherIn;
              // حساب سلف الموظفين الخاصة بهذه الخزينة
              const trxAdvancesForTreasury = tTrx.filter(isStaffAdvanceTrx).reduce((sum, trx) => sum + (Number(trx.amount) || 0), 0);
              let empRecAdvancesForTreasury = 0;
              if (employees && Array.isArray(employees)) {
                employees.forEach(emp => {
                  if (emp.branchId && !matchesActiveBranch(emp.branchId, (emp as any).branchCode)) return;
                  (emp.financialRecords || []).forEach((r: any) => {
                    const isSalary = r.type === 'salary' || (r.type === 'advance' && (r.id?.startsWith('FIN-SAL-') || r.note?.includes('مسير رواتب') || r.note?.includes('تم استلام صافي الراتب')));
                    if (r.type === 'advance' && !isSalary) {
                      const rTreasury = r.treasuryId || (isCash ? 'cash' : '');
                      if (matchesTreasury(rTreasury)) {
                        const matchesShift = matchesCurrentShift(r.date, (r as any).createdAt || (r as any).created_at, (r as any).shiftId, (r as any).shiftDate);
                        if (matchesShift) {
                          const rAmt = Number(r.amount) || 0;
                          const alreadyInTrx = tTrx.some(trx => 
                            isStaffAdvanceTrx(trx) &&
                            Math.abs((Number(trx.amount) || 0) - rAmt) < 0.01 &&
                            (trx.id === r.id || (trx.description && trx.description.includes(emp.name)))
                          );
                          if (!alreadyInTrx) {
                            empRecAdvancesForTreasury += rAmt;
                          }
                        }
                      }
                    }
                  });
                });
              }
              const totalAdvancesForTreasury = trxAdvancesForTreasury + empRecAdvancesForTreasury;

              const regularExpenses = tTrx.filter(trx => {
                if (isStaffAdvanceTrx(trx)) return false;
                const isOut = trx.type === 'out' || (trx.type as string) === 'expense' || trx.category === 'expense' || trx.category === 'مصروفات' || trx.category?.includes('مصروف');
                if (!isOut) return false;
                if (trx.category === 'transfer' || trx.description?.includes('تحويل')) return false;
                return true;
              }).reduce((sum, trx) => sum + (Number(trx.amount) || 0), 0);

              const outcome = regularExpenses + totalAdvancesForTreasury;
              const net = income - outcome;

              if (isMain) {
                return (
                  <div 
                    key={t.id} 
                    className="p-4 rounded-2xl border transition-all bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-800/90 border-emerald-500/50 shadow-inner"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                        <span>🏛️</span>
                        {t.name}
                      </span>
                      <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300/30">
                        الخزينة الرئيسية (رصيد متراكم)
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* مبيعات اليوم/الوردية الموجهة لها */}
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1">
                          <span>🛍️</span>
                          <span>{isShiftOpen ? 'مبيعات الوردية الموجهة لها:' : 'مبيعات اليوم الموجهة لها:'}</span>
                        </span>
                        <span className="text-emerald-400 font-bold font-mono">+{sales.toFixed(2)} {settings.currency}</span>
                      </div>

                      {/* مقدم حجز */}
                      <div className={`flex justify-between items-center ${bookingAdvancesAmt > 0 ? 'bg-teal-500/15 border border-teal-400/30 px-2 py-1 rounded-lg text-teal-200 font-extrabold' : 'text-slate-300'}`}>
                        <span className="flex items-center gap-1">
                          <span>📅</span>
                          <span>مقدم حجز:</span>
                        </span>
                        <span className={`font-mono ${bookingAdvancesAmt > 0 ? 'text-teal-300 font-black' : 'text-slate-300 font-bold'}`}>
                          +{bookingAdvancesAmt.toFixed(2)} {settings.currency}
                        </span>
                      </div>

                      {/* إيداعات وتحويلات اليوم/الوردية */}
                      {otherIn > 0 && (
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="flex items-center gap-1">
                            <span>📥</span>
                            <span>{isShiftOpen ? 'إيداعات وتحويلات الوردية:' : 'إيداعات وتحويلات اليوم:'}</span>
                          </span>
                          <span className="text-teal-400 font-bold font-mono">+{otherIn.toFixed(2)} {settings.currency}</span>
                        </div>
                      )}

                      {/* سلف موظفين المنصرفة من هذه الخزينة */}
                      {totalAdvancesForTreasury > 0 && (
                        <div className="flex justify-between items-center bg-amber-500/15 border border-amber-400/30 px-2 py-1 rounded-lg text-amber-200 font-extrabold">
                          <span className="flex items-center gap-1">
                            <span>🤝</span>
                            <span>سلف موظفين:</span>
                          </span>
                          <span className="text-amber-300 font-bold font-mono">-{totalAdvancesForTreasury.toFixed(2)} {settings.currency}</span>
                        </div>
                      )}

                      {/* مسحوبات ومصروفات اليوم/الوردية */}
                      <div className="flex justify-between items-center text-slate-300 border-b border-slate-700/80 pb-2">
                        <span className="flex items-center gap-1">
                          <span>💸</span>
                          <span>{isShiftOpen ? 'مسحوبات ومصروفات الوردية:' : 'مسحوبات ومصروفات اليوم:'}</span>
                        </span>
                        <span className="text-rose-400 font-bold font-mono">-{regularExpenses.toFixed(2)} {settings.currency}</span>
                      </div>

                      {/* إجمالي الحركات المتراكمة الشاملة */}
                      <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-2.5 my-1 space-y-1">
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                          <span>إجمالي المقبوضات التراكمية:</span>
                          <span className="font-mono text-emerald-400 font-bold">+{cumulativeIn.toFixed(2)} {settings.currency}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                          <span>إجمالي المدفوعات التراكمية:</span>
                          <span className="font-mono text-rose-400 font-bold">-{cumulativeOut.toFixed(2)} {settings.currency}</span>
                        </div>
                      </div>

                      {/* الرصيد الفعلي المتراكم للخزينة الرئيسية */}
                      <div className="flex justify-between items-center pt-1 font-black text-sm text-white">
                        <span className="flex items-center gap-1 text-emerald-200">
                          <span>🏛️</span>
                          <span>الرصيد الفعلي المتراكم:</span>
                        </span>
                        <span className={`font-mono text-base font-black ${cumulativeBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {cumulativeBalance.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={t.id} 
                  className={`p-4 rounded-2xl border transition-all ${
                    isCash 
                      ? 'bg-gradient-to-b from-indigo-950/80 to-slate-800/90 border-indigo-500/50 shadow-inner' 
                      : 'bg-slate-800/80 border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      {isCash && <span>💵</span>}
                      {!isCash && <span>💳</span>}
                      {t.name}
                    </span>
                    {isCash && (
                      <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300/30">
                        كاش الدرج
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Highlighted Custody Row for Cash */}
                    {custody > 0 && (
                      <div className="flex justify-between items-center bg-amber-500/15 border border-amber-400/30 px-2.5 py-1.5 rounded-xl text-amber-200 font-extrabold">
                        <span className="flex items-center gap-1">
                          <span>💰</span>
                          <span>العهدة الافتتاحية:</span>
                        </span>
                        <span className="font-mono text-amber-100 font-black">+{custody.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}

                    {/* Sales Row */}
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="flex items-center gap-1">
                        <span>🛍️</span>
                        <span>{isShiftOpen ? 'مبيعات وإيرادات الوردية:' : 'مبيعات وإيرادات اليوم:'}</span>
                      </span>
                      <span className="text-emerald-400 font-bold font-mono">+{sales.toFixed(2)} {settings.currency}</span>
                    </div>

                    {/* Booking Advances Row - مقدم حجز (يظهر دائماً في جميع الخزائن) */}
                    <div className={`flex justify-between items-center ${bookingAdvancesAmt > 0 ? 'bg-teal-500/15 border border-teal-400/30 px-2 py-1 rounded-lg text-teal-200 font-extrabold' : 'text-slate-300'}`}>
                      <span className="flex items-center gap-1">
                        <span>📅</span>
                        <span>مقدم حجز:</span>
                      </span>
                      <span className={`font-mono ${bookingAdvancesAmt > 0 ? 'text-teal-300 font-black' : 'text-slate-300 font-bold'}`}>
                        +{bookingAdvancesAmt.toFixed(2)} {settings.currency}
                      </span>
                    </div>

                    {/* Other Inflows */}
                    {otherIn > 0 && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1">
                          <span>📥</span>
                          <span>{isShiftOpen ? 'إيداعات أخرى (الوردية):' : 'إيداعات أخرى:'}</span>
                        </span>
                        <span className="text-teal-400 font-bold font-mono">+{otherIn.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}

                    {/* سلف موظفين المنصرفة من هذه الخزينة */}
                    {totalAdvancesForTreasury > 0 && (
                      <div className="flex justify-between items-center bg-amber-500/15 border border-amber-400/30 px-2 py-1 rounded-lg text-amber-200 font-extrabold">
                        <span className="flex items-center gap-1">
                          <span>🤝</span>
                          <span>سلف موظفين:</span>
                        </span>
                        <span className="text-amber-300 font-bold font-mono">-{totalAdvancesForTreasury.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}

                    {/* Outflows */}
                    <div className="flex justify-between items-center text-slate-300 border-b border-slate-700/80 pb-2">
                      <span className="flex items-center gap-1">
                        <span>💸</span>
                        <span>{isShiftOpen ? 'مسحوبات ومصروفات الوردية:' : 'مسحوبات ومصروفات:'}</span>
                      </span>
                      <span className="text-rose-400 font-bold font-mono">-{regularExpenses.toFixed(2)} {settings.currency}</span>
                    </div>

                    {/* Total Net Balance in Drawer */}
                    <div className="flex justify-between items-center pt-1 font-black text-sm text-white">
                      <span>{isCash ? 'الرصيد الفعلي بالدرج:' : 'الرصيد الفعلي بالخزينة:'}</span>
                      <span className={`font-mono ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {net.toFixed(2)} {settings.currency}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unconfirmed Bookings Alert & Action Section */}
      <div className="bg-white rounded-3xl border border-amber-200/80 shadow-sm p-5 mb-6 overflow-hidden relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold relative">
              <Bell size={20} className="animate-bounce" />
              {pendingBookings.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white"></span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-slate-900">الحجوزات الجديدة بانتظار التأكيد</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  pendingBookings.length > 0 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {pendingBookings.length > 0 ? `${pendingBookings.length} حجز معلق` : 'لا توجد حجوزات معلقة ✓'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">الحجوزات الواردة عبر التطبيق أو الموقع والتي لم يتم تأكيدها وقبولها من قبل الصالون بعد</p>
            </div>
          </div>
        </div>

        {pendingBookings.length === 0 ? (
          <div className="py-6 text-center text-slate-400 font-semibold text-xs flex flex-col items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-400 mb-1.5 opacity-80" />
            <p>جميع الحجوزات مؤكدة ومحدثة! لا توجد حجوزات جديدة بانتظار الاعتماد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingBookings.map((booking) => {
              const totalAdvance = booking.advancePayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

              return (
                <div 
                  key={booking.id}
                  className="bg-gradient-to-br from-amber-50/60 via-white to-orange-50/30 rounded-2xl p-4 border border-amber-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          {booking.time || '12:00'}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">{booking.clientName}</h4>
                          <p className="text-[11px] text-slate-500 font-mono font-bold" dir="ltr">{booking.phone}</p>
                        </div>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                        قيد الانتظار ⏳
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100/80 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                        <Calendar size={13} className="text-amber-600" />
                        <span>التاريخ: {booking.date}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        <span className="font-bold text-slate-700">الخدمات: </span>
                        {booking.services.map(s => s.serviceName).join(' + ') || 'خدمة عامة'}
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-xs font-bold">
                        <span className="text-slate-500">القيمة الإجمالية:</span>
                        <span className="text-slate-900 font-black font-mono">
                          {booking.totalAmount || 0} {settings.currency}
                        </span>
                      </div>
                      {totalAdvance > 0 && (
                        <div className="flex justify-between items-center text-[11px] text-emerald-600 font-bold">
                          <span>المقدم المدفوع:</span>
                          <span>{totalAdvance} {settings.currency}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-amber-100">
                    <button
                      onClick={() => handleConfirmBooking(booking.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Check size={14} />
                      <span>تأكيد الحجز</span>
                    </button>
                    <button
                      onClick={() => onToPOS(booking)}
                      className="bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Scissors size={14} />
                      <span>تحويل للـ POS</span>
                    </button>
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="col-span-2 text-rose-600 hover:bg-rose-50 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <X size={13} />
                      <span>إلغاء ورفض الحجز</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-1">
          <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            تنبيهات نواقص المخزون
          </h3>
          <div className="space-y-3">
            {products && products.filter(p => p.currentStock <= p.reorderLimit).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">لا يوجد نواقص في المخزون</p>
            ) : (
              products && products.filter(p => p.currentStock <= p.reorderLimit).slice(0, 5).map(p => (
                <div key={p.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-orange-50 text-orange-500">
                      <Package size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-[13px]">{p.name}</p>
                      <p className="text-[11px] text-slate-500">حد الطلب: {p.reorderLimit}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-red-600 text-[13px]">{p.currentStock}</p>
                    <p className="text-[10px] text-slate-500">متبقي</p>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <CalendarClock className="text-primary" size={18} />
              حجوزات موعد تنفيذها اليوم
            </h3>
            {!isShiftOpen ? (
              <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold">الوردية مغلقة (اليوم: {localToday})</span>
            ) : (
              <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md font-bold">تاريخ الوردية المفتوحة: {targetShiftDate}</span>
            )}
          </div>
          
          <div className="flex-1 space-y-3">
            {shiftBookings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                <CalendarClock size={40} className="mb-2 opacity-50 text-slate-300" />
                <p className="text-[13px]">{isShiftOpen ? `لا توجد حجوزات موعد تنفيذها في تاريخ الوردية (${targetShiftDate})` : 'لا توجد حجوزات موعد تنفيذها اليوم'}</p>
              </div>
            ) : (
              shiftBookings.map(booking => {
                const totalAdvance = booking.advancePayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                return (
                <div key={booking.id} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-primary/30 shadow-sm transition-all flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-secondary flex items-center justify-center font-bold text-[13px]">
                        {booking.time}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-[14px]">{booking.clientName}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span dir="ltr" className="font-semibold">{booking.phone}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="font-bold text-emerald-600">
                            مقدم: {totalAdvance} {settings.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {advPaymentModal === booking.id ? (
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-md border border-slate-200 w-full md:w-auto">
                          <input 
                            type="number" 
                            placeholder="المبلغ" 
                            className="w-20 px-2 py-1 text-[12px] rounded border border-slate-200 outline-none focus:border-primary"
                            value={advAmount}
                            onChange={(e) => setAdvAmount(e.target.value)}
                          />
                          <select 
                            className="w-24 px-1 py-1 text-[12px] rounded border border-slate-200 outline-none focus:border-primary bg-white"
                            value={advTreasury}
                            onChange={e => setAdvTreasury(e.target.value)}
                          >
                            {settings.treasuries.filter(t => !t.isMain).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                          <button onClick={() => handlePayAdvance(booking)} className="bg-emerald-500 text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-emerald-600">سداد</button>
                          <button onClick={() => {setAdvPaymentModal(null); setAdvAmount('')}} className="text-slate-500 hover:bg-slate-200 px-2 py-1 rounded text-[11px] font-bold">إلغاء</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                          <button 
                            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors"
                            onClick={() => setAdvPaymentModal(booking.id)}
                          >
                            <Banknote size={14} /> سداد مقدم
                          </button>
                          <button 
                            onClick={() => setPreviewBooking(booking)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors cursor-pointer"
                            title="معاينة محتويات الحجز"
                          >
                            <Eye size={14} /> معاينة
                          </button>
                          <button onClick={() => handleEditBooking(booking)} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors cursor-pointer">
                            <Edit2 size={14} /> تعديل
                          </button>
                          <button onClick={() => handleToInvoice(booking)} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm cursor-pointer">
                            <FileText size={14} /> لفاتورة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Detailed Booking Info */}
                  <div className="flex gap-4 border-t border-slate-100 pt-3 text-[12px]">
                    <div className="flex-1">
                      <p className="font-bold text-slate-700 mb-1">الخدمات:</p>
                      {booking.services?.length > 0 ? (
                        <div className="space-y-1">
                          {booking.services.map(s => (
                            <div key={s.id} className="flex justify-between text-slate-600 bg-slate-50 px-2 py-1 rounded">
                              <span>{s.serviceName} <span className="text-[10px] text-slate-400">({s.technicianName})</span></span>
                              <span className="font-bold">{s.price} {settings.currency}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400">لا توجد خدمات مسجلة</p>
                      )}
                    </div>
                    {booking.advancePayments?.length > 0 && (
                      <div className="w-1/3">
                        <p className="font-bold text-slate-700 mb-1">المقدمات المسددة:</p>
                        <div className="space-y-1">
                          {booking.advancePayments.map(p => (
                            <div key={p.id} className="flex justify-between text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                              <span>{p.treasuryName}</span>
                              <span className="font-bold">{p.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* جدولا فواتير وحجوزات الوردية الحالية (جنباً إلى جنب بتنسيق مستجيب) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">
        {/* الجدول الأول: فواتير الوردية الحالية */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs">
                <Receipt size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>فواتير الوردية الحالية</span>
                  <span className="text-[11px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-mono">
                    {currentShiftInvoices.length}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isShiftOpen 
                    ? `الفواتير الصادرة والمكتملة ضمن الوردية المفتوحة (${shiftData?.shiftId ? '#' + shiftData.shiftId.slice(-6).toUpperCase() : shiftDate})`
                    : 'الوردية مغلقة حالياً'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-emerald-50/80 border border-emerald-200/70 rounded-xl px-3 py-1 text-left">
                <span className="text-[10px] text-emerald-700 block font-bold">إجمالي فواتير الوردية</span>
                <span className="text-xs sm:text-sm font-black text-emerald-800 font-mono">
                  {shiftInvoicesTotalAmount.toFixed(2)} {settings.currency}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            {!isShiftOpen ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <AlertTriangle size={36} className="text-amber-400 mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-700">الوردية مغلقة حالياً</p>
                <p className="text-[11px] text-slate-400 mt-1">افتح وردية جديدة من شاشة الورديات لبدء تسجيل ومتابعة الفواتير</p>
              </div>
            ) : currentShiftInvoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Receipt size={36} className="text-slate-300 mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-700">لا توجد فواتير في الوردية الحالية حتى الآن</p>
                <p className="text-[11px] text-slate-400 mt-1">ستظهر أي فاتورة يتم إتمامها في نقطة البيع (POS) فوراً هنا</p>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10">
                    <tr className="text-slate-500 font-bold border-b border-slate-100">
                      <th className="py-2.5 px-3">رقم الفاتورة</th>
                      <th className="py-2.5 px-3">العميل</th>
                      <th className="py-2.5 px-3">الوقت</th>
                      <th className="py-2.5 px-3">طريقة الدفع</th>
                      <th className="py-2.5 px-3">المبلغ</th>
                      <th className="py-2.5 px-2 text-center">معاينة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentShiftInvoices.map(inv => {
                      const timeStr = inv.time || (inv.date?.includes('T') ? inv.date.split('T')[1].substring(0, 5) : '--:--');
                      const invCode = inv.invoiceNumber || inv.id;
                      const clientLabel = inv.clientName || 'عميل نقدي';
                      const paymentMethod = inv.paymentMethod || (inv.paymentMethods?.[0]?.treasuryId) || 'cash';
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-2 py-0.5 rounded-md" dir="ltr">
                              #{invCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 block truncate max-w-[120px]" title={clientLabel}>
                              {clientLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-slate-500 text-[11px] flex items-center gap-1" dir="ltr">
                              <Clock size={11} className="text-slate-400" />
                              {timeStr}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {paymentMethod === 'cash' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">نقداً</span>
                            ) : paymentMethod === 'card' || paymentMethod === 'network' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">شبكة</span>
                            ) : paymentMethod === 'transfer' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">تحويل</span>
                            ) : paymentMethod === 'split' || (inv.paymentMethods && inv.paymentMethods.length > 1) ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">مقسم</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{paymentMethod}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-black text-slate-900 font-mono text-[12px]">
                              {Number(inv.total || 0).toFixed(2)} {settings.currency}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => setViewInvoice(inv)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="معاينة تفاصيل الفاتورة"
                            >
                              <Eye size={13} />
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
        </div>

        {/* الجدول الثاني: حجوزات الوردية الحالية المنشأة */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
                <CalendarClock size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>حجوزات تم انشائها اليوم</span>
                  <span className="text-[11px] font-extrabold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-mono">
                    {currentShiftReservations.length}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isShiftOpen 
                    ? `الحجوزات التي تم إنشاؤها وتسجيلها خلال تاريخ الوردية المفتوحة (${targetShiftDate})`
                    : 'الوردية مغلقة حالياً'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-indigo-50/80 border border-indigo-200/70 rounded-xl px-3 py-1 text-left">
                <span className="text-[10px] text-indigo-700 block font-bold">إجمالي القيمة</span>
                <span className="text-xs sm:text-sm font-black text-indigo-800 font-mono">
                  {shiftReservationsTotalAmount.toFixed(2)} {settings.currency}
                </span>
              </div>
              {shiftReservationsTotalAdvances > 0 && (
                <div className="bg-teal-50/80 border border-teal-200/70 rounded-xl px-3 py-1 text-left">
                  <span className="text-[10px] text-teal-700 block font-bold">المقدمات</span>
                  <span className="text-xs sm:text-sm font-black text-teal-800 font-mono">
                    {shiftReservationsTotalAdvances.toFixed(2)} {settings.currency}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            {!isShiftOpen ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <AlertTriangle size={36} className="text-amber-400 mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-700">الوردية مغلقة حالياً</p>
                <p className="text-[11px] text-slate-400 mt-1">افتح وردية جديدة من شاشة الورديات لبدء تسجيل ومتابعة الحجوزات</p>
              </div>
            ) : currentShiftReservations.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <CalendarClock size={36} className="text-slate-300 mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-700">لا توجد حجوزات أُنشئت في الوردية الحالية حتى الآن</p>
                <p className="text-[11px] text-slate-400 mt-1">ستظهر هنا أي حجوزات يتم إنشاؤها وتسجيلها أثناء الوردية الحالية</p>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10">
                    <tr className="text-slate-500 font-bold border-b border-slate-100">
                      <th className="py-2.5 px-3">العميل / الكود</th>
                      <th className="py-2.5 px-3">موعد الحجز</th>
                      <th className="py-2.5 px-3">الخدمات</th>
                      <th className="py-2.5 px-3">المبلغ والمقدم</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-2 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentShiftReservations.map(booking => {
                      const totalAdv = booking.advancePayments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
                      const bookingCode = booking.bookingCode || booking.id;
                      const servicesCount = booking.services?.length || 0;
                      return (
                        <tr key={booking.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <div>
                              <span className="font-bold text-slate-900 block truncate max-w-[120px]" title={booking.clientName}>
                                {booking.clientName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400" dir="ltr">
                                #{bookingCode}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div>
                              <span className="font-bold text-slate-700 text-[11px] block">
                                {booking.date}
                              </span>
                              <span className="font-mono text-slate-500 text-[10px] flex items-center gap-1" dir="ltr">
                                <Clock size={10} className="text-slate-400" />
                                {booking.time}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {servicesCount} {servicesCount === 1 ? 'خدمة' : 'خدمات'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div>
                              <span className="font-black text-slate-900 font-mono text-[12px] block">
                                {Number(booking.totalAmount || 0).toFixed(2)} {settings.currency}
                              </span>
                              {totalAdv > 0 && (
                                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded font-mono">
                                  عربون: {totalAdv.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {booking.status === 'confirmed' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">مؤكد</span>
                            ) : booking.status === 'pending' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">معلق</span>
                            ) : booking.status === 'completed' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">مكتمل</span>
                            ) : booking.status === 'cancelled' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">ملغي</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{booking.status}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setPreviewBooking(booking)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="معاينة محتويات الحجز"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                onClick={() => handleEditBooking(booking)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="تعديل الحجز"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleToInvoice(booking)}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                                title="تحويل إلى فاتورة في POS"
                              >
                                <Scissors size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      {settings.showDashboardAnalytics !== false && (
        <DashboardChartsSection
          settings={settings}
          transactions={branchTransactions}
          invoices={branchInvoices}
          bookings={branchBookings}
          products={products}
          purchaseInvoices={purchaseInvoices}
          itemMovements={itemMovements}
        />
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">تعديل الحجز</h3>
              <button onClick={()=>setEditingBooking(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">العميل</label>
                  <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary" value={editingBooking.clientName} onChange={e=>setEditingBooking({...editingBooking, clientName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">رقم الجوال</label>
                  <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary" value={editingBooking.phone} onChange={e=>setEditingBooking({...editingBooking, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">تاريخ الحجز</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary" value={editingBooking.date} onChange={e=>setEditingBooking({...editingBooking, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">الوقت</label>
                  <input type="time" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary" value={editingBooking.time} onChange={e=>setEditingBooking({...editingBooking, time: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-2 border-t border-slate-100 pt-3">الخدمات المحجوزة</label>
                {editingBooking.services?.length > 0 ? (
                  <div className="space-y-2">
                    {editingBooking.services.map(s => (
                      <div key={s.id} className="flex justify-between items-center text-[12px] text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-bold">{s.serviceName}</span>
                          <span className="text-slate-500 text-[11px]">{s.technicianName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-primary">{s.price} {settings.currency}</span>
                          <button onClick={() => removeServiceFromEdit(s.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-[12px] text-center bg-slate-50 py-3 rounded-lg border border-dashed border-slate-200">لا توجد خدمات. الحجز فارغ.</p>
                )}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button onClick={()=>setEditingBooking(null)} className="px-4 py-2 text-[13px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors">إلغاء</button>
              <button onClick={saveEditBooking} className="px-4 py-2 text-[13px] font-bold bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors">حفظ التعديلات</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice View Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[450px] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2"><Receipt size={18}/> تفاصيل الفاتورة {viewInvoice.id}</h3>
              <button onClick={()=>setViewInvoice(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4 text-[13px]">
                <span className="font-bold text-slate-700">العميل: {viewInvoice.clientName}</span>
                <span className="text-slate-500">{new Date(viewInvoice.date).toLocaleDateString('ar-EG')}</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-right text-[12px]">
                  <thead className="bg-slate-50 border-b">
                    <tr><th className="p-2">الخدمة</th><th className="p-2">الفني</th><th className="p-2">السعر</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewInvoice.items?.map(it => (
                      <tr key={it.id}>
                        <td className="p-2 font-bold text-slate-700">{it.serviceName}</td>
                        <td className="p-2 text-slate-500">{it.technicianName}</td>
                        <td className="p-2 font-bold">{it.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1 text-[13px] text-slate-600">
                <div className="flex justify-between"><span>الإجمالي الفرعي:</span> <span>{viewInvoice.total + viewInvoice.discount}</span></div>
                <div className="flex justify-between text-red-500"><span>الخصم:</span> <span>{viewInvoice.discount}</span></div>
                <div className="flex justify-between font-bold text-base text-slate-800 pt-2 border-t mt-2"><span>الصافي:</span> <span>{viewInvoice.total} {settings.currency}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details & Contents Preview Modal (معاينة محتويات وتفاصيل الحجز) */}
      {previewBooking && (() => {
        const bookingCode = previewBooking.bookingCode || previewBooking.id;
        const totalAdv = previewBooking.advancePayments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
        const totalAmt = Number(previewBooking.totalAmount || 0);
        const remainingAmt = Math.max(0, totalAmt - totalAdv);
        const phone = previewBooking.phone || previewBooking.clientPhone || '-';
        const createdDate = previewBooking.createdAt || (previewBooking as any).created_at;
        const branchObj = branches?.find(b => b.id === (previewBooking.branchId || activeBranchId));

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh]" dir="rtl">
              {/* Header */}
              <div className="p-4 px-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <CalendarClock size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base text-slate-800">معاينة محتويات الحجز</h3>
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md" dir="ltr">
                        #{bookingCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      معاينة شاملة لبيانات العميل، الخدمات، والمبالغ المسددة
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewBooking(null)} 
                  className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar text-right">
                
                {/* 1. Client & Booking Header Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">اسم العميل</span>
                    <span className="font-black text-slate-800 text-[13px]">{previewBooking.clientName || 'عميل نقدي'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">رقم الجوال</span>
                    <span className="font-mono font-bold text-slate-700 text-[12px]" dir="ltr">{phone}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">حالة الحجز</span>
                    {previewBooking.status === 'confirmed' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">مؤكد ✓</span>
                    ) : previewBooking.status === 'pending' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">معلق ⏳</span>
                    ) : previewBooking.status === 'completed' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">مكتمل 🎯</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">ملغي ✕</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">موعد الحجز المجدول</span>
                    <span className="font-bold text-slate-800">{previewBooking.date} ({previewBooking.time})</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">تاريخ ووقت الإنشاء</span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {createdDate ? new Date(createdDate).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">الفرع / الموقع</span>
                    <span className="font-bold text-slate-700 text-[11px] truncate">
                      {branchObj?.name || previewBooking.location || 'الفرع الرئيسي'}
                    </span>
                  </div>
                </div>

                {/* 2. Services & Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <Scissors size={14} className="text-primary" />
                      <span>الخدمات والبنود المحجوزة ({previewBooking.services?.length || 0})</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 font-bold">
                      إجمالي الخدمات: {totalAmt.toFixed(2)} {settings.currency}
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="p-2.5">الخدمة / البند</th>
                          <th className="p-2.5">الفني / المنفذ</th>
                          <th className="p-2.5 text-center">الكمية</th>
                          <th className="p-2.5 text-left">السعر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {previewBooking.services && previewBooking.services.length > 0 ? (
                          previewBooking.services.map((srv, idx) => {
                            const qty = Math.max(1, Number(srv.quantity) || 1);
                            const price = Number(srv.price) || 0;
                            return (
                              <tr key={srv.id || idx} className="hover:bg-slate-50/60">
                                <td className="p-2.5 font-bold text-slate-800">
                                  <span>{srv.serviceName}</span>
                                  {srv.type === 'product' && (
                                    <span className="mr-1.5 text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded font-bold">منتج</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px]">
                                  {srv.technicianName || '-'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold">
                                  {qty}
                                </td>
                                <td className="p-2.5 text-left font-mono font-black text-slate-900">
                                  {(price * qty).toFixed(2)} {settings.currency}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400">لا توجد خدمات مضافة في هذا الحجز</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Advance Payments Details (if any) */}
                {previewBooking.advancePayments && previewBooking.advancePayments.length > 0 && (
                  <div>
                    <span className="font-bold text-xs text-slate-800 block mb-2">
                      💰 تفاصيل الدفعات المقدمة المسددة ({previewBooking.advancePayments.length}):
                    </span>
                    <div className="space-y-1.5">
                      {previewBooking.advancePayments.map((adv, aIdx) => (
                        <div key={adv.id || aIdx} className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-teal-50/70 border border-teal-200/70">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                            <span className="font-bold text-teal-900">دفعة #{aIdx + 1}</span>
                            <span className="text-[11px] text-teal-700">({adv.treasuryName || 'خزينة'} • {adv.date})</span>
                            {adv.notes && <span className="text-[10px] text-teal-600">- {adv.notes}</span>}
                          </div>
                          <div className="font-mono font-black text-teal-800 text-[13px]">
                            +{Number(adv.amount || 0).toFixed(2)} {settings.currency}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Financial Summary Card */}
                <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>إجمالي قيمة الحجز:</span>
                    <span className="font-mono font-bold text-sm text-white">{totalAmt.toFixed(2)} {settings.currency}</span>
                  </div>

                  {totalAdv > 0 && (
                    <div className="flex justify-between items-center text-teal-300">
                      <span>إجمالي العربون / المقدم المسدد:</span>
                      <span className="font-mono font-bold text-sm">-{totalAdv.toFixed(2)} {settings.currency}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-black text-sm">
                    <span className="text-amber-400">المتبقي للتحصيل عند الحضور:</span>
                    <span className={`font-mono text-base ${remainingAmt > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {remainingAmt.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                </div>

                {/* 5. Notes if present */}
                {(previewBooking.notes || previewBooking.internalNotes) && (
                  <div className="space-y-2 text-xs">
                    {previewBooking.notes && (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700">
                        <strong className="text-slate-800 block mb-0.5">ملاحظات العميل:</strong>
                        <p>{previewBooking.notes}</p>
                      </div>
                    )}
                    {previewBooking.internalNotes && (
                      <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900">
                        <strong className="text-amber-800 block mb-0.5">ملاحظات داخلية:</strong>
                        <p>{previewBooking.internalNotes}</p>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewBooking(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  إغلاق
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const b = previewBooking;
                      setPreviewBooking(null);
                      handleEditBooking(b);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-200/80 hover:bg-slate-200 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 size={13} />
                    <span>تعديل الحجز</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const b = previewBooking;
                      setPreviewBooking(null);
                      handleToInvoice(b);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-primary hover:bg-primary-dark cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Scissors size={13} />
                    <span>تحويل إلى فاتورة في POS</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
