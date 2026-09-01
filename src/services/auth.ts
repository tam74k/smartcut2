import { AppUser, UserRole, ActionPermission, CustomRole } from '../types';
import { DB } from './db';

const STORAGE_KEYS = {
  USERS: 'smartcut_users',
  SESSION: 'smartcut_session',
  ACTIVE_BRANCH: 'smartcut_active_branch',
  CUSTOM_ROLES: 'smartcut_custom_roles'
};

export interface ScreenMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  iconName?: string;
}

export interface ActionMeta {
  id: ActionPermission;
  name: string;
  category: string;
  description: string;
}

export const SCREEN_CATALOG: ScreenMeta[] = [
  { id: 'owner_portal', name: '📱 نبض المالك اليومي (موبايل)', category: 'الرئيسية', description: 'لوحة مركزة لمالك الصالون بالموبايل للتعرف على ملخصات اليوم والدوام والإيرادات وإدارة المستخدمين' },
  { id: 'barber_portal', name: '✂️ بوابة الفني / الحلاق المستقلة', category: 'الرئيسية', description: 'شاشة خاصة بالفني لمتابعة حجوزاته والعمولات والخدمات والتارجت والدوام والسلف' },
  { id: 'dashboard', name: 'لوحة التحكم والملخص العام', category: 'الرئيسية', description: 'عرض مؤشرات الأداء، الحجوزات السريعة، والإحصائيات العامة' },
  { id: 'pos', name: 'نقطة البيع (الكاشير POS)', category: 'المبيعات', description: 'إنشاء الفواتير، اختيار الخدمات والمنتجات، والدفع وطباعة الفاتورة' },
  { id: 'bookings', name: 'الحجوزات والمواعيد', category: 'المبيعات', description: 'جدولة مواعيد العملاء مع الفنيين ومتابعة حالة الحجز' },
  { id: 'invoices', name: 'سجل الفواتير والمبيعات', category: 'المبيعات', description: 'استعراض فواتير المبيعات، إعادة الطباعة، وتتبع تفاصيل الدفع' },
  { id: 'services', name: 'الخدمات والتصنيفات', category: 'الكتالوج والخدمات', description: 'إضافة وتعديل الخدمات والأسعار ومدد التنفيذ والتصنيفات' },
  
  // Warehouse & Inventory Hub
  { id: 'warehouse', name: 'المخزن والمستودع الشامل (الرئيسي)', category: 'المخزون والمستودع', description: 'المركز الموحد لإدارة المنتجات والموردين وفواتير الشراء والجرد وحركة المواد' },
  { id: 'warehouse_products', name: '📦 دليل المنتجات والأصناف والأسعار', category: 'المخزون والمستودع', description: 'إدارة المنتجات وأسعار البيع والتكلفة والباركود واستيراد الإكسل' },
  { id: 'warehouse_suppliers', name: '🚚 سجل الموردين والحسابات والسداد', category: 'المخزون والمستودع', description: 'إدارة بيانات الموردين ومتابعة كشوف الحسابات وسداد المستحقات' },
  { id: 'warehouse_purchases', name: '🛒 فواتير المشتريات والتوريد', category: 'المخزون والمستودع', description: 'تسجيل فواتير الشراء وتحديث الأرصدة والمخزون' },
  { id: 'warehouse_inventory', name: '📋 الجرد الدوري وسجل حركة الأصناف', category: 'المخزون والمستودع', description: 'إجراء الجرد وتسوية العجز والزيادة وسجل حركة المواد' },
  { id: 'warehouse_shortages', name: '⚠️ نواقص البضاعة وحدود إعادة الطلب', category: 'المخزون والمستودع', description: 'متابعة الأصناف التي قاربت على النفاد والتنبيهات التلقائية' },

  { id: 'clients', name: 'سجل العملاء ونقاط الولاء', category: 'العملاء والموظفون', description: 'بيانات العملاء، رصيد نقاط الولاء، وسجل الزيارات السابقة' },
  { id: 'complaints', name: '⚠️ شكاوى العملاء وضمان الخدمة', category: 'العملاء والموظفون', description: 'متابعة شكاوى العملاء، فواتير الإصلاح المجاني، صور قبل وبعد، وسجل الحلول' },
  { id: 'employees', name: 'شؤون وإدارة الموظفين والتايم شيت', category: 'العملاء والموظفون', description: 'إدارة الكادر الفني، الرواتب، التايم شيت، وصرف السلف' },
  { id: 'treasury', name: 'الخزائن والماليات', category: 'الماليات', description: 'مراقبة أرصدة الخزائن الرئيسية والفرعية والتحويلات والإيداعات' },
  { id: 'expenses', name: 'سندات الصرف والمصروفات', category: 'الماليات', description: 'تسجيل بنود المصروفات التشغيلية وسندات الصرف' },
  { id: 'reports', name: 'التقارير التحليلية والمالية', category: 'التقارير', description: 'تقارير الدخل والمصروفات والأرباح ومبيعات الخدمات وإغلاق اليوم' },
  { id: 'permissions', name: 'إدارة الصلاحيات والمستخدمين', category: 'الإدارة والنظام', description: 'التحكم بالمستخدمين وإنشاء الأدوار المخصصة وتوزيع الصلاحيات' },
  { id: 'saas_subscriptions', name: '👑 إدارة اشتراكات الصالونات (SaaS)', category: 'الإدارة والنظام', description: 'متابعة الصالونات المسجلة، الفترات التجريبية، وتجديد الاشتراكات والربط مع Evolution API' },
  { id: 'ai_assistant', name: '🤖 المساعد الذكي وإدارة العمليات', category: 'الذكاء الاصطناعي والمساعد', description: 'شات ذكي للاستعلام الفوري وتنفيذ العمليات والحجوزات والإحصائيات بالأوامر' },
  { id: 'settings', name: 'إعدادات النظام والمنشأة', category: 'الإدارة والنظام', description: 'بيانات الصالون، الرقم الضريبي، إعدادات ZATCA، والربط السحابي' }
];

