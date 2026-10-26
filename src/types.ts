export type UserRole = 'programmer' | 'owner' | 'admin' | 'supervisor' | 'cashier' | 'receptionist' | 'barber' | 'accountant' | 'warehouse_manager' | 'kiosk' | 'custom';

// 1. صلاحيات الشاشات (ScreenPermission)
export type ScreenPermission =
  | 'dashboard'
  | 'owner_portal'
  | 'barber_portal'
  | 'pos'
  | 'kiosk'
  | 'queue_calling'
  | 'bookings'
  | 'invoices'
  | 'deferred_invoices'
  | 'promo_codes'
  | 'services'
  | 'warehouse'
  | 'warehouse_products'
  | 'warehouse_suppliers'
  | 'warehouse_purchases'
  | 'warehouse_inventory'
  | 'warehouse_shortages'
  | 'clients'
  | 'complaints'
  | 'employees'
  | 'hr'
  | 'fingerprint_logs'
  | 'treasury'
  | 'expenses'
  | 'partners'
  | 'tips'
  | 'reports'
  | 'permissions'
  | 'settings'
  | 'manager_ai_chat'
  | 'saas_subscriptions'
  | '*'
  | (string & {});

// 2. صلاحيات الإجراءات والعمليات (ActionPermission)
export type ActionPermission = 
  // POS, Cashier & Sales
  | 'pos_discount' 
  | 'pos_custom_price'
  | 'pos_void' 
  | 'pos_reprint'
  | 'sales_return' 
  | 'manage_invoices_delete'
  | 'manage_queue'

  // Shifts, Treasuries & Financials
  | 'manage_shifts' 
  | 'edit_shift_cash'
  | 'treasury_deposit'
  | 'treasury_withdraw'
  | 'treasury_transfer'
  | 'treasury_view_balance'
  | 'manage_treasury_delete'
  | 'delete_transactions'

  // Warehouse, Inventory, Purchasing & Expenses
  | 'manage_products'
  | 'import_products_excel'
  | 'print_barcodes'
  | 'manage_suppliers' 
  | 'manage_purchases'
  | 'manage_inventory' 
  | 'manage_expenses'
  | 'manage_expense_categories' // إضافة وتعديل وحذف بنود وتصنيفات المصروفات

  // الإجراء العام والتوافق الإداري لشؤون العاملين
  | 'manage_hr_actions'

  // 10 صلاحيات إجرائية تفصيلية خاصة بشؤون العاملين (HR Granular Permissions)
  | 'hr_manage_advances'          // 1. صرف وإدارة وطباعة سندات السلف النقدية
  | 'hr_manage_penalties'         // 2. تطبيق واعتماد سندات الجزاءات والخصومات الإدارية
  | 'hr_manage_bonuses'           // 3. تسجيل وصرف سندات الحوافز والمكافآت التشجيعية
  | 'hr_manage_leaves'            // 4. تسجيل واعتماد وحذف إجازات الموظفين (مدفوعة / غير مدفوعة)
  | 'hr_manage_permissions'       // 5. تسجيل واعتماد وحذف أذونات الاستئذان والمأموريات الرسمية
  | 'hr_manage_attendance'        // 6. تسجيل وتعديل الحضور والانصراف والدوام اليدوي
  | 'hr_approve_delays_overtime'  // 7. العفو عن التأخيرات واعتماد ساعات العمل الإضافية (الأوفرتايم)
  | 'hr_manage_salary_increments' // 8. إقرار وتطبيق وتعديل زيادات وعلاوات الرواتب
  | 'hr_disburse_payroll'         // 9. فتح واعتماد وصرف مسير الرواتب الشهرية من الخزائن وطباعة سندات الصرف
  | 'hr_manage_commissions'       // 10. اعتماد وتصفية وصرف عمولات الخدمات والمبيعات نقدياً

  // Additional HR & Timesheet aliases / operations
  | 'hr_view_timesheet'
  | 'hr_delete_attendance'
  | 'hr_forgive_delays'
  | 'hr_approve_overtime'
  | 'hr_salary_increments'
  | 'hr_disburse_salaries'
  | 'hr_disburse_commissions'
  | 'hr_print_slips'
  | 'hr_fingerprint_sync'

  // Employees & Staff Management (بيانات وملفات الموظفين)
  | 'manage_employees_add'
  | 'manage_employees_edit'
  | 'manage_employees_delete'
  | 'manage_custodies'
  | 'manage_end_of_service'

  // Compatibility & Legacy aliases
  | 'manage_employees' 
  | 'manage_salaries'
  | 'manage_hr'
  | 'view_fingerprint_logs'

  // Clients, Loyalty & Complaints
  | 'manage_clients'
  | 'manage_clients_delete'
  | 'delete_client'
  | 'view_client_financials'

  // Bookings, Partners, Promo Codes & Tips
  | 'manage_booking_settings'
  | 'manage_bookings_delete'
  | 'manage_partners'
  | 'manage_promo_codes'
  | 'manage_tips'

  // Reports, Analytics & System Management
  | 'view_reports' 
  | 'view_system_analytics'
  | 'view_employee_analytics'
  | 'export_excel' // صلاحية تصدير البيانات والجداول والتقارير إلى ملفات Excel
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
  screens: ScreenPermission[];
  actions: ActionPermission[];
  createdAt: string;
  isSystem?: boolean;
}

