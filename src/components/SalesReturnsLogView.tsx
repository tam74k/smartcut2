import React, { useState, useMemo } from 'react';
import { SalesReturn, Invoice, AppSettings, AppUser } from '../types';
import { 
  RotateCcw, Search, Calendar, Filter, Printer, FileSpreadsheet, 
  Eye, Package, Scissors, DollarSign, ArrowUpRight, CheckCircle2, 
  HelpCircle, AlertCircle, Plus, Trash2, Check, X 
} from 'lucide-react';
import { exportToExcel } from '../utils/exportExcel';
import { AuthService } from '../services/auth';
import { SalesReturnVoucherModal } from './SalesReturnVoucherModal';

interface SalesReturnsLogViewProps {
  salesReturns: SalesReturn[];
  invoices: Invoice[];
  settings: AppSettings;
  currentUser?: AppUser | null;
  onOpenCreateReturn?: (invoice?: Invoice) => void;
  onStartNewReturn?: (invoice?: Invoice) => void;
  onViewInvoice?: (invoice: Invoice) => void;
  onViewVoucher?: (ret: SalesReturn) => void;
  onDeleteReturn?: (ret: SalesReturn) => void;
}

export function SalesReturnsLogView({
  salesReturns,
  invoices,
  settings,
  currentUser,
  onOpenCreateReturn,
  onStartNewReturn,
  onViewInvoice,
  onViewVoucher,
  onDeleteReturn
}: SalesReturnsLogViewProps) {
  const handleStartReturn = onStartNewReturn || onOpenCreateReturn;
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [voucherToView, setVoucherToView] = useState<SalesReturn | null>(null);

  // Quick invoice search modal to initiate return from this tab
  const [showInvoiceSearchModal, setShowInvoiceSearchModal] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  // Date Filtering calculation
  const filteredReturns = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    return salesReturns.filter(ret => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRetNum = ret.returnNumber?.toLowerCase().includes(q) || ret.id?.toLowerCase().includes(q);
        const matchesInvNum = ret.originalInvoiceNumber?.toLowerCase().includes(q) || ret.originalInvoiceId?.toLowerCase().includes(q);
        const matchesClient = ret.clientName?.toLowerCase().includes(q) || ret.clientPhone?.includes(q);
        const matchesItems = (ret.items || []).some(i => i.name?.toLowerCase().includes(q));
        if (!matchesRetNum && !matchesInvNum && !matchesClient && !matchesItems) return false;
      }

      // 2. Reason Filter
      if (reasonFilter !== 'all') {
        if (ret.reason !== reasonFilter) return false;
      }

      // 3. Date Filter
      if (dateFilter === 'today') {
        if (ret.date !== todayStr) return false;
      } else if (dateFilter === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        const yestStr = yest.toISOString().split('T')[0];
        if (ret.date !== yestStr) return false;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        if (ret.date < weekAgoStr || ret.date > todayStr) return false;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        const monthAgoStr = monthAgo.toISOString().split('T')[0];
        if (ret.date < monthAgoStr || ret.date > todayStr) return false;
      } else if (dateFilter === 'custom') {
        if (customFrom && ret.date < customFrom) return false;
        if (customTo && ret.date > customTo) return false;
      }

      return true;
    });
  }, [salesReturns, searchQuery, dateFilter, customFrom, customTo, reasonFilter]);

  // Aggregate KPI metrics
  const metrics = useMemo(() => {
    let totalAmount = 0;
    let totalProductsCount = 0;
    let totalServicesCount = 0;
    let cashRefundAmount = 0;
    let cardRefundAmount = 0;

    filteredReturns.forEach(ret => {
      const amt = Number(ret.totalRefundAmount) || 0;
      totalAmount += amt;
      if (ret.refundMethod === 'cash') cashRefundAmount += amt;
      else cardRefundAmount += amt;

      (ret.items || []).forEach(item => {
        const qty = Number(item.returnedQuantity) || 1;
        if (item.type === 'product') totalProductsCount += qty;
        else totalServicesCount += qty;
      });
    });

    return {
      totalAmount,
      returnsCount: filteredReturns.length,
      totalProductsCount,
      totalServicesCount,
      cashRefundAmount,
      cardRefundAmount
    };
  }, [filteredReturns]);

  // Reason translations
  const getReasonBadge = (reason: string, custom?: string) => {
    switch (reason) {
      case 'defective':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-md">منتج تالف / عيب</span>;
      case 'wrong_order':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md">صنف خاطئ</span>;
      case 'customer_request':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-md">رغبة العميل</span>;
      case 'service_unsatisfactory':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-md">عدم رضا عن الخدمة</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-md">{custom || 'أخرى'}</span>;
    }
  };

  const getMethodBadge = (m: string) => {
    switch (m) {
      case 'cash':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.2 rounded">كاش</span>;
      case 'card':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.2 rounded">شبكة</span>;
      case 'bank':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-1.5 py-0.2 rounded">تحويل</span>;
      case 'client_balance':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.2 rounded">رصيد</span>;
      default:
        return <span className="text-[10px] font-bold">{m}</span>;
    }
  };

  const canExportExcel = AuthService.canDo('export_excel', currentUser);

  // Export to Excel
  const handleExportExcel = () => {
    if (!canExportExcel) {
      alert('عذراً، لا تملك صلاحية التصدير إلى Excel (export_excel).');
      return;
    }
    const data = filteredReturns.map(r => ({
      'رقم سند المرتجع': r.returnNumber || r.id,
      'التاريخ': r.date,
      'الوقت': r.time,
      'رقم الفاتورة الأصلية': r.isGeneralReturn || (!r.originalInvoiceId && !r.originalInvoiceNumber) ? 'بدون فاتورة (مرتجع عام)' : (r.originalInvoiceNumber || r.originalInvoiceId),
      'اسم العميل': r.clientName || 'عميل نقدي',
      'رقم هاتف العميل': r.clientPhone || '-',
      'عدد البنود المسترجعة': (r.items || []).length,
      'تفاصيل البنود': (r.items || []).map(i => `${i.name} (${i.returnedQuantity})`).join(', '),
      'سبب الإرجاع': r.reasonText || r.reason,
      'طريقة الرد': r.refundMethod,
      'الخزينة': r.treasuryName || '-',
      'المبلغ المسترد': r.totalRefundAmount,
      'الموظف': r.createdByName || '-'
    }));

    exportToExcel(data, `سجل_مرتجعات_المبيعات_${new Date().toISOString().split('T')[0]}`);
  };

  // Search invoices to start a return
  const eligibleInvoicesForReturn = useMemo(() => {
    if (!invoiceSearchQuery.trim()) return invoices.slice(0, 10);
    const q = invoiceSearchQuery.toLowerCase().trim();
    return invoices.filter(inv => {
      const matchNum = inv.id?.toLowerCase().includes(q) || (inv as any).invoiceNumber?.toLowerCase().includes(q);
      const matchClient = inv.clientName?.toLowerCase().includes(q) || inv.clientPhone?.includes(q);
      return matchNum || matchClient;
    }).slice(0, 20);
  }, [invoices, invoiceSearchQuery]);

  return (
    <div className="space-y-4">
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 p-3.5 rounded-2xl border border-rose-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-bold">إجمالي مبالغ المرتجعات</span>
            <RotateCcw size={16} />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-rose-950">
            {metrics.totalAmount.toFixed(2)} <span className="text-xs font-sans text-rose-700">{settings.currency}</span>
          </div>
          <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
            كاش: {metrics.cashRefundAmount.toFixed(2)} | شبكة: {metrics.cardRefundAmount.toFixed(2)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">عدد سندات المرتجع</span>
            <CheckCircle2 size={16} className="text-indigo-600" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
            {metrics.returnsCount}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
            عملية إرجاع مسجلة
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">المنتجات المسترجعة للمخزن</span>
            <Package size={16} className="text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
            {metrics.totalProductsCount} <span className="text-xs font-sans text-slate-500">قطعة</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
            <Check size={11} className="text-emerald-600" />
            <span>تمت إعادة المخزون تلقائياً</span>
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">الخدمات المسترجعة</span>
            <Scissors size={16} className="text-indigo-600" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
            {metrics.totalServicesCount} <span className="text-xs font-sans text-slate-500">خدمة</span>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
            ملغاة أو مستردة القيمة
          </span>
        </div>
      </div>

      {/* Control Actions & Search Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="ابحث برقم المرتجع، رقم الفاتورة الأصلية، اسم العميل، أو الصنف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Quick General Return Button */}
            <button
              onClick={() => {
                if (handleStartReturn) handleStartReturn(undefined);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95 shrink-0"
              title="تسجيل مرتجع أصناف عام ومباشر بدون اشتراط فاتورة سابقة"
            >
              <Package size={15} />
              <span>مرتجع أصناف عام</span>
            </button>

            {/* Quick New Return Button */}
            <button
              onClick={() => setShowInvoiceSearchModal(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95 shrink-0"
              title="تسجيل مرتجع مبيعات جديد لفاتورة سابقة"
            >
              <Plus size={15} />
              <span>مرتجع بموجب فاتورة</span>
            </button>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={filteredReturns.length === 0 || !canExportExcel}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all shrink-0 ${
                canExportExcel && filteredReturns.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
              }`}
              title={canExportExcel ? 'تصدير سجل المرتجعات إلى ملف إكسل' : 'لا تملك صلاحية التصدير إلى Excel'}
            >
              <FileSpreadsheet size={15} />
              <span>إكسل</span>
            </button>
          </div>
        </div>

        {/* Date & Reason Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-bold ml-1">الفترة:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'yesterday', label: 'الأمس' },
              { id: 'week', label: 'آخر 7 أيام' },
              { id: 'month', label: 'آخر 30 يوم' },
              { id: 'custom', label: 'مخصص' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === f.id 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-bold">سبب الإرجاع:</span>
            <select
              value={reasonFilter}
              onChange={e => setReasonFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">كافة الأسباب</option>
              <option value="customer_request">رغبة العميل</option>
              <option value="defective">تالف / عيب</option>
              <option value="wrong_order">طلب خاطئ</option>
              <option value="service_unsatisfactory">عدم رضا عن الخدمة</option>
              <option value="other">أسباب أخرى</option>
            </select>
          </div>
        </div>

        {/* Custom Date Inputs if selected */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-bold">من:</span>
              <input 
                type="date" 
                value={customFrom} 
                onChange={e => setCustomFrom(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-bold">إلى:</span>
              <input 
                type="date" 
                value={customTo} 
                onChange={e => setCustomTo(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sales Returns Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="p-3">رقم سند المرتجع</th>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">الفاتورة الأصلية</th>
                <th className="p-3">العميل</th>
                <th className="p-3">الأصناف المسترجعة</th>
                <th className="p-3">سبب الإرجاع</th>
                <th className="p-3">طريقة الرد والخزينة</th>
                <th className="p-3 text-left">المبلغ المسترد</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <RotateCcw size={28} className="text-slate-300" />
                      <p className="font-bold text-slate-600">لا توجد مرتجعات مبيعات مسجلة</p>
                      <p className="text-[11px] text-slate-400">يمكنك تسجيل مرتجع جديد من زر "مرتجع جديد" أو من قائمة فواتير المبيعات</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReturns.map(ret => {
                  const itemsCount = (ret.items || []).length;
                  const firstItem = ret.items?.[0];

                  return (
                    <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-mono font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg text-xs">
                          {ret.returnNumber || ret.id}
                        </span>
                      </td>

                      <td className="p-3 text-slate-600 font-mono">
                        <div>{ret.date}</div>
                        <div className="text-[10px] text-slate-400">{ret.time}</div>
                      </td>

                      <td className="p-3">
                        {ret.isGeneralReturn || (!ret.originalInvoiceId && !ret.originalInvoiceNumber) ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                            <Package size={11} className="text-amber-600" />
                            <span>بدون فاتورة</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              const originalInv = invoices.find(i => i.id === ret.originalInvoiceId);
                              if (originalInv && onViewInvoice) onViewInvoice(originalInv);
                            }}
                            className="font-mono font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                            title="عرض الفاتورة الأصلية"
                          >
                            <span>#{ret.originalInvoiceNumber || ret.originalInvoiceId}</span>
                            <ArrowUpRight size={12} />
                          </button>
                        )}
                      </td>

                      <td className="p-3 font-bold text-slate-800">
                        <div>{ret.clientName || 'عميل نقدي'}</div>
                        {ret.clientPhone && (
                          <div className="text-[10px] font-mono text-slate-400 font-normal">{ret.clientPhone}</div>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="max-w-[200px] truncate" title={(ret.items || []).map(i => `${i.name} (×${i.returnedQuantity})`).join(', ')}>
                          {firstItem && (
                            <span className="font-semibold text-slate-700">
                              {firstItem.name} (×{firstItem.returnedQuantity})
                            </span>
                          )}
                          {itemsCount > 1 && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-1.5 py-0.5 rounded mr-1">
                              +{itemsCount - 1} بنود أخرى
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        {getReasonBadge(ret.reason, ret.reasonText)}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {getMethodBadge(ret.refundMethod)}
                          <span className="text-[11px] text-slate-600 font-semibold truncate max-w-[90px]">
                            {ret.treasuryName || 'الخزينة'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 text-left font-mono font-black text-rose-600 text-xs">
                        -{Number(ret.totalRefundAmount || 0).toFixed(2)} {settings.currency}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewVoucher ? onViewVoucher(ret) : setVoucherToView(ret)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                            title="معاينة وطباعة سند المرتجع (إشعار دائن)"
                          >
                            <Printer size={14} />
                            <span className="hidden sm:inline">طباعة</span>
                          </button>
                          {onDeleteReturn && (
                            <button
                              onClick={() => onDeleteReturn(ret)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="حذف سند المرتجع"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {/* Printable Voucher Modal */}
      {voucherToView && (
        <SalesReturnVoucherModal
          salesReturn={voucherToView}
          settings={settings}
          onClose={() => setVoucherToView(null)}
        />
      )}

      {/* Quick Invoice Search Modal to start return */}
      {showInvoiceSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-5 space-y-4 border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <RotateCcw size={18} />
                </span>
                <h3 className="font-black text-sm text-slate-800">اختر الفاتورة المراد عمل مرتجع لها</h3>
              </div>
              <button
                onClick={() => setShowInvoiceSearchModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                title="إغلاق"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-700">
                  <Package size={18} />
                </span>
                <div>
                  <h4 className="font-black text-xs text-amber-950">مرتجع أصناف عام (بدون فاتورة)</h4>
                  <p className="text-[10px] text-amber-700">إرجاع بضاعة مباشرة وتسوية المخزون فورياً دون اشتراط وجود فاتورة سابقة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInvoiceSearchModal(false);
                  if (handleStartReturn) handleStartReturn(undefined);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all shrink-0 active:scale-95 inline-flex items-center gap-1.5"
              >
                <Package size={13} />
                <span>بدء مرتجع عام</span>
              </button>
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                autoFocus
                placeholder="ابحث برقم الفاتورة أو اسم العميل أو رقم الهاتف..."
                value={invoiceSearchQuery}
                onChange={e => setInvoiceSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold outline-none focus:border-primary"
              />
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 max-h-64 custom-scrollbar">
              {eligibleInvoicesForReturn.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  لا توجد فواتير مطابقة
                </div>
              ) : (
                eligibleInvoicesForReturn.map(inv => (
                  <div 
                    key={inv.id} 
                    className="p-3 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs transition-colors rounded-xl"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>#{inv.id}</span>
                        <span className="text-slate-500">•</span>
                        <span>{inv.clientName || 'عميل نقدي'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {inv.date} • {Number(inv.total || 0).toFixed(2)} {settings.currency}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowInvoiceSearchModal(false);
                        if (handleStartReturn) handleStartReturn(inv);
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all flex items-center gap-1 active:scale-95"
                    >
                      <RotateCcw size={13} />
                      <span>بدء المرتجع</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
