import React, { useState, useMemo } from 'react';
import { 
  AppSettings, Invoice, Transaction, Client, Branch 
} from '../types';
import { 
  Search, Filter, Calendar, DollarSign, Clock, CheckCircle2, 
  AlertTriangle, Hourglass, Phone, MessageCircle, Printer, X, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  ArrowUpDown, ArrowUp, ArrowDown, FileText, Ban, RotateCcw, 
  Eye, Wallet, CreditCard, User, Building, Info, ShieldAlert
} from 'lucide-react';
import { DB } from '../services/db';
import { executePrintInvoiceReceipt } from './InvoiceReceiptCard';

interface DeferredInvoicesScreenProps {
  settings: AppSettings;
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[] | ((prev: Invoice[]) => Invoice[])) => void;
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  clients: Client[];
  setClients?: (clients: Client[] | ((prev: Client[]) => Client[])) => void;
  activeBranchId?: string;
  branches?: Branch[];
  currentUser?: any;
  onNavigate?: (screenId: string) => void;
}

export function DeferredInvoicesScreen({
  settings,
  invoices,
  setInvoices,
  transactions,
  setTransactions,
  clients,
  setClients,
  activeBranchId,
  branches = [],
  currentUser,
  onNavigate
}: DeferredInvoicesScreenProps) {
  // Tabs: 'deferred' = active deferred invoices, 'ledger' = client debt statement, 'bad_debts' = written off
  const [activeTab, setActiveTab] = useState<'deferred' | 'ledger' | 'bad_debts'>('deferred');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'deferred' | 'partially_paid'>('all');

  // Client Ledger Sorting
  const [ledgerSortOrder, setLedgerSortOrder] = useState<'desc' | 'asc'>('desc'); // desc = highest debt first

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals State
  const [settleModalInvoice, setSettleModalInvoice] = useState<Invoice | null>(null);
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [settleTreasury, setSettleTreasury] = useState<string>(
    settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || 'cash'
  );
  const [settleNotes, setSettleNotes] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Bad Debt Modal
  const [badDebtModalInvoice, setBadDebtModalInvoice] = useState<Invoice | null>(null);
  const [badDebtReason, setBadDebtReason] = useState('تعذر الوصول للعميل');
  const [isSubmittingBadDebt, setIsSubmittingBadDebt] = useState(false);

  // Client Statement Print Modal
  const [statementClient, setStatementClient] = useState<{
    clientName: string;
    clientPhone: string;
    invoices: Invoice[];
    totalBilled: number;
    totalPaid: number;
    totalRemaining: number;
  } | null>(null);

  // Payments History Quick View Modal
  const [historyModalInvoice, setHistoryModalInvoice] = useState<Invoice | null>(null);

  // Branch matching helper
  const matchesBranch = (itemBranchId?: string) => {
    if (branchFilter !== 'all') return itemBranchId === branchFilter;
    if (!itemBranchId) return true;
    if (!branches || branches.length <= 1) return true;
    if (activeBranchId && activeBranchId !== 'all' && activeBranchId !== 'b-main') {
      return itemBranchId === activeBranchId;
    }
    return true;
  };

  // Base list of deferred / partially paid invoices
  const rawDeferredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!matchesBranch(inv.branchId)) return false;
      const isDeferredStatus = inv.status === 'deferred' || inv.status === 'partially_paid' || inv.status === 'unpaid';
      const hasDebt = (Number(inv.remaining) > 0 || (Number(inv.paid) === 0 && Number(inv.total) > 0));
      return isDeferredStatus && hasDebt && inv.status !== 'cancelled' && inv.status !== 'bad_debt';
    });
  }, [invoices, branchFilter, activeBranchId, branches]);

  // Bad debts list
  const badDebtsInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!matchesBranch(inv.branchId)) return false;
      return inv.status === 'bad_debt';
    });
  }, [invoices, branchFilter, activeBranchId, branches]);

  // Overall KPIs
  const stats = useMemo(() => {
    const totalRemaining = rawDeferredInvoices.reduce((acc, inv) => acc + (Number(inv.remaining) || (Number(inv.total) - Number(inv.paid || 0))), 0);
    const totalPaid = rawDeferredInvoices.reduce((acc, inv) => acc + (Number(inv.paid) || 0), 0);
    const uniqueIndebtedClients = new Set(rawDeferredInvoices.map(i => i.clientPhone || i.clientName || i.clientId)).size;
    const totalBadDebts = badDebtsInvoices.reduce((acc, inv) => acc + (Number(inv.remaining) || Number(inv.total) || 0), 0);

    return {
      totalRemaining,
      totalPaid,
      countDeferred: rawDeferredInvoices.length,
      indebtedClientsCount: uniqueIndebtedClients,
      badDebtsTotal: totalBadDebts,
      badDebtsCount: badDebtsInvoices.length
    };
  }, [rawDeferredInvoices, badDebtsInvoices]);

  // Filtered Deferred Invoices for Tab 1
  const filteredDeferredInvoices = useMemo(() => {
    return rawDeferredInvoices.filter(inv => {
      // Date filter
      const invDateStr = (inv.date || '').split('T')[0];
      if (dateFrom && invDateStr < dateFrom) return false;
      if (dateTo && invDateStr > dateTo) return false;

      // Status filter
      if (statusFilter === 'deferred' && inv.status !== 'deferred') return false;
      if (statusFilter === 'partially_paid' && inv.status !== 'partially_paid') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesId = (inv.invoiceNumber || inv.id || '').toLowerCase().includes(q);
        const matchesName = (inv.clientName || '').toLowerCase().includes(q);
        const matchesPhone = (inv.clientPhone || '').includes(q);
        if (!matchesId && !matchesName && !matchesPhone) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawDeferredInvoices, dateFrom, dateTo, statusFilter, searchQuery]);

  // Filtered Bad Debts for Tab 3
  const filteredBadDebts = useMemo(() => {
    return badDebtsInvoices.filter(inv => {
      const invDateStr = (inv.date || '').split('T')[0];
      if (dateFrom && invDateStr < dateFrom) return false;
      if (dateTo && invDateStr > dateTo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesId = (inv.invoiceNumber || inv.id || '').toLowerCase().includes(q);
        const matchesName = (inv.clientName || '').toLowerCase().includes(q);
        const matchesPhone = (inv.clientPhone || '').includes(q);
        if (!matchesId && !matchesName && !matchesPhone) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [badDebtsInvoices, dateFrom, dateTo, searchQuery]);

  // Client Debt Ledger Aggregation for Tab 2
  const clientDebtLedger = useMemo(() => {
    const map = new Map<string, {
      clientId?: string;
      clientName: string;
      clientPhone: string;
      invoices: Invoice[];
      totalBilled: number;
      totalPaid: number;
      totalRemaining: number;
      oldestInvoiceDate: string;
      newestInvoiceDate: string;
    }>();

    rawDeferredInvoices.forEach(inv => {
      const key = (inv.clientPhone && inv.clientPhone.trim()) 
        ? inv.clientPhone.trim() 
        : (inv.clientName ? inv.clientName.trim() : (inv.clientId || 'unknown'));
      
      const invRemaining = Number(inv.remaining) || Math.max(0, Number(inv.total) - Number(inv.paid || 0));
      const invPaid = Number(inv.paid) || 0;
      const invTotal = Number(inv.total) || 0;

      if (!map.has(key)) {
        map.set(key, {
          clientId: inv.clientId,
          clientName: inv.clientName || 'عميل نقدي',
          clientPhone: inv.clientPhone || '',
          invoices: [inv],
          totalBilled: invTotal,
          totalPaid: invPaid,
          totalRemaining: invRemaining,
          oldestInvoiceDate: inv.date,
          newestInvoiceDate: inv.date
        });
      } else {
        const entry = map.get(key)!;
        entry.invoices.push(inv);
        entry.totalBilled += invTotal;
        entry.totalPaid += invPaid;
        entry.totalRemaining += invRemaining;
        if (new Date(inv.date).getTime() < new Date(entry.oldestInvoiceDate).getTime()) {
          entry.oldestInvoiceDate = inv.date;
        }
        if (new Date(inv.date).getTime() > new Date(entry.newestInvoiceDate).getTime()) {
          entry.newestInvoiceDate = inv.date;
        }
      }
    });

    let list = Array.from(map.values());

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(item => 
        item.clientName.toLowerCase().includes(q) || 
        item.clientPhone.includes(q)
      );
    }

    // Sort by Total Remaining Debt (من الأكبر للأصغر أو من الأصغر للأكبر)
    list.sort((a, b) => {
      if (ledgerSortOrder === 'desc') {
        return b.totalRemaining - a.totalRemaining;
      } else {
        return a.totalRemaining - b.totalRemaining;
      }
    });

    return list;
  }, [rawDeferredInvoices, searchQuery, ledgerSortOrder]);

  // Current active data list based on tab
  const currentTabList = useMemo(() => {
    if (activeTab === 'deferred') return filteredDeferredInvoices;
    if (activeTab === 'ledger') return clientDebtLedger;
    return filteredBadDebts;
  }, [activeTab, filteredDeferredInvoices, clientDebtLedger, filteredBadDebts]);

  // Pagination calculation
  const totalItems = currentTabList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return currentTabList.slice(start, start + pageSize);
  }, [currentTabList, safeCurrentPage, pageSize]);

  // Reset pagination on tab change or search
  const handleTabChange = (tab: 'deferred' | 'ledger' | 'bad_debts') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // 💳 Action: Open Settlement Modal
  const handleOpenSettleModal = (inv: Invoice) => {
    const remaining = Number(inv.remaining) || Math.max(0, Number(inv.total) - Number(inv.paid || 0));
    setSettleModalInvoice(inv);
    setSettleAmount(remaining);
    setSettleTreasury(settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || 'cash');
    setSettleNotes('');
  };

  // 💾 Action: Confirm Settlement Payment
  const handleConfirmSettle = async () => {
    if (!settleModalInvoice) return;
    const payNum = Number(settleAmount);
    const currentRemaining = Number(settleModalInvoice.remaining) || Math.max(0, Number(settleModalInvoice.total) - Number(settleModalInvoice.paid || 0));

    if (isNaN(payNum) || payNum <= 0) {
      alert('⚠️ الرجاء إدخال مبلغ سداد صحيح أكبر من الصفر.');
      return;
    }
    if (payNum > currentRemaining + 0.01) {
      alert(`⚠️ المبلغ المدخل (${payNum}) أكبر من المتبقي المستحق على الفاتورة (${currentRemaining.toFixed(2)})!`);
      return;
    }
    if (!settleTreasury) {
      alert('⚠️ الرجاء اختيار الخزينة المودع بها المبلغ.');
      return;
    }

    setIsSubmittingSettle(true);
    try {
      const nowIso = new Date().toISOString();
      const treasuryName = settings.treasuries.find(t => t.id === settleTreasury)?.name || settleTreasury;
      const newPaid = Number(settleModalInvoice.paid || 0) + payNum;
      const newRemaining = Math.max(0, currentRemaining - payNum);
      const isFullyPaid = newRemaining <= 0.01;

      // 1. Payment history entry
      const pmtEntry = {
        id: 'PMT-' + Date.now(),
        date: nowIso,
        amount: payNum,
        paymentMethod: treasuryName,
        treasuryId: settleTreasury,
        notes: settleNotes?.trim() || (isFullyPaid ? 'سداد كامل المبلغ المتبقي' : 'سداد دفعة جزئية من الآجل'),
        createdBy: currentUser?.name || 'المحاسب'
      };

      const updatedHistory = [...(settleModalInvoice.paymentsHistory || []), pmtEntry];

      // 2. Updated Invoice object
      const updatedInvoice: Invoice = {
        ...settleModalInvoice,
        paid: newPaid,
        remaining: isFullyPaid ? 0 : newRemaining,
        status: isFullyPaid ? 'completed' : 'partially_paid',
        paymentsHistory: updatedHistory,
        paymentMethods: [
          ...(settleModalInvoice.paymentMethods || []),
          { amount: payNum, treasuryId: settleTreasury }
        ]
      };

      // 3. Create and record income Transaction to deposit in treasury
      const newTrx: Transaction = {
        id: 'TRX-DEF-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        salonId: settings.salonId,
        date: nowIso,
        type: 'in',
        amount: payNum,
        category: 'sales',
        description: `سداد آجل - فاتورة ${updatedInvoice.invoiceNumber || updatedInvoice.id} (${updatedInvoice.clientName})`,
        treasury: settleTreasury,
        branchId: updatedInvoice.branchId || activeBranchId,
        invoiceId: updatedInvoice.id
      } as any;

      // Save to DB
      await DB.saveInvoice(updatedInvoice, settings.salonId);
      await DB.saveTransaction(newTrx, settings.salonId);

      // Update Local State
      setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
      setTransactions(prev => [newTrx, ...prev]);

      if (isFullyPaid) {
        alert(`✅ تم سداد الفاتورة (${updatedInvoice.invoiceNumber || updatedInvoice.id}) بالكامل بمبلغ ${payNum.toFixed(2)} ${settings.currency}، وتم تحويلها تلقائياً إلى شاشة الفواتير المكتملة.`);
      } else {
        alert(`✅ تم سداد دفعة بقيمة ${payNum.toFixed(2)} ${settings.currency} بنجاح وإيداعها في خزينة (${treasuryName}). المتبقي على الفاتورة: ${newRemaining.toFixed(2)} ${settings.currency}.`);
      }

      setSettleModalInvoice(null);
    } catch (err: any) {
      console.error('Error settling deferred invoice:', err);
      alert('❌ حدث خطأ أثناء تسجيل السداد: ' + (err?.message || err));
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // ⚠️ Action: Write off as Bad Debt (تحويل لدين معدوم)
  const handleConfirmBadDebt = async () => {
    if (!badDebtModalInvoice) return;
    setIsSubmittingBadDebt(true);
    try {
      const updatedInvoice: Invoice = {
        ...badDebtModalInvoice,
        status: 'bad_debt',
        badDebtReason: badDebtReason.trim() || 'تعذر التحصيل',
        badDebtAt: new Date().toISOString(),
        badDebtBy: currentUser?.name || 'المدير'
      };

      await DB.saveInvoice(updatedInvoice, settings.salonId);
      setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));

      alert(`⚠️ تم تحويل الفاتورة (${updatedInvoice.invoiceNumber || updatedInvoice.id}) إلى ديون معدومة وحفظ سبب الشطب في الأرشيف.`);
      setBadDebtModalInvoice(null);
    } catch (err: any) {
      console.error('Error writing off bad debt:', err);
      alert('❌ حدث خطأ: ' + (err?.message || err));
    } finally {
      setIsSubmittingBadDebt(false);
    }
  };

  // 🔄 Action: Restore Bad Debt (استعادة دين معدوم إلى الآجل)
  const handleRestoreBadDebt = async (inv: Invoice) => {
    if (!window.confirm(`هل أنت متأكد من استعادة الفاتورة (${inv.invoiceNumber || inv.id}) من الديون المعدومة إلى الفواتير الآجلة النشطة؟`)) {
      return;
    }
    try {
      const restoredStatus: Invoice['status'] = (Number(inv.paid) > 0) ? 'partially_paid' : 'deferred';
      const updatedInvoice: Invoice = {
        ...inv,
        status: restoredStatus,
        badDebtReason: undefined,
        badDebtAt: undefined,
        badDebtBy: undefined
      };
      await DB.saveInvoice(updatedInvoice, settings.salonId);
      setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
      alert('✅ تم استعادة الفاتورة بنجاح إلى قائمة الفواتير الآجلة.');
    } catch (e: any) {
      alert('❌ فشلت الاستعادة: ' + e?.message);
    }
  };

  // 💬 Action: Send polite WhatsApp reminder to client
  const handleSendWhatsAppReminder = (clientName: string, phone: string, remainingDebt: number, invoicesCount: number) => {
    if (!phone || phone.length < 8) {
      alert('⚠️ لا يتوفر رقم هاتف مسجل لهذا العميل لإرسال تذكير واتساب.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const salonName = settings.salonName || 'صالونكم';
    const message = `السلام عليكم ورحمة الله أستاذ ${clientName}،\nتحية طيبة من ${salonName} 🌺\n\nنود تذكير سيادتكم بلطف بوجود رصيد آجل مستحق بقيمة: ${remainingDebt.toFixed(2)} ${settings.currency} (عدد ${invoicesCount} فاتورة).\n\nنسعد بتشريفكم لسدادها بالصالون، أو يمكنكم التحويل عبر إنستاباي / فودافون كاش.\nشاكرين ومقدرين حسن تعاملكم معنا دائماً 🙏`;
    
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // 🖨️ Action: Print Client Account Statement
  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="p-6 md:p-8 w-full h-full flex flex-col bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-2xl">
              <Hourglass size={26} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">إدارة الفواتير الآجلة والذمم والمطالبات</h2>
              <p className="text-slate-500 text-xs font-bold mt-0.5">
                متابعة الفواتير المؤجلة والمسددة جزئياً، سداد المطالبات، كشوف حساب العملاء، وأرشيف الديون المعدومة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          {onNavigate && (
            <button
              onClick={() => onNavigate('invoices')}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-extrabold rounded-xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <FileText size={16} className="text-slate-500" />
              <span>شاشة الفواتير المكتملة</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border border-amber-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-bold">إجمالي الذمم والديون القائمة</span>
            <Hourglass size={18} />
          </div>
          <p className="text-2xl font-black text-amber-900 font-mono">
            {stats.totalRemaining.toFixed(2)} <span className="text-xs font-bold text-slate-500">{settings.currency}</span>
          </p>
          <p className="text-[11px] font-bold text-amber-700 mt-1">مستحقة على {stats.indebtedClientsCount} عميل</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border border-emerald-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-bold">المبالغ المحصلة من الآجل</span>
            <CheckCircle2 size={18} />
          </div>
          <p className="text-2xl font-black text-emerald-800 font-mono">
            {stats.totalPaid.toFixed(2)} <span className="text-xs font-bold text-slate-500">{settings.currency}</span>
          </p>
          <p className="text-[11px] font-bold text-emerald-700 mt-1">دفعات تم تحصيلها وإيداعها بالخزائن</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-white border border-blue-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-xs font-bold">عدد الفواتير الآجلة</span>
            <FileText size={18} />
          </div>
          <p className="text-2xl font-black text-blue-900 font-mono">
            {stats.countDeferred} <span className="text-xs font-bold text-slate-500">فاتورة</span>
          </p>
          <p className="text-[11px] font-bold text-blue-700 mt-1">مؤجلة كلياً أو مسددة جزئياً</p>
        </div>

        <div className="bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-white border border-rose-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-bold">أرشيف الديون المعدومة</span>
            <Ban size={18} />
          </div>
          <p className="text-2xl font-black text-rose-900 font-mono">
            {stats.badDebtsTotal.toFixed(2)} <span className="text-xs font-bold text-slate-500">{settings.currency}</span>
          </p>
          <p className="text-[11px] font-bold text-rose-700 mt-1">{stats.badDebtsCount} فواتير مشطوبة بقرار إداري</p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 bg-white p-2 rounded-2xl shadow-xs">
        <button
          onClick={() => handleTabChange('deferred')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'deferred'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Hourglass size={18} />
          <span>الفواتير الآجلة النشطة ({stats.countDeferred})</span>
        </button>

        <button
          onClick={() => handleTabChange('ledger')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <User size={18} />
          <span>كشف حساب ومطالبات العملاء ({clientDebtLedger.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('bad_debts')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'bad_debts'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Ban size={18} />
          <span>أرشيف الديون المعدومة ({stats.badDebtsCount})</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 mb-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder={activeTab === 'ledger' ? "بحث باسم العميل أو رقم الموبايل..." : "بحث برقم الفاتورة، اسم العميل، أو الهاتف..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Date Range: From */}
          <div className="md:col-span-2.5 flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">من:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-primary"
            />
          </div>

          {/* Date Range: To */}
          <div className="md:col-span-2.5 flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">إلى:</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-primary"
            />
          </div>

          {/* Multi-Branch Selector if available */}
          {branches && branches.length > 1 && (
            <div className="md:col-span-1.5">
              <select
                value={branchFilter}
                onChange={e => { setBranchFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary"
              >
                <option value="all">كل الفروع</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status filter for Tab 1 */}
          {activeTab === 'deferred' && (
            <div className="md:col-span-1.5">
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary"
              >
                <option value="all">كافة الحالات</option>
                <option value="deferred">مؤجلة بالكامل</option>
                <option value="partially_paid">مسددة جزئياً</option>
              </select>
            </div>
          )}

          {/* Sorting for Tab 2 (كشف حساب العملاء) */}
          {activeTab === 'ledger' && (
            <div className="md:col-span-3 flex items-center justify-end gap-2">
              <span className="text-xs font-bold text-slate-500">الترتيب:</span>
              <button
                type="button"
                onClick={() => setLedgerSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                title="تغيير الترتيب حسب إجمالي المتبقي"
              >
                {ledgerSortOrder === 'desc' ? (
                  <>
                    <ArrowDown size={14} className="text-amber-600" />
                    <span>من الأكبر للأصغر 🔽</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={14} className="text-blue-600" />
                    <span>من الأصغر للأكبر 🔼</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Reset Filters */}
          {(searchQuery || dateFrom || dateTo || statusFilter !== 'all' || branchFilter !== 'all') && (
            <div className="md:col-span-1 flex justify-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateFrom('');
                  setDateTo('');
                  setStatusFilter('all');
                  setBranchFilter('all');
                  setCurrentPage(1);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 p-2 rounded-xl hover:bg-rose-50 cursor-pointer"
                title="مسح كافة الفلاتر"
              >
                <X size={15} />
                <span>مسح</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================== TAB 1: الفواتير الآجلة النشطة ===================== */}
      {activeTab === 'deferred' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-black">
                  <th className="py-3.5 px-4">رقم الفاتورة والتاريخ</th>
                  <th className="py-3.5 px-4">العميل وبيانات الاتصال</th>
                  <th className="py-3.5 px-4 text-center">إجمالي الفاتورة</th>
                  <th className="py-3.5 px-4 text-center">المدفوع</th>
                  <th className="py-3.5 px-4 text-center">المتبقي المطلوب</th>
                  <th className="py-3.5 px-4 text-center">تاريخ الاستحقاق</th>
                  <th className="py-3.5 px-4 text-center">الحالة</th>
                  <th className="py-3.5 px-4">ملاحظات</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pagedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <Hourglass size={42} className="mx-auto text-slate-300 mb-2 opacity-60" />
                      <p className="font-extrabold text-sm text-slate-600">لا توجد فواتير آجلة مطابقة لخيارات البحث</p>
                      <p className="text-xs text-slate-400 mt-1">جميع الفواتير مسددة بالكامل أو تم شطبها</p>
                    </td>
                  </tr>
                ) : (
                  (pagedItems as Invoice[]).map(inv => {
                    const remaining = Number(inv.remaining) || Math.max(0, Number(inv.total) - Number(inv.paid || 0));
                    const paid = Number(inv.paid) || 0;
                    const total = Number(inv.total) || 0;
                    const isOverdue = inv.dueDate && new Date(inv.dueDate).getTime() < new Date().setHours(0,0,0,0);

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-black text-slate-800 block">{inv.invoiceNumber || inv.id}</span>
                          <span className="text-[11px] text-slate-400 font-bold block mt-0.5">
                            {new Date(inv.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-800 block text-sm">{inv.clientName || 'عميل نقدي'}</span>
                          {inv.clientPhone && (
                            <span className="text-[11px] text-slate-500 font-mono font-bold flex items-center gap-1 mt-0.5" dir="ltr">
                              <Phone size={11} className="text-slate-400" />
                              {inv.clientPhone}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                          {total.toFixed(2)} {settings.currency}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">
                          {paid.toFixed(2)} {settings.currency}
                          {inv.paymentsHistory && inv.paymentsHistory.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setHistoryModalInvoice(inv)}
                              className="block mx-auto text-[10px] text-blue-600 hover:underline mt-0.5 font-bold cursor-pointer"
                            >
                              ({inv.paymentsHistory.length} دفعات)
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono font-black text-amber-700 text-sm bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {remaining.toFixed(2)} {settings.currency}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {inv.dueDate ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isOverdue ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isOverdue && <AlertTriangle size={12} className="text-rose-600" />}
                              <span>{inv.dueDate}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {inv.status === 'partially_paid' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                              <Clock size={12} />
                              <span>مسددة جزئياً</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                              <Hourglass size={12} />
                              <span>مؤجلة بالكامل</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 text-xs max-w-xs truncate" title={inv.notes || ''}>
                          {inv.notes || '-'}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* زر سداد الفاتورة */}
                            <button
                              type="button"
                              onClick={() => handleOpenSettleModal(inv)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                              title="سداد الفاتورة أو جزء منها"
                            >
                              <Wallet size={14} />
                              <span>سداد</span>
                            </button>

                            {/* زر تذكير واتساب */}
                            {inv.clientPhone && (
                              <button
                                type="button"
                                onClick={() => handleSendWhatsAppReminder(inv.clientName, inv.clientPhone || '', remaining, 1)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer"
                                title="إرسال تذكير سداد عبر واتساب"
                              >
                                <MessageCircle size={16} />
                              </button>
                            )}

                            {/* طباعة الإيصال */}
                            <button
                              type="button"
                              onClick={() => executePrintInvoiceReceipt(`invoice-print-${inv.id}`, inv.id)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                              title="طباعة إيصال الفاتورة"
                            >
                              <Printer size={16} />
                            </button>

                            {/* زر تحويل لدين معدوم */}
                            <button
                              type="button"
                              onClick={() => { setBadDebtModalInvoice(inv); setBadDebtReason('تعذر الوصول للعميل'); }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-all cursor-pointer"
                              title="تحويل الفاتورة إلى دين معدوم (شطب)"
                            >
                              <Ban size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: كشف حساب ومطالبات العملاء ===================== */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-black">
                  <th className="py-3.5 px-4">اسم العميل ورقم الموبايل</th>
                  <th className="py-3.5 px-4 text-center">عدد الفواتير الآجلة</th>
                  <th className="py-3.5 px-4 text-center">أقدم تاريخ فاتورة</th>
                  <th className="py-3.5 px-4 text-center">إجمالي المطلوب</th>
                  <th className="py-3.5 px-4 text-center">المسدد</th>
                  <th className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-800">
                      <span>صافي الذمة المتبقية</span>
                      {ledgerSortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center">الإجراءات والمطالبات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pagedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <User size={42} className="mx-auto text-slate-300 mb-2 opacity-60" />
                      <p className="font-extrabold text-sm text-slate-600">لا يوجد عملاء مدينين حالياً</p>
                      <p className="text-xs text-slate-400 mt-1">جميع الحسابات والذمم مسددة بالكامل</p>
                    </td>
                  </tr>
                ) : (
                  (pagedItems as any[]).map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-800 block text-sm">{entry.clientName}</span>
                        {entry.clientPhone && (
                          <span className="text-[11px] text-slate-500 font-mono font-bold flex items-center gap-1 mt-0.5" dir="ltr">
                            <Phone size={11} className="text-slate-400" />
                            {entry.clientPhone}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg border border-blue-200 font-black">
                          {entry.invoices.length} فواتير
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                        {new Date(entry.oldestInvoiceDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {entry.totalBilled.toFixed(2)} {settings.currency}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">
                        {entry.totalPaid.toFixed(2)} {settings.currency}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-black text-amber-800 text-sm bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-300">
                          {entry.totalRemaining.toFixed(2)} {settings.currency}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* زر كشف حساب تفصيلي */}
                          <button
                            type="button"
                            onClick={() => setStatementClient(entry)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="عرض وطباعة كشف حساب ومطالبة العميل"
                          >
                            <FileText size={14} />
                            <span>كشف حساب</span>
                          </button>

                          {/* زر تذكير واتساب */}
                          {entry.clientPhone && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppReminder(entry.clientName, entry.clientPhone, entry.totalRemaining, entry.invoices.length)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                              title="إرسال رسالة مطالبة ودية عبر واتساب"
                            >
                              <MessageCircle size={14} />
                              <span>تذكير واتساب</span>
                            </button>
                          )}

                          {/* زر سداد الفاتورة الأقدم */}
                          {entry.invoices.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenSettleModal(entry.invoices[0])}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                              title="سداد دفعة على الفاتورة الأقدم"
                            >
                              <Wallet size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: أرشيف الديون المعدومة ===================== */}
      {activeTab === 'bad_debts' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-black">
                  <th className="py-3.5 px-4">رقم الفاتورة والتاريخ</th>
                  <th className="py-3.5 px-4">اسم العميل ورقم الموبايل</th>
                  <th className="py-3.5 px-4 text-center">إجمالي الفاتورة</th>
                  <th className="py-3.5 px-4 text-center">المبلغ المشطوب</th>
                  <th className="py-3.5 px-4">سبب الشطب والمسؤول</th>
                  <th className="py-3.5 px-4 text-center">تاريخ الشطب</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pagedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <Ban size={42} className="mx-auto text-slate-300 mb-2 opacity-60" />
                      <p className="font-extrabold text-sm text-slate-600">لا توجد ديون معدومة في الأرشيف</p>
                    </td>
                  </tr>
                ) : (
                  (pagedItems as Invoice[]).map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-slate-800 block">{inv.invoiceNumber || inv.id}</span>
                        <span className="text-[11px] text-slate-400 font-bold block mt-0.5">
                          {new Date(inv.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-800 block text-sm">{inv.clientName || 'عميل نقدي'}</span>
                        {inv.clientPhone && (
                          <span className="text-[11px] text-slate-500 font-mono font-bold block mt-0.5" dir="ltr">
                            {inv.clientPhone}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {Number(inv.total || 0).toFixed(2)} {settings.currency}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-black text-rose-700 text-sm bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                          {Number(inv.remaining || inv.total || 0).toFixed(2)} {settings.currency}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 block">{inv.badDebtReason || 'شطب دين'}</span>
                        {inv.badDebtBy && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">بواسطة: {inv.badDebtBy}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center text-slate-500 font-bold">
                        {inv.badDebtAt 
                          ? new Date(inv.badDebtAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '-'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRestoreBadDebt(inv)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
                          title="استعادة الفاتورة إلى الآجل النشط"
                        >
                          <RotateCcw size={14} className="text-amber-600" />
                          <span>استعادة للآجل</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 text-xs font-bold text-slate-600">
        <div className="flex items-center gap-2">
          <span>عرض</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none font-bold text-slate-700"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>سجل لكل صفحة (إجمالي: {totalItems} سجل)</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(1)}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            title="الصفحة الأولى"
          >
            <ChevronsRight size={16} />
          </button>
          <button
            type="button"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            title="السابق"
          >
            <ChevronRight size={16} />
          </button>

          <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-black text-slate-800">
            صفحة {safeCurrentPage} من {totalPages}
          </span>

          <button
            type="button"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            title="التالي"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            title="الصفحة الأخيرة"
          >
            <ChevronsLeft size={16} />
          </button>
        </div>
      </div>

      {/* ===================== MODAL 1: سداد الفاتورة أو جزء منها ===================== */}
      {settleModalInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">سداد الفاتورة الآجلة</h3>
                  <p className="text-[10px] text-slate-400 font-bold">رقم: {settleModalInvoice.invoiceNumber || settleModalInvoice.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSettleModalInvoice(null)}
                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Invoice Summary Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">العميل:</span>
                  <span className="font-extrabold text-slate-800">{settleModalInvoice.clientName}</span>
                </div>
                {settleModalInvoice.clientPhone && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">الهاتف:</span>
                    <span className="font-mono font-bold text-slate-700" dir="ltr">{settleModalInvoice.clientPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-bold">إجمالي الفاتورة:</span>
                  <span className="font-mono font-bold text-slate-700">{Number(settleModalInvoice.total || 0).toFixed(2)} {settings.currency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">المسدد سابقاً:</span>
                  <span className="font-mono font-bold text-emerald-600">{Number(settleModalInvoice.paid || 0).toFixed(2)} {settings.currency}</span>
                </div>
                <div className="flex justify-between items-center bg-amber-50 p-2 rounded-xl border border-amber-200">
                  <span className="text-amber-900 font-black">المتبقي المطلوب سداده:</span>
                  <span className="font-mono font-black text-amber-900 text-sm">
                    {(Number(settleModalInvoice.remaining) || Math.max(0, Number(settleModalInvoice.total) - Number(settleModalInvoice.paid || 0))).toFixed(2)} {settings.currency}
                  </span>
                </div>
              </div>

              {/* Amount to Pay */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المراد سداده الآن *</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    step="any"
                    value={settleAmount}
                    onChange={e => setSettleAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-black font-mono text-slate-800 outline-none focus:border-emerald-500"
                    placeholder="أدخل المبلغ..."
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {settings.currency}
                  </span>
                </div>
                {/* Shortcut button: Pay full remaining */}
                <button
                  type="button"
                  onClick={() => setSettleAmount(Number(settleModalInvoice.remaining) || Math.max(0, Number(settleModalInvoice.total) - Number(settleModalInvoice.paid || 0)))}
                  className="mt-1 text-[11px] font-black text-emerald-600 hover:underline cursor-pointer"
                >
                  ⚡ سداد كامل المتبقي ({((Number(settleModalInvoice.remaining) || Math.max(0, Number(settleModalInvoice.total) - Number(settleModalInvoice.paid || 0)))).toFixed(2)} {settings.currency})
                </button>
              </div>

              {/* Treasury / Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">خزينة الإيداع وطريقة الدفع *</label>
                <div className="grid grid-cols-2 gap-2">
                  {settings.treasuries.filter(t => !t.isMain).map(t => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition-all ${
                        settleTreasury === t.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="settle_treasury"
                        value={t.id}
                        checked={settleTreasury === t.id}
                        onChange={() => setSettleTreasury(t.id)}
                        className="w-3.5 h-3.5 text-emerald-600"
                      />
                      <span>{t.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات السداد (اختياري)</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={e => setSettleNotes(e.target.value)}
                  placeholder="مثال: تحويل إنستاباي، سداد نقدي بالصالون..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSettleModalInvoice(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmittingSettle}
                onClick={handleConfirmSettle}
                className="flex-[1.5] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>{isSubmittingSettle ? 'جاري تسجيل السداد...' : 'تأكيد السداد والإيداع'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: تحويل الفاتورة لدين معدوم ===================== */}
      {badDebtModalInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-rose-100 flex justify-between items-center bg-rose-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Ban size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-rose-900">تحويل الفاتورة إلى ديون معدومة</h3>
                  <p className="text-[10px] text-slate-500 font-bold">شطب الذمة من حسابات التحصيل النشطة</p>
                </div>
              </div>
              <button
                onClick={() => setBadDebtModalInvoice(null)}
                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs font-bold space-y-1">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-mono">{badDebtModalInvoice.invoiceNumber || badDebtModalInvoice.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span>{badDebtModalInvoice.clientName}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-black">
                  <span>المبلغ المشطوب:</span>
                  <span className="font-mono">
                    {(Number(badDebtModalInvoice.remaining) || Math.max(0, Number(badDebtModalInvoice.total) - Number(badDebtModalInvoice.paid || 0))).toFixed(2)} {settings.currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب شطب الدين واعتباره معدوماً *</label>
                <select
                  value={badDebtReason}
                  onChange={e => setBadDebtReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-rose-500 mb-2"
                >
                  <option value="تعذر الوصول للعميل وإغلاق الهاتف">تعذر الوصول للعميل وإغلاق الهاتف</option>
                  <option value="مغادرة العميل النهائية أو السفر">مغادرة العميل النهائية أو السفر</option>
                  <option value="وفاة العميل أو إفلاسه">وفاة العميل أو إفلاسه</option>
                  <option value="نزاع تجاري وإلغاء المطالبة ودياً">نزاع تجاري وإلغاء المطالبة ودياً</option>
                  <option value="مبلغ ضئيل لا يستحق تكلفة المتابعة">مبلغ ضئيل لا يستحق تكلفة المتابعة</option>
                  <option value="أخرى">أخرى (كتابة يدوية)</option>
                </select>

                {badDebtReason === 'أخرى' && (
                  <input
                    type="text"
                    placeholder="اكتب السبب بالتفصيل..."
                    onChange={e => setBadDebtReason(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-rose-500"
                  />
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] font-bold flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                <span>سيتم أرشفة هذه الفاتورة كدين معدوم وتوثيق اسم المسؤول وتاريخ الشطب. يمكنك استعادتها في أي وقت من تبويب الديون المعدومة.</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBadDebtModalInvoice(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmittingBadDebt}
                onClick={handleConfirmBadDebt}
                className="flex-[1.5] bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs transition-all shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Ban size={16} />
                <span>{isSubmittingBadDebt ? 'جاري الشطب...' : 'تأكيد الشطب كدين معدوم'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: كشف حساب ومطالبة العميل للطباعة ===================== */}
      {statementClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 print:hidden">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">كشف حساب ومطالبة الذمة المالية</h3>
                  <p className="text-[10px] text-slate-400 font-bold">{statementClient.clientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={15} />
                  <span>طباعة الكشف 🖨️</span>
                </button>
                <button
                  onClick={() => setStatementClient(null)}
                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Statement Area */}
            <div id="client-statement-printable" className="p-6 md:p-8 overflow-y-auto space-y-6 text-slate-800">
              {/* Statement Header */}
              <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black text-slate-900">{settings.salonName || 'صالون الحلاقة والتجميل'}</h1>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">{settings.address || 'كشف حساب رسمي بالذمم والمطالبات الآجلة'}</p>
                  {settings.phone && (
                    <p className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">هاتف الصالون: {settings.phone}</p>
                  )}
                </div>
                <div className="text-left font-mono">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded-lg mb-1">
                    كشف حساب ذمة عميل
                  </span>
                  <p className="text-xs text-slate-500 font-bold">التاريخ: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>

              {/* Client Info Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block">اسم العميل:</span>
                  <span className="text-base font-black text-slate-900 block">{statementClient.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">رقم الهاتف:</span>
                  <span className="text-base font-black text-slate-900 font-mono block" dir="ltr">{statementClient.clientPhone || 'غير مسجل'}</span>
                </div>
              </div>

              {/* Table of Client's Invoices */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black">
                    <tr>
                      <th className="py-2.5 px-3">رقم الفاتورة</th>
                      <th className="py-2.5 px-3">التاريخ</th>
                      <th className="py-2.5 px-3 text-center">الإجمالي</th>
                      <th className="py-2.5 px-3 text-center">المدفوع</th>
                      <th className="py-2.5 px-3 text-center">المتبقي المطلوب</th>
                      <th className="py-2.5 px-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {statementClient.invoices.map((inv, idx) => {
                      const invRem = Number(inv.remaining) || Math.max(0, Number(inv.total) - Number(inv.paid || 0));
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{inv.invoiceNumber || inv.id}</td>
                          <td className="py-2 px-3 text-slate-600">{new Date(inv.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold">{Number(inv.total || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-emerald-600">{Number(inv.paid || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-amber-800">{invRem.toFixed(2)}</td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">{inv.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-4 flex justify-between items-center text-sm">
                <div>
                  <span className="font-extrabold text-amber-950 block">صافي الرصيد المستحق على العميل:</span>
                  <span className="text-xs text-amber-800">إجمالي عدد الفواتير: {statementClient.invoices.length} فاتورة</span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-2xl font-black text-amber-900 block">
                    {statementClient.totalRemaining.toFixed(2)} {settings.currency}
                  </span>
                </div>
              </div>

              {/* Payment Instructions Notice */}
              <div className="text-xs text-slate-500 border-t border-slate-200 pt-4 space-y-1">
                <p className="font-bold text-slate-700">طرق السداد المتاحة:</p>
                <p>• نقداً أو عبر بطاقة الفيزا / مدى بالصالون.</p>
                <p>• التحويل المباشر عبر إنستاباي / فودافون كاش / الحساب البنكي المعتمد للصالون.</p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs font-bold text-slate-600 text-center">
                <div>
                  <p>توقيع وختم الإدارة / المحاسب</p>
                  <div className="h-12"></div>
                  <p>.......................................</p>
                </div>
                <div>
                  <p>توقيع واعتراف العميل بالرصيد</p>
                  <div className="h-12"></div>
                  <p>.......................................</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 4: سجل الدفعات التاريخية للفاتورة ===================== */}
      {historyModalInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">سجل دفعات الفاتورة</h3>
                <p className="text-[10px] text-slate-400 font-bold">{historyModalInvoice.invoiceNumber || historyModalInvoice.id} - {historyModalInvoice.clientName}</p>
              </div>
              <button
                onClick={() => setHistoryModalInvoice(null)}
                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto max-h-[60vh]">
              {(!historyModalInvoice.paymentsHistory || historyModalInvoice.paymentsHistory.length === 0) ? (
                <p className="text-center text-xs text-slate-400 py-6 font-bold">لا توجد دفعات مسجلة لهذه الفاتورة بعد.</p>
              ) : (
                historyModalInvoice.paymentsHistory.map((pmt, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700">دفعة #{idx + 1}</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">+{pmt.amount.toFixed(2)} {settings.currency}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>طريقة الدفع: {pmt.paymentMethod}</span>
                      <span className="font-mono">{new Date(pmt.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {pmt.notes && (
                      <p className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-100 mt-1">{pmt.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalInvoice(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
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
