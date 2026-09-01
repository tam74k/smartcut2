import React, { useState, useEffect } from 'react';
import { 
  Building2, Sparkles, Calendar, Search, CheckCircle2, Clock, ShieldAlert, 
  UserCheck, UserX, Plus, Edit3, DollarSign, MessageSquare, Globe, Mail, 
  Phone, Sliders, X, ExternalLink, ChevronDown, Lock, Zap, Shield, Key, 
  Database, RefreshCw, AlertTriangle, ArrowRight, UserPlus, Layers, Server,
  Trash2, Receipt, CreditCard, LogOut
} from 'lucide-react';
import { SalonTenant, AppUser, Branch } from '../types';
import { SubscriptionService, COUNTRY_CURRENCY_MAP } from '../services/subscriptionService';
import { AuthService } from '../services/auth';
import { DB } from '../services/db';

interface SaaSProgrammerPortalProps {
  onSwitchSalon?: (salon: SalonTenant) => void;
  onExitPortal?: () => void;
  onLogout?: () => void;
}

export function SaaSProgrammerPortal({ onSwitchSalon, onExitPortal, onLogout }: SaaSProgrammerPortalProps) {
  const [portalTab, setPortalTab] = useState<'salons' | 'branches'>('salons');
  const [salons, setSalons] = useState<SalonTenant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'expiring_soon' | 'expired_trials' | 'active' | 'trial' | 'expired' | 'suspended'>('all');
  const [branchStatusFilter, setBranchStatusFilter] = useState<'all' | 'pending_activation' | 'active' | 'suspended'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSalon, setEditingSalon] = useState<SalonTenant | null>(null);
  const [showExtendModal, setShowExtendModal] = useState<SalonTenant | null>(null);
  const [extendDaysCount, setExtendDaysCount] = useState<number>(30);
  const [showResetPassModal, setShowResetPassModal] = useState<SalonTenant | null>(null);
  const [newAdminPassword, setNewAdminPassword] = useState('123456');

  // Change Developer Master Key State
  const [showChangeProgrammerPassModal, setShowChangeProgrammerPassModal] = useState(false);
  const [newProgPass, setNewProgPass] = useState('');
  const [confirmProgPass, setConfirmProgPass] = useState('');
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  // Platform Branding & Support Settings State (Database sync)
  const [showPlatformSettingsModal, setShowPlatformSettingsModal] = useState(false);
  const [isSavingPlatformSettings, setIsSavingPlatformSettings] = useState(false);
  const [platformForm, setPlatformForm] = useState({
    platformName: 'منظومة سمارت كت برو لإدارة الصالونات ومراكز التجميل',
    platformPhone: '0500000000',
    platformEmail: 'admin@smartcut.app',
    platformLogoUrl: '',
    defaultTrialDays: 7
  });

  const handleSavePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPlatformSettings(true);
    const ok = await DB.savePlatformSettings(platformForm);
    setIsSavingPlatformSettings(false);
    if (ok) {
      alert('✅ تم حفظ إعدادات وهوية المنظومة وأرقام الدعم الفني في قاعدة البيانات بنجاح!');
      setShowPlatformSettingsModal(false);
    } else {
      alert('حدث خطأ أثناء حفظ الإعدادات في قاعدة البيانات');
    }
  };

  // New Salon Form State
  const [newSalonForm, setNewSalonForm] = useState({
    salonName: '',
    ownerName: '',
    email: '',
    phone: '',
    country: 'المملكة العربية السعودية',
    password: '',
    trialDays: 7,
    plan: 'pro' as 'starter' | 'pro' | 'enterprise'
  });

  const handleChangeProgrammerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgPass.trim()) {
      alert('يرجى إدخال كلمة المرور الجديدة');
      return;
    }
    if (newProgPass.trim() !== confirmProgPass.trim()) {
      alert('كلمتا المرور غير متطابقتين');
      return;
    }
    setIsUpdatingPass(true);
    const ok = await AuthService.updateProgrammerPassword(newProgPass.trim());
    setIsUpdatingPass(false);
    if (ok) {
      alert('✅ تم حفظ وتحديث كلمة مرور المطور في قاعدة البيانات بنجاح!');
      setShowChangeProgrammerPassModal(false);
      setNewProgPass('');
      setConfirmProgPass('');
    } else {
      alert('حدث خطأ أثناء حفظ كلمة المرور');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {

    setIsLoadingData(true);
    try {
      const [dbSalons, dbBranches, dbPlatform] = await Promise.all([
        DB.fetchSalons(),
        DB.fetchBranches(),
        DB.fetchPlatformSettings()
      ]);

      if (dbPlatform) {
        setPlatformForm({
          platformName: dbPlatform.platformName || 'منظومة سمارت كت برو لإدارة الصالونات ومراكز التجميل',
          platformPhone: dbPlatform.platformPhone || '0500000000',
          platformEmail: dbPlatform.platformEmail || 'admin@smartcut.app',
          platformLogoUrl: dbPlatform.platformLogoUrl || '',
          defaultTrialDays: dbPlatform.defaultTrialDays ?? 7
        });
      }

      let finalSalons = dbSalons && dbSalons.length > 0 ? dbSalons : [];
      let finalBranches = dbBranches && dbBranches.length > 0 ? dbBranches : [];

      if (finalSalons.length === 0) {
        const localSalons = SubscriptionService.getSalons();
        finalSalons = localSalons;
        for (const s of localSalons) {
          await DB.saveSalon(s);
        }
      }

      if (finalBranches.length === 0) {
        const localBranches = SubscriptionService.getBranches();
        finalBranches = localBranches;
        for (const b of localBranches) {
          await DB.saveBranch(b);
        }
      }

      setSalons(finalSalons);
      SubscriptionService.saveSalons(finalSalons);

      setBranches(finalBranches);
      SubscriptionService.saveBranches(finalBranches);
    } catch (e) {
      console.error('Failed to load SaaS salons & branches:', e);
      setSalons(SubscriptionService.getSalons());
      setBranches(SubscriptionService.getBranches());
    } finally {
      setIsLoadingData(false);
    }
  };

  const getDaysLeft = (s: SalonTenant) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(s.subscriptionEndDate || today);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24));
  };

  const handleActivateBranch = async (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;
    const updatedBranch: Branch = {
      ...branch,
      isActive: true,
      status: 'active'
    };
    setBranches(prev => prev.map(b => b.id === branchId ? updatedBranch : b));
    SubscriptionService.setBranchStatus(branchId, 'active');
    await DB.saveBranch(updatedBranch);
  };

  const handleSuspendBranch = async (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;
    const updatedBranch: Branch = {
      ...branch,
      isActive: false,
      status: 'suspended'
    };
    setBranches(prev => prev.map(b => b.id === branchId ? updatedBranch : b));
    SubscriptionService.setBranchStatus(branchId, 'suspended');
    await DB.saveBranch(updatedBranch);
  };

  const handleToggleBranchActive = async (branch: Branch) => {
    const newActive = !branch.isActive;
    const newStatus: 'active' | 'suspended' = newActive ? 'active' : 'suspended';
    const updatedBranch: Branch = {
      ...branch,
      isActive: newActive,
      status: newStatus
    };

    setBranches(prev => prev.map(b => b.id === branch.id ? updatedBranch : b));
    SubscriptionService.setBranchStatus(branch.id, newStatus);
    await DB.saveBranch(updatedBranch);
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا الفرع نهائياً؟')) {
      SubscriptionService.deleteBranch(branchId);
      setBranches(prev => prev.filter(b => b.id !== branchId));
    }
  };

  const filteredSalons = salons.filter(s => {
    const daysLeft = getDaysLeft(s);
    const isExpired = daysLeft < 0 || s.subscriptionStatus === 'expired' || !s.isActive;
    const isExpiringSoon = daysLeft >= 0 && daysLeft <= 5 && s.isActive && s.subscriptionStatus !== 'expired';
    const isExpiredTrial = (s.subscriptionStatus === 'trial' || (s.trialDays !== undefined && s.trialDays > 0)) && (isExpired || daysLeft <= 0);

    const matchesSearch = 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      (s.ownerName && s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'expiring_soon') return isExpiringSoon;
    if (statusFilter === 'expired_trials') return isExpiredTrial;
    if (statusFilter === 'active') return s.subscriptionStatus === 'active' && s.isActive && !isExpired;
    if (statusFilter === 'trial') return s.subscriptionStatus === 'trial' && s.isActive && !isExpired;
    if (statusFilter === 'expired') return isExpired;
    if (statusFilter === 'suspended') return !s.isActive || s.subscriptionStatus === 'suspended';
    return true;
  });

  const stats = {
    total: salons.length,
    active: salons.filter(s => s.subscriptionStatus === 'active' && s.isActive && getDaysLeft(s) >= 0).length,
    trial: salons.filter(s => s.subscriptionStatus === 'trial' && s.isActive && getDaysLeft(s) >= 0).length,
    expiringSoon: salons.filter(s => {
      const d = getDaysLeft(s);
      return d >= 0 && d <= 5 && s.isActive && s.subscriptionStatus !== 'expired';
    }).length,
    expiredTrials: salons.filter(s => {
      const d = getDaysLeft(s);
      const isExp = d < 0 || s.subscriptionStatus === 'expired' || !s.isActive;
      return (s.subscriptionStatus === 'trial' || (s.trialDays !== undefined && s.trialDays > 0)) && isExp;
    }).length,
    expired: salons.filter(s => !s.isActive || s.subscriptionStatus === 'expired' || s.subscriptionStatus === 'suspended' || getDaysLeft(s) < 0).length
  };

  const handleCreateSalon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalonForm.salonName || !newSalonForm.email || !newSalonForm.phone) {
      alert('الرجاء ملء جميع الحقول الأساسية للصالون');
      return;
    }

    const res = SubscriptionService.registerNewSalon({
      salonName: newSalonForm.salonName,
      ownerName: newSalonForm.ownerName || newSalonForm.salonName,
      email: newSalonForm.email,
      phone: newSalonForm.phone,
      country: newSalonForm.country,
      password: newSalonForm.password || '123456',
      customTrialDays: Number(newSalonForm.trialDays) || 7
    });

    if (res?.salon) {
      await DB.saveSalon(res.salon);
      if (res.branch) await DB.saveBranch(res.branch);
      if (res.user) await DB.saveUser(res.user);
      if (res.settings) await DB.saveSettings(res.salon.id, res.settings);
    }

    await loadData();
    setShowAddModal(false);
    setNewSalonForm({
      salonName: '',
      ownerName: '',
      email: '',
      phone: '',
      country: 'المملكة العربية السعودية',
      password: '',
      trialDays: 7,
      plan: 'pro'
    });
    alert('✅ تم إنشاء الصالون وتجهيز الحساب والتجربة المجانية (7 أيام) وحفظه بقاعدة البيانات بنجاح!');
  };

  const handleToggleActive = async (salon: SalonTenant) => {
    const newActive = !salon.isActive;
    const newStatus = newActive 
      ? (salon.subscriptionStatus === 'suspended' ? 'active' : salon.subscriptionStatus) 
      : 'suspended';

    const updatedSalon: SalonTenant = {
      ...salon,
      isActive: newActive,
      subscriptionStatus: newStatus
    };

    setSalons(prev => prev.map(s => s.id === salon.id ? updatedSalon : s));
    SubscriptionService.updateSalon(salon.id, {
      isActive: newActive,
      subscriptionStatus: newStatus
    });

    await DB.saveSalon(updatedSalon);
    await DB.saveSettings(salon.id, {
      isSalonActive: newActive,
      subscriptionStatus: newStatus,
      subscriptionEndDate: salon.subscriptionEndDate
    });

    if (newActive) {
      const salonBranches = branches.filter(b => b.salonId === salon.id);
      for (const b of salonBranches) {
        const updatedBranch = { ...b, isActive: true, status: 'active' as const };
        SubscriptionService.setBranchStatus(b.id, 'active');
        await DB.saveBranch(updatedBranch);
      }
      setBranches(prev => prev.map(b => b.salonId === salon.id ? { ...b, isActive: true, status: 'active' } : b));
    } else {
      const salonBranches = branches.filter(b => b.salonId === salon.id);
      for (const b of salonBranches) {
        const updatedBranch = { ...b, isActive: false, status: 'suspended' as const };
        SubscriptionService.setBranchStatus(b.id, 'suspended');
        await DB.saveBranch(updatedBranch);
      }
      setBranches(prev => prev.map(b => b.salonId === salon.id ? { ...b, isActive: false, status: 'suspended' } : b));
    }
  };


  const handleApplyExtend = async () => {
    if (!showExtendModal) return;
    const updated = SubscriptionService.extendDays(showExtendModal.id, extendDaysCount);
    if (updated) {
      setSalons(prev => prev.map(s => s.id === updated.id ? updated : s));
      await DB.saveSalon(updated);
      await DB.saveSettings(updated.id, {
        subscriptionEndDate: updated.subscriptionEndDate,
        subscriptionStatus: 'active',
        isSalonActive: true
      });
    }
    setShowExtendModal(null);
    alert(`✅ تم تمديد فترة اشتراك ${showExtendModal.name} بنجاح بمقدار +${extendDaysCount} يوماً وحفظها بقاعدة البيانات!`);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalon) return;
    const updated = SubscriptionService.updateSalon(editingSalon.id, {
      name: editingSalon.name,
      ownerName: editingSalon.ownerName,
      email: editingSalon.email,
      phone: editingSalon.phone,
      country: editingSalon.country,
      currency: editingSalon.currency,
      subscriptionPlan: editingSalon.subscriptionPlan,
      subscriptionStatus: editingSalon.subscriptionStatus,
      subscriptionEndDate: editingSalon.subscriptionEndDate,
      maxBranches: editingSalon.maxBranches,
      maxUsers: editingSalon.maxUsers,
      isActive: editingSalon.isActive
    });
    if (updated) {
      setSalons(prev => prev.map(s => s.id === updated.id ? updated : s));
      await DB.saveSalon(updated);
    }
    setEditingSalon(null);
    alert('✅ تم حفظ تعديلات الصالون في قاعدة البيانات بنجاح!');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetPassModal || !newAdminPassword.trim()) return;
    const users = AuthService.getUsers();
    const salonUsers = users.filter(u => u.salonId === showResetPassModal.id || u.email === showResetPassModal.email);
    if (salonUsers.length > 0) {
      for (const u of salonUsers) {
        if (u.role === 'admin') {
          u.password = newAdminPassword.trim();
          await DB.saveUser(u);
        }
      }
      AuthService.saveUsers(users);
      alert(`✅ تم تغيير كلمة مرور أدمن صالون (${showResetPassModal.name}) وحفظها بقاعدة البيانات: ${newAdminPassword.trim()}`);
    } else {
      const newAdmin: AppUser = {
        id: 'usr-' + Math.random().toString(36).substring(2, 9),
        salonId: showResetPassModal.id,
        salonCode: showResetPassModal.code,
        username: showResetPassModal.email.split('@')[0] || 'admin',
        email: showResetPassModal.email,
        password: newAdminPassword.trim(),
        name: showResetPassModal.ownerName || showResetPassModal.name,
        role: 'admin',
        phone: showResetPassModal.phone,
        active: true,
        screens: ['*'],
        actions: ['*']
      };
      AuthService.saveUser(newAdmin);
      await DB.saveUser(newAdmin);
      alert(`✅ تم تعيين مستخدم أدمن جديد للصالون وحفظه بقاعدة البيانات بكلمة مرور: ${newAdminPassword.trim()}`);
    }
    setShowResetPassModal(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Programmer Banner */}
      <div className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-600/40">
              <Zap size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  لوحة تحكم المطور والمبرمج الرئيسي
                </h1>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                  SaaS Master Root 👑
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                إدارة كافة الصالونات المشتركة، تفعيل وتعطيل الحسابات، تمديد فترات التجربة (7 أيام)، والتحكم المركزي في المنظومة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoadingData}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="مزامنة وتحديث البيانات من السحابة وقاعدة بيانات Supabase"
            >
              <RefreshCw size={15} className={isLoadingData ? 'animate-spin text-indigo-400' : 'text-slate-400'} />
              <span>{isLoadingData ? 'جارِ المزامنة...' : 'تحديث من السحابة 🔄'}</span>
            </button>

            <button
              onClick={() => setShowPlatformSettingsModal(true)}
              className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 px-3.5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
              title="تعديل هوية المنظومة، الشعار، وأرقام الدعم الفني والبريد الإلكتروني الظاهرة في شاشة الدخول"
            >
              <Sliders size={15} />
              <span>هوية ودعم المنظومة ⚙️</span>
            </button>

            <button
              onClick={() => {
                setNewProgPass('');
                setConfirmProgPass('');
                setShowChangeProgrammerPassModal(true);
              }}
              className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 px-3.5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Key size={15} />
              <span>تغيير كلمة مرور المطور</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <UserPlus size={16} />
              <span>إضافة صالون جديد</span>
            </button>

            {onExitPortal && (
              <button
                onClick={onExitPortal}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
              >
                الاستعراض العام للصالون
              </button>
            )}

            <button
              onClick={() => {
                if (confirm('هل ترغب في تسجيل الخروج من لوحة تحكم المبرمج؟')) {
                  AuthService.logout();
                  if (onLogout) {
                    onLogout();
                  } else {
                    window.location.reload();
                  }
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <LogOut size={16} />
              <span>تسجيل خروج</span>
            </button>

          </div>
        </div>


        {/* Global Statistics Cards */}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 mb-1">إجمالي الصالونات المسجلة</p>
            <p className="text-2xl font-black text-white">{stats.total}</p>
          </div>
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-emerald-900/40">
            <p className="text-[11px] font-bold text-emerald-400 mb-1">اشتراكات مفعلة ونشطة 🟢</p>
            <p className="text-2xl font-black text-emerald-400">{stats.active}</p>
          </div>
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-amber-900/40">
            <p className="text-[11px] font-bold text-amber-400 mb-1">فترة تجريبية (7 أيام) 🟡</p>
            <p className="text-2xl font-black text-amber-400">{stats.trial}</p>
          </div>
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-rose-900/40">
            <p className="text-[11px] font-bold text-rose-400 mb-1">منتهية أو معطلة 🔴</p>
            <p className="text-2xl font-black text-rose-400">{stats.expired}</p>
          </div>
        </div>
      </div>

      {/* Portal Views Tabs */}
      <div className="max-w-7xl mx-auto mb-4 flex items-center gap-3">
        <button
          onClick={() => { setPortalTab('salons'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            portalTab === 'salons'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Building2 size={16} />
          <span>🏢 صالونات المنظومة ({salons.length})</span>
        </button>

        <button
          onClick={() => { setPortalTab('branches'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer relative ${
            portalTab === 'branches'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Layers size={16} />
          <span>🏬 الفروع وطلبات التفعيل ({branches.length})</span>
          {branches.filter(b => b.status === 'pending_activation').length > 0 && (
            <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse">
              {branches.filter(b => b.status === 'pending_activation').length} بانتظار الاعتماد ⏳
            </span>
          )}
        </button>
      </div>

      {/* Main Table Card */}
      <div className="max-w-7xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 w-full md:w-auto max-w-md">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder={portalTab === 'salons' ? "البحث باسم الصالون، الكود، الجوال، البريد، أو المالك..." : "البحث باسم الفرع، المدينة، الصالون، أو الجوال..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          {portalTab === 'salons' ? (
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
              {[
                { id: 'all', label: `الكل (${stats.total})` },
                { id: 'expired_trials', label: `تجريبية لم تشترك 📋 (${stats.expiredTrials})` },
                { id: 'expiring_soon', label: `تنتهي خلال 5 أيام ⚠️ (${stats.expiringSoon})` },
                { id: 'expired', label: `المنتهية 🔴 (${stats.expired})` },
                { id: 'active', label: `المفعلة 🟢 (${stats.active})` },
                { id: 'trial', label: `التجريبية 🟡 (${stats.trial})` },
                { id: 'suspended', label: 'الموقوفة ⛔' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    statusFilter === tab.id
                      ? tab.id === 'expired_trials' ? 'bg-purple-600 text-white font-black shadow-md' :
                        tab.id === 'expiring_soon' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
              {[
                { id: 'all', label: 'كافة الفروع' },
                { id: 'pending_activation', label: `بانتظار التفعيل (${branches.filter(b => b.status === 'pending_activation').length}) 🟡` },
                { id: 'active', label: 'الفروع النشطة 🟢' },
                { id: 'suspended', label: 'المعلقة 🔴' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setBranchStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    branchStatusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TAB 1: SALONS TABLE */}
        {portalTab === 'salons' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-black">
                  <th className="py-3 px-3">كود الصالون</th>
                  <th className="py-3 px-3">اسم الصالون والمالك</th>
                  <th className="py-3 px-3">التواصل والدولة</th>
                  <th className="py-3 px-3">الباقة والحالة</th>
                  <th className="py-3 px-3">الفروع</th>
                  <th className="py-3 px-3">تاريخ الانتهاء</th>
                  <th className="py-3 px-3">تفعيل / إيقاف</th>
                  <th className="py-3 px-3 text-center">العمليات الإدارية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSalons.map(salon => {
                  const isExpired = new Date(salon.subscriptionEndDate) < new Date();
                  const salonBranches = branches.filter(b => b.salonId === salon.id);
                  return (
                    <tr key={salon.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-400">
                        {salon.code}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-black text-white text-sm">{salon.name}</p>
                        <p className="text-[11px] text-slate-400">{salon.ownerName || 'غير محدد'}</p>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-mono text-slate-300 font-bold" dir="ltr">{salon.phone}</p>
                            <p className="text-[10px] text-slate-400">{salon.country} ({salon.currency})</p>
                          </div>
                          {salon.phone && (
                            <div className="flex items-center gap-1 mr-1">
                              <a
                                href={`https://wa.me/${salon.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً أستاذ ${salon.ownerName || salon.name}، نود إعلامكم بانتهاء الفترة التجريبية لمنظومة سمارت كت للصالونات، ويسعدنا تقديم باقات التجديد لتفعيل اشتراككم الرسمي.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white rounded-lg transition-all"
                                title="مراسلة واتساب فورية"
                              >
                                <MessageSquare size={13} />
                              </a>
                              <a
                                href={`tel:${salon.phone}`}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
                                title="اتصال هاتفي"
                              >
                                <Phone size={13} />
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 font-bold border border-indigo-800 text-[10px] uppercase">
                            {salon.subscriptionPlan}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            !salon.isActive || salon.subscriptionStatus === 'suspended'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : isExpired
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : salon.subscriptionStatus === 'trial'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}>
                            {!salon.isActive ? 'موقوف ⛔' : isExpired ? 'منتهي 🔴' : salon.subscriptionStatus === 'trial' ? 'تجريبي (7 أيام) 🟡' : 'ساري 🟢'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-300 font-mono">
                          {salonBranches.length} / {salon.maxBranches || 3}
                        </span>
                        <p className="text-[10px] text-slate-500">فروع مسجلة</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-mono font-bold text-slate-200">{salon.subscriptionEndDate}</p>
                        <p className="text-[10px] text-slate-500">بدأ: {salon.subscriptionStartDate}</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(salon)}
                            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                              salon.isActive ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'bg-slate-700'
                            }`}
                            title={salon.isActive ? 'انقر لتعطيل الصالون فوراً' : 'انقر لتفعيل الصالون فوراً'}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                salon.isActive ? '-translate-x-7' : '-translate-x-1'
                              }`}
                            />
                          </button>
                          <span className={`text-[10px] font-black ${
                            salon.isActive ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            {salon.isActive ? 'مفعل 🟢' : 'معطل 🔴'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            title="تمديد الاشتراك أو التجربة"
                            onClick={() => {
                              setShowExtendModal(salon);
                              setExtendDaysCount(7);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-all"
                          >
                            <Calendar size={14} />
                          </button>
                          <button
                            title="تعديل بيانات الصالون"
                            onClick={() => setEditingSalon(salon)}
                            className="p-1.5 bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white rounded-lg transition-all"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            title="إعادة تعيين كلمة مرور أدمن الصالون"
                            onClick={() => setShowResetPassModal(salon)}
                            className="p-1.5 bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white rounded-lg transition-all"
                          >
                            <Key size={14} />
                          </button>
                          {onSwitchSalon && (
                            <button
                              title="دخول ومعاينة الصالون"
                              onClick={() => onSwitchSalon(salon)}
                              className="p-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition-all"
                            >
                              <ExternalLink size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: BRANCHES TABLE */}
        {portalTab === 'branches' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-black">
                  <th className="py-3 px-3">كود الفرع</th>
                  <th className="py-3 px-3">اسم الفرع والمدينة</th>
                  <th className="py-3 px-3">الصالون التابع له</th>
                  <th className="py-3 px-3">رقم الهاتف والعنوان</th>
                  <th className="py-3 px-3">حالة التفعيل والاعتماد</th>
                  <th className="py-3 px-3 text-center">إجراءات المبرمج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {branches
                  .filter(b => {
                    const parent = salons.find(s => s.id === b.salonId);
                    const q = searchQuery.toLowerCase();
                    const matches = 
                      b.name.toLowerCase().includes(q) ||
                      b.code.toLowerCase().includes(q) ||
                      (b.city && b.city.toLowerCase().includes(q)) ||
                      (b.phone && b.phone.includes(q)) ||
                      (parent && parent.name.toLowerCase().includes(q));
                    if (!matches) return false;
                    if (branchStatusFilter === 'all') return true;
                    if (branchStatusFilter === 'pending_activation') return b.status === 'pending_activation';
                    if (branchStatusFilter === 'active') return b.status === 'active' || (b.isActive && !b.status);
                    if (branchStatusFilter === 'suspended') return b.status === 'suspended' || b.isActive === false;
                    return true;
                  })
                  .map(branch => {
                    const parentSalon = salons.find(s => s.id === branch.salonId);
                    const isPending = branch.status === 'pending_activation';
                    const isActive = branch.status === 'active' || (branch.isActive && !branch.status);
                    return (
                      <tr key={branch.id} className={`hover:bg-slate-800/40 transition-colors ${isPending ? 'bg-amber-950/20' : ''}`}>
                        <td className="py-3 px-3 font-mono font-bold text-indigo-400">
                          {branch.code}
                          {branch.isMain && (
                            <span className="mr-1.5 bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-bold">الرئيسي</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-black text-white text-sm">{branch.name}</p>
                          <p className="text-[11px] text-slate-400">{branch.city || 'غير محدد'}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-indigo-300">{parentSalon?.name || 'غير معروف'}</p>
                          <p className="text-[10px] font-mono text-slate-500">{branch.salonCode || parentSalon?.code}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <p>{branch.phone || 'غير مسجل'}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-xs">{branch.address || '-'}</p>
                        </td>
                        <td className="py-3 px-3">
                          {isPending ? (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-xl text-[11px] font-black inline-flex items-center gap-1.5 animate-pulse">
                              <Clock size={12} />
                              <span>بانتظار التفعيل ⏳</span>
                            </span>
                          ) : isActive ? (
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-xl text-[11px] font-black inline-flex items-center gap-1.5">
                              <CheckCircle2 size={12} />
                              <span>مفعل ونشط 🟢</span>
                            </span>
                          ) : (
                            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-xl text-[11px] font-black inline-flex items-center gap-1.5">
                              <ShieldAlert size={12} />
                              <span>معلق وموقوف 🔴</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleBranchActive(branch)}
                                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                                  branch.isActive ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'bg-slate-700'
                                }`}
                                title={branch.isActive ? 'انقر لتعليق الفرع' : 'انقر لتفعيل واعتماد الفرع فوراً'}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    branch.isActive ? '-translate-x-7' : '-translate-x-1'
                                  }`}
                                />
                              </button>
                              <span className={`text-[10px] font-black ${
                                branch.isActive ? 'text-emerald-400' : 'text-slate-500'
                              }`}>
                                {branch.isActive ? 'مفعل 🟢' : isPending ? 'بانتظار الاعتماد ⏳' : 'معلق ⏸️'}
                              </span>
                            </div>

                            {!branch.isMain && (
                              <button
                                onClick={() => handleDeleteBranch(branch.id)}
                                className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                                title="حذف الفرع"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD NEW SALON */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl text-slate-100 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <UserPlus size={18} className="text-indigo-400" />
                <span>إضافة صالون جديد على منظومة SaaS</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSalon} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">اسم الصالون</label>
                <input
                  type="text"
                  required
                  value={newSalonForm.salonName}
                  onChange={e => setNewSalonForm({ ...newSalonForm, salonName: e.target.value })}
                  placeholder="صالون الأناقة الحديثة"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">اسم المالك</label>
                  <input
                    type="text"
                    value={newSalonForm.ownerName}
                    onChange={e => setNewSalonForm({ ...newSalonForm, ownerName: e.target.value })}
                    placeholder="سعد العتيبي"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">رقم الجوال</label>
                  <input
                    type="tel"
                    required
                    value={newSalonForm.phone}
                    onChange={e => setNewSalonForm({ ...newSalonForm, phone: e.target.value })}
                    placeholder="0500000000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={newSalonForm.email}
                    onChange={e => setNewSalonForm({ ...newSalonForm, email: e.target.value })}
                    placeholder="salon@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">الدولة</label>
                  <select
                    value={newSalonForm.country}
                    onChange={e => setNewSalonForm({ ...newSalonForm, country: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    {Object.keys(COUNTRY_CURRENCY_MAP).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">فترة التجربة (بالأيام)</label>
                  <input
                    type="number"
                    value={newSalonForm.trialDays}
                    onChange={e => setNewSalonForm({ ...newSalonForm, trialDays: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">كلمة مرور الأدمن الأولية</label>
                  <input
                    type="password"
                    value={newSalonForm.password}
                    onChange={e => setNewSalonForm({ ...newSalonForm, password: e.target.value })}
                    placeholder="123456"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                تأكيد إضافة وتفعيل الصالون (7 أيام)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EXTEND TRIAL / SUBSCRIPTION */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-slate-100 animate-in fade-in">
            <h3 className="font-black text-sm text-white mb-2 flex items-center gap-2">
              <Calendar size={18} className="text-indigo-400" />
              <span>تمديد اشتراك: {showExtendModal.name}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              التاريخ الحالي للانتهاء: <span className="font-mono text-indigo-300 font-bold">{showExtendModal.subscriptionEndDate}</span>
            </p>

            <div className="space-y-3">
              <label className="block text-[11px] font-bold text-slate-400">اختر عدد الأيام المراد إضافتها:</label>
              <div className="grid grid-cols-3 gap-2">
                {[7, 14, 30, 90, 180, 365].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExtendDaysCount(d)}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      extendDaysCount === d
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    +{d} يوم
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleApplyExtend}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  تأكيد التمديد (+{extendDaysCount} يوم)
                </button>
                <button
                  type="button"
                  onClick={() => setShowExtendModal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET ADMIN PASSWORD */}
      {showResetPassModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-slate-100 animate-in fade-in">
            <h3 className="font-black text-sm text-white mb-2 flex items-center gap-2">
              <Key size={18} className="text-purple-400" />
              <span>إعادة ضبط كلمة مرور أدمن الصالون</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              صالون: <span className="text-white font-bold">{showResetPassModal.name}</span> ({showResetPassModal.email})
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">كلمة المرور الجديدة</label>
                <input
                  type="text"
                  required
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-black py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  حفظ وتعيين كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetPassModal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 4: EDIT SALON DATA */}
      {editingSalon && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl text-slate-100 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Edit3 size={18} className="text-amber-400" />
                <span>تعديل بيانات الصالون: {editingSalon.name}</span>
              </h3>
              <button onClick={() => setEditingSalon(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">اسم الصالون</label>
                <input
                  type="text"
                  required
                  value={editingSalon.name}
                  onChange={e => setEditingSalon({ ...editingSalon, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">اسم المالك</label>
                  <input
                    type="text"
                    value={editingSalon.ownerName || ''}
                    onChange={e => setEditingSalon({ ...editingSalon, ownerName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">رقم الجوال</label>
                  <input
                    type="tel"
                    required
                    value={editingSalon.phone}
                    onChange={e => setEditingSalon({ ...editingSalon, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">الباقة</label>
                  <select
                    value={editingSalon.subscriptionPlan}
                    onChange={e => setEditingSalon({ ...editingSalon, subscriptionPlan: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="starter">Starter (فرع واحد)</option>
                    <option value="pro">Pro (3 فروع)</option>
                    <option value="enterprise">Enterprise (غير محدود)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">تاريخ انتهاء الاشتراك</label>
                  <input
                    type="date"
                    required
                    value={editingSalon.subscriptionEndDate}
                    onChange={e => setEditingSalon({ ...editingSalon, subscriptionEndDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">الحد الأقصى للفروع</label>
                  <input
                    type="number"
                    value={editingSalon.maxBranches}
                    onChange={e => setEditingSalon({ ...editingSalon, maxBranches: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">الحد الأقصى للمستخدمين</label>
                  <input
                    type="number"
                    value={editingSalon.maxUsers}
                    onChange={e => setEditingSalon({ ...editingSalon, maxUsers: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSalon(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Developer Master Key Modal */}
      {showChangeProgrammerPassModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">تغيير كلمة مرور المطور (Master Key)</h3>
                  <p className="text-[10px] text-slate-400">سيتم حفظها فورياً بقاعدة البيانات وتحديث الدخول المركزي</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowChangeProgrammerPassModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeProgrammerPassword} className="space-y-4">
              <div className="bg-purple-950/40 border border-purple-500/30 p-3 rounded-2xl text-[11px] text-purple-200">
                <span>🔐 اسم مستخدم المطور: </span>
                <strong className="text-white font-mono font-black">programmer</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  value={newProgPass}
                  onChange={e => setNewProgPass(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-purple-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  تأكيد كلمة المرور *
                </label>
                <input
                  type="password"
                  value={confirmProgPass}
                  onChange={e => setConfirmProgPass(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور للتأكيد"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-purple-500"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChangeProgrammerPassModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPass}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-2.5 rounded-xl text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingPass ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>حفظ وتحديث بقاعدة البيانات 💾</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Platform Branding & Support Settings Modal */}
      {showPlatformSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">إعدادات هوية المنظومة والدعم الفني (شاشة الدخول)</h3>
                  <p className="text-[11px] text-slate-400">تُحفظ مباشرة في جدول اعدادات التطبيق بقاعدة البيانات Supabase</p>
                </div>
              </div>
              <button
                onClick={() => setShowPlatformSettingsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlatformSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المنظومة العام (Platform Name)</label>
                <input
                  type="text"
                  value={platformForm.platformName}
                  onChange={e => setPlatformForm({ ...platformForm, platformName: e.target.value })}
                  placeholder="منظومة سمارت كت برو لإدارة الصالونات ومراكز التجميل"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">رقم هاتف / واتساب الدعم الفني</label>
                  <input
                    type="tel"
                    value={platformForm.platformPhone}
                    onChange={e => setPlatformForm({ ...platformForm, platformPhone: e.target.value })}
                    placeholder="0500000000"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white outline-none focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">البريد الإلكتروني للدعم الفني</label>
                  <input
                    type="email"
                    value={platformForm.platformEmail}
                    onChange={e => setPlatformForm({ ...platformForm, platformEmail: e.target.value })}
                    placeholder="support@smartcut.app"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white outline-none focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  <span>رابط شعار المنظومة (Logo URL)</span>
                  <span className="text-[10px] text-slate-400 mr-2 font-normal">(يظهر في شاشة تسجيل الدخول)</span>
                </label>
                <input
                  type="url"
                  value={platformForm.platformLogoUrl}
                  onChange={e => setPlatformForm({ ...platformForm, platformLogoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white outline-none focus:border-emerald-500"
                  dir="ltr"
                />
                {platformForm.platformLogoUrl && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-slate-800/60 rounded-xl border border-slate-700">
                    <span className="text-[11px] text-slate-400 font-bold">معاينة الشعار:</span>
                    <img src={platformForm.platformLogoUrl} alt="Preview" className="w-8 h-8 object-contain rounded-lg bg-white p-0.5" />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPlatformSettingsModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlatformSettings}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPlatformSettings ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>حفظ الإعدادات في قاعدة البيانات 💾</span>
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