export interface SecurityQuestionAnswer {
  question: string;
  answer: string;
}

export const PRESET_SECURITY_QUESTIONS: string[] = [
  'ما هو اسم أول مدرسة التحقت بها في طفولتك؟',
  'ما هي المدينة أو القرية التي ولدت فيها؟',
  'ما هو اسم صديق طفولتك الأقرب إليك؟',
  'ما هو اسم حيوانك الأليف الأول أو المفضل؟',
  'ما هي أكلتك أو وجبتك المفضلة؟',
  'ما هو نوع أو لون أول سيارة امتلكتها أو تفضلها؟',
  'ما هي وجهتك السياحية المفضلة للسفر؟',
  'ما هو اسم والدتك قبل الزواج (اسم عائلة الأم)؟',
  'ما هي مادتك الدراسية المفضلة في الثانوية؟',
  'ما هو فريقك أو ناديك الرياضي المفضل؟'
];

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
  status?: 'active' | 'pending' | 'rejected';
  securityQuestions?: SecurityQuestionAnswer[];
  screens: ScreenPermission[];
  actions: ActionPermission[];
  avatar?: string;
  integritySignature?: string;
  securityHash?: string;
  isTampered?: boolean;
  createdAt?: string;
  approvedAt?: string;
  approvedBy?: string;
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
  timezone?: string; // IANA Time Zone string (e.g. Asia/Riyadh, Africa/Cairo)
  storageLimitMb?: number; // الحد الأقصى للمساحة التخزينية بالميجابايت (افتراضي 50MB)
  usedStorageBytes?: number; // المساحة المستخدمة الفعلية بالبايت
}



export interface Category { 
  id: string; 
  salonId?: string;
  branchId?: string;
  name: string; 
  icon?: string; 
  type?: 'service' | 'product'; 
  isActive?: boolean;
  stock?: number;
  minStockAlert?: number;
  price?: number;
  salePrice?: number;
}

export interface ServiceItem { 
  id: string; 
  salonId?: string;
  branchId?: string;
  categoryId: string; 
  name: string; 
  price: number; 
  branchPrices?: Record<string, number>; // تسعير الخدمة المخصص لكل فرع (branchId -> price)
  branchForeignerPrices?: Record<string, number>; // تسعير الخدمة المخصص للأجانب لكل فرع
  foreignerPrice?: number; // سعر الخدمة للأجنبي في حال تفعيل التسعير المزدوج
  discountPrice?: number;
  commissionableAmount?: number; // المبلغ الخاضع للعمولة (لحساب عمولة الفني على جزء من السعر فقط واستبعاد تكلفة الخامات)
  isTargetExempt?: boolean; // هل الخدمة معفاة من التارجت وتصرف عمولتها فورياً للموظف دون احتسابها في التارجت؟
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
  imageUrl?: string; // رابط صورة الخدمة المخزنة في Bucket services
  isPriority?: boolean; // أولوية الظهور في الكاشير ونقطة البيع
  cardColor?: string; // لون البطاقة المخصص للخدمة في شاشة الكاشير
  priorityOrder?: number; // ترتيب أسبقية الظهور
  category?: string;
  description?: string;
}

export interface WorkShift {
  id: string;
  shiftCode?: string;
  salonId?: string;
  branchId?: string;
  shiftDate: string; // YYYY-MM-DD
  openedAt: string; // ISO String
  closedAt?: string; // ISO String
  openedByUserId?: string;
  openedByUserName?: string;
  openedByName?: string;
  openedByRole?: string;
  closedByUserId?: string;
  closedByUserName?: string;
  closedByName?: string;
  closedByRole?: string;
  initialCash: number; // العهدة الافتتاحية
  expectedCash?: number; // الكاش المتوقع في الدرج عند الإغلاق
  actualCash?: number; // الكاش الفعلي المعدود في الدرج
  cashDifference?: number; // العجز أو الزيادة
  totalSales?: number;
  totalCashSales?: number;
  totalCardSales?: number;
  totalExpenses?: number;
  transferredToTreasury?: string;
  transferredAmount?: number;
  totalAdvances?: number;
  status: 'open' | 'closed';
  notes?: string;
  createdAt?: string;
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
  type?: 'shift_start' | 'mid_shift' | 'official_mission'; // نوع الإذن: بداية الدوام، وسط الدوام، مأمورية عمل
  actualStartTime?: string; // وقت الخروج الفعلي بالبصمة
  actualEndTime?: string; // وقت العودة الفعلي بالبصمة
  actualDurationMinutes?: number; // المدة الفعلية المستغرقة بالدقائق
  isExcused?: boolean; // إذن معفى/مقبول رسمي
  reason?: string;
  status?: 'approved' | 'pending' | 'rejected' | 'auto_converted';
  deductionAction?: 'balance_deducted' | 'unpaid_delay' | 'partial_absence' | 'converted_leave' | 'converted_absence' | 'mission_exempt';
  administrativeAction?: 'none' | 'warning' | 'penalty';
  administrativeNotes?: string;
  approvedBy?: string;
  createdAt?: string;
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
  type: 'salary' | 'advance' | 'penalty_cash' | 'penalty_days' | 'bonus' | 'commission' | 'referral_commission' | 'commission_payout';
  amount?: number;
  days?: number;
  treasuryId?: string;
  note: string;
  payrollPeriod?: { startDate: string; endDate: string; month?: string };
  periodKey?: string;
  targetDate?: string;
  targetMonth?: string;
}

