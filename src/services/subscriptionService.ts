import { SalonTenant, AppUser, Branch, AppSettings, SubscriptionPaymentRecord } from '../types';
import { AuthService } from './auth';
import { DB } from './db';

const STORAGE_KEYS = {
  SALONS: 'smartcut_saas_salons',
  BRANCHES: 'smartcut_saas_branches',
  PAYMENTS: 'smartcut_saas_payments',
  CURRENT_SALON: 'smartcut_current_salon',
  SETTINGS: 'smartcut_app_settings',
  TRIAL_DAYS_DEFAULT: 'smartcut_default_trial_days'
};

export const DEFAULT_INITIAL_BRANCHES: Branch[] = [];


export const COUNTRY_CURRENCY_MAP: Record<string, { currency: string; tax: number; phoneCode: string; nameEn?: string }> = {
  'المملكة العربية السعودية': { currency: 'SAR', tax: 15, phoneCode: '+966', nameEn: 'Saudi Arabia' },
  'جمهورية مصر العربية': { currency: 'EGP', tax: 14, phoneCode: '+20', nameEn: 'Egypt' },
  'الإمارات العربية المتحدة': { currency: 'AED', tax: 5, phoneCode: '+971', nameEn: 'United Arab Emirates' },
  'دولة الكويت': { currency: 'KWD', tax: 0, phoneCode: '+965', nameEn: 'Kuwait' },
  'سلطنة عمان': { currency: 'OMR', tax: 5, phoneCode: '+968', nameEn: 'Oman' },
  'دولة قطر': { currency: 'QAR', tax: 0, phoneCode: '+974', nameEn: 'Qatar' },
  'مملكة البحرين': { currency: 'BHD', tax: 10, phoneCode: '+973', nameEn: 'Bahrain' },
  'المملكة الأردنية الهاشمية': { currency: 'JOD', tax: 16, phoneCode: '+962', nameEn: 'Jordan' },
  'الجمهورية العراقية': { currency: 'IQD', tax: 0, phoneCode: '+964', nameEn: 'Iraq' },
  'الجمهورية العربية السورية': { currency: 'SYP', tax: 0, phoneCode: '+963', nameEn: 'Syria' },
  'الجمهورية اللبنانية': { currency: 'LBP', tax: 11, phoneCode: '+961', nameEn: 'Lebanon' },
  'دولة فلسطين': { currency: 'ILS', tax: 16, phoneCode: '+970', nameEn: 'Palestine' },
  'الجمهورية اليمنية': { currency: 'YER', tax: 5, phoneCode: '+967', nameEn: 'Yemen' },
  'دولة ليبيا': { currency: 'LYD', tax: 0, phoneCode: '+218', nameEn: 'Libya' },
  'الجمهورية التونسية': { currency: 'TND', tax: 19, phoneCode: '+216', nameEn: 'Tunisia' },
  'الجمهورية الجزائرية الديمقراطية الشعبية': { currency: 'DZD', tax: 19, phoneCode: '+213', nameEn: 'Algeria' },
  'المملكة المغربية': { currency: 'MAD', tax: 20, phoneCode: '+212', nameEn: 'Morocco' },
  'جمهورية السودان': { currency: 'SDG', tax: 17, phoneCode: '+249', nameEn: 'Sudan' },
  'الجمهورية الإسلامية الموريتانية': { currency: 'MRU', tax: 16, phoneCode: '+222', nameEn: 'Mauritania' },
  'جمهورية الصومال الفيدرالية': { currency: 'SOS', tax: 0, phoneCode: '+252', nameEn: 'Somalia' },
  'جمهورية جيبوتي': { currency: 'DJF', tax: 10, phoneCode: '+253', nameEn: 'Djibouti' },
  'جمهورية جزر القمر الاتحادية': { currency: 'KMF', tax: 10, phoneCode: '+269', nameEn: 'Comoros' },
  'أخرى (دولار أمريكي)': { currency: 'USD', tax: 0, phoneCode: '+1', nameEn: 'Other' }
};

