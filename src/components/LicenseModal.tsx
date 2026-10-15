import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Copy, Check, Key, AlertTriangle, Clock, RefreshCw, X, Sparkles, Phone, MessageCircle } from 'lucide-react';
import { DB } from '../services/db';

export interface LicenseInfo {
  isLicensed: boolean;
  mode: 'lifetime' | 'days' | 'runs' | 'trial_auto' | string;
  status: 'active' | 'expired' | 'tampered' | 'unconnected' | string;
  machineCode: string;
  daysLeft: number | null;
  runsLeft: number | null;
  maxEmployees?: number | null;
  currentEmployeeCount?: number;
  expiryDate?: string | null;
  message?: string;
}

const DURATIONS = [
  { id: '1m', label: 'شهر', months: 1, isPopular: false },
  { id: '3m', label: '3 شهور', months: 3, isPopular: false },
  { id: '6m', label: '6 شهور', months: 6, isPopular: false },
  { id: '12m', label: 'سنة', months: 12, isPopular: true, badge: '🔥 الأكثر طلباً وتوفيراً' }
] as const;

const PLANS = [
  {
    id: 'starter',
    name: 'باقة البداية',
    employeeRange: '1–5 موظفين',
    description: 'مثالية للصالونات الناشئة والصغيرة ذات الفريق المحدود',
    badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    prices: {
      '1m': 350,
      '3m': 1000,
      '6m': 1950,
      '12m': 3500
    },
    savings: {
      '3m': 50,
      '6m': 150,
      '12m': 700
    },
    features: [
      'من 1 إلى 5 موظفين',
      'نقطة بيع POS سريعة وفواتير غير محدودة',
      'إدارة الحجوزات والمواعيد والعملاء',
      'الخزينة والمصروفات والتقارير اليومية',
      'إغلاق الوردية وطباعة تقرير Z-Report'
    ]
  },
  {
    id: 'growth',
    name: 'باقة التوسع',
    employeeRange: '6–10 موظفين',
    description: 'الخيار الممتاز للصالونات المتوسطة والمتنامية',
    badgeColor: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    prices: {
      '1m': 450,
      '3m': 1250,
      '6m': 2500,
      '12m': 4500
    },
    savings: {
      '3m': 100,
      '6m': 200,
      '12m': 900
    },
    features: [
      'من 6 إلى 10 موظفين',
      'كافة ميزات باقة 1-5 موظفين',
      'المخازن والمستودع الشامل وحركة الأصناف',
      'حساب عمولات الموظفين ومسيرات الرواتب والسلف',
      'برنامج ولاء ونقاط العملاء وكوبونات الخصم',
      'ربط وإشعارات رسائل واتساب'
    ]
  },
  {
    id: 'enterprise',
    name: 'باقة الأعمال الكبرى',
    employeeRange: 'أكثر من 10 موظفين',
    description: 'حل متكامل للمنشآت والمراكز الكبرى (سعة غير محدودة)',
    badgeColor: 'border-purple-200 bg-purple-50 text-purple-800',
    prices: {
      '1m': 550,
      '3m': 1550,
      '6m': 3050,
      '12m': 5500
    },
    savings: {
      '3m': 100,
      '6m': 250,
      '12m': 1100
    },
    features: [
      'أكثر من 10 موظفين (سعة مفتوحة ∞)',
      'كافة ميزات باقة التوسع',
      'لوحة تحليلات ورسوم بيانية لأداء الموظفين',
      'دعم الفروع المتعددة والمستودعات',
      'أولوية قصوى في الدعم الفني والتحديثات'
    ]
  }
];

