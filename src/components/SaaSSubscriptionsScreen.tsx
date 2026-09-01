import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Sparkles, 
  Calendar, 
  Search, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  Plus, 
  Edit3, 
  DollarSign, 
  MessageSquare, 
  Globe, 
  Mail, 
  Phone, 
  Sliders, 
  X,
  ExternalLink,
  ChevronDown,
  Lock,
  Zap,
  Receipt,
  ArrowUpRight,
  Filter,
  AlertTriangle,
  Printer,
  CreditCard,
  RefreshCw,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { SalonTenant, Branch, SubscriptionPaymentRecord } from '../types';
import { SubscriptionService, COUNTRY_CURRENCY_MAP } from '../services/subscriptionService';

interface SaaSSubscriptionsScreenProps {
  onSwitchSalon?: (salon: SalonTenant) => void;
}

export function SaaSSubscriptionsScreen({ onSwitchSalon }: SaaSSubscriptionsScreenProps) {
  // Navigation Tabs: 'salons' | 'pending' | 'payments'
  const [mainTab, setMainTab] = useState<'salons' | 'pending' | 'payments'>('salons');

  // State
  const [salons, setSalons] = useState<SalonTenant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [payments, setPayments] = useState<SubscriptionPaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'expiring_soon' | 'expired_trials' | 'expired' | 'active' | 'trial' | 'pending'>('all');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSalon, setEditingSalon] = useState<SalonTenant | null>(null);
  const [renewTargetSalon, setRenewTargetSalon] = useState<SalonTenant | null>(null);
  const [activationTarget, setActivationTarget] = useState<{ type: 'salon' | 'branch'; item: SalonTenant | Branch } | null>(null);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<SubscriptionPaymentRecord | null>(null);

  // Renewal Form State
  const [renewalForm, setRenewalForm] = useState({
    durationMonths: 1,
    customDays: 0,
    amountPaid: 350,
    paymentMethod: 'bank_transfer' as 'cash' | 'bank_transfer' | 'card' | 'online' | 'other',
    referenceNumber: '',
    notes: '',
    recordedBy: 'المبرمج الرئيسي'
  });

  // New Salon Form State
  const [newSalonForm, setNewSalonForm] = useState({
    salonName: '',
    salonType: 'men' as 'men' | 'women' | 'mixed',
    ownerName: '',
    email: '',
    phone: '',
    country: 'المملكة العربية السعودية',
    password: '',
    trialDays: 7,
    plan: 'pro' as 'starter' | 'pro' | 'enterprise',
    initialStatus: 'trial' as 'active' | 'trial'
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setSalons(SubscriptionService.getSalons());
    setBranches(SubscriptionService.getBranches());
    setPayments(SubscriptionService.getPayments());

    try {
      const cloudSalons = await DB.fetchSalons();
      if (cloudSalons && cloudSalons.length > 0) {
        SubscriptionService.saveSalons(cloudSalons);
        setSalons(cloudSalons);
      }
      const cloudBranches = await DB.fetchBranches();
      if (cloudBranches && cloudBranches.length > 0) {
        SubscriptionService.saveBranches(cloudBranches);
        setBranches(cloudBranches);
      }
    } catch (e) {
      console.error('Failed to fetch salons from cloud:', e);
    }
  };

  // Check days remaining helper
  const getSalonExpiryInfo = (s: SalonTenant) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(s.subscriptionEndDate || today);
    end.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 3600 * 24));
    const isExpired = daysLeft < 0 || s.subscriptionStatus === 'expired' || !s.isActive;
    const isExpiringSoon = daysLeft >= 0 && daysLeft <= 5 && s.isActive && s.subscriptionStatus !== 'expired';
    const isExpiredTrial = (s.subscriptionStatus === 'trial' || (s.trialDays !== undefined && s.trialDays > 0)) && (isExpired || daysLeft <= 0);
    return { daysLeft, isExpired, isExpiringSoon, isExpiredTrial };
  };

  // Pending items computation
  const pendingSalons = salons.filter(s => s.subscriptionStatus === 'suspended' && !s.isActive);
  const pendingBranches = branches.filter(b => b.status === 'pending_activation' || (b.isActive === false && !b.status));
  const totalPendingCount = pendingSalons.length + pendingBranches.length;

  // Filtered Salons
  const filteredSalons = salons.filter(s => {
    const { isExpired, isExpiringSoon, isExpiredTrial } = getSalonExpiryInfo(s);
    
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
    if (statusFilter === 'expired') return isExpired;
    if (statusFilter === 'active') return s.subscriptionStatus === 'active' && s.isActive && !isExpired;
    if (statusFilter === 'trial') return s.subscriptionStatus === 'trial' && s.isActive && !isExpired;
    if (statusFilter === 'pending') return !s.isActive || s.subscriptionStatus === 'suspended';
    return true;
  });

  // Overall Statistics
  const stats = useMemo(() => {
    let total = salons.length;
    let active = 0;
    let trial = 0;
    let expiringSoon = 0;
    let expiredTrials = 0;
    let expired = 0;
    let totalRevenueCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    salons.forEach(s => {
      const { isExpired, isExpiringSoon, isExpiredTrial } = getSalonExpiryInfo(s);
      if (isExpiredTrial) {
        expiredTrials++;
      }
      if (isExpired) {
        expired++;
      } else if (isExpiringSoon) {
        expiringSoon++;
        if (s.subscriptionStatus === 'active') active++;
        else if (s.subscriptionStatus === 'trial') trial++;
      } else if (s.subscriptionStatus === 'active' && s.isActive) {
        active++;
      } else if (s.subscriptionStatus === 'trial' && s.isActive) {
        trial++;
      }
    });

    return { total, active, trial, expiringSoon, expiredTrials, expired, totalRevenueCollected };
  }, [salons, payments]);

  // Handle Salon Creation
  const handleCreateSalon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalonForm.salonName || !newSalonForm.email || !newSalonForm.phone) {
      alert('الرجاء ملء جميع الحقول الأساسية للصالون');
      return;
    }

    SubscriptionService.registerNewSalon({
      salonName: newSalonForm.salonName,
      salonType: newSalonForm.salonType,
      ownerName: newSalonForm.ownerName || newSalonForm.salonName,
      email: newSalonForm.email,
      phone: newSalonForm.phone,
      country: newSalonForm.country,
      password: newSalonForm.password || '123456',
      customTrialDays: Number(newSalonForm.trialDays) || 7
    });

    setShowAddModal(false);
    setNewSalonForm({
      salonName: '',
      salonType: 'men',
      ownerName: '',
      email: '',
      phone: '',
      country: 'المملكة العربية السعودية',
      password: '',
      trialDays: 7,
      plan: 'pro',
      initialStatus: 'trial'
    });
    loadAllData();
    alert('✅ تم تسجيل الصالون بنجاح وتجهيز حسابه في المنظومة!');
  };

  // Open Renewal Modal
  const handleOpenRenewModal = (salon: SalonTenant) => {
    setRenewTargetSalon(salon);
    // Estimated renewal price by currency
    const defaultPrices: Record<string, number> = {
      'SAR': 350,
      'AED': 350,
      'EGP': 2500,
      'KWD': 30,
      'OMR': 35,
      'QAR': 350,
      'BHD': 35,
      'USD': 99
    };
    const price = defaultPrices[salon.currency || 'SAR'] || 350;

    setRenewalForm({
      durationMonths: 1,
      customDays: 0,
      amountPaid: price,
      paymentMethod: 'bank_transfer',
      referenceNumber: '',
      notes: `تجديد باقة اشتراك صالون: ${salon.name}`,
      recordedBy: 'المبرمج الرئيسي'
    });
  };

  // Calculate new end date for preview
  const previewRenewalEndDate = useMemo(() => {
    if (!renewTargetSalon) return '';
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let baseDate: Date;
    if (renewTargetSalon.subscriptionEndDate && renewTargetSalon.subscriptionEndDate > todayStr && renewTargetSalon.isActive) {
      baseDate = new Date(renewTargetSalon.subscriptionEndDate);
    } else {
      baseDate = new Date();
    }

    let newEnd: Date;
    if (renewalForm.customDays > 0) {
      newEnd = new Date(baseDate.getTime() + renewalForm.customDays * 24 * 3600 * 1000);
    } else if (renewalForm.durationMonths === 1) {
      newEnd = new Date(baseDate);
      newEnd.setMonth(newEnd.getMonth() + 1);
    } else if (renewalForm.durationMonths === 3) {
      newEnd = new Date(baseDate);
      newEnd.setMonth(newEnd.getMonth() + 3);
    } else if (renewalForm.durationMonths === 6) {
      newEnd = new Date(baseDate);
      newEnd.setMonth(newEnd.getMonth() + 6);
    } else if (renewalForm.durationMonths === 12) {
      newEnd = new Date(baseDate);
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd = new Date(baseDate);
      newEnd.setMonth(newEnd.getMonth() + renewalForm.durationMonths);
    }

    return newEnd.toISOString().split('T')[0];
  }, [renewTargetSalon, renewalForm]);

  // Execute Subscription Renewal
  const handleConfirmRenewal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTargetSalon) return;

    const res = SubscriptionService.renewSubscription(renewTargetSalon.id, {
      durationMonths: renewalForm.customDays > 0 ? 0 : renewalForm.durationMonths,
      customDays: renewalForm.customDays,
      amountPaid: Number(renewalForm.amountPaid) || 0,
      paymentMethod: renewalForm.paymentMethod,
      referenceNumber: renewalForm.referenceNumber,
      notes: renewalForm.notes,
      recordedBy: renewalForm.recordedBy
    });

    if (res.success) {
      loadAllData();
      setRenewTargetSalon(null);
      alert(res.message);
      if (res.payment) {
        setSelectedReceiptPayment(res.payment);
      }
    } else {
      alert(res.message);
    }
  };

  // Handle Quick Activation for Salon or Branch
  const handleExecuteActivation = (mode: 'active' | 'trial', durationValue: number) => {
    if (!activationTarget) return;

    if (activationTarget.type === 'salon') {
      const salon = activationTarget.item as SalonTenant;
      if (mode === 'trial') {
        SubscriptionService.activateSalon(salon.id, 'trial', { days: durationValue });
        alert(`✅ تم تفعيل حساب الصالون كفترة تجريبية لمدة (${durationValue} أيام) بنجاح!`);
      } else {
        SubscriptionService.activateSalon(salon.id, 'active', { months: durationValue });
        alert(`✅ تم تفعيل وتنشيط اشتراك الصالون الرسمي لمدة (${durationValue} شهور) بنجاح!`);
      }
    } else {
      const branch = activationTarget.item as Branch;
      SubscriptionService.activateBranch(branch.id);
      alert(`✅ تم تفعيل الفرع (${branch.name}) بنجاح وأصبح متاحاً للعمل!`);
    }

    setActivationTarget(null);
    loadAllData();
  };

  const handleToggleActive = (salon: SalonTenant) => {
    const newActiveState = !salon.isActive;
    const newStatus = newActiveState ? 'active' : 'suspended';
    SubscriptionService.updateSalon(salon.id, { 
      isActive: newActiveState, 
      subscriptionStatus: newStatus as any 
    });
    loadAllData();
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalon) return;

    SubscriptionService.updateSalon(editingSalon.id, editingSalon);
    setEditingSalon(null);
    loadAllData();
    alert('✅ تم حفظ تعديلات بيانات واشتراك الصالون بنجاح!');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto bg-slate-50 font-sans" dir="rtl">
      
      {/* Header Hub */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
              <Building2 size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <span>بوابة المبرمج المركزية • إدارة الاشتراكات والتفعيل (SaaS Master Hub)</span>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">التحكم المركزي</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تفعيل الصالونات والفروع الجديدة، إدارة ومتابعة سداد الاشتراكات وتجديدها، وتنبيهات مواعيد الانتهاء
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <Plus size={16} />
            <span>+ تسجيل صالون جديد</span>
          </button>
        </div>
      </div>

      {/* Main Top Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-slate-200 pb-3">
        <button
          onClick={() => setMainTab('salons')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            mainTab === 'salons'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 size={16} />
          <span>الصالونات والاشتراكات ({salons.length})</span>
        </button>

        <button
          onClick={() => setMainTab('pending')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer relative ${
            mainTab === 'pending'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock size={16} />
          <span>طلبات التفعيل المعلقة (صالونات وفروع)</span>
          {totalPendingCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
              {totalPendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('payments')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            mainTab === 'payments'
              ? 'bg-emerald-700 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CreditCard size={16} />
          <span>سجل مدفوعات وتجديد الاشتراكات ({payments.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SALONS & SUBSCRIPTIONS */}
      {/* ========================================================================= */}
      {mainTab === 'salons' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
            <div 
              onClick={() => setStatusFilter('all')} 
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                statusFilter === 'all' ? 'ring-2 ring-slate-900 border-transparent' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500">إجمالي الصالونات</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center font-bold">
                  <Building2 size={20} />
                </div>
              </div>
            </div>

            <div 
              onClick={() => setStatusFilter('active')} 
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                statusFilter === 'active' ? 'ring-2 ring-emerald-500 border-transparent' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500">اشتراكات نشطة</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
                  <CheckCircle2 size={20} />
                </div>
              </div>
            </div>

            <div 
              onClick={() => setStatusFilter('trial')} 
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                statusFilter === 'trial' ? 'ring-2 ring-amber-500 border-transparent' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500">فترات تجريبية نشطة</p>
                  <p className="text-2xl font-black text-amber-600 mt-1">{stats.trial}</p>
                </div>
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
                  <Clock size={20} />
                </div>
              </div>
            </div>

            {/* EXPIRED TRIALS CARD (LEADS) */}
            <div 
              onClick={() => setStatusFilter('expired_trials')} 
              className={`bg-gradient-to-br from-purple-50 to-indigo-50/50 p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                statusFilter === 'expired_trials' ? 'ring-2 ring-purple-600 border-transparent' : 'border-purple-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black text-purple-900 flex items-center gap-1">
                    <span>تجريبية منتهية لم تشترك 📋</span>
                  </p>
                  <p className="text-2xl font-black text-purple-700 mt-1">{stats.expiredTrials}</p>
                </div>
                <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center font-bold shadow-xs">
                  <FileSpreadsheet size={20} />
                </div>
              </div>
            </div>

            {/* EXPIRING SOON IN 5 DAYS CARD */}
            <div 
              onClick={() => setStatusFilter('expiring_soon')} 
              className={`bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                statusFilter === 'expiring_soon' ? 'ring-2 ring-amber-500 border-transparent' : 'border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-extrabold text-amber-900 flex items-center gap-1">
                    <span>تنتهي خلال 5 أيام ⚠️</span>
                  </p>
                  <p className="text-2xl font-black text-amber-700 mt-1">{stats.expiringSoon}</p>
                </div>
                <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center font-bold shadow-xs">
                  <AlertTriangle size={20} />
                </div>
              </div>
            </div>

            {/* EXPIRED CARD */}
            <div 
              onClick={() => setStatusFilter('expired')} 
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                statusFilter === 'expired' ? 'ring-2 ring-rose-500 border-transparent' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500">منتهية أو موقوفة</p>
                  <p className="text-2xl font-black text-rose-600 mt-1">{stats.expired}</p>
                </div>
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center font-bold">
                  <ShieldAlert size={20} />
                </div>
              </div>
            </div>
          </div>

          {/* Salons Table Container */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Filters and Search Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-slate-50/50">
              <div className="flex flex-wrap gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل ({stats.total})
                </button>
                <button
                  onClick={() => setStatusFilter('expired_trials')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'expired_trials' ? 'bg-purple-700 text-white shadow-xs font-black' : 'text-purple-800 hover:text-purple-950 font-black'
                  }`}
                >
                  📋 تجريبية منتهية لم تشترك ({stats.expiredTrials})
                </button>
                <button
                  onClick={() => setStatusFilter('expiring_soon')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'expiring_soon' ? 'bg-amber-500 text-white shadow-xs font-black' : 'text-amber-800 hover:text-amber-950 font-extrabold'
                  }`}
                >
                  تنتهي خلال 5 أيام ⚠️ ({stats.expiringSoon})
                </button>
                <button
                  onClick={() => setStatusFilter('expired')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'expired' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  منتهية الصلاحية 🔴 ({stats.expired})
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نشط 🟢 ({stats.active})
                </button>
                <button
                  onClick={() => setStatusFilter('trial')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'trial' ? 'bg-white text-amber-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تجريبي ⏳ ({stats.trial})
                </button>
              </div>

              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  placeholder="بحث باسم الصالون، الإيميل، الكود..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-600"
                />
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">كود الصالون</th>
                    <th className="p-3.5">اسم الصالون والمالك</th>
                    <th className="p-3.5">التواصل والمراسلة السريعة</th>
                    <th className="p-3.5">تاريخ التسجيل والاشتراك</th>
                    <th className="p-3.5">صلاحية الحساب</th>
                    <th className="p-3.5">حالة الحساب</th>
                    <th className="p-3.5 text-center">إجراءات وتجديد الاشتراك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSalons.map(s => {
                    const subStatus = SubscriptionService.checkSubscriptionStatus(s);
                    const { isExpiringSoon, isExpiredTrial, daysLeft } = getSalonExpiryInfo(s);
                    const cleanPhone = s.phone ? s.phone.replace(/[^0-9]/g, '') : '';
                    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`مرحباً أستاذ ${s.ownerName || s.name}، نود إعلامكم بانتهاء الفترة التجريبية لمنظومة سمارت كت للصالونات، ويسعدنا تقديم باقات التجديد لتفعيل اشتراككم الرسمي.`)}`;

                    return (
                      <tr 
                        key={s.id} 
                        className={`transition-colors ${
                          isExpiredTrial ? 'bg-purple-50/40 hover:bg-purple-50/80' :
                          isExpiringSoon ? 'bg-amber-50/40 hover:bg-amber-50/80' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="p-3.5 font-mono font-bold text-emerald-700">
                          <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {s.code}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{s.name}</span>
                            {isExpiredTrial ? (
                              <span className="bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded">
                                تجريبي لم يشترك
                              </span>
                            ) : isExpiringSoon ? (
                              <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded animate-pulse">
                                ينتهي قريباً
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <span>المالك:</span>
                            <span className="font-bold text-slate-700">{s.ownerName || 'غير محدد'}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-mono text-slate-800 font-bold" dir="ltr">{s.phone}</div>
                              <div className="text-[10px] text-slate-400">{s.email}</div>
                            </div>
                            
                            {/* Quick WhatsApp & Call Icons */}
                            {cleanPhone && (
                              <div className="flex items-center gap-1 mr-2">
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-emerald-100 hover:bg-emerald-600 text-emerald-800 hover:text-white rounded-lg transition-all"
                                  title="مراسلة واتساب فورية لعرض الاشتراك"
                                >
                                  <MessageSquare size={13} />
                                </a>
                                <a
                                  href={`tel:${cleanPhone}`}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white rounded-lg transition-all"
                                  title="اتصال هاتفي مباشر"
                                >
                                  <Phone size={13} />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="text-[11px] text-slate-600 font-semibold">
                            <span>تاريخ التسجيل: </span>
                            <span className="font-mono font-bold text-slate-800">
                              {s.createdAt ? new Date(s.createdAt).toLocaleDateString('ar-SA') : s.subscriptionStartDate}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {s.country} • {s.currency}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-mono text-xs text-slate-800 font-extrabold flex items-center gap-1">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{s.subscriptionEndDate}</span>
                          </div>
                          <div className="text-[11px] mt-0.5">
                            {daysLeft > 5 ? (
                              <span className="text-emerald-700 font-bold">متبقي {daysLeft} يوم</span>
                            ) : daysLeft >= 0 ? (
                              <span className="text-amber-700 font-black bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                                ⚠️ متبقي {daysLeft} يوم فقط!
                              </span>
                            ) : (
                              <span className="text-rose-600 font-black bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                ⛔ منتهي منذ {-daysLeft} يوم
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border inline-block ${subStatus.badgeColor}`}>
                            {subStatus.badgeLabel}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* SMART RENEWAL BUTTON */}
                            <button
                              onClick={() => handleOpenRenewModal(s)}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                              title="تجديد وسداد الاشتراك (شهر / 3 شهور / 6 شهور / سنة)"
                            >
                              <RefreshCw size={13} />
                              <span>تجديد / سداد</span>
                            </button>

                            {/* Toggle Active / Suspend */}
                            <button
                              onClick={() => handleToggleActive(s)}
                              className={`p-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                s.isActive ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                              title={s.isActive ? 'إيقاف الحساب مؤقتاً (Read-Only)' : 'إلغاء الإيقاف وتفعيل الحساب'}
                            >
                              {s.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                            </button>

                            {/* Edit Details */}
                            <button
                              onClick={() => setEditingSalon(s)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
                              title="تعديل تفاصيل الصالون والاشتراك"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Switch / View as Salon */}
                            {onSwitchSalon && (
                              <button
                                onClick={() => onSwitchSalon(s)}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs transition-colors cursor-pointer"
                                title="الانتقال ومعاينة هذا الصالون"
                              >
                                <ExternalLink size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredSalons.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد صالونات مسجلة تطابق خيارات البحث والتصفية الحالية.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PENDING ACTIVATIONS (SALONS & BRANCHES) */}
      {/* ========================================================================= */}
      {mainTab === 'pending' && (
        <div className="space-y-6">
          <div className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="font-black text-sm text-indigo-950">طلبات التفعيل المعلقة للصالونات والفروع</h3>
                <p className="text-xs text-indigo-800/80 mt-0.5">
                  هنا تظهر الصالونات أو الفروع التي تم إنشاؤها وتنتظر اعتماد وتفعيل المبرمج (نشط رسمي أو تجريبي)
                </p>
              </div>
            </div>
            <span className="bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full">
              {totalPendingCount} طلب معلق
            </span>
          </div>

          {/* Pending Salons */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
            <h4 className="font-black text-sm text-slate-900 mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-indigo-600" />
              <span>صالونات جديدة بانتظار التفعيل ({pendingSalons.length})</span>
            </h4>

            {pendingSalons.length === 0 ? (
              <div className="py-6 text-center text-slate-400 font-bold text-xs">
                لا توجد صالونات معلقة حالياً ✓ جميع الصالونات مفعلة ومحدثة.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {pendingSalons.map(s => (
                  <div key={s.id} className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-black text-sm text-slate-900">{s.name}</h5>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">المالك: {s.ownerName || '-'}</p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-300">
                        معلق ⏳
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 font-semibold">
                      <p>الدولة: {s.country}</p>
                      <p>الهاتف: <span className="font-mono" dir="ltr">{s.phone}</span></p>
                      <p>البريد: {s.email}</p>
                    </div>

                    <div className="border-t border-amber-200/80 pt-3 flex gap-2">
                      <button
                        onClick={() => setActivationTarget({ type: 'salon', item: s })}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-black transition-colors shadow-xs"
                      >
                        ⚡ تفعيل الصالون الآن
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Branches */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
            <h4 className="font-black text-sm text-slate-900 mb-3 flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" />
              <span>فروع جديدة بانتظار التفعيل والاعتماد ({pendingBranches.length})</span>
            </h4>

            {pendingBranches.length === 0 ? (
              <div className="py-6 text-center text-slate-400 font-bold text-xs">
                لا توجد فروع معلقة حالياً ✓ جميع الفروع نشطة.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {pendingBranches.map(b => {
                  const parentSalon = salons.find(s => s.id === b.salonId);

                  return (
                    <div key={b.id} className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-black text-sm text-slate-900">{b.name}</h5>
                          <p className="text-xs text-indigo-700 font-bold mt-0.5">
                            تابع لـ: {parentSalon?.name || b.salonCode || 'صالون'}
                          </p>
                        </div>
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-indigo-300">
                          فرع بانتظار الاعتماد
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 font-semibold">
                        <p>الدولة والمدينة: {b.country || parentSalon?.country || '-'} • {b.city || '-'}</p>
                        <p>العملة والضريبة: {b.currency || 'SAR'} • {b.vatRate !== undefined ? `${b.vatRate}%` : '15%'}</p>
                        <p>الهاتف: <span className="font-mono" dir="ltr">{b.phone || '-'}</span></p>
                      </div>

                      <div className="border-t border-indigo-200/80 pt-3 flex gap-2">
                        <button
                          onClick={() => handleExecuteActivation('active', 1)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-black transition-colors shadow-xs"
                        >
                          🟢 اعتماد وتفعيل الفرع
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SUBSCRIPTION PAYMENTS LOG */}
      {/* ========================================================================= */}
      {mainTab === 'payments' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/60">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                <span>سجل عمليات سداد وتجديد الاشتراكات</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                سجل تاريخي كامل لجميع عمليات تحصيل رسوم الاشتراك وتجديد الصلاحية
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800">إجمالي المبالغ المحصلة:</span>
              <span className="font-mono font-black text-emerald-700 text-base">
                {stats.totalRevenueCollected.toLocaleString()} ر.س
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">رقم السند</th>
                  <th className="p-3.5">الصالون</th>
                  <th className="p-3.5">مدة التجديد</th>
                  <th className="p-3.5">فترة الصلاحية</th>
                  <th className="p-3.5">المبلغ المحصل</th>
                  <th className="p-3.5">طريقة الدفع</th>
                  <th className="p-3.5">تاريخ العملية</th>
                  <th className="p-3.5 text-center">طباعة السند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-700">{p.id}</td>
                    <td className="p-3.5 font-black text-slate-900 text-sm">{p.salonName}</td>
                    <td className="p-3.5">
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                        {p.durationLabel}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {p.periodStart} ➔ {p.periodEnd}
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-600 text-sm">
                      {p.amount} {p.currency}
                    </td>
                    <td className="p-3.5 font-bold text-slate-700">
                      {p.paymentMethod === 'bank_transfer' ? 'تحويل بنكي 🏦' :
                       p.paymentMethod === 'cash' ? 'نقدي / كاش 💵' :
                       p.paymentMethod === 'card' ? 'بطاقة / مدى 💳' :
                       p.paymentMethod === 'online' ? 'دفع إلكتروني ⚡' : 'أخرى'}
                    </td>
                    <td className="p-3.5 text-slate-500 font-mono">
                      {new Date(p.paymentDate).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => setSelectedReceiptPayment(p)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="معاينة وطباعة سند السند"
                      >
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                ))}

                {payments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                      لا توجد عمليات سداد مسجلة حتى الآن.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SMART SUBSCRIPTION RENEWAL & PAYMENT */}
      {/* ========================================================================= */}
      {renewTargetSalon && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">تجديد وتسجيل سداد اشتراك الصالون</h3>
                  <p className="text-xs text-slate-500">{renewTargetSalon.name} ({renewTargetSalon.code})</p>
                </div>
              </div>
              <button onClick={() => setRenewTargetSalon(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Current Expiration Status Box */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500 font-bold">تاريخ الانتهاء الحالي:</span>
                <p className="font-mono font-black text-slate-900 text-sm mt-0.5">{renewTargetSalon.subscriptionEndDate}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold">تاريخ الانتهاء بعد التجديد:</span>
                <p className="font-mono font-black text-emerald-600 text-sm mt-0.5">{previewRenewalEndDate}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmRenewal} className="space-y-4">
              {/* Quick Duration Buttons */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-2">اختر مدة التجديد المطلوبة *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setRenewalForm({ ...renewalForm, durationMonths: 1, customDays: 0 })}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      renewalForm.durationMonths === 1 && renewalForm.customDays === 0
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ⚡ شهر واحد
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewalForm({ ...renewalForm, durationMonths: 3, customDays: 0 })}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      renewalForm.durationMonths === 3 && renewalForm.customDays === 0
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    💎 3 شهور
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewalForm({ ...renewalForm, durationMonths: 6, customDays: 0 })}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      renewalForm.durationMonths === 6 && renewalForm.customDays === 0
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ⭐ 6 شهور
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewalForm({ ...renewalForm, durationMonths: 12, customDays: 0 })}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      renewalForm.durationMonths === 12 && renewalForm.customDays === 0
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    👑 سنة كاملة
                  </button>
                </div>
              </div>

              {/* Financial Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المحصل ({renewTargetSalon.currency || 'SAR'}) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={renewalForm.amountPaid}
                    onChange={e => setRenewalForm({ ...renewalForm, amountPaid: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black font-mono text-emerald-600 outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طريقة السداد *</label>
                  <select
                    value={renewalForm.paymentMethod}
                    onChange={e => setRenewalForm({ ...renewalForm, paymentMethod: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                  >
                    <option value="bank_transfer">تحويل بنكي 🏦</option>
                    <option value="cash">نقدي / كاش 💵</option>
                    <option value="card">شبكة / بطاقة 💳</option>
                    <option value="online">دفع إلكتروني ⚡</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الحوالة / المرجع (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: REF-99482749"
                  value={renewalForm.referenceNumber}
                  onChange={e => setRenewalForm({ ...renewalForm, referenceNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-emerald-600"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات التجديد</label>
                <input
                  type="text"
                  value={renewalForm.notes}
                  onChange={e => setRenewalForm({ ...renewalForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRenewTargetSalon(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>تأكيد التجديد وتحديث الصلاحية 🚀</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ACTIVATION CHOICE (ACTIVE VS TRIAL) */}
      {/* ========================================================================= */}
      {activationTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <span>تحديد نوع تفعيل الحساب</span>
              </h3>
              <button onClick={() => setActivationTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              يرجى اختيار هل ترغب بتفعيل الصالون كـ <strong>اشتراك رسمي مدفوع</strong> أو كـ <strong>فترة تجريبية</strong>:
            </p>

            <div className="space-y-3">
              {/* Option 1: Paid Active */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-950 font-black text-sm">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>تفعيل كاشتراك رسمي (نشط)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => handleExecuteActivation('active', 1)}
                    className="bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-800 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    1 شهر
                  </button>
                  <button
                    onClick={() => handleExecuteActivation('active', 3)}
                    className="bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-800 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    3 شهور
                  </button>
                  <button
                    onClick={() => handleExecuteActivation('active', 12)}
                    className="bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-800 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    1 سنة
                  </button>
                </div>
              </div>

              {/* Option 2: Trial */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                  <Clock size={16} className="text-amber-600" />
                  <span>تفعيل كفترة تجريبية (Trial)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => handleExecuteActivation('trial', 3)}
                    className="bg-white border border-amber-300 hover:bg-amber-600 hover:text-white text-amber-900 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    3 أيام
                  </button>
                  <button
                    onClick={() => handleExecuteActivation('trial', 7)}
                    className="bg-white border border-amber-300 hover:bg-amber-600 hover:text-white text-amber-900 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    7 أيام
                  </button>
                  <button
                    onClick={() => handleExecuteActivation('trial', 14)}
                    className="bg-white border border-amber-300 hover:bg-amber-600 hover:text-white text-amber-900 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    14 يوم
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW SALON */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Building2 size={18} />
                </div>
                <h3 className="font-black text-base text-slate-900">تسجيل صالون جديد في المنظومة</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSalon} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصالون / المنشأة *</label>
                <input
                  type="text"
                  required
                  placeholder="صالون الأناقة الملكي"
                  value={newSalonForm.salonName}
                  onChange={e => setNewSalonForm({ ...newSalonForm, salonName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                />
              </div>

              {/* Salon Type Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">نوع الصالون / النشاط *</label>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    إلزامي للاختيار ⚠️
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'men' as const, label: 'رجالي', icon: '💈' },
                    { id: 'women' as const, label: 'نسائي', icon: '💇‍♀️' },
                    { id: 'mixed' as const, label: 'مختلط', icon: '✂️' }
                  ].map(t => {
                    const isSelected = newSalonForm.salonType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewSalonForm({ ...newSalonForm, salonType: t.id })}
                        className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 font-black ring-2 ring-emerald-500/20'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                        }`}
                      >
                        <span className="text-lg leading-none">{t.icon}</span>
                        <span className="text-xs">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المالك / المدير *</label>
                  <input
                    type="text"
                    required
                    placeholder="محمد مصطفى"
                    value={newSalonForm.ownerName}
                    onChange={e => setNewSalonForm({ ...newSalonForm, ownerName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الجوال *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0500000000"
                    value={newSalonForm.phone}
                    onChange={e => setNewSalonForm({ ...newSalonForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني للصالون *</label>
                  <input
                    type="email"
                    required
                    placeholder="owner@salon.com"
                    value={newSalonForm.email}
                    onChange={e => setNewSalonForm({ ...newSalonForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الافتراضية</label>
                  <input
                    type="text"
                    placeholder="123456"
                    value={newSalonForm.password}
                    onChange={e => setNewSalonForm({ ...newSalonForm, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الدولة والمنطقة</label>
                  <select
                    value={newSalonForm.country}
                    onChange={e => setNewSalonForm({ ...newSalonForm, country: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                  >
                    {Object.keys(COUNTRY_CURRENCY_MAP).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المدة التجريبية (أيام)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={newSalonForm.trialDays}
                    onChange={e => setNewSalonForm({ ...newSalonForm, trialDays: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/30"
                >
                  حفظ وتسجيل الصالون 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT SALON */}
      {/* ========================================================================= */}
      {editingSalon && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Edit3 size={18} className="text-indigo-600" />
                <span>تعديل بيانات واشتراك: {editingSalon.name}</span>
              </h3>
              <button onClick={() => setEditingSalon(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصالون</label>
                <input
                  type="text"
                  value={editingSalon.name}
                  onChange={e => setEditingSalon({ ...editingSalon, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة الاشتراك</label>
                  <select
                    value={editingSalon.subscriptionStatus}
                    onChange={e => setEditingSalon({ ...editingSalon, subscriptionStatus: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="active">نشط (Active 🟢)</option>
                    <option value="trial">تجريبي (Trial ⏳)</option>
                    <option value="expired">منتهي (Expired ⚠️)</option>
                    <option value="suspended">موقوف (Suspended ⛔)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ انتهاء الاشتراك</label>
                  <input
                    type="date"
                    value={editingSalon.subscriptionEndDate}
                    onChange={e => setEditingSalon({ ...editingSalon, subscriptionEndDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأقصى للفروع</label>
                  <input
                    type="number"
                    value={editingSalon.maxBranches}
                    onChange={e => setEditingSalon({ ...editingSalon, maxBranches: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأقصى للمستخدمين</label>
                  <input
                    type="number"
                    value={editingSalon.maxUsers}
                    onChange={e => setEditingSalon({ ...editingSalon, maxUsers: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSalon(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md shadow-indigo-600/20"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PAYMENT RECEIPT VOUCHER */}
      {/* ========================================================================= */}
      {selectedReceiptPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                <span>سند سداد وتجديد اشتراك</span>
              </h3>
              <button onClick={() => setSelectedReceiptPayment(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-bold">رقم السند:</span>
                <span className="font-mono font-black text-slate-900">{selectedReceiptPayment.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">اسم الصالون:</span>
                <span className="font-black text-slate-900">{selectedReceiptPayment.salonName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">المبلغ المسدد:</span>
                <span className="font-mono font-black text-emerald-600 text-sm">{selectedReceiptPayment.amount} {selectedReceiptPayment.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">مدة الاشتراك المجددة:</span>
                <span className="font-bold text-indigo-700">{selectedReceiptPayment.durationLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">فترة الصلاحية:</span>
                <span className="font-mono font-bold text-slate-700">{selectedReceiptPayment.periodStart} ➔ {selectedReceiptPayment.periodEnd}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">طريقة السداد:</span>
                <span className="font-bold text-slate-800">{selectedReceiptPayment.paymentMethod}</span>
              </div>
              {selectedReceiptPayment.referenceNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">رقم المرجع:</span>
                  <span className="font-mono text-slate-700">{selectedReceiptPayment.referenceNumber}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-bold">مسجل بواسطة:</span>
                <span className="font-bold text-slate-700">{selectedReceiptPayment.recordedBy || 'المبرمج'}</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Printer size={15} />
                <span>طباعة السند</span>
              </button>
              <button
                onClick={() => setSelectedReceiptPayment(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