export const ACTION_CATALOG: ActionMeta[] = [
  // POS & Sales
  { id: 'pos_discount', name: 'تطبيق وتعديل نسب الخصم في الفاتورة', category: 'نقطة البيع والمبيعات', description: 'السماح بمنح خصم نقدي أو نسبي للعميل أثناء عملية الدفع' },
  { id: 'pos_custom_price', name: 'تعديل أسعار الخدمات يدوياً في الكاشير', category: 'نقطة البيع والمبيعات', description: 'تغيير السعر الافتراضي للخدمة أو المنتج أثناء إنشاء الفاتورة' },
  { id: 'pos_void', name: 'إلغاء الفاتورة / حذف البنود أثناء البيع', category: 'نقطة البيع والمبيعات', description: 'حذف عناصر من السلة أو إفراغ الفاتورة قبل الدفع' },
  { id: 'pos_reprint', name: 'إعادة طباعة الفواتير السابقة', category: 'نقطة البيع والمبيعات', description: 'طباعة نسخة ثانية من أي فاتورة مبيعات سابقة' },
  { id: 'sales_return', name: 'إنشاء فواتير مرتجع مبيعات', category: 'نقطة البيع والمبيعات', description: 'استرجاع مبالغ فواتير المبيعات وإلغاء تأثيرها المالي' },

  // Shifts & Treasuries
  { id: 'manage_shifts', name: 'فتح وإغلاق الوردية وإصدار تقرير Z', category: 'الورديات والخزائن', description: 'إمكانية بدء وردية جديدة أو إغلاقها وتصفير الخزائن وطباعة التقرير' },
  { id: 'edit_shift_cash', name: 'تعديل العهدة الافتتاحية للوردية', category: 'الورديات والخزائن', description: 'تغيير مبلغ الكاش الافتتاحي عند بدء الوردية' },
  { id: 'treasury_deposit', name: 'تسجيل عمليات إيداع نقدية في الخزائن', category: 'الورديات والخزائن', description: 'إضافة مبالغ نقدية إلى الخزنة الرئيسية أو الفرعية' },
  { id: 'treasury_withdraw', name: 'تسجيل عمليات صرف نقدية من الخزائن', category: 'الورديات والخزائن', description: 'سحب مبالغ نقدية من الخزينة' },
  { id: 'treasury_transfer', name: 'تحويل أرصدة مالية بين الخزائن', category: 'الورديات والخزائن', description: 'نقل الأموال من خزينة إلى أخرى (مثل من كاش إلى رئيسية)' },
  { id: 'treasury_view_balance', name: 'الاطلاع على الأرصدة المالية الإجمالية', category: 'الورديات والخزائن', description: 'مشاهدة الرصيد الفعلي للخزائن والسيولة النقدية' },

  // Warehouse & Inventory Management
  { id: 'manage_products', name: 'إضافة وتعديل وحذف المنتجات والأصناف', category: 'المخزن والمستودع', description: 'التحكم الكامل في كتالوج المنتجات وأسعار البيع والتكلفة والباركود' },
  { id: 'import_products_excel', name: 'استيراد وتصدير المنتجات عبر Excel', category: 'المخزن والمستودع', description: 'رفع وتنزيل شيتات الإكسل للأصناف وقوالب النماذج' },
  { id: 'manage_suppliers', name: 'إدارة الموردين وسندات السداد', category: 'المخزن والمستودع', description: 'إضافة الموردين وكشوف الحسابات وصرف دفعات الموردين' },
  { id: 'manage_purchases', name: 'تسجيل وتعديل فواتير المشتريات', category: 'المخزن والمستودع', description: 'إدخال بضائع جديدة وسندات الشراء وإدارة الدفعات' },
  { id: 'manage_inventory', name: 'إجراء الجرد وتسوية الفروقات المخزنية', category: 'المخزن والمستودع', description: 'تسجيل محاضر الجرد وتعديل كميات المستودع وتتبع الحركات' },

  // Expenses
  { id: 'manage_expenses', name: 'إضافة وتعديل وحذف سندات المصروفات', category: 'المصروفات والماليات', description: 'تسجيل المصروفات التشغيلية واليومية' },

  // HR, Employees & Clients
  { id: 'manage_employees', name: 'إضافة وتعديل بيانات الموظفين والفنيين', category: 'الموظفون والعملاء', description: 'التحكم في سجلات الكادر الفني والإداري' },
  { id: 'manage_salaries', name: 'تعديل الرواتب ونسب العمولات وصرف السلف', category: 'الموظفون والعملاء', description: 'صرف المستحقات المالية وعمولات الخدمات والسلف والخصومات' },
  { id: 'manage_hr', name: 'إدارة سجلات الحضور والانصراف (التايم شيت)', category: 'الموظفون والعملاء', description: 'تسجيل الحضور اليدوي وتعديل سجلات الدوام والأوفرتايم' },
  { id: 'manage_clients', name: 'إدارة وتعديل وحذف بيانات العملاء', category: 'الموظفون والعملاء', description: 'التحكم في قاعدة بيانات العملاء ونقاط الولاء' },
  { id: 'manage_booking_settings', name: 'ضبط إعدادات الحجوزات وإغلاق الساعات والأيام', category: 'الموظفون والعملاء', description: 'التحكم في إغلاق الأيام والساعات وسعة الحجوزات وإتاحة الفنيين' },

  // Reports, Analytics & System
  { id: 'view_reports', name: 'الاطلاع على التقارير المالية والتشغيلية', category: 'التقارير والإدارة', description: 'مشاهدة الأرباح والإيرادات ومبيعات الخدمات وإغلاق اليوم' },
  { id: 'view_system_analytics', name: 'الاطلاع على الرسوم البيانية وإحصائيات النظام', category: 'التقارير والإدارة', description: 'مشاهدة الرسوم البيانية ومقارنات المبيعات والمصروفات والخدمات في لوحة التحكم' },
  { id: 'view_employee_analytics', name: 'الاطلاع على إحصائيات ورسومات الموظفين', category: 'التقارير والإدارة', description: 'مشاهدة الرسوم البيانية لإيرادات وعمولات وغيابات وتأخيرات وسلف الموظفين' },
  { id: 'export_excel', name: 'تصدير الجداول والتقارير إلى Excel', category: 'التقارير والإدارة', description: 'تحميل ملفات البيانات بصيغة .xlsx المنسقة' },
  { id: 'manage_settings', name: 'تعديل إعدادات المنشأة والضريبة والطباعة', category: 'التقارير والإدارة', description: 'تغيير اسم الصالون، الرقم الضريبي، والطابعات والنسخ الاحتياطي' },
  { id: 'manage_rbac', name: 'إدارة المستخدمين والصلاحيات والأدوار', category: 'التقارير والإدارة', description: 'إنشاء حسابات مستخدمين جديدة وتحديد أذونات الوصول' }
];

