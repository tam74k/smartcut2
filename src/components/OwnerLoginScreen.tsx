import React, { useState, useEffect } from 'react';
import { 
  Crown, Lock, User, Eye, EyeOff, Sparkles, Building2, 
  ArrowRight, ShieldCheck, CheckCircle2, ChevronRight, Store 
} from 'lucide-react';
import { AuthService } from '../services/auth';
import { AppUser, AppSettings, Branch } from '../types';
import { SubscriptionService } from '../services/subscriptionService';
import { DB } from '../services/db';

interface OwnerLoginScreenProps {
  onLoginSuccess: (user: AppUser, customSettings?: AppSettings, selectedBranch?: Branch) => void;
  salonName?: string;
  onSwitchToMainApp?: () => void;
}

export function OwnerLoginScreen({ 
  onLoginSuccess, 
  salonName = 'منظومة سمارت كت للصالونات',
  onSwitchToMainApp 
}: OwnerLoginScreenProps) {
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbLogoUrl, setDbLogoUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const loadLogo = async () => {
      try {
        const pSettings = await DB.fetchPlatformSettings();
        if ((pSettings?.logoUrl || pSettings?.platformLogoUrl) && isMounted) {
          setDbLogoUrl(pSettings.logoUrl || pSettings.platformLogoUrl || '');
        }
      } catch (e) {
        console.warn('Failed to load platform logo:', e);
      }
    };
    loadLogo();
    return () => { isMounted = false; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);
    try {
      const user = await AuthService.loginAsync(username, password);
      setIsLoading(false);

      if (user) {
        // Validate user role: owner, admin, or programmer
        if (user.role !== 'owner' && user.role !== 'admin' && user.role !== 'programmer') {
          setError('⛔ هذا الحساب مخصص لموظفي الفرع (كاشير/استقبال). الدخول لبوابة المالك مخصص لمالك الصالون والإدارة التنفيذية فقط.');
          return;
        }

        const salons = SubscriptionService.getSalons();
        const salon = user.salonId 
          ? salons.find(s => s.id === user.salonId) 
          : (salons.find(s => s.email?.toLowerCase() === user.email?.toLowerCase() || (user.phone && s.phone === user.phone)) || salons[0]);
        
        const sBranches = SubscriptionService.getBranches(salon?.id);
        const chosenBranch = (user.branchId && sBranches.find(b => b.id === user.branchId)) || sBranches.find(b => b.isMain) || sBranches[0];

        let branchSettings: AppSettings | undefined = undefined;
        if (chosenBranch) {
          branchSettings = SubscriptionService.getBranchSettings(chosenBranch.id);
        }

        onLoginSuccess(user, branchSettings, chosenBranch);
      } else {
        setError('بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم وكلمة المرور');
      }
    } catch (e) {
      setIsLoading(false);
      setError('حدث خطأ أثناء التحقق من تسجيل الدخول');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-amber-500 selection:text-slate-900 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {dbLogoUrl ? (
            <div className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-amber-500/40 p-1.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <img src={dbLogoUrl} alt="Platform Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <Crown size={24} />
            </div>
          )}
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              <span>بوابة مالك الصالون التنفيذية</span>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">
                Executive Owner
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">SmartCut VIP Dashboard • نبض الصالون المباشر</p>
          </div>
        </div>

        {onSwitchToMainApp && (
          <button
            onClick={onSwitchToMainApp}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <Store size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">نظام الكاشير ونقاط البيع</span>
            <ChevronRight size={14} />
          </button>
        )}
      </header>

      {/* Center Card */}
      <main className="max-w-md w-full mx-auto my-8 z-10">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            {dbLogoUrl ? (
              <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white shadow-xl shadow-amber-500/20 border border-amber-500/30 mb-2 transform hover:scale-110 hover:rotate-3 transition-all duration-300">
                <img src={dbLogoUrl} alt="Logo" className="w-14 h-14 object-contain rounded-xl" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-400/10 border border-amber-500/30 text-amber-400 mb-1 transform hover:scale-110 hover:rotate-6 transition-all duration-300">
                <Sparkles size={28} />
              </div>
            )}
            <h2 className="text-xl font-black text-white">تسجيل دخول المالك</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              تابع الإيرادات اللحظية، مؤشرات الأداء، دوام الموظفين، والمقارنات بين الفروع لأي تاريخ وفترة زمنية
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-2xl text-xs font-bold animate-in fade-in duration-200">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم المستخدم أو البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="owner"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-amber-500 rounded-2xl pr-10 pl-4 py-3 text-xs font-mono font-bold text-white outline-none transition-all shadow-inner"
                  dir="ltr"
                />
                <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-amber-500 rounded-2xl pr-10 pl-10 py-3 text-xs font-mono font-bold text-white outline-none transition-all shadow-inner"
                  dir="ltr"
                />
                <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black py-3.5 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Crown size={16} />
                  <span>دخول إلى لوحة المالك</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center text-xs text-slate-500 z-10">
        <p>SmartCut Salon & Spa Management • رابط المالك المباشر: <code className="text-amber-400/80">/owner</code></p>
      </footer>
    </div>
  );
}
