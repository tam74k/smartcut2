import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, ShieldAlert, Sparkles, KeyRound } from 'lucide-react';
import { PasswordResetService } from '../services/passwordResetService';

interface ResetPasswordScreenProps {
  token?: string;
  onNavigateToLogin: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  token: propToken,
  onNavigateToLogin,
}) => {
  const [token, setToken] = useState<string>(propToken || '');
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [matchedUser, setMatchedUser] = useState<any | null>(null);

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // 1. Extract token from URL if not supplied via props
  useEffect(() => {
    let extractedToken = propToken || '';
    if (!extractedToken && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      extractedToken = urlParams.get('token') || urlParams.get('reset_token') || urlParams.get('resettoken') || '';

      if (!extractedToken && window.location.hash) {
        const hash = window.location.hash;
        const hashMatch = hash.match(/[?&]token=([^&]+)/i) || hash.match(/[?&]reset_token=([^&]+)/i);
        if (hashMatch && hashMatch[1]) {
          extractedToken = decodeURIComponent(hashMatch[1]);
        }
      }
    }
    setToken(extractedToken);
  }, [propToken]);

  // 2. Verify token on token change
  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        setIsVerifying(false);
        setTokenError('لم يتم العثور على رمز استعادة كلمة المرور في الرابط.');
        return;
      }

      setIsVerifying(true);
      setTokenError(null);

      try {
        const res = await PasswordResetService.verifyResetToken(token);
        if (!isMounted) return;

        if (res.valid && res.user) {
          setMatchedUser(res.user);
          setTokenError(null);
        } else {
          setTokenError(res.error || 'رمز الاستعادة غير صالح أو منتهي الصلاحية.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setTokenError(err.message || 'حدث خطأ أثناء فحص رمز الاستعادة.');
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    }

    if (token) {
      checkToken();
    } else {
      setIsVerifying(false);
      setTokenError('الرابط المستخدم غير مكتمل، يرجى التأكد من الرابط المرسل لبريدك الإلكتروني.');
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 3. Countdown on success before auto-redirect
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onNavigateToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSuccess, onNavigateToLogin]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!password) {
      setSubmitError('يرجى إدخال كلمة المرور الجديدة');
      return;
    }

    if (password.length < 6) {
      setSubmitError('يجب أن تتكون كلمة المرور من 6 خانات على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await PasswordResetService.executePasswordReset(token, password);
      if (res.success) {
        setIsSuccess(true);
      } else {
        setSubmitError(res.message);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'حدث خطأ أثناء حفظ كلمة المرور الجديدة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mask email for privacy (e.g. j***e@domain.com)
  const maskEmail = (emailStr: string) => {
    if (!emailStr) return '';
    const [name, domain] = emailStr.split('@');
    if (!domain) return emailStr;
    const maskedName = name.length <= 2 ? name[0] + '***' : name[0] + '***' + name[name.length - 1];
    return `${maskedName}@${domain}`;
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 relative overflow-hidden font-sans"
    >
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 overflow-hidden z-10 transition-all">
        
        {/* Header / Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 mb-3">
            <KeyRound size={28} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">
            إعادة تعيين كلمة المرور
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            SmartCut • المنظومة الذكية لإدارة الصالونات
          </p>
        </div>

        {/* 1. Loading State */}
        {isVerifying && (
          <div className="py-12 text-center">
            <div className="inline-block w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-semibold text-slate-700">جاري التحقق من أمان الرابط وصلاحيته...</p>
            <p className="text-xs text-slate-400 mt-1">يرجى الانتظار لحظات</p>
          </div>
        )}

        {/* 2. Error State (Invalid/Expired/Inactive User) */}
        {!isVerifying && tokenError && (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 text-rose-500 mb-3">
              <ShieldAlert size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">تعذر المتابعة</h3>
            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 mb-6 text-right">
              <div className="flex items-start gap-2 text-rose-700 text-xs font-semibold leading-relaxed">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{tokenError}</span>
              </div>
            </div>
            <button
              onClick={onNavigateToLogin}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl shadow-md text-xs sm:text-sm flex items-center justify-center gap-2 transition-all transform active:scale-98"
            >
              <span>العودة لصفحة تسجيل الدخول</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* 3. Success State */}
        {!isVerifying && !tokenError && isSuccess && (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">تم تحديث كلمة المرور بنجاح!</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              تم تغيير كلمة المرور لحسابك في المنظومة. يمكنك الآن تسجيل الدخول مباشرة بكلمة المرور الجديدة.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6">
              <p className="text-xs font-semibold text-emerald-800">
                سيتم تحويلك إلى شاشة تسجيل الدخول تلقائياً خلال{' '}
                <span className="font-extrabold text-sm text-emerald-950 underline px-1">{countdown}</span> ثوانٍ...
              </p>
            </div>
            <button
              onClick={onNavigateToLogin}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/30 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all transform active:scale-98"
            >
              <span>تسجيل الدخول الآن</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* 4. Active Reset Form */}
        {!isVerifying && !tokenError && !isSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Info Pill */}
            {matchedUser && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {matchedUser.name ? matchedUser.name[0] : (matchedUser.username ? matchedUser.username[0].toUpperCase() : 'U')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {matchedUser.name || matchedUser.username}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate" dir="ltr">
                    {maskEmail(matchedUser.email)}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                  نشط ✓
                </span>
              </div>
            )}

            {/* Error Message if any */}
            {submitError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-rose-700 text-xs font-semibold">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{submitError}</span>
              </div>
            )}

            {/* New Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور الجديدة
              </label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور جديدة قوية"
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-10 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تأكيد كلمة المرور الجديدة
              </label>
              <div className="relative">
                <ShieldCheck className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-10 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className={password.length >= 6 ? 'text-emerald-600' : 'text-slate-400'}>
                  {password.length >= 6 ? '✓' : '○'}
                </span>
                <span className={password.length >= 6 ? 'text-emerald-700' : 'text-slate-500'}>
                  6 خانات على الأقل
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className={confirmPassword && password === confirmPassword ? 'text-emerald-600' : 'text-slate-400'}>
                  {confirmPassword && password === confirmPassword ? '✓' : '○'}
                </span>
                <span className={confirmPassword && password === confirmPassword ? 'text-emerald-700' : 'text-slate-500'}>
                  تطابق كلمتي المرور
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !password || password.length < 6 || password !== confirmPassword}
              className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>حفظ كلمة المرور الجديدة</span>
                </>
              )}
            </button>

            {/* Cancel / Back to login */}
            <button
              type="button"
              onClick={onNavigateToLogin}
              disabled={isSubmitting}
              className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700 py-1 transition-colors"
            >
              إلغاء والعودة لشاشة الدخول
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            تم تأمين هذا الإجراء بواسطة تشفير عالي الحماية ومنظومة Resend الموثقة.
          </p>
        </div>
      </div>
    </div>
  );
};
