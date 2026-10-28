import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Plus, Minus, Trash2, User, CreditCard, Banknote, Scissors, 
  Tag, X, Package, Clock, UserCog, Calendar, CheckCircle2, Image as ImageIcon,
  Wrench, ShieldAlert, Camera, Crown, Sparkles, PauseCircle, PlayCircle,
  FilePlus2, Layers, Zap, AlertCircle, DollarSign, Coffee, Sliders, Save, AlertTriangle, Loader2,
  Printer, Eye, FileText, RotateCcw, Barcode, Hourglass, CheckCircle, Check,
  Wallet, Ticket, Edit3, Gift, Lock, Info, Star, UserCheck
} from 'lucide-react';
import { 
  AppSettings, CartItem, ServiceItem, Booking, Invoice, Client, Category, Employee,
  getClientTier, getNextClientTier, calculateClientTotalSpend, ClientTierConfig, HeldInvoice, PromoCode, PromoCodeUsage, TipRecord, AdvancePayment, ClientPreferences, Transaction, FingerprintLog, SalesReturn, Branch,
  getServicePrice
} from '../types';
import { processImageFile, MAX_IMAGE_SIZE_KB, compressClientBeforeAfterPhoto } from '../utils/imageUpload';
import { ComplaintsService } from '../services/complaintsService';
import { ZatcaService } from '../services/zatcaService';
import { EtaEgyptService } from '../services/etaEgyptService';
import { DB } from '../services/db';
import { SupabaseService } from '../services/supabase';
import { AuthService } from '../services/auth';
import { RealtimeSync } from '../services/realtimeSync';
import { isBarberEmployee, isReferralEligibleEmployee } from '../utils/employeeHelper';
import { ClosingReportReceipt } from './ClosingReportReceipt';
import { printThermalFinancialVoucher } from './ThermalFinancialVoucher';
import { directPrintHtml, isMobileOrTablet, printHtmlToMainServer } from '../utils/print';
import { InvoiceReceiptCard, executePrintInvoiceReceipt, isSaudiSalon } from './InvoiceReceiptCard';
import { SalesReturnModal } from './SalesReturnModal';
import { SalesReturnVoucherModal } from './SalesReturnVoucherModal';
import { generateBarcodeSvgString } from '../utils/barcodeGenerator';
import { POSAttendanceModal } from './POSAttendanceModal';

const getCartItemPrice = (c: CartItem | any): number => {
  if (!c) return 0;
  const p = c?.item?.displayPrice ?? c?.item?.price ?? c?.price ?? 0;
  const num = Number(p);
  return isNaN(num) ? 0 : num;
};

const normalizeCartItem = (c: any): CartItem => {
  const price = getCartItemPrice(c);
  const rawItem = c?.item || {};
  const origPrice = Number(c?.originalPrice || rawItem?.originalPrice || (c?.discount ? price + Number(c.discount) : price));
  const disc = Number(c?.discount || rawItem?.discount || 0);

  return {
    cartId: c?.cartId || Math.random().toString(36).substring(2, 9),
    quantity: Math.max(1, Number(c?.quantity) || 1),
    employeeId: c?.employeeId && c?.employeeId !== 'any' ? c?.employeeId : '',
    referralEmployeeId: c?.referralEmployeeId || '',
    type: c?.type || rawItem?.type || (rawItem?._isProduct ? 'product' : 'service'),
    price,
    discount: disc > 0 ? disc : undefined,
    originalPrice: origPrice > price ? origPrice : undefined,
    item: {
      ...rawItem,
      id: rawItem?.id || c?.id || c?.serviceId || c?.productId || 'item',
      name: rawItem?.name || c?.name || c?.serviceName || 'خدمة',
      price,
      displayPrice: price,
      type: rawItem?.type || c?.type || 'service',
      originalPrice: origPrice > price ? origPrice : undefined,
      discount: disc > 0 ? disc : undefined
    }
  };
};

const isLightColor = (hex?: string): boolean => {
  if (!hex || !hex.startsWith('#')) return false;
  const c = hex.substring(1);
  const rgb = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
  if (isNaN(rgb)) return false;
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165;
};

