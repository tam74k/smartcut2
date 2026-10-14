import { useState, useMemo, useEffect } from 'react';
import { AppSettings, Transaction, Invoice, Branch, TipRecord, AppUser, Booking, SalesReturn } from '../types';
import { Calendar, FileBarChart, Download, TrendingUp, TrendingDown, DollarSign, Printer, CheckCircle2, Clock, Wallet, Coins, ShoppingCart, Truck, Edit2, Trash2, RefreshCw, AlertTriangle, User, X, Check, Save, RotateCcw, UserX, MessageSquare, Phone, Copy, Search, Award, Sparkles, UserCheck, Target } from 'lucide-react';
import { ClosingReportReceipt } from './ClosingReportReceipt';
import { ServicesReportReceipt } from './ServicesReportReceipt';
import { EmployeesReportReceipt } from './EmployeesReportReceipt';
import { ExpensesReportReceipt } from './ExpensesReportReceipt';
import { IncomeReportReceipt } from './IncomeReportReceipt';
import { CustodyReportReceipt } from './CustodyReportReceipt';
import { exportToExcel } from '../utils/exportExcel';
import { handlePrintReceipt } from '../utils/print';
import { calculateEmployeeCommission, calculateEmployeeTotalCommission } from '../utils/commissionHelper';
import { calculateEmployeeTargetCommission } from '../utils/targetCalculationHelper';
import { DB, getFingerprintProcessedDate } from '../services/db';
import { AuthService } from '../services/auth';
import { SalesReturnVoucherModal } from './SalesReturnVoucherModal';
export const safeSplitDate = (d?: string | any): string => {
  if (!d || typeof d !== 'string') return '';
  return d.includes('T') ? d.split('T')[0] : (d.includes(' ') ? d.split(' ')[0] : d);
};

export const isBookingAdvanceTransaction = (t?: any): boolean => {
  if (!t) return false;
  const cat = String(t.category || '').toLowerCase();
  const desc = String(t.description || '').toLowerCase();
  if (cat === 'مقدم حجز' || cat === 'booking_advance') return true;
  if (cat.includes('مقدم') && cat.includes('حجز')) return true;
  if (cat === 'advance' && (desc.includes('حجز') || desc.includes('عربون') || desc.includes('booking'))) return true;
  if (desc.includes('مقدم حجز') || desc.includes('عربون حجز') || desc.includes('عربون لحجز') || desc.includes('دفعة مقدمة / عربون')) return true;
  return false;
};

