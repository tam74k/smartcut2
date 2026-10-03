import React, { useState, useMemo, useEffect } from 'react';
import { AppSettings, Invoice, SalesReturn, SalesReturnItem, Product, Employee, ServiceItem } from '../types';
import { 
  X, RotateCcw, AlertTriangle, CheckSquare, Square, Package, Scissors, 
  Search, Calendar, User, Phone, Wallet, Printer, FileText, CheckCircle2 
} from 'lucide-react';
import { ThermalSalesReturnReceipt } from './ThermalSalesReturnReceipt';

interface SalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (salesReturn: SalesReturn) => void;
  settings: AppSettings;
  invoices: Invoice[];
  salesReturns: SalesReturn[];
  initialInvoice?: Invoice | null;
  currentUser?: any;
  products?: Product[];
  employees?: Employee[];
  services?: ServiceItem[];
}

export const RETURN_REASONS = [
  'عيب تصنيعي أو تلف في المنتج',
  'عدم رضا العميل عن جودة الخدمة',
  'خطأ في تسجيل الصنف أو الفاتورة',
  'رغبة العميل في الإلغاء والاسترجاع',
  'خدمة لم يتم تقديمها للعميل',
  'تغيير المنتج بمنتج آخر',
  'أخرى (مذكور في الملاحظات)'
];