export interface EmployeeLeaveRecord {
  id: string;
  startDate: string;
  endDate: string;
  type: 'paid' | 'unpaid' | 'termination';
  note: string;
  daysCount?: number;
  reason?: string;
  createdAt?: string;
  approvedBy?: string;
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
  maxDailyPermissionHours?: number; // الحد الأقصى اليومي المسموح به لساعات الاستئذان في اليوم الواحد (افتراضياً 4 ساعات)
  permissionOverstayAction?: 'annual_leave' | 'unpaid_absence'; // الإجراء التلقائي عند تجاوز الحد اليومي أو عدم العودة
  triggerAdministrativePenaltyOnDelayWithoutBalance?: boolean; // تفعيل جزاء إداري عند التأخر بدون رصيد
  permissionDeductionRate?: 'exact_minute_rate' | 'hourly_rate';

  weeklyOffPaid: boolean;
  weeklyOffPaidType?: 'paid' | 'unpaid'; // نوع الإجازة الأسبوعية: مدفوعة على حساب المحل أو غير مدفوعة
  absenceDeductionDays?: number; // عدد أيام الخصم في حالة الغياب (الافتراضي 1)
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

export const EMPLOYEE_ROLES = [
  'حلاق / كوافير',
  'مساعد',
  'كاشير',
  'اداري',
  'عامل'
] as const;

export type StandardEmployeeRole = typeof EMPLOYEE_ROLES[number];

export interface Employee { 
  id: string; 
  salonId?: string;
  branchId?: string;
  name: string; 
  email?: string;
  avatarUrl?: string;
  publicBio?: string; // نبذة وملاحظة تظهر للعملاء في تطبيق الحجز الأونلاين
  hasOnlineAccount?: boolean;
  username?: string;
  userId?: string;
  role: string; 
  baseSalary: number; 
  fingerprintCode: string; 
  commissionRate: number; 
  commissionModel?: 'none' | 'fixed_rate' | 'target_based' | 'tiered_brackets';
  commissionTiers?: CommissionTier[];
  target: number; 
  targetType: 'none' | 'daily' | 'monthly'; 
  dailyTargetAmount?: number;
  dailyTargetMethod?: 'excess_only' | 'full_amount' | 'salary_multiplier';
  dailyTargetMultiplier?: number;
  monthlyTargetAmount?: number;
  monthlyTargetMethod?: 'deduct_salary' | 'gross_sales' | 'salary_multiplier';
  monthlyTargetMultiplier?: number;
  targetSalaryMultiplier?: number;
  targetCommissionRate?: number;
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
  icon: string; // 'star' | 'shield' | 'crown' | 'gem'
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
    icon: 'star',
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
    icon: 'shield',
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
    icon: 'crown',
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
    icon: 'gem',
    spendingThreshold: 1500,
    discountPercentage: 15,
    color: 'purple',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-400',
    description: 'العضوية الملكية البلاتينية بإنفاق يتجاوز 1500 ر.س (خصم 15%)'
  }
];

