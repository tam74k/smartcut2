export type UserRole = 'programmer' | 'owner' | 'admin' | 'supervisor' | 'cashier' | 'receptionist' | 'barber' | 'accountant' | 'warehouse_manager' | 'custom';

export type ActionPermission = 
  // POS & Sales
  | 'pos_discount' 
  | 'pos_custom_price'
  | 'pos_void' 
  | 'pos_reprint'
  | 'sales_return' 
  // Shifts & Treasuries
  | 'manage_shifts' 
  | 'edit_shift_cash'
  | 'treasury_deposit'
  | 'treasury_withdraw'
  | 'treasury_transfer'
  | 'treasury_view_balance'
  // Warehouse, Expenses, Purchases & Inventory
  | 'manage_products'
  | 'import_products_excel'
  | 'print_barcodes'
  | 'manage_expenses' 
  | 'manage_suppliers' 
  | 'manage_purchases'
  | 'manage_inventory' 
  // Staff, HR, Custodies & Clients
  | 'manage_employees' 
  | 'manage_salaries'
  | 'manage_hr'
  | 'manage_custodies'
  | 'manage_clients'
  | 'view_client_financials'
  // Bookings, Partners, Promo Codes & Tips
  | 'manage_booking_settings'
  | 'manage_partners'
  | 'manage_promo_codes'
  | 'manage_tips'
  | 'view_fingerprint_logs'
  // Reports, Invoices & System Management
  | 'view_reports' 
  | 'manage_invoices_delete'
  | 'view_system_analytics'
  | 'view_employee_analytics'
  | 'export_excel'
  | 'manage_settings'
  | 'manage_rbac'
  | '*';

export interface BlockedDateEntry {
  id: string;
  date: string; // YYYY-MM-DD
  reason?: string;
}

export interface BlockedHourEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // Slot time, e.g. "10:00 ص" or "14:00"
  reason?: string;
}

export interface StaffUnavailabilityEntry {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string; // YYYY-MM-DD
  reason?: string;
}

export interface BookingRulesSettings {
  maxBookingsPerHour?: number; // سعة الحجوزات للموظف الواحد في الساعة (1 أو 2)
  slotIntervalMinutes?: 30 | 60; // تقسيم الساعات: كل 30 دقيقة أو كل 60 دقيقة
  openingTime?: string; // وقت فتح الصالون (مثال: "09:00" أو "10:00")
  closingTime?: string; // موعد إغلاق الصالون (مثال: "23:00" أو "00:00")
  blockedDates?: BlockedDateEntry[];
  blockedHours?: BlockedHourEntry[];
  staffUnavailabilities?: StaffUnavailabilityEntry[];
}

export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  screens: string[];
  actions: ActionPermission[];
  createdAt: string;
  isSystem?: boolean;
}

export interface AppUser {
  id: string;
  salonId?: string;
  salonCode?: string;
  branchId?: string;
  branchCode?: string;
  username: string;
  email?: string;
  password?: string;
  name: string;
  role: UserRole;
  customRoleId?: string;
  employeeId?: string;
  phone?: string;
  active: boolean;
  screens: string[];
  actions: ActionPermission[];
  avatar?: string;
}

export type SalonType = 'men' | 'women' | 'mixed';

export interface SalonTenant {
  id: string;
  code: string;
  name: string;
  salonType?: SalonType;
  ownerName?: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  isActive: boolean;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled';
  subscriptionPlan: 'starter' | 'pro' | 'enterprise';
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  trialDays?: number;
  maxBranches: number;
  maxUsers: number;
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstanceName?: string;
  createdAt: string;
}

export interface SaaSSubscription {
  id: string;
  salonId?: string;
  salonCode?: string;
  organizationName: string;
  salonType?: SalonType;
  ownerEmail?: string;
  phone?: string;
  country?: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled';
  isActive: boolean;
  startDate: string;
  endDate: string;
  maxBranches: number;
  maxUsers: number;
  currentBranchesCount?: number;
  trialDays?: number;
}

