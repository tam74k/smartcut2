import React, { useState, useMemo } from 'react';
import { AppSettings, PromoCode, PromoCodeUsage } from '../types';
import { 
  Tag, Plus, CheckCircle2, Clock, Trash2, Edit2, Copy, Check, 
  Users, DollarSign, Calendar, Percent, AlertCircle, FileText
} from 'lucide-react';

interface PromoCodesScreenProps {
  settings: AppSettings;
  promoCodes: PromoCode[];
  setPromoCodes: (updater: PromoCode[] | ((prev: PromoCode[]) => PromoCode[])) => void;
  promoCodeUsages: PromoCodeUsage[];
  currentUser?: any;
}

export function PromoCodesScreen({
  settings,
  promoCodes = [],
  setPromoCodes,
  promoCodeUsages = [],
  currentUser
}: PromoCodesScreenProps) {
  const [activeTab, setActiveTab] = useState<'codes' | 'usages'>('codes');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
    return promoCodes.filter(c => c.isActive && c.endDate >= today).length;
  }, [promoCodes]);

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

  const handleSavePromoCode = (e: React.FormEvent) => {
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

    if (editingCode) {
      setPromoCodes(promoCodes.map(c => {
        if (c.id === editingCode.id) {
          return {
            ...c,
            code: cleanCode,
            discountType: formType,
            discountValue: Number(formValue),
            maxDiscountAmount: formMaxDiscount ? Number(formMaxDiscount) : undefined,
            startDate: formStartDate,
            endDate: formEndDate,
            maxUsesTotal: formMaxUsesTotal ? Number(formMaxUsesTotal) : undefined,
            notes: formNotes.trim() || undefined
          };
        }
        return c;
      }));
    } else {
      // Check duplicate
      if (promoCodes.some(c => c.code === cleanCode)) {
        alert('هذا الكود مسجل مسبقاً، يرجى اختيار كود آخر');
        return;
      }

      const newPromo: PromoCode = {
        id: 'PC-' + Math.random().toString(36).substring(2, 9),
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
      setPromoCodes([...promoCodes, newPromo]);
    }

    setShowAddModal(false);
  };

  const handleDeletePromo = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الكود؟')) {
      setPromoCodes(promoCodes.filter(c => c.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    setPromoCodes(promoCodes.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>إنشاء كود خصم جديد</span>
        </button>
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
                    <th className="p-3.5 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promoCodes.map(pc => {
                    const today = new Date().toISOString().split('T')[0];
                    const isExpired = pc.endDate < today;
                    const isFullyUsed = pc.maxUsesTotal && pc.usesCount >= pc.maxUsesTotal;

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
                          <div className={isExpired ? 'text-red-500 font-bold' : ''}>إلى: {pc.endDate}</div>
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                            {pc.usesCount} {pc.maxUsesTotal ? `/ ${pc.maxUsesTotal}` : 'استخدام'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {isExpired ? (
                            <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold text-[10px] border border-red-100">
                              منتهي الصلاحية
                            </span>
                          ) : isFullyUsed ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-100">
                              استنفذ الحد الأقصى
                            </span>
                          ) : pc.isActive ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-100">
                              فعال ونشط
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold text-[10px]">
                              معطل
                            </span>
                          )}
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
                    <th className="p-3.5">قيمة الخصم المطبق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promoCodeUsages.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">{new Date(u.usedAt).toLocaleString('ar-EG')}</td>
                      <td className="p-3.5">
                        <span className="font-mono font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          {u.code}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">{u.clientName || 'عميل نقدي'}</td>
                      <td className="p-3.5 text-slate-600 font-mono" dir="ltr">{u.clientPhone}</td>
                      <td className="p-3.5 font-mono text-slate-600">{u.invoiceId || '-'}</td>
                      <td className="p-3.5 font-black text-emerald-600">
                        {u.discountApplied.toLocaleString()} {settings.currency}
                      </td>
                    </tr>
                  ))}
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
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs transition-colors shadow-xs"
                >
                  {editingCode ? 'حفظ التعديلات' : 'إنشاء الكود الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
