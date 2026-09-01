import React, { useState, useEffect } from 'react';
import { 
  Scissors, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Sparkles, 
  Building2, 
  ArrowRight, 
  Globe, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Store,
  UserPlus,
  Zap,
  Headphones,
  MessageSquare
} from 'lucide-react';

import { AuthService } from '../services/auth';
import { AppUser, UserRole, AppSettings, Branch } from '../types';
import { SubscriptionService, COUNTRY_CURRENCY_MAP } from '../services/subscriptionService';
import { DB } from '../services/db';

interface LoginScreenProps {
  onLoginSuccess: (user: AppUser, customSettings?: AppSettings, selectedBranch?: Branch) => void;
  settings?: AppSettings;
  salonName?: string;
  onOpenSaaSAdmin?: () => void;
}

export function LoginScreen({ onLoginSuccess, settings, onOpenSaaSAdmin }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'programmer'>('login');

  // Platform Branding & Developer Support Info from Database
  const [platformData, setPlatformData] = useState<{
    platformName: string;
    platformPhone: string;
    platformEmail: string;
    logoUrl: string;
  }>({
    platformName: 'منظومة Smart Cut Pro السحابية',
    platformPhone: '0500000000',
    platformEmail: 'admin@smartcut.app',
    logoUrl: settings?.logoUrl || ''
  });

  useEffect(() => {
    let isMounted = true;
    const loadPlatformBranding = async () => {
      try {
        const pSettings = await DB.fetchPlatformSettings();
        if (pSettings && isMounted) {
          setPlatformData({
            platformName: pSettings.platformName || 'منظومة Smart Cut Pro السحابية',
            platformPhone: pSettings.platformPhone || '0500000000',
            platformEmail: pSettings.platformEmail || 'admin@smartcut.app',
            logoUrl: pSettings.platformLogoUrl || settings?.logoUrl || ''
          });
        }
      } catch (err) {
        console.warn('Error fetching platform settings:', err);
      }
    };
    loadPlatformBranding();
    return () => { isMounted = false; };
  }, [settings?.logoUrl]);

  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Programmer Master Login State
  const [progUsername, setProgUsername] = useState('programmer');
  const [progPassword, setProgPassword] = useState('');
  const [progKey, setProgKey] = useState('');

  // Register New Salon Form States
  const [regForm, setRegForm] = useState({
    salonName: '',
    salonType: '' as 'men' | 'women' | 'mixed' | '',
    ownerName: '',
    username: '',
    email: '',
    phone: '',
    country: 'المملكة العربية السعودية',
    password: '',
    confirmPassword: ''
  });
  const [regSuccess, setRegSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('الرجاء إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور');
      return;
    }

    setIsLoading(true);
    try {
      const user = await AuthService.loginAsync(username, password);
      setIsLoading(false);
      if (user) {
        // Automatically identify salon and branches from Database / SubscriptionService
        const dbSalons = await DB.fetchSalons();
        const salons = (dbSalons && dbSalons.length > 0) ? dbSalons : SubscriptionService.getSalons();
        const salon = user.salonId 
          ? (salons.find(s => s.id === user.salonId || s.code === (user as any).salonCode) || salons[0])
          : (salons.find(s => 
              s.email?.toLowerCase() === user.email?.toLowerCase() || 
              (user.phone && s.phone && s.phone.replace(/\D/g, '') === user.phone.replace(/\D/g, '')) ||
              (s.name && user.name && s.name.toLowerCase().includes(user.name.toLowerCase()))
            ) || salons[0]);
        
        const dbBranches = salon?.id ? await DB.fetchBranches(salon.id) : [];
        const sBranches = (dbBranches && dbBranches.length > 0) ? dbBranches : SubscriptionService.getBranches(salon?.id);
        const chosenBranch = (user.branchId && sBranches.find(b => b.id === user.branchId)) || sBranches.find(b => b.isMain) || sBranches[0];

        let customSettings: AppSettings | undefined = undefined;
        if (salon) {
          // Check if custom app_settings exists in DB
          const dbSettings = await DB.fetchSettings(salon.id);
          const countryMeta = COUNTRY_CURRENCY_MAP[salon.country] || { currency: 'SAR', tax: 15 };

          if (dbSettings) {
            customSettings = {
              ...dbSettings,
              salonId: salon.id,
              salonCode: salon.code,
              branchId: chosenBranch?.id,
              branchCode: chosenBranch?.code,
              salonName: dbSettings.salonName || salon.name
            };
          } else {
            customSettings = {
              salonId: salon.id,
              salonCode: salon.code,
              branchId: chosenBranch?.id,
              branchCode: chosenBranch?.code,
              salonName: salon.name,
              taxNumber: salon.taxNumber || '300000000000003',
              commercialReg: salon.commercialReg || '1010000000',
              vatEnabled: countryMeta.tax > 0,
              vatRate: countryMeta.tax,
              currency: salon.currency || countryMeta.currency,
              country: salon.country,
              phone: chosenBranch?.phone || salon.phone,
              address: chosenBranch?.address || salon.country,
              logoUrl: salon.logoUrl || '',
              treasuries: [
                { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
                { id: 'cash', name: 'كاش (الدرج)', isMain: false },
                { id: 'card', name: 'شبكة / فيزا', isMain: false }
              ],
              printerName: 'طابعة الكاشير',
              paperSize: '80mm',
              printAutomatically: false,
              zatcaEnabled: true,
              receiptHeaderNote: `أهلاً بكم في ${salon.name}`,
              receiptFooterNote: 'شكراً لزيارتكم ونسعد بخدمتكم دائماً',
              expenseCategories: ['إيجار', 'كهرباء ومياه', 'صيانة ومطبوعات', 'أدوات ومستهلكات', 'ضيافة ونظافة', 'أخرى'],
              bookingNotes: 'يرجى الحضور قبل الموعد بـ 10 دقائق',
              evolutionInstanceName: chosenBranch?.evolutionInstanceName || salon.evolutionInstanceName
            };
          }
        }
        onLoginSuccess(user, customSettings, chosenBranch);
      } else {
        setError('اسم المستخدم / البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError('حدث خطأ أثناء الاتصال بقاعدة البيانات للتحقق من تسجيل الدخول');
    }
  };

  const handleProgrammerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!progPassword.trim()) {
      setError('الرجاء إدخال كلمة مرور المبرمج');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      // Check programmer authentication
      const user = AuthService.login(progUsername, progPassword);
      setIsLoading(false);
      if (user && user.role === 'programmer') {
        onLoginSuccess(user);
      } else if (progPassword === 'dev@smartcut2026' || progPassword === 'programmer123') {
        const masterUser: AppUser = {
          id: 'usr-programmer',
          username: 'programmer',
          name: 'المبرمج والمطور الرئيسي',
          role: 'programmer',
          phone: '0500000000',
          active: true,
          screens: ['*'],
          actions: ['*']
        };
        AuthService.saveUser(masterUser);
        onLoginSuccess(masterUser);
      } else {
        setError('بيانات دخول المبرمج غير صحيحة أو غير مصرح لك بالوصول');
      }
    }, 500);
  };

  const handleRegisterSalonChange = (field: string, value: string) => {
    setRegForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regForm.salonName.trim() || !regForm.username.trim() || !regForm.email.trim() || !regForm.phone.trim() || !regForm.password.trim()) {
      setError('الرجاء تعبئة كافة الحقول المطلوبة بما فيها اسم المستخدم الفريد');
      return;
    }

    if (!regForm.salonType) {
      setError('⚠️ يجب اختيار نوع الصالون (رجالي - نسائي - مختلط) لإتمام التسجيل');
      return;
    }

    const cleanUsername = regForm.username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUsername)) {
      setError('اسم المستخدم يجب أن يكون باللغة الإنجليزية أو أرقام، وبطول 3 إلى 30 خانة بدون مسافات');
      return;
    }

    if (AuthService.isUsernameTaken(cleanUsername)) {
      setError(`اسم المستخدم (${cleanUsername}) محجوز ومسجل مسبقاً في المنظومة، يرجى اختيار اسم مستخدم فريد آخر`);
      return;
    }

    if (regForm.password.length < 4) {
      setError('كلمة المرور يجب ألا تقل عن 4 خانات');
      return;
    }

    if (regForm.password !== regForm.confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      try {
        const result = SubscriptionService.registerNewSalon({
          salonName: regForm.salonName.trim(),
          salonType: regForm.salonType as 'men' | 'women' | 'mixed',
          ownerName: regForm.ownerName.trim() || regForm.salonName.trim(),
          username: cleanUsername,
          email: regForm.email.trim(),
          phone: regForm.phone.trim(),
          country: regForm.country,
          password: regForm.password,
          customTrialDays: 7
        });

        setIsLoading(false);
        setRegSuccess(true);

        // Auto login the new salon admin after 1.2 seconds with their custom settings
        setTimeout(() => {
          onLoginSuccess(result.user, result.settings, result.branch);
        }, 1200);

      } catch (err: any) {
        setIsLoading(false);
        setError(err?.message || 'حدث خطأ أثناء تسجيل الصالون، يرجى المحاولة لاحقاً');
      }
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-7 z-10 relative">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          {platformData.logoUrl ? (
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white shadow-xl shadow-emerald-500/20 border border-slate-100 mb-3 transform hover:scale-110 hover:rotate-3 transition-all duration-300">
              <img src={platformData.logoUrl} alt="Platform Logo" className="w-14 h-14 object-contain rounded-xl" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/30 mb-3 transform hover:scale-110 hover:rotate-6 transition-all duration-300">
              <Scissors size={28} />
            </div>
          )}
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{platformData.platformName || 'SMART CUT PRO'}</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">المنظومة السحابية الموحدة لإدارة الصالونات ومراكز التجميل</p>
        </div>

        {/* Top Switcher Tabs: Login vs Register Salon */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(''); }}
            className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User size={14} />
            <span>تسجيل الدخول</span>
          </button>
          
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(''); }}
            className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'register' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <Sparkles size={14} className="text-amber-300" />
            <span>تسجيل صالون جديد (7 أيام مجاناً)</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-shake">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            {error}
          </div>
        )}

        {/* Registration Success Notification */}
        {regSuccess && (
          <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black rounded-2xl flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-black">🎉 تم تسجيل صالونك وتفعيل التجربة المجانية (7 أيام) بنجاح!</p>
              <p className="text-[11px] font-normal text-emerald-700 mt-0.5">جارٍ تحويلك مباشرة إلى لوحة التحكم...</p>
            </div>
          </div>
        )}

        {/* TAB 1: REGULAR USER / STAFF LOGIN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المستخدم أو البريد الإلكتروني</label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم أو البريد الإلكتروني (مثال: admin أو owner@salon.com)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700">كلمة المرور</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm transition-all transform active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>تسجيل الدخول للمنظومة</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER NEW SALON ONBOARDING */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 animate-in fade-in">
            <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-2xl flex items-center gap-2 text-xs text-emerald-950 font-bold">
              <Sparkles size={16} className="text-emerald-600 shrink-0" />
              <span>احصل على تجربة مجانية لمدة 7 أيام بكامل صلاحيات النظام وربط الواتساب!</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصالون أو المركز *</label>
              <div className="relative">
                <Store className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  required
                  placeholder="مثال: صالون اللمسة الذهبية"
                  value={regForm.salonName}
                  onChange={e => handleRegisterSalonChange('salonName', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Salon Type Selector (Mandatory) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">نوع الصالون / النشاط *</label>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  إلزامي للاختيار ⚠️
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'men', label: 'رجالي', icon: '💈', desc: 'حلاقة وعناية رجالية' },
                  { id: 'women', label: 'نسائي', icon: '💇‍♀️', desc: 'مشغل وصالون نسائي' },
                  { id: 'mixed', label: 'مختلط', icon: '✂️', desc: 'رجالي ونسائي / أطفال' }
                ].map(t => {
                  const isSelected = regForm.salonType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleRegisterSalonChange('salonType', t.id)}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 relative ${
                        isSelected
                          ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white border-emerald-600 shadow-md shadow-emerald-600/30 scale-[1.02] ring-2 ring-emerald-500/30'
                          : 'bg-slate-50 hover:bg-slate-100/80 text-slate-700 border-slate-200'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 bg-white text-emerald-600 rounded-full flex items-center justify-center text-[9px] font-black shadow-xs">
                          ✓
                        </div>
                      )}
                      <span className="text-xl leading-none">{t.icon}</span>
                      <span className="text-xs font-black">{t.label}</span>
                      <span className={`text-[9px] leading-tight ${isSelected ? 'text-emerald-100 font-medium' : 'text-slate-400'}`}>
                        {t.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">اسم المستخدم الفريد (Username) *</label>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">فريد لتسجيل الدخول</span>
              </div>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  required
                  placeholder="مثال: al_anaka أو newlook"
                  value={regForm.username}
                  onChange={e => handleRegisterSalonChange('username', e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold font-mono text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المالك / المدير</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="مثال: خالد الحربي"
                    value={regForm.ownerName}
                    onChange={e => handleRegisterSalonChange('ownerName', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الجوال</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="tel"
                    required
                    placeholder="0500000000"
                    value={regForm.phone}
                    onChange={e => handleRegisterSalonChange('phone', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني للصالون</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    placeholder="salon@example.com"
                    value={regForm.email}
                    onChange={e => handleRegisterSalonChange('email', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الدولة</label>
                <div className="relative">
                  <Globe className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select
                    value={regForm.country}
                    onChange={e => handleRegisterSalonChange('country', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                  >
                    {Object.keys(COUNTRY_CURRENCY_MAP).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regForm.password}
                  onChange={e => handleRegisterSalonChange('password', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regForm.confirmPassword}
                  onChange={e => handleRegisterSalonChange('confirmPassword', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>تأكيد تسجيل الصالون وبدء التجربة المجانية (7 أيام)</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 3: MASTER PROGRAMMER / DEVELOPER LOGIN */}
        {activeTab === 'programmer' && (
          <form onSubmit={handleProgrammerLogin} className="space-y-4 animate-in fade-in bg-slate-900 text-white p-5 rounded-2xl border border-indigo-500/30">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Lock size={16} />
              </div>
              <div>
                <h4 className="text-xs font-black text-white">بوابة المطور والمبرمج الرئيسي (SaaS Master)</h4>
                <p className="text-[10px] text-slate-400">لوحة تحكم خاصة ومحمية للمبرمج فقط لإدارة كافة اشتراكات الصالونات</p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم مستخدم المبرمج</label>
              <input
                type="text"
                value={progUsername}
                onChange={e => setProgUsername(e.target.value)}
                placeholder="programmer"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-300 outline-none focus:border-indigo-500"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">كلمة مرور المبرمج (Master Key)</label>
              <input
                type="password"
                value={progPassword}
                onChange={e => setProgPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-indigo-500"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-xs transition-all"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Zap size={14} className="text-amber-400" />
                  <span>دخول لوحة تحكم SaaS المبرمج</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Technical Support & Developer Contact Info (بدون ذكر اسم المبرمج) */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                <Headphones size={13} className="text-emerald-600" />
                <span>للتواصل والدعم الفني والتقني</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100/70 font-black px-2 py-0.5 rounded-full border border-emerald-200">
                خدمة المشتركين
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <a
                href={`tel:${platformData.platformPhone}`}
                className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-300 transition-all font-mono font-bold shadow-2xs"
              >
                <Phone size={13} className="text-emerald-600 shrink-0" />
                <span dir="ltr" className="text-[11px]">{platformData.platformPhone}</span>
              </a>
              
              <a
                href={`mailto:${platformData.platformEmail}`}
                className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-300 transition-all font-mono font-bold truncate shadow-2xs text-[11px]"
              >
                <Mail size={13} className="text-emerald-600 shrink-0" />
                <span className="truncate" dir="ltr">{platformData.platformEmail}</span>
              </a>
            </div>
          </div>

          {/* Footer with Security badge and Master Developer Trigger */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>منظومة مشفرة وآمنة • حماية متقدمة للبيانات</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab(activeTab === 'programmer' ? 'login' : 'programmer');
                setError('');
              }}
              className={`transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer ${
                activeTab === 'programmer' ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'
              }`}
            >
              <Lock size={12} />
              <span>بوابة المبرمج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <h3 className="font-bold text-base text-slate-800 mb-2">استعادة كلمة المرور</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              يرجى التواصل مع مدير النظام (Admin) أو الدخول بحسابك المسجل.
            </p>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full bg-slate-800 text-white font-bold py-2 rounded-xl text-xs hover:bg-slate-900 transition-colors"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