export interface SubscriptionPaymentRecord {
  id: string;
  salonId: string;
  salonCode?: string;
  salonName: string;
  amount: number;
  currency: string;
  durationMonths: number;
  durationLabel: string;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'online' | 'other';
  referenceNumber?: string;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  salonId?: string;
  salonCode?: string;
  name: string;
  code: string;
  country?: string;
  currency?: string;
  vatRate?: number;
  vatEnabled?: boolean;
  taxNumber?: string;
  address?: string;
  isMain: boolean;
  isActive?: boolean;
  status?: 'active' | 'pending_activation' | 'suspended';
  tipPayoutMethod?: 'instant_cash' | 'pooled_deferred';
  createdAt?: string;
  evolutionInstanceName?: string;
}



export interface Category { 
  id: string; 
  salonId?: string;
  branchId?: string;
  name: string; 
  icon?: string; 
  type?: 'service' | 'product'; 
}

export interface ServiceItem { 
  id: string; 
  salonId?: string;
  branchId?: string;
  categoryId: string; 
  name: string; 
  price: number; 
  discountPrice?: number;
  employeeCommissionPercentage?: number;
  employeeCommissionAmount?: number;
  referralCommissionType?: 'fixed' | 'percentage'; // نوع عمولة فتح الشغل / إحالة الموظف
  referralCommissionAmount?: number; // قيمة أو نسبة عمولة فتح الشغل للموظف
  clientReferralCashbackType?: 'fixed' | 'percentage'; // نوع كاش باك إحالة العميل
  clientReferralCashbackAmount?: number; // قيمة أو نسبة كاش باك إحالة العميل (تمنح للمرشِح على أول فاتورة فقط)
  cashbackPercentage?: number;
  durationMinutes?: number;
  isActive: boolean;
  type: 'service' | 'product'; 
  barcode?: string; 
}

export interface SalaryHistoryEntry {
  id: string;
  date: string;
  previousSalary: number;
  newSalary: number;
  increaseAmount?: number;
  increasePercentage?: number;
  increaseType?: 'fixed' | 'percentage';
  reason?: string;
  approvedBy?: string;
  createdAt?: string;
}


export interface EmployeePermissionRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isExcused?: boolean;
  reason?: string;
}

export interface EndOfServiceRecord {
  terminationDate: string;
  reason: string;
  notes?: string;
  isBlacklisted: boolean;
  blacklistReason?: string;
  settledAmount?: number;
  recordedBy?: string;
}

export interface EmployeeFinancialRecord {
  id: string;
  date: string; // shift date or ISO
  type: 'advance' | 'penalty_cash' | 'penalty_days' | 'bonus' | 'commission' | 'referral_commission';
  amount?: number;
  days?: number;
  treasuryId?: string;
  note: string;
}

export interface EmployeeLeaveRecord {
  id: string;
  startDate: string;
  endDate: string;
  type: 'paid' | 'unpaid' | 'termination';
  note: string;
}

export interface HRSettings {
  // Overtime Rules (الأوفر تايم والعمل الإضافي)
  overtimeRateType: '1x' | '1.5x' | '2x' | 'custom_rate' | 'custom_percent' | 'custom_fixed_amount';
  customOvertimeHourlyRate?: number; // سعر ساعة الأوفر تايم الإضافية المحدد (ر.س / ساعة)
  customOvertimeDailyPercent?: number;
  overtimeGraceMinutes: number; // فترة السماح بالأوفر تايم بالدقائق (افتراضياً 30 دقيقة)

  // Delay / Lateness Rules (قواعد التأخير القابلة للتخصيص بالكامل)
  delayGraceMinutes?: number; // فترة السماح بالتأخير بالدقائق (افتراضياً 15 دقيقة)
  delayDeductionType?: 'percentage_of_daily' | 'fixed_amount'; // نوع الخصم: نسبة من أجر اليوم % أو مبلغ ثابت ر.س
  delayTier1StartMin?: number; // الشريحة 1: من دقيقة (افتراضياً 15)
  delayTier1EndMin?: number; // الشريحة 1: إلى دقيقة (افتراضياً 30)
  delayTier1Deduction: number; // خصم الشريحة 1 (افتراضياً 5% أو 10 ر.س)
  delayTier2StartMin?: number; // الشريحة 2: من دقيقة (افتراضياً 31)
  delayTier2EndMin?: number; // الشريحة 2: إلى دقيقة (افتراضياً 45)
  delayTier2Deduction: number; // خصم الشريحة 2 (افتراضياً 15% أو 25 ر.س)
  delayTier3StartMin?: number; // الشريحة 3: من دقيقة (افتراضياً 46)
  delayTier3EndMin?: number; // الشريحة 3: إلى دقيقة (افتراضياً 60)
  delayTier3Deduction: number; // خصم الشريحة 3 (افتراضياً 25% أو 50 ر.س)
  delayTier4StartMin?: number; // الشريحة 4: من دقيقة (افتراضياً 61 وما فوق)
  delayTier4Deduction: number; // خصم الشريحة 4 (افتراضياً 50% أو 100 ر.س)
  delayAbsenceThresholdHours: number; // حد اعتبار التأخير غياب كامل (افتراضياً 2 ساعة = 120 دقيقة)

