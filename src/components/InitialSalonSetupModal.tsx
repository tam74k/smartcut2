import React, { useState } from 'react';
import { 
  Building2, Globe, DollarSign, Phone, MapPin, 
  Sparkles, CheckCircle2, ShieldCheck, ArrowLeft, Loader2, Store,
  Scissors, Check, AlertCircle, Landmark
} from 'lucide-react';
import { COUNTRY_CURRENCY_MAP, getCountryMeta, SubscriptionService } from '../services/subscriptionService';
import { AppSettings, Branch } from '../types';
import { DB } from '../services/db';

interface InitialSalonSetupModalProps {
  isOpen: boolean;
  onComplete: (createdSettings: AppSettings, mainBranch: Branch) => void;
}

export const DEFAULT_INITIAL_TREASURIES = [
  { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
  { id: 'cash', name: 'كاش الدرج', isMain: false },
  { id: 'card', name: 'فيزا', isMain: false },
  { id: 'instapay', name: 'انستاباي', isMain: false },
  { id: 'vodafone_cash', name: 'فودافون كاش', isMain: false }
];

export function InitialSalonSetupModal({ isOpen, onComplete }: InitialSalonSetupModalProps) {
  const [salonName, setSalonName] = useState('');
  const [salonType, setSalonType] = useState<'men' | 'women' | 'mixed'>('men');
  const [country, setCountry] = useState('جمهورية مصر العربية');
  const [currency, setCurrency] = useState('EGP');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleCountryChange = (selectedCountry: string) => {
    setCountry(selectedCountry);
    const meta = getCountryMeta(selectedCountry);
    if (meta && meta.currency) {
      setCurrency(meta.currency);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!salonName.trim()) {
      setErrorMsg('يرجى إدخال اسم الصالون أو المركز للمتابعة');
      return;
    }

    setIsSubmitting(true);
    try {
      const salonId = 'salon_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      const salonCode = 'SC-' + Math.floor(1000 + Math.random() * 9000);
      const mainBranchId = 'branch_main_' + Date.now().toString(36);

      // 1. كائن الصالون الجديد
      const newSalon = {
        id: salonId,
        name: salonName.trim(),
        code: salonCode,
        salonCode: salonCode,
        salonType,
        phone: phone.trim(),
        country,
        currency,
        address: address.trim(),
        isActive: true,
        status: 'active',
        subscriptionPlan: 'trial',
        subscriptionStatus: 'trial',
        trialDays: 7,
        maxEmployees: 5,
        maxBranches: 1,
        created_at: new Date().toISOString()
      };

      // 2. كائن الفرع الرئيسي الوحيد
      const mainBranch: Branch = {
        id: mainBranchId,
        salonId: salonId,
        name: 'الفرع الرئيسي',
        code: 'B-01',
        isMain: true,
        phone: phone.trim(),
        address: address.trim(),
        isActive: true,
        status: 'active',
        currency,
        vatRate: 0,
        vatEnabled: false
      };

      // 3. الإعدادات الافتراضية الصارمة للمنظومة
      const newSettings: AppSettings = {
        salonId,
        salonCode,
        branchId: mainBranchId,
        branchCode: 'B-01',
        salonName: salonName.trim(),
        salonType,
        phone: phone.trim(),
        address: address.trim(),
        country,
        currency,
        taxNumber: '',
        commercialReg: '',
        vatEnabled: false, // ضريبة القيمة المضافة: غير مفعلة
        vatRate: 0,
        zatcaEnabled: false, // الفاتورة الإلكترونية: غير مفعلة
        treasuries: DEFAULT_INITIAL_TREASURIES,
        expenseCategories: ['إيجار', 'كهرباء ومياه', 'صيانة ومطبوعات', 'أدوات ومستهلكات', 'ضيافة ونظافة', 'أخرى'],
        bookingNotes: '',
        printerName: 'طابعة الكاشير',
        paperSize: '80mm',
        printAutomatically: false,
        showDashboardAnalytics: true,
        showEmployeeAnalytics: true,
        receiptHeaderNote: 'أهلاً بكم في ' + salonName.trim(),
        receiptFooterNote: 'شكراً لزيارتكم ونسعد برؤيتكم دائماً'
      };

      // حفظ الصالون في قاعدة البيانات المحلية و SubscriptionService
      try {
        await DB.saveSalon(newSalon as any);
      } catch (err) {
        console.warn('DB.saveSalon notice:', err);
      }
      SubscriptionService.saveSalons([newSalon as any]);

      // حفظ الفرع الرئيسي
      try {
        await DB.saveBranch(mainBranch);
      } catch (err) {
        console.warn('DB.saveBranch notice:', err);
      }
      SubscriptionService.saveBranches([mainBranch]);

      // حفظ إعدادات النظام
      try {
        await DB.saveSettings(salonId, newSettings);
      } catch (err) {
        console.warn('DB.saveSettings notice:', err);
      }
      localStorage.setItem('smartcut_app_settings', JSON.stringify(newSettings));
      localStorage.setItem('smartcut_active_salon_id', salonId);
      SubscriptionService.saveBranchSettings(mainBranchId, newSettings);

      // تحديث بيانات المستخدم الحالي (admin) ليرتبط بهذا الصالون والفرع الرئيسي
      try {
        await DB.executeGenericQuery?.('users', 'update', {
          salon_id: salonId,
          branch_id: mainBranchId
        }, { username: 'admin' });
      } catch (e) {}

      setIsSubmitting(false);
      onComplete(newSettings, mainBranch);
    } catch (err: any) {
      console.error('Error during initial salon setup:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ بيانات الصالون، يرجى المحاولة ثانية');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Badge */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-black">
            <Sparkles size={15} className="text-emerald-600 animate-pulse" />
            <span>تفعيل تجريبي مجاني 7 أيام (حتى 5 موظفين)</span>
          </div>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            الإعداد الأولي لأول مرة
          </span>
        </div>

        {/* Modal Title */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            <Store size={26} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              إعداد بيانات الصالون الأساسية
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              مرحباً بك في منظومة <strong className="text-slate-800">Smart Cut POS</strong>! يرجى إدخال البيانات الأساسية لمنشأتك لبدء تشغيل نظام الكاشير ونقاط البيع مباشرة.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold leading-relaxed flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Salon Name */}
          <div>
            <label className="block text-xs font-black text-slate-800 mb-1.5">
              اسم الصالون / المركز (يظهر بالفواتير والإيصالات) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={salonName}
                onChange={e => setSalonName(e.target.value)}
                placeholder="مثال: صالون نيو لوك للعناية بالرجل"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 outline-none transition-all"
                autoFocus
              />
              <Building2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Salon Type */}
          <div>
            <label className="block text-xs font-black text-slate-800 mb-1.5">
              نوع النشاط / التخصص
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSalonType('men')}
                className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  salonType === 'men'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Scissors size={14} />
                <span>صالون رجالي</span>
              </button>
              <button
                type="button"
                onClick={() => setSalonType('women')}
                className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  salonType === 'women'
                    ? 'bg-pink-50 border-pink-500 text-pink-900 ring-2 ring-pink-500/20 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles size={14} />
                <span>صالون نسائي</span>
              </button>
              <button
                type="button"
                onClick={() => setSalonType('mixed')}
                className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  salonType === 'mixed'
                    ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building2 size={14} />
                <span>مختلط / أطفال</span>
              </button>
            </div>
          </div>

          {/* Country & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                الدولة <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={country}
                  onChange={e => handleCountryChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none transition-all appearance-none"
                >
                  {Object.keys(COUNTRY_CURRENCY_MAP).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                العملة المعتمدة
              </label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none transition-all appearance-none"
                >
                  {Array.from(new Set(Object.values(COUNTRY_CURRENCY_MAP).map(v => v.currency))).map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
                <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Phone & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                رقم التواصل / الهاتف
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="01000000000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                  dir="ltr"
                />
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                العنوان / المقر
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="المدينة، الشارع..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                />
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* System Defaults Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 mt-2">
            <span className="text-[11px] font-black text-slate-600 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-indigo-600" />
              <span>الإعدادات التلقائية المطبقة وفق متطلبات النظام:</span>
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-700">
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <Check size={13} className="text-emerald-600 stroke-[3]" />
                <span>الفروع: الفرع الرئيسي فقط</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <Check size={13} className="text-emerald-600 stroke-[3]" />
                <span>الضريبة: غير مفعلة (0%)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <Check size={13} className="text-emerald-600 stroke-[3]" />
                <span>الفاتورة الإلكترونية: غير مفعلة</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <Check size={13} className="text-emerald-600 stroke-[3]" />
                <span>الخزينة الرئيسية: ثابتة دائماً</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 pt-1 flex items-center gap-1.5">
              <Landmark size={12} className="text-slate-400 shrink-0" />
              <span>الخزائن المضافة افتراضياً: <strong>الخزينة الرئيسية</strong> • <strong>الدرج كاش</strong> • <strong>انستاباي</strong> • <strong>فودافون</strong></span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-black shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>جاري حفظ البيانات وتهيئة النظام...</span>
              </>
            ) : (
              <>
                <span>حفظ وبدء العمل على النظام</span>
                <ArrowLeft size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
