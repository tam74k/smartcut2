import React, { useState, useRef, useEffect } from 'react';
import { 
  User, Key, Settings as SettingsIcon, LogOut, 
  X, Check, Eye, EyeOff, Shield, Building, Phone, Mail, Sparkles
} from 'lucide-react';
import { AppUser, AppSettings } from '../types';
import { AuthService, ROLE_LABELS } from '../services/auth';
import { DB } from '../services/db';

export function getUserInitials(name?: string): string {
  if (!name || !name.trim()) return 'م';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]);
  }
  return name.trim().slice(0, 2);
}

interface UserMenuDropdownProps {
  currentUser: AppUser;
  setCurrentUser: (u: AppUser) => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
  settings?: AppSettings;
  activeBranch?: any;
  placement?: 'header' | 'sidebar';
  children: React.ReactNode;
}

export function UserMenuDropdown({
  currentUser,
  setCurrentUser,
  onLogout,
  onOpenSettings,
  settings,
  activeBranch,
  placement = 'header',
  children
}: UserMenuDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: currentUser.name || '',
    phone: currentUser.phone || '',
    email: currentUser.email || ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    oldPass: '',
    newPass: '',
    confirmPass: ''
  });
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Keep profile form synced when currentUser changes or modal opens
  useEffect(() => {
    if (showProfileModal) {
      setProfileForm({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        email: currentUser.email || ''
      });
      setProfileMsg(null);
    }
  }, [showProfileModal, currentUser]);

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      setProfileMsg({ type: 'error', text: 'يرجى إدخال الاسم الكامل' });
      return;
    }

    setProfileSaving(true);
    setProfileMsg(null);

    try {
      const updatedUser: AppUser = {
        ...currentUser,
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || undefined,
        email: profileForm.email.trim() || undefined
      };

      setCurrentUser(updatedUser);
      AuthService.setSession(updatedUser);

      // Update in local users storage
      const allUsers = AuthService.getUsers();
      const idx = allUsers.findIndex(u => u.id === updatedUser.id || (u.username && u.username.toLowerCase() === updatedUser.username.toLowerCase()));
      if (idx !== -1) {
        allUsers[idx] = updatedUser;
        AuthService.saveUsers(allUsers);
      }

      // Persist to Supabase
      await DB.saveUser(updatedUser);

      setProfileMsg({ type: 'success', text: 'تم تحديث بيانات الملف الشخصي بنجاح!' });
      setTimeout(() => {
        setShowProfileModal(false);
      }, 1200);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ التعديلات' });
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (!passwordForm.oldPass) {
      setPasswordError('يرجى إدخال كلمة المرور الحالية');
      return;
    }
    if (!passwordForm.newPass) {
      setPasswordError('يرجى إدخال كلمة المرور الجديدة');
      return;
    }
    if (passwordForm.newPass.length < 4) {
      setPasswordError('كلمة المرور الجديدة يجب ألا تقل عن 4 خانات');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirmPass) {
      setPasswordError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await AuthService.changePasswordAsync(
        currentUser.id,
        passwordForm.oldPass,
        passwordForm.newPass,
        currentUser
      );

      if (!res.success) {
        setPasswordError(res.message || 'فشل تغيير كلمة المرور، تأكد من صحة كلمة المرور الحالية');
      } else {
        setPasswordSuccess(true);
        setPasswordForm({ oldPass: '', newPass: '', confirmPass: '' });
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess(false);
        }, 1500);
      }
    } catch (err: any) {
      setPasswordError(err.message || 'حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Role label in Arabic
  const roleLabel = ROLE_LABELS[currentUser.role] || currentUser.role;

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger element (Avatar or profile box) */}
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="cursor-pointer select-none"
        role="button"
        tabIndex={0}
      >
        {children}
      </div>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div 
          className={`absolute ${
            placement === 'header' 
              ? 'left-0 top-full mt-2' 
              : 'bottom-full left-0 right-0 mb-2'
          } w-60 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 text-right animate-in fade-in zoom-in-95 duration-100`}
          dir="rtl"
        >
          {/* Top User Info Section */}
          <div className="px-3 py-2 text-right">
            <h4 className="text-sm font-extrabold text-slate-800 leading-tight truncate">
              {currentUser.name}
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5 truncate font-mono">
              {currentUser.username || currentUser.email || 'user'}
            </p>
            <div className="mt-1.5">
              <span className="inline-block bg-sky-100/70 text-sky-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="h-px bg-slate-100 my-1 mx-1" />

          {/* Menu Action Items */}
          <div className="space-y-0.5">
            {/* 1. الملف الشخصي */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowProfileModal(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors text-right cursor-pointer"
            >
              <User size={18} className="text-slate-600 shrink-0" />
              <span>الملف الشخصي</span>
            </button>

            {/* 2. تغيير كلمة المرور */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setPasswordError('');
                setPasswordSuccess(false);
                setPasswordForm({ oldPass: '', newPass: '', confirmPass: '' });
                setShowPasswordModal(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors text-right cursor-pointer"
            >
              <Key size={18} className="text-slate-600 shrink-0" />
              <span>تغيير كلمة المرور</span>
            </button>

            {/* 3. الإعدادات */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onOpenSettings) {
                  onOpenSettings();
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors text-right cursor-pointer"
            >
              <SettingsIcon size={18} className="text-slate-600 shrink-0" />
              <span>الإعدادات</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1 mx-1" />

          {/* 4. تسجيل الخروج */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-right cursor-pointer"
          >
            <LogOut size={18} className="text-rose-600 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      )}

      {/* Modal 1: الملف الشخصي (Profile Modal) */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">الملف الشخصي</h3>
                  <p className="text-xs text-slate-500 font-medium">عرض وتعديل معلومات حساب المستخدم</p>
                </div>
              </div>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Content */}
            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              {profileMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  profileMsg.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {profileMsg.type === 'success' ? <Check size={16} /> : <X size={16} />}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              {/* Role & System Info Card */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">الدور الوظيفي والصلاحية</span>
                  <span className="text-xs font-black text-slate-800">{roleLabel}</span>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-slate-400 font-medium block">الفرع الحالي</span>
                  <span className="text-xs font-black text-slate-700">{activeBranch?.name || 'الفرع الرئيسي'}</span>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل:</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-primary focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم (المعرف):</label>
                  <input
                    type="text"
                    value={currentUser.username}
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-400 outline-none cursor-not-allowed font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">اسم المستخدم هو معرّف الدخول الأساسي للنظام ولا يمكن تغييره يدوياً.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="05xxxxxxxx"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-primary focus:bg-white transition-all pl-9"
                    />
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني:</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                      placeholder="user@example.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-primary focus:bg-white transition-all pl-9"
                    />
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-primary hover:bg-primary-dark transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
                >
                  {profileSaving ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: تغيير كلمة المرور (Change Password Modal) */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">تغيير كلمة المرور</h3>
                  <p className="text-xs text-slate-500 font-medium">تحديث رمز الأمان لحساب {currentUser.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Password Form */}
            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              {passwordError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
                  <X size={16} className="shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                  <Check size={16} className="shrink-0" />
                  <span>تم تغيير كلمة المرور بنجاح!</span>
                </div>
              )}

              <div className="space-y-3">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الحالية:</label>
                  <div className="relative">
                    <input
                      type={showOldPass ? 'text' : 'password'}
                      value={passwordForm.oldPass}
                      onChange={e => setPasswordForm({ ...passwordForm, oldPass: e.target.value })}
                      required
                      placeholder="أدخل كلمة المرور الحالية"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-primary focus:bg-white transition-all pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة:</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={passwordForm.newPass}
                      onChange={e => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                      required
                      minLength={4}
                      placeholder="أدخل كلمة المرور الجديدة (4 خانات على الأقل)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-primary focus:bg-white transition-all pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة:</label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={passwordForm.confirmPass}
                      onChange={e => setPasswordForm({ ...passwordForm, confirmPass: e.target.value })}
                      required
                      minLength={4}
                      placeholder="أعد إدخال كلمة المرور الجديدة"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-primary focus:bg-white transition-all pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                >
                  {passwordSaving ? (
                    <span>جاري التحديث...</span>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>تحديث كلمة المرور</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