  // Monthly Permissions Rules (قواعد ورصيد الاستئذان الشهري)
  maxMonthlyPermissions?: number; // الحد الأقصى لعدد الأذونات شهرياً
  maxMonthlyPermissionHours: number; // الحد الأقصى لساعات الاستئذان المسموح بها شهرياً بدون خصم (مثال: ساعتين)
  permissionDeductionRate?: 'exact_minute_rate' | 'hourly_rate';

  weeklyOffPaid: boolean;
}


export interface ShiftScheduleEntry {
  id: string;
  date: string; // YYYY-MM-DD (Effective start date)
  previousCheckInTime?: string;
  previousCheckOutTime?: string;
  checkInTime: string;
  checkOutTime: string;
  weeklyDaysOff?: string[];
  reason?: string;
  updatedBy?: string;
}

export interface CommissionTier {
  id: string;
  fromAmount: number;
  toAmount: number; // 0 means and above (no limit)
  percentage: number;
}

export interface Employee { 
  id: string; 
  salonId?: string;
  branchId?: string;
  name: string; 
  email?: string;
  avatarUrl?: string;
  publicBio?: string; // نبذة وملاحظة تظهر للعملاء في تطبيق الحجز الأونلاين
  hasOnlineAccount?: boolean;
  userId?: string;
  role: string; 
  baseSalary: number; 
  fingerprintCode: string; 
  commissionRate: number; 
  commissionModel?: 'fixed_rate' | 'target_based' | 'tiered_brackets';
  commissionTiers?: CommissionTier[];
  target: number; 
  targetType: 'daily' | 'monthly'; 
  availableVacations: number; 
  salaryType?: 'salary' | 'commission_only' | 'salary_plus_commission';
  allowDualCommission?: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  weeklyDaysOff?: string[];
  isActive?: boolean;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  financialRecords?: EmployeeFinancialRecord[];
  leaveRecords?: EmployeeLeaveRecord[];
  salaryHistory?: SalaryHistoryEntry[];
  shiftScheduleHistory?: ShiftScheduleEntry[];
  permissionRecords?: EmployeePermissionRecord[];
  endOfService?: EndOfServiceRecord;
}

export interface ClientPreferences {
  hairStyleNotes?: string; // ستايل وقصة الشعر المفضلة
  beardStyleNotes?: string; // ستايل وتحديد اللحية
  shavingMethod?: 'machine' | 'blade' | 'scissors_only' | 'both'; // طريقة الحلاقة (ماكينة / موس / مقص فقط / كلاهما)
  skinSensitivities?: string; // حساسية البشرة / مواد يتجنبها
  favoriteBeverage?: string; // المشروب المفضل (قهوة تركي / إسبريسو / شاي كرك / قهوة عربية...)
  sugarLevel?: 'none' | 'half' | 'one_spoon' | 'two_spoons' | 'extra'; // كمية السكر (بدون / خفيف / ملعقة / ملعقتين / زيادة)
  waterTemperature?: 'cold' | 'room' | 'none'; // درجة برودة الماء
  generalNotes?: string; // ملاحظات عامة للضيافة والتعامل
}

export type ClientTierLevel = 'standard' | 'distinguished' | 'vip' | 'royal';

export interface ClientTierConfig {
  id: ClientTierLevel;
  name: string; // قياسي / متميز / VIP / ملكي
  icon: string; // ⚪ / 🔷 / 👑 / 💎
  spendingThreshold: number; // الحد الأدنى للإنفاق
  discountPercentage: number; // نسبة الخصم المخصصة للمستوى %
  color: string; // لون الشارة
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description?: string;
}

export interface ClientTierSettings {
  enabled: boolean;
  periodMonths: number; // 0 = مدى الحياة, 3, 6, 12 شهر
  allowTierDiscountWithCashback: boolean; // السماح بخصم الترقية في حالة استخدام الكاش باك في سداد كامل الفاتورة
  tiers: ClientTierConfig[];
}