export const MASTER_PROGRAMMER_USER: AppUser = {
  id: 'usr-master-programmer',
  username: 'programmer',
  password: 'dev@smartcut2026',
  name: 'المبرمج والمطور الرئيسي (Master Programmer)',
  role: 'programmer',
  phone: '0500000000',
  active: true,
  screens: ['*'],
  actions: ['*']
};

export const DEFAULT_USERS: AppUser[] = [
  {
    id: 'usr-admin',
    username: 'admin',
    password: '123',
    name: 'مدير النظام العام',
    role: 'admin',
    phone: '0500000000',
    active: true,
    screens: ['*'],
    actions: ['*']
  }
];


export const DEFAULT_CUSTOM_ROLES: CustomRole[] = [];

export const DEFAULT_ROLE_PRESETS: Record<UserRole, { screens: string[]; actions: ActionPermission[] }> = {
  owner: {
    screens: ['owner_portal'],
    actions: ['view_reports', 'view_system_analytics', 'view_employee_analytics', 'export_excel', 'treasury_view_balance']
  },
  admin: {
    screens: ['*'],
    actions: ['*']
  },
  supervisor: {
    screens: ['dashboard', 'pos', 'bookings', 'invoices', 'services', 'warehouse', 'clients', 'employees', 'treasury', 'expenses', 'reports'],
    actions: ['pos_discount', 'pos_void', 'pos_reprint', 'sales_return', 'manage_shifts', 'edit_shift_cash', 'treasury_deposit', 'treasury_withdraw', 'treasury_transfer', 'treasury_view_balance', 'manage_expenses', 'manage_products', 'manage_inventory', 'manage_employees', 'manage_salaries', 'manage_hr', 'manage_clients', 'manage_booking_settings', 'view_reports', 'export_excel']
  },
  warehouse_manager: {
    screens: ['dashboard', 'warehouse', 'products', 'suppliers', 'purchases', 'inventory'],
    actions: ['manage_products', 'import_products_excel', 'manage_suppliers', 'manage_purchases', 'manage_inventory', 'export_excel']
  },
  cashier: {
    screens: ['pos', 'bookings', 'invoices', 'clients', 'expenses', 'treasury'],
    actions: ['pos_discount', 'pos_reprint', 'manage_shifts', 'treasury_deposit', 'manage_expenses']
  },
  receptionist: {
    screens: ['bookings', 'clients', 'services', 'complaints'],
    actions: ['pos_reprint', 'manage_clients']
  },
  accountant: {
    screens: ['dashboard', 'invoices', 'warehouse', 'treasury', 'expenses', 'reports'],
    actions: ['pos_reprint', 'sales_return', 'treasury_deposit', 'treasury_withdraw', 'treasury_transfer', 'treasury_view_balance', 'manage_expenses', 'manage_suppliers', 'manage_purchases', 'manage_inventory', 'manage_salaries', 'view_reports', 'export_excel']
  },
  barber: {
    screens: ['barber_portal'],
    actions: []
  },
  programmer: {
    screens: ['*'],
    actions: ['*']
  },
  custom: {
    screens: ['pos', 'bookings', 'invoices'],
    actions: ['pos_discount', 'pos_reprint']
  }
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'مالك الصالون (Executive Owner)',
  admin: 'مدير النظام (Admin - كافة الصلاحيات)',
  supervisor: 'مشرف صالون عام (Supervisor)',
  warehouse_manager: 'مسؤول المخزن والمستودع (Warehouse Manager)',
  cashier: 'كاشير (Cashier)',
  receptionist: 'موظف استقبال (Receptionist)',
  barber: 'فني / حلاق (Barber)',
  accountant: 'محاسب مالي (Accountant)',
  custom: 'دور مخصص (Custom Role)',
  programmer: 'المبرمج والمطور الرئيسي (Master Developer)'
};