function buildReceiptHtml(completedInvoice: Invoice, settings: AppSettings): string {
  const items = completedInvoice.items || [];
  const invoiceSubtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * (Number(item.quantity) || 1)), 0);
  const discountVal = Number(completedInvoice.discount) || 0;
  const totalInclusive = Math.max(0, invoiceSubtotal - discountVal);
  const vatRate = Number(settings.vatRate) || 15;
  const baseTotal = totalInclusive / (1 + vatRate / 100);
  const vatAmt = totalInclusive - baseTotal;
  const advAmt = Number(completedInvoice.advanceDeduction) || 0;
  const advList = completedInvoice.advancePayments || [];

  return `
    <div style="width: 100%; max-width: 72mm; padding: 5mm; font-family: 'Cairo', sans-serif; color: #000; margin: 0 auto; box-sizing: border-box; direction: rtl; text-align: right;">
      <div style="text-align: center; margin-bottom: 15px;">
        ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-width: 80px; max-height: 80px; margin: 0 auto 10px auto; display: block;" />` : ''}
        <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 5px 0;">${settings.salonName || 'صالون العناية'}</h2>
        ${completedInvoice.id ? `
          <div style="margin: 6px auto 10px auto; text-align: center;">
            ${generateBarcodeSvgString(completedInvoice.id, { height: 32, width: 1.3, fontSize: 10 })}
          </div>
        ` : ''}
        <div style="border-bottom: 1px dashed #000; margin: 12px 0;"></div>
        <p style="font-size: 13px; margin: 0;">رقم الفاتورة: ${completedInvoice.id}</p>
        <p style="font-size: 13px; margin: 0;">التاريخ: ${new Date(completedInvoice.date).toLocaleString('ar-SA')}</p>
        ${completedInvoice.clientName ? `<p style="font-size: 13px; margin: 5px 0 0 0;">العميل: ${completedInvoice.clientName}</p>` : ''}
      </div>
      
      <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>
      
      <table style="width: 100%; font-size: 13px; text-align: right; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="padding: 8px 0; width: 50%;">الصنف</th>
            <th style="padding: 8px 0; text-align: center; width: 20%;">الكمية</th>
            <th style="padding: 8px 0; text-align: left; width: 30%;">السعر</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr style="border-bottom: 1px dotted #ccc;">
              <td style="padding: 8px 0;">
                <div style="font-weight: bold;">${item.serviceName}</div>
                ${(item as any).discount > 0 ? `<div style="font-size: 10px; color: #b91c1c; font-weight: bold;">(خصم: -${Number((item as any).discount).toFixed(2)})</div>` : ''}
                <div style="font-size: 11px; color: #555;">بواسطة: ${item.technicianName || '-'}</div>
              </td>
              <td style="padding: 8px 0; text-align: center;">${item.quantity || 1}</td>
              <td style="padding: 8px 0; text-align: left;">${Number(item.price).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>
      
      <div style="font-size: 14px; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between;">
          <span>المجموع:</span>
          <span>${invoiceSubtotal.toFixed(2)}</span>
        </div>
        ${discountVal > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>الخصم:</span>
            <span>- ${discountVal.toFixed(2)}</span>
          </div>
        ` : ''}
        ${settings.vatEnabled ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span>المبلغ قبل الضريبة:</span>
            <span>${baseTotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span>الضريبة (${vatRate}%):</span>
            <span>${vatAmt.toFixed(2)} شامل</span>
          </div>
        ` : ''}
        ${advAmt > 0 ? `
          <div style="margin: 4px 0; padding: 4px 0; border-top: 1px dotted #a7f3d0; border-bottom: 1px dotted #a7f3d0;">
            <div style="display: flex; justify-content: space-between; color: #059669; font-weight: bold;">
              <span>المدفوع مقدماً (عربون الحجز):</span>
              <span>- ${advAmt.toFixed(2)}</span>
            </div>
            ${advList.length > 0 ? `
              <div style="font-size: 10px; color: #047857; margin-top: 2px;">
                ${advList.map(adv => `
                  <div style="display: flex; justify-content: space-between; padding-left: 8px;">
                    <span>• ${adv.treasuryName || adv.paymentMethod || 'دفعة'} (${adv.date?.split('T')[0] || ''}):</span>
                    <span>${Number(adv.amount).toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #000;">
          <span>الصافي المدفوع اليوم:</span>
          <span>${Number(completedInvoice.total).toFixed(2)} ${settings.currency}</span>
        </div>
        ${completedInvoice.paymentMethods && completedInvoice.paymentMethods.length > 0 ? `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 12px;">
            <div style="font-weight: bold; margin-bottom: 5px;">طرق الدفع:</div>
            ${completedInvoice.paymentMethods.map(pm => `
              <div style="display: flex; justify-content: space-between;">
                <span>${pm.treasuryId === 'cashback' ? 'كاش باك' : (settings.treasuries?.find(t => t.id === pm.treasuryId)?.name || 'غير محدد')}</span>
                <span>${Number(pm.amount).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin-top: 25px; font-size: 13px; font-weight: bold;">
        <p style="margin: 0 0 10px 0;">شكراً لزيارتكم!</p>
        ${settings.phone ? `<p style="font-size: 12px; font-weight: normal; margin: 2px 0;">جوال: ${settings.phone}</p>` : ''}
        ${settings.address ? `<p style="font-size: 12px; font-weight: normal; margin: 2px 0;">العنوان: ${settings.address}</p>` : ''}
      </div>
    </div>
  `;
}

export function POSScreen({ 
  settings, 
  isShiftOpen, 
  shiftDate, 
  initialBooking, 
  initialHeldInvoice,
  initialEditingInvoice,
  onClearInitial, 
  onCheckoutComplete, 
  clients, 
  allSalonClients = [],
  setClients, 
  services: items, 
  categories, 
  employees, 
  products,
  invoices = [],
  setEmployees,
  isSubscriptionBlocked,
  promoCodes = [],
  setPromoCodes,
  promoCodeUsages = [],
  setPromoCodeUsages,
  tips = [],
  setTips,
  currentUser,
  activeBranchId,
  branches = [],
  transactions = [],
  shiftData,
  fingerprintLogs = [],
  setFingerprintLogs,
  setInvoices,
  salesReturns = [],
  setSalesReturns,
  setProducts,
  setTransactions,
  setItemMovements,
}: { 
  settings: AppSettings, 
  branches?: Branch[],
  activeBranchId?: string,
  isShiftOpen: boolean,
  shiftDate: string,
  initialBooking?: Booking | null, 
  initialHeldInvoice?: HeldInvoice | null,
  initialEditingInvoice?: Invoice | null,
  onClearInitial?: () => void,
  onCheckoutComplete?: (invoice: Invoice, paymentSplits: { amount: number, treasuryId: string }[], bookingId?: string) => void,
  clients: Client[],
  allSalonClients?: Client[],
  setClients: (c: Client[]) => void,
  services: ServiceItem[],
  categories: Category[],
  employees: Employee[], 
  products: any[],
  invoices?: Invoice[],
  setInvoices?: (i: Invoice[]) => void,
  setEmployees?: (e: Employee[]) => void,
  isSubscriptionBlocked?: boolean,
  promoCodes?: PromoCode[],
  setPromoCodes?: (updater: PromoCode[] | ((prev: PromoCode[]) => PromoCode[])) => void,
  promoCodeUsages?: PromoCodeUsage[],
  setPromoCodeUsages?: (updater: PromoCodeUsage[] | ((prev: PromoCodeUsage[]) => PromoCodeUsage[])) => void,
  tips?: TipRecord[],
  setTips?: (updater: TipRecord[] | ((prev: TipRecord[]) => TipRecord[])) => void,
  currentUser?: any,
  transactions?: Transaction[],
  shiftData?: { isOpen: boolean; date: string; initialCash?: number },
  fingerprintLogs?: FingerprintLog[],
  setFingerprintLogs?: (updater: FingerprintLog[] | ((prev: FingerprintLog[]) => FingerprintLog[])) => void,
  salesReturns?: SalesReturn[],
  setSalesReturns?: (returns: SalesReturn[] | ((prev: SalesReturn[]) => SalesReturn[])) => void,
  setProducts?: (p: any[] | ((prev: any[]) => any[])) => void,
  setTransactions?: (t: any[] | ((prev: any[]) => any[])) => void,
  setItemMovements?: (m: any[] | ((prev: any[]) => any[])) => void,
}) {
  const [showPOSReturnInvoicePicker, setShowPOSReturnInvoicePicker] = useState(false);
  const [posReturnSearch, setPosReturnSearch] = useState('');
  const [posSelectedInvoiceForReturn, setPosSelectedInvoiceForReturn] = useState<Invoice | null>(null);
  const [isPOSReturnModalOpen, setIsPOSReturnModalOpen] = useState(false);
  const [posReturnModalInitialMode, setPosReturnModalInitialMode] = useState<'by_invoice' | 'general'>('by_invoice');
  const [posVoucherReturn, setPosVoucherReturn] = useState<SalesReturn | null>(null);
  const canMakeSalesReturn = AuthService.canDo('sales_return', currentUser);

  const effectiveIsShiftOpen = Boolean(
    isShiftOpen || 
    shiftData?.isOpen || 
    (() => {
      try {
        const raw = localStorage.getItem('smartcut_work_shifts_state');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (activeBranchId && parsed[activeBranchId]?.isOpen) return true;
          if (parsed['b-main']?.isOpen) return true;
          return Object.values(parsed).some((s: any) => s?.isOpen);
        }
      } catch (e) {}
      return false;
    })()
  );

  const effectiveShiftDate = (isShiftOpen && shiftDate) || (shiftData?.isOpen && shiftData?.date) || (() => {
    try {
      const raw = localStorage.getItem('smartcut_work_shifts_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (activeBranchId && parsed[activeBranchId]?.date) return parsed[activeBranchId].date;
        if (parsed['b-main']?.date) return parsed['b-main'].date;
        const anyS: any = Object.values(parsed).find((s: any) => s?.isOpen && s?.date);
        if (anyS?.date) return anyS.date;
      }
    } catch (e) {}
    return shiftDate || new Date().toISOString().split('T')[0];
  })();

  const effectiveShiftCode = (shiftData as any)?.shiftCode || (() => {
    try {
      const raw = localStorage.getItem('smartcut_work_shifts_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (activeBranchId && parsed[activeBranchId]?.shiftCode) return parsed[activeBranchId].shiftCode;
        if (parsed['b-main']?.shiftCode) return parsed['b-main'].shiftCode;
        const anyS: any = Object.values(parsed).find((s: any) => s?.isOpen && s?.shiftCode);
        if (anyS?.shiftCode) return anyS.shiftCode;
      }
    } catch (e) {}
    return undefined;
  })();

  const effectiveShiftId = (shiftData as any)?.shiftId || (() => {
    try {
      const raw = localStorage.getItem('smartcut_work_shifts_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (activeBranchId && parsed[activeBranchId]?.shiftId) return parsed[activeBranchId].shiftId;
        if (parsed['b-main']?.shiftId) return parsed['b-main'].shiftId;
        const anyS: any = Object.values(parsed).find((s: any) => s?.isOpen && s?.shiftId);
        if (anyS?.shiftId) return anyS.shiftId;
      }
    } catch (e) {}
    return undefined;
  })();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<'service' | 'product'>('service');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  const [showDailyReportModal, setShowDailyReportModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState<{
    name: string;
    phone: string;
    referredByPhone: string;
    dobDay: string;
    dobMonth: string;
    clientType: 'citizen' | 'foreigner';
  }>({ name: '', phone: '', referredByPhone: '', dobDay: '', dobMonth: '', clientType: 'citizen' });

  const matchedSalonClientInPOS = useMemo(() => {
    const clean = (newClientForm.phone || '').trim().replace(/\D/g, '');
    if (!clean || clean.length < 7) return null;
    const pool = (allSalonClients && allSalonClients.length > 0) ? allSalonClients : clients;
    return pool.find(c => (c.phone || '').trim().replace(/\D/g, '') === clean) || null;
  }, [newClientForm.phone, allSalonClients, clients]);

  useEffect(() => {
    if (matchedSalonClientInPOS && (!newClientForm.name || newClientForm.name.trim() === '')) {
      const dobParts = (matchedSalonClientInPOS.dob || '').split('-');
      setNewClientForm(prev => ({
        ...prev,
        name: matchedSalonClientInPOS.name || prev.name,
        clientType: matchedSalonClientInPOS.clientType || prev.clientType,
        referredByPhone: matchedSalonClientInPOS.referredByPhone || prev.referredByPhone,
        dobMonth: dobParts[0] || prev.dobMonth,
        dobDay: dobParts[1] || prev.dobDay
      }));
    }
  }, [matchedSalonClientInPOS]);


  // نافذة استعلام أسعار الخدمات (معاينة فقط دون إضافة للفاتورة)
  const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);
  const [priceCheckSearch, setPriceCheckSearch] = useState('');
  const [priceCheckCategory, setPriceCheckCategory] = useState('all');
  const [priceCheckType, setPriceCheckType] = useState<'service' | 'product' | 'all'>('service');
  const priceCheckInputRef = useRef<HTMLInputElement>(null);
  const itemsGridRef = useRef<HTMLDivElement>(null);

  // نافذة تفضيلات العميل (الحلاقة والضيافة)
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [prefForm, setPrefForm] = useState<ClientPreferences>({
    shavingMethod: 'machine',
    sugarLevel: 'one_spoon',
    waterTemperature: 'cold'
  });
  const [savePrefSuccess, setSavePrefSuccess] = useState(false);

  // Core Cart & Pricing State
  const [discount, setDiscount] = useState<{type: 'percentage'|'fixed', value: number}>({ type: 'fixed', value: 0 });
  const [advanceDeduction, setAdvanceDeduction] = useState(0);
  const [activeAdvancePayments, setActiveAdvancePayments] = useState<AdvancePayment[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>(undefined);
  const [activeQueueNumber, setActiveQueueNumber] = useState<number | null>(null);

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
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Payment & Receipt Modals State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'single' | 'split'>('single');
  const [singleTreasury, setSingleTreasury] = useState(settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || '');
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [mobilePrintNotice, setMobilePrintNotice] = useState<string | null>(null);

  // Deferred & Partial Payment State (الفواتير الآجلة والسداد الجزئي)
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | 'deferred'>('full');
  const [partialPaidAmount, setPartialPaidAmount] = useState<number | ''>('');
  const [deferredDueDate, setDeferredDueDate] = useState<string>('');
  const [deferredNotes, setDeferredNotes] = useState<string>('');

  // Before & After Photos for Invoice (Max 500 KB)
  const [beforePhotoUrl, setBeforePhotoUrl] = useState('');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState('');

  // Remedy / Warranty Fix on Salon Expense (0.00 SAR)
  const [isRemedyInvoice, setIsRemedyInvoice] = useState(false);
  const [remedyReason, setRemedyReason] = useState('إصلاح مجاني بناءً على ضمان الصالون');

  // Wasel / Complimentary Free Services (0.00 SAR)
  const [isWaselInvoice, setIsWaselInvoice] = useState(false);
  const [waselReason, setWaselReason] = useState('');
  const [waselRecipientName, setWaselRecipientName] = useState('');
  const [showWaselModal, setShowWaselModal] = useState(false);

  // Fast Quick Expense Modal State (تسجيل مصروف سريع من نقطة البيع)
  const [showQuickExpenseModal, setShowQuickExpenseModal] = useState(false);
  const [quickExpenseAmount, setQuickExpenseAmount] = useState<number | ''>('');
  const [quickExpenseCategory, setQuickExpenseCategory] = useState<string>('');
  const [quickExpenseDescription, setQuickExpenseDescription] = useState<string>('');
  const [quickExpenseTreasury, setQuickExpenseTreasury] = useState<string>('');
  const [quickExpenseDate, setQuickExpenseDate] = useState<string>('');
  const [quickExpensePrint, setQuickExpensePrint] = useState<boolean>(true);
  const [quickExpenseError, setQuickExpenseError] = useState<string>('');
  const [isSubmittingQuickExpense, setIsSubmittingQuickExpense] = useState<boolean>(false);

  const availableExpenseCategories = useMemo(() => {
    const list = settings.expenseCategories && settings.expenseCategories.length > 0
      ? settings.expenseCategories
      : ['نثريات وضيافة', 'مشتريات وبوفيه', 'صيانة ومعدات', 'أدوات ومستهلكات', 'إيجار وفواتير', 'رواتب ومكافآت', 'أخرى'];
    return Array.from(new Set(list));
  }, [settings.expenseCategories]);

  const availableExpenseTreasuries = useMemo(() => {
    if (settings.treasuries && settings.treasuries.length > 0) {
      return settings.treasuries;
    }
    return [
      { id: 'cash', name: 'درج الكاش (الخزينة النقدية)', isMain: false },
      { id: 'main', name: 'الخزينة الرئيسية', isMain: true }
    ];
  }, [settings.treasuries]);

  const handleOpenQuickExpenseModal = () => {
    const initialDay = shiftData?.isOpen && shiftData.date 
      ? shiftData.date 
      : (shiftDate || new Date().toISOString().split('T')[0]);
    const defaultTreasury = settings.treasuries?.find(t => !t.isMain)?.id 
      || settings.treasuries?.[0]?.id 
      || 'cash';
    
    setQuickExpenseAmount('');
    setQuickExpenseDescription('');
    setQuickExpenseCategory(availableExpenseCategories[0] || 'نثريات وضيافة');
    setQuickExpenseTreasury(defaultTreasury);
    setQuickExpenseDate(initialDay);
    setQuickExpensePrint(true);
    setQuickExpenseError('');
    setShowQuickExpenseModal(true);
  };

  const handleSaveQuickExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amt = Number(quickExpenseAmount);
    if (isNaN(amt) || amt <= 0) {
      setQuickExpenseError('الرجاء إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    if (!quickExpenseDescription.trim()) {
      setQuickExpenseError('الرجاء إدخال بيان وتفاصيل المصروف');
      return;
    }
    if (!quickExpenseCategory) {
      setQuickExpenseError('الرجاء اختيار بند المصروف');
      return;
    }
    if (!quickExpenseTreasury) {
      setQuickExpenseError('الرجاء اختيار الخزينة المسحوب منها');
      return;
    }

    setIsSubmittingQuickExpense(true);
    setQuickExpenseError('');

    try {
      const nowIso = new Date().toISOString();
      const effectiveDay = quickExpenseDate || (shiftData?.isOpen && shiftData.date ? shiftData.date : nowIso.split('T')[0]);
      const tTime = nowIso.split('T')[1] || '12:00:00.000Z';
      const tDate = effectiveDay + 'T' + tTime;
      const isMatchingCurrentShift = Boolean(shiftData?.isOpen && shiftData.date === effectiveDay);
      const assignedShiftDate = isMatchingCurrentShift ? shiftData.date : effectiveDay;
      const assignedShiftId = isMatchingCurrentShift ? ((shiftData as any)?.shiftId || (shiftData as any)?.id) : undefined;
      const assignedShiftCode = isMatchingCurrentShift ? (shiftData as any)?.shiftCode : undefined;

      const newTrx: Transaction = {
        id: 'EXP-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        salonId: settings.salonId,
        branchId: activeBranchId,
        branchCode: branches?.find(b => b.id === activeBranchId)?.code,
        date: tDate,
        createdAt: nowIso,
        type: 'out',
        amount: amt,
        category: 'expense',
        expenseCategory: quickExpenseCategory,
        description: quickExpenseDescription.trim(),
        treasury: quickExpenseTreasury,
        treasuryId: quickExpenseTreasury,
        shiftDate: assignedShiftDate,
        shiftId: assignedShiftId,
        shiftCode: assignedShiftCode,
        createdBy: currentUser?.username || currentUser?.name,
        createdByName: currentUser?.name || currentUser?.username,
        createdById: currentUser?.id
      } as any;

      // حفظ المصروف في قاعدة البيانات
      await DB.saveTransaction(newTrx, settings.salonId);

      // تحديث مصفوفة المعاملات محلياً
      if (setTransactions) {
        setTransactions((prev: any) => [newTrx, ...(prev || [])]);
      }

      // طباعة إيصال الصرف الحراري عند تفعيل خيار الطباعة
      if (quickExpensePrint) {
        const treasuryName = availableExpenseTreasuries.find(t => t.id === quickExpenseTreasury)?.name || quickExpenseTreasury;
        const expDateStr = tDate.includes('T') ? tDate.replace('T', ' ').substring(0, 19) : tDate;
        try {
          printThermalFinancialVoucher(settings, {
            voucherType: 'expense',
            voucherNumber: newTrx.id,
            date: expDateStr,
            expenseCategory: quickExpenseCategory,
            amount: amt,
            treasuryName: treasuryName,
            note: quickExpenseDescription.trim(),
            issuedBy: currentUser?.name || currentUser?.username || 'الكاشير',
            shiftDate: assignedShiftDate
          });
        } catch (printErr) {
          console.warn('Thermal expense voucher print error:', printErr);
        }
      }

      setShowQuickExpenseModal(false);
      setQuickExpenseAmount('');
      setQuickExpenseDescription('');
    } catch (err: any) {
      console.error('Error saving quick expense:', err);
      setQuickExpenseError('حدث خطأ أثناء حفظ المصروف: ' + (err?.message || err));
    } finally {
      setIsSubmittingQuickExpense(false);
    }
  };

  // Fast Attendance & Timesheet Modal State
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Fast Shift Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleEffectiveDate, setScheduleEffectiveDate] = useState(effectiveIsShiftOpen ? effectiveShiftDate : new Date().toISOString().split('T')[0]);
  const [employeeSchedules, setEmployeeSchedules] = useState<Record<string, { checkIn: string, checkOut: string }>>({});
  const [bulkCheckIn, setBulkCheckIn] = useState('09:00');
  const [bulkCheckOut, setBulkCheckOut] = useState('18:00');

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
  const [activeHeldInvoiceId, setActiveHeldInvoiceId] = useState<string | null>(null);

  const handleOpenPreferencesModal = () => {
    if (!selectedClient) return;
    setPrefForm(selectedClient.preferences || {
      shavingMethod: 'machine',
      sugarLevel: 'one_spoon',
      waterTemperature: 'cold'
    });
    setSavePrefSuccess(false);
    setShowPreferencesModal(true);
  };

  const handleSavePreferencesInPOS = async () => {
    if (!selectedClient) return;

    const updatedClient: Client = {
      ...selectedClient,
      preferences: prefForm
    };

    setSelectedClient(updatedClient);
    if (setClients) {
      setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
    }

    try {
      await DB.saveClient(updatedClient);
      const saved = localStorage.getItem('smartcut_clients');
      if (saved) {
        const list: Client[] = JSON.parse(saved);
        const updatedList = list.map(c => c.id === updatedClient.id ? updatedClient : c);
        localStorage.setItem('smartcut_clients', JSON.stringify(updatedList));
      }
    } catch (e) {
      console.warn('Failed to save client preferences from POS:', e);
    }

    setSavePrefSuccess(true);
    setTimeout(() => {
      setSavePrefSuccess(false);
      setShowPreferencesModal(false);
    }, 900);
  };

  // العميل المرشِّح المستنتج من رقم الهاتف المدخل في نافذة إضافة عميل جديد
  const referrerClientInModal = useMemo(() => {
    const rawRef = (newClientForm.referredByPhone || '').trim();
    if (!rawRef) return null;
    const digitsRef = rawRef.replace(/\D/g, '');
    if (digitsRef.length < 3) return null;

    return (clients || []).find(c => {
      const p = (c.phone || '').replace(/\D/g, '');
      if (!p) return false;
      if (p === digitsRef) return true;
      if (digitsRef.length >= 7 && (p.endsWith(digitsRef) || digitsRef.endsWith(p))) return true;
      return false;
    }) || null;
  }, [newClientForm.referredByPhone, clients]);

  // تصفية عملاء الصالون الحالي فقط (بما يشمل كافة فروعه دون أي صالونات أخرى)
  const currentSalonId = settings?.salonId;
  const currentSalonClients = useMemo(() => {
    return (clients || []).filter(c => !c.salonId || !currentSalonId || c.salonId === currentSalonId);
  }, [clients, currentSalonId]);

  // قائمة الاقتراحات والإكمال التلقائي لأرقام وأسماء العملاء مع كتابة كل رقم
  const phoneSuggestions = useMemo(() => {
    const rawQuery = clientSearch.trim();
    if (!rawQuery) return [];

    const digitsQuery = rawQuery.replace(/\D/g, '');
    const textQuery = rawQuery.toLowerCase();

    return currentSalonClients.filter(client => {
      const phoneDigits = (client.phone || '').replace(/\D/g, '');
      // البحث ببادئة الرقم (مثال: كتابة 0 تظهر كل ما يبدأ بـ 0، ثم 01 تظهر ما يبدأ بـ 01 وهكذا)
      const isPrefixMatch = digitsQuery.length > 0 && phoneDigits.startsWith(digitsQuery);
      // أو احتواء الرقم
      const isPhoneContains = digitsQuery.length >= 2 && phoneDigits.includes(digitsQuery);
      // أو البحث بالاسم
      const isNameMatch = client.name && client.name.toLowerCase().includes(textQuery);

      return isPrefixMatch || isPhoneContains || isNameMatch;
    }).sort((a, b) => {
      const phoneA = (a.phone || '').replace(/\D/g, '');
      const phoneB = (b.phone || '').replace(/\D/g, '');
      if (digitsQuery.length > 0) {
        const aStarts = phoneA.startsWith(digitsQuery);
        const bStarts = phoneB.startsWith(digitsQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
      }
      return (a.name || '').localeCompare(b.name || '', 'ar');
    }).slice(0, 10);
  }, [clientSearch, currentSalonClients]);

  // إغلاق قائمة الاقتراحات عند النقر خارج حقل البحث
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // التركيز التلقائي وإغلاق نافذة استعلام الأسعار بزر Esc
  useEffect(() => {
    if (showPriceCheckModal) {
      const timer = setTimeout(() => {
        priceCheckInputRef.current?.focus();
      }, 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowPriceCheckModal(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showPriceCheckModal]);

  // إغلاق نافذة إيصال الفاتورة بزر Esc وبدء فاتورة جديدة فوراً
  useEffect(() => {
    if (showReceiptModal) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCloseReceiptModal();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showReceiptModal]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setClientSearch('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  // Permissions
  const canApplyDiscount = AuthService.canDo('pos_discount', currentUser);
  const canEditItemPrice = AuthService.canDo('pos_custom_price', currentUser);
  const canVoidCart = AuthService.canDo('pos_void', currentUser);
  const canViewClientFinancials = AuthService.canDo('view_reports', currentUser) || currentUser?.role === 'admin' || currentUser?.role === 'owner' || currentUser?.role === 'supervisor' || currentUser?.role === 'programmer';



  useEffect(() => {
    try {
      localStorage.setItem('smartcut_held_invoices', JSON.stringify(heldInvoices));
    } catch (e) {
      console.warn('Failed to persist held invoices:', e);
    }
  }, [heldInvoices]);

  // مزامنة لحظية للفواتير المعلقة مع السحابة وقاعدة البيانات عبر الشبكة المحلية (LAN SSE)
  useEffect(() => {
    let isMounted = true;
    let lastKnownCount = -1;

    const playHeldChime = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch {}
    };

    const fetchHeld = async () => {
      try {
        const cloudHeld = await DB.fetchHeldInvoices(settings.salonId);
        if (isMounted && Array.isArray(cloudHeld)) {
          setHeldInvoices(cloudHeld);
          try {
            localStorage.setItem('smartcut_held_invoices', JSON.stringify(cloudHeld));
          } catch {}
          if (lastKnownCount >= 0 && cloudHeld.length > lastKnownCount) {
            playHeldChime();
          }
          lastKnownCount = cloudHeld.length;
        }
      } catch (err) {
        console.warn('Held invoices sync error:', err);
      }
    };

    fetchHeld();

    // 1. استماع لحظي عبر WebSockets للشبكة المحلية (LAN) بين جميع الأجهزة المتصلة
    const unsubHeld = RealtimeSync.subscribe(['held_invoices'], (event) => {
      if (event.action === 'delete') {
        const deletedId = event.id || event.filters?.id || event.data?.id;
        const deletedIds: string[] = (event as any).ids || (deletedId ? [deletedId] : []);
        if (deletedIds.length > 0) {
          setHeldInvoices(prev => {
            const next = prev.filter(h => !deletedIds.includes(h.id) && (!h.queueTicketId || !deletedIds.includes(h.queueTicketId)));
            try {
              localStorage.setItem('smartcut_held_invoices', JSON.stringify(next));
            } catch {}
            return next;
          });
        }
        if (deletedId && (activeBookingId === deletedId || initialHeldInvoice?.id === deletedId || activeHeldInvoiceId === deletedId)) {
          alert('تنبيه: تم سداد أو إلغاء هذه الفاتورة المعلقة للتو من جهاز كاشير آخر لتفادي تكرار المحاسبة.');
          clearBooking();
        }
      }
      fetchHeld();
    });

    // 2. استماع لحظي عبر BroadcastChannel بين التبويبات لنفس المتصفح
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel(`smartcut_held_${settings.salonId || 'default'}`);
      bc.onmessage = (event) => {
        if (event.data?.type === 'HELD_INVOICES_UPDATED') {
          fetchHeld();
        }
      };
    }

    // فحص دوري كل 5 ثوانٍ كشبكة أمان
    const interval = setInterval(fetchHeld, 5000);

    return () => {
      isMounted = false;
      unsubHeld();
      clearInterval(interval);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, [settings.salonId, activeBookingId, initialHeldInvoice]);

  const handleOpenScheduleModal = () => {
    const initialMap: Record<string, { checkIn: string, checkOut: string }> = {};
    employees.forEach(emp => {
      initialMap[emp.id] = {
        checkIn: emp.checkInTime || '09:00',
        checkOut: emp.checkOutTime || '18:00'
      };
    });
    setEmployeeSchedules(initialMap);
    setScheduleEffectiveDate(effectiveIsShiftOpen ? effectiveShiftDate : new Date().toISOString().split('T')[0]);
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
    alert(`تم تحديث وتوثيق مواعيد دوام الموظفين بنجاح وسريانها من تاريخ ${scheduleEffectiveDate}`);
  };



  // تعليق الفاتورة الحالية يدوياً (Hold Current Bill)
  const handleHoldCurrentInvoice = () => {
    if (cart.length === 0) {
      alert('لا توجد عناصر في الفاتورة الحالية لتعليقها.');
      return;
    }
    const heldId = activeHeldInvoiceId || ('HOLD-' + Math.random().toString(36).substr(2, 6).toUpperCase());
    const newHeld: HeldInvoice = {
      id: heldId,
      salonId: settings.salonId,
      heldAt: new Date().toISOString(),
      timeStr: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      client: selectedClient,
      clientSearch,
      cart: cart.map(normalizeCartItem),
      discount,
      advanceDeduction: Number(advanceDeduction) || 0,
      advancePayments: activeAdvancePayments,
      bookingId: activeBookingId,
      isRemedyInvoice,
      remedyReason,
      isWaselInvoice,
      waselReason,
      waselRecipientName,
      beforePhotoUrl,
      afterPhotoUrl,
      queueNumber: activeQueueNumber || undefined,
      isOpen: false,
      openedBy: undefined
    };
    setHeldInvoices(prev => [newHeld, ...prev.filter(h => h.id !== heldId)]);
    DB.saveHeldInvoice(newHeld).catch(e => console.warn('Failed to save held invoice:', e));
    // تفريغ الفاتورة النشطة
    setCart([]);
    setSelectedClient(null);
    setClientSearch('');
    setDiscount({ type: 'fixed', value: 0 });
    setAdvanceDeduction(0);
    setActiveAdvancePayments([]);
    setActiveBookingId(undefined);
    setActiveQueueNumber(null);
    setIsRemedyInvoice(false);
    setIsWaselInvoice(false);
    setWaselReason('');
    setWaselRecipientName('');
    setBeforePhotoUrl('');
    setAfterPhotoUrl('');
    setActiveHeldInvoiceId(null);
    try {
      localStorage.removeItem('smartcut_pos_active_draft');
    } catch {}
    if (onClearInitial) onClearInitial();
  };

  // إعادة ضبط شاشة نقطة البيع وبدء فاتورة جديدة فوراً مع تحميل جميع الخدمات دون أي تأخير
  const resetToNewInvoice = (options?: { holdCurrentCart?: boolean }) => {
    // 1. إذا طلب تعليق الفاتورة الحالية وكانت السلة تحتوي عناصر (ولا نكون في وضع تعديل فاتورة قائمة)
    if (options?.holdCurrentCart && cart.length > 0 && !editingInvoice) {
      const heldId = activeHeldInvoiceId || ('HOLD-' + Math.random().toString(36).substr(2, 6).toUpperCase());
      const newHeld: HeldInvoice = {
        id: heldId,
        salonId: settings.salonId,
        heldAt: new Date().toISOString(),
        timeStr: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        client: selectedClient,
        clientSearch,
        cart: cart.map(normalizeCartItem),
        discount,
        advanceDeduction: Number(advanceDeduction) || 0,
        advancePayments: activeAdvancePayments,
        bookingId: activeBookingId,
        isRemedyInvoice,
        remedyReason,
        isWaselInvoice,
        waselReason,
        waselRecipientName,
        beforePhotoUrl,
        afterPhotoUrl,
        queueNumber: activeQueueNumber || undefined,
        isOpen: false,
        openedBy: undefined
      };
      setHeldInvoices(prev => [newHeld, ...prev.filter(h => h.id !== heldId)]);
      // حفظ في الخلفية دون تعطيل الواجهة أو إيقاف استجابتها
      setTimeout(() => {
        DB.saveHeldInvoice(newHeld).catch(e => console.warn('Failed to save held invoice:', e));
      }, 0);
    }

    // 2. تصفير فوري لجميع حقول الفاتورة والعميل والسلة وإنهاء وضع التعديل
    setCart([]);
    setSelectedClient(null);
    setClientSearch('');
    setDiscount({ type: 'fixed', value: 0 });
    setAdvanceDeduction(0);
    setActiveAdvancePayments([]);
    setActiveBookingId(undefined);
    setActiveQueueNumber(null);
    setIsRemedyInvoice(false);
    setIsWaselInvoice(false);
    setWaselReason('');
    setWaselRecipientName('');
    setBeforePhotoUrl('');
    setAfterPhotoUrl('');
    setActiveHeldInvoiceId(null);
    setEditingInvoice(null);
    setSplitAmounts({});
    setAppliedPromo(null);
    setPromoDiscountAmount(0);
    setPromoError(null);
    setShowReceiptModal(false);
    setCompletedInvoice(null);
    setShowPaymentModal(false);

    // 3. إعادة ضبط فلاتر الخدمات فوراً على (الخدمات + الكل + بدون بحث) لنزول كافة الخدمات لحظياً
    setItemTypeFilter('service');
    setSelectedCategory('all');
    setSearchQuery('');

    // 4. حذف المسودة المؤقتة فوراً
    try {
      localStorage.removeItem('smartcut_pos_active_draft');
    } catch {}

    if (onClearInitial) {
      onClearInitial();
    }

    // 5. التمرير للأعلى فوراً في شبكة الخدمات
    if (itemsGridRef.current) {
      itemsGridRef.current.scrollTop = 0;
    }
  };

  // بدء فاتورة جديدة (New Invoice) مع تعليق الفاتورة السابقة إن وجدت
  const handleNewInvoice = () => {
    resetToNewInvoice({ holdCurrentCart: true });
  };

  // استكمال الفاتورة المعلقة (Resume Held Bill)
  const handleResumeHeldInvoice = (held: HeldInvoice) => {
    if (cart.length > 0 && activeHeldInvoiceId !== held.id) {
      // تعليق الفاتورة الحالية أولاً وحفظها في قاعدة البيانات
      const curHeldId = activeHeldInvoiceId || ('HOLD-' + Math.random().toString(36).substr(2, 6).toUpperCase());
      const activeAsHeld: HeldInvoice = {
        id: curHeldId,
        salonId: settings.salonId,
        heldAt: new Date().toISOString(),
        timeStr: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        client: selectedClient,
        clientSearch,
        cart: cart.map(normalizeCartItem),
        discount,
        advanceDeduction: Number(advanceDeduction) || 0,
        advancePayments: activeAdvancePayments,
        bookingId: activeBookingId,
        isRemedyInvoice,
        remedyReason,
        isWaselInvoice,
        waselReason,
        waselRecipientName,
        beforePhotoUrl,
        afterPhotoUrl,
        queueNumber: activeQueueNumber || undefined,
        isOpen: false,
        openedBy: undefined
      };
      setHeldInvoices(prev => [activeAsHeld, ...prev.filter(h => h.id !== curHeldId && h.id !== held.id)]);
      DB.saveHeldInvoice(activeAsHeld).catch(e => console.warn('Failed to save held invoice:', e));
    }

    // تعيين الفاتورة كنشطة دون حذفها من قاعدة البيانات
    setActiveHeldInvoiceId(held.id);
    const updatedHeld: HeldInvoice = {
      ...held,
      isOpen: true,
      openedBy: currentUser?.name || 'الكاشير'
    };
    setHeldInvoices(prev => prev.map(h => h.id === held.id ? updatedHeld : h));
    DB.saveHeldInvoice(updatedHeld).catch(e => console.warn('Failed to update held invoice status:', e));

    const normalizedCart = (held.cart || []).map(normalizeCartItem);
    setCart(normalizedCart);
    setSelectedClient(held.client || null);
    setClientSearch(held.clientSearch || (held.client ? held.client.name : ''));
    setDiscount(held.discount || { type: 'fixed', value: 0 });
    setAdvanceDeduction(Number(held.advanceDeduction) || 0);
    setActiveAdvancePayments(held.advancePayments || []);
    setActiveBookingId(held.bookingId || undefined);
    if (held.queueNumber) setActiveQueueNumber(held.queueNumber);
    setIsRemedyInvoice(held.isRemedyInvoice || false);
    setRemedyReason(held.remedyReason || '');
    setIsWaselInvoice(held.isWaselInvoice || false);
    setWaselReason(held.waselReason || '');
    setWaselRecipientName(held.waselRecipientName || '');
    setBeforePhotoUrl(held.beforePhotoUrl || '');
    setAfterPhotoUrl(held.afterPhotoUrl || '');
    setShowHeldInvoicesModal(false);
  };

  // حذف / إلغاء فاتورة معلقة
  const handleDeleteHeldInvoice = (heldId: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف / إلغاء هذه الفاتورة المعلقة؟')) {
      setHeldInvoices(prev => {
        const next = prev.filter(h => h.id !== heldId);
        try {
          localStorage.setItem('smartcut_held_invoices', JSON.stringify(next));
        } catch {}
        return next;
      });
      DB.removeHeldInvoice(heldId).catch(e => console.warn('Failed to remove held invoice:', e));
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

  const clientTierProgression = useMemo(() => {
    if (!selectedClient || !clientTier) return null;
    return getNextClientTier(clientTier, clientTotalSpend, settings.tierSettings);
  }, [selectedClient, clientTier, clientTotalSpend, settings.tierSettings]);

  // Automatically apply Tier discount when client is identified, or reset unearned discount
  useEffect(() => {
    if (!appliedPromo) {
      if (selectedClient) {
        const tier = getClientTier(selectedClient, invoices, settings.tierSettings);
        if (tier && tier.discountPercentage > 0) {
          setDiscount({ type: 'percentage', value: tier.discountPercentage });
        } else {
          // Reset automatic percentage discount if current client's tier has 0% discount
          setDiscount(prev => (prev.type === 'percentage' ? { type: 'fixed', value: 0 } : prev));
        }
      } else {
        // Reset automatic percentage discount when client is cleared
        setDiscount(prev => (prev.type === 'percentage' ? { type: 'fixed', value: 0 } : prev));
      }
    }
  }, [selectedClient, invoices, settings.tierSettings, appliedPromo]);

  // Handle Apply Promo Code
  const handleApplyPromoCode = () => {
    setPromoError(null);
    const clean = promoCodeInput.trim().toUpperCase();
    if (!clean) return;

    // يجب اختيار عميل قبل تطبيق كود الخصم للتحقق من الاستخدام المسبق
    if (!selectedClient) {
      setPromoError('يرجى اختيار العميل أولاً قبل تطبيق كود الخصم');
      return;
    }

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

    // التحقق من أن العميل لم يستخدم هذا الكود من قبل (بالـ clientId أولاً، ثم بالهاتف كاحتياط)
    const alreadyUsedById = promoCodeUsages?.some(u =>
      u.promoCodeId === found.id && u.clientId === selectedClient.id
    );
    const alreadyUsedByPhone = !alreadyUsedById && selectedClient.phone
      ? promoCodeUsages?.some(u =>
          u.code?.toUpperCase() === clean &&
          u.clientPhone?.replace(/\D/g, '') === selectedClient.phone?.replace(/\D/g, '')
        )
      : false;

    if (alreadyUsedById || alreadyUsedByPhone) {
      setPromoError('كود مستخدم من قبل');
      return;
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
    // إلغاء أي خصم يدوي مسبق نهائياً عند استخدام برومو كود
    setDiscount({ type: 'fixed', value: 0 });
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscountAmount(0);
    setPromoError(null);
    if (selectedClient) {
      const tier = getClientTier(selectedClient, invoices, settings.tierSettings);
      if (tier && tier.discountPercentage > 0) {
        setDiscount({ type: 'percentage', value: tier.discountPercentage });
      } else {
        setDiscount({ type: 'fixed', value: 0 });
      }
    } else {
      setDiscount({ type: 'fixed', value: 0 });
    }
  };

  // In-cart custom price update
  const handleSaveCustomPrice = (cartId: string) => {
    if (customPriceInput === '' || Number(customPriceInput) < 0) {
      setEditingCartId(null);
      return;
    }
    const newPrice = Number(customPriceInput);
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        return {
          ...c,
          price: newPrice,
          item: {
            ...c.item,
            price: newPrice,
            displayPrice: newPrice
          }
        };
      }
      return c;
    }));
    setEditingCartId(null);
  };



  const hasLineDiscounts = cart.some(c => (Number(c.discount || c.item?.discount) || 0) > 0);
  const hasOverallDiscount = !hasLineDiscounts && (Number(discount.value) || 0) > 0;

  const subtotal = cart.reduce((sum, c) => sum + (getCartItemPrice(c) * (Number(c.quantity) || 1)), 0);
  const manualDiscountAmount = (appliedPromo || hasLineDiscounts)
    ? 0 
    : (discount.type === 'percentage' ? subtotal * ((Number(discount.value) || 0) / 100) : (Number(discount.value) || 0));
  const discountAmount = manualDiscountAmount + promoDiscountAmount;
  const totalInclusive = Math.max(0, subtotal - discountAmount);
  const baseTotal = settings.vatEnabled ? totalInclusive / (1 + settings.vatRate / 100) : totalInclusive;
  const vatAmount = settings.vatEnabled ? totalInclusive - baseTotal : 0;
  const totalBeforeAdvance = totalInclusive;
  const rawFinalTotal = Math.max(0, totalBeforeAdvance - (Number(advanceDeduction) || 0));
  const finalTotal = (isRemedyInvoice || isWaselInvoice) ? 0 : rawFinalTotal;

  // Tips & Change Calculation
  const isCashPayment = singleTreasury === 'cash' || singleTreasury.includes('cash');
  const receivedNum = Number(receivedAmount) || 0;
  const changeDue = isCashPayment && receivedNum > finalTotal ? receivedNum - finalTotal : 0;
  const calculatedTip = !isCashPayment && receivedNum > finalTotal ? receivedNum - finalTotal : 0;

  const handleInvoicePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ضغط صورة العميل قبل / بعد بجودة واضحة وحجم فائق الصغر (30-65 KB)
    const compressed = await compressClientBeforeAfterPhoto(file);
    if (compressed.error) {
      alert(compressed.error);
      return;
    }

    const branchIdToUse = activeBranchId || settings.branchId;
    const invTempId = 'pos_' + (selectedClient?.id || Math.random().toString(36).substr(2, 7));
    const oldUrl = type === 'before' ? beforePhotoUrl : afterPhotoUrl;

    const uploadRes = await DB.uploadClientPhoto(
      compressed.blob,
      invTempId,
      type,
      settings.salonId,
      branchIdToUse,
      oldUrl
    );

    if (uploadRes.error) {
      alert(uploadRes.error);
      return;
    }

    if (uploadRes.url) {
      if (type === 'before') {
        setBeforePhotoUrl(uploadRes.url);
      } else {
        setAfterPhotoUrl(uploadRes.url);
      }
    }
  };

  const handleConfirmPayment = async (shouldPrint: boolean = false) => {
    if (isSubmittingPayment) return;
    if (isSubscriptionBlocked) {
      alert('الحساب موقوف أو انتهت فترة الاشتراك. النظام يعمل الآن بوضع الاطلاع فقط (Read-Only) ولا يمكن إنشاء أو سداد فواتير جديدة.');
      return;
    }

    // فحص وقائي فوري لمنع سداد نفس الحجز أكثر من مرة
    const targetBookingId = activeBookingId || initialBooking?.id;
    if (targetBookingId) {
      const alreadyPaid = invoices.some(inv => inv.bookingId === targetBookingId);
      if (alreadyPaid) {
        alert('تنبيه: تم سداد هذا الحجز بالفعل عبر فاتورة أخرى لتفادي ازدواجية المحاسبة.');
        setShowPaymentModal(false);
        clearBooking();
        return;
      }
    }

    setIsSubmittingPayment(true);
    try {
      if (isWaselInvoice) {
        if (!waselRecipientName.trim()) {
          alert('يرجى كتابة اسم الشخص الذي حصل على خدمات مجانية (واصل)');
          setShowWaselModal(true);
          setIsSubmittingPayment(false);
          return;
        }
        if (!waselReason.trim()) {
          alert('يرجى كتابة ملاحظة وسبب تقديم الفاتورة مجاناً (واصل)');
          setShowWaselModal(true);
          setIsSubmittingPayment(false);
          return;
        }
      }

      let splits: { amount: number, treasuryId: string }[] = [];
      const cashbackUsed = (isRemedyInvoice || isWaselInvoice) ? 0 : (splitAmounts['cashback'] || 0);
      const remainingTotal = finalTotal - cashbackUsed;
    
    // التحقق من متطلبات الفاتورة الآجلة أو السداد الجزئي
    if (paymentMode === 'deferred' || paymentMode === 'partial') {
      const clientName = selectedClient ? selectedClient.name : clientSearch?.trim();
      if (!clientName || clientName === 'عميل نقدي') {
        alert('تنبيه: الفواتير الآجلة والسداد الجزئي يتطلبان تحديد اسم العميل لمتابعة الذمة والمطالبات بدقة.');
        setIsSubmittingPayment(false);
        return;
      }
    }

    let actualPaid = finalTotal;
    let actualRemaining = 0;
    let invoiceStatus: Invoice['status'] = 'completed';

    if (paymentMode === 'deferred') {
      actualPaid = 0;
      actualRemaining = finalTotal;
      invoiceStatus = 'deferred';
      splits = [];
    } else if (paymentMode === 'partial') {
      const partialVal = Number(partialPaidAmount) || 0;
      if (partialVal <= 0 || partialVal >= finalTotal) {
        alert('المبلغ المسدد جزئياً يجب أن يكون أكبر من صفر وأقل من إجمالي الفاتورة!');
        setIsSubmittingPayment(false);
        return;
      }
      if (!singleTreasury) {
        alert('الرجاء اختيار طريقة وخزينة دفع الجزء المسدد حالياً');
        setIsSubmittingPayment(false);
        return;
      }
      actualPaid = partialVal;
      actualRemaining = Math.max(0, finalTotal - partialVal);
      invoiceStatus = 'partially_paid';
      splits = [{ amount: partialVal, treasuryId: singleTreasury }];
    } else if (isRemedyInvoice) {
      splits = [{ amount: 0, treasuryId: 'remedy_free' }];
    } else if (isWaselInvoice) {
      splits = [{ amount: 0, treasuryId: 'wasel_free' }];
    } else if (paymentType === 'single') {
      if (remainingTotal > 0 && !singleTreasury) {
        alert('الرجاء اختيار طريقة الدفع'); 
        setIsSubmittingPayment(false);
        return;
      }
      // If non-cash and has tip, the card terminal was charged with (remainingTotal + calculatedTip)
      const actualTreasuryCharged = remainingTotal + (!isCashPayment && calculatedTip > 0 ? calculatedTip : 0);
      if (actualTreasuryCharged > 0) splits.push({ amount: actualTreasuryCharged, treasuryId: singleTreasury });
      if (cashbackUsed > 0) splits.push({ amount: cashbackUsed, treasuryId: 'cashback' });
    } else {
      const totalSplit = Object.values(splitAmounts).reduce((a: number, b) => a + (Number(b) || 0), 0) as number;
      if (totalSplit < finalTotal) {
        alert('مجموع المبالغ الموزعة يجب أن يساوي أو يزيد عن المطلوب سداده!'); 
        setIsSubmittingPayment(false);
        return;
      }
      splits = Object.entries(splitAmounts).filter(([_, amt]) => Number(amt) > 0).map(([tId, amt]) => ({ amount: Number(amt), treasuryId: tId }));
    }

    const isUnspecifiedTip = tipEmployeeId === 'unspecified';
    const assignedTipEmployee = isUnspecifiedTip
      ? { id: 'unspecified', name: 'غير محدد (عامة للصالون)' }
      : (employees.find(e => e.id === tipEmployeeId) || employees.find(e => e.id === cart[0]?.employeeId) || { id: 'unspecified', name: 'غير محدد (عامة للصالون)' });
    const tipPayoutMode = settings.tipPayoutMethod || 'instant_cash';

    const finalInvoiceId = editingInvoice ? editingInvoice.id : ('INV-' + Math.random().toString(36).substr(2,9).toUpperCase());
    const finalInvoiceDate = editingInvoice ? editingInvoice.date : (effectiveIsShiftOpen ? (effectiveShiftDate + 'T' + new Date().toTimeString().split(' ')[0]) : new Date().toISOString());

    const initialInv: Invoice = {
      id: finalInvoiceId,
      salonId: settings.salonId,
      branchId: activeBranchId || (branches?.find(b => b.isMain)?.id) || settings.branchId,
      branchCode: (branches?.find(b => b.id === (activeBranchId || settings.branchId))?.code),
      cashierId: currentUser?.id || currentUser?.username || undefined,
      cashierName: currentUser?.name || currentUser?.username || undefined,
      createdBy: editingInvoice?.createdBy || currentUser?.username || currentUser?.name || undefined,
      createdById: editingInvoice?.createdById || currentUser?.id || undefined,
      updatedBy: currentUser?.username || currentUser?.name || undefined,
      updatedByName: currentUser?.name || currentUser?.username || undefined,
      updatedById: currentUser?.id || undefined,
      updatedAt: new Date().toISOString(),
      date: finalInvoiceDate,
      clientName: isWaselInvoice && waselRecipientName.trim()
        ? (selectedClient ? `${selectedClient.name} (${waselRecipientName.trim()})` : waselRecipientName.trim())
        : (selectedClient ? selectedClient.name : (clientSearch || 'عميل نقدي')),
      clientId: selectedClient ? selectedClient.id : undefined,
      clientPhone: selectedClient ? selectedClient.phone : undefined,
      subtotal: subtotal,
      vatAmount: vatAmount,
      total: finalTotal, // net paid (0 if remedy or wasel)
      paid: actualPaid,
      remaining: actualRemaining,
      dueDate: (paymentMode === 'deferred' || paymentMode === 'partial') ? (deferredDueDate || undefined) : undefined,
      notes: isWaselInvoice
        ? `[فاتورة واصل - المستفيد: ${waselRecipientName.trim()} - السبب: ${waselReason.trim()}]${deferredNotes ? ' - ' + deferredNotes : ''}`
        : ((paymentMode === 'deferred' || paymentMode === 'partial') ? (deferredNotes || undefined) : undefined),
      paymentsHistory: paymentMode === 'partial' ? [{
        id: 'PMT-' + Date.now(),
        date: effectiveIsShiftOpen ? (effectiveShiftDate + 'T' + new Date().toTimeString().split(' ')[0]) : new Date().toISOString(),
        amount: actualPaid,
        paymentMethod: settings.treasuries.find(t => t.id === singleTreasury)?.name || singleTreasury || 'كاش',
        treasuryId: singleTreasury || 'cash',
        notes: 'الدفعة الأولى عند إصدار الفاتورة',
        createdBy: currentUser?.name || 'الكاشير'
      }] : [],
      discount: (isRemedyInvoice || isWaselInvoice) ? subtotal : discountAmount,
      paymentMethod: paymentMode === 'deferred' ? 'deferred' : (splits[0]?.treasuryId || 'cash'),
      treasuryId: paymentMode === 'deferred' ? 'deferred' : (splits[0]?.treasuryId || 'main'),
      shiftId: effectiveShiftId,
      shiftCode: effectiveShiftCode,
      shiftDate: effectiveIsShiftOpen ? effectiveShiftDate : undefined,
      advanceDeduction: advanceDeduction > 0 ? advanceDeduction : undefined,
      advancePayments: activeAdvancePayments.length > 0 ? activeAdvancePayments : undefined,
      bookingId: activeBookingId || initialBooking?.id || undefined,
      cashbackUsed: cashbackUsed > 0 ? cashbackUsed : undefined,
      promoCode: appliedPromo ? appliedPromo.code : undefined,
      promoDiscount: promoDiscountAmount > 0 ? promoDiscountAmount : undefined,
      tipAmount: calculatedTip > 0 ? calculatedTip : undefined,
      tipEmployeeId: calculatedTip > 0 ? (isUnspecifiedTip ? 'unspecified' : assignedTipEmployee?.id) : undefined,
      tipEmployeeName: calculatedTip > 0 ? (isUnspecifiedTip ? 'غير محدد (عامة للصالون)' : assignedTipEmployee?.name) : undefined,
      status: invoiceStatus,

      beforePhotoUrl: beforePhotoUrl || undefined,
      afterPhotoUrl: afterPhotoUrl || undefined,
      isRemedyInvoice: isRemedyInvoice || undefined,
      remedyReason: isRemedyInvoice ? remedyReason : undefined,
      isWaselInvoice: isWaselInvoice || undefined,
      waselReason: isWaselInvoice ? waselReason.trim() : undefined,
      waselRecipientName: isWaselInvoice ? waselRecipientName.trim() : undefined,

      items: cart.map(c => {
        const performer = employees.find(e => e.id === c.employeeId);
        const referrer = employees.find(e => e.id === c.referralEmployeeId);
        let refCommAmt = 0;
        const matchedService = items.find(s => s.id === c.item?.id || s.name === c.item?.name);
        const refCommType = c.item?.referralCommissionType || matchedService?.referralCommissionType || 'percentage';
        const refCommVal = c.item?.referralCommissionAmount !== undefined && c.item?.referralCommissionAmount > 0 
          ? c.item?.referralCommissionAmount 
          : (matchedService?.referralCommissionAmount || 0);

        const itemPrice = getCartItemPrice(c);
        if (refCommVal > 0 && c.referralEmployeeId) {
          if (refCommType === 'fixed') {
            refCommAmt = refCommVal;
          } else {
            refCommAmt = (refCommVal / 100) * itemPrice;
          }
        }

        // حساب عمولة التنفيذ المباشرة للموظف (سواء خدمة أو منتج)
        let execCommAmt = 0;
        const qty = c.quantity || 1;
        const isProduct = c.type === 'product' || c.item?.type === 'product' || Boolean(c.item?._isProduct);
        if (isProduct) {
          const matchedProd = products?.find((p: any) => p.id === c.item?.id || p.name === c.item?.name);
          const prodComm = Number(c.item?.commission ?? matchedProd?.commission ?? 0);
          if (prodComm > 0) {
            execCommAmt = prodComm * qty;
          }
        } else {
          const srvAmount = Number(c.item?.employeeCommissionAmount ?? matchedService?.employeeCommissionAmount ?? c.item?.commissionAmount ?? matchedService?.commissionAmount ?? 0);
          const srvPct = Number(c.item?.employeeCommissionPercentage ?? matchedService?.employeeCommissionPercentage ?? c.item?.commissionRate ?? matchedService?.commissionRate ?? 0);
          const rawCommBase = Number(c.item?.commissionableAmount ?? matchedService?.commissionableAmount ?? 0);
          const commBase = rawCommBase > 0 ? rawCommBase : itemPrice;
          if (srvAmount > 0) {
            execCommAmt = srvAmount * qty;
          } else if (srvPct > 0) {
            execCommAmt = (srvPct / 100) * commBase * qty;
          } else if (performer && (performer.commissionModel === 'fixed_rate' || !performer.commissionModel) && Number(performer.commissionRate) > 0) {
            execCommAmt = ((Number(performer.commissionRate) || 0) / 100) * commBase * qty;
          }
        }

        const commBaseVal = Number(c.item?.commissionableAmount ?? matchedService?.commissionableAmount ?? 0);
        const isExempt = Boolean(c.item?.isTargetExempt ?? matchedService?.isTargetExempt);

        return {
          id: c.cartId,
          itemId: c.item?.id || c.cartId,
          type: c.type || (isProduct ? 'product' : 'service'),
          employeeId: c.employeeId,
          referralEmployeeId: c.referralEmployeeId || undefined,
          serviceName: c.item?.name || 'خدمة',
          technicianName: performer?.name || 'غير محدد',
          referralEmployeeName: referrer?.name || undefined,
          referralCommissionAmount: refCommAmt > 0 ? refCommAmt : undefined,
          employeeCommission: execCommAmt > 0 ? execCommAmt : undefined,
          commissionAmount: execCommAmt > 0 ? execCommAmt : undefined,
          commission: execCommAmt > 0 ? execCommAmt : undefined,
          commissionableAmount: commBaseVal > 0 ? commBaseVal : undefined,
          isTargetExempt: isExempt || undefined,
          price: isRemedyInvoice ? 0 : itemPrice,
          discount: Number(c.discount || c.item?.discount) || undefined,
          originalPrice: Number(c.originalPrice || c.item?.originalPrice || itemPrice) || undefined,
          quantity: qty
        };
      }),
      paymentMethods: splits
    };

    // ZATCA Phase 1 & 2 QR Code Generation & Reporting (ONLY for Saudi Arabia)
    let zatcaQr = '';
    let zatcaReportingStatus: Invoice['zatcaReportingStatus'] = 'not_submitted';
    const isSaudi = isSaudiSalon(settings, branches, activeBranchId);
    if (isSaudi) {
      try {
        zatcaQr = await ZatcaService.generateZatcaQR(initialInv, settings, settings.zatcaSettings);
        if (settings.zatcaSettings?.enabled && settings.zatcaSettings.autoReportB2C) {
          const zatcaRes = await ZatcaService.reportSimplifiedInvoice(initialInv, settings, settings.zatcaSettings);
          zatcaReportingStatus = zatcaRes.reportingStatus;
        }
      } catch (err) {
        console.warn('ZATCA QR Generation warning:', err);
      }
    }

    // ETA Egypt e-Receipt Submission
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

    if (selectedClient && !isRemedyInvoice && !isWaselInvoice) {
      // 1. كاش باك العميل المباشر: لا يُحتسب كاش باك إذا تم استخدام كاش باك في السداد أو عند استخدام برومو كود
      let earnedCashback = 0;
      if (cashbackUsed === 0 && !appliedPromo) {
        cart.forEach(c => {
          if (c.item?.cashbackPercentage) {
            earnedCashback += (getCartItemPrice(c) * Number(c.item.cashbackPercentage)) / 100;
          }
        });
      }

      // 2. كاش باك ترشيح وإحالة العميل (يُمنح للعميل المرشِح على أول فاتورة فقط للعميل الجديد بشرط عدم استخدام برومو كود)
      let referrerClientPhone = selectedClient.referredByPhone?.trim();
      if (referrerClientPhone === selectedClient.phone?.trim()) {
        referrerClientPhone = undefined; // منع الترشيح الذاتي
      }

      const isFirstInvoice = !selectedClient.hasUsedReferralReward && 
        invoices.filter(inv => (selectedClient.phone && inv.clientPhone === selectedClient.phone) || (selectedClient.id && inv.clientId === selectedClient.id)).length === 0;

      let referrerEarnedCashback = 0;
      let referrerClientId: string | undefined = undefined;

      if (referrerClientPhone && isFirstInvoice && !appliedPromo) {
        const foundReferrer = clients.find(cl => cl.phone && cl.phone.trim() === referrerClientPhone);
        if (foundReferrer && foundReferrer.id !== selectedClient.id) {
          referrerClientId = foundReferrer.id;
          cart.forEach(c => {
            if (c.type === 'service' && c.item?.clientReferralCashbackAmount && c.item.clientReferralCashbackAmount > 0) {
              if (c.item.clientReferralCashbackType === 'fixed') {
                referrerEarnedCashback += c.item.clientReferralCashbackAmount * (c.quantity || 1);
              } else {
                referrerEarnedCashback += ((getCartItemPrice(c) * c.item.clientReferralCashbackAmount) / 100) * (c.quantity || 1);
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
        employeeId: isUnspecifiedTip ? 'unspecified' : assignedTipEmployee.id,
        employeeName: isUnspecifiedTip ? 'غير محدد (عامة للصالون)' : assignedTipEmployee.name,
        amount: calculatedTip,
        paymentMethod: tipPaymentMethodName,
        date: newInvoice.date,
        status: isUnspecifiedTip ? 'paid_out' : (tipPayoutMode === 'instant_cash' ? 'paid_out' : 'pending_payout'),
        payoutMethod: isUnspecifiedTip ? undefined : tipPayoutMode,
        paidOutAt: isUnspecifiedTip ? newInvoice.date : (tipPayoutMode === 'instant_cash' ? newInvoice.date : undefined),
        paidOutTreasuryId: isUnspecifiedTip ? undefined : (tipPayoutMode === 'instant_cash' ? 'cash' : undefined),
        notes: isUnspecifiedTip ? 'إكرامية عامة للصالون (غير مخصصة لموظف)' : undefined
      };
      if (setTips) {
        setTips(prev => [...prev, newTip]);
      }
      DB.saveTip(newTip);
    }

      if (onCheckoutComplete) {
        onCheckoutComplete(newInvoice, splits, activeBookingId || initialBooking?.id);
      }
      setEditingInvoice(null);

      // حفظ استخدام البرومو كود للعميل المحدد منعاً من الاستخدام المتكرر
      if (appliedPromo && selectedClient) {
        const usage: any = {
          id: DB.generateUUID(),
          salonId: settings.salonId,
          promoCodeId: appliedPromo.id,
          code: appliedPromo.code,
          clientId: selectedClient.id,
          clientPhone: selectedClient.phone || '',
          clientName: selectedClient.name || '',
          invoiceId: newInvoice.id,
          discountApplied: promoDiscountAmount,
          usedAt: new Date().toISOString()
        };
        if (setPromoCodeUsages) {
          setPromoCodeUsages((prev: any[]) => [...prev, usage]);
        }
        DB.savePromoCodeUsage(usage);

        // تحديث عدد مرات استخدام الكود وحفظه مباشرة في قاعدة البيانات
        const updatedPromo = {
          ...appliedPromo,
          usesCount: (appliedPromo.usesCount || 0) + 1
        };
        DB.savePromoCode(updatedPromo);
        if (setPromoCodes) {
          setPromoCodes((prev: PromoCode[]) => prev.map(p => p.id === updatedPromo.id ? updatedPromo : p));
        }
      }

      // إزالة الفاتورة المعلقة من السيرفر والمحلي فوراً بعد تمام السداد الفعلي فقط
      if (activeHeldInvoiceId) {
        DB.removeHeldInvoice(activeHeldInvoiceId).catch(() => {});
        setHeldInvoices(prev => prev.filter(h => h.id !== activeHeldInvoiceId));
      }
      if (activeBookingId) {
        DB.removeHeldInvoice(activeBookingId).catch(() => {});
        DB.removeHeldInvoice('HOLD-B-' + activeBookingId).catch(() => {});
        setHeldInvoices(prev => prev.filter(h => h.bookingId !== activeBookingId && h.id !== 'HOLD-B-' + activeBookingId));
      }
      if (initialBooking?.id) {
        DB.removeHeldInvoice(initialBooking.id).catch(() => {});
        DB.removeHeldInvoice('HOLD-B-' + initialBooking.id).catch(() => {});
      }
      if (initialHeldInvoice?.id) {
        DB.removeHeldInvoice(initialHeldInvoice.id).catch(() => {});
      }
      setActiveHeldInvoiceId(null);
      
      // إعادة ضبط الكاشير وبدء فاتورة جديدة فوراً ونزول جميع الخدمات
      setCart([]);
      setSelectedClient(null);
      setClientSearch('');
      setDiscount({ type: 'fixed', value: 0 });
      setAdvanceDeduction(0);
      setActiveAdvancePayments([]);
      setActiveBookingId(undefined);
      setActiveQueueNumber(null);
      setIsRemedyInvoice(false);
      setIsWaselInvoice(false);
      setWaselReason('');
      setWaselRecipientName('');
      setBeforePhotoUrl('');
      setAfterPhotoUrl('');
      setSplitAmounts({});
      setReceivedAmount('');
      setTipEmployeeId('');
      setAppliedPromo(null);
      setPromoDiscountAmount(0);
      setPromoError(null);
      setPaymentMode('full');
      setPartialPaidAmount('');
      setDeferredDueDate('');
      setDeferredNotes('');
      setItemTypeFilter('service');
      setSelectedCategory('all');
      setSearchQuery('');
      try { localStorage.removeItem('smartcut_pos_active_draft'); } catch {}
      if (onClearInitial) onClearInitial();

      setCompletedInvoice(newInvoice);
      setShowPaymentModal(false);
      setShowReceiptModal(false);

      if (shouldPrint) {
        // إرسال أمر الطباعة فوراً على الطابعة الافتراضية دون فتح أي نافذة معاينة
        const triggerDirectPrint = (attempts = 0) => {
          const el = document.getElementById('direct-receipt-print-area');
          if (el) {
            executePrintInvoiceReceipt('direct-receipt-print-area', newInvoice.id);
          } else if (attempts < 15) {
            setTimeout(() => triggerDirectPrint(attempts + 1), 30);
          }
        };
        setTimeout(() => triggerDirectPrint(0), 30);
      }
    } catch (err: any) {
      console.error('Payment confirmation error:', err);
      alert('حدث خطأ أثناء تأكيد الدفع: ' + (err?.message || ''));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // إغلاق شاشة الفاتورة دون أي طباعة وبدء فاتورة جديدة فوراً
  const handleCloseReceiptModal = () => {
    setShowReceiptModal(false);
    setCompletedInvoice(null);
  };

  // طباعة الفاتورة مباشرة
  const printReceiptDirect = () => {
    if (!completedInvoice) return;
    executePrintInvoiceReceipt('receipt-content', completedInvoice.id);
  };

  // معاينة الفاتورة قبل الطباعة
  const printReceiptPreview = () => {
    if (!completedInvoice) return;
    executePrintInvoiceReceipt('receipt-content', completedInvoice.id);
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

    let savedClient: Client;
    if (matchedSalonClientInPOS) {
      const existingBranchIds = Array.isArray(matchedSalonClientInPOS.branchIds) ? matchedSalonClientInPOS.branchIds : [];
      const branchIdFallback = matchedSalonClientInPOS.branchId ? [matchedSalonClientInPOS.branchId] : [];
      const updatedBranchIds = Array.from(new Set([
        ...existingBranchIds,
        ...branchIdFallback,
        activeBranchId
      ].filter(Boolean) as string[]));

      savedClient = {
        ...matchedSalonClientInPOS,
        name: newClientForm.name.trim() || matchedSalonClientInPOS.name,
        phone: cleanPhone || matchedSalonClientInPOS.phone,
        clientType: newClientForm.clientType || matchedSalonClientInPOS.clientType || 'citizen',
        referredByPhone: cleanReferredBy || matchedSalonClientInPOS.referredByPhone,
        dob: (newClientForm.dobDay && newClientForm.dobMonth) ? `${newClientForm.dobMonth}-${newClientForm.dobDay}` : matchedSalonClientInPOS.dob,
        branchIds: updatedBranchIds,
        branchId: matchedSalonClientInPOS.branchId || activeBranchId,
        salonId: settings.salonId || matchedSalonClientInPOS.salonId
      };
      setClients([...clients.filter(c => c.id !== savedClient.id), savedClient]);
      DB.saveClient(savedClient);
    } else {
      savedClient = {
        id: 'C-' + Math.random().toString(36).substr(2, 9),
        salonId: settings.salonId,
        branchId: activeBranchId,
        branchIds: activeBranchId ? [activeBranchId] : [],
        name: newClientForm.name.trim(),
        phone: cleanPhone,
        clientType: newClientForm.clientType || 'citizen',
        referredByPhone: cleanReferredBy,
        loyaltyPoints: 0,
        cashback: 0,
        dob: (newClientForm.dobDay && newClientForm.dobMonth) ? `${newClientForm.dobMonth}-${newClientForm.dobDay}` : undefined
      };
      setClients([...clients, savedClient]);
      DB.saveClient(savedClient);
    }

    setSelectedClient(savedClient);
    setClientSearch(savedClient.name);
    setShowAddClientModal(false);
    setNewClientForm({ name: '', phone: '', referredByPhone: '', dobDay: '', dobMonth: '', clientType: 'citizen' });
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
      
      // 1. Process services and discounts with mutual exclusivity for initialBooking
      let rawBookingServices = initialBooking.services;
      if (typeof rawBookingServices === 'string') {
        try {
          rawBookingServices = JSON.parse(rawBookingServices);
        } catch {
          rawBookingServices = [];
        }
      }
      if (!Array.isArray(rawBookingServices)) rawBookingServices = [];

      const lineDiscountsTotal = rawBookingServices.reduce((sum: number, s: any) => sum + (Number(s.discount) || 0), 0);
      const hasLineDiscounts = lineDiscountsTotal > 0;
      const rawBookingDiscVal = Number(initialBooking.discountValue) || 0;
      const hasOverallDiscount = !hasLineDiscounts && rawBookingDiscVal > 0;

      const cartItems: CartItem[] = rawBookingServices.map((s: any, idx: number) => {
        const isProduct = s.type === 'product';
        const foundProduct = isProduct ? products.find(p => p.id === (s.serviceId || s.productId)) : undefined;
        const foundService = !isProduct ? items.find(i => i.id === s.serviceId) : undefined;
        const foundItem = isProduct ? foundProduct : foundService;
        const parsedPrice = Number(s.price) || (foundItem ? Number((foundItem as any).sellPrice ?? (foundItem as any).price) : 0);
        const safeOrigPrice = isNaN(parsedPrice) ? 0 : parsedPrice;
        
        const qty = Math.max(1, Number(s.quantity) || 1);
        // In case of line discounts, deduct directly from service/product unit price on the cart line
        const lineDiscount = hasLineDiscounts ? (Number(s.discount) || 0) : 0;
        const perUnitDiscount = lineDiscount > 0 ? lineDiscount / qty : 0;
        const effectiveLinePrice = Math.max(0, safeOrigPrice - perUnitDiscount);

        const cartItemObj: any = foundItem ? {
          ...foundItem,
          name: s.serviceName || s.productName || foundItem.name,
          price: effectiveLinePrice,
          displayPrice: effectiveLinePrice,
          originalPrice: safeOrigPrice,
          discount: lineDiscount > 0 ? lineDiscount : undefined,
          type: isProduct ? 'product' : 'service'
        } : {
          id: s.serviceId || s.productId || `item-${idx}`,
          name: s.serviceName || s.productName || (isProduct ? 'منتج صالون' : 'خدمة صالون'),
          price: effectiveLinePrice,
          displayPrice: effectiveLinePrice,
          categoryId: isProduct ? 'products' : 'services',
          isActive: true,
          type: isProduct ? 'product' : 'service',
          originalPrice: safeOrigPrice,
          discount: lineDiscount > 0 ? lineDiscount : undefined
        };
        
        return {
          cartId: Math.random().toString(36).substring(2, 9),
          item: cartItemObj,
          quantity: qty,
          employeeId: s.technicianId && s.technicianId !== 'any' && s.technicianId !== '-' ? s.technicianId : '',
          type: isProduct ? 'product' : 'service',
          price: effectiveLinePrice,
          discount: lineDiscount > 0 ? lineDiscount : undefined,
          originalPrice: safeOrigPrice
        };
      });
      
      setCart(cartItems);

      // In case of line discounts, discount is already on each service line -> bottom discount = 0
      // In case of overall booking discount, service prices are original -> discount is in bottom discount section!
      if (hasOverallDiscount) {
        setDiscount({
          type: initialBooking.discountType || 'fixed',
          value: rawBookingDiscVal
        });
      } else {
        setDiscount({ type: 'fixed', value: 0 });
      }
      
      let rawAdvances = initialBooking.advancePayments;
      if (typeof rawAdvances === 'string') {
        try {
          rawAdvances = JSON.parse(rawAdvances);
        } catch {
          rawAdvances = [];
        }
      }
      if (!Array.isArray(rawAdvances)) rawAdvances = [];

      let advancesSum = rawAdvances.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      if (advancesSum === 0 && (initialBooking as any).advancePayment) {
        const legacyAdv = Number((initialBooking as any).advancePayment) || 0;
        if (legacyAdv > 0) {
          advancesSum = legacyAdv;
          rawAdvances = [{
            id: 'adv-' + initialBooking.id,
            amount: legacyAdv,
            treasuryId: (initialBooking as any).treasuryId || '',
            treasuryName: (initialBooking as any).treasuryName || 'الخزينة',
            date: initialBooking.date || new Date().toISOString().split('T')[0]
          }];
        }
      }

      setAdvanceDeduction(advancesSum);
      setActiveAdvancePayments(rawAdvances);
      setActiveBookingId(initialBooking.id);
      if (initialBooking.queueNumber) {
        setActiveQueueNumber(initialBooking.queueNumber);
      }

      if (onClearInitial) onClearInitial();
    }
  }, [initialBooking]);

  // استكمال وفتح الفاتورة المعلقة تلقائياً عند تمريرها من شاشة المناداة بعد اكتمال الخدمة
  useEffect(() => {
    if (initialHeldInvoice) {
      let client = initialHeldInvoice.client;
      if (!client && initialHeldInvoice.clientSearch) {
        client = clients.find(c => 
          initialHeldInvoice.clientSearch?.includes(c.phone) || 
          c.name === initialHeldInvoice.clientSearch
        );
      }
      if (!client && initialHeldInvoice.clientSearch) {
        const parts = initialHeldInvoice.clientSearch.split(' - ');
        client = {
          id: 'C-' + Math.random().toString(36).substr(2, 9),
          name: parts[0] || 'عميل',
          phone: parts[1] || '',
          loyaltyPoints: 0
        };
      }

      const normalizedCart = (initialHeldInvoice.cart || []).map(normalizeCartItem);
      setSelectedClient(client || null);
      setClientSearch(initialHeldInvoice.clientSearch || client?.name || '');
      setCart(normalizedCart);
      setDiscount(initialHeldInvoice.discount || { type: 'fixed', value: 0 });
      setAdvanceDeduction(Number(initialHeldInvoice.advanceDeduction) || 0);
      setActiveAdvancePayments(initialHeldInvoice.advancePayments || []);
      setActiveBookingId(initialHeldInvoice.bookingId || undefined);
      setIsRemedyInvoice(initialHeldInvoice.isRemedyInvoice || false);
      setRemedyReason(initialHeldInvoice.remedyReason || '');
      setIsWaselInvoice(initialHeldInvoice.isWaselInvoice || false);
      setWaselReason(initialHeldInvoice.waselReason || '');
      setWaselRecipientName(initialHeldInvoice.waselRecipientName || '');
      setBeforePhotoUrl(initialHeldInvoice.beforePhotoUrl || '');
      setAfterPhotoUrl(initialHeldInvoice.afterPhotoUrl || '');
      if (initialHeldInvoice.queueNumber) {
        setActiveQueueNumber(initialHeldInvoice.queueNumber);
      }

      // الاحتفاظ بالفاتورة المعلقة كنشطة في الـ POS دون حذفها من قاعدة البيانات حتى يتم السداد الفعلي
      setActiveHeldInvoiceId(initialHeldInvoice.id);
      const updatedHeld: HeldInvoice = {
        ...initialHeldInvoice,
        isOpen: true,
        openedBy: currentUser?.name || 'الكاشير'
      };
      setHeldInvoices(prev => {
        const exists = prev.some(h => h.id === initialHeldInvoice.id);
        return exists ? prev.map(h => h.id === initialHeldInvoice.id ? updatedHeld : h) : [updatedHeld, ...prev];
      });
      if (initialHeldInvoice.id) {
        DB.saveHeldInvoice(updatedHeld).catch(() => {});
      }

      if (onClearInitial) onClearInitial();
    }
  }, [initialHeldInvoice, clients]);

  // استرجاع وفتح الفاتورة بالكامل للتعديل في نقطة البيع
  useEffect(() => {
    if (initialEditingInvoice) {
      setEditingInvoice(initialEditingInvoice);

      // 1. العميل
      let client = clients.find(c => 
        (initialEditingInvoice.clientId && c.id === initialEditingInvoice.clientId) ||
        (initialEditingInvoice.clientPhone && c.phone === initialEditingInvoice.clientPhone) ||
        c.name === initialEditingInvoice.clientName
      );
      if (!client && initialEditingInvoice.clientName) {
        client = {
          id: initialEditingInvoice.clientId || ('C-' + Math.random().toString(36).substr(2, 9)),
          name: initialEditingInvoice.clientName,
          phone: initialEditingInvoice.clientPhone || '',
          loyaltyPoints: 0
        };
      }
      setSelectedClient(client || null);
      setClientSearch(initialEditingInvoice.clientName || client?.name || '');

      // 2. بنود الفاتورة (خدمات ومنتجات)
      const loadedCart: CartItem[] = (initialEditingInvoice.items || []).map((it, idx) => {
        const isProd = it.type === 'product';
        const rawItem = isProd
          ? (products?.find((p: any) => p.id === it.itemId || p.name === it.serviceName) || {
              id: it.itemId || it.id,
              name: it.serviceName,
              price: Number(it.price || 0),
              originalPrice: Number(it.originalPrice || it.price || 0),
              type: 'product',
              _isProduct: true
            })
          : (items.find((s: any) => s.id === it.itemId || s.name === it.serviceName) || {
              id: it.itemId || it.id,
              name: it.serviceName,
              price: Number(it.price || 0),
              originalPrice: Number(it.originalPrice || it.price || 0),
              type: 'service'
            });

        return normalizeCartItem({
          cartId: it.id || ('CART-EDIT-' + idx + '-' + Math.random().toString(36).substr(2, 6)),
          quantity: Math.max(1, Number(it.quantity) || 1),
          employeeId: it.employeeId || employees[0]?.id || '',
          referralEmployeeId: it.referralEmployeeId || '',
          type: isProd ? 'product' : 'service',
          price: Number(it.price) || 0,
          discount: Number(it.discount) || 0,
          originalPrice: Number(it.originalPrice || it.price) || 0,
          item: rawItem
        });
      });
      setCart(loadedCart);

      // 3. الخصم
      setDiscount({ type: 'fixed', value: Number(initialEditingInvoice.discount) || 0 });

      // 4. العربون والحجز
      setAdvanceDeduction(Number(initialEditingInvoice.advanceDeduction) || 0);
      setActiveAdvancePayments(initialEditingInvoice.advancePayments || []);
      setActiveBookingId(initialEditingInvoice.bookingId || undefined);

      // 5. الحالات الخاصة
      setIsRemedyInvoice(Boolean(initialEditingInvoice.isRemedyInvoice));
      setRemedyReason(initialEditingInvoice.remedyReason || '');
      setIsWaselInvoice(Boolean(initialEditingInvoice.isWaselInvoice));
      setWaselReason(initialEditingInvoice.waselReason || '');
      setWaselRecipientName(initialEditingInvoice.waselRecipientName || '');
      setBeforePhotoUrl(initialEditingInvoice.beforePhotoUrl || '');
      setAfterPhotoUrl(initialEditingInvoice.afterPhotoUrl || '');

      if (initialEditingInvoice.queueNumber) {
        setActiveQueueNumber(initialEditingInvoice.queueNumber);
      }

      // 6. طرق الدفع المسبقة
      if (initialEditingInvoice.status === 'deferred') {
        setPaymentMode('deferred');
        setDeferredDueDate(initialEditingInvoice.dueDate || '');
        setDeferredNotes(initialEditingInvoice.notes || '');
      } else if (initialEditingInvoice.status === 'partially_paid') {
        setPaymentMode('partial');
        setPartialPaidAmount(Number(initialEditingInvoice.paid) || 0);
        setDeferredDueDate(initialEditingInvoice.dueDate || '');
        setDeferredNotes(initialEditingInvoice.notes || '');
      } else {
        setPaymentMode('full');
      }

      if (initialEditingInvoice.paymentMethods && initialEditingInvoice.paymentMethods.length > 1) {
        setPaymentType('split');
        const splitsObj: Record<string, number> = {};
        initialEditingInvoice.paymentMethods.forEach(pm => {
          splitsObj[pm.treasuryId] = pm.amount;
        });
        setSplitAmounts(splitsObj);
      } else {
        setPaymentType('single');
        const primaryTreasury = initialEditingInvoice.paymentMethods?.[0]?.treasuryId || initialEditingInvoice.treasuryId || initialEditingInvoice.paymentMethod || 'cash';
        setSingleTreasury(primaryTreasury);
      }

      if (onClearInitial) onClearInitial();
    }
  }, [initialEditingInvoice, clients, items, products, employees]);

  // حفظ الفاتورة النشطة كمسودة محلية تلقائياً لضمان عدم فقدانها عند التنقل بين الشاشات
  useEffect(() => {
    if (cart.length > 0 || activeBookingId || (selectedClient && selectedClient.name) || activeHeldInvoiceId) {
      const draft = {
        cart,
        selectedClient,
        clientSearch,
        discount,
        advanceDeduction: Number(advanceDeduction) || 0,
        activeAdvancePayments,
        activeBookingId,
        activeHeldInvoiceId,
        isRemedyInvoice,
        remedyReason,
        isWaselInvoice,
        waselReason,
        waselRecipientName,
        beforePhotoUrl,
        afterPhotoUrl,
        activeQueueNumber
      };
      try {
        localStorage.setItem('smartcut_pos_active_draft', JSON.stringify(draft));
      } catch (e) {
        console.warn('Failed to save POS draft:', e);
      }
    } else {
      try {
        localStorage.removeItem('smartcut_pos_active_draft');
      } catch {}
    }
  }, [cart, selectedClient, clientSearch, discount, advanceDeduction, activeAdvancePayments, activeBookingId, activeHeldInvoiceId, isRemedyInvoice, remedyReason, isWaselInvoice, waselReason, waselRecipientName, beforePhotoUrl, afterPhotoUrl, activeQueueNumber]);

  // استعادة المسودة النشطة عند فتح شاشة الكاشير (إذا لم يتم تمرير حجز جديد أو فاتورة معلقة أو فاتورة للتعديل)
  useEffect(() => {
    if (!initialBooking && !initialHeldInvoice && !initialEditingInvoice) {
      try {
        const savedDraft = localStorage.getItem('smartcut_pos_active_draft');
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          if (draft && Array.isArray(draft.cart) && draft.cart.length > 0) {
            const normalized = draft.cart.map(normalizeCartItem);
            setCart(normalized);
            if (draft.selectedClient) setSelectedClient(draft.selectedClient);
            if (draft.clientSearch) setClientSearch(draft.clientSearch);
            if (draft.discount) setDiscount(draft.discount);
            if (draft.advanceDeduction !== undefined) setAdvanceDeduction(Number(draft.advanceDeduction) || 0);
            if (draft.activeAdvancePayments) setActiveAdvancePayments(draft.activeAdvancePayments);
            if (draft.activeBookingId) setActiveBookingId(draft.activeBookingId);
            if (draft.activeHeldInvoiceId) setActiveHeldInvoiceId(draft.activeHeldInvoiceId);
            if (draft.isRemedyInvoice) setIsRemedyInvoice(draft.isRemedyInvoice);
            if (draft.remedyReason) setRemedyReason(draft.remedyReason);
            if (draft.isWaselInvoice) setIsWaselInvoice(draft.isWaselInvoice);
            if (draft.waselReason) setWaselReason(draft.waselReason);
            if (draft.waselRecipientName) setWaselRecipientName(draft.waselRecipientName);
            if (draft.beforePhotoUrl) setBeforePhotoUrl(draft.beforePhotoUrl);
            if (draft.afterPhotoUrl) setAfterPhotoUrl(draft.afterPhotoUrl);
            if (draft.activeQueueNumber) setActiveQueueNumber(draft.activeQueueNumber);
          }
        }
      } catch (e) {
        console.warn('Failed to restore POS draft:', e);
      }
    }
  }, []);

  const clearBooking = () => {
    setCart([]);
    setClientSearch('');
    setSelectedClient(null);
    setAdvanceDeduction(0);
    setActiveAdvancePayments([]);
    setActiveBookingId(undefined);
    setActiveQueueNumber(null);
    setActiveHeldInvoiceId(null);
    setEditingInvoice(null);
    setIsRemedyInvoice(false);
    setIsWaselInvoice(false);
    setWaselReason('');
    setWaselRecipientName('');
    setBeforePhotoUrl('');
    setAfterPhotoUrl('');
    try {
      localStorage.removeItem('smartcut_pos_active_draft');
    } catch {}
    if (onClearInitial) onClearInitial();
  };

  // تصنيفات التبويب النشط (خدمات أو منتجات) لضمان ظهور كافة تصنيفات الخدمات أو المنتجات التابعة
  const activeCategories = useMemo(() => {
    const relevantItems = itemTypeFilter === 'service' ? items : products;
    // استخراج معرّفات وأسماء التصنيفات المستخدمة بالفعل في العناصر
    const usedCategories = new Set(
      relevantItems.map((it: any) => String(it.categoryId || it.category_id || it.category || '').trim().toLowerCase()).filter(Boolean)
    );

    const cleanCategories = (categories || []).filter(c => c && c.id !== 'all');

    return cleanCategories.filter(cat => {
      // 1. إذا كان نوع التصنيف محدد صراحة كخدمة أو منتج
      if (cat.type) {
        return cat.type === itemTypeFilter;
      }
      // 2. إذا لم يكن النوع محدداً، نتحقق مما إذا كان مستخدماً في عناصر التبويب الحالي
      const idLower = String(cat.id || '').trim().toLowerCase();
      const nameLower = String(cat.name || '').trim().toLowerCase();
      if (usedCategories.has(idLower) || usedCategories.has(nameLower)) {
        return true;
      }
      // 3. افتراضياً للخدمات إذا لم يكن هناك نوع محدد
      return itemTypeFilter === 'service';
    });
  }, [categories, itemTypeFilter, items, products]);

  const isForeignerClient = Boolean(settings.enableDualPricing && selectedClient?.clientType === 'foreigner');

  // مزامنة وتحديث أسعار الخدمات داخل السلة تلقائياً عند تغيير نوع العميل (مواطن / أجنبي)
  useEffect(() => {
    if (!settings.enableDualPricing) return;
    setCart(prevCart => {
      if (!prevCart || prevCart.length === 0) return prevCart;
      let changed = false;
      const updated = prevCart.map(cartItem => {
        if (cartItem.type === 'product' || cartItem.item?._isProduct) return cartItem;
        const srvId = cartItem.item?.id;
        const srv = (items || []).find(s => s.id === srvId);
        if (!srv) return cartItem;

        const isFore = Boolean(selectedClient?.clientType === 'foreigner');
        const hasForePrice = Boolean(isFore && srv.foreignerPrice && Number(srv.foreignerPrice) > 0);
        const rawDisc = Number(srv.discountPrice);
        const hasDisc = !hasForePrice && !isNaN(rawDisc) && rawDisc > 0 && rawDisc < Number(srv.price);
        const targetPrice = hasForePrice ? Number(srv.foreignerPrice) : (hasDisc ? rawDisc : Number(srv.price) || 0);
        const origPrice = hasForePrice ? Number(srv.foreignerPrice) : (Number(srv.price) || 0);

        if (cartItem.price !== targetPrice || cartItem.item?.isForeignerPrice !== hasForePrice) {
          changed = true;
          return {
            ...cartItem,
            price: targetPrice,
            originalPrice: origPrice,
            item: {
              ...cartItem.item,
              displayPrice: targetPrice,
              originalPrice: origPrice,
              isForeignerPrice: hasForePrice
            }
          };
        }
        return cartItem;
      });
      return changed ? updated : prevCart;
    });
  }, [selectedClient?.id, selectedClient?.clientType, settings.enableDualPricing, items]);

  // قائمة الخدمات الافتراضية النشطة المجهزة مسبقاً في الذاكرة (Ultra Fast-Path Cache) لنزول الخدمات فوراً دون أي تأخير
  const defaultActiveServices = useMemo(() => {
    const active = (items || []).filter(i => i.isActive !== false);
    return active.sort((a: any, b: any) => {
      const aPri = a.isPriority ? 1 : 0;
      const bPri = b.isPriority ? 1 : 0;
      if (aPri !== bPri) return bPri - aPri;
      const aOrder = a.priorityOrder ?? 0;
      const bOrder = b.priorityOrder ?? 0;
      return aOrder - bOrder;
    }).map(i => {
      const isForePrice = Boolean(isForeignerClient && ((i.foreignerPrice && Number(i.foreignerPrice) > 0) || (activeBranchId && i.branchForeignerPrices?.[activeBranchId])));
      const originalPrice = getServicePrice(i, activeBranchId, isForeignerClient);
      const rawDiscount = Number(i.discountPrice);
      const hasDiscount = !isForePrice && !isNaN(rawDiscount) && rawDiscount > 0 && rawDiscount < originalPrice;
      const effectivePrice = hasDiscount ? rawDiscount : originalPrice;
      return {
        ...i,
        _isProduct: false,
        isForeignerPrice: isForePrice,
        hasDiscount,
        discountPrice: hasDiscount ? rawDiscount : undefined,
        originalPrice,
        displayPrice: effectivePrice
      };
    });
  }, [items, isForeignerClient, activeBranchId]);

  const filteredItems = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();

    // مسار فائق السرعة (Ultra Fast Path): استرجاع الخدمات فوراً بدون إعادة فرز أو معالجة عند بدء فاتورة جديدة
    if (itemTypeFilter === 'service' && (!selectedCategory || selectedCategory === 'all') && !q) {
      return defaultActiveServices;
    }

    let source = itemTypeFilter === 'service' 
      ? items.filter(i => i.isActive !== false) 
      : products.filter(p => (p as any).productType !== 'raw_material');
    let filtered = source;

    if (selectedCategory && selectedCategory !== 'all') {
      const selectedCat = categories.find(c => c.id === selectedCategory || c.name === selectedCategory);
      const targetId = (selectedCat?.id || selectedCategory).trim().toLowerCase();
      const targetName = (selectedCat?.name || selectedCategory).trim().toLowerCase();

      filtered = filtered.filter(i => {
        const itemCatId = String(i.categoryId || (i as any).category_id || '').trim().toLowerCase();
        const itemCatName = String((i as any).category || (i as any).categoryName || '').trim().toLowerCase();

        // 1. مطابقة بمعرف التصنيف
        if (itemCatId && (itemCatId === targetId || itemCatId === targetName)) return true;
        // 2. مطابقة باسم التصنيف
        if (itemCatName && (itemCatName === targetName || itemCatName === targetId)) return true;
        // 3. مطابقة إذا كانت الخدمة/المنتج مسجلة بمعرف كائن التصنيف
        if (selectedCat && (itemCatId === selectedCat.id.toLowerCase() || itemCatId === selectedCat.name.toLowerCase())) return true;

        return false;
      });
    }
    if (q) {
      // تطبيع الأرقام (تحويل الأرقام العربية إلى إنجليزية إن وُجدت)
      const normalizedQ = q.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim();
      const numQuery = parseFloat(normalizedQ);
      const isPureNumeric = !isNaN(numQuery) && /^\d+(\.\d+)?$/.test(normalizedQ);

      filtered = filtered.filter(i => {
        // 1. مطابقة الاسم
        const matchesName = Boolean(i.name && i.name.toLowerCase().includes(q));
        // 2. مطابقة الباركود
        const matchesBarcode = Boolean(i.barcode && i.barcode.toLowerCase().includes(q));
        
        // 3. مطابقة سعر الخدمة أو المنتج إذا كتب المستخدم رقماً (مثل 1500)
        let matchesPrice = false;
        if (isPureNumeric) {
          const itemPrice = Number(i.price);
          const itemSellPrice = Number((i as any).sellPrice);
          const itemDiscountPrice = Number(i.discountPrice);

          matchesPrice = (
            (!isNaN(itemPrice) && itemPrice === numQuery) ||
            (!isNaN(itemSellPrice) && itemSellPrice === numQuery) ||
            (!isNaN(itemDiscountPrice) && itemDiscountPrice > 0 && itemDiscountPrice === numQuery)
          );
        }

        return matchesName || matchesBarcode || matchesPrice;
      });

      // إذا كان المستخدم في تبويب الخدمات وقام بالبحث/مسح باركود أو سعر يطابق منتجات، نظهر المنتجات المطابقة
      if (itemTypeFilter === 'service') {
        const matchingBarcodeOrPriceProducts = products.filter(p => {
          if ((p as any).productType === 'raw_material') return false;
          const pBarcodeMatch = Boolean(p.barcode && p.barcode.toLowerCase().includes(q));
          let pPriceMatch = false;
          if (isPureNumeric) {
            const pSellPrice = Number(p.sellPrice);
            pPriceMatch = !isNaN(pSellPrice) && pSellPrice === numQuery;
          }
          return pBarcodeMatch || pPriceMatch;
        });
        if (matchingBarcodeOrPriceProducts.length > 0) {
          const existingIds = new Set(filtered.map(x => x.id));
          const newProducts = matchingBarcodeOrPriceProducts.filter(p => !existingIds.has(p.id));
          if (newProducts.length > 0) {
            filtered = [...filtered, ...newProducts];
          }
        }
      }
    }

    // ترتيب الخدمات بحيث تكون الخدمات ذات الأولوية (isPriority) في المقدمة دائماً
    if (itemTypeFilter === 'service') {
      filtered = [...filtered].sort((a: any, b: any) => {
        const aPri = a.isPriority ? 1 : 0;
        const bPri = b.isPriority ? 1 : 0;
        if (aPri !== bPri) return bPri - aPri;
        const aOrder = a.priorityOrder ?? 0;
        const bOrder = b.priorityOrder ?? 0;
        return aOrder - bOrder;
      });
    }

    return filtered.map(i => {
      const isProduct = (i as any)._isProduct !== undefined 
        ? Boolean((i as any)._isProduct) 
        : itemTypeFilter === 'product' || Boolean((i as any).sellPrice !== undefined && (i as any).price === undefined);
      const isForePrice = Boolean(!isProduct && isForeignerClient && i.foreignerPrice && Number(i.foreignerPrice) > 0);
      const originalPrice = isProduct ? (Number(i.sellPrice) || 0) : (isForePrice ? Number(i.foreignerPrice) : (Number(i.price) || 0));
      const rawDiscount = Number(i.discountPrice);
      const hasDiscount = !isProduct && !isForePrice && !isNaN(rawDiscount) && rawDiscount > 0 && rawDiscount < originalPrice;
      const effectivePrice = hasDiscount ? rawDiscount : originalPrice;

      return {
        ...i,
        _isProduct: isProduct,
        isForeignerPrice: isForePrice,
        hasDiscount,
        discountPrice: hasDiscount ? rawDiscount : undefined,
        originalPrice: originalPrice,
        displayPrice: effectivePrice
      };
    });
  }, [selectedCategory, searchQuery, items, products, itemTypeFilter, categories, isForeignerClient, defaultActiveServices]);

  // تصفية الخدمات والمنتجات لنافذة استعلام الأسعار (معاينة وقراءة فقط دون إضافة للفاتورة)
  const priceCheckFilteredItems = useMemo(() => {
    const q = (priceCheckSearch || '').trim().toLowerCase();
    let source: any[] = [];
    if (priceCheckType === 'service' || priceCheckType === 'all') {
      source.push(...(items || []).filter(i => i.isActive !== false).map(s => ({ ...s, _isProduct: false })));
    }
    if (priceCheckType === 'product' || priceCheckType === 'all') {
      source.push(...(products || []).filter(p => (p as any).productType !== 'raw_material').map(p => ({ ...p, _isProduct: true })));
    }

    let filtered = source;

    if (priceCheckCategory && priceCheckCategory !== 'all') {
      const selectedCat = categories.find(c => c.id === priceCheckCategory || c.name === priceCheckCategory);
      const targetId = (selectedCat?.id || priceCheckCategory).trim().toLowerCase();
      const targetName = (selectedCat?.name || priceCheckCategory).trim().toLowerCase();

      filtered = filtered.filter(i => {
        const itemCatId = String(i.categoryId || (i as any).category_id || '').trim().toLowerCase();
        const itemCatName = String((i as any).category || (i as any).categoryName || '').trim().toLowerCase();

        if (itemCatId && (itemCatId === targetId || itemCatId === targetName)) return true;
        if (itemCatName && (itemCatName === targetName || itemCatName === targetId)) return true;
        if (selectedCat && (itemCatId === selectedCat.id.toLowerCase() || itemCatId === selectedCat.name.toLowerCase())) return true;
        return false;
      });
    }

    if (q) {
      filtered = filtered.filter(i => 
        (i.name && i.name.toLowerCase().includes(q)) || 
        (i.barcode && i.barcode.toLowerCase().includes(q))
      );
    }

    // ترتيب بحيث تكون الخدمات ذات الأولوية أولاً
    filtered = [...filtered].sort((a: any, b: any) => {
      const aPri = a.isPriority ? 1 : 0;
      const bPri = b.isPriority ? 1 : 0;
      if (aPri !== bPri) return bPri - aPri;
      const aOrder = a.priorityOrder ?? 0;
      const bOrder = b.priorityOrder ?? 0;
      return aOrder - bOrder;
    });

    return filtered.map(i => {
      const isProduct = Boolean(i._isProduct);
      const originalPrice = isProduct ? (Number(i.sellPrice) || 0) : (Number(i.price) || 0);
      const rawDiscount = Number(i.discountPrice);
      const hasDiscount = !isProduct && !isNaN(rawDiscount) && rawDiscount > 0 && rawDiscount < originalPrice;
      const effectivePrice = hasDiscount ? rawDiscount : originalPrice;
      const catObj = categories.find(c => c.id === i.categoryId || c.name === i.categoryId);

      return {
        ...i,
        _isProduct: isProduct,
        categoryName: catObj?.name || (i as any).category || (i as any).categoryName || '',
        hasDiscount,
        discountPrice: hasDiscount ? rawDiscount : undefined,
        originalPrice,
        displayPrice: effectivePrice
      };
    });
  }, [items, products, priceCheckSearch, priceCheckCategory, priceCheckType, categories]);

  // تصفية الفنيين المنفذين المسموح لهم بتنفيذ الخدمات (حلاق / كوافير فقط)
  const performerEmployees = useMemo(() => {
    return (employees || []).filter(e => isBarberEmployee(e));
  }, [employees]);

  // تصفية موظفي الإحالة وفتح الشغل (حلاق / كوافير - مساعد فقط)
  const referralEmployees = useMemo(() => {
    return (employees || []).filter(e => isReferralEligibleEmployee(e));
  }, [employees]);

  const addToCart = (item: any) => {
    if (isSubscriptionBlocked) {
      alert('الحساب موقوف أو انتهت فترة الاشتراك. النظام يعمل الآن بوضع الاطلاع فقط (Read-Only) ولا يمكن إضافة عناصر للسلة.');
      return;
    }
    if (item.productType === 'raw_material' || (item._isProduct && products.find(p => p.id === item.id)?.productType === 'raw_material')) {
      alert('هذا الصنف مسجل كمادة خام داخلية وغير متاح للبيع المباشر في نقطة البيع.');
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const q = (searchQuery || '').trim().toLowerCase();
      if (!q) return;

      // 1. فحص باركود المنتج المباشر أولاً
      const matchedProduct = products.find(p => p.barcode && p.barcode.trim().toLowerCase() === q);
      if (matchedProduct) {
        if (matchedProduct.productType === 'raw_material') {
          alert('هذا الصنف مسجل كمادة خام (استهلاك صالون) وغير متاح للبيع المباشر.');
          return;
        }
        addToCart({
          ...matchedProduct,
          _isProduct: true,
          displayPrice: matchedProduct.sellPrice || 0,
          originalPrice: matchedProduct.sellPrice || 0
        });
        setSearchQuery('');
        return;
      }

      // 2. فحص باركود الخدمة
      const matchedService = items.find(s => s.barcode && s.barcode.trim().toLowerCase() === q);
      if (matchedService) {
        const isForePrice = Boolean(isForeignerClient && ((matchedService.foreignerPrice && Number(matchedService.foreignerPrice) > 0) || (activeBranchId && matchedService.branchForeignerPrices?.[activeBranchId])));
        const origPrice = getServicePrice(matchedService, activeBranchId, isForeignerClient);
        const rawDisc = Number(matchedService.discountPrice);
        const hasDisc = !isForePrice && !isNaN(rawDisc) && rawDisc > 0 && rawDisc < origPrice;
        const effPrice = hasDisc ? rawDisc : origPrice;

        addToCart({
          ...matchedService,
          _isProduct: false,
          isForeignerPrice: isForePrice,
          displayPrice: effPrice,
          originalPrice: origPrice
        });
        setSearchQuery('');
        return;
      }

      // 3. إذا كان هناك عنصر وحيد مطابق في قائمة البحث الحالية، إضافته فوراً
      if (filteredItems.length === 1) {
        addToCart(filteredItems[0]);
        setSearchQuery('');
      }
    }
  };


  const setDirectQuantity = (cartId: string, val: string | number) => {
    setCart(prev => prev.map(c => {
      if (c.cartId === cartId) {
        if (val === '') {
          return { ...c, quantity: '' as any };
        }
        const parsed = parseInt(String(val), 10);
        const newQty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        const curQ = Number(c.quantity) || 1;
        const newQ = Math.max(1, curQ + delta);
        return { ...c, quantity: newQ };
      }
      return c;
    }));
  };

  const handleUpdateLineDiscount = (cartId: string, discValStr: string) => {
    setCart(prev => prev.map(c => {
      if (c.cartId !== cartId) return c;

      const qty = Math.max(1, Number(c.quantity) || 1);
      const curPrice = getCartItemPrice(c);
      const existingLineDisc = Number(c.discount || c.item?.discount) || 0;
      const origPrice = Number(c.originalPrice || c.item?.originalPrice || (curPrice + (existingLineDisc > 0 ? existingLineDisc / qty : 0)));

      if (discValStr === '') {
        return {
          ...c,
          discount: undefined,
          originalPrice: undefined,
          price: origPrice,
          item: {
            ...c.item,
            price: origPrice,
            displayPrice: origPrice,
            originalPrice: undefined,
            discount: undefined
          }
        };
      }

      const inputVal = parseFloat(discValStr);
      const lineDisc = isNaN(inputVal) || inputVal < 0 ? 0 : Math.min(origPrice * qty, inputVal);
      const perUnitDisc = lineDisc > 0 ? lineDisc / qty : 0;
      const effectivePrice = Math.max(0, origPrice - perUnitDisc);

      return {
        ...c,
        discount: lineDisc > 0 ? lineDisc : undefined,
        originalPrice: lineDisc > 0 ? origPrice : undefined,
        price: effectivePrice,
        item: {
          ...c.item,
          price: effectivePrice,
          displayPrice: effectivePrice,
          originalPrice: lineDisc > 0 ? origPrice : undefined,
          discount: lineDisc > 0 ? lineDisc : undefined
        }
      };
    }));

    // If a line discount was entered, clear overall invoice discount immediately
    if (parseFloat(discValStr) > 0) {
      setDiscount({ type: 'fixed', value: 0 });
    }
  };

  const updateEmployee = (cartId: string, employeeId: string) => {
    setCart(cart.map(c => c.cartId === cartId ? { ...c, employeeId } : c));
  };

  const updateReferralEmployee = (cartId: string, referralEmployeeId: string) => {
    setCart(cart.map(c => c.cartId === cartId ? { ...c, referralEmployeeId } : c));
  };

  const removeFromCart = (cartId: string) => {
    if (!canVoidCart) {
      alert('عذراً، حذف البنود من السلة أو إلغاء الفاتورة يتطلب صلاحية الإلغاء وحذف البنود.');
      return;
    }
    setCart(cart.filter(c => c.cartId !== cartId));
  };

  if (!effectiveIsShiftOpen) {
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
    <div className="flex flex-col lg:flex-row w-full bg-slate-50 overflow-y-auto lg:overflow-hidden lg:h-full">
      {/* Right Section: Items Grid */}
      <div className="order-2 lg:order-none flex-none lg:flex-1 flex flex-col p-4 lg:p-6 lg:overflow-hidden">
        {/* Banner وضع تعديل الفاتورة */}
        {editingInvoice && (
          <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <span className="font-black text-amber-800">أنت في وضع تعديل الفاتورة رقم: <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-bold">{editingInvoice.id}</span></span>
                <span className="text-slate-600 mr-2 text-[11px] hidden sm:inline">
                  (تعديل الخدمات/المنتجات/الموظفين/الخصم/العميل - سيتم تحديث الخزائن بدقة ولن تُكرر المبالغ)
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('هل تريد إلغاء وضع تعديل الفاتورة وتفريغ السلة؟')) {
                  setEditingInvoice(null);
                  clearBooking();
                }
              }}
              className="bg-white hover:bg-amber-100 text-rose-600 border border-amber-200 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs"
            >
              إلغاء التعديل
            </button>
          </div>
        )}

        {/* Search & Action Bar - صف واحد متناسق بدون نزول الأزرار للسطر التالي */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 lg:mb-4 w-full flex-nowrap overflow-x-auto no-scrollbar">
          {/* خانة البحث المرنة بحيث تملأ المساحة المتاحة دون دفع الأزرار */}
          <div className="relative flex-1 min-w-[130px] sm:min-w-[160px] max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="ابحث بالاسم، السعر، أو الباركود..."
              className="w-full h-10 bg-white border border-slate-200 rounded-xl pr-8 pl-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs text-slate-700 truncate"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {/* زر مصروفات السريع بجوار خانة البحث مباشرة */}
          <button
            type="button"
            onClick={handleOpenQuickExpenseModal}
            className="h-10 bg-white hover:bg-rose-50/80 border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-900 px-2.5 sm:px-3 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
            title="تسجيل مصروف سريع جديد بدون مغادرة نقطة البيع"
          >
            <Wallet size={15} className="text-rose-600 shrink-0" />
            <span>مصروفات</span>
          </button>

          {/* زر حضور وانصراف السريع للوردية كجزء من التايم شيت */}
          <button
            type="button"
            onClick={() => setShowAttendanceModal(true)}
            className="h-10 bg-white hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 sm:px-3 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
            title="تسجيل حضور وانصراف الموظفين في التايم شيت لوردية اليوم"
          >
            <UserCheck size={15} className="text-emerald-600 shrink-0" />
            <span>حضور وانصراف</span>
          </button>

          {/* زر تقرير اليومية للوردية */}
          <button
            type="button"
            onClick={() => setShowDailyReportModal(true)}
            className="h-10 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-900 px-2.5 sm:px-3 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
            title="عرض وطباعة تقرير اليومية للوردية الحالية"
          >
            <FileText size={15} className="text-indigo-600 shrink-0" />
            <span>تقرير اليومية</span>
          </button>

          {/* زر تعديل مواعيد الدوام */}
          <button
            type="button"
            onClick={handleOpenScheduleModal}
            className="h-10 bg-white hover:bg-amber-50/70 border border-slate-200 hover:border-amber-200 text-slate-700 hover:text-amber-900 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
            title="تعديل مواعيد حضور وانصراف الموظفين"
          >
            <Clock size={15} className="text-amber-600 shrink-0" />
            <span>مواعيد الدوام</span>
          </button>
        </div>

        
        {/* Type Toggle */}
        <div className="flex gap-2 mb-2 lg:mb-4 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
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

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-4 no-scrollbar">
          {/* زر الكل (All) دائماً في البداية */}
          <button
            onClick={() => setSelectedCategory('all')}
            className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm border cursor-pointer ${
              selectedCategory === 'all' 
                ? 'bg-primary border-primary text-white shadow-primary/20' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            الكل
          </button>

          {/* أزرار التصنيفات التابعة للتبويب النشط */}
          {activeCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm border cursor-pointer ${
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
        <div ref={itemsGridRef} className="lg:flex-1 lg:overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4 pb-4 lg:pb-0">
            {filteredItems.map(item => {
              const isPriority = !item._isProduct && Boolean(item.isPriority);
              const customColor = item.cardColor || '#10b981';
              const isLight = isLightColor(customColor);

              return (
                <button 
                  key={item.id}
                  onClick={() => addToCart(item)}
                  style={isPriority ? { backgroundColor: customColor, borderColor: customColor } : undefined}
                  className={`relative rounded-2xl p-3.5 pt-6 flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 group cursor-pointer overflow-hidden ${
                    isPriority 
                      ? 'shadow-md hover:shadow-xl hover:scale-[1.02] border-2 ring-1 ring-black/10' 
                      : 'bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-primary/30'
                  }`}
                >
                  {isPriority && (
                    <div 
                      className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-xs border z-10"
                      style={{
                        backgroundColor: isLight ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.22)',
                        color: isLight ? '#0f172a' : '#ffffff',
                        borderColor: isLight ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.4)'
                      }}
                    >
                      <Star size={11} className={isLight ? 'text-amber-600 fill-amber-600' : 'text-amber-300 fill-amber-300'} />
                      <span>سريعة</span>
                    </div>
                  )}

                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-2xs overflow-hidden shrink-0"
                    style={isPriority ? { 
                      backgroundColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.2)', 
                      color: isLight ? '#0f172a' : '#ffffff' 
                    } : { 
                      backgroundColor: '#f1f5f9', 
                      color: '#0f766e' 
                    }}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      item._isProduct ? <Package size={22} /> : <Scissors size={22} />
                    )}
                  </div>

                  <div className="w-full">
                    <h4 
                      className="font-extrabold text-xs mb-1 leading-tight line-clamp-2"
                      style={{ color: isPriority ? (isLight ? '#0f172a' : '#ffffff') : '#1e293b' }}
                    >
                      {item.name}
                    </h4>
                    {item.barcode && (
                      <div className="flex justify-center mb-1">
                        <span 
                          className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: isPriority ? (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.2)') : '#f1f5f9',
                            color: isPriority ? (isLight ? '#334155' : 'rgba(255,255,255,0.9)') : '#64748b'
                          }}
                        >
                          <Barcode size={10} />
                          <span>{item.barcode}</span>
                        </span>
                      </div>
                    )}
                    {item.isForeignerPrice ? (
                      <div className="flex flex-col items-center">
                        <p 
                          className="font-black text-xs font-mono"
                          style={{ color: isPriority ? (isLight ? '#047857' : '#a7f3d0') : '#0f766e' }}
                        >
                          {item.displayPrice} {settings.currency}
                        </p>
                        <span 
                          className="text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5"
                          style={{
                            backgroundColor: isPriority ? (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.25)') : '#fef3c7',
                            color: isPriority ? (isLight ? '#78350f' : '#fef3c7') : '#92400e'
                          }}
                        >
                          سعر أجنبي
                        </span>
                      </div>
                    ) : item.hasDiscount ? (
                      <div className="flex flex-col items-center">
                        <p 
                          className="font-black text-xs font-mono"
                          style={{ color: isPriority ? (isLight ? '#047857' : '#a7f3d0') : '#059669' }}
                        >
                          {item.discountPrice} {settings.currency}
                        </p>
                        <p 
                          className="text-[10px] line-through font-mono"
                          style={{ color: isPriority ? (isLight ? '#64748b' : 'rgba(255, 255, 255, 0.65)') : '#94a3b8' }}
                        >
                          {item.originalPrice} {settings.currency}
                        </p>
                      </div>
                    ) : (
                      <p 
                        className="font-extrabold text-xs font-mono"
                        style={{ color: isPriority ? (isLight ? '#0f172a' : '#ffffff') : '#0f766e' }}
                      >
                        {item.originalPrice} {settings.currency}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Left Section: Cart & Payment (Enlarged & Re-engineered) */}
      <div className="order-1 lg:order-none w-full lg:w-[420px] lg:max-w-[460px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 shadow-xl z-10 flex flex-col lg:h-full lg:overflow-hidden">
        
        {/* Banner وضع تعديل الفاتورة في السلة */}
        {editingInvoice && (
          <div className="bg-amber-500 text-white p-2.5 px-3 flex items-center justify-between gap-2 text-xs font-bold shrink-0 shadow-inner border-b border-amber-600 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">تعديل فاتورة</span>
              <span className="truncate font-mono">#{editingInvoice.id}</span>
              <span className="text-[10px] bg-amber-700/60 px-1.5 py-0.5 rounded">
                {editingInvoice.date.split('T')[0]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('هل تريد إلغاء وضع تعديل الفاتورة وتفريغ السلة؟')) {
                  setEditingInvoice(null);
                  clearBooking();
                }
              }}
              className="bg-white text-amber-800 hover:bg-amber-50 px-2 py-0.5 rounded-lg text-[11px] font-black shrink-0 transition-colors cursor-pointer shadow-xs"
            >
              إلغاء التعديل
            </button>
          </div>
        )}

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

            {canMakeSalesReturn && (
              <button
                onClick={() => {
                  setPosReturnSearch('');
                  setShowPOSReturnInvoicePicker(true);
                }}
                className="bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title="مرتجع مبيعات - تسجيل مرتجع لفاتورة وطباعة إشعار دائن"
              >
                <RotateCcw size={14} />
                <span>مرتجع</span>
              </button>
            )}
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

        {/* Active Held Invoice Banner */}
        {activeHeldInvoiceId && (
          <div className="px-3 py-2 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-50 border-b border-amber-300 flex items-center justify-between gap-2 text-xs font-bold text-amber-950 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              <div className="truncate">
                <span className="font-black text-amber-900 inline-flex items-center gap-1">
                  <Zap size={13} className="text-amber-600 shrink-0" />
                  <span>فاتورة معلقة مفتوحة:</span>
                </span>
                <span className="mr-1 text-slate-800 font-semibold">
                  {selectedClient?.name || clientSearch || 'عميل نقدي'}
                </span>
              </div>
            </div>
            <button
              onClick={handleHoldCurrentInvoice}
              className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer shadow-xs transition-all active:scale-95 shrink-0 flex items-center gap-1"
              title="حفظ الفاتورة الحالية في الفواتير المعلقة وإفراغ شاشة الكاشير"
            >
              <PauseCircle size={13} />
              <span>حفظ كمعلقة والرجوع</span>
            </button>
          </div>
        )}

        {/* 2. Client Select Header */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2">
            {!selectedClient ? (
              <div ref={searchContainerRef} className="relative flex-1 flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="رقم العميل للبحث أو الإضافة..."
                    className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold focus:outline-none focus:border-primary transition-colors font-mono"
                    value={clientSearch}
                    onFocus={() => setShowSuggestions(true)}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowSuggestions(true);
                      setHighlightedIndex(-1);
                    }}
                    onKeyDown={(e) => {
                      if (showSuggestions && phoneSuggestions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedIndex(prev => (prev < phoneSuggestions.length - 1 ? prev + 1 : 0));
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : phoneSuggestions.length - 1));
                          return;
                        }
                        if (e.key === 'Enter' && highlightedIndex >= 0 && phoneSuggestions[highlightedIndex]) {
                          e.preventDefault();
                          handleSelectClient(phoneSuggestions[highlightedIndex]);
                          return;
                        }
                        if (e.key === 'Escape') {
                          setShowSuggestions(false);
                          return;
                        }
                      }
                      if (e.key === 'Enter') {
                        handleClientSearch();
                      }
                    }}
                  />

                  {/* القائمة المنسدلة للإكمال التلقائي لأرقام العملاء */}
                  {showSuggestions && clientSearch.trim().length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-72 flex flex-col animate-in fade-in-50 slide-in-from-top-2 duration-150">
                      <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Zap size={12} className="text-amber-500" />
                          <span>عملاء الصالون المطابقون:</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono text-[10px]">
                          {phoneSuggestions.length}
                        </span>
                      </div>

                      <div className="overflow-y-auto divide-y divide-slate-100 max-h-56 custom-scrollbar">
                        {phoneSuggestions.map((client, idx) => {
                          const isHighlighted = idx === highlightedIndex;
                          const tier = getClientTier(client, invoices, settings.tierSettings);
                          const cashbackVal = client.cashback !== undefined ? client.cashback : (client.loyaltyPoints || 0);

                          return (
                            <button
                              key={client.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectClient(client);
                              }}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              className={`w-full text-right p-2.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                isHighlighted ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                                  {client.name.charAt(0) || <User size={14} className="text-slate-400" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-xs text-slate-900 truncate">{client.name}</span>
                                    {tier && (
                                      <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-md ${tier.badgeBg} ${tier.badgeText} shrink-0`}>
                                        {tier.name}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1" dir="ltr">
                                    <span>{client.phone}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="text-left shrink-0">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 font-mono block">
                                  كاش باك: {cashbackVal.toFixed(0)} {settings.currency}
                                </span>
                              </div>
                            </button>
                          );
                        })}

                        {/* خيار تسجيل عميل جديد بالرقم المكتوب */}
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setShowSuggestions(false);
                            setNewClientForm(prev => ({ ...prev, phone: clientSearch.replace(/[^0-9]/g, '') }));
                            setShowAddClientModal(true);
                          }}
                          className="w-full text-right p-2.5 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-800 flex items-center justify-between gap-2 transition-colors cursor-pointer text-xs font-bold"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus size={14} className="text-emerald-600" />
                            <span>إضافة عميل جديد بالرقم: <strong className="font-mono" dir="ltr">{clientSearch}</strong></span>
                          </span>
                          <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                            تسجيل جديد +
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-black text-slate-900 truncate">{selectedClient.name}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                          selectedClient.clientType === 'foreigner' 
                            ? 'bg-amber-100/90 text-amber-900 border border-amber-300' 
                            : 'bg-emerald-100/90 text-emerald-900 border border-emerald-300'
                        }`}>
                          {selectedClient.clientType === 'foreigner' ? 'أجنبي' : 'مواطن'}
                        </span>
                        {clientTier && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-0.5 ${clientTier.badgeBg} ${clientTier.badgeText} ${clientTier.badgeBorder}`}>
                            <span>{clientTier.icon}</span>
                            <span>{clientTier.name}</span>
                            {clientTier.discountPercentage > 0 && <span>({clientTier.discountPercentage}%)</span>}
                          </span>
                        )}
                        {clientTierProgression && !clientTierProgression.isMaxTier && clientTierProgression.nextTier && (
                          <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.2 rounded-md truncate max-w-[180px]" title={`متبقي ${clientTierProgression.amountNeeded.toFixed(0)} ${settings.currency} للترقية إلى ${clientTierProgression.nextTier.name}`}>
                            متبقي {clientTierProgression.amountNeeded.toFixed(0)} {settings.currency} إلى {clientTierProgression.nextTier.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono font-bold text-slate-500" dir="ltr">{selectedClient.phone}</p>

                      {/* Quick preferences preview chips if any */}
                      {selectedClient.preferences && (selectedClient.preferences.favoriteBeverage || selectedClient.preferences.shavingMethod || selectedClient.preferences.skinSensitivities) && (
                        <div 
                          onClick={handleOpenPreferencesModal}
                          className="flex flex-wrap gap-1 mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                          title="انقر لتعديل تفضيلات العميل"
                        >
                          {selectedClient.preferences.shavingMethod && (
                            <span className="text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Scissors size={10} className="text-indigo-600" />
                              <span>{selectedClient.preferences.shavingMethod === 'machine' ? 'ماكينة' : selectedClient.preferences.shavingMethod === 'blade' ? 'موس' : selectedClient.preferences.shavingMethod === 'scissors_only' ? 'مقص' : 'مدمج'}</span>
                            </span>
                          )}
                          {selectedClient.preferences.favoriteBeverage && (
                            <span className="text-[8px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Coffee size={10} className="text-amber-700" />
                              <span>{selectedClient.preferences.favoriteBeverage}</span>
                            </span>
                          )}
                          {selectedClient.preferences.skinSensitivities && (
                            <span className="text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <AlertTriangle size={10} className="text-rose-600" />
                              <span>حساسية بشرة</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { setSelectedClient(null); setClientSearch(''); setDiscount({ type: 'fixed', value: 0 }); }} className="text-slate-400 hover:text-red-500 p-1 transition-colors">
                    <X size={14} />
                  </button>
                </div>

                {/* Client preferences button & points bar */}
                <div className="flex items-center justify-between text-[9px] bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 font-bold gap-2">
                  <button
                    type="button"
                    onClick={handleOpenPreferencesModal}
                    className="flex items-center gap-1 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-200/90 px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
                    title="عرض وتعديل تفضيلات الحلاقة والضيافة للعميل"
                  >
                    <Sliders size={11} className="text-indigo-600 shrink-0" />
                    <span>تفضيلات العميل</span>
                    {selectedClient.preferences && Object.values(selectedClient.preferences).some(v => !!v) ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[8px] px-1 rounded-full font-black">مسجلة</span>
                    ) : (
                      <Edit3 size={10} className="text-slate-400" />
                    )}
                  </button>

                  <span className="text-purple-700 shrink-0">
                    كاش باك: <strong className="font-mono">{(selectedClient.cashback !== undefined ? selectedClient.cashback : selectedClient.loyaltyPoints || 0).toFixed(1)} {settings.currency}</strong>
                  </span>
                </div>
              </div>
            )}
            
            {activeQueueNumber && (
              <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 px-2.5 py-1 rounded-xl border border-amber-500/30 text-xs font-black font-mono">
                <Ticket size={12} className="text-amber-700" />
                <span>دور #{activeQueueNumber}</span>
                <button 
                  type="button" 
                  onClick={() => setActiveQueueNumber(null)} 
                  className="hover:text-red-600 cursor-pointer"
                  title="إخفاء شارة الدور"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            
            {(initialBooking || activeBookingId) && (
              <button onClick={clearBooking} title="إلغاء الحجز الحالي" className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
          {(initialBooking || activeBookingId || advanceDeduction > 0) && (
            <div className="flex flex-col gap-1 mt-1.5">
              <div className="bg-emerald-50 text-emerald-800 text-[11px] px-3 py-1.5 rounded-xl font-bold flex justify-between items-center border border-emerald-200">
                <span className="flex items-center gap-1.5">
                  <Wallet size={13} className="text-emerald-700" />
                  <span>المدفوع مقدماً (عربون الحجز):</span>
                </span>
                <span className="font-mono text-xs font-black text-emerald-700">-{(Number(advanceDeduction) || 0).toFixed(2)} {settings.currency}</span>
              </div>
              {activeAdvancePayments.length > 0 && (
                <div className="text-[10px] text-emerald-600 px-1 font-semibold flex flex-wrap gap-1">
                  {activeAdvancePayments.map((adv, idx) => (
                    <span key={adv.id || idx} className="bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200">
                      {adv.treasuryName || adv.paymentMethod || 'دفعة'}: {adv.amount} {settings.currency}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Cart Items List (Enlarged & Spacious) */}
        <div className="lg:flex-1 lg:overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-slate-50/40">
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
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 ${c.type === 'product' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                          {c.type === 'product' ? <Package size={10} /> : <Scissors size={10} />}
                          <span>{c.type === 'product' ? 'منتج' : 'خدمة'}</span>
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
                              className="px-1 py-0.5 text-slate-400 hover:text-slate-600 cursor-pointer flex items-center justify-center"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p 
                              className={`text-primary font-black text-xs ${canEditItemPrice ? 'cursor-pointer hover:underline flex items-center' : ''}`}
                              onClick={() => {
                                if (canEditItemPrice) {
                                  setEditingCartId(c.cartId);
                                  setCustomPriceInput(getCartItemPrice(c));
                                }
                              }}
                              title={canEditItemPrice ? "انقر لتعديل السعر في الفاتورة" : undefined}
                            >
                              <span>{getCartItemPrice(c)} {settings.currency}</span>
                              {canEditItemPrice && <Edit3 size={10} className="text-slate-400 mr-1" />}
                            </p>
                            {((c.item?.originalPrice && c.item.originalPrice > getCartItemPrice(c)) || (Number(c.discount || c.item?.discount) > 0)) && (
                              <span className="text-[10px] text-slate-400 line-through font-mono">
                                {(c.item?.originalPrice || (getCartItemPrice(c) + Number(c.discount || c.item?.discount || 0))).toFixed(2)}
                              </span>
                            )}
                            {(Number(c.discount || c.item?.discount) > 0 || (c.item?.originalPrice && c.item.originalPrice > getCartItemPrice(c))) && (
                              <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 font-extrabold px-1.5 py-0.5 rounded-md">
                                خصم: -{(Number(c.discount || c.item?.discount) || (c.item?.originalPrice - getCartItemPrice(c))).toFixed(2)} {settings.currency}
                              </span>
                            )}
                            {c.quantity > 1 && (
                              <span className="text-[10px] text-slate-400 font-bold">
                                (الإجمالي: {(getCartItemPrice(c) * (c.quantity || 1)).toFixed(2)} {settings.currency})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                        <button onClick={() => updateQuantity(c.cartId, 1)} className="p-1 text-slate-700 hover:text-primary transition-colors" title="زيادة الكمية"><Plus size={12} /></button>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={c.quantity === '' ? '' : c.quantity}
                          onChange={(e) => setDirectQuantity(c.cartId, e.target.value)}
                          onBlur={() => {
                            if (!c.quantity || Number(c.quantity) < 1) {
                              setDirectQuantity(c.cartId, 1);
                            }
                          }}
                          className="w-12 text-center text-xs font-black font-mono bg-white border border-slate-200 rounded px-0.5 py-0.5 outline-none focus:border-primary text-slate-900"
                          title="الكمية (يمكن كتابة الرقم مباشرة كـ 100 أو غيره)"
                        />
                        <button onClick={() => updateQuantity(c.cartId, -1)} className="p-1 text-slate-700 hover:text-red-500 transition-colors" title="إنقاص الكمية"><Minus size={12} /></button>
                      </div>
                      {canVoidCart ? (
                        <button onClick={() => removeFromCart(c.cartId)} className="text-slate-400 hover:text-red-500 p-1 transition-colors" title="حذف البند من السلة">
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="text-slate-300 p-1 cursor-not-allowed opacity-40" title="لا تملك صلاحية حذف البنود من السلة">
                          <Trash2 size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Performer & Referral (فتح شغل) Controls Row */}
                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
                    {/* 1. Performer */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                        <Scissors size={10} className="text-slate-400" />
                        <span>الفني المنفذ:</span>
                      </label>
                      <select 
                        className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-full outline-none focus:border-primary cursor-pointer transition-colors font-semibold"
                        value={c.employeeId}
                        onChange={(e) => updateEmployee(c.cartId, e.target.value)}
                      >
                        <option value="">اختر المنفذ...</option>
                        {performerEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                        {c.employeeId && !performerEmployees.some(e => e.id === c.employeeId) && (
                          <option value={c.employeeId}>
                            {employees.find(e => e.id === c.employeeId)?.name || c.employeeId}
                          </option>
                        )}
                      </select>
                    </div>

                    {/* 2. Referral / فتح شغل */}
                    {c.type === 'service' ? (
                      <div>
                        <label className="block text-[9px] font-bold text-amber-800 mb-0.5 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Zap size={10} className="text-amber-600" />
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
                          {referralEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                          {c.referralEmployeeId && !referralEmployees.some(e => e.id === c.referralEmployeeId) && (
                            <option value={c.referralEmployeeId}>
                              {employees.find(e => e.id === c.referralEmployeeId)?.name || c.referralEmployeeId}
                            </option>
                          )}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 self-end pb-1 font-bold">
                        <Package size={11} className="text-slate-400" />
                        <span>منتج بيع مباشر</span>
                      </div>
                    )}
                  </div>

                  {/* 3. Service / Product Discount Row */}
                  {(c.type === 'service' || c.type === 'product') && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs">
                      <label className="text-[10px] font-bold text-rose-700 flex items-center gap-1 shrink-0">
                        <Tag size={10} className="text-rose-600" />
                        <span>خصم {c.type === 'product' ? 'المنتج' : 'الخدمة'}:</span>
                        {hasOverallDiscount && (
                          <span className="text-[9px] text-amber-700 bg-amber-100/90 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                            معطل (خصم شامل)
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={hasOverallDiscount || !canApplyDiscount || !!appliedPromo || isRemedyInvoice || isWaselInvoice}
                          value={c.discount || ''}
                          onChange={(e) => handleUpdateLineDiscount(c.cartId, e.target.value)}
                          placeholder="0"
                          className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold outline-none focus:border-rose-400 disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                          title={hasOverallDiscount ? "معطل لوجود خصم شامل على الفاتورة" : (!canApplyDiscount ? "ليس لديك صلاحية لتعديل الخصم" : `خصم على إجمالي ${c.type === 'product' ? 'هذا المنتج' : 'هذه الخدمة'}`)}
                        />
                        <span className="text-[10px] text-slate-500 font-bold">{settings.currency}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 4. Compact Summary & Checkout Bottom Bar */}
        <div className="bg-white border-t border-slate-200 p-3 space-y-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] shrink-0">
          
          {/* Quick Options Bar (Warranty, Wasel & Photos) */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 text-[10px]">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isRemedyInvoice}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsRemedyInvoice(checked);
                    if (checked) {
                      setIsWaselInvoice(false);
                    }
                  }}
                  className="w-3.5 h-3.5 text-purple-600 rounded"
                />
                <span className="font-black text-purple-950 flex items-center gap-1">
                  <Wrench size={12} className="text-purple-700" />
                  <span>إصلاح مجاني (ضمان)</span>
                </span>
              </label>

              <label className="flex items-center gap-1 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isWaselInvoice}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsWaselInvoice(checked);
                    if (checked) {
                      setIsRemedyInvoice(false);
                      if (!waselRecipientName && selectedClient?.name) {
                        setWaselRecipientName(selectedClient.name);
                      }
                      setShowWaselModal(true);
                    }
                  }}
                  className="w-3.5 h-3.5 text-amber-600 rounded"
                />
                <span className="font-black text-amber-950 flex items-center gap-1">
                  <Gift size={12} className="text-amber-600" />
                  <span>واصل (مجاني)</span>
                </span>
              </label>

              {isWaselInvoice && (
                <button
                  type="button"
                  onClick={() => setShowWaselModal(true)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors flex items-center gap-1 ${
                    waselRecipientName.trim() && waselReason.trim() 
                      ? 'bg-amber-50 text-amber-800 border-amber-300' 
                      : 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                  }`}
                  title="تعديل بيانات واصل (المستفيد والسبب)"
                >
                  <Edit3 size={10} />
                  <span>{waselRecipientName.trim() ? `${waselRecipientName.trim().slice(0, 10)}...` : 'إكمال البيانات *'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <label className={`cursor-pointer px-1.5 py-0.5 rounded-lg text-[9px] font-black border transition-colors flex items-center gap-1 ${beforePhotoUrl ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                <Camera size={11} className={beforePhotoUrl ? 'text-emerald-700' : 'text-slate-500'} />
                <span>{beforePhotoUrl ? <span className="inline-flex items-center gap-0.5"><span>قبل</span><Check size={10} /></span> : '+ صورة قبل'}</span>
                <input type="file" accept="image/*" onChange={e => handleInvoicePhotoUpload(e, 'before')} className="hidden" />
              </label>
              <label className={`cursor-pointer px-1.5 py-0.5 rounded-lg text-[9px] font-black border transition-colors flex items-center gap-1 ${afterPhotoUrl ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                <Camera size={11} className={afterPhotoUrl ? 'text-emerald-700' : 'text-slate-500'} />
                <span>{afterPhotoUrl ? <span className="inline-flex items-center gap-0.5"><span>بعد</span><Check size={10} /></span> : '+ صورة بعد'}</span>
                <input type="file" accept="image/*" onChange={e => handleInvoicePhotoUpload(e, 'after')} className="hidden" />
              </label>
            </div>
          </div>

          {/* Wasel Active Notification Banner */}
          {isWaselInvoice && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-2 text-xs text-amber-900 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-1.5 truncate">
                <div className="p-1 bg-amber-200/80 rounded-lg text-amber-800 shrink-0">
                  <Gift size={13} />
                </div>
                <div className="truncate text-[11px]">
                  <strong className="text-amber-950">فاتورة واصل مجانية:</strong>{' '}
                  <span className="font-bold text-amber-800">{waselRecipientName.trim() ? `المستفيد (${waselRecipientName.trim()})` : 'يرجى كتابة اسم المستفيد *'}</span>{' '}
                  <span className="text-slate-400">|</span>{' '}
                  <span className="text-slate-600">{waselReason.trim() ? waselReason.trim() : 'يرجى كتابة السبب *'}</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowWaselModal(true)} 
                className="text-[10px] font-black bg-amber-200/70 hover:bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md transition-colors shrink-0 mr-1"
              >
                تعديل
              </button>
            </div>
          )}

          {/* Compact Calculations Grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>المجموع:</span>
              <span className="font-bold font-mono text-slate-800">{subtotal.toFixed(2)} {settings.currency}</span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span className="flex items-center gap-1">
                <span>الخصم:</span>
                {appliedPromo && (
                  <span className="text-[10px] text-amber-700 bg-amber-100/90 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                    معطل (برومو كود)
                  </span>
                )}
                {hasLineDiscounts && (
                  <span className="text-[10px] text-amber-700 bg-amber-100/90 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                    معطل (خصم خدمات)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1" title={hasLineDiscounts ? "معطل لوجود خصم على مستوى الخدمات" : (appliedPromo ? "لا يُسمح بعمل خصم يدوي عند استخدام برومو كود" : (!canApplyDiscount ? "ليس لديك صلاحية لتعديل أو منح الخصم" : undefined))}>
                <input 
                  type="number" 
                  disabled={isRemedyInvoice || isWaselInvoice || !canApplyDiscount || !!appliedPromo || hasLineDiscounts}
                  value={(isRemedyInvoice || isWaselInvoice) ? subtotal : (appliedPromo || hasLineDiscounts ? 0 : (discount.value || ''))}
                  onChange={(e) => {
                    if (!canApplyDiscount || appliedPromo || hasLineDiscounts) return;
                    setDiscount({...discount, value: Number(e.target.value)});
                  }}
                  className="w-12 border border-slate-200 rounded px-1 py-0.5 text-center text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed font-mono font-bold"
                  placeholder="0"
                />
                <select 
                  disabled={isRemedyInvoice || isWaselInvoice || !canApplyDiscount || !!appliedPromo || hasLineDiscounts}
                  value={discount.type}
                  onChange={(e) => {
                    if (!canApplyDiscount || appliedPromo || hasLineDiscounts) return;
                    setDiscount({...discount, type: e.target.value as 'percentage'|'fixed'});
                  }}
                  className="border border-slate-200 rounded px-0.5 text-[10px] outline-none cursor-pointer disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="fixed">{settings.currency}</option>
                  <option value="percentage">%</option>
                </select>
              </div>
            </div>

            {settings.vatEnabled && !isRemedyInvoice && !isWaselInvoice && (
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>الضريبة ({settings.vatRate}%):</span>
                <span className="font-bold font-mono">{vatAmount.toFixed(2)}</span>
              </div>
            )}

            {advanceDeduction > 0 && !isRemedyInvoice && !isWaselInvoice && (
              <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded-md text-[11px] font-bold border border-emerald-200/60">
                <span>المدفوع مقدماً (عربون الحجز):</span>
                <span className="font-mono font-black text-emerald-800">-{advanceDeduction.toFixed(2)} {settings.currency}</span>
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
                  disabled={isRemedyInvoice || isWaselInvoice}
                  onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="برومو كود (مثل TEMO25)..."
                  className="flex-1 px-2.5 py-1 bg-white border border-purple-200 rounded-lg text-xs font-mono font-bold uppercase outline-none focus:border-purple-500 disabled:bg-slate-100 disabled:opacity-60"
                  onKeyDown={e => { if (e.key === 'Enter') handleApplyPromoCode(); }}
                />
                <button
                  type="button"
                  disabled={isRemedyInvoice || isWaselInvoice}
                  onClick={handleApplyPromoCode}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  تطبيق
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-bold text-purple-900 bg-purple-100/80 px-2 py-1 rounded-lg">
                  <span className="flex items-center gap-1">
                    <Tag size={13} className="text-purple-700" />
                    <span>تم تطبيق الكود: <strong>{appliedPromo.code}</strong> (-{promoDiscountAmount.toFixed(2)} {settings.currency})</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="text-purple-600 hover:text-red-600 p-0.5 cursor-pointer flex items-center justify-center"
                    title="إلغاء البرومو كود"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-bold">
                  * تم إيقاف الخصم اليدوي ولا يُحتسب كاش باك على هذه الفاتورة.
                </div>
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
          {!appliedPromo && clientTier && clientTier.discountPercentage > 0 && discount.value === clientTier.discountPercentage && discount.type === 'percentage' && !isRemedyInvoice && !isWaselInvoice && (
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
                alert('عذراً، لا يمكن إصدار فواتير جديدة نظراً لانتهاء الفترة التجريبية للصالون. يرجى تجديد الاشتراك مع الإدارة.');
                return;
              }
              if (isWaselInvoice) {
                if (!waselRecipientName.trim()) {
                  alert('يرجى كتابة اسم الشخص الذي حصل على خدمات مجانية (واصل)');
                  setShowWaselModal(true);
                  return;
                }
                if (!waselReason.trim()) {
                  alert('يرجى كتابة ملاحظة وسبب تقديم الفاتورة مجاناً (واصل)');
                  setShowWaselModal(true);
                  return;
                }
              }
              if (cart.length > 0) {
                if (!tipEmployeeId) {
                  setTipEmployeeId(cart[0]?.employeeId || 'unspecified');
                }
                setShowPaymentModal(true);
              }
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

              {isWaselInvoice ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">طريقة السداد المحددة:</label>
                    <div className="flex items-center justify-between p-4 border-2 border-amber-500 bg-amber-50/80 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                        <div>
                          <div className="font-black text-amber-950 text-sm flex items-center gap-1.5">
                            <Gift size={16} className="text-amber-600" />
                            <span>واصل (خدمات مجانية بالكامل)</span>
                          </div>
                          <div className="text-[11px] text-amber-800 font-bold mt-1">
                            <span>المستفيد: <strong>{waselRecipientName.trim()}</strong></span>
                            <span className="mx-1.5 text-amber-400">|</span>
                            <span>السبب: {waselReason.trim()}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl text-xs border border-emerald-300">
                        0.00 {settings.currency}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowWaselModal(true)}
                      className="text-xs text-amber-800 underline font-black hover:text-amber-950 inline-flex items-center gap-1.5 cursor-pointer py-1 px-3 rounded-lg hover:bg-amber-100/50 transition-colors"
                    >
                      <Edit3 size={13} />
                      <span>تعديل بيانات واصل (المستفيد / السبب)</span>
                    </button>
                  </div>
                </div>
              ) : isRemedyInvoice ? (
                <div className="bg-purple-50 border border-purple-300 rounded-2xl p-4 text-center space-y-3">
                  <div className="inline-flex p-3 rounded-full bg-purple-100 text-purple-700 shadow-xs">
                    <Wrench size={28} />
                  </div>
                  <div>
                    <h4 className="font-black text-purple-950 text-sm">فاتورة إصلاح مجاني (ضمان الصالون)</h4>
                    <p className="text-[11px] text-purple-800">صافي المطلوب سداده: 0.00 {settings.currency}</p>
                  </div>
                  <p className="text-xs text-purple-900 bg-white/80 p-3 rounded-xl border border-purple-200 font-medium">
                    {remedyReason || 'إصلاح مجاني بناءً على ضمان الصالون'}
                  </p>
                </div>
              ) : (
                <>
                  {/* اختيار نوع السداد: فوري كلي / جزئي آجل / مؤجل بالكامل */}
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-center mb-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('full')}
                      className={`py-2 px-1 text-xs font-black rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMode === 'full' 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <CheckCircle size={15} />
                      <span>سداد فوري كلي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('partial')}
                      className={`py-2 px-1 text-xs font-black rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMode === 'partial' 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <Clock size={15} />
                      <span>سداد جزئي + آجل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('deferred')}
                      className={`py-2 px-1 text-xs font-black rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMode === 'deferred' 
                          ? 'bg-amber-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <Hourglass size={15} />
                      <span>مؤجلة بالكامل</span>
                    </button>
                  </div>

              {/* تنبيه ضرورة تحديد العميل للفواتير الآجلة والجزئية */}
              {(paymentMode === 'deferred' || paymentMode === 'partial') && (!selectedClient || !selectedClient.name || selectedClient.name === 'عميل نقدي') && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">تنبيه ذمم العملاء:</p>
                    <p className="font-medium text-[11px] mt-0.5">يجب اختيار عميل مسجل وتحديد رقم هاتفه لمتابعة الذمة والمطالبات بدقة. العميل الحالي: <span className="underline">{selectedClient?.name || clientSearch || 'عميل نقدي'}</span></p>
                  </div>
                </div>
              )}

              {/* شاشة الفاتورة المؤجلة بالكامل */}
              {paymentMode === 'deferred' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-2">
                    <div className="inline-flex p-2 rounded-full bg-amber-100 text-amber-700">
                      <Hourglass size={24} />
                    </div>
                    <h4 className="font-extrabold text-amber-900 text-sm">فاتورة مؤجلة بالكامل (سداد لاحقاً)</h4>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      سيتم قيد كامل المبلغ <span className="font-mono font-black text-amber-950 text-sm">({finalTotal.toFixed(2)} {settings.currency})</span> كدين مستحق في قسم الفواتير الآجلة على العميل <span className="font-bold underline">{selectedClient?.name || clientSearch || 'عميل نقدي'}</span>، ولن يتم تسجيل أي حركة قبض في الخزائن حالياً.
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الاستحقاق المتوقع (اختياري):</label>
                      <input 
                        type="date"
                        value={deferredDueDate}
                        onChange={e => setDeferredDueDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الذمة والتأجيل:</label>
                      <input 
                        type="text"
                        placeholder="سبب التأجيل، اتفاق السداد..."
                        value={deferredNotes}
                        onChange={e => setDeferredNotes(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* شاشة السداد الجزئي */}
              {paymentMode === 'partial' && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-blue-900">المبلغ المدفوع الآن نقدياً/فيزا:</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0.5"
                          max={finalTotal - 0.01}
                          step="any"
                          value={partialPaidAmount}
                          onChange={e => setPartialPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder={(finalTotal / 2).toFixed(2)}
                          className="w-28 px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-left font-mono font-black text-sm text-blue-700 focus:border-blue-600 outline-none"
                        />
                        <span className="text-xs text-blue-800 font-bold">{settings.currency}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-white/80 p-2.5 rounded-xl border border-blue-100">
                      <span className="text-slate-600 font-bold">المتبقي الآجل المستحق لاحقاً:</span>
                      <span className="font-mono text-sm font-black text-red-600">
                        {Math.max(0, finalTotal - (Number(partialPaidAmount) || 0)).toFixed(2)} {settings.currency}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ الاستحقاق:</label>
                        <input 
                          type="date"
                          value={deferredDueDate}
                          onChange={e => setDeferredDueDate(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات الذمة:</label>
                        <input 
                          type="text"
                          placeholder="ملاحظات..."
                          value={deferredNotes}
                          onChange={e => setDeferredNotes(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">خزينة سداد الدفعة المدفوعة حالياً ({Number(partialPaidAmount) || 0} {settings.currency}):</label>
                    <div className="grid grid-cols-2 gap-2">
                      {settings.treasuries.map(t => (
                        <label key={t.id} className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-all ${singleTreasury === t.id ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500/20' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
                          <div className="flex items-center gap-2">
                            <input type="radio" name="partial_treasury" value={t.id} checked={singleTreasury === t.id} onChange={() => setSingleTreasury(t.id)} className="w-3.5 h-3.5 text-blue-600" />
                            <span>{t.name}</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${t.isMain ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                            {t.isMain ? 'رئيسية' : 'فرعية'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* شاشة السداد الفوري الكامل (الوضع المعتاد) */}
              {paymentMode === 'full' && (
                <>
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
                            value={tipEmployeeId || 'unspecified'}
                            onChange={e => setTipEmployeeId(e.target.value)}
                            className="w-full bg-white border border-purple-300 rounded-xl px-3 py-1.5 text-xs font-bold text-purple-950 outline-none focus:border-purple-600 shadow-2xs"
                          >
                            <option value="unspecified">غير محدد (إكرامية عامة للصالون)</option>
                            {employees.filter(e => e.isActive !== false).map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                          </select>
                        </div>

                        {(tipEmployeeId === 'unspecified' || !tipEmployeeId) ? (
                          <div className="text-[11px] font-semibold p-2.5 rounded-xl border flex items-center gap-1.5 bg-purple-100/70 border-purple-300 text-purple-950">
                            <Sparkles size={14} className="text-purple-700 shrink-0" />
                            <span>إكرامية عامة للصالون: لا تُخصص لأي موظف وتُسجل كإيراد عام للصالون (لن يتم خصم أي مبالغ من درج الكاش).</span>
                          </div>
                        ) : (
                          <div className="text-[11px] font-semibold p-2.5 rounded-xl border flex items-center gap-1.5" style={{
                            backgroundColor: (settings.tipPayoutMethod || 'instant_cash') === 'instant_cash' ? '#ecfdf5' : '#eef2ff',
                            borderColor: (settings.tipPayoutMethod || 'instant_cash') === 'instant_cash' ? '#a7f3d0' : '#c7d2fe',
                            color: (settings.tipPayoutMethod || 'instant_cash') === 'instant_cash' ? '#065f46' : '#3730a3'
                          }}>
                            {(settings.tipPayoutMethod || 'instant_cash') === 'instant_cash' ? (
                              <>
                                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                                  <span>الصرف الفوري: يُخصم البقشيش فوراً نقداً من درج الكاش لتسليمه للموظف، وتُسجل الفيزا بكامل المبلغ ({receivedNum.toFixed(2)} {settings.currency}).</span>
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock size={14} className="text-indigo-600 shrink-0" />
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0"></span>
                                  <span>الصرف المؤجل: يُسجل البقشيش كرصيد مجمع للموظف ويُصرف لاحقاً من الخزينة المحددة.</span>
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {(() => {
                    const maxCashback = selectedClient 
                      ? Number(selectedClient.cashback !== undefined ? selectedClient.cashback : selectedClient.loyaltyPoints || 0) 
                      : 0;
                    
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
                            {settings.tierSettings?.allowTierDiscountWithCashback === false && discount.value > 0 && (
                              <p className="text-[10px] text-amber-800 font-bold mt-1.5 flex items-center gap-1">
                                <AlertCircle size={12} className="text-amber-700 shrink-0" />
                                <span>سياسة الصالون: لا يُجمع بين خصم المستوى التلقائي ({discount.value}%) وسداد كامل الفاتورة بالكاش باك.</span>
                              </p>
                            )}
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
                </>
              )}
              </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
              {/* زر سداد الفاتورة وإغلاق النافذة مباشرة بدون فتح شاشة المعاينة */}
              <button 
                type="button"
                disabled={isSubmittingPayment}
                onClick={() => handleConfirmPayment(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 font-extrabold py-3 px-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-xs"
                title="إتمام وحفظ الفاتورة بدون طباعة"
              >
                {isSubmittingPayment ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <X size={16} />
                )}
                <span>
                  {isWaselInvoice ? 'تأكيد وحفظ واصل' : (isRemedyInvoice ? 'حفظ الضمان وإغلاق' : (paymentMode === 'deferred' ? 'تأجيل وإغلاق' : paymentMode === 'partial' ? 'سداد الدفعة وإغلاق' : 'سداد وإغلاق'))}
                </span>
              </button>

              {/* زر سداد وطباعة الفاتورة مباشرة على الطابعة الافتراضية */}
              <button 
                type="button"
                disabled={isSubmittingPayment}
                onClick={() => handleConfirmPayment(true)}
                className={`flex-[1.4] disabled:opacity-50 text-white font-black py-3 px-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-xs ${
                  isWaselInvoice
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                    : isRemedyInvoice
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/25'
                    : paymentMode === 'deferred'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                    : paymentMode === 'partial'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                }`}
                title="إتمام العملية والطباعة مباشرة على الطابعة الافتراضية"
              >
                {isSubmittingPayment ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جاري الحفظ والطباعة...</span>
                  </>
                ) : (
                  <>
                    <Printer size={17} />
                    <span>
                      {isWaselInvoice 
                        ? 'تأكيد وطباعة الفاتورة' 
                        : isRemedyInvoice 
                        ? 'حفظ وطباعة الضمان' 
                        : paymentMode === 'deferred' 
                        ? 'تأجيل الفاتورة وطباعتها' 
                        : paymentMode === 'partial' 
                        ? 'سداد الدفعة وطباعة الفاتورة' 
                        : 'سداد وطباعة الفاتورة'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wasel (Complimentary Free Services) Modal */}
      {showWaselModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-amber-200">
            <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-2xs">
                  <Gift size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm">بيانات فاتورة واصل (خدمات مجانية)</h3>
                  <p className="text-[10px] text-amber-100 font-bold">تصبح الفاتورة مجانية بالكامل (0.00)</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  if (!waselRecipientName.trim() || !waselReason.trim()) {
                    setIsWaselInvoice(false);
                  }
                  setShowWaselModal(false);
                }} 
                className="w-7 h-7 rounded-lg bg-black/10 hover:bg-black/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-right" dir="rtl">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 leading-relaxed font-bold">
                تنبيه: يجب كتابة اسم الشخص المستفيد وسبب تقديم الخدمة مجاناً للمتابعة والرقابة وضمان الشفافية في التقارير والإيصالات.
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  اسم الشخص الذي حصل على الخدمات مجاناً <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={waselRecipientName}
                  onChange={e => setWaselRecipientName(e.target.value)}
                  placeholder="مثال: أ. محمد السعيد / ضيف الإدارة..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all shadow-2xs"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  سبب تقديم الخدمة مجاناً (الملاحظة) <span className="text-rose-600">*</span>
                </label>
                
                {/* Fast Preset Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'ضيف الإدارة / VIP',
                    'هدية ترويجية / مسابقة',
                    'تعويض عميل وتطييب خاطر',
                    'دعاية وتسويق (صانع محتوى)',
                    'أقارب ومعارف الإدارة'
                  ].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setWaselReason(chip)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                        waselReason === chip 
                          ? 'bg-amber-100 text-amber-900 border-amber-400 font-black ring-1 ring-amber-400' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={waselReason}
                  onChange={e => setWaselReason(e.target.value)}
                  placeholder="اكتب تفاصيل سبب منح الفاتورة مجاناً (إلزامي)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all resize-none shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (!waselRecipientName.trim()) {
                      alert('يرجى كتابة اسم الشخص المستفيد من الخدمات المجانية');
                      return;
                    }
                    if (!waselReason.trim()) {
                      alert('يرجى كتابة سبب تقديم الفاتورة مجاناً');
                      return;
                    }
                    setIsWaselInvoice(true);
                    setShowWaselModal(false);
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check size={16} />
                  <span>تأكيد واعتماد (واصل)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsWaselInvoice(false);
                    setShowWaselModal(false);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء واصل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* تقرير اليومية (الوردية الحالية) للاطلاع أو الطباعة المباشرة فقط بدون إغلاق الوردية */}
      {showDailyReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">تقرير اليومية (الوردية الحالية)</h3>
                  <p className="text-[10px] text-slate-400 font-bold">{effectiveShiftDate}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDailyReportModal(false)} 
                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="إغلاق النافذة"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-slate-100 overflow-y-auto flex justify-center max-h-[65vh]">
              <div id="pos-daily-report-content" className="bg-white shadow-sm p-4 w-full rounded-2xl">
                <ClosingReportReceipt 
                  settings={settings}
                  shiftCode={effectiveShiftCode}
                  transactions={(transactions || []).filter(t => (t.shiftCode && effectiveShiftCode && t.shiftCode === effectiveShiftCode) || (t.shiftDate && effectiveShiftDate && t.shiftDate === effectiveShiftDate) || t.date?.startsWith(effectiveShiftDate || ''))}
                  invoices={(invoices || []).filter(i => (i.shiftCode && effectiveShiftCode && i.shiftCode === effectiveShiftCode) || (i.shiftDate && effectiveShiftDate && i.shiftDate === effectiveShiftDate) || i.date?.startsWith(effectiveShiftDate || ''))}
                  dateLabel={effectiveShiftDate || new Date().toISOString().split('T')[0]}
                  initialCash={shiftData?.initialCash || 0}
                  userName={currentUser?.name || settings.ownerName || 'المسؤول'}
                  employees={employees}
                  fingerprintLogs={fingerprintLogs}
                />
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setShowDailyReportModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-xs"
              >
                <X size={16} />
                <span>إغلاق</span>
              </button>

              <button 
                type="button"
                onClick={async () => {
                  const el = document.getElementById('pos-daily-report-content');
                  if (el) {
                    await directPrintHtml(el.innerHTML, settings.printerName);
                  }
                }}
                className="flex-[1.5] py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-xs"
                title="طباعة تقرير اليومية مباشرة على الطابعة الافتراضية بدون صناديق حوارية"
              >
                <Printer size={16} />
                <span>طباعة مباشرة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة استعلام أسعار الخدمات والمنتجات (معاينة سريعة فقط دون إضافة للفاتورة) */}
      {showPriceCheckModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            {/* رأس النافذة */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs shrink-0">
                  <Tag size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-base sm:text-lg text-slate-800">استعلام أسعار الخدمات</h3>
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                      معاينة فقط • لا تضاف للفاتورة
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    ابحث عن أي خدمة أو منتج لمعرفة السعر الفوري دون التأثير على سلة الفاتورة الحالية
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPriceCheckModal(false)} 
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors cursor-pointer shrink-0"
                title="إغلاق النافذة (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* شريط البحث والتصنيفات */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 space-y-3">
              {/* حقل البحث بالاسم أو الباركود */}
              <div className="relative">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  ref={priceCheckInputRef}
                  type="text"
                  placeholder="ابحث باسم الخدمة أو الصنف أو امسح الباركود..."
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl pr-10 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs text-slate-800 font-medium"
                  value={priceCheckSearch}
                  onChange={(e) => setPriceCheckSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                />
                {priceCheckSearch && (
                  <button 
                    type="button"
                    onClick={() => {
                      setPriceCheckSearch('');
                      priceCheckInputRef.current?.focus();
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                    title="مسح البحث"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* أزرار التبديل والتصنيفات */}
              <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
                {/* تبديل النوع: خدمات / منتجات / الكل */}
                <div className="inline-flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setPriceCheckType('service'); setPriceCheckCategory('all'); }}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      priceCheckType === 'service' 
                        ? 'bg-white text-emerald-800 font-black shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Scissors size={14} />
                    <span>الخدمات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPriceCheckType('product'); setPriceCheckCategory('all'); }}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      priceCheckType === 'product' 
                        ? 'bg-white text-emerald-800 font-black shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Package size={14} />
                    <span>المنتجات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPriceCheckType('all'); setPriceCheckCategory('all'); }}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      priceCheckType === 'all' 
                        ? 'bg-white text-emerald-800 font-black shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers size={14} />
                    <span>الكل</span>
                  </button>
                </div>

                {/* تصنيفات سريعة */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setPriceCheckCategory('all')}
                    className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      priceCheckCategory === 'all'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    الكل
                  </button>
                  {categories
                    .filter(c => priceCheckType === 'all' || !c.type || c.type === priceCheckType)
                    .map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPriceCheckCategory(c.id)}
                        className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                          priceCheckCategory === c.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* قائمة نتائج الخدمات المعروضة للاستعلام */}
            <div className="p-4 overflow-y-auto max-h-[50vh] bg-slate-50/40 custom-scrollbar">
              {priceCheckFilteredItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <Search size={28} />
                  </div>
                  <h4 className="font-extrabold text-slate-700 text-sm">لم يتم العثور على أي خدمات أو أصناف</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    تأكد من كتابة الاسم أو الباركود بشكل صحيح أو قم باختيار تصنيف آخر
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {priceCheckFilteredItems.map(item => (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs transition-all"
                    >
                      {/* تفاصيل الخدمة / الصنف */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                          item._isProduct ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            item._isProduct ? <Package size={20} /> : <Scissors size={20} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-slate-800 truncate" title={item.name}>
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {item.categoryName && (
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                                {item.categoryName}
                              </span>
                            )}
                            {item.durationMinutes ? (
                              <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium px-1.5 py-0.2 rounded-md inline-flex items-center gap-1">
                                <Clock size={10} />
                                <span>{item.durationMinutes} د</span>
                              </span>
                            ) : null}
                            {item.barcode && (
                              <span className="bg-slate-50 text-slate-500 font-mono text-[10px] px-1.5 py-0.2 rounded-md border border-slate-200 inline-flex items-center gap-0.5">
                                <Barcode size={10} />
                                <span>{item.barcode}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* السعر البارز */}
                      <div className="flex flex-col items-end shrink-0 pl-1">
                        {Boolean(settings.enableDualPricing && !item._isProduct && item.foreignerPrice && Number(item.foreignerPrice) > 0) ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-700 font-mono">
                                مواطن: {item.displayPrice} {settings.currency}
                              </span>
                            </div>
                            <span className="text-xs sm:text-sm font-black text-amber-800 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-0.5">
                              أجنبي: {item.foreignerPrice} {settings.currency}
                            </span>
                          </>
                        ) : item.hasDiscount ? (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 line-through font-bold">
                                {item.originalPrice} {settings.currency}
                              </span>
                              <span className="bg-red-50 text-red-600 text-[9px] font-black px-1 rounded">
                                خصم
                              </span>
                            </div>
                            <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                              {item.displayPrice} {settings.currency}
                            </span>
                          </>
                        ) : (
                          <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                            {item.displayPrice} {settings.currency}
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                          <Eye size={11} className="text-slate-400" />
                          <span>معاينة فقط</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* شريط ذيل النافذة */}
            <div className="p-3.5 sm:p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-slate-700">عدد النتائج:</span>
                <span className="bg-slate-100 text-slate-800 font-mono font-bold px-2 py-0.5 rounded-md">
                  {priceCheckFilteredItems.length}
                </span>
                <span className="hidden sm:inline text-slate-400">•</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1">
                  <Lock size={11} className="text-slate-400" />
                  <span>نافذة استعلام سريعة للأسعار دون إدخال أي خدمة إلى سلة الفاتورة الحالية.</span>
                </span>
              </div>

              <button 
                type="button"
                onClick={() => setShowPriceCheckModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-xs"
              >
                <X size={16} />
                <span>إغلاق (Esc)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile/Tablet Silent Print Success Notification Toast */}
      {mobilePrintNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-3 backdrop-blur-md transition-all animate-bounce">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/30">
            <Check size={16} />
          </div>
          <span className="text-xs sm:text-sm font-black">{mobilePrintNotice}</span>
        </div>
      )}

      {/* Hidden offscreen printable container for instant direct printing without preview modal */}
      <div 
        aria-hidden="true" 
        style={{ 
          position: 'fixed', 
          top: '-10000px', 
          left: '-10000px', 
          width: '300px', 
          visibility: 'hidden', 
          pointerEvents: 'none',
          zIndex: -100 
        }}
      >
        {completedInvoice && (
          <div id="direct-receipt-print-area">
            <InvoiceReceiptCard
              invoice={completedInvoice}
              settings={settings}
              branches={branches}
              activeBranchId={activeBranchId}
              currentUser={currentUser}
            />
          </div>
        )}
      </div>

      {/* Receipt / Invoice Print Modal */}
      {showReceiptModal && completedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] w-full max-w-sm">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">فاتورة نقطة البيع</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">#{completedInvoice.id}</p>
              </div>
              <button 
                onClick={handleCloseReceiptModal} 
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-xl transition-colors cursor-pointer" 
                title="إغلاق وبدء فاتورة جديدة (Esc)"
              >
                <X size={20}/>
              </button>
            </div>
            
            {/* Thermal Paper Preview Area using InvoiceReceiptCard */}
            <div className="bg-slate-100 p-4 overflow-y-auto flex justify-center max-h-[65vh]">
              <div id="receipt-content" className="bg-white shadow-sm p-2 w-full rounded-xl">
                <InvoiceReceiptCard
                  invoice={completedInvoice}
                  settings={settings}
                  branches={branches}
                  activeBranchId={activeBranchId}
                  currentUser={currentUser}
                />
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-3">
              <button 
                type="button"
                onClick={handleCloseReceiptModal}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-xs"
                title="إغلاق الشاشة وبدء فاتورة جديدة"
              >
                <X size={16} />
                <span>إغلاق</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  executePrintInvoiceReceipt('receipt-content', completedInvoice.id);
                }}
                className="flex-[1.4] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md shadow-emerald-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-xs"
                title="طباعة الفاتورة على طابعة الإيصالات الحرارية"
              >
                <Printer size={18} />
                <span>طباعة الفاتورة</span>
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
                {matchedSalonClientInPOS && (
                  <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2 text-xs">
                    <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-black text-blue-950 flex items-center gap-1.5">
                        <span>تم العثور على العميل مسجلاً مسبقاً ({matchedSalonClientInPOS.name})</span>
                      </div>
                      <div className="text-[11px] text-blue-700 mt-0.5">
                        سيتم تفعيل العميل وإتاحته في هذا الفرع فور الحفظ مع ربط كافة بياناته.
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-amber-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Gift size={14} className="text-amber-600" />
                    <span>رقم جوال العميل الذي رشحه (اختياري)</span>
                  </span>
                  {referrerClientInModal && (
                    <span className="text-[11px] text-emerald-700 font-extrabold bg-emerald-100/90 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Check size={11} className="text-emerald-700" />
                      <span>تم التعرف على العميل</span>
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input 
                    type="text"
                    value={newClientForm.referredByPhone}
                    onChange={(e) => setNewClientForm({...newClientForm, referredByPhone: e.target.value})}
                    className={`w-full border rounded-xl px-4 py-2.5 outline-none font-mono text-sm transition-all ${
                      referrerClientInModal 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40 text-emerald-950 font-bold' 
                        : 'bg-amber-50 border-amber-200 focus:border-amber-500'
                    }`}
                    placeholder="رقم جوال العميل المرشِح..."
                    dir="ltr"
                  />
                  {newClientForm.referredByPhone && (
                    <button 
                      type="button"
                      onClick={() => setNewClientForm({...newClientForm, referredByPhone: ''})}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-1 rounded-full transition-colors"
                      title="مسح الرقم"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* التحقق من عدم ترشيح العميل لنفسه */}
                {newClientForm.referredByPhone && newClientForm.phone && newClientForm.referredByPhone.trim().replace(/\D/g, '') === newClientForm.phone.trim().replace(/\D/g, '') && (
                  <p className="text-xs text-red-500 font-bold mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} className="text-red-500" />
                    <span>لا يمكن إدخال رقم العميل نفسه كمرشِح</span>
                  </p>
                )}

                {/* إظهار اسم العميل المرشِح فور العثور عليه برقم هاتفه */}
                {referrerClientInModal && (
                  <div className="mt-2 p-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300/90 rounded-xl flex items-center justify-between gap-2 text-emerald-950 shadow-2xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                        <User size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-emerald-700 font-bold">العميل الذي رشح الصالون:</span>
                        </div>
                        <p className="text-xs font-black text-emerald-950 truncate">{referrerClientInModal.name}</p>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-[11px] font-mono font-bold bg-white/90 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-lg" dir="ltr">
                        {referrerClientInModal.phone}
                      </span>
                    </div>
                  </div>
                )}

                {/* إشعار في حال كتابة رقم كامل غير مسجل مسبقاً */}
                {!referrerClientInModal && newClientForm.referredByPhone && newClientForm.referredByPhone.trim().replace(/\D/g, '').length >= 9 && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center gap-1.5 text-amber-800 text-[11px] font-medium">
                    <Info size={13} className="shrink-0 text-amber-700" />
                    <span>لم يتم العثور على عميل مسجل بهذا الرقم مسبقاً (سيتم حفظ الرقم كجهة ترشيح)</span>
                  </div>
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
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User size={14} className="text-primary" />
                  <span>نوع العميل / الصفة (مواطن - أجنبي) *</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNewClientForm({...newClientForm, clientType: 'citizen'})}
                    className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      newClientForm.clientType !== 'foreigner'
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Check size={13} className={newClientForm.clientType !== 'foreigner' ? 'opacity-100' : 'opacity-0'} />
                    <span>مواطن</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewClientForm({...newClientForm, clientType: 'foreigner'})}
                    className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      newClientForm.clientType === 'foreigner'
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Check size={13} className={newClientForm.clientType === 'foreigner' ? 'opacity-100' : 'opacity-0'} />
                    <span>أجنبي</span>
                  </button>
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

      {/* Fast Quick Expense Modal (نافذة تسجيل مصروف سريع من نقطة البيع) */}
      {showQuickExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">تسجيل مصروف سريع</h3>
                  <p className="text-[11px] text-slate-500">صرف مباشر من الخزينة وتوثيق في حسابات الوردية</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowQuickExpenseModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {quickExpenseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0" />
                <span>{quickExpenseError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuickExpense} className="space-y-3.5">
              {/* المبلغ */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  المبلغ المنصرف *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    autoFocus
                    required
                    placeholder="0.00"
                    value={quickExpenseAmount}
                    onChange={(e) => setQuickExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-left font-mono font-black text-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-900"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {settings.currency}
                  </span>
                </div>
              </div>

              {/* بند المصروف */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  بند المصروف / التصنيف *
                </label>
                <select
                  value={quickExpenseCategory}
                  onChange={(e) => setQuickExpenseCategory(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-800"
                >
                  {availableExpenseCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* الخزينة المنصرف منها */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  الخزينة المنصرف منها *
                </label>
                <select
                  value={quickExpenseTreasury}
                  onChange={(e) => setQuickExpenseTreasury(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-800"
                >
                  {availableExpenseTreasuries.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* البيان / الوصف */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  بيان وتفاصيل المصروف *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شراء ضيافة وبوفيه، أدوات نظافة، صيانة استشوار..."
                  value={quickExpenseDescription}
                  onChange={(e) => setQuickExpenseDescription(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-800"
                />
              </div>

              {/* تاريخ الصرف + خيار الطباعة */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    تاريخ العملية
                  </label>
                  <input
                    type="date"
                    value={quickExpenseDate}
                    onChange={(e) => setQuickExpenseDate(e.target.value)}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-4 select-none">
                  <input
                    type="checkbox"
                    checked={quickExpensePrint}
                    onChange={(e) => setQuickExpensePrint(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Printer size={13} className="text-slate-500" />
                    طباعة إيصال
                  </span>
                </label>
              </div>

              {/* الأزرار */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickExpenseModal(false)}
                  className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickExpense}
                  className="flex-[1.5] h-11 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-xl text-xs transition-all shadow-md shadow-rose-600/25 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {isSubmittingQuickExpense ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>حفظ المصروف</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fast Attendance & Timesheet Modal */}
      <POSAttendanceModal 
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        employees={employees}
        setEmployees={setEmployees}
        fingerprintLogs={fingerprintLogs}
        setFingerprintLogs={setFingerprintLogs}
        shiftDate={effectiveIsShiftOpen ? effectiveShiftDate : (shiftDate || new Date().toISOString().split('T')[0])}
        settings={settings}
        currentUser={currentUser}
      />

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
                <X size={16} />
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

      {/* Held / Suspended Invoices Modal */}
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
                  const heldCart = held.cart || [];
                  const heldSubtotal = heldCart.reduce((sum, c) => sum + (getCartItemPrice(c) * (c?.quantity || 1)), 0);
                  const heldDiscountAmt = held.discount?.type === 'percentage' ? heldSubtotal * ((Number(held.discount?.value) || 0) / 100) : (Number(held.discount?.value) || 0);
                  const heldTotal = (held.isRemedyInvoice || held.isWaselInvoice) ? 0 : Math.max(0, heldSubtotal - heldDiscountAmt - (Number(held.advanceDeduction) || 0));

                  return (
                    <div key={held.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 hover:border-amber-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-mono font-black text-xs">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-xs text-slate-900">
                                {held.client?.name || held.clientSearch || 'عميل نقدي'}
                              </h4>
                              {held.bookingId && (
                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Calendar size={11} className="text-indigo-600" />
                                  <span>حجز مكتمل</span>
                                </span>
                              )}
                              {held.queueNumber && (
                                <span className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                                  <Ticket size={11} className="text-amber-800" />
                                  <span>دور #{held.queueNumber}</span>
                                </span>
                              )}
                              {held.client?.phone && (
                                <span className="text-[10px] text-slate-500 font-mono" dir="ltr">{held.client.phone}</span>
                              )}
                              {held.isRemedyInvoice && (
                                <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                  ضمان/إصلاح
                                </span>
                              )}
                              {held.isWaselInvoice && (
                                <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full" title={`المستفيد: ${held.waselRecipientName || '-'} | السبب: ${held.waselReason || '-'}`}>
                                  واصل ({held.waselRecipientName || 'مجاني'})
                                </span>
                              )}
                              {held.id === activeHeldInvoiceId ? (
                                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  <span>مفتوحة حالياً على الكاشير</span>
                                </span>
                              ) : (held.isOpen && held.openedBy ? (
                                <span className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <User size={11} className="text-amber-800" />
                                  <span>مفتوحة بواسطة ({held.openedBy})</span>
                                </span>
                              ) : null)}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                              <Clock size={11} />
                              <span>معلقة منذ: {held.timeStr || (held.heldAt && held.heldAt.includes('T') ? held.heldAt.split('T')[1].substring(0, 5) : 'الآن')}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-left">
                          <span className="text-sm font-black font-mono text-primary">
                            {heldTotal.toFixed(2)} {settings.currency}
                          </span>
                          {(Number(held.advanceDeduction) || 0) > 0 && (
                            <p className="text-[10px] text-emerald-600 font-bold font-mono">
                              عربون: -{Number(held.advanceDeduction).toFixed(2)}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 font-semibold">{heldCart.length} أصناف / خدمات</p>
                        </div>
                      </div>

                      {/* Items Preview Chips */}
                      {heldCart.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                          {heldCart.map(c => (
                            <span key={c.cartId || Math.random().toString()} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <span>{c?.item?.name || 'خدمة'}</span>
                              <span className="font-mono text-primary font-bold">x{c?.quantity || 1}</span>
                            </span>
                          ))}
                        </div>
                      )}

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
                          onClick={() => {
                            if (held.id === activeHeldInvoiceId) {
                              setShowHeldInvoicesModal(false);
                            } else {
                              handleResumeHeldInvoice(held);
                            }
                          }}
                          className={`px-4 py-1.5 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            held.id === activeHeldInvoiceId 
                              ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <PlayCircle size={14} />
                          <span>{held.id === activeHeldInvoiceId ? 'العودة للفاتورة الحالية' : 'استكمال الفاتورة'}</span>
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

      {/* نافذة تفضيلات العميل وإمكانية التعديل عليها */}
      {showPreferencesModal && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-amber-400 text-white flex items-center justify-center shadow-md">
                  <Scissors size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
                    <span>تفضيلات العميل: {selectedClient.name}</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-bold" dir="ltr">{selectedClient.phone}</span>
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    تخصيص ستايل الحلاقة المفضل، حساسية البشرة، ومشروب الضيافة
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPreferencesModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Form */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar bg-slate-50">
              {savePrefSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 p-3 rounded-2xl text-xs font-black flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>تم حفظ وتحديث تفضيلات العميل بنجاح في قاعدة البيانات وتظهر لجميع الفروع</span>
                </div>
              )}

              {/* 1. Shaving & Hair Preferences */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Scissors size={16} className="text-indigo-600" />
                  <span>تفضيلات الحلاقة وقصة الشعر واللحية</span>
                </h4>

                {/* Shaving Method Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">أداة وطريقة الحلاقة المفضلة للعميل:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'machine', label: 'ماكينة', desc: 'تجنب الموس الحاد' },
                      { id: 'blade', label: 'موس كلاسيكي', desc: 'تنعيم بالموس' },
                      { id: 'scissors_only', label: 'مقص فقط', desc: 'قص هادئ بالمقص' },
                      { id: 'both', label: 'ماكينة + موس', desc: 'حلاقة مدمجة' }
                    ].map(opt => (
                      <label
                        key={opt.id}
                        onClick={() => setPrefForm({ ...prefForm, shavingMethod: opt.id as any })}
                        className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col ${
                          (prefForm.shavingMethod || 'machine') === opt.id
                            ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-600/20'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="posShavingMethod"
                            checked={(prefForm.shavingMethod || 'machine') === opt.id}
                            onChange={() => setPrefForm({ ...prefForm, shavingMethod: opt.id as any })}
                            className="text-indigo-600"
                          />
                          <span className="font-black text-xs text-slate-900">{opt.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Hair & Beard Style Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ستايل وقصة الشعر المفضلة:
                    </label>
                    <textarea
                      rows={2}
                      value={prefForm.hairStyleNotes || ''}
                      onChange={e => setPrefForm({ ...prefForm, hairStyleNotes: e.target.value })}
                      placeholder="مثال: تدريج منخفض Fade من الجوانب، تخفيف بسيط من الأعلى، تجنب الجل القوي..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-600 focus:bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ستايل وتحديد اللحية والشارب:
                    </label>
                    <textarea
                      rows={2}
                      value={prefForm.beardStyleNotes || ''}
                      onChange={e => setPrefForm({ ...prefForm, beardStyleNotes: e.target.value })}
                      placeholder="مثال: تحديد دقيق للخطوط، تخفيف نمرة 2، ترك السكسوكة، سنفرة خفيفة..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-600 focus:bg-white font-medium"
                    />
                  </div>
                </div>

                {/* Skin sensitivities */}
                <div>
                  <label className="block text-xs font-bold text-rose-700 mb-1 flex items-center gap-1">
                    <AlertTriangle size={13} className="text-rose-600" />
                    <span>حساسية البشرة / مواد يتجنبها:</span>
                  </label>
                  <input
                    type="text"
                    value={prefForm.skinSensitivities || ''}
                    onChange={e => setPrefForm({ ...prefForm, skinSensitivities: e.target.value })}
                    placeholder="مثال: حساسية من الكحول بعد الحلاقة (مرطب بارد فقط)، بشرة حساسة للحرارة..."
                    className="w-full bg-rose-50/40 border border-rose-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-rose-500 focus:bg-white font-medium text-rose-950"
                  />
                </div>
              </div>

              {/* 2. Hospitality & Beverage Preferences */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Coffee size={16} className="text-amber-700" />
                  <span>تفضيلات الضيافة والمشروبات</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المشروب المفضل:</label>
                    <select
                      value={prefForm.favoriteBeverage || 'قهوة تركي'}
                      onChange={e => setPrefForm({ ...prefForm, favoriteBeverage: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white"
                    >
                      <option value="قهوة تركي">قهوة تركي</option>
                      <option value="إسبريسو">إسبريسو</option>
                      <option value="قهوة عربية">قهوة عربية</option>
                      <option value="شاي كرك">شاي كرك</option>
                      <option value="شاي أحمر">شاي أحمر كلاسيكي</option>
                      <option value="شاي أخضر">شاي أخضر بالنعناع</option>
                      <option value="ماء فقط">ماء فقط</option>
                      <option value="عصير برتقال">عصير طازج</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">كمية السكر المفضلة:</label>
                    <select
                      value={prefForm.sugarLevel || 'one_spoon'}
                      onChange={e => setPrefForm({ ...prefForm, sugarLevel: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white"
                    >
                      <option value="none">بدون سكر (سادة)</option>
                      <option value="half">نصف ملعقة (سكر خفيف)</option>
                      <option value="one_spoon">ملعقة واحدة (مضبوط)</option>
                      <option value="two_spoons">ملعقتين</option>
                      <option value="extra">زيادة سكر (حلو)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">برودة الماء:</label>
                    <select
                      value={prefForm.waterTemperature || 'cold'}
                      onChange={e => setPrefForm({ ...prefForm, waterTemperature: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white"
                    >
                      <option value="cold">ماء بارد</option>
                      <option value="room">ماء عادي (حرارة الغرفة)</option>
                      <option value="none">لا يطلب ماء</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات عامة لطاقم العمل والاستقبال:
                  </label>
                  <input
                    type="text"
                    value={prefForm.generalNotes || ''}
                    onChange={e => setPrefForm({ ...prefForm, generalNotes: e.target.value })}
                    placeholder="مثال: يفضل عدم الحديث أثناء الجلسة، يفضل الجلوس بالصالة العائلية، عميل دائم..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:bg-white font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreferencesModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
              >
                إغلاق
              </button>

              <button
                type="button"
                onClick={handleSavePreferencesInPOS}
                className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <Save size={15} />
                <span>حفظ التفضيلات وتطبيقها فوراً</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* مودال اختيار الفاتورة لعمل مرتجع في نقطة البيع */}
      {showPOSReturnInvoicePicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-rose-50/50">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">اختيار فاتورة لعمل مرتجع مبيعات</h3>
                  <p className="text-slate-400 text-xs">ابحث عن الفاتورة برقمها أو اسم العميل أو رقم الجوال</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPOSReturnInvoicePicker(false);
                    setPosSelectedInvoiceForReturn(null);
                    setPosReturnModalInitialMode('general');
                    setIsPOSReturnModalOpen(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Package size={14} />
                  <span>مرتجع أصناف عام (بدون فاتورة)</span>
                </button>
                <button 
                  onClick={() => setShowPOSReturnInvoicePicker(false)}
                  className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center border border-slate-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={posReturnSearch}
                  onChange={(e) => setPosReturnSearch(e.target.value)}
                  placeholder="ابحث برقم الفاتورة، اسم العميل، جوال العميل..."
                  className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs font-bold outline-none focus:border-rose-500 shadow-xs"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {invoices
                .filter(inv => {
                  if (inv.status === 'cancelled') return false;
                  if (!posReturnSearch.trim()) return true;
                  const q = posReturnSearch.toLowerCase().trim();
                  return (
                    inv.id.toLowerCase().includes(q) ||
                    (inv.clientName && inv.clientName.toLowerCase().includes(q)) ||
                    (inv.clientPhone && inv.clientPhone.includes(q))
                  );
                })
                .slice(0, 30)
                .map(inv => {
                  return (
                    <div
                      key={inv.id}
                      className="p-3 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{inv.id}
                          </span>
                          <span className="font-bold text-xs text-slate-800">
                            {inv.clientName || 'عميل نقدي'}
                          </span>
                          {inv.clientPhone && (
                            <span className="text-[11px] font-mono text-slate-400">
                              ({inv.clientPhone})
                            </span>
                          )}
                          {inv.hasReturn && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                              <RotateCcw size={10} />
                              مرتجع سابق: {Number(inv.returnedAmount || 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-medium">
                          <span>{new Date(inv.date).toLocaleDateString('ar-SA')}</span>
                          <span>•</span>
                          <span>{inv.items?.length || 0} أصناف/خدمات</span>
                          <span>•</span>
                          <span className="font-bold text-slate-700">
                            الإجمالي: {Number(inv.total).toFixed(2)} {settings.currency}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setPosSelectedInvoiceForReturn(inv);
                          setPosReturnModalInitialMode('by_invoice');
                          setShowPOSReturnInvoicePicker(false);
                          setIsPOSReturnModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap self-end sm:self-center"
                      >
                        <RotateCcw size={14} />
                        <span>تسجيل مرتجع ↵</span>
                      </button>
                    </div>
                  );
                })}

              {invoices.filter(i => i.status !== 'cancelled').length === 0 && (
                <div className="py-12 text-center text-slate-400 font-bold text-xs">
                  لا توجد فواتير مؤهلة للمرتجع حالياً
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowPOSReturnInvoicePicker(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال عمل المرتجع الفعلي */}
      {isPOSReturnModalOpen && (
        <SalesReturnModal
          isOpen={true}
          onClose={() => {
            setIsPOSReturnModalOpen(false);
            setPosSelectedInvoiceForReturn(null);
          }}
          invoice={posSelectedInvoiceForReturn}
          initialMode={posReturnModalInitialMode}
          settings={settings}
          products={products}
          setProducts={setProducts}
          setItemMovements={setItemMovements}
          transactions={transactions}
          setTransactions={setTransactions}
          invoices={invoices}
          setInvoices={setInvoices}
          clients={clients}
          setClients={setClients}
          currentUser={currentUser}
          onReturnSuccess={(newReturn, updatedInvoice) => {
            if (updatedInvoice && setInvoices) {
              setInvoices(invoices.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
            }
            if (setSalesReturns) {
              setSalesReturns(prev => [newReturn, ...prev.filter(r => r.id !== newReturn.id)]);
            }
            setIsPOSReturnModalOpen(false);
            setPosSelectedInvoiceForReturn(null);
            setPosVoucherReturn(newReturn);
          }}
        />
      )}

      {/* مودال طباعة إشعار دائن (سند مرتجع مبيعات) */}
      {posVoucherReturn && (
        <SalesReturnVoucherModal
          isOpen={true}
          onClose={() => setPosVoucherReturn(null)}
          salesReturn={posVoucherReturn}
          settings={settings}
        />
      )}
    </div>
  );
}
