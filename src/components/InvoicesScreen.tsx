import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AppSettings, Invoice, Transaction, Client, Branch, Product, Employee, ServiceItem, SalesReturn } from '../types';
import { 
  Search, Filter, Printer, XCircle, Edit, CheckCircle, ChevronDown, 
  ChevronUp, Image as ImageIcon, Wrench, Eye, X, Trash2, RotateCcw,
  FileSpreadsheet, Hourglass, Gift, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  MessageCircle, Copy, Check, Lock, ArrowLeft, ArrowRight
} from 'lucide-react';
import { DB } from '../services/db';
import { InvoicesImportModal } from './InvoicesImportModal';
import { SalesReturnModal } from './SalesReturnModal';
import { generateCode39Svg } from '../utils/printQueueSlip';
import { InvoiceReceiptCard, executePrintInvoiceReceipt } from './InvoiceReceiptCard';
import { isWaselInvoice } from '../utils/commissionHelper';
import { formatInvoiceDateTimeDisplay, parseDbDateTime } from '../utils/timezone';

export const getEffectiveInvoiceTotal = (inv: Invoice | any): number => {
  if (!inv) return 0;
  if (inv.total !== undefined && inv.total !== null && Number(inv.total) > 0) {
    return Number(inv.total);
  }
  if (inv.subtotal !== undefined && inv.subtotal !== null && Number(inv.subtotal) > 0) {
    return Math.max(0, Number(inv.subtotal) - Number(inv.discount || 0));
  }
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    const sum = inv.items.reduce((acc: number, it: any) => acc + (Number(it.price || 0) * (Number(it.quantity) || 1)), 0);
    if (sum > 0) return Math.max(0, sum - Number(inv.discount || 0));
  }
  return Number(inv.total || 0);
};