export const DEFAULT_CLIENT_TIERS: ClientTierConfig[] = [
  {
    id: 'standard',
    name: 'قياسي',
    icon: '⭐',
    spendingThreshold: 0,
    discountPercentage: 0,
    color: 'slate',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    description: 'المستوى الأساسي لجميع العملاء الجدد'
  },
  {
    id: 'distinguished',
    name: 'متميز',
    icon: '🔷',
    spendingThreshold: 300,
    discountPercentage: 5,
    color: 'blue',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-300',
    description: 'عميل منتظم بإنفاق يتجاوز 300 ر.س (خصم 5%)'
  },
  {
    id: 'vip',
    name: 'VIP',
    icon: '👑',
    spendingThreshold: 800,
    discountPercentage: 10,
    color: 'amber',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-400',
    description: 'عضوية كبار الشخصيات بإنفاق يتجاوز 800 ر.س (خصم 10%)'
  },
  {
    id: 'royal',
    name: 'ملكي',
    icon: '💎',
    spendingThreshold: 1500,
    discountPercentage: 15,
    color: 'purple',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-400',
    description: 'العضوية الملكية البلاتينية بإنفاق يتجاوز 1500 ر.س (خصم 15%)'
  }
];

export function calculateClientTotalSpend(client: { id?: string; name: string; phone?: string }, invoices: Invoice[], periodMonths: number = 0): number {
  if (!client) return 0;
  const now = new Date().getTime();
  const periodMs = periodMonths > 0 ? periodMonths * 30 * 24 * 60 * 60 * 1000 : 0;

  return invoices
    .filter(inv => {
      if (inv.status === 'cancelled') return false;
      const isMatch = (client.id && inv.clientId === client.id) || 
                      (client.phone && inv.clientPhone && inv.clientPhone.replace(/\D/g, '') === client.phone.replace(/\D/g, '')) || 
                      (inv.clientName && inv.clientName.trim().toLowerCase() === client.name.trim().toLowerCase());
      if (!isMatch) return false;
      if (periodMs > 0) {
        const invTime = new Date(inv.date).getTime();
        if (now - invTime > periodMs) return false;
      }
      return true;
    })
    .reduce((sum, inv) => sum + (inv.total || 0), 0);
}

export function getClientTier(
  client: { id?: string; name: string; phone?: string; isVip?: boolean } | null | undefined, 
  invoices: Invoice[], 
  tierSettings?: ClientTierSettings
): ClientTierConfig {
  if (!client) {
    return DEFAULT_CLIENT_TIERS[0];
  }
  const tiers = (tierSettings?.tiers && tierSettings.tiers.length > 0) ? tierSettings.tiers : DEFAULT_CLIENT_TIERS;
  
  if (tierSettings?.enabled === false) {
    return tiers[0] || DEFAULT_CLIENT_TIERS[0];
  }

  const totalSpend = calculateClientTotalSpend(client, invoices, tierSettings?.periodMonths || 0);
  
  // Sort descending by threshold
  const sortedTiers = [...tiers].sort((a, b) => b.spendingThreshold - a.spendingThreshold);
  for (const tier of sortedTiers) {
    if (totalSpend >= tier.spendingThreshold && tier.spendingThreshold > 0) {
      return tier;
    }
  }

  // If manually flagged as VIP but spending hasn't hit threshold yet
  if (client.isVip) {
    const vipTier = tiers.find(t => t.id === 'vip');
    if (vipTier) return vipTier;
  }

  return sortedTiers[sortedTiers.length - 1] || DEFAULT_CLIENT_TIERS[0];
}

export interface VIPSettings {
  enabled: boolean;
  spendingThreshold: number; // e.g. 1000 SAR
  periodMonths: number; // e.g. 6 or 12 months (0 = lifetime)
  discountPercentage?: number; // e.g. 10%
  autoUpgrade: boolean; // Auto-upgrade when threshold is met
  vipPerksNotes?: string; // امتيازات ومزايا الـ VIP
}

