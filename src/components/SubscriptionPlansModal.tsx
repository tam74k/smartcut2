import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Check, Sparkles, Building2, Users, ShieldCheck, 
  CreditCard, MessageCircle, AlertCircle, ArrowRight, 
  HelpCircle, Plus, Minus, Zap, Crown, Clock, CheckCircle2,
  Receipt, ShieldAlert
} from 'lucide-react';
import { 
  SubscriptionPlan, SubscriptionAddon, BillingCycle, 
  BillingCurrency, AppSettings, SalonTenant, AppUser 
} from '../types';
import { DB } from '../services/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  currentSalon?: SalonTenant | any;
  currentUser?: AppUser | null;
  onSubscriptionUpdated?: () => void;
}

export const SubscriptionPlansModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  currentSalon,
  currentUser,
  onSubscriptionUpdated
}) => {
  const isProgrammer = currentUser?.role === 'programmer';

  // Billing cycle state: default is '6m' (نصف سنوي)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('6m');
  // Currency state: Egypt (EGP) vs International (USD)
  const [currency, setCurrency] = useState<BillingCurrency>(() => {
    return settings.country?.includes('مصر') ? 'EGP' : 'EGP';
  });
  
  // Selected plan state (default to growth)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('growth');
  // Additional branches counter state
  const [additionalBranches, setAdditionalBranches] = useState<number>(0);

  // Plans & Addons fetched from DB
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [addon, setAddon] = useState<SubscriptionAddon | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingRequestResult, setPendingRequestResult] = useState<{
    orderId: string;
    planName: string;
    cycleLabel: string;
    amount: number;
    currency: string;
    branches: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadPricing() {
      setLoading(true);
      try {
        const [fetchedPlans, fetchedAddons] = await Promise.all([
          DB.fetchSubscriptionPlans(),
          DB.fetchSubscriptionAddons()
        ]);
        if (isMounted) {
          setPlans(fetchedPlans);
          if (fetchedAddons.length > 0) {
            setAddon(fetchedAddons[0]);
          }
        }
      } catch (err) {
        console.error('Error loading subscription pricing:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPricing();
    return () => { isMounted = false; };
  }, [isOpen]);

  // Months multiplier based on billing cycle
  const cycleMonths = useMemo(() => {
    switch (billingCycle) {
      case '1m': return 1;
      case '3m': return 3;
      case '6m': return 6;
      case '12m': return 12;
      default: return 6;
    }
  }, [billingCycle]);

  // Get plan price for the chosen cycle & currency
  const getPlanPrice = (plan: SubscriptionPlan): number => {
    if (!plan) return 0;
    let val: any = 0;
    if (currency === 'USD') {
      switch (billingCycle) {
        case '1m': val = plan.priceUsd1m ?? (plan as any).priceUsd_1m ?? (plan as any).price_usd_1m; break;
        case '3m': val = plan.priceUsd3m ?? (plan as any).priceUsd_3m ?? (plan as any).price_usd_3m; break;
        case '6m': val = plan.priceUsd6m ?? (plan as any).priceUsd_6m ?? (plan as any).price_usd_6m; break;
        case '12m': val = plan.priceUsd12m ?? (plan as any).priceUsd_12m ?? (plan as any).price_usd_12m; break;
      }
    } else {
      switch (billingCycle) {
        case '1m': val = plan.priceEgp1m ?? (plan as any).priceEgp_1m ?? (plan as any).price_egp_1m; break;
        case '3m': val = plan.priceEgp3m ?? (plan as any).priceEgp_3m ?? (plan as any).price_egp_3m; break;
        case '6m': val = plan.priceEgp6m ?? (plan as any).priceEgp_6m ?? (plan as any).price_egp_6m; break;
        case '12m': val = plan.priceEgp12m ?? (plan as any).priceEgp_12m ?? (plan as any).price_egp_12m; break;
      }
    }
    return Number(val) || 0;
  };

  // Monthly base price for comparison
  const getMonthlyBasePrice = (plan: SubscriptionPlan): number => {
    if (!plan) return 0;
    const val = currency === 'USD' 
      ? (plan.priceUsd1m ?? (plan as any).priceUsd_1m ?? (plan as any).price_usd_1m)
      : (plan.priceEgp1m ?? (plan as any).priceEgp_1m ?? (plan as any).price_egp_1m);
    return Number(val) || 0;
  };

  // Calculate Frontend Savings
  // Savings = (Monthly Rate * Cycle Months) - Discounted Period Price
  const calculateSavings = (plan: SubscriptionPlan): number => {
    if (!plan || billingCycle === '1m') return 0;
    const monthlyRate = getMonthlyBasePrice(plan);
    const regularTotal = monthlyRate * cycleMonths;
    const discountedTotal = getPlanPrice(plan);
    const savings = regularTotal - discountedTotal;
    return savings > 0 ? Math.round(savings) : 0;
  };

  // Branch addon price for the chosen cycle & currency
  const getAddonPrice = (): number => {
    if (!addon) return currency === 'USD' ? 50 : 1500;
    let val: any = 0;
    if (currency === 'USD') {
      switch (billingCycle) {
        case '1m': val = addon.priceUsd1m ?? (addon as any).priceUsd_1m ?? (addon as any).price_usd_1m; break;
        case '3m': val = addon.priceUsd3m ?? (addon as any).priceUsd_3m ?? (addon as any).price_usd_3m; break;
        case '6m': val = addon.priceUsd6m ?? (addon as any).priceUsd_6m ?? (addon as any).price_usd_6m; break;
        case '12m': val = addon.priceUsd12m ?? (addon as any).priceUsd_12m ?? (addon as any).price_usd_12m; break;
      }
    } else {
      switch (billingCycle) {
        case '1m': val = addon.priceEgp1m ?? (addon as any).priceEgp_1m ?? (addon as any).price_egp_1m; break;
        case '3m': val = addon.priceEgp3m ?? (addon as any).priceEgp_3m ?? (addon as any).price_egp_3m; break;
        case '6m': val = addon.priceEgp6m ?? (addon as any).priceEgp_6m ?? (addon as any).price_egp_6m; break;
        case '12m': val = addon.priceEgp12m ?? (addon as any).priceEgp_12m ?? (addon as any).price_egp_12m; break;
      }
    }
    return Number(val) || 0;
  };

  // Selected plan object
  const selectedPlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId) || plans[1] || plans[0];
  }, [plans, selectedPlanId]);

  // Total Bill calculation
  const planPriceTotal = selectedPlan ? getPlanPrice(selectedPlan) : 0;
  const addonPricePerBranch = getAddonPrice();
  const addonsTotal = additionalBranches * addonPricePerBranch;
  const grandTotal = planPriceTotal + addonsTotal;
  const totalSavings = selectedPlan ? calculateSavings(selectedPlan) : 0;

  // Currency symbol label
  const currencyLabel = currency === 'USD' ? '$ USD' : 'ج.م EGP';

  // Handle WhatsApp Checkout
  const handleWhatsAppContact = (orderRef?: string) => {
    const salonName = settings.salonName || currentSalon?.name || 'الصالون';
    const planName = selectedPlan?.planNameAr || 'الباقة';
    const cycleLabel = 
      billingCycle === '1m' ? 'شهر واحد' :
      billingCycle === '3m' ? '3 شهور (ربع سنوي)' :
      billingCycle === '6m' ? '6 شهور (نصف سنوي)' : 'سنة كاملة (12 شهر)';

    const msg = `مرحباً فريق سمارت كت،
أرغب في الاشتراك / تجديد باقة صالوننا${orderRef ? ` (رقم الطلب: #${orderRef})` : ''}:
🏛️ اسم الصالون: ${salonName}
📦 الباقة المختارة: ${planName}
⏱️ دورة الفوترة: ${cycleLabel}
🏢 عدد الفروع الإضافية: ${additionalBranches} فرع
💰 إجمالي الفاتورة: ${Number(grandTotal || 0).toLocaleString()} ${currencyLabel}
${totalSavings > 0 ? `🎁 إجمالي التوفير: ${Number(totalSavings || 0).toLocaleString()} ${currencyLabel}\n` : ''}
يرجى تزويدي ببيانات الدفع (حساب بنكي / فودافون كاش / إنستاباي / رابط فيزا) لإرفاق إيصال التحويل وتأكيد التفعيل فوراً. شكراً لكم!`;

    const cleanPhone = (settings.contactPhone || '201014888000').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Submit Official Subscription Request (Pending Payment Verification)
  // CRITICAL SECURITY: Normal clients can NEVER self-activate. This records a pending request only!
  const handleRequestSubscription = async () => {
    if (!selectedPlan) return;
    setIsSubmitting(true);
    try {
      const tenantId = settings.salonId || currentSalon?.id || 'default-salon';
      const cycleLabel = 
        billingCycle === '1m' ? 'شهر واحد' :
        billingCycle === '3m' ? '3 شهور (ربع سنوي)' :
        billingCycle === '6m' ? '6 شهور (نصف سنوي)' : 'سنة كاملة (12 شهر)';

      const res = await DB.activateOrRenewSubscriptionRPC({
        tenantId,
        planId: selectedPlan.id,
        billingCycle,
        additionalBranches,
        currency,
        paidAmount: grandTotal,
        paymentMethod: 'pending_transfer',
        notes: `طلب اشتراك مسجل عبر واجهة الأسعار - ${billingCycle}`,
        status: 'pending_payment'
      });

      const orderId = res?.subscription_id || res?.subscriptionId || 'SUB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setPendingRequestResult({
        orderId,
        planName: selectedPlan.planNameAr,
        cycleLabel,
        amount: grandTotal,
        currency: currencyLabel,
        branches: additionalBranches
      });
    } catch (err) {
      console.error('Error submitting subscription request:', err);
      handleWhatsAppContact();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dedicated Programmer-Only Direct Activation (Requires confirm)
  const handleProgrammerDirectActivation = async () => {
    if (!selectedPlan) return;
    if (!window.confirm(`⚡ تنبيه المبرمج الرئيسي:\nهل أنت متأكد من تفعيل باقة (${selectedPlan.planNameAr}) فورياً وتحديث تاريخ انتهاء الصالون في قاعدة البيانات بدون انتظار السداد؟`)) {
      return;
    }
    setIsSubmitting(true);
    try {
      const tenantId = settings.salonId || currentSalon?.id || 'default-salon';
      const res = await DB.activateOrRenewSubscriptionRPC({
        tenantId,
        planId: selectedPlan.id,
        billingCycle,
        additionalBranches,
        currency,
        paidAmount: grandTotal,
        paymentMethod: 'programmer_override',
        notes: `تفعيل استثنائي مباشر بواسطة المبرمج الرئيسي - ${billingCycle}`,
        status: 'active'
      });

      if (res && (res.success || res.status === 'active')) {
        setSuccessMessage('🎉 تم تفعيل الباقة وتحديث حالة المنشأة بنجاح بواسطة المبرمج!');
        if (onSubscriptionUpdated) {
          setTimeout(() => {
            onSubscriptionUpdated();
          }, 1500);
        }
      } else {
        alert('تعذر التفعيل: ' + (res?.message || 'خطأ غير معروف'));
      }
    } catch (err) {
      console.error('Error in programmer activation:', err);
      alert('حدث خطأ أثناء التفعيل المباشر');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl my-auto overflow-hidden border border-slate-100 flex flex-col max-h-[94vh]"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-7 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="إغلاق"
          >
            <X size={20} />
          </button>

          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30 mb-2">
              <Sparkles size={14} className="text-emerald-400" />
              باقات واشتراكات SMART CUT PRO السحابية
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>اختر الباقة المناسبة لنمو وتوسع صالونك</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
              نظام شامل لإدارة المبيعات، الحجوزات، الموظفين، والمخازن مع دعم الفروع المتعددة وتكامل سحابي فوري.
            </p>
          </div>

          {/* Top Toggles: Billing Cycle & Currency */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
            {/* Billing Cycle Switch */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-700/80 shadow-inner">
              <button
                onClick={() => setBillingCycle('1m')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  billingCycle === '1m'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                شهري
              </button>
              <button
                onClick={() => setBillingCycle('3m')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  billingCycle === '3m'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3 شهور
              </button>
              <button
                onClick={() => setBillingCycle('6m')}
                className={`relative px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  billingCycle === '6m'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                نصف سنوي (6 شهور)
                <span className="inline-block mr-1 text-[10px] text-amber-300 font-normal">(الافتراضي)</span>
              </button>
              <button
                onClick={() => setBillingCycle('12m')}
                className={`relative px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  billingCycle === '12m'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <span>سنوي (12 شهر)</span>
                <span className="bg-amber-400/30 text-amber-200 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-400/40">
                  🏆 الأكثر توفيراً
                </span>
              </button>
            </div>

            {/* Currency / Region Toggle */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-700/80">
              <button
                onClick={() => setCurrency('EGP')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currency === 'EGP'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🇪🇬 مصر (EGP)</span>
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currency === 'USD'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🌐 دولي (USD $)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
          {pendingRequestResult ? (
            <div className="p-6 sm:p-10 bg-white rounded-3xl border border-slate-200 shadow-md flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-lg shadow-amber-500/10">
                <Clock size={36} className="animate-pulse" />
              </div>

              <div className="space-y-1 max-w-lg">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-black mb-1">
                  <Clock size={12} />
                  بانتظار التحقق من السداد والاعتماد ⏳
                </span>
                <h3 className="text-2xl font-black text-slate-900">تم تسجيل طلب الاشتراك بنجاح!</h3>
                <p className="text-xs text-slate-500">
                  رقم الفاتورة / الطلب المرجعي: <strong className="font-mono text-slate-900 text-sm font-black">#{pendingRequestResult.orderId}</strong>
                </p>
              </div>

              {/* Order Details */}
              <div className="w-full max-w-md bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2.5 text-right font-medium">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">الصالون:</span>
                  <span className="font-bold text-slate-800">{settings.salonName || currentSalon?.name}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">الباقة المطلوبة:</span>
                  <span className="font-bold text-indigo-700">{pendingRequestResult.planName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">دورة الفوترة:</span>
                  <span className="font-bold text-slate-800">{pendingRequestResult.cycleLabel}</span>
                </div>
                {pendingRequestResult.branches > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">الفروع الإضافية:</span>
                    <span className="font-bold text-slate-800">+{pendingRequestResult.branches} فرع</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2.5 text-sm font-black text-slate-900 bg-white px-3.5 rounded-xl border border-slate-200">
                  <span>إجمالي المبلغ المطلوب سداده:</span>
                  <span className="font-mono text-emerald-600 text-base">{Number(pendingRequestResult.amount).toLocaleString()} {pendingRequestResult.currency}</span>
                </div>
              </div>

              {/* Strict Security Alert */}
              <div className="w-full max-w-md bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs text-right leading-relaxed flex items-start gap-3">
                <ShieldAlert size={22} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-rose-900 block mb-1">تنبيه مالي وأمني حاسم:</strong>
                  تم حظر التفعيل المجاني أو التلقائي لحماية المنظومة. لن يتم تفعيل الباقة وتمديد صلاحية الصالون إلا بعد تحويل المبلغ ومراجعة إيصال التحويل من قِبل إدارة المنظومة.
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md pt-2">
                <button
                  onClick={() => handleWhatsAppContact(pendingRequestResult.orderId)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <MessageCircle size={18} />
                  <span>إرسال إيصال السداد عبر واتساب الآن 📲</span>
                </button>

                <button
                  onClick={() => {
                    setPendingRequestResult(null);
                    onClose();
                  }}
                  className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <>
              {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-sm font-bold shadow-xs">
                  <div className="flex items-center gap-2">
                    <Check className="text-emerald-600" size={20} />
                    <span>{successMessage}</span>
                  </div>
                  <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 text-xs hover:underline">
                    حسناً
                  </button>
                </div>
              )}

              {/* Pricing Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
            {plans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const price = getPlanPrice(plan);
              const monthlyEquivalent = Math.round(price / cycleMonths);
              const savings = calculateSavings(plan);

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`relative rounded-3xl p-5 sm:p-6 transition-all cursor-pointer flex flex-col justify-between border-2 ${
                    isSelected
                      ? 'border-emerald-500 bg-white shadow-xl shadow-emerald-500/10 scale-[1.02]'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {/* Badge */}
                  {plan.isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black px-3.5 py-1 rounded-full shadow-md flex items-center gap-1">
                      <Zap size={13} className="text-amber-300" />
                      الأكثر طلباً وشهرة
                    </div>
                  )}
                  {plan.id === 'enterprise' && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-black px-3.5 py-1 rounded-full shadow-md flex items-center gap-1">
                      <Crown size={13} className="text-amber-300" />
                      للمنشآت الكبرى
                    </div>
                  )}

                  <div>
                    {/* Header: Title & Target */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">{plan.planNameAr}</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{plan.planNameEn}</p>
                      </div>
                      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors">
                        <div className={`w-4 h-4 rounded-full transition-all ${isSelected ? 'bg-emerald-600' : 'bg-transparent'}`} />
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
                      {plan.descriptionAr}
                    </p>

                    {/* Capacity Badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold mb-4">
                      <Users size={15} className="text-slate-500" />
                      <span>
                        سعة الفريق: <strong>{plan.id === 'enterprise' ? '11 موظفاً فأكثر (غير محدود)' : `من ${plan.minEmployees} إلى ${plan.maxEmployees} موظفين`}</strong>
                      </span>
                    </div>

                    {/* Price Block */}
                    <div className="my-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-baseline gap-1 text-slate-900">
                        <span className="text-3xl font-black tracking-tight">{Number(price || 0).toLocaleString()}</span>
                        <span className="text-xs font-bold text-slate-500">{currencyLabel}</span>
                        <span className="text-xs text-slate-400 font-medium">/ {cycleMonths === 1 ? 'شهرياً' : `${cycleMonths} شهور`}</span>
                      </div>

                      {cycleMonths > 1 && (
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">ما يعادل شهرياً:</span>
                          <span className="font-bold text-slate-700 font-mono">{Number(monthlyEquivalent || 0).toLocaleString()} {currencyLabel}/شهر</span>
                        </div>
                      )}

                      {/* Savings Indicator */}
                      {savings > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-black text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg">
                          <span>وفرت مع هذه المدة:</span>
                          <span className="font-mono text-emerald-600">{Number(savings || 0).toLocaleString()} {currencyLabel} 🎉</span>
                        </div>
                      )}
                    </div>

                    {/* Feature List */}
                    <div className="space-y-2 text-xs text-slate-600 font-medium mb-4">
                      {plan.features?.map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-2">
                          <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Select button */}
                  <button
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{isSelected ? 'الباقة المختارة حالياً' : 'اختيار هذه الباقة'}</span>
                    {isSelected && <Check size={15} />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Section: Additional Branch Add-ons Counter */}
          <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs border border-indigo-100">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900">إضافة فروع مرخصة (Branch Add-on)</h4>
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    حتى 5 موظفين للفرع
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                  تسمح لك رخصة الفرع الإضافي بربط وتشغيل فرع إضافي في النظام مع قاعدة بيانات موحدة ومزامنة حية للمخزون والتقارير.
                </p>
                <p className="text-xs font-bold text-indigo-950 mt-1.5">
                  سعر رخصة الفرع للمدة المختارة: <strong className="text-indigo-600 font-mono font-black">{Number(addonPricePerBranch || 0).toLocaleString()} {currencyLabel}</strong>
                </p>
              </div>
            </div>

            {/* Counter Component */}
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setAdditionalBranches(prev => Math.max(0, prev - 1))}
                disabled={additionalBranches === 0}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-black transition-colors shadow-2xs"
                title="تقليل عدد الفروع"
              >
                <Minus size={16} />
              </button>

              <div className="text-center px-3 min-w-[70px]">
                <span className="text-xl font-black text-slate-900 font-mono">{additionalBranches}</span>
                <p className="text-[10px] text-slate-400 font-bold">فروع إضافية</p>
              </div>

              <button
                type="button"
                onClick={() => setAdditionalBranches(prev => prev + 1)}
                className="w-9 h-9 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center font-black transition-colors shadow-xs active:scale-95"
                title="إضافة فرع جديد"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Bill Summary & Action Footer */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="space-y-1 text-center md:text-right">
              <span className="text-xs font-bold text-emerald-400 flex items-center justify-center md:justify-start gap-1.5">
                <ShieldCheck size={16} />
                ملخص الفاتورة المعتمدة
              </span>
              <div className="flex flex-wrap items-baseline justify-center md:justify-start gap-2">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
                  {Number(grandTotal || 0).toLocaleString()}
                </span>
                <span className="text-sm font-bold text-slate-300">{currencyLabel}</span>
                <span className="text-xs text-slate-400 font-medium">
                  ({selectedPlan?.planNameAr} • {cycleMonths === 1 ? 'شهر واحد' : `${cycleMonths} شهور`} {additionalBranches > 0 ? `• +${additionalBranches} فرع إضافي` : ''})
                </span>
              </div>
              {totalSavings > 0 && (
                <p className="text-xs text-amber-300 font-bold flex items-center justify-center md:justify-start gap-1">
                  <span>وفرت:</span>
                  <strong className="font-mono">{Number(totalSavings || 0).toLocaleString()} {currencyLabel}</strong>
                  <span>مقارنة بالدفع الشهري المنفصل! 🎁</span>
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => handleWhatsAppContact()}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <MessageCircle size={18} />
                <span>طلب التفعيل الفوري عبر واتساب 📲</span>
              </button>

              <button
                onClick={handleRequestSubscription}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
              >
                <Receipt size={18} />
                <span>{isSubmitting ? 'جاري التسجيل...' : 'تسجيل طلب اشتراك (بانتظار السداد) 📋'}</span>
              </button>

              {isProgrammer && (
                <button
                  onClick={handleProgrammerDirectActivation}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-95 border-2 border-amber-300"
                  title="صلاحية خاصة بالمبرمج الرئيسي فقط"
                >
                  <Zap size={16} className="text-slate-950" />
                  <span>تفعيل فوري مباشر (صلاحية المبرمج) ⚡</span>
                </button>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