export function ReportsScreen({ 
  settings, 
  transactions, 
  invoices, 
  employees = [], 
  services = [], 
  products = [],
  bookings = [],
  activeBranchId,
  branches = [],
  tips = [],
  fingerprintLogs = [],
  expenses = [],
  purchases = [],
  supplierPayments = [],
  suppliers = [],
  currentUser,
  setEmployees,
  setTransactions,
  salesReturns = [],
  clients = [],
}: { 
  settings: AppSettings, 
  transactions: Transaction[], 
  invoices: Invoice[], 
  employees: any[], 
  services: any[], 
  products?: any[],
  bookings?: Booking[],
  activeBranchId?: string,
  branches?: Branch[],
  tips?: TipRecord[],
  fingerprintLogs?: any[],
  expenses?: any[],
  purchases?: any[],
  supplierPayments?: any[],
  suppliers?: any[],
  currentUser?: AppUser | null,
  setEmployees?: (employees: any[]) => void,
  setTransactions?: (transactions: any[]) => void,
  salesReturns?: SalesReturn[],
  clients?: any[],
}) {
  const canExportExcel = AuthService.canDo('export_excel', currentUser);

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
  const defaultFirstDay = `${year}-${month}-01`;
  const defaultLastDay = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const [fromDate, setFromDate] = useState(defaultFirstDay);
  const [toDate, setToDate] = useState(defaultLastDay);
  const [reportType, setReportType] = useState('income');
  const [isGenerated, setIsGenerated] = useState(false);
  const [overtimeViewMode, setOvertimeViewMode] = useState<'summary' | 'detailed'>('summary');
  const [selectedOvertimeEmpId, setSelectedOvertimeEmpId] = useState<string>('all');
  const [selectedAdvanceEmpId, setSelectedAdvanceEmpId] = useState<string>('all');
  const [unpaidBookingsFilter, setUnpaidBookingsFilter] = useState<'all' | 'unpaid_only' | 'paid_only'>('all');
  const [unpaidBookingsSearch, setUnpaidBookingsSearch] = useState<string>('');
  const [inactiveClientsSearch, setInactiveClientsSearch] = useState<string>('');
  const defaultInactiveDays = Number(settings.inactiveClientsDays) > 0 ? Number(settings.inactiveClientsDays) : 60;
  const [inactiveDaysFilter, setInactiveDaysFilter] = useState<number>(defaultInactiveDays);
  const [inactiveStatusFilter, setInactiveStatusFilter] = useState<'all' | 'visited' | 'never_visited'>('all');
  const [inactiveSortBy, setInactiveSortBy] = useState<'days_desc' | 'days_asc' | 'spend_desc' | 'visits_desc'>('days_desc');
  const [targetReportSearch, setTargetReportSearch] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<'all' | 'daily' | 'monthly' | 'none'>('all');
  const [targetStatusFilter, setTargetStatusFilter] = useState<'all' | 'achieved' | 'not_achieved'>('all');

  useEffect(() => {
    if (Number(settings.inactiveClientsDays) > 0) {
      setInactiveDaysFilter(Number(settings.inactiveClientsDays));
    }
  }, [settings.inactiveClientsDays]);

  const [localFingerprintLogs, setLocalFingerprintLogs] = useState<any[]>(fingerprintLogs || []);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState<boolean>(false);
  const [editingAdvance, setEditingAdvance] = useState<{
    row: any;
    amount: number;
    date: string;
    treasuryId: string;
    note: string;
  } | null>(null);

  const activeUserName = currentUser?.name || settings.ownerName || 'المسؤول';

  useEffect(() => {
    if (fingerprintLogs && fingerprintLogs.length > 0) {
      setLocalFingerprintLogs(fingerprintLogs);
    }
  }, [fingerprintLogs]);

  const refreshLogs = async () => {
    const sId = settings.salonId;
    if (!sId) return;
    setIsRefreshingLogs(true);
    try {
      const freshLogs = await DB.fetchFingerprintLogs(sId);
      if (Array.isArray(freshLogs)) {
        setLocalFingerprintLogs(freshLogs);
      }
    } catch (e) {
      console.warn('Error refreshing logs in ReportsScreen:', e);
    } finally {
      setIsRefreshingLogs(false);
    }
  };

  useEffect(() => {
    if (reportType === 'overtime' && localFingerprintLogs.length === 0) {
      refreshLogs();
    }
  }, [reportType]);

  const effectiveFingerprintLogs = localFingerprintLogs.length > 0 ? localFingerprintLogs : fingerprintLogs;

  const [activeFrom, setActiveFrom] = useState(defaultFirstDay);
  const [activeTo, setActiveTo] = useState(defaultLastDay);
  const [activeReportType, setActiveReportType] = useState('income');

  const mainBranch = (branches && branches[0]) || { id: 'b-main', name: 'الفرع الرئيسي' };
  const mainBranchId = mainBranch.id;
  const isMainBranch = !activeBranchId || activeBranchId === mainBranchId || activeBranchId === 'b-main';

  const matchesActiveBranch = (itemBranchId?: string) => {
    if (itemBranchId) {
      return itemBranchId === activeBranchId;
    }
    return isMainBranch;
  };

  const branchTransactions = useMemo(() => {
    return transactions.filter(t => matchesActiveBranch((t as any).branchId));
  }, [transactions, activeBranchId, isMainBranch]);

  const branchInvoices = useMemo(() => {
    return invoices.filter(inv => matchesActiveBranch(inv.branchId));
  }, [invoices, activeBranchId, isMainBranch]);

  const branchEmployees = useMemo(() => {
    return employees.filter(e => matchesActiveBranch((e as any).branchId));
  }, [employees, activeBranchId, isMainBranch]);

  const branchTips = useMemo(() => {
    return (tips || []).filter(t => matchesActiveBranch(t.branchId));
  }, [tips, activeBranchId, isMainBranch]);

  const branchBookings = useMemo(() => {
    return (bookings || []).filter(b => matchesActiveBranch((b as any).branchId));
  }, [bookings, activeBranchId, isMainBranch]);

  const [localSalesReturns, setLocalSalesReturns] = useState<SalesReturn[]>(salesReturns || []);
  const [voucherModalReturn, setVoucherModalReturn] = useState<SalesReturn | null>(null);

  useEffect(() => {
    if (salesReturns && salesReturns.length > 0) {
      setLocalSalesReturns(salesReturns);
    }
  }, [salesReturns]);

  useEffect(() => {
    DB.fetchSalesReturns(settings.salonId).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setLocalSalesReturns(data);
      }
    }).catch(() => {});
  }, [settings.salonId]);

  const effectiveReturns = (salesReturns && salesReturns.length > 0) ? salesReturns : localSalesReturns;

  const branchSalesReturns = useMemo(() => {
    return effectiveReturns.filter(r => matchesActiveBranch(r.branchId));
  }, [effectiveReturns, activeBranchId, isMainBranch]);

  const getTreasuryLabel = (tId?: string, paymentMethod?: string) => {
    if (tId) {
      const found = settings.treasuries?.find((t: any) => t.id === tId);
      if (found) return found.name;
      if (tId === 'cash') return 'كاش (الدرج)';
      if (tId === 'card') return 'شبكة / فيزا';
      if (tId === 'main') return 'الخزنة الرئيسية';
    }
    if (paymentMethod === 'cash') return 'نقدي (كاش)';
    if (paymentMethod === 'card') return 'شبكة / فيزا';
    if (paymentMethod === 'bank' || paymentMethod === 'transfer') return 'تحويل بنكي';
    return tId || paymentMethod || 'كاش';
  };

  const getSupplierName = (sId?: string) => {
    if (!sId) return 'مورد عام';
    const s = (suppliers || []).find((item: any) => item.id === sId);
    return s ? s.name : sId;
  };

  const handleGenerate = () => {
    setActiveFrom(fromDate);
    setActiveTo(toDate);
    setActiveReportType(reportType);
    setIsGenerated(true);
  };

  // ---- حسابات معادلة صافي الأرباح (Net Profit Equation) ----
  const netProfitReportData = useMemo(() => {
    if (!activeFrom || !activeTo) {
      return {
        grossIncome: 0,
        totalInvoicedSales: 0,
        totalCashbackUsed: 0,
        netTreasurySales: 0,
        totalExpenses: 0,
        totalSalaries: 0,
        totalAdvances: 0,
        totalPurchasesPaid: 0,
        totalPurchasesAmount: 0,
        totalPurchasesRemaining: 0,
        totalSupplierPayments: 0,
        totalPurchasesAndSuppliers: 0,
        totalCommissions: 0,
        totalDeductions: 0,
        netProfit: 0,
        profitMargin: 0,
        periodInvoicesCount: 0,
        periodPurchases: [],
        periodSupplierPayments: [],
        supplierPaymentsByMethod: {},
        purchasesByMethod: {},
        breakdownList: []
      };
    }

    // 1. Gross Invoiced Income (إجمالي الدخل من الفواتير)
    const periodInvoices = branchInvoices.filter(inv => {
      const d = (inv.date || '').split('T')[0];
      return d >= activeFrom && d <= activeTo && inv.status !== 'cancelled';
    });

    const totalInvoicedSales = periodInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const totalCashbackUsed = periodInvoices.reduce((sum, inv) => sum + (Number(inv.cashbackUsed) || 0), 0);

    // 1.1 Sales Returns (مرتجعات المبيعات)
    const periodReturns = branchSalesReturns.filter(r => {
      const d = (r.returnDate || '').split('T')[0];
      return d >= activeFrom && d <= activeTo;
    });
    const totalReturnsAmount = periodReturns.reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
    const netSalesAfterReturns = Math.max(0, totalInvoicedSales - totalReturnsAmount);
    const netTreasurySales = Math.max(0, netSalesAfterReturns - totalCashbackUsed);
    const grossIncome = netSalesAfterReturns;

    // 2. All Expenses (جميع المصروفات)
    const periodTransactions = branchTransactions.filter(t => {
      const d = (t.date || '').split('T')[0];
      return d >= activeFrom && d <= activeTo;
    });

    const directExpenseTx = periodTransactions.filter(t => t.type === 'expense');
    const customExpenses = (expenses || []).filter(e => {
      const d = (e.date || '').split('T')[0];
      const isBranchMatch = matchesActiveBranch(e.branchId);
      return d >= activeFrom && d <= activeTo && isBranchMatch;
    });

    const totalExpenses = customExpenses.length > 0
      ? customExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      : directExpenseTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 3. Salaries Disbursed (الرواتب)
    let totalSalaries = 0;
    let totalAdvances = 0;

    branchEmployees.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        const d = (rec.date || '').split('T')[0];
        if (d >= activeFrom && d <= activeTo) {
          if (rec.type === 'salary') {
            totalSalaries += Number(rec.amount) || 0;
          } else if (rec.type === 'advance') {
            totalAdvances += Number(rec.amount) || 0;
          }
        }
      });
    });

    if (totalSalaries === 0) {
      totalSalaries = periodTransactions
        .filter(t => t.category?.includes('راتب') || t.category?.includes('رواتب') || t.description?.includes('راتب'))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }
    if (totalAdvances === 0) {
      totalAdvances = periodTransactions
        .filter(t => t.category?.includes('سلفة') || t.category?.includes('سلف') || t.description?.includes('سلفة'))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }

    // 4. Purchases Paid + Supplier Payments (المسدد في فواتير المشتريات + دفعات الموردين)
    const periodPurchases = (purchases || []).filter(p => {
      const d = (p.invoiceDate || p.date || '').split('T')[0];
      const isBranchMatch = matchesActiveBranch(p.branchId);
      return d >= activeFrom && d <= activeTo && isBranchMatch;
    });
    const totalPurchasesPaid = periodPurchases.reduce((sum, p) => sum + (Number(p.paid ?? p.paidAmount ?? p.paid_amount) || 0), 0);
    const totalPurchasesAmount = periodPurchases.reduce((sum, p) => sum + (Number(p.total ?? p.totalAmount ?? p.total_amount) || 0), 0);
    const totalPurchasesRemaining = periodPurchases.reduce((sum, p) => sum + (Number(p.remaining ?? p.remainingAmount ?? p.remaining_amount) || 0), 0);

    const periodSupplierPayments = (supplierPayments || []).filter(sp => {
      const d = (sp.paymentDate || sp.date || '').split('T')[0];
      const isBranchMatch = matchesActiveBranch(sp.branchId);
      return d >= activeFrom && d <= activeTo && isBranchMatch;
    });
    const totalSupplierPayments = periodSupplierPayments.reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
    const totalPurchasesAndSuppliers = totalPurchasesPaid + totalSupplierPayments;

    // Breakdown of Supplier Payments by Treasury / Payment Method
    const supplierPaymentsByMethod: Record<string, number> = {};
    periodSupplierPayments.forEach(sp => {
      const method = sp.treasuryId || sp.paymentMethod || sp.treasury || 'cash';
      supplierPaymentsByMethod[method] = (supplierPaymentsByMethod[method] || 0) + (Number(sp.amount) || 0);
    });

    // Breakdown of Purchases by Treasury / Payment Method
    const purchasesByMethod: Record<string, number> = {};
    periodPurchases.forEach(p => {
      const paid = Number(p.paid ?? p.paidAmount ?? p.paid_amount) || 0;
      if (paid > 0) {
        const method = p.treasuryId || p.paymentMethod || p.treasury || 'cash';
        purchasesByMethod[method] = (purchasesByMethod[method] || 0) + paid;
      }
    });

    // 5. Employee Commissions (عمولات الموظفين - تنفيذ وإحالة)
    let totalCommissions = 0;
    periodInvoices.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        totalCommissions += Number(item.employeeCommission || item.commissionAmount || 0) + Number(item.referralCommissionAmount || 0);
      });
    });

    if (totalCommissions === 0) {
      branchEmployees.forEach(emp => {
        (emp.financialRecords || []).forEach((rec: any) => {
          const d = (rec.date || '').split('T')[0];
          if (d >= activeFrom && d <= activeTo && (rec.type === 'commission' || rec.type === 'service_commission' || rec.type === 'referral_commission')) {
            totalCommissions += Number(rec.amount) || 0;
          }
        });
      });
    }

    // 6. Net Profit Calculation:
    // صافي الربح = إجمالي الدخل - المصروفات - الرواتب - السلف - المسدد في المشتريات - دفعات الموردين - العمولات
    const totalDeductions = totalExpenses + totalSalaries + totalAdvances + totalPurchasesAndSuppliers + totalCommissions;
    const netProfit = grossIncome - totalDeductions;
    const profitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

    const breakdownList = [
      { id: 'income', label: 'إجمالي مبيعات الفواتير الصادرة', amount: totalInvoicedSales, type: 'plus', percent: 100, note: `${periodInvoices.length} فاتورة مسددة (شاملة الكاش باك)` },
      ...(totalReturnsAmount > 0 ? [
        { id: 'sales_returns', label: 'إجمالي مرتجعات المبيعات (إشعارات دائن)', amount: totalReturnsAmount, type: 'minus', percent: totalInvoicedSales > 0 ? (totalReturnsAmount / totalInvoicedSales) * 100 : 0, note: `${periodReturns.length} حركة مرتجع مسجلة بالنظام` },
        { id: 'net_sales', label: 'صافي المبيعات (بعد خصم المرتجعات)', amount: netSalesAfterReturns, type: 'info', percent: totalInvoicedSales > 0 ? (netSalesAfterReturns / totalInvoicedSales) * 100 : 0, note: `المبيعات الفعلية المتبقية بعد استبعاد المرتجعات` }
      ] : []),
      ...(totalCashbackUsed > 0 ? [
        { id: 'cashback', label: 'المسدد بواسطة الكاش باك (محفظة العملاء)', amount: totalCashbackUsed, type: 'info', percent: grossIncome > 0 ? (totalCashbackUsed / grossIncome) * 100 : 0, note: `سدد من أرصدة ونقاط العملاء • الفارق بين إجمالي الفواتير والمحصل بالخزائن (${Number(netTreasurySales || 0).toFixed(2)} ${settings.currency})` }
      ] : []),
      { id: 'expenses', label: 'جميع المصروفات التشغيلية والنثرية', amount: totalExpenses, type: 'minus', percent: grossIncome > 0 ? (totalExpenses / grossIncome) * 100 : 0, note: 'مصروفات الإيجار والفواتير والنثريات' },
      { id: 'salaries', label: 'الرواتب الأساسية ومسيرات الصرف', amount: totalSalaries, type: 'minus', percent: grossIncome > 0 ? (totalSalaries / grossIncome) * 100 : 0, note: 'مسيرات الرواتب المنصرفة للكادر' },
      { id: 'advances', label: 'سلف الموظفين المصروفة', amount: totalAdvances, type: 'minus', percent: grossIncome > 0 ? (totalAdvances / grossIncome) * 100 : 0, note: 'السلف الممنوحة خلال هذه الفترة' },
      { id: 'purchases', label: 'المسدد في فواتير المشتريات', amount: totalPurchasesPaid, type: 'minus', percent: grossIncome > 0 ? (totalPurchasesPaid / grossIncome) * 100 : 0, note: `${periodPurchases.length} فاتورة مشتريات (إجمالي الفواتير: ${Number(totalPurchasesAmount || 0).toFixed(2)} ${settings.currency} - المتبقي كآجل: ${Number(totalPurchasesRemaining || 0).toFixed(2)} ${settings.currency})` },
      { id: 'supplier_payments', label: 'سندات دفعات وسداد الموردين', amount: totalSupplierPayments, type: 'minus', percent: grossIncome > 0 ? (totalSupplierPayments / grossIncome) * 100 : 0, note: `${periodSupplierPayments.length} سند دفع وسداد للموردين خلال الفترة` },
      { id: 'commissions', label: 'عمولات الموظفين على الخدمات والمنتجات', amount: totalCommissions, type: 'minus', percent: grossIncome > 0 ? (totalCommissions / grossIncome) * 100 : 0, note: 'استحقاقات الفنيين عن المبيعات المنجزة' },
      { id: 'net_profit', label: 'صافي الربح الفعلي بعد كافة الاستقطاعات', amount: netProfit, type: 'result', percent: profitMargin, note: `هامش الربح الصافي: ${Number(profitMargin || 0).toFixed(1)}%` }
    ];

    return {
      grossIncome,
      totalInvoicedSales,
      totalReturnsAmount,
      netSalesAfterReturns,
      returnsCount: periodReturns.length,
      totalCashbackUsed,
      netTreasurySales,
      totalExpenses,
      totalSalaries,
      totalAdvances,
      totalPurchasesPaid,
      totalPurchasesAmount,
      totalPurchasesRemaining,
      totalSupplierPayments,
      totalPurchasesAndSuppliers,
      totalCommissions,
      totalDeductions,
      netProfit,
      profitMargin,
      periodInvoicesCount: periodInvoices.length,
      periodPurchases,
      periodSupplierPayments,
      supplierPaymentsByMethod,
      purchasesByMethod,
      breakdownList
    };
  }, [activeFrom, activeTo, branchInvoices, branchTransactions, expenses, branchEmployees, purchases, supplierPayments, branchSalesReturns, matchesActiveBranch, settings.currency]);

  // ---- حسابات تقرير مرتجعات المبيعات (Sales Returns Report Data) ----
  const salesReturnsReportData = useMemo(() => {
    if (!activeFrom || !activeTo) {
      return {
        returns: [],
        totalRefundAmount: 0,
        returnsCount: 0,
        restockedProductsCount: 0,
        returnedServicesCount: 0,
        reasonsBreakdown: {},
        treasuriesBreakdown: {},
        topReturnedItems: []
      };
    }

    const filtered = branchSalesReturns.filter(r => {
      const d = (r.returnDate || '').split('T')[0];
      return d >= activeFrom && d <= activeTo;
    });

    let totalRefund = 0;
    let restockedProducts = 0;
    let returnedServices = 0;
    const reasonsMap: Record<string, { count: number; amount: number }> = {};
    const treasuriesMap: Record<string, number> = {};
    const itemsMap: Record<string, { name: string; type: string; qty: number; amount: number }> = {};

    filtered.forEach(r => {
      totalRefund += Number(r.totalRefundAmount || 0);

      const rName = r.reason || 'أخرى';
      if (!reasonsMap[rName]) reasonsMap[rName] = { count: 0, amount: 0 };
      reasonsMap[rName].count += 1;
      reasonsMap[rName].amount += Number(r.totalRefundAmount || 0);

      const tId = r.treasuryId || r.refundMethod || 'cash';
      treasuriesMap[tId] = (treasuriesMap[tId] || 0) + Number(r.totalRefundAmount || 0);

      (r.items || []).forEach(item => {
        if (item.type === 'product' && item.restockToInventory) {
          restockedProducts += Number(item.quantity || 1);
        } else if (item.type === 'service') {
          returnedServices += Number(item.quantity || 1);
        }

        const itKey = item.itemId || item.name;
        if (!itemsMap[itKey]) {
          itemsMap[itKey] = { name: item.name, type: item.type, qty: 0, amount: 0 };
        }
        itemsMap[itKey].qty += Number(item.quantity || 1);
        itemsMap[itKey].amount += Number(item.totalRefund || (item.unitPrice * item.quantity));
      });
    });

    const topItems = Object.values(itemsMap).sort((a, b) => b.qty - a.qty);

    return {
      returns: filtered,
      totalRefundAmount: totalRefund,
      returnsCount: filtered.length,
      restockedProductsCount: restockedProducts,
      returnedServicesCount: returnedServices,
      reasonsBreakdown: reasonsMap,
      treasuriesBreakdown: treasuriesMap,
      topReturnedItems: topItems
    };
  }, [branchSalesReturns, activeFrom, activeTo]);

  const targetReportData = useMemo(() => {
    if (!activeFrom || !activeTo) {
      return {
        rows: [],
        totalTargetSales: 0,
        totalEligibleAmount: 0,
        totalTargetCommissions: 0,
        totalExemptSales: 0,
        totalExemptCommissions: 0,
        achievedCount: 0,
        totalTargetEmployees: 0,
        totalEmployees: 0,
      };
    }

    const start = new Date(activeFrom);
    const end = new Date(activeTo);
    end.setHours(23, 59, 59, 999);

    const periodInvoices = branchInvoices.filter(inv => {
      const d = new Date(inv.date);
      return d >= start && d <= end;
    });

    const rows = branchEmployees.map((emp: any) => {
      const targetType = (emp.targetType || 'none') as 'none' | 'daily' | 'monthly';
      const baseSalary = Number(emp.baseSalary ?? emp.basicSalary ?? 0);
      const commissionRate = Math.max(0, Number(
        emp.targetCommissionRate !== undefined && emp.targetCommissionRate !== null 
          ? emp.targetCommissionRate 
          : (emp.commissionRate ?? 0)
      ) || 0);

      if (targetType === 'daily') {
        const dailyTarget = Number(emp.dailyTargetAmount || emp.target || 0);
        const dailyMethod = emp.dailyTargetMethod || 'excess_only';
        const methodLabel = dailyMethod === 'full_amount' 
          ? 'يومي: على كامل المبلغ عند تحقيق التارجت' 
          : 'يومي: على ما فوق التارجت فقط (الفائض)';

        let totalSales = 0;
        let totalEligible = 0;
        let totalCommission = 0;
        let totalExemptSales = 0;
        let totalExemptCommission = 0;
        let totalExemptItems = 0;
        let daysAchieved = 0;
        let workingDaysCount = 0;

        const dayMap = new Map<string, any[]>();
        periodInvoices.forEach(inv => {
          const d = (inv.date || (inv as any).createdAt || '').split('T')[0];
          if (d) {
            if (!dayMap.has(d)) dayMap.set(d, []);
            dayMap.get(d)!.push(inv);
          }
        });

        dayMap.forEach((dayInvs, dStr) => {
          const dayCalc = calculateEmployeeTargetCommission({
            employee: emp,
            settings,
            invoices: dayInvs,
            dateRange: { start: dStr, end: dStr },
            isDaily: true
          });
          if (dayCalc.totalValidSales > 0 || dayCalc.exemptSales > 0) {
            workingDaysCount++;
          }
          totalSales += dayCalc.totalValidSales;
          totalEligible += dayCalc.eligibleAmount;
          totalCommission += dayCalc.commissionAmount;
          totalExemptSales += dayCalc.exemptSales;
          totalExemptCommission += dayCalc.exemptCommission;
          totalExemptItems += dayCalc.exemptItemsCount;
          if (dayCalc.isTargetAchieved) {
            daysAchieved++;
          }
        });

        const isAchieved = daysAchieved > 0;
        const progressPercent = workingDaysCount > 0 ? Math.min(100, Math.round((daysAchieved / workingDaysCount) * 100)) : 0;

        return {
          empId: emp.id,
          empCode: emp.code || '',
          empName: emp.name,
          empRole: emp.role || 'موظف',
          targetType,
          targetRequired: dailyTarget,
          targetMethod: dailyMethod,
          targetMethodLabel: methodLabel,
          baseSalary,
          totalWorkSales: totalSales,
          targetSalesPool: totalSales,
          eligibleAmount: totalEligible,
          commissionRate,
          targetCommission: totalCommission,
          isTargetAchieved: isAchieved,
          remainingToTarget: Math.max(0, dailyTarget - totalSales),
          exemptSales: totalExemptSales,
          exemptCommission: totalExemptCommission,
          exemptItemsCount: totalExemptItems,
          progressPercent,
          daysAchieved,
          workingDaysCount,
          totalEarnedCommission: totalCommission + totalExemptCommission
        };
      } else if (targetType === 'monthly') {
        const monthlyTarget = Number(emp.monthlyTargetAmount || emp.target || 0);
        const monthlyMethod = emp.monthlyTargetMethod || 'deduct_salary';
        const methodLabel = monthlyMethod === 'gross_sales'
          ? 'شهري: على إجمالي الشغل بدون خصم الراتب'
          : 'شهري: خصم الراتب الأساسي ثم النسبة على ما فوق التارجت';

        const calc = calculateEmployeeTargetCommission({
          employee: emp,
          settings,
          invoices: periodInvoices,
          dateRange: { start: activeFrom, end: activeTo },
          isDaily: false,
          daysInMonth: 30
        });

        return {
          empId: emp.id,
          empCode: emp.code || '',
          empName: emp.name,
          empRole: emp.role || 'موظف',
          targetType,
          targetRequired: monthlyTarget,
          targetMethod: monthlyMethod,
          targetMethodLabel: methodLabel,
          baseSalary,
          totalWorkSales: calc.totalValidSales,
          targetSalesPool: calc.totalValidSales,
          eligibleAmount: calc.eligibleAmount,
          commissionRate,
          targetCommission: calc.commissionAmount,
          isTargetAchieved: calc.isTargetAchieved,
          remainingToTarget: calc.remainingToTarget,
          exemptSales: calc.exemptSales,
          exemptCommission: calc.exemptCommission,
          exemptItemsCount: calc.exemptItemsCount,
          progressPercent: calc.achievementPercentage,
          daysAchieved: calc.isTargetAchieved ? 1 : 0,
          workingDaysCount: 1,
          totalEarnedCommission: calc.commissionAmount + calc.exemptCommission
        };
      } else {
        const calc = calculateEmployeeTargetCommission({
          employee: emp,
          settings,
          invoices: periodInvoices,
          dateRange: { start: activeFrom, end: activeTo },
          isDaily: false
        });

        return {
          empId: emp.id,
          empCode: emp.code || '',
          empName: emp.name,
          empRole: emp.role || 'موظف',
          targetType: 'none',
          targetRequired: 0,
          targetMethod: 'none',
          targetMethodLabel: 'غير خاضع لنظام التارجت',
          baseSalary,
          totalWorkSales: calc.totalValidSales,
          targetSalesPool: calc.totalValidSales,
          eligibleAmount: 0,
          commissionRate: emp.commissionRate || 0,
          targetCommission: 0,
          isTargetAchieved: false,
          remainingToTarget: 0,
          exemptSales: calc.exemptSales,
          exemptCommission: calc.exemptCommission,
          exemptItemsCount: calc.exemptItemsCount,
          progressPercent: 100,
          daysAchieved: 0,
          workingDaysCount: 0,
          totalEarnedCommission: calc.exemptCommission
        };
      }
    });

    const targetEmployees = rows.filter((r: any) => r.targetType !== 'none');
    const achievedCount = targetEmployees.filter((r: any) => r.isTargetAchieved).length;
    const totalTargetSales = rows.reduce((sum: number, r: any) => sum + r.targetSalesPool, 0);
    const totalEligibleAmount = rows.reduce((sum: number, r: any) => sum + r.eligibleAmount, 0);
    const totalTargetCommissions = rows.reduce((sum: number, r: any) => sum + r.targetCommission, 0);
    const totalExemptSales = rows.reduce((sum: number, r: any) => sum + r.exemptSales, 0);
    const totalExemptCommissions = rows.reduce((sum: number, r: any) => sum + r.exemptCommission, 0);

    return {
      rows,
      totalTargetSales,
      totalEligibleAmount,
      totalTargetCommissions,
      totalExemptSales,
      totalExemptCommissions,
      achievedCount,
      totalTargetEmployees: targetEmployees.length,
      totalEmployees: rows.length
    };
  }, [branchEmployees, branchInvoices, activeFrom, activeTo, settings]);

  const inactiveDaysThreshold = inactiveDaysFilter > 0 ? inactiveDaysFilter : (Number(settings.inactiveClientsDays) > 0 ? Number(settings.inactiveClientsDays) : 60);

  const inactiveClientsReportData = useMemo(() => {
    const now = new Date();
    const thresholdDays = inactiveDaysThreshold;

    const clientMap = new Map<string, {
      id: string;
      name: string;
      phone: string;
      lastVisitDate: string;
      createdAtDate: string;
      isNeverVisited: boolean;
      totalVisits: number;
      totalSpend: number;
      avgInvoice: number;
      loyaltyPoints: number;
      cashback: number;
      tier: string;
      isVip: boolean;
      notes: string;
      daysAbsent: number;
    }>();

    // 1. Ingest registered clients
    (clients || []).forEach(c => {
      if (!c) return;
      const cleanPhone = (c.phone || '').trim();
      const key = cleanPhone || c.id || c.name;
      if (!key) return;

      const clientLastVisit = c.lastVisit ? safeSplitDate(c.lastVisit) : '';
      const clientCreatedAt = c.createdAt ? safeSplitDate(c.createdAt) : '';

      clientMap.set(key, {
        id: c.id || key,
        name: c.name || 'عميل بدون اسم',
        phone: c.phone || '',
        lastVisitDate: clientLastVisit,
        createdAtDate: clientCreatedAt,
        isNeverVisited: !clientLastVisit,
        totalVisits: Number(c.totalVisits) || 0,
        totalSpend: Number(c.totalSpent) || 0,
        avgInvoice: 0,
        loyaltyPoints: Number(c.loyaltyPoints) || 0,
        cashback: Number(c.cashback) || 0,
        tier: (c as any).tier || (c as any).membershipLevel || (c.isVip ? 'vip' : 'standard'),
        isVip: Boolean(c.isVip),
        notes: c.notes || (c as any).generalNotes || '',
        daysAbsent: 0
      });
    });

    // 2. Scan invoices to update latest visit date, visit count, and spend
    (invoices || []).forEach(inv => {
      if (!inv || inv.status === 'cancelled') return;
      const invPhone = (inv.clientPhone || '').trim();
      const invName = (inv.clientName || '').trim();
      const invDate = safeSplitDate(inv.date || (inv as any).created_at);
      if (!invDate) return;

      let matchedKey = '';
      if (invPhone && clientMap.has(invPhone)) {
        matchedKey = invPhone;
      } else if (inv.clientId && clientMap.has(inv.clientId)) {
        matchedKey = inv.clientId;
      } else {
        for (const [k, cData] of clientMap.entries()) {
          if (invPhone && cData.phone && (cData.phone === invPhone || cData.phone.replace(/\D/g, '') === invPhone.replace(/\D/g, ''))) {
            matchedKey = k;
            break;
          }
          if (!matchedKey && invName && cData.name && cData.name.toLowerCase() === invName.toLowerCase()) {
            matchedKey = k;
            break;
          }
        }
      }

      const invAmount = Number(inv.total ?? (inv as any).total_amount ?? 0) || 0;

      if (matchedKey) {
        const existing = clientMap.get(matchedKey)!;
        if (!existing.lastVisitDate || invDate > existing.lastVisitDate) {
          existing.lastVisitDate = invDate;
        }
        existing.isNeverVisited = false;
        existing.totalVisits = (existing.totalVisits || 0) + 1;
        existing.totalSpend = (existing.totalSpend || 0) + invAmount;
      } else if (invPhone || (invName && invName !== 'عميل نقدي' && invName !== 'عميل عام')) {
        const newKey = invPhone || invName;
        clientMap.set(newKey, {
          id: inv.clientId || newKey,
          name: invName || 'عميل نقدي',
          phone: invPhone,
          lastVisitDate: invDate,
          createdAtDate: invDate,
          isNeverVisited: false,
          totalVisits: 1,
          totalSpend: invAmount,
          avgInvoice: invAmount,
          loyaltyPoints: 0,
          cashback: 0,
          tier: 'standard',
          isVip: false,
          notes: '',
          daysAbsent: 0
        });
      }
    });

    // 3. Scan bookings to update latest visit date
    (bookings || []).forEach(b => {
      if (!b || b.status === 'cancelled') return;
      const bPhone = (b.phone || '').trim();
      const bDate = safeSplitDate(b.date);
      if (!bDate) return;

      for (const [k, cData] of clientMap.entries()) {
        if (bPhone && cData.phone && (cData.phone === bPhone || cData.phone.replace(/\D/g, '') === bPhone.replace(/\D/g, ''))) {
          if (!cData.lastVisitDate || bDate > cData.lastVisitDate) {
            cData.lastVisitDate = bDate;
          }
          cData.isNeverVisited = false;
          break;
        }
      }
    });

    // 4. Compute days absent and identify inactive clients
    const allClientsList = Array.from(clientMap.values());
    const qualifiedInactiveList: any[] = [];
    let totalSpendAllInactive = 0;
    let sumDaysAbsent = 0;
    let vipInactiveCount = 0;

    allClientsList.forEach(c => {
      const hasVisited = Boolean(c.lastVisitDate);
      const referenceDate = hasVisited ? c.lastVisitDate : c.createdAtDate;
      c.isNeverVisited = !hasVisited;

      let daysAbsent = 0;
      if (referenceDate) {
        const refTime = new Date(referenceDate).getTime();
        if (!isNaN(refTime)) {
          const diffMs = now.getTime() - refTime;
          daysAbsent = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      c.daysAbsent = daysAbsent;
      c.avgInvoice = c.totalVisits > 0 ? (c.totalSpend / c.totalVisits) : 0;

      if (daysAbsent >= thresholdDays) {
        qualifiedInactiveList.push(c);
        totalSpendAllInactive += (c.totalSpend || 0);
        sumDaysAbsent += daysAbsent;

        const isVipTier = c.tier === 'vip' || c.tier === 'royal' || c.tier === 'distinguished' || c.isVip;
        if (isVipTier) {
          vipInactiveCount++;
        }
      }
    });

    // 5. Apply status filter (all / visited / never_visited) and search query
    const searchQuery = (inactiveClientsSearch || '').trim().toLowerCase();

    const filteredInactiveList = qualifiedInactiveList.filter(c => {
      if (inactiveStatusFilter === 'visited' && c.isNeverVisited) return false;
      if (inactiveStatusFilter === 'never_visited' && !c.isNeverVisited) return false;

      if (searchQuery) {
        const matchName = c.name && c.name.toLowerCase().includes(searchQuery);
        const matchPhone = c.phone && c.phone.includes(searchQuery);
        const matchNotes = c.notes && c.notes.toLowerCase().includes(searchQuery);
        if (!matchName && !matchPhone && !matchNotes) return false;
      }

      return true;
    });

    // 6. Sort
    filteredInactiveList.sort((a, b) => {
      if (inactiveSortBy === 'days_asc') {
        return a.daysAbsent - b.daysAbsent;
      } else if (inactiveSortBy === 'spend_desc') {
        return (b.totalSpend || 0) - (a.totalSpend || 0);
      } else if (inactiveSortBy === 'visits_desc') {
        return (b.totalVisits || 0) - (a.totalVisits || 0);
      } else {
        // Default: 'days_desc'
        return b.daysAbsent - a.daysAbsent;
      }
    });

    const inactiveCount = qualifiedInactiveList.length;
    const avgDaysAbsent = inactiveCount > 0 ? Math.round(sumDaysAbsent / inactiveCount) : 0;
    const totalClientsCount = allClientsList.length;
    const inactiveRate = totalClientsCount > 0 ? Math.round((inactiveCount / totalClientsCount) * 100) : 0;

    return {
      allInactiveClients: qualifiedInactiveList,
      inactiveClients: filteredInactiveList,
      inactiveCount,
      totalClientsCount,
      totalPreviousSpend: totalSpendAllInactive,
      avgDaysAbsent,
      inactiveRate,
      vipInactiveCount,
      thresholdDays
    };
  }, [clients, invoices, bookings, inactiveDaysThreshold, inactiveStatusFilter, inactiveSortBy, inactiveClientsSearch]);

  const overtimeReportData = useMemo(() => {
    if (!activeFrom || !activeTo) return { detailedRows: [], summaryRows: [], totalHours: 0, totalAmount: 0, totalEmployees: 0, otCount: 0 };

    const hr = settings.hrSettings || {
      overtimeRateType: '1.5x',
      customOvertimeHourlyRate: 25,
      overtimeGraceMinutes: 30
    };

    const targetEmployees = selectedOvertimeEmpId === 'all'
      ? branchEmployees
      : branchEmployees.filter(e => e.id === selectedOvertimeEmpId);

    const effectiveLogs = (localFingerprintLogs && localFingerprintLogs.length > 0) ? localFingerprintLogs : (fingerprintLogs || []);

    const dates: string[] = [];
    const cur = new Date(activeFrom);
    const end = new Date(activeTo);
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const detailedRows: any[] = [];
    const summaryMap: Record<string, any> = {};

    targetEmployees.forEach(emp => {
      summaryMap[emp.id] = {
        empId: emp.id,
        employee: emp,
        empName: emp.name,
        empCode: emp.fingerprintCode || emp.id,
        role: emp.role || 'موظف',
        baseSalary: emp.baseSalary || 0,
        otDaysCount: 0,
        totalOtMinutes: 0,
        totalOtHours: 0,
        totalOtAmount: 0,
        rateType: hr.overtimeRateType || '1.5x',
        customHourlyRate: hr.customOvertimeHourlyRate || 25
      };

      dates.forEach(dateStr => {
        const rowDate = new Date(dateStr);
        const dayNameAr = rowDate.toLocaleDateString('ar-SA', { weekday: 'long' });

        const shiftSchedule = (emp.shiftScheduleHistory && emp.shiftScheduleHistory.length > 0)
          ? [...emp.shiftScheduleHistory].reverse().find(s => s.date <= dateStr) || { checkInTime: emp.checkInTime || '09:00', checkOutTime: emp.checkOutTime || '18:00' }
          : { checkInTime: emp.checkInTime || '09:00', checkOutTime: emp.checkOutTime || '18:00' };

        const scheduledCheckIn = shiftSchedule.checkInTime || emp.checkInTime || '09:00';
        const scheduledCheckOut = shiftSchedule.checkOutTime || emp.checkOutTime || '18:00';
        
        const schedInParts = scheduledCheckIn.split(':').map(Number);
        const totalSchedInMin = schedInParts[0] * 60 + (schedInParts[1] || 0);

        const schedOutParts = scheduledCheckOut.split(':').map(Number);
        let totalSchedOutMin = schedOutParts[0] * 60 + (schedOutParts[1] || 0);

        // Overnight shift schedule (e.g. 14:00 to 02:00)
        if (totalSchedOutMin <= totalSchedInMin) {
          totalSchedOutMin += 1440;
        }

        const dayLogs = effectiveLogs.filter(l => 
          (l.employeeId === emp.id || (emp.fingerprintCode && (l.fingerprintCode === emp.fingerprintCode || (l as any).fingerprint_code === emp.fingerprintCode))) &&
          (getFingerprintProcessedDate(l) === dateStr || (l.timestamp && (l.timestamp.startsWith(dateStr) || l.timestamp.split('T')[0] === dateStr)))
        ).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        // Look for next day early morning check_out (00:00 - 06:00) for overnight shift as fallback
        const nextDate = new Date(rowDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        const nextDayEarlyCheckOut = effectiveLogs.find(l => 
          (l.employeeId === emp.id || (emp.fingerprintCode && (l.fingerprintCode === emp.fingerprintCode || (l as any).fingerprint_code === emp.fingerprintCode))) &&
          l.type === 'check_out' &&
          (getFingerprintProcessedDate(l) === dateStr || (
            (l.timestamp && (l.timestamp.startsWith(nextDateStr) || safeSplitDate(l.timestamp) === nextDateStr)) &&
            (() => {
              const timePart = l.timestamp?.includes('T') ? l.timestamp.split('T')[1] : (l.timestamp?.includes(' ') ? l.timestamp.split(' ')[1] : '');
              if (!timePart) return false;
              const hour = Number(timePart.split(':')[0]);
              return !isNaN(hour) && hour <= 6;
            })()
          ))
        );

        const checkInLogs = dayLogs.filter(l => l.type === 'check_in');
        const checkOutLogs = dayLogs.filter(l => l.type === 'check_out');

        const checkInLog = checkInLogs[checkInLogs.length - 1] || (dayLogs.length > 0 && !checkOutLogs.includes(dayLogs[0]) ? dayLogs[0] : null);
        let checkOutLog = checkOutLogs[checkOutLogs.length - 1] || (dayLogs.length > 1 && dayLogs[dayLogs.length - 1] !== checkInLog ? dayLogs[dayLogs.length - 1] : null);

        let isNextDayLog = false;
        if (!checkOutLog && nextDayEarlyCheckOut) {
          checkOutLog = nextDayEarlyCheckOut;
          isNextDayLog = true;
        }

        if (checkOutLog && (checkInLog || isNextDayLog || checkOutLog !== checkInLog)) {
          const outTimeStr = checkOutLog.timestamp?.includes('T') ? checkOutLog.timestamp.split('T')[1]?.substring(0, 5) : (checkOutLog.timestamp?.includes(' ') ? checkOutLog.timestamp.split(' ')[1]?.substring(0, 5) : '');
          if (outTimeStr && outTimeStr.includes(':')) {
            const outParts = outTimeStr.split(':').map(Number);
            let actualOutMin = (outParts[0] || 0) * 60 + (outParts[1] || 0);

            const inTimeStr = checkInLog ? (checkInLog.timestamp?.includes('T') ? checkInLog.timestamp.split('T')[1]?.substring(0, 5) : (checkInLog.timestamp?.includes(' ') ? checkInLog.timestamp.split(' ')[1]?.substring(0, 5) : '')) : null;
            const actualInMin = (inTimeStr && inTimeStr.includes(':')) ? (Number(inTimeStr.split(':')[0] || 0) * 60 + Number(inTimeStr.split(':')[1] || 0)) : totalSchedInMin;

            const isOvernight = isNextDayLog || (actualOutMin <= actualInMin);
            if (isOvernight) {
              actualOutMin += 1440;
            }

            if (actualOutMin > totalSchedOutMin) {
              const rawOt = actualOutMin - totalSchedOutMin;
              const otGrace = hr.overtimeGraceMinutes ?? 30;
              if (rawOt >= otGrace) {
                const overtimeMinutes = rawOt;
                const overtimeHours = (overtimeMinutes / 60);
                
                let hourlyRate = 25;
                let rateLabel = '';
                if (hr.overtimeRateType === 'custom_fixed_amount') {
                  hourlyRate = Number(hr.customOvertimeHourlyRate) || 25;
                  rateLabel = `${hourlyRate} ${settings.currency} (مبلغ محدد)`;
                } else if (hr.overtimeRateType === '2x') {
                  const baseHourly = (Number(emp.baseSalary || 0) > 0 ? Number(emp.baseSalary || 0) / 30 : 0) / 8;
                  hourlyRate = (baseHourly > 0 ? baseHourly : 25) * 2;
                  rateLabel = `2.0x (${Number(hourlyRate || 0).toFixed(1)} ${settings.currency}/س)`;
                } else if (hr.overtimeRateType === '1.5x') {
                  const baseHourly = (Number(emp.baseSalary || 0) > 0 ? Number(emp.baseSalary || 0) / 30 : 0) / 8;
                  hourlyRate = (baseHourly > 0 ? baseHourly : 25) * 1.5;
                  rateLabel = `1.5x (${Number(hourlyRate || 0).toFixed(1)} ${settings.currency}/س)`;
                } else {
                  const baseHourly = (Number(emp.baseSalary || 0) > 0 ? Number(emp.baseSalary || 0) / 30 : 0) / 8;
                  hourlyRate = baseHourly > 0 ? baseHourly : 25;
                  rateLabel = `1.0x (${Number(hourlyRate || 0).toFixed(1)} ${settings.currency}/س)`;
                }

                const overtimeAmount = hourlyRate * overtimeHours;

                detailedRows.push({
                  id: `${emp.id}_${dateStr}`,
                  dateStr,
                  dayNameArabic: dayNameAr,
                  employee: emp,
                  empName: emp.name,
                  empCode: emp.fingerprintCode || emp.id,
                  role: emp.role || 'موظف',
                  scheduledCheckOut,
                  actualCheckOut: isOvernight ? `${outTimeStr} (+1)` : outTimeStr,
                  overtimeMinutes,
                  overtimeHours: Number(overtimeHours || 0).toFixed(2),
                  hourlyRate: Number(hourlyRate || 0).toFixed(2),
                  rateLabel,
                  overtimeAmount
                });

                summaryMap[emp.id].otDaysCount += 1;
                summaryMap[emp.id].totalOtMinutes += overtimeMinutes;
                summaryMap[emp.id].totalOtHours += overtimeHours;
                summaryMap[emp.id].totalOtAmount += overtimeAmount;
              }
            }
          }
        }
      });
    });

    const summaryRows = Object.values(summaryMap).filter(s => s.otDaysCount > 0 || selectedOvertimeEmpId !== 'all');
    const totalHours = detailedRows.reduce((sum, r) => sum + (r.overtimeMinutes / 60), 0);
    const totalAmount = detailedRows.reduce((sum, r) => sum + r.overtimeAmount, 0);
    const totalEmployees = new Set(detailedRows.map(r => r.employee.id)).size;

    return {
      detailedRows,
      summaryRows,
      totalHours,
      totalAmount,
      totalEmployees,
      otCount: detailedRows.length
    };
  }, [activeFrom, activeTo, branchEmployees, selectedOvertimeEmpId, fingerprintLogs, localFingerprintLogs, settings.hrSettings, settings.currency]);

  const stats = useMemo(() => {
    const start = new Date(activeFrom);
    const end = new Date(activeTo);
    end.setHours(23, 59, 59, 999);

    const filteredTransactions = branchTransactions.filter(t => {
      const tDateStr = safeSplitDate(t.date);
      return tDateStr >= activeFrom && tDateStr <= activeTo;
    });

    // استبعاد مقدمات الحجز والعربونات والعهد الافتتاحية والتحويلات من بند الإيرادات
    const income = filteredTransactions
      .filter(t => 
        t.type === 'in' && 
        t.category !== 'transfer' && 
        t.category !== 'عهدة افتتاحية' && 
        t.category !== 'initial_cash' &&
        !isBookingAdvanceTransaction(t)
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = filteredTransactions
      .filter(t => t.type === 'out' && t.category !== 'transfer')
      .reduce((sum, t) => sum + t.amount, 0);

    const custodyTransactions = filteredTransactions.filter(
      t => t.category === 'عهدة افتتاحية' || t.category === 'initial_cash'
    );
    const totalCustody = custodyTransactions.reduce((sum, t) => sum + t.amount, 0);
    const custodyCount = custodyTransactions.length;
    const custodyAvg = custodyCount > 0 ? totalCustody / custodyCount : 0;

    const filteredTips = branchTips.filter(t => {
      const tDateStr = (t.date || '').split('T')[0];
      return tDateStr >= activeFrom && tDateStr <= activeTo;
    });
    const totalTips = filteredTips.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const instantCashTips = filteredTips.filter(t => t.employeeId !== 'unspecified' && (t.payoutMethod === 'instant_cash' || (!t.payoutMethod && t.status === 'paid_out'))).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const pendingTips = filteredTips.filter(t => t.status === 'pending_payout').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const deferredPaidTips = filteredTips.filter(t => t.payoutMethod === 'pooled_deferred' && t.status === 'paid_out').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return { 
      income, 
      expense, 
      profit: income - expense,
      totalCustody,
      custodyCount,
      custodyAvg,
      totalTips,
      instantCashTips,
      pendingTips,
      deferredPaidTips,
      tipsCount: filteredTips.length
    };
  }, [activeFrom, activeTo, branchTransactions, branchTips]);

  // ---- حسابات حركة صرف العمولات (Commission Payouts Report) ----
  const commissionPayoutsReportData = useMemo(() => {
    if (!activeFrom || !activeTo) {
      return {
        rows: [] as any[],
        totalAmount: 0,
        count: 0,
        treasuryBreakdown: [] as any[]
      };
    }

    const rows: Array<{
      id: string;
      dateStr: string;
      empId: string;
      empCode: string;
      empName: string;
      empRole: string;
      amount: number;
      treasuryId?: string;
      treasuryName: string;
      note: string;
    }> = [];

    branchEmployees.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        if (rec.type === 'commission_payout') {
          const d = (rec.date || '').split('T')[0];
          if (d >= activeFrom && d <= activeTo) {
            const trName = settings.treasuries.find(t => t.id === rec.treasuryId)?.name || 'الخزينة الرئيسية';
            rows.push({
              id: rec.id || Math.random().toString(),
              dateStr: rec.date || d,
              empId: emp.id,
              empCode: emp.fingerprintCode || emp.id,
              empName: emp.name,
              empRole: emp.role || 'فني',
              amount: Number(rec.amount) || 0,
              treasuryId: rec.treasuryId,
              treasuryName: trName,
              note: rec.note || 'صرف عمولة مستحقة'
            });
          }
        }
      });
    });

    // Also check transactions categorized as 'commissions'
    branchTransactions.forEach(trx => {
      if (trx.category === 'commissions' && trx.type === 'out') {
        const d = (trx.date || '').split('T')[0];
        if (d >= activeFrom && d <= activeTo) {
          const alreadyExists = rows.some(r => r.id === trx.id || (r.dateStr.startsWith(d) && Math.abs(r.amount - trx.amount) < 0.01));
          if (!alreadyExists) {
            const trName = settings.treasuries.find(t => t.id === trx.treasury)?.name || trx.treasury || 'الخزينة الرئيسية';
            rows.push({
              id: trx.id,
              dateStr: trx.date,
              empId: '',
              empCode: '-',
              empName: trx.description || 'صرف عمولة',
              empRole: 'موظف',
              amount: Number(trx.amount) || 0,
              treasuryId: trx.treasury,
              treasuryName: trName,
              note: trx.description || 'صرف عمولة'
            });
          }
        }
      }
    });

    rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
    const count = rows.length;

    const tMap: { [key: string]: { name: string; amount: number; count: number } } = {};
    rows.forEach(r => {
      if (!tMap[r.treasuryName]) {
        tMap[r.treasuryName] = { name: r.treasuryName, amount: 0, count: 0 };
      }
      tMap[r.treasuryName].amount += r.amount;
      tMap[r.treasuryName].count += 1;
    });

    return {
      rows,
      totalAmount,
      count,
      treasuryBreakdown: Object.values(tMap)
    };
  }, [branchEmployees, branchTransactions, activeFrom, activeTo, settings.treasuries]);

  // ---- حسابات تقرير سلف الموظفين وتفاصيلها (Advances Report) ----
  const advancesReportData = useMemo(() => {
    if (!activeFrom || !activeTo) {
      return {
        rows: [] as any[],
        totalAmount: 0,
        count: 0,
        employeeCount: 0,
        treasuryBreakdown: [] as any[]
      };
    }

    const rows: Array<{
      id: string;
      dateStr: string;
      empId: string;
      empCode: string;
      empName: string;
      empRole: string;
      amount: number;
      treasuryId?: string;
      treasuryName: string;
      note: string;
      source: 'emp_record' | 'transaction';
      originalRecord?: any;
    }> = [];

    const targetEmployees = selectedAdvanceEmpId === 'all'
      ? branchEmployees
      : branchEmployees.filter(e => e.id === selectedAdvanceEmpId);

    targetEmployees.forEach(emp => {
      (emp.financialRecords || []).forEach((rec: any) => {
        const isSalaryRecord = rec.type === 'salary' || (rec.type === 'advance' && (rec.id?.startsWith('FIN-SAL-') || rec.note?.includes('مسير رواتب') || rec.note?.includes('تم استلام صافي الراتب')));
        if (rec.type === 'advance' && !isSalaryRecord) {
          const d = (rec.date || '').split('T')[0];
          if (d >= activeFrom && d <= activeTo) {
            const trName = settings.treasuries.find(t => t.id === rec.treasuryId)?.name || 'الخزينة الرئيسية';
            rows.push({
              id: rec.id || `ADV-${emp.id}-${d}-${rec.amount}`,
              dateStr: rec.date || d,
              empId: emp.id,
              empCode: emp.fingerprintCode || emp.id,
              empName: emp.name,
              empRole: emp.role || 'موظف',
              amount: Number(rec.amount) || 0,
              treasuryId: rec.treasuryId,
              treasuryName: trName,
              note: rec.note || 'سلفة موظف',
              source: 'emp_record',
              originalRecord: rec
            });
          }
        }
      });
    });

    // Also check transactions categorized as advance if not already included
    if (selectedAdvanceEmpId === 'all') {
      branchTransactions.forEach(trx => {
        const isAdvanceTrx = trx.type === 'out' && (
          trx.category === 'staff_advance' || 
          trx.category === 'hr_advance' || 
          trx.category === 'advance' ||
          trx.expenseCategory === 'سلف' ||
          trx.expenseCategory === 'سلفة موظف' ||
          (trx.description && trx.description.includes('سلفة'))
        );
        if (isAdvanceTrx) {
          const d = (trx.date || '').split('T')[0];
          if (d >= activeFrom && d <= activeTo) {
            const alreadyExists = rows.some(r => r.id === trx.id || (r.dateStr.startsWith(d) && Math.abs(r.amount - trx.amount) < 0.01));
            if (!alreadyExists) {
              const trName = settings.treasuries.find(t => t.id === trx.treasury)?.name || trx.treasury || 'الخزينة الرئيسية';
              rows.push({
                id: trx.id,
                dateStr: trx.date,
                empId: '',
                empCode: '-',
                empName: trx.description || 'سلفة موظف',
                empRole: 'موظف',
                amount: Number(trx.amount) || 0,
                treasuryId: trx.treasury,
                treasuryName: trName,
                note: trx.description || 'سلفة موظف',
                source: 'transaction',
                originalRecord: trx
              });
            }
          }
        }
      });
    }

    rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
    const count = rows.length;
    const uniqueEmployees = new Set(rows.map(r => r.empId || r.empName)).size;

    const tMap: { [key: string]: { name: string; amount: number; count: number } } = {};
    rows.forEach(r => {
      if (!tMap[r.treasuryName]) {
        tMap[r.treasuryName] = { name: r.treasuryName, amount: 0, count: 0 };
      }
      tMap[r.treasuryName].amount += r.amount;
      tMap[r.treasuryName].count += 1;
    });

    return {
      rows,
      totalAmount,
      count,
      employeeCount: uniqueEmployees,
      treasuryBreakdown: Object.values(tMap)
    };
  }, [branchEmployees, branchTransactions, activeFrom, activeTo, selectedAdvanceEmpId, settings.treasuries]);

  // Handle Edit & Save Advance
  const handleSaveEditAdvance = async () => {
    if (!editingAdvance) return;
    const { row, amount, date, treasuryId, note } = editingAdvance;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      alert('الرجاء إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    try {
      // 1. Update in employee financial records if linked to an employee
      if (row.empId && employees) {
        const emp = employees.find(e => e.id === row.empId);
        if (emp) {
          const updatedFinancialRecords = (emp.financialRecords || []).map((rec: any) => {
            if (rec.id === row.id || (rec.date === row.dateStr && Math.abs(rec.amount - row.amount) < 0.01)) {
              return {
                ...rec,
                amount: numAmount,
                date: date || rec.date,
                treasuryId: treasuryId || rec.treasuryId,
                note: note !== undefined ? note : rec.note
              };
            }
            return rec;
          });

          const updatedEmp = { ...emp, financialRecords: updatedFinancialRecords };
          const updatedEmployees = employees.map(e => e.id === emp.id ? updatedEmp : e);
          if (setEmployees) setEmployees(updatedEmployees);
          await DB.saveEmployee(updatedEmp);
        }
      }

      // 2. Update linked transaction if it exists
      if (transactions) {
        const linkedTrx = transactions.find(t => 
          t.id === row.id || 
          (t.date && t.date.startsWith(safeSplitDate(row.dateStr)) && Math.abs(t.amount - row.amount) < 0.01 && (t.category === 'staff_advance' || t.category === 'hr_advance' || t.category === 'advance' || (t.description && t.description.includes('سلفة'))))
        );
        if (linkedTrx) {
          const updatedTrx = {
            ...linkedTrx,
            amount: numAmount,
            date: date ? `${date}T12:00:00` : linkedTrx.date,
            treasury: treasuryId || linkedTrx.treasury,
            description: note !== undefined ? note : linkedTrx.description
          };
          const updatedTransactions = transactions.map(t => t.id === linkedTrx.id ? updatedTrx : t);
          if (setTransactions) setTransactions(updatedTransactions);
          await DB.saveTransaction(updatedTrx);
        }
      }

      alert('✅ تم تعديل السلفة بنجاح');
      setEditingAdvance(null);
    } catch (err: any) {
      console.error('Error updating advance:', err);
      alert('حدث خطأ أثناء حفظ التعديل: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  // Handle Delete Advance
  const handleDeleteAdvance = async (row: any) => {
    const confirmMsg = `هل أنت متأكد من حذف سلفة الموظف (${row.empName}) بمبلغ ${row.amount} ${settings.currency}؟\nسيتم حذفها نهائياً من سجلات الموظف والمعاملات المالية.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      // 1. Remove from employee financial records
      if (row.empId && employees) {
        const emp = employees.find(e => e.id === row.empId);
        if (emp) {
          const updatedFinancialRecords = (emp.financialRecords || []).filter((rec: any) => {
            const isMatch = rec.id === row.id || (rec.date === row.dateStr && Math.abs(rec.amount - row.amount) < 0.01);
            return !isMatch;
          });

          const updatedEmp = { ...emp, financialRecords: updatedFinancialRecords };
          const updatedEmployees = employees.map(e => e.id === emp.id ? updatedEmp : e);
          if (setEmployees) setEmployees(updatedEmployees);
          await DB.saveEmployee(updatedEmp);
        }
      }

      // 2. Remove from transactions if linked
      if (transactions) {
        const linkedTrx = transactions.find(t => 
          t.id === row.id || 
          (t.date && t.date.startsWith(safeSplitDate(row.dateStr)) && Math.abs(t.amount - row.amount) < 0.01 && (t.category === 'staff_advance' || t.category === 'hr_advance' || t.category === 'advance' || (t.description && t.description.includes('سلفة'))))
        );
        if (linkedTrx) {
          const updatedTransactions = transactions.filter(t => t.id !== linkedTrx.id);
          if (setTransactions) setTransactions(updatedTransactions);
          await DB.deleteTransaction(linkedTrx.id);
        }
      }

      alert('🗑️ تم حذف السلفة بنجاح');
    } catch (err: any) {
      console.error('Error deleting advance:', err);
      alert('حدث خطأ أثناء حذف السلفة: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  const unpaidBookingsReportData = useMemo(() => {
    if (!activeFrom || !activeTo) {
      return {
        totalCount: 0,
        totalRequired: 0,
        totalPaid: 0,
        totalRemaining: 0,
        filteredBookings: []
      };
    }

    const periodBookings = branchBookings.filter(b => {
      if (b.status === 'cancelled') return false;
      const d = safeSplitDate(b.date);
      return d >= activeFrom && d <= activeTo;
    });

    const mappedBookings = periodBookings.map(b => {
      const totalAmount = Number(
        b.totalAmount ||
        (b.services || []).reduce((acc: number, s: any) => acc + Number(s.price || 0), 0) ||
        0
      );
      const paidAmount = Number(
        (b as any).paid_amount ??
        (b as any).paidAmount ??
        (b.advancePayments && b.advancePayments.length > 0
          ? b.advancePayments.reduce((acc: number, a: any) => acc + Number(a.amount || 0), 0)
          : 0)
      );
      const remaining = Math.max(0, totalAmount - paidAmount);

      const servicesSummary = (b.services || []).map((s: any) => {
        const sName = s.serviceName || s.name || 'خدمة';
        const tName = s.technicianName && s.technicianName !== 'غير محدد' ? ` (${s.technicianName})` : '';
        return `${sName}${tName}`;
      }).join('، ') || 'بدون خدمات';

      let advanceDetails = '0.00';
      if (b.advancePayments && b.advancePayments.length > 0) {
        advanceDetails = b.advancePayments.map((a: any) => {
          const tLabel = getTreasuryLabel(a.treasuryId, a.paymentMethod);
          return `${Number(a.amount || 0).toFixed(2)} (${tLabel})`;
        }).join(' + ');
      } else if (paidAmount > 0) {
        advanceDetails = `${Number(paidAmount).toFixed(2)} (${getTreasuryLabel((b as any).treasuryId, (b as any).paymentMethod)})`;
      }

      let statusLabel = 'قيد الانتظار';
      let statusColor = 'bg-amber-100 text-amber-800 border-amber-300';
      if (b.status === 'confirmed') {
        statusLabel = 'مؤكد';
        statusColor = 'bg-blue-100 text-blue-800 border-blue-300';
      } else if (b.status === 'completed') {
        statusLabel = 'مكتمل';
        statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      } else if (b.status === 'cancelled') {
        statusLabel = 'ملغي';
        statusColor = 'bg-rose-100 text-rose-800 border-rose-300';
      }

      const customerName = b.clientName || (b as any).customerName || 'عميل نقدي';
      const customerPhone = b.phone || (b as any).customerPhone || '';

      return {
        ...b,
        customerName,
        customerPhone,
        totalAmount,
        paidAmount,
        remaining,
        servicesSummary,
        advanceDetails,
        statusLabel,
        statusColor
      };
    });

    let filtered = mappedBookings;
    if (unpaidBookingsFilter === 'unpaid_only') {
      filtered = filtered.filter(b => b.remaining > 0.001);
    } else if (unpaidBookingsFilter === 'paid_only') {
      filtered = filtered.filter(b => b.remaining <= 0.001);
    }

    if (unpaidBookingsSearch.trim()) {
      const q = unpaidBookingsSearch.trim().toLowerCase();
      filtered = filtered.filter(b => 
        (b.customerName && b.customerName.toLowerCase().includes(q)) ||
        (b.customerPhone && b.customerPhone.includes(q)) ||
        (b.bookingCode && b.bookingCode.toLowerCase().includes(q)) ||
        (b.location && b.location.toLowerCase().includes(q))
      );
    }

    const totalCount = filtered.length;
    const totalRequired = filtered.reduce((acc, b) => acc + b.totalAmount, 0);
    const totalPaid = filtered.reduce((acc, b) => acc + b.paidAmount, 0);
    const totalRemaining = filtered.reduce((acc, b) => acc + b.remaining, 0);

    return {
      totalCount,
      totalRequired,
      totalPaid,
      totalRemaining,
      filteredBookings: filtered
    };
  }, [branchBookings, activeFrom, activeTo, unpaidBookingsFilter, unpaidBookingsSearch, settings.treasuries]);

  const handleExport = () => {
    if (!canExportExcel) {
      alert('⛔ عذراً، تصدير التقارير إلى Excel يتطلب صلاحية التصدير (export_excel).');
      return;
    }
    const filename = `تقرير_${activeReportType}_${activeFrom}_${activeTo}`;
    if (activeReportType === 'income') {
      const headers = ['رقم الحركة', 'التاريخ', 'النوع', 'المبلغ', 'البيان', 'الخزينة'];
      const filtered = transactions.filter(t => {
        const d = safeSplitDate(t.date);
        return d >= activeFrom && d <= activeTo && !isBookingAdvanceTransaction(t);
      });
      const rows = filtered.map(t => [
        t.id,
        t.date,
        t.type === 'in' ? 'إيراد / قبض' : 'مصروف / صرف',
        t.amount,
        t.description,
        t.treasury
      ]);
      exportToExcel(filename, 'تقرير الدخل', headers, rows);
    } else if (activeReportType === 'expenses') {
      const headers = ['رقم السند', 'التاريخ', 'المبلغ', 'التصنيف', 'البيان', 'الخزينة'];
      const filtered = transactions.filter(t => {
        const d = safeSplitDate(t.date);
        return d >= activeFrom && d <= activeTo && t.type === 'out';
      });
      const rows = filtered.map(t => [
        t.id,
        t.date,
        t.amount,
        t.expenseCategory || t.category,
        t.description,
        t.treasury
      ]);
      exportToExcel(filename, 'تقرير المصروفات', headers, rows);
    } else if (activeReportType === 'initial_cash') {
      const headers = ['رقم السند', 'التاريخ والوقت', 'تاريخ الوردية', 'المستخدم / الكاشير', 'الخزينة', 'مبلغ العهدة', 'البيان'];
      const filtered = transactions.filter(t => {
        const d = safeSplitDate(t.date);
        return d >= activeFrom && d <= activeTo && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash');
      });
      const rows = filtered.map(t => [
        t.id,
        t.date,
        t.shiftDate || safeSplitDate(t.date),
        t.userName || t.createdBy || 'الكاشير',
        settings.treasuries.find(tr => tr.id === t.treasury)?.name || t.treasury,
        t.amount,
        t.description
      ]);
      exportToExcel(filename, 'تقرير العهد الافتتاحية', headers, rows);
    } else if (activeReportType === 'tips') {
      const headers = ['التاريخ والوقت', 'رقم الفاتورة', 'اسم العميل', 'الموظف المستحق', 'طريقة الدفع', 'مبلغ الإكرامية', 'طريقة وحالة الصرف'];
      const filtered = branchTips.filter(t => {
        const d = (t.date || '').split('T')[0];
        return d >= activeFrom && d <= activeTo;
      });
      const rows = filtered.map(t => [
        t.date ? new Date(t.date).toLocaleString('ar-EG') : '-',
        t.invoiceId,
        t.clientName || 'عميل نقدي',
        t.employeeName,
        t.paymentMethod || 'بطاقة',
        t.amount,
        t.status === 'paid_out' 
          ? (t.payoutMethod === 'instant_cash' ? 'تم الصرف فوراً كاش' : 'تم الصرف لاحقاً')
          : 'معلق بانتظار الصرف'
      ]);
      exportToExcel(filename, 'تقرير البقشيش والإكراميات', headers, rows);
    } else if (activeReportType === 'overtime') {
      if (overtimeViewMode === 'summary') {
        const headers = ['كود الموظف', 'اسم الموظف', 'المسمى الوظيفي', 'الراتب الأساسي', 'أيام الإضافي', 'إجمالي الدقائق', 'إجمالي الساعات', 'المبلغ المستحق'];
        const rows = overtimeReportData.summaryRows.map(s => [
          s.empCode,
          s.empName,
          s.role,
          s.baseSalary,
          s.otDaysCount,
          s.totalOtMinutes,
          Number(s.totalOtHours || 0).toFixed(2),
          Number(s.totalOtAmount || 0).toFixed(2)
        ]);
        exportToExcel(filename, 'إجمالي_الأوفر_تايم_مجمع', headers, rows);
      } else {
        const headers = ['التاريخ', 'اليوم', 'كود الموظف', 'اسم الموظف', 'المسمى الوظيفي', 'الانصراف المجدول', 'الانصراف الفعلي', 'دقائق الإضافي', 'ساعات الإضافي', 'طريقة الحساب', 'المبلغ المستحق'];
        const rows = overtimeReportData.detailedRows.map(r => [
          r.dateStr,
          r.dayNameArabic,
          r.empCode,
          r.empName,
          r.role,
          r.scheduledCheckOut,
          r.actualCheckOut,
          r.overtimeMinutes,
          r.overtimeHours,
          r.rateLabel,
          Number(r.overtimeAmount || 0).toFixed(2)
        ]);
        exportToExcel(filename, 'تفاصيل_الأوفر_تايم_يومي', headers, rows);
      }
    } else if (activeReportType === 'advances') {
      const headers = ['رقم السند', 'التاريخ والوقت', 'كود الموظف', 'اسم الموظف', 'الوظيفة', 'الخزينة المنصرف منها', 'المبلغ المصروف', 'البيان والملاحظات'];
      const rows = advancesReportData.rows.map(r => [
        r.id,
        r.dateStr,
        r.empCode,
        r.empName,
        r.empRole,
        r.treasuryName,
        Number(r.amount || 0).toFixed(2),
        r.note
      ]);
      exportToExcel(filename, 'تقرير_سلف_الموظفين', headers, rows);
    } else if (activeReportType === 'commission_payouts') {
      const headers = ['رقم السند', 'التاريخ والوقت', 'كود الموظف', 'اسم الموظف', 'الوظيفة', 'الخزينة المنصرف منها', 'المبلغ المصروف', 'البيان والملاحظات'];
      const rows = commissionPayoutsReportData.rows.map(r => [
        r.id,
        r.dateStr,
        r.empCode,
        r.empName,
        r.empRole,
        r.treasuryName,
        Number(r.amount || 0).toFixed(2),
        r.note
      ]);
      exportToExcel(filename, 'حركة_صرف_العمولات', headers, rows);
    } else if (activeReportType === 'net_profit') {
      const headers = ['البند المالي', 'نوع التأثير', 'المبلغ المستحق', 'النسبة المئوية من الدخل', 'الملاحظات'];
      const rows = netProfitReportData.breakdownList.map(b => [
        b.label,
        b.type === 'plus' ? 'إيراد (+)' : b.type === 'minus' ? 'استقطاع / تكلفة (-)' : 'صافي النتيجة (=)',
        Number(b.amount || 0).toFixed(2),
        `${Number(b.percent || 0).toFixed(1)}%`,
        b.note
      ]);
      exportToExcel(filename, 'تقرير_صافي_الأرباح_وقائمة_الدخل', headers, rows);
    } else if (activeReportType === 'unpaid_bookings') {
      const headers = ['م', 'كود الحجز', 'مكان الحجز', 'اسم العميل', 'رقم الجوال', 'تاريخ الحجز', 'وقت الحجز', 'الخدمات والفني', 'إجمالي الحجز', 'العربون المدفوع', 'المتبقي غير المسدد', 'حالة الحجز'];
      const rows = unpaidBookingsReportData.filteredBookings.map((b: any, index: number) => [
        index + 1,
        b.bookingCode || b.id,
        b.location || 'غير محدد',
        b.customerName,
        b.customerPhone || '',
        safeSplitDate(b.date),
        b.time || '',
        b.servicesSummary,
        Number(b.totalAmount || 0).toFixed(2),
        Number(b.paidAmount || 0).toFixed(2),
        Number(b.remaining || 0).toFixed(2),
        b.statusLabel
      ]);
      exportToExcel(filename, 'تقرير_الحجوزات_غير_المسددة', headers, rows);
    } else if (activeReportType === 'sales_returns') {
      const headers = ['م', 'رقم المرتجع', 'رقم الفاتورة', 'اسم العميل', 'تاريخ المرتجع', 'طريقة الاسترداد', 'سبب الإرجاع', 'عدد الأصناف', 'المبلغ المسترد', 'الكاشير'];
      const rows = salesReturnsReportData.returns.map((r: SalesReturn, idx: number) => [
        idx + 1,
        r.returnNumber,
        r.invoiceId,
        r.clientName || 'عميل نقدي',
        safeSplitDate(r.returnDate),
        getTreasuryLabel(r.treasuryId, r.refundMethod),
        r.reason || 'أخرى',
        r.items?.length || 0,
        Number(r.totalRefundAmount || 0).toFixed(2),
        r.createdByUserName || 'المسؤول'
      ]);
      exportToExcel(filename, 'تقرير_مرتجعات_المبيعات', headers, rows);
    } else if (activeReportType === 'target_report') {
      const headers = [
        'م', 
        'كود الموظف', 
        'اسم الموظف', 
        'المسمى الوظيفي', 
        'نظام التارجت', 
        'طريقة الحساب', 
        'قيمة التارجت المطلوب', 
        'الراتب الأساسي', 
        'إجمالي العمل (الخاضع للعمولة)', 
        'المبيعات الخاضعة للتارجت', 
        'المبلغ المحسوب عليه النسبة', 
        'نسبة التارجت %', 
        'عمولة التارجت المستحقة', 
        'حالة تحقيق التارجت', 
        'المتبقي لتحقيق التارجت', 
        'مبيعات الخدمات المعفاة', 
        'عمولة الخدمات المعفاة',
        'إجمالي العمولة المستحقة'
      ];
      const rows = targetReportData.rows.map((r: any, idx: number) => [
        idx + 1,
        r.empCode,
        r.empName,
        r.empRole,
        r.targetType === 'daily' ? 'تارجت يومي' : r.targetType === 'monthly' ? 'تارجت شهري' : 'بدون تارجت',
        r.targetMethodLabel,
        Number(r.targetRequired || 0).toFixed(2),
        Number(r.baseSalary || 0).toFixed(2),
        Number(r.totalWorkSales || 0).toFixed(2),
        Number(r.targetSalesPool || 0).toFixed(2),
        Number(r.eligibleAmount || 0).toFixed(2),
        `${r.commissionRate}%`,
        Number(r.targetCommission || 0).toFixed(2),
        r.isTargetAchieved ? 'محقق للتارجت 🎯' : (r.targetType === 'none' ? 'بدون تارجت' : 'لم يحقق بعد ⏳'),
        Number(r.remainingToTarget || 0).toFixed(2),
        Number(r.exemptSales || 0).toFixed(2),
        Number(r.exemptCommission || 0).toFixed(2),
        Number(r.totalEarnedCommission || 0).toFixed(2)
      ]);
      exportToExcel(filename, 'تقرير_التارجت_والعمولات_المستهدفة', headers, rows);
    } else if (activeReportType === 'inactive_clients') {
      const headers = ['م', 'اسم العميل', 'المستوى', 'حالة الزيارة', 'رقم الموبايل', 'تاريخ آخر زيارة / تسجيل', 'مدة الانقطاع (يوم)', 'الزيارات السابقة', 'إجمالي الإنفاق السابق', 'متوسط الفاتورة', 'نقاط الولاء', 'رصيد الكاش باك', 'الملاحظات'];
      const rows = inactiveClientsReportData.inactiveClients.map((c: any, idx: number) => [
        idx + 1,
        c.name,
        c.tier === 'royal' ? 'ملكي 💎' : c.tier === 'vip' ? 'VIP 👑' : c.tier === 'distinguished' ? 'متميز 🔷' : 'قياسي ⭐',
        c.isNeverVisited ? 'مسجل جديد لم يزر بعد' : 'سبق له الزيارة',
        c.phone || '-',
        c.lastVisitDate ? c.lastVisitDate : (c.createdAtDate ? `${c.createdAtDate} (تاريخ التسجيل)` : '-'),
        c.daysAbsent,
        c.totalVisits || 0,
        Number(c.totalSpend || 0).toFixed(2),
        Number(c.avgInvoice || 0).toFixed(2),
        c.loyaltyPoints || 0,
        Number(c.cashback || 0).toFixed(2),
        c.notes || '-'
      ]);
      exportToExcel(`تقرير_العملاء_المنقطعين_${inactiveClientsReportData.thresholdDays}_يوم`, `العملاء_المنقطعين_${inactiveClientsReportData.thresholdDays}_يوم`, headers, rows);
    } else {
      const headers = ['البيان', 'القيمة'];
      const rows = [
        ['إجمالي الإيرادات', stats.income],
        ['إجمالي المصروفات', stats.expense],
        ['صافي الأرباح', stats.profit]
      ];
      exportToExcel(filename, 'الملخص المالي', headers, rows);
    }
  };


  return (
    <div className="p-4 sm:p-8 w-full h-full overflow-y-auto bg-slate-50 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">التقارير التحليلية والمالية الشاملة</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">تقارير المبيعات، عمولات الموظفين، إغلاق الوردية وتصدير البيانات</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExport}
            disabled={!canExportExcel}
            className={`${canExportExcel ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-50'} text-white px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-sm transition-all`}
            title={canExportExcel ? undefined : "لا تملك صلاحية تصدير التقارير إلى Excel"}
          >
            <Download size={16} />
            <span>تصدير إلى Excel</span>
          </button>
          <button
            onClick={() => handlePrintReceipt('report-receipt-container', true, 'a4')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Report Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 print:hidden">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-primary" />
          محددات التقرير
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">نوع التقرير</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary font-semibold text-slate-700 bg-white">
              <option value="net_profit">💎 تقرير الأرباح الصافية (معادلة صافي الربح وقائمة الدخل)</option>
              <option value="sales_returns">🔄 تقرير مرتجعات المبيعات (تفصيلي وتحليلي)</option>
              <option value="target_report">🎯 تقرير التارجت والعمولات المستهدفة للموظفين</option>
              <option value="inactive_clients">👥 تقرير العملاء المنقطعين عن الزيارة (إعادة التنشيط)</option>
              <option value="unpaid_bookings">📅 تقرير المبالغ المتبقية والغير مسددة في الحجوزات</option>
              <option value="income">تقرير الدخل التفصيلي</option>
              <option value="closing">تقرير إغلاق اليوم</option>
              <option value="employees">أعمال وعمولات الموظفين</option>
              <option value="commission_payouts">💵 حركة صرف العمولات (سندات الصرف والخزن)</option>
              <option value="advances">💸 تقرير سلف الموظفين وتفاصيلها</option>
              <option value="services_report">تقرير الخدمات</option>
              <option value="expenses">تقرير المصروفات</option>
              <option value="initial_cash">تقرير العهد الافتتاحية</option>
              <option value="tips">تقرير البقشيش والإكراميات</option>
              <option value="overtime">⏱️ تقرير ساعات العمل الإضافي (الأوفر تايم)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary font-semibold text-slate-700" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">إلى تاريخ</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary font-semibold text-slate-700" />
          </div>
          <div className="flex items-end">
            <button onClick={handleGenerate} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 rounded-lg transition-colors cursor-pointer">
              عرض التقرير
            </button>
          </div>
        </div>

        {/* Sub-filters for Target Report */}
        {reportType === 'target_report' && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">بحث بالاسم أو الكود:</label>
              <div className="relative">
                <input
                  type="text"
                  value={targetReportSearch}
                  onChange={(e) => setTargetReportSearch(e.target.value)}
                  placeholder="ابحث عن موظف..."
                  className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                />
                <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                {targetReportSearch && (
                  <button
                    type="button"
                    onClick={() => setTargetReportSearch('')}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">دورة / نظام التارجت:</label>
              <select
                value={targetTypeFilter}
                onChange={(e) => setTargetTypeFilter(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
              >
                <option value="all">🎯 جميع الأنظمة (يومي وشهري وبدون)</option>
                <option value="daily">📅 تارجت يومي فقط</option>
                <option value="monthly">🗓️ تارجت شهري فقط</option>
                <option value="none">⚪ بدون تارجت</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">حالة تحقيق التارجت:</label>
              <select
                value={targetStatusFilter}
                onChange={(e) => setTargetStatusFilter(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
              >
                <option value="all">الكل (المحققون وغير المحققين)</option>
                <option value="achieved">🎯 محقق للتارجت فقط</option>
                <option value="not_achieved">⏳ لم يحقق التارجت بعد</option>
              </select>
            </div>
          </div>
        )}

        {/* Sub-filters for Advances Report */}
        {reportType === 'advances' && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">فلترة حسب الموظف:</label>
              <select
                value={selectedAdvanceEmpId}
                onChange={(e) => setSelectedAdvanceEmpId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-primary"
              >
                <option value="all">👥 جميع الموظفين (الكل)</option>
                {branchEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role || 'موظف'})</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <span className="text-xs text-slate-500 font-semibold">
                يمكنك معاينة سلف الفترة وتعديل أو حذف أي سلفة مباشرة في الجدول أدناه قبل الطباعة والتصدير.
              </span>
            </div>
          </div>
        )}

        {/* Sub-filters for Overtime Report */}
        {reportType === 'overtime' && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">طريقة عرض التقرير:</label>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setOvertimeViewMode('summary')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    overtimeViewMode === 'summary' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📊 مجمع حسب الموظف
                </button>
                <button
                  type="button"
                  onClick={() => setOvertimeViewMode('detailed')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    overtimeViewMode === 'detailed' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📅 تفصيلي يوم بيوم
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">تحديد موظف محدد:</label>
              <select
                value={selectedOvertimeEmpId}
                onChange={(e) => setSelectedOvertimeEmpId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
              >
                <option value="all">👥 جميع الموظفين</option>
                {branchEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role || 'موظف'})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Sub-filters for Unpaid Bookings Report */}
        {reportType === 'unpaid_bookings' && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">حالة السداد:</label>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setUnpaidBookingsFilter('all')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    unpaidBookingsFilter === 'all' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setUnpaidBookingsFilter('unpaid_only')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    unpaidBookingsFilter === 'unpaid_only' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  غير مسدد فقط
                </button>
                <button
                  type="button"
                  onClick={() => setUnpaidBookingsFilter('paid_only')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    unpaidBookingsFilter === 'paid_only' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  مسدد بالكامل
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">بحث فوري:</label>
              <input
                type="text"
                value={unpaidBookingsSearch}
                onChange={(e) => setUnpaidBookingsSearch(e.target.value)}
                placeholder="بحث بالاسم، رقم الجوال، كود الحجز، مكان الحجز..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* Sub-filters for Inactive Clients Report */}
        {reportType === 'inactive_clients' && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in">
            {/* Days threshold, Chips & Reset */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-rose-50/80 p-3.5 rounded-2xl border border-rose-200/80">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-rose-950 whitespace-nowrap flex items-center gap-1.5">
                    <Clock size={16} className="text-rose-600" />
                    <span>معيار أيام الانقطاع:</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={inactiveDaysFilter}
                      onChange={(e) => setInactiveDaysFilter(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 bg-white border border-rose-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-black text-rose-950 text-center outline-none focus:border-rose-600 shadow-2xs"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-slate-400 font-bold pointer-events-none">يوم</span>
                  </div>
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[30, 45, 60, 90, 120].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setInactiveDaysFilter(d)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        inactiveDaysFilter === d
                          ? 'bg-rose-600 text-white shadow-2xs font-black'
                          : 'bg-white hover:bg-rose-100/70 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {d} يوم
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset to Settings Default */}
              <button
                type="button"
                onClick={() => setInactiveDaysFilter(defaultInactiveDays)}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="استعادة القيمة المسجلة في الإعدادات العامة"
              >
                <RotateCcw size={13} className="text-rose-600" />
                <span>الافتراضي من الإعدادات ({defaultInactiveDays} يوم)</span>
              </button>
            </div>

            {/* Visit Status Filter + Search + Sort */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Visit Status Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">تصفية حالة العميل:</label>
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setInactiveStatusFilter('all')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      inactiveStatusFilter === 'all' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setInactiveStatusFilter('visited')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      inactiveStatusFilter === 'visited' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    سبق لهم الزيارة وانقطعوا
                  </button>
                  <button
                    type="button"
                    onClick={() => setInactiveStatusFilter('never_visited')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      inactiveStatusFilter === 'never_visited' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    مسجلين جدد ولم يزوروا بعد
                  </button>
                </div>
              </div>

              {/* Text Search */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">بحث في قائمة العملاء:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={inactiveClientsSearch}
                    onChange={(e) => setInactiveClientsSearch(e.target.value)}
                    placeholder="ابحث بالاسم، أو رقم الجوال، أو الملاحظات..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-rose-500 shadow-2xs pr-8"
                  />
                  <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
                </div>
              </div>

              {/* Sort Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ترتيب العملاء:</label>
                <select
                  value={inactiveSortBy}
                  onChange={(e: any) => setInactiveSortBy(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-rose-500 shadow-2xs"
                >
                  <option value="days_desc">الأطول غياباً وانقطاعاً أولاً (تنازلي)</option>
                  <option value="days_asc">الأحدث انقطاعاً أولاً (تصاعدي)</option>
                  <option value="spend_desc">الأعلى إنفاقاً تاريخياً أولاً (كبار العملاء)</option>
                  <option value="visits_desc">الأكثر زيارات سابقة أولاً</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Summary */}
      {isGenerated && activeReportType === 'net_profit' ? (
        <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Main Profit Equation Visual Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black mb-2">
                  <span>معادلة صافي الربح المعتمدة</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">تحليل صافي الأرباح وقائمة الدخل</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl font-medium leading-relaxed">
                  صافي الربح = إجمالي الدخل من الفواتير - جميع المصروفات - الرواتب - السلف - (المسدد في المشتريات + دفعات الموردين) - عمولات الموظفين
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-center shrink-0">
                <p className="text-xs text-slate-300 font-bold mb-0.5">صافي الربح الفعلي</p>
                <div className={`text-2xl sm:text-3xl font-black font-mono ${netProfitReportData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netProfitReportData.netProfit >= 0 ? '+' : ''}{Number(netProfitReportData.netProfit || 0).toFixed(2)}
                  <span className="text-xs font-normal text-slate-300 mr-1.5">{settings.currency}</span>
                </div>
                <div className="text-[11px] font-bold text-slate-300 mt-1">
                  هامش الربح: <span className={netProfitReportData.netProfit >= 0 ? 'text-emerald-300 font-mono' : 'text-rose-300 font-mono'}>{Number(netProfitReportData.profitMargin || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 7 KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* 1. Invoiced Income (+) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-emerald-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">1. إجمالي الدخل من الفواتير (+)</p>
                <h4 className="text-xl font-black text-emerald-600 font-mono">
                  {Number(netProfitReportData.grossIncome || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <div className="text-[10px] text-slate-400 font-bold mt-1 space-y-0.5">
                  <p>{netProfitReportData.periodInvoicesCount} فاتورة مسددة</p>
                  {netProfitReportData.totalCashbackUsed > 0 && (
                    <p className="text-purple-600 font-mono">
                      (خزائن: {Number(netProfitReportData.netTreasurySales || 0).toFixed(0)} + كاش باك: {Number(netProfitReportData.totalCashbackUsed || 0).toFixed(0)})
                    </p>
                  )}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp size={22} />
              </div>
            </div>

            {/* 2. All Expenses (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-rose-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">2. جميع المصروفات (-)</p>
                <h4 className="text-xl font-black text-rose-600 font-mono">
                  {Number(netProfitReportData.totalExpenses || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">تشغيلية ونثرية وإيجار</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <TrendingDown size={22} />
              </div>
            </div>

            {/* 3. Salaries (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-blue-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">3. الرواتب المصروفة (-)</p>
                <h4 className="text-xl font-black text-blue-600 font-mono">
                  {Number(netProfitReportData.totalSalaries || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">مسيرات الرواتب الأساسية</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <DollarSign size={22} />
              </div>
            </div>

            {/* 4. Advances (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-amber-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">4. سلف الموظفين (-)</p>
                <h4 className="text-xl font-black text-amber-600 font-mono">
                  {Number(netProfitReportData.totalAdvances || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">السلف المنصرفة للفترة</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Wallet size={22} />
              </div>
            </div>

            {/* 5. Purchases Paid (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-purple-500 flex justify-between items-center">
              <div className="flex-1">
                <p className="text-slate-500 text-xs font-bold mb-1">5. المسدد في فواتير المشتريات (-)</p>
                <h4 className="text-xl font-black text-purple-600 font-mono">
                  {Number(netProfitReportData.totalPurchasesPaid || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {Object.keys(netProfitReportData.purchasesByMethod).length > 0 ? (
                    Object.entries(netProfitReportData.purchasesByMethod).map(([m, amt]) => (
                      <span key={m} className="bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-200">
                        {getTreasuryLabel(m)}: {Number(amt || 0).toFixed(0)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">إجمالي الفواتير: {Number(netProfitReportData.totalPurchasesAmount || 0).toFixed(0)}</span>
                  )}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 mr-2">
                <ShoppingCart size={22} />
              </div>
            </div>

            {/* 6. Supplier Payments (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500 flex justify-between items-center">
              <div className="flex-1">
                <p className="text-slate-500 text-xs font-bold mb-1">6. سندات دفعات وسداد الموردين (-)</p>
                <h4 className="text-xl font-black text-indigo-600 font-mono">
                  {Number(netProfitReportData.totalSupplierPayments || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {Object.keys(netProfitReportData.supplierPaymentsByMethod).length > 0 ? (
                    Object.entries(netProfitReportData.supplierPaymentsByMethod).map(([m, amt]) => (
                      <span key={m} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                        {getTreasuryLabel(m)}: {Number(amt || 0).toFixed(0)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">عدد السندات: {netProfitReportData.periodSupplierPayments.length}</span>
                  )}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 mr-2">
                <Truck size={22} />
              </div>
            </div>

            {/* 7. Employee Commissions (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-teal-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">7. عمولات الموظفين (-)</p>
                <h4 className="text-xl font-black text-teal-600 font-mono">
                  {Number(netProfitReportData.totalCommissions || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">عمولات الخدمات والمنتجات</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <CheckCircle2 size={22} />
              </div>
            </div>

            {/* 7.5 Cashback Used Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-fuchsia-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">المسدد كاش باك 🎁</p>
                <h4 className="text-xl font-black text-fuchsia-600 font-mono">
                  {Number(netProfitReportData.totalCashbackUsed || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">تسوية من رصيد العملاء • فارق الخزائن</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-fuchsia-50 flex items-center justify-center text-fuchsia-600">
                <Coins size={22} />
              </div>
            </div>

            {/* 8. Total Deductions (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-slate-700 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">إجمالي التكاليف والاستقطاعات</p>
                <h4 className="text-xl font-black text-slate-800 font-mono">
                  {Number(netProfitReportData.totalDeductions || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">مجموع البنود (المصروفات + الرواتب + السلف + المشتريات + الموردين + العمولات)</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Clock size={22} />
              </div>
            </div>

            {/* 8. Net Profit Result (=) */}
            <div className={`p-5 rounded-2xl border shadow-md border-r-4 flex justify-between items-center ${netProfitReportData.netProfit >= 0 ? 'bg-emerald-50/50 border-emerald-300 border-r-emerald-600' : 'bg-rose-50/50 border-rose-300 border-r-rose-600'}`}>
              <div>
                <p className={`text-xs font-bold mb-1 ${netProfitReportData.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>صافي الربح المحقق (=)</p>
                <h4 className={`text-xl font-black font-mono ${netProfitReportData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {Number(netProfitReportData.netProfit || 0).toFixed(2)} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
                </h4>
                <p className={`text-[10px] font-bold mt-1 ${netProfitReportData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {netProfitReportData.netProfit >= 0 ? '✅ ربح تشغيلي إيجابي' : '⚠️ عجز / خسارة تشغيلية'}
                </p>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${netProfitReportData.netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                <DollarSign size={22} />
              </div>
            </div>

          </div>

        </div>
      ) : isGenerated && activeReportType === 'unpaid_bookings' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-blue-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي الحجوزات</p>
              <h4 className="text-2xl font-black text-slate-800 font-mono">
                {unpaidBookingsReportData.totalCount} <span className="text-xs font-normal text-slate-400">حجز</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Calendar size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي المبالغ المطلوبة</p>
              <h4 className="text-2xl font-black text-indigo-700 font-mono">
                {Number(unpaidBookingsReportData.totalRequired || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <DollarSign size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-emerald-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي العربون المحصل</p>
              <h4 className="text-2xl font-black text-emerald-600 font-mono">
                {Number(unpaidBookingsReportData.totalPaid || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-rose-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">المتبقي غير المسدد</p>
              <h4 className="text-2xl font-black text-rose-600 font-mono">
                {Number(unpaidBookingsReportData.totalRemaining || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle size={22} />
            </div>
          </div>
        </div>
      ) : isGenerated && activeReportType === 'inactive_clients' ? (
        <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Gradient Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-rose-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black mb-2">
                  <UserX size={14} className="text-rose-400" />
                  <span>نظام استعادة وتنشيط العملاء (Client Retention)</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  تقرير العملاء المنقطعين عن الزيارة (Inactive Clients Retention)
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl font-medium leading-relaxed">
                  حصر العملاء الذين انقطعوا عن زيارة الصالون لمدة ({inactiveClientsReportData.thresholdDays} يوم) فأكثر لمتابعتهم وإرسال عروض ترويجية لإعادة تنشيطهم.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center">
                  <div className="text-[11px] text-slate-300 font-bold mb-0.5">معيار الانقطاع</div>
                  <div className="text-xl font-mono font-black text-white">
                    {inactiveClientsReportData.thresholdDays} <span className="text-xs font-normal text-slate-300">يوم</span>
                  </div>
                </div>
                <div className="bg-rose-500/20 backdrop-blur-md px-5 py-3 rounded-2xl border border-rose-400/30 text-center">
                  <div className="text-[11px] text-rose-200 font-bold mb-0.5">المنقطعون / الإجمالي</div>
                  <div className="text-xl font-mono font-black text-rose-300">
                    {inactiveClientsReportData.inactiveCount} <span className="text-xs font-normal text-rose-200">({inactiveClientsReportData.inactiveRate}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* 1. إجمالي العملاء المنقطعين (حد أحمر) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-rose-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">إجمالي العملاء المنقطعين</p>
                <h4 className="text-2xl font-black text-rose-700 font-mono">
                  {inactiveClientsReportData.inactiveCount} <span className="text-xs font-normal text-slate-400">عميل</span>
                </h4>
                <p className="text-[10px] text-rose-600 font-bold mt-1">
                  نسبة الغياب: {inactiveClientsReportData.inactiveRate}% من {inactiveClientsReportData.totalClientsCount} عميل
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shadow-xs">
                <UserX size={22} />
              </div>
            </div>

            {/* 2. متوسط فترة الغياب والانقطاع (حد كهرماني) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-amber-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">متوسط فترة الغياب والانقطاع</p>
                <h4 className="text-2xl font-black text-amber-700 font-mono">
                  {inactiveClientsReportData.avgDaysAbsent} <span className="text-xs font-normal text-slate-400">يوم</span>
                </h4>
                <p className="text-[10px] text-amber-600 font-bold mt-1">
                  الحد الأدنى المعتمد: {inactiveClientsReportData.thresholdDays} يوم
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-xs">
                <Clock size={22} />
              </div>
            </div>

            {/* 3. إجمالي إنفاقهم التاريخي (حد أخضر) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-emerald-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">إجمالي إنفاقهم التاريخي</p>
                <h4 className="text-2xl font-black text-emerald-700 font-mono">
                  {Number(inactiveClientsReportData.totalPreviousSpend || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">المبيعات السابقة المعرضة للفقدان</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-xs">
                <DollarSign size={22} />
              </div>
            </div>

            {/* 4. عملاء VIP ومميزين منقطعين (حد بنفسجي) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-purple-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">عملاء VIP ومميزين منقطعين</p>
                <h4 className="text-2xl font-black text-purple-700 font-mono">
                  {inactiveClientsReportData.vipInactiveCount || 0} <span className="text-xs font-normal text-slate-400">عميل</span>
                </h4>
                <p className="text-[10px] text-purple-600 font-bold mt-1">أولوية قصوى للتواصل وإعادة التنشيط</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-xs">
                <Award size={22} />
              </div>
            </div>
          </div>
        </div>
      ) : isGenerated && activeReportType === 'target_report' ? (
        <div className="space-y-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-black mb-2 border border-indigo-400/30">
                  <Target size={14} /> لوحة مؤشرات التارجت والعمولات المستهدفة
                </span>
                <h3 className="text-2xl font-black text-white">متابعة الأداء البيعي والتحفيزي لفريق العمل</h3>
                <p className="text-indigo-200 text-xs mt-1">
                  الفترة: {activeFrom} إلى {activeTo} • {settings.salonName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-center">
                  <div className="text-[11px] text-indigo-200 font-bold mb-0.5">المحققون للتارجت</div>
                  <div className="text-xl font-mono font-black text-emerald-300">
                    {targetReportData.achievedCount} / {targetReportData.totalTargetEmployees}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* 1. إجمالي مبيعات التارجت الخاضعة */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">المبيعات الخاضعة للتارجت</p>
                <h4 className="text-2xl font-black text-indigo-700 font-mono">
                  {Number(targetReportData.totalTargetSales || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">الوعاء البيعي المؤهل للتارجت</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-xs">
                <DollarSign size={22} />
              </div>
            </div>

            {/* 2. إجمالي عمولات التارجت المستحقة */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-emerald-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">عمولات التارجت المستحقة</p>
                <h4 className="text-2xl font-black text-emerald-700 font-mono">
                  {Number(targetReportData.totalTargetCommissions || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">المكافآت المحققة لليومي والشهري</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-xs">
                <Award size={22} />
              </div>
            </div>

            {/* 3. مبيعات وعمولات الخدمات المعفاة */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-amber-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">عمولات الخدمات المعفاة (فورية)</p>
                <h4 className="text-2xl font-black text-amber-700 font-mono">
                  {Number(targetReportData.totalExemptCommissions || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-amber-600 font-bold mt-1">
                  مبيعات معفاة: {Number(targetReportData.totalExemptSales || 0).toFixed(0)} {settings.currency}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-xs">
                <Sparkles size={22} />
              </div>
            </div>

            {/* 4. نسبة تحقيق التارجت */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-cyan-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">نسبة نجاح التارجت</p>
                <h4 className="text-2xl font-black text-cyan-700 font-mono">
                  {targetReportData.totalTargetEmployees > 0 
                    ? Math.round((targetReportData.achievedCount / targetReportData.totalTargetEmployees) * 100) 
                    : 0}%
                </h4>
                <p className="text-[10px] text-cyan-600 font-bold mt-1">
                  {targetReportData.achievedCount} من {targetReportData.totalTargetEmployees} موظف حققوا الهدف
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 shadow-xs">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </div>
        </div>
      ) : isGenerated && activeReportType === 'advances' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-rose-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي مبالغ السلف</p>
              <h4 className="text-2xl font-black text-rose-600 font-mono">
                {Number(advancesReportData.totalAmount || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <DollarSign size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">عدد السلف المنصرفة</p>
              <h4 className="text-2xl font-black text-indigo-600 font-mono">
                {advancesReportData.count} <span className="text-xs font-normal text-slate-400">سند</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Wallet size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-blue-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">الموظفون المستفيدون</p>
              <h4 className="text-2xl font-black text-blue-600 font-mono">
                {advancesReportData.employeeCount} <span className="text-xs font-normal text-slate-400">موظف</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <User size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-purple-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">متوسط السلفة</p>
              <h4 className="text-2xl font-black text-purple-600 font-mono">
                {advancesReportData.count > 0 ? (Number(advancesReportData.totalAmount || 0) / advancesReportData.count).toFixed(2) : '0.00'} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Coins size={22} />
            </div>
          </div>
        </div>
      ) : isGenerated && activeReportType === 'overtime' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي ساعات الإضافي</p>
              <h4 className="text-2xl font-black text-indigo-600 font-mono">
                {Number(overtimeReportData.totalHours || 0).toFixed(1)} <span className="text-xs font-normal text-slate-400">ساعة</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-emerald-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي المبالغ المستحقة</p>
              <h4 className="text-2xl font-black text-emerald-600 font-mono">
                {Number(overtimeReportData.totalAmount || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-blue-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">الموظفون المستحقون</p>
              <h4 className="text-2xl font-black text-blue-600 font-mono">
                {overtimeReportData.totalEmployees} <span className="text-xs font-normal text-slate-400">موظف</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-purple-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">عدد مرات العمل الإضافي</p>
              <h4 className="text-2xl font-black text-purple-600 font-mono">
                {overtimeReportData.otCount} <span className="text-xs font-normal text-slate-400">وردية</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <TrendingUp size={22} />
            </div>
          </div>
        </div>
      ) : isGenerated && activeReportType === 'tips' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-emerald-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي البقشيش المحصل</p>
              <h4 className="text-2xl font-black text-emerald-600 font-mono">
                {Number(stats.totalTips || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-teal-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">المنصرف فوراً (كاش)</p>
              <h4 className="text-2xl font-black text-teal-600 font-mono">
                {Number(stats.instantCashTips || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-amber-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">المجمع المؤجل (معلق)</p>
              <h4 className="text-2xl font-black text-amber-600 font-mono">
                {Number(stats.pendingTips || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">عدد عمليات البقشيش</p>
              <h4 className="text-2xl font-black text-slate-800 font-mono">
                {stats.tipsCount} <span className="text-xs font-normal text-slate-400">عملية</span>
              </h4>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Wallet size={22} />
            </div>
          </div>
        </div>
      ) : isGenerated && activeReportType === 'initial_cash' ? (

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-amber-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-sm font-bold mb-2">مجموع مبالغ العهدة الافتتاحية</p>
              <h4 className="text-3xl font-extrabold text-amber-600 font-mono">
                {Number(stats.totalCustody || 0).toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <DollarSign size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-sm font-bold mb-2">عدد الورديات المفتوحة بالعهدة</p>
              <h4 className="text-3xl font-extrabold text-slate-800 font-mono">
                {stats.custodyCount} <span className="text-base font-normal text-slate-400">وردية</span>
              </h4>
            </div>
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Calendar size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-teal-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-sm font-bold mb-2">متوسط العهدة لكل وردية</p>
              <h4 className="text-3xl font-extrabold text-teal-700 font-mono">
                {Number(stats.custodyAvg || 0).toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
              <DollarSign size={24} />
            </div>
          </div>
        </div>
      ) : isGenerated && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-emerald-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-sm font-bold mb-2">إجمالي الإيرادات</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{Number(stats.income || 0).toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span></h4>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-red-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-sm font-bold mb-2">إجمالي المصروفات</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{Number(stats.expense || 0).toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span></h4>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <TrendingDown size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-blue-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-sm font-bold mb-2">صافي الربح</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{Number(stats.profit || 0).toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span></h4>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <DollarSign size={24} />
            </div>
          </div>
        </div>
      )}

      {/* Report Data Placeholder / Table */}
      {!isGenerated ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-slate-400">
          <FileBarChart size={48} className="mb-4 opacity-50 text-slate-300" />
          <p className="font-bold">يرجى تحديد المعاملات والضغط على "عرض التقرير" لإنشاء البيانات</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <ReportTable 
            reportType={activeReportType} 
            activeFrom={activeFrom} 
            activeTo={activeTo} 
            transactions={branchTransactions} 
            invoices={branchInvoices} 
            branchInvoices={branchInvoices}
            settings={settings}
            employees={employees}
            services={services}
            products={products}
            fingerprintLogs={effectiveFingerprintLogs}
            branchTips={branchTips}
            overtimeReportData={overtimeReportData}
            overtimeViewMode={overtimeViewMode}
            setOvertimeViewMode={setOvertimeViewMode}
            selectedOvertimeEmpId={selectedOvertimeEmpId}
            setSelectedOvertimeEmpId={setSelectedOvertimeEmpId}
            stats={stats}
            netProfitReportData={netProfitReportData}
            commissionPayoutsReportData={commissionPayoutsReportData}
            suppliers={suppliers}
            activeUserName={activeUserName}
            refreshLogs={refreshLogs}
            isRefreshingLogs={isRefreshingLogs}
            advancesReportData={advancesReportData}
            selectedAdvanceEmpId={selectedAdvanceEmpId}
            branchEmployees={branchEmployees}
            editingAdvance={editingAdvance}
            setEditingAdvance={setEditingAdvance}
            handleDeleteAdvance={handleDeleteAdvance}
            handleSaveEditAdvance={handleSaveEditAdvance}
            getTreasuryLabel={getTreasuryLabel}
            getSupplierName={getSupplierName}
            canExportExcel={canExportExcel}
            unpaidBookingsReportData={unpaidBookingsReportData}
            unpaidBookingsFilter={unpaidBookingsFilter}
            setUnpaidBookingsFilter={setUnpaidBookingsFilter}
            unpaidBookingsSearch={unpaidBookingsSearch}
            setUnpaidBookingsSearch={setUnpaidBookingsSearch}
            salesReturnsReportData={salesReturnsReportData}
            branchSalesReturns={branchSalesReturns}
            voucherModalReturn={voucherModalReturn}
            setVoucherModalReturn={setVoucherModalReturn}
            inactiveClientsReportData={inactiveClientsReportData}
            inactiveClientsSearch={inactiveClientsSearch}
            setInactiveClientsSearch={setInactiveClientsSearch}
            targetReportData={targetReportData}
            targetReportSearch={targetReportSearch}
            setTargetReportSearch={setTargetReportSearch}
            targetTypeFilter={targetTypeFilter}
            setTargetTypeFilter={setTargetTypeFilter}
            targetStatusFilter={targetStatusFilter}
            setTargetStatusFilter={setTargetStatusFilter}
          />
        </div>
      )}

    </div>
  );
}

function ReportTable({ 
  reportType, 
  activeFrom, 
  activeTo, 
  canExportExcel = true,
  transactions, 
  invoices, 
  branchInvoices,
  settings, 
  employees, 
  services, 
  products,
  fingerprintLogs,
  branchTips,
  overtimeReportData,
  overtimeViewMode,
  setOvertimeViewMode,
  selectedOvertimeEmpId,
  setSelectedOvertimeEmpId,
  stats,
  netProfitReportData,
  commissionPayoutsReportData,
  suppliers = [],
  activeUserName = 'المسؤول',
  refreshLogs,
  isRefreshingLogs = false,
  advancesReportData,
  selectedAdvanceEmpId = 'all',
  branchEmployees = [],
  editingAdvance,
  setEditingAdvance,
  handleDeleteAdvance,
  handleSaveEditAdvance,
  getTreasuryLabel: customGetTreasuryLabel,
  getSupplierName: customGetSupplierName,
  salesReturnsReportData,
  branchSalesReturns = [],
  voucherModalReturn,
  setVoucherModalReturn,
  inactiveClientsReportData,
  inactiveClientsSearch = '',
  setInactiveClientsSearch,
  targetReportData,
  targetReportSearch = '',
  setTargetReportSearch,
  targetTypeFilter = 'all',
  setTargetTypeFilter,
  targetStatusFilter = 'all',
  setTargetStatusFilter
}: any) {
  const start = new Date(activeFrom);
  const end = new Date(activeTo);
  end.setHours(23, 59, 59, 999);

  const getTreasuryLabel = customGetTreasuryLabel || ((tId?: string, paymentMethod?: string) => {
    if (tId) {
      const found = settings?.treasuries?.find((t: any) => t.id === tId);
      if (found) return found.name;
      if (tId === 'cash') return 'كاش (الدرج)';
      if (tId === 'card') return 'شبكة / فيزا';
      if (tId === 'main') return 'الخزنة الرئيسية';
    }
    if (paymentMethod === 'cash') return 'نقدي (كاش)';
    if (paymentMethod === 'card') return 'شبكة / فيزا';
    if (paymentMethod === 'bank' || paymentMethod === 'transfer') return 'تحويل بنكي';
    return tId || paymentMethod || 'كاش';
  });

  const getSupplierName = customGetSupplierName || ((sId?: string) => {
    if (!sId) return 'مورد عام';
    const s = (suppliers || []).find((item: any) => item.id === sId);
    return s ? s.name : sId;
  });

  const getDisplayCategory = (t: Transaction) => {
    if (t.category === 'expense' && t.expenseCategory) return t.expenseCategory;
    switch (t.category) {
    
      case 'sales': return 'مبيعات';
      case 'deposit': return 'إيداع';
      case 'expense': return 'مصروفات';
      case 'staff_advance': return 'سلفة موظف';
      case 'booking_advance': return 'مقدم حجز';
      case 'transfer': return 'تحويل';
      case 'عهدة افتتاحية': return 'عهدة افتتاحية';
      default: return t.category;
    }
  };

  const getTreasuryName = (id: string) => {
    return settings.treasuries.find((t: any) => t.id === id)?.name || id;
  };

  
  if (reportType === 'income') {
    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="w-full flex flex-col items-center py-6 bg-slate-100/90 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 w-full px-6 mb-4 print:hidden">
          <div className="text-xs text-slate-600 font-bold flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span>👈 يمكنك التمرير أفقياً لرؤية باقي أعمدة التقرير كاملة (اليسار)</span>
          </div>
          <button 
            onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-income-receipt', true)); }} 
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Printer size={16} /> طباعة التقرير (A4 بالعرض)
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="w-full overflow-x-auto px-4 pb-4">
          <div className="w-max min-w-full mx-auto bg-white shadow-xl rounded-xl p-4 border border-slate-200">
            <IncomeReportReceipt 
              settings={settings}
              transactions={transactions.filter(t => !isBookingAdvanceTransaction(t))}
              invoices={branchInvoices || invoices || []}
              startDate={activeFrom}
              endDate={activeTo}
              dateLabel={dateLabel}
              userName={activeUserName}
            />
          </div>
        </div>
      </div>
    );
  }

  if (reportType === 'initial_cash') {
    const custodyTrxs = transactions.filter((t: Transaction) => {
      const tDateStr = safeSplitDate(t.date);
      return tDateStr >= activeFrom && tDateStr <= activeTo && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash');
    });

    const totalCustody = custodyTrxs.reduce((sum, t) => sum + t.amount, 0);
    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="p-6 space-y-6">
        {/* Print Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-amber-50/70 border border-amber-200 p-4 rounded-2xl">
          <div>
            <h4 className="font-extrabold text-sm text-amber-900">كشف العهد الافتتاحية خلال الفترة ({dateLabel})</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              إجمالي مبالغ العهد المسجلة: <span className="font-bold font-mono text-slate-900">{Number(totalCustody || 0).toFixed(2)} {settings.currency}</span> ({custodyTrxs.length} وردية)
            </p>
          </div>
          <button 
            onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-custody-receipt')); }} 
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Printer size={15} /> طباعة إيصال العهدة
          </button>
        </div>

        {/* Dedicated Custody Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                <th className="py-3 px-4">رقم السند</th>
                <th className="py-3 px-4">تاريخ الوردية</th>
                <th className="py-3 px-4">وقت التسجيل</th>
                <th className="py-3 px-4">المستخدم / الكاشير</th>
                <th className="py-3 px-4">الخزينة المستلمة</th>
                <th className="py-3 px-4">البيان</th>
                <th className="py-3 px-4 text-left">مبلغ العهدة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {custodyTrxs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-bold">
                    لا توجد عهد افتتاحية مسجلة خلال هذه الفترة
                  </td>
                </tr>
              ) : (
                custodyTrxs.map((t: Transaction) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{t.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.shiftDate || safeSplitDate(t.date)}</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{new Date(t.date).toLocaleTimeString('ar-SA')}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-md">
                        {t.userName || t.createdBy || 'الكاشير'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">{getTreasuryName(t.treasury)}</td>
                    <td className="py-3 px-4 text-slate-500">{t.description || 'عهدة افتتاحية لبدء الوردية'}</td>
                    <td className="py-3 px-4 text-left font-mono font-black text-amber-600 text-sm">
                      +{Number(t.amount || 0).toFixed(2)} {settings.currency}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {custodyTrxs.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={6} className="py-3 px-4 text-left">مجموع مبالغ العهدة الافتتاحية للفترة:</td>
                  <td className="py-3 px-4 text-left font-mono text-amber-700 text-base">
                    {Number(totalCustody || 0).toFixed(2)} {settings.currency}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Hidden thermal print receipt container */}
        <div className="hidden">
          <CustodyReportReceipt 
            settings={settings}
            transactions={custodyTrxs}
            dateLabel={dateLabel}
            userName={activeUserName}
          />
        </div>
      </div>
    );
  }

  
  if (reportType === 'expenses') {
    const filteredTransactions = transactions.filter((t: Transaction) => {
      const tDateStr = safeSplitDate(t.date);
      return tDateStr >= activeFrom && tDateStr <= activeTo && t.type === 'out' && t.category !== 'transfer';
    });

    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="flex flex-col items-center py-8 bg-slate-200">
        <button onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-expenses-receipt')); }} className="mb-6 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 print:hidden">
          <Printer size={18} /> طباعة التقرير
        </button>
        <div className="bg-white shadow-xl">
          <ExpensesReportReceipt 
            settings={settings}
            transactions={filteredTransactions}
            dateLabel={dateLabel}
            userName={activeUserName}
          />
        </div>
      </div>
    );
  }

  if (reportType === 'closing') {
    const filteredTransactions = transactions.filter((t: Transaction) => {
      const tDateStr = safeSplitDate(t.date); return tDateStr >= activeFrom && tDateStr <= activeTo;
    });
    const filteredInvoices = invoices.filter((i: Invoice) => {
      const iDateStr = safeSplitDate(i.date); return iDateStr >= activeFrom && iDateStr <= activeTo;
    });

    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="flex flex-col items-center py-8 bg-slate-200">
        <button onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-receipt')); }} className="mb-6 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 print:hidden">
          <Printer size={18} /> طباعة التقرير
        </button>
        <div className="bg-white shadow-xl">
          <ClosingReportReceipt 
            settings={settings} 
            transactions={filteredTransactions} 
            invoices={filteredInvoices} 
            dateLabel={dateLabel} 
            userName={activeUserName}
            employees={employees}
            fingerprintLogs={fingerprintLogs}
          />
        </div>
      </div>
    );
  }

  
  if (reportType === 'services_report') {
    const filteredInvoices = invoices.filter((i: Invoice) => {
      const iDateStr = safeSplitDate(i.date); return iDateStr >= activeFrom && iDateStr <= activeTo;
    });

    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="flex flex-col items-center py-8 bg-slate-200">
        <button onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-services-receipt')); }} className="mb-6 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 print:hidden">
          <Printer size={18} /> طباعة التقرير
        </button>
        <div className="bg-white shadow-xl">
          <ServicesReportReceipt 
            settings={settings}
            invoices={filteredInvoices}
            dateLabel={dateLabel}
            userName={activeUserName}
          />
        </div>
      </div>
    );
  }

  
  if (reportType === 'commission_payouts') {
    const data = commissionPayoutsReportData || { rows: [], totalAmount: 0, count: 0, treasuryBreakdown: [] };
    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="p-6 space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-amber-500/10 border border-amber-200 p-4 rounded-2xl">
          <div>
            <h4 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
              <Coins size={18} className="text-amber-600" />
              <span>كشف وسجل حركة صرف عمولات الموظفين ({dateLabel})</span>
            </h4>
            <p className="text-xs text-amber-800 mt-0.5">
              إجمالي العمولات المصروفة: <strong className="font-mono text-slate-900 font-bold">{Number(data.totalAmount || 0).toFixed(2)} {settings.currency}</strong> ({data.count} سند صرف)
            </p>
          </div>
          <button 
            onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-commission-payouts-receipt', true, 'a4')); }} 
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Printer size={15} /> طباعة التقرير (A4)
          </button>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-bold text-slate-500">إجمالي المبالغ المصروفة</p>
            <h3 className="text-xl font-black font-mono text-amber-600 mt-1">
              {Number(data.totalAmount || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
            </h3>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-bold text-slate-500">إجمالي سندات الصرف</p>
            <h3 className="text-xl font-black font-mono text-slate-800 mt-1">
              {data.count} <span className="text-xs font-normal text-slate-400">سند</span>
            </h3>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-bold text-slate-500 mb-1">التوزيع حسب الخزينة</p>
            <div className="space-y-1 max-h-16 overflow-y-auto">
              {data.treasuryBreakdown.map((t: any, i: number) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-slate-600 font-bold">{t.name}:</span>
                  <span className="font-mono font-bold text-slate-900">{Number(t.amount || 0).toFixed(2)}</span>
                </div>
              ))}
              {data.treasuryBreakdown.length === 0 && (
                <span className="text-[11px] text-slate-400">لا توجد حركات</span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                  <th className="py-3 px-4">رقم السند</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">كود</th>
                  <th className="py-3 px-4">اسم الموظف</th>
                  <th className="py-3 px-4">الوظيفة</th>
                  <th className="py-3 px-4">الخزينة المنصرف منها</th>
                  <th className="py-3 px-4">البيان والملاحظات</th>
                  <th className="py-3 px-4 text-left">المبلغ المصروف</th>
                  <th className="py-3 px-4 text-center">إيصال</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                      لا توجد حركات صرف عمولات مسجلة خلال الفترة المحددة
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-600">{row.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{row.dateStr}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">#{row.empCode}</td>
                      <td className="py-3 px-4 font-black text-slate-900">{row.empName}</td>
                      <td className="py-3 px-4 text-slate-600">{row.empRole}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md">{row.treasuryName}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{row.note}</td>
                      <td className="py-3 px-4 text-left font-mono font-black text-rose-600 text-sm">
                        {Number(row.amount || 0).toFixed(2)} {settings.currency}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            import('./ThermalFinancialVoucher').then(m => {
                              m.printThermalFinancialVoucher(settings, {
                                voucherType: 'commission_payout',
                                voucherNumber: row.id,
                                date: row.dateStr,
                                employeeName: row.empName,
                                employeeCode: row.empCode,
                                employeeRole: row.empRole,
                                amount: row.amount,
                                treasuryName: row.treasuryName,
                                note: row.note,
                                issuedBy: activeUserName
                              });
                            });
                          }}
                          className="hover:text-indigo-600 transition-colors p-1 rounded hover:bg-slate-100 text-slate-400 cursor-pointer"
                          title="طباعة إيصال حراري 80mm"
                        >
                          <Printer size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={7} className="py-3 px-4 text-left font-black">
                      إجمالي العمولات المصروفة للفترة ({data.rows.length} حركة):
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-rose-700 text-base font-black">
                      {Number(data.totalAmount || 0).toFixed(2)} {settings.currency}
                    </td>
                    <td className="py-3 px-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Printable Receipt Container (A4 Printable) */}
        <div id="print-commission-payouts-receipt" className="hidden print:block p-6 text-right font-sans" dir="rtl">
          <div className="text-center pb-4 border-b-2 border-slate-900 mb-4">
            <h2 className="text-xl font-black">{settings.salonName || 'SMART CUT'}</h2>
            <h3 className="text-base font-bold text-slate-700 mt-1">تقرير حركة صرف العمولات للفترة ({dateLabel})</h3>
            <p className="text-xs text-slate-500 mt-0.5">تاريخ الطباعة: {new Date().toLocaleString('ar-SA')}</p>
          </div>

          <table className="w-full text-right text-xs border-collapse mb-4">
            <thead>
              <tr className="bg-slate-200 border border-slate-400">
                <th className="p-2 border border-slate-400">رقم السند</th>
                <th className="p-2 border border-slate-400">التاريخ</th>
                <th className="p-2 border border-slate-400">كود</th>
                <th className="p-2 border border-slate-400">اسم الموظف</th>
                <th className="p-2 border border-slate-400">الخزينة</th>
                <th className="p-2 border border-slate-400">الملاحظات</th>
                <th className="p-2 border border-slate-400 text-left">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: any) => (
                <tr key={row.id} className="border border-slate-300">
                  <td className="p-2 border border-slate-300 font-mono">{row.id}</td>
                  <td className="p-2 border border-slate-300 font-mono">{row.dateStr}</td>
                  <td className="p-2 border border-slate-300 font-mono">{row.empCode}</td>
                  <td className="p-2 border border-slate-300 font-bold">{row.empName}</td>
                  <td className="p-2 border border-slate-300">{row.treasuryName}</td>
                  <td className="p-2 border border-slate-300">{row.note}</td>
                  <td className="p-2 border border-slate-300 font-mono font-bold text-left">{Number(row.amount || 0).toFixed(2)} {settings.currency}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black border border-slate-400">
                <td colSpan={6} className="p-2 border border-slate-400 text-left">الإجمالي الكلي:</td>
                <td className="p-2 border border-slate-400 font-mono text-left">{Number(data.totalAmount || 0).toFixed(2)} {settings.currency}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  if (reportType === 'employees') {
    const filteredInvoices = invoices.filter((i: Invoice) => {
      const iDateStr = safeSplitDate(i.date); return iDateStr >= activeFrom && iDateStr <= activeTo;
    });

    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    // Map employees work and commissions
    const empsMap: Record<string, {
      name: string;
      count: number;
      totalWork: number;
      executionCommission: number;
      openingCommission: number;
      totalCommission: number;
    }> = {};

    const getOrCreate = (name: string) => {
      const cleanName = (name || '').trim();
      if (!cleanName || cleanName === 'غير محدد' || cleanName === 'بدون') return null;
      if (!empsMap[cleanName]) {
        empsMap[cleanName] = {
          name: cleanName,
          count: 0,
          totalWork: 0,
          executionCommission: 0,
          openingCommission: 0,
          totalCommission: 0
        };
      }
      return empsMap[cleanName];
    };

    filteredInvoices.forEach(inv => {
      if (inv.status !== 'cancelled' && Array.isArray(inv.items)) {
        const totalBeforeDiscount = inv.items.reduce((s, item) => s + (Number(item.price || 0) * (item.quantity || 1)), 0);
        const discount = Number(inv.discount) || 0;
        const discountRatio = totalBeforeDiscount > 0 ? (discount / totalBeforeDiscount) : 0;

        inv.items.forEach(item => {
          const qty = item.quantity || 1;
          const itemTotal = (Number(item.price) || 0) * qty;
          const effectivePrice = Math.max(0, itemTotal - (itemTotal * discountRatio));

          const service = services.find((s: any) => s.id === item.itemId || s.id === item.id || s.name === item.serviceName);
          const product = products && products.find((p: any) => p.id === item.itemId || p.id === item.id || p.name === item.serviceName);

          // 1. عمولة التنفيذ (فني التنفيذ)
          const performerEmp = employees.find((e: any) => (item.employeeId && e.id === item.employeeId) || (item.technicianName && e.name === item.technicianName));
          const performerName = performerEmp?.name || item.technicianName;
          const performerEntry = getOrCreate(performerName);

          if (performerEntry) {
            let execComm = Number(item.employeeCommission ?? item.commissionAmount ?? (item as any).commission ?? 0);
            if (execComm <= 0) {
              if (item.type === 'product' || (!service && product)) {
                if (product && product.commission > 0) {
                  execComm = product.commission * qty;
                } else if (performerEmp) {
                  execComm = calculateEmployeeCommission(performerEmp, effectivePrice);
                }
              } else {
                const srvAmount = Number(service?.employeeCommissionAmount ?? service?.commissionAmount ?? 0);
                const srvPct = Number(service?.employeeCommissionPercentage ?? service?.commissionRate ?? 0);
                const rawBase = Number(service?.commissionableAmount ?? (item as any).commissionableAmount ?? 0);
                const commBase = rawBase > 0 ? (rawBase * qty) : effectivePrice;
                if (srvAmount > 0) {
                  execComm = srvAmount * qty;
                } else if (srvPct > 0) {
                  execComm = commBase * (srvPct / 100);
                } else if (performerEmp) {
                  execComm = calculateEmployeeCommission(performerEmp, commBase);
                }
              }
            }

            performerEntry.count += qty;
            performerEntry.totalWork += effectivePrice;
            performerEntry.executionCommission += execComm;
            performerEntry.totalCommission += execComm;
          }

          // 2. عمولة فتح الشغل / الإحالة (فني فتح الشغل)
          const referrerEmp = employees.find((e: any) => (item.referralEmployeeId && e.id === item.referralEmployeeId) || (item.referralEmployeeName && e.name === item.referralEmployeeName));
          const referrerName = referrerEmp?.name || item.referralEmployeeName;
          const referrerEntry = getOrCreate(referrerName);

          if (referrerEntry && (item.referralEmployeeId || item.referralEmployeeName)) {
            let openComm = 0;
            if (item.referralCommissionAmount !== undefined && item.referralCommissionAmount > 0) {
              openComm = item.referralCommissionAmount * qty;
            } else if (service && service.referralCommissionAmount !== undefined && service.referralCommissionAmount > 0) {
              if (service.referralCommissionType === 'fixed') {
                openComm = service.referralCommissionAmount * qty;
              } else {
                openComm = effectivePrice * (service.referralCommissionAmount / 100);
              }
            }

            if (openComm > 0) {
              referrerEntry.openingCommission += openComm;
              referrerEntry.totalCommission += openComm;
            }
          }
        });
      }
    });

    // إعادة احتساب العمولات وفق قواعد النظام (العمولة الثابتة + عمولة الخدمات إذا كان الخيار مفعلاً)
    Object.values(empsMap).forEach((entry: any) => {
      const emp = employees.find((e: any) => e.name === entry.name);
      const commResult = calculateEmployeeTotalCommission({
        employee: emp,
        totalWork: entry.totalWork,
        serviceExecutionCommission: entry.executionCommission,
        referralCommission: entry.openingCommission
      });
      entry.executionCommission = commResult.fixedCommission + commResult.serviceExecutionCommission;
      entry.openingCommission = commResult.referralCommission;
      entry.totalCommission = commResult.totalCommission;
    });

    const empList = Object.values(empsMap).sort((a, b) => b.totalWork - a.totalWork);

    const grandTotalCount = empList.reduce((s, e) => s + e.count, 0);
    const grandTotalWork = empList.reduce((s, e) => s + e.totalWork, 0);
    const grandTotalExecComm = empList.reduce((s, e) => s + e.executionCommission, 0);
    const grandTotalOpenComm = empList.reduce((s, e) => s + e.openingCommission, 0);
    const grandTotalComm = empList.reduce((s, e) => s + e.totalCommission, 0);

    const handleExportExcel = () => {
      if (!canExportExcel) {
        alert('⛔ عذراً، تصدير التقارير إلى Excel يتطلب صلاحية التصدير (export_excel).');
        return;
      }
      const excelData = empList.map(e => ({
        'الموظف': e.name,
        'العدد': e.count,
        'اجمالي الشغل': Number(e.totalWork || 0).toFixed(2),
        'عمولة تنفيذ': Number(e.executionCommission || 0).toFixed(2),
        'عمولة فتح شغل': Number(e.openingCommission || 0).toFixed(2),
        'مجموع العمولة': Number(e.totalCommission || 0).toFixed(2)
      }));

      excelData.push({
        'الموظف': 'الإجمالي العام',
        'العدد': grandTotalCount,
        'اجمالي الشغل': Number(grandTotalWork || 0).toFixed(2),
        'عمولة تنفيذ': Number(grandTotalExecComm || 0).toFixed(2),
        'عمولة فتح شغل': Number(grandTotalOpenComm || 0).toFixed(2),
        'مجموع العمولة': Number(grandTotalComm || 0).toFixed(2)
      });

      exportToExcel(excelData, `تقرير_أعمال_وعمولات_الموظفين_${dateLabel.replace(/\s+/g, '_')}`);
    };

    return (
      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs print:hidden">
          <div className="flex items-center gap-3">
            <span className="font-black text-slate-800 text-base">تقرير أعمال وعمولات الموظفين</span>
            <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">الفترة: {dateLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={!canExportExcel}
              className={`${canExportExcel ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-50'} text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all`}
              title={canExportExcel ? undefined : "لا تملك صلاحية تصدير Excel"}
            >
              <Download size={16} /> تصدير إكسيل
            </button>
            <button
              onClick={() => handlePrintReceipt('print-employees-receipt')}
              className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <Printer size={16} /> طباعة إيصال كاشير (حراري 80mm)
            </button>
            <button
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <Printer size={16} /> طباعة صفحة A4
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:hidden">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-blue-500">
            <p className="text-slate-500 text-xs font-bold mb-1">إجمالي الشغل</p>
            <h4 className="text-xl font-black text-slate-900">
              {Number(grandTotalWork || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">صافي قيمة الخدمات والمنتجات</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-indigo-500">
            <p className="text-slate-500 text-xs font-bold mb-1">إجمالي العدد المنفذ</p>
            <h4 className="text-xl font-black text-slate-900">{grandTotalCount}</h4>
            <p className="text-[10px] text-slate-400 mt-1">عملية خدمة / بيع منتج</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-purple-500">
            <p className="text-slate-500 text-xs font-bold mb-1">عمولات التنفيذ</p>
            <h4 className="text-xl font-black text-purple-700">
              {Number(grandTotalExecComm || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">المستحقة لفنيي التنفيذ</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-amber-500">
            <p className="text-slate-500 text-xs font-bold mb-1">عمولات فتح الشغل</p>
            <h4 className="text-xl font-black text-amber-700">
              {Number(grandTotalOpenComm || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">عمولات الإحالة والترشيح</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-emerald-500 bg-emerald-50/20">
            <p className="text-slate-500 text-xs font-bold mb-1">مجموع العمولات المستحقة</p>
            <h4 className="text-xl font-black text-emerald-700">
              {Number(grandTotalComm || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
            </h4>
            <p className="text-[10px] text-emerald-600 mt-1">تنفيذ + فتح شغل</p>
          </div>
        </div>

        {/* 6-Column Main Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="font-extrabold text-sm text-slate-800">بيان تفصيلي بأعمال وعمولات الموظفين</span>
            <span className="text-xs font-bold text-slate-500">عدد الموظفين: {empList.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                  <th className="py-3 px-4 text-right">الموظف</th>
                  <th className="py-3 px-4 text-center">العدد</th>
                  <th className="py-3 px-4 text-center">اجمالي الشغل</th>
                  <th className="py-3 px-4 text-center">عمولة تنفيذ</th>
                  <th className="py-3 px-4 text-center">عمولة فتح شغل</th>
                  <th className="py-3 px-4 text-left">مجموع العمولة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empList.map((emp, idx) => (
                  <tr key={emp.name} className={`hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="py-3 px-4 font-black text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-xs">
                        {idx + 1}
                      </span>
                      <span>{emp.name}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700 font-mono">
                      {emp.count}
                    </td>
                    <td className="py-3 px-4 text-center font-extrabold text-slate-800 font-mono">
                      {Number(emp.totalWork || 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-purple-700 font-mono">
                      {Number(emp.executionCommission || 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-700 font-mono">
                      {Number(emp.openingCommission || 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-left font-black text-emerald-700 font-mono text-sm">
                      {Number(emp.totalCommission || 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                    </td>
                  </tr>
                ))}
                {empList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                      لا توجد عمليات أو عمولات مسجلة للموظفين خلال هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
              {empList.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-900">
                    <td className="py-3.5 px-4 font-black text-sm">الإجمالي العام</td>
                    <td className="py-3.5 px-4 text-center font-mono font-black">{grandTotalCount}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-black">{Number(grandTotalWork || 0).toFixed(2)} {settings.currency}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-purple-300">{Number(grandTotalExecComm || 0).toFixed(2)} {settings.currency}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-amber-300">{Number(grandTotalOpenComm || 0).toFixed(2)} {settings.currency}</td>
                    <td className="py-3.5 px-4 text-left font-mono font-black text-emerald-300 text-sm">{Number(grandTotalComm || 0).toFixed(2)} {settings.currency}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Thermal Print Receipt Preview */}
        <div className="flex flex-col items-center py-8 bg-slate-200 rounded-2xl border border-slate-300">
          <div className="mb-4 text-xs font-black text-slate-600 bg-white/80 px-4 py-1.5 rounded-full shadow-2xs">
            معاينة إيصال الطابعة الحرارية (80mm)
          </div>
          <div className="bg-white shadow-xl rounded-lg p-2">
            <EmployeesReportReceipt 
              settings={settings}
              invoices={filteredInvoices}
              employees={employees}
              services={services}
              products={products}
              dateLabel={dateLabel}
              userName={activeUserName}
            />
          </div>
        </div>
      </div>
    );
  }

  if (reportType === 'initial_cash') {
    const custodyTrxs = transactions.filter((t: Transaction) => {
      const tDateStr = safeSplitDate(t.date);
      return tDateStr >= activeFrom && tDateStr <= activeTo && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash');
    });

    const totalCustody = custodyTrxs.reduce((sum, t) => sum + t.amount, 0);

    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="space-y-6">
        {/* Custody Summary Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-amber-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي مبالغ العهد المسجلة</p>
              <h4 className="text-2xl font-black text-slate-800">
                {Number(totalCustody || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              💰
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">عدد الورديات المفتوحة</p>
              <h4 className="text-2xl font-black text-slate-800">{custodyTrxs.length} وردية</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              🕒
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-emerald-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">متوسط العهدة لكل وردية</p>
              <h4 className="text-2xl font-black text-slate-800">
                {custodyTrxs.length > 0 ? (Number(totalCustody || 0) / custodyTrxs.length).toFixed(2) : '0.00'} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              📊
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="font-extrabold text-sm text-slate-800">سجل العهد اليومية بالتاريخ واليوزر والمبلغ</span>
            <span className="text-xs font-bold text-slate-500">الفترة: {dateLabel}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-extrabold border-b border-slate-200">
                  <th className="py-3 px-4">رقم الحركة</th>
                  <th className="py-3 px-4">تاريخ الوردية</th>
                  <th className="py-3 px-4">وقت التسجيل</th>
                  <th className="py-3 px-4">المستخدم / الكاشير</th>
                  <th className="py-3 px-4">الخزينة (المستلمة)</th>
                  <th className="py-3 px-4">مبلغ العهدة</th>
                  <th className="py-3 px-4">البيان / ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {custodyTrxs.map(trx => (
                  <tr key={trx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{trx.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{trx.shiftDate || safeSplitDate(trx.date)}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{new Date(trx.date).toLocaleTimeString('ar-SA')}</td>
                    <td className="py-3 px-4">
                      <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-extrabold border border-indigo-200 inline-flex items-center gap-1">
                        👤 {trx.userName || trx.createdBy || 'الكاشير'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {settings.treasuries.find(t => t.id === trx.treasury)?.name || trx.treasury}
                    </td>
                    <td className="py-3 px-4 font-black text-sm text-emerald-600">
                      +{Number(trx.amount || 0).toFixed(2)} <span className="text-[10px] font-bold text-slate-400">{settings.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{trx.description || 'عهدة افتتاحية'}</td>
                  </tr>
                ))}
                {custodyTrxs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      لا توجد عهد افتتاحية مسجلة في هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Thermal Print Receipt Preview */}
        <div className="flex flex-col items-center py-6 bg-slate-200 rounded-2xl">
          <button 
            onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-custody-receipt', false, settings.paperSize || '80mm')); }} 
            className="mb-4 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 print:hidden text-xs shadow-sm cursor-pointer"
          >
            <Printer size={16} /> طباعة إيصال العهد الحراري
          </button>
          <div className="bg-white shadow-xl rounded-xl overflow-hidden">
            <CustodyReportReceipt 
              settings={settings}
              transactions={transactions}
              dateLabel={dateLabel}
              userName={activeUserName}
            />
          </div>
        </div>
      </div>
    );
  }

  if (reportType === 'tips') {
    const filteredTipsList = branchTips.filter((t: TipRecord) => {
      const tDateStr = (t.date || '').split('T')[0];
      return tDateStr >= activeFrom && tDateStr <= activeTo;
    });

    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="space-y-6">
        {/* Tips Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:hidden">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-emerald-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي البقشيش</p>
              <h4 className="text-2xl font-black text-slate-800 font-mono">
                {Number(stats.totalTips || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              💵
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-teal-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">صُرف فوراً كاش</p>
              <h4 className="text-2xl font-black text-teal-600 font-mono">
                {Number(stats.instantCashTips || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              🟢
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-amber-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">مجمع مؤجل (معلق)</p>
              <h4 className="text-2xl font-black text-amber-600 font-mono">
                {Number(stats.pendingTips || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              ⏳
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">عدد الفواتير بالإكرامية</p>
              <h4 className="text-2xl font-black text-slate-800 font-mono">{filteredTipsList.length} فاتورة</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              📋
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="report-receipt-container">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div>
              <span className="font-extrabold text-sm text-slate-800">تقرير تفصيلي لحركات البقشيش والإكراميات</span>
              <p className="text-[11px] text-slate-500 mt-0.5">يوضح اسم العميل، رقم الفاتورة، الموظف المستحق، طريقة الدفع وحالة الصرف</p>
            </div>
            <span className="text-xs font-bold text-slate-500">الفترة: {dateLabel}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-extrabold border-b border-slate-200">
                  <th className="py-3 px-4">م</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">اسم العميل</th>
                  <th className="py-3 px-4">الموظف المستحق</th>
                  <th className="py-3 px-4">طريقة دفع الفاتورة</th>
                  <th className="py-3 px-4">مبلغ الإكرامية</th>
                  <th className="py-3 px-4 text-center">طريقة وحالة الصرف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTipsList.map((tip, idx) => (
                  <tr key={tip.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {tip.date ? new Date(tip.date).toLocaleString('ar-EG') : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{tip.invoiceId}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{tip.clientName || 'عميل نقدي'}</td>
                    <td className="py-3 px-4">
                      <span className={`${
                        tip.employeeId === 'unspecified' 
                          ? 'bg-purple-100 text-purple-800 border-purple-300' 
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      } px-2.5 py-1 rounded-lg font-extrabold border inline-flex items-center gap-1`}>
                        {tip.employeeId === 'unspecified' ? '✨' : '👤'} {tip.employeeName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {tip.paymentMethod === 'card' ? 'شبكة / بطاقة' : tip.paymentMethod === 'transfer' ? 'تحويل بنكي' : tip.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-black text-sm text-emerald-600">
                      +{Number(tip.amount || 0).toFixed(2)} <span className="text-[10px] font-bold text-slate-400">{settings.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tip.employeeId === 'unspecified' ? (
                        <span className="bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-black px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          <span>إيراد عام للصالون ✨</span>
                        </span>
                      ) : tip.status === 'paid_out' ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          <span>{tip.payoutMethod === 'instant_cash' ? 'صُرف فوراً كاش 🟢' : 'تم الصرف لاحقاً 🔵'}</span>
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                          <Clock size={11} />
                          <span>مجمع مؤجل (معلق) ⏳</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredTipsList.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                      لا توجد عمليات بقشيش مسجلة في هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (reportType === 'overtime') {
    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    const { detailedRows = [], summaryRows = [], totalHours = 0, totalAmount = 0 } = overtimeReportData || {};

    return (
      <div className="space-y-6">
        {/* Overtime Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="report-receipt-container">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <span className="font-extrabold text-sm text-slate-800">
                  {overtimeViewMode === 'summary' ? 'تقرير ساعات ومبالغ العمل الإضافي (الأوفر تايم) - مجمع حسب الموظف' : 'تقرير ساعات ومبالغ العمل الإضافي (الأوفر تايم) - تفصيلي يوم بيوم'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {overtimeViewMode === 'summary' 
                  ? 'ملخص إجمالي ساعات ودقائق الإضافي والمبالغ المستحقة لكل موظف خلال الفترة المحددة'
                  : 'بيان تفصيلي يومي بالانصراف الفعلي ودقائق وساعات العمل الإضافي والمبالغ المحتسبة بدقة'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshLogs}
                disabled={isRefreshingLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                title="تحديث واسترجاع سجلات الحضور والانصراف والبصمة من السيرفر"
              >
                <RefreshCw size={13} className={isRefreshingLogs ? 'animate-spin' : ''} />
                <span>{isRefreshingLogs ? 'جاري التحديث...' : 'تحديث سجلات البصمة'}</span>
              </button>
              <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                الفترة: {dateLabel}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {overtimeViewMode === 'summary' ? (
              /* Summary Table per Employee */
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold text-[11px]">
                  <tr>
                    <th className="py-3 px-4 text-center">#</th>
                    <th className="py-3 px-4">كود الموظف</th>
                    <th className="py-3 px-4">اسم الموظف</th>
                    <th className="py-3 px-4">المسمى الوظيفي</th>
                    <th className="py-3 px-4">الراتب الأساسي</th>
                    <th className="py-3 px-4">طريقة احتساب الإضافي</th>
                    <th className="py-3 px-4 text-center">أيام العمل الإضافي</th>
                    <th className="py-3 px-4 text-center">إجمالي الدقائق</th>
                    <th className="py-3 px-4 text-center">إجمالي الساعات</th>
                    <th className="py-3 px-4 text-left pl-6">المبلغ المستحق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {summaryRows.map((row: any, idx: number) => (
                    <tr key={row.empId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-center">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{row.empCode}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{row.empName}</td>
                      <td className="py-3 px-4 text-slate-600">{row.role}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{Number(row.baseSalary || 0) > 0 ? `${Number(row.baseSalary || 0).toFixed(2)} ${settings.currency}` : 'نسبة فقط'}</td>
                      <td className="py-3 px-4">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-bold border border-indigo-200">
                          {row.rateType === 'custom_fixed_amount' ? `${row.customHourlyRate} ${settings.currency}/ساعة (مبلغ محدد)` : row.rateType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 text-center">{row.otDaysCount} يوم</td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-center">{row.totalOtMinutes} دقيقة</td>
                      <td className="py-3 px-4 font-mono font-black text-indigo-700 text-center">{Number(row.totalOtHours || 0).toFixed(2)} ساعة</td>
                      <td className="py-3 px-4 font-mono font-black text-sm text-emerald-600 text-left pl-6">
                        {Number(row.totalOtAmount || 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                      </td>
                    </tr>
                  ))}
                  {summaryRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                        لا توجد ساعات عمل إضافي مسجلة للموظفين خلال هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
                {summaryRows.length > 0 && (
                  <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-xs">
                    <tr>
                      <td colSpan={6} className="py-3 px-4 text-center font-black">المجموع الكلي</td>
                      <td className="py-3 px-4 text-center font-mono">{summaryRows.reduce((s: number, r: any) => s + r.otDaysCount, 0)} يوم</td>
                      <td className="py-3 px-4 text-center font-mono">{summaryRows.reduce((s: number, r: any) => s + r.totalOtMinutes, 0)} د</td>
                      <td className="py-3 px-4 text-center font-mono text-indigo-700">{Number(totalHours || 0).toFixed(2)} ساعة</td>
                      <td className="py-3 px-4 font-mono text-emerald-700 text-left pl-6 font-black text-sm">
                        {Number(totalAmount || 0).toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              /* Detailed Day-by-Day Table */
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold text-[11px]">
                  <tr>
                    <th className="py-3 px-4 text-center">#</th>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">اليوم</th>
                    <th className="py-3 px-4">كود الموظف</th>
                    <th className="py-3 px-4">اسم الموظف</th>
                    <th className="py-3 px-4">المسمى الوظيفي</th>
                    <th className="py-3 px-4 text-center">الانصراف المجدول</th>
                    <th className="py-3 px-4 text-center">الانصراف الفعلي</th>
                    <th className="py-3 px-4 text-center">دقائق الإضافي</th>
                    <th className="py-3 px-4 text-center">ساعات الإضافي</th>
                    <th className="py-3 px-4">طريقة وسعر الحساب</th>
                    <th className="py-3 px-4 text-left pl-6">المبلغ المحتسب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {detailedRows.map((row: any, idx: number) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-center">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">{row.dateStr}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{row.dayNameArabic}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{row.empCode}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{row.empName}</td>
                      <td className="py-3 px-4 text-slate-600">{row.role}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-center">{row.scheduledCheckOut}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700 text-center">{row.actualCheckOut}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 text-center">{row.overtimeMinutes} د</td>
                      <td className="py-3 px-4 font-mono font-black text-indigo-700 text-center">{row.overtimeHours} س</td>
                      <td className="py-3 px-4">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-bold border border-indigo-200">
                          {row.rateLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-sm text-emerald-600 text-left pl-6">
                        +{Number(row.overtimeAmount || 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                      </td>
                    </tr>
                  ))}
                  {detailedRows.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400 font-bold">
                        لا توجد سجلات عمل إضافي يومية مسجلة خلال هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
                {detailedRows.length > 0 && (
                  <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-xs">
                    <tr>
                      <td colSpan={8} className="py-3 px-4 text-center font-black">المجموع الكلي ({detailedRows.length} سجل)</td>
                      <td className="py-3 px-4 text-center font-mono">{detailedRows.reduce((s: number, r: any) => s + r.overtimeMinutes, 0)} د</td>
                      <td className="py-3 px-4 text-center font-mono text-indigo-700">{Number(totalHours || 0).toFixed(2)} س</td>
                      <td></td>
                      <td className="py-3 px-4 font-mono text-emerald-700 text-left pl-6 font-black text-sm">
                        {Number(totalAmount || 0).toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- ADVANCES REPORT TABLE & PREVIEW ---------------- */
  if (reportType === 'advances') {
    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    const data = advancesReportData;

    return (
      <div className="space-y-6">
        {/* Advances Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-rose-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي مبالغ السلف</p>
              <h4 className="text-2xl font-black text-rose-600 font-mono">
                {Number(data.totalAmount || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <DollarSign size={20} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">عدد السلف المنصرفة</p>
              <h4 className="text-2xl font-black text-slate-800 font-mono">{data.count} <span className="text-xs font-normal text-slate-400">سند</span></h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Wallet size={20} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs border-r-4 border-r-blue-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">الموظفون المستفيدون</p>
              <h4 className="text-2xl font-black text-slate-800 font-mono">{data.employeeCount} <span className="text-xs font-normal text-slate-400">موظف</span></h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <User size={20} />
            </div>
          </div>

          {/* Treasury Breakdown */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-slate-500 text-xs font-bold mb-2">توزيع السلف حسب الخزائن</p>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {data.treasuryBreakdown.map((tb, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-slate-600 font-semibold">{tb.name}:</span>
                  <span className="font-mono font-bold text-rose-600">{Number(tb.amount || 0).toFixed(2)} ({tb.count})</span>
                </div>
              ))}
              {data.treasuryBreakdown.length === 0 && (
                <span className="text-[11px] text-slate-400">لا توجد سلف مسجلة</span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Advances Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="report-receipt-container">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                <span className="font-extrabold text-sm text-slate-800">
                  تقرير وسجل سلف الموظفين وتفاصيلها (معاينة حية وإدارة السلف)
                </span>
                {selectedAdvanceEmpId !== 'all' && (
                  <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    موظف محدد: {branchEmployees.find(e => e.id === selectedAdvanceEmpId)?.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                يمكنك معاينة السلف المصروفة وتعديل القيمة أو التاريخ أو الخزينة أو حذف السلفة مباشرة قبل الطباعة
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                الفترة: {dateLabel}
              </span>
              <button
                type="button"
                onClick={() => handlePrintReceipt('report-receipt-container', true, 'a4')}
                className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs print:hidden"
              >
                <Printer size={14} />
                <span>طباعة التقرير (A4)</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-white font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-4 text-center">#</th>
                  <th className="py-3 px-4">رقم السند</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">كود الموظف</th>
                  <th className="py-3 px-4">اسم الموظف</th>
                  <th className="py-3 px-4">الوظيفة</th>
                  <th className="py-3 px-4">الخزينة المنصرف منها</th>
                  <th className="py-3 px-4">البيان والملاحظات</th>
                  <th className="py-3 px-4 text-left">مبلغ السلفة ({settings.currency})</th>
                  <th className="py-3 px-4 text-center print:hidden">إجراءات المعاينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {data.rows.map((row: any, idx: number) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono text-center">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{row.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{row.dateStr}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{row.empCode}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{row.empName}</td>
                    <td className="py-3 px-4 text-slate-600">{row.empRole}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-[11px]">
                        {row.treasuryName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={row.note}>{row.note}</td>
                    <td className="py-3 px-4 text-left font-mono font-black text-rose-600 text-sm">
                      {Number(row.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center print:hidden">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => setEditingAdvance({
                            row,
                            amount: row.amount,
                            date: safeSplitDate(row.dateStr),
                            treasuryId: row.treasuryId || settings.treasuries[0]?.id || 'cash',
                            note: row.note
                          })}
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="تعديل السلفة"
                        >
                          <Edit2 size={13} />
                          <span>تعديل</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteAdvance(row)}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="حذف السلفة"
                        >
                          <Trash2 size={13} />
                          <span>حذف</span>
                        </button>

                        {/* Thermal Voucher Print */}
                        <button
                          type="button"
                          onClick={() => {
                            import('./ThermalFinancialVoucher').then(m => {
                              m.printThermalFinancialVoucher(settings, {
                                voucherType: 'advance',
                                voucherNumber: row.id,
                                date: row.dateStr,
                                employeeName: row.empName,
                                employeeCode: row.empCode,
                                employeeRole: row.empRole,
                                amount: row.amount,
                                treasuryName: row.treasuryName,
                                note: row.note,
                                issuedBy: activeUserName
                              });
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
                          title="طباعة سند صرف سلفة حراري (80mm)"
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                      لا توجد سلف مسجلة خلال الفترة المحددة
                    </td>
                  </tr>
                )}
              </tbody>
              {data.rows.length > 0 && (
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-xs">
                  <tr>
                    <td colSpan={8} className="py-3 px-4 text-left font-black">
                      المجموع الكلي لسلف الموظفين المنصرفة ({data.rows.length} سلفة):
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-rose-700 text-base font-black">
                      {Number(data.totalAmount || 0).toFixed(2)} {settings.currency}
                    </td>
                    <td className="print:hidden"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Modal: Edit Advance */}
        {editingAdvance && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <Edit2 size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800">تعديل بيانات السلفة</h3>
                    <p className="text-[11px] text-slate-500">الموظف: {editingAdvance.row.empName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAdvance(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">مبلغ السلفة ({settings.currency})</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={editingAdvance.amount}
                    onChange={(e) => setEditingAdvance({ ...editingAdvance, amount: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-black font-mono text-rose-600 focus:border-indigo-600 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ السلفة</label>
                  <input
                    type="date"
                    value={editingAdvance.date}
                    onChange={(e) => setEditingAdvance({ ...editingAdvance, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الخزينة المنصرف منها</label>
                  <select
                    value={editingAdvance.treasuryId}
                    onChange={(e) => setEditingAdvance({ ...editingAdvance, treasuryId: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-600 outline-none bg-white"
                  >
                    {settings.treasuries.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">البيان / سبب السلفة</label>
                  <input
                    type="text"
                    value={editingAdvance.note}
                    onChange={(e) => setEditingAdvance({ ...editingAdvance, note: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-600 outline-none"
                    placeholder="بيان وملاحظة السلفة"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAdvance(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditAdvance}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Save size={14} />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- NET PROFIT REPORT TABLE ---------------- */
  if (reportType === 'net_profit') {
    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div id="report-receipt-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 animate-in fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-800">📊 قائمة الدخل وصافي الأرباح التشغيلية</span>
              <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-2.5 py-1 rounded-lg border border-emerald-200">
                {Number(netProfitReportData.profitMargin || 0).toFixed(1)}% هامش الربح
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">الفترة الزمنية: <span className="font-mono font-bold text-slate-700">{dateLabel}</span> • {settings.salonName}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-xs font-black border ${netProfitReportData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
              صافي الربح: <span className="font-mono text-sm">{Number(netProfitReportData.netProfit || 0).toFixed(2)} {settings.currency}</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Composition of Revenue */}
        <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
            <span>توزيع عناصر المعادلة من إجمالي الدخل:</span>
            <span className="font-mono text-emerald-700">{Number(netProfitReportData.grossIncome || 0).toFixed(2)} {settings.currency} (100%)</span>
          </div>
          <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
            <div title={`مصروفات: ${Number(netProfitReportData.totalExpenses || 0).toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalExpenses / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-rose-500 h-full"></div>
            <div title={`رواتب: ${Number(netProfitReportData.totalSalaries || 0).toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalSalaries / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-blue-500 h-full"></div>
            <div title={`سلف: ${Number(netProfitReportData.totalAdvances || 0).toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalAdvances / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-amber-500 h-full"></div>
            <div title={`مشتريات: ${Number(netProfitReportData.totalPurchasesPaid || 0).toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalPurchasesPaid / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-purple-500 h-full"></div>
            <div title={`دفعات موردين: ${Number(netProfitReportData.totalSupplierPayments || 0).toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalSupplierPayments / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-indigo-500 h-full"></div>
            <div title={`عمولات: ${Number(netProfitReportData.totalCommissions || 0).toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalCommissions / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-teal-500 h-full"></div>
            {netProfitReportData.netProfit > 0 && (
              <div title={`صافي الربح: ${Number(netProfitReportData.netProfit || 0).toFixed(1)}`} style={{ width: `${Math.max(0, (netProfitReportData.netProfit / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-emerald-500 h-full"></div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2.5 text-[11px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> مصروفات</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> رواتب</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> سلف</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> مشتريات مسددة</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> دفعات موردين</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> عمولات</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> صافي الربح</span>
          </div>
        </div>

        {/* Detailed Breakdown Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900 text-white font-bold text-[11px]">
              <tr>
                <th className="py-3 px-4 text-center">#</th>
                <th className="py-3 px-4">البند المالي في معادلة الربح</th>
                <th className="py-3 px-4 text-center">نوع التأثير في المعادلة</th>
                <th className="py-3 px-4 text-center">النسبة من الدخل</th>
                <th className="py-3 px-4">تفاصيل البند</th>
                <th className="py-3 px-4 text-left pl-6">المبلغ ({settings.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {netProfitReportData.breakdownList.map((item, idx) => (
                <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.type === 'result' ? 'bg-emerald-50/60 font-black' : ''}`}>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-center">{idx + 1}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                    {item.type === 'plus' ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    ) : item.type === 'minus' ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    )}
                    <span>{item.label}</span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {item.type === 'plus' ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                        + إيراد محصل
                      </span>
                    ) : item.type === 'minus' ? (
                      <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                        - استقطاع وتكلفة
                      </span>
                    ) : (
                      <span className="bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                        = صافي النتيجة
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-700">
                    {Number(item.percent || 0).toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs">
                    {item.note}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-black text-sm text-left pl-6">
                    <span className={item.type === 'plus' ? 'text-emerald-600' : item.type === 'minus' ? 'text-rose-600' : item.amount >= 0 ? 'text-emerald-700 text-base' : 'text-rose-700 text-base'}>
                      {item.type === 'minus' ? '-' : item.type === 'plus' ? '+' : ''}{Number(item.amount || 0).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-black border-t-2 border-slate-800 text-xs">
              <tr>
                <td colSpan={5} className="py-4 px-4 text-center text-sm font-black">
                  صافي الأرباح التشغيلية النهائية للفترة (المعادلة المعتمدة)
                </td>
                <td className={`py-4 px-4 font-mono text-left pl-6 font-black text-base ${netProfitReportData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netProfitReportData.netProfit >= 0 ? '+' : ''}{Number(netProfitReportData.netProfit || 0).toFixed(2)} {settings.currency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* SECTION: تفاصيل فواتير المشتريات والمسدد منها */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm">تفاصيل فواتير المشتريات والمسدد منها ({netProfitReportData.periodPurchases.length} فاتورة)</h3>
                <p className="text-[11px] text-slate-400">فواتير الشراء المسجلة خلال الفترة مع تفصيل المسدد منها والمتبقي كآجل وطرق الدفع</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold">
                إجمالي الفواتير: <span className="font-mono text-purple-700">{Number(netProfitReportData.totalPurchasesAmount || 0).toFixed(2)} {settings.currency}</span>
              </div>
              <div className="bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 text-purple-800 font-bold">
                المسدد فعلياً: <span className="font-mono">{Number(netProfitReportData.totalPurchasesPaid || 0).toFixed(2)} {settings.currency}</span>
              </div>
              <div className="bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 text-amber-800 font-bold">
                المتبقي كآجل: <span className="font-mono">{Number(netProfitReportData.totalPurchasesRemaining || 0).toFixed(2)} {settings.currency}</span>
              </div>
            </div>
          </div>

          {/* Breakdown by Payment Method / Treasury for Purchases */}
          {Object.keys(netProfitReportData.purchasesByMethod).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3 bg-purple-50/50 p-2.5 rounded-xl border border-purple-100 text-xs">
              <span className="font-black text-purple-900 ml-2">طرق سداد المشتريات:</span>
              {Object.entries(netProfitReportData.purchasesByMethod).map(([method, amount]) => (
                <span key={method} className="bg-white px-2.5 py-1 rounded-lg border border-purple-200 text-purple-700 font-bold flex items-center gap-1 shadow-sm">
                  <span>{getTreasuryLabel(method)}:</span>
                  <span className="font-mono font-black">{(Number(amount) || 0).toFixed(2)} {settings.currency}</span>
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800 text-white font-bold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 text-center">#</th>
                  <th className="py-2.5 px-3">رقم الفاتورة</th>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">المورد</th>
                  <th className="py-2.5 px-3">طريقة السداد / الخزينة</th>
                  <th className="py-2.5 px-3 text-center">إجمالي الفاتورة</th>
                  <th className="py-2.5 px-3 text-center">المسدد (مستقطع بالأرباح)</th>
                  <th className="py-2.5 px-3 text-center">المتبقي (آجل)</th>
                  <th className="py-2.5 px-3 text-center">حالة السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {netProfitReportData.periodPurchases.map((p: any, idx: number) => {
                  const invoiceNum = p.invoiceNumber || p.id || '-';
                  const invDate = (p.invoiceDate || p.date || '').split('T')[0];
                  const supplierName = getSupplierName(p.supplierId);
                  const total = Number(p.total ?? p.totalAmount ?? p.total_amount) || 0;
                  const paid = Number(p.paid ?? p.paidAmount ?? p.paid_amount) || 0;
                  const remaining = Number(p.remaining ?? p.remainingAmount ?? p.remaining_amount) || 0;
                  const treasury = p.treasuryId || p.paymentMethod || p.treasury || 'cash';
                  const isFullyPaid = remaining <= 0 && paid > 0;
                  const isPartial = paid > 0 && remaining > 0;

                  return (
                    <tr key={p.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-center">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{invoiceNum}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{invDate}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{supplierName}</td>
                      <td className="py-2.5 px-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                          {getTreasuryLabel(treasury)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 text-center">
                        {Number(total || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-purple-700 text-center">
                        {Number(paid || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700 text-center">
                        {Number(remaining || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isFullyPaid ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                            مدفوعة بالكامل
                          </span>
                        ) : isPartial ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                            مسددة جزئياً
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-300">
                            آجلة بالكامل
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {netProfitReportData.periodPurchases.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-bold">
                      لا توجد فواتير مشتريات مسجلة خلال هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
              {netProfitReportData.periodPurchases.length > 0 && (
                <tfoot className="bg-slate-50 font-black text-slate-900 border-t border-slate-200 text-xs">
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 text-center font-black">
                      المجموع ({netProfitReportData.periodPurchases.length} فاتورة)
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black">
                      {Number(netProfitReportData.totalPurchasesAmount || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black text-purple-700">
                      {Number(netProfitReportData.totalPurchasesPaid || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black text-amber-700">
                      {Number(netProfitReportData.totalPurchasesRemaining || 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* SECTION: تفاصيل سندات دفعات وسداد الموردين */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm">تفاصيل سندات دفعات وسداد الموردين ({netProfitReportData.periodSupplierPayments.length} سند)</h3>
                <p className="text-[11px] text-slate-400">سندات الصرف المسددة للموردين مع الخزائن وطرق الدفع والبيان المالي</p>
              </div>
            </div>

            <div className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-800 font-bold text-xs">
              إجمالي دفعات الموردين: <span className="font-mono text-sm">{Number(netProfitReportData.totalSupplierPayments || 0).toFixed(2)} {settings.currency}</span>
            </div>
          </div>

          {/* Breakdown by Payment Method / Treasury for Supplier Payments */}
          {Object.keys(netProfitReportData.supplierPaymentsByMethod).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 text-xs">
              <span className="font-black text-indigo-900 ml-2">طرق صرف دفعات الموردين:</span>
              {Object.entries(netProfitReportData.supplierPaymentsByMethod).map(([method, amount]) => (
                <span key={method} className="bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 font-bold flex items-center gap-1 shadow-sm">
                  <span>{getTreasuryLabel(method)}:</span>
                  <span className="font-mono font-black">{(Number(amount) || 0).toFixed(2)} {settings.currency}</span>
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800 text-white font-bold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 text-center">#</th>
                  <th className="py-2.5 px-3">رقم السند</th>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">المورد</th>
                  <th className="py-2.5 px-3">الخزينة / طريقة الدفع</th>
                  <th className="py-2.5 px-3">البيان / ملاحظات السند</th>
                  <th className="py-2.5 px-3 text-left pl-6">المبلغ المنصرف ({settings.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {netProfitReportData.periodSupplierPayments.map((sp: any, idx: number) => {
                  const payNum = sp.paymentNumber || sp.id || '-';
                  const payDate = (sp.paymentDate || sp.date || '').split('T')[0];
                  const supplierName = getSupplierName(sp.supplierId);
                  const treasury = sp.treasuryId || sp.paymentMethod || sp.treasury || 'cash';
                  const amount = Number(sp.amount) || 0;
                  const notes = sp.notes || sp.description || '-';

                  return (
                    <tr key={sp.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-center">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{payNum}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{payDate}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{supplierName}</td>
                      <td className="py-2.5 px-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                          {getTreasuryLabel(treasury, sp.paymentMethod)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate" title={notes}>
                        {notes}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-sm text-indigo-700 text-left pl-6">
                        {Number(amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                {netProfitReportData.periodSupplierPayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                      لا توجد سندات دفعات موردين مسجلة خلال هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
              {netProfitReportData.periodSupplierPayments.length > 0 && (
                <tfoot className="bg-slate-50 font-black text-slate-900 border-t border-slate-200 text-xs">
                  <tr>
                    <td colSpan={6} className="py-2.5 px-3 text-center font-black">
                      المجموع الكلي لدفعات وسداد الموردين ({netProfitReportData.periodSupplierPayments.length} سند)
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-800 text-left pl-6 font-black text-sm">
                      {Number(netProfitReportData.totalSupplierPayments || 0).toFixed(2)} {settings.currency}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- UNPAID BOOKINGS REPORT TABLE ---------------- */
  if (reportType === 'unpaid_bookings') {
    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div id="report-receipt-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 animate-in fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-800">📅 تقرير المبالغ المتبقية والغير مسددة في الحجوزات</span>
              <span className="bg-rose-50 text-rose-700 font-bold text-xs px-2.5 py-1 rounded-lg border border-rose-200">
                {unpaidBookingsReportData?.filteredBookings?.length || 0} حجز
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">الفترة الزمنية: <span className="font-mono font-bold text-slate-700">{dateLabel}</span> • {settings.salonName}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl text-xs font-black border bg-rose-50 text-rose-800 border-rose-200">
              إجمالي المتبقي: <span className="font-mono text-sm">{Number(unpaidBookingsReportData?.totalRemaining || 0).toFixed(2)} {settings.currency}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 text-center w-12">م</th>
                <th className="py-3 px-3">رقم ومكان الحجز</th>
                <th className="py-3 px-3">العميل ورقم الجوال</th>
                <th className="py-3 px-3">تاريخ ووقت الحجز</th>
                <th className="py-3 px-3">الخدمات والفني</th>
                <th className="py-3 px-3 text-left">إجمالي الحجز</th>
                <th className="py-3 px-3 text-left">العربون وطريقة الدفع</th>
                <th className="py-3 px-3 text-left">المتبقي غير المسدد</th>
                <th className="py-3 px-3 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(unpaidBookingsReportData?.filteredBookings || []).map((b: any, index: number) => {
                const isUnpaid = Number(b.remaining || 0) > 0.001;
                return (
                  <tr key={b.id || index} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-500 font-mono font-semibold">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-800 text-xs">{b.bookingCode || b.id}</div>
                      {b.location && (
                        <div className="mt-1">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            📍 {b.location}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{b.customerName}</div>
                      {b.customerPhone && (
                        <div className="text-[11px] font-mono text-slate-400 dir-ltr text-right">{b.customerPhone}</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-700">{safeSplitDate(b.date)}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{b.time || ''}</div>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <div className="text-slate-600 truncate font-medium" title={b.servicesSummary}>
                        {b.servicesSummary}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 text-left">
                      {Number(b.totalAmount || 0).toFixed(2)} {settings.currency}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-600 text-left">
                      {b.advanceDetails}
                    </td>
                    <td className="py-3 px-3 text-left">
                      <span className={`inline-block font-mono font-bold px-2 py-1 rounded-lg text-xs border ${
                        isUnpaid 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {Number(b.remaining || 0).toFixed(2)} {settings.currency}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${b.statusColor}`}>
                        {b.statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(!unpaidBookingsReportData?.filteredBookings || unpaidBookingsReportData.filteredBookings.length === 0) && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                    لا توجد حجوزات مطابقة للفترة أو محددات البحث المحددة
                  </td>
                </tr>
              )}
            </tbody>
            {unpaidBookingsReportData?.filteredBookings && unpaidBookingsReportData.filteredBookings.length > 0 && (
              <tfoot className="bg-slate-100 font-black text-slate-800 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-center font-black text-sm">
                    الإجمالي الكلي ({unpaidBookingsReportData.totalCount} حجز)
                  </td>
                  <td className="py-3 px-3 font-mono font-black text-left text-sm text-indigo-700">
                    {Number(unpaidBookingsReportData.totalRequired || 0).toFixed(2)} {settings.currency}
                  </td>
                  <td className="py-3 px-3 font-mono font-black text-left text-sm text-emerald-700">
                    {Number(unpaidBookingsReportData.totalPaid || 0).toFixed(2)} {settings.currency}
                  </td>
                  <td className="py-3 px-3 font-mono font-black text-left text-sm text-rose-700">
                    {Number(unpaidBookingsReportData.totalRemaining || 0).toFixed(2)} {settings.currency}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  /* ---------------- SALES RETURNS REPORT ---------------- */
  if (reportType === 'sales_returns') {
    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    const data = salesReturnsReportData;

    const handleExportExcel = () => {
      if (!canExportExcel) {
        alert('⛔ عذراً، تصدير التقارير إلى Excel يتطلب صلاحية التصدير (export_excel).');
        return;
      }
      const excelData = data.returns.map((r: SalesReturn, idx: number) => ({
        'م': idx + 1,
        'رقم المرتجع': r.returnNumber,
        'رقم الفاتورة': r.invoiceId,
        'العميل': r.clientName || 'عميل نقدي',
        'التاريخ': safeSplitDate(r.returnDate),
        'طريقة الاسترداد': getTreasuryLabel(r.treasuryId, r.refundMethod),
        'السبب': r.reason || 'أخرى',
        'عدد الأصناف': r.items?.length || 0,
        'مبلغ المرتجع': Number(r.totalRefundAmount || 0).toFixed(2),
        'الكاشير': r.createdByUserName || 'المسؤول'
      }));

      excelData.push({
        'م': '' as any,
        'رقم المرتجع': 'الإجمالي الكلي',
        'رقم الفاتورة': '',
        'العميل': '',
        'التاريخ': '',
        'طريقة الاسترداد': '',
        'السبب': '',
        'عدد الأصناف': data.returns.reduce((sum, r) => sum + (r.items?.length || 0), 0) as any,
        'مبلغ المرتجع': Number(data.totalRefundAmount || 0).toFixed(2),
        'الكاشير': ''
      });

      exportToExcel(excelData, `تقرير_مرتجعات_المبيعات_${activeFrom}_${activeTo}`);
    };

    return (
      <div id="report-receipt-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 animate-in fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-800">🔄 تقرير مرتجعات المبيعات (إشعارات دائن)</span>
              <span className="bg-rose-50 text-rose-700 font-bold text-xs px-2.5 py-1 rounded-lg border border-rose-200">
                {data.returnsCount} عملية مرتجع
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              الفترة الزمنية: <span className="font-mono font-bold text-slate-700">{dateLabel}</span> • {settings.salonName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={!canExportExcel}
              className={`${canExportExcel ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-50'} text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all`}
            >
              <Download size={15} /> تصدير إكسل
            </button>
            <button
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Printer size={15} /> طباعة التقرير
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100/40 border border-rose-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-rose-800">إجمالي مبالغ المرتجعات</p>
              <p className="text-2xl font-black text-rose-950 mt-1 font-mono">
                {Number(data.totalRefundAmount || 0).toFixed(2)} <span className="text-xs">{settings.currency}</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <RotateCcw size={22} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/40 border border-amber-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-800">عدد عمليات المرتجع</p>
              <p className="text-2xl font-black text-amber-950 mt-1 font-mono">
                {data.returnsCount} <span className="text-xs font-sans">عملية</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <FileBarChart size={22} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/40 border border-blue-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-800">منتجات مسترجعة للمخزون</p>
              <p className="text-2xl font-black text-blue-950 mt-1 font-mono">
                {data.restockedProductsCount} <span className="text-xs font-sans">قطعة</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShoppingCart size={22} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/40 border border-purple-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-purple-800">خدمات تم إلغاؤها / إرجاعها</p>
              <p className="text-2xl font-black text-purple-950 mt-1 font-mono">
                {data.returnedServicesCount} <span className="text-xs font-sans">خدمة</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Coins size={22} />
            </div>
          </div>
        </div>

        {/* 2 Analytical Breakdown Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reason Breakdown */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <h4 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>تحليل أسباب المرتجعات</span>
            </h4>
            <div className="space-y-2">
              {Object.entries(data.reasonsBreakdown).map(([reason, stat]: [string, any]) => (
                <div key={reason} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{reason}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono">({stat.count} مرات)</span>
                    <span className="font-mono font-black text-rose-700">{stat.amount.toFixed(2)} {settings.currency}</span>
                  </div>
                </div>
              ))}
              {Object.keys(data.reasonsBreakdown).length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400 font-bold">لا توجد بيانات أسباب مسجلة</p>
              )}
            </div>
          </div>

          {/* Refund Methods / Treasuries Breakdown */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <h4 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>الخزائن وطرق استرداد المبالغ</span>
            </h4>
            <div className="space-y-2">
              {Object.entries(data.treasuriesBreakdown).map(([tId, amount]: [string, any]) => (
                <div key={tId} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{getTreasuryLabel(tId)}</span>
                  <span className="font-mono font-black text-indigo-700">{amount.toFixed(2)} {settings.currency}</span>
                </div>
              ))}
              {Object.keys(data.treasuriesBreakdown).length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400 font-bold">لا توجد مبالغ مستردة مسجلة</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Returned Items */}
        {data.topReturnedItems.length > 0 && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <div className="p-3.5 bg-slate-100/70 border-b border-slate-200 font-black text-xs text-slate-800 flex items-center justify-between">
              <span>الأصناف والخدمات الأكثر إرجاعاً</span>
              <span className="text-[11px] text-slate-400 font-normal">مرتبة تنازلياً حسب كمية الإرجاع</span>
            </div>
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">م</th>
                  <th className="py-2.5 px-3">اسم الصنف / الخدمة</th>
                  <th className="py-2.5 px-3 text-center">النوع</th>
                  <th className="py-2.5 px-3 text-center">الكمية المرتجعة</th>
                  <th className="py-2.5 px-3 text-left pl-6">إجمالي المبلغ المسترد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topReturnedItems.slice(0, 10).map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{it.name}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${it.type === 'product' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                        {it.type === 'product' ? 'منتج' : 'خدمة'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-700">{it.qty}</td>
                    <td className="py-2.5 px-3 font-mono font-black text-slate-800 text-left pl-6">
                      {it.amount.toFixed(2)} {settings.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detailed Returns Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="p-3.5 bg-slate-900 text-white font-black text-xs flex items-center justify-between">
            <span>سجل عمليات مرتجعات المبيعات التفصيلي</span>
            <span className="text-[11px] text-slate-300 font-mono font-normal">{data.returns.length} سجل</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-12">م</th>
                  <th className="py-3 px-3">رقم المرتجع</th>
                  <th className="py-3 px-3">رقم الفاتورة</th>
                  <th className="py-3 px-3">التاريخ والوقت</th>
                  <th className="py-3 px-3">العميل</th>
                  <th className="py-3 px-3">سبب الإرجاع</th>
                  <th className="py-3 px-3">طريقة الاسترداد / الخزينة</th>
                  <th className="py-3 px-3">الأصناف المرتجعة</th>
                  <th className="py-3 px-3 text-left">مبلغ المرتجع</th>
                  <th className="py-3 px-3 text-center">طباعة إشعار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.returns.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-rose-50/20 transition-colors">
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-rose-700">{r.returnNumber}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">#{r.invoiceId}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono">{safeSplitDate(r.returnDate)}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{r.clientName || 'عميل نقدي'}</td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{r.reason || 'أخرى'}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        {getTreasuryLabel(r.treasuryId, r.refundMethod)}
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-slate-600" title={r.items?.map(i => `${i.name} (x${i.quantity})`).join(', ')}>
                      {r.items?.map(i => `${i.name} (x${i.quantity})`).join(', ') || '-'}
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-rose-700 text-left">
                      {Number(r.totalRefundAmount || 0).toFixed(2)} {settings.currency}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setVoucherModalReturn(r)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                        title="طباعة إشعار دائن (سند مرتجع)"
                      >
                        <Printer size={13} />
                        <span>طباعة</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {data.returns.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                      لا توجد عمليات مرتجع مسجلة في هذه الفترة الزمنية
                    </td>
                  </tr>
                )}
              </tbody>
              {data.returns.length > 0 && (
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={8} className="py-3 px-4 text-center font-black">
                      إجمالي مبالغ المرتجعات ({data.returns.length} عملية)
                    </td>
                    <td className="py-3 px-3 font-mono text-rose-700 font-black text-sm text-left">
                      {Number(data.totalRefundAmount || 0).toFixed(2)} {settings.currency}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Modal for Credit Note Voucher */}
        {voucherModalReturn && (
          <SalesReturnVoucherModal
            isOpen={true}
            onClose={() => setVoucherModalReturn(null)}
            salesReturn={voucherModalReturn}
            settings={settings}
          />
        )}
      </div>
    );
  }

  if (reportType === 'inactive_clients') {
    const data = inactiveClientsReportData || {
      allInactiveClients: [],
      inactiveClients: [],
      inactiveCount: 0,
      totalClientsCount: 0,
      totalPreviousSpend: 0,
      avgDaysAbsent: 0,
      inactiveRate: 0,
      vipInactiveCount: 0,
      thresholdDays: 60
    };

    const filteredClients = data.inactiveClients || [];

    const handleExportExcel = () => {
      const headers = ['م', 'اسم العميل', 'المستوى', 'حالة الزيارة', 'رقم الموبايل', 'تاريخ آخر زيارة / تسجيل', 'مدة الانقطاع (يوم)', 'الزيارات السابقة', 'إجمالي الإنفاق السابق', 'متوسط الفاتورة', 'نقاط الولاء', 'رصيد الكاش باك', 'الملاحظات'];
      const rows = filteredClients.map((c: any, idx: number) => [
        idx + 1,
        c.name,
        c.tier === 'royal' ? 'ملكي 💎' : c.tier === 'vip' ? 'VIP 👑' : c.tier === 'distinguished' ? 'متميز 🔷' : 'قياسي ⭐',
        c.isNeverVisited ? 'مسجل جديد لم يزر بعد' : 'سبق له الزيارة',
        c.phone || '-',
        c.lastVisitDate ? c.lastVisitDate : (c.createdAtDate ? `${c.createdAtDate} (تاريخ التسجيل)` : '-'),
        c.daysAbsent,
        c.totalVisits || 0,
        Number(c.totalSpend || 0).toFixed(2),
        Number(c.avgInvoice || 0).toFixed(2),
        c.loyaltyPoints || 0,
        Number(c.cashback || 0).toFixed(2),
        c.notes || '-'
      ]);
      exportToExcel(`تقرير_العملاء_المنقطعين_${data.thresholdDays}_يوم`, `العملاء_المنقطعين_${data.thresholdDays}_يوم`, headers, rows);
    };

    const handleCopyPhone = (phone: string) => {
      if (!phone) return;
      navigator.clipboard.writeText(phone);
      alert(`تم نسخ رقم الموبايل: ${phone}`);
    };

    const getWhatsAppUrl = (client: any) => {
      const phoneDigits = (client.phone || '').replace(/\D/g, '');
      if (!phoneDigits) return null;
      let fullPhone = phoneDigits;
      if (fullPhone.startsWith('05') && fullPhone.length === 10) {
        fullPhone = '966' + fullPhone.slice(1);
      } else if (fullPhone.startsWith('01') && fullPhone.length === 11) {
        fullPhone = '20' + fullPhone.slice(1);
      }
      const salonName = settings.salonName || 'صالون سمارت كت';
      const msg = `مرحباً أستاذ ${client.name} 🌹\nاشتقنا لزيارتك في ${salonName}!\nيسعدنا أن نقدم لك عرضاً وخصماً خاصاً وحصرياً بمناسبة عودتك لزيارتنا.\nهل تود حجز موعدك القادم معنا اليوم؟ ✂️✨`;
      return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    };

    const totalDisplayedVisits = filteredClients.reduce((sum: number, c: any) => sum + (c.totalVisits || 0), 0);
    const totalDisplayedSpend = filteredClients.reduce((sum: number, c: any) => sum + Number(c.totalSpend || 0), 0);
    const avgDisplayedDays = filteredClients.length > 0 ? Math.round(filteredClients.reduce((sum: number, c: any) => sum + c.daysAbsent, 0) / filteredClients.length) : 0;
    const avgInvoiceOverall = totalDisplayedVisits > 0 ? (totalDisplayedSpend / totalDisplayedVisits) : 0;

    return (
      <div id="report-receipt-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 animate-in fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-800 flex items-center gap-2">
                <UserX size={24} className="text-rose-600" />
                <span>👥 تقرير العملاء المنقطعين عن الزيارة (إعادة التنشيط)</span>
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                  معيار الانقطاع: {data.thresholdDays} يوم فأكثر
                </span>
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              متابعة وإعادة استهداف العملاء الغائبين لتعزيز نسبة الولاء والعودة للصالون • {settings.salonName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={!canExportExcel}
              className={`${canExportExcel ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-50'} text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all`}
            >
              <Download size={15} /> تصدير إكسل
            </button>
            <button
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Printer size={15} /> طباعة التقرير
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border-2 border-rose-200 shadow-xs flex items-center justify-between border-r-4 border-r-rose-600">
            <div>
              <p className="text-xs font-bold text-rose-800">إجمالي العملاء المنقطعين</p>
              <p className="text-2xl font-black text-rose-950 mt-1 font-mono">
                {data.inactiveCount} <span className="text-xs font-sans">عميل</span>
              </p>
              <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                نسبة الغياب: {data.inactiveRate}% من {data.totalClientsCount} عميل
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX size={22} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-amber-200 shadow-xs flex items-center justify-between border-r-4 border-r-amber-500">
            <div>
              <p className="text-xs font-bold text-amber-800">متوسط فترة الغياب والانقطاع</p>
              <p className="text-2xl font-black text-amber-950 mt-1 font-mono">
                {data.avgDaysAbsent} <span className="text-xs font-sans">يوم</span>
              </p>
              <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                الحد الأدنى: {data.thresholdDays} يوم
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={22} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-emerald-200 shadow-xs flex items-center justify-between border-r-4 border-r-emerald-500">
            <div>
              <p className="text-xs font-bold text-emerald-800">إجمالي إنفاقهم التاريخي</p>
              <p className="text-2xl font-black text-emerald-950 mt-1 font-mono">
                {Number(data.totalPreviousSpend || 0).toFixed(2)} <span className="text-xs">{settings.currency}</span>
              </p>
              <p className="text-[10px] text-emerald-700 font-bold mt-0.5">مبيعات سابقة معرضة للفقدان</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={22} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-purple-200 shadow-xs flex items-center justify-between border-r-4 border-r-purple-500">
            <div>
              <p className="text-xs font-bold text-purple-800">عملاء VIP ومميزين منقطعين</p>
              <p className="text-2xl font-black text-purple-950 mt-1 font-mono">
                {data.vipInactiveCount || 0} <span className="text-xs font-sans">عميل</span>
              </p>
              <p className="text-[10px] text-purple-600 font-bold mt-0.5">أولوية قصوى للمتابعة</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award size={22} />
            </div>
          </div>
        </div>

        {/* Detailed Inactive Clients Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div className="p-3.5 bg-slate-900 text-white font-black text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <span>قائمة العملاء الذين لم يحضروا منذ {data.thresholdDays} يوماً فأكثر</span>
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">
                {filteredClients.length} عميل معروض
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-normal">
              💡 اضغط على زر «دعوة عودة 💬» لإرسال رسالة ترحيبية وعرض مخصص عبر واتساب مباشرة
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3">العميل والمستوى</th>
                  <th className="py-3 px-3">رقم الجوال</th>
                  <th className="py-3 px-3">تاريخ آخر زيارة</th>
                  <th className="py-3 px-3 text-center">مدة الانقطاع</th>
                  <th className="py-3 px-3 text-center">الزيارات السابقة</th>
                  <th className="py-3 px-3 text-left">إجمالي الإنفاق</th>
                  <th className="py-3 px-3 text-left">متوسط الفاتورة</th>
                  <th className="py-3 px-3 text-center">النقاط والكاش باك</th>
                  <th className="py-3 px-3">الملاحظات</th>
                  <th className="py-3 px-3 text-center print:hidden">إجراءات المتابعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {filteredClients.map((c: any, idx: number) => {
                  const waUrl = getWhatsAppUrl(c);
                  const isCriticalAbsent = c.daysAbsent >= 120;
                  const isMediumAbsent = c.daysAbsent >= 60 && c.daysAbsent < 120;

                  return (
                    <tr key={c.id || idx} className="hover:bg-rose-50/25 transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <User size={14} className="text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-900">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                              c.tier === 'royal'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : c.tier === 'vip'
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : c.tier === 'distinguished'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {c.tier === 'royal' ? '💎 ملكي' : c.tier === 'vip' ? '👑 VIP' : c.tier === 'distinguished' ? '🔷 متميز' : '⭐ قياسي'}
                            </span>
                            {c.isNeverVisited && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                جديد لم يزر بعد ✨
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700" dir="ltr">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span>{c.phone || '-'}</span>
                          {c.phone && (
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(c.phone)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 print:hidden"
                              title="نسخ رقم الموبايل"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono">
                        {c.lastVisitDate ? (
                          <span>{c.lastVisitDate}</span>
                        ) : c.createdAtDate ? (
                          <div className="text-[11px] text-slate-500">
                            <div>{c.createdAtDate}</div>
                            <span className="text-[9px] text-slate-400">(تاريخ التسجيل)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1 border ${
                          isCriticalAbsent
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : isMediumAbsent
                            ? 'bg-orange-100 text-orange-900 border-orange-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}>
                          <span>{c.daysAbsent}</span>
                          <span className="text-[10px] font-normal">يوم</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {c.totalVisits || 0}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-slate-800 text-left">
                        {Number(c.totalSpend || 0).toFixed(2)} {settings.currency}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-slate-700 text-left">
                        {Number(c.avgInvoice || 0).toFixed(2)} {settings.currency}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-0.5 text-[11px]">
                          <span className="font-mono font-bold text-indigo-700">{c.loyaltyPoints || 0} نقطة</span>
                          {Number(c.cashback || 0) > 0 && (
                            <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {Number(c.cashback).toFixed(2)} {settings.currency}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[150px] truncate" title={c.notes || ''}>
                        {c.notes || '-'}
                      </td>
                      <td className="py-3 px-3 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                              title="إرسال رسالة ترحيبية ودعوة عودة مع خصم حصري عبر واتساب"
                            >
                              <MessageSquare size={13} />
                              <span>دعوة عودة 💬</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px]">لا يوجد هاتف</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
                          <UserCheck size={28} />
                        </div>
                        <p className="text-sm font-black text-slate-800">
                          {inactiveClientsSearch
                            ? `لا توجد نتائج مطابقة لبحثك "${inactiveClientsSearch}"`
                            : `رائع! لا يوجد عملاء منقطعون تجاوزوا مدة (${data.thresholdDays}) يوم وفق الفلتر الحالي.`}
                        </p>
                        <p className="text-xs text-slate-400 max-w-md">
                          جميع عملائك على تواصل وزيارات منتظمة، أو يمكنك تقليل معيار عدد الأيام من شريط الفلاتر بالأعلى لفحص فترات غياب أقصر.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredClients.length > 0 && (
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={4} className="py-3.5 px-4 text-center font-black">
                      إجمالي العملاء المنقطعين المعروضين ({filteredClients.length} عميل)
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-rose-700 font-black">
                      متوسط {avgDisplayedDays} يوم
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      {totalDisplayedVisits} زيارة
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-900 font-black text-sm text-left">
                      {totalDisplayedSpend.toFixed(2)} {settings.currency}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-900 font-black text-sm text-left">
                      {avgInvoiceOverall.toFixed(2)} {settings.currency}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (reportType === 'target_report') {
    const data = targetReportData || { rows: [] };
    const filteredRows = (data.rows || []).filter((r: any) => {
      // Search filter
      if (targetReportSearch && targetReportSearch.trim()) {
        const q = targetReportSearch.trim().toLowerCase();
        const matchesName = (r.empName || '').toLowerCase().includes(q);
        const matchesCode = (r.empCode || '').toLowerCase().includes(q);
        const matchesRole = (r.empRole || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesRole) return false;
      }
      // Type filter
      if (targetTypeFilter && targetTypeFilter !== 'all') {
        if (r.targetType !== targetTypeFilter) return false;
      }
      // Status filter
      if (targetStatusFilter === 'achieved' && !r.isTargetAchieved) return false;
      if (targetStatusFilter === 'not_achieved' && (r.isTargetAchieved || r.targetType === 'none')) return false;
      return true;
    });

    const totalTargetRequired = filteredRows.reduce((sum: number, r: any) => sum + Number(r.targetRequired || 0), 0);
    const totalSalesPool = filteredRows.reduce((sum: number, r: any) => sum + Number(r.targetSalesPool || 0), 0);
    const totalEligible = filteredRows.reduce((sum: number, r: any) => sum + Number(r.eligibleAmount || 0), 0);
    const totalCommission = filteredRows.reduce((sum: number, r: any) => sum + Number(r.targetCommission || 0), 0);
    const totalExemptSales = filteredRows.reduce((sum: number, r: any) => sum + Number(r.exemptSales || 0), 0);
    const totalExemptCommission = filteredRows.reduce((sum: number, r: any) => sum + Number(r.exemptCommission || 0), 0);
    const totalGrandCommission = filteredRows.reduce((sum: number, r: any) => sum + Number(r.totalEarnedCommission || 0), 0);

    return (
      <div id="report-receipt-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 animate-in fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Target size={24} className="text-indigo-600" />
                <span>🎯 تقرير التارجت والعمولات المستهدفة للموظفين</span>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  الفترة: {activeFrom} إلى {activeTo}
                </span>
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              متابعة تحقيق التارجت اليومي والشهري، واحتساب العمولات الخاضعة والمعفاة بدقة • {settings.salonName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrintReceipt('report-receipt-container', true, 'a4')}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Printer size={15} /> طباعة التقرير
            </button>
          </div>
        </div>

        {/* Detailed Target Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div className="p-3.5 bg-slate-900 text-white font-black text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <span>كشف أداء وعمولات التارجت لموظفي الفرع</span>
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">
                {filteredRows.length} موظف معروض
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-normal">
              💡 الخدمات ذات الصرف الفوري معفاة من التارجت وتظهر عمولتها مباشرة بالعمود المخصص
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-3">الموظف</th>
                  <th className="py-3 px-3 text-center">نظام التارجت</th>
                  <th className="py-3 px-3">طريقة الاحتساب</th>
                  <th className="py-3 px-3 text-left">التارجت المطلوب</th>
                  <th className="py-3 px-3 text-left">المبيعات الخاضعة</th>
                  <th className="py-3 px-3 text-center min-w-[130px]">نسبة الإنجاز</th>
                  <th className="py-3 px-3 text-center">حالة التارجت</th>
                  <th className="py-3 px-3 text-left">المبلغ الخاضع للنسبة</th>
                  <th className="py-3 px-3 text-center">النسبة</th>
                  <th className="py-3 px-3 text-left">عمولة التارجت</th>
                  <th className="py-3 px-3 text-left">مبيعات معفاة</th>
                  <th className="py-3 px-3 text-left">عمولة معفاة</th>
                  <th className="py-3 px-3 text-left font-black text-slate-900">إجمالي المستحق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {filteredRows.map((r: any, idx: number) => {
                  return (
                    <tr key={r.empId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-slate-900">{r.empName}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          {r.empCode && <span className="font-mono bg-slate-100 px-1 rounded">{r.empCode}</span>}
                          <span>{r.empRole}</span>
                          {r.baseSalary > 0 && <span>• راتب: {r.baseSalary}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {r.targetType === 'daily' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200">
                            يومي 📅
                          </span>
                        ) : r.targetType === 'monthly' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                            شهري 🗓️
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            بدون
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] text-slate-600 block max-w-[190px] leading-tight">
                          {r.targetMethodLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700 text-left">
                        {r.targetRequired > 0 ? `${Number(r.targetRequired).toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-slate-900 text-left">
                        {Number(r.targetSalesPool).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {r.targetType !== 'none' ? (
                          <div className="flex flex-col gap-1 items-center">
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  r.isTargetAchieved 
                                    ? 'bg-emerald-500' 
                                    : r.progressPercent >= 70 
                                    ? 'bg-amber-500' 
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, r.progressPercent)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-slate-500">
                              {r.progressPercent}% {r.targetType === 'daily' && r.workingDaysCount > 0 ? `(${r.daysAchieved}/${r.workingDaysCount} يوم)` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {r.targetType === 'none' ? (
                          <span className="text-slate-400 text-[10px]">بدون تارجت</span>
                        ) : r.isTargetAchieved ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                            <span>محقق 🎯</span>
                          </span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              جاري السعي ⏳
                            </span>
                            {r.remainingToTarget > 0 && (
                              <span className="text-[9px] text-rose-500 font-mono mt-0.5 font-bold">
                                متبقي: {Number(r.remainingToTarget).toFixed(0)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700 text-left">
                        {Number(r.eligibleAmount).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                        {r.commissionRate}%
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-emerald-700 text-left">
                        {Number(r.targetCommission).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 text-left">
                        {Number(r.exemptSales).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-700 text-left">
                        {Number(r.exemptCommission).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-slate-900 text-left bg-slate-50">
                        {Number(r.totalEarnedCommission).toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                          <Target size={28} />
                        </div>
                        <p className="text-sm font-black text-slate-800">
                          {targetReportSearch
                            ? `لا توجد نتائج مطابقة للبحث "${targetReportSearch}"`
                            : 'لا توجد بيانات تارجت للموظفين في هذه الفترة المحددة.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredRows.length > 0 && (
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={4} className="py-3.5 px-4 text-center font-black">
                      الإجمالي العام ({filteredRows.length} موظف)
                    </td>
                    <td className="py-3.5 px-3 font-mono text-left font-black text-slate-800">
                      {totalTargetRequired.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-left font-black text-slate-900">
                      {totalSalesPool.toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                    <td className="py-3.5 px-3 font-mono text-left font-black text-indigo-800">
                      {totalEligible.toFixed(2)}
                    </td>
                    <td></td>
                    <td className="py-3.5 px-3 font-mono text-left font-black text-emerald-800">
                      {totalCommission.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-left font-bold text-slate-700">
                      {totalExemptSales.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-left font-black text-amber-800">
                      {totalExemptCommission.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-left font-black text-slate-950 text-sm bg-slate-200/70">
                      {totalGrandCommission.toFixed(2)} {settings.currency}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