export const SalesReturnModal: React.FC<SalesReturnModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  settings,
  invoices,
  salesReturns,
  initialInvoice,
  currentUser,
  products = [],
  employees = [],
  services = []
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(initialInvoice || null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  
  // Selected items to return: itemId -> returnQuantity
  const [itemSelections, setItemSelections] = useState<Record<string, { selected: boolean; returnQty: number; reason?: string }>>({});
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [notes, setNotes] = useState<string>('');
  const [treasuryId, setTreasuryId] = useState<string>('');
  const [restockProducts, setRestockProducts] = useState<boolean>(true);
  const [reverseCommissions, setReverseCommissions] = useState<boolean>(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justCompletedReturn, setJustCompletedReturn] = useState<SalesReturn | null>(null);

  useEffect(() => {
    if (initialInvoice) {
      setSelectedInvoice(initialInvoice);
    }
  }, [initialInvoice]);

  // When selected invoice changes, initialize item selections
  useEffect(() => {
    if (!selectedInvoice) {
      setItemSelections({});
      return;
    }

    // Default treasury from invoice payment methods or cash
    const defaultTreasury = selectedInvoice.paymentMethods?.[0]?.treasuryId || 
                            settings.treasuries.find(t => !t.isMain)?.id || 
                            settings.treasuries[0]?.id || 'cash';
    setTreasuryId(defaultTreasury);

    // Compute already returned quantities per item
    const priorReturns = salesReturns.filter(r => r.originalInvoiceId === selectedInvoice.id && r.status !== 'cancelled');
    const returnedQtyMap: Record<string, number> = {};
    priorReturns.forEach(ret => {
      ret.items.forEach(it => {
        const key = it.originalItemId || it.id || `${it.type}_${it.name}`;
        returnedQtyMap[key] = (returnedQtyMap[key] || 0) + (it.returnQuantity || 0);
      });
    });

    const initSelections: Record<string, { selected: boolean; returnQty: number; reason?: string }> = {};
    (selectedInvoice.items || []).forEach((item, idx) => {
      const key = item.id || `item_${idx}`;
      const originalQty = Number(item.quantity) || 1;
      const alreadyReturned = returnedQtyMap[key] || 0;
      const remainingQty = Math.max(0, originalQty - alreadyReturned);

      initSelections[key] = {
        selected: remainingQty > 0, // auto select if refundable
        returnQty: remainingQty,
        reason: ''
      };
    });

    setItemSelections(initSelections);
  }, [selectedInvoice, salesReturns, settings.treasuries]);

  // Filter invoices for search if no invoice is selected
  const matchingInvoices = useMemo(() => {
    if (!invoiceSearchQuery.trim()) return [];
    const q = invoiceSearchQuery.toLowerCase().trim();
    return invoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      const idMatch = (inv.id || '').toLowerCase().includes(q);
      const nameMatch = (inv.clientName || '').toLowerCase().includes(q);
      const phoneMatch = (inv.clientPhone || '').includes(q);
      return idMatch || nameMatch || phoneMatch;
    }).slice(0, 8);
  }, [invoices, invoiceSearchQuery]);

  // Existing returns on this invoice
  const existingReturns = useMemo(() => {
    if (!selectedInvoice) return [];
    return salesReturns.filter(r => r.originalInvoiceId === selectedInvoice.id && r.status !== 'cancelled');
  }, [selectedInvoice, salesReturns]);

  // Calculate items summary and refundable totals
  const { returnItemsList, subtotalRefund, totalRefund, isFullReturn, totalRemainingBeforeThis } = useMemo(() => {
    if (!selectedInvoice) return { returnItemsList: [], subtotalRefund: 0, totalRefund: 0, isFullReturn: false, totalRemainingBeforeThis: 0 };

    // Compute already returned
    const returnedQtyMap: Record<string, number> = {};
    existingReturns.forEach(ret => {
      ret.items.forEach(it => {
        const key = it.originalItemId || it.id || `${it.type}_${it.name}`;
        returnedQtyMap[key] = (returnedQtyMap[key] || 0) + (it.returnQuantity || 0);
      });
    });

    let totalInvQty = 0;
    let totalReturnedQty = 0;
    let subtotal = 0;
    const itemsList: SalesReturnItem[] = [];

    (selectedInvoice.items || []).forEach((item, idx) => {
      const key = item.id || `item_${idx}`;
      const originalQty = Number(item.quantity) || 1;
      const alreadyReturned = returnedQtyMap[key] || 0;
      const remainingQty = Math.max(0, originalQty - alreadyReturned);
      
      totalInvQty += originalQty;
      totalReturnedQty += alreadyReturned;

      const sel = itemSelections[key];
      if (sel && sel.selected && sel.returnQty > 0) {
        const actualReturnQty = Math.min(sel.returnQty, remainingQty);
        // Unit price paid
        const unitPrice = Number(item.price) || 0;
        const lineRefund = unitPrice * actualReturnQty;

        subtotal += lineRefund;
        itemsList.push({
          id: 'RETI-' + Math.random().toString(36).substr(2, 9),
          originalItemId: item.id,
          itemId: item.itemId,
          type: item.type || 'service',
          name: item.serviceName,
          price: unitPrice,
          originalQuantity: originalQty,
          returnQuantity: actualReturnQty,
          totalRefund: lineRefund,
          technicianId: item.employeeId,
          technicianName: item.technicianName,
          referralEmployeeId: item.referralEmployeeId,
          referralEmployeeName: item.referralEmployeeName,
          reason: sel.reason || reason
        });
      }
    });

    const isFull = (totalReturnedQty + itemsList.reduce((acc, it) => acc + it.returnQuantity, 0)) >= totalInvQty;

    return {
      returnItemsList: itemsList,
      subtotalRefund: subtotal,
      totalRefund: subtotal,
      isFullReturn: isFull,
      totalRemainingBeforeThis: totalInvQty - totalReturnedQty
    };
  }, [selectedInvoice, existingReturns, itemSelections, reason]);

  const handleToggleSelectAll = () => {
    if (!selectedInvoice) return;
    const allSelected = Object.values(itemSelections).every(s => s.selected);
    const updated = { ...itemSelections };
    Object.keys(updated).forEach(k => {
      updated[k].selected = !allSelected;
    });
    setItemSelections(updated);
  };

  const handleItemCheck = (key: string) => {
    setItemSelections(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        selected: !prev[key]?.selected
      }
    }));
  };

  const handleItemQtyChange = (key: string, qty: number, maxQty: number) => {
    const validQty = Math.max(1, Math.min(qty, maxQty));
    setItemSelections(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        returnQty: validQty
      }
    }));
  };

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

  const handleSubmitReturn = async () => {
    if (!selectedInvoice) {
      alert('يرجى اختيار فاتورة صالحة لعمل المرتجع');
      return;
    }

    if (returnItemsList.length === 0 || totalRefund <= 0) {
      alert('يرجى تحديد بند واحد على الأقل مع كمية صحيحة لإتمام المرتجع');
      return;
    }

    if (!treasuryId) {
      alert('يرجى اختيار الخزينة التي سيتم استرجاع المبلغ منها');
      return;
    }

    const treasuryObj = settings.treasuries.find(t => t.id === treasuryId);

    const now = new Date();
    const returnNumber = 'RET-' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const newReturn: SalesReturn = {
      id: returnNumber,
      salonId: settings.salonId,
      branchId: selectedInvoice.branchId,
      branchCode: selectedInvoice.branchCode,
      originalInvoiceId: selectedInvoice.id,
      originalInvoiceDate: selectedInvoice.date,
      date: now.toISOString(),
      clientId: selectedInvoice.clientId,
      clientName: selectedInvoice.clientName,
      clientPhone: selectedInvoice.clientPhone,
      items: returnItemsList,
      subtotalRefund: subtotalRefund,
      taxRefund: 0,
      totalRefund: totalRefund,
      refundMethod: treasuryId,
      treasuryId: treasuryId,
      treasuryName: treasuryObj?.name || 'الخزينة النقدية',
      reason: reason,
      returnType: isFullReturn ? 'full' : 'partial',
      createdBy: currentUser?.id,
      createdByName: currentUser?.name || 'الكاشير',
      notes: notes,
      status: 'completed',
      restockProducts: restockProducts,
      reverseCommissions: reverseCommissions
    };

    setIsSubmitting(true);
    try {
      await onConfirm(newReturn);
      setJustCompletedReturn(newReturn);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حفظ المرتجع.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right" dir="rtl">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-700 to-rose-900 text-white p-5 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <RotateCcw size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide">
                إنشاء مرتجع مبيعات • إشعار دائن (Sales Return)
              </h3>
              <p className="text-rose-200 text-xs mt-0.5">
                استرجاع مبالغ الأصناف أو الخدمات مع تعديل الخزينة وإعادة المخزون
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Success Mode (When return is completed) */}
          {justCompletedReturn ? (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-800">تم تسجيل مرتجع المبيعات بنجاح!</h4>
                <p className="text-slate-500 text-sm mt-1">
                  رقم سند المرتجع: <span className="font-mono font-bold text-rose-600">{justCompletedReturn.id}</span> للفاتورة رقم <span className="font-mono font-bold text-slate-700">#{justCompletedReturn.originalInvoiceId}</span>
                </p>
                <div className="mt-3 inline-block bg-rose-50 text-rose-700 px-4 py-1.5 rounded-xl border border-rose-200 text-sm font-bold">
                  المبلغ المسترد: {Number(justCompletedReturn.totalRefund).toFixed(2)} {settings.currency} من {justCompletedReturn.treasuryName}
                </div>
              </div>

              {/* Printable receipt in hidden view */}
              <div className="hidden">
                <ThermalSalesReturnReceipt salesReturn={justCompletedReturn} settings={settings} />
              </div>

              <div className="flex justify-center items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handlePrint(justCompletedReturn.id)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all"
                >
                  <Printer size={16} />
                  <span>طباعة سند المرتجع (إيصال حراري)</span>
                </button>
                <button
                  onClick={() => {
                    setJustCompletedReturn(null);
                    onClose();
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all"
                >
                  إغلاق النافذة
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 1. Invoice Selection / Info Header */}
              {!selectedInvoice ? (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    ابحث عن الفاتورة الأصلية المراد عمل مرتجع لها:
                  </label>
                  <div className="relative">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="اكتب رقم الفاتورة، أو اسم العميل، أو رقم الهاتف..."
                      value={invoiceSearchQuery}
                      onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pr-10 pl-4 py-2.5 text-sm font-medium focus:outline-none focus:border-rose-500 shadow-xs"
                      autoFocus
                    />
                  </div>

                  {/* Matching results */}
                  {matchingInvoices.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-md max-h-56 overflow-y-auto mt-2">
                      {matchingInvoices.map(inv => (
                        <div
                          key={inv.id}
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-3 hover:bg-rose-50/60 cursor-pointer flex justify-between items-center transition-colors text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 font-mono">#{inv.id}</span>
                            <span className="text-slate-400 mx-1.5">•</span>
                            <span className="font-bold text-rose-700">{inv.clientName}</span>
                            {inv.clientPhone && <span className="text-slate-500 font-mono mr-2">({inv.clientPhone})</span>}
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(inv.date).toLocaleDateString('ar-EG')} • {inv.items?.length || 0} أصناف
                            </div>
                          </div>
                          <div className="text-left font-mono font-bold text-slate-800 text-sm">
                            {Number(inv.total || 0).toFixed(2)} {settings.currency}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {invoiceSearchQuery && matchingInvoices.length === 0 && (
                    <p className="text-xs text-amber-600 font-medium">لم يتم العثور على فواتير مطابقة لهذا البحث.</p>
                  )}
                </div>
              ) : (
                /* Selected Invoice Overview Card */
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">الفاتورة الأصلية:</span>
                        <span className="font-mono font-black text-slate-900 text-sm">#{selectedInvoice.id}</span>
                        {selectedInvoice.status === 'refunded' && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-200">
                            مرتجع كلي سابق
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-3 mt-0.5">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          {selectedInvoice.clientName || 'عميل نقدي'}
                        </span>
                        {selectedInvoice.clientPhone && (
                          <span className="font-mono text-slate-500 flex items-center gap-1">
                            <Phone size={11} className="text-slate-400" />
                            {selectedInvoice.clientPhone}
                          </span>
                        )}
                        <span className="text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar size={11} className="text-slate-400" />
                          {new Date(selectedInvoice.date).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left font-mono">
                      <span className="text-[11px] text-slate-400 block">إجمالي الفاتورة:</span>
                      <span className="font-black text-slate-800 text-base">
                        {Number(selectedInvoice.total || 0).toFixed(2)} {settings.currency}
                      </span>
                    </div>

                    {!initialInvoice && (
                      <button
                        onClick={() => setSelectedInvoice(null)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 transition-colors cursor-pointer"
                      >
                        تغيير الفاتورة
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Prior returns warning if any */}
              {existingReturns.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <div>
                    تم تنفيذ <strong>({existingReturns.length})</strong> مرتجع سابق لهذه الفاتورة بقيمة إجمالية{' '}
                    <strong>{existingReturns.reduce((s, r) => s + r.totalRefund, 0).toFixed(2)} {settings.currency}</strong>.
                    الكميات المتاحة أدناه هي الكميات المتبقية فقط القابلة للاسترجاع.
                  </div>
                </div>
              )}

              {/* 2. Items Table Selection */}
              {selectedInvoice && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span>الأصناف والخدمات في الفاتورة</span>
                      <span className="text-xs text-slate-500 font-normal">
                        (حدد الأصناف والكميات المراد استرجاعها)
                      </span>
                    </h4>

                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs font-bold text-rose-700 hover:text-rose-800 flex items-center gap-1.5 cursor-pointer bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200"
                    >
                      <CheckSquare size={14} />
                      <span>تحديد / إلغاء تحديد الكل</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">اختر</th>
                          <th className="py-3 px-3">الصنف / الخدمة</th>
                          <th className="py-3 px-3 text-center">النوع</th>
                          <th className="py-3 px-3 text-center">الكمية المباعة</th>
                          <th className="py-3 px-3 text-center">المتبقي للاسترجاع</th>
                          <th className="py-3 px-3 text-center w-28">كمية المرتجع</th>
                          <th className="py-3 px-3 text-center">سعر الوحدة</th>
                          <th className="py-3 px-3 text-left">إجمالي المسترد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(selectedInvoice.items || []).map((item, idx) => {
                          const key = item.id || `item_${idx}`;
                          const originalQty = Number(item.quantity) || 1;
                          
                          // compute already returned
                          let returnedSoFar = 0;
                          existingReturns.forEach(ret => {
                            ret.items.forEach(it => {
                              if (it.originalItemId === item.id || it.name === item.serviceName) {
                                returnedSoFar += (it.returnQuantity || 0);
                              }
                            });
                          });
                          const maxRefundableQty = Math.max(0, originalQty - returnedSoFar);
                          const isFullyReturned = maxRefundableQty <= 0;
                          
                          const sel = itemSelections[key] || { selected: false, returnQty: 0 };
                          const lineRefund = (Number(item.price) || 0) * (sel.selected ? sel.returnQty : 0);

                          return (
                            <tr key={key} className={`transition-colors ${sel.selected ? 'bg-rose-50/40' : 'hover:bg-slate-50'} ${isFullyReturned ? 'opacity-40 bg-slate-100' : ''}`}>
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  disabled={isFullyReturned}
                                  checked={sel.selected && !isFullyReturned}
                                  onChange={() => handleItemCheck(key)}
                                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800 text-sm">{item.serviceName}</div>
                                {item.technicianName && (
                                  <div className="text-[11px] text-slate-500">الفني: {item.technicianName}</div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                  item.type === 'product' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                  {item.type === 'product' ? <Package size={10} /> : <Scissors size={10} />}
                                  <span>{item.type === 'product' ? 'منتج' : 'خدمة'}</span>
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                                {originalQty}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold">
                                {isFullyReturned ? (
                                  <span className="text-red-500">0 (مسترجع بالكامل)</span>
                                ) : (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    {maxRefundableQty}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={maxRefundableQty}
                                  disabled={!sel.selected || isFullyReturned}
                                  value={sel.returnQty || 1}
                                  onChange={(e) => handleItemQtyChange(key, parseInt(e.target.value) || 1, maxRefundableQty)}
                                  className="w-20 text-center font-mono font-black border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:border-rose-500 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </td>
                              <td className="py-3 px-3 text-center font-mono text-slate-700">
                                {Number(item.price).toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-left font-mono font-black text-rose-600 text-sm">
                                {lineRefund.toFixed(2)} {settings.currency}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. Reason, Treasury, and Restock Settings */}
              {selectedInvoice && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  {/* Return Reason */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      سبب الإرجاع والاسترداد: <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500 shadow-xs mb-2"
                    >
                      {RETURN_REASONS.map((r, i) => (
                        <option key={i} value={r}>{r}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="ملاحظات توضيحية إضافية لسبب المرتجع..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-rose-500 shadow-xs"
                    />
                  </div>

                  {/* Refund Treasury & Options */}
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">
                        خزينة رد وسحب المبلغ: <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={treasuryId}
                        onChange={(e) => setTreasuryId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500 shadow-xs"
                      >
                        {settings.treasuries.filter(t => !t.isMain).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                        {settings.treasuries.filter(t => t.isMain).map(t => (
                          <option key={t.id} value={t.id}>{t.name} (رئيسية)</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-2 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={restockProducts}
                          onChange={(e) => setRestockProducts(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                        />
                        <span>إعادة المنتجات المرتجعة إلى رصيد المستودع تلقائياً</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={reverseCommissions}
                          onChange={(e) => setReverseCommissions(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                        />
                        <span>عكس وخصم عمولات الموظفين المستحقة على البنود المرجعة</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Total Calculation Summary Bar */}
              {selectedInvoice && (
                <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4">
                  <div className="space-y-0.5">
                    <div className="text-xs text-rose-800 font-bold flex items-center gap-2">
                      <span>نوع المرتجع الناتج:</span>
                      <span className="bg-rose-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                        {isFullReturn ? 'مرتجع كلي كامل' : 'مرتجع جزئي'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      سيتم تسجيل حركة سحب مالي من الخزينة المحددة، وتحديث حالة الفاتورة.
                    </p>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-xs text-rose-700 font-bold block">صافي المبلغ المسترد للعميل:</span>
                    <span className="text-2xl font-black text-rose-700">
                      {totalRefund.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!justCompletedReturn && (
          <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
            >
              إلغاء وتراجع
            </button>

            {selectedInvoice && (
              <button
                type="button"
                disabled={isSubmitting || returnItemsList.length === 0 || totalRefund <= 0}
                onClick={handleSubmitReturn}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw size={16} />
                <span>{isSubmitting ? 'جاري التنفيذ...' : `تأكيد المرتجع (${totalRefund.toFixed(2)} ${settings.currency})`}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