export function calculateClientTotalSpend(
  client: { id?: string; name: string; phone?: string } | null | undefined, 
  invoices?: Invoice[], 
  periodMonths: number = 0
): number {
  if (!client || !Array.isArray(invoices) || invoices.length === 0) return 0;
  const now = new Date().getTime();
  const periodMs = periodMonths > 0 ? periodMonths * 30 * 24 * 60 * 60 * 1000 : 0;
  const clientDigits = client.phone ? String(client.phone).replace(/\D/g, '') : '';
  const clientNameTrim = client.name ? String(client.name).trim().toLowerCase() : '';

  const total = invoices
    .filter(inv => {
      if (!inv || inv.status === 'cancelled' || inv.status === 'refunded') return false;
      
      // Match by Client ID (Primary)
      if (client.id && inv.clientId && inv.clientId === client.id) {
        // match confirmed
      } else {
        // Match by phone number (at least 7 digits to prevent false positives on empty/short strings)
        const invDigits = inv.clientPhone ? String(inv.clientPhone).replace(/\D/g, '') : '';
        const phoneMatch = clientDigits.length >= 7 && invDigits.length >= 7 && (
          clientDigits === invDigits || 
          clientDigits.endsWith(invDigits) || 
          invDigits.endsWith(clientDigits)
        );

        // Match by Client Name (at least 2 characters)
        const invNameTrim = inv.clientName ? String(inv.clientName).trim().toLowerCase() : '';
        const nameMatch = clientNameTrim.length >= 2 && invNameTrim.length >= 2 && clientNameTrim === invNameTrim;

        if (!phoneMatch && !nameMatch) return false;
      }

      // Check period constraint if periodMonths > 0
      if (periodMs > 0) {
        const dateStr = inv.date || (inv as any).created_at || (inv as any).shift_date || '';
        const invTime = dateStr ? new Date(dateStr).getTime() : NaN;
        if (!isNaN(invTime) && (now - invTime > periodMs)) return false;
      }
      return true;
    })
    .reduce((sum, inv) => {
      const invTotal = Number(inv.total ?? (inv as any).total_amount ?? 0);
      return sum + (isNaN(invTotal) ? 0 : invTotal);
    }, 0);

  return Math.round(total * 100) / 100;
}

export function getClientTier(
  client: { id?: string; name: string; phone?: string; isVip?: boolean } | null | undefined, 
  invoices?: Invoice[], 
  tierSettings?: ClientTierSettings
): ClientTierConfig {
  const tiers = (tierSettings?.tiers && Array.isArray(tierSettings.tiers) && tierSettings.tiers.length > 0) 
    ? tierSettings.tiers 
    : DEFAULT_CLIENT_TIERS;
  
  const standardFallback = tiers.find(t => t.id === 'standard' || Number(t.spendingThreshold) === 0) || DEFAULT_CLIENT_TIERS[0];

  if (!client) {
    return standardFallback;
  }
  
  // If tier system is disabled by salon settings, return standard tier with 0% discount
  if (tierSettings?.enabled === false) {
    return { ...standardFallback, discountPercentage: 0 };
  }

  const totalSpend = calculateClientTotalSpend(client, invoices, tierSettings?.periodMonths || 0);
  
  // Sort descending by spendingThreshold (highest threshold first: Royal -> VIP -> Distinguished -> Standard)
  const sortedTiers = [...tiers].sort((a, b) => (Number(b.spendingThreshold) || 0) - (Number(a.spendingThreshold) || 0));
  for (const tier of sortedTiers) {
    const threshold = Number(tier.spendingThreshold) || 0;
    if (threshold > 0 && totalSpend >= threshold) {
      return tier;
    }
  }

  // If client is manually flagged as VIP, ensure they at least get VIP tier (or Distinguished if no VIP)
  if (client.isVip) {
    const vipTier = tiers.find(t => t.id === 'vip') || tiers.find(t => t.id === 'distinguished');
    if (vipTier) return vipTier;
  }

  return standardFallback;
}

/**
 * دالة مساعدة لحساب المستوى القادم والتقدم المطلوب للترقية
 */
export function getNextClientTier(
  currentTier: ClientTierConfig,
  totalSpend: number,
  tierSettings?: ClientTierSettings
): {
  nextTier: ClientTierConfig | null;
  amountNeeded: number;
  progressPercentage: number;
  isMaxTier: boolean;
} {
  const tiers = (tierSettings?.tiers && Array.isArray(tierSettings.tiers) && tierSettings.tiers.length > 0) 
    ? tierSettings.tiers 
    : DEFAULT_CLIENT_TIERS;

  // Sort ascending by spendingThreshold (Standard -> Distinguished -> VIP -> Royal)
  const ascendingTiers = [...tiers].sort((a, b) => (Number(a.spendingThreshold) || 0) - (Number(b.spendingThreshold) || 0));
  
  // Find the next tier that has a strictly higher threshold than totalSpend (or current tier)
  const currentThreshold = Number(currentTier.spendingThreshold) || 0;
  const nextTier = ascendingTiers.find(t => (Number(t.spendingThreshold) || 0) > Math.max(totalSpend, currentThreshold)) || null;

  if (!nextTier) {
    return {
      nextTier: null,
      amountNeeded: 0,
      progressPercentage: 100,
      isMaxTier: true
    };
  }

  const nextThreshold = Number(nextTier.spendingThreshold) || 1;
  const amountNeeded = Math.max(0, Math.round((nextThreshold - totalSpend) * 100) / 100);
  const progressPercentage = Math.min(100, Math.max(0, Math.round((totalSpend / nextThreshold) * 100)));

  return {
    nextTier,
    amountNeeded,
    progressPercentage,
    isMaxTier: false
  };
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
  branchIds?: string[]; // الفروع التي يتردد عليها العميل أو متاح فيها
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
  debt?: number;
  totalDebt?: number;
  clientType?: 'citizen' | 'foreigner'; // مواطن / أجنبي
  lastBirthdayGreetingAt?: string; // تاريخ ووقت آخر رسالة تهنئة بعيد الميلاد تم إرسالها للعميل
  lastReactivationMessageAt?: string; // تاريخ ووقت آخر رسالة تنشيط واستعادة تم إرسالها للعميل المنقطع
  createdAt?: string;
}

