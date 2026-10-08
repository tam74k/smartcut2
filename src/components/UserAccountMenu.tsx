import React, { useEffect, useRef } from 'react';
import { AppUser } from '../types';
import { ROLE_LABELS } from '../services/auth';
import { User, Key, Settings, LogOut } from 'lucide-react';

interface UserAccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onProfileClick: () => void;
  onChangePasswordClick: () => void;
  onSettingsClick: () => void;
  onLogoutClick: () => void;
  align?: 'bottom-start' | 'top-start' | 'bottom-end' | 'top-end';
}

export const UserAccountMenu: React.FC<UserAccountMenuProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileClick,
  onChangePasswordClick,
  onSettingsClick,
  onLogoutClick,
  align = 'bottom-start'
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const roleName = ROLE_LABELS[currentUser.role] || currentUser.role;

  // Positioning classes based on align prop
  const positionClasses = {
    'bottom-start': 'top-full left-0 mt-2',
    'bottom-end': 'top-full right-0 mt-2',
    'top-start': 'bottom-full left-0 mb-2',
    'top-end': 'bottom-full right-0 mb-2',
  }[align];

  return (
    <div
      ref={menuRef}
      className={`absolute ${positionClasses} z-50 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 text-right animate-in fade-in zoom-in-95 duration-150 select-none`}
      dir="rtl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* User Info Header */}
      <div className="p-2.5 pb-2">
        <h4 className="text-sm font-black text-slate-800 leading-tight truncate">
          {currentUser.name}
        </h4>
        <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
          {currentUser.username || 'admin'}
        </p>
        <div className="mt-2">
          <span className="inline-block bg-sky-100/80 text-sky-800 border border-sky-200/60 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            {roleName}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 my-1.5 mx-1" />

      {/* Menu Action Items */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onProfileClick();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-right cursor-pointer"
        >
          <User size={16} className="text-slate-600 shrink-0" />
          <span>الملف الشخصي</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onChangePasswordClick();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-right cursor-pointer"
        >
          <Key size={16} className="text-slate-600 shrink-0" />
          <span>تغيير كلمة المرور</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onSettingsClick();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-right cursor-pointer"
        >
          <Settings size={16} className="text-slate-600 shrink-0" />
          <span>الإعدادات</span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 my-1.5 mx-1" />

      {/* Logout Action */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onLogoutClick();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-right cursor-pointer"
      >
        <LogOut size={16} className="text-rose-500 shrink-0" />
        <span>تسجيل الخروج</span>
      </button>
    </div>
  );
};