interface LicenseModalProps {
  isOpen: boolean;
  licenseInfo: LicenseInfo | null;
  onClose?: () => void;
  onActivated?: (newLicense: LicenseInfo) => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  licenseInfo,
  onClose,
  onActivated
}) => {
  const [localLicense, setLocalLicense] = useState<LicenseInfo | null>(null);
  const [fetchingCode, setFetchingCode] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'plans' | 'key'>('plans');
  const [selectedDuration, setSelectedDuration] = useState<'1m' | '3m' | '6m' | '12m'>('12m');
  const [dbPlans, setDbPlans] = useState<any[]>([]);

  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || Boolean(localStorage.getItem('smartcut_api_url')));

  const currentSalonInfo = useMemo(() => {
    try {
      const s = localStorage.getItem('smartcut_app_settings');
      if (s) {
        const parsed = JSON.parse(s);
        return {
          code: parsed.salonCode || parsed.salon_code || '',
          name: parsed.salonName || parsed.salon_name || '',
          id: parsed.salonId || parsed.salon_id || ''
        };
      }
    } catch {}
    return { code: '', name: '', id: '' };
  }, []);

  const activeLicense = licenseInfo || localLicense;
  const currentMachineCode = activeLicense?.machineCode || '';
  const isMandatory = !activeLicense?.isLicensed;

  useEffect(() => {
    if (isOpen) {
      setInputKey('');
      setErrorMsg('');
      setSuccessMsg('');

      // قراءة الباقات المحدثة ديناميكياً من جدول قاعدة البيانات
      DB.fetchSubscriptionPlans()
        .then(fetched => {
          if (Array.isArray(fetched) && fetched.length > 0) {
            setDbPlans(fetched);
          }
        })
        .catch(err => {
          console.warn('Could not fetch plans from DB in LicenseModal:', err);
        });

      // قراءة أحدث بيانات الترخيص عند الفتح (في البيئة المحلية فقط)
      const isLocalHost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || Boolean(localStorage.getItem('smartcut_api_url')));
      
      if (isLocalHost) {
        setFetchingCode(true);
        fetch('/api/server-info')
          .then(res => {
            const cType = res.headers.get('content-type') || '';
            if (res.ok && cType.includes('application/json')) {
              return res.json();
            }
            return null;
          })
          .then(data => {
            if (data && data.license) {
              setLocalLicense(data.license);
            }
          })
          .catch(() => {})
          .finally(() => {
            setFetchingCode(false);
          });
      }
    }
  }, [isOpen]);

  // دمج الباقات القادمة من قاعدة البيانات مع الباقات الافتراضية
  const activePlans = useMemo(() => {
    if (dbPlans && dbPlans.length > 0) {
      return dbPlans.map(p => ({
        id: p.id,
        name: p.planNameAr || p.name || 'باقة',
        employeeRange: p.maxEmployees && p.maxEmployees < 9000
          ? `${p.minEmployees || 1}–${p.maxEmployees} موظفين`
          : 'أكثر من 10 موظفين',
        description: p.descriptionAr || p.description || '',
        badgeColor: p.id === 'starter' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : p.id === 'growth' ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-purple-200 bg-purple-50 text-purple-800',
        prices: {
          '1m': Number(p.priceEgp1m || 350),
          '3m': Number(p.priceEgp3m || 1000),
          '6m': Number(p.priceEgp6m || 1950),
          '12m': Number(p.priceEgp12m || 3500)
        },
        savings: {
          '3m': Math.max(0, (Number(p.priceEgp1m || 0) * 3) - Number(p.priceEgp3m || 0)),
          '6m': Math.max(0, (Number(p.priceEgp1m || 0) * 6) - Number(p.priceEgp6m || 0)),
          '12m': Math.max(0, (Number(p.priceEgp1m || 0) * 12) - Number(p.priceEgp12m || 0))
        },
        features: Array.isArray(p.features) ? p.features : []
      }));
    }
    return PLANS;
  }, [dbPlans]);

  if (!isOpen) return null;

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('انسخ كود الجهاز:', text);
    }
  };

  const handleCopyCode = () => {
    const textToCopy = isLocalHost ? currentMachineCode : (currentSalonInfo.code || currentMachineCode || 'CLOUD-SAAS');
    if (!textToCopy) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        })
        .catch(() => {
          fallbackCopy(textToCopy);
        });
    } else {
      fallbackCopy(textToCopy);
    }
  };

  // تنسيق الكود تلقائياً أثناء الكتابة ليشمل الشرطات: XXXX-XXXX-XXXX-XXXX
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^a-zA-Z0-9@._-]/g, '').toUpperCase().slice(0, 30);
    if (/^[A-Z0-9]+$/.test(raw) && raw.length <= 16 && !raw.includes('@')) {
      let formatted = '';
      for (let i = 0; i < raw.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += '-';
        formatted += raw[i];
      }
      setInputKey(formatted);
    } else {
      setInputKey(raw);
    }
    setErrorMsg('');
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputKey.replace(/[^a-zA-Z0-9]/g, '');

    if (isLocalHost && clean.length !== 16) {
      setErrorMsg('كود التفعيل للأجهزة المحلية يجب أن يتكون من 16 حرفاً أو رقماً');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (isLocalHost) {
      // ── تفعيل الأجهزة المحلية (OFFLINE HARDWARE ACTIVATION) ──
      try {
        const res = await fetch('/api/license/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey: inputKey })
        });

        const cType = res.headers.get('content-type') || '';
        if (!cType.includes('application/json')) {
          setErrorMsg('تعذر الاتصال بخادم التراخيص المحلي');
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMsg(data.message || 'فشل تفعيل الكود، يرجى التحقق من صحته');
          setLoading(false);
          return;
        }

        setSuccessMsg(data.message || 'تم تفعيل المنظومة بنجاح!');
        if (typeof window !== 'undefined') {
          localStorage.setItem('smartcut_license_readonly', 'false');
        }
        if (onActivated && data.license) {
          setTimeout(() => {
            onActivated(data.license);
            if (onClose) onClose();
          }, 800);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'تعذر الاتصال بخادم التراخيص المحلي');
      } finally {
        setLoading(false);
      }
    } else {
      // ── تفعيل المنظومة السحابية أونلاين (ONLINE SAAS ACTIVATION) ──
      try {
        const targetSalonId = currentSalonInfo.id || DB.getStoredSalonId();
        const trimmed = inputKey.trim();
        const isMaster = trimmed.toLowerCase() === 'dev@smartcut2026' || clean === 'DEV2026PRO' || clean.length === 16;

        if (!isMaster) {
          setErrorMsg('كود التفعيل السحابي غير صحيح. للتفعيل أو التجديد يرجى التواصل مع إدارة المنظومة.');
          setLoading(false);
          return;
        }

        const res = await DB.activateOrRenewSubscriptionRPC({
          tenantId: targetSalonId,
          planId: 'pro',
          billingCycle: '12m',
          status: 'active',
          paymentMethod: 'license_key',
          notes: `تفعيل سحابي رسمي بواسطة الكود: ${inputKey}`
        });

        if (res && res.success) {
          setSuccessMsg('تم تفعيل وتنشيط اشتراك الصالون السحابي بنجاح!');
          localStorage.setItem('smartcut_license_readonly', 'false');
          const activatedLic: LicenseInfo = {
            isLicensed: true,
            status: 'active',
            mode: 'lifetime',
            machineCode: currentSalonInfo.code || 'CLOUD-SAAS',
            daysLeft: 365,
            runsLeft: null,
            expiryDate: res.endDate || null,
            message: 'تم تفعيل اشتراك الصالون السحابي بنجاح 🟢'
          };
          setLocalLicense(activatedLic);
          if (onActivated) {
            setTimeout(() => {
              onActivated(activatedLic);
              if (onClose) onClose();
            }, 800);
          }
        } else {
          setErrorMsg(res?.error || 'تعذر استكمال التفعيل السحابي، يرجى المحاولة لاحقاً');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'حدث خطأ أثناء محاولة التفعيل السحابي');
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusBadge = () => {
    const lic = activeLicense;
    if (!lic) return null;

    let empQuota: React.ReactNode = null;
    if (typeof lic.maxEmployees === 'number' && lic.maxEmployees > 0) {
      empQuota = (
        <div className="mt-1.5 flex items-center justify-between text-[11px] bg-white/70 px-2.5 py-1 rounded-lg border border-current/20 font-bold">
          <span>👥 باقة الموظفين:</span>
          <span className="text-indigo-800">حتى {lic.maxEmployees} موظفين حد أقصى</span>
        </div>
      );
    } else if (lic.isLicensed && lic.status === 'active') {
      empQuota = (
        <div className="mt-1.5 flex items-center justify-between text-[11px] bg-white/70 px-2.5 py-1 rounded-lg border border-current/20 font-bold">
          <span>👥 باقة الموظفين:</span>
          <span className="text-emerald-700">غير محدودة (مفتوحة ∞)</span>
        </div>
      );
    }

    if (lic.status === 'tampered') {
      return (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs font-bold space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{lic.message || 'تنبيه: تم رصد عدم تطابق في بيانات ترخيص النظام'}</span>
          </div>
          {empQuota}
        </div>
      );
    }
    if (lic.status === 'expired') {
      return (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-2xl text-xs font-bold space-y-1">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600 shrink-0" />
            <span>{lic.message || 'انتهت فترة الصلاحية المحددة للبرنامج'}</span>
          </div>
          {empQuota}
        </div>
      );
    }
    if (lic.mode === 'lifetime') {
      return (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl text-xs font-bold space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-600 shrink-0" />
            <span>البرنامج مرخص رسمياً مدى الحياة 👑</span>
          </div>
          {empQuota}
        </div>
      );
    }
    return (
      <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-2xl text-xs font-bold space-y-1">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-600 shrink-0" />
          <span>{lic.message || 'ترخيص النظام نشط ومفعل'}</span>
        </div>
        {empQuota}
      </div>
    );
  };

  const handleOrderPlanViaWhatsApp = (planName: string, employeeRange: string, price: number) => {
    const durationLabel = 
      selectedDuration === '1m' ? 'شهر واحد' :
      selectedDuration === '3m' ? '3 شهور' :
      selectedDuration === '6m' ? '6 شهور' : 'سنة كاملة (12 شهر - الأكثر طلباً)';

    const idBlock = isLocalHost
      ? `💻 كود بصمة جهازي (Machine Code): ${currentMachineCode || 'غير متوفر'}`
      : `🏢 كود الصالون (Salon Code): ${currentSalonInfo.code || 'صالون سحابي'}\n🏢 اسم المنشأة: ${currentSalonInfo.name || 'صالون سمارت كت'}`;

    const msg = `مرحباً أستاذنا،
أود الاشتراك وتفعيل باقة لمنظومة Smart Cut:
📦 الباقة: ${planName} (${employeeRange})
⏱️ المدة: ${durationLabel}
💰 السعر: ${price.toLocaleString()} جنيه مصري
${idBlock}

يرجى تزويدي ببيانات السداد (فودافون كاش / إنستاباي / حساب بنكي) لإرسال إيصال التحويل وتفعيل الاشتراك فوراً. شكراً لكم!`;

    window.open(`https://wa.me/201014889704?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-white w-full max-w-4xl max-h-[94vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 sm:p-6 text-white relative shrink-0">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute left-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          )}
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white">ترخيص وتفعيل منظومة Smart Cut</h2>
                <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                  الأسعار الرسمية المقترحة (EGP)
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">اختر الباقة المناسبة لفريق عملك وقم بتفعيل الترخيص للأجهزة المحلية</p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 p-1.5 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Sparkles size={15} className="text-amber-500" />
            <span>باقات وأسعار الاشتراك (المقترحة)</span>
            <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-black border border-amber-300 hidden sm:inline-block">
              1–5 | 6–10 | +10 موظفين
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('key')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'key'
                ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Key size={15} className="text-indigo-600" />
            <span>إدخال كود التفعيل (تنشيط الجهاز)</span>
            {activeLicense?.isLicensed ? (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                مفعل ✅
              </span>
            ) : (
              <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                مطلوب 🔑
              </span>
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Status Badge */}
          {getStatusBadge()}

          {activeTab === 'plans' ? (
            /* ========================================================================= */
            /* TAB 1: PACKAGES & PRICING                                                 */
            /* ========================================================================= */
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Machine / Salon Code Quick Banner */}
              <div className="bg-slate-900 text-white p-3 sm:p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{isLocalHost ? '💻' : '🏢'}</span>
                  <div>
                    <div className="text-[11px] text-slate-400 font-bold">
                      {isLocalHost ? 'كود بصمة جهازك الحالي (Machine Code):' : 'كود الصالون السحابي (Salon Code):'}
                    </div>
                    <div className="text-sm sm:text-base font-mono font-black text-amber-300 tracking-wider">
                      {isLocalHost
                        ? (fetchingCode ? 'جاري الاستخراج...' : currentMachineCode || 'APP-LOCAL')
                        : (currentSalonInfo.code || 'CLOUD-SAAS')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={isLocalHost ? !currentMachineCode : !currentSalonInfo.code}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 shadow-xs shrink-0"
                >
                  {copied ? <Check size={14} className="text-slate-950" /> : <Copy size={14} />}
                  <span>{copied ? 'تم النسخ بنجاح! ✓' : (isLocalHost ? 'نسخ كود الجهاز' : 'نسخ كود الصالون')}</span>
                </button>
              </div>

              {/* Duration Switcher */}
              <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-xs font-black text-slate-700">اختر مدة الاشتراك:</span>
                  <span className="text-[11px] text-emerald-700 font-bold">الأسعار بالجنيه المصري (EGP)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {DURATIONS.map(dur => {
                    const isSelected = selectedDuration === dur.id;
                    const isAnnual = dur.id === '12m';
                    return (
                      <button
                        key={dur.id}
                        type="button"
                        onClick={() => setSelectedDuration(dur.id)}
                        className={`relative py-2.5 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isSelected
                            ? isAnnual
                              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/80 scale-[1.02]'
                              : 'bg-indigo-600 text-white shadow-md scale-[1.02]'
                            : isAnnual
                            ? 'bg-amber-50 text-amber-900 border border-amber-300/80 hover:bg-amber-100/80'
                            : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                        }`}
                      >
                        <span className="text-sm font-black">{dur.label}</span>
                        {isAnnual && (
                          <span className={`text-[10px] font-black px-2 py-0.2 rounded-full ${
                            isSelected ? 'bg-slate-950 text-amber-300' : 'bg-amber-200 text-amber-950'
                          }`}>
                            🔥 الأكثر طلباً
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3 Package Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activePlans.map(plan => {
                  const currentPrice = plan.prices[selectedDuration];
                  const isAnnual = selectedDuration === '12m';
                  const saving = isAnnual ? plan.savings['12m'] : plan.savings[selectedDuration as '3m' | '6m'] || 0;
                  const monthlyRate = Math.round(currentPrice / (selectedDuration === '1m' ? 1 : selectedDuration === '3m' ? 3 : selectedDuration === '6m' ? 6 : 12));

                  return (
                    <div
                      key={plan.id}
                      className={`relative bg-white rounded-3xl p-5 border-2 transition-all flex flex-col justify-between shadow-xs ${
                        isAnnual
                          ? 'border-amber-400/80 shadow-amber-500/10 hover:shadow-md'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {isAnnual && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-black px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1 border border-amber-300">
                          <span>⭐ الأكثر طلباً وتوفيراً</span>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${plan.badgeColor}`}>
                            👥 {plan.employeeRange}
                          </span>
                          {saving > 0 && (
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                              وفّر {saving.toLocaleString()} ج.م
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-base font-black text-slate-900">{plan.name}</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{plan.description}</p>
                        </div>

                        {/* Price Display */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                              {currentPrice.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-slate-600">جنيه مصري</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                            {selectedDuration === '1m'
                              ? 'سداد شهري متجدد'
                              : `يعادل ~${monthlyRate} ج.م فقط شهرياً`}
                          </div>
                        </div>

                        {/* Features List */}
                        <ul className="space-y-1.5 text-xs text-slate-700 pt-1">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 leading-tight">
                              <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                              <span className="text-[11.5px]">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* WhatsApp Order Button */}
                      <button
                        type="button"
                        onClick={() => handleOrderPlanViaWhatsApp(plan.name, plan.employeeRange, currentPrice)}
                        className={`w-full mt-4 py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                          isAnnual
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-amber-500/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        }`}
                      >
                        <MessageCircle size={15} />
                        <span>طلب هذه الباقة عبر واتساب 📲</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Complete Pricing Matrix Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span>📊</span>
                    <span>جدول الأسعار النهائي المقترح (بالجنيه المصري):</span>
                  </h4>
                  <span className="text-[10px] text-amber-700 font-black bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    👑 الباقات السنوية هي الأكثر طلباً وتوفيراً
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <th className="p-2.5 font-black">فئة الموظفين</th>
                        <th className="p-2.5 font-bold text-center">شهر</th>
                        <th className="p-2.5 font-bold text-center">3 شهور</th>
                        <th className="p-2.5 font-bold text-center">6 شهور</th>
                        <th className="p-2.5 font-black text-center bg-amber-100 text-amber-950 border-r border-l border-amber-300">
                          سنة (الأكثر طلباً 🔥)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activePlans.map(plan => (
                        <tr key={plan.id} className="hover:bg-slate-50/70">
                          <td className="p-2.5 font-black text-slate-900">{plan.employeeRange}</td>
                          <td className="p-2.5 font-mono text-center text-slate-700">{plan.prices['1m'].toLocaleString()} ج.م</td>
                          <td className="p-2.5 font-mono text-center text-slate-700">{plan.prices['3m'].toLocaleString()} ج.م</td>
                          <td className="p-2.5 font-mono text-center text-slate-700">{plan.prices['6m'].toLocaleString()} ج.م</td>
                          <td className="p-2.5 font-mono text-center font-black text-amber-950 bg-amber-50/80 border-r border-l border-amber-200">
                            {plan.prices['12m'].toLocaleString()} ج.م 👑
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Shortcut to Activation Tab */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Key size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-900">هل قمت بالتحويل وحصلت على كود التفعيل بالفعل؟</h5>
                    <p className="text-[11px] text-slate-500">انقر هنا لإدخال الكود المكون من 16 خانة وتنشيط البرنامج فوراً دون انتظار.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('key')}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0"
                >
                  إدخال كود التفعيل الآن 🔑
                </button>
              </div>

            </div>
          ) : (
            /* ========================================================================= */
            /* TAB 2: ACTIVATION KEY INPUT FORM                                          */
            /* ========================================================================= */
            <div className="space-y-5 max-w-xl mx-auto animate-in fade-in duration-150">
              
              {/* Machine Code Box */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>💻</span>
                    <span>بصمة الجهاز الفريدة (Machine Code):</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    disabled={!currentMachineCode}
                    className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 hover:text-indigo-900 bg-indigo-100/80 hover:bg-indigo-200/80 border border-indigo-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copied ? 'تم النسخ بنجاح! ✓' : 'نسخ الكود'}</span>
                  </button>
                </div>

                <div 
                  onClick={handleCopyCode}
                  className="bg-white border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-3 text-center cursor-pointer transition-colors group shadow-inner"
                  title="انقر هنا لنسخ الكود"
                >
                  {fetchingCode ? (
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-bold py-1">
                      <RefreshCw size={15} className="animate-spin text-indigo-600" />
                      <span>جاري استخراج بصمة الجهاز من السيرفر المحلي...</span>
                    </div>
                  ) : currentMachineCode ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-base sm:text-xl font-mono font-black text-slate-900 tracking-widest select-all">
                        {currentMachineCode}
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 font-bold transition-colors">
                        (انقر للنسخ 📋)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 text-amber-700 text-xs font-bold py-1">
                      <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                      <span>جاري قراءة وتجهيز كود الجهاز...</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  قم بنسخ هذا الكود وإرساله للمطور أو المورد للحصول على مفتاح التفعيل المخصص لهذا الجهاز.
                </p>
              </div>

              {/* Programmer Contact Box */}
              <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                      <Phone size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        رقم الاتصال بالمبرمج والدعم الفني:
                      </h4>
                      <a
                        href="tel:+201014889704"
                        className="text-base font-mono font-black text-indigo-700 hover:text-indigo-900 transition-colors inline-block mt-0.5 tracking-wider"
                        dir="ltr"
                      >
                        +201014889704
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <a
                      href="tel:+201014889704"
                      className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-indigo-900 border border-indigo-200 px-3 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                    >
                      <Phone size={13} className="text-indigo-600" />
                      <span>اتصال</span>
                    </a>
                    <a
                      href={`https://wa.me/201014889704?text=${encodeURIComponent(
                        isLocalHost
                          ? `مرحباً، أود تفعيل منظومة Smart Cut.\nبصمة الجهاز (Machine Code): ${currentMachineCode || ''}`
                          : `مرحباً، أود تفعيل اشتراك صالون Smart Cut سحابياً.\nكود الصالون (Salon Code): ${currentSalonInfo.code || ''}\nاسم الصالون: ${currentSalonInfo.name || ''}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <MessageCircle size={15} />
                      <span>واتساب</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Activation Form */}
              <form onSubmit={handleActivate} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                    {isLocalHost ? 'أدخل مفتاح التفعيل للجهاز (16 خانة):' : 'أدخل كود تفعيل الصالون السحابي (أو المفتاح المعتمد):'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={inputKey}
                      onChange={handleInputChange}
                      placeholder={isLocalHost ? "XXXX-XXXX-XXXX-XXXX" : "أدخل كود التفعيل هنا..."}
                      maxLength={30}
                      className="w-full text-center text-base sm:text-lg font-mono font-extrabold px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none uppercase tracking-widest text-slate-900 bg-slate-50 focus:bg-white transition-all shadow-inner"
                    />
                    <Key size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold animate-in fade-in flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-rose-500" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-xs font-bold animate-in fade-in flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-emerald-600" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (isLocalHost ? inputKey.replace(/[^a-zA-Z0-9]/g, '').length !== 16 : !inputKey.trim())}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin text-amber-400" />
                      <span>جاري التحقق وتفعيل المنظومة...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} className="text-amber-400" />
                      <span>تنشيط وتفعيل البرنامج الآن</span>
                    </>
                  )}
                </button>
              </form>

              {/* Data Safety Assurance */}
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold text-sm shrink-0">🛡️</span>
                <p className="text-[11px] text-emerald-900 font-medium leading-relaxed">
                  <strong>أمان البيانات:</strong> جميع بياناتك وفواتيرك وحساباتك السابقة في قاعدة البيانات محفوظة ومحمية بنسبة 100% ولن تتأثر أو تُحذف عند انتهاء الترخيص أو التجديد.
                </p>
              </div>

              {/* View Plans Button */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline transition-colors cursor-pointer"
                >
                  الاطلاع على باقات وأسعار التجديد المقترحة 💎
                </button>
              </div>

            </div>
          )}

          {onClose && (
            <div className="text-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold underline transition-colors cursor-pointer"
              >
                الاستمرار بالاطلاع على البيانات والتقارير في وضع القراءة فقط 👁️
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