export interface BookingService { 
  id: string; 
  serviceId: string; 
  serviceName: string; 
  technicianId: string; 
  technicianName: string; 
  price: number; 
  quantity?: number;
  discount?: number;
  type?: 'service' | 'product';
  productId?: string;
  productName?: string;
}

export interface AdvancePayment { 
  id: string; 
  amount: number; 
  treasuryId: string; 
  treasuryName: string; 
  date: string; 
  paymentMethod?: string;
  notes?: string;
  shiftDate?: string;
  paymentDate?: string;
}

export interface ClientPortalAccount {
  id: string;
  username: string; // اسم المستخدم الفريد (إجباري وغير مكرر)
  phone?: string;
  email?: string;
  password?: string;
  name: string;
  country: string;
  referredByPhone?: string; // العميل الذي رشحه
  isVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
  salonId?: string; // معرف الصالون الأساسي المرتبط به الحساب
  salonCode?: string; // كود الصالون الأساسي المرتبط به الحساب
  linkedSalonCodes?: string[]; // قائمة أكواد الصالونات المرتبطة بهذا العميل
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
  startTime?: string; // UTC ISO string
  endTime?: string; // UTC ISO string
  start_time?: string; // Supabase column mapping
  end_time?: string; // Supabase column mapping
  timezone?: string; // IANA Time Zone string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'; 
  advancePayments: AdvancePayment[]; 
  services: BookingService[]; 
  totalAmount: number; 
  notes?: string;
  internalNotes?: string; // ملاحظات داخلية خاصة بالإدارة لا تظهر للعميل
  source?: 'online' | 'pos' | 'phone';
  bookingCode?: string;
  queueNumber?: number;
  invoiceId?: string;
  isPaid?: boolean;
  location?: string;
  createdAt?: string;
  createdBy?: string; // اسم المستخدم الذي أنشأ الحجز
  createdById?: string; // معرف المستخدم الذي أنشأ الحجز
  updatedAt?: string; // تاريخ ووقت آخر تعديل
  updatedBy?: string; // اسم المستخدم الذي قام بآخر تعديل عليه
  updatedById?: string; // معرف المستخدم الذي قام بآخر تعديل عليه
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  paidDeposit?: number; // إجمالي العربون المسدد
  isDepositRefunded?: boolean; // هل تم استرجاع العربون
  depositRefundedAt?: string; // تاريخ ووقت استرجاع العربون
  depositRefundedBy?: string; // اسم المستخدم الذي قام بالاسترجاع
  depositRefundAmount?: number; // قيمة العربون المسترجع
  refundExpenseId?: string; // معرف سند المصروف المرتبط بالاسترجاع
  cancelledAt?: string; // تاريخ ووقت الإلغاء
  cancelledBy?: string; // اسم المستخدم منفذ الإلغاء
}

export interface CartItem { 
  cartId: string; 
  item: any; 
  quantity: number; 
  employeeId: string; 
  referralEmployeeId?: string; // موظف الإحالة / فتح الشغل
  type: 'service' | 'product'; 
  price: number;
  discount?: number;
  originalPrice?: number;
}

