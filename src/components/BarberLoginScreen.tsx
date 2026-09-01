import React, { useState, useEffect } from 'react';
import { Scissors, Lock, User, Sparkles, ShieldCheck, ArrowRight, Smartphone, Building2, CheckCircle2, ChevronDown } from 'lucide-react';
import { AuthService } from '../services/auth';
import { SubscriptionService } from '../services/subscriptionService';
import { AppUser, AppSettings, Branch } from '../types';
import { DB } from '../services/db';

interface BarberLoginScreenProps {
  onLoginSuccess: (user: AppUser, customSettings?: AppSettings, selectedBranch?: Branch) => void;
  salonName?: string;
  onSwitchToMainApp?: () => void;
  onSwitchToOwnerPortal?: () => void;
}

export function BarberLoginScreen({
  onLoginSuccess,
  salonName = 'SMART CUT',
  onSwitchToMainApp,
  onSwitchToOwnerPortal
}: BarberLoginScreenProps) {
  const [username, setUsername] = useState('barber');
  const [password, setPassword] = useState('123');
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

  // Available Branches
  const branches = SubscriptionService.getBranches();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || 'b-main');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await AuthService.loginAsync(username, password);

      if (!user) {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        setIsLoading(false);
        return;
      }

      // Check if user has barber, admin or programmer role
      if (user.role !== 'barber' && user.role !== 'admin' && user.role !== 'programmer') {
        setError('⚠️ هذا الحساب غير مصرح له بالدخول لبوابة الفنيين والكوافير.');
        setIsLoading(false);
        return;
      }

      const branch = branches.find(b => b.id === (user.branchId || selectedBranchId)) || branches[0];
      onLoginSuccess(user, undefined, branch);
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
      setError('حدث خطأ أثناء التحقق من تسجيل الدخول');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-between items-center p-4 font-sans text-slate-100 relative overflow-hidden select-none" dir="rtl">
      {/* Subtle Background Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header */}
      <header className="w-full max-w-md flex items-center justify-between py-4 z-10">
        <div className="flex items-center gap-2">
          {dbLogoUrl ? (
            <div className="w-10 h-10 rounded-2xl bg-slate-900/90 border border-indigo-500/40 p-1 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <img src={dbLogoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Scissors size={18} />
            </div>
          )}
          <div>
            <h1 className="text-sm font-black tracking-tight text-white">{salonName}</h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">بوابة الفني والكوافير المستقلة</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (onSwitchToMainApp) onSwitchToMainApp();
              else window.location.href = '/';
            }}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 transition-all cursor-pointer font-bold"
          >
            <span>النظام الرئيسي</span>
            <ArrowRight size={14} className="rotate-180" />
          </button>
        </div>
      </header>

      {/* Login Card */}
      <main className="w-full max-w-md my-auto z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 relative">
          {/* Logo / Badge */}
          <div className="text-center mb-5">
            {dbLogoUrl ? (
              <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white shadow-xl shadow-indigo-500/20 border border-indigo-500/30 mb-2 transform hover:scale-110 hover:rotate-3 transition-all duration-300">
                <img src={dbLogoUrl} alt="Platform Logo" className="w-14 h-14 object-contain rounded-xl" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 text-white shadow-lg shadow-indigo-500/20 mb-2 transform hover:scale-110 hover:rotate-6 transition-all duration-300">
                <Scissors size={28} />
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full text-[11px] font-bold block w-fit mx-auto">
              <Sparkles size={13} className="text-indigo-400" />
              <span>بوابة الفني والكوافير • Barber VIP</span>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-1 tracking-tight">مرحباً بك مجدداً ✂️</h2>
          <p className="text-xs text-slate-400 mb-6 font-normal leading-relaxed">
            سجّل دخولك لمتابعة مواعيد حجوزاتك، عمولاتك المكتسبة، إنجاز التارجت اللحظي وسجل الدوام والسلف.
          </p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-2xl text-xs font-bold mb-5 flex items-center gap-2 animate-shake">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0"></span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المستخدم للفني / الكوافير</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="barber"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 text-white rounded-2xl pr-10 pl-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 text-white rounded-2xl pr-10 pl-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>تسجيل الدخول إلى لوحة الفني</span>
                  <Scissors size={15} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-4 z-10 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <span>SMART CUT v2.0 • Barber Cloud</span>
        <button
          onClick={() => {
            if (onSwitchToOwnerPortal) onSwitchToOwnerPortal();
            else window.location.href = '/owner';
          }}
          className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
        >
          <span>👑 بوابة المالك</span>
        </button>
      </footer>
    </div>
  );
}
