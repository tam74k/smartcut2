import React, { useState, useMemo } from 'react';
import { 
  AppSettings, 
  Invoice, 
  Transaction, 
  Branch, 
  Employee, 
  Service, 
  AppUser 
} from '../types';
import { 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  Printer, 
  Download, 
  DollarSign, 
  Users, 
  Receipt, 
  TrendingDown, 
  TrendingUp, 
  Wallet,
  Sparkles,
  TableProperties
} from 'lucide-react';
import { calculateEmployeeCommission, getCommissionModelLabel } from '../utils/commissionHelper';
import { exportToExcel } from '../utils/exportExcel';

interface DailySheetScreenProps {
  settings: AppSettings;
  invoices: Invoice[];
  transactions: Transaction[];
  expenses?: any[];
  employees: Employee[];
  services: Service[];
  branches?: Branch[];
  activeBranchId?: string;
  currentUser?: AppUser | null;
}

export function DailySheetScreen({
  settings,
  invoices = [],
  transactions = [],
  expenses = [],
  employees = [],
  services = [],
  branches = [],
  activeBranchId,
  currentUser
}: DailySheetScreenProps) {
  // Current selected date in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Navigate dates
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

  // Helper date checker
  const isMatchDate = (dateStr?: string) => {
    if (!dateStr) return false;
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    return clean === selectedDate;
  };

  // 1. Registered payment methods / treasuries (Dynamic based on settings.treasuries)
  const registeredMethods = useMemo(() => {
    const treasuries = settings.treasuries || [];
    if (treasuries.length > 0) {
      return treasuries.map(t => ({
        id: t.id,
        name: t.name || t.id
      }));
    }
    return [
      { id: 'cash', name: 'كاش' },
      { id: 'card', name: 'فيزا' },
      { id: 'instapay', name: 'انستاباي' },
      { id: 'vodafone', name: 'فودافون' }
    ];
  }, [settings.treasuries]);

  // 2. Filter invoices on selected date
  const dayInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      return isMatchDate(inv.date);
    });
  }, [invoices, selectedDate]);

  // 3. Find active employees who provided services on this date
  const activeEmployees = useMemo(() => {
    const empMap = new Map<string, { id: string; name: string; empObj?: Employee }>();

    dayInvoices.forEach(inv => {
      (inv.items || []).forEach(it => {
        const empId = it.technicianId || it.technicianName;
        const empName = it.technicianName || employees.find(e => e.id === it.technicianId)?.name;
        if (empId && empName) {
          if (!empMap.has(empId)) {
            const empObj = employees.find(e => e.id === empId || e.name === empName);
            empMap.set(empId, {
              id: empId,
              name: empName.trim(),
              empObj
            });
          }
        }
      });
    });

    return Array.from(empMap.values());
  }, [dayInvoices, employees]);

  // 4. Map invoices per employee
  // Under each active employee, list their invoices with invoice ID, methods amounts, and wasel
  const employeeData = useMemo(() => {
    return activeEmployees.map(emp => {
      // Find all invoices where this employee has services
      const invoicesForEmp: Array<{
        invoiceId: string;
        methodAmounts: Record<string, number>;
        waselAmount: number;
        totalAmount: number;
        commission: number;
      }> = [];

      let totalSales = 0;
      let totalCommission = 0;
      const methodTotals: Record<string, number> = {};
      registeredMethods.forEach(m => { methodTotals[m.id] = 0; });
      let totalWasel = 0;

      dayInvoices.forEach(inv => {
        // Find items of this technician
        const empItems = (inv.items || []).filter(it => 
          (it.technicianId && it.technicianId === emp.id) || 
          (it.technicianName && it.technicianName.trim() === emp.name)
        );

        if (empItems.length === 0) return;

        // Technician's gross share of items
        const empItemsTotal = empItems.reduce((sum, it) => {
          const p = Number(it.price || it.originalPrice || 0);
          const q = Number(it.quantity || 1);
          return sum + (p * q);
        }, 0);

        // Commission for these items
        const empItemsCommission = empItems.reduce((sum, it) => {
          const c = Number(it.employeeCommission ?? it.commissionAmount ?? (it as any).commission ?? 0);
          return sum + c;
        }, 0);

        const isWasel = Boolean(inv.isWaselInvoice || inv.paymentMethod === 'wasel_free' || inv.paymentMethods?.some(pm => pm.treasuryId === 'wasel_free'));

        const methodAmounts: Record<string, number> = {};
        registeredMethods.forEach(m => { methodAmounts[m.id] = 0; });
        let waselAmount = 0;

        if (isWasel) {
          waselAmount = empItemsTotal;
          totalWasel += waselAmount;
        } else {
          // Total invoice effective paid amount
          const invSubtotal = Number(inv.subtotal || 0) > 0 ? Number(inv.subtotal) : Number(inv.total || empItemsTotal);
          const ratio = invSubtotal > 0 ? (empItemsTotal / invSubtotal) : 1;

          if (inv.paymentMethods && inv.paymentMethods.length > 0) {
            inv.paymentMethods.forEach(pm => {
              const matchedMethod = registeredMethods.find(m => m.id === pm.treasuryId || m.name === pm.treasuryId);
              const mKey = matchedMethod ? matchedMethod.id : registeredMethods[0]?.id || 'cash';
              const allocated = Number(pm.amount || 0) * ratio;
              methodAmounts[mKey] = (methodAmounts[mKey] || 0) + allocated;
              methodTotals[mKey] = (methodTotals[mKey] || 0) + allocated;
            });
          } else {
            const singleMethod = inv.paymentMethod || 'cash';
            const matchedMethod = registeredMethods.find(m => m.id === singleMethod || m.name === singleMethod);
            const mKey = matchedMethod ? matchedMethod.id : registeredMethods[0]?.id || 'cash';
            methodAmounts[mKey] = (methodAmounts[mKey] || 0) + empItemsTotal;
            methodTotals[mKey] = (methodTotals[mKey] || 0) + empItemsTotal;
          }
          totalSales += empItemsTotal;
        }

        totalCommission += empItemsCommission;

        invoicesForEmp.push({
          invoiceId: inv.id,
          methodAmounts,
          waselAmount,
          totalAmount: empItemsTotal,
          commission: empItemsCommission
        });
      });

      // If item-level commissions were 0, compute via model
      let finalCommission = totalCommission;
      if (finalCommission <= 0 && emp.empObj) {
        finalCommission = calculateEmployeeCommission(emp.empObj, totalSales);
      }

      const commissionLabel = emp.empObj ? getCommissionModelLabel(emp.empObj) : 'نسبة افتراضية';

      return {
        empId: emp.id,
        empName: emp.name,
        empObj: emp.empObj,
        invoices: invoicesForEmp,
        invoiceCount: invoicesForEmp.length,
        methodTotals,
        totalWasel,
        totalSales,
        totalCommission: finalCommission,
        commissionLabel
      };
    });
  }, [activeEmployees, dayInvoices, registeredMethods]);

  // 5. Staff Payments (المدفوعات: السلف والرواتب)
  const staffPayments = useMemo(() => {
    return transactions.filter(t => {
      if (!isMatchDate(t.date)) return false;
      const cat = String(t.category || '').toLowerCase();
      const expCat = String(t.expenseCategory || '').toLowerCase();
      const isAdvance = (
        cat === 'staff_advance' || 
        cat === 'hr_advance' || 
        cat === 'advance' || 
        cat === 'commission_payout' || 
        cat === 'salary' || 
        cat === 'سلفة موظف' ||
        expCat.includes('سلف') || 
        expCat.includes('رواتب') || 
        expCat.includes('مرتبات')
      );
      return (t.type === 'out' || (t.type as string) === 'expense') && isAdvance;
    }).map(t => {
      const empName = t.userName || (t as any).employeeName || employees.find(e => e.id === t.userId || e.id === (t as any).employeeId)?.name || t.description || 'سلفة موظف';
      return {
        id: t.id,
        name: empName,
        amount: Number(t.amount || 0)
      };
    });
  }, [transactions, selectedDate, employees]);

  const totalStaffPayments = useMemo(() => {
    return staffPayments.reduce((s, p) => s + p.amount, 0);
  }, [staffPayments]);

  // 6. Operational Expenses (المصروفات اليومية)
  const dayExpenses = useMemo(() => {
    return transactions.filter(t => {
      if (!isMatchDate(t.date)) return false;
      const cat = String(t.category || '').toLowerCase();
      const expCat = String(t.expenseCategory || '').toLowerCase();
      const isAdvance = (
        cat === 'staff_advance' || 
        cat === 'hr_advance' || 
        cat === 'advance' || 
        cat === 'commission_payout' || 
        cat === 'salary' || 
        cat === 'سلفة موظف' ||
        expCat.includes('سلف') || 
        expCat.includes('رواتب') || 
        expCat.includes('مرتبات')
      );
      return (t.type === 'out' || (t.type as string) === 'expense') && !isAdvance;
    }).map(t => {
      return {
        id: t.id,
        type: t.description || t.expenseCategory || 'مصروف عام',
        amount: Number(t.amount || 0)
      };
    });
  }, [transactions, selectedDate]);

  const totalDayExpenses = useMemo(() => {
    return dayExpenses.reduce((s, e) => s + e.amount, 0);
  }, [dayExpenses]);

  // 7. Max rows count to build perfectly aligned grid
  const maxRows = useMemo(() => {
    const empMax = employeeData.reduce((max, e) => Math.max(max, e.invoices.length), 0);
    return Math.max(empMax, staffPayments.length, dayExpenses.length, 1);
  }, [employeeData, staffPayments, dayExpenses]);

  // 8. Overall totals
  const overallMethodTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    registeredMethods.forEach(m => { totals[m.id] = 0; });
    employeeData.forEach(e => {
      registeredMethods.forEach(m => {
        totals[m.id] += (e.methodTotals[m.id] || 0);
      });
    });
    return totals;
  }, [employeeData, registeredMethods]);

  const totalOverallWasel = useMemo(() => {
    return employeeData.reduce((s, e) => s + e.totalWasel, 0);
  }, [employeeData]);

  const totalGrandIncome = useMemo(() => {
    return Object.values(overallMethodTotals).reduce((s, val) => s + val, 0);
  }, [overallMethodTotals]);

  const netIncome = useMemo(() => {
    return totalGrandIncome - totalStaffPayments - totalDayExpenses;
  }, [totalGrandIncome, totalStaffPayments, totalDayExpenses]);

  // Total columns calculation for colspans
  // Per employee: 1 (ID) + registeredMethods.length + 1 (Wasel)
  const colsPerEmployee = 1 + registeredMethods.length + 1;
  const totalEmployeeCols = activeEmployees.length * colsPerEmployee;
  // + 1 separator + 2 payments + 2 expenses
  const totalTableCols = totalEmployeeCols + 1 + 2 + 2;

  // Print function with dynamic zoom based on column count
  const handlePrintDailySheet = () => {
    const printArea = document.getElementById('daily-sheet-print-container');
    if (!printArea) return;

    // Calculate dynamic zoom for A4 Landscape
    // Default 65% for ~10 barbers, scale up if fewer, scale down if more
    const colsCount = totalTableCols;
    let zoomPercent = 65;
    if (colsCount <= 20) zoomPercent = 85;
    else if (colsCount <= 35) zoomPercent = 70;
    else if (colsCount <= 50) zoomPercent = 58;
    else zoomPercent = 48;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>الكشف اليومي - ${selectedDate}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { 
      font-family: 'Cairo', sans-serif; 
      padding: 10px; 
      margin: 0; 
      background-color: #fff; 
      direction: rtl;
    }
    h2 { 
      text-align: center; 
      margin-bottom: 12px; 
      text-decoration: underline; 
      font-weight: 800; 
      font-size: 18px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      text-align: center; 
      font-size: 11px; 
      direction: rtl;
    }
    th, td { 
      border: 1px solid #000; 
      padding: 4px; 
      white-space: nowrap; 
    }
    @media print {
      @page { 
        size: landscape; 
        margin: 5mm; 
      }
      body { 
        padding: 0; 
        margin: 0; 
        zoom: ${zoomPercent}%; 
      }
      table { 
        width: 100%; 
        max-width: 100%; 
        table-layout: auto; 
      }
      th, td { 
        white-space: normal !important; 
        word-wrap: break-word !important; 
        font-size: 10px !important; 
        padding: 2px !important; 
      }
      thead { display: table-header-group !important; }
      tfoot { display: table-footer-group !important; }
      tr { page-break-inside: avoid !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <h2>تقرير اليومية: ${selectedDate} - ${settings.salonName || 'صالون'}</h2>
  ${printArea.innerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
    `);
    printWindow.document.close();
  };

  // Excel Export
  const handleExportExcel = () => {
    const headers = ['م'];
    activeEmployees.forEach(emp => {
      headers.push(`${emp.name} - رقم`);
      registeredMethods.forEach(m => headers.push(`${emp.name} - ${m.name}`));
      headers.push(`${emp.name} - واصل`);
    });
    headers.push('المدفوعات - الاسم', 'المدفوعات - المبلغ', 'المصروفات - النوع', 'المصروفات - المبلغ');

    const rows: any[][] = [];
    for (let r = 0; r < maxRows; r++) {
      const rowData: any[] = [r + 1];

      activeEmployees.forEach((emp, empIdx) => {
        const empInfo = employeeData[empIdx];
        const inv = empInfo?.invoices[r];
        if (inv) {
          rowData.push(inv.invoiceId);
          registeredMethods.forEach(m => rowData.push(inv.methodAmounts[m.id] ? inv.methodAmounts[m.id].toFixed(2) : ''));
          rowData.push(inv.waselAmount ? inv.waselAmount.toFixed(2) : '');
        } else {
          rowData.push('');
          registeredMethods.forEach(() => rowData.push(''));
          rowData.push('');
        }
      });

      const p = staffPayments[r];
      rowData.push(p ? p.name : '', p ? p.amount.toFixed(2) : '');

      const e = dayExpenses[r];
      rowData.push(e ? e.type : '', e ? e.amount.toFixed(2) : '');

      rows.push(rowData);
    }

    exportToExcel(`الكشف_اليومي_${selectedDate}`, [
      headers,
      ...rows,
      ['', ...activeEmployees.flatMap((_, idx) => [`العدد: ${employeeData[idx]?.invoiceCount}`, ...registeredMethods.map(() => ''), '']), '', `م: ${totalStaffPayments.toFixed(2)}`, '', `م: ${totalDayExpenses.toFixed(2)}`],
      ['', ...activeEmployees.flatMap((_, idx) => [`الإجمالي: ${employeeData[idx]?.totalSales.toFixed(2)}`, ...registeredMethods.map(() => ''), '']), '', '', '', ''],
      ['', ...activeEmployees.flatMap((_, idx) => [`العمولة: ${employeeData[idx]?.totalCommission.toFixed(2)}`, ...registeredMethods.map(() => ''), '']), '', '', '', ''],
      [`إجمالي الدخل: ${totalGrandIncome.toFixed(2)}`, `صافي الدخل: ${netIncome.toFixed(2)}`]
    ]);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden animate-in fade-in">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shadow-xs">
              <TableProperties size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>الكشف اليومي للصالون</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg font-mono">
                  {selectedDate}
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                توزيع فواتير الحلاقين حسب طرق الدفع مع حصر السلف والمصروفات وصافي الدخل النهائي
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevDay}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-colors cursor-pointer"
              title="اليوم السابق"
            >
              <ChevronRight size={18} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-800 px-2.5 py-1 outline-hidden font-mono cursor-pointer"
            />
            <button
              onClick={handleNextDay}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-colors cursor-pointer"
              title="اليوم التالي"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          <button
            onClick={handleToday}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              selectedDate === todayStr 
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            اليوم
          </button>

          <button
            onClick={handlePrintDailySheet}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Printer size={15} />
            <span>طباعة الكشف / حفظ كـ PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500">الحلاقين النشطين</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900 font-mono">{activeEmployees.length}</span>
            <Users size={16} className="text-indigo-600" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500">فواتير اليوم</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900 font-mono">{dayInvoices.length}</span>
            <Receipt size={16} className="text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-700">إجمالي الدخل</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-emerald-700 font-mono">{totalGrandIncome.toFixed(0)}</span>
            <span className="text-[10px] text-emerald-600 font-bold">{settings.currency}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-orange-700">سلف ورواتب الموظفين</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-orange-700 font-mono">{totalStaffPayments.toFixed(0)}</span>
            <span className="text-[10px] text-orange-600 font-bold">{settings.currency}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-rose-700">المصروفات اليومية</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-rose-700 font-mono">{totalDayExpenses.toFixed(0)}</span>
            <span className="text-[10px] text-rose-600 font-bold">{settings.currency}</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-3.5 rounded-xl text-white shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-indigo-200">صافي الدخل (الخزينة)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-xl font-black font-mono ${netIncome >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
              {netIncome.toFixed(0)}
            </span>
            <span className="text-[10px] text-indigo-300 font-bold">{settings.currency}</span>
          </div>
        </div>
      </div>

      {/* Main Daily Sheet Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-3 sm:p-5">
        {activeEmployees.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
            <TableProperties size={40} className="text-slate-300 stroke-1" />
            <p className="text-base text-slate-600">لا توجد فواتير أو نشاط للموظفين في هذا التاريخ ({selectedDate})</p>
            <p className="text-xs text-slate-400">اختر يوماً آخر من شريط التاريخ بالأعلى لعرض الكشف اليومي الخاص به</p>
          </div>
        ) : (
          <div className="overflow-x-auto" id="daily-sheet-print-container">
            <table className="w-full text-center border-collapse text-xs" style={{ minWidth: `${Math.max(900, totalTableCols * 38)}px` }}>
              <thead>
                {/* Level 1: Employee Names & Categories */}
                <tr>
                  {activeEmployees.map(emp => (
                    <th 
                      key={emp.id} 
                      colSpan={colsPerEmployee} 
                      className="border border-black py-2 px-1 text-slate-900 font-black text-xs bg-slate-100"
                    >
                      {emp.name}
                    </th>
                  ))}
                  {/* Dark Separator Column */}
                  <th style={{ backgroundColor: '#333', width: '5px' }} className="border border-black p-0"></th>
                  {/* Staff Payments */}
                  <th 
                    colSpan={2} 
                    style={{ backgroundColor: '#ffccbc' }} 
                    className="border border-black py-2 px-2 text-orange-950 font-black text-xs"
                  >
                    المدفوعات
                  </th>
                  {/* Expenses */}
                  <th 
                    colSpan={2} 
                    style={{ backgroundColor: '#b3e5fc' }} 
                    className="border border-black py-2 px-2 text-blue-950 font-black text-xs"
                  >
                    المصروفات
                  </th>
                </tr>

                {/* Level 2: Sub-columns (رقم, كاش, فيزا, ..., واصل) */}
                <tr className="text-[11px] font-bold">
                  {activeEmployees.map(emp => (
                    <React.Fragment key={emp.id}>
                      <th className="border border-black py-1 px-1 bg-slate-50 text-slate-700 w-12">رقم</th>
                      {registeredMethods.map(m => (
                        <th key={m.id} className="border border-black py-1 px-1 bg-slate-50 text-slate-700 min-w-10">
                          {m.name}
                        </th>
                      ))}
                      <th className="border border-black py-1 px-1 bg-amber-50 text-amber-900 min-w-10">واصل</th>
                    </React.Fragment>
                  ))}
                  {/* Separator */}
                  <th style={{ backgroundColor: '#333' }} className="border border-black p-0"></th>
                  {/* Payments Subheaders */}
                  <th style={{ backgroundColor: '#ffe0b2' }} className="border border-black py-1 px-2 text-orange-900 font-bold min-w-24">الاسم</th>
                  <th style={{ backgroundColor: '#ffe0b2' }} className="border border-black py-1 px-1 text-orange-900 font-bold min-w-14">مبلغ</th>
                  {/* Expenses Subheaders */}
                  <th style={{ backgroundColor: '#e1f5fe' }} className="border border-black py-1 px-2 text-blue-900 font-bold min-w-28">نوع</th>
                  <th style={{ backgroundColor: '#e1f5fe' }} className="border border-black py-1 px-1 text-blue-900 font-bold min-w-14">مبلغ</th>
                </tr>
              </thead>

              <tbody>
                {Array.from({ length: maxRows }).map((_, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/50">
                    {/* Employee invoice cells */}
                    {activeEmployees.map((emp, empIdx) => {
                      const empData = employeeData[empIdx];
                      const inv = empData?.invoices[rIdx];

                      return (
                        <React.Fragment key={emp.id}>
                          {/* Invoice Number */}
                          <td 
                            style={{ backgroundColor: '#fcfcfc', color: '#c62828', fontWeight: 'bold' }} 
                            className="border border-black py-1 px-1 font-mono text-[11px]"
                          >
                            {inv ? inv.invoiceId : ''}
                          </td>

                          {/* Dynamic Payment Method Amounts */}
                          {registeredMethods.map(m => {
                            const val = inv?.methodAmounts[m.id];
                            return (
                              <td 
                                key={m.id} 
                                className="border border-black py-1 px-1 font-mono font-bold text-slate-800"
                              >
                                {val && val > 0 ? val.toFixed(0) : ''}
                              </td>
                            );
                          })}

                          {/* Wasel Column */}
                          <td 
                            style={{ backgroundColor: '#fff8e1' }} 
                            className="border border-black py-1 px-1 font-mono font-bold text-amber-900"
                          >
                            {inv && inv.waselAmount > 0 ? inv.waselAmount.toFixed(0) : ''}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* Dark Separator Column */}
                    <td style={{ backgroundColor: '#333' }} className="border border-black p-0"></td>

                    {/* Staff Payment Row Cells */}
                    {(() => {
                      const pay = staffPayments[rIdx];
                      return (
                        <>
                          <td className="border border-black py-1 px-2 font-bold text-slate-800 text-right truncate max-w-32">
                            {pay ? pay.name : ''}
                          </td>
                          <td 
                            style={{ fontWeight: 'bold', color: '#d84315' }} 
                            className="border border-black py-1 px-1 font-mono text-center"
                          >
                            {pay ? pay.amount.toFixed(0) : ''}
                          </td>
                        </>
                      );
                    })()}

                    {/* Operational Expense Row Cells */}
                    {(() => {
                      const exp = dayExpenses[rIdx];
                      return (
                        <>
                          <td className="border border-black py-1 px-2 font-bold text-slate-800 text-right truncate max-w-36">
                            {exp ? exp.type : ''}
                          </td>
                          <td 
                            style={{ fontWeight: 'bold', color: '#0277bd' }} 
                            className="border border-black py-1 px-1 font-mono text-center"
                          >
                            {exp ? exp.amount.toFixed(0) : ''}
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                {/* Footer Row 1: Invoice Counts */}
                <tr>
                  {activeEmployees.map((emp, empIdx) => {
                    const empData = employeeData[empIdx];
                    return (
                      <td 
                        key={emp.id} 
                        colSpan={colsPerEmployee} 
                        style={{ backgroundColor: '#e0ffff', fontWeight: 'bold' }} 
                        className="border border-black py-1.5 px-1 text-slate-900 text-xs"
                      >
                        العدد: {empData?.invoiceCount || 0}
                      </td>
                    );
                  })}
                  <td style={{ backgroundColor: '#333' }} className="border border-black p-0"></td>
                  <td 
                    colSpan={2} 
                    style={{ backgroundColor: '#ffccbc', fontWeight: 'bold' }} 
                    className="border border-black py-1.5 px-2 text-orange-950 font-mono text-xs"
                  >
                    م: {totalStaffPayments.toFixed(0)}
                  </td>
                  <td 
                    colSpan={2} 
                    style={{ backgroundColor: '#b3e5fc', fontWeight: 'bold' }} 
                    className="border border-black py-1.5 px-2 text-blue-950 font-mono text-xs"
                  >
                    م: {totalDayExpenses.toFixed(0)}
                  </td>
                </tr>

                {/* Footer Row 2: Method Totals per employee */}
                <tr>
                  {activeEmployees.map((emp, empIdx) => {
                    const empData = employeeData[empIdx];
                    return (
                      <React.Fragment key={emp.id}>
                        <td style={{ backgroundColor: '#eee' }} className="border border-black p-1"></td>
                        {registeredMethods.map(m => {
                          const val = empData?.methodTotals[m.id] || 0;
                          return (
                            <td 
                              key={m.id} 
                              style={{ backgroundColor: '#e0f7fa', fontWeight: 'bold', fontSize: '11px' }} 
                              className="border border-black py-1 px-1 font-mono text-slate-800"
                            >
                              {val > 0 ? `${val.toFixed(0)}` : ''}
                            </td>
                          );
                        })}
                        <td 
                          style={{ backgroundColor: '#e0f7fa', fontWeight: 'bold', fontSize: '11px' }} 
                          className="border border-black py-1 px-1 font-mono text-amber-900"
                        >
                          {empData && empData.totalWasel > 0 ? `${empData.totalWasel.toFixed(0)}` : ''}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td style={{ backgroundColor: '#333' }} className="border border-black p-0"></td>
                  <td colSpan={2} style={{ backgroundColor: '#f0f0f0' }} className="border border-black p-1"></td>
                  <td colSpan={2} style={{ backgroundColor: '#f0f0f0' }} className="border border-black p-1"></td>
                </tr>

                {/* Footer Row 3: Employee Grand Sales Totals */}
                <tr>
                  {activeEmployees.map((emp, empIdx) => {
                    const empData = employeeData[empIdx];
                    return (
                      <td 
                        key={emp.id} 
                        colSpan={colsPerEmployee} 
                        style={{ backgroundColor: '#b2dfdb', borderTop: '1px solid #009688', fontWeight: 'bold' }} 
                        className="border border-black py-1.5 px-2 text-teal-950 text-xs"
                      >
                        الإجمالي: {empData?.totalSales.toFixed(0) || 0}
                      </td>
                    );
                  })}
                  <td style={{ backgroundColor: '#333' }} className="border border-black p-0"></td>
                  <td colSpan={4} className="border border-black bg-slate-100 p-1"></td>
                </tr>

                {/* Footer Row 4: Employee Earned Commission */}
                <tr>
                  {activeEmployees.map((emp, empIdx) => {
                    const empData = employeeData[empIdx];
                    return (
                      <td 
                        key={emp.id} 
                        colSpan={colsPerEmployee} 
                        style={{ backgroundColor: '#f3e5f5', borderTop: '1px solid #ab47bc', fontWeight: 'bold', color: '#6a1b9a', fontSize: '11px' }} 
                        className="border border-black py-1.5 px-1"
                      >
                        العمولة: {empData?.totalCommission.toFixed(0) || 0}
                        <br />
                        <span style={{ color: '#666', fontWeight: 'normal', fontSize: '10px' }}>
                          ({empData?.commissionLabel})
                        </span>
                      </td>
                    );
                  })}
                  <td style={{ backgroundColor: '#333' }} className="border border-black p-0"></td>
                  <td colSpan={4} style={{ backgroundColor: '#f3e5f5' }} className="border border-black p-1"></td>
                </tr>

                {/* Footer Row 5: Total Methods Bar across all employees */}
                <tr style={{ backgroundColor: '#2c3e50', color: '#fff', fontWeight: 'bold' }}>
                  {(() => {
                    // Split the available employee cols evenly among payment methods
                    const methodCols = registeredMethods.length + 1; // registered + wasel
                    const spanPerMethod = Math.max(1, Math.floor(totalEmployeeCols / methodCols));
                    const remainder = totalEmployeeCols - (spanPerMethod * methodCols);

                    return (
                      <>
                        {registeredMethods.map((m, idx) => {
                          const colSpan = spanPerMethod + (idx === 0 ? remainder : 0);
                          const val = overallMethodTotals[m.id] || 0;
                          return (
                            <td 
                              key={m.id} 
                              colSpan={colSpan} 
                              className="border border-black py-2 px-2 text-xs font-mono font-bold"
                            >
                              إجمالي {m.name}: {val.toFixed(0)}
                            </td>
                          );
                        })}
                        <td 
                          colSpan={spanPerMethod} 
                          className="border border-black py-2 px-2 text-xs font-mono font-bold text-amber-300"
                        >
                          إجمالي واصل: {totalOverallWasel.toFixed(0)}
                        </td>
                        <td style={{ backgroundColor: '#333' }} className="border border-black p-0"></td>
                        <td colSpan={4} className="border border-black bg-slate-800 p-1"></td>
                      </>
                    );
                  })()}
                </tr>

                {/* Footer Row 6: Total Paid Income */}
                <tr style={{ backgroundColor: '#000', color: '#ffeb3b', fontWeight: 'bold', fontSize: '19px' }}>
                  <td colSpan={totalTableCols} className="border border-black py-2.5 px-4 text-center font-black">
                    إجمالي الدخل (مجموع جميع الفواتير): {totalGrandIncome.toFixed(0)} {settings.currency}
                  </td>
                </tr>

                {/* Footer Row 7: Final Net Income */}
                <tr style={{ height: '48px', backgroundColor: '#1a237e', color: '#ffffff', fontSize: '24px', fontWeight: 'bold', borderTop: '4px double #fff' }}>
                  <td colSpan={totalTableCols} className="border border-black py-2 px-4 text-center font-black">
                    صافي الدخل (الخزينة): {netIncome.toFixed(0)} {settings.currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