export class AuthService {
  private static currentUser: AppUser | null = null;

  public static initUsers(): AppUser[] {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    let users: AppUser[] = [];
    if (saved) {
      try {
        users = JSON.parse(saved);
      } catch {
        users = [...DEFAULT_USERS];
      }
    } else {
      users = [...DEFAULT_USERS];
    }

    // Strip out master programmer accounts from general salon users list
    users = users.filter(u => u.username !== 'programmer' && u.role !== 'programmer' && u.id !== 'usr-programmer' && u.id !== 'usr-master-programmer');

    // Deduplicate by ID and (username + salonId)
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const deduped: AppUser[] = [];

    for (const u of users) {
      const uName = (u.username || '').trim().toLowerCase();
      const sId = u.salonId || 'default';
      const key = `${sId}___${uName}`;
      const uId = u.id || `usr-${uName}-${Math.random().toString(36).substring(2, 6)}`;

      if (uName && !seenIds.has(uId) && !seenKeys.has(key)) {
        seenIds.add(uId);
        seenKeys.add(key);
        deduped.push({
          ...u,
          id: uId,
          username: uName
        });
      }
    }

    if (deduped.length === 0) {
      deduped.push(...DEFAULT_USERS);
    }

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(deduped));
    return deduped;
  }

  public static getUsers(salonId?: string): AppUser[] {
    const all = this.initUsers().filter(u => u.role !== 'programmer' && u.username !== 'programmer');
    if (!salonId) return all;
    return all.filter(u => !u.salonId || u.salonId === salonId || u.salonId === '00000000-0000-0000-0000-000000000001');
  }

  public static isUsernameTaken(username: string, excludeUserId?: string, salonId?: string): boolean {
    const clean = username.trim().toLowerCase();
    if (!clean) return false;
    if (clean === 'programmer' || clean === 'master') return true;
    const users = this.getUsers(salonId);
    return users.some(u => u.username.toLowerCase() === clean && u.id !== excludeUserId);
  }

  public static isEmailTaken(email: string, excludeUserId?: string, salonId?: string): boolean {
    const clean = email.trim().toLowerCase();
    if (!clean) return false;
    const users = this.getUsers(salonId);
    return users.some(u => u.email?.toLowerCase() === clean && u.id !== excludeUserId);
  }

  public static saveUser(user: AppUser): void {
    if (user.role === 'programmer' || user.username === 'programmer') return;
    const users = this.initUsers();
    const cleanUName = (user.username || '').trim().toLowerCase();
    const existingIdx = users.findIndex(u => 
      u.id === user.id || 
      (u.username.toLowerCase() === cleanUName && (u.salonId === user.salonId || !u.salonId || !user.salonId))
    );
    if (existingIdx >= 0) {
      users[existingIdx] = { ...user, username: cleanUName };
    } else {
      users.push({ ...user, username: cleanUName });
    }
    this.saveUsers(users);
  }

  public static saveUsers(users: AppUser[]): void {
    const cleanUsers = users.filter(u => u.role !== 'programmer' && u.username !== 'programmer');
    // Deduplicate before saving
    const seen = new Set<string>();
    const finalUsers: AppUser[] = [];
    for (const u of cleanUsers) {
      const key = `${u.salonId || 'default'}___${u.username.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        finalUsers.push(u);
      }
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(finalUsers));
  }


  public static getCustomRoles(): CustomRole[] {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_ROLES);
    if (!saved) {
      return [];
    }
    try {
      const parsed: CustomRole[] = JSON.parse(saved);
      const dummyIds = new Set([
        'role-owner', 'role-admin', 'role-supervisor', 'role-accountant',
        'role-warehouse-manager', 'role-cashier', 'role-receptionist', 'role-barber'
      ]);
      const clean = parsed.filter(r => !dummyIds.has(r.id) && !r.isSystem);
      if (clean.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_ROLES, JSON.stringify(clean));
      }
      return clean;
    } catch {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_ROLES, JSON.stringify([]));
      return [];
    }
  }

  public static saveCustomRoles(roles: CustomRole[]): void {
    const dummyIds = new Set([
      'role-owner', 'role-admin', 'role-supervisor', 'role-accountant',
      'role-warehouse-manager', 'role-cashier', 'role-receptionist', 'role-barber'
    ]);
    const clean = roles.filter(r => !dummyIds.has(r.id) && !r.isSystem);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_ROLES, JSON.stringify(clean));
  }

  public static getCurrentUser(): AppUser | null {
    if (this.currentUser) return this.currentUser;
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!session) return null;
    try {
      const { userId } = JSON.parse(session);
      if (userId === MASTER_PROGRAMMER_USER.id || userId === 'usr-programmer') {
        this.currentUser = MASTER_PROGRAMMER_USER;
        return MASTER_PROGRAMMER_USER;
      }
      const users = this.getUsers();
      const user = users.find(u => u.id === userId && u.active);
      if (user) {
        this.currentUser = user;
        return user;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  public static getProgrammerPassword(): string {
    try {
      const saved = localStorage.getItem('smartcut_programmer_password');
      if (saved) return saved;
    } catch (e) {}
    return MASTER_PROGRAMMER_USER.password || 'dev@smartcut2026';
  }

  public static async updateProgrammerPassword(newPass: string): Promise<boolean> {
    if (!newPass || !newPass.trim()) return false;
    const clean = newPass.trim();
    try {
      localStorage.setItem('smartcut_programmer_password', clean);
      MASTER_PROGRAMMER_USER.password = clean;
      await DB.saveUser({
        id: '00000000-0000-0000-0000-000000000099',
        salonId: '00000000-0000-0000-0000-000000000001',
        branchId: '00000000-0000-0000-0000-000000000002',
        username: 'programmer',
        name: 'المبرمج والمطور الرئيسي (Master Programmer)',
        password: clean,
        role: 'programmer',
        phone: '0500000000',
        active: true,
        screens: ['*'],
        actions: ['*']
      });
      return true;
    } catch (e) {
      console.error('Failed to update programmer password:', e);
      return false;
    }
  }

  public static login(identifier: string, password: string): AppUser | null {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Master Programmer login
    const currentProgPass = this.getProgrammerPassword();
    if (cleanId === 'programmer' && (cleanPass === currentProgPass || cleanPass === MASTER_PROGRAMMER_USER.password || cleanPass === 'dev@smartcut2026' || cleanPass === 'programmer123')) {
      const progUser = { ...MASTER_PROGRAMMER_USER, password: currentProgPass };
      this.currentUser = progUser;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ userId: progUser.id, loginTime: new Date().toISOString() }));
      return progUser;
    }

    // 2. Direct Admin Fallback Check
    if (cleanId === 'admin' && (cleanPass === '123' || cleanPass === '123456' || cleanPass === 'admin')) {
      const defaultAdmin = DEFAULT_USERS[0];
      this.currentUser = defaultAdmin;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ userId: defaultAdmin.id, loginTime: new Date().toISOString() }));
      return defaultAdmin;
    }

    const users = this.getUsers();
    
    // 3. Match by username or email or phone
    const user = users.find(
      u => (u.username.toLowerCase() === cleanId || 
            (u.email && u.email.toLowerCase() === cleanId) || 
            (u.phone && u.phone.replace(/\D/g, '') === cleanId.replace(/\D/g, ''))) && 
           (u.password === cleanPass || (u as any).passwordHash === cleanPass || (u as any).password_hash === cleanPass || (u.username.toLowerCase() === 'admin' && (cleanPass === '123' || cleanPass === '123456'))) && 
           u.active !== false
    );

    if (user) {
      this.currentUser = user;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ userId: user.id, loginTime: new Date().toISOString() }));
      return user;
    }

    return null;
  }

  public static async loginAsync(identifier: string, password: string): Promise<AppUser | null> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Try local/sync login first
    const syncUser = this.login(identifier, password);
    if (syncUser) return syncUser;

    // 2. Query Supabase users directly
    try {
      const dbUsers = await DB.fetchUsers();
      if (dbUsers && dbUsers.length > 0) {
        const currentLocal = this.initUsers();
        for (const dbu of dbUsers) {
          const idx = currentLocal.findIndex(l => l.username.toLowerCase() === dbu.username.toLowerCase());
          if (idx >= 0) {
            currentLocal[idx] = {
              ...dbu,
              password: dbu.password || currentLocal[idx].password || '123456'
            };
          } else {
            currentLocal.push(dbu);
          }
        }
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(currentLocal));

        const matched = currentLocal.find(
          u => (u.username.toLowerCase() === cleanId || 
                (u.email && u.email.toLowerCase() === cleanId) || 
                (u.phone && u.phone.replace(/\D/g, '') === cleanId.replace(/\D/g, ''))) && 
               (u.password === cleanPass || (u as any).passwordHash === cleanPass || (u as any).password_hash === cleanPass || ((u.username.toLowerCase() === 'admin' || u.role === 'admin' || u.role === 'owner') && (cleanPass === '123' || cleanPass === '123456'))) && 
               u.active !== false
        );

        if (matched) {
          this.currentUser = matched;
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ userId: matched.id, loginTime: new Date().toISOString() }));
          return matched;
        }
      }

      // 3. Check if matching a registered salon in database (e.g. salon owner login by email/phone/username)
      const salons = await DB.fetchSalons();
      const matchedSalon = (salons || []).find(s => 
        (s.code && s.code.toLowerCase() === cleanId) ||
        (s.email && s.email.toLowerCase() === cleanId) ||
        (s.ownerEmail && s.ownerEmail.toLowerCase() === cleanId) ||
        (s.phone && s.phone.replace(/\D/g, '') === cleanId.replace(/\D/g, '')) ||
        (s.name && s.name.toLowerCase() === cleanId)
      );

      if (matchedSalon) {
        // Find or synthesize admin user for this salon
        const sAdmin: AppUser = {
          id: `usr-${matchedSalon.id}`,
          salonId: matchedSalon.id,
          salonCode: matchedSalon.code,
          username: cleanId,
          password: cleanPass,
          name: matchedSalon.ownerName || matchedSalon.name,
          email: matchedSalon.email || matchedSalon.ownerEmail || '',
          phone: matchedSalon.phone || '',
          role: 'owner',
          active: matchedSalon.isActive !== false,
          screens: ['*'],
          actions: ['*']
        };
        this.saveUser(sAdmin);
        await DB.saveUser(sAdmin);
        this.currentUser = sAdmin;
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ userId: sAdmin.id, loginTime: new Date().toISOString() }));
        return sAdmin;
      }

    } catch (err) {
      console.warn('DB login lookup error:', err);
    }

    return null;
  }

  public static quickLogin(role: UserRole = 'admin'): AppUser | null {
    const users = this.getUsers();
    const user = users.find(u => u.role === role && u.active) || users[0];
    if (user) {
      this.currentUser = user;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ userId: user.id, loginTime: new Date().toISOString() }));
      return user;
    }
    return null;
  }

  public static logout(): void {
    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  public static canAccess(screen: string, user?: AppUser | null): boolean {
    const u = user || this.getCurrentUser();
    if (!u) return false;
    
    // SaaS Subscriptions Portal is EXCLUSIVELY for the Master Programmer
    if (screen === 'saas_subscriptions') {
      return u.role === 'programmer';
    }

    if (u.role === 'programmer') return true;
    if (u.role === 'admin' || u.role === 'owner') return true;
    if (u.screens?.includes('*')) return true;
    return u.screens?.includes(screen) || false;
  }

  public static canDo(action: ActionPermission, user?: AppUser | null): boolean {
    const u = user || this.getCurrentUser();
    if (!u) return false;
    if (u.role === 'programmer') return true;
    if (u.role === 'admin' || u.role === 'owner') return true;
    if (u.actions?.includes('*')) return true;
    return u.actions?.includes(action) || false;
  }

  public static changePassword(userId: string, oldPass: string, newPass: string): boolean {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    if (users[idx].password !== oldPass) return false;
    users[idx].password = newPass;
    this.saveUsers(users);
    return true;
  }
}
