import React, { useState } from 'react';
import { Sparkles, Building2, Cloud, CloudOff, CheckCircle2, ChevronDown, X, Smartphone, Lock } from 'lucide-react';
import { SaaSSubscription, Branch, AppUser } from '../types';

interface SubscriptionBannerProps {
  subscription: SaaSSubscription;
  branches: Branch[];
  activeBranchId: string;
  onSelectBranch: (branchId: string) => void;
  isCloudConnected: boolean;
  onOpenOwnerPortal?: () => void;
  salonName?: string;
  currentUser?: AppUser | null;
}

export function SubscriptionBanner({ 
  subscription, 
  branches, 
  activeBranchId, 
  onSelectBranch,
  isCloudConnected,
  onOpenOwnerPortal,
  salonName,
  currentUser
}: SubscriptionBannerProps) {
  const [showBranchesMenu, setShowBranchesMenu] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Can this user switch branches? ONLY Master Programmer OR Salon Owner (Admin with no branchId constraint)
  const isOwnerOrProgrammer = currentUser?.role === 'programmer' || currentUser?.role === 'owner' || (currentUser?.role === 'admin' && !currentUser?.branchId);
  const canSwitchBranches = isOwnerOrProgrammer;

  const currentSalonId = currentUser?.salonId || subscription.salonId;
  const filteredBranches = (branches && branches.length > 0)
    ? (currentSalonId ? branches.filter(b => b.salonId === currentSalonId) : branches)
    : [];
  const effectiveBranches = filteredBranches;

  const activeBranch = effectiveBranches.find(b => b.id === activeBranchId) || effectiveBranches[0];
  const nowMidnight = new Date();
  nowMidnight.setHours(0, 0, 0, 0);
  const endDateTime = subscription.endDate ? new Date(subscription.endDate) : new Date(Date.now() + 7 * 86400000);
  const isExpired = subscription.status === 'expired' || endDateTime.getTime() < nowMidnight.getTime();
  const isSuspended = subscription.isActive === false || subscription.status === 'suspended';
  const isTrial = subscription.status === 'trial';
  
  const daysLeft = Math.max(0, Math.ceil((endDateTime.getTime() - Date.now()) / (1000 * 3600 * 24)));
  const displaySalonName = salonName || subscription.organizationName;

  return (
    <>
      {/* Red Alert Banner if Expired or Suspended */}
      {(isExpired || isSuspended) && (
        <div className="bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 text-white px-4 py-2 flex items-center justify-between text-xs font-bold border-b border-red-800 z-40 shadow-md animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
            <span>⛔ تنبيه هام: لقد انتهت فترة اشتراك هذا الصالون (أو الحساب موقوف مؤقتاً). المنظومة تعمل الآن بوضع <strong>الاطلاع فقط (Read-Only)</strong> ولا يمكن حفظ فواتير أو تعديلات جديدة.</span>
          </div>
          <span className="bg-white/20 text-white px-3 py-1 rounded-lg text-[11px] font-black">
            يرجى التجديد 🛡️
          </span>
        </div>
      )}

      {/* Pending Branch Activation Alert Banner */}
      {activeBranch?.status === 'pending_activation' && !isExpired && !isSuspended && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold border-b border-amber-700 z-40 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
            <span>⏳ تنبيه: هذا الفرع ({activeBranch.name}) بانتظار الاعتماد والتفعيل من قِبل إدارة المنظومة (المبرمج الرئيسي) • تم تجميد إدخال البيانات لهذا الفرع لحين التفعيل.</span>
          </div>
          <span className="bg-white/20 text-white px-3 py-1 rounded-lg text-[11px] font-black">
            بانتظار التفعيل 🟡
          </span>
        </div>
      )}

      <div className="bg-slate-900 text-white px-4 py-1.5 flex items-center justify-between text-xs border-b border-slate-800 z-30 font-sans select-none">
        {/* Left / Right Start: Organization & Plan */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-emerald-400 font-extrabold">{displaySalonName}</span>
            <button 
              onClick={() => setShowPlanModal(true)}
              className={`inline-flex items-center gap-1 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow hover:brightness-110 transition-all cursor-pointer ${
                isTrial ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
              }`}
            >
              <Sparkles size={10} />
              <span>{isTrial ? `تجريبي (${Math.max(0, daysLeft)} يوم متبقي)` : `باقة ${subscription.plan.toUpperCase()}`}</span>
            </button>
          </div>

        {/* Cloud Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700 text-[11px]">
          {isCloudConnected ? (
            <>
              <Cloud size={13} className="text-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">سحابي متصل</span>
            </>
          ) : (
            <>
              <CloudOff size={13} className="text-amber-400" />
              <span className="text-slate-300 font-medium">محلي (Offline)</span>
            </>
          )}
        </div>
      </div>

      {/* Center/End: Branch Selector */}
      <div className="flex items-center gap-2">

        {canSwitchBranches ? (
          <div className="relative">
            <button
              onClick={() => setShowBranchesMenu(!showBranchesMenu)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              title="انقر لتبديل الفرع النشط (صلاحية المالك / الإدارة)"
            >
              <Building2 size={14} className={activeBranch?.status === 'pending_activation' ? 'text-amber-400' : 'text-emerald-400'} />
              <span>{activeBranch?.name || 'الفرع الرئيسي'}</span>
              {activeBranch?.status === 'pending_activation' && (
                <span className="bg-amber-500 text-slate-900 text-[10px] px-1.5 py-0.2 rounded font-black">معلق</span>
              )}
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {showBranchesMenu && (
              <div className="absolute left-0 mt-1.5 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 flex justify-between items-center">
                  <span>تبديل الفرع المختار</span>
                  <span className="text-emerald-400 font-mono text-[9px]">المالك 👑</span>
                </div>
                {effectiveBranches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      onSelectBranch(b.id);
                      setShowBranchesMenu(false);
                    }}
                    className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors cursor-pointer ${
                      b.id === activeBranchId ? 'text-emerald-400 font-bold bg-slate-700/50' : 'text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{b.status === 'pending_activation' ? '🟡' : '🟢'}</span>
                      <span className="truncate">{b.name}</span>
                      {b.status === 'pending_activation' && (
                        <span className="text-[10px] text-amber-400 font-normal">(بانتظار التفعيل)</span>
                      )}
                    </div>
                    {b.id === activeBranchId && <CheckCircle2 size={14} className="shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div 
            className="flex items-center gap-2 bg-slate-800/90 text-slate-200 px-3 py-1 rounded-lg border border-slate-700 font-semibold text-xs select-none"
            title="الفرع المخصص لحسابك (غير مصرح بالانتقال لفروع أخرى)"
          >
            <Building2 size={14} className="text-emerald-400" />
            <span>{activeBranch?.name || 'الفرع المخصص'}</span>
            <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.2 rounded font-black flex items-center gap-1">
              <Lock size={10} />
              <span>فرعك</span>
            </span>
          </div>
        )}

        {onOpenOwnerPortal && currentUser?.role === 'owner' && (
          <button
            onClick={onOpenOwnerPortal}
            title="الانتقال إلى شاشة المالك التنفيذية (نبض المالك)"
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-lg text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
          >
            <Smartphone size={13} />
            <span className="hidden sm:inline">العودة لشاشة المالك</span>
            <span>👑</span>
          </button>
        )}
      </div>

      {/* Subscription Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowPlanModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 font-bold text-lg"
            >
              <X size={20} />
            </button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Sparkles size={24} />
              </div>
              <h3 className="font-extrabold text-lg text-slate-800">تفاصيل اشتراك المنظومة (SaaS)</h3>
              <p className="text-xs text-slate-500 mt-1">خطة العمل النشطة لمؤسستكم</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-xs mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">المنشأة:</span>
                <span className="font-bold text-slate-800">{displaySalonName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">نوع الباقة:</span>
                <span className="font-bold text-emerald-600 uppercase">{subscription.plan} PRO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">حالة الاشتراك:</span>
                <span className="font-bold text-emerald-600">ساري ونشط 🟢</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">تاريخ التجديد:</span>
                <span className="font-bold text-slate-700">{subscription.endDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">عدد الفروع المتاحة:</span>
                <span className="font-bold text-slate-700">{branches.length} من أصل {subscription.maxBranches}</span>
              </div>
            </div>

            <button
              onClick={() => setShowPlanModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
