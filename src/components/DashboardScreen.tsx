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

  // دالة فحص العمليات التابعة للوردية الحالية المفتوحة حصراً
  const matchesCurrentShift = (dateStr?: string, createdAtStr?: string, itemShiftId?: string, itemShiftDate?: string) => {
    // 1. إذا كانت الوردية مغلقة، يجب تصفير كافة المؤشرات للبدء بنظافة كاملة (0)
    if (!isShiftOpen || !shiftDate) return false;

    // 2. إذا كان العنصر يحمل معرّف وردية مطابق للوردية الحالية
    if (itemShiftId && shiftData?.shiftId && itemShiftId === shiftData.shiftId) {
      return true;
    }

    // 3. إذا كان العنصر يحمل تاريخ وردية مطابق لتاريخ الوردية الحالية المفتوحة
    if (itemShiftDate && itemShiftDate.split('T')[0].trim() === shiftDate) {
      return true;
    }

    if (!dateStr && !createdAtStr) return false;
    const cleanDate = (dateStr || '').trim();
    const cleanCreated = (createdAtStr || '').trim();

    // 4. فحص تطابق التاريخ مع تاريخ الوردية المفتوحة
    const dateOnly = cleanDate.split('T')[0].trim();
    const createdDateOnly = cleanCreated.split('T')[0].trim();
    const dateMatches = dateOnly === shiftDate || createdDateOnly === shiftDate ||
      cleanDate.startsWith(shiftDate) || cleanCreated.startsWith(shiftDate);
    if (!dateMatches) return false;

    // 5. في حال وجود إغلاق وردية سابقة في نفس اليوم، استبعاد العمليات التي تمت قبل وقت الإغلاق السابق فقط
    // ملاحظة حاسمة: إذا كان السجل يحمل تاريخ اليوم فقط بدون وقت، نعتبره تابعاً للوردية الحالية ولا نستبعده
    if (shiftData?.lastClosedAt) {
      const hasTime = cleanCreated.includes('T') || cleanDate.includes('T') || cleanDate.includes(' ');
      if (hasTime) {
        const timeToCompare = cleanCreated.includes('T') ? cleanCreated : cleanDate;
        const lastClosedTime = new Date(shiftData.lastClosedAt).getTime();
        const itemTime = new Date(timeToCompare).getTime();
        if (itemTime > 0 && itemTime <= lastClosedTime) return false;
      }
    }

    return true;
  };

  // ── حجوزات الوردية الحالية المفتوحة (Shift Bookings) ──
  const shiftBookings = useMemo(() => {
    if (!isShiftOpen) return [];
    // تاريخ فتح الوردية الحالية المفتوحة من قاعدة البيانات حصراً
    const targetShiftDate = (shiftData?.date || shiftDate || '').split('T')[0].split(' ')[0].trim();
    if (!targetShiftDate) return [];

    return branchBookings.filter(b => {
      if (b.status === 'completed' || b.status === 'cancelled') return false;
      // استخراج تاريخ إنشاء الحجز (created_at::date) مع تجاهل أوقات الساعات وتوقيت جهاز العميل تماماً
      const createdRaw = (b.createdAt || (b as any).created_at || '').trim();
      if (!createdRaw) return false;
      const createdDateOnly = createdRaw.split('T')[0].split(' ')[0].trim();
      return createdDateOnly === targetShiftDate;
    });
  }, [branchBookings, isShiftOpen, shiftDate, shiftData]);
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
    const targetDate = (isShiftOpen && shiftDate) ? shiftDate : localToday;

    // 1. من جدول المعاملات المالية المباشرة لليوم
    const fromTrx = todayTrx.filter(t => 
      t.type === 'in' && 
      (t.category === 'مقدم حجز' || t.category === 'booking_advance' || t.category === 'advance' || (t.description && t.description.includes('مقدم حجز'))) &&
      matcher(t.treasury || (t as any).treasuryId)
    );
    const sumTrx = fromTrx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 2. من جدول الحجوزات (لأي حجز مسجل به دفعات مقدمة بتاريخ اليوم ولم تسجل في transactions)
    let fromBookingsOnly = 0;
    (branchBookings || []).forEach(b => {
      if (b.status === 'cancelled') return;
      const advances = (b.advancePayments && Array.isArray(b.advancePayments))
        ? b.advancePayments
        : (typeof (b as any).advance_payments === 'string'
          ? (() => { try { return JSON.parse((b as any).advance_payments); } catch { return []; } })()
          : []);

      advances.forEach((adv: any) => {
        const advDate = (adv.date || b.date || (b as any).createdAt || '').split('T')[0].trim();
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
  }, [todayTrx, branchBookings, isShiftOpen, shiftDate, localToday]);

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
    if (!isShiftOpen || !shiftDate) return [];
    return branchInvoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      // 1. فحص تطابق معرف الوردية المفتوحة صراحة
      if (shiftData?.shiftId && (inv.shiftId === shiftData.shiftId || (inv as any).workShiftId === shiftData.shiftId)) {
        return true;
      }
      // 2. فحص تطابق تاريخ الوردية
      if (inv.shiftDate && inv.shiftDate.split('T')[0].trim() === shiftDate) {
        return true;
      }
      // 3. فحص وقت الإنشاء بعد فتح الوردية المفتوحة
      const invDateTime = inv.date || (inv as any).createdAt || (inv as any).created_at;
      if (shiftData?.openedAt && invDateTime) {
        const openedTime = new Date(shiftData.openedAt).getTime();
        const invTime = new Date(invDateTime).getTime();
        if (openedTime > 0 && invTime >= openedTime) {
          return true;
        }
      }
      // 4. فحص شرط الوردية العام
      return matchesCurrentShift(inv.date, (inv as any).createdAt || (inv as any).created_at, inv.shiftId, inv.shiftDate);
    }).sort((a, b) => {
      const timeA = new Date(a.date || (a as any).createdAt || 0).getTime();
      const timeB = new Date(b.date || (b as any).createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [branchInvoices, isShiftOpen, shiftDate, shiftData]);

  // ── الحجوزات المنشأة خلال الوردية الحالية المفتوحة (Current Shift Reservations) ──
  const currentShiftReservations = useMemo(() => {
    if (!isShiftOpen) return [];
    // الاعتماد الكامل على تاريخ الوردية المخزن في قاعدة البيانات حصراً
    const targetShiftDate = (shiftData?.date || shiftDate || '').split('T')[0].split(' ')[0].trim();
    if (!targetShiftDate) return [];

    return branchBookings.filter(b => {
      // الشرط المنطقي: تصفية وعرض الحجوزات التي يتطابق تاريخ إنشائها (created_at::date) حصراً مع تاريخ فتح الوردية الحالية المفتوحة (shift_date)
      // مع تجاهل أوقات الساعات وتجاهل تاريخ ووقت جهاز العميل (Client Device Time) تماماً لتفادي فروق التوقيت أو تداخل الورديات الليلية
      const createdRaw = (b.createdAt || (b as any).created_at || '').trim();
      if (!createdRaw) return false;
      const createdDateOnly = createdRaw.split('T')[0].split(' ')[0].trim();
      return createdDateOnly === targetShiftDate;
    }).sort((a, b) => {
      const timeA = new Date(a.createdAt || (a as any).created_at || 0).getTime();
      const timeB = new Date(b.createdAt || (b as any).created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [branchBookings, isShiftOpen, shiftDate, shiftData]);

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
    
    // Add to booking advances
    const newAdvance = {
      id: Math.random().toString(36).substr(2,9),
      amount,
      treasuryId: treasury.id,
      treasuryName: treasury.name,
      date: new Date().toISOString()
    };
    
    setBookings(bookings.map(b => 
      b.id === booking.id ? { ...b, advancePayments: [...b.advancePayments, newAdvance] } : b
    ));

    // Add transaction
    const newTrx: Transaction = {
      id: 'TRX-' + Math.random().toString(36).substr(2,9),
      date: new Date().toISOString(),
      type: 'in',
      amount,
      category: 'مقدم حجز',
      description: `مقدم حجز للعميل ${booking.clientName}`,
      treasury: treasury.id
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
      <h2 className="text-xl font-bold text-slate-800 mb-5">نظرة عامة (لوحة التحكم)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setShowRevenueDetails(!showRevenueDetails)}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
        >
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">مبيعات اليوم (اضغط للتفاصيل)</p>
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
            <p className="text-slate-500 text-[12px] font-bold mb-1">فواتير اليوم</p>
            <h3 className="text-lg font-extrabold text-slate-800">{todayInvoicesCount} <span className="text-sm font-normal text-slate-400">فاتورة</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
            <Receipt size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">مصروفات اليوم</p>
            <h3 className="text-lg font-extrabold text-slate-800 font-mono">{totalExpense.toFixed(2)} <span className="text-sm font-normal text-slate-500">{settings.currency}</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <ArrowUpRight size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">{isShiftOpen ? 'سلف الوردية الحالية' : 'سلف اليوم'}</p>
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
                <span>تفاصيل الخزائن والإيرادات ({isShiftOpen && shiftDate ? `وردية: ${shiftDate}` : 'الوردية مغلقة - تصفير أدراج الوردية'})</span>
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
                      {/* مبيعات اليوم الموجهة لها */}
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1">
                          <span>🛍️</span>
                          <span>مبيعات اليوم الموجهة لها:</span>
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

                      {/* إيداعات وتحويلات اليوم */}
                      {otherIn > 0 && (
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="flex items-center gap-1">
                            <span>📥</span>
                            <span>إيداعات وتحويلات اليوم:</span>
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

                      {/* مسحوبات ومصروفات اليوم */}
                      <div className="flex justify-between items-center text-slate-300 border-b border-slate-700/80 pb-2">
                        <span className="flex items-center gap-1">
                          <span>💸</span>
                          <span>مسحوبات ومصروفات اليوم:</span>
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
                        <span>مبيعات وإيرادات اليوم:</span>
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
                          <span>إيداعات أخرى:</span>
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
                        <span>مسحوبات ومصروفات:</span>
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
              حجوزات اليوم والوردية
            </h3>
            {!isShiftOpen ? (
              <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold">تاريخ اليوم: {localToday}</span>
            ) : (
              <span className="text-[11px] bg-emerald-50 text-primary px-2 py-1 rounded-md font-bold">تاريخ الوردية: {shiftDate}</span>
            )}
          </div>
          
          <div className="flex-1 space-y-3">
            {shiftBookings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                <CalendarClock size={40} className="mb-2 opacity-50 text-slate-300" />
                <p className="text-[13px]">لا توجد حجوزات مجدولة لتاريخ اليوم</p>
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
                          <button onClick={() => handleEditBooking(booking)} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors">
                            <Edit2 size={14} /> تعديل
                          </button>
                          <button onClick={() => handleToInvoice(booking)} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm">
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
                  <span>حجوزات الوردية الحالية</span>
                  <span className="text-[11px] font-extrabold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-mono">
                    {currentShiftReservations.length}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isShiftOpen 
                    ? `الحجوزات التي تم إنشاؤها وتسجيلها خلال هذه الوردية`
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

    </div>
  );
}
