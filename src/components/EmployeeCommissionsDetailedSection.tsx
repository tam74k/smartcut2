import React, { useState, useMemo } from 'react';
import { 
  AppSettings, Employee, Invoice, ServiceItem 
} from '../types';
import { 
  Coins, User, Calendar, Search, Printer, Download, Filter, 
  CheckCircle2, FileText, Sparkles, Scissors, Zap, Eye, X,
  Clock, TrendingUp, DollarSign, Layers, ChevronDown, Award
} from 'lucide-react';
import { calculateEmployeeCommission, getCommissionModelLabel } from '../utils/commissionHelper';
import { handlePrintReceipt } from '../utils/print';

export interface CommissionItemRow {
  uniqueId: string;
  invoiceId: string;
  invoiceDate: string;
  invoiceTime: string;
  clientName: string;
  clientPhone: string;
  employeeId: string;
  employeeName: string;
  serviceName: string;
  itemType: 'service' | 'product';
  quantity: number;
  itemGross: number;
  effectivePrice: number;
  commissionType: 'execution' | 'referral';
  commissionRateLabel: string;
  commissionAmount: number;
  rawInvoice: Invoice;
}

// Format 24h or ISO time into 12-hour AM/PM format (ص / م)
function formatTo12HourTime(isoOrDateStr?: string): { dateStr: string; timeStr: string } {
  if (!isoOrDateStr) return { dateStr: '-', timeStr: '-' };
  try {
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) {
      const parts = isoOrDateStr.split(/[ T]/);
      return { dateStr: parts[0] || '-', timeStr: parts[1] || '-' };
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    const h12 = hours % 12 || 12;
    const timeStr = `${String(h12).padStart(2, '0')}:${minutes} ${ampm}`;
    return { dateStr, timeStr };
  } catch {
    return { dateStr: isoOrDateStr, timeStr: '-' };
  }
}

// Helper to compute default first day and last day of current month
function getCurrentMonthBounds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDayNum = new Date(year, month + 1, 0).getDate();
  const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
  return { firstDay, lastDay };
}