export interface Client { 
  id: string; 
  salonId?: string;
  branchId?: string;
  name: string; 
  phone: string; 
  email?: string;
  loyaltyPoints: number; 
  cashback?: number;
  isVip?: boolean;
  vipSince?: string;
  vipNotes?: string;
  referredByPhone?: string; // رقم هاتف العميل الذي رشحه (كود الإحالة)
  hasUsedReferralReward?: boolean; // تم صرف كاش باك الإحالة للعميل المرشح عند أول فاتورة
  referralCount?: number; // عدد العملاء الجدد الذين رشحهم هذا العميل
  referralTotalCashbackEarned?: number; // إجمالي مبالغ الكاش باك المكتسبة من الإحالات
  lastVisit?: string; 
  dobDay?: string;
  dobMonth?: string;
  dob?: string;
  notes?: string;
  preferences?: ClientPreferences;
  createdAt?: string;
}

export interface BookingService { 
  id: string; 
  serviceId: string; 
  serviceName: string; 
  technicianId: string; 
  technicianName: string; 
  price: number; 
}

export interface AdvancePayment { 
  id: string; 
  amount: number; 
  treasuryId: string; 
  treasuryName: string; 
  date: string; 
}

export interface ClientPortalAccount {
  id: string;
  phone: string;
  email: string;
  password?: string;
  name: string;
  country: string;
  referredByPhone?: string; // العميل الذي رشحه
  isVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface Booking { 
  id: string; 
  salonId?: string;
  branchId?: string;
  clientName: string; 
  phone: string; 
  customerEmail?: string;
  date: string; 
  time: string; 
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'; 
  advancePayments: AdvancePayment[]; 
  services: BookingService[]; 
  totalAmount: number; 
  notes?: string;
  source?: 'online' | 'pos' | 'phone';
  bookingCode?: string;
}

export interface CartItem { 
  cartId: string; 
  item: any; 
  quantity: number; 
  employeeId: string; 
  referralEmployeeId?: string; // موظف الإحالة / فتح الشغل
  type: 'service' | 'product'; 
  price: number;
}

export interface HeldInvoice {
  id: string;
  heldAt: string; // ISO string
  timeStr: string; // HH:mm
  client: Client | null;
  clientSearch: string;
  cart: CartItem[];
  discount: { type: 'percentage' | 'fixed'; value: number };
  advanceDeduction: number;
  isRemedyInvoice?: boolean;
  remedyReason?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  note?: string;
}

export interface Treasury { 
  id: string; 
  name: string; 
  isMain: boolean; 
}

export interface ZatcaSettings {
  enabled: boolean;
  environment: 'sandbox' | 'simulation' | 'production';
  vatNumber: string; // 15 digits starting and ending with 3
  commercialReg: string;
  egsSerialNumber: string;
  organizationName: string;
  organizationUnitName: string;
  countryName: string; // "SA"
  cityName: string;
  streetName: string;
  buildingNumber: string;
  postalCode: string;
  // Security & Onboarding
  otp?: string;
  complianceCsid?: string;
  complianceSecret?: string;
  productionCsid?: string;
  productionSecret?: string;
  privateKey?: string;
  publicKey?: string;
  compliancePassed?: boolean;
  isOnboarded?: boolean;
  autoReportB2C?: boolean;
  lastInvoiceHash?: string;
  invoiceCounter?: number;
}

export interface EtaEgyptSettings {
  enabled: boolean;
  environment: 'preproduction' | 'production';
  taxRegistrationNumber: string; // 9 digits (e.g. 123-456-789)
  taxpayerActivityCode: string; // e.g. 9602 for Salons & Beauty centers
  branchCode: string; // "0" for main branch
  clientId: string;
  clientSecret: string;
  clientSecret2?: string;
  posSerialNumber: string;
  posModel: string;
  posOsVersion: string;
  autoSubmitReceipts?: boolean;
  isConnected?: boolean;
  lastTokenExpiry?: string;
}

export interface AppSettings { 
  salonId?: string;
  salonCode?: string;
  branchId?: string;
  branchCode?: string;
  isSalonActive?: boolean;
  subscriptionStatus?: 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled';
  subscriptionEndDate?: string;
  ownerEmail?: string;
  salonName: string;
  salonType?: SalonType;
  taxNumber: string;
  commercialReg: string;
  vatEnabled: boolean; 
  vatRate: number; 
  currency: string; 
  country: string; 
  phone: string; 
  address: string; 
  logoUrl: string; 
  treasuries: Treasury[];
  printerName: string;
  paperSize: '80mm' | '58mm' | 'a4';
  printAutomatically: boolean;
  zatcaEnabled: boolean;
  zatcaSettings?: ZatcaSettings;
  etaEgyptSettings?: EtaEgyptSettings;
  receiptHeaderNote: string;
  receiptFooterNote: string;
  expenseCategories: string[];
  bookingNotes: string;
  // Evolution API WhatsApp Integration per salon & branch
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstanceName?: string;
  evolutionBranchInstances?: Record<string, string>; // branchId -> instanceName
  waInstantName?: string; 
  waApiKey?: string; 
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseEnabled?: boolean;
  showDashboardAnalytics?: boolean;
  showEmployeeAnalytics?: boolean;
  hrSettings?: HRSettings;
  bookingRules?: BookingRulesSettings;
  vipSettings?: VIPSettings;
  tierSettings?: ClientTierSettings;
  aiProvider?: 'builtin' | 'gemini' | 'openai';
  aiApiKey?: string;
  aiAssistantEnabled?: boolean; // تفعيل أو إلغاء تفعيل المساعد الذكي
  tipsEnabled?: boolean; // تفعيل نظام البقشيش
  tipsDirectCashDeduction?: boolean; // خصم البقشيش من الكاش مباشرة
  tipPayoutMethod?: 'instant_cash' | 'pooled_deferred'; // طريقة صرف وسداد الإكراميات (فوري كاش أو مجمع مؤجل)
  allowNonCashTips?: boolean; // السماح بالبقشيش عبر طرق الدفع غير النقدية (فيزا / شبكة / تحويل)
}


export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  actionCard?: {
    type: 'booking_created' | 'advance_created' | 'expense_created' | 'client_created' | 'data_query' | 'stats_summary';
    title: string;
    data?: any;
    actions?: {
      label: string;
      actionType: 'open_booking' | 'to_pos' | 'print_receipt' | 'open_screen';
      targetId?: string;
      screenName?: string;
    }[];
  };
  isThinking?: boolean;
}

