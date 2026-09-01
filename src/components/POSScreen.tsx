import { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, User, CreditCard, Banknote, Scissors, 
  Tag, X, Package, Clock, UserCog, Calendar, CheckCircle2, Image as ImageIcon,
  Wrench, ShieldAlert, Camera, Crown, Sparkles, PauseCircle, PlayCircle,
  FilePlus2, Layers, Zap, AlertCircle, DollarSign
} from 'lucide-react';
import { 
  AppSettings, CartItem, ServiceItem, Booking, Invoice, Client, Category, Employee,
  getClientTier, calculateClientTotalSpend, ClientTierConfig, HeldInvoice, PromoCode, PromoCodeUsage, TipRecord 
} from '../types';
import { processImageFile, MAX_IMAGE_SIZE_KB } from '../utils/imageUpload';
import { ComplaintsService } from '../services/complaintsService';
import { ZatcaService } from '../services/zatcaService';
import { EtaEgyptService } from '../services/etaEgyptService';
import { DB } from '../services/db';

export function POSScreen({ 
  settings, 
  isShiftOpen, 
  shiftDate, 
  initialBooking, 
  onClearInitial, 
  onCheckoutComplete, 
  clients, 
  setClients, 
  services: items, 
  categories, 
  employees, 
  products,
  invoices = [],
  setEmployees,
  isSubscriptionBlocked,
  promoCodes = [],
  promoCodeUsages = [],
  setPromoCodeUsages,
  tips = [],
  setTips,
  currentUser
}: { 
  settings: AppSettings, 
  isShiftOpen: boolean,
  shiftDate: string,
  initialBooking?: Booking | null, 
  onClearInitial?: () => void,
  onCheckoutComplete?: (invoice: Invoice, paymentSplits: { amount: number, treasuryId: string }[], bookingId?: string) => void,
  clients: Client[],
  setClients: (c: Client[]) => void,
  services: ServiceItem[],
  categories: Category[],
  employees: Employee[], 
  products: any[],
  invoices?: Invoice[],
  setEmployees?: (e: Employee[]) => void,
  isSubscriptionBlocked?: boolean,
  promoCodes?: PromoCode[],
  promoCodeUsages?: PromoCodeUsage[],
  setPromoCodeUsages?: (updater: PromoCodeUsage[] | ((prev: PromoCodeUsage[]) => PromoCodeUsage[])) => void,
  tips?: TipRecord[],
  setTips?: (updater: TipRecord[] | ((prev: TipRecord[]) => TipRecord[])) => void,
  currentUser?: any
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<'service' | 'product'>('service');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: '', phone: '', referredByPhone: '', dobDay: '', dobMonth: '' });

  // Permissions
  const canViewClientFinancials = !currentUser || currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'programmer' || currentUser.actions?.includes('view_client_financials') || currentUser.actions?.includes('*');
  const canEditItemPrice = !currentUser || currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'programmer' || currentUser.actions?.includes('pos_custom_price') || currentUser.actions?.includes('*');

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoDiscountAmount, setPromoDiscountAmount] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);

  // In-cart custom price editing state
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState<number | ''>('');

  // Tips and Received Amount in Payment Modal
  const [receivedAmount, setReceivedAmount] = useState<number | ''>('');
  const [tipEmployeeId, setTipEmployeeId] = useState<string>('');
  
  // Held / Suspended Invoices Management (نظام الفواتير المعلقة والمفتوحة)
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>(() => {
    try {
      const saved = localStorage.getItem('smartcut_held_invoices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHeldInvoicesModal, setShowHeldInvoicesModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('smartcut_held_invoices', JSON.stringify(heldInvoices));
    } catch (e) {
      console.warn('Failed to persist held invoices:', e);
    }
  }, [heldInvoices]);

  // Before & After Photos for Invoice (Max 500 KB)
  const [beforePhotoUrl, setBeforePhotoUrl] = useState('');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState('');
  
  // Remedy / Warranty Fix on Salon Expense (0.00 SAR)
  const [isRemedyInvoice, setIsRemedyInvoice] = useState(false);
  const [remedyReason, setRemedyReason] = useState('إصلاح مجاني بناءً على ضمان الصالون');
  
  // Fast Shift Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleEffectiveDate, setScheduleEffectiveDate] = useState(isShiftOpen ? shiftDate : new Date().toISOString().split('T')[0]);
  const [employeeSchedules, setEmployeeSchedules] = useState<Record<string, { checkIn: string, checkOut: string }>>({});
  const [bulkCheckIn, setBulkCheckIn] = useState('09:00');
  const [bulkCheckOut, setBulkCheckOut] = useState('18:00');

  const handleOpenScheduleModal = () => {
    const initialMap: Record<string, { checkIn: string, checkOut: string }> = {};
    employees.forEach(emp => {
      initialMap[emp.id] = {
        checkIn: emp.checkInTime || '09:00',
        checkOut: emp.checkOutTime || '18:00'
      };
    });
    setEmployeeSchedules(initialMap);
    setScheduleEffectiveDate(isShiftOpen ? shiftDate : new Date().toISOString().split('T')[0]);
    setShowScheduleModal(true);
  };

  const handleApplyBulkSchedule = () => {
    const updatedMap: Record<string, { checkIn: string, checkOut: string }> = {};
    employees.forEach(emp => {
      updatedMap[emp.id] = { checkIn: bulkCheckIn, checkOut: bulkCheckOut };
    });
    setEmployeeSchedules(updatedMap);
  };

  const handleSaveShiftSchedules = () => {
    if (!setEmployees) return;
    
    const updatedEmployees = employees.map(emp => {
      const schedule = employeeSchedules[emp.id];
      if (!schedule) return emp;

      const isChanged = schedule.checkIn !== emp.checkInTime || schedule.checkOut !== emp.checkOutTime;
      if (!isChanged) return emp;

      const entry = {
        id: 'SCH-' + Math.random().toString(36).substr(2, 9),
        date: scheduleEffectiveDate,
        previousCheckInTime: emp.checkInTime || '09:00',
        previousCheckOutTime: emp.checkOutTime || '18:00',
        checkInTime: schedule.checkIn,
        checkOutTime: schedule.checkOut,
        weeklyDaysOff: emp.weeklyDaysOff || ['Friday'],
        reason: 'تعديل سريع من نقطة البيع (POS)',
        updatedBy: 'نقطة البيع (POS)'
      };

      return {
        ...emp,
        checkInTime: schedule.checkIn,
        checkOutTime: schedule.checkOut,
        shiftScheduleHistory: [...(emp.shiftScheduleHistory || []), entry]
      };
    });

    setEmployees(updatedEmployees);
    setShowScheduleModal(false);
    alert(`✅ تم تحديث وتوثيق مواعيد دوام الموظفين بنجاح وسريانها من تاريخ ${scheduleEffectiveDate}`);
  };

  const [discount, setDiscount] = useState<{type: 'percentage'|'fixed', value: number}>({ type: 'fixed', value: 0 });
  const [advanceDeduction, setAdvanceDeduction] = useState(0);

  // ⏸️ تعليق الفاتورة الحالية يدوياً (Hold Current Bill)
  const handleHoldCurrentInvoice = () => {
    if (cart.length === 0) {
      alert('لا توجد عناصر في الفاتورة الحالية لتعليقها.');
      return;
    }
    const newHeld: HeldInvoice = {
      id: 'HOLD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      heldAt: new Date().toISOString(),
      timeStr: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      client: selectedClient,
      clientSearch,
      cart,
      discount,
      advanceDeduction,
      isRemedyInvoice,
      remedyReason,
      beforePhotoUrl,
      afterPhotoUrl
    };
    setHeldInvoices(prev => [newHeld, ...prev]);
    // تفريغ الفاتورة النشطة
    setCart([]);
    setSelectedClient(null);
    setClientSearch('');
    setDiscount({ type: 'fixed', value: 0 });
    setAdvanceDeduction(0);
    setIsRemedyInvoice(false);
    setBeforePhotoUrl('');
    setAfterPhotoUrl('');
    if (onClearInitial) onClearInitial();
  };

  // ➕ بدء فاتورة جديدة (New Invoice) مع تعليق الفاتورة السابقة إن وجدت
  const handleNewInvoice = () => {
    if (cart.length > 0) {
      const newHeld: HeldInvoice = {
        id: 'HOLD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        heldAt: new Date().toISOString(),
        timeStr: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        client: selectedClient,
        clientSearch,
        cart,
        discount,
        advanceDeduction,
        isRemedyInvoice,
        remedyReason,
        beforePhotoUrl,
        afterPhotoUrl
      };
      setHeldInvoices(prev => [newHeld, ...prev]);
    }
    setCart([]);
    setSelectedClient(null);
    setClientSearch('');
    setDiscount({ type: 'fixed', value: 0 });
    setAdvanceDeduction(0);
    setIsRemedyInvoice(false);
    setBeforePhotoUrl('');
    setAfterPhotoUrl('');
    if (onClearInitial) onClearInitial();
  };

  // ▶ استكمال الفاتورة المعلقة (Resume Held Bill)
  const handleResumeHeldInvoice = (held: HeldInvoice) => {
    if (cart.length > 0) {
      // تعليق الفاتورة الحالية أولاً
      const activeAsHeld: HeldInvoice = {
        id: 'HOLD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        heldAt: new Date().toISOString(),
        timeStr: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        client: selectedClient,
        clientSearch,
        cart,
        discount,
        advanceDeduction,
        isRemedyInvoice,
        remedyReason,
        beforePhotoUrl,
        afterPhotoUrl
      };
      setHeldInvoices(prev => [activeAsHeld, ...prev.filter(h => h.id !== held.id)]);
    } else {
      setHeldInvoices(prev => prev.filter(h => h.id !== held.id));
    }

    setCart(held.cart || []);
    setSelectedClient(held.client || null);
    setClientSearch(held.clientSearch || (held.client ? held.client.name : ''));
    setDiscount(held.discount || { type: 'fixed', value: 0 });
    setAdvanceDeduction(held.advanceDeduction || 0);
    setIsRemedyInvoice(held.isRemedyInvoice || false);
    setRemedyReason(held.remedyReason || '');
    setBeforePhotoUrl(held.beforePhotoUrl || '');
    setAfterPhotoUrl(held.afterPhotoUrl || '');
    setShowHeldInvoicesModal(false);
  };

  // 🗑️ حذف / إلغاء فاتورة معلقة
  const handleDeleteHeldInvoice = (heldId: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف / إلغاء هذه الفاتورة المعلقة؟')) {
      setHeldInvoices(prev => prev.filter(h => h.id !== heldId));
    }
  };

  // Client Tier & Cross-Branch Total Spend Calculation
  const clientTotalSpend = useMemo(() => {
    if (!selectedClient) return 0;
    return calculateClientTotalSpend(selectedClient, invoices, settings.tierSettings?.periodMonths || 0);
  }, [selectedClient, invoices, settings.tierSettings]);

  const clientTier = useMemo(() => {
    if (!selectedClient) return null;
    return getClientTier(selectedClient, invoices, settings.tierSettings);
  }, [selectedClient, invoices, settings.tierSettings]);

  // Automatically apply Tier discount when client is identified
  useEffect(() => {
    if (selectedClient) {
      const tier = getClientTier(selectedClient, invoices, settings.tierSettings);
      if (tier && tier.discountPercentage > 0) {
        setDiscount({ type: 'percentage', value: tier.discountPercentage });
      }
    }
  }, [selectedClient, invoices, settings.tierSettings]);

  // Handle Apply Promo Code
  const handleApplyPromoCode = () => {
    setPromoError(null);
    const clean = promoCodeInput.trim().toUpperCase();
    if (!clean) return;

    const found = promoCodes.find(p => p.code?.toUpperCase() === clean);
    if (!found) {
      setPromoError('كود الخصم غير موجود');
      return;
    }

    if (!found.isActive) {
      setPromoError('هذا الكود غير فعال حالياً');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (found.endDate < today) {
      setPromoError('انتهت صلاحية هذا الكود');
      return;
    }
    if (found.startDate > today) {
      setPromoError('لم تبدأ فترة سريان هذا الكود بعد');
      return;
    }

    if (found.maxUsesTotal && found.usesCount >= found.maxUsesTotal) {
      setPromoError('تم استنفاذ الحد الأقصى لاستخدامات هذا الكود');
      return;
    }

    // Check if client has used this code already
    const clientPhone = selectedClient?.phone || clientSearch?.replace(/\D/g, '');
    if (clientPhone) {
      const alreadyUsed = promoCodeUsages.some(u => 
        u.code?.toUpperCase() === clean && 
        u.clientPhone?.replace(/\D/g, '') === clientPhone.replace(/\D/g, '')
      );
      if (alreadyUsed) {
        setPromoError('تم استخدام هذا الكود مسبقاً لهذا العميل');
        return;
      }
    }

    // Calculate discount
    let promoDisc = 0;
    if (found.discountType === 'percentage') {
      promoDisc = subtotal * (found.discountValue / 100);
      if (found.maxDiscountAmount && promoDisc > found.maxDiscountAmount) {
        promoDisc = found.maxDiscountAmount;
      }
    } else {
      promoDisc = Math.min(subtotal, found.discountValue);
    }

    setAppliedPromo(found);
    setPromoDiscountAmount(promoDisc);
    setPromoCodeInput('');
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscountAmount(0);
    setPromoError(null);
  };

  // In-cart custom price update
  const handleSaveCustomPrice = (cartId: string) => {
    if (customPriceInput === '' || Number(customPriceInput) < 0) {
      setEditingCartId(null);
      return;
    }
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        return {
          ...c,
          item: {
            ...c.item,
            displayPrice: Number(customPriceInput)
          }
        };
      }
      return c;
    }));
    setEditingCartId(null);
  };

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'single' | 'split'>('single');
  const [singleTreasury, setSingleTreasury] = useState(settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || '');
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);

  const subtotal = cart.reduce((sum, c) => sum + (c.item.displayPrice * c.quantity), 0);
  const manualDiscountAmount = discount.type === 'percentage' ? subtotal * (discount.value / 100) : discount.value;
  const discountAmount = manualDiscountAmount + promoDiscountAmount;
  const totalInclusive = Math.max(0, subtotal - discountAmount);
  const baseTotal = settings.vatEnabled ? totalInclusive / (1 + settings.vatRate / 100) : totalInclusive;
  const vatAmount = settings.vatEnabled ? totalInclusive - baseTotal : 0;
  const totalBeforeAdvance = totalInclusive;
  const rawFinalTotal = Math.max(0, totalBeforeAdvance - advanceDeduction);
  const finalTotal = isRemedyInvoice ? 0 : rawFinalTotal;

  // Tips & Change Calculation
  const isCashPayment = singleTreasury === 'cash' || singleTreasury.includes('cash');
  const receivedNum = Number(receivedAmount) || 0;
  const changeDue = isCashPayment && receivedNum > finalTotal ? receivedNum - finalTotal : 0;
  const calculatedTip = !isCashPayment && receivedNum > finalTotal ? receivedNum - finalTotal : 0;

  const handleInvoicePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const res = await processImageFile(file);
    if (res.error) {
      alert(res.error);
      return;
    }

    if (type === 'before') {
      setBeforePhotoUrl(res.dataUrl);
    } else {
      setAfterPhotoUrl(res.dataUrl);
    }
  };

  const handleConfirmPayment = async () => {
    if (isSubscriptionBlocked) {
      alert('⛔ الحساب موقوف أو انتهت فترة الاشتراك. النظام يعمل الآن بوضع الاطلاع فقط (Read-Only) ولا يمكن إنشاء أو سداد فواتير جديدة.');
      return;
    }

    let splits: { amount: number, treasuryId: string }[] = [];
    const cashbackUsed = isRemedyInvoice ? 0 : (splitAmounts['cashback'] || 0);
    const remainingTotal = finalTotal - cashbackUsed;
    
    if (isRemedyInvoice) {
      splits = [{ amount: 0, treasuryId: 'remedy_free' }];
    } else if (paymentType === 'single') {
      if (remainingTotal > 0 && !singleTreasury) {
        alert('الرجاء اختيار طريقة الدفع'); return;
      }
      // If non-cash and has tip, the card terminal was charged with (remainingTotal + calculatedTip)
      const actualTreasuryCharged = remainingTotal + (!isCashPayment && calculatedTip > 0 ? calculatedTip : 0);
      if (actualTreasuryCharged > 0) splits.push({ amount: actualTreasuryCharged, treasuryId: singleTreasury });
      if (cashbackUsed > 0) splits.push({ amount: cashbackUsed, treasuryId: 'cashback' });
    } else {
      const totalSplit = Object.values(splitAmounts).reduce((a: number, b) => a + (Number(b) || 0), 0) as number;
      if (totalSplit < finalTotal) {
        alert('مجموع المبالغ الموزعة يجب أن يساوي أو يزيد عن المطلوب سداده!'); return;
      }
      splits = Object.entries(splitAmounts).filter(([_, amt]) => Number(amt) > 0).map(([tId, amt]) => ({ amount: Number(amt), treasuryId: tId }));
    }

    const assignedTipEmployee = employees.find(e => e.id === tipEmployeeId) || employees.find(e => e.id === cart[0]?.employeeId) || employees[0];
    const tipPayoutMode = settings.tipPayoutMethod || 'instant_cash';

    const initialInv: Invoice = {
      id: 'INV-' + Math.random().toString(36).substr(2,9).toUpperCase(),
      date: isShiftOpen ? (shiftDate + 'T' + new Date().toTimeString().split(' ')[0]) : new Date().toISOString(),
      clientName: selectedClient ? selectedClient.name : (clientSearch || 'عميل نقدي'),
      clientId: selectedClient ? selectedClient.id : undefined,
      clientPhone: selectedClient ? selectedClient.phone : undefined,
      total: finalTotal, // net paid (0 if remedy)
      discount: isRemedyInvoice ? subtotal : discountAmount,
      cashbackUsed: cashbackUsed > 0 ? cashbackUsed : undefined,
      promoCode: appliedPromo ? appliedPromo.code : undefined,
      promoDiscount: promoDiscountAmount > 0 ? promoDiscountAmount : undefined,
      tipAmount: calculatedTip > 0 ? calculatedTip : undefined,
      tipEmployeeId: calculatedTip > 0 ? assignedTipEmployee?.id : undefined,
      tipEmployeeName: calculatedTip > 0 ? assignedTipEmployee?.name : undefined,
      status: 'completed',

      beforePhotoUrl: beforePhotoUrl || undefined,
      afterPhotoUrl: afterPhotoUrl || undefined,
      isRemedyInvoice: isRemedyInvoice || undefined,
      remedyReason: isRemedyInvoice ? remedyReason : undefined,

      items: cart.map(c => {
        const performer = employees.find(e => e.id === c.employeeId);
        const referrer = employees.find(e => e.id === c.referralEmployeeId);
        let refCommAmt = 0;
        if (c.item.referralCommissionAmount && c.referralEmployeeId) {
          if (c.item.referralCommissionType === 'fixed') {
            refCommAmt = c.item.referralCommissionAmount;
          } else {
            refCommAmt = (c.item.referralCommissionAmount / 100) * (c.item.displayPrice || c.price || 0);
          }
        }

        return {
          id: c.cartId,
          itemId: c.item.id,
          type: c.type,
          employeeId: c.employeeId,
          referralEmployeeId: c.referralEmployeeId || undefined,
          serviceName: c.item.name,
          technicianName: performer?.name || 'غير محدد',
          referralEmployeeName: referrer?.name || undefined,
          referralCommissionAmount: refCommAmt > 0 ? refCommAmt : undefined,
          price: isRemedyInvoice ? 0 : (c.item.displayPrice || c.price || 0),
          quantity: c.quantity
        };
      }),
      paymentMethods: splits
    };

    // 🇸🇦 ZATCA Phase 1 & 2 QR Code Generation & Reporting
    let zatcaQr = '';
    let zatcaReportingStatus: Invoice['zatcaReportingStatus'] = 'not_submitted';
    try {
      zatcaQr = await ZatcaService.generateZatcaQR(initialInv, settings, settings.zatcaSettings);
      if (settings.zatcaSettings?.enabled && settings.zatcaSettings.autoReportB2C) {
        const zatcaRes = await ZatcaService.reportSimplifiedInvoice(initialInv, settings, settings.zatcaSettings);
        zatcaReportingStatus = zatcaRes.reportingStatus;
      }
    } catch (err) {
      console.warn('ZATCA QR Generation warning:', err);
    }

    // 🇪🇬 ETA Egypt e-Receipt Submission
    let etaSubmissionUuid: string | undefined = undefined;
    let etaStatus: Invoice['etaStatus'] = 'not_submitted';
    try {
      if (settings.etaEgyptSettings?.enabled && settings.etaEgyptSettings.autoSubmitReceipts) {
        const etaRes = await EtaEgyptService.submitReceipt(initialInv, settings, settings.etaEgyptSettings);
        etaSubmissionUuid = etaRes.submissionUuid;
        etaStatus = etaRes.status as any;
      }
    } catch (err) {
      console.warn('ETA Egypt submission warning:', err);
    }

    const newInvoice: Invoice = {
      ...initialInv,
      zatcaQr: zatcaQr || undefined,
      zatcaReportingStatus,
      etaSubmissionUuid,
      etaStatus
    };

    if (selectedClient && !isRemedyInvoice) {
      // 1. كاش باك العميل المباشر: الفاتورة التي يتم استخدام الكاش باك في سدادها لا يحتسب عليها كاش باك
      let earnedCashback = 0;
      if (cashbackUsed === 0) {
        cart.forEach(c => {
          if (c.item.cashbackPercentage) {
            earnedCashback += (c.item.displayPrice * c.item.cashbackPercentage) / 100;
          }
        });
      }

      // 2. كاش باك ترشيح وإحالة العميل (يُمنح للعميل المرشِح على أول فاتورة فقط للعميل الجديد)
      let referrerClientPhone = selectedClient.referredByPhone?.trim();
      if (referrerClientPhone === selectedClient.phone?.trim()) {
        referrerClientPhone = undefined; // منع الترشيح الذاتي
      }

      const isFirstInvoice = !selectedClient.hasUsedReferralReward && 
        invoices.filter(inv => (selectedClient.phone && inv.clientPhone === selectedClient.phone) || (selectedClient.id && inv.clientId === selectedClient.id)).length === 0;

      let referrerEarnedCashback = 0;
      let referrerClientId: string | undefined = undefined;

      if (referrerClientPhone && isFirstInvoice) {
        const foundReferrer = clients.find(cl => cl.phone && cl.phone.trim() === referrerClientPhone);
        if (foundReferrer && foundReferrer.id !== selectedClient.id) {
          referrerClientId = foundReferrer.id;
          cart.forEach(c => {
            if (c.type === 'service' && c.item.clientReferralCashbackAmount && c.item.clientReferralCashbackAmount > 0) {
              if (c.item.clientReferralCashbackType === 'fixed') {
                referrerEarnedCashback += c.item.clientReferralCashbackAmount * (c.quantity || 1);
              } else {
                referrerEarnedCashback += ((c.item.displayPrice * c.item.clientReferralCashbackAmount) / 100) * (c.quantity || 1);
              }
            }
          });
        }
      }

      // تطبيق التحديثات على العملاء (العميل الحالي + العميل المرشِح)
      setClients(clients.map(cl => {
        if (cl.id === selectedClient.id) {
          return {
            ...cl,
            loyaltyPoints: Math.max(0, (cl.loyaltyPoints || 0) - cashbackUsed + earnedCashback),
            cashback: Math.max(0, (cl.cashback !== undefined ? cl.cashback : cl.loyaltyPoints || 0) - cashbackUsed + earnedCashback),
            hasUsedReferralReward: isFirstInvoice ? true : cl.hasUsedReferralReward,
            lastVisit: new Date().toISOString().split('T')[0]
          };
        }
        if (referrerClientId && cl.id === referrerClientId && referrerEarnedCashback > 0) {
          return {
            ...cl,
            loyaltyPoints: (cl.loyaltyPoints || 0) + referrerEarnedCashback,
            cashback: (cl.cashback !== undefined ? cl.cashback : cl.loyaltyPoints || 0) + referrerEarnedCashback,
            referralCount: (cl.referralCount || 0) + 1,
            referralTotalCashbackEarned: (cl.referralTotalCashbackEarned || 0) + referrerEarnedCashback
          };
        }
        return cl;
      }));
    }

    if (calculatedTip > 0 && assignedTipEmployee) {

      const tipPaymentMethodName = isCashPayment ? 'نقدي (كاش)' : (settings.treasuries.find(t => t.id === singleTreasury)?.name || 'بطاقة / فيزا');
      const newTip: TipRecord = {
        id: 'TIP-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        salonId: settings.salonId,
        branchId: (newInvoice as any)?.branchId,
        invoiceId: newInvoice.id,
        clientName: newInvoice.clientName,
        employeeId: assignedTipEmployee.id,
        employeeName: assignedTipEmployee.name,
        amount: calculatedTip,
        paymentMethod: tipPaymentMethodName,
        date: newInvoice.date,
        status: tipPayoutMode === 'instant_cash' ? 'paid_out' : 'pending_payout',
        payoutMethod: tipPayoutMode,
        paidOutAt: tipPayoutMode === 'instant_cash' ? newInvoice.date : undefined,
        paidOutTreasuryId: tipPayoutMode === 'instant_cash' ? 'cash' : undefined
      };
      if (setTips) {
        setTips(prev => [...prev, newTip]);
      }
      DB.saveTip(newTip);
    }

    if (onCheckoutComplete) {
      onCheckoutComplete(newInvoice, splits, initialBooking?.id);
    }
    
    setCompletedInvoice(newInvoice);

    setShowPaymentModal(false);
    setShowReceiptModal(true);
    
    // reset cart
    setCart([]);
    setClientSearch('');
    setSelectedClient(null);
    setAdvanceDeduction(0);
    setDiscount({ type: 'fixed', value: 0 });
    setSplitAmounts({});
    setBeforePhotoUrl('');
    setAfterPhotoUrl('');
    setIsRemedyInvoice(false);
    if(onClearInitial) onClearInitial();

    if (settings.printAutomatically) {
      setTimeout(printReceipt, 500);
    }
  };

  const printReceipt = () => {
    const printContent = document.getElementById('receipt-content')?.outerHTML;
    if (printContent) {
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write('<html><head><title>طباعة الفاتورة</title>');
        printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">');
        printWindow.document.write('<style>');
        printWindow.document.write('body { margin: 0; display: flex; justify-content: center; background-color: #fff; direction: rtl; }');
        printWindow.document.write('@media print { body { padding: 0; margin: 0; } @page { margin: 0; } }');
        printWindow.document.write('</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        printWindow.setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    }
  };

  const handleClientSearch = () => {
    if (!clientSearch.trim()) return;
    const found = clients.find(c => c.phone === clientSearch.trim() || c.name === clientSearch.trim());
    if (found) {
      setSelectedClient(found);
    } else {
      setNewClientForm(prev => ({ ...prev, phone: clientSearch.replace(/[^0-9]/g, '') }));
      setShowAddClientModal(true);
    }
  };

  const handleAddClient = () => {
    if (!newClientForm.name || !newClientForm.phone) {
      alert('الرجاء إدخال الاسم ورقم الجوال');
      return;
    }
    const cleanPhone = newClientForm.phone.trim();
    const cleanReferredBy = (newClientForm.referredByPhone && newClientForm.referredByPhone.trim() !== cleanPhone)
      ? newClientForm.referredByPhone.trim()
      : undefined;

    const newClient: Client = {
      id: 'C-' + Math.random().toString(36).substr(2, 9),
      name: newClientForm.name.trim(),
      phone: cleanPhone,
      referredByPhone: cleanReferredBy,
      loyaltyPoints: 0,
      cashback: 0,
      dob: (newClientForm.dobDay && newClientForm.dobMonth) ? `${newClientForm.dobMonth}-${newClientForm.dobDay}` : undefined
    };
    setClients([...clients, newClient]);
    DB.saveClient(newClient);
    setSelectedClient(newClient);
    setClientSearch(newClient.name);
    setShowAddClientModal(false);
    setNewClientForm({ name: '', phone: '', referredByPhone: '', dobDay: '', dobMonth: '' });
  };

  useEffect(() => {
    if (initialBooking) {
      // Find client by phone
      let client = clients.find(c => c.phone === initialBooking.phone);
      if (!client && initialBooking.phone) {
        // Create new client
        client = {
          id: 'C-' + Math.random().toString(36).substr(2, 9),
          name: initialBooking.clientName || 'بدون اسم',
          phone: initialBooking.phone,
          loyaltyPoints: 0
        };
        setClients([...clients, client]);
      }
      setSelectedClient(client || null);
      setClientSearch(initialBooking.clientName);
      
      const cartItems: CartItem[] = initialBooking.services?.map(s => {
        // Try to find the actual service item from mock if possible, otherwise construct a mock one
        const foundItem = items.find(i => i.id === s.serviceId);
        const parsedPrice = Number(s.price) || (foundItem ? Number(foundItem.price) : 0);
        const serviceItem: any = foundItem ? {
          ...foundItem,
          name: s.serviceName || foundItem.name,
          price: parsedPrice,
          displayPrice: parsedPrice
        } : {
          id: s.serviceId,
          name: s.serviceName,
          price: parsedPrice,
          displayPrice: parsedPrice,
          categoryId: 'services',
          isActive: true,
          type: 'service'
        };
        
        return {
          cartId: Math.random().toString(36).substring(2, 9),
          item: serviceItem,
          quantity: 1,
          employeeId: s.technicianId,
          type: 'service'
        };
      }) || [];
      
      setCart(cartItems);
      
      const advancesSum = initialBooking.advancePayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      setAdvanceDeduction(advancesSum);
    }
  }, [initialBooking]);

  const clearBooking = () => {
    setCart([]);
    setClientSearch('');
    setAdvanceDeduction(0);
    if(onClearInitial) onClearInitial();
  };

  const filteredItems = useMemo(() => {
    let source = itemTypeFilter === 'service' ? items.filter(i => i.isActive !== false) : products;
    let filtered = source;
    if (selectedCategory !== 'all') {
      const selectedCat = categories.find(c => c.id === selectedCategory);
      filtered = filtered.filter(i => {
        if (i.categoryId === selectedCategory) return true;
        if (selectedCat && (i.categoryId === selectedCat.name || (i as any).category === selectedCat.name || (i as any).category === selectedCat.id)) return true;
        return false;
      });
    }
    if (searchQuery) {
      filtered = filtered.filter(i => 
        i.name.includes(searchQuery) || (i.barcode && i.barcode === searchQuery)
      );
    }
    return filtered.map(i => {
      const isProduct = itemTypeFilter === 'product';
      const originalPrice = isProduct ? (Number(i.sellPrice) || 0) : (Number(i.price) || 0);
      const rawDiscount = Number(i.discountPrice);
      const hasDiscount = !isProduct && !isNaN(rawDiscount) && rawDiscount > 0 && rawDiscount < originalPrice;
      const effectivePrice = hasDiscount ? rawDiscount : originalPrice;

      return {
        ...i,
        _isProduct: isProduct,
        hasDiscount,
        discountPrice: hasDiscount ? rawDiscount : undefined,
        originalPrice: originalPrice,
        displayPrice: effectivePrice
      };
    });
  }, [selectedCategory, searchQuery, items, products, itemTypeFilter, categories]);

  const addToCart = (item: any) => {
    if (isSubscriptionBlocked) {
      alert('⛔ الحساب موقوف أو انتهت فترة الاشتراك. النظام يعمل الآن بوضع الاطلاع فقط (Read-Only) ولا يمكن إضافة عناصر للسلة.');
      return;
    }
    const finalPrice = item.displayPrice !== undefined ? item.displayPrice : (item.price ?? item.sellPrice ?? 0);
    const newItem: CartItem = {
      cartId: Math.random().toString(36).substring(2, 9),
      item: { ...item, displayPrice: finalPrice },
      quantity: 1,
      price: finalPrice,
      employeeId: '',
      referralEmployeeId: '',
      type: item._isProduct ? 'product' : 'service'
    };
    setCart([...cart, newItem]);
  };


  const updateQuantity = (cartId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        const newQ = Math.max(1, c.quantity + delta);
        return { ...c, quantity: newQ };
      }
      return c;
    }));
  };

  const updateEmployee = (cartId: string, employeeId: string) => {
    setCart(cart.map(c => c.cartId === cartId ? { ...c, employeeId } : c));
  };

  const updateReferralEmployee = (cartId: string, referralEmployeeId: string) => {
    setCart(cart.map(c => c.cartId === cartId ? { ...c, referralEmployeeId } : c));
  };

  const removeFromCart = (cartId: string) => {
    setCart(cart.filter(c => c.cartId !== cartId));
  };

  if (!isShiftOpen) {
    return (
      <div className="flex flex-col h-full w-full bg-slate-50 items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 max-w-md w-full">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <X size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">الوردية مغلقة</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            الرجاء فتح وردية جديدة من لوحة التحكم لتتمكن من إضافة الفواتير والمبيعات.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* Right Section: Items Grid */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Search & Filter */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="ابحث عن خدمة أو مرر الباركود..."
              className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-slate-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={handleOpenScheduleModal}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            title="تعديل مواعيد حضور وانصراف الموظفين"
          >
            <Clock size={16} className="text-amber-600" />
            <span>تعديل مواعيد الدوام</span>
          </button>
        </div>

        
        {/* Type Toggle */}
        <div className="flex gap-2 mb-4 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
          <button 
            onClick={() => { setItemTypeFilter('service'); setSelectedCategory('all'); }} 
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2 ${itemTypeFilter === 'service' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Scissors size={18} /> الخدمات
          </button>
          <button 
            onClick={() => { setItemTypeFilter('product'); setSelectedCategory('all'); }} 
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2 ${itemTypeFilter === 'product' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Package size={18} /> المنتجات
          </button>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
          {categories.filter(c => c.id === 'all' || !c.type || c.type === itemTypeFilter).map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm border ${
                selectedCategory === cat.id 
                  ? 'bg-primary border-primary text-white shadow-primary/20' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map(item => (
              <button 
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-95 group"
              >
                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                  {item._isProduct ? <Package size={24} /> : <Scissors size={24} />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{item.name}</h4>
                  {item.hasDiscount ? (
                    <div className="flex flex-col items-center">
                      <p className="text-emerald-600 font-black text-sm">{item.discountPrice} {settings.currency}</p>
                      <p className="text-slate-400 text-xs line-through">{item.originalPrice} {settings.currency}</p>
                    </div>
                  ) : (
                    <p className="text-secondary font-bold text-sm">{item.originalPrice} {settings.currency}</p>
                  )}

                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Left Section: Cart & Payment (Enlarged & Re-engineered) */}
      <div className="w-full max-w-[420px] lg:max-w-[460px] bg-white border-r border-slate-200 shadow-xl z-10 flex flex-col h-full overflow-hidden">
        
        {/* 1. Top Quick Action Bar: New Bill / Hold / Held Invoices Counter */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between gap-2 shadow-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleNewInvoice}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="بدء فاتورة جديدة (سيتم تعليق الفاتورة الحالية تلقائياً إن وجدت)"
            >
              <FilePlus2 size={15} />
              <span>فاتورة جديدة</span>
            </button>

            <button
              disabled={cart.length === 0}
              onClick={handleHoldCurrentInvoice}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-amber-400 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              title="تعليق الفاتورة الحالية للعودة إليها لاحقاً"
            >
              <PauseCircle size={15} />
              <span>تعليق</span>
            </button>
          </div>

          {/* Held Invoices Button & Glowing Badge */}
          <button
            onClick={() => setShowHeldInvoicesModal(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              heldInvoices.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="عرض الفواتير المعلقة والمفتوحة"
          >
            <Layers size={15} />
            <span>الفواتير المعلقة</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${heldInvoices.length > 0 ? 'bg-slate-950 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
              {heldInvoices.length}
            </span>
          </button>
        </div>

        {/* 2. Client Select Header */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2">
            {!selectedClient ? (
              <div className="relative flex-1 flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="رقم العميل للبحث أو الإضافة..."
                    className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleClientSearch(); }}
                  />
                </div>
                <button onClick={handleClientSearch} className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors">
                  بحث
                </button>
              </div>
            ) : (
              <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-2 shadow-2xs space-y-1 animate-in fade-in">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-xs ${
                      clientTier?.id === 'royal' ? 'bg-gradient-to-br from-purple-600 to-indigo-700 ring-2 ring-purple-400/30' :
                      clientTier?.id === 'vip' ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 ring-2 ring-amber-400/30' :
                      clientTier?.id === 'distinguished' ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-slate-900'
                    }`}>
                      {clientTier ? clientTier.icon : selectedClient.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-black text-slate-900">{selectedClient.name}</p>
                        {clientTier && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-0.5 ${clientTier.badgeBg} ${clientTier.badgeText} ${clientTier.badgeBorder}`}>
                            <span>{clientTier.icon}</span>
                            <span>{clientTier.name}</span>
                            {clientTier.discountPercentage > 0 && <span>({clientTier.discountPercentage}%)</span>}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono font-bold text-slate-500" dir="ltr">{selectedClient.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedClient(null); setClientSearch(''); setDiscount({ type: 'fixed', value: 0 }); }} className="text-slate-400 hover:text-red-500 p-1 transition-colors">
                    <X size={14} />
                  </button>
                </div>

                {/* Cross-branch summary & points bar */}
                <div className="flex items-center justify-between text-[9px] bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 font-bold">
                  {canViewClientFinancials ? (
                    <span className="text-emerald-700">
                      مجموع الإنفاق: <strong className="font-mono">{clientTotalSpend.toFixed(0)} {settings.currency}</strong>
                    </span>
                  ) : <span className="text-slate-400">عميل مسجل ✓</span>}
                  <span className="text-purple-700">
                    كاش باك: <strong className="font-mono">{(selectedClient.cashback !== undefined ? selectedClient.cashback : selectedClient.loyaltyPoints || 0).toFixed(1)} {settings.currency}</strong>
                  </span>
                </div>
              </div>
            )}
            
            {initialBooking && (
              <button onClick={clearBooking} title="إلغاء الحجز الحالي" className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
          {initialBooking && advanceDeduction > 0 && (
            <div className="bg-emerald-50 text-emerald-700 text-[11px] px-2.5 py-1 rounded-md font-bold flex justify-between items-center border border-emerald-100 mt-1.5">
              <span>مقدم مدفوع مسبقاً (سيتم خصمه)</span>
              <span>{advanceDeduction} {settings.currency}</span>
            </div>
          )}
        </div>

        {/* 3. Cart Items List (Enlarged & Spacious) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-slate-50/40">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                <Scissors size={36} strokeWidth={1.5} />
              </div>
              <p className="font-bold text-sm text-slate-600">الفاتورة فارغة</p>
              <p className="text-xs text-slate-400">اختر الخدمات أو المنتجات من القائمة لإضافتها للسلة</p>
            </div>
          ) : (
            cart.map(c => {
              const hasReferralCommission = c.type === 'service' && c.item.referralCommissionAmount;
              return (
                <div key={c.cartId} className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-col gap-2 transition-all hover:border-slate-300">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${c.type === 'product' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                          {c.type === 'product' ? 'منتج 📦' : 'خدمة ✂️'}
                        </span>
                        <h5 className="font-extrabold text-slate-900 text-xs leading-tight">{c.item.name}</h5>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {editingCartId === c.cartId ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={customPriceInput}
                              onChange={e => setCustomPriceInput(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-16 px-1.5 py-0.5 border border-primary rounded text-xs font-bold text-slate-800"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveCustomPrice(c.cartId)}
                              className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded"
                            >
                              حفظ
                            </button>
                            <button
                              onClick={() => setEditingCartId(null)}
                              className="px-1 py-0.5 text-slate-400 hover:text-slate-600 text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <p 
                              className={`text-primary font-black text-xs ${canEditItemPrice ? 'cursor-pointer hover:underline' : ''}`}
                              onClick={() => {
                                if (canEditItemPrice) {
                                  setEditingCartId(c.cartId);
                                  setCustomPriceInput(c.item.displayPrice);
                                }
                              }}
                              title={canEditItemPrice ? "انقر لتعديل السعر في الفاتورة" : undefined}
                            >
                              {c.item.displayPrice} {settings.currency}
                              {canEditItemPrice && <span className="text-[9px] text-slate-400 mr-1">✏️</span>}
                            </p>
                            {c.quantity > 1 && (
                              <span className="text-[10px] text-slate-400 font-bold">
                                (الإجمالي: {(c.item.displayPrice * c.quantity).toFixed(2)} {settings.currency})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                        <button onClick={() => updateQuantity(c.cartId, 1)} className="p-1 text-slate-700 hover:text-primary transition-colors"><Plus size={12} /></button>
                        <span className="text-xs font-black w-5 text-center font-mono">{c.quantity}</span>
                        <button onClick={() => updateQuantity(c.cartId, -1)} className="p-1 text-slate-700 hover:text-red-500 transition-colors"><Minus size={12} /></button>
                      </div>
                      <button onClick={() => removeFromCart(c.cartId)} className="text-slate-400 hover:text-red-500 p-1 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Performer & Referral (فتح شغل) Controls Row */}
                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
                    {/* 1. Performer */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                        <span>✂️ الفني المنفذ:</span>
                      </label>
                      <select 
                        className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-full outline-none focus:border-primary cursor-pointer transition-colors font-semibold"
                        value={c.employeeId}
                        onChange={(e) => updateEmployee(c.cartId, e.target.value)}
                      >
                        <option value="">اختر المنفذ...</option>
                        {employees.filter(e => e.isActive !== false).map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Referral / فتح شغل */}
                    {c.type === 'service' ? (
                      <div>
                        <label className="block text-[9px] font-bold text-amber-800 mb-0.5 flex items-center justify-between">
                          <span className="flex items-center gap-0.5">
                            <span>⚡</span>
                            <span>إحالة (فتح شغل):</span>
                          </span>
                          {hasReferralCommission ? (
                            <span className="text-[8px] font-mono font-black text-amber-700 bg-amber-100/80 px-1 rounded">
                              {c.item.referralCommissionType === 'fixed' ? `+${c.item.referralCommissionAmount}` : `+${c.item.referralCommissionAmount}%`}
                            </span>
                          ) : null}
                        </label>
                        <select 
                          className="text-[11px] bg-amber-50/60 border border-amber-200 rounded-lg px-2 py-1 w-full outline-none focus:border-amber-500 cursor-pointer transition-colors text-amber-950 font-bold"
                          value={c.referralEmployeeId || ''}
                          onChange={(e) => updateReferralEmployee(c.cartId, e.target.value)}
                        >
                          <option value="">بدون إحالة...</option>
                          {employees.filter(e => e.isActive !== false).map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center text-[10px] text-slate-400 self-end pb-1 font-bold">
                        📦 منتج بيع مباشر
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Compact Summary & Checkout Bottom Bar */}
        <div className="bg-white border-t border-slate-200 p-3 space-y-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] shrink-0">
          
          {/* Quick Options Bar (Warranty & Photos) */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 text-[10px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input 
                type="checkbox"
                checked={isRemedyInvoice}
                onChange={e => setIsRemedyInvoice(e.target.checked)}
                className="w-3.5 h-3.5 text-purple-600 rounded"
              />
              <span className="font-black text-purple-950 flex items-center gap-1">
                <Wrench size={12} className="text-purple-700" />
                <span>إصلاح مجاني (ضمان)</span>
              </span>
            </label>

            <div className="flex items-center gap-1.5">
              <label className={`cursor-pointer px-1.5 py-0.5 rounded-lg text-[9px] font-black border transition-colors ${beforePhotoUrl ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                <span>{beforePhotoUrl ? '📷 قبل ✓' : '+ صورة قبل'}</span>
                <input type="file" accept="image/*" onChange={e => handleInvoicePhotoUpload(e, 'before')} className="hidden" />
              </label>
              <label className={`cursor-pointer px-1.5 py-0.5 rounded-lg text-[9px] font-black border transition-colors ${afterPhotoUrl ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                <span>{afterPhotoUrl ? '📷 بعد ✓' : '+ صورة بعد'}</span>
                <input type="file" accept="image/*" onChange={e => handleInvoicePhotoUpload(e, 'after')} className="hidden" />
              </label>
            </div>
          </div>

          {/* Compact Calculations Grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>المجموع:</span>
              <span className="font-bold font-mono text-slate-800">{subtotal.toFixed(2)} {settings.currency}</span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>الخصم:</span>
              <div className="flex items-center gap-1">
                <input 
                  type="number" 
                  disabled={isRemedyInvoice}
                  value={isRemedyInvoice ? subtotal : (discount.value || '')}
                  onChange={(e) => setDiscount({...discount, value: Number(e.target.value)})}
                  className="w-12 border border-slate-200 rounded px-1 py-0.5 text-center text-xs outline-none focus:border-primary disabled:bg-slate-100 font-mono font-bold"
                  placeholder="0"
                />
                <select 
                  disabled={isRemedyInvoice}
                  value={discount.type}
                  onChange={(e) => setDiscount({...discount, type: e.target.value as 'percentage'|'fixed'})}
                  className="border border-slate-200 rounded px-0.5 text-[10px] outline-none cursor-pointer"
                >
                  <option value="fixed">{settings.currency}</option>
                  <option value="percentage">%</option>
                </select>
              </div>
            </div>

            {settings.vatEnabled && !isRemedyInvoice && (
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>الضريبة ({settings.vatRate}%):</span>
                <span className="font-bold font-mono">{vatAmount.toFixed(2)}</span>
              </div>
            )}

            {advanceDeduction > 0 && !isRemedyInvoice && (
              <div className="flex justify-between items-center text-emerald-700 text-[11px] font-bold">
                <span>خصم المقدم:</span>
                <span className="font-mono">-{advanceDeduction.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Promo Code Input & Active Badge */}
          <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-2 flex flex-col gap-1.5">
            {!appliedPromo ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="برومو كود (مثل TEMO25)..."
                  className="flex-1 px-2.5 py-1 bg-white border border-purple-200 rounded-lg text-xs font-mono font-bold uppercase outline-none focus:border-purple-500"
                  onKeyDown={e => { if (e.key === 'Enter') handleApplyPromoCode(); }}
                />
                <button
                  type="button"
                  onClick={handleApplyPromoCode}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  تطبيق
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs font-bold text-purple-900 bg-purple-100/80 px-2 py-1 rounded-lg">
                <span className="flex items-center gap-1">
                  <Tag size={13} className="text-purple-700" />
                  <span>تم تطبيق الكود: <strong>{appliedPromo.code}</strong> (-{promoDiscountAmount.toFixed(2)} {settings.currency})</span>
                </span>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="text-purple-600 hover:text-red-600 p-0.5"
                  title="إلغاء البرومو كود"
                >
                  ✕
                </button>
              </div>
            )}
            {promoError && (
              <div className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{promoError}</span>
              </div>
            )}
          </div>

          {/* Tier Discount Banner if active */}
          {clientTier && clientTier.discountPercentage > 0 && discount.value === clientTier.discountPercentage && discount.type === 'percentage' && !isRemedyInvoice && (
            <div className="text-[10px] font-black bg-amber-50 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-300 flex items-center justify-between">
              <span>{clientTier.icon} خصم مستوى {clientTier.name}:</span>
              <span className="font-mono">-{manualDiscountAmount.toFixed(2)} {settings.currency} ({clientTier.discountPercentage}%)</span>
            </div>
          )}

          {isSubscriptionBlocked && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2 text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-rose-700 font-black text-[11px]">
                <AlertCircle size={13} />
                <span>الاشتراك غير نشط (وضع القراءة فقط)</span>
              </div>
            </div>
          )}

          <button 
            disabled={cart.length === 0 || isSubscriptionBlocked}
            onClick={() => {
              if (isSubscriptionBlocked) {
                alert('⚠️ عذراً، لا يمكن إصدار فواتير جديدة نظراً لانتهاء الفترة التجريبية للصالون. يرجى تجديد الاشتراك مع الإدارة.');
                return;
              }
              if (cart.length > 0) setShowPaymentModal(true);
            }} 
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-2.5 px-3 rounded-xl transition-all shadow-md flex items-center justify-between cursor-pointer active:scale-[0.99]"
          >
            <span className="flex items-center gap-1.5 text-xs">
              <CreditCard size={16} />
              <span>إتمام وسداد الفاتورة</span>
            </span>
            <span className="text-sm font-black font-mono bg-emerald-700/60 px-2.5 py-0.5 rounded-lg">
              {finalTotal.toFixed(2)} {settings.currency}
            </span>
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">طريقة الدفع وسداد الفاتورة</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="text-center mb-2">
                <p className="text-slate-500 text-xs mb-0.5 font-bold">صافي المبلغ المطلوب سداده</p>
                <p className="text-3xl font-extrabold text-primary">{finalTotal.toFixed(2)} <span className="text-sm font-normal text-slate-500">{settings.currency}</span></p>
              </div>

              {/* Received Amount & Tips / Change Calculation */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">المبلغ المدفوع من العميل:</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={finalTotal}
                      step="any"
                      value={receivedAmount}
                      onChange={e => setReceivedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={finalTotal.toFixed(2)}
                      className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-left font-mono font-black text-sm focus:border-primary outline-none"
                    />
                    <span className="text-xs text-slate-500 font-bold">{settings.currency}</span>
                  </div>
                </div>

                {/* Case 1: Cash Change Due */}
                {isCashPayment && changeDue > 0 && (
                  <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-200 font-bold">
                    <span>الباقي المستحق للعميل (كاش):</span>
                    <span className="font-mono text-base font-black text-emerald-700">
                      {changeDue.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                )}

                {/* Case 2: Non-Cash Tip Recognized */}
                {!isCashPayment && calculatedTip > 0 && (
                  <div className="space-y-2.5 bg-gradient-to-br from-purple-50 to-indigo-50 text-purple-950 p-4 rounded-2xl border border-purple-200 shadow-xs">
                    <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                      <span className="flex items-center gap-1.5 text-xs font-black text-purple-900">
                        <DollarSign size={16} className="text-purple-600" />
                        <span>مبلغ الزيادة (الإكرامية / البقشيش):</span>
                      </span>
                      <span className="font-mono text-lg font-black text-purple-700">
                        +{calculatedTip.toFixed(2)} {settings.currency}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2.5 rounded-xl border border-purple-100">
                      <div>
                        <span className="text-slate-500 block">المبلغ المدفوع بالفيزا:</span>
                        <span className="font-mono font-bold text-slate-800">{receivedNum.toFixed(2)} {settings.currency}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">صافي الفاتورة:</span>
                        <span className="font-mono font-bold text-slate-800">{finalTotal.toFixed(2)} {settings.currency}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-purple-900 mb-1">الموظف المستحق للإكرامية *</label>
                      <select
                        value={tipEmployeeId}
                        onChange={e => setTipEmployeeId(e.target.value)}
                        className="w-full bg-white border border-purple-300 rounded-xl px-3 py-1.5 text-xs font-bold text-purple-950 outline-none focus:border-purple-600 shadow-2xs"
                      >
                        {employees.filter(e => e.isActive !== false).map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="text-[11px] font-semibold p-2.5 rounded-xl border flex items-center gap-1.5" style={{
                      backgroundColor: (settings.tipPayoutMethod || 'instant_cash') === 'instant_cash' ? '#ecfdf5' : '#eef2ff',
                      borderColor: (settings.tipPayoutMethod || 'instant_cash') === 'instant_cash' ? '#a7f3d0' : '#c7d2fe',
                      color: (settings.tipPayoutMethod || 'instant_cash') === 'instant_cash' ? '#065f46' : '#3730a3'
                    }}>
                      {(settings.tipPayoutMethod || 'instant_cash') === 'instant_cash' ? (
                        <>
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span>🟢 الصرف الفوري: يُخصم البقشيش فوراً نقداً من درج الكاش لتسليمه للموظف، وتُسجل الفيزا بكامل المبلغ ({receivedNum.toFixed(2)} {settings.currency}).</span>
                        </>
                      ) : (
                        <>
                          <Clock size={14} className="text-indigo-600 shrink-0" />
                          <span>🟡 الصرف المؤجل: يُسجل البقشيش كرصيد مجمع للموظف ويُصرف لاحقاً من الخزينة المحددة.</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>



              {(() => {
                const maxCashback = selectedClient ? selectedClient.loyaltyPoints : 0;
                
                return (
                  <>
                    {selectedClient && maxCashback > 0 && (
                      <div className="mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-blue-800">رصيد الكاش باك المتوفر:</span>
                          <span className="text-sm font-bold text-blue-600">{maxCashback.toFixed(2)} {settings.currency}</span>
                        </div>
                        <label className="block text-xs font-bold text-blue-700 mb-1">المبلغ المستخدم من الكاش باك (سيتم خصمه من الإجمالي):</label>
                        <input 
                          type="number" 
                          max={Math.min(maxCashback, finalTotal)}
                          min={0}
                          value={splitAmounts['cashback'] || ''}
                          onChange={(e) => {
                            let val = Number(e.target.value);
                            if (val > maxCashback) val = maxCashback;
                            if (val > finalTotal) val = finalTotal;
                            if (val < 0) val = 0;
                            setSplitAmounts(prev => ({...prev, 'cashback': val}));
                          }}
                          className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                <button 
                  onClick={() => setPaymentType('single')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${paymentType === 'single' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  طريقة دفع واحدة
                </button>
                <button 
                  onClick={() => setPaymentType('split')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${paymentType === 'split' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  تقسيم الفاتورة
                </button>
              </div>

              {paymentType === 'single' ? (
                <div className="space-y-3">
                  {settings.treasuries.filter(t => !t.isMain).map(t => (
                    <label key={t.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${singleTreasury === t.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="radio" name="treasury" value={t.id} checked={singleTreasury === t.id} onChange={() => setSingleTreasury(t.id)} className="w-4 h-4 text-primary" />
                      <span className="font-bold text-slate-700">{t.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {settings.treasuries.filter(t => !t.isMain).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                      <span className="font-bold text-slate-700">{t.name}</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0"
                          className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-left outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          value={splitAmounts[t.id] || ''}
                          onChange={(e) => setSplitAmounts({...splitAmounts, [t.id]: Number(e.target.value)})}
                        />
                        <span className="text-xs text-slate-500">{settings.currency}</span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 text-center text-sm font-bold">
                    <span className="text-slate-500">المتبقي للتوزيع: </span>
                    {(() => {
                      const totalSplit = Object.values(splitAmounts).reduce((a: number, b) => a + (Number(b) || 0), 0) as number;
                      const remaining = finalTotal - totalSplit;
                      return (
                        <span className={remaining === 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {remaining.toFixed(2)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={handleConfirmPayment}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-emerald-500/20"
              >
                تأكيد الدفع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt / Invoice Print Modal */}
      {showReceiptModal && completedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">معاينة الفاتورة</h3>
              <button onClick={() => { setShowReceiptModal(false); setCompletedInvoice(null); }} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
            </div>
            
            {/* Thermal Paper Preview Area */}
            <div className="bg-slate-200 p-8 overflow-y-auto flex justify-center" style={{ fontFamily: '"Cairo", sans-serif' }}>
              <div id="receipt-content" className="bg-white shadow-sm" style={{ width: '100%', maxWidth: '72mm', padding: '5mm', fontFamily: '"Cairo", sans-serif', color: '#000', margin: '0 auto', boxSizing: 'border-box' }}>
                <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                  {settings.logoUrl && (
                    <img src={settings.logoUrl} alt="Logo" style={{ maxWidth: '80px', maxHeight: '80px', margin: '0 auto 10px auto', display: 'block' }} />
                  )}
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 5px 0' }}>{settings.salonName || 'صالون العناية'}</h2>
                  
                  <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>
                  
                  <p style={{ fontSize: '13px', margin: '0' }}>رقم الفاتورة: {completedInvoice.id}</p>
                  <p style={{ fontSize: '13px', margin: '0' }}>التاريخ: {new Date(completedInvoice.date).toLocaleString('ar-SA')}</p>
                  {completedInvoice.clientName && (
                    <p style={{ fontSize: '13px', margin: '5px 0 0 0' }}>العميل: {completedInvoice.clientName}</p>
                  )}
                </div>
                
                <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>
                
                <table style={{ width: '100%', fontSize: '13px', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000' }}>
                      <th style={{ padding: '8px 0', width: '50%' }}>الصنف</th>
                      <th style={{ padding: '8px 0', textAlign: 'center', width: '20%' }}>الكمية</th>
                      <th style={{ padding: '8px 0', textAlign: 'left', width: '30%' }}>السعر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedInvoice.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                        <td style={{ padding: '8px 0' }}>
                          <div style={{ fontWeight: 'bold' }}>{item.serviceName}</div>
                          <div style={{ fontSize: '11px', color: '#555' }}>بواسطة: {item.technicianName || '-'}</div>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'center' }}>{item.quantity || 1}</td>
                        <td style={{ padding: '8px 0', textAlign: 'left' }}>{item.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>
                
                <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>المجموع:</span>
                    <span>{completedInvoice.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0).toFixed(2)}</span>
                  </div>
                  {completedInvoice.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>الخصم:</span>
                      <span>- {completedInvoice.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {settings.vatEnabled && (() => {
                    const invoiceSubtotal = completedInvoice.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
                    const totalInclusive = Math.max(0, invoiceSubtotal - completedInvoice.discount);
                    const baseTotal = totalInclusive / (1 + settings.vatRate / 100);
                    const vatAmt = totalInclusive - baseTotal;
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span>المبلغ قبل الضريبة:</span>
                          <span>{baseTotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span>الضريبة ({settings.vatRate}%):</span>
                          <span>{vatAmt.toFixed(2)} شامل</span>
                        </div>
                      </>
                    );
                  })()}
                  {advanceDeduction > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                      <span>مقدم مدفوع:</span>
                      <span>- {advanceDeduction.toFixed(2)}</span>
                    </div>
                  )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #000' }}>
                    <span>الصافي المدفوع:</span>
                    <span>{completedInvoice.total.toFixed(2)} {settings.currency}</span>
                  </div>
                  {completedInvoice.paymentMethods && completedInvoice.paymentMethods.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #ccc', fontSize: '12px' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>طرق الدفع:</div>
                      {completedInvoice.paymentMethods.map((pm, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{pm.treasuryId === 'cashback' ? 'كاش باك' : (settings.treasuries.find(t => t.id === pm.treasuryId)?.name || 'غير محدد')}</span>
                          <span>{pm.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '13px', fontWeight: 'bold' }}>
                  <p style={{ margin: '0 0 10px 0' }}>شكراً لزيارتكم!</p>
                  {settings.phone && <p style={{ fontSize: '12px', fontWeight: 'normal', margin: '2px 0' }}>جوال: {settings.phone}</p>}
                  {settings.address && <p style={{ fontSize: '12px', fontWeight: 'normal', margin: '2px 0' }}>العنوان: {settings.address}</p>}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => { setShowReceiptModal(false); setCompletedInvoice(null); }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                إغلاق
              </button>
              <button 
                onClick={printReceipt}
                className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-md transition-colors"
              >
                طباعة الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">إضافة عميل جديد</h3>
              <button onClick={() => setShowAddClientModal(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم العميل *</label>
                <input 
                  type="text"
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm({...newClientForm, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-primary"
                  placeholder="اسم العميل الكامل..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">رقم الجوال *</label>
                <input 
                  type="text"
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm({...newClientForm, phone: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-primary"
                  placeholder="05XXXXXXXX"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-amber-700 mb-1 flex items-center gap-2">
                  <span>🎁</span>
                  <span>رقم جوال العميل الذي رشحه (اختياري)</span>
                </label>
                <input 
                  type="text"
                  value={newClientForm.referredByPhone}
                  onChange={(e) => setNewClientForm({...newClientForm, referredByPhone: e.target.value})}
                  className="w-full bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 outline-none focus:border-amber-500 font-mono"
                  placeholder="رقم جوال العميل المرشِح..."
                  dir="ltr"
                />
                {newClientForm.referredByPhone && newClientForm.referredByPhone.trim() === newClientForm.phone.trim() && (
                  <p className="text-xs text-red-500 font-bold mt-1">⚠️ لا يمكن إدخال رقم العميل نفسه كمرشِح</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">تاريخ الميلاد (اختياري)</label>
                <div className="flex gap-3">
                  <select 
                    value={newClientForm.dobDay}
                    onChange={(e) => setNewClientForm({...newClientForm, dobDay: e.target.value})}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-primary"
                  >
                    <option value="">اليوم</option>
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                      <option key={d} value={d.toString().padStart(2, '0')}>{d}</option>
                    ))}
                  </select>
                  <select 
                    value={newClientForm.dobMonth}
                    onChange={(e) => setNewClientForm({...newClientForm, dobMonth: e.target.value})}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-primary"
                  >
                    <option value="">الشهر</option>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m.toString().padStart(2, '0')}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={handleAddClient}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-primary/20"
              >
                حفظ العميل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fast Shift Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">تعديل مواعيد حضور وانصراف الموظفين</h3>
                  <p className="text-xs text-slate-500">تطبيق المواعيد الجديدة بأثر فوري في التايم شيت من تاريخ السريان</p>
                </div>
              </div>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Effective Date & Batch Adjuster */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar size={13} className="text-indigo-600" />
                  <span>تاريخ سريان المواعيد الجديدة</span>
                </label>
                <input
                  type="date"
                  value={scheduleEffectiveDate}
                  onChange={e => setScheduleEffectiveDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تطبيق موعد موحد للجميع
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={bulkCheckIn}
                    onChange={e => setBulkCheckIn(e.target.value)}
                    className="w-24 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-mono font-bold"
                  />
                  <span className="text-xs text-slate-400">إلى</span>
                  <input
                    type="time"
                    value={bulkCheckOut}
                    onChange={e => setBulkCheckOut(e.target.value)}
                    className="w-24 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBulkSchedule}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    تطبيق
                  </button>
                </div>
              </div>
            </div>

            {/* Employees List */}
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">وقت الحضور المقرر</th>
                    <th className="p-3">وقت الانصراف المقرر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.filter(e => e.isActive !== false).map(emp => {
                    const currentSched = employeeSchedules[emp.id] || { checkIn: emp.checkInTime || '09:00', checkOut: emp.checkOutTime || '18:00' };

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{emp.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">كود: {emp.fingerprintCode || '-'} | {emp.role}</div>
                        </td>
                        <td className="p-3">
                          <input
                            type="time"
                            value={currentSched.checkIn}
                            onChange={e => {
                              setEmployeeSchedules({
                                ...employeeSchedules,
                                [emp.id]: {
                                  ...currentSched,
                                  checkIn: e.target.value
                                }
                              });
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="time"
                            value={currentSched.checkOut}
                            onChange={e => {
                              setEmployeeSchedules({
                                ...employeeSchedules,
                                [emp.id]: {
                                  ...currentSched,
                                  checkOut: e.target.value
                                }
                              });
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveShiftSchedules}
                className="flex-2 py-2.5 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>حفظ وتطبيق المواعيد الجديدة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⏸️ Held / Suspended Invoices Modal */}
      {showHeldInvoicesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">سجل الفواتير المعلقة والمفتوحة (On-Hold Invoices)</h3>
                  <p className="text-[11px] text-slate-300">يمكنك استكمال أي فاتورة معلقة بضغطة زر أو إلغاؤها</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHeldInvoicesModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar bg-slate-50">
              {heldInvoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <PauseCircle size={40} className="mx-auto opacity-40 text-slate-400" />
                  <p className="font-bold text-sm text-slate-600">لا توجد فواتير معلقة حالياً</p>
                  <p className="text-xs text-slate-400">عند الضغط على زر "فاتورة جديدة" يتم تعليق الفاتورة الحالية هنا تلقائياً</p>
                </div>
              ) : (
                heldInvoices.map((held, idx) => {
                  const heldSubtotal = held.cart.reduce((sum, c) => sum + (c.item.displayPrice * c.quantity), 0);
                  const heldDiscountAmt = held.discount.type === 'percentage' ? heldSubtotal * (held.discount.value / 100) : held.discount.value;
                  const heldTotal = held.isRemedyInvoice ? 0 : Math.max(0, heldSubtotal - heldDiscountAmt - held.advanceDeduction);

                  return (
                    <div key={held.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 hover:border-amber-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-mono font-black text-xs">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-xs text-slate-900">
                                {held.client?.name || held.clientSearch || 'عميل نقدي'}
                              </h4>
                              {held.client?.phone && (
                                <span className="text-[10px] text-slate-500 font-mono" dir="ltr">{held.client.phone}</span>
                              )}
                              {held.isRemedyInvoice && (
                                <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                  ضمان/إصلاح
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                              <Clock size={11} />
                              <span>معلقة منذ: {held.timeStr || held.heldAt.split('T')[1].substring(0, 5)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-left">
                          <span className="text-sm font-black font-mono text-primary">
                            {heldTotal.toFixed(2)} {settings.currency}
                          </span>
                          <p className="text-[10px] text-slate-400 font-semibold">{held.cart.length} أصناف / خدمات</p>
                        </div>
                      </div>

                      {/* Items Preview Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                        {held.cart.map(c => (
                          <span key={c.cartId} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span>{c.item.name}</span>
                            <span className="font-mono text-primary font-bold">x{c.quantity}</span>
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleDeleteHeldInvoice(held.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>إلغاء وحذف</span>
                        </button>

                        <button
                          onClick={() => handleResumeHeldInvoice(held)}
                          className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <PlayCircle size={14} />
                          <span>استكمال الفاتورة</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white flex justify-between items-center">
              <span className="text-xs text-slate-500 font-bold">
                إجمالي الفواتير المعلقة: <strong className="text-slate-800">{heldInvoices.length}</strong>
              </span>
              <button
                onClick={() => setShowHeldInvoicesModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
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