export interface QueueTicket {
  id: string;
  salonId: string;
  branchId: string;
  queueNumber: number; // رقم التسلسل (1, 2, 3...)
  clientId?: string;
  clientName: string;
  phone: string;
  status: 'waiting' | 'called' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  source: 'kiosk' | 'booking' | 'pos';
  bookingId?: string;
  heldInvoiceId?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  checkInTime: string; // ISO string
  calledAt?: string;
  completedAt?: string;
  notes?: string;
  shiftDate?: string;
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
  advancePayments?: AdvancePayment[];
  bookingId?: string;
  isRemedyInvoice?: boolean;
  remedyReason?: string;
  isWaselInvoice?: boolean;
  waselReason?: string;
  waselRecipientName?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  note?: string;
  queueNumber?: number;
  queueTicketId?: string;
  salonId?: string;
  branchId?: string;
  isOpen?: boolean;
  openedBy?: string;
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
  timezone?: string; // المنطقة الزمنية المعتمدة للصالون (مثل Asia/Riyadh, Africa/Cairo)
  phone: string; 
  address: string; 
  logoUrl: string; 
  treasuries: Treasury[];
  printerName: string;
  paperSize: '80mm' | '58mm' | 'a4';
  printAutomatically: boolean;
  // Network / Kiosk Thermal Printer Settings (إعدادات طابعة الانتظار بالشبكة)
  thermalPrinterIp?: string; // عنوان IP الخاص بالطابعة أو الجهاز المتصل بها في الشبكة
  thermalPrinterPort?: number; // رقم المنفذ (مثل 9100 أو 8080 أو 80)
  kioskPrinterEndpoint?: string; // مسار الإرسال (مثل /print أو /api/print)
  kioskPrinterMethod?: 'direct_ip' | 'reception_auto' | 'both'; // طريقة الطباعة الشبكية
  isReceptionPrinterStation?: boolean; // هل هذا الجهاز هو محطة الطباعة التلقائية المتصلة بالطابعة
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
  aiProvider?: 'builtin' | 'gemini' | 'openai' | 'openrouter';
  aiApiKey?: string;
  aiModel?: string; // الموديل المختار: gemini-1.5-flash (الافتراضي), gemini-2.0-flash, gemini-1.5-pro, openai/gpt-4o-mini, etc.
  aiAssistantEnabled?: boolean; // تفعيل أو إلغاء تفعيل المساعد الذكي
  // OpenRouter Integration for Manager AI Chat
  openrouterApiKey?: string;
  openrouterModel?: string;
  tipsEnabled?: boolean; // تفعيل نظام البقشيش
  tipsDirectCashDeduction?: boolean; // خصم البقشيش من الكاش مباشرة
  tipPayoutMethod?: 'instant_cash' | 'pooled_deferred'; // طريقة صرف وسداد الإكراميات (فوري كاش أو مجمع مؤجل)
  allowNonCashTips?: boolean; // السماح بالبقشيش عبر طرق الدفع غير النقدية (فيزا / شبكة / تحويل)
  instantCommissionFromDrawer?: boolean; // صرف العمولة الفورية من الدرج مباشرة عند تنفيذ خدمة مستثناة من التارجت
  targetCalculationPolicy?: TargetCalculationPolicy; // 1: صافي المبيعات بعد خصم الراتب، 2: إجمالي المبيعات، 3: الشرائح المكتملة، 4: المنتجات والإحالات فقط
  targetStepAmount?: number; // خطوة التارجت للسياسة 3 (افتراضياً 1000)
  inactiveClientsTrackingEnabled?: boolean; // تفعيل أو تعطيل نظام متابعة العملاء المنقطعين (افتراضياً true)
  inactiveClientsDays?: number; // مدة متابعة العملاء الذين لم يحضروا بالأيام (افتراضياً 60 يوم وقابل للتعديل)
  depositRefundAllowedDays?: number; // مهلة استرجاع العربون بالأيام (0 = عدم السماح نهائياً)
  deposit_refund_allowed_days?: number;
  enableDualPricing?: boolean; // تفعيل سعرين للخدمة (مواطن وأجنبي)
}

export type TargetCalculationPolicy = 1 | 2 | 3 | 4 | 5;


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
  employeeCommission?: number;
  commissionAmount?: number;
  commission?: number;
  commissionableAmount?: number;
  isTargetExempt?: boolean;
  originalPrice?: number;
  discount?: number;
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
  advanceDeduction?: number;
  advancePayments?: AdvancePayment[];
  bookingId?: string;
  vatAmount?: number;
  cashbackUsed?: number;
  total: number;
  paid?: number;
  remaining?: number;
  dueDate?: string;
  notes?: string;
  badDebtReason?: string;
  badDebtAt?: string;
  badDebtBy?: string;
  paymentsHistory?: {
    id: string;
    date: string;
    amount: number;
    paymentMethod: string;
    treasuryId: string;
    notes?: string;
    createdBy?: string;
    shiftId?: string;
    shiftCode?: string;
  }[];
  status: 'completed' | 'cancelled' | 'refunded' | 'partially_paid' | 'deferred' | 'unpaid' | 'bad_debt'; 
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
  isWaselInvoice?: boolean;
  waselReason?: string;
  waselRecipientName?: string;
  relatedComplaintId?: string;
  originalInvoiceId?: string;
  // Sales Returns (مرتجعات المبيعات)
  hasReturn?: boolean;
  returnedAmount?: number;
  returnIds?: string[];
  shiftId?: string;
  shiftCode?: string;
  shiftDate?: string;
}