export interface InvoiceItem { 
  id: string; 
  itemId?: string; 
  type?: 'service' | 'product'; 
  serviceName: string; 
  technicianName: string; 
  price: number; 
  quantity?: number; 
  employeeId?: string; 
  referralEmployeeId?: string; // موظف الإحالة / فتح الشغل
  referralEmployeeName?: string;
  referralCommissionAmount?: number;
}

export interface Invoice { 
  id: string; 
  salonId?: string;
  branchId?: string;
  branchCode?: string;
  date: string; 
  clientName: string; 
  clientId?: string;
  clientPhone?: string; 
  subtotal?: number;
  discount: number; 
  vatAmount?: number;
  cashbackUsed?: number;
  total: number; 
  status: 'completed' | 'cancelled' | 'refunded'; 
  items: InvoiceItem[]; 
  paymentMethods?: { amount: number; treasuryId: string; }[];
  promoCode?: string;
  promoDiscount?: number;
  tipAmount?: number;
  tipEmployeeId?: string;
  tipEmployeeName?: string;
  zatcaQr?: string;
  zatcaHash?: string;
  zatcaReportingStatus?: 'reported' | 'cleared' | 'failed' | 'not_submitted';
  zatcaWarning?: string;
  etaSubmissionUuid?: string;
  etaStatus?: 'submitted' | 'valid' | 'invalid' | 'not_submitted';
  createdBy?: string;
  // Before and After photos for quality assurance & customer history
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  // Remedy / Warranty Fix on Salon Expense
  isRemedyInvoice?: boolean;
  remedyReason?: string;
  relatedComplaintId?: string;
  originalInvoiceId?: string;
}

// ============================================================
// 👥 1. نظام إدارة الشركاء ورأس المال (Partners Management)
// ============================================================
export interface Partner {
  id: string;
  salonId?: string;
  name: string;
  phone: string;
  idNumber?: string;
  capitalShare: number; // حصة رأس المال
  sharePercentage: number; // النسبة المئوية من إجمالي رأس المال
  joinDate: string;
  notes?: string;
  isActive: boolean;
}

export interface PartnerTransaction {
  id: string;
  salonId?: string;
  partnerId: string;
  partnerName: string;
  type: 'deposit' | 'withdrawal' | 'profit_share'; // إيداع رأس مال / مسحوبات شريك / توزيع أرباح
  amount: number;
  date: string;
  treasuryId: string;
  treasuryName?: string;
  description: string;
  createdBy?: string;
}

