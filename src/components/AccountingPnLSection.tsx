import React, { useState, useMemo } from 'react';
import { 
  AppSettings, Partner, PartnerTransaction, Transaction, 
  Invoice, Employee, Branch, SalesReturn, ProfitDistribution 
} from '../types';
import { 
  Scale, TrendingUp, TrendingDown, DollarSign, Calendar, 
  PieChart as PieIcon, CheckCircle2, Printer, AlertTriangle, 
  FileText, Building2, Sparkles, ArrowUpRight, ArrowDownRight, 
  Percent, Coins, Wallet, Check, X, Users, RefreshCw, ChevronRight,
  ArrowRight
} from 'lucide-react';
import { DB } from '../services/db';
import { handlePrintReceipt } from '../utils/print';

interface AccountingPnLSectionProps {
  settings: AppSettings;
  partners: Partner[];
  setPartners: (updater: Partner[] | ((prev: Partner[]) => Partner[])) => void;
  partnerTransactions: PartnerTransaction[];
  setPartnerTransactions: (updater: PartnerTransaction[] | ((prev: PartnerTransaction[]) => PartnerTransaction[])) => void;
  invoices?: Invoice[];
  transactions?: Transaction[];
  employees?: Employee[];
  purchases?: any[];
  supplierPayments?: any[];
  salesReturns?: SalesReturn[];
  branches?: Branch[];
  activeBranchId?: string;
  currentUser?: any;
}