export interface ReturnInvoiceItem {
  id: string;
  itemId?: string;
  type: 'service' | 'product';
  name: string;
  originalQuantity: number;
  returnedQuantity: number;
  unitPrice: number;
  lineDiscount?: number;
  netRefundAmount: number;
  employeeId?: string;
  employeeName?: string;
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  originalInvoiceId?: string;
  originalInvoiceNumber?: string;
  isGeneralReturn?: boolean; // مرتجع أصناف عام بدون فاتورة
  salonId?: string;
  branchId?: string;
  branchCode?: string;
  date: string;
  time: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  items: ReturnInvoiceItem[];
  totalRefundAmount: number;
  refundMethod: 'cash' | 'card' | 'bank' | 'treasury' | 'client_balance';
  treasuryId?: string;
  treasuryName?: string;
  reason: 'defective' | 'wrong_order' | 'customer_request' | 'service_unsatisfactory' | 'other';
  reasonText?: string;
  notes?: string;
  createdByName?: string;
  createdById?: string;
  status: 'completed';
  createdAt: string;
}

// ============================================================
// 1. نظام إدارة الشركاء ورأس المال (Partners Management)
// ============================================================
export interface Partner {
  id: string;
  salonId?: string;
  tenantId?: string;
  name: string;
  phone: string;
  idNumber?: string;
  status: 'active' | 'exiting' | 'exited' | 'suspended'; // حالة الشريك
  capitalShare: number; // حصة رأس المال المدفوعة الفعلية
  sharePercentage: number; // النسبة المئوية الدقيقة من إجمالي رأس المال %
  maxDrawingsCap?: number; // سقف السحوبات المسموح كسلف على الأرباح
  debitBalance?: number; // رصيد ذمم مدين مرحّل (مستحق السداد للصالون)
  totalWithdrawn?: number; // إجمالي المسحوبات
  totalProfitReceived?: number; // إجمالي الأرباح المستلمة
  openingBalance?: number;
  joinDate: string;
  exitDate?: string;
  notes?: string;
  isActive: boolean;
}

export interface PartnerTransaction {
  id: string;
  salonId?: string;
  tenantId?: string;
  partnerId: string;
  partnerName: string;
  type: 'deposit' | 'withdrawal' | 'profit_share'; // إيداع رأس مال / مسحوبات شريك / توزيع أرباح
  amount: number;
  date: string;
  treasuryId: string;
  treasuryName?: string;
  description: string;
  createdBy?: string;
  treasuryId?: string;
  paymentMethod?: string;
  finalTotal?: number;
  isRemedyInvoice?: boolean;
  remedyReason?: string;
  isWaselInvoice?: boolean;
  waselReason?: string;
  waselRecipientName?: string;
  shiftId?: string;
  shiftCode?: string;
  shiftDate?: string;
  createdAt?: string;
  invoiceNumber?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  remedyApprovedBy?: string;
  complaintId?: string;
}

export interface PartnerDrawing {
  id: string;
  salonId?: string;
  tenantId?: string;
  partnerId: string;
  partnerName?: string;
  amount: number;
  drawingDate: string;
  drawingType: 'profit_advance' | 'personal_drawing' | 'emergency';
  treasuryId?: string;
  treasuryName?: string;
  notes?: string;
  createdBy?: string;
  isSettled: boolean;
  settlementId?: string;
}

export interface ProfitDistribution {
  id: string;
  salonId?: string;
  tenantId?: string;
  partnerId: string;
  partnerName?: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  distributableProfitPool: number;
  partnerSharePercentage: number;
  grossProfitShare: number;
  capitalAdditionAmount?: number; // المبلغ المضاف لزيادة رأس مال الشريك
  newCapitalShare?: number; // رأس مال الشريك الجديد بعد التعلية
  drawingsDeducted: number;
  priorDebitDeducted: number;
  netPayableAmount: number;
  carriedDebitBalance: number;
  status: 'draft' | 'approved' | 'paid' | 'carried_forward';
  distributionDate: string;
  approvedBy?: string;
  notes?: string;
}

export interface PartnerExitInstallment {
  id: string;
  salonId?: string;
  tenantId?: string;
  partnerId: string;
  partnerName?: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: string;
  treasuryId?: string;
  paymentReference?: string;
  notes?: string;
}

// ============================================================
// 2. نظام البرومو كود وأكواد المشاهير (Promo Codes System)
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
  clientId?: string;
  clientPhone: string;
  clientName?: string;
  invoiceId?: string;
  discountApplied: number;
  usedAt: string;
}

// ============================================================
// 3. نظام البقشيش (Tips Management)
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
// 4. نظام عهد الموظفين (Employee Custodies)
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
// 5. سجل حركات وسحوبات البصمة (Fingerprint Logs)
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
  processedDate?: string;
  processed_date?: string;
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
  shiftId?: string;
  shiftCode?: string;
  bookingId?: string;
  branchId?: string;
  branchCode?: string;
  salonId?: string;
  isVoided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
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
  branchStocks?: Record<string, number>; // أرصدة المخزون مفصولة لكل فرع (branchId -> stock)
  branchReorderLimits?: Record<string, number>; // حد الطلب لكل فرع
  commission: number;
  barcode?: string;
  productType?: 'for_sale' | 'raw_material'; // 'للبيع' | 'مادة خام'
  salonId?: string;
  branchId?: string;
  branchCode?: string;
  isActive?: boolean;
}