// ============================================================
// 🏷️ 2. نظام البرومو كود وأكواد المشاهير (Promo Codes System)
// ============================================================
export interface PromoCode {
  id: string;
  salonId?: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number;
  startDate: string;
  endDate: string;
  maxUsesTotal?: number;
  usesCount: number;
  isActive: boolean;
  notes?: string;
  createdBy?: string;
}

export interface PromoCodeUsage {
  id: string;
  salonId?: string;
  promoCodeId: string;
  code: string;
  clientPhone: string;
  clientName?: string;
  invoiceId?: string;
  discountApplied: number;
  usedAt: string;
}

// ============================================================
// 💵 3. نظام البقشيش (Tips Management)
// ============================================================
export interface TipRecord {
  id: string;
  salonId?: string;
  branchId?: string;
  invoiceId: string;
  clientName?: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  paymentMethod: string;
  date: string;
  status: 'pending_payout' | 'paid_out';
  payoutMethod?: 'instant_cash' | 'pooled_deferred';
  paidOutAt?: string;
  paidOutTreasuryId?: string;
  paidOutBy?: string;
  notes?: string;
}


// ============================================================
// 📦 4. نظام عهد الموظفين (Employee Custodies)
// ============================================================
export interface EmployeeCustody {
  id: string;
  salonId?: string;
  branchId?: string;
  employeeId: string;
  employeeName: string;
  itemName: string;
  serialNumber?: string;
  quantity: number;
  givenDate: string;
  status: 'in_custody' | 'returned' | 'damaged' | 'lost';
  returnedDate?: string;
  notes?: string;
  createdBy?: string;
}

// ============================================================
// ⏱️ 5. سجل حركات وسحوبات البصمة (Fingerprint Logs)
// ============================================================
export interface FingerprintLog {
  id: string;
  salonId?: string;
  branchId?: string;
  employeeId?: string;
  employeeName?: string;
  fingerprintCode: string;
  timestamp: string;
  type: 'check_in' | 'check_out';
  deviceIp?: string;
  status: 'synced' | 'processed' | 'manual';
  notes?: string;
}


export interface ComplaintAction {
  id: string;
  date: string;
  actionText: string;
  performedBy: string;
}

export interface ClientComplaint {
  id: string;
  salonId?: string;
  salonCode?: string;
  branchId?: string;
  branchCode?: string;
  clientPhone: string;
  clientName: string;
  clientId?: string;
  invoiceId?: string;
  invoiceDate?: string;
  invoiceTotal?: number;
  employeeId?: string;
  employeeName?: string;
  category: 'service_quality' | 'staff_behavior' | 'timing_delay' | 'skin_hair_damage' | 'pricing' | 'other';
  description: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actions: ComplaintAction[];
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  isRemedyProvided?: boolean;
  remedyInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction { 
  id: string; 
  date: string; 
  type: 'in' | 'out'; 
  amount: number; 
  category: string; 
  expenseCategory?: string; 
  description: string; 
  treasury: string; 
  createdBy?: string;
  userId?: string;
  userName?: string;
  shiftDate?: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  sellPrice: number;
  costPrice: number;
  reorderLimit: number;
  openingStock: number;
  currentStock: number;
  commission: number;
  barcode?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  currentBalance: number; 
}

export interface PurchaseInvoiceItem {
  productId: string;
  quantity: number;
  costPrice: number;
  total: number;
}

export interface PurchaseInvoice {
  id: string;
  supplierId: string;
  date: string;
  items: PurchaseInvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  treasuryId: string;
  notes?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  date: string;
  amount: number;
  treasuryId: string;
  notes?: string;
}

export interface InventoryCountItem {
  productId: string;
  expectedQuantity: number;
  actualQuantity: number;
  difference: number;
  notes?: string;
}

export interface InventoryCount {
  id: string;
  date: string;
  notes?: string;
  items: InventoryCountItem[];
}

export interface ItemMovement {
  id: string;
  productId: string;
  date: string;
  type: 'purchase' | 'sale' | 'inventory_count' | 'manual_adjustment' | 'internal_use' | 'purchase_return' | 'sale_return';
  referenceId?: string; 
  quantityIn: number;
  quantityOut: number;
  balanceAfter: number;
  notes?: string;
}
