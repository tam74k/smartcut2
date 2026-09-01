import { useState, useMemo } from 'react';
import { AppSettings, Transaction, Invoice, Branch, TipRecord } from '../types';
import { Calendar, FileBarChart, Download, TrendingUp, TrendingDown, DollarSign, Printer, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { ClosingReportReceipt } from './ClosingReportReceipt';
import { ServicesReportReceipt } from './ServicesReportReceipt';
import { EmployeesReportReceipt } from './EmployeesReportReceipt';
import { ExpensesReportReceipt } from './ExpensesReportReceipt';
import { IncomeReportReceipt } from './IncomeReportReceipt';
import { CustodyReportReceipt } from './CustodyReportReceipt';
import { exportToExcel } from '../utils/exportExcel';
import { handlePrintReceipt } from '../utils/print';

export function ReportsScreen({ 
  settings, 
  transactions, 
  invoices, 
  employees = [], 
  services = [], 
  products = [],
  activeBranchId,
  branches = [],
  tips = [],
  fingerprintLogs = [],
  expenses = [],
  purchases = [],
  supplierPayments = []
}: { 
  settings: AppSettings, 
  transactions: Transaction[], 
  invoices: Invoice[], 
  employees: any[], 
  services: any[], 
  products?: any[],
  activeBranchId?: string,
  branches?: Branch[],
  tips?: TipRecord[],
  fingerprintLogs?: any[],
  expenses?: any[],
  purchases?: any[],
  supplierPayments?: any[]
}) {

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
        totalExpenses: 0,
        totalSalaries: 0,
        totalAdvances: 0,
        totalPurchasesPaid: 0,
        totalSupplierPayments: 0,
        totalPurchasesAndSuppliers: 0,
        totalCommissions: 0,
        netProfit: 0,
        profitMargin: 0,
        periodInvoicesCount: 0,
        breakdownList: []
      };
    }

    // 1. Gross Invoiced Income (إجمالي الدخل من الفواتير)
    const periodInvoices = branchInvoices.filter(inv => {
      const d = (inv.date || '').split('T')[0];
      return d >= activeFrom && d <= activeTo && inv.status !== 'cancelled';
    });

    const grossIncome = periodInvoices.reduce((sum, inv) => {
      const paid = inv.paidAmount !== undefined ? Number(inv.paidAmount) : Number(inv.total) || 0;
      return sum + paid;
    }, 0);

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
    const totalPurchasesPaid = periodPurchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);

    const periodSupplierPayments = (supplierPayments || []).filter(sp => {
      const d = (sp.paymentDate || sp.date || '').split('T')[0];
      const isBranchMatch = matchesActiveBranch(sp.branchId);
      return d >= activeFrom && d <= activeTo && isBranchMatch;
    });
    const totalSupplierPayments = periodSupplierPayments.reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
    const totalPurchasesAndSuppliers = totalPurchasesPaid + totalSupplierPayments;

    // 5. Employee Commissions (عمولات الموظفين)
    let totalCommissions = 0;
    periodInvoices.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        totalCommissions += Number(item.employeeCommission || item.commissionAmount || 0);
      });
    });

    if (totalCommissions === 0) {
      branchEmployees.forEach(emp => {
        (emp.financialRecords || []).forEach((rec: any) => {
          const d = (rec.date || '').split('T')[0];
          if (d >= activeFrom && d <= activeTo && (rec.type === 'commission' || rec.type === 'service_commission')) {
            totalCommissions += Number(rec.amount) || 0;
          }
        });
      });
    }

    // 6. Net Profit Calculation:
    // صافي الربح = إجمالي الدخل - المصروفات - الرواتب - السلف - (المسدد في المشتريات + دفعات الموردين) - العمولات
    const totalDeductions = totalExpenses + totalSalaries + totalAdvances + totalPurchasesAndSuppliers + totalCommissions;
    const netProfit = grossIncome - totalDeductions;
    const profitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

    const breakdownList = [
      { id: 'income', label: 'إجمالي الدخل المحصل من الفواتير', amount: grossIncome, type: 'plus', percent: 100, note: `${periodInvoices.length} فاتورة مسددة` },
      { id: 'expenses', label: 'جميع المصروفات التشغيلية والنثرية', amount: totalExpenses, type: 'minus', percent: grossIncome > 0 ? (totalExpenses / grossIncome) * 100 : 0, note: 'مصروفات الإيجار والفواتير والنثريات' },
      { id: 'salaries', label: 'الرواتب الأساسية ومسيرات الصرف', amount: totalSalaries, type: 'minus', percent: grossIncome > 0 ? (totalSalaries / grossIncome) * 100 : 0, note: 'مسيرات الرواتب المنصرفة للكادر' },
      { id: 'advances', label: 'سلف الموظفين المصروفة', amount: totalAdvances, type: 'minus', percent: grossIncome > 0 ? (totalAdvances / grossIncome) * 100 : 0, note: 'السلف الممنوحة خلال هذه الفترة' },
      { id: 'purchases', label: 'المسدد في فواتير المشتريات', amount: totalPurchasesPaid, type: 'minus', percent: grossIncome > 0 ? (totalPurchasesPaid / grossIncome) * 100 : 0, note: 'دفعات فواتير مخزون المنتجات والمستلزمات' },
      { id: 'supplier_payments', label: 'سندات دفعات وسداد الموردين', amount: totalSupplierPayments, type: 'minus', percent: grossIncome > 0 ? (totalSupplierPayments / grossIncome) * 100 : 0, note: 'المبالغ المسددة لسندات وصكوك الموردين' },
      { id: 'commissions', label: 'عمولات الموظفين على الخدمات والمنتجات', amount: totalCommissions, type: 'minus', percent: grossIncome > 0 ? (totalCommissions / grossIncome) * 100 : 0, note: 'استحقاقات الفنيين عن المبيعات المنجزة' },
      { id: 'net_profit', label: 'صافي الربح الفعلي بعد كافة الاستقطاعات', amount: netProfit, type: 'result', percent: profitMargin, note: `هامش الربح الصافي: ${profitMargin.toFixed(1)}%` }
    ];

    return {
      grossIncome,
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
      periodInvoicesCount: periodInvoices.length,
      breakdownList
    };
  }, [activeFrom, activeTo, branchInvoices, branchTransactions, expenses, branchEmployees, purchases, supplierPayments, matchesActiveBranch]);

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

        const scheduledCheckOut = shiftSchedule.checkOutTime || '18:00';
        const schedOutParts = scheduledCheckOut.split(':').map(Number);
        const totalSchedOutMin = schedOutParts[0] * 60 + (schedOutParts[1] || 0);

        const dayLogs = (fingerprintLogs || []).filter(l => 
          (l.employeeId === emp.id || (emp.fingerprintCode && l.fingerprintCode === emp.fingerprintCode)) &&
          (l.timestamp && l.timestamp.startsWith(dateStr))
        ).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        const checkInLog = dayLogs.find(l => l.type === 'check_in') || dayLogs[0];
        const checkOutLog = dayLogs.filter(l => l.type === 'check_out').pop() || (dayLogs.length > 1 ? dayLogs[dayLogs.length - 1] : null);

        if (checkOutLog && checkOutLog !== checkInLog) {
          const outTimeStr = checkOutLog.timestamp.includes('T') ? checkOutLog.timestamp.split('T')[1].substring(0, 5) : checkOutLog.timestamp.split(' ')[1]?.substring(0, 5);
          if (outTimeStr) {
            const outParts = outTimeStr.split(':').map(Number);
            const actualOutMin = outParts[0] * 60 + (outParts[1] || 0);

            if (actualOutMin > totalSchedOutMin) {
              const rawOt = actualOutMin - totalSchedOutMin;
              const otGrace = hr.overtimeGraceMinutes ?? 30;
              if (rawOt > otGrace) {
                const overtimeMinutes = rawOt;
                const overtimeHours = (overtimeMinutes / 60);
                
                let hourlyRate = 25;
                let rateLabel = '';
                if (hr.overtimeRateType === 'custom_fixed_amount') {
                  hourlyRate = Number(hr.customOvertimeHourlyRate) || 25;
                  rateLabel = `${hourlyRate} ${settings.currency} (مبلغ محدد)`;
                } else if (hr.overtimeRateType === '2x') {
                  const baseHourly = (emp.baseSalary > 0 ? emp.baseSalary / 30 : 0) / 8;
                  hourlyRate = (baseHourly > 0 ? baseHourly : 25) * 2;
                  rateLabel = `2.0x (${hourlyRate.toFixed(1)} ${settings.currency}/س)`;
                } else if (hr.overtimeRateType === '1.5x') {
                  const baseHourly = (emp.baseSalary > 0 ? emp.baseSalary / 30 : 0) / 8;
                  hourlyRate = (baseHourly > 0 ? baseHourly : 25) * 1.5;
                  rateLabel = `1.5x (${hourlyRate.toFixed(1)} ${settings.currency}/س)`;
                } else {
                  const baseHourly = (emp.baseSalary > 0 ? emp.baseSalary / 30 : 0) / 8;
                  hourlyRate = baseHourly > 0 ? baseHourly : 25;
                  rateLabel = `1.0x (${hourlyRate.toFixed(1)} ${settings.currency}/س)`;
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
                  actualCheckOut: outTimeStr,
                  overtimeMinutes,
                  overtimeHours: overtimeHours.toFixed(2),
                  hourlyRate: hourlyRate.toFixed(2),
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
  }, [activeFrom, activeTo, branchEmployees, selectedOvertimeEmpId, fingerprintLogs, settings.hrSettings, settings.currency]);

  const stats = useMemo(() => {
    const start = new Date(activeFrom);
    const end = new Date(activeTo);
    end.setHours(23, 59, 59, 999);

    const filteredTransactions = branchTransactions.filter(t => {
      const tDateStr = t.date.split('T')[0];
      return tDateStr >= activeFrom && tDateStr <= activeTo;
    });

    const income = filteredTransactions
      .filter(t => t.type === 'in' && t.category !== 'transfer' && t.category !== 'عهدة افتتاحية' && t.category !== 'initial_cash')
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
    const instantCashTips = filteredTips.filter(t => (t.payoutMethod === 'instant_cash' || (!t.payoutMethod && t.status === 'paid_out'))).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
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

  const handleExport = () => {
    const filename = `تقرير_${activeReportType}_${activeFrom}_${activeTo}`;
    if (activeReportType === 'income') {
      const headers = ['رقم الحركة', 'التاريخ', 'النوع', 'المبلغ', 'البيان', 'الخزينة'];
      const filtered = transactions.filter(t => {
        const d = t.date.split('T')[0];
        return d >= activeFrom && d <= activeTo;
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
        const d = t.date.split('T')[0];
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
        const d = t.date.split('T')[0];
        return d >= activeFrom && d <= activeTo && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash');
      });
      const rows = filtered.map(t => [
        t.id,
        t.date,
        t.shiftDate || t.date.split('T')[0],
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
          s.totalOtHours.toFixed(2),
          s.totalOtAmount.toFixed(2)
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
          r.overtimeAmount.toFixed(2)
        ]);
        exportToExcel(filename, 'تفاصيل_الأوفر_تايم_يومي', headers, rows);
      }
    } else if (activeReportType === 'net_profit') {
      const headers = ['البند المالي', 'نوع التأثير', 'المبلغ المستحق', 'النسبة المئوية من الدخل', 'الملاحظات'];
      const rows = netProfitReportData.breakdownList.map(b => [
        b.label,
        b.type === 'plus' ? 'إيراد (+)' : b.type === 'minus' ? 'استقطاع / تكلفة (-)' : 'صافي النتيجة (=)',
        b.amount.toFixed(2),
        `${b.percent.toFixed(1)}%`,
        b.note
      ]);
      exportToExcel(filename, 'تقرير_صافي_الأرباح_وقائمة_الدخل', headers, rows);
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
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
              <option value="income">تقرير الدخل التفصيلي</option>
              <option value="closing">تقرير إغلاق اليوم</option>
              <option value="employees">أعمال وعمولات الموظفين</option>
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
                  {netProfitReportData.netProfit >= 0 ? '+' : ''}{netProfitReportData.netProfit.toFixed(2)}
                  <span className="text-xs font-normal text-slate-300 mr-1.5">{settings.currency}</span>
                </div>
                <div className="text-[11px] font-bold text-slate-300 mt-1">
                  هامش الربح: <span className={netProfitReportData.netProfit >= 0 ? 'text-emerald-300 font-mono' : 'text-rose-300 font-mono'}>{netProfitReportData.profitMargin.toFixed(1)}%</span>
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
                  {netProfitReportData.grossIncome.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">{netProfitReportData.periodInvoicesCount} فاتورة مسددة</p>
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
                  {netProfitReportData.totalExpenses.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
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
                  {netProfitReportData.totalSalaries.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
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
                  {netProfitReportData.totalAdvances.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">السلف المنصرفة للفترة</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Wallet size={22} />
              </div>
            </div>

            {/* 5. Purchases & Suppliers (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-purple-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">5. المشتريات والموردين (-)</p>
                <h4 className="text-xl font-black text-purple-600 font-mono">
                  {netProfitReportData.totalPurchasesAndSuppliers.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">مشتريات: {netProfitReportData.totalPurchasesPaid.toFixed(1)} + موردين: {netProfitReportData.totalSupplierPayments.toFixed(1)}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <FileBarChart size={22} />
              </div>
            </div>

            {/* 6. Employee Commissions (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-teal-500 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">6. عمولات الموظفين (-)</p>
                <h4 className="text-xl font-black text-teal-600 font-mono">
                  {netProfitReportData.totalCommissions.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">عمولات الخدمات والمنتجات</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <CheckCircle2 size={22} />
              </div>
            </div>

            {/* 7. Total Deductions (-) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-slate-700 flex justify-between items-center">
              <div>
                <p className="text-slate-500 text-xs font-bold mb-1">إجمالي التكاليف والاستقطاعات</p>
                <h4 className="text-xl font-black text-slate-800 font-mono">
                  {netProfitReportData.totalDeductions.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">مجموع البنود (2 + 3 + 4 + 5 + 6)</p>
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
                  {netProfitReportData.netProfit.toFixed(2)} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
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
      ) : isGenerated && activeReportType === 'overtime' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold mb-1">إجمالي ساعات الإضافي</p>
              <h4 className="text-2xl font-black text-indigo-600 font-mono">
                {overtimeReportData.totalHours.toFixed(1)} <span className="text-xs font-normal text-slate-400">ساعة</span>
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
                {overtimeReportData.totalAmount.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
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
                {stats.totalTips.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
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
                {stats.instantCashTips.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
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
                {stats.pendingTips.toFixed(2)} <span className="text-xs font-normal text-slate-400">{settings.currency}</span>
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
                {stats.totalCustody.toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span>
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
                {stats.custodyAvg.toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span>
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
              <h4 className="text-3xl font-extrabold text-slate-800">{stats.income.toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span></h4>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-red-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-sm font-bold mb-2">إجمالي المصروفات</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{stats.expense.toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span></h4>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <TrendingDown size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-r-4 border-r-blue-500 flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-sm font-bold mb-2">صافي الربح</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{stats.profit.toFixed(2)} <span className="text-base font-normal text-slate-400">{settings.currency}</span></h4>
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
            transactions={transactions} 
            invoices={invoices} 
            settings={settings}
            employees={employees}
            services={services}
            products={products}
            fingerprintLogs={fingerprintLogs}
            branchTips={branchTips}
            overtimeReportData={overtimeReportData}
            overtimeViewMode={overtimeViewMode}
            setOvertimeViewMode={setOvertimeViewMode}
            selectedOvertimeEmpId={selectedOvertimeEmpId}
            setSelectedOvertimeEmpId={setSelectedOvertimeEmpId}
            stats={stats}
            netProfitReportData={netProfitReportData}
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
  transactions, 
  invoices, 
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
  netProfitReportData
}: any) {
  const start = new Date(activeFrom);
  const end = new Date(activeTo);
  end.setHours(23, 59, 59, 999);

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
      <div className="flex flex-col items-center py-8 bg-slate-200 overflow-x-auto w-full">
        <button onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-income-receipt', true)); }} className="mb-6 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 print:hidden">
          <Printer size={18} /> طباعة التقرير (A4 بالعرض)
        </button>
        <div className="bg-white shadow-xl overflow-x-auto max-w-full">
          <IncomeReportReceipt 
            settings={settings}
            transactions={transactions}
            startDate={activeFrom}
            endDate={activeTo}
            dateLabel={dateLabel}
          />
        </div>
      </div>
    );
  }

  if (reportType === 'initial_cash') {
    const custodyTrxs = transactions.filter((t: Transaction) => {
      const tDateStr = t.date.split('T')[0];
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
              إجمالي مبالغ العهد المسجلة: <span className="font-bold font-mono text-slate-900">{totalCustody.toFixed(2)} {settings.currency}</span> ({custodyTrxs.length} وردية)
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
                    <td className="py-3 px-4 font-bold text-slate-800">{t.shiftDate || t.date.split('T')[0]}</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{new Date(t.date).toLocaleTimeString('ar-SA')}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-md">
                        {t.userName || t.createdBy || 'الكاشير'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">{getTreasuryName(t.treasury)}</td>
                    <td className="py-3 px-4 text-slate-500">{t.description || 'عهدة افتتاحية لبدء الوردية'}</td>
                    <td className="py-3 px-4 text-left font-mono font-black text-amber-600 text-sm">
                      +{t.amount.toFixed(2)} {settings.currency}
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
                    {totalCustody.toFixed(2)} {settings.currency}
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
          />
        </div>
      </div>
    );
  }

  
  if (reportType === 'expenses') {
    const filteredTransactions = transactions.filter((t: Transaction) => {
      const tDateStr = t.date.split('T')[0];
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
          />
        </div>
      </div>
    );
  }

  if (reportType === 'closing') {
    const filteredTransactions = transactions.filter((t: Transaction) => {
      const tDateStr = t.date.split('T')[0]; return tDateStr >= activeFrom && tDateStr <= activeTo;
    });
    const filteredInvoices = invoices.filter((i: Invoice) => {
      const iDateStr = i.date.split('T')[0]; return iDateStr >= activeFrom && iDateStr <= activeTo;
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
          />
        </div>
      </div>
    );
  }

  
  if (reportType === 'services_report') {
    const filteredInvoices = invoices.filter((i: Invoice) => {
      const iDateStr = i.date.split('T')[0]; return iDateStr >= activeFrom && iDateStr <= activeTo;
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
          />
        </div>
      </div>
    );
  }

  
  if (reportType === 'employees') {
    const filteredInvoices = invoices.filter((i: Invoice) => {
      const iDateStr = i.date.split('T')[0]; return iDateStr >= activeFrom && iDateStr <= activeTo;
    });

    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`;

    return (
      <div className="flex flex-col items-center py-8 bg-slate-200">
        <button onClick={() => { import('../utils/print').then(m => m.handlePrintReceipt('print-employees-receipt')); }} className="mb-6 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 print:hidden">
          <Printer size={18} /> طباعة التقرير
        </button>
        <div className="bg-white shadow-xl">
          <EmployeesReportReceipt 
            settings={settings}
            invoices={filteredInvoices}
            employees={employees}
            services={services}
            products={products}
            dateLabel={dateLabel}
          />
        </div>
      </div>
    );
  }

  if (reportType === 'initial_cash') {
    const custodyTrxs = transactions.filter((t: Transaction) => {
      const tDateStr = t.date.split('T')[0];
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
                {totalCustody.toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
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
                {custodyTrxs.length > 0 ? (totalCustody / custodyTrxs.length).toFixed(2) : '0.00'} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
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
                    <td className="py-3 px-4 font-bold text-slate-900">{trx.shiftDate || trx.date.split('T')[0]}</td>
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
                      +{trx.amount.toFixed(2)} <span className="text-[10px] font-bold text-slate-400">{settings.currency}</span>
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
                {stats.totalTips.toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
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
                {stats.instantCashTips.toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
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
                {stats.pendingTips.toFixed(2)} <span className="text-xs font-bold text-slate-400">{settings.currency}</span>
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
                      <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg font-extrabold border border-purple-200 inline-flex items-center gap-1">
                        👤 {tip.employeeName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {tip.paymentMethod === 'card' ? 'شبكة / بطاقة' : tip.paymentMethod === 'transfer' ? 'تحويل بنكي' : tip.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-black text-sm text-emerald-600">
                      +{tip.amount.toFixed(2)} <span className="text-[10px] font-bold text-slate-400">{settings.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tip.status === 'paid_out' ? (
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
                      <td className="py-3 px-4 font-mono text-slate-700">{row.baseSalary > 0 ? `${row.baseSalary.toFixed(2)} ${settings.currency}` : 'نسبة فقط'}</td>
                      <td className="py-3 px-4">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-bold border border-indigo-200">
                          {row.rateType === 'custom_fixed_amount' ? `${row.customHourlyRate} ${settings.currency}/ساعة (مبلغ محدد)` : row.rateType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 text-center">{row.otDaysCount} يوم</td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-center">{row.totalOtMinutes} دقيقة</td>
                      <td className="py-3 px-4 font-mono font-black text-indigo-700 text-center">{row.totalOtHours.toFixed(2)} ساعة</td>
                      <td className="py-3 px-4 font-mono font-black text-sm text-emerald-600 text-left pl-6">
                        {row.totalOtAmount.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
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
                      <td className="py-3 px-4 text-center font-mono text-indigo-700">{totalHours.toFixed(2)} ساعة</td>
                      <td className="py-3 px-4 font-mono text-emerald-700 text-left pl-6 font-black text-sm">
                        {totalAmount.toFixed(2)} {settings.currency}
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
                        +{row.overtimeAmount.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
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
                      <td className="py-3 px-4 text-center font-mono text-indigo-700">{totalHours.toFixed(2)} س</td>
                      <td></td>
                      <td className="py-3 px-4 font-mono text-emerald-700 text-left pl-6 font-black text-sm">
                        {totalAmount.toFixed(2)} {settings.currency}
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
                {netProfitReportData.profitMargin.toFixed(1)}% هامش الربح
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">الفترة الزمنية: <span className="font-mono font-bold text-slate-700">{dateLabel}</span> • {settings.salonName}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-xs font-black border ${netProfitReportData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
              صافي الربح: <span className="font-mono text-sm">{netProfitReportData.netProfit.toFixed(2)} {settings.currency}</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Composition of Revenue */}
        <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
            <span>توزيع عناصر المعادلة من إجمالي الدخل:</span>
            <span className="font-mono text-emerald-700">{netProfitReportData.grossIncome.toFixed(2)} {settings.currency} (100%)</span>
          </div>
          <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
            <div title={`مصروفات: ${netProfitReportData.totalExpenses.toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalExpenses / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-rose-500 h-full"></div>
            <div title={`رواتب: ${netProfitReportData.totalSalaries.toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalSalaries / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-blue-500 h-full"></div>
            <div title={`سلف: ${netProfitReportData.totalAdvances.toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalAdvances / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-amber-500 h-full"></div>
            <div title={`مشتريات وموردين: ${netProfitReportData.totalPurchasesAndSuppliers.toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalPurchasesAndSuppliers / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-purple-500 h-full"></div>
            <div title={`عمولات: ${netProfitReportData.totalCommissions.toFixed(1)}`} style={{ width: `${Math.min(100, (netProfitReportData.totalCommissions / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-teal-500 h-full"></div>
            {netProfitReportData.netProfit > 0 && (
              <div title={`صافي الربح: ${netProfitReportData.netProfit.toFixed(1)}`} style={{ width: `${Math.max(0, (netProfitReportData.netProfit / (netProfitReportData.grossIncome || 1)) * 100)}%` }} className="bg-emerald-500 h-full"></div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2.5 text-[11px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> مصروفات</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> رواتب</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> سلف</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> مشتريات وموردين</span>
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
                    {item.percent.toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs">
                    {item.note}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-black text-sm text-left pl-6">
                    <span className={item.type === 'plus' ? 'text-emerald-600' : item.type === 'minus' ? 'text-rose-600' : item.amount >= 0 ? 'text-emerald-700 text-base' : 'text-rose-700 text-base'}>
                      {item.type === 'minus' ? '-' : item.type === 'plus' ? '+' : ''}{item.amount.toFixed(2)}
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
                  {netProfitReportData.netProfit >= 0 ? '+' : ''}{netProfitReportData.netProfit.toFixed(2)} {settings.currency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return null;
}