export function EmployeeCommissionsDetailedSection({
  settings,
  employees = [],
  invoices = [],
  services = [],
  products = [],
  currentUser,
  initialEmployeeId,
  isModal = false,
  onCloseModal
}: {
  settings: AppSettings;
  employees: Employee[];
  invoices: Invoice[];
  services?: ServiceItem[];
  products?: any[];
  currentUser?: any;
  initialEmployeeId?: string;
  isModal?: boolean;
  onCloseModal?: () => void;
}) {
  const activeEmployees = useMemo(() => employees.filter(e => !e.isBlacklisted), [employees]);

  // Employee Selection
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialEmployeeId || activeEmployees[0]?.id || ''
  );

  // Date Range Defaults: First day and last day of CURRENT MONTH
  const currentBounds = useMemo(() => getCurrentMonthBounds(), []);
  const [startDate, setStartDate] = useState<string>(currentBounds.firstDay);
  const [endDate, setEndDate] = useState<string>(currentBounds.lastDay);

  // Filters & Search
  const [commissionTypeFilter, setCommissionTypeFilter] = useState<'all' | 'execution' | 'referral'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'detailed' | 'grouped'>('detailed');

  // Preview Invoice Modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Fallback services & products from localStorage if not passed
  const effectiveServices = useMemo(() => {
    if (services && services.length > 0) return services;
    try {
      const saved = localStorage.getItem('smartcut_services');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [services]);

  const effectiveProducts = useMemo(() => {
    if (products && products.length > 0) return products;
    try {
      const saved = localStorage.getItem('smartcut_products');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [products]);

  // Selected Employee Details
  const selectedEmp = useMemo(() => {
    return activeEmployees.find(e => e.id === selectedEmpId) || activeEmployees[0] || null;
  }, [activeEmployees, selectedEmpId]);

  // Quick date presets
  const handleSetPreset = (preset: 'this_month' | 'last_month' | 'last_30' | 'today' | 'all') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (preset === 'this_month') {
      const b = getCurrentMonthBounds();
      setStartDate(b.firstDay);
      setEndDate(b.lastDay);
    } else if (preset === 'last_month') {
      const prevDate = new Date(year, month - 1, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth();
      const firstDay = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(prevYear, prevMonth + 1, 0).getDate();
      const lastDay = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_30') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'today') {
      const t = now.toISOString().split('T')[0];
      setStartDate(t);
      setEndDate(t);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // 1. Filter valid non-cancelled, completed (paid) invoices within the date range
  const validInvoices = useMemo(() => {
    return (invoices || []).filter(inv => {
      if (!inv) return false;
      // الفواتير الغير ملغية فقط
      if (inv.status === 'cancelled' || inv.status === 'refunded') return false;
      // الفواتير المسددة فقط (completed)
      if (inv.status && inv.status !== 'completed') return false;

      // فحص تاريخ الفاتورة ضمن الفترة المحددة
      const invDateStr = (inv.date || '').split('T')[0];
      if (!invDateStr) return false;
      if (startDate && invDateStr < startDate) return false;
      if (endDate && invDateStr > endDate) return false;

      return true;
    });
  }, [invoices, startDate, endDate]);

  // 2. Extract itemized commission rows for the selected employee
  const commissionRows = useMemo(() => {
    if (!selectedEmp) return [];

    const rows: CommissionItemRow[] = [];

    validInvoices.forEach(inv => {
      const items = inv.items || [];
      const invoiceSubtotal = items.reduce(
        (sum, it) => sum + (Number(it.price || 0) * (it.quantity || 1)), 
        0
      );
      const invoiceDiscount = Number(inv.discount || 0);
      const discountRatio = invoiceSubtotal > 0 ? (invoiceDiscount / invoiceSubtotal) : 0;
      const { dateStr, timeStr } = formatTo12HourTime(inv.date);

      items.forEach((item, itemIdx) => {
        const qty = item.quantity || 1;
        const itemGross = Number(item.price || 0) * qty;
        const effectivePrice = Math.max(0, itemGross - (itemGross * discountRatio));

        const matchedService = effectiveServices.find(s => s.id === item.itemId || s.name === item.serviceName);
        const matchedProduct = effectiveProducts.find(p => p.id === item.itemId || p.name === item.serviceName);

        // A. فحص استحقاق عمولة التنفيذ (فني التنفيذ)
        const isPerformer = (item.employeeId && item.employeeId === selectedEmp.id) ||
                            (!item.employeeId && item.technicianName && item.technicianName === selectedEmp.name);

        if (isPerformer) {
          let execComm = 0;
          let rateLabel = '';

          if (item.type === 'product' || (!matchedService && matchedProduct)) {
            if (matchedProduct && Number(matchedProduct.commission) > 0) {
              execComm = Number(matchedProduct.commission) * qty;
              rateLabel = `${matchedProduct.commission} ${settings.currency} / قطعة`;
            } else if (selectedEmp.commissionRate > 0) {
              execComm = calculateEmployeeCommission(selectedEmp, effectivePrice);
              rateLabel = `نسبة موظف ${selectedEmp.commissionRate}%`;
            }
          } else {
            // Service
            if (matchedService && matchedService.employeeCommissionAmount !== undefined && Number(matchedService.employeeCommissionAmount) > 0) {
              execComm = Number(matchedService.employeeCommissionAmount) * qty;
              rateLabel = `${matchedService.employeeCommissionAmount} ${settings.currency} (محددة بالخدمة)`;
            } else if (matchedService && matchedService.employeeCommissionPercentage !== undefined && Number(matchedService.employeeCommissionPercentage) > 0) {
              execComm = effectivePrice * (Number(matchedService.employeeCommissionPercentage) / 100);
              rateLabel = `${matchedService.employeeCommissionPercentage}% (محددة بالخدمة)`;
            } else if (selectedEmp) {
              execComm = calculateEmployeeCommission(selectedEmp, effectivePrice);
              rateLabel = getCommissionModelLabel(selectedEmp);
            }
          }

          if (execComm > 0 || isPerformer) {
            rows.push({
              uniqueId: `${inv.id}-${item.id || itemIdx}-exec`,
              invoiceId: inv.id,
              invoiceDate: dateStr,
              invoiceTime: timeStr,
              clientName: inv.clientName || 'عميل نقدي',
              clientPhone: inv.clientPhone || '-',
              employeeId: selectedEmp.id,
              employeeName: selectedEmp.name,
              serviceName: item.serviceName || 'خدمة',
              itemType: item.type === 'product' ? 'product' : 'service',
              quantity: qty,
              itemGross,
              effectivePrice,
              commissionType: 'execution',
              commissionRateLabel: rateLabel || 'نسبة الموظف',
              commissionAmount: execComm,
              rawInvoice: inv
            });
          }
        }

        // B. فحص استحقاق عمولة فتح الشغل / الإحالة
        const isReferrer = (item.referralEmployeeId && item.referralEmployeeId === selectedEmp.id) ||
                           (!item.referralEmployeeId && item.referralEmployeeName && item.referralEmployeeName === selectedEmp.name);

        if (isReferrer) {
          let refComm = 0;
          let rateLabel = '';

          if (item.referralCommissionAmount !== undefined && Number(item.referralCommissionAmount) > 0) {
            refComm = Number(item.referralCommissionAmount) * qty;
            rateLabel = `${item.referralCommissionAmount} ${settings.currency} (إحالة مسجلة)`;
          } else if (matchedService && matchedService.referralCommissionAmount !== undefined && Number(matchedService.referralCommissionAmount) > 0) {
            if (matchedService.referralCommissionType === 'fixed') {
              refComm = Number(matchedService.referralCommissionAmount) * qty;
              rateLabel = `${matchedService.referralCommissionAmount} ${settings.currency} ثابتة (فتح شغل)`;
            } else {
              refComm = effectivePrice * (Number(matchedService.referralCommissionAmount) / 100);
              rateLabel = `${matchedService.referralCommissionAmount}% (فتح شغل)`;
            }
          }

          if (refComm > 0 || isReferrer) {
            rows.push({
              uniqueId: `${inv.id}-${item.id || itemIdx}-ref`,
              invoiceId: inv.id,
              invoiceDate: dateStr,
              invoiceTime: timeStr,
              clientName: inv.clientName || 'عميل نقدي',
              clientPhone: inv.clientPhone || '-',
              employeeId: selectedEmp.id,
              employeeName: selectedEmp.name,
              serviceName: item.serviceName || 'خدمة',
              itemType: item.type === 'product' ? 'product' : 'service',
              quantity: qty,
              itemGross,
              effectivePrice,
              commissionType: 'referral',
              commissionRateLabel: rateLabel || 'إحالة / فتح شغل',
              commissionAmount: refComm,
              rawInvoice: inv
            });
          }
        }
      });
    });

    // Sort newest to oldest
    return rows.sort((a, b) => b.invoiceId.localeCompare(a.invoiceId));
  }, [selectedEmp, validInvoices, effectiveServices, effectiveProducts, settings.currency]);

  // 3. Filtered rows by commission type and search
  const filteredRows = useMemo(() => {
    return commissionRows.filter(row => {
      if (commissionTypeFilter !== 'all' && row.commissionType !== commissionTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInv = row.invoiceId.toLowerCase().includes(q);
        const matchClient = row.clientName.toLowerCase().includes(q);
        const matchPhone = row.clientPhone.toLowerCase().includes(q);
        const matchService = row.serviceName.toLowerCase().includes(q);
        if (!matchInv && !matchClient && !matchPhone && !matchService) return false;
      }
      return true;
    });
  }, [commissionRows, commissionTypeFilter, searchQuery]);

  // 4. Grouped by invoice representation
  const groupedInvoices = useMemo(() => {
    const map = new Map<string, {
      invoice: Invoice;
      invoiceId: string;
      invoiceDate: string;
      invoiceTime: string;
      clientName: string;
      clientPhone: string;
      totalSales: number;
      executionCommission: number;
      referralCommission: number;
      totalCommission: number;
      items: CommissionItemRow[];
    }>();

    filteredRows.forEach(row => {
      if (!map.has(row.invoiceId)) {
        map.set(row.invoiceId, {
          invoice: row.rawInvoice,
          invoiceId: row.invoiceId,
          invoiceDate: row.invoiceDate,
          invoiceTime: row.invoiceTime,
          clientName: row.clientName,
          clientPhone: row.clientPhone,
          totalSales: 0,
          executionCommission: 0,
          referralCommission: 0,
          totalCommission: 0,
          items: []
        });
      }
      const entry = map.get(row.invoiceId)!;
      entry.items.push(row);
      if (row.commissionType === 'execution') {
        entry.totalSales += row.effectivePrice;
        entry.executionCommission += row.commissionAmount;
      } else {
        entry.referralCommission += row.commissionAmount;
      }
      entry.totalCommission += row.commissionAmount;
    });

    return Array.from(map.values());
  }, [filteredRows]);

  // 5. Aggregate KPI Totals
  const totals = useMemo(() => {
    const uniqueInvoiceIds = new Set(filteredRows.map(r => r.invoiceId));
    let totalWork = 0;
    let totalExecComm = 0;
    let totalRefComm = 0;

    filteredRows.forEach(r => {
      if (r.commissionType === 'execution') {
        totalWork += r.effectivePrice;
        totalExecComm += r.commissionAmount;
      } else {
        totalRefComm += r.commissionAmount;
      }
    });

    return {
      invoicesCount: uniqueInvoiceIds.size,
      itemsCount: filteredRows.length,
      totalWork,
      totalExecComm,
      totalRefComm,
      grandTotalCommission: totalExecComm + totalRefComm
    };
  }, [filteredRows]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredRows.length) return;
    const headers = [
      'رقم الفاتورة',
      'اسم العميل',
      'هاتف العميل',
      'التاريخ',
      'الوقت',
      'الصنف / الخدمة',
      'النوع',
      'الكمية',
      'القيمة الصافية',
      'نوع الاستحقاق',
      'طريقة الحساب',
      'قيمة العمولة'
    ];

    const csvRows = filteredRows.map(r => [
      `"${r.invoiceId}"`,
      `"${r.clientName.replace(/"/g, '""')}"`,
      `"${r.clientPhone}"`,
      `"${r.invoiceDate}"`,
      `"${r.invoiceTime}"`,
      `"${r.serviceName.replace(/"/g, '""')}"`,
      `"${r.itemType === 'product' ? 'منتج' : 'خدمة'}"`,
      r.quantity,
      r.effectivePrice.toFixed(2),
      `"${r.commissionType === 'execution' ? 'تنفيذ خدمة' : 'إحالة (فتح شغل)'}"`,
      `"${r.commissionRateLabel.replace(/"/g, '""')}"`,
      r.commissionAmount.toFixed(2)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `عمولات_${selectedEmp?.name || 'الموظف'}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    handlePrintReceipt('employee-commissions-print-sheet', false, 'a4');
  };

  return (
    <div className={`space-y-6 ${isModal ? 'p-1' : ''}`} dir="rtl">
      {/* 1. Header Section */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Coins size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">ملخص عمولات الموظف التفصيلي</h3>
                <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                  فواتير مسددة فقط
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                كشف تحليلي لكافة الفواتير المستحق عنها عمولات (تنفيذ وإحالة) خلال الفترة المحددة
              </p>
            </div>
          </div>

          {/* Action Buttons (Print / Export / Close) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              disabled={filteredRows.length === 0}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-40"
              title="طباعة تقرير العمولات التفصيلي"
            >
              <Printer size={15} />
              <span>طباعة التقرير (A4)</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredRows.length === 0}
              className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              title="تصدير لملف إكسيل"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {isModal && onCloseModal && (
              <button
                onClick={onCloseModal}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Controls Grid (Employee + Dates + Filters) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          {/* Employee Picker */}
          <div className="lg:col-span-4">
            <label className="block text-xs font-black text-slate-700 mb-1 flex items-center gap-1.5">
              <User size={14} className="text-indigo-600" />
              <span>اختيار الموظف:</span>
            </label>
            <select
              value={selectedEmpId}
              onChange={e => setSelectedEmpId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 focus:border-indigo-600 outline-none cursor-pointer"
            >
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role} {emp.fingerprintCode ? `- بصمة ${emp.fingerprintCode}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date (Default: First day of current month) */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-black text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-600" />
              <span>من تاريخ:</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-600 outline-none"
            />
          </div>

          {/* End Date (Default: Last day of current month) */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-black text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-600" />
              <span>إلى تاريخ:</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-indigo-600 outline-none"
            />
          </div>

          {/* Commission Type Filter */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-black text-slate-700 mb-1 flex items-center gap-1.5">
              <Filter size={14} className="text-indigo-600" />
              <span>النوع:</span>
            </label>
            <select
              value={commissionTypeFilter}
              onChange={e => setCommissionTypeFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-600 outline-none cursor-pointer"
            >
              <option value="all">الكل (تنفيذ وإحالة)</option>
              <option value="execution">✂️ تنفيذ فقط</option>
              <option value="referral">⚡ إحالة فقط</option>
            </select>
          </div>
        </div>

        {/* Date Presets Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 ml-1">فترات سريعة:</span>
            <button
              type="button"
              onClick={() => handleSetPreset('this_month')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                startDate === currentBounds.firstDay && endDate === currentBounds.lastDay
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              الشهر الحالي
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('last_month')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            >
              الشهر السابق
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('last_30')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            >
              آخر 30 يوم
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('today')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('all')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            >
              جميع الفترات
            </button>
          </div>

          {/* Employee Commission System Badge */}
          {selectedEmp && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-semibold">نظام عمولة الموظف:</span>
              <span className="text-[11px] font-black bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Award size={12} className="text-amber-600" />
                <span>{getCommissionModelLabel(selectedEmp)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Grand Commission */}
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-3xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-amber-100">إجمالي العمولات المستحقة</span>
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Coins size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono">
              {totals.grandTotalCommission.toFixed(2)}
              <span className="text-xs font-bold mr-1.5">{settings.currency}</span>
            </div>
            <p className="text-[10px] text-amber-100 font-bold mt-0.5">
              تنفيذ: {totals.totalExecComm.toFixed(2)} + إحالة: {totals.totalRefComm.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Execution Commissions */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <span>✂️ عمولات التنفيذ</span>
            </span>
            <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Scissors size={15} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black font-mono text-indigo-700">
              {totals.totalExecComm.toFixed(2)}
              <span className="text-xs font-bold mr-1 text-slate-400">{settings.currency}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">عن أداء الخدمات والمبيعات</p>
          </div>
        </div>

        {/* Referral Commissions */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <span>⚡ عمولات الإحالة</span>
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap size={15} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black font-mono text-amber-700">
              {totals.totalRefComm.toFixed(2)}
              <span className="text-xs font-bold mr-1 text-slate-400">{settings.currency}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">فتح شغل للزملاء</p>
          </div>
        </div>

        {/* Total Sales Generated */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500">صافي الشغل المنفذ</span>
            <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black font-mono text-slate-800">
              {totals.totalWork.toFixed(2)}
              <span className="text-xs font-bold mr-1 text-slate-400">{settings.currency}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">بعد خصومات الفواتير</p>
          </div>
        </div>

        {/* Qualifying Invoices Count */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500">الفواتير المستحقة</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileText size={15} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black font-mono text-emerald-700">
              {totals.invoicesCount}
              <span className="text-xs font-bold mr-1 text-slate-400">فاتورة</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">({totals.itemsCount} بند خدمة/منتج)</p>
          </div>
        </div>
      </div>

      {/* 3. Detailed Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-slate-900">سجل الفواتير وبنود الاستحقاق</h4>
            <span className="text-xs font-bold text-slate-500">({filteredRows.length} استحقاق)</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'detailed' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                تفصيلي بالخدمة
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grouped' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                مجمع بالفاتورة
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الفاتورة أو العميل..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-semibold focus:border-indigo-600 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Content Table / Empty State */}
        {filteredRows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto">
              <Coins size={32} />
            </div>
            <p className="text-sm font-bold text-slate-600">لا توجد فواتير أو عمولات مسجلة للموظف في هذه الفترة</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              تأكد من اختيار نطاق زمني يتضمن فواتير مسددة مكتملة قام الموظف بتنفيذها أو فتح شغل لها.
            </p>
          </div>
        ) : viewMode === 'detailed' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-3"># الفاتورة</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">الخدمة / الصنف</th>
                  <th className="p-3 text-center">نوع العمولة</th>
                  <th className="p-3 text-left">قيمة الخدمة الصافية</th>
                  <th className="p-3 text-left">طريقة / نسبة العمولة</th>
                  <th className="p-3 text-left">العمولة المستحقة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">معاينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.uniqueId} className="hover:bg-slate-50/70 transition-colors">
                    {/* Invoice ID */}
                    <td className="p-3">
                      <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 text-[11px]">
                        {row.invoiceId}
                      </span>
                    </td>

                    {/* Client Name & Phone */}
                    <td className="p-3">
                      <div className="font-black text-slate-900">{row.clientName}</div>
                      {row.clientPhone && row.clientPhone !== '-' && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{row.clientPhone}</div>
                      )}
                    </td>

                    {/* Date & 12h Time */}
                    <td className="p-3">
                      <div className="font-bold text-slate-800 font-mono text-[11px]">{row.invoiceDate}</div>
                      <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                        <Clock size={11} className="text-slate-400" />
                        <span>{row.invoiceTime}</span>
                      </div>
                    </td>

                    {/* Service Name */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{row.serviceName}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">
                        {row.itemType === 'product' ? 'منتج 📦' : 'خدمة ✂️'} {row.quantity > 1 ? `(الكمية: ${row.quantity})` : ''}
                      </div>
                    </td>

                    {/* Commission Type Badge */}
                    <td className="p-3 text-center">
                      {row.commissionType === 'execution' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-lg">
                          <Scissors size={11} />
                          <span>تنفيذ خدمة</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg">
                          <Zap size={11} />
                          <span>إحالة (فتح شغل)</span>
                        </span>
                      )}
                    </td>

                    {/* Effective Net Price */}
                    <td className="p-3 text-left font-mono font-bold text-slate-800">
                      <div>{row.effectivePrice.toFixed(2)} {settings.currency}</div>
                      {row.itemGross !== row.effectivePrice && (
                        <div className="text-[10px] text-slate-400 line-through">
                          {row.itemGross.toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* Calculation Explanation */}
                    <td className="p-3 text-left">
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {row.commissionRateLabel}
                      </span>
                    </td>

                    {/* Calculated Commission Amount */}
                    <td className="p-3 text-left font-mono font-black text-emerald-700 text-sm">
                      +{row.commissionAmount.toFixed(2)} {settings.currency}
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={11} />
                        <span>مسددة</span>
                      </span>
                    </td>

                    {/* View Button */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setPreviewInvoice(row.rawInvoice)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="معاينة الفاتورة كاملة"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grouped Invoices View */
          <div className="divide-y divide-slate-100">
            {groupedInvoices.map((grp) => (
              <div key={grp.invoiceId} className="p-4 hover:bg-slate-50/60 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 text-xs">
                      {grp.invoiceId}
                    </span>
                    <div>
                      <span className="font-black text-slate-900 text-xs">{grp.clientName}</span>
                      {grp.clientPhone && grp.clientPhone !== '-' && (
                        <span className="text-[10px] font-mono text-slate-400 mr-2">({grp.clientPhone})</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                      <span>{grp.invoiceDate}</span>
                      <span className="text-slate-300">|</span>
                      <span>{grp.invoiceTime}</span>
                    </div>

                    <div className="text-left font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                      إجمالي العمولة: +{grp.totalCommission.toFixed(2)} {settings.currency}
                    </div>

                    <button
                      onClick={() => setPreviewInvoice(grp.invoice)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="معاينة الفاتورة كاملة"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>

                {/* Sub-items in this invoice */}
                <div className="bg-slate-50/90 rounded-2xl p-2.5 border border-slate-200/80 space-y-1.5">
                  {grp.items.map((it) => (
                    <div key={it.uniqueId} className="flex justify-between items-center text-xs px-2 py-1 bg-white rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2">
                        {it.commissionType === 'execution' ? (
                          <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                            ✂️ تنفيذ
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                            ⚡ إحالة
                          </span>
                        )}
                        <span className="font-bold text-slate-800">{it.serviceName}</span>
                        {it.quantity > 1 && <span className="text-[10px] text-slate-400 font-mono">x{it.quantity}</span>}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-[10px] font-semibold text-slate-400">
                          القيمة: {it.effectivePrice.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                          {it.commissionRateLabel}
                        </span>
                        <span className="font-mono font-black text-emerald-700">
                          +{it.commissionAmount.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Summary Bar */}
        {filteredRows.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 font-bold text-xs">
            <span className="text-slate-600">
              إجمالي عدد الفواتير: <strong className="text-slate-900 font-mono">{totals.invoicesCount}</strong> | إجمالي البنود: <strong className="text-slate-900 font-mono">{totals.itemsCount}</strong>
            </span>
            <div className="flex items-center gap-4">
              <span>
                إجمالي الشغل: <strong className="text-slate-900 font-mono">{totals.totalWork.toFixed(2)}</strong> {settings.currency}
              </span>
              <span className="text-emerald-700 font-black text-sm bg-emerald-100/70 border border-emerald-300 px-3 py-1 rounded-xl">
                العمولة المستحقة: {totals.grandTotalCommission.toFixed(2)} {settings.currency}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. PRINT SHEET TEMPLATE (Rendered in DOM, hidden on screen, printed on A4) */}
      <div id="employee-commissions-print-sheet" className="hidden">
        <div style={{ padding: '15mm', direction: 'rtl', fontFamily: '"Cairo", sans-serif', color: '#0f172a' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px 0' }}>{settings.salonName || 'صالون العناية'}</h1>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0' }}>{settings.address} {settings.phone ? `| هاتف: ${settings.phone}` : ''}</p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '15px', fontWeight: '900', color: '#b45309' }}>تقرير عمولات الموظف التفصيلي</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
              </div>
            </div>
          </div>

          {/* Employee & Period Info Box */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', marginBottom: '16px', fontSize: '12px' }}>
            <div>
              <p style={{ margin: '3px 0' }}><strong>الموظف:</strong> {selectedEmp?.name || '-'} {selectedEmp?.fingerprintCode ? `(كود: ${selectedEmp.fingerprintCode})` : ''}</p>
              <p style={{ margin: '3px 0' }}><strong>المسمى الوظيفي:</strong> {selectedEmp?.role || '-'}</p>
            </div>
            <div>
              <p style={{ margin: '3px 0' }}><strong>الفترة:</strong> من {startDate || 'البداية'} إلى {endDate || 'اليوم'}</p>
              <p style={{ margin: '3px 0' }}><strong>نظام العمولة:</strong> {selectedEmp ? getCommissionModelLabel(selectedEmp) : '-'}</p>
            </div>
          </div>

          {/* Financial Summary Box */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>عدد الفواتير</div>
              <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '2px' }}>{totals.invoicesCount}</div>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>صافي الشغل المنفذ</div>
              <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '2px' }}>{totals.totalWork.toFixed(2)} {settings.currency}</div>
            </div>
            <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px', border: '1px solid #bfdbfe', color: '#1e40af' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold' }}>عمولات التنفيذ</div>
              <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '2px' }}>{totals.totalExecComm.toFixed(2)} {settings.currency}</div>
            </div>
            <div style={{ backgroundColor: '#fef3c7', padding: '8px', borderRadius: '8px', border: '1px solid #fde68a', color: '#92400e' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold' }}>عمولات الإحالة</div>
              <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '2px' }}>{totals.totalRefComm.toFixed(2)} {settings.currency}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#ecfdf5', padding: '10px', borderRadius: '8px', border: '2px solid #a7f3d0', textAlign: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#065f46' }}>صافي إجمالي العمولات المستحقة للموظف: </span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#047857' }}>{totals.grandTotalCommission.toFixed(2)} {settings.currency}</span>
          </div>

          {/* Detailed Invoices Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'right' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#fff' }}>
                <th style={{ padding: '6px 8px', border: '1px solid #0f172a' }}># الفاتورة</th>
                <th style={{ padding: '6px 8px', border: '1px solid #0f172a' }}>العميل</th>
                <th style={{ padding: '6px 8px', border: '1px solid #0f172a' }}>التاريخ والوقت</th>
                <th style={{ padding: '6px 8px', border: '1px solid #0f172a' }}>الخدمة / الصنف</th>
                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', textAlign: 'center' }}>النوع</th>
                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', textAlign: 'left' }}>القيمة</th>
                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', textAlign: 'left' }}>العمولة</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, idx) => (
                <tr key={r.uniqueId} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: 'bold' }}>{r.invoiceId}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>{r.clientName}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>{r.invoiceDate} {r.invoiceTime}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>{r.serviceName} {r.quantity > 1 ? `(${r.quantity})` : ''}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    {r.commissionType === 'execution' ? 'تنفيذ' : 'إحالة'}
                  </td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', fontFamily: 'monospace' }}>{r.effectivePrice.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>
                    +{r.commissionAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30mm', paddingTop: '10px', fontSize: '12px' }}>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderBottom: '1px solid #94a3b8', paddingBottom: '40px', marginBottom: '5px' }}></div>
              <span>توقيع الموظف</span>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderBottom: '1px solid #94a3b8', paddingBottom: '40px', marginBottom: '5px' }}></div>
              <span>توقيع الإدارة / الحسابات</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Invoice Quick Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تفاصيل الفاتورة #{previewInvoice.id}</h3>
                  <p className="text-xs text-slate-500">
                    {previewInvoice.date ? new Date(previewInvoice.date).toLocaleString('ar-SA') : '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">العميل:</span>
                <p className="font-bold text-slate-800">{previewInvoice.clientName || 'عميل نقدي'}</p>
              </div>
              <div>
                <span className="text-slate-400">الهاتف:</span>
                <p className="font-mono font-bold text-slate-800">{previewInvoice.clientPhone || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400">إجمالي الفاتورة:</span>
                <p className="font-mono font-black text-slate-900">{previewInvoice.total} {settings.currency}</p>
              </div>
              <div>
                <span className="text-slate-400">الخصم:</span>
                <p className="font-mono font-bold text-rose-600">{previewInvoice.discount || 0} {settings.currency}</p>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {(previewInvoice.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs p-2 bg-white border border-slate-200 rounded-xl">
                  <div>
                    <div className="font-bold text-slate-800">{it.serviceName}</div>
                    <div className="text-[10px] text-slate-400">
                      فني التنفيذ: {it.technicianName || '-'} {it.referralEmployeeName ? `| إحالة: ${it.referralEmployeeName}` : ''}
                    </div>
                  </div>
                  <div className="font-mono font-black text-slate-900">
                    {it.price} {settings.currency} {it.quantity && it.quantity > 1 ? `(x${it.quantity})` : ''}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
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