export function InvoicesScreen({ 
  settings, 
  invoices, 
  setInvoices, 
  transactions, 
  setTransactions,
  clients,
  allSalonClients = [],
  setClients,
  activeBranchId,
  branches = [],
  currentUser,
  products = [],
  setProducts,
  setItemMovements,
  employees = [],
  services = [],
  salesReturns = [],
  onProcessSalesReturn,
  onNavigateToReturns,
  onNavigateToDeferred,
  onEditInvoiceInPOS,
  shiftData,
}: { 
  settings: AppSettings;
  invoices: Invoice[];
  setInvoices: (i: Invoice[] | ((prev: Invoice[]) => Invoice[])) => void;
  transactions: Transaction[];
  setTransactions: (t: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  clients: Client[];
  setClients: (c: Client[]) => void;
  allSalonClients?: Client[];
  activeBranchId?: string;
  branches?: Branch[];
  currentUser?: any;
  products?: Product[];
  setProducts?: (p: Product[] | ((prev: Product[]) => Product[])) => void;
  setItemMovements?: (m: any[] | ((prev: any[]) => any[])) => void;
  employees?: Employee[];
  services?: ServiceItem[];
  salesReturns?: SalesReturn[];
  setSalesReturns?: (returns: SalesReturn[] | ((prev: SalesReturn[]) => SalesReturn[])) => void;
  onProcessSalesReturn?: (ret: SalesReturn) => void;
  onNavigateToReturns?: () => void;
  onNavigateToDeferred?: () => void;
  onEditInvoiceInPOS?: (invoice: Invoice) => void;
  shiftData?: { isOpen: boolean; date: string; id?: string; shiftCode?: string; code?: string };
}) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // هل المستخدم مدير أو مالك أو مبرمج ولديه وصول كامل للنظام بكافة فروعه؟
  const isAdminOrFullAccess = useMemo(() => {
    if (!currentUser) return true;
    return (
      currentUser.role === 'admin' || 
      currentUser.role === 'owner' || 
      currentUser.role === 'programmer' ||
      currentUser.actions?.includes('*') ||
      currentUser.actions?.includes('view_all_branches')
    );
  }, [currentUser]);

  // لحساب الإدارة والمالك يتم عرض كافة فروع النظام افتراضياً، وللكاشير يتم قفله على فرعه
  const [branchFilter, setBranchFilter] = useState<string>(() => {
    if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'programmer' || currentUser.actions?.includes('*') || currentUser.actions?.includes('view_all_branches')) {
      return 'all';
    }
    return activeBranchId || 'all';
  });

  // مرجع التمرير الأفقي للجدول
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // هل المستخدم كاشير مقيد (لا يملك صلاحية رؤية الأيام السابقة أو صلاحيات الإدارة/المالك/المبرمج)؟
  const isCashierRestricted = useMemo(() => {
    if (!currentUser) return false;
    // استثناء صريح للإدارة والمالك والمبرمج ومن يملك صلاحية كاملة أو صلاحية الأيام السابقة
    if (
      currentUser.role === 'admin' || 
      currentUser.role === 'owner' || 
      currentUser.role === 'programmer' ||
      currentUser.actions?.includes('*') ||
      currentUser.actions?.includes('view_past_invoices')
    ) {
      return false;
    }
    // الكاشير وأي دور آخر مقيد بتاريخ اليوم / الوردية المفتوحة
    return true;
  }, [currentUser]);

  // تحديد تاريخ اليوم وتاريخ الوردية المفتوحة
  const getTodayLocalDateStr = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const activeShiftDate = useMemo(() => {
    if (shiftData?.isOpen && shiftData?.date) {
      return shiftData.date;
    }
    return getTodayLocalDateStr();
  }, [shiftData]);

  // استخراج كود الوردية النشطة ومعرفها للفرع الحالي بدقة مطلقة
  const effectiveShiftCode = useMemo(() => {
    const code = (shiftData as any)?.shiftCode || (shiftData as any)?.code || (shiftData as any)?.shift_code;
    if (code && typeof code === 'string' && code.trim()) {
      return code.trim();
    }
    try {
      const raw = localStorage.getItem('smartcut_work_shifts_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        const branchKey = activeBranchId || 'b-main';
        if (parsed[branchKey]?.shiftCode) return String(parsed[branchKey].shiftCode).trim();
        if (parsed['b-main']?.shiftCode) return String(parsed['b-main'].shiftCode).trim();
        const anyS: any = Object.values(parsed).find((s: any) => s?.isOpen && s?.shiftCode);
        if (anyS?.shiftCode) return String(anyS.shiftCode).trim();
      }
    } catch (e) {}
    return '';
  }, [shiftData, activeBranchId]);

  const effectiveShiftId = useMemo(() => {
    const id = (shiftData as any)?.shiftId || (shiftData as any)?.id || (shiftData as any)?.shift_id;
    if (id && typeof id === 'string' && id.trim()) {
      return id.trim();
    }
    try {
      const raw = localStorage.getItem('smartcut_work_shifts_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        const branchKey = activeBranchId || 'b-main';
        if (parsed[branchKey]?.shiftId || parsed[branchKey]?.id) return String(parsed[branchKey].shiftId || parsed[branchKey].id).trim();
        if (parsed['b-main']?.shiftId || parsed['b-main']?.id) return String(parsed['b-main'].shiftId || parsed['b-main'].id).trim();
        const anyS: any = Object.values(parsed).find((s: any) => s?.isOpen && (s?.shiftId || s?.id));
        if (anyS?.shiftId || anyS?.id) return String(anyS.shiftId || anyS.id).trim();
      }
    } catch (e) {}
    return '';
  }, [shiftData, activeBranchId]);

  // التحقق القاطع: هل الفاتورة تنتمي للوردية الحالية المفتوحة؟
  const isInvoiceInCurrentShift = useCallback((inv: Invoice): boolean => {
    const invShiftCode = (inv.shiftCode || (inv as any).shift_code || '').trim();
    const invShiftId = (inv.shiftId || (inv as any).shift_id || '').trim();

    // 1. التطابق المباشر عبر كود الوردية
    if (effectiveShiftCode && invShiftCode && invShiftCode.toLowerCase() === effectiveShiftCode.toLowerCase()) {
      return true;
    }

    // 2. التطابق المباشر عبر معرف الوردية (UUID / id)
    if (effectiveShiftId && invShiftId && invShiftId.toLowerCase() === effectiveShiftId.toLowerCase()) {
      return true;
    }

    // 3. التحقق المتقاطع في حال تم تسجيل المعرف في حقل الكود أو العكس
    if (effectiveShiftCode && invShiftId && invShiftId.toLowerCase() === effectiveShiftCode.toLowerCase()) {
      return true;
    }
    if (effectiveShiftId && invShiftCode && invShiftCode.toLowerCase() === effectiveShiftCode.toLowerCase()) {
      return true;
    }

    // 4. إذا كانت الوردية الحالية مفتوحة ويوجد تطابق في التاريخ أو توقيت الإنشاء
    if (shiftData?.isOpen) {
      const invDateStr = getInvoiceLocalDateStr(inv);
      const invCreatedDateStr = ((inv as any).createdAt || (inv as any).created_at || '').split('T')[0];
      if (activeShiftDate && (invDateStr === activeShiftDate || invCreatedDateStr === activeShiftDate)) {
        return true;
      }
      if (shiftData.openedAt && ((inv as any).createdAt || (inv as any).created_at)) {
        const invTime = new Date((inv as any).createdAt || (inv as any).created_at).getTime();
        const openTime = new Date(shiftData.openedAt).getTime();
        if (invTime >= openTime - 60000) {
          return true;
        }
      }
    }

    return false;
  }, [shiftData?.isOpen, shiftData?.openedAt, effectiveShiftCode, effectiveShiftId, activeShiftDate]);

  // قفل التواريخ تلقائياً للكاشير على تاريخ الوردية المفتوحة فقط
  useEffect(() => {
    if (isCashierRestricted) {
      setDateFrom(activeShiftDate);
      setDateTo(activeShiftDate);
    }
  }, [isCashierRestricted, activeShiftDate]);

  // دوال التنقل الأفقي السريع في أعمدة الجدول
  const scrollTableLeft = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollTableRight = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  const scrollToActions = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ left: -9999, behavior: 'smooth' });
    }
  };

  const scrollToStart = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ left: 9999, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (activeBranchId) {
      setBranchFilter(activeBranchId);
    }
  }, [activeBranchId]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'wasel' | 'cancelled' | 'unpaid' | 'deferred' | 'partially_paid' | 'refunded' | 'partial_refund'>('all');
  const [returnTargetInvoice, setReturnTargetInvoice] = useState<Invoice | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState<{ before?: string; after?: string; title: string } | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFrom, dateTo, statusFilter, paymentFilter, branchFilter]);
  
  const [showPayModal, setShowPayModal] = useState<Invoice | null>(null);
  const [payTreasury, setPayTreasury] = useState(settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || '');
  const [cashbackToUse, setCashbackToUse] = useState<number>(0);
  
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<Invoice | null>(null);
  const [adminPasswordTarget, setAdminPasswordTarget] = useState<Invoice | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);

  // Copy Phone Number state & helper
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  const handleCopyPhone = async (phone: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!phone) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(phone.trim());
      } else {
        const el = document.createElement('textarea');
        el.value = phone.trim();
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedPhoneId(id);
      setTimeout(() => setCopiedPhoneId(null), 2000);
    } catch (err) {
      console.error('Copy phone error:', err);
    }
  };

  const getWhatsAppUrl = (phone?: string) => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('01')) {
      digits = '2' + digits;
    } else if (digits.length === 10 && digits.startsWith('05')) {
      digits = '966' + digits.slice(1);
    }
    return `https://wa.me/${digits}`;
  };

  // دالة موحدة لاستخراج تاريخ الفاتورة بصيغة YYYY-MM-DD بدقة
  const getInvoiceLocalDateStr = (inv: { date?: string; shiftDate?: string }): string => {
    if (!inv) return '';
    let raw = '';
    if (inv.shiftDate && typeof inv.shiftDate === 'string' && inv.shiftDate.trim()) {
      raw = inv.shiftDate.trim();
    } else if (inv.date && typeof inv.date === 'string' && inv.date.trim()) {
      raw = inv.date.trim();
    }
    if (!raw) return '';

    const clean = raw.replace(/\//g, '-').split('T')[0].split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return clean;
  };

  // فحص حاسم ومحكم: هل الفاتورة مسموح للمستخدم تعديلها؟
  // (للكاشير: مسموح فقط لفواتير الوردية الحالية المفتوحة المطابقة لكود الوردية المسجل في الفاتورة وليس تاريخ إنشائها)
  const isInvoiceFromPreviousDate = (inv: Invoice): boolean => {
    // 1. للمالك والآدمن والمبرمج ومن يملك صلاحية الكل: لا يوجد أي حظر لتعديل الفواتير
    if (
      currentUser?.role === 'admin' || 
      currentUser?.role === 'owner' || 
      currentUser?.role === 'programmer' || 
      currentUser?.actions?.includes('*')
    ) {
      return false;
    }

    // 2. إذا كانت الوردية مغلقة: ممنوع التعديل قطعاً للمستخدم المقيد / الكاشير
    if (!shiftData?.isOpen) {
      return true;
    }

    // 3. إذا كانت الفاتورة تنتمي حصراً للوردية الحالية المفتوحة عبر كود الوردية
    if (isInvoiceInCurrentShift(inv)) {
      return false;
    }

    // غير ذلك: تعتبر الفاتورة صادرة في وردية سابقة ومغلقة وممنوع تعديلها حتى وإن تشابه تاريخ إنشائها
    return true;
  };

  // صلاحيات تعديل وحذف الفواتير
  const canEditInvoice = !currentUser || 
    currentUser.role === 'admin' || 
    currentUser.role === 'owner' || 
    currentUser.role === 'programmer' || 
    currentUser.actions?.includes('manage_invoices_edit') || 
    currentUser.actions?.includes('manage_invoices') || 
    currentUser.actions?.includes('*');

  const canDeleteInvoice = !currentUser || 
    currentUser.role === 'admin' || 
    currentUser.role === 'owner' || 
    currentUser.role === 'programmer' || 
    currentUser.actions?.includes('manage_invoices_delete') || 
    currentUser.actions?.includes('*');

  // معالجة بدء تعديل الفاتورة في نقطة البيع
  const handleInitiateEdit = (inv: Invoice) => {
    if (!canEditInvoice) {
      alert('عذراً، لا تملك صلاحية تعديل فواتير المبيعات.');
      return;
    }
    if (isInvoiceFromPreviousDate(inv)) {
      alert('عذراً، محظور تعديل الفواتير الصادرة في ورديات سابقة أو مغلقة حفاظاً على سلامة الحسابات. التعديل متاح فقط لفواتير الوردية الحالية المفتوحة.');
      return;
    }
    if (inv.status === 'cancelled') {
      alert('عذراً، لا يمكن تعديل فاتورة ملغاة.');
      return;
    }
    
    if (onEditInvoiceInPOS) {
      onEditInvoiceInPOS(inv);
    }
  };

  // حذف الفاتورة نهائياً لحساب الأدمن والمالك أو من يملك الصلاحية حتى لو كانت قديمة
  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!canDeleteInvoice) {
      alert('عذراً، حذف الفواتير يتطلب صلاحية الحذف النهائي للفواتير.');
      return;
    }

    if (!window.confirm(`تحذير: هل أنت متأكد من حذف الفاتورة رقم (${inv.id}) نهائياً من النظام وقاعدة البيانات؟\nسيتم حذف الفاتورة نهائياً وإلغاء حركاتها المالية وعكس أثرها بالكامل.`)) {
      return;
    }

    try {
      // 1. Delete from DB & clean all caches
      await DB.deleteInvoice(inv.id);
      
      // 2. Remove from state using functional updater (guarantees safe deletion across branch filters)
      setInvoices((prev: Invoice[]) => (prev || []).filter(i => i.id !== inv.id));

      // 3. Reverse any financial transactions for this invoice in state
      setTransactions((prev: Transaction[]) => (prev || []).filter(t => (t as any).invoiceId !== inv.id && !t.description?.includes(inv.id) && !t.id.includes(inv.id)));
      
      // 4. Clean local cache directly
      try {
        const cached = localStorage.getItem('smartcut_invoices_cache');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            localStorage.setItem('smartcut_invoices_cache', JSON.stringify(list.filter((i: any) => i.id !== inv.id)));
          }
        }
      } catch (e) {}

      alert(`تم حذف الفاتورة ${inv.id} نهائياً بنجاح.`);
    } catch (err: any) {
      console.error('Failed to delete invoice:', err);
      alert(`حدث خطأ أثناء حذف الفاتورة من قاعدة البيانات: ${err?.message || 'خطأ غير معروف'}\nيرجى المحاولة مجدداً أو مراجعة اتصال الإنترنت.`);
    }
  };
  
  const handleConfirmCancel = async () => {
    if (!cancelInvoiceTarget) return;
    const invoice = cancelInvoiceTarget;

    if (isInvoiceFromPreviousDate(invoice)) {
      alert('عذراً، محظور إلغاء الفواتير الصادرة في ورديات سابقة أو مغلقة. الإلغاء متاح فقط لفواتير الوردية الحالية المفتوحة.');
      setCancelInvoiceTarget(null);
      return;
    }
    // 1. Update invoice status in DB & state
    const updatedInv = { 
      ...invoice, 
      status: 'cancelled' as const,
      updatedBy: currentUser?.username || currentUser?.name,
      updatedByName: currentUser?.name || currentUser?.username,
      updatedById: currentUser?.id,
      updatedAt: new Date().toISOString()
    };
    await DB.saveInvoice(updatedInv);
    setInvoices(invoices.map(inv => inv.id === invoice.id ? updatedInv : inv));

    // 2. Remove financial effect from DB & state
    await DB.deleteTransactionsByInvoiceId(invoice.id);
    setTransactions(transactions.filter(t => !t.description?.includes(invoice.id) && (t as any).invoiceId !== invoice.id));

    // 3. Revert cashback if it was used
    if (invoice.cashbackUsed && invoice.clientId) {
      const targetClient = clients.find(c => c.id === invoice.clientId);
      if (targetClient) {
        const updatedClient = { ...targetClient, loyaltyPoints: (targetClient.loyaltyPoints || 0) + invoice.cashbackUsed! };
        await DB.saveClient(updatedClient);
        setClients(clients.map(c => c.id === invoice.clientId ? updatedClient : c));
      }
    }

    setCancelInvoiceTarget(null);
  };

  // التحقق من كلمة المرور الحقيقية للمستخدم الحالي بدلاً من الكلمة المشفرة ثابتة
  const handleAdminPasswordSubmit = () => {
    const currentUserPassword = currentUser?.password || '';
    const isValid = 
      (currentUserPassword && adminPasswordInput === currentUserPassword) ||
      (currentUser?.role === 'admin' || currentUser?.role === 'owner' || currentUser?.role === 'programmer');
    
    if (isValid && adminPasswordTarget) {
      const target = adminPasswordTarget;
      if (isInvoiceFromPreviousDate(target)) {
        alert('عذراً، محظور تعديل الفواتير الصادرة في ورديات سابقة أو مغلقة حفاظاً على سلامة الحسابات. التعديل متاح فقط لفواتير الوردية الحالية المفتوحة.');
        setAdminPasswordTarget(null);
        setAdminPasswordInput('');
        setAdminPasswordError(false);
        return;
      }
      setAdminPasswordTarget(null);
      setAdminPasswordInput('');
      setAdminPasswordError(false);
      if (onEditInvoiceInPOS) {
        onEditInvoiceInPOS(target);
      }
    } else {
      setAdminPasswordError(true);
    }
  };

  // استعادة فاتورة ملغاة مع إعادة كل آثارها المالية والمخزنية
  const handleRestoreInvoice = async (invoice: Invoice) => {
    const isAuthorized = !currentUser || ['admin', 'owner', 'programmer'].includes(currentUser.role) ||
      currentUser.actions?.includes('manage_invoices') || currentUser.actions?.includes('*');
    if (!isAuthorized) {
      alert('عذراً، استعادة الفواتير تتطلب صلاحية الإدارة.');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من استعادة الفاتورة رقم (${invoice.id})؟ سيتم إعادة تفعيلها وإعادة تسجيل آثارها المالية وكميات المنتجات.`)) return;

    // 1. تحديث حالة الفاتورة إلى مكتملة
    const restored = { 
      ...invoice, 
      status: 'completed' as const,
      updatedBy: currentUser?.username || currentUser?.name,
      updatedByName: currentUser?.name || currentUser?.username,
      updatedById: currentUser?.id,
      updatedAt: new Date().toISOString()
    };
    await DB.saveInvoice(restored);
    setInvoices(invoices.map(inv => inv.id === invoice.id ? restored : inv));

    // 2. إعادة إنشاء المعاملات المالية من طرق الدفع الموجودة في الفاتورة
    if (invoice.paymentMethods && invoice.paymentMethods.length > 0) {
      const restoredTrxs: Transaction[] = invoice.paymentMethods
        .filter(pm => pm.treasuryId !== 'cashback')
        .map(pm => ({
          id: 'TRX-RST-' + Math.random().toString(36).substr(2, 9),
          salonId: invoice.salonId,
          date: new Date().toISOString(),
          type: 'in' as const,
          amount: pm.amount,
          category: 'sales',
          description: `استعادة - مبيعات فاتورة ${invoice.id}`,
          treasury: pm.treasuryId,
          branchId: invoice.branchId,
        } as any));
      if (restoredTrxs.length > 0) {
        setTransactions([...transactions, ...restoredTrxs]);
        DB.saveTransactions(restoredTrxs, invoice.salonId);
      }
    }

    // 3. إعادة خصم كميات المنتجات من المخزن
    if (setProducts && invoice.items && invoice.items.some(i => i.type === 'product')) {
      const updatedProducts = [...products];
      const newMovements: any[] = [];
      invoice.items.forEach(item => {
        if (item.type === 'product' && item.itemId) {
          const pIdx = updatedProducts.findIndex(p => p.id === item.itemId);
          if (pIdx !== -1) {
            updatedProducts[pIdx] = { 
              ...updatedProducts[pIdx], 
              currentStock: updatedProducts[pIdx].currentStock - (item.quantity || 1) 
            };
            newMovements.push({
              id: 'MOV-RST-' + Math.random().toString(36).substr(2, 9),
              productId: item.itemId,
              date: new Date().toISOString(),
              type: 'sale',
              referenceId: invoice.id,
              quantityIn: 0,
              quantityOut: item.quantity || 1,
              balanceAfter: updatedProducts[pIdx].currentStock,
            });
          }
        }
      });
      setProducts(updatedProducts);
      if (setItemMovements && newMovements.length > 0) {
        setItemMovements((prev: any[]) => [...prev, ...newMovements]);
      }
    }

    // 4. إعادة خصم نقاط الكاش باك إذا كانت مستخدمة
    if (invoice.cashbackUsed && invoice.cashbackUsed > 0 && invoice.clientId) {
      const targetClient = clients.find(c => c.id === invoice.clientId);
      if (targetClient) {
        const updatedClient = { 
          ...targetClient, 
          loyaltyPoints: Math.max(0, (targetClient.loyaltyPoints || 0) - invoice.cashbackUsed!) 
        };
        await DB.saveClient(updatedClient);
        setClients(clients.map(c => c.id === invoice.clientId ? updatedClient : c));
      }
    }

    alert(`تم استعادة الفاتورة ${invoice.id} بنجاح وإعادة تسجيل آثارها المالية.`);
  };
  
  const handlePayInvoice = async () => {
    if (!showPayModal) return;
    
    const invoice = showPayModal;
    const client = invoice.clientId ? clients.find(c => c.id === invoice.clientId) : null;
    const maxCashback = client ? client.loyaltyPoints : 0;
    
    const finalCashbackUsed = Math.min(cashbackToUse, maxCashback, invoice.total);
    const remainingToPay = invoice.total - finalCashbackUsed;

    if (remainingToPay > 0 && !payTreasury) {
      alert('الرجاء اختيار خزينة لسداد باقي المبلغ');
      return;
    }
    
    const paymentMethods = [];
    
    if (finalCashbackUsed > 0) {
      paymentMethods.push({ amount: finalCashbackUsed, treasuryId: 'cashback' });
      if (client) {
        setClients(clients.map(c => c.id === client.id ? { ...c, loyaltyPoints: c.loyaltyPoints - finalCashbackUsed } : c));
      }
    }

    if (remainingToPay > 0) {
      // Create transaction
      const newTrx: Transaction = {
        id: 'TRX-' + Math.random().toString(36).substr(2,9),
        date: new Date().toISOString(),
        type: 'in',
        amount: remainingToPay,
        category: 'sales',
        description: `مبيعات - فاتورة ${invoice.id}`,
        treasury: payTreasury
      };
      setTransactions([...transactions, newTrx]);
      paymentMethods.push({ amount: remainingToPay, treasuryId: payTreasury });
    }
    
    const paidInv: Invoice = { 
      ...invoice, 
      status: 'completed', 
      paid: invoice.total,
      remaining: 0,
      settledAt: new Date().toISOString(),
      cashbackUsed: finalCashbackUsed,
      paymentMethods: paymentMethods,
      updatedBy: currentUser?.username || currentUser?.name,
      updatedByName: currentUser?.name || currentUser?.username,
      updatedById: currentUser?.id,
      updatedAt: new Date().toISOString()
    };
    await DB.saveInvoice(paidInv);
    setInvoices(invoices.map(inv => inv.id === invoice.id ? paidInv : inv));
    
    setShowPayModal(null);
    setCashbackToUse(0);
  };
  
  const handlePrint = (invoice: Invoice) => {
    executePrintInvoiceReceipt(`invoice-print-${invoice.id}`, invoice.id);
  };

  const mainBranch = (branches && branches[0]) || { id: 'b-main', name: 'الفرع الرئيسي' };
  const mainBranchId = mainBranch.id;
  const isMainBranch = !activeBranchId || activeBranchId === mainBranchId || activeBranchId === 'b-main';

  const matchesActiveBranch = (itemBranchId?: string, itemBranchCode?: string) => {
    if (!branches || branches.length <= 1) return true;
    // إذا كان فلتر الفرع مضبوطاً على "الكل" أو غير محدد، تُعرض فواتير جميع الفروع بالكامل
    if (!branchFilter || branchFilter === 'all') return true;

    const curBranch = branches.find(b => b.id === branchFilter);
    if (!curBranch) return true;
    const isMain = Boolean(curBranch?.isMain || curBranch?.id === branches[0]?.id);

    const bId = (itemBranchId || '').trim();
    const bCode = (itemBranchCode || '').trim();

    if (bId) {
      if (curBranch?.id && bId === curBranch.id) return true;
      if (curBranch?.code && bId.toLowerCase() === curBranch.code.toLowerCase()) return true;
      if (curBranch?.name && bId.toLowerCase() === curBranch.name.toLowerCase()) return true;
      if (isMain && (bId === 'b-main' || (branches[0] && bId === branches[0].id))) return true;
      return false;
    }
    if (bCode && curBranch?.code) {
      if (bCode.toLowerCase() === curBranch.code.toLowerCase()) return true;
      if (curBranch?.name && bCode.toLowerCase() === curBranch.name.toLowerCase()) return true;
      return false;
    }

    return isMain;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Branch filter
      if (!matchesActiveBranch(inv.branchId, (inv as any).branchCode)) return false;

      // Date & Shift filter
      if (isCashierRestricted) {
        // قيد الكاشير الصارم: يرى فقط الفواتير المنشأة في الوردية الحالية المفتوحة
        if (!isInvoiceInCurrentShift(inv)) return false;
      } else {
        // فحص التواريخ للإدارة والمالك مع شمول تاريخ الإنشاء لمنع اختفاء فواتير اليوم
        const invDateStr = getInvoiceLocalDateStr(inv);
        const invSettledDateStr = ((inv as any).settledAt || '').split('T')[0];
        const invCreatedDateStr = ((inv as any).createdAt || (inv as any).created_at || '').split('T')[0];
        if (dateFrom) {
          const matchesFrom = invDateStr >= dateFrom || 
                              (invSettledDateStr && invSettledDateStr >= dateFrom) ||
                              (invCreatedDateStr && invCreatedDateStr >= dateFrom);
          if (!matchesFrom) return false;
        }
        if (dateTo) {
          const matchesTo = invDateStr <= dateTo || 
                            (invSettledDateStr && invSettledDateStr <= dateTo) ||
                            (invCreatedDateStr && invCreatedDateStr <= dateTo);
          if (!matchesTo) return false;
        }
      }
      
      // Status filter
      if (statusFilter === 'wasel') {
        if (!isWaselInvoice(inv)) return false;
      } else if (statusFilter === 'refunded') {
        if (inv.status !== 'refunded') return false;
      } else if (statusFilter === 'partial_refund') {
        const hasPartial = salesReturns.some(r => r.originalInvoiceId === inv.id && r.status !== 'cancelled') && inv.status !== 'refunded';
        if (!hasPartial) return false;
      } else if (statusFilter === 'all') {
        // لحساب الأدمن والمالك والمبرمج: يشاهد كافة الفواتير المسجلة في النظام بالكامل دون استثناء
        if (!isAdminOrFullAccess) {
          const isUnpaidDeferred = (inv.status === 'deferred' || inv.status === 'unpaid' || inv.status === 'partially_paid') &&
            (Number(inv.remaining ?? 0) > 0.01 || Number(inv.paid ?? 0) < Number(inv.total ?? 0) - 0.01);
          if (isUnpaidDeferred) return false;
        }
      } else if (inv.status !== statusFilter) {
        return false;
      }
      
      // Payment filter
      if (paymentFilter !== 'all') {
        if (paymentFilter === 'wasel_free') {
          if (!isWaselInvoice(inv)) return false;
        } else {
          const hasPm = (inv.paymentMethods && inv.paymentMethods.some(pm => pm.treasuryId === paymentFilter)) || 
                        inv.paymentMethod === paymentFilter || 
                        (inv as any).treasuryId === paymentFilter;
          if (!hasPm) return false;
        }
      }
      
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (inv.id || '').toLowerCase().includes(q) || 
               (inv.clientName || '').toLowerCase().includes(q) || 
               (inv.clientPhone && inv.clientPhone.includes(q));
      }
      
      return true;
    }).sort((a, b) => parseDbDateTime(b.date).getTime() - parseDbDateTime(a.date).getTime());
  }, [invoices, dateFrom, dateTo, statusFilter, paymentFilter, searchQuery, activeBranchId, isMainBranch, branchFilter, salesReturns, isCashierRestricted, shiftData?.isOpen, isInvoiceInCurrentShift, isAdminOrFullAccess]);

  // Pagination calculation
  const totalInvoices = filteredInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedInvoices = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, safeCurrentPage, pageSize]);

  return (
    <div className="p-3 sm:p-5 lg:p-6 w-full h-full flex flex-col bg-slate-50 min-h-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800">إدارة الفواتير</h2>
            {isCashierRestricted && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs">
                <Lock size={12} className="text-amber-700" />
                <span>
                  {shiftData?.isOpen 
                    ? `فواتير الوردية الحالية (${effectiveShiftCode || activeShiftDate})` 
                    : 'الوردية مغلقة حالياً'}
                </span>
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">استعراض وتصفية فواتير النظام</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث بالرقم، الاسم، الجوال..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary w-56 sm:w-64 shadow-2xs" 
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer ${showFilters ? 'text-primary border-primary/50' : 'text-slate-700'}`}
          >
            <Filter size={15} /> 
            <span>تصفية</span>
            {showFilters ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>

          {onNavigateToReturns && (
            <button
              onClick={onNavigateToReturns}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
              title="الانتقال إلى سجل وإدارة مرتجعات المبيعات"
            >
              <RotateCcw size={15} />
              <span>المرتجعات ({salesReturns.length})</span>
            </button>
          )}

          {onNavigateToDeferred && (
            <button
              onClick={onNavigateToDeferred}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
              title="الانتقال إلى شاشة إدارة الفواتير الآجلة والذمم والمطالبات"
            >
              <Hourglass size={15} />
              <span>الفواتير الآجلة ({invoices.filter(i => (i.status === 'deferred' || i.status === 'partially_paid' || i.status === 'unpaid' || ((Number(i.remaining) > 0 || Number(i.paid || 0) < Number(i.total || 0) - 0.01) && i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'bad_debt'))).length})</span>
            </button>
          )}

          <button 
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
            title="سحب واستيراد فواتير سابقة من ملف إكسل .xlsx مكون من ورقتي عمل"
          >
            <FileSpreadsheet size={15} />
            <span>سحب من إكسل</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4 grid grid-cols-1 ${branches && branches.length > 1 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3.5 shrink-0`}>
          {isCashierRestricted && (
            <div className={`col-span-1 ${branches && branches.length > 1 ? 'md:col-span-5' : 'md:col-span-4'} bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-amber-900 text-xs font-bold shadow-2xs`}>
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-amber-600 shrink-0" />
                <span>
                  {shiftData?.isOpen 
                    ? `تنبيه صلاحيات الكاشير: استعراض الفواتير مقيد حصراً بفواتير الوردية الحالية المفتوحة وفقاً لكود الوردية المسجل بالفاتورة (${effectiveShiftCode || 'غير محدد'})، ولا يمكن استعراض أو تعديل فواتير أي ورديات سابقة حتى وإن فتحت الوردية بتاريخ سابق.`
                    : 'تنبيه صلاحيات الكاشير: لا توجد وردية مفتوحة حالياً لهذا الفرع. لن تظهر أي فواتير ولن يتاح تعديلها حتى يتم فتح وردية جديدة.'}
                </span>
              </div>
              {effectiveShiftCode && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 font-mono text-xs font-black shrink-0 border border-amber-300">
                  كود الوردية: {effectiveShiftCode}
                </span>
              )}
            </div>
          )}
          {branches && branches.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الفرع</label>
              <select 
                value={branchFilter} 
                onChange={e => setBranchFilter(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary"
              >
                <option value="all">جميع الفروع ({invoices.length})</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">{isCashierRestricted ? 'تاريخ الوردية' : 'من تاريخ'}</label>
              {isCashierRestricted && (
                <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5">
                  <Lock size={10} /> تاريخ الوردية
                </span>
              )}
            </div>
            <input 
              type={isCashierRestricted ? "text" : "date"} 
              value={isCashierRestricted ? (shiftData?.isOpen ? activeShiftDate : 'وردية مغلقة') : dateFrom} 
              onChange={e => {
                if (isCashierRestricted) return;
                setDateFrom(e.target.value);
              }} 
              disabled={isCashierRestricted}
              className={`w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none transition-all ${
                isCashierRestricted 
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900 cursor-not-allowed font-mono' 
                  : 'bg-slate-50 border-slate-200 focus:border-primary'
              }`} 
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">{isCashierRestricted ? 'كود الوردية' : 'إلى تاريخ'}</label>
              {isCashierRestricted && (
                <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5">
                  <Lock size={10} /> مقيد بالكود
                </span>
              )}
            </div>
            <input 
              type={isCashierRestricted ? "text" : "date"} 
              value={isCashierRestricted ? (effectiveShiftCode || 'لا يوجد وردية مفتوحة') : dateTo} 
              onChange={e => {
                if (isCashierRestricted) return;
                setDateTo(e.target.value);
              }} 
              disabled={isCashierRestricted}
              className={`w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none transition-all ${
                isCashierRestricted 
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900 cursor-not-allowed font-mono' 
                  : 'bg-slate-50 border-slate-200 focus:border-primary'
              }`} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">حالة الفاتورة</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary font-bold">
              <option value="all">الكل</option>
              <option value="completed">مكتملة ومسددة</option>
              <option value="wasel">واصل (خدمات مجانية)</option>
              <option value="deferred">مؤجلة بالكامل</option>
              <option value="partially_paid">مسددة جزئياً</option>
              <option value="partial_refund">مرتجع جزئي</option>
              <option value="refunded">مرتجع كلي</option>
              <option value="unpaid">غير مسددة</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع</label>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary font-bold">
              <option value="all">الكل</option>
              <option value="wasel_free">واصل (خدمات مجانية)</option>
              {settings.treasuries.map(t => (
                <option key={t.id} value={t.id}>{t.name} {t.isMain ? '(رئيسية)' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Table Container with Increased Height & Horizontal Scroll */}
      <div className="flex-1 min-h-[520px] lg:min-h-[640px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
        {/* Horizontal Navigation Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 bg-slate-100/90 border-b border-slate-200 text-xs font-bold text-slate-700 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-slate-500 text-[11px] sm:text-xs">التنقل السريع بأعمدة الجدول:</span>
            <button
              type="button"
              onClick={scrollToStart}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1 transition-all active:scale-95 text-slate-700 hover:text-primary cursor-pointer text-xs"
              title="الانتقال إلى بداية الجدول (اليمين)"
            >
              <span>بداية الجدول</span>
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={scrollTableRight}
              className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center justify-center transition-all active:scale-95 text-slate-700 hover:text-primary cursor-pointer"
              title="تمرير يمين"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={scrollTableLeft}
              className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center justify-center transition-all active:scale-95 text-slate-700 hover:text-primary cursor-pointer"
              title="تمرير يسار"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={scrollToActions}
              className="px-3 py-1 bg-gradient-to-r from-amber-100 to-amber-50 hover:from-amber-200 hover:to-amber-100 border border-amber-300 text-amber-900 rounded-lg shadow-2xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer font-black text-xs"
              title="الانتقال المباشر لليسار إلى عمود الإجراءات والتعديل والطباعة"
            >
              <ArrowLeft size={13} />
              <span>الانتقال لعمود الإجراءات والتعديل</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">
              إجمالي الفواتير المعروضة: <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">{filteredInvoices.length}</span>
            </span>
          </div>
        </div>

        <div ref={tableScrollRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0 custom-scrollbar scroll-smooth">
          <table className="w-full text-right text-xs sm:text-sm min-w-[1100px]">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="px-4 sm:px-6 py-3 whitespace-nowrap">رقم الفاتورة</th>
                <th className="px-4 sm:px-6 py-3 whitespace-nowrap">التاريخ والوقت</th>
                <th className="px-4 sm:px-6 py-3 whitespace-nowrap">العميل</th>
                <th className="px-4 sm:px-6 py-3 whitespace-nowrap">الخدمات والموظف</th>
                <th className="px-4 sm:px-6 py-3 text-center whitespace-nowrap">طريقة الدفع</th>
                <th className="px-4 sm:px-6 py-3 text-center whitespace-nowrap">الخصم</th>
                <th className="px-4 sm:px-6 py-3 text-center whitespace-nowrap">المسدد كاش باك</th>
                <th className="px-4 sm:px-6 py-3 whitespace-nowrap">الإجمالي</th>
                <th className="px-4 sm:px-6 py-3 text-center whitespace-nowrap">الحالة</th>
                <th className="px-4 sm:px-6 py-3 text-center whitespace-nowrap bg-slate-100/90 sticky left-0 z-10">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedInvoices.map((inv) => (
                <tr key={inv.id} className={`transition-colors ${inv.status === 'cancelled' ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-slate-800">
                    <div>{inv.id}</div>
                    {(inv.createdBy || inv.cashierName) && (
                      <div className="text-[10px] text-slate-400 font-normal">
                        بواسطة: {inv.createdBy || inv.cashierName}
                      </div>
                    )}
                    {inv.updatedBy && (
                      <div className="text-[9px] text-amber-600 font-normal">
                        تعديل: {inv.updatedBy}
                      </div>
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3 text-slate-600 font-medium whitespace-nowrap">{formatInvoiceDateTimeDisplay(inv.date, 'ar-EG')}</td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3">
                    <div className="font-bold text-primary">{inv.clientName}</div>
                    {inv.clientPhone && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5">
                        <span dir="ltr">{inv.clientPhone}</span>
                        <div className="relative inline-flex items-center">
                          <button
                            type="button"
                            onClick={(e) => handleCopyPhone(inv.clientPhone!, inv.id, e)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="نسخ رقم الموبايل"
                          >
                            {copiedPhoneId === inv.id ? (
                              <Check size={12} className="text-emerald-600 stroke-[2.5]" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          {copiedPhoneId === inv.id && (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-20 animate-in fade-in zoom-in-95">
                              تم نسخ الرقم
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {inv.isRemedyInvoice && (
                      <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full mt-1 border border-purple-200">
                        <Wrench size={10} />
                        <span>إصلاح مجاني (ضمان الصالون)</span>
                      </span>
                    )}
                    {inv.isWaselInvoice && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full mt-1 border border-amber-300" title={`المستفيد: ${inv.waselRecipientName || '-'} | السبب: ${inv.waselReason || '-'}`}>
                        <Gift size={10} className="text-amber-700" />
                        <span>واصل مجاني: {inv.waselRecipientName || ''}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3">
                    <div className="flex flex-col gap-1">
                      {inv.items.map((item, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-bold text-slate-700">{item.serviceName}</span>
                          <span className="text-slate-400 mx-1">بواسطة</span>
                          <span className="text-emerald-600 font-bold">{item.technicianName}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3 text-center text-xs font-bold text-slate-600">
                    {inv.isWaselInvoice || inv.paymentMethod === 'wasel_free' || inv.paymentMethods?.some(pm => pm.treasuryId === 'wasel_free') ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-black px-2.5 py-1 rounded-full border border-amber-300 shadow-2xs">
                        <Gift size={11} className="text-amber-700" />
                        <span>واصل</span>
                      </span>
                    ) : inv.isRemedyInvoice || inv.paymentMethod === 'remedy_free' || inv.paymentMethods?.some(pm => pm.treasuryId === 'remedy_free') ? (
                      <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 font-black px-2.5 py-1 rounded-full border border-purple-200 shadow-2xs">
                        <Wrench size={11} className="text-purple-700" />
                        <span>إصلاح (ضمان)</span>
                      </span>
                    ) : (
                      inv.paymentMethods?.map((pm, pmIdx) => {
                        const treasury = settings.treasuries.find(t => t.id === pm.treasuryId);
                        return treasury ? <div key={pm.treasuryId || pmIdx}>{treasury.name} ({Number(pm.amount || 0).toFixed(2)})</div> : null;
                      }) || '-'
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3 text-center font-bold text-red-500">{Number(inv.discount || 0) > 0 ? Number(inv.discount).toFixed(2) : '-'}</td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3 text-center font-bold text-blue-600">{Number(inv.cashbackUsed || 0) > 0 ? Number(inv.cashbackUsed).toFixed(2) : '-'}</td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-slate-800">
                    <div>{getEffectiveInvoiceTotal(inv).toFixed(2)} {settings.currency}</div>
                    {inv.advanceDeduction !== undefined && Number(inv.advanceDeduction || 0) > 0 && (
                      <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                        (عربون: {Number(inv.advanceDeduction || 0).toFixed(2)})
                      </div>
                    )}
                    {inv.isRemedyInvoice && <div className="text-[10px] text-purple-700 font-bold">(0.00 إصلاح)</div>}
                    {inv.isWaselInvoice && <div className="text-[10px] text-amber-700 font-bold">(0.00 واصل)</div>}
                  </td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3 text-center">
                    {(() => {
                      const invReturns = salesReturns.filter(r => r.originalInvoiceId === inv.id && r.status !== 'cancelled');
                      const totalReturned = invReturns.reduce((sum, r) => sum + (Number(r.totalRefund) || 0), 0);
                      const isPartial = invReturns.length > 0 && inv.status !== 'refunded' && inv.status !== 'cancelled';

                      if (inv.status === 'refunded') {
                        return (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            مرتجع كلي
                          </span>
                        );
                      }
                      if (isPartial) {
                        return (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              مرتجع جزئي
                            </span>
                            <span className="text-[10px] text-rose-600 font-mono font-bold">
                              (-{totalReturned.toFixed(2)})
                            </span>
                          </div>
                        );
                      }
                      if (inv.status === 'completed') {
                        return (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">مسددة</span>
                            {(inv as any).settledAt && (
                              <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold" title={`تم سداد الآجل بتاريخ: ${formatInvoiceDateTimeDisplay((inv as any).settledAt, 'ar-EG')}`}>
                                سداد آجل
                              </span>
                            )}
                          </div>
                        );
                      }
                      if (inv.status === 'deferred') {
                        return (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              مؤجلة
                            </span>
                            <span className="text-[10px] text-amber-700 font-mono font-bold">
                              متبقي: {(Number(inv.remaining) || Number(inv.total) || 0).toFixed(2)}
                            </span>
                          </div>
                        );
                      }
                      if (inv.status === 'partially_paid') {
                        return (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                              مسددة جزئياً
                            </span>
                            <span className="text-[10px] text-red-600 font-mono font-bold">
                              متبقي: {(Number(inv.remaining) || 0).toFixed(2)}
                            </span>
                          </div>
                        );
                      }
                      if (inv.status === 'bad_debt') {
                        return (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
                            دين معدوم
                          </span>
                        );
                      }
                      if (inv.status === 'unpaid') {
                        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600">غير مسددة</span>;
                      }
                      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-500">ملغاة</span>;
                    })()}
                  </td>
                  <td className="px-4 sm:px-6 py-2.5 sm:py-3 sticky left-0 bg-white/95 backdrop-blur-xs shadow-2xs z-1">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Before / After Photo Preview Button */}
                      {(inv.beforePhotoUrl || inv.afterPhotoUrl) && (
                        <button
                          onClick={() => setShowPhotoPreview({
                            before: inv.beforePhotoUrl,
                            after: inv.afterPhotoUrl,
                            title: `صور جلسة العميل (${inv.clientName}) - فاتورة #${inv.id}`
                          })}
                          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                          title="عرض صور قبل وبعد"
                        >
                          <ImageIcon size={16} />
                        </button>
                      )}

                      {/* زر إنشاء مرتجع مبيعات للفاتورة */}
                      {(inv.status === 'completed' || (salesReturns.some(r => r.originalInvoiceId === inv.id && r.status !== 'cancelled') && inv.status !== 'refunded')) && (
                        <button 
                          onClick={() => setReturnTargetInvoice(inv)} 
                          className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors cursor-pointer" 
                          title="إنشاء مرتجع مبيعات / إشعار دائن لهذه الفاتورة"
                        >
                          <RotateCcw size={15} />
                        </button>
                      )}

                      {inv.status === 'unpaid' && (
                        <button onClick={() => setShowPayModal(inv)} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors" title="سداد الفاتورة">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      
                      {canEditInvoice && (() => {
                        const isPrevDate = isInvoiceFromPreviousDate(inv);
                        return (
                          <button 
                            type="button"
                            disabled={isPrevDate}
                            onClick={() => {
                              if (isPrevDate) return;
                              handleInitiateEdit(inv);
                            }} 
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              isPrevDate 
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-40 shadow-none' 
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer shadow-xs'
                            }`} 
                            title={isPrevDate ? 'محظور تعديل الفواتير الصادرة في ورديات سابقة أو مغلقة (متاح فقط لفواتير الوردية الحالية المفتوحة)' : 'تعديل الفاتورة في نقطة البيع (POS)'}
                          >
                            <Edit size={16} />
                          </button>
                        );
                      })()}

                      <button onClick={() => handlePrint(inv)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors" title="طباعة">
                        <Printer size={16} />
                      </button>
                      
                      {inv.status === 'completed' && (
                        <button onClick={() => setCancelInvoiceTarget(inv)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors" title="إلغاء الفاتورة">
                          <XCircle size={16} />
                        </button>
                      )}

                      {/* زر استعادة الفاتورة الملغاة */}
                      {inv.status === 'cancelled' && (
                        <button 
                          onClick={() => handleRestoreInvoice(inv)} 
                          className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors" 
                          title="استعادة الفاتورة الملغاة وإعادة آثارها المالية"
                        >
                          <RotateCcw size={15} />
                        </button>
                      )}

                      {/* زر حذف الفاتورة نهائياً للإدارة أو لمن يملك الصلاحية */}
                      {canDeleteInvoice && (
                        <button 
                          onClick={() => handleDeleteInvoice(inv)} 
                          className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors" 
                          title="حذف الفاتورة نهائياً"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}

                      {/* زر فتح محادثة واتساب مباشرة مع العميل */}
                      {(() => {
                        const waUrl = getWhatsAppUrl(inv.clientPhone);
                        return waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors border border-emerald-200 shadow-2xs"
                            title={`فتح محادثة واتساب مع العميل (${inv.clientName})`}
                          >
                            <MessageCircle size={15} />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-300 flex items-center justify-center cursor-not-allowed opacity-50"
                            title="لا يوجد رقم هاتف للعميل"
                          >
                            <MessageCircle size={15} />
                          </button>
                        );
                      })()}
                    </div>
                    
                    {/* Hidden printable receipt matching BookingsScreen / POS format */}
                    <div className="hidden">
                      <InvoiceReceiptCard
                        id={`invoice-print-${inv.id}`}
                        invoice={inv}
                        settings={settings}
                        branches={branches}
                        activeBranchId={activeBranchId}
                        currentUser={currentUser}
                      />
                    </div>

                  </td>
                </tr>
              ))}
              
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-500 font-bold">
                    {isCashierRestricted && !shiftData?.isOpen 
                      ? 'لا توجد وردية مفتوحة حالياً لهذا الفرع. يرجى فتح وردية جديدة للبدء في استعراض وإصدار الفواتير.' 
                      : (isCashierRestricted 
                          ? `لا توجد فواتير منشأة في الوردية الحالية (${effectiveShiftCode || 'المفتوحة'}) حتى الآن.`
                          : 'لا توجد فواتير تطابق شروط التصفية')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls Bar */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-bold text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span>عرض</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 outline-none font-bold text-slate-700 shadow-2xs cursor-pointer focus:border-primary"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
            <span>فاتورة لكل صفحة</span>
            <span className="text-slate-400 mx-1">|</span>
            <span className="text-slate-700 font-extrabold">
              {totalInvoices === 0 ? 'لا توجد نتائج' : `عرض ${((safeCurrentPage - 1) * pageSize) + 1} - ${Math.min(safeCurrentPage * pageSize, totalInvoices)} من إجمالي ${totalInvoices} فاتورة`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              title="الصفحة الأولى"
            >
              <ChevronsRight size={16} />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              title="الصفحة السابقة"
            >
              <ChevronRight size={16} />
            </button>

            <span className="px-3.5 py-1 bg-white border border-slate-200 rounded-lg font-black text-slate-800 shadow-2xs">
              صفحة {safeCurrentPage} من {totalPages}
            </span>

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              title="الصفحة التالية"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              title="الصفحة الأخيرة"
            >
              <ChevronsLeft size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">سداد فاتورة</h3>
              <button onClick={() => setShowPayModal(null)} className="text-slate-400 hover:text-red-500"><XCircle size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="text-center mb-6">
                <p className="text-slate-500 text-sm mb-1">المبلغ المطلوب</p>
                <p className="text-3xl font-extrabold text-primary">{Number(showPayModal?.total || 0).toFixed(2)} <span className="text-sm">{settings.currency}</span></p>
              </div>

              {(() => {
                const client = showPayModal.clientId ? clients.find(c => c.id === showPayModal.clientId) : null;
                const maxCashback = Number(client?.cashback ?? client?.loyaltyPoints ?? 0);
                const remainingToPay = Math.max(0, Number(showPayModal?.total || 0) - (cashbackToUse || 0));

                return (
                  <>
                    {client && maxCashback > 0 && (
                      <div className="mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-blue-800">رصيد الكاش باك المتوفر:</span>
                          <span className="text-sm font-bold text-blue-600">{Number(maxCashback || 0).toFixed(2)} {settings.currency}</span>
                        </div>
                        <label className="block text-xs font-bold text-blue-700 mb-1">المبلغ المستخدم من الكاش باك:</label>
                        <input 
                          type="number" 
                          max={Math.min(maxCashback, Number(showPayModal?.total || 0))}
                          min={0}
                          value={cashbackToUse}
                          onChange={(e) => {
                            let val = Number(e.target.value);
                            if (val > maxCashback) val = maxCashback;
                            if (val > Number(showPayModal?.total || 0)) val = Number(showPayModal?.total || 0);
                            if (val < 0) val = 0;
                            setCashbackToUse(val);
                          }}
                          className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    {remainingToPay > 0 && (
                      <>
                        <div className="mb-4 text-center">
                          <span className="text-sm font-bold text-slate-600">المبلغ المتبقي للدفع: </span>
                          <span className="text-lg font-bold text-primary">{Number(remainingToPay || 0).toFixed(2)} {settings.currency}</span>
                        </div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">طريقة الدفع (الخزينة)</label>
                        <div className="space-y-2">
                          {settings.treasuries.filter(t => !t.isMain).map(t => (
                            <label key={t.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${payTreasury === t.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-slate-200'}`}>
                              <input type="radio" name="payTreasury" value={t.id} checked={payTreasury === t.id} onChange={() => setPayTreasury(t.id)} className="text-primary" />
                              <span className="font-bold text-slate-700">{t.name}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button onClick={handlePayInvoice} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors">تأكيد السداد</button>
            </div>
          </div>
        </div>
      )}



      {/* Cancel Confirm Modal */}
      {cancelInvoiceTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} />
              </div>
              <h3 className="font-bold text-xl text-slate-800 mb-2">إلغاء الفاتورة</h3>
              <p className="text-slate-500 text-sm">هل أنت متأكد من إلغاء هذه الفاتورة؟ سيزول أثرها المالي بالكامل ولن يمكنك التراجع عن هذا الإجراء.</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setCancelInvoiceTarget(null)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition-colors">تراجع</button>
              <button onClick={handleConfirmCancel} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors">تأكيد الإلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Modal */}
      {adminPasswordTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6">
              <h3 className="font-bold text-xl text-slate-800 mb-2">صلاحية إدارة</h3>
              <p className="text-slate-500 text-sm mb-4">الرجاء إدخال كلمة مرور الإدارة لتعديل الفاتورة.</p>
              <input 
                type="password" 
                value={adminPasswordInput}
                onChange={e => setAdminPasswordInput(e.target.value)}
                placeholder="كلمة المرور (admin)"
                onKeyDown={(e) => e.key === 'Enter' && handleAdminPasswordSubmit()}
                className={`w-full bg-slate-50 border ${adminPasswordError ? 'border-red-500' : 'border-slate-200'} rounded-lg px-4 py-3 text-center outline-none focus:border-primary`} 
              />
              {adminPasswordError && <p className="text-red-500 text-xs mt-2">كلمة المرور غير صحيحة</p>}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => {
                setAdminPasswordTarget(null);
                setAdminPasswordInput('');
                setAdminPasswordError(false);
              }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition-colors">إلغاء</button>
              <button onClick={handleAdminPasswordSubmit} className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors">دخول</button>
            </div>
          </div>
        </div>
      )}

      {/* Before / After Photo Comparison Modal */}
      {showPhotoPreview && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">{showPhotoPreview.title}</h3>
              <button onClick={() => setShowPhotoPreview(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 text-center">
                <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full border border-amber-200">
                  صورة قبل (Before)
                </span>
                <div className="h-72 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  {showPhotoPreview.before ? (
                    <img src={showPhotoPreview.before} alt="Before" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">لا توجد صورة قبل</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-center">
                <span className="bg-emerald-100 text-emerald-900 text-xs font-black px-3 py-1 rounded-full border border-emerald-200">
                  صورة بعد (After)
                </span>
                <div className="h-72 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  {showPhotoPreview.after ? (
                    <img src={showPhotoPreview.after} alt="After" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">لا توجد صورة بعد</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowPhotoPreview(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2 rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <InvoicesImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          settings={settings}
          existingInvoices={invoices}
          clients={clients}
          employees={employees}
          services={services}
          products={products}
          activeBranchId={activeBranchId}
          currentUser={currentUser}
          onImportComplete={(newInvoices, newClients) => {
            // تحديث الفواتير في الواجهة
            setInvoices([
              ...newInvoices, 
              ...invoices.filter(old => !newInvoices.some(n => n.id.trim().toUpperCase() === old.id.trim().toUpperCase()))
            ]);
            // تحديث العملاء إن وجد عملاء جدد
            if (newClients.length > 0 && setClients) {
              setClients([...clients, ...newClients]);
            }
          }}
        />
      )}

      {returnTargetInvoice && (
        <SalesReturnModal
          isOpen={Boolean(returnTargetInvoice)}
          onClose={() => setReturnTargetInvoice(null)}
          initialInvoice={returnTargetInvoice}
          onConfirm={(ret) => {
            if (onProcessSalesReturn) {
              onProcessSalesReturn(ret);
            }
            setReturnTargetInvoice(null);
          }}
          settings={settings}
          invoices={invoices}
          salesReturns={salesReturns}
          currentUser={currentUser}
          products={products}
          employees={employees}
          services={services}
        />
      )}

    </div>
  );
}