export function getProductStock(p: Product | null | undefined, branchId?: string): number {
  if (!p) return 0;
  if (branchId && p.branchStocks && p.branchStocks[branchId] !== undefined) {
    return Number(p.branchStocks[branchId]) || 0;
  }
  return Number(p.currentStock) || 0;
}

export function getProductReorderLimit(p: Product | null | undefined, branchId?: string): number {
  if (!p) return 5;
  if (branchId && p.branchReorderLimits && p.branchReorderLimits[branchId] !== undefined) {
    return Number(p.branchReorderLimits[branchId]) || 0;
  }
  return Number(p.reorderLimit ?? 5);
}

export function isClientInBranch(client: Client | null | undefined, activeBranchId?: string, branches: Branch[] = []): boolean {
  if (!client) return false;
  if (!branches || branches.length <= 1) return true;
  if (!activeBranchId) return true;
  const curBranch = branches.find(b => b.id === activeBranchId) || branches.find(b => b.isMain) || branches[0];
  const isMain = Boolean(curBranch?.isMain || curBranch?.id === branches[0]?.id);

  if (client.branchIds && Array.isArray(client.branchIds) && client.branchIds.length > 0) {
    if (client.branchIds.includes(activeBranchId)) return true;
    if (curBranch?.code && client.branchIds.includes(curBranch.code)) return true;
    if (curBranch?.name && client.branchIds.includes(curBranch.name)) return true;
  }

  const bId = ((client.branchId || (client as any).branch_id) || '').trim();
  const bCode = ((client as any).branchCode || (client as any).branch_code || '').trim();

  if (bId) {
    if (curBranch?.id && bId === curBranch.id) return true;
    if (curBranch?.code && bId.toLowerCase() === curBranch.code.toLowerCase()) return true;
    if (curBranch?.name && bId.toLowerCase() === curBranch.name.toLowerCase()) return true;
    return false;
  }
  if (bCode && curBranch?.code) {
    if (bCode.toLowerCase() === curBranch.code.toLowerCase()) return true;
    return false;
  }

  return isMain;
}

export function getServicePrice(service: ServiceItem | null | undefined, branchId?: string, isForeigner?: boolean): number {
  if (!service) return 0;
  if (isForeigner) {
    if (branchId && service.branchForeignerPrices && service.branchForeignerPrices[branchId] !== undefined) {
      return Number(service.branchForeignerPrices[branchId]);
    }
    if (service.foreignerPrice !== undefined && service.foreignerPrice !== null && Number(service.foreignerPrice) > 0) {
      return Number(service.foreignerPrice);
    }
  }
  if (branchId && service.branchPrices && service.branchPrices[branchId] !== undefined) {
    return Number(service.branchPrices[branchId]);
  }
  return Number(service.price || 0);
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

// ==============================================================================
// وحدة الاشتراكات والفوترة والباقات (Subscription & Billing Module)
// ==============================================================================
export type BillingCycle = '1m' | '3m' | '6m' | '12m';
export type BillingCurrency = 'EGP' | 'USD';

export interface SubscriptionPlan {
  id: string; // 'starter' | 'growth' | 'enterprise'
  planNameAr: string;
  planNameEn: string;
  descriptionAr?: string;
  minEmployees: number;
  maxEmployees: number; // 5, 10, 9999
  priceEgp1m: number;
  priceEgp3m: number;
  priceEgp6m: number;
  priceEgp12m: number;
  priceUsd1m: number;
  priceUsd3m: number;
  priceUsd6m: number;
  priceUsd12m: number;
  // أسعار إضافة الفرع المرخص المرتبطة بهذه الباقة
  branchPriceEgp1m?: number;
  branchPriceEgp3m?: number;
  branchPriceEgp6m?: number;
  branchPriceEgp12m?: number;
  branchPriceUsd1m?: number;
  branchPriceUsd3m?: number;
  branchPriceUsd6m?: number;
  branchPriceUsd12m?: number;
  features?: string[];
  isPopular?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

export interface SubscriptionAddon {
  id: string; // 'branch_license'
  addonName: string;
  addonNameAr: string;
  addonType: string;
  maxEmployeesPerBranch: number;
  priceEgp1m: number;
  priceEgp3m: number;
  priceEgp6m: number;
  priceEgp12m: number;
  priceUsd1m: number;
  priceUsd3m: number;
  priceUsd6m: number;
  priceUsd12m: number;
  descriptionAr?: string;
  isActive?: boolean;
}

export interface TenantSubscriptionRecord {
  id?: string;
  tenantId: string;
  salonId?: string;
  planId: string;
  status: 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled';
  startDate: string;
  endDate: string;
  totalBranches: number;
  totalEmployees: number;
  billingCycle?: BillingCycle;
  currency?: BillingCurrency;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  updatedAt?: string;
}
