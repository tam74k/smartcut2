import React, { useState, useMemo, useEffect } from 'react';
import { AppSettings, PromoCode, PromoCodeUsage, Invoice } from '../types';
import { DB } from '../services/db';
import { 
  Tag, Plus, CheckCircle2, Clock, Trash2, Edit2, Copy, Check, 
  Users, DollarSign, Calendar, Percent, AlertCircle, FileText,
  Receipt, Printer, RefreshCw
} from 'lucide-react';

interface PromoCodesScreenProps {
  settings: AppSettings;
  promoCodes: PromoCode[];
  setPromoCodes: (updater: PromoCode[] | ((prev: PromoCode[]) => PromoCode[])) => void;
  promoCodeUsages: PromoCodeUsage[];
  setPromoCodeUsages?: (updater: PromoCodeUsage[] | ((prev: PromoCodeUsage[]) => PromoCodeUsage[])) => void;
  invoices?: Invoice[];
  currentUser?: any;
}

export function PromoCodesScreen({
  settings,
  promoCodes = [],
  setPromoCodes,
  promoCodeUsages = [],
  setPromoCodeUsages,
  invoices = [],
  currentUser
}: PromoCodesScreenProps) {
  const [activeTab, setActiveTab] = useState<'codes' | 'usages'>('codes');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedCodeForDetails, setSelectedCodeForDetails] = useState<PromoCode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // مزامنة فورية ومباشرة مع قاعدة البيانات السحابية (Supabase) عند فتح الشاشة
  const fetchCloudData = async () => {
    setIsLoading(true);
    try {
      const [cloudCodes, cloudUsages] = await Promise.all([
        DB.fetchPromoCodes(settings.salonId),
        DB.fetchPromoCodeUsages(settings.salonId)
      ]);
      if (Array.isArray(cloudCodes)) {
        setPromoCodes(cloudCodes);
        try { localStorage.setItem('smartcut_promo_codes', JSON.stringify(cloudCodes)); } catch (e) {}
      }
      if (Array.isArray(cloudUsages) && setPromoCodeUsages) {
        setPromoCodeUsages(cloudUsages);
        try { localStorage.setItem('smartcut_promo_code_usages', JSON.stringify(cloudUsages)); } catch (e) {}
      }
    } catch (err) {
      console.warn('Error loading promo codes on mount:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCloudData();
  }, [settings.salonId]);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<'percentage' | 'fixed'>('percentage');
  const [formValue, setFormValue] = useState<number | ''>('');
  const [formMaxDiscount, setFormMaxDiscount] = useState<number | ''>('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [formMaxUsesTotal, setFormMaxUsesTotal] = useState<number | ''>('');
  const [formNotes, setFormNotes] = useState('');

  // Total discounts given through promo codes
  const totalDiscountsGiven = useMemo(() => {
    return promoCodeUsages.reduce((sum, u) => sum + (Number(u.discountApplied) || 0), 0);
  }, [promoCodeUsages]);

  const activeCodesCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return promoCodes.filter(c => {
      const isDateValid = c.endDate >= today;
      const isUsesValid = !c.maxUsesTotal || c.usesCount < c.maxUsesTotal;
      return c.isActive && isDateValid && isUsesValid;
    }).length;
  }, [promoCodes]);

  // دالة استخراج تفاصيل العملاء المستخدمين لكود محدد مع إجمالي الفاتورة قبل وبعد الخصم
  const getDetailedUsagesForCode = (pc: PromoCode) => {
    const list: Array<{
      id: string;
      clientName: string;
      clientPhone: string;
      visitDate: string;
      invoiceId?: string;
      invoiceSubtotal: number;
      discountApplied: number;
      invoiceTotal: number;
      invoiceStatus?: string;
    }> = [];
    const processedInvoiceIds = new Set<string>();
    const clean = pc.code?.trim().toUpperCase();

    // 1. من سجل استخدامات البرومو كود
    const usages = promoCodeUsages.filter(u => 
      u.promoCodeId === pc.id || u.code?.trim().toUpperCase() === clean
    );

    usages.forEach(u => {
      const inv = invoices.find(i => 
        (u.invoiceId && i.id === u.invoiceId) ||
        (i.promoCode?.trim().toUpperCase() === clean && 
         i.clientPhone && u.clientPhone && 
         i.clientPhone.replace(/\D/g, '') === u.clientPhone.replace(/\D/g, '') &&
         Math.abs(new Date(i.date).getTime() - new Date(u.usedAt).getTime()) < 86400000)
      );

      if (inv) processedInvoiceIds.add(inv.id);

      const disc = Number(u.discountApplied || (u as any).discount_applied || inv?.promoDiscount || inv?.discount || 0);
      const total = Number(inv ? (inv.total ?? 0) : 0);
      const subtotal = inv ? Number(inv.subtotal ?? (total + disc)) : Number(total + disc);

      list.push({
        id: u.id,
        clientName: u.clientName || (u as any).client_name || inv?.clientName || 'عميل نقدي',
        clientPhone: u.clientPhone || (u as any).client_phone || inv?.clientPhone || '-',
        visitDate: inv?.date || u.usedAt || (u as any).used_at || new Date().toISOString(),
        invoiceId: u.invoiceId || (u as any).invoice_id || inv?.id || undefined,
        invoiceSubtotal: isNaN(subtotal) ? 0 : subtotal,
        discountApplied: isNaN(disc) ? 0 : disc,
        invoiceTotal: isNaN(total) ? 0 : total,
        invoiceStatus: inv?.status || 'completed'
      });
    });

    // 2. الفواتير المسجلة بالبرومو كود ولم تكن مضافة بعد في الاستخدامات
    invoices.forEach(inv => {
      if (inv.status === 'cancelled') return;
      if (inv.promoCode?.trim().toUpperCase() === clean && !processedInvoiceIds.has(inv.id)) {
        const disc = Number(inv.promoDiscount || inv.discount || 0);
        const total = Number(inv.total || 0);
        const subtotal = Number(inv.subtotal ?? (total + disc));
        list.push({
          id: 'INV-USAGE-' + inv.id,
          clientName: inv.clientName || 'عميل نقدي',
          clientPhone: inv.clientPhone || '-',
          visitDate: inv.date || new Date().toISOString(),
          invoiceId: inv.id,
          invoiceSubtotal: isNaN(subtotal) ? 0 : subtotal,
          discountApplied: isNaN(disc) ? 0 : disc,
          invoiceTotal: isNaN(total) ? 0 : total,
          invoiceStatus: inv.status
        });
      }
    });

    return list;
  };

  const handleOpenAdd = () => {
    setEditingCode(null);
    setFormCode('');
    setFormType('percentage');
    setFormValue('');
    setFormMaxDiscount('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setFormMaxUsesTotal('');
    setFormNotes('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (pc: PromoCode) => {
    setEditingCode(pc);
    setFormCode(pc.code);
    setFormType(pc.discountType);
    setFormValue(pc.discountValue);
    setFormMaxDiscount(pc.maxDiscountAmount || '');
    setFormStartDate(pc.startDate);
    setFormEndDate(pc.endDate);
    setFormMaxUsesTotal(pc.maxUsesTotal || '');
    setFormNotes(pc.notes || '');
    setShowAddModal(true);
  };

  // حفظ في قاعدة البيانات السحابية (Supabase) مباشرة
  const handleSavePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) {
      alert('يرجى إدخال كود الخصم');
      return;
    }
    if (!formValue || Number(formValue) <= 0) {
      alert('يرجى إدخال قيمة الخصم بشكل صحيح');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCode) {
        const updatedPromo: PromoCode = {
          ...editingCode,
          code: cleanCode,
          discountType: formType,
          discountValue: Number(formValue),
          maxDiscountAmount: formMaxDiscount ? Number(formMaxDiscount) : undefined,
          startDate: formStartDate,
          endDate: formEndDate,
          maxUsesTotal: formMaxUsesTotal ? Number(formMaxUsesTotal) : undefined,
          notes: formNotes.trim() || undefined
        };
        const saved = await DB.savePromoCode(updatedPromo);
        if (!saved) {
          alert('تعذر حفظ التعديلات في قاعدة البيانات السحابية، يرجى التأكد من اتصال الإنترنت.');
          return;
        }
        setPromoCodes(promoCodes.map(c => c.id === editingCode.id ? updatedPromo : c));
        try {
          const updatedList = promoCodes.map(c => c.id === editingCode.id ? updatedPromo : c);
          localStorage.setItem('smartcut_promo_codes', JSON.stringify(updatedList));
        } catch (e) {}
        alert(`✅ تم تحديث كود الخصم (${cleanCode}) في قاعدة البيانات بنجاح!`);
      } else {
        // Check duplicate
        if (promoCodes.some(c => c.code === cleanCode)) {
          alert('هذا الكود مسجل مسبقاً، يرجى اختيار كود آخر');
          return;
        }

        const newPromo: PromoCode = {
          id: 'PC-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
          salonId: settings.salonId,
          code: cleanCode,
          discountType: formType,
          discountValue: Number(formValue),
          maxDiscountAmount: formMaxDiscount ? Number(formMaxDiscount) : undefined,
          startDate: formStartDate,
          endDate: formEndDate,
          maxUsesTotal: formMaxUsesTotal ? Number(formMaxUsesTotal) : undefined,
          usesCount: 0,
          isActive: true,
          notes: formNotes.trim() || undefined,
          createdBy: currentUser?.name || 'المدير'
        };
        const saved = await DB.savePromoCode(newPromo);
        if (!saved) {
          alert('تعذر حفظ كود الخصم في قاعدة البيانات السحابية، يرجى التأكد من اتصال الإنترنت.');
          return;
        }
        setPromoCodes([...promoCodes, newPromo]);
        try {
          localStorage.setItem('smartcut_promo_codes', JSON.stringify([...promoCodes, newPromo]));
        } catch (e) {}
        alert(`✅ تم حفظ كود الخصم (${cleanCode}) في قاعدة البيانات السحابية بنجاح!`);
      }
      setShowAddModal(false);
    } catch (err: any) {
      console.error('Error saving promo code:', err);
      alert(`حدث خطأ أثناء الحفظ: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الكود نهائياً من قاعدة البيانات؟')) {
      const res = await DB.deletePromoCode(id);
      setPromoCodes(promoCodes.filter(c => c.id !== id));
      try {
        localStorage.setItem('smartcut_promo_codes', JSON.stringify(promoCodes.filter(c => c.id !== id)));
      } catch (e) {}
      alert('تم حذف كود الخصم من قاعدة البيانات.');
    }
  };

  const handleToggleActive = async (id: string) => {
    const target = promoCodes.find(c => c.id === id);
    if (!target) return;
    const updated = { ...target, isActive: !target.isActive };
    await DB.savePromoCode(updated);
    setPromoCodes(promoCodes.map(c => c.id === id ? updated : c));
    try {
      localStorage.setItem('smartcut_promo_codes', JSON.stringify(promoCodes.map(c => c.id === id ? updated : c)));
    } catch (e) {}
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // طباعة تقرير مستخدمي الكود وتفاصيل الفواتير قبل وبعد الخصم
  const handlePrintUsagesReport = (pc: PromoCode, usages: Array<any>) => {
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) return;
    const totalSub = usages.reduce((s, u) => s + (u.invoiceSubtotal || 0), 0);
    const totalDisc = usages.reduce((s, u) => s + (u.discountApplied || 0), 0);
    const totalNet = usages.reduce((s, u) => s + (u.invoiceTotal || 0), 0);

    const rowsHtml = usages.map((u, i) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${i + 1}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${u.clientName}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; direction: ltr; text-align: right; font-family: monospace;">${u.clientPhone}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${u.visitDate ? new Date(u.visitDate).toLocaleString('ar-EG') : '-'}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${u.invoiceId || '-'}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold;">${Number(u.invoiceSubtotal || 0).toFixed(2)} ${settings.currency}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: left; color: #dc2626; font-weight: bold;">-${Number(u.discountApplied || 0).toFixed(2)} ${settings.currency}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #16a34a;">${Number(u.invoiceTotal || 0).toFixed(2)} ${settings.currency}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير مستخدمي كود الخصم: ${pc.code}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 24px; color: #1e293b; direction: rtl; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th { background: #f8fafc; padding: 10px; border: 1px solid #cbd5e1; text-align: right; }
            .header { border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 20px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${settings.salonName || 'صالون'} - تقرير مستخدمي كود الخصم (${pc.code})</h2>
            <p>تاريخ استخراج التقرير: ${new Date().toLocaleString('ar-EG')}</p>
          </div>
          <table style="margin-bottom: 20px; background: #f8fafc;">
            <tr>
              <td style="padding: 10px;"><strong>كود الخصم:</strong> ${pc.code}</td>
              <td style="padding: 10px;"><strong>نوع الخصم:</strong> ${pc.discountType === 'percentage' ? pc.discountValue + '%' : pc.discountValue + ' ' + settings.currency}</td>
              <td style="padding: 10px;"><strong>إجمالي الاستخدامات:</strong> ${usages.length}</td>
            </tr>
            <tr>
              <td style="padding: 10px;"><strong>إجمالي قبل الخصم:</strong> ${Number(totalSub || 0).toFixed(2)} ${settings.currency}</td>
              <td style="padding: 10px;"><strong>إجمالي الخصم الممنوح:</strong> ${Number(totalDisc || 0).toFixed(2)} ${settings.currency}</td>
              <td style="padding: 10px;"><strong>إجمالي بعد الخصم:</strong> ${Number(totalNet || 0).toFixed(2)} ${settings.currency}</td>
            </tr>
          </table>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم العميل</th>
                <th>رقم الهاتف</th>
                <th>تاريخ الزيارة</th>
                <th>رقم الفاتورة</th>
                <th>قبل الخصم</th>
                <th>الخصم المطبق</th>
                <th>بعد الخصم</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px;">لا يوجد استخدامات مسجلة</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <Tag className="text-purple-600" size={26} />
            <span>نظام البرومو كود وأكواد المشاهير (Promo Codes)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">إنشاء وإدارة أكواد الخصم والحملات الترويجية (استخدام مرة واحدة لكل عميل بناءً على رقم هاتفه)</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchCloudData}
            disabled={isLoading}
            title="تحديث البيانات مباشرة من قاعدة البيانات السحابية"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-300 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-purple-600' : 'text-slate-500'} />
            <span className="hidden sm:inline">{isLoading ? 'جاري التحميل...' : 'مزامنة السحابة'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>إنشاء كود خصم جديد</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Tag size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي الأكواد النشطة</div>
            <div className="text-xl font-black text-slate-800 mt-0.5">
              {activeCodesCount} <span className="text-xs font-normal text-slate-500">من أصل {promoCodes.length}</span>
            </div>
            <div className="text-[11px] text-purple-600 font-semibold mt-0.5">أكواد صالحة للاستخدام حالياً</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">مرات الاستخدام</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5">
              {promoCodeUsages.length} <span className="text-xs font-normal text-slate-500">عملية استخدام</span>
            </div>
            <div className="text-[11px] text-slate-400 font-semibold mt-0.5">موثقة في فواتير المبيعات</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي الخصومات الممنوحة</div>
            <div className="text-xl font-black text-blue-600 mt-0.5">
              {totalDiscountsGiven.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-semibold mt-0.5">خصومات تسويقية مقدمة</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('codes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'codes' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          أكواد الخصم النشطة ({promoCodes.length})
        </button>
        <button
          onClick={() => setActiveTab('usages')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'usages' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          سجل استخدامات العملاء ({promoCodeUsages.length})
        </button>
      </div>

      {/* Tab 1: Codes List */}
      {activeTab === 'codes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {promoCodes.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <Tag size={48} className="text-slate-200 stroke-1" />
              <p className="text-sm font-semibold">لم تقم بإنشاء أي برومو كود حتى الآن</p>
              <button
                onClick={handleOpenAdd}
                className="mt-1 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold rounded-xl transition-all"
              >
                + إنشاء أول كود خصم
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="p-3.5">كود الخصم</th>
                    <th className="p-3.5">نوع وقيمة الخصم</th>
                    <th className="p-3.5">الحد الأقصى للخصم</th>
                    <th className="p-3.5">فترة الصلاحية</th>
                    <th className="p-3.5">الاستخدامات</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-center">المستخدمون</th>
                    <th className="p-3.5 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promoCodes.map(pc => {
                    const today = new Date().toISOString().split('T')[0];
                    const isDateExpired = pc.endDate < today;
                    const isUsesExpired = Boolean(pc.maxUsesTotal && pc.usesCount >= pc.maxUsesTotal);
                    const isExpired = isDateExpired || isUsesExpired;
                    const detailedUsages = getDetailedUsagesForCode(pc);

                    return (
                      <tr key={pc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 tracking-wider">
                              {pc.code}
                            </span>
                            <button
                              onClick={() => handleCopy(pc.code)}
                              className="text-slate-400 hover:text-purple-600 p-1"
                              title="نسخ الكود"
                            >
                              {copiedCode === pc.code ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                          {pc.notes && <div className="text-[10px] text-slate-400 mt-1">{pc.notes}</div>}
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">
                          {pc.discountType === 'percentage' ? (
                            <span className="text-emerald-600 font-extrabold text-sm">{pc.discountValue}% خصم</span>
                          ) : (
                            <span className="text-blue-600 font-extrabold text-sm">{pc.discountValue} {settings.currency}</span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {pc.maxDiscountAmount ? `${pc.maxDiscountAmount} ${settings.currency}` : 'بدون حد أقصى'}
                        </td>
                        <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                          <div>من: {pc.startDate}</div>
                          <div className={isDateExpired ? 'text-red-500 font-bold' : ''}>إلى: {pc.endDate}</div>
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                            isUsesExpired ? 'bg-red-50 text-red-700 font-black border border-red-200' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {pc.usesCount} {pc.maxUsesTotal ? `/ ${pc.maxUsesTotal}` : 'استخدام'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {isExpired ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-black text-xs border border-rose-200 flex items-center gap-1 shadow-2xs">
                                <AlertCircle size={12} className="text-rose-600" />
                                <span>منتهي</span>
                              </span>
                              <span className="text-[10px] text-rose-600 font-bold">
                                {isDateExpired && isUsesExpired ? 'انتهى التاريخ والحد' : isDateExpired ? 'انتهت الصلاحية' : 'استنفذ الحد الأقصى'}
                              </span>
                            </div>
                          ) : pc.isActive ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-100 inline-flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              <span>فعال ونشط</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">
                              معطل
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedCodeForDetails(pc)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs active:scale-95 ${
                              isExpired
                                ? 'bg-purple-600 hover:bg-purple-700 text-white font-black ring-2 ring-purple-300 ring-offset-1'
                                : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                            }`}
                            title="عرض قائمة العملاء وتواريخ زياراتهم وإجمالي الفواتير قبل وبعد الخصم"
                          >
                            <Users size={14} />
                            <span>قائمة العملاء ({detailedUsages.length})</span>
                          </button>
                        </td>
                        <td className="p-3.5 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleActive(pc.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                pc.isActive 
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' 
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                              }`}
                            >
                              {pc.isActive ? 'تعطيل' : 'تفعيل'}
                            </button>
                            <button
                              onClick={() => handleOpenEdit(pc)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="تعديل"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeletePromo(pc.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Usages Log */}
      {activeTab === 'usages' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {promoCodeUsages.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <FileText size={48} className="text-slate-200 stroke-1" />
              <p className="text-sm font-semibold">لم يقم أي عميل باستخدام برومو كود حتى الآن</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="p-3.5">تاريخ ووقت الاستخدام</th>
                    <th className="p-3.5">كود الخصم</th>
                    <th className="p-3.5">اسم العميل</th>
                    <th className="p-3.5">رقم الهاتف</th>
                    <th className="p-3.5">رقم الفاتورة</th>
                    <th className="p-3.5 text-left">إجمالي قبل الخصم</th>
                    <th className="p-3.5 text-left">الخصم المطبق</th>
                    <th className="p-3.5 text-left">إجمالي بعد الخصم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promoCodeUsages.map(u => {
                    const matchedInv = invoices.find(inv => 
                      (u.invoiceId && inv.id === u.invoiceId) || 
                      (inv.promoCode?.trim().toUpperCase() === u.code?.trim().toUpperCase() && 
                       inv.clientPhone && u.clientPhone && 
                       inv.clientPhone.replace(/\D/g, '') === u.clientPhone.replace(/\D/g, ''))
                    );
                    const disc = Number(u.discountApplied || matchedInv?.promoDiscount || matchedInv?.discount || 0);
                    const netTotal = Number(matchedInv ? matchedInv.total : 0);
                    const subtotal = Number(matchedInv ? (matchedInv.subtotal ?? (matchedInv.total + disc)) : (netTotal + disc));

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">{new Date(u.usedAt).toLocaleString('ar-EG')}</td>
                        <td className="p-3.5">
                          <span className="font-mono font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            {u.code}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">{u.clientName || matchedInv?.clientName || 'عميل نقدي'}</td>
                        <td className="p-3.5 text-slate-600 font-mono" dir="ltr">{u.clientPhone || matchedInv?.clientPhone || '-'}</td>
                        <td className="p-3.5 font-mono text-slate-600">{u.invoiceId || matchedInv?.id || '-'}</td>
                        <td className="p-3.5 text-left font-mono font-bold text-slate-700">
                          {Number(subtotal || 0).toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-3.5 text-left font-black text-rose-600 font-mono">
                          -{Number(disc || 0).toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-3.5 text-left font-black text-emerald-600 font-mono">
                          {Number(netTotal || 0).toFixed(2)} {settings.currency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Promo Code Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <Tag size={20} className="text-purple-600" />
                <span>{editingCode ? 'تعديل البرومو كود' : 'إنشاء برومو كود جديد'}</span>
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePromoCode} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كود الخصم (Promo Code) *</label>
                <input 
                  type="text" 
                  value={formCode}
                  onChange={e => setFormCode(e.target.value.toUpperCase())}
                  placeholder="مثال: TEMO25 أو SUMMER20"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-black font-mono tracking-wider uppercase focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع الخصم</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت ({settings.currency})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {formType === 'percentage' ? 'نسبة الخصم (%) *' : `قيمة الخصم (${settings.currency}) *`}
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    max={formType === 'percentage' ? 100 : undefined}
                    value={formValue}
                    onChange={e => setFormValue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={formType === 'percentage' ? 'مثال: 20' : 'مثال: 50'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              {formType === 'percentage' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأقصى للخصم ({settings.currency})</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formMaxDiscount}
                    onChange={e => setFormMaxDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="اختياري (مثال: 100)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ البدء</label>
                  <input 
                    type="date" 
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الانتهاء</label>
                  <input 
                    type="date" 
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأقصى لعدد الاستخدامات الإجمالي</label>
                <input 
                  type="number" 
                  min="1"
                  value={formMaxUsesTotal}
                  onChange={e => setFormMaxUsesTotal(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="اتركه فارغاً للاستخدام غير المحدود"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">ملاحظة: النظام يمنع العميل الواحد من استخدام الكود أكثر من مرة تلقائياً برقم هاتفه.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات أو اسم المشهور / العميل</label>
                <input 
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="مثال: كود حملة المشهور فلان"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving && <RefreshCw size={14} className="animate-spin" />}
                  <span>{isSaving ? 'جاري الحفظ في قاعدة البيانات...' : (editingCode ? 'حفظ التعديلات' : 'إنشاء الكود الآن')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل العملاء المستخدمين للبرومو كود وفواتيرهم */}
      {selectedCodeForDetails && (() => {
        const pc = selectedCodeForDetails;
        const today = new Date().toISOString().split('T')[0];
        const isDateExpired = pc.endDate < today;
        const isUsesExpired = Boolean(pc.maxUsesTotal && pc.usesCount >= pc.maxUsesTotal);
        const isExpired = isDateExpired || isUsesExpired;
        const usages = getDetailedUsagesForCode(pc);

        const totalSubtotal = usages.reduce((sum, u) => sum + (u.invoiceSubtotal || 0), 0);
        const totalDiscountApplied = usages.reduce((sum, u) => sum + (u.discountApplied || 0), 0);
        const totalNetPaid = usages.reduce((sum, u) => sum + (u.invoiceTotal || 0), 0);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
              {/* ترويسة النافذة */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Tag size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base sm:text-lg text-slate-800 flex items-center gap-1.5">
                        <span>سجل مستخدمي الكود:</span>
                        <span className="font-mono text-purple-700 font-black px-2 py-0.5 bg-purple-50 rounded-lg border border-purple-200">{pc.code}</span>
                      </h3>
                      {isExpired ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-black text-xs border border-rose-200 flex items-center gap-1">
                          <AlertCircle size={12} />
                          <span>منتهي</span>
                        </span>
                      ) : pc.isActive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>نشط</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                          معطل
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      قائمة بجميع العملاء الذين استفادوا من هذا البرومو كود وتفاصيل فواتيرهم قبل وبعد الخصم
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedCodeForDetails(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-lg p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* شريط الإحصائيات السريعة */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/70 border-b border-slate-100 shrink-0">
                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Users size={13} className="text-purple-600" />
                    <span>عدد المستخدمين</span>
                  </div>
                  <div className="text-lg font-black text-slate-800 mt-1">
                    {usages.length} <span className="text-xs font-normal text-slate-400">عميل</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Receipt size={13} className="text-blue-600" />
                    <span>إجمالي قبل الخصم</span>
                  </div>
                  <div className="text-lg font-black text-blue-600 mt-1 font-mono">
                    {Number(totalSubtotal || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400 font-sans">{settings.currency}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Tag size={13} className="text-rose-600" />
                    <span>إجمالي الخصم الممنوح</span>
                  </div>
                  <div className="text-lg font-black text-rose-600 mt-1 font-mono">
                    -{Number(totalDiscountApplied || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400 font-sans">{settings.currency}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <DollarSign size={13} className="text-emerald-600" />
                    <span>الصافي بعد الخصم</span>
                  </div>
                  <div className="text-lg font-black text-emerald-600 mt-1 font-mono">
                    {Number(totalNetPaid || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400 font-sans">{settings.currency}</span>
                  </div>
                </div>
              </div>

              {/* جدول العملاء المستخدمين */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {usages.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-400 flex items-center justify-center">
                      <Users size={32} />
                    </div>
                    <div className="font-bold text-sm text-slate-700">لم يقم أي عميل باستخدام هذا الكود حتى الآن</div>
                    <p className="text-xs text-slate-400 max-w-sm">
                      عند استخدام هذا الكود في شاشة الكاشير (POS) وإتمام الفاتورة، سيتم توثيق بيانات العميل والفاتورة وتاريخ الزيارة هنا تلقائياً في قاعدة البيانات.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">اسم العميل</th>
                          <th className="p-3">رقم الهاتف</th>
                          <th className="p-3">تاريخ ووقت الزيارة</th>
                          <th className="p-3">رقم الفاتورة</th>
                          <th className="p-3 text-left">إجمالي قبل الخصم</th>
                          <th className="p-3 text-left">الخصم المطبق</th>
                          <th className="p-3 text-left">إجمالي بعد الخصم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usages.map((u, idx) => (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-800">
                              {u.clientName}
                            </td>
                            <td className="p-3 font-mono text-slate-600" dir="ltr">
                              {u.clientPhone}
                            </td>
                            <td className="p-3 text-slate-600 font-mono text-[11px]">
                              {u.visitDate ? new Date(u.visitDate).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                            </td>
                            <td className="p-3 font-mono text-slate-600 text-[11px]">
                              {u.invoiceId ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                                  {u.invoiceId}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="p-3 text-left font-mono font-bold text-slate-700">
                              {Number(u.invoiceSubtotal || 0).toFixed(2)} {settings.currency}
                            </td>
                            <td className="p-3 text-left font-mono font-bold text-rose-600">
                              -{Number(u.discountApplied || 0).toFixed(2)} {settings.currency}
                            </td>
                            <td className="p-3 text-left font-mono font-black text-emerald-700">
                              {Number(u.invoiceTotal || 0).toFixed(2)} {settings.currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* أسفل النافذة */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>البيانات مسجلة ومحفوظة في قاعدة البيانات السحابية مباشرة.</span>
                </div>
                <div className="flex items-center gap-2">
                  {usages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePrintUsagesReport(pc, usages)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Printer size={14} />
                      <span>طباعة التقرير</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedCodeForDetails(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors shadow-2xs"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
