import React, { useState, useMemo } from 'react';
import { AppSettings, Invoice, SalesReturn, Branch, Product, Employee, ServiceItem } from '../types';
import { 
  RotateCcw, Search, Filter, Printer, Download, Eye, Plus, Calendar, 
  Trash2, X, FileSpreadsheet, ChevronDown, ChevronUp, Package, Scissors, 
  ArrowDownLeft, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { SalesReturnModal } from './SalesReturnModal';
import { ThermalSalesReturnReceipt } from './ThermalSalesReturnReceipt';
import { exportToExcel } from '../utils/exportExcel';

interface SalesReturnsScreenProps {
  settings: AppSettings;
  salesReturns: SalesReturn[];
  setSalesReturns: (returns: SalesReturn[] | ((prev: SalesReturn[]) => SalesReturn[])) => void;
  invoices: Invoice[];
  onProcessSalesReturn: (ret: SalesReturn) => void;
  onDeleteSalesReturn?: (returnId: string) => void;
  activeBranchId?: string;
  branches?: Branch[];
  currentUser?: any;
  products?: Product[];
  employees?: Employee[];
  services?: ServiceItem[];
}

export const SalesReturnsScreen: React.FC<SalesReturnsScreenProps> = ({
  settings,
  salesReturns,
  setSalesReturns,
  invoices,
  onProcessSalesReturn,
  onDeleteSalesReturn,
  activeBranchId,
  branches = [],
  currentUser,
  products = [],
  employees = [],
  services = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [treasuryFilter, setTreasuryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'full' | 'partial'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReturnForPreview, setSelectedReturnForPreview] = useState<SalesReturn | null>(null);
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');

  const canDelete = !currentUser || currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'programmer';

  const matchesActiveBranch = (itemBranchId?: string) => {
    if (branchFilter !== 'all') return itemBranchId === branchFilter;
    if (!itemBranchId) return true;
    if (!branches || branches.length <= 1) return true;
    if (itemBranchId === activeBranchId) return true;
    return true;
  };

  const filteredReturns = useMemo(() => {
    return salesReturns.filter(ret => {
      if (ret.status === 'cancelled') return false;
      if (!matchesActiveBranch(ret.branchId)) return false;

      const retDateStr = (ret.date || '').split('T')[0];
      if (dateFrom && retDateStr < dateFrom) return false;
      if (dateTo && retDateStr > dateTo) return false;

      if (treasuryFilter !== 'all' && ret.treasuryId !== treasuryFilter) return false;
      if (typeFilter !== 'all' && ret.returnType !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = (ret.id || '').toLowerCase().includes(q);
        const invMatch = (ret.originalInvoiceId || '').toLowerCase().includes(q);
        const nameMatch = (ret.clientName || '').toLowerCase().includes(q);
        const phoneMatch = (ret.clientPhone || '').includes(q);
        const reasonMatch = (ret.reason || '').toLowerCase().includes(q);
        return idMatch || invMatch || nameMatch || phoneMatch || reasonMatch;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [salesReturns, branchFilter, dateFrom, dateTo, treasuryFilter, typeFilter, searchQuery, activeBranchId]);

  // KPIs
  const stats = useMemo(() => {
    let totalAmount = 0;
    let productReturnsCount = 0;
    let serviceReturnsCount = 0;
    let fullReturnsCount = 0;
    let partialReturnsCount = 0;

    filteredReturns.forEach(ret => {
      totalAmount += (Number(ret.totalRefund) || 0);
      if (ret.returnType === 'full') fullReturnsCount++;
      else partialReturnsCount++;

      (ret.items || []).forEach(it => {
        if (it.type === 'product') productReturnsCount += (it.returnQuantity || 1);
        else serviceReturnsCount += (it.returnQuantity || 1);
      });
    });

    return {
      totalAmount,
      totalCount: filteredReturns.length,
      productReturnsCount,
      serviceReturnsCount,
      fullReturnsCount,
      partialReturnsCount
    };
  }, [filteredReturns]);

  const handlePrint = (returnId: string) => {
    const printContent = document.getElementById(`thermal-sales-return-${returnId}`)?.outerHTML;
    if (printContent) {
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write('<html><head><title>طباعة إشعار دائن مرتجع مبيعات</title>');
        printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">');
        printWindow.document.write('<style>');
        printWindow.document.write('body { margin: 0; display: flex; justify-content: center; background-color: #fff; direction: rtl; font-family: "Cairo", sans-serif; }');
        printWindow.document.write('@media print { body { padding: 0; margin: 0; } @page { margin: 0; } }');
        printWindow.document.write('</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent);
        printWindow.document.write('</body></html>');
        
        printWindow.setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    }
  };

  const handleExportExcel = () => {
    const rows = filteredReturns.map((ret, idx) => ({
      'م': idx + 1,
      'رقم سند المرتجع': ret.id,
      'رقم الفاتورة الأصلية': ret.originalInvoiceId,
      'التاريخ والوقت': new Date(ret.date).toLocaleString('ar-SA'),
      'اسم العميل': ret.clientName || 'عميل نقدي',
      'رقم الهاتف': ret.clientPhone || '-',
      'نوع الإرجاع': ret.returnType === 'full' ? 'مرتجع كلي' : 'مرتجع جزئي',
      'الأصناف المستردة': ret.items.map(it => `${it.name} (${it.returnQuantity})`).join(' ، '),
      'الخزينة المنصرف منها': ret.treasuryName || ret.treasuryId,
      'المبلغ المسترد': ret.totalRefund,
      'سبب الإرجاع': ret.reason || '-',
      'المسؤول': ret.createdByName || '-'
    }));

    exportToExcel(rows, `تقرير_مرتجعات_المبيعات_${new Date().toISOString().split('T')[0]}`);
  };

  const handleDelete = (ret: SalesReturn) => {
    if (!canDelete) {
      alert('⛔ حذف سندات المرتجع مقتصر على إدارة النظام.');
      return;
    }
    if (window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف سند المرتجع رقم (${ret.id})؟ سيتم إلغاء أثره المالي وعكس القيود المرتبطة.`)) {
      if (onDeleteSalesReturn) {
        onDeleteSalesReturn(ret.id);
      } else {
        setSalesReturns(prev => prev.filter(r => r.id !== ret.id));
      }
      alert('✅ تم حذف سند المرتجع بنجاح.');
    }
  };

  return (
    <div className="p-6 md:p-8 w-full h-full flex flex-col bg-slate-50 overflow-y-auto" dir="rtl">
      
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
              <RotateCcw size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                سجل وإدارة مرتجعات المبيعات (Sales Returns)
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                متابعة فواتير المرتجع، إشعارات الدائن، واسترداد المبالغ والمخزون بدقة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>إنشاء مرتجع مبيعات جديد</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
            title="تصدير جدول المرتجعات إلى ملف إكسل"
          >
            <FileSpreadsheet size={16} />
            <span className="hidden sm:inline">تصدير إكسل</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft size={24} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">إجمالي مبالغ المرتجعات</span>
            <div className="text-xl font-black text-rose-600 font-mono">
              {stats.totalAmount.toFixed(2)} <span className="text-xs font-sans text-slate-600">{settings.currency}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <RotateCcw size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">عدد فواتير المرتجع</span>
            <div className="text-xl font-black text-slate-800 font-mono">
              {stats.totalCount} <span className="text-xs font-sans text-slate-400">عملية</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">منتجات تم إرجاعها للمخزن</span>
            <div className="text-xl font-black text-amber-700 font-mono">
              {stats.productReturnsCount} <span className="text-xs font-sans text-slate-400">قطعة</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Scissors size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">خدمات مستردة ومعدلة</span>
            <div className="text-xl font-black text-purple-700 font-mono">
              {stats.serviceReturnsCount} <span className="text-xs font-sans text-slate-400">خدمة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="بحث برقم المرتجع، رقم الفاتورة، اسم العميل، الهاتف، السبب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                showFilters ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Filter size={15} />
              <span>خيارات التصفية</span>
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {branches && branches.length > 1 && (
              <div>
                <label className="block font-bold text-slate-600 mb-1">الفرع:</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium outline-none focus:border-rose-500"
                >
                  <option value="all">كل الفروع</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-600 mb-1">من تاريخ:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">إلى تاريخ:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">نوع المرتجع:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium outline-none focus:border-rose-500"
              >
                <option value="all">الكل (كلي وجزئي)</option>
                <option value="full">مرتجع كلي كامل</option>
                <option value="partial">مرتجع جزئي</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">الخزينة المنصرف منها:</label>
              <select
                value={treasuryFilter}
                onChange={(e) => setTreasuryFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium outline-none focus:border-rose-500"
              >
                <option value="all">كل الخزائن</option>
                {settings.treasuries.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Returns Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3.5 px-4">رقم السند</th>
                <th className="py-3.5 px-4">الفاتورة الأصلية</th>
                <th className="py-3.5 px-4">التاريخ والوقت</th>
                <th className="py-3.5 px-4">العميل</th>
                <th className="py-3.5 px-4">البنود المرجعة</th>
                <th className="py-3.5 px-4 text-center">النوع</th>
                <th className="py-3.5 px-4">الخزينة</th>
                <th className="py-3.5 px-4">المبلغ المسترد</th>
                <th className="py-3.5 px-4">سبب الإرجاع</th>
                <th className="py-3.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                      <RotateCcw size={20} />
                    </div>
                    <p className="font-bold text-sm text-slate-600">لا توجد عمليات مرتجع مبيعات مسجلة</p>
                    <p className="text-xs text-slate-400 mt-0.5">يمكنك إنشاء مرتجع جديد بالضغط على زر "إنشاء مرتجع مبيعات جديد" بالأعلى</p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map(ret => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-700">
                      {ret.id}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      #{ret.originalInvoiceId}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(ret.date).toLocaleString('ar-SA')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{ret.clientName || 'عميل نقدي'}</div>
                      {ret.clientPhone && <div className="text-[11px] font-mono text-slate-400">{ret.clientPhone}</div>}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-col gap-1">
                        {ret.items.map((it, idx) => (
                          <div key={idx} className="text-[11px] text-slate-700 flex items-center gap-1">
                            <span className="font-bold text-slate-900">{it.name}</span>
                            <span className="font-mono text-rose-600 font-bold">({it.returnQuantity}×)</span>
                            {it.type === 'product' && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded">منتج</span>}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ret.returnType === 'full' 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {ret.returnType === 'full' ? 'مرتجع كلي' : 'مرتجع جزئي'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-bold">
                      {ret.treasuryName || ret.treasuryId}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-rose-600 text-sm">
                      {Number(ret.totalRefund).toFixed(2)} {settings.currency}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={ret.reason + (ret.notes ? ` - ${ret.notes}` : '')}>
                      <span>{ret.reason}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedReturnForPreview(ret)}
                          className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors cursor-pointer"
                          title="معاينة سند المرتجع"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          onClick={() => handlePrint(ret.id)}
                          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                          title="طباعة سند المرتجع (إيصال حراري)"
                        >
                          <Printer size={14} />
                        </button>

                        {canDelete && (
                          <button
                            onClick={() => handleDelete(ret)}
                            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors cursor-pointer"
                            title="حذف سند المرتجع"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}

                        {/* Hidden thermal print receipt container */}
                        <div className="hidden">
                          <ThermalSalesReturnReceipt salesReturn={ret} settings={settings} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>إجمالي السجلات المعروضة: <strong>{filteredReturns.length}</strong> سند مرتجع</span>
          <span>إجمالي المبالغ المستردة: <strong className="font-mono text-rose-600">{stats.totalAmount.toFixed(2)} {settings.currency}</strong></span>
        </div>
      </div>

      {/* Create Sales Return Modal */}
      {showCreateModal && (
        <SalesReturnModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onConfirm={(newRet) => {
            onProcessSalesReturn(newRet);
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

      {/* Preview & Print Modal */}
      {selectedReturnForPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-right" dir="rtl">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-rose-400" />
                <h3 className="font-black text-sm">معاينة وطباعة إشعار دائن مرتجع • #{selectedReturnForPreview.id}</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintFormat(printFormat === 'thermal' ? 'a4' : 'thermal')}
                  className="bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  {printFormat === 'thermal' ? 'التبديل إلى نموذج A4' : 'التبديل إلى إيصال حراري'}
                </button>
                <button
                  onClick={() => setSelectedReturnForPreview(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
              <div className="bg-white shadow-md rounded-xl p-4">
                <ThermalSalesReturnReceipt
                  salesReturn={selectedReturnForPreview}
                  settings={settings}
                  id="preview-sales-return"
                  isA4={printFormat === 'a4'}
                />
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                onClick={() => setSelectedReturnForPreview(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                إغلاق
              </button>

              <button
                onClick={() => handlePrint('preview-sales-return')}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer size={15} />
                <span>طباعة السند الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
