import React, { useState } from 'react';
import { 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { AppUser } from '../types';
import { AuthService } from '../services/auth';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onSuccess?: (updatedUser: AppUser) => void;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  currentUser,
  onSuccess
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setIsSubmitting(false);
    setIsSuccess(false);
  };

  const handleClose = () => {
    handleResetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('يرجى إدخال كلمة المرور الحالية');
      return;
    }
    if (!newPassword) {
      setError('يرجى إدخال كلمة المرور الجديدة');
      return;
    }
    if (newPassword.length < 4) {
      setError('كلمة المرور الجديدة يجب أن تكون 4 خانات على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }
    if (currentPassword === newPassword) {
      setError('كلمة المرور الجديدة يجب أن تختلف عن كلمة المرور الحالية');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await AuthService.changePasswordAsync(currentUser, currentPassword, newPassword);
      setIsSubmitting(false);

      if (!res.success) {
        setError(res.message || 'فشل تحديث كلمة المرور');
        return;
      }

      setIsSuccess(true);
      if (res.updatedUser && onSuccess) {
        onSuccess(res.updatedUser);
      }

      setTimeout(() => {
        handleClose();
      }, 1600);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'حدث خطأ غير متوقع أثناء تغيير كلمة المرور');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden my-6 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">تعديل كلمة المرور</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                حساب: <span className="font-bold text-slate-700">{currentUser.name}</span> (<span className="font-mono text-indigo-600">@{currentUser.username}</span>)
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-in zoom-in-50 duration-300">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="font-black text-base text-slate-900">تم تغيير كلمة المرور بنجاح!</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              تم تحديث كلمة المرور وحفظ التوقيع الرقمي المشفر للحساب بنجاح.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Current Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور الحالية *
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الحالية"
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 2. New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور الجديدة *
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة (4 خانات فأكثر)"
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 3. Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تأكيد كلمة المرور الجديدة *
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Security note */}
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-start gap-2.5 text-[11px] text-indigo-900 font-medium">
              <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <span>
                سيتم تشفير كلمة المرور وتحديث الختم الرقمي الأمني لحسابك فوراً لمنع أي اختراق أو تلاعب.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>جارٍ الحفظ...</span>
                ) : (
                  <>
                    <Lock size={15} />
                    <span>حفظ كلمة المرور الجديدة</span>
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