export function getCountryMeta(countryName: string) {
  if (!countryName) return COUNTRY_CURRENCY_MAP['المملكة العربية السعودية'];
  if (COUNTRY_CURRENCY_MAP[countryName]) return COUNTRY_CURRENCY_MAP[countryName];
  
  // Fuzzy match for common short names
  const normalized = countryName.replace(/^(المملكة|جمهورية|دولة|سلطنة|مملكة|الجمهورية)\s+/, '').trim();
  for (const [key, val] of Object.entries(COUNTRY_CURRENCY_MAP)) {
    if (key.includes(normalized) || key.includes(countryName) || countryName.includes(key)) {
      return val;
    }
  }
  return { currency: 'SAR', tax: 15, phoneCode: '+966', nameEn: 'Saudi Arabia' };
}

/**
 * Generates a random, secure, non-guessable, human-friendly business code for salons (e.g. SC-7X9K2)
 */
export function generateSecureSalonCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'SC-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generates a standard branch code (e.g. BR-01, BR-02)
 */
export function generateSecureBranchCode(index: number = 1): string {
  return `BR-${index < 10 ? '0' + index : index}`;
}

/**
 * Generates a standard UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const DEFAULT_INITIAL_SALONS: SalonTenant[] = [];

export const SubscriptionService = {
  /**
   * Get all registered salons
   */
  getSalons(): SalonTenant[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SALONS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load salons from storage:', e);
    }
    return [];
  },

  /**
   * Save salons list to storage
   */
  saveSalons(salons: SalonTenant[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SALONS, JSON.stringify(salons));
    } catch (e) {
      console.error('Failed to save salons:', e);
    }
  },

  /**
   * Register a new salon with automated 7-day trial and setup
   */
  registerNewSalon(data: {
    salonName: string;
    ownerName: string;
    username?: string;
    email: string;
    phone: string;
    country: string;
    salonType?: 'men' | 'women' | 'mixed';
    password?: string;
    customTrialDays?: number;
  }): { salon: SalonTenant; user: AppUser; branch: Branch; settings: AppSettings } {
    const salons = this.getSalons();
    const trialDays = data.customTrialDays || 7;
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDate = new Date(now.getTime() + trialDays * 24 * 3600 * 1000).toISOString().split('T')[0];
    
    const countryMeta = COUNTRY_CURRENCY_MAP[data.country] || { currency: 'SAR', tax: 15 };
    
    // توليد كود صالون عشوائي غير تسلسلي وغير قابل للتخمين (مثال: SC-9K4M2)
    let salonCode = generateSecureSalonCode();
    while (salons.some(s => s.code === salonCode)) {
      salonCode = generateSecureSalonCode();
    }
    
    const salonId = generateUUID();
    const branchId = generateUUID();

    const newSalon: SalonTenant = {
      id: salonId,
      code: salonCode,
      name: data.salonName,
      salonType: data.salonType || 'men',
      ownerName: data.ownerName,
      email: data.email,
      phone: data.phone,
      country: data.country,
      currency: countryMeta.currency,
      isActive: true,
      subscriptionStatus: 'trial',
      subscriptionPlan: 'pro',
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      trialDays: trialDays,
      maxBranches: 3,
      maxUsers: 10,
      evolutionInstanceName: `${salonCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}_main`,
      createdAt: now.toISOString()
    };

    const newBranch: Branch = {
      id: branchId,
      salonId: salonId,
      salonCode: salonCode,
      code: 'BR-MAIN',
      name: 'الفرع الرئيسي',
      phone: data.phone,
      isMain: true,
      isActive: true,
      evolutionInstanceName: `${salonCode.toLowerCase()}_main`
    };

    const chosenUsername = data.username?.trim().toLowerCase() || data.email.split('@')[0] || 'admin';

    const newAdminUser: AppUser = {
      id: 'usr-' + Math.random().toString(36).substring(2, 9),
      salonId: salonId,
      salonCode: salonCode,
      branchId: branchId,
      branchCode: 'BR-MAIN',
      username: chosenUsername,
      email: data.email,
      password: data.password || '123456',
      name: data.ownerName || data.salonName,
      role: 'admin',
      phone: data.phone,
      active: true,
      screens: ['*'],
      actions: ['*']
    };

    const initialSettings: AppSettings = {
      salonId: salonId,
      salonCode: salonCode,
      branchId: branchId,
      branchCode: 'BR-MAIN',
      isSalonActive: true,
      subscriptionStatus: 'trial',
      subscriptionEndDate: endDate,
      ownerEmail: data.email,
      salonName: data.salonName,
      salonType: data.salonType || 'men',
      taxNumber: '300000000000003',
      commercialReg: '1010000000',
      vatEnabled: countryMeta.tax > 0,
      vatRate: countryMeta.tax,
      currency: countryMeta.currency,
      country: data.country,
      phone: data.phone,
      address: data.country,
      logoUrl: '',
      treasuries: [
        { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
        { id: 'cash', name: 'كاش (الدرج)', isMain: false },
        { id: 'card', name: 'شبكة / فيزا', isMain: false }
      ],
      printerName: 'طابعة الكاشير',
      paperSize: '80mm',
      printAutomatically: false,
      zatcaEnabled: true,
      receiptHeaderNote: `أهلاً بكم في ${data.salonName}`,
      receiptFooterNote: 'شكراً لزيارتكم ونسعد بخدمتكم دائماً',
      expenseCategories: ['إيجار', 'كهرباء ومياه', 'صيانة ومطبوعات', 'أدوات ومستهلكات', 'ضيافة ونظافة', 'أخرى'],
      bookingNotes: 'يرجى الحضور قبل الموعد بـ 10 دقائق',
      evolutionInstanceName: `${salonCode.toLowerCase()}_main`
    };

    // 1. Save user to AuthService so they can authenticate
    AuthService.saveUser(newAdminUser);

    // 2. Save active salon settings to localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
      localStorage.setItem(STORAGE_KEYS.CURRENT_SALON, JSON.stringify(newSalon));
      localStorage.setItem(`smartcut_settings_${salonId}`, JSON.stringify(initialSettings));
    } catch (e) {
      console.error('Failed to save initial settings to localStorage:', e);
    }

    this.saveSalons([...salons, newSalon]);
    const allBranches = this.getBranches();
    this.saveBranches([...allBranches, newBranch]);

    // 3. Save directly and instantly to Supabase Cloud Database
    DB.saveSalon(newSalon);
    DB.saveBranch(newBranch);
    DB.saveSettings(salonId, initialSettings);
    DB.saveUser(newAdminUser);

    return { salon: newSalon, user: newAdminUser, branch: newBranch, settings: initialSettings };
  },

  /**
   * Get all branches (optionally filtered by salonId)
   */
  getBranches(salonId?: string): Branch[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BRANCHES);
      let branches: Branch[] = stored ? JSON.parse(stored) : [...DEFAULT_INITIAL_BRANCHES];
      if (!stored) {
        this.saveBranches(DEFAULT_INITIAL_BRANCHES);
      }
      if (salonId) {
        const salonBranches = branches.filter(b => b.salonId === salonId);
        if (salonBranches.length > 0) {
          return salonBranches;
        }
        // Auto-create official main branch with code BR-01 for this salon if none exists
        const salons = this.getSalons();
        const salon = salons.find(s => s.id === salonId);
        if (salon) {
          const autoMainBranch: Branch = {
            id: generateUUID(),
            salonId: salon.id,
            salonCode: salon.code,
            code: 'BR-01',
            name: `الفرع الرئيسي (${salon.name})`,
            phone: salon.phone,
            country: salon.country,
            currency: salon.currency,
            isMain: true,
            isActive: true,
            status: 'active',
            createdAt: new Date().toISOString()
          };
          branches.push(autoMainBranch);
          this.saveBranches(branches);
          DB.saveBranch(autoMainBranch);
          return [autoMainBranch];
        }
      }
      return branches;
    } catch (e) {
      console.error('Failed to load branches:', e);
      return DEFAULT_INITIAL_BRANCHES;
    }
  },


  /**
   * Save branches list
   */
  saveBranches(branches: Branch[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BRANCHES, JSON.stringify(branches));
    } catch (e) {
      console.error('Failed to save branches:', e);
    }
  },

  /**
   * Request / add a new branch for a salon
   */
  addBranch(salonId: string, data: { 
    name: string; 
    country?: string;
    currency?: string;
    vatRate?: number;
    vatEnabled?: boolean;
    taxNumber?: string;
    city?: string; 
    phone?: string; 
    address?: string 
  }): { success: boolean; branch?: Branch; message: string } {
    const salons = this.getSalons();
    const salon = salons.find(s => s.id === salonId);
    if (!salon) return { success: false, message: 'تعذر العثور على الصالون المحدد' };

    const branches = this.getBranches();
    const salonBranches = branches.filter(b => b.salonId === salonId);
    
    // Check maxBranches limit
    if (salon.maxBranches && salonBranches.length >= salon.maxBranches) {
      return {
        success: false,
        message: `تم الوصول إلى الحد الأقصى للفروع المسموحة لباقة هذا الصالون (${salon.maxBranches} فروع). يرجى التواصل مع إدارة النظام لترقية الباقة.`
      };
    }

    const branchCountry = data.country || salon.country || 'المملكة العربية السعودية';
    const countryMeta = getCountryMeta(branchCountry);
    const branchCurrency = data.currency || countryMeta.currency;
    const branchVatRate = data.vatRate !== undefined ? data.vatRate : countryMeta.tax;
    const branchVatEnabled = data.vatEnabled !== undefined ? data.vatEnabled : (branchVatRate > 0);

    const branchCode = generateSecureBranchCode(salonBranches.length + 1);
    const branchId = generateUUID();

    const newBranch: Branch = {
      id: branchId,
      salonId: salon.id,
      salonCode: salon.code,
      code: branchCode,
      name: data.name,
      country: branchCountry,
      currency: branchCurrency,
      vatRate: branchVatRate,
      vatEnabled: branchVatEnabled,
      taxNumber: data.taxNumber || '',
      city: data.city || branchCountry,
      phone: data.phone || salon.phone,
      address: data.address || '',
      isMain: salonBranches.length === 0,
      isActive: false, // Inactive until approved by programmer
      status: 'pending_activation',
      createdAt: new Date().toISOString(),
      evolutionInstanceName: `${salon.code.toLowerCase()}_${branchCode.toLowerCase()}`
    };

    branches.push(newBranch);
    this.saveBranches(branches);
    DB.saveBranch(newBranch);

    return {
      success: true,
      branch: newBranch,
      message: 'تم تسجيل طلب الفرع بنجاح وهو الآن بانتظار التفعيل والاعتماد من قبل المبرمج وإدارة المنظومة ⏳'
    };
  },

  /**
   * Update branch status (Active / Pending / Suspended)
   */
  setBranchStatus(branchId: string, status: 'active' | 'pending_activation' | 'suspended'): Branch | null {
    const branches = this.getBranches();
    const idx = branches.findIndex(b => b.id === branchId);
    if (idx === -1) return null;

    branches[idx] = {
      ...branches[idx],
      status: status,
      isActive: status === 'active'
    };

    this.saveBranches(branches);
    return branches[idx];
  },

  /**
   * Get settings specific to an individual branch
   */
  getBranchSettings(branchId: string, fallbackSettings?: AppSettings): AppSettings {
    try {
      const stored = localStorage.getItem(`smartcut_branch_settings_${branchId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}

    const branches = this.getBranches();
    const branch = branches.find(b => b.id === branchId);
    const salons = this.getSalons();
    const salon = salons.find(s => s.id === branch?.salonId) || (fallbackSettings?.salonId ? salons.find(s => s.id === fallbackSettings.salonId) : null);
    
    const countryName = branch?.country || salon?.country || fallbackSettings?.country || 'المملكة العربية السعودية';
    const meta = getCountryMeta(countryName);
    const actualSalonName = salon?.name || fallbackSettings?.salonName || 'صالون سمارت كت';

    const base: AppSettings = fallbackSettings || {
      salonId: salon?.id,
      salonCode: salon?.code,
      salonName: actualSalonName,
      taxNumber: branch?.taxNumber || '300000000000003',
      commercialReg: '1010000000',
      vatEnabled: branch?.vatEnabled !== undefined ? branch.vatEnabled : (meta.tax > 0),
      vatRate: branch?.vatRate !== undefined ? branch.vatRate : meta.tax,
      currency: branch?.currency || meta.currency,
      country: countryName,
      phone: branch?.phone || '0500000000',
      address: branch?.address || countryName,
      logoUrl: '',
      printerName: 'طابعة الكاشير',
      paperSize: '80mm',
      printAutomatically: false,
      zatcaEnabled: meta.currency === 'SAR',
      receiptHeaderNote: `أهلاً بكم في ${actualSalonName}`,
      receiptFooterNote: 'شكراً لزيارتكم ونسعد بخدمتكم دائماً',
      expenseCategories: ['إيجار', 'كهرباء ومياه', 'صيانة ومطبوعات', 'أدوات ومستهلكات', 'ضيافة ونظافة', 'أخرى'],
      bookingNotes: '',
      treasuries: [
        { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
        { id: 'cash', name: 'كاش (الدرج)', isMain: false },
        { id: 'card', name: 'شبكة / فيزا', isMain: false }
      ]
    };

    const branchSettings: AppSettings = {
      ...base,
      salonId: salon?.id || base.salonId,
      salonCode: salon?.code || base.salonCode,
      branchId: branch?.id || branchId,
      branchCode: branch?.code,
      salonName: actualSalonName,
      country: countryName,
      currency: branch?.currency || meta.currency,
      vatRate: branch?.vatRate !== undefined ? branch.vatRate : meta.tax,
      vatEnabled: branch?.vatEnabled !== undefined ? branch.vatEnabled : (meta.tax > 0),
      taxNumber: branch?.taxNumber || base.taxNumber,
      phone: branch?.phone || base.phone,
      address: branch?.address || base.address,
      receiptHeaderNote: `أهلاً بكم في ${actualSalonName}`
    };

    try {
      localStorage.setItem(`smartcut_branch_settings_${branchId}`, JSON.stringify(branchSettings));
    } catch (e) {}

    return branchSettings;
  },

  /**
   * Save settings for an individual branch
   */
  saveBranchSettings(branchId: string, settings: AppSettings): void {
    try {
      localStorage.setItem(`smartcut_branch_settings_${branchId}`, JSON.stringify(settings));
      
      const branches = this.getBranches();
      const branch = branches.find(b => b.id === branchId);
      if (branch?.isMain) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      }
      
      // Keep branch metadata strictly synced
      if (branch) {
        branch.name = settings.salonName || branch.name;
        branch.country = settings.country || branch.country;
        branch.currency = settings.currency || branch.currency;
        branch.vatRate = settings.vatRate !== undefined ? settings.vatRate : branch.vatRate;
        branch.vatEnabled = settings.vatEnabled !== undefined ? settings.vatEnabled : branch.vatEnabled;
        branch.taxNumber = settings.taxNumber || branch.taxNumber;
        branch.phone = settings.phone || branch.phone;
        branch.address = settings.address || branch.address;
        this.saveBranches(branches);
      }
    } catch (e) {
      console.error('Failed to save branch settings:', e);
    }
  },

  /**
   * Delete branch
   */
  deleteBranch(branchId: string): boolean {
    const branches = this.getBranches();
    const filtered = branches.filter(b => b.id !== branchId);
    this.saveBranches(filtered);
    return true;
  },

  /**
   * Update a salon's status, subscription dates, or active flag
   */
  updateSalon(salonId: string, updates: Partial<SalonTenant>): SalonTenant | null {
    const salons = this.getSalons();
    const idx = salons.findIndex(s => s.id === salonId);
    if (idx === -1) return null;

    salons[idx] = { ...salons[idx], ...updates };
    this.saveSalons(salons);
    return salons[idx];
  },

  /**
   * Extend subscription or trial by specific number of days
   */
  extendDays(salonId: string, additionalDays: number): SalonTenant | null {
    const salons = this.getSalons();
    const salon = salons.find(s => s.id === salonId);
    if (!salon) return null;

    const currentEnd = new Date(salon.subscriptionEndDate || Date.now());
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(baseDate.getTime() + additionalDays * 24 * 3600 * 1000);

    return this.updateSalon(salonId, {
      subscriptionEndDate: newEnd.toISOString().split('T')[0],
      subscriptionStatus: 'active',
      isActive: true
    });
  },

  /**
   * Get subscription payment records
   */
  getPayments(salonId?: string): SubscriptionPaymentRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      const list: SubscriptionPaymentRecord[] = stored ? JSON.parse(stored) : [];
      if (salonId) {
        return list.filter(p => p.salonId === salonId);
      }
      return list.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    } catch (e) {
      return [];
    }
  },

  /**
   * Save subscription payment records
   */
  savePayments(payments: SubscriptionPaymentRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
    } catch (e) {
      console.error('Failed to save payments:', e);
    }
  },

  /**
   * Renew salon subscription for a duration (1 month, 3 months, 6 months, 12 months, or custom days)
   * If current subscription is still active: extends from current end date.
   * If already expired: extends from today.
   */
  renewSubscription(salonId: string, options: {
    durationMonths: number;
    customDays?: number;
    amountPaid: number;
    paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'online' | 'other';
    referenceNumber?: string;
    notes?: string;
    recordedBy?: string;
  }): { success: boolean; salon?: SalonTenant; payment?: SubscriptionPaymentRecord; message: string } {
    const salons = this.getSalons();
    const salon = salons.find(s => s.id === salonId);
    if (!salon) return { success: false, message: 'تعذر العثور على الصالون' };

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Determine base start date
    let baseDate: Date;
    if (salon.subscriptionEndDate && salon.subscriptionEndDate > todayStr && salon.isActive && salon.subscriptionStatus === 'active') {
      // Still active: extend from current end date
      baseDate = new Date(salon.subscriptionEndDate);
    } else {
      // Expired or new: start from today
      baseDate = new Date();
    }

    const startDateStr = baseDate.toISOString().split('T')[0];
    let newEndDate: Date;
    let durationLabel = '';

    if (options.customDays && options.customDays > 0) {
      newEndDate = new Date(baseDate.getTime() + options.customDays * 24 * 3600 * 1000);
      durationLabel = `${options.customDays} يوم`;
    } else if (options.durationMonths === 1) {
      newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);
      durationLabel = 'شهر واحد (30 يوم)';
    } else if (options.durationMonths === 3) {
      newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + 3);
      durationLabel = '3 شهور (ربع سنوي)';
    } else if (options.durationMonths === 6) {
      newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + 6);
      durationLabel = '6 شهور (نصف سنوي)';
    } else if (options.durationMonths === 12) {
      newEndDate = new Date(baseDate);
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      durationLabel = 'سنة كاملة (سنوي)';
    } else {
      newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + (options.durationMonths || 1));
      durationLabel = `${options.durationMonths} شهور`;
    }

    const endDateStr = newEndDate.toISOString().split('T')[0];

    // Update salon
    const updatedSalon = this.updateSalon(salonId, {
      subscriptionEndDate: endDateStr,
      subscriptionStatus: 'active',
      isActive: true
    });

    // Record payment
    const paymentRecord: SubscriptionPaymentRecord = {
      id: 'PAY-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      salonId: salon.id,
      salonCode: salon.code,
      salonName: salon.name,
      amount: options.amountPaid,
      currency: salon.currency || 'SAR',
      durationMonths: options.durationMonths,
      durationLabel,
      paymentDate: new Date().toISOString(),
      periodStart: startDateStr,
      periodEnd: endDateStr,
      paymentMethod: options.paymentMethod,
      referenceNumber: options.referenceNumber || '',
      notes: options.notes || '',
      recordedBy: options.recordedBy || 'المبرمج الرئيسي',
      createdAt: new Date().toISOString()
    };

    const allPayments = this.getPayments();
    this.savePayments([paymentRecord, ...allPayments]);

    return {
      success: true,
      salon: updatedSalon || undefined,
      payment: paymentRecord,
      message: `تم تجديد وتفعيل الاشتراك بنجاح حتى تاريخ ${endDateStr} (${durationLabel}) 🚀`
    };
  },

  /**
   * Activate a salon with choice of 'active' (paid) or 'trial' (test period)
   */
  activateSalon(salonId: string, mode: 'active' | 'trial', options?: { days?: number; months?: number }): SalonTenant | null {
    const salons = this.getSalons();
    const salon = salons.find(s => s.id === salonId);
    if (!salon) return null;

    const today = new Date();
    let newEnd: Date;
    
    if (mode === 'trial') {
      const trialDays = options?.days || 7;
      newEnd = new Date(today.getTime() + trialDays * 24 * 3600 * 1000);
      return this.updateSalon(salonId, {
        subscriptionStatus: 'trial',
        isActive: true,
        trialDays: trialDays,
        subscriptionEndDate: newEnd.toISOString().split('T')[0]
      });
    } else {
      const months = options?.months || 1;
      newEnd = new Date(today);
      newEnd.setMonth(newEnd.getMonth() + months);
      return this.updateSalon(salonId, {
        subscriptionStatus: 'active',
        isActive: true,
        subscriptionEndDate: newEnd.toISOString().split('T')[0]
      });
    }
  },

  /**
   * Activate a branch
   */
  activateBranch(branchId: string): Branch | null {
    const branches = this.getBranches();
    const idx = branches.findIndex(b => b.id === branchId);
    if (idx === -1) return null;

    branches[idx] = {
      ...branches[idx],
      status: 'active',
      isActive: true
    };
    this.saveBranches(branches);
    return branches[idx];
  },

  /**
   * Evaluates if a salon subscription is expired
   */
  checkSubscriptionStatus(salon: SalonTenant): {
    isActive: boolean;
    isExpired: boolean;
    daysRemaining: number;
    badgeLabel: string;
    badgeColor: string;
  } {
    if (!salon.isActive || salon.subscriptionStatus === 'suspended') {
      return {
        isActive: false,
        isExpired: false,
        daysRemaining: 0,
        badgeLabel: 'حساب موقوف ⛔',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300'
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const isExpired = salon.subscriptionEndDate < today;
    const endMs = new Date(salon.subscriptionEndDate).getTime();
    const nowMs = new Date().getTime();
    const daysRemaining = Math.ceil((endMs - nowMs) / (1000 * 3600 * 24));

    if (isExpired || salon.subscriptionStatus === 'expired') {
      return {
        isActive: false,
        isExpired: true,
        daysRemaining: 0,
        badgeLabel: 'منتهي الصلاحية ⚠️',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300'
      };
    }

    if (salon.subscriptionStatus === 'trial') {
      return {
        isActive: true,
        isExpired: false,
        daysRemaining: Math.max(0, daysRemaining),
        badgeLabel: `تجريبي (${daysRemaining} يوم متبقي) ⏳`,
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300'
      };
    }

    return {
      isActive: true,
      isExpired: false,
      daysRemaining: Math.max(0, daysRemaining),
      badgeLabel: 'اشتراك نشط 🟢',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    };
  }
};
