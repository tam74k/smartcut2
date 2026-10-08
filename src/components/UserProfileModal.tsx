import React from 'react';
import { AppUser, Branch } from '../types';
import { ROLE_LABELS } from '../services/auth';
import { 
  User, 
  Key, 
  X, 
  ShieldCheck, 
  Phone, 
  Mail, 
  Building2, 
  Calendar, 
  CheckCircle2,
  Lock
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  activeBranch?: Branch;
  onChangePasswordClick: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeBranch,
  onChangePasswordClick
}) => {
  if (!isOpen) return null;

  const roleName = ROLE_LABELS[currentUser.role] || currentUser.role;

  // استخراج الحروف الأولى للأفاتار
  const getInitials = (name: string) => {
    if (!name) return 'م';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).substring(0, 2);
    }
    return name.substring(0, 2);
  };

  const createdDateFormatted = currentUser.createdAt 
    ? new Date(currentUser.createdAt).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'غير محدد';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <User size={22} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">الملف الشخصي للمستخدم</h2>
              <p className="text-xs text-slate-500">تفاصيل الحساب وبيانات الاعتماد</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* User Card */}
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl p-5 border border-slate-200/80 mb-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-800 border-2 border-sky-200/80 flex items-center justify-center font-black text-lg shadow-xs shrink-0">
            {getInitials(currentUser.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-base text-slate-900 truncate">{currentUser.name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">@{currentUser.username}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                <ShieldCheck size={12} />
                <span>{roleName}</span>
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <CheckCircle2 size={11} />
                <span>حساب نشط</span>
              </span>
            </div>
          </div>
        </div>

        {/* Details List */}
        <div className="space-y-3 mb-6 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 flex items-center gap-2 font-medium">
              <Phone size={14} className="text-slate-400" />
              <span>رقم الهاتف:</span>
            </span>
            <span className="font-bold text-slate-800 font-mono" dir="ltr">
              {currentUser.phone || 'غير مسجل'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 flex items-center gap-2 font-medium">
              <Mail size={14} className="text-slate-400" />
              <span>البريد الإلكتروني:</span>
            </span>
            <span className="font-bold text-slate-800 font-mono" dir="ltr">
              {currentUser.email || 'غير مسجل'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 flex items-center gap-2 font-medium">
              <Building2 size={14} className="text-slate-400" />
              <span>الفرع الحالي:</span>
            </span>
            <span className="font-bold text-slate-800">
              {activeBranch?.name || 'الفرع الرئيسي'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 flex items-center gap-2 font-medium">
              <Calendar size={14} className="text-slate-400" />
              <span>تاريخ إنشاء الحساب:</span>
            </span>
            <span className="font-bold text-slate-800">
              {createdDateFormatted}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onClose();
              onChangePasswordClick();
            }}
            className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Key size={14} />
            <span>تغيير كلمة المرور</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