export function AccountingPnLSection({
  settings,
  partners = [],
  setPartners,
  partnerTransactions = [],
  setPartnerTransactions,
  invoices = [],
  transactions = [],
  employees = [],
  purchases = [],
  supplierPayments = [],
  salesReturns = [],
  branches = [],
  activeBranchId,
  currentUser
}: AccountingPnLSectionProps) {
  // ---- Period State ----
  const now = new Date();
  const defaultFirstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState<string>(defaultFirstDay);
  const [toDate, setToDate] = useState<string>(defaultLastDay);
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchId || 'all');

  // Quick Period Presets
  const setQuickPeriod = (preset: 'this_month' | 'last_month' | 'this_quarter' | 'this_year') => {
    const d = new Date();
    if (preset === 'this_month') {
      const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(last);
    } else if (preset === 'last_month') {
      const first = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0];
      const last = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(last);
    } else if (preset === 'this_quarter') {
      const currentQuarter = Math.floor(d.getMonth() / 3);
      const first = new Date(d.getFullYear(), currentQuarter * 3, 1).toISOString().split('T')[0];
      const last = new Date(d.getFullYear(), (currentQuarter + 1) * 3, 0).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(last);
    } else if (preset === 'this_year') {
      const first = new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
      const last = new Date(d.getFullYear(), 11, 31).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(last);
    }
  };

  // ---- Capital Increase / Reinvestment State ----
  // Type: 'percentage' | 'fixed_amount'
  const [reinvestmentType, setReinvestmentType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [reinvestmentPercentage, setReinvestmentPercentage] = useState<number>(20); // Default 20% to capital
  const [reinvestmentFixedAmount, setReinvestmentFixedAmount] = useState<number | ''>('');

  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // ---- Helper Branch Filter ----
  const filterByBranch = (itemBranchId?: string | null) => {
    if (selectedBranch === 'all' || !selectedBranch) return true;
    return String(itemBranchId || '') === String(selectedBranch);
  };

  // ---- P&L Calculations ----
  const pnlData = useMemo(() => {
    // 1. Invoices
    const periodInvoices = (invoices || []).filter(inv => {
      const d = (inv.date || '').split('T')[0];
      return d >= fromDate && d <= toDate && inv.status !== 'cancelled' && filterByBranch(inv.branchId);
    });

    const totalInvoicedSales = periodInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const totalCashbackUsed = periodInvoices.reduce((sum, inv) => sum + (Number(inv.cashbackUsed) || 0), 0);

    let servicesRevenue = 0;
    let productsRevenue = 0;
    periodInvoices.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const itemTotal = Number(item.total || (item.price * (item.quantity || 1)) || 0);
        if (item.type === 'product' || item.productId) {
          productsRevenue += itemTotal;
        } else {
          servicesRevenue += itemTotal;
        }
      });
    });

    if (servicesRevenue === 0 && productsRevenue === 0 && totalInvoicedSales > 0) {
      servicesRevenue = totalInvoicedSales;
    }

    // 1.1 Sales Returns
    const periodReturns = (salesReturns || []).filter(r => {
      const d = (r.date || (r as any).returnDate || '').split('T')[0];
      return d >= fromDate && d <= toDate && filterByBranch(r.branchId);
    });
    const totalReturnsAmount = periodReturns.reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
    const netOperatingRevenue = Math.max(0, totalInvoicedSales - totalReturnsAmount);

    // 2. Cost of Goods Sold (COGS / المشتريات ومستلزمات التشغيل)
    const periodPurchases = (purchases || []).filter(p => {
      const d = (p.invoiceDate || p.date || '').split('T')[0];
      return d >= fromDate && d <= toDate && filterByBranch(p.branchId);
    });
    const totalPurchasesPaid = periodPurchases.reduce((sum, p) => sum + (Number(p.paid ?? p.paidAmount ?? p.paid_amount) || 0), 0);

    const periodSupplierPayments = (supplierPayments || []).filter(sp => {
      const d = (sp.paymentDate || sp.date || '').split('T')[0];
      return d >= fromDate && d <= toDate && filterByBranch(sp.branchId);
    });
    const totalSupplierPayments = periodSupplierPayments.reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
    const totalCOGS = totalPurchasesPaid + totalSupplierPayments;

    // Gross Profit
    const grossProfit = netOperatingRevenue - totalCOGS;
    const grossMargin = netOperatingRevenue > 0 ? (grossProfit / netOperatingRevenue) * 100 : 0;

    // 3. Operating Expenses (OPEX / المصروفات التشغيلية والرواتب)
    const periodTransactions = (transactions || []).filter(t => {
      const d = (t.date || '').split('T')[0];
      return d >= fromDate && d <= toDate && filterByBranch(t.branchId);
    });

    // Salaries & Advances from employee financial records or transactions
    let totalSalaries = 0;
    let totalAdvances = 0;
    const periodEmployees = (employees || []).filter(emp => filterByBranch(emp.branchId));
    periodEmployees.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        const d = (rec.date || '').split('T')[0];
        if (d >= fromDate && d <= toDate) {
          if (rec.type === 'salary') totalSalaries += Number(rec.amount) || 0;
          else if (rec.type === 'advance') totalAdvances += Number(rec.amount) || 0;
        }
      });
    });

    if (totalSalaries === 0) {
      totalSalaries = periodTransactions
        .filter(t => (t.category || '').includes('راتب') || (t.description || '').includes('راتب'))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }
    if (totalAdvances === 0) {
      totalAdvances = periodTransactions
        .filter(t => (t.category || '').includes('سلفة') || (t.description || '').includes('سلفة'))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }

    // Staff Commissions
    let totalCommissions = 0;
    periodInvoices.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        totalCommissions += Number(item.employeeCommission || item.commissionAmount || 0) + Number(item.referralCommissionAmount || 0);
      });
    });

    // Categorized General Expenses
    let rentAndUtilities = 0;
    let maintenanceAndSupplies = 0;
    let marketingAndAds = 0;
    let hospitalityAndMisc = 0;
    let otherGeneralExpenses = 0;

    periodTransactions
      .filter(t => t.type === 'out' || (t.type as string) === 'expense' || t.category === 'expense')
      .forEach(t => {
        const cat = String(t.category || '').toLowerCase();
        const desc = String(t.description || '').toLowerCase();
        const amt = Number(t.amount) || 0;

        // استبعاد تصفير الخزائن، إغلاق الورديات، والتحويلات الداخلية، والمسحوبات
        if (
          cat === 'transfer' || 
          desc.includes('تصفير') || 
          desc.includes('نقل الرصيد') || 
          desc.includes('تحويل') || 
          cat.includes('مسحوبات') || 
          cat === 'partner_drawing' || 
          cat === 'partner_distribution'
        ) {
          return;
        }

        if (cat.includes('راتب') || desc.includes('راتب') || cat.includes('سلفة') || desc.includes('سلفة')) {
          // Already counted in salaries / advances
          return;
        }

        if (cat.includes('إيجار') || cat.includes('ايجار') || cat.includes('كهرباء') || cat.includes('مياه') || cat.includes('انترنت') || desc.includes('إيجار') || desc.includes('ايجار') || desc.includes('كهرباء')) {
          rentAndUtilities += amt;
        } else if (cat.includes('صيانة') || cat.includes('نظافة') || desc.includes('صيانة') || desc.includes('تصليح')) {
          maintenanceAndSupplies += amt;
        } else if (cat.includes('تسويق') || cat.includes('إعلان') || cat.includes('دعاية') || desc.includes('تسويق') || desc.includes('إعلان')) {
          marketingAndAds += amt;
        } else if (cat.includes('ضيافة') || cat.includes('بوفيه') || cat.includes('شاي') || desc.includes('ضيافة')) {
          hospitalityAndMisc += amt;
        } else {
          otherGeneralExpenses += amt;
        }
      });

    const totalGeneralExpenses = rentAndUtilities + maintenanceAndSupplies + marketingAndAds + hospitalityAndMisc + otherGeneralExpenses;
    const totalOperatingExpenses = totalSalaries + totalCommissions + totalAdvances + totalGeneralExpenses;

    // 4. Net Profit / Loss
    const netProfit = grossProfit - totalOperatingExpenses;
    const netProfitMargin = netOperatingRevenue > 0 ? (netProfit / netOperatingRevenue) * 100 : 0;

    return {
      periodInvoicesCount: periodInvoices.length,
      totalInvoicedSales,
      servicesRevenue,
      productsRevenue,
      totalReturnsAmount,
      returnsCount: periodReturns.length,
      totalCashbackUsed,
      netOperatingRevenue,
      totalPurchasesPaid,
      totalSupplierPayments,
      totalCOGS,
      grossProfit,
      grossMargin,
      totalSalaries,
      totalCommissions,
      totalAdvances,
      rentAndUtilities,
      maintenanceAndSupplies,
      marketingAndAds,
      hospitalityAndMisc,
      otherGeneralExpenses,
      totalGeneralExpenses,
      totalOperatingExpenses,
      netProfit,
      netProfitMargin
    };
  }, [invoices, transactions, employees, purchases, supplierPayments, salesReturns, fromDate, toDate, selectedBranch]);

  // ---- Capital Increase & Partner Allocation Calculations ----
  const activePartners = useMemo(() => {
    return (partners || []).filter(p => p.status === 'active' || p.isActive !== false);
  }, [partners]);

  const totalCurrentCapital = useMemo(() => {
    return activePartners.reduce((s, p) => s + (Number(p.capitalShare) || 0), 0);
  }, [activePartners]);

  // Allocation calculations
  const allocationData = useMemo(() => {
    const netProfit = pnlData.netProfit;
    if (netProfit <= 0) {
      return {
        capitalAdditionPool: 0,
        distributableCashPool: 0,
        effectiveReinvestmentPercent: 0,
        newTotalCapital: totalCurrentCapital,
        partnerAllocations: []
      };
    }

    let capitalAdditionPool = 0;
    if (reinvestmentType === 'percentage') {
      const pct = Math.max(0, Math.min(100, reinvestmentPercentage || 0));
      capitalAdditionPool = (netProfit * pct) / 100;
    } else {
      const amt = Number(reinvestmentFixedAmount) || 0;
      capitalAdditionPool = Math.max(0, Math.min(netProfit, amt));
    }

    const distributableCashPool = Math.max(0, netProfit - capitalAdditionPool);
    const effectiveReinvestmentPercent = netProfit > 0 ? (capitalAdditionPool / netProfit) * 100 : 0;
    const newTotalCapital = totalCurrentCapital + capitalAdditionPool;

    // Allocate per partner
    const partnerAllocations = activePartners.map(p => {
      const sharePct = Number(p.sharePercentage) || 0;
      const currentCapital = Number(p.capitalShare) || 0;
      
      // Total profit share of this partner
      const partnerTotalProfit = (netProfit * sharePct) / 100;
      
      // Capital addition share
      const partnerCapitalAddition = (capitalAdditionPool * sharePct) / 100;
      
      // New capital share
      const partnerNewCapital = currentCapital + partnerCapitalAddition;
      
      // Cash profit share
      const partnerCashProfit = (distributableCashPool * sharePct) / 100;
      
      // Deductions (drawings / prior debt)
      const drawings = Number(p.debitBalance || p.totalWithdrawn || 0);
      const netPayableCash = Math.max(0, partnerCashProfit - drawings);
      const carriedDebt = Math.max(0, drawings - partnerCashProfit);

      return {
        partnerId: p.id,
        partnerName: p.name,
        phone: p.phone,
        sharePercentage: sharePct,
        currentCapital,
        partnerTotalProfit,
        partnerCapitalAddition,
        partnerNewCapital,
        partnerCashProfit,
        drawings,
        netPayableCash,
        carriedDebt
      };
    });

    return {
      capitalAdditionPool,
      distributableCashPool,
      effectiveReinvestmentPercent,
      newTotalCapital,
      partnerAllocations
    };
  }, [pnlData.netProfit, activePartners, totalCurrentCapital, reinvestmentType, reinvestmentPercentage, reinvestmentFixedAmount]);

  // ---- Execute & Post Settlement to DB ----
  const handleExecutePosting = async () => {
    if (allocationData.partnerAllocations.length === 0 || pnlData.netProfit <= 0) return;
    setIsSubmitting(true);
    setSuccessNotice(null);

    try {
      const periodLabel = `قائمة أرباح وتسوية رأس المال (${fromDate} إلى ${toDate})`;
      const sId = settings.salonId;
      const today = new Date().toISOString().split('T')[0];

      const updatedPartnersList = [...partners];
      const newTransactions: PartnerTransaction[] = [];

      for (const alloc of allocationData.partnerAllocations) {
        // 1. Update partner in list
        const pIndex = updatedPartnersList.findIndex(p => p.id === alloc.partnerId);
        if (pIndex !== -1) {
          const original = updatedPartnersList[pIndex];
          const updatedPartner: Partner = {
            ...original,
            capitalShare: Math.round(alloc.partnerNewCapital),
            debitBalance: Math.round(alloc.carriedDebt),
            totalProfitReceived: (Number(original.totalProfitReceived) || 0) + Math.round(alloc.partnerTotalProfit)
          };
          updatedPartnersList[pIndex] = updatedPartner;
          await DB.savePartner(updatedPartner);
        }

        // 2. Record Capital Addition Transaction (Deposit / Capital Increase)
        if (alloc.partnerCapitalAddition > 0) {
          const capTx: PartnerTransaction = {
            id: `PTX-CAP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            salonId: sId,
            partnerId: alloc.partnerId,
            partnerName: alloc.partnerName,
            type: 'deposit',
            amount: Math.round(alloc.partnerCapitalAddition),
            date: today,
            treasuryId: settings.treasuries[0]?.id || 'main',
            treasuryName: settings.treasuries[0]?.name || 'الخزينة الرئيسية',
            description: `تعلية رأس المال من أرباح الفترة (${fromDate} إلى ${toDate}) - حصة ${alloc.sharePercentage}%`,
            createdBy: currentUser?.name || 'النظام المحاسبي'
          };
          newTransactions.push(capTx);
          await DB.savePartnerTransaction(capTx);
        }

        // 3. Record Cash Profit Share Transaction
        if (alloc.netPayableCash > 0) {
          const profitTx: PartnerTransaction = {
            id: `PTX-PRF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            salonId: sId,
            partnerId: alloc.partnerId,
            partnerName: alloc.partnerName,
            type: 'profit_share',
            amount: Math.round(alloc.netPayableCash),
            date: today,
            treasuryId: settings.treasuries[0]?.id || 'main',
            treasuryName: settings.treasuries[0]?.name || 'الخزينة الرئيسية',
            description: `صرف أرباح نقدية معتمدة عن فترة (${fromDate} إلى ${toDate})`,
            createdBy: currentUser?.name || 'النظام المحاسبي'
          };
          newTransactions.push(profitTx);
          await DB.savePartnerTransaction(profitTx);
        }

        // 4. Save ProfitDistribution Record
        const distRecord: ProfitDistribution = {
          id: `PDIST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          salonId: sId,
          partnerId: alloc.partnerId,
          partnerName: alloc.partnerName,
          periodStart: fromDate,
          periodEnd: toDate,
          periodLabel: periodLabel,
          distributableProfitPool: pnlData.netProfit,
          partnerSharePercentage: alloc.sharePercentage,
          grossProfitShare: Math.round(alloc.partnerTotalProfit),
          capitalAdditionAmount: Math.round(alloc.partnerCapitalAddition),
          newCapitalShare: Math.round(alloc.partnerNewCapital),
          drawingsDeducted: Math.round(alloc.drawings),
          priorDebitDeducted: 0,
          netPayableAmount: Math.round(alloc.netPayableCash),
          carriedDebitBalance: Math.round(alloc.carriedDebt),
          status: 'approved',
          distributionDate: today,
          approvedBy: currentUser?.name || 'المدير العام',
          notes: `تم اعتماد تعلية رأس مال بقيمة ${Math.round(alloc.partnerCapitalAddition)} ${settings.currency} وصرف نقدي ${Math.round(alloc.netPayableCash)} ${settings.currency}`
        };
        await DB.saveProfitDistribution(distRecord);
      }

      setPartners(updatedPartnersList);
      setPartnerTransactions(prev => [...newTransactions, ...prev]);

      setSuccessNotice(`تم اعتماد تسوية وتعلية رأس المال بنجاح! تم رفع رأس مال الصالون بمقدار ${Math.round(allocationData.capitalAdditionPool).toLocaleString()} ${settings.currency} وتسجيل قيود التوزيع الرسمية.`);
      setShowConfirmModal(false);
    } catch (err: any) {
      alert(`حدث خطأ أثناء اعتماد العملية: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const printDocumentId = `accounting-pnl-print-${fromDate}-${toDate}`;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header & Quick Filter Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shadow-xs">
                <Scale size={24} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">قائمة الأرباح والخسائر وتعلية رأس المال</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  نظام محاسبي تقليدي ومبسط يجمع أعمال الصالون ويوضح نصيب كل شريك وإمكانية تعلية وتضخيم رأس المال
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer size={15} />
              <span>طباعة القائمة ومحضر التعلية (A4)</span>
            </button>
            {pnlData.netProfit > 0 && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer ring-2 ring-indigo-400/30"
              >
                <CheckCircle2 size={15} />
                <span>اعتماد التسوية وتعلية رأس المال</span>
              </button>
            )}
          </div>
        </div>

        {/* Success Notice if triggered */}
        {successNotice && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-between gap-3 text-emerald-200 text-xs font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button onClick={() => setSuccessNotice(null)} className="text-emerald-400 hover:text-white p-1">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Period Selector Controls */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Quick Presets */}
          <div className="md:col-span-4 flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[11px] font-bold text-slate-400 ml-2">فترات سريعة:</span>
            <button
              onClick={() => setQuickPeriod('this_month')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setQuickPeriod('last_month')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              الشهر الماضي
            </button>
            <button
              onClick={() => setQuickPeriod('this_quarter')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              الربع الحالي
            </button>
            <button
              onClick={() => setQuickPeriod('this_year')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              السنة المالية الحالية
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Calendar size={12} className="text-indigo-400" />
              <span>من تاريخ:</span>
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Calendar size={12} className="text-indigo-400" />
              <span>إلى تاريخ:</span>
            </label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
            />
          </div>

          {branches.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                <Building2 size={12} className="text-indigo-400" />
                <span>نطاق الفرع:</span>
              </label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:border-indigo-500 outline-none"
              >
                <option value="all">جميع الفروع الموحدة</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <div className="text-[11px] text-slate-400 font-mono py-2">
              عدد فواتير الفترة: <span className="font-bold text-indigo-300">{pnlData.periodInvoicesCount}</span> فاتورة
            </div>
          </div>
        </div>
      </div>

      {/* 2. Simplified Traditional P&L Cards (قائمة الدخل المبسطة) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Operating Revenues */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span className="flex items-center gap-1.5">
                <ArrowDownRight size={14} className="text-blue-600" />
                <span>1. صافي الإيرادات والمبيعات</span>
              </span>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full">الدخل</span>
            </div>
            <div className="font-mono font-black text-2xl text-slate-900">
              {pnlData.netOperatingRevenue.toLocaleString()} <span className="text-xs text-slate-500 font-sans">{settings.currency}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>مبيعات الخدمات:</span>
              <span className="font-mono font-bold text-slate-800">{pnlData.servicesRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>مبيعات المنتجات:</span>
              <span className="font-mono font-bold text-slate-800">{pnlData.productsRevenue.toLocaleString()}</span>
            </div>
            {pnlData.totalReturnsAmount > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>مرتجع مبيعات:</span>
                <span className="font-mono">-{pnlData.totalReturnsAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Cost of Goods Sold (COGS) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span className="flex items-center gap-1.5">
                <ArrowUpRight size={14} className="text-amber-600" />
                <span>2. تكلفة النشاط والمخزون</span>
              </span>
              <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">COGS</span>
            </div>
            <div className="font-mono font-black text-2xl text-slate-900">
              {pnlData.totalCOGS.toLocaleString()} <span className="text-xs text-slate-500 font-sans">{settings.currency}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>المسدد في المشتريات:</span>
              <span className="font-mono font-bold text-slate-800">{pnlData.totalPurchasesPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>دفعات الموردين:</span>
              <span className="font-mono font-bold text-slate-800">{pnlData.totalSupplierPayments.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-dashed border-slate-100">
              <span>مجمل الربح:</span>
              <span className="font-mono">{pnlData.grossProfit.toLocaleString()} ({pnlData.grossMargin.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Operating Expenses (OPEX) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span className="flex items-center gap-1.5">
                <ArrowUpRight size={14} className="text-rose-600" />
                <span>3. المصروفات التشغيلية والرواتب</span>
              </span>
              <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full">OPEX</span>
            </div>
            <div className="font-mono font-black text-2xl text-slate-900">
              {pnlData.totalOperatingExpenses.toLocaleString()} <span className="text-xs text-slate-500 font-sans">{settings.currency}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>الرواتب والعمولات:</span>
              <span className="font-mono font-bold text-slate-800">{(pnlData.totalSalaries + pnlData.totalCommissions).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>الإيجار والفواتير:</span>
              <span className="font-mono font-bold text-slate-800">{pnlData.rentAndUtilities.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>نثريات ومصروفات عامة:</span>
              <span className="font-mono font-bold text-slate-800">{(pnlData.maintenanceAndSupplies + pnlData.hospitalityAndMisc + pnlData.otherGeneralExpenses).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Net Accounting Profit / Loss */}
        <div className={`rounded-3xl p-5 border shadow-xs flex flex-col justify-between ${
          pnlData.netProfit >= 0 
            ? 'bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-emerald-300' 
            : 'bg-gradient-to-br from-rose-50 via-red-50/50 to-white border-rose-300'
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className={`flex items-center gap-1.5 ${pnlData.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                {pnlData.netProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>4. صافي الربح المحاسبي (=)</span>
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                pnlData.netProfit >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                {pnlData.netProfit >= 0 ? 'فائض أرباح' : 'عجز تشغيلي'}
              </span>
            </div>
            <div className={`font-mono font-black text-2xl ${pnlData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {pnlData.netProfit.toLocaleString()} <span className="text-xs text-slate-500 font-sans">{settings.currency}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 text-[11px] space-y-1">
            <div className="flex justify-between text-slate-700">
              <span>هامش صافي الربح:</span>
              <span className="font-mono font-black">{pnlData.netProfitMargin.toFixed(1)}%</span>
            </div>
            <div className="text-[10px] text-slate-500">
              {pnlData.netProfit >= 0 
                ? 'متاح للتوزيع على الشركاء أو تعلية وتضخيم رأس المال' 
                : 'يُنصح بمراجعة بنود المصروفات وتكلفة البضاعة'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Capital Reinvestment / Increase Engine (تعلية رأس المال من الأرباح) */}
      {pnlData.netProfit > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-emerald-50 p-6 rounded-3xl border border-indigo-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  إعادة استثمار جزء من الأرباح لزيادة وتعلية رأس المال (Capital Growth)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  حدد النسبة أو المبلغ المراد اقتطاعه من الأرباح وإضافته رسمياً لرأس مال الشركاء لتضخيم حقوق الملكية وتوسيع أعمال الصالون
                </p>
              </div>
            </div>

            {/* Selector Method */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-indigo-200 shadow-2xs self-start sm:self-center">
              <button
                type="button"
                onClick={() => setReinvestmentType('percentage')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  reinvestmentType === 'percentage' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                نسبة مئوية (%)
              </button>
              <button
                type="button"
                onClick={() => setReinvestmentType('fixed_amount')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  reinvestmentType === 'fixed_amount' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                مبلغ مالي مقطوع
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Input Controls */}
            <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                {reinvestmentType === 'percentage' 
                  ? 'نسبة الأرباح المحتجزة لتعلية رأس المال %' 
                  : `المبلغ المقتطع لزيادة رأس المال (${settings.currency})`}
              </label>

              {reinvestmentType === 'percentage' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={reinvestmentPercentage}
                      onChange={e => setReinvestmentPercentage(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black font-mono text-indigo-700 focus:border-indigo-600 outline-none"
                    />
                    <span className="font-bold text-slate-500 text-xs">%</span>
                  </div>
                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[0, 10, 20, 25, 30, 50].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setReinvestmentPercentage(pct)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                          reinvestmentPercentage === pct 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="number"
                    min="0"
                    max={pnlData.netProfit}
                    value={reinvestmentFixedAmount}
                    onChange={e => setReinvestmentFixedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="مثال: 25000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black font-mono text-indigo-700 focus:border-indigo-600 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">الحد الأقصى المسموح: {pnlData.netProfit.toLocaleString()} {settings.currency}</p>
                </div>
              )}
            </div>

            {/* Allocation Result 1: Added to Capital */}
            <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-indigo-900">المبلغ المخصص لتعلية رأس المال:</span>
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                  +{allocationData.effectiveReinvestmentPercent.toFixed(1)}%
                </span>
              </div>
              <div className="font-mono font-black text-2xl text-indigo-700 mt-2">
                +{Math.round(allocationData.capitalAdditionPool).toLocaleString()} <span className="text-xs font-sans text-slate-500">{settings.currency}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                رأس مال الصالون الجديد: <strong className="font-mono text-slate-900">{Math.round(allocationData.newTotalCapital).toLocaleString()}</strong> {settings.currency}
              </p>
            </div>

            {/* Allocation Result 2: Cash Distributable */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-emerald-900">صافي الأرباح المتبقية للتوزيع النقدي:</span>
                <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  {(100 - allocationData.effectiveReinvestmentPercent).toFixed(1)}%
                </span>
              </div>
              <div className="font-mono font-black text-2xl text-emerald-700 mt-2">
                {Math.round(allocationData.distributableCashPool).toLocaleString()} <span className="text-xs font-sans text-slate-500">{settings.currency}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                جاهزة للصرف والتحويل النقدي للشركاء بعد خصم المسحوبات
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Partners Distribution Table (جدول حصص الشركاء وتعلية رأس المال) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-indigo-600" />
              <span>جدول استحقاقات الشركاء وتعلية رأس المال ({activePartners.length} شريك)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              يوضح رأس المال الحالي، نصيب كل شريك من زيادة رأس المال، ورأس المال الجديد، والمستحق للصرف نقداً
            </p>
          </div>

          <div className="text-xs font-bold text-slate-600 font-mono">
            إجمالي رأس المال الحالي: <span className="text-indigo-700">{totalCurrentCapital.toLocaleString()} {settings.currency}</span>
          </div>
        </div>

        {activePartners.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users size={48} className="mx-auto mb-2 text-slate-200 stroke-1" />
            <p className="font-bold text-xs">لا يوجد شركاء نشطون مسجلون في النظام حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80 font-black">
                <tr>
                  <th className="p-3.5">الشريك</th>
                  <th className="p-3.5 text-center">النسبة</th>
                  <th className="p-3.5">رأس المال السابق</th>
                  <th className="p-3.5">إجمالي نصيب الأرباح</th>
                  <th className="p-3.5 text-indigo-700 bg-indigo-50/50">المضاف لرأس المال (تعلية)</th>
                  <th className="p-3.5 text-indigo-900 bg-indigo-50/80">رأس المال الجديد</th>
                  <th className="p-3.5 text-emerald-800 bg-emerald-50/40">النصيب النقدي</th>
                  <th className="p-3.5 text-rose-700">مسحوبات مخصومة</th>
                  <th className="p-3.5 text-emerald-700 font-black">صافي المستحق نقداً</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocationData.partnerAllocations.map(alloc => (
                  <tr key={alloc.partnerId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">
                      <div>{alloc.partnerName}</div>
                      {alloc.phone && <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{alloc.phone}</div>}
                    </td>
                    <td className="p-3.5 text-center font-mono font-black text-amber-700">
                      {alloc.sharePercentage}%
                    </td>
                    <td className="p-3.5 font-mono text-slate-700 font-bold">
                      {Math.round(alloc.currentCapital).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-slate-900 font-extrabold">
                      {Math.round(alloc.partnerTotalProfit).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-indigo-700 font-black bg-indigo-50/30">
                      +{Math.round(alloc.partnerCapitalAddition).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-indigo-900 font-black bg-indigo-50/60">
                      {Math.round(alloc.partnerNewCapital).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-emerald-800 font-bold bg-emerald-50/20">
                      {Math.round(alloc.partnerCashProfit).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-rose-600 font-bold">
                      {alloc.drawings > 0 ? `-${Math.round(alloc.drawings).toLocaleString()}` : '0'}
                    </td>
                    <td className="p-3.5 font-mono text-emerald-700 font-black text-sm">
                      {alloc.netPayableCash > 0 ? (
                        `+${Math.round(alloc.netPayableCash).toLocaleString()}`
                      ) : (
                        <span className="text-amber-700 text-xs flex items-center gap-1 font-bold">
                          <AlertTriangle size={11} className="text-amber-600" />
                          <span>رصيد مدين {Math.round(alloc.carriedDebt).toLocaleString()}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/80 border-t-2 border-slate-300 font-black text-slate-900">
                <tr>
                  <td className="p-3.5">الإجمالي العام</td>
                  <td className="p-3.5 text-center font-mono">100%</td>
                  <td className="p-3.5 font-mono">{Math.round(totalCurrentCapital).toLocaleString()}</td>
                  <td className="p-3.5 font-mono">{Math.round(pnlData.netProfit).toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-indigo-700 bg-indigo-100/50">+{Math.round(allocationData.capitalAdditionPool).toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-indigo-900 bg-indigo-100/80">{Math.round(allocationData.newTotalCapital).toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-emerald-800">{Math.round(allocationData.distributableCashPool).toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-rose-600">
                    -{Math.round(allocationData.partnerAllocations.reduce((s, a) => s + a.drawings, 0)).toLocaleString()}
                  </td>
                  <td className="p-3.5 font-mono text-emerald-700 text-sm">
                    {Math.round(allocationData.partnerAllocations.reduce((s, a) => s + a.netPayableCash, 0)).toLocaleString()} {settings.currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CONFIRMATION POSTING MODAL */}
      {/* ========================================================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/70">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-indigo-600" />
                <span>اعتماد التسوية وتعلية رأس المال رسمياً</span>
              </h3>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-700" />
                  <span>تأكيد اعتماد القيود المالية في النظام:</span>
                </div>
                <p className="text-[11px] font-normal text-amber-800 leading-relaxed">
                  سيتم تحديث رأس مال الشركاء رسمياً في قاعدة البيانات، وإضافة المبالغ المخصصة لتعلية رأس المال لحصصهم، وتسجيل قيود إيداع وتوزيع الأرباح.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">الفترة المحاسبية:</span>
                  <span className="font-mono font-bold text-slate-900">{fromDate} إلى {toDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">صافي أرباح الصالون:</span>
                  <span className="font-mono font-bold text-emerald-700">{Math.round(pnlData.netProfit).toLocaleString()} {settings.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">المبلغ المخصص لتعلية رأس المال:</span>
                  <span className="font-mono font-black text-indigo-700">+{Math.round(allocationData.capitalAdditionPool).toLocaleString()} {settings.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">صافي المستحق للصرف نقداً:</span>
                  <span className="font-mono font-black text-emerald-700">
                    {Math.round(allocationData.partnerAllocations.reduce((s, a) => s + a.netPayableCash, 0)).toLocaleString()} {settings.currency}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-900 font-black">إجمالي رأس مال الصالون الجديد:</span>
                  <span className="font-mono font-black text-indigo-900 text-sm">
                    {Math.round(allocationData.newTotalCapital).toLocaleString()} {settings.currency}
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleExecutePosting}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>جاري الاعتماد...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>تأكيد الاعتماد والترحيل</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINTABLE A4 MODAL (محضر الأرباح والخسائر وتعلية رأس المال) */}
      {/* ========================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-800">محضر قائمة الأرباح والخسائر وتعلية رأس المال</h3>
                  <p className="text-[11px] text-slate-400 font-normal">معاينة التقرير الرسمي للطباعة والتوقيع المعتمد (A4)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintReceipt(printDocumentId, true, 'a4')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Printer size={15} />
                  <span>طباعة الآن (A4)</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 flex justify-center">
              <div
                id={printDocumentId}
                className="w-full max-w-[280mm] bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 text-slate-900 font-sans text-xs"
              >
                {/* Header */}
                <div className="flex justify-between items-start pb-6 border-b-2 border-slate-900">
                  <div className="space-y-1">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {settings.salonName || 'صالون سمارت كت للرجال'}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                      سجل تجاري / ترخيص: {settings.commercialRegister || settings.taxNumber || '1010789456'}
                    </p>
                    <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg text-[11px] font-black">
                      <FileText size={13} className="text-indigo-800" />
                      <span>قائمة الأرباح والخسائر ومحضر تعلية رأس المال وتوزيع الحصص المعتمد</span>
                    </div>
                  </div>

                  <div className="text-left font-mono text-[11px] text-slate-500 space-y-1">
                    <div>الفترة: <strong>{fromDate}</strong> إلى <strong>{toDate}</strong></div>
                    <div>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</div>
                    <div>العملة المعتمدة: {settings.currency}</div>
                  </div>
                </div>

                {/* Simplified P&L Summary Block */}
                <div className="my-6 p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-3">
                  <h3 className="font-black text-xs text-slate-800 border-b border-slate-200 pb-1.5">
                    أولاً: ملخص قائمة الأرباح والخسائر للصالون (P&L Summary)
                  </h3>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold">صافي الإيرادات:</div>
                      <div className="font-mono font-black text-sm text-slate-900">{pnlData.netOperatingRevenue.toLocaleString()} {settings.currency}</div>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold">تكلفة النشاط (COGS):</div>
                      <div className="font-mono font-black text-sm text-amber-700">-{pnlData.totalCOGS.toLocaleString()} {settings.currency}</div>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold">المصروفات التشغيلية والرواتب:</div>
                      <div className="font-mono font-black text-sm text-rose-700">-{pnlData.totalOperatingExpenses.toLocaleString()} {settings.currency}</div>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-300">
                      <div className="text-[10px] text-emerald-800 font-black">صافي الأرباح المحاسبية:</div>
                      <div className="font-mono font-black text-base text-emerald-700">+{pnlData.netProfit.toLocaleString()} {settings.currency}</div>
                    </div>
                  </div>
                </div>

                {/* Capital Increase Summary Block */}
                {allocationData.capitalAdditionPool > 0 && (
                  <div className="mb-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-2">
                    <h3 className="font-black text-xs text-indigo-900">
                      ثانياً: قرار تعلية رأس المال (Capital Addition Decision)
                    </h3>
                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                      بناءً على نتائج الأعمال المحققة، تقرر اقتطاع مبلغ <strong>{Math.round(allocationData.capitalAdditionPool).toLocaleString()} {settings.currency}</strong> (بنسبة <strong>{allocationData.effectiveReinvestmentPercent.toFixed(1)}%</strong> من صافي الأرباح) وإضافته لرأس مال الصالون وحصص الشركاء، وتوزيع المتبقي البالغ <strong>{Math.round(allocationData.distributableCashPool).toLocaleString()} {settings.currency}</strong> نقداً.
                    </p>
                  </div>
                )}

                {/* Partners Table */}
                <div className="mb-6">
                  <h3 className="font-black text-xs text-slate-800 mb-2">
                    ثالثاً: جدول توزيع أرباح وحصص الشركاء ورؤوس الأموال الجديدة
                  </h3>
                  <table className="w-full text-right border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-slate-100 font-bold">
                      <tr>
                        <th className="border border-slate-300 p-2">اسم الشريك</th>
                        <th className="border border-slate-300 p-2 text-center">النسبة</th>
                        <th className="border border-slate-300 p-2">رأس المال السابق</th>
                        <th className="border border-slate-300 p-2">إجمالي نصيب الربح</th>
                        <th className="border border-slate-300 p-2 text-indigo-900 bg-indigo-50">تعلية رأس المال</th>
                        <th className="border border-slate-300 p-2 text-indigo-900 font-black bg-indigo-50">رأس المال الجديد</th>
                        <th className="border border-slate-300 p-2 text-emerald-900 bg-emerald-50 font-black">المستحق نقداً</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationData.partnerAllocations.map(alloc => (
                        <tr key={alloc.partnerId}>
                          <td className="border border-slate-300 p-2 font-bold">{alloc.partnerName}</td>
                          <td className="border border-slate-300 p-2 text-center font-mono">{alloc.sharePercentage}%</td>
                          <td className="border border-slate-300 p-2 font-mono">{Math.round(alloc.currentCapital).toLocaleString()}</td>
                          <td className="border border-slate-300 p-2 font-mono">{Math.round(alloc.partnerTotalProfit).toLocaleString()}</td>
                          <td className="border border-slate-300 p-2 font-mono text-indigo-900 bg-indigo-50/50">+{Math.round(alloc.partnerCapitalAddition).toLocaleString()}</td>
                          <td className="border border-slate-300 p-2 font-mono text-indigo-900 font-black bg-indigo-50">{Math.round(alloc.partnerNewCapital).toLocaleString()}</td>
                          <td className="border border-slate-300 p-2 font-mono text-emerald-800 font-black bg-emerald-50/50">+{Math.round(alloc.netPayableCash).toLocaleString()} {settings.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-black">
                      <tr>
                        <td className="border border-slate-300 p-2">الإجمالي العام</td>
                        <td className="border border-slate-300 p-2 text-center font-mono">100%</td>
                        <td className="border border-slate-300 p-2 font-mono">{Math.round(totalCurrentCapital).toLocaleString()}</td>
                        <td className="border border-slate-300 p-2 font-mono">{Math.round(pnlData.netProfit).toLocaleString()}</td>
                        <td className="border border-slate-300 p-2 font-mono text-indigo-900 bg-indigo-50">+{Math.round(allocationData.capitalAdditionPool).toLocaleString()}</td>
                        <td className="border border-slate-300 p-2 font-mono text-indigo-900 font-black bg-indigo-50">{Math.round(allocationData.newTotalCapital).toLocaleString()}</td>
                        <td className="border border-slate-300 p-2 font-mono text-emerald-800 font-black bg-emerald-50">+{Math.round(allocationData.partnerAllocations.reduce((s, a) => s + a.netPayableCash, 0)).toLocaleString()} {settings.currency}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Signatures Block */}
                <div className="pt-6 border-t border-slate-300">
                  <h4 className="font-bold text-[11px] text-slate-700 mb-6">رابعاً: اعتماد وإقرار الشركاء والإدارة:</h4>
                  <div className="grid grid-cols-3 gap-6 text-center text-xs">
                    <div className="space-y-12">
                      <p className="font-bold text-slate-800">إقرار وتوقيع الشركاء</p>
                      <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
                    </div>
                    <div className="space-y-12">
                      <p className="font-bold text-slate-800">المحاسب / المدير المالي</p>
                      <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
                    </div>
                    <div className="space-y-12">
                      <p className="font-bold text-slate-800">اعتماد المدير العام</p>
                      <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
