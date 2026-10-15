import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Phone, 
  Mail, 
  HelpCircle, 
  Eye, 
  EyeOff, 
  X, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { AppUser, PRESET_SECURITY_QUESTIONS, SecurityQuestionAnswer } from '../types';
import { AuthService } from '../services/auth';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RegisterModal({ isOpen, onClose, onSuccess }: RegisterModalProps) {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 3 Security Questions & Answers
  const [q1, setQ1] = useState(PRESET_SECURITY_QUESTIONS[0] || '');
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState(PRESET_SECURITY_QUESTIONS[1] || '');
  const [a2, setA2] = useState('');
  const [q3, setQ3] = useState(PRESET_SECURITY_QUESTIONS[2] || '');
  const [a3, setA3] = useState('');

  // UI States
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!fullName.trim()) {
      setError('يرجى إدخال اسم الموظف بالكامل');
      return;
    }
    if (!phone.trim()) {
      setError('يرجى إدخال رقم الموبايل');
      return;
    }
    if (!username.trim()) {
      setError('يرجى إدخال اسم المستخدم باللغة الإنجليزية');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
      setError('اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط');
      return;
    }
    if (password.length < 4) {
      setError('كلمة المرور يجب أن تتكون من 4 خانات على الأقل');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقتين');
      return;
    }

    // Security Questions Validation
    if (!a1.trim() || !a2.trim() || !a3.trim()) {
      setError('يرجى الإجابة على جميع أسئلة استعادة كلمة المرور الثلاثة');
      return;
    }
    if (q1 === q2 || q1 === q3 || q2 === q3) {
      setError('يرجى اختيار 3 أسئلة أمان مختلفة عن بعضها البعض');
      return;
    }

    setIsSubmitting(true);
    try {
      const securityQuestions: SecurityQuestionAnswer[] = [
        { question: q1, answer: a1.trim().toLowerCase() },
        { question: q2, answer: a2.trim().toLowerCase() },
        { question: q3, answer: a3.trim().toLowerCase() }
      ];

      const newUser: AppUser = {
        id: 'usr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        name: fullName.trim(),
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        email: email.trim().toLowerCase() || undefined,
        password: password.trim(),
        role: 'custom',
        active: false,
        status: 'pending',
        screens: [],
        actions: [],
        securityQuestions,
        createdAt: new Date().toISOString()
      };

      const res = await AuthService.registerUser(newUser);
      setIsSubmitting(false);

      if (res.success) {
        setIsSubmittedSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        setError(res.message || 'فشل تسجيل الحساب، يرجى المحاولة مرة أخرى');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'حدث خطأ أثناء حفظ البيانات، يرجى التحقق من الاتصال');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto font-sans" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-100 overflow-hidden my-6">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-black text-base">تسجيل حساب موظف جديد</h3>
              <p className="text-[11px] text-slate-300">إنشاء طلب حساب جديد بانتظار موافقة مدير النظام (Admin)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success View */}
        {isSubmittedSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 border-2 border-amber-200 flex items-center justify-center mx-auto animate-bounce">
              <Clock size={32} />
            </div>

            <div className="space-y-2">
              <h4 className="text-lg font-black text-slate-900">تم تسجيل طلب حسابك بنجاح!</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                حسابك الآن في حالة <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">معلق بانتظار الموافقة</span>
              </p>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 text-right space-y-2 max-w-md mx-auto mt-4">
                <div className="flex items-center gap-2 font-bold text-indigo-900">
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <span>ما هي الخطوة التالية؟</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  سيقوم مدير النظام (Admin) بمراجعة طلبك في لوحة تحكم الصلاحيات وتخصيص الدور والصلاحيات المناسبة لمهامك (كاشير، محاسب، فني، إلخ). بعد الاعتماد ستتمكن فوراً من تسجيل الدخول باستخدام اسم المستخدم وكلمة المرور الخاصة بك.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              العودة إلى شاشة تسجيل الدخول
            </button>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Error Banner */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Note banner */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <Clock size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-snug">
                <span className="font-black">ملاحظة أمنية: </span>
                <span>الحسابات المسجلة حديثاً تكون في حالة (معلقة) ولا تملك أي صلاحيات حتى يقوم مدير النظام بقبول الطلب وتعيين الصلاحيات المناسبة.</span>
              </div>
            </div>

            {/* 1. Basic Info Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الموظف بالكامل *</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="مثال: عبد الله أحمد"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الموبايل *</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني (اختياري)</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="employee@domain.com"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المستخدم للدخول (Username) *</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="ahmed123"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">كلمة المرور *</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-9 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تأكيد كلمة المرور *</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-9 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Security Questions for Password Recovery (3 أسئلة إلزامية) */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                <HelpCircle size={16} className="text-indigo-600" />
                <span>3 أسئلة أمان لاستعادة كلمة المرور (إلزامية)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                اختر 3 أسئلة مختلفة وأدخل إجاباتك الخاصة لاستخدامها عند نسيان كلمة المرور في أي وقت:
              </p>

              {/* Question 1 */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-indigo-900">السؤال الأول (1)</span>
                </div>
                <select
                  value={q1}
                  onChange={e => setQ1(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  {PRESET_SECURITY_QUESTIONS.map((q, idx) => (
                    <option key={idx} value={q}>{q}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={a1}
                  onChange={e => setA1(e.target.value)}
                  placeholder="إجابة السؤال الأول..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              {/* Question 2 */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-indigo-900">السؤال الثاني (2)</span>
                </div>
                <select
                  value={q2}
                  onChange={e => setQ2(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  {PRESET_SECURITY_QUESTIONS.map((q, idx) => (
                    <option key={idx} value={q}>{q}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={a2}
                  onChange={e => setA2(e.target.value)}
                  placeholder="إجابة السؤال الثاني..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              {/* Question 3 */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-indigo-900">السؤال الثالث (3)</span>
                </div>
                <select
                  value={q3}
                  onChange={e => setQ3(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  {PRESET_SECURITY_QUESTIONS.map((q, idx) => (
                    <option key={idx} value={q}>{q}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={a3}
                  onChange={e => setA3(e.target.value)}
                  placeholder="إجابة السؤال الثالث..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Submit and Cancel Buttons */}
            <div className="pt-3 border-t border-slate-100 flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>إرسال طلب تسجيل الحساب</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
