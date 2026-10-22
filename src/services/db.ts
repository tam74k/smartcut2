import { SupabaseService } from './supabase';
import { dataUrlToBlob } from '../utils/imageUpload';
import { HeldInvoice } from '../types';
import { sealUserRecord } from '../utils/securityCrypto';
import { localSalonTimeToUtcIso, utcToSalonLocal, getSalonTimezone } from '../utils/timezone';

// ============================================================
// SmartCut DB Service — طبقة البيانات الموحدة
// تحوّل بين camelCase (TypeScript) وsnake_case (PostgreSQL)
// ============================================================

const sb = () => SupabaseService.getClient();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toSalonUUID(id?: string | null): string {
  if (id && UUID_REGEX.test(id)) return id;
  try {
    const active = localStorage.getItem('smartcut_active_salon_id');
    if (active && UUID_REGEX.test(active)) return active;

    const currentUser = localStorage.getItem('smartcut_current_user');
    if (currentUser) {
      const parsedUser = JSON.parse(currentUser);
      if (parsedUser?.salonId && UUID_REGEX.test(parsedUser.salonId)) return parsedUser.salonId;
      if (parsedUser?.salon_id && UUID_REGEX.test(parsedUser.salon_id)) return parsedUser.salon_id;
    }

    const session = localStorage.getItem('smartcut_session');
    if (session) {
      const parsedSession = JSON.parse(session);
      const user = parsedSession?.user || parsedSession;
      if (user?.salonId && UUID_REGEX.test(user.salonId)) return user.salonId;
      if (user?.salon_id && UUID_REGEX.test(user.salon_id)) return user.salon_id;
      if (parsedSession?.salonId && UUID_REGEX.test(parsedSession.salonId)) return parsedSession.salonId;
    }

    const s = localStorage.getItem('smartcut_app_settings');
    const parsed = s ? JSON.parse(s) : null;
    if (parsed?.salonId && UUID_REGEX.test(parsed.salonId)) return parsed.salonId;
    if (parsed?.salon_id && UUID_REGEX.test(parsed.salon_id)) return parsed.salon_id;

    if (id) {
      const storedSalons = localStorage.getItem('smartcut_salons');
      if (storedSalons) {
        const salonsList = JSON.parse(storedSalons);
        if (Array.isArray(salonsList) && salonsList.length > 0) {
          const match = salonsList.find((sl: any) => sl.id === id || sl.code?.toLowerCase() === id.toLowerCase() || sl.salonCode?.toLowerCase() === id.toLowerCase());
          if (match && UUID_REGEX.test(match.id)) return match.id;
        }
      }
    }
  } catch (e) {}
  return (id && UUID_REGEX.test(id)) ? id : '11111111-1111-4111-8111-111111111111';
}

export function toBranchUUID(id?: string | null): string | null {
  if (!id) return null;
  if (UUID_REGEX.test(id)) return id;
  return null;
}

export function toBool(val: any): boolean {
  if (val === true || val === 1 || val === '1' || val === '1.0' || val === 'true' || val === 'TRUE') return true;
  if (val === false || val === 0 || val === '0' || val === '0.0' || val === 'false' || val === 'FALSE' || val === null || val === undefined) return false;
  const num = Number(val);
  if (!isNaN(num)) return num > 0;
  return false;
}

export function toDateOrNull(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str === 'undefined' || str === 'null') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  return null;
}

// ---- تحويل snake_case → camelCase ----
export function toCamel(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-zA-Z0-9])/g, (_, c) => c.toUpperCase()),
      toCamel(v)
    ])
  );
}

// ---- تحويل camelCase → snake_case ----
export function toSnake(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnake);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/([A-Z])/g, '_$1').toLowerCase(),
      v instanceof Object && !Array.isArray(v) && !(v instanceof Date) ? toSnake(v) : v
    ])
  );
}

// ---- تحديد معرف الصالون ----
function getSalonId(): string {
  try {
    const active = localStorage.getItem('smartcut_active_salon_id');
    if (active && UUID_REGEX.test(active)) return active;

    const currentUser = localStorage.getItem('smartcut_current_user');
    if (currentUser) {
      const parsedUser = JSON.parse(currentUser);
      if (parsedUser?.salonId && UUID_REGEX.test(parsedUser.salonId)) return parsedUser.salonId;
      if (parsedUser?.salon_id && UUID_REGEX.test(parsedUser.salon_id)) return parsedUser.salon_id;
    }

    const session = localStorage.getItem('smartcut_session');
    if (session) {
      const parsedSession = JSON.parse(session);
      const user = parsedSession?.user || parsedSession;
      if (user?.salonId && UUID_REGEX.test(user.salonId)) return user.salonId;
      if (user?.salon_id && UUID_REGEX.test(user.salon_id)) return user.salon_id;
      if (parsedSession?.salonId && UUID_REGEX.test(parsedSession.salonId)) return parsedSession.salonId;
    }

    const s = localStorage.getItem('smartcut_app_settings');
    const parsed = s ? JSON.parse(s) : null;
    if (parsed?.salonId && UUID_REGEX.test(parsed.salonId)) return parsed.salonId;
    if (parsed?.salon_id && UUID_REGEX.test(parsed.salon_id)) return parsed.salon_id;

    return '11111111-1111-4111-8111-111111111111';
  } catch { return '11111111-1111-4111-8111-111111111111'; }
}

// ============================================================
// نظام الفحص والإنشاء التلقائي للأعمدة (Self-Healing Schema Engine) - Hardened Against SQLi
// ============================================================
const verifiedColumns = new Set<string>();
const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z0-9_]+$/;
const SAFE_TYPE_REGEX = /^(?:TEXT|VARCHAR\(\d+\)|BOOLEAN|INT|INTEGER|BIGINT|NUMERIC\(\d+(?:,\s*\d+)?\)|TIMESTAMPTZ|DATE|JSONB|UUID)$/i;

export async function ensureColumn(table: string, column: string, type: string = 'TEXT'): Promise<boolean> {
  const cleanTable = table.trim();
  const cleanColumn = column.trim();
  const cleanType = type.trim();

  // Strict Validation to prevent SQL / DDL injection
  if (!SAFE_IDENTIFIER_REGEX.test(cleanTable) || !SAFE_IDENTIFIER_REGEX.test(cleanColumn) || !SAFE_TYPE_REGEX.test(cleanType)) {
    console.warn(`[Security] ensureColumn rejected invalid identifier or type: ${cleanTable}.${cleanColumn} (${cleanType})`);
    return false;
  }

  const cacheKey = `${cleanTable}.${cleanColumn}`;
  if (verifiedColumns.has(cacheKey)) return true;

  const client = sb();
  if (!client) return false;

  try {
    // Invoke secure parameter-bound RPC
    const { data, error } = await client.rpc('add_column_if_not_exists', {
      p_table: cleanTable,
      p_column: cleanColumn,
      p_type: cleanType
    });
    if (!error && (data === true || data === null)) {
      verifiedColumns.add(cacheKey);
      return true;
    }
  } catch {
    /* Silent fail */
  }

  return false;
}

// فحص واستخدام Bucket في Supabase Storage
export async function ensureStorageBucket(bucketName: string = 'services'): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    const { data: buckets } = await client.storage.listBuckets();
    const exists = buckets?.some(b => b.name === bucketName || b.id === bucketName);
    if (!exists) {
      try {
        await client.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 2097152 // 2MB max per service image
        });
      } catch {}
    }
    return true;
  } catch {
    return true;
  }
}

// فحص واستباق إنشاء الأعمدة الأساسية الحديثة في قاعدة البيانات
export async function ensureCoreSchema(): Promise<void> {
  try {
    await Promise.allSettled([
      ensureColumn('platform_settings', 'logo_url', 'TEXT'),
      ensureColumn('salons', 'salon_type', 'VARCHAR(20)'),
      ensureColumn('salons', 'evolution_instance_name', 'VARCHAR(100)'),
      ensureColumn('salons', 'evolution_api_key', 'TEXT'),
      ensureColumn('salons', 'evolution_api_url', 'TEXT'),
      ensureColumn('app_settings', 'salon_type', 'VARCHAR(20)'),
      ensureColumn('app_settings', 'evolution_instance_name', 'VARCHAR(100)'),
      ensureColumn('app_settings', 'evolution_api_key', 'TEXT'),
      ensureColumn('app_settings', 'evolution_api_url', 'TEXT'),
      ensureColumn('employees', 'custom_overtime_rate', 'NUMERIC(10,2)'),
      ensureColumn('employees', 'late_deduction_rules', 'JSONB'),
      ensureColumn('employees', 'permissions_limit', 'INT'),
      ensureColumn('services', 'image_url', 'TEXT'),
      ensureColumn('services', 'is_priority', 'BOOLEAN'),
      ensureColumn('services', 'card_color', 'VARCHAR(50)'),
      ensureColumn('services', 'priority_order', 'INT'),
      ensureColumn('work_shifts', 'shift_code', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'salon_id', 'UUID'),
      ensureColumn('work_shifts', 'branch_id', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'shift_date', 'VARCHAR(50)'),
      ensureColumn('work_shifts', 'opened_at', 'TIMESTAMPTZ'),
      ensureColumn('work_shifts', 'closed_at', 'TIMESTAMPTZ'),
      ensureColumn('work_shifts', 'opened_by_user_id', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'opened_by_user_name', 'VARCHAR(255)'),
      ensureColumn('work_shifts', 'opened_by_name', 'VARCHAR(255)'),
      ensureColumn('work_shifts', 'opened_by_role', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'closed_by_user_id', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'closed_by_user_name', 'VARCHAR(255)'),
      ensureColumn('work_shifts', 'closed_by_name', 'VARCHAR(255)'),
      ensureColumn('work_shifts', 'closed_by_role', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'initial_cash', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'expected_cash', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'actual_cash', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'cash_difference', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'total_sales', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'total_cash_sales', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'total_card_sales', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'total_expenses', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'transferred_to_treasury', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'transferred_amount', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'total_advances', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'status', 'VARCHAR(50)'),
      ensureColumn('invoices', 'shift_code', 'VARCHAR(100)'),
      ensureColumn('transactions', 'shift_code', 'VARCHAR(100)'),
      ensureColumn('app_settings', 'overtime_settings', 'JSONB'),
      ensureColumn('app_settings', 'attendance_settings', 'JSONB'),
      ensureColumn('app_settings', 'commission_settings', 'JSONB'),
      ensureColumn('custom_roles', 'screens', 'JSONB'),
      ensureColumn('custom_roles', 'actions', 'JSONB'),
      ensureColumn('custom_roles', 'is_system', 'BOOLEAN'),
      ensureColumn('purchase_invoices', 'paid_amount', 'NUMERIC(12,2)'),
      ensureColumn('purchase_invoices', 'remaining_amount', 'NUMERIC(12,2)'),
      ensureColumn('partners', 'salon_id', 'UUID'),
      ensureColumn('partners', 'tenant_id', 'TEXT'),
      ensureColumn('partners', 'status', 'VARCHAR(50)'),
      ensureColumn('partners', 'max_drawings_cap', 'NUMERIC(15,2)'),
      ensureColumn('partners', 'debit_balance', 'NUMERIC(15,2)'),
      ensureColumn('partners', 'total_withdrawn', 'NUMERIC(15,2)'),
      ensureColumn('partners', 'total_profit_received', 'NUMERIC(15,2)'),
      ensureColumn('partners', 'opening_balance', 'NUMERIC(15,2)'),
      ensureColumn('partners', 'exit_date', 'DATE'),
      ensureColumn('profit_distributions', 'capital_addition_amount', 'NUMERIC(15,2)'),
      ensureColumn('profit_distributions', 'new_capital_share', 'NUMERIC(15,2)'),
      ensureColumn('invoices', 'advance_deduction', 'NUMERIC(12,2)'),
      ensureColumn('invoices', 'booking_id', 'VARCHAR(100)'),
      ensureColumn('bookings', 'advance_payments', 'JSONB'),
      ensureColumn('bookings', 'is_paid', 'BOOLEAN'),
      ensureColumn('bookings', 'invoice_id', 'VARCHAR(100)'),
      ensureColumn('bookings', 'location', 'TEXT'),
      ensureColumn('client_portal_accounts', 'username', 'VARCHAR(100)'),
      ensureColumn('client_portal_accounts', 'salon_code', 'VARCHAR(50)'),
      ensureColumn('client_portal_accounts', 'linked_salon_codes', 'JSONB'),
      ensureColumn('clients', 'branch_id', 'VARCHAR(50)'),
      ensureColumn('clients', 'dob', 'VARCHAR(50)'),
      ensureColumn('clients', 'dob_day', 'INT'),
      ensureColumn('clients', 'dob_month', 'INT'),
      ensureColumn('clients', 'client_type', 'VARCHAR(50)'),
      ensureColumn('clients', 'last_birthday_greeting_at', 'TIMESTAMPTZ'),
      ensureColumn('clients', 'last_reactivation_message_at', 'TIMESTAMPTZ'),
      ensureColumn('clients', 'tier_level', 'VARCHAR(50)'),
      ensureColumn('clients', 'vip_since', 'VARCHAR(50)'),
      ensureColumn('clients', 'vip_notes', 'TEXT'),
      ensureColumn('clients', 'referred_by_phone', 'VARCHAR(50)'),
      ensureColumn('clients', 'has_used_referral_reward', 'BOOLEAN'),
      ensureColumn('clients', 'referral_count', 'INT'),
      ensureColumn('clients', 'referral_total_cashback_earned', 'NUMERIC(15,2)'),
      ensureColumn('clients', 'blacklist_reason', 'TEXT'),
      ensureColumn('clients', 'preferences', 'JSONB'),
      ensureColumn('invoices', 'invoice_number', 'VARCHAR(100)'),
      ensureColumn('invoices', 'paid_amount', 'NUMERIC(12,2)'),
      ensureColumn('invoices', 'paid', 'NUMERIC(12,2)'),
      ensureColumn('invoices', 'remaining_amount', 'NUMERIC(12,2)'),
      ensureColumn('invoices', 'remaining', 'NUMERIC(12,2)'),
      ensureColumn('invoices', 'vat', 'NUMERIC(12,2)'),
      ensureColumn('invoices', 'tax', 'NUMERIC(12,2)'),
      ensureColumn('bookings', 'total_price', 'NUMERIC(10,2)'),
      ensureColumn('bookings', 'total_amount', 'NUMERIC(12,2)'),
      ensureColumn('bookings', 'time', 'VARCHAR(50)'),
      ensureColumn('bookings', 'start_time', 'VARCHAR(50)'),
      ensureColumn('bookings', 'booking_code', 'VARCHAR(50)'),
      ensureColumn('bookings', 'customer_email', 'VARCHAR(100)'),
      ensureColumn('bookings', 'branch_code', 'VARCHAR(50)'),
      ensureColumn('bookings', 'discount_type', 'VARCHAR(20)'),
      ensureColumn('bookings', 'discount_value', 'NUMERIC(10,2)'),
      ensureColumn('bookings', 'discount_amount', 'NUMERIC(10,2)'),
      ensureColumn('bookings', 'created_by', 'VARCHAR(100)'),
      ensureColumn('bookings', 'created_by_name', 'VARCHAR(100)'),
      ensureColumn('bookings', 'created_by_id', 'VARCHAR(100)'),
      ensureColumn('bookings', 'updated_at', 'TIMESTAMPTZ'),
      ensureColumn('bookings', 'updated_by', 'VARCHAR(100)'),
      ensureColumn('bookings', 'updated_by_name', 'VARCHAR(100)'),
      ensureColumn('bookings', 'updated_by_id', 'VARCHAR(100)'),
      ensureColumn('bookings', 'internal_notes', 'TEXT'),
      ensureColumn('employees', 'basic_salary', 'NUMERIC(10,2)'),
      ensureColumn('employees', 'base_salary', 'NUMERIC(10,2)'),
      ensureColumn('employees', 'target', 'NUMERIC(12,2)'),
      ensureColumn('employees', 'target_amount', 'NUMERIC(12,2)'),
      ensureColumn('employees', 'check_in_time', 'VARCHAR(20)'),
      ensureColumn('employees', 'check_out_time', 'VARCHAR(20)'),
      ensureColumn('services', 'duration', 'INT'),
      ensureColumn('services', 'duration_minutes', 'INT'),
      ensureColumn('services', 'commission_rate', 'NUMERIC(5,2)'),
      ensureColumn('services', 'commission_amount', 'NUMERIC(10,2)'),
      ensureColumn('services', 'employee_commission_percentage', 'NUMERIC(5,2)'),
      ensureColumn('services', 'employee_commission_amount', 'NUMERIC(10,2)'),
      ensureColumn('services', 'commissionable_amount', 'NUMERIC(10,2)'),
      ensureColumn('services', 'is_target_exempt', 'BOOLEAN'),
      ensureColumn('services', 'foreigner_price', 'NUMERIC(10,2)'),
      ensureColumn('app_settings', 'enable_dual_pricing', 'BOOLEAN'),
      ensureColumn('employees', 'daily_target_method', 'VARCHAR(50)'),
      ensureColumn('employees', 'monthly_target_method', 'VARCHAR(50)'),
      ensureColumn('employees', 'daily_target_multiplier', 'NUMERIC(5,2)'),
      ensureColumn('employees', 'monthly_target_multiplier', 'NUMERIC(5,2)'),
      ensureColumn('employees', 'target_salary_multiplier', 'NUMERIC(5,2)'),
      ensureColumn('products', 'retail_price', 'NUMERIC(10,2)'),
      ensureColumn('products', 'sell_price', 'NUMERIC(10,2)'),
      ensureColumn('products', 'min_stock_alert', 'NUMERIC(12,2)'),
      ensureColumn('products', 'reorder_limit', 'INT'),
      ensureColumn('transactions', 'treasury', 'VARCHAR(100)'),
      ensureColumn('transactions', 'treasury_id', 'VARCHAR(50)'),
      ensureColumn('transactions', 'payment_method', 'VARCHAR(50)'),
      ensureColumn('transactions', 'expense_category', 'VARCHAR(100)'),
      ensureColumn('transactions', 'branch_code', 'VARCHAR(50)'),
      ensureColumn('transactions', 'user_id', 'VARCHAR(50)'),
      ensureColumn('transactions', 'user_name', 'VARCHAR(255)'),
      ensureColumn('transactions', 'shift_date', 'VARCHAR(50)'),
      ensureColumn('held_invoices', 'notes', 'TEXT'),
      ensureColumn('held_invoices', 'note', 'TEXT'),
      ensureColumn('held_invoices', 'items', 'JSONB'),
      ensureColumn('held_invoices', 'client_search', 'VARCHAR(255)'),
      ensureColumn('held_invoices', 'discount_type', 'VARCHAR(50)'),
      ensureColumn('held_invoices', 'discount_value', 'NUMERIC(12,2)'),
      ensureColumn('held_invoices', 'advance_deduction', 'NUMERIC(12,2)'),
      ensureColumn('held_invoices', 'advance_payments', 'JSONB'),
      ensureColumn('held_invoices', 'is_open', 'BOOLEAN'),
      ensureColumn('held_invoices', 'opened_by', 'VARCHAR(100)'),
      ensureColumn('customer_complaints', 'subject', 'VARCHAR(255)'),
      ensureColumn('customer_complaints', 'category', 'VARCHAR(100)'),
      ensureColumn('customer_complaints', 'actions', 'JSONB'),
      ensureColumn('customer_complaints', 'is_remedy_provided', 'BOOLEAN'),
      ensureColumn('customer_complaints', 'remedy_invoice_id', 'VARCHAR(50)'),
      ensureColumn('promo_codes', 'usage_limit', 'INT'),
      ensureColumn('promo_codes', 'max_uses_total', 'INT'),
      ensureColumn('promo_codes', 'used_count', 'INT'),
      ensureColumn('promo_codes', 'uses_count', 'INT')
    ]);
  } catch { /* Silent fail */ }
}

// تشغيل الفحص الاستباقي تلقائياً عند تحميل الخدمة
setTimeout(() => { ensureCoreSchema(); }, 1000);

// ============================================================
// Generic CRUD
// ============================================================
export const DB = {

  // توليد UUID متوافق
  generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // فحص وإنشاء عمود يدوياً
  async ensureColumn(table: string, column: string, type: string = 'TEXT'): Promise<boolean> {
    return ensureColumn(table, column, type);
  },

  // --- وحدة النسخ الاحتياطي المتقدم (Advanced Backup Module API) ---
  async fetchBackupSettings(): Promise<any> {
    try {
      const res = await fetch('/api/backup/settings');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (e: any) {
      console.warn('DB.fetchBackupSettings error:', e.message);
      return {
        enabled: true,
        days: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
        frequencyPreset: 'every_6_hours',
        customTimes: ["02:00","14:00","23:00"],
        lastBackupAt: null
      };
    }
  },

  async saveBackupSettings(settings: any): Promise<boolean> {
    try {
      const res = await fetch('/api/backup/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      return res.ok;
    } catch (e: any) {
      console.error('DB.saveBackupSettings error:', e.message);
      return false;
    }
  },

  async triggerBackupNow(backupDir?: string): Promise<{ success: boolean; message?: string; backup?: any; error?: string }> {
    try {
      const res = await fetch('/api/backup/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupDir })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async fetchBackupList(): Promise<{ logs: any[]; files: any[] }> {
    try {
      const res = await fetch('/api/backup/list');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (e: any) {
      console.warn('DB.fetchBackupList error:', e.message);
      return { logs: [], files: [] };
    }
  },

  // --- جلب سجلات جدول مع دعم التحديد المخصص للأعمدة والترقيم Pagination (.range) ----
  async fetchPaginated<T>(table: string, options?: {
    columns?: string;
    from?: number;
    to?: number;
    extraFilters?: Record<string, string>;
    overrideSalonId?: string;
  }): Promise<T[]> {
    const client = sb();
    if (!client) return [];
    try {
      const rawSalonId = options?.overrideSalonId || getSalonId();
      const validSalonId = rawSalonId ? toSalonUUID(rawSalonId) : '';
      let q = client.from(table).select(options?.columns || '*');
      if (validSalonId && table !== 'platform_settings' && table !== 'arab_countries' && table !== 'salons') {
        q = q.eq('salon_id', validSalonId);
      }
      if (options?.extraFilters) {
        Object.entries(options.extraFilters).forEach(([k, v]) => { q = q.eq(k, v); });
      }
      if (typeof options?.from === 'number' && typeof options?.to === 'number') {
        q = q.range(options.from, options.to);
      }

      const { data, error } = await q;
      if (error) {
        console.error(`DB.fetchPaginated[${table}]:`, error.message);
        return [];
      }
      if (!Array.isArray(data)) return [];

      data.sort((a: any, b: any) => {
        const timeA = a.created_at || a.date || a.used_at || a.id || '';
        const timeB = b.created_at || b.date || b.used_at || b.id || '';
        if (timeA > timeB) return -1;
        if (timeA < timeB) return 1;
        return 0;
      });

      return data.map(row => toCamel(row)) as T[];
    } catch (e) { console.error(`DB.fetchPaginated[${table}] exception:`, e); return []; }
  },

  // --- جلب جميع سجلات جدول مع استعادة الحقول المحفوظة محلياً إن وجدت ----
  async fetchAll<T>(table: string, extraFilters?: Record<string, string>, overrideSalonId?: string, columns: string = '*'): Promise<T[]> {
    const client = sb();
    if (!client) return [];
    try {
      const rawSalonId = overrideSalonId || getSalonId();
      const validSalonId = rawSalonId ? toSalonUUID(rawSalonId) : '';
      let q = client.from(table).select(columns);
      if (validSalonId && table !== 'platform_settings' && table !== 'arab_countries' && table !== 'salons') {
        q = q.eq('salon_id', validSalonId);
      }
      if (extraFilters) {
        Object.entries(extraFilters).forEach(([k, v]) => { q = q.eq(k, v); });
      }

      const { data, error } = await q;
      if (error) {
        console.error(`DB.fetchAll[${table}]:`, error.message);
        return [];
      }
      if (!Array.isArray(data)) return [];

      // Fast in-memory sort by created_at / date / timestamp
      data.sort((a: any, b: any) => {
        const timeA = a.created_at || a.date || a.used_at || a.id || '';
        const timeB = b.created_at || b.date || b.used_at || b.id || '';
        if (timeA > timeB) return -1;
        if (timeA < timeB) return 1;
        return 0;
      });

      let resultData = data;
      
      return resultData.map(row => {
        const camel = toCamel(row);
        // Hydrate any local fallback properties if needed
        if (camel && camel.id) {
          try {
            const keys = Object.keys(localStorage);
            const prefix = `smartcut_extra_${table}_${camel.id}_`;
            keys.filter(k => k.startsWith(prefix)).forEach(k => {
              const colName = k.replace(prefix, '');
              const val = JSON.parse(localStorage.getItem(k) || 'null');
              if (val !== null && camel[colName] === undefined) {
                camel[colName] = val;
              }
            });
          } catch {}
        }
        return camel;
      }) as T[];
    } catch (e) { console.error(`DB.fetchAll[${table}] exception:`, e); return []; }
  },

  // --- حفظ أو تحديث سجل مع المعالجة التلقائية للحقول غير الموجودة ---
  async upsert<T>(table: string, record: Partial<T>): Promise<T | null> {
    const client = sb();
    if (!client) return null;
    try {
      const salonId = getSalonId();
      let snakeRecord: any = toSnake(record);
      if (salonId && !snakeRecord.salon_id && table !== 'platform_settings' && table !== 'arab_countries' && table !== 'salons') {
        snakeRecord.salon_id = salonId;
      }

      let attempts = 0;
      while (attempts < 5) {
        attempts++;
        const { data, error } = await client.from(table).upsert(snakeRecord, { onConflict: 'id' }).select().single();
        
        if (!error) {
          return toCamel(data) as T;
        }

        // Check if error is due to missing column (PGRST204 or PostgreSQL 42703)
        const errMsg = error.message || '';
        const missingColMatch = errMsg.match(/Could not find the '([^']+)' column of '([^']+)'/i) 
          || errMsg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i);

        if (missingColMatch) {
          const missingCol = missingColMatch[1];
          const targetTable = missingColMatch[2] || table;
          console.warn(`[Auto-Schema] Missing column '${missingCol}' in '${targetTable}'. Attempting auto-creation...`);

          // 1. Attempt to create missing column in database via RPC
          const created = await ensureColumn(targetTable, missingCol, 'TEXT');
          if (created) {
            await new Promise(r => setTimeout(r, 200));
            continue; // Retry with column in place
          }

          // 2. If creation not possible on remote DB, strip missing column and store locally
          if (snakeRecord.id && snakeRecord[missingCol] !== undefined) {
            localStorage.setItem(`smartcut_extra_${targetTable}_${snakeRecord.id}_${missingCol}`, JSON.stringify(snakeRecord[missingCol]));
          }
          delete snakeRecord[missingCol];
          continue; // Retry without missing column
        }

        console.error(`DB.upsert[${table}]:`, error.message);
        return null;
      }
      return null;
    } catch (e) { console.error(`DB.upsert[${table}] exception:`, e); return null; }
  },

  // --- حفظ مجموعة سجلات دفعة واحدة ----
  async upsertMany<T>(table: string, records: Partial<T>[]): Promise<boolean> {
    const client = sb();
    if (!client || !records.length) return false;
    try {
      const salonId = getSalonId();
      const snakeRecords = records.map(r => {
        const s: any = toSnake(r);
        if (salonId && !s.salon_id && table !== 'platform_settings' && table !== 'arab_countries' && table !== 'salons') {
          s.salon_id = salonId;
        }
        return s;
      });
      const { error } = await client.from(table).upsert(snakeRecords, { onConflict: 'id' });
      if (error) {
        // Fallback row-by-row with self-healing upsert
        for (const rec of records) {
          await this.upsert(table, rec);
        }
      }
      return true;
    } catch (e) { console.error(`DB.upsertMany[${table}] exception:`, e); return false; }
  },

  // --- حذف سجل ----
  async remove(table: string, id: string): Promise<boolean> {
    const client = sb();
    if (!client) return false;
    try {
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) { console.error(`DB.remove[${table}]:`, error.message); return false; }
      return true;
    } catch (e) { console.error(`DB.remove[${table}] exception:`, e); return false; }
  },

  // --- تحديث حقل واحد أو أكثر مع المعالجة التلقائية ---
  async patch(table: string, id: string, updates: Record<string, any>): Promise<boolean> {
    const client = sb();
    if (!client) return false;
    try {
      let snakeUpdates: any = toSnake(updates);
      let attempts = 0;
      while (attempts < 4) {
        attempts++;
        const { error } = await client.from(table).update(snakeUpdates).eq('id', id);
        if (!error) return true;

        const errMsg = error.message || '';
        const missingColMatch = errMsg.match(/Could not find the '([^']+)' column of '([^']+)'/i) 
          || errMsg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i);

        if (missingColMatch) {
          const missingCol = missingColMatch[1];
          const targetTable = missingColMatch[2] || table;
          const created = await ensureColumn(targetTable, missingCol, 'TEXT');
          if (created) {
            await new Promise(r => setTimeout(r, 200));
            continue;
          }
          if (snakeUpdates[missingCol] !== undefined) {
            localStorage.setItem(`smartcut_extra_${targetTable}_${id}_${missingCol}`, JSON.stringify(snakeUpdates[missingCol]));
          }
          delete snakeUpdates[missingCol];
          continue;
        }

        console.error(`DB.patch[${table}]:`, error.message);
        return false;
      }
      return false;
    } catch (e) { console.error(`DB.patch[${table}] exception:`, e); return false; }
  },

  // ============================================================
  // وظائف مخصصة لكل كيان
  // ============================================================

  // ---- إعدادات إدارة المنظومة العامة (Platform Settings) ----
  async fetchPlatformSettings() {
    const client = sb();
    const localLogo = localStorage.getItem('smartcut_platform_logo_url') || '';
    if (!client) {
      return localLogo ? {
        platformName: 'منظومة سمارت كت برو لإدارة الصالونات',
        platformPhone: '0500000000',
        platformEmail: 'admin@smartcut.app',
        logoUrl: localLogo,
        platformLogoUrl: localLogo
      } : null;
    }
    try {
      const { data, error } = await client.from('platform_settings').select('*').limit(1).maybeSingle();
      if (error) { console.error('DB.fetchPlatformSettings:', error.message); }
      if (data) {
        const camel = toCamel(data);
        const resolvedLogo = camel.logoUrl || camel.platformLogoUrl || localLogo || '';
        return {
          ...camel,
          logoUrl: resolvedLogo,
          platformLogoUrl: resolvedLogo
        };
      }
      if (localLogo) {
        return {
          platformName: 'منظومة سمارت كت برو لإدارة الصالونات',
          platformPhone: '0500000000',
          platformEmail: 'admin@smartcut.app',
          logoUrl: localLogo,
          platformLogoUrl: localLogo
        };
      }
      return null;
    } catch (e) { return null; }
  },

  async savePlatformSettings(settings: any) {
    const client = sb();
    const logoVal = settings.logoUrl || settings.platformLogoUrl || '';
    if (logoVal) {
      localStorage.setItem('smartcut_platform_logo_url', logoVal);
      // فحص وإنشاء الحقل أولاً في قاعدة البيانات قبل التعامل معه
      await ensureColumn('platform_settings', 'logo_url', 'TEXT');
    }
    if (!client) return false;
    try {
      const snap: any = {
        id: '00000000-0000-0000-0000-000000000000',
        platform_name: settings.platformName || 'منظومة سمارت كت برو لإدارة الصالونات',
        platform_phone: settings.platformPhone || '0500000000',
        platform_email: settings.platformEmail || 'admin@smartcut.app',
        evolution_api_url: settings.evolutionApiUrl || null,
        evolution_api_key: settings.evolutionApiKey || null,
        evolution_instance_name: settings.evolutionInstanceName || 'smartcut_platform_main',
        default_trial_days: settings.defaultTrialDays ?? 7,
        master_programmer_key: settings.masterProgrammerKey || 'dev@smartcut2026',
        ai_provider: settings.aiProvider || 'builtin',
        ai_api_key: settings.aiApiKey || null,
        ai_model: settings.aiModel || 'gemini-3.8-flash',
        updated_at: new Date().toISOString()
      };
      if (logoVal) {
        snap.logo_url = logoVal;
      }
      const { error } = await client.from('platform_settings').upsert(snap, { onConflict: 'id' });
      if (error) {
        // If logo_url column isn't in PostgreSQL schema cache yet, fallback without it
        delete snap.logo_url;
        delete snap.platform_logo_url;
        const { error: fallbackErr } = await client.from('platform_settings').upsert(snap, { onConflict: 'id' });
        if (fallbackErr) {
          console.error('DB.savePlatformSettings:', fallbackErr.message);
          return false;
        }
      }
      return true;
    } catch (e) { return false; }
  },

  // ---- الفواتير المعلقة والمفتوحة (Held / Suspended Invoices) ----
  async fetchHeldInvoices(salonId?: string, branchId?: string): Promise<HeldInvoice[]> {
    const client = sb();
    if (!client) return [];
    try {
      const validSalonId = toSalonUUID(salonId || getSalonId());
      let q = client.from('held_invoices').select('*');
      if (validSalonId) {
        q = q.eq('salon_id', validSalonId);
      }
      if (branchId) {
        q = q.eq('branch_id', branchId);
      }
      q = q.order('held_at', { ascending: false });
      const { data, error } = await q;
      if (error) {
        console.error('DB.fetchHeldInvoices:', error.message);
        return [];
      }
      return (data || []).map(row => {
        const camel = toCamel(row);
        if (!camel.discount && (camel.discountType || camel.discountValue !== undefined)) {
          camel.discount = {
            type: camel.discountType || 'fixed',
            value: Number(camel.discountValue) || 0
          };
        }
        if (!camel.cart && Array.isArray(camel.items)) {
          camel.cart = camel.items;
        }
        if (!Array.isArray(camel.cart)) {
          camel.cart = [];
        } else {
          camel.cart = camel.cart.map((c: any) => {
            const p = Number(c?.item?.displayPrice ?? c?.item?.display_price ?? c?.item?.price ?? c?.price ?? 0);
            const safePrice = isNaN(p) ? 0 : p;
            return {
              ...c,
              price: safePrice,
              item: {
                ...(c?.item || {}),
                id: c?.item?.id || c?.id || c?.cartId,
                name: c?.item?.name || c?.name || 'خدمة',
                price: safePrice,
                displayPrice: safePrice
              }
            };
          });
        }
        if (!camel.advancePayments && camel.advance_payments) {
          camel.advancePayments = camel.advance_payments;
        }
        if (!camel.bookingId && camel.booking_id) {
          camel.bookingId = camel.booking_id;
        }
        if (!camel.client && (camel.clientName || camel.clientPhone || camel.clientId)) {
          camel.client = {
            id: camel.clientId || 'client-walkin',
            name: camel.clientName || '',
            phone: camel.clientPhone || '',
            gender: 'men'
          };
        }
        if (!camel.timeStr && camel.heldAt) {
          try {
            camel.timeStr = new Date(camel.heldAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
          } catch {}
        }
        camel.isOpen = camel.isOpen !== undefined ? camel.isOpen : !!camel.is_open;
        camel.openedBy = camel.openedBy || camel.opened_by || undefined;
        return camel;
      });
    } catch (e) {
      console.error('DB.fetchHeldInvoices exception:', e);
      return [];
    }
  },

  async saveHeldInvoice(held: HeldInvoice): Promise<boolean> {
    const client = sb();
    if (!client) return false;
    try {
      const validSalonId = toSalonUUID(held.salonId || getSalonId());
      if (!validSalonId) return false;

      const normalizedCart = (held.cart || []).map((c: any) => {
        const p = Number(c?.item?.displayPrice ?? c?.item?.price ?? c?.price ?? 0);
        const safePrice = isNaN(p) ? 0 : p;
        return {
          ...c,
          price: safePrice,
          item: {
            ...(c?.item || {}),
            id: c?.item?.id || c?.id || c?.cartId,
            name: c?.item?.name || c?.name || 'خدمة',
            price: safePrice,
            displayPrice: safePrice
          }
        };
      });

      const snake: any = {
        id: held.id,
        salon_id: validSalonId,
        branch_id: toBranchUUID(held.branchId) || held.branchId || null,
        client_id: held.client?.id || null,
        client_name: held.client?.name || held.clientSearch || 'عميل',
        client_phone: held.client?.phone || '',
        client_search: held.clientSearch || held.client?.name || '',
        cart: normalizedCart,
        items: normalizedCart,
        discount_type: held.discount?.type || 'fixed',
        discount_value: held.discount?.value || 0,
        advance_deduction: Number(held.advanceDeduction) || 0,
        advance_payments: held.advancePayments || [],
        booking_id: held.bookingId || null,
        is_remedy_invoice: !!held.isRemedyInvoice,
        remedy_reason: held.remedyReason || null,
        before_photo_url: held.beforePhotoUrl || null,
        after_photo_url: held.afterPhotoUrl || null,
        note: held.note || (held as any).notes || null,
        notes: held.note || (held as any).notes || null,
        held_at: held.heldAt || new Date().toISOString(),
        queue_number: held.queueNumber || null,
        queue_ticket_id: held.queueTicketId || null,
        is_open: held.isOpen !== undefined ? !!held.isOpen : false,
        opened_by: held.openedBy || null,
        total: normalizedCart.reduce((sum, c) => sum + ((Number(c?.item?.displayPrice ?? c?.price) || 0) * (c?.quantity || 1)), 0)
      };

      const { error } = await client.from('held_invoices').upsert(snake, { onConflict: 'id' });
      if (error) {
        console.error('DB.saveHeldInvoice error:', error.message);
        return false;
      }

      // إشعار فوري للشاشات والتبويبات المفتوحة عبر BroadcastChannel
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel(`smartcut_held_${held.salonId || 'default'}`);
          bc.postMessage({ type: 'HELD_INVOICES_UPDATED', id: held.id });
          bc.close();
        } catch {}
      }

      return true;
    } catch (e) {
      console.error('DB.saveHeldInvoice exception:', e);
      return false;
    }
  },

  async removeHeldInvoice(id: string): Promise<boolean> {
    const client = sb();
    if (!client) return false;
    try {
      const { error } = await client.from('held_invoices').delete().eq('id', id);
      if (error) {
        console.error('DB.removeHeldInvoice error:', error.message);
        return false;
      }
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('smartcut_held_default');
          bc.postMessage({ type: 'HELD_INVOICES_UPDATED', id });
          bc.close();
        } catch {}
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  async removeHeldInvoiceByTicket(queueTicketId: string): Promise<boolean> {
    const client = sb();
    if (!client) return false;
    try {
      const { error } = await client.from('held_invoices').delete().or(`id.eq.${queueTicketId},queue_ticket_id.eq.${queueTicketId}`);
      if (error) {
        console.error('DB.removeHeldInvoiceByTicket error:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  // ---- الصالونات والمستأجرين (Salons / Tenants) ----
  async fetchSalons() {
    const client = sb();
    if (!client) return [];
    try {
      const { data, error } = await client.from('salons').select('*').order('created_at', { ascending: true });
      if (error) { console.error('DB.fetchSalons:', error.message); return []; }
      return (data || []).map(toCamel);
    } catch (e) { return []; }
  },

  async saveSalon(s: any) {
    const client = sb();
    if (!client) return false;
    try {
      const validSalonId = toSalonUUID(s.id);
      
      // Fetch existing salon to merge and protect actual salon name and credentials from being overwritten by defaults
      const { data: existingSalon } = await client
        .from('salons')
        .select('*')
        .eq('id', validSalonId)
        .maybeSingle();

      const safeName = (s.name && s.name !== 'صالون سمارت كت' && s.name !== 'الصالون')
        ? s.name
        : (existingSalon?.name || s.name || 'صالون سمارت كت');

      const safePhone = (s.phone && s.phone !== '0500000000')
        ? s.phone
        : (existingSalon?.phone || s.phone || '');

      const safeTaxNumber = (s.taxNumber || s.tax_number) && (s.taxNumber !== '300000000000003' && s.tax_number !== '300000000000003')
        ? (s.taxNumber || s.tax_number)
        : (existingSalon?.tax_number || s.taxNumber || s.tax_number || '300000000000003');

      const safeCommercialReg = (s.commercialReg || s.commercial_reg) && (s.commercialReg !== '1010000000' && s.commercial_reg !== '1010000000')
        ? (s.commercialReg || s.commercial_reg)
        : (existingSalon?.commercial_reg || s.commercialReg || s.commercial_reg || '1010000000');

      const snap: any = {
        id: validSalonId,
        code: s.code || existingSalon?.code,
        name: safeName,
        salon_type: s.salonType || existingSalon?.salon_type || 'men',
        tax_number: safeTaxNumber,
        commercial_reg: safeCommercialReg,
        phone: safePhone,
        email: s.email || existingSalon?.email,
        owner_name: (s.ownerName && s.ownerName !== 'صالون سمارت كت') ? s.ownerName : (existingSalon?.owner_name || s.ownerName || safeName),
        owner_email: s.ownerEmail || s.email || existingSalon?.owner_email,
        country: s.country || existingSalon?.country || 'المملكة العربية السعودية',
        currency: s.currency || existingSalon?.currency || 'SAR',
        timezone: s.timezone || existingSalon?.timezone || getSalonTimezone(s) || 'Asia/Riyadh',
        address: s.address || existingSalon?.address || s.country,
        logo_url: s.logoUrl !== undefined ? s.logoUrl : (existingSalon?.logo_url || null),
        is_active: s.isActive !== undefined ? s.isActive : (existingSalon?.is_active ?? true),
        subscription_status: s.subscriptionStatus || existingSalon?.subscription_status || 'trial',
        subscription_plan: s.subscriptionPlan || existingSalon?.subscription_plan || 'pro',
        subscription_start_date: toDateOrNull(s.subscriptionStartDate) || existingSalon?.subscription_start_date || new Date().toISOString().split('T')[0],
        subscription_end_date: toDateOrNull(s.subscriptionEndDate) || existingSalon?.subscription_end_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        trial_days: s.trialDays || existingSalon?.trial_days || 7,
        max_branches: s.maxBranches || existingSalon?.max_branches || 3,
        max_users: s.maxUsers || existingSalon?.max_users || 10,
        evolution_instance_name: s.evolutionInstanceName ?? s.waInstantName ?? existingSalon?.evolution_instance_name ?? null,
        evolution_api_key: s.evolutionApiKey ?? s.waApiKey ?? existingSalon?.evolution_api_key ?? null,
        evolution_api_url: s.evolutionApiUrl ?? existingSalon?.evolution_api_url ?? null,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('salons').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveSalon error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.saveSalon exception:', e); return false; }
  },

  // ---- الفروع (Branches) ----
  async fetchBranches(salonId?: string) {
    const client = sb();
    if (!client) return [];
    try {
      let q = client.from('branches').select('*');
      if (salonId) {
        q = q.eq('salon_id', toSalonUUID(salonId));
      }
      const { data, error } = await q.order('created_at', { ascending: true });
      if (error) { console.error('DB.fetchBranches:', error.message); return []; }
      return (data || []).map(row => {
        const c = toCamel(row);
        let st: any = {};
        if (typeof row.settings === 'object' && row.settings) {
          st = row.settings;
        } else if (typeof row.settings === 'string' && row.settings) {
          try { st = JSON.parse(row.settings); } catch {}
        }
        return {
          ...c,
          storageLimitMb: Number(c.storageLimitMb ?? st.storageLimitMb ?? 50),
          usedStorageBytes: Number(c.usedStorageBytes ?? st.usedStorageBytes ?? 0),
          isMain: toBool(c.isMain),
          isActive: toBool(c.isActive),
          vatEnabled: c.vatEnabled !== undefined ? toBool(c.vatEnabled) : true,
          vatRate: Number(c.vatRate ?? 15)
        };
      });
    } catch (e) { return []; }
  },

  async saveBranch(b: any) {
    const client = sb();
    if (!client) return false;
    try {
      const validSalonId = toSalonUUID(b.salonId);
      const branchCode = b.code || 'BR-01';
      let validBranchId: string | undefined;
      
      // If branch exists by salon_id and code, adopt its id to avoid duplicate key violation
      if (validSalonId && branchCode) {
        try {
          const { data: existing } = await client.from('branches')
            .select('id, settings')
            .eq('salon_id', validSalonId)
            .eq('code', branchCode)
            .maybeSingle();
          if (existing?.id) {
            validBranchId = existing.id;
          }
        } catch {}
      }

      const currentSettings = (typeof b.settings === 'object' && b.settings) ? b.settings : {};
      const storageLimitMb = Number(b.storageLimitMb ?? currentSettings.storageLimitMb ?? 50);
      const usedStorageBytes = Number(b.usedStorageBytes ?? currentSettings.usedStorageBytes ?? 0);

      const snap: any = {
        ...(validBranchId ? { id: validBranchId } : (b.id ? { id: b.id } : {})),
        salon_id: validSalonId,
        salon_code: b.salonCode || 'SC-01',
        code: branchCode,
        name: b.name,
        phone: b.phone || null,
        address: b.address || null,
        city: b.city || null,
        country: b.country || 'المملكة العربية السعودية',
        currency: b.currency || 'SAR',
        timezone: b.timezone || null,
        vat_rate: b.vatRate ?? 15,
        vat_enabled: b.vatEnabled !== false,
        tax_number: b.taxNumber || null,
        commercial_reg: b.commercialReg || null,
        is_main: b.isMain || false,
        is_active: b.isActive !== false,
        status: b.status || 'active',
        evolution_instance_name: b.evolutionInstanceName || null,
        settings: {
          ...currentSettings,
          storageLimitMb,
          usedStorageBytes
        },
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('branches').upsert(snap, { onConflict: 'id' });
      if (error) {
        if (error.message?.includes('branches_salon_id_code_key')) {
          // If code conflict occurs, update the existing branch record directly
          const { id: _ignoreId, ...updateFields } = snap;
          const { error: updateErr } = await client.from('branches')
            .update(updateFields)
            .eq('salon_id', validSalonId)
            .eq('code', snap.code);
          if (!updateErr) return true;
        }
        console.error('DB.saveBranch error:', error.message);
        return false;
      }
      return true;
    } catch (e) { console.error('DB.saveBranch exception:', e); return false; }
  },

  async deleteBranch(branchId: string) {
    const client = sb();
    if (!client) return false;
    try {
      const { error } = await client.from('branches').delete().eq('id', branchId);
      if (error) {
        console.error('DB.deleteBranch error:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('DB.deleteBranch exception:', e);
      return false;
    }
  },

  // ---- المستخدمون (Users) ----
  async fetchUsers(salonId?: string) {
    const client = sb();
    if (!client) return [];
    try {
      let q = client.from('users').select('*');
      if (salonId) {
        q = q.eq('salon_id', toSalonUUID(salonId));
      }
      const { data, error } = await q.order('created_at', { ascending: true });
      if (error) { console.error('DB.fetchUsers:', error.message); return []; }
      return (data || []).map(dbUserToApp);
    } catch (e) { return []; }
  },

  async saveUser(u: any) {
    const client = sb();
    if (!client) return false;
    try {
      const validSalonId = toSalonUUID(u.salonId);
      const validBranchId = toBranchUUID(u.branchId);
      const cleanUsername = (u.username || '').trim().toLowerCase();
      const userUuid = u.id && u.id.includes('-') && u.id.length === 36 ? u.id : DB.generateUUID();
      
      const normalizedRole = u.role === 'kiosk' ? 'custom' : (u.role || 'cashier');
      const normalizedScreens = (u.role === 'admin' || u.role === 'owner' || u.role === 'programmer')
        ? ['*']
        : (Array.isArray(u.screens) ? u.screens.filter((s: string) => s !== '*') : []);
      const normalizedActions = (u.role === 'admin' || u.role === 'owner' || u.role === 'programmer')
        ? ['*']
        : (Array.isArray(u.actions) ? u.actions.filter((a: string) => a !== '*') : []);

      // Cryptographically seal user record to prevent external tampering
      const sealed = sealUserRecord({
        ...u,
        id: userUuid,
        salonId: validSalonId,
        branchId: validBranchId,
        username: cleanUsername,
        role: normalizedRole,
        screens: normalizedScreens,
        actions: normalizedActions,
        active: u.active !== false
      });

      const snap: any = {
        id: userUuid,
        salon_id: validSalonId,
        branch_id: validBranchId,
        salon_code: u.salonCode || 'SC-01',
        branch_code: u.branchCode || 'BR-01',
        username: cleanUsername,
        email: u.email || null,
        employee_id: u.employeeId || null,
        password_hash: sealed.passwordHash || sealed.password || '123456',
        name: u.name || cleanUsername,
        role: normalizedRole,
        custom_role_id: u.customRoleId || null,
        phone: u.phone || null,
        active: u.active !== false,
        screens: normalizedScreens,
        actions: normalizedActions,
        permissions: normalizedActions,
        avatar: u.avatar || null,
        security_hash: sealed.integritySignature,
        integrity_signature: sealed.integritySignature,
        updated_at: new Date().toISOString()
      };
      let { error } = await client.from('users').upsert(snap, { onConflict: 'username' });
      if (error && error.message && error.message.includes('employee_id')) {
        delete snap.employee_id;
        const retry = await client.from('users').upsert(snap, { onConflict: 'username' });
        error = retry.error;
      }
      if (error) { 
        console.error('DB.saveUser error:', error.message); 
        return false; 
      }
      return true;
    } catch (e) { 
      console.error('DB.saveUser exception:', e); 
      return false; 
    }
  },

  async deleteUser(userId: string) {
    const client = sb();
    if (!client) return false;
    try {
      const { error } = await client.from('users').delete().eq('id', userId);
      if (error) { console.error('DB.deleteUser error:', error.message); return false; }
      return true;
    } catch (e) { return false; }
  },

  // ---- الأدوار والصلاحيات المخصصة (Custom Roles) ----
  async fetchCustomRoles(salonId?: string) {
    const client = sb();
    if (!client) return [];
    try {
      const validSalonId = toSalonUUID(salonId || getSalonId());
      let q = client.from('custom_roles').select('*');
      if (validSalonId) {
        q = q.eq('salon_id', validSalonId);
      }
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) { console.error('DB.fetchCustomRoles error:', error.message); return []; }

      const dummyIds = new Set([
        'role-owner', 'role-admin', 'role-supervisor', 'role-accountant',
        'role-warehouse-manager', 'role-cashier', 'role-receptionist', 'role-barber'
      ]);

      return (data || [])
        .filter((r: any) => !dummyIds.has(r.id) && !r.is_system)
        .map((r: any) => ({
          id: r.id,
          salonId: r.salon_id,
          name: r.name,
          description: r.description || '',
          screens: Array.isArray(r.screens) ? r.screens : (typeof r.screens === 'string' ? JSON.parse(r.screens) : ['*']),
          actions: Array.isArray(r.actions) ? r.actions : (typeof r.actions === 'string' ? JSON.parse(r.actions) : ['*']),
          isSystem: r.is_system || false,
          createdAt: r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
        }));
    } catch (e) { console.error('DB.fetchCustomRoles exception:', e); return []; }
  },

  async saveCustomRole(r: any, salonId?: string) {
    const client = sb();
    if (!client || !r) return null;
    const validSalonId = toSalonUUID(salonId || r.salonId || getSalonId());
    try {
      const snap = {
        id: r.id,
        salon_id: validSalonId,
        name: r.name,
        description: r.description || null,
        screens: r.screens || ['*'],
        actions: r.actions || ['*'],
        is_system: false,
        created_at: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      };
      const { error } = await client.from('custom_roles').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveCustomRole error:', error.message); return null; }
      return r;
    } catch (e) { console.error('DB.saveCustomRole exception:', e); return null; }
  },

  async deleteCustomRole(roleId: string) {
    return DB.remove('custom_roles', roleId);
  },

  async clearDemoCustomRoles(salonId?: string) {
    const client = sb();
    if (!client) return;
    try {
      const validSalonId = toSalonUUID(salonId || getSalonId());
      const dummyIds = [
        'role-owner', 'role-admin', 'role-supervisor', 'role-accountant',
        'role-warehouse-manager', 'role-cashier', 'role-receptionist', 'role-barber'
      ];
      for (const id of dummyIds) {
        await client.from('custom_roles').delete().eq('id', id);
      }
      if (validSalonId) {
        await client.from('custom_roles').delete().eq('salon_id', validSalonId).eq('is_system', true);
      }
    } catch (e) { console.error('DB.clearDemoCustomRoles exception:', e); }
  },

  // ---- إعدادات الصالون (App Settings) ----
  async fetchSettings(salonId: string) {
    const client = sb();
    if (!client) return null;
    try {
      const validSalonId = toSalonUUID(salonId);
      const { data, error } = await client.from('app_settings').select('*').eq('salon_id', validSalonId).maybeSingle();
      if (error) { console.error('DB.fetchSettings:', error.message); return null; }
      
      // Auto-heal: If salon exists in salons table but has no app_settings row yet, create it automatically!
      if (!data) {
        const { data: salonRow } = await client.from('salons').select('*').eq('id', validSalonId).maybeSingle();
        if (salonRow) {
          const { data: mainBranch } = await client.from('branches').select('id, code, phone, address').eq('salon_id', validSalonId).eq('is_main', true).maybeSingle();
          const initialSet: any = {
            salonId: salonRow.id,
            salonCode: salonRow.code,
            branchId: mainBranch?.id || null,
            branchCode: mainBranch?.code || 'BR-01',
            salonName: salonRow.name || 'الصالون',
            salonType: salonRow.salon_type || 'men',
            taxNumber: salonRow.tax_number || '300000000000003',
            commercialReg: salonRow.commercial_reg || '1010000000',
            vatEnabled: true,
            vatRate: (salonRow.currency === 'SAR' || (salonRow.country && /السعودية|saudi/i.test(salonRow.country))) ? 15 : 14,
            currency: salonRow.currency || 'EGP',
            country: salonRow.country || 'جمهورية مصر العربية',
            phone: salonRow.phone || mainBranch?.phone || '',
            address: salonRow.address || mainBranch?.address || '',
            logoUrl: salonRow.logo_url || null,
            printerName: 'طابعة الكاشير',
            paperSize: '80mm',
            printAutomatically: false,
            zatcaEnabled: !!(salonRow.country && /السعودية|saudi/i.test(salonRow.country)),
            receiptHeaderNote: `أهلاً بكم في ${salonRow.name || 'صالونكم المميز'}`,
            receiptFooterNote: 'شكراً لزيارتكم ونسعد بخدمتكم دائماً',
            bookingNotes: 'يرجى الحضور قبل الموعد بـ 10 دقائق',
            treasuries: [
              { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
              { id: 'cash', name: 'كاش الدرج', isMain: false },
              { id: 'card', name: 'فيزا', isMain: false },
              { id: 'instapay', name: 'انستاباي', isMain: false },
              { id: 'vodafone_cash', name: 'فودافون كاش', isMain: false }
            ],
            expenseCategories: ['إيجار', 'كهرباء ومياه', 'صيانة ومطبوعات', 'أدوات ومستهلكات', 'ضيافة ونظافة', 'أخرى']
          };
          await this.saveSettings(validSalonId, initialSet);
          return initialSet;
        }
        return null;
      }

      const res = toCamel(data);
      if (data.vat_enabled !== undefined && data.vat_enabled !== null) {
        res.vatEnabled = toBool(data.vat_enabled);
      }
      if (data.zatca_enabled !== undefined && data.zatca_enabled !== null) {
        res.zatcaEnabled = toBool(data.zatca_enabled);
      }
      if (data.print_automatically !== undefined && data.print_automatically !== null) {
        res.printAutomatically = toBool(data.print_automatically);
      }
      if (data.show_dashboard_analytics !== undefined && data.show_dashboard_analytics !== null) {
        res.showDashboardAnalytics = toBool(data.show_dashboard_analytics);
      }
      if (data.show_employee_analytics !== undefined && data.show_employee_analytics !== null) {
        res.showEmployeeAnalytics = toBool(data.show_employee_analytics);
      }

      const bRules = typeof data.booking_rules === 'object' && data.booking_rules ? data.booking_rules : {};
      const uiSet = typeof data.ui_settings === 'object' && data.ui_settings ? data.ui_settings : {};

      res.depositRefundAllowedDays = bRules.depositRefundAllowedDays ?? uiSet.depositRefundAllowedDays ?? (Number(data.deposit_refund_allowed_days) || 0);
      res.deposit_refund_allowed_days = res.depositRefundAllowedDays;
      res.openrouterApiKey = uiSet.openrouterApiKey || null;
      res.openrouterModel = uiSet.openrouterModel || null;
      res.instantCommissionFromDrawer = data.instant_commission_from_drawer !== undefined 
        ? toBool(data.instant_commission_from_drawer) 
        : (uiSet.instantCommissionFromDrawer !== undefined ? toBool(uiSet.instantCommissionFromDrawer) : false);
      res.tipPayoutMethod = data.tip_payout_method || uiSet.tipPayoutMethod || 'instant_cash';
      res.allowNonCashTips = data.allow_non_cash_tips !== undefined ? toBool(data.allow_non_cash_tips) : (uiSet.allowNonCashTips !== undefined ? toBool(uiSet.allowNonCashTips) : true);
      res.enableDualPricing = data.enable_dual_pricing !== undefined ? toBool(data.enable_dual_pricing) : (uiSet.enableDualPricing !== undefined ? toBool(uiSet.enableDualPricing) : false);

      return res;
    } catch (e) { return null; }
  },

  async saveSettings(salonId: string, settings: any) {
    const client = sb();
    if (!client) return false;
    try {
      const validSalonId = toSalonUUID(salonId);
      const validBranchId = toBranchUUID(settings.branchId);

      // Check if existing record exists for this salon - Fetch full record to merge and prevent overwriting!
      const { data: existing } = await client
        .from('app_settings')
        .select('*')
        .eq('salon_id', validSalonId)
        .limit(1)
        .maybeSingle();

      const existingBRules = typeof settings.bookingRules === 'object' && settings.bookingRules 
        ? settings.bookingRules 
        : (typeof existing?.booking_rules === 'object' && existing?.booking_rules ? existing.booking_rules : {});
      const existingUiSettings = typeof settings.uiSettings === 'object' && settings.uiSettings 
        ? settings.uiSettings 
        : (typeof existing?.ui_settings === 'object' && existing?.ui_settings ? existing.ui_settings : {});

      const depositRefundDays = Number(settings.depositRefundAllowedDays ?? settings.deposit_refund_allowed_days ?? existing?.deposit_refund_allowed_days ?? 0);

      const bookingRulesMerged = {
        ...existingBRules,
        depositRefundAllowedDays: depositRefundDays
      };

      const uiSettingsMerged = {
        ...existingUiSettings,
        depositRefundAllowedDays: depositRefundDays,
        openrouterApiKey: settings.openrouterApiKey || existingUiSettings.openrouterApiKey || null,
        openrouterModel: settings.openrouterModel || existingUiSettings.openrouterModel || null,
        instantCommissionFromDrawer: settings.instantCommissionFromDrawer !== undefined ? Boolean(settings.instantCommissionFromDrawer) : (existingUiSettings.instantCommissionFromDrawer ?? false),
        tipPayoutMethod: settings.tipPayoutMethod || existingUiSettings.tipPayoutMethod || 'instant_cash',
        allowNonCashTips: settings.allowNonCashTips !== undefined ? Boolean(settings.allowNonCashTips) : (existingUiSettings.allowNonCashTips ?? true),
        enableDualPricing: settings.enableDualPricing !== undefined ? Boolean(settings.enableDualPricing) : (existingUiSettings.enableDualPricing ?? false)
      };

      const safeSalonName = (settings.salonName && settings.salonName !== 'صالون سمارت كت')
        ? settings.salonName
        : (existing?.salon_name || settings.salonName || 'صالون سمارت كت');

      const safePhone = (settings.phone && settings.phone !== '0500000000')
        ? settings.phone
        : (existing?.phone || settings.phone || '0500000000');

      const safeAddress = settings.address !== undefined
        ? settings.address
        : (existing?.address || '');

      const safeTaxNumber = (settings.taxNumber && settings.taxNumber !== '300000000000003')
        ? settings.taxNumber
        : (existing?.tax_number || settings.taxNumber || '300000000000003');

      const safeCommercialReg = (settings.commercialReg && settings.commercialReg !== '1010000000')
        ? settings.commercialReg
        : (existing?.commercial_reg || settings.commercialReg || '1010000000');

      const safeTreasuries = (Array.isArray(settings.treasuries) && settings.treasuries.length > 0)
        ? settings.treasuries
        : (existing?.treasuries || []);

      const safeExpenseCategories = (Array.isArray(settings.expenseCategories) && settings.expenseCategories.length > 0)
        ? settings.expenseCategories
        : (existing?.expense_categories || []);

      // Allowed columns strictly corresponding to public.app_settings in Supabase
      const snap: any = {
        salon_id: validSalonId,
        branch_id: validBranchId || existing?.branch_id || null,
        salon_name: safeSalonName,
        salon_type: settings.salonType || settings.salon_type || existing?.salon_type || 'men',
        logo_url: settings.logoUrl !== undefined ? settings.logoUrl : (existing?.logo_url || null),
        phone: safePhone,
        address: safeAddress,
        currency: settings.currency || existing?.currency || 'EGP',
        country: settings.country || existing?.country || 'جمهورية مصر العربية',
        tax_number: safeTaxNumber,
        commercial_reg: safeCommercialReg,
        vat_enabled: settings.vatEnabled !== undefined ? toBool(settings.vatEnabled) : (existing?.vat_enabled !== undefined ? toBool(existing.vat_enabled) : true),
        vat_rate: settings.vatRate ?? settings.vatPercentage ?? existing?.vat_rate ?? 15,
        zatca_enabled: settings.zatcaEnabled ?? existing?.zatca_enabled ?? false,
        enable_dual_pricing: settings.enableDualPricing !== undefined ? Boolean(settings.enableDualPricing) : (existing?.enable_dual_pricing ?? false),
        zatca_settings: settings.zatcaSettings || existing?.zatca_settings || null,
        eta_egypt_settings: settings.etaEgyptSettings || existing?.eta_egypt_settings || null,
        receipt_header_note: settings.receiptHeaderNote !== undefined ? settings.receiptHeaderNote : (existing?.receipt_header_note || ''),
        receipt_footer_note: settings.receiptFooterNote !== undefined ? settings.receiptFooterNote : (existing?.receipt_footer_note || ''),
        booking_notes: settings.bookingNotes !== undefined ? settings.bookingNotes : (existing?.booking_notes || ''),
        treasuries: safeTreasuries,
        expense_categories: safeExpenseCategories,
        printer_name: settings.printerName || existing?.printer_name || 'طابعة الكاشير',
        paper_size: settings.paperSize || existing?.paper_size || '80mm',
        print_automatically: settings.printAutomatically !== undefined ? settings.printAutomatically : (existing?.print_automatically ?? false),
        thermal_printer_ip: settings.thermalPrinterIp || existing?.thermal_printer_ip || null,
        thermal_printer_port: settings.thermalPrinterPort ? Number(settings.thermalPrinterPort) : (existing?.thermal_printer_port || 9100),
        evolution_api_url: settings.evolutionApiUrl || existing?.evolution_api_url || null,
        evolution_api_key: settings.evolutionApiKey || settings.waApiKey || existing?.evolution_api_key || null,
        evolution_instance_name: settings.evolutionInstanceName || settings.waInstantName || existing?.evolution_instance_name || null,
        wa_instant_name: settings.evolutionInstanceName || settings.waInstantName || existing?.wa_instant_name || null,
        wa_api_key: settings.evolutionApiKey || settings.waApiKey || existing?.wa_api_key || null,
        evolution_branch_instances: settings.evolutionBranchInstances || existing?.evolution_branch_instances || {},
        supabase_url: settings.supabaseUrl || existing?.supabase_url || null,
        supabase_anon_key: settings.supabaseAnonKey || existing?.supabase_anon_key || null,
        supabase_enabled: settings.supabaseEnabled ?? existing?.supabase_enabled ?? false,
        hr_settings: settings.hrSettings || existing?.hr_settings || null,
        booking_rules: bookingRulesMerged,
        vip_settings: settings.vipSettings || existing?.vip_settings || null,
        tier_settings: settings.tierSettings || existing?.tier_settings || null,
        ui_settings: uiSettingsMerged,
        show_dashboard_analytics: settings.showDashboardAnalytics !== undefined ? settings.showDashboardAnalytics : (existing?.show_dashboard_analytics ?? true),
        show_employee_analytics: settings.showEmployeeAnalytics !== undefined ? settings.showEmployeeAnalytics : (existing?.show_employee_analytics ?? true),
        ai_provider: settings.aiProvider || existing?.ai_provider || 'builtin',
        ai_api_key: settings.aiApiKey || existing?.ai_api_key || null,
        ai_model: settings.aiModel || existing?.ai_model || null,
        updated_at: new Date().toISOString()
      };

      let error: any = null;
      if (existing && existing.id) {
        const res = await client.from('app_settings').update(snap).eq('id', existing.id);
        error = res.error;
      } else {
        const res = await client.from('app_settings').insert(snap);
        error = res.error;
      }
      if (error) { 
        console.error('DB.saveSettings error:', error.message); 
        return false; 
      }
      
      // Keep salons table synchronized as well - ONLY with non-default real values
      const salonUpdate: any = { updated_at: new Date().toISOString() };
      if (settings.salonType) salonUpdate.salon_type = settings.salonType;
      if (settings.salonName && settings.salonName !== 'صالون سمارت كت') salonUpdate.name = settings.salonName;
      if (settings.phone && settings.phone !== '0500000000') salonUpdate.phone = settings.phone;
      if (settings.address) salonUpdate.address = settings.address;
      if (settings.taxNumber && settings.taxNumber !== '300000000000003') salonUpdate.tax_number = settings.taxNumber;
      if (settings.commercialReg && settings.commercialReg !== '1010000000') salonUpdate.commercial_reg = settings.commercialReg;
      if (settings.country) salonUpdate.country = settings.country;
      if (settings.currency) salonUpdate.currency = settings.currency;
      if (settings.logoUrl !== undefined && settings.logoUrl) salonUpdate.logo_url = settings.logoUrl;
      if (Object.keys(salonUpdate).length > 1) {
        await client.from('salons').update(salonUpdate).eq('id', validSalonId);
      }

      return true;
    } catch (e) { 
      console.error('DB.saveSettings exception:', e);
      return false; 
    }
  },

  // --- التحديث المباشر للاشتراكات بدون المساس بإعدادات الصالون نهائياً ---
  async updateSalonSubscription(salonId: string, updates: {
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    subscriptionStartDate?: string;
    subscriptionEndDate?: string;
    isSalonActive?: boolean;
    maxBranches?: number;
    maxUsers?: number;
  }): Promise<boolean> {
    const client = sb();
    if (!client || !salonId) return false;
    const validSalonId = toSalonUUID(salonId);
    try {
      const salonPatch: any = { updated_at: new Date().toISOString() };
      if (updates.subscriptionStatus) salonPatch.subscription_status = updates.subscriptionStatus;
      if (updates.subscriptionPlan) salonPatch.subscription_plan = updates.subscriptionPlan;
      if (updates.subscriptionStartDate) salonPatch.subscription_start_date = toDateOrNull(updates.subscriptionStartDate);
      if (updates.subscriptionEndDate) salonPatch.subscription_end_date = toDateOrNull(updates.subscriptionEndDate);
      if (updates.isSalonActive !== undefined) salonPatch.is_active = updates.isSalonActive;
      if (updates.maxBranches) salonPatch.max_branches = updates.maxBranches;
      if (updates.maxUsers) salonPatch.max_users = updates.maxUsers;

      await client.from('salons').update(salonPatch).eq('id', validSalonId);

      const settingsPatch: any = { updated_at: new Date().toISOString() };
      if (updates.subscriptionStatus) settingsPatch.subscription_status = updates.subscriptionStatus;
      if (updates.subscriptionEndDate) settingsPatch.subscription_end_date = toDateOrNull(updates.subscriptionEndDate);
      if (updates.isSalonActive !== undefined) settingsPatch.is_salon_active = updates.isSalonActive;

      await client.from('app_settings').update(settingsPatch).eq('salon_id', validSalonId);
      return true;
    } catch (e) {
      console.error('DB.updateSalonSubscription error:', e);
      return false;
    }
  },

  // ---- العملاء (Shared Across all Branches of the Same Salon) ----
  async fetchClients(salonId?: string) { return DB.fetchAll<any>('clients', undefined, salonId); },
  
  async saveClient(c: any, salonId?: string) {
    const client = sb();
    if (!client || !c) return null;
    const validSalonId = toSalonUUID(salonId || c.salonId || getSalonId());
    const validBranchId = toBranchUUID(c.branchId);
    try {
      const snap: any = {
        id: c.id,
        salon_id: validSalonId,
        branch_id: validBranchId,
        name: c.name?.trim() || '',
        phone: c.phone?.trim() || '',
        email: c.email?.trim() || null,
        dob: c.dob || null,
        birth_date: toDateOrNull(c.dob || c.birthDate),
        dob_day: c.dobDay || null,
        dob_month: c.dobMonth || null,
        client_type: c.clientType || 'citizen',
        last_birthday_greeting_at: toDateOrNull(c.lastBirthdayGreetingAt || c.last_birthday_greeting_at),
        last_reactivation_message_at: toDateOrNull(c.lastReactivationMessageAt || c.last_reactivation_message_at),
        cashback_balance: Number(c.cashback ?? c.cashbackBalance ?? 0),
        loyalty_points: Number(c.loyaltyPoints ?? 0),
        tier_level: c.tierLevel || 'standard',
        is_vip: c.isVip || false,
        vip_since: toDateOrNull(c.vipSince),
        vip_notes: c.vipNotes || null,
        referred_by_phone: c.referredByPhone?.trim() || null,
        has_used_referral_reward: c.hasUsedReferralReward || false,
        referral_count: Number(c.referralCount ?? 0),
        referral_total_cashback_earned: Number(c.referralTotalCashbackEarned ?? 0),
        notes: c.notes || null,
        is_blacklisted: c.isBlacklisted || false,
        blacklist_reason: c.blacklistReason || null,
        last_visit: toDateOrNull(c.lastVisit),
        preferences: c.preferences || {},
        updated_at: new Date().toISOString()
      };
      const { data, error } = await client.from('clients').upsert(snap, { onConflict: 'id' }).select().single();
      if (error) {
        console.error('DB.saveClient error:', error.message);
        return null;
      }
      return toCamel(data);
    } catch (e) {
      console.error('DB.saveClient exception:', e);
      return null;
    }
  },

  async saveClients(list: any[], salonId?: string) {
    if (!list || !list.length) return true;
    for (const c of list) {
      await this.saveClient(c, salonId);
    }
    return true;
  },

  async deleteClient(clientId: string): Promise<boolean> {
    return DB.remove('clients', clientId);
  },

  // ---- حسابات بوابة حجز العملاء (Client Portal Accounts) ----
  async fetchClientPortalAccountByUsername(username: string) {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername) return null;

    const client = sb();
    try {
      if (client) {
        const { data, error } = await client
          .from('client_portal_accounts')
          .select('*')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (!error && data) {
          const acc = toCamel(data);
          if (data.password_hash) acc.password = data.password_hash;
          return acc;
        }
      }
    } catch (e) {
      console.warn('DB.fetchClientPortalAccountByUsername error:', e);
    }

    // Fallback to local storage
    try {
      const saved = localStorage.getItem('smartcut_client_accounts');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          const found = list.find((a: any) => (a.username || '').trim().toLowerCase() === cleanUsername);
          if (found) return found;
        }
      }
    } catch (e) {}

    return null;
  },

  async checkClientUsernameAvailable(username: string): Promise<boolean> {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) return false;

    try {
      const client = sb();
      if (client) {
        // 1. Check in client_portal_accounts
        const { data: portalUser } = await client
          .from('client_portal_accounts')
          .select('id')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (portalUser) return false;

        // 2. Also ensure no system staff user uses this username
        const { data: staffUser } = await client
          .from('users')
          .select('id')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (staffUser) return false;
      }
    } catch (e) {}

    // Check local storage accounts
    try {
      const saved = localStorage.getItem('smartcut_client_accounts');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          const exists = list.some((a: any) => (a.username || '').trim().toLowerCase() === cleanUsername);
          if (exists) return false;
        }
      }
    } catch (e) {}

    return true;
  },

  async saveClientPortalAccount(account: any) {
    const cleanUsername = (account.username || '').trim().toLowerCase();
    if (!cleanUsername) return null;

    const validSalonId = account.salonId ? toSalonUUID(account.salonId) : null;
    const client = sb();

    const snap: any = {
      id: account.id || ('cli-' + Date.now()),
      username: cleanUsername,
      password_hash: account.password || account.passwordHash || '',
      name: account.name?.trim() || cleanUsername,
      phone: account.phone?.trim() || null,
      email: account.email?.trim() || null,
      country: account.country || 'المملكة العربية السعودية',
      referred_by_phone: account.referredByPhone?.trim() || null,
      salon_id: validSalonId,
      salon_code: account.salonCode || null,
      linked_salon_codes: account.linkedSalonCodes || (account.salonCode ? [account.salonCode] : []),
      avatar_url: account.avatarUrl || null,
      is_verified: true,
      active: true,
      created_at: account.createdAt || new Date().toISOString()
    };

    let result = { ...account, username: cleanUsername };

    if (client) {
      try {
        const { data, error } = await client
          .from('client_portal_accounts')
          .upsert(snap, { onConflict: 'id' })
          .select()
          .single();

        if (!error && data) {
          result = toCamel(data);
          if (data.password_hash) result.password = data.password_hash;
        } else if (error) {
          console.warn('DB.saveClientPortalAccount Supabase error:', error.message);
        }
      } catch (e) {
        console.warn('DB.saveClientPortalAccount exception:', e);
      }
    }

    // Always keep localStorage updated as well
    try {
      const saved = localStorage.getItem('smartcut_client_accounts');
      const list: any[] = saved ? JSON.parse(saved) : [];
      const idx = list.findIndex((a: any) => (a.username || '').trim().toLowerCase() === cleanUsername || a.id === snap.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...result };
      } else {
        list.push(result);
      }
      localStorage.setItem('smartcut_client_accounts', JSON.stringify(list));
    } catch (e) {}

    return result;
  },

  // ---- الفواتير ----
  async fetchInvoices(salonId?: string, branchId?: string) {
    const validSalonId = salonId ? toSalonUUID(salonId) : undefined;
    const filter = (branchId && branchId !== 'all') ? { branch_id: toBranchUUID(branchId) || branchId } : undefined;
    const list = await DB.fetchAll<any>('invoices', filter, validSalonId);
    if (list && list.length > 0) return list.map(dbInvoiceToApp);
    try {
      const cached = localStorage.getItem('smartcut_invoices_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  },
  async saveInvoice(inv: any, salonId?: string) {
    if (!inv) return null;
    const client = sb();
    const validSalonId = toSalonUUID(salonId || inv.salonId || getSalonId());
    const validBranchId = toBranchUUID(inv.branchId);

    // 1. Always cache in localStorage for instant offline & screen reactivity
    try {
      const saved = localStorage.getItem('smartcut_invoices_cache');
      const list = saved ? JSON.parse(saved) : [];
      const filtered = list.filter((i: any) => i.id !== inv.id);
      localStorage.setItem('smartcut_invoices_cache', JSON.stringify([inv, ...filtered].slice(0, 500)));
    } catch (e) {
      console.warn('LocalStorage saveInvoice warning:', e);
    }

    if (!client) return inv;

    try {
      const safeClientId = (inv.clientId && typeof inv.clientId === 'string' && inv.clientId.trim()) ? inv.clientId.trim() : null;
      const snap: any = {
        id: inv.id,
        salon_id: validSalonId,
        branch_id: validBranchId,
        branch_code: inv.branchCode || null,
        invoice_number: inv.invoiceNumber || inv.invoice_number || inv.id || ('INV-' + Date.now()),
        client_id: safeClientId,
        client_name: inv.clientName || inv.client_name || 'عميل نقدي',
        client_phone: inv.clientPhone || inv.client_phone || '0000000000',
        cashier_id: inv.cashierId || null,
        cashier_name: inv.cashierName || null,
        date: inv.date || new Date().toISOString(),
        subtotal: Number(inv.subtotal ?? inv.total ?? 0),
        discount: Number(inv.discount ?? 0),
        discount_type: inv.discountType || 'fixed',
        tax: Number(inv.vatAmount ?? inv.tax ?? inv.vat ?? 0),
        vat: Number(inv.vatAmount ?? inv.vat ?? inv.tax ?? 0),
        cashback_used: Number(inv.cashbackUsed ?? 0),
        total: Number(inv.total ?? 0),
        paid: Number(inv.paid ?? inv.paidAmount ?? inv.total ?? 0),
        paid_amount: Number(inv.paidAmount ?? inv.paid ?? inv.total ?? 0),
        remaining: Number(inv.remaining ?? inv.remainingAmount ?? 0),
        remaining_amount: Number(inv.remainingAmount ?? inv.remaining ?? 0),
        advance_deduction: Number(inv.advanceDeduction ?? 0),
        booking_id: inv.bookingId || null,
        payment_method: inv.paymentMethods?.[0]?.treasuryId || inv.paymentMethod || 'cash',
        treasury_id: inv.paymentMethods?.[0]?.treasuryId || inv.treasuryId || 'main',
        items: inv.items || [], 
        payment_methods: inv.paymentMethods || (inv.paymentMethod ? [{ amount: inv.total || 0, treasuryId: inv.paymentMethod }] : []),
        status: inv.status || 'completed',
        is_cancelled: Boolean(inv.status === 'cancelled' || inv.isCancelled),
        cancel_reason: inv.cancelReason || null,
        cancelled_at: inv.cancelledAt || null,
        is_remedy: Boolean(inv.isRemedyInvoice || inv.isRemedy || false),
        remedy_notes: inv.remedyReason || inv.remedyNotes || null,
        related_complaint_id: inv.relatedComplaintId || null,
        original_invoice_id: inv.originalInvoiceId || null,
        before_photo_url: inv.beforePhotoUrl || null,
        after_photo_url: inv.afterPhotoUrl || null,
        zatca_qr: inv.zatcaQr || null,
        zatca_hash: inv.zatcaHash || null,
        zatca_reporting_status: inv.zatcaReportingStatus || 'not_submitted',
        eta_submission_uuid: inv.etaSubmissionUuid || null,
        eta_status: inv.etaStatus || 'not_submitted',
        shift_id: inv.shiftId || null,
        shift_date: inv.shiftDate || (inv.date ? inv.date.split('T')[0] : null),
        shift_code: inv.shiftCode || null,
        tips: Number(inv.tipAmount ?? inv.tips ?? 0),
        notes: inv.notes || inv.note || null,
        due_date: inv.dueDate || inv.due_date || null,
        bad_debt_reason: inv.badDebtReason || inv.bad_debt_reason || null,
        bad_debt_at: inv.badDebtAt || inv.bad_debt_at || null,
        bad_debt_by: inv.badDebtBy || inv.bad_debt_by || null,
        payments_history: inv.paymentsHistory || inv.payments_history || [],
        created_by: inv.createdBy || null
      };

      let { error } = await client.from('invoices').upsert(snap, { onConflict: 'id' });
      if (error && error.code === '23503') {
        if (error.message?.includes('client_id') || error.details?.includes('clients')) {
          console.warn('DB.saveInvoice FK warning on client_id, retrying with client_id = null:', error.message);
          snap.client_id = null;
        }
        if (error.message?.includes('branch_id') || error.details?.includes('branches')) {
          console.warn('DB.saveInvoice FK warning on branch_id, retrying with branch_id = null:', error.message);
          snap.branch_id = null;
        }
        const retry = await client.from('invoices').upsert(snap, { onConflict: 'id' });
        error = retry.error;
        if (error && error.code === '23503') {
          snap.client_id = null;
          snap.branch_id = null;
          const retry2 = await client.from('invoices').upsert(snap, { onConflict: 'id' });
          error = retry2.error;
        }
      }

      if (error) { 
        console.error('DB.saveInvoice error:', error.message); 
        return null; 
      }
      return inv;
    } catch (e) { 
      console.error('DB.saveInvoice exception:', e); 
      return null; 
    }
  },

  // ---- مرتجعات المبيعات (Sales Returns) ----
  async fetchSalesReturns(salonId?: string) {
    const list = await DB.fetchAll<any>('sales_returns', undefined, salonId);
    if (list && list.length > 0) return list;
    try {
      const cached = localStorage.getItem('smartcut_sales_returns');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  },
  async saveSalesReturn(ret: any, salonId?: string) {
    if (!ret) return null;
    const validSalonId = toSalonUUID(salonId || ret.salonId || getSalonId());
    const validBranchId = toBranchUUID(ret.branchId);

    // 1. Always ensure cached in localStorage immediately for instant offline reactivity
    try {
      const saved = localStorage.getItem('smartcut_sales_returns');
      const list = saved ? JSON.parse(saved) : [];
      const filtered = list.filter((r: any) => r.id !== ret.id);
      localStorage.setItem('smartcut_sales_returns', JSON.stringify([ret, ...filtered]));
    } catch (e) {
      console.warn('LocalStorage saveSalesReturn warning:', e);
    }

    // 2. Persist to DB / Supabase if connected
    const client = sb();
    if (client) {
      try {
        const snap: any = {
          id: ret.id,
          salon_id: validSalonId,
          branch_id: validBranchId,
          return_number: ret.returnNumber || ret.id,
          original_invoice_id: ret.originalInvoiceId || null,
          original_invoice_number: ret.originalInvoiceNumber || null,
          is_general_return: ret.isGeneralReturn ? 1 : 0,
          date: ret.date,
          time: ret.time,
          client_id: ret.clientId || null,
          client_name: ret.clientName,
          client_phone: ret.clientPhone || '',
          total_refund_amount: ret.totalRefundAmount || 0,
          refund_method: ret.refundMethod || 'cash',
          treasury_id: ret.treasuryId || 'main',
          treasury_name: ret.treasuryName || 'الخزينة الرئيسية',
          reason: ret.reason || 'customer_request',
          reason_text: ret.reasonText || null,
          notes: ret.notes || null,
          created_by_name: ret.createdByName || null,
          created_by_id: ret.createdById || null,
          status: ret.status || 'completed',
          items: ret.items || [],
          created_at: ret.createdAt || new Date().toISOString()
        };
        let { error } = await client.from('sales_returns').upsert(snap, { onConflict: 'id' });
        if (error && error.code === '23503' && snap.client_id) {
          snap.client_id = null;
          const retry = await client.from('sales_returns').upsert(snap, { onConflict: 'id' });
          error = retry.error;
        }
        if (error) {
          console.warn('DB.saveSalesReturn upsert error (saved locally):', error.message);
        }
      } catch (e) {
        console.warn('DB.saveSalesReturn exception (saved locally):', e);
      }
    }
    return ret;
  },
  async deleteSalesReturn(returnId: string) {
    try {
      const saved = localStorage.getItem('smartcut_sales_returns');
      if (saved) {
        const list = JSON.parse(saved);
        localStorage.setItem('smartcut_sales_returns', JSON.stringify(list.filter((r: any) => r.id !== returnId)));
      }
      const client = sb();
      if (client) {
        await client.from('sales_returns').delete().eq('id', returnId);
      }
      return true;
    } catch {
      return false;
    }
  },

  // ---- المعاملات المالية ----
  async fetchTransactions(salonId?: string) { return DB.fetchAll<any>('transactions', undefined, salonId); },
  async saveTransaction(t: any, salonId?: string) {
    const client = sb(); if (!client || !t) return null;
    const validSalonId = toSalonUUID(salonId || t.salonId || getSalonId());
    const validBranchId = toBranchUUID((t as any).branchId);
    try {
      const snap: any = {
        id: t.id || ('TRX-' + Math.random().toString(36).substring(2, 9)), 
        salon_id: validSalonId, 
        branch_id: validBranchId,
        branch_code: (t as any).branchCode || null,
        date: t.date || new Date().toISOString(), 
        type: t.type || 'in', 
        amount: Number(t.amount || 0), 
        category: t.category || 'sales',
        expense_category: t.expenseCategory || t.category || null, 
        description: t.description || '',
        treasury: t.treasury || t.treasuryId || 'الخزينة الرئيسية',
        treasury_id: t.treasuryId || t.treasury || 'main',
        payment_method: t.paymentMethod || 'cash',
        invoice_id: (t as any).invoiceId || (t as any).invoice_id || null,
        booking_id: (t as any).bookingId || (t as any).booking_id || null,
        shift_id: (t as any).shiftId || (t as any).shift_id || null,
        shift_code: (t as any).shiftCode || (t as any).shift_code || null,
        shift_date: t.shiftDate || null,
        created_by: t.createdBy || null, 
        user_id: t.userId || null,
        user_name: t.userName || null
      };

      let attempts = 0;
      let lastError: any = null;

      while (attempts < 8) {
        attempts++;
        const { error } = await client.from('transactions').upsert(snap, { onConflict: 'id' });
        if (!error) {
          lastError = null;
          break;
        }

        lastError = error;
        const errMsg = error.message || '';

        // 1. Foreign Key constraints
        if (error.code === '23503' || errMsg.includes('foreign key')) {
          if (snap.invoice_id && (errMsg.includes('invoice_id') || error.details?.includes('invoices'))) {
            snap.invoice_id = null;
            continue;
          }
          if (snap.booking_id && (errMsg.includes('booking_id') || error.details?.includes('bookings'))) {
            snap.booking_id = null;
            continue;
          }
          if (snap.branch_id && (errMsg.includes('branch_id') || error.details?.includes('branches'))) {
            snap.branch_id = null;
            continue;
          }
          if (snap.shift_id && (errMsg.includes('shift_id') || error.details?.includes('shifts') || error.details?.includes('daily_shifts') || error.details?.includes('work_shifts'))) {
            snap.shift_id = null;
            continue;
          }
        }

        // 2. Missing Column in Schema Cache (PGRST204 or PostgreSQL 42703)
        const missingColMatch = errMsg.match(/Could not find the '([^']+)' column of '([^']+)'/i)
          || errMsg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i);

        if (missingColMatch) {
          const missingCol = missingColMatch[1];
          console.warn(`DB.saveTransaction stripping unknown column '${missingCol}' and retrying...`);
          delete snap[missingCol];
          continue;
        }

        // 3. Fallback for specific optional columns that might not exist in older tables
        let pruned = false;
        const optionalCols = [
          'treasury_id', 'payment_method', 'booking_id', 'shift_id', 'shift_code',
          'expense_category', 'branch_code', 'user_id', 'user_name', 'created_by'
        ];
        for (const col of optionalCols) {
          if (errMsg.includes(col) && snap[col] !== undefined) {
            delete snap[col];
            pruned = true;
          }
        }
        if (pruned) continue;

        break;
      }

      if (lastError) {
        console.error('DB.saveTransaction final error:', lastError.message);
        return null;
      }

      return t;
    } catch (e) {
      console.error('DB.saveTransaction exception:', e);
      return null;
    }
  },
  async saveTransactions(list: any[], salonId?: string) {
    if (!list || !list.length) return true;
    for (const t of list) await this.saveTransaction(t, salonId);
    return true;
  },

  // ---- الحجوزات ----
  async fetchBookings(salonId?: string) { 
    const list = await DB.fetchAll<any>('bookings', undefined, salonId);
    return (list || []).map(dbBookingToApp);
  },
  async saveBooking(b: any, salonId?: string) {
    const client = sb(); if (!client || !b) return null;
    const validSalonId = toSalonUUID(salonId || b.salonId || getSalonId());
    const validBranchId = toBranchUUID((b as any).branchId);
    try {
      const allowedSources = ['pos', 'online', 'phone'];
      const safeSource = allowedSources.includes(b.source) ? b.source : 'pos';
      const safePhone = b.phone || b.clientPhone || b.customerPhone || '0000000000';
      const safeName = b.clientName || b.customerName || 'عميل حجز';
      const firstSrv = (b.services && Array.isArray(b.services) && b.services[0]) ? b.services[0] : null;
      const safeEmpId = b.employeeId || b.barberId || firstSrv?.technicianId || firstSrv?.employeeId || null;
      const safeEmpName = b.employeeName || b.barberName || firstSrv?.technicianName || firstSrv?.employeeName || null;
      const safeSrvId = b.serviceId || firstSrv?.serviceId || firstSrv?.id || null;
      const safeSrvName = b.serviceName || firstSrv?.serviceName || firstSrv?.name || null;

      const rawClientId = b.clientId || b.customerId || (b as any).client_id;
      const safeClientId = (rawClientId && UUID_REGEX.test(rawClientId)) ? rawClientId : null;

      const safeDate = typeof b.date === 'string' ? b.date.split('T')[0].trim() : (b.date || new Date().toISOString().split('T')[0]);
      const rawTime = b.time || b.startTime || '10:00';
      const safeTime = String(rawTime).includes('T')
        ? (String(rawTime).split('T')[1]?.slice(0, 5) || '10:00')
        : (String(rawTime).slice(0, 8) || '10:00');

      const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
      const safeStatus = allowedStatuses.includes(b.status) ? b.status : 'confirmed';

      let cleanAdvances = b.advancePayments || b.advance_payments || [];
      if (typeof cleanAdvances === 'string') {
        try { cleanAdvances = JSON.parse(cleanAdvances); } catch { cleanAdvances = []; }
      }
      if (!Array.isArray(cleanAdvances)) cleanAdvances = [];

      let cleanServices = b.services || [];
      if (typeof cleanServices === 'string') {
        try { cleanServices = JSON.parse(cleanServices); } catch { cleanServices = []; }
      }
      if (!Array.isArray(cleanServices)) cleanServices = [];

      const snap: any = {
        id: b.id || ('B-' + Math.random().toString(36).substring(2, 9).toUpperCase()),
        salon_id: validSalonId,
        branch_id: validBranchId,
        branch_code: (b as any).branchCode || null,
        client_id: safeClientId,
        client_name: safeName,
        client_phone: safePhone,
        customer_email: b.customerEmail || b.customer_email || null,
        booking_code: b.bookingCode || b.booking_code || null,
        source: safeSource,
        services: cleanServices,
        total_amount: Number(b.totalAmount ?? b.total_amount ?? b.totalPrice ?? b.total_price ?? 0),
        date: safeDate,
        time: safeTime,
        status: safeStatus,
        advance_payments: cleanAdvances,
        notes: b.notes || null,
        created_at: b.createdAt || b.created_at || new Date().toISOString()
      };

      // Add optional fields supported by schema migrations
      if (safeEmpId) snap.employee_id = safeEmpId;
      if (safeEmpName) snap.employee_name = safeEmpName;
      if (safeSrvId) snap.service_id = safeSrvId;
      if (safeSrvName) snap.service_name = safeSrvName;
      if (b.queueNumber !== undefined && b.queueNumber !== null) snap.queue_number = b.queueNumber;
      if (b.location) snap.location = b.location;
      if (b.internalNotes) snap.internal_notes = b.internalNotes;
      if (b.isPaid !== undefined) snap.is_paid = Boolean(b.isPaid);
      if (b.invoiceId) snap.invoice_id = b.invoiceId;
      if (b.discountType) snap.discount_type = b.discountType;
      if (b.discountValue !== undefined && b.discountValue !== null) snap.discount_value = Number(b.discountValue);
      if (b.discountAmount !== undefined && b.discountAmount !== null) snap.discount_amount = Number(b.discountAmount);
      if (b.createdBy || b.createdByName) snap.created_by = b.createdBy || b.createdByName;
      if (b.createdByName || b.createdBy) snap.created_by_name = b.createdByName || b.createdBy;
      if (b.updatedAt) snap.updated_at = b.updatedAt;
      if (b.updatedBy || b.updatedByName) snap.updated_by = b.updatedBy || b.updatedByName;
      if (b.updatedByName || b.updatedBy) snap.updated_by_name = b.updatedByName || b.updatedBy;

      // Timezone-aware UTC start_time & end_time
      try {
        const salonTz = b.timezone || (b as any).timeZone || getSalonTimezone();
        let startTimeUtc = b.startTime || b.start_time;
        if (startTimeUtc && !String(startTimeUtc).endsWith('Z')) {
          const timePart = String(startTimeUtc).includes('T') ? String(startTimeUtc).split('T')[1].slice(0, 5) : String(startTimeUtc).slice(0, 5);
          startTimeUtc = localSalonTimeToUtcIso(safeDate, timePart, salonTz);
        } else if (!startTimeUtc) {
          startTimeUtc = localSalonTimeToUtcIso(safeDate, safeTime, salonTz);
        }
        if (startTimeUtc) snap.start_time = startTimeUtc;

        let endTimeUtc = b.endTime || b.end_time;
        if (endTimeUtc && !String(endTimeUtc).endsWith('Z')) {
          const timePart = String(endTimeUtc).includes('T') ? String(endTimeUtc).split('T')[1].slice(0, 5) : String(endTimeUtc).slice(0, 5);
          endTimeUtc = localSalonTimeToUtcIso(safeDate, timePart, salonTz);
        } else if (!endTimeUtc && (b.duration || b.durationMinutes)) {
          const durMin = Number(b.duration || b.durationMinutes || 30);
          if (startTimeUtc) {
            const sMs = new Date(startTimeUtc).getTime();
            if (!isNaN(sMs)) {
              endTimeUtc = new Date(sMs + durMin * 60 * 1000).toISOString();
            }
          }
        }
        if (endTimeUtc) snap.end_time = endTimeUtc;
        if (b.timezone) snap.timezone = b.timezone;
      } catch (tzErr) {
        console.warn('DB.saveBooking timezone conversion warning:', tzErr);
      }

      // Resilient local storage update
      try {
        const stored = localStorage.getItem('smartcut_bookings');
        const list = stored ? JSON.parse(stored) : [];
        const idx = list.findIndex((item: any) => item.id === snap.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...b };
        } else {
          list.unshift(b);
        }
        localStorage.setItem('smartcut_bookings', JSON.stringify(list));
      } catch (e) {}

      let attempts = 0;
      let lastError: any = null;

      while (attempts < 8) {
        attempts++;
        const { error } = await client.from('bookings').upsert(snap, { onConflict: 'id' });
        if (!error) {
          lastError = null;
          break;
        }

        lastError = error;
        const errMsg = error.message || '';

        // 1. Foreign Key constraint on client_id or branch_id
        if (error.code === '23503' || errMsg.includes('foreign key') || errMsg.includes('client_id')) {
          if (snap.client_id) {
            console.warn('DB.saveBooking client_id foreign key retry with null');
            snap.client_id = null;
            continue;
          }
        }
        if (error.code === '23503' || errMsg.includes('foreign key') || errMsg.includes('branch_id')) {
          if (snap.branch_id) {
            console.warn('DB.saveBooking branch_id foreign key retry with null');
            snap.branch_id = null;
            continue;
          }
        }

        // 2. Missing Column in Schema Cache (PGRST204 or PostgreSQL 42703)
        const missingColMatch = errMsg.match(/Could not find the '([^']+)' column of '([^']+)'/i)
          || errMsg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i);

        if (missingColMatch) {
          const missingCol = missingColMatch[1];
          console.warn(`DB.saveBooking stripping unknown column '${missingCol}' and retrying...`);
          delete snap[missingCol];
          continue;
        }

        // 3. Fallback for specific optional columns that might not exist in older tables
        let pruned = false;
        const optionalCols = [
          'created_by', 'created_by_name', 'updated_at', 'updated_by', 'updated_by_name',
          'internal_notes', 'location', 'queue_number', 'is_paid', 'invoice_id',
          'discount_type', 'discount_value', 'discount_amount',
          'employee_id', 'employee_name', 'service_id', 'service_name', 'branch_code',
          'start_time', 'end_time', 'timezone'
        ];
        for (const col of optionalCols) {
          if (errMsg.includes(col) && snap[col] !== undefined) {
            delete snap[col];
            pruned = true;
          }
        }
        if (pruned) continue;

        // 4. Check constraint violation on source or status
        if (errMsg.includes('source') || errMsg.includes('check constraint')) {
          snap.source = 'pos';
          snap.status = 'confirmed';
          continue;
        }

        break;
      }

      if (lastError) {
        console.warn('DB.saveBooking trying guaranteed minimal payload:', lastError.message);
        const minimalSnap = {
          id: snap.id,
          salon_id: snap.salon_id,
          branch_id: snap.branch_id,
          client_name: snap.client_name || 'عميل نقدي',
          client_phone: snap.client_phone || '0000000000',
          source: 'pos',
          services: snap.services || [],
          total_amount: snap.total_amount || 0,
          date: snap.date,
          time: snap.time || '10:00',
          status: 'confirmed',
          advance_payments: snap.advance_payments || []
        };
        const minRetry = await client.from('bookings').upsert(minimalSnap, { onConflict: 'id' });
        if (minRetry.error) {
          console.error('DB.saveBooking failed completely:', minRetry.error.message);
          return null;
        }
      }

      return b;
    } catch (e) {
      console.error('DB.saveBooking exception:', e);
      return null;
    }
  },

  // ---- الموظفون ----
  async fetchEmployees(salonId?: string) { 
    const list = await DB.fetchAll<any>('employees', undefined, salonId);
    return (list || []).map(dbEmployeeToApp);
  },
  async saveEmployee(e: any, salonId?: string) {
    const client = sb(); if (!client || !e) return null;
    let validSalonId = toSalonUUID(salonId || e.salonId || getSalonId());
    const validBranchId = toBranchUUID(e.branchId);

    // Map frontend 'none' to null so Postgres check constraint passes
    const dbCommissionModel = (e.commissionModel === 'none' || e.commissionModel === null)
      ? null
      : (e.commissionModel || 'fixed_rate');

    try {
      const snap: any = {
        id: e.id, 
        salon_id: validSalonId || null, 
        branch_id: validBranchId,
        salon_code: e.salonCode || null, 
        branch_code: e.branchCode || null,
        name: e.name, 
        email: e.email || null, 
        avatar_url: e.avatarUrl || null,
        public_bio: e.publicBio || null, 
        has_online_account: e.hasOnlineAccount || false,
        user_id: e.userId || null, 
        role: e.role, 
        phone: e.phone || '',
        basic_salary: Number(e.basicSalary ?? e.baseSalary ?? 0) || 0,
        base_salary: Number(e.baseSalary ?? e.basicSalary ?? 0) || 0,
        fingerprint_code: e.fingerprintCode || null, 
        commission_rate: e.commissionRate !== undefined && e.commissionRate !== null ? Number(e.commissionRate) : 0,
        commission_model: dbCommissionModel,
        commission_tiers: e.commissionTiers || [],
        target: e.target ?? e.targetAmount ?? 5000, 
        target_amount: e.targetAmount ?? e.target ?? 5000, 
        target_type: e.targetType || 'monthly',
        daily_target_amount: Number(e.dailyTargetAmount ?? e.daily_target_amount ?? 0),
        daily_target_method: e.dailyTargetMethod || 'excess_only',
        daily_target_multiplier: Number(e.dailyTargetMultiplier ?? e.targetSalaryMultiplier ?? 1) || 1,
        monthly_target_amount: Number(e.monthlyTargetAmount ?? e.monthly_target_amount ?? e.target ?? 5000),
        monthly_target_method: e.monthlyTargetMethod || 'deduct_salary',
        monthly_target_multiplier: Number(e.monthlyTargetMultiplier ?? e.targetSalaryMultiplier ?? 1) || 1,
        target_salary_multiplier: Number(e.targetSalaryMultiplier ?? e.monthlyTargetMultiplier ?? e.dailyTargetMultiplier ?? 1) || 1,
        target_commission_rate: Number(e.targetCommissionRate ?? e.target_commission_rate ?? 0),
        available_vacations: e.availableVacations ?? 21,
        salary_type: e.salaryType || 'salary',
        allow_dual_commission: e.allowDualCommission || false,
        check_in_time: e.checkInTime || '09:00', 
        check_out_time: e.checkOutTime || '18:00',
        weekly_days_off: e.weeklyDaysOff || ['Friday'],
        is_active: e.isActive !== false ? 1 : 0, 
        is_blacklisted: toBool(e.isBlacklisted) ? 1 : 0,
        blacklist_reason: e.blacklistReason || null,
        financial_records: e.financialRecords || [],
        leave_records: e.leaveRecords || [],
        salary_history: e.salaryHistory || [],
        shift_schedule_history: e.shiftScheduleHistory || [],
        permission_records: e.permissionRecords || [],
        end_of_service: e.endOfService || null,
        updated_at: new Date().toISOString()
      };
      let { error } = await client.from('employees').upsert(snap, { onConflict: 'id' });
      if (error && (error.message?.includes('daily_target_multiplier') || error.message?.includes('monthly_target_multiplier') || error.message?.includes('target_salary_multiplier'))) {
        console.warn('DB.saveEmployee: multiplier columns not found in schema cache, retrying without them...', error.message);
        delete (snap as any).daily_target_multiplier;
        delete (snap as any).monthly_target_multiplier;
        delete (snap as any).target_salary_multiplier;
        const retryResult = await client.from('employees').upsert(snap, { onConflict: 'id' });
        error = retryResult.error;
      }
      if (error) { console.error('DB.saveEmployee error:', error.message); return null; }
      return e;
    } catch (e2) { console.error('DB.saveEmployee exception:', e2); return null; }
  },
  async saveEmployees(list: any[], salonId?: string) { for (const e of list) await DB.saveEmployee(e, salonId); return true; },
  async deleteEmployee(employeeId: string): Promise<boolean> {
    return DB.remove('employees', employeeId);
  },

  // ---- الخدمات ----
  async fetchServices(salonId?: string) { return DB.fetchAll<any>('services', undefined, salonId); },
  async saveService(s: any, salonId?: string) {
    const client = sb(); if (!client || !s) return null;
    const validSalonId = toSalonUUID(salonId || s.salonId || getSalonId());
    try {
      const snap: any = {
        id: s.id, 
        salon_id: validSalonId, 
        category_id: s.categoryId || null, 
        name: s.name,
        price: s.price ?? 0, 
        foreigner_price: (s.foreignerPrice !== undefined && s.foreignerPrice !== null && s.foreignerPrice !== '') ? Number(s.foreignerPrice) : null,
        discount_price: s.discountPrice ?? 0,
        commission_rate: s.employeeCommissionPercentage ?? s.commissionRate ?? 0,
        commission_amount: s.employeeCommissionAmount ?? s.commissionAmount ?? 0,
        employee_commission_percentage: s.employeeCommissionPercentage ?? s.commissionRate ?? 0,
        employee_commission_amount: s.employeeCommissionAmount ?? s.commissionAmount ?? 0,
        commissionable_amount: s.commissionableAmount ?? (s as any).commissionable_amount ?? null,
        is_target_exempt: s.isTargetExempt ? 1 : 0,
        referral_commission_type: s.referralCommissionType || 'percentage',
        referral_commission_amount: s.referralCommissionAmount ?? 0,
        cashback_percentage: s.cashbackPercentage ?? 0,
        client_referral_cashback_type: s.clientReferralCashbackType || 'percentage',
        client_referral_cashback_amount: s.clientReferralCashbackAmount ?? 0,
        duration: s.durationMinutes ?? s.duration ?? 30,
        duration_minutes: s.durationMinutes ?? s.duration ?? 30, 
        barcode: s.barcode || null,
        image_url: s.imageUrl || s.image_url || null,
        is_priority: s.isPriority ?? s.is_priority ?? false,
        card_color: s.cardColor || s.card_color || null,
        priority_order: s.priorityOrder ?? s.priority_order ?? 0,
        is_active: s.isActive !== false, 
        type: s.type || 'service'
      };
      const { error } = await client.from('services').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveService error:', error.message); return null; }
      return s;
    } catch (e) { console.error('DB.saveService exception:', e); return null; }
  },
  async saveServices(list: any[], salonId?: string) { for (const s of list) await DB.saveService(s, salonId); return true; },

  // ---- نظام إدارة ومراقبة المساحات التخزينية للفروع في Supabase Storage ----

  /**
   * فحص كوتة التخزين المخصصة للفرع
   */
  async checkBranchStorageQuota(
    salonId?: string, 
    branchId?: string, 
    newFileSizeBytes: number = 0
  ): Promise<{ allowed: boolean; currentUsedBytes: number; limitMb: number; message?: string }> {
    const defaultLimitMb = 50;
    try {
      const client = sb();
      if (!client) {
        return { allowed: true, currentUsedBytes: 0, limitMb: defaultLimitMb };
      }

      let targetBranch: any = null;
      if (branchId) {
        const { data } = await client.from('branches').select('id, settings').eq('id', branchId).maybeSingle();
        targetBranch = data;
      }
      if (!targetBranch && salonId) {
        const validSalonId = toSalonUUID(salonId);
        const { data } = await client.from('branches').select('id, settings').eq('salon_id', validSalonId).limit(1).maybeSingle();
        targetBranch = data;
      }

      const st = (typeof targetBranch?.settings === 'object' && targetBranch?.settings) ? targetBranch.settings : {};
      const limitMb = Number(st.storageLimitMb ?? defaultLimitMb);
      const currentUsedBytes = Number(st.usedStorageBytes ?? 0);
      const limitBytes = limitMb * 1024 * 1024;

      if ((currentUsedBytes + newFileSizeBytes) > limitBytes) {
        const usedMb = (currentUsedBytes / (1024 * 1024)).toFixed(2);
        return {
          allowed: false,
          currentUsedBytes,
          limitMb,
          message: `تم استنفاذ المساحة التخزينية المخصصة لهذا الفرع (${limitMb} MB). المساحة الحالية المستخدمة: ${usedMb} MB. تم إيقاف رفع الصور لهذا الفرع لتجنب تجاوز الحد المسموح. يمكنك زيادة المساحة التخزينية للفرع من شاشة الإعدادات.`
        };
      }

      return { allowed: true, currentUsedBytes, limitMb };
    } catch (e) {
      console.warn('DB.checkBranchStorageQuota exception:', e);
      return { allowed: true, currentUsedBytes: 0, limitMb: defaultLimitMb };
    }
  },

  /**
   * تحديث المساحة المستخدمة للفرع في Supabase وقائمة التخزين المحلي
   */
  async updateBranchStorageUsage(salonId?: string, branchId?: string, deltaBytes: number = 0): Promise<void> {
    if (!deltaBytes) return;
    try {
      const client = sb();
      if (!client) return;

      let targetBranchId = branchId;
      if (!targetBranchId && salonId) {
        const validSalonId = toSalonUUID(salonId);
        const { data } = await client.from('branches').select('id').eq('salon_id', validSalonId).limit(1).maybeSingle();
        targetBranchId = data?.id;
      }
      if (!targetBranchId) return;

      const { data: bData } = await client.from('branches').select('id, settings').eq('id', targetBranchId).maybeSingle();
      if (!bData) return;

      const currentSettings = (typeof bData.settings === 'object' && bData.settings) ? bData.settings : {};
      const currentBytes = Number(currentSettings.usedStorageBytes ?? 0);
      const newBytes = Math.max(0, currentBytes + deltaBytes);

      const updatedSettings = {
        ...currentSettings,
        usedStorageBytes: newBytes
      };

      await client.from('branches').update({ settings: updatedSettings, updated_at: new Date().toISOString() }).eq('id', targetBranchId);

      // تحديث فروع التخزين المحلي فورياً لتحديث الواجهة تلقائياً
      try {
        const stored = localStorage.getItem('smartcut_saas_branches');
        if (stored) {
          const list: any[] = JSON.parse(stored);
          const updated = list.map(b => b.id === targetBranchId ? { ...b, usedStorageBytes: newBytes, settings: updatedSettings } : b);
          localStorage.setItem('smartcut_saas_branches', JSON.stringify(updated));
        }
      } catch {}
    } catch (e) {
      console.warn('DB.updateBranchStorageUsage error:', e);
    }
  },

  /**
   * مزامنة وإعادة احتساب المساحة التخزينية الفعلية للفرع بمطابقة مجلدات Supabase Storage
   */
  async syncBranchStorageUsage(salonId: string, branchId: string): Promise<number> {
    try {
      const client = sb();
      if (!client || !salonId || !branchId) return 0;

      const cleanSalonId = salonId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanBranchId = branchId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const categories = ['services', 'employees', 'clients'];
      let totalBytes = 0;

      for (const cat of categories) {
        const prefix = `salons/${cleanSalonId}/branches/${cleanBranchId}/${cat}`;
        try {
          const { data: files } = await client.storage.from('services').list(prefix, { limit: 1000 });
          if (files && Array.isArray(files)) {
            for (const f of files) {
              if (f.metadata?.size) {
                totalBytes += Number(f.metadata.size);
              }
            }
          }
        } catch {}
      }

      // حفظ الإجمالي الدقيق في الفرع
      const { data: bData } = await client.from('branches').select('id, settings').eq('id', branchId).maybeSingle();
      if (bData) {
        const currentSettings = (typeof bData.settings === 'object' && bData.settings) ? bData.settings : {};
        const updatedSettings = { ...currentSettings, usedStorageBytes: totalBytes };
        await client.from('branches').update({ settings: updatedSettings, updated_at: new Date().toISOString() }).eq('id', branchId);
      }

      return totalBytes;
    } catch (e) {
      console.warn('DB.syncBranchStorageUsage error:', e);
      return 0;
    }
  },

  /**
   * رفع صورة مخصصة لفرع وصالون محددين مع العزل التام للمجلدات والتحقق من الكوتة
   */
  async uploadBranchImage(options: {
    fileOrBlob: File | Blob | string;
    salonId?: string;
    branchId?: string;
    category: 'services' | 'employees' | 'clients';
    identifier?: string;
    subType?: string;
    oldImageUrl?: string;
  }): Promise<{ url: string; error?: string }> {
    const { fileOrBlob, category, identifier, subType, oldImageUrl } = options;
    const client = sb();
    if (!client) {
      return { url: typeof fileOrBlob === 'string' ? fileOrBlob : '' };
    }

    const salonId = options.salonId || localStorage.getItem('smartcut_active_salon_id') || 'default_salon';
    const branchId = options.branchId || localStorage.getItem('smartcut_active_branch_id') || 'main_branch';

    try {
      await ensureStorageBucket('services');

      let blob: Blob;
      let fileExt = 'webp';

      if (typeof fileOrBlob === 'string') {
        if (!fileOrBlob.startsWith('data:')) {
          return { url: fileOrBlob };
        }
        blob = dataUrlToBlob(fileOrBlob);
        fileExt = fileOrBlob.includes('image/webp') ? 'webp' : 'jpg';
      } else {
        blob = fileOrBlob;
        if (fileOrBlob.type.includes('webp')) fileExt = 'webp';
        else if (fileOrBlob.type.includes('png')) fileExt = 'png';
        else fileExt = 'jpg';
      }

      // 1. فحص كوتة التخزين المخصصة للفرع
      const quota = await DB.checkBranchStorageQuota(salonId, branchId, blob.size);
      if (!quota.allowed) {
        return { url: '', error: quota.message };
      }

      // 2. حذف الصورة القديمة وتخفيض حجمها من المساحة المستهلكة
      if (oldImageUrl) {
        await DB.deleteBranchImage(oldImageUrl, salonId, branchId);
      }

      // 3. مسار المجلد المنعزل بدقة: salons/{salon_id}/branches/{branch_id}/{category}/{filename}
      const cleanSalonId = salonId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanBranchId = branchId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanId = (identifier || 'img').replace(/[^a-zA-Z0-9_-]/g, '_');
      const subTypePrefix = subType ? `${subType}_` : '';
      const fileName = `${cleanId}_${subTypePrefix}${Date.now()}.${fileExt}`;
      const filePath = `salons/${cleanSalonId}/branches/${cleanBranchId}/${category}/${fileName}`;

      // 4. رفع الملف إلى Supabase Storage
      const { error: uploadErr } = await client.storage.from('services').upload(filePath, blob, {
        contentType: blob.type || `image/${fileExt}`,
        cacheControl: '3600',
        upsert: true
      });

      if (uploadErr) {
        console.error('DB.uploadBranchImage error:', uploadErr.message);
        return { url: typeof fileOrBlob === 'string' ? fileOrBlob : '', error: uploadErr.message };
      }

      // 5. استخراج الرابط العام
      const { data: publicUrlData } = client.storage.from('services').getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl || '';

      // 6. زيادة المساحة المستهلكة للفرع
      await DB.updateBranchStorageUsage(salonId, branchId, blob.size);

      return { url: publicUrl };
    } catch (err: any) {
      console.error('DB.uploadBranchImage exception:', err);
      return { url: typeof fileOrBlob === 'string' ? fileOrBlob : '', error: err?.message || 'خطأ أثناء رفع الصورة' };
    }
  },

  /**
   * حذف صورة فرع من Storage وتحديث المساحة المستهلكة
   */
  async deleteBranchImage(imageUrl?: string, salonId?: string, branchId?: string): Promise<boolean> {
    if (!imageUrl || typeof imageUrl !== 'string') return true;
    const client = sb();
    if (!client) return false;

    try {
      let filePath = imageUrl;
      if (imageUrl.includes('/storage/v1/object/public/services/')) {
        filePath = imageUrl.split('/storage/v1/object/public/services/')[1];
      } else if (imageUrl.includes('/services/')) {
        filePath = imageUrl.split('/services/')[1];
      } else if (imageUrl.startsWith('http')) {
        const parts = imageUrl.split('/');
        filePath = parts.slice(-5).join('/');
      }

      if (filePath && !filePath.startsWith('data:')) {
        const cleanPath = filePath.split('?')[0];
        await client.storage.from('services').remove([cleanPath]);
        // تخفيض متوسط الحجم المقدر في حالة عدم معرفة الحجم الفعلي
        await DB.updateBranchStorageUsage(salonId, branchId, -40000);
        return true;
      }
      return true;
    } catch (e) {
      console.warn('DB.deleteBranchImage exception:', e);
      return false;
    }
  },

  // ---- دوال استدعاء مخصصة لكل نوع صورة ----

  async uploadServiceImage(
    fileOrBlob: File | Blob | string, 
    serviceId: string, 
    oldImageUrl?: string,
    salonId?: string,
    branchId?: string
  ): Promise<string> {
    const res = await DB.uploadBranchImage({
      fileOrBlob,
      salonId,
      branchId,
      category: 'services',
      identifier: serviceId,
      oldImageUrl
    });
    if (res.error) {
      alert(res.error);
      return typeof fileOrBlob === 'string' ? fileOrBlob : '';
    }
    return res.url;
  },

  async uploadEmployeeImage(
    fileOrBlob: File | Blob | string,
    employeeId: string,
    oldImageUrl?: string,
    salonId?: string,
    branchId?: string
  ): Promise<{ url: string; error?: string }> {
    return await DB.uploadBranchImage({
      fileOrBlob,
      salonId,
      branchId,
      category: 'employees',
      identifier: employeeId,
      oldImageUrl
    });
  },

  async uploadClientPhoto(
    fileOrBlob: File | Blob | string,
    clientOrInvoiceId: string,
    type: 'before' | 'after',
    salonId?: string,
    branchId?: string,
    oldImageUrl?: string
  ): Promise<{ url: string; error?: string }> {
    return await DB.uploadBranchImage({
      fileOrBlob,
      salonId,
      branchId,
      category: 'clients',
      identifier: clientOrInvoiceId,
      subType: type,
      oldImageUrl
    });
  },

  async deleteServiceImage(imageUrl?: string, salonId?: string, branchId?: string): Promise<boolean> {
    return await DB.deleteBranchImage(imageUrl, salonId, branchId);
  },

  async deleteService(serviceId: string, imageUrl?: string): Promise<boolean> {
    if (imageUrl) {
      await DB.deleteServiceImage(imageUrl);
    }
    return DB.remove('services', serviceId);
  },

  // ---- التصنيفات ----
  async fetchCategories(salonId?: string) { return DB.fetchAll<any>('categories', undefined, salonId); },
  async saveCategory(c: any, salonId?: string) {
    const client = sb(); if (!client || !c) return null;
    const validSalonId = toSalonUUID(salonId || c.salonId || getSalonId());
    const { error } = await client.from('categories').upsert(
      { id: c.id, salon_id: validSalonId, name: c.name, icon: c.icon || 'Scissors', type: c.type || 'service' },
      { onConflict: 'id' }
    );
    if (error) console.error('DB.saveCategory error:', error.message);
    return error ? null : c;
  },
  async deleteCategory(id: string) { return DB.remove('categories', id); },
  async saveCategories(list: any[], salonId?: string) { for (const c of list) await DB.saveCategory(c, salonId); return true; },

  // ---- المنتجات ----
  async fetchProducts(salonId?: string) { return DB.fetchAll<any>('products', undefined, salonId); },
  async saveProduct(p: any, salonId?: string) {
    const client = sb(); if (!client || !p) return null;
    const validSalonId = toSalonUUID(salonId || p.salonId || getSalonId());
    const validBranchId = toBranchUUID(p.branchId);
    const catId = (p.categoryId && p.categoryId !== 'all') 
      ? p.categoryId 
      : (p.category_id && p.category_id !== 'all') 
        ? p.category_id 
        : null;
    const { error } = await client.from('products').upsert({
      id: p.id, salon_id: validSalonId, branch_id: validBranchId,
      category_id: catId, name: p.name,
      retail_price: p.retailPrice ?? p.sellPrice ?? p.price ?? 0,
      sell_price: p.sellPrice ?? p.retailPrice ?? p.price ?? 0, cost_price: p.costPrice ?? 0,
      min_stock_alert: p.minStockAlert ?? p.reorderLimit ?? 5,
      reorder_limit: p.reorderLimit ?? p.minStockAlert ?? 5, opening_stock: p.openingStock ?? 0,
      current_stock: p.currentStock ?? 0, commission: p.commission ?? 0,
      barcode: p.barcode || null, is_active: p.isActive !== false,
      product_type: p.productType || 'for_sale'
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveProduct error:', error.message); return null; }
    return p;
  },
  async deleteProduct(id: string) { return DB.remove('products', id); },
  async saveProducts(list: any[], salonId?: string) { for (const p of list) await DB.saveProduct(p, salonId); return true; },

  // ---- الموردون ----
  async fetchSuppliers(salonId?: string) { return DB.fetchAll<any>('suppliers', undefined, salonId); },
  async saveSupplier(s: any, salonId?: string) {
    const client = sb(); if (!client || !s) return null;
    const validSalonId = toSalonUUID(salonId || s.salonId || getSalonId());
    const { error } = await client.from('suppliers').upsert({
      id: s.id, salon_id: validSalonId, name: s.name, phone: s.phone,
      email: s.email || null, address: s.address || null, current_balance: s.currentBalance ?? 0
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveSupplier error:', error.message); return null; }
    return s;
  },
  async deleteSupplier(id: string) { return DB.remove('suppliers', id); },

  // ---- فواتير الشراء ----
  async fetchPurchaseInvoices(salonId?: string) { return DB.fetchAll<any>('purchase_invoices', undefined, salonId); },
  async savePurchaseInvoice(p: any, salonId?: string) {
    const client = sb(); if (!client || !p) return null;
    const validSalonId = toSalonUUID(salonId || p.salonId || getSalonId());
    const validBranchId = toBranchUUID(p.branchId);
    const { error } = await client.from('purchase_invoices').upsert({
      id: p.id, salon_id: validSalonId, branch_id: validBranchId,
      supplier_id: p.supplierId || null, date: p.date,
      subtotal: p.subtotal ?? 0, discount: p.discount ?? 0, total: p.total ?? 0,
      paid: p.paid ?? 0, remaining: p.remaining ?? 0, treasury_id: p.treasuryId || null,
      notes: p.notes || null, items: p.items || []
    }, { onConflict: 'id' });
    if (error) { console.error('DB.savePurchaseInvoice error:', error.message); return null; }
    return p;
  },

  // ---- مدفوعات الموردين ----
  async fetchSupplierPayments(salonId?: string) { return DB.fetchAll<any>('supplier_payments', undefined, salonId); },
  async saveSupplierPayment(sp: any, salonId?: string) {
    const client = sb(); if (!client || !sp) return null;
    const validSalonId = toSalonUUID(salonId || sp.salonId || getSalonId());
    const validBranchId = toBranchUUID(sp.branchId);
    const { error } = await client.from('supplier_payments').upsert({
      id: sp.id, salon_id: validSalonId, branch_id: validBranchId,
      supplier_id: sp.supplierId, date: sp.date, amount: sp.amount ?? 0,
      treasury_id: sp.treasuryId, notes: sp.notes || null
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveSupplierPayment error:', error.message); return null; }
    return sp;
  },
  async deleteSupplierPayment(id: string) { return DB.remove('supplier_payments', id); },

  // ---- الجرد ----
  async fetchInventoryCounts(salonId?: string) { return DB.fetchAll<any>('inventory_counts', undefined, salonId); },
  async saveInventoryCount(ic: any, salonId?: string) {
    const client = sb(); if (!client || !ic) return null;
    const validSalonId = toSalonUUID(salonId || ic.salonId || getSalonId());
    const validBranchId = toBranchUUID(ic.branchId);
    const { error } = await client.from('inventory_counts').upsert({
      id: ic.id, salon_id: validSalonId, branch_id: validBranchId,
      date: ic.date, notes: ic.notes || null, items: ic.items || []
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveInventoryCount error:', error.message); return null; }
    return ic;
  },

  // ---- حركات المخزون ----
  async fetchItemMovements(salonId?: string) { return DB.fetchAll<any>('item_movements', undefined, salonId); },
  async saveItemMovement(im: any, salonId?: string) {
    const client = sb(); if (!client || !im) return null;
    const validSalonId = toSalonUUID(salonId || im.salonId || getSalonId());
    const validBranchId = toBranchUUID(im.branchId);
    const { error } = await client.from('item_movements').upsert({
      id: im.id, salon_id: validSalonId, branch_id: validBranchId,
      product_id: im.productId, date: im.date, type: im.type,
      reference_id: im.referenceId || null, quantity_in: im.quantityIn ?? 0,
      quantity_out: im.quantityOut ?? 0, balance_after: im.balanceAfter ?? 0,
      notes: im.notes || null
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveItemMovement:', error.message); return null; }
    return im;
  },

  // ---- الشكاوى ----
  async fetchComplaints(salonId?: string) { return DB.fetchAll<any>('customer_complaints', undefined, salonId); },
  async saveComplaint(c: any, salonId?: string) {
    const client = sb(); if (!client) return null;
    const validSalonId = toSalonUUID(salonId || c.salonId || getSalonId());
    const { error } = await client.from('customer_complaints').upsert({
      id: c.id, salon_id: validSalonId, branch_id: c.branchId || null,
      client_phone: c.clientPhone, client_name: c.clientName, client_id: c.clientId || null,
      invoice_id: c.invoiceId || null, invoice_date: c.invoiceDate || null,
      invoice_total: c.invoiceTotal || null, employee_id: c.employeeId || null,
      employee_name: c.employeeName || null, category: c.category || 'service_quality',
      subject: c.subject || c.category || 'شكوى عميل',
      description: c.description, before_photo_url: c.beforePhotoUrl || null,
      after_photo_url: c.afterPhotoUrl || null, status: c.status || 'open',
      priority: c.priority || 'medium', actions: c.actions || [],
      resolution: c.resolution || null, resolved_at: c.resolvedAt || null,
      resolved_by: c.resolvedBy || null, is_remedy_provided: c.isRemedyProvided || false,
      remedy_invoice_id: c.remedyInvoiceId || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveComplaint error:', error.message); return null; }
    return c;
  },

  // ---- حذف فاتورة ومعاملاتها المالية المرتبطة نهائياً من قاعدة البيانات ----
  async deleteInvoice(invoiceId: string) {
    const client = sb();
    if (!client) return false;
    try {
      // 1. Delete all transactions linked to this invoice from DB
      await client.from('transactions').delete().eq('invoice_id', invoiceId);
      await client.from('transactions').delete().ilike('description', `%${invoiceId}%`);
      try { await client.from('tips').delete().eq('invoice_id', invoiceId); } catch (e) {}
      try { await client.from('promo_code_usages').delete().eq('invoice_id', invoiceId); } catch (e) {}
      // 2. Delete the invoice itself from DB
      const { error } = await client.from('invoices').delete().eq('id', invoiceId);
      if (error) { console.error('DB.deleteInvoice error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.deleteInvoice exception:', e); return false; }
  },

  // ---- حذف معاملة مالية من قاعدة البيانات ----
  async deleteTransaction(transactionId: string) {
    const client = sb();
    if (!client) return false;
    try {
      const { error } = await client.from('transactions').delete().eq('id', transactionId);
      if (error) { console.error('DB.deleteTransaction error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.deleteTransaction exception:', e); return false; }
  },

  async deleteTransactionsByInvoiceId(invoiceId: string) {
    const client = sb();
    if (!client) return false;
    try {
      await client.from('transactions').delete().eq('invoice_id', invoiceId);
      await client.from('transactions').delete().ilike('description', `%${invoiceId}%`);
      return true;
    } catch (e) { return false; }
  },

  // ---- حذف حجز نهائياً من قاعدة البيانات مع تصفير كامل أثره المالي (Cascade / Financial Voiding) ----
  async deleteBooking(bookingId: string, bookingCode?: string) {
    const client = sb();
    if (!client || !bookingId) return false;
    try {
      // 1. حذف تذاكر الطابور والانتظار المرتبطة
      try {
        await client.from('queue_tickets').delete().eq('booking_id', bookingId);
        await client.from('queue_tickets').delete().eq('id', 'QT-B-' + bookingId);
      } catch (e) {}
      // 2. حذف الفواتير المعلقة المرتبطة
      try {
        await client.from('held_invoices').delete().or(`id.eq.HOLD-B-${bookingId},booking_id.eq.${bookingId}`);
        await client.from('held_invoices').delete().eq('id', bookingId);
      } catch (e) {}
      // 3. تصفير وإلغاء جميع الحركات المالية المرتبطة بالحجز (عربونات ومسترجعات)
      try {
        await client.from('transactions').delete().eq('booking_id', bookingId);
        await client.from('transactions').delete().ilike('description', `%${bookingId}%`);
        if (bookingCode) {
          await client.from('transactions').delete().ilike('description', `%${bookingCode}%`);
        }
      } catch (e) {}
      // 4. تحديث الكاش المحلي في localStorage إذا وجد
      try {
        const storedTrxs = localStorage.getItem('smartcut_transactions');
        if (storedTrxs) {
          const list = JSON.parse(storedTrxs);
          if (Array.isArray(list)) {
            const filtered = list.filter((t: any) => 
              t.bookingId !== bookingId && 
              t.booking_id !== bookingId &&
              !t.description?.includes(bookingId) &&
              !(bookingCode && t.description?.includes(bookingCode))
            );
            localStorage.setItem('smartcut_transactions', JSON.stringify(filtered));
          }
        }
      } catch (e) {}
      // 5. حذف الحجز نفسه
      const { error } = await client.from('bookings').delete().eq('id', bookingId);
      if (error) { console.error('DB.deleteBooking error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.deleteBooking exception:', e); return false; }
  },

  async deleteTransactionsByBookingId(bookingId: string, bookingCode?: string) {
    const client = sb();
    if (!client || !bookingId) return false;
    try {
      await client.from('transactions').delete().eq('booking_id', bookingId);
      await client.from('transactions').delete().ilike('description', `%${bookingId}%`);
      if (bookingCode) {
        await client.from('transactions').delete().ilike('description', `%${bookingCode}%`);
      }
      return true;
    } catch (e) { return false; }
  },

  // ---- الورديات ومتابعة العهدة (Work Shifts & Custody) ----
  async fetchWorkShifts(salonId?: string, branchId?: string) {
    const client = sb();
    if (!client) return [];
    try {
      const sId = salonId || getSalonId();
      if (!sId) return [];
      const validSalonId = toSalonUUID(sId);
      if (!validSalonId) return [];
      let q = client.from('work_shifts').select('*').eq('salon_id', validSalonId);
      const { data, error } = await q.order('opened_at', { ascending: false });
      if (error) { console.error('DB.fetchWorkShifts:', error.message); return []; }
      const list = (data || []).map(toCamel);
      if (branchId && branchId !== 'all') {
        const bId = toBranchUUID(branchId) || branchId;
        const filtered = list.filter((s: any) => s.branchId === bId || !s.branchId || s.branchId === 'b-main');
        return filtered.length > 0 ? filtered : list;
      }
      return list;
    } catch (e) { return []; }
  },

  async getActiveWorkShift(salonId?: string, branchId?: string) {
    const client = sb();
    if (!client) return null;
    try {
      const sId = salonId || getSalonId();
      if (!sId) return null;
      const validSalonId = toSalonUUID(sId);
      if (!validSalonId) return null;

      // 1. استعلام فوري ومباشر عن أي وردية حالتها 'open' وغير مغلقة لهذا الصالون
      const { data: openData, error: openError } = await client
        .from('work_shifts')
        .select('*')
        .eq('salon_id', validSalonId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(20);

      const openShifts = (!openError && openData && Array.isArray(openData))
        ? openData.filter((s: any) => s.status === 'open' && !s.closed_at)
        : [];

      if (openShifts.length > 0) {
        const targetBranchId = branchId && branchId !== 'all' ? (toBranchUUID(branchId) || branchId) : null;
        let matchedShift = openShifts[0];

        // مطابقة على الفرع إذا تم تحديده
        if (targetBranchId) {
          const exactMatch = openShifts.find((s: any) => s.branch_id === targetBranchId);
          if (exactMatch) matchedShift = exactMatch;
        } else {
          const genericMatch = openShifts.find((s: any) => !s.branch_id || s.branch_id === 'b-main' || s.branch_id === 'all');
          if (genericMatch) matchedShift = genericMatch;
        }

        const sDate = matchedShift.shift_date || new Date().toISOString().split('T')[0];
        const sCode = matchedShift.shift_code || matchedShift.shiftCode || `SH-${sDate.replace(/-/g, '')}-01`;

        return {
          ...toCamel(matchedShift),
          shiftCode: sCode,
          isOpen: true,
          status: 'open',
          hasDefinitiveProof: true
        };
      }

      // 2. إذا لم نجد أي وردية بحالة open، نجلب آخر 50 وردية لتأكيد حالة الإغلاق
      const { data, error } = await client
        .from('work_shifts')
        .select('*')
        .eq('salon_id', validSalonId)
        .order('opened_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('DB.getActiveWorkShift error:', error.message);
        return { error: true, message: error.message };
      }

      if (!data || data.length === 0) {
        // لا يوجد أي وردية سابقة مسجلة في قاعدة البيانات
        return { isOpen: false, isClosed: true, hasDefinitiveProof: true, noShifts: true };
      }

      // فحص أمان إضافي للورديات المفتوحة
      const fallbackOpen = data.filter((s: any) => (s.status === 'open' || !s.closed_at) && s.status !== 'closed');
      if (fallbackOpen.length > 0) {
        const m = fallbackOpen[0];
        const sDate = m.shift_date || new Date().toISOString().split('T')[0];
        const sCode = m.shift_code || m.shiftCode || `SH-${sDate.replace(/-/g, '')}-01`;
        return {
          ...toCamel(m),
          shiftCode: sCode,
          isOpen: true,
          status: 'open',
          hasDefinitiveProof: true
        };
      }

      // لا توجد أي وردية مفتوحة، نرجع آخر وردية مغلقة
      const closedShifts = data.filter((s: any) => s.status === 'closed' || !!s.closed_at);
      if (closedShifts.length > 0) {
        const latestClosed = closedShifts[0];
        const sDate = latestClosed.shift_date || new Date().toISOString().split('T')[0];
        const sCode = latestClosed.shift_code || latestClosed.shiftCode || `SH-${sDate.replace(/-/g, '')}-01`;
        return {
          ...toCamel(latestClosed),
          shiftCode: sCode,
          isOpen: false,
          isClosed: true,
          status: 'closed',
          hasDefinitiveProof: true
        };
      }

      return { isOpen: false, isClosed: true, hasDefinitiveProof: true };
    } catch (e: any) {
      console.error('DB.getActiveWorkShift exception:', e);
      return { error: true, message: e?.message };
    }
  },

  async saveWorkShift(ws: any): Promise<boolean> {
    const client = sb();
    if (!client || !ws) return false;
    try {
      const validSalonId = toSalonUUID(ws.salonId || getSalonId());
      const validBranchId = ws.branchId ? (toBranchUUID(ws.branchId) || ws.branchId) : null;
      let finalShiftCode = ws.shiftCode || ws.shift_code || null;
      if (!finalShiftCode) {
        const dStr = ws.shiftDate || ws.shift_date || new Date().toISOString().split('T')[0];
        const cD = dStr.replace(/-/g, '');
        finalShiftCode = `SH-${cD}-01`;
      }
      const snap: any = {
        id: ws.id,
        shift_code: finalShiftCode,
        salon_id: validSalonId,
        branch_id: validBranchId,
        shift_date: ws.shiftDate || ws.shift_date || new Date().toISOString().split('T')[0],
        ...(ws.openedAt ? { opened_at: ws.openedAt } : (ws.status === 'open' ? { opened_at: new Date().toISOString() } : {})),
        closed_at: ws.closedAt || ws.closed_at || null,
        opened_by_user_id: ws.openedByUserId || ws.opened_by_user_id || null,
        opened_by_user_name: ws.openedByUserName || ws.opened_by_user_name || ws.openedByName || ws.opened_by_name || null,
        opened_by_name: ws.openedByName || ws.opened_by_name || ws.openedByUserName || ws.opened_by_user_name || null,
        opened_by_role: ws.openedByRole || ws.opened_by_role || null,
        closed_by_user_id: ws.closedByUserId || ws.closed_by_user_id || null,
        closed_by_user_name: ws.closedByUserName || ws.closed_by_user_name || ws.closedByName || ws.closed_by_name || null,
        closed_by_name: ws.closedByName || ws.closed_by_name || ws.closedByUserName || ws.closed_by_user_name || null,
        closed_by_role: ws.closedByRole || ws.closed_by_role || null,
        initial_cash: Number(ws.initialCash ?? ws.initial_cash ?? 0) || 0,
        expected_cash: ws.expectedCash !== undefined ? Number(ws.expectedCash) : (ws.expected_cash !== undefined ? Number(ws.expected_cash) : null),
        actual_cash: ws.actualCash !== undefined ? Number(ws.actualCash) : (ws.actual_cash !== undefined ? Number(ws.actual_cash) : null),
        cash_difference: ws.cashDifference !== undefined ? Number(ws.cashDifference) : (ws.cash_difference !== undefined ? Number(ws.cash_difference) : null),
        total_sales: ws.totalSales !== undefined ? Number(ws.totalSales) : (ws.total_sales !== undefined ? Number(ws.total_sales) : null),
        total_cash_sales: ws.totalCashSales !== undefined ? Number(ws.totalCashSales) : (ws.total_cash_sales !== undefined ? Number(ws.total_cash_sales) : null),
        total_card_sales: ws.totalCardSales !== undefined ? Number(ws.totalCardSales) : (ws.total_card_sales !== undefined ? Number(ws.total_card_sales) : null),
        total_expenses: ws.totalExpenses !== undefined ? Number(ws.totalExpenses) : (ws.total_expenses !== undefined ? Number(ws.total_expenses) : null),
        transferred_to_treasury: ws.transferredToTreasury || ws.transferred_to_treasury || null,
        transferred_amount: ws.transferredAmount !== undefined ? Number(ws.transferredAmount) : (ws.transferred_amount !== undefined ? Number(ws.transferred_amount) : null),
        total_advances: ws.totalAdvances !== undefined ? Number(ws.totalAdvances) : (ws.total_advances !== undefined ? Number(ws.total_advances) : null),
        status: ws.status || (ws.closedAt || ws.closed_at ? 'closed' : 'open'),
        notes: ws.notes || null,
        created_at: ws.createdAt || ws.created_at || new Date().toISOString()
      };
      const { error } = await client.from('work_shifts').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveWorkShift error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.saveWorkShift exception:', e); return false; }
  },

  // ---- الشركاء ورأس المال (Partners & Equity) ----
  async fetchPartners(salonId?: string) {
    return DB.fetchAll<any>('partners', undefined, salonId);
  },
  async savePartner(p: any) {
    const client = sb(); if (!client || !p) return null;
    const validSalonId = toSalonUUID(p.salonId || getSalonId());
    try {
      const snap: any = {
        id: p.id,
        salon_id: validSalonId,
        tenant_id: validSalonId,
        name: p.name,
        phone: p.phone,
        id_number: p.idNumber || null,
        status: p.status || (p.isActive !== false ? 'active' : 'suspended'),
        capital_share: p.capitalShare ?? 0,
        share_percentage: p.sharePercentage ?? 0,
        max_drawings_cap: p.maxDrawingsCap ?? 0,
        debit_balance: p.debitBalance ?? 0,
        total_withdrawn: p.totalWithdrawn ?? 0,
        total_profit_received: p.totalProfitReceived ?? 0,
        opening_balance: p.openingBalance ?? 0,
        join_date: toDateOrNull(p.joinDate) || new Date().toISOString().split('T')[0],
        exit_date: toDateOrNull(p.exitDate) || null,
        notes: p.notes || null,
        is_active: p.status !== 'exited' && p.status !== 'suspended' && p.isActive !== false,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('partners').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.savePartner error:', error.message); return null; }
      return p;
    } catch (e) { console.error('DB.savePartner exception:', e); return null; }
  },
  async deletePartner(partnerId: string) {
    return DB.remove('partners', partnerId);
  },

  // ---- معاملات الشركاء (Partner Transactions) ----
  async fetchPartnerTransactions(salonId?: string) {
    return DB.fetchAll<any>('partner_transactions', undefined, salonId);
  },
  async savePartnerTransaction(pt: any) {
    const client = sb(); if (!client || !pt) return null;
    const validSalonId = toSalonUUID(pt.salonId || getSalonId());
    try {
      const snap: any = {
        id: pt.id,
        salon_id: validSalonId,
        tenant_id: validSalonId,
        partner_id: pt.partnerId,
        partner_name: pt.partnerName,
        type: pt.type,
        amount: pt.amount ?? 0,
        date: pt.date,
        treasury_id: pt.treasuryId,
        description: pt.description,
        created_by: pt.createdBy || null
      };
      const { error } = await client.from('partner_transactions').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.savePartnerTransaction error:', error.message); return null; }
      return pt;
    } catch (e) { console.error('DB.savePartnerTransaction exception:', e); return null; }
  },

  // ---- سحوبات الشركاء (Partner Drawings) ----
  async fetchPartnerDrawings(salonId?: string) {
    return DB.fetchAll<any>('partner_drawings', undefined, salonId);
  },
  async savePartnerDrawing(d: any) {
    const client = sb(); if (!client || !d) return null;
    const validSalonId = toSalonUUID(d.salonId || getSalonId());
    try {
      const snap: any = {
        id: d.id,
        tenant_id: validSalonId,
        salon_id: validSalonId,
        partner_id: d.partnerId,
        amount: d.amount ?? 0,
        drawing_date: d.drawingDate || new Date().toISOString(),
        drawing_type: d.drawingType || 'profit_advance',
        treasury_id: d.treasuryId || null,
        treasury_name: d.treasuryName || null,
        notes: d.notes || null,
        created_by: d.createdBy || null,
        is_settled: d.isSettled || false,
        settlement_id: d.settlementId || null
      };
      const { error } = await client.from('partner_drawings').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.savePartnerDrawing error:', error.message); return null; }
      return d;
    } catch (e) { console.error('DB.savePartnerDrawing exception:', e); return null; }
  },

  // ---- توزيعات الأرباح والتسويات السنوية (Profit Distributions) ----
  async fetchProfitDistributions(salonId?: string) {
    return DB.fetchAll<any>('profit_distributions', undefined, salonId);
  },
  async saveProfitDistribution(pd: any) {
    const client = sb(); if (!client || !pd) return null;
    const validSalonId = toSalonUUID(pd.salonId || getSalonId());
    try {
      const snap: any = {
        id: pd.id,
        tenant_id: validSalonId,
        salon_id: validSalonId,
        partner_id: pd.partnerId,
        period_start: pd.periodStart,
        period_end: pd.periodEnd,
        period_label: pd.periodLabel,
        distributable_profit_pool: pd.distributableProfitPool ?? 0,
        partner_share_percentage: pd.partnerSharePercentage ?? 0,
        gross_profit_share: pd.grossProfitShare ?? 0,
        capital_addition_amount: pd.capitalAdditionAmount ?? 0,
        new_capital_share: pd.newCapitalShare ?? 0,
        drawings_deducted: pd.drawingsDeducted ?? 0,
        prior_debit_deducted: pd.priorDebitDeducted ?? 0,
        net_payable_amount: pd.netPayableAmount ?? 0,
        carried_debit_balance: pd.carriedDebitBalance ?? 0,
        status: pd.status || 'approved',
        distribution_date: pd.distributionDate || new Date().toISOString().split('T')[0],
        approved_by: pd.approvedBy || null,
        notes: pd.notes || null
      };
      const { error } = await client.from('profit_distributions').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveProfitDistribution error:', error.message); return null; }
      return pd;
    } catch (e) { console.error('DB.saveProfitDistribution exception:', e); return null; }
  },

  // ---- أقساط التخارج (Partner Exit Installments) ----
  async fetchPartnerExitInstallments(salonId?: string) {
    return DB.fetchAll<any>('partner_exit_installments', undefined, salonId);
  },
  async savePartnerExitInstallment(inst: any) {
    const client = sb(); if (!client || !inst) return null;
    const validSalonId = toSalonUUID(inst.salonId || getSalonId());
    try {
      const snap: any = {
        id: inst.id,
        tenant_id: validSalonId,
        salon_id: validSalonId,
        partner_id: inst.partnerId,
        installment_number: inst.installmentNumber,
        due_date: inst.dueDate,
        amount: inst.amount ?? 0,
        status: inst.status || 'pending',
        paid_at: inst.paidAt || null,
        treasury_id: inst.treasuryId || null,
        payment_reference: inst.paymentReference || null,
        notes: inst.notes || null
      };
      const { error } = await client.from('partner_exit_installments').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.savePartnerExitInstallment error:', error.message); return null; }
      return inst;
    } catch (e) { console.error('DB.savePartnerExitInstallment exception:', e); return null; }
  },

  // استدعاء دالة الإقفال والتسوية السنوية في Supabase RPC
  async executeAnnualSettlementRPC(params: {
    tenantId: string;
    periodStart: string;
    periodEnd: string;
    periodLabel: string;
    distributableProfit: number;
    approvedBy: string;
  }) {
    const client = sb(); if (!client) return null;
    try {
      const { data, error } = await client.rpc('rpc_execute_annual_profit_settlement', {
        p_tenant_id: toSalonUUID(params.tenantId),
        p_period_start: params.periodStart,
        p_period_end: params.periodEnd,
        p_period_label: params.periodLabel,
        p_distributable_profit: params.distributableProfit,
        p_approved_by: params.approvedBy
      });
      if (error) { console.error('DB.executeAnnualSettlementRPC error:', error.message); return null; }
      return data;
    } catch (e) { console.error('DB.executeAnnualSettlementRPC exception:', e); return null; }
  },

  // استدعاء دالة جدولة التخارج في Supabase RPC
  async schedulePartnerExitRPC(params: {
    tenantId: string;
    partnerId: string;
    exitValuation: number;
    installmentsCount: number;
    firstDueDate: string;
    notes?: string;
  }) {
    const client = sb(); if (!client) return null;
    try {
      const { data, error } = await client.rpc('rpc_schedule_partner_exit', {
        p_tenant_id: toSalonUUID(params.tenantId),
        p_partner_id: params.partnerId,
        p_exit_valuation: params.exitValuation,
        p_installments_count: params.installmentsCount,
        p_first_due_date: params.firstDueDate,
        p_notes: params.notes || 'تخارج شريك مجدول'
      });
      if (error) { console.error('DB.schedulePartnerExitRPC error:', error.message); return null; }
      return data;
    } catch (e) { console.error('DB.schedulePartnerExitRPC exception:', e); return null; }
  },

  // ---- البرومو كود (Promo Codes) ----
  async fetchPromoCodes(salonId?: string) {
    return DB.fetchAll<any>('promo_codes', undefined, salonId);
  },
  async savePromoCode(pc: any) {
    const client = sb(); if (!client || !pc) return null;
    const validSalonId = toSalonUUID(pc.salonId || getSalonId());
    try {
      const snap: any = {
        id: pc.id, salon_id: validSalonId, code: pc.code?.trim().toUpperCase(),
        discount_type: pc.discountType || 'percentage', discount_value: pc.discountValue ?? 0,
        max_discount_amount: pc.maxDiscountAmount || null,
        start_date: toDateOrNull(pc.startDate) || new Date().toISOString().split('T')[0],
        end_date: toDateOrNull(pc.endDate) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        max_uses_total: pc.maxUsesTotal || pc.usageLimit || null,
        usage_limit: pc.usageLimit || pc.maxUsesTotal || null,
        uses_count: pc.usesCount ?? pc.usedCount ?? 0,
        used_count: pc.usedCount ?? pc.usesCount ?? 0,
        is_active: pc.isActive !== false, notes: pc.notes || null,
        created_by: pc.createdBy || null, updated_at: new Date().toISOString()
      };
      const { error } = await client.from('promo_codes').upsert(snap, { onConflict: 'id' });
      if (error) { 
        console.error('DB.savePromoCode error:', error.message); 
        return null; 
      }
      try {
        const bc = new BroadcastChannel(`smartcut_promos_${validSalonId}`);
        bc.postMessage({ type: 'PROMO_SAVED', promoCodeId: pc.id });
        bc.close();
      } catch {}
      return pc;
    } catch (e) { 
      console.error('DB.savePromoCode exception:', e); 
      return null; 
    }
  },
  async deletePromoCode(promoCodeId: string) {
    const validSalonId = toSalonUUID(getSalonId());
    const res = await DB.remove('promo_codes', promoCodeId);
    try {
      const bc = new BroadcastChannel(`smartcut_promos_${validSalonId}`);
      bc.postMessage({ type: 'PROMO_DELETED', promoCodeId });
      bc.close();
    } catch {}
    return res;
  },

  // ---- استخدامات البرومو كود (Promo Code Usages) ----
  async fetchPromoCodeUsages(salonId?: string) {
    return DB.fetchAll<any>('promo_code_usages', undefined, salonId);
  },
  async savePromoCodeUsage(u: any) {
    const client = sb(); if (!client || !u) return null;
    const validSalonId = toSalonUUID(u.salonId || getSalonId());
    try {
      const snap: any = {
        id: u.id, salon_id: validSalonId, promo_code_id: u.promoCodeId,
        code: u.code, client_id: u.clientId || null, client_phone: u.clientPhone, client_name: u.clientName || null,
        invoice_id: u.invoiceId || null, 
        discount_applied: u.discountApplied ?? 0,
        discount_amount: u.discountApplied ?? 0,
        used_at: u.usedAt || new Date().toISOString()
      };
      const { error } = await client.from('promo_code_usages').upsert(snap, { onConflict: 'id' });
      if (error) { 
        console.error('DB.savePromoCodeUsage error:', error.message); 
        return null; 
      }
      try {
        const bc = new BroadcastChannel(`smartcut_promos_${validSalonId}`);
        bc.postMessage({ type: 'USAGE_SAVED', usageId: u.id });
        bc.close();
      } catch {}
      return u;
    } catch (e) { 
      console.error('DB.savePromoCodeUsage exception:', e); 
      return null; 
    }
  },

  // ---- البقشيش (Tips) ----
  async fetchTips(salonId?: string) {
    return DB.fetchAll<any>('tips', undefined, salonId);
  },
  async saveTip(t: any) {
    const client = sb(); if (!client || !t) return null;
    const validSalonId = toSalonUUID(t.salonId || getSalonId());
    const validBranchId = toBranchUUID(t.branchId);
    try {
      const snap: any = {
        id: t.id, salon_id: validSalonId, branch_id: validBranchId,
        invoice_id: t.invoiceId, employee_id: t.employeeId,
        employee_name: t.employeeName, amount: t.amount ?? 0,
        payment_method: t.paymentMethod || 'card', date: t.date || new Date().toISOString(),
        status: t.status || 'pending_payout', paid_out_at: t.paidOutAt || null,
        paid_out_treasury_id: t.paidOutTreasuryId || null, notes: t.notes || null
      };

      const { error } = await client.from('tips').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveTip error:', error.message); return null; }
      return t;
    } catch (e) { console.error('DB.saveTip exception:', e); return null; }
  },

  // ---- عهد الموظفين (Employee Custodies) ----
  async fetchCustodies(salonId?: string) {
    return DB.fetchAll<any>('employee_custodies', undefined, salonId);
  },
  async saveCustody(c: any) {
    const client = sb(); if (!client || !c) return null;
    const validSalonId = toSalonUUID(c.salonId || getSalonId());
    const validBranchId = toBranchUUID(c.branchId);
    try {
      const snap: any = {
        id: c.id, salon_id: validSalonId, branch_id: validBranchId,
        employee_id: c.employeeId, employee_name: c.employeeName,
        item_name: c.itemName, serial_number: c.serialNumber || null,
        quantity: c.quantity ?? 1, given_date: toDateOrNull(c.givenDate) || new Date().toISOString().split('T')[0],
        status: c.status || 'in_custody', returned_date: toDateOrNull(c.returnedDate),
        notes: c.notes || null, created_by: c.createdBy || null,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('employee_custodies').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveCustody error:', error.message); return null; }
      return c;
    } catch (e) { console.error('DB.saveCustody exception:', e); return null; }
  },

  // ---- سجلات البصمة (Fingerprint Logs) ----
  async fetchFingerprintLogs(salonId?: string) {
    const list = await DB.fetchAll<any>('fingerprint_logs', undefined, salonId);
    return (list || []).map(fl => {
      const ts = fl.timestamp || fl.logTime || fl.log_time || fl.createdAt || fl.created_at;
      const type = fl.type || 'check_in';
      const processedDate = fl.processedDate || fl.processed_date || calculateFingerprintProcessedDate(ts, type);
      return {
        ...fl,
        timestamp: ts,
        logTime: fl.logTime || fl.log_time || ts,
        type: type,
        status: fl.status || (fl.source === 'manual' ? 'manual' : 'synced'),
        fingerprintCode: fl.fingerprintCode || fl.fingerprint_code || '',
        employeeId: fl.employeeId || fl.employee_id || '',
        employeeName: fl.employeeName || fl.employee_name || '',
        processedDate: processedDate,
        processed_date: processedDate
      };
    });
  },
  async saveFingerprintLog(fl: any) {
    const client = sb(); if (!client || !fl) return null;
    const validSalonId = toSalonUUID(fl.salonId || getSalonId());
    const validBranchId = toBranchUUID(fl.branchId);
    const validTimestamp = fl.timestamp || fl.logTime || fl.log_time || new Date().toISOString();
    const type = fl.type || 'check_in';
    const computedProcessedDate = fl.processedDate || fl.processed_date || calculateFingerprintProcessedDate(validTimestamp, type);
    const fpCode = fl.fingerprintCode || fl.fingerprint_code || (fl.employeeId ? `FP-${fl.employeeId.slice(0, 4)}` : '101');
    
    let resolvedEmployeeId = fl.employeeId || fl.employee_id || null;
    let resolvedEmployeeName = fl.employeeName || fl.employee_name || null;

    // Auto-resolve employee by fingerprint_code if not supplied
    if ((!resolvedEmployeeId || !resolvedEmployeeName) && fpCode) {
      try {
        const emps = await DB.fetchAll<any>('employees', undefined, validSalonId);
        const matched = (emps || []).find(e => 
          (e.fingerprintCode && String(e.fingerprintCode).trim() === String(fpCode).trim()) ||
          (e.fingerprint_code && String(e.fingerprint_code).trim() === String(fpCode).trim()) ||
          (e.id && String(e.id).trim() === String(fpCode).trim())
        );
        if (matched) {
          if (!resolvedEmployeeId) resolvedEmployeeId = matched.id;
          if (!resolvedEmployeeName) resolvedEmployeeName = matched.name;
        }
      } catch (err) {
        console.warn('Error auto-resolving employee for fingerprint log:', err);
      }
    }

    try {
      const snap: any = {
        id: fl.id || ('fp_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)),
        salon_id: validSalonId,
        branch_id: validBranchId,
        employee_id: resolvedEmployeeId,
        employee_name: resolvedEmployeeName,
        fingerprint_code: fpCode,
        timestamp: validTimestamp,
        type: type,
        device_ip: fl.deviceIp || fl.device_ip || null,
        status: fl.status || (fl.source === 'manual' ? 'manual' : 'synced'),
        notes: fl.notes || null
      };
      let { error } = await client.from('fingerprint_logs').upsert(snap, { onConflict: 'id' });
      if (error && error.message && (error.message.includes('schema cache') || error.message.includes('column'))) {
        console.warn('DB.saveFingerprintLog retrying with minimal fields due to schema notice:', error.message);
        const minimalSnap: any = {
          id: snap.id,
          salon_id: snap.salon_id,
          fingerprint_code: snap.fingerprint_code,
          timestamp: snap.timestamp,
          type: snap.type,
          status: snap.status
        };
        if (snap.branch_id) minimalSnap.branch_id = snap.branch_id;
        if (snap.employee_id) minimalSnap.employee_id = snap.employee_id;
        if (snap.employee_name) minimalSnap.employee_name = snap.employee_name;
        const retry = await client.from('fingerprint_logs').upsert(minimalSnap, { onConflict: 'id' });
        if (!retry.error) {
          error = null;
        }
      }
      if (error) { 
        console.error('DB.saveFingerprintLog error:', error.message); 
        throw error; 
      }
      return {
        ...fl,
        ...snap,
        fingerprintCode: fpCode,
        employeeId: resolvedEmployeeId,
        employeeName: resolvedEmployeeName,
        processedDate: computedProcessedDate,
        processed_date: computedProcessedDate,
        logTime: validTimestamp,
        timestamp: validTimestamp
      };
    } catch (e) { 
      console.error('DB.saveFingerprintLog exception:', e); 
      throw e; 
    }
  },
  async deleteFingerprintLog(id: string) {
    const client = sb(); if (!client || !id) return false;
    try {
      const { error } = await client.from('fingerprint_logs').delete().eq('id', id);
      if (error) { console.error('DB.deleteFingerprintLog error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.deleteFingerprintLog exception:', e); return false; }
  },

  // ---- الباقات والفوترة والاشتراكات (Subscription & Billing Module) ----
  async fetchSubscriptionPlans(): Promise<any[]> {
    const client = sb();
    if (client) {
      try {
        const { data, error } = await client.from('subscription_plans').select('*').eq('is_active', true).order('display_order', { ascending: true });
        if (!error && data && data.length > 0) {
          return data.map((row: any) => {
            const camel = toCamel(row);
            return {
              id: camel.id || row.id,
              planNameAr: camel.planNameAr || row.plan_name_ar || '',
              planNameEn: camel.planNameEn || row.plan_name_en || '',
              descriptionAr: camel.descriptionAr || row.description_ar || '',
              minEmployees: Number(camel.minEmployees ?? row.min_employees ?? 1),
              maxEmployees: Number(camel.maxEmployees ?? row.max_employees ?? 9999),
              priceEgp1m: Number(camel.priceEgp1m ?? camel.priceEgp_1m ?? row.price_egp_1m ?? 0),
              priceEgp3m: Number(camel.priceEgp3m ?? camel.priceEgp_3m ?? row.price_egp_3m ?? 0),
              priceEgp6m: Number(camel.priceEgp6m ?? camel.priceEgp_6m ?? row.price_egp_6m ?? 0),
              priceEgp12m: Number(camel.priceEgp12m ?? camel.priceEgp_12m ?? row.price_egp_12m ?? 0),
              priceUsd1m: Number(camel.priceUsd1m ?? camel.priceUsd_1m ?? row.price_usd_1m ?? 0),
              priceUsd3m: Number(camel.priceUsd3m ?? camel.priceUsd_3m ?? row.price_usd_3m ?? 0),
              priceUsd6m: Number(camel.priceUsd6m ?? camel.priceUsd_6m ?? row.price_usd_6m ?? 0),
              priceUsd12m: Number(camel.priceUsd12m ?? camel.priceUsd_12m ?? row.price_usd_12m ?? 0),
              // أسعار الفروع الإضافية المخصصة لكل باقة (افتراضياً 2/3 سعر الباقة إذا لم تحدد)
              branchPriceEgp1m: Number(camel.branchPriceEgp1m ?? camel.branchPriceEgp_1m ?? row.branch_price_egp_1m ?? Math.round(((camel.priceEgp1m ?? camel.priceEgp_1m ?? row.price_egp_1m ?? 0) * 2) / 3)),
              branchPriceEgp3m: Number(camel.branchPriceEgp3m ?? camel.branchPriceEgp_3m ?? row.branch_price_egp_3m ?? Math.round(((camel.priceEgp3m ?? camel.priceEgp_3m ?? row.price_egp_3m ?? 0) * 2) / 3)),
              branchPriceEgp6m: Number(camel.branchPriceEgp6m ?? camel.branchPriceEgp_6m ?? row.branch_price_egp_6m ?? Math.round(((camel.priceEgp6m ?? camel.priceEgp_6m ?? row.price_egp_6m ?? 0) * 2) / 3)),
              branchPriceEgp12m: Number(camel.branchPriceEgp12m ?? camel.branchPriceEgp_12m ?? row.branch_price_egp_12m ?? Math.round(((camel.priceEgp12m ?? camel.priceEgp_12m ?? row.price_egp_12m ?? 0) * 2) / 3)),
              branchPriceUsd1m: Number(camel.branchPriceUsd1m ?? camel.branchPriceUsd_1m ?? row.branch_price_usd_1m ?? Math.round(((camel.priceUsd1m ?? camel.priceUsd_1m ?? row.price_usd_1m ?? 0) * 2) / 3)),
              branchPriceUsd3m: Number(camel.branchPriceUsd3m ?? camel.branchPriceUsd_3m ?? row.branch_price_usd_3m ?? Math.round(((camel.priceUsd3m ?? camel.priceUsd_3m ?? row.price_usd_3m ?? 0) * 2) / 3)),
              branchPriceUsd6m: Number(camel.branchPriceUsd6m ?? camel.branchPriceUsd_6m ?? row.branch_price_usd_6m ?? Math.round(((camel.priceUsd6m ?? camel.priceUsd_6m ?? row.price_usd_6m ?? 0) * 2) / 3)),
              branchPriceUsd12m: Number(camel.branchPriceUsd12m ?? camel.branchPriceUsd_12m ?? row.branch_price_usd_12m ?? Math.round(((camel.priceUsd12m ?? camel.priceUsd_12m ?? row.price_usd_12m ?? 0) * 2) / 3)),
              features: Array.isArray(camel.features) ? camel.features : (typeof camel.features === 'string' ? JSON.parse(camel.features) : []),
              isPopular: Boolean(camel.isPopular ?? row.is_popular),
              isActive: Boolean(camel.isActive ?? row.is_active ?? true),
              displayOrder: Number(camel.displayOrder ?? row.display_order ?? 0)
            };
          });
        }
      } catch (e) {
        console.warn('Could not fetch subscription_plans from DB, using fallback defaults');
      }
    }
    // Fallback default plans
    return [
      {
        id: 'starter',
        planNameAr: 'باقة البداية (1–5 موظفين)',
        planNameEn: 'Starter Plan',
        descriptionAr: 'مثالية للصالونات الناشئة والصغيرة بفريق عمل حتى 5 موظفين',
        minEmployees: 1,
        maxEmployees: 5,
        priceEgp1m: 350,
        priceEgp3m: 1000,
        priceEgp6m: 1950,
        priceEgp12m: 3500,
        priceUsd1m: 10,
        priceUsd3m: 28,
        priceUsd6m: 53,
        priceUsd12m: 100,
        branchPriceEgp1m: 230,
        branchPriceEgp3m: 670,
        branchPriceEgp6m: 1300,
        branchPriceEgp12m: 2300,
        branchPriceUsd1m: 7,
        branchPriceUsd3m: 19,
        branchPriceUsd6m: 35,
        branchPriceUsd12m: 67,
        features: [
          'من 1 إلى 5 موظفين',
          'نقطة بيع سريعة POS وفواتير غير محدودة',
          'إدارة الحجوزات والمواعيد والعملاء',
          'سندات المصروفات والخزائن النقدية',
          'تقارير مالية تفصيلية وإغلاق الوردية Z-Report',
          'دعم فني وتحديثات مستمرة'
        ],
        isPopular: false,
        isActive: true,
        displayOrder: 1
      },
      {
        id: 'growth',
        planNameAr: 'باقة التوسع (6–10 موظفين)',
        planNameEn: 'Growth Plan',
        descriptionAr: 'الخيار الممتاز للصالونات المتوسطة والمتنامية حتى 10 موظفين',
        minEmployees: 6,
        maxEmployees: 10,
        priceEgp1m: 450,
        priceEgp3m: 1250,
        priceEgp6m: 2500,
        priceEgp12m: 4500,
        priceUsd1m: 17,
        priceUsd3m: 47,
        priceUsd6m: 87,
        priceUsd12m: 160,
        branchPriceEgp1m: 300,
        branchPriceEgp3m: 830,
        branchPriceEgp6m: 1670,
        branchPriceEgp12m: 3000,
        branchPriceUsd1m: 11,
        branchPriceUsd3m: 31,
        branchPriceUsd6m: 58,
        branchPriceUsd12m: 107,
        features: [
          'من 6 إلى 10 موظفين',
          'كافة ميزات باقة البداية',
          'إدارة المخازن والمستودع الشامل وحركة الأصناف',
          'حساب عمولات الموظفين والسلف والمسير الذكي',
          'برنامج ولاء ونقاط العملاء وكوبونات الخصم',
          'ربط واتساب وإشعارات تذكير المواعيد'
        ],
        isPopular: true,
        isActive: true,
        displayOrder: 2
      },
      {
        id: 'enterprise',
        planNameAr: 'باقة الأعمال الكبرى (أكثر من 10 موظفين)',
        planNameEn: 'Enterprise Plan',
        descriptionAr: 'حل متكامل للمنشآت والمراكز الكبرى مع قدرات غير محدودة وتوسع كامل',
        minEmployees: 11,
        maxEmployees: 9999,
        priceEgp1m: 550,
        priceEgp3m: 1550,
        priceEgp6m: 3050,
        priceEgp12m: 5500,
        priceUsd1m: 27,
        priceUsd3m: 75,
        priceUsd6m: 140,
        priceUsd12m: 264,
        branchPriceEgp1m: 370,
        branchPriceEgp3m: 1030,
        branchPriceEgp6m: 2030,
        branchPriceEgp12m: 3670,
        branchPriceUsd1m: 18,
        branchPriceUsd3m: 50,
        branchPriceUsd6m: 93,
        branchPriceUsd12m: 176,
        features: [
          '11 موظفاً فأكثر (سعة غير محدودة)',
          'كافة ميزات باقة التوسع',
          'إدارة الشركاء والمستثمرين والتسويات السنوية',
          'الذكاء الاصطناعي والمساعد المتقدم لتحليل العمليات',
          'دعم أجهزة الحضور والانصراف والبصمة المتعددة',
          'أولوية قصوى في الدعم الفني وتخصيص الصلاحيات'
        ],
        isPopular: false,
        isActive: true,
        displayOrder: 3
      }
    ];
  },

  async saveSubscriptionPlan(plan: any): Promise<boolean> {
    const client = sb();
    if (!client) return false;
    try {
      const payload: any = {
        id: plan.id,
        plan_name_ar: plan.planNameAr || plan.plan_name_ar,
        plan_name_en: plan.planNameEn || plan.plan_name_en,
        description_ar: plan.descriptionAr || plan.description_ar,
        min_employees: Number(plan.minEmployees ?? plan.min_employees ?? 1),
        max_employees: Number(plan.maxEmployees ?? plan.max_employees ?? 9999),
        price_egp_1m: Number(plan.priceEgp1m ?? plan.price_egp_1m ?? 0),
        price_egp_3m: Number(plan.priceEgp3m ?? plan.price_egp_3m ?? 0),
        price_egp_6m: Number(plan.priceEgp6m ?? plan.price_egp_6m ?? 0),
        price_egp_12m: Number(plan.priceEgp12m ?? plan.price_egp_12m ?? 0),
        price_usd_1m: Number(plan.priceUsd1m ?? plan.price_usd_1m ?? 0),
        price_usd_3m: Number(plan.priceUsd3m ?? plan.price_usd_3m ?? 0),
        price_usd_6m: Number(plan.priceUsd6m ?? plan.price_usd_6m ?? 0),
        price_usd_12m: Number(plan.priceUsd12m ?? plan.price_usd_12m ?? 0),
        branch_price_egp_1m: Number(plan.branchPriceEgp1m ?? plan.branch_price_egp_1m ?? 0),
        branch_price_egp_3m: Number(plan.branchPriceEgp3m ?? plan.branch_price_egp_3m ?? 0),
        branch_price_egp_6m: Number(plan.branchPriceEgp6m ?? plan.branch_price_egp_6m ?? 0),
        branch_price_egp_12m: Number(plan.branchPriceEgp12m ?? plan.branch_price_egp_12m ?? 0),
        branch_price_usd_1m: Number(plan.branchPriceUsd1m ?? plan.branch_price_usd_1m ?? 0),
        branch_price_usd_3m: Number(plan.branchPriceUsd3m ?? plan.branch_price_usd_3m ?? 0),
        branch_price_usd_6m: Number(plan.branchPriceUsd6m ?? plan.branch_price_usd_6m ?? 0),
        branch_price_usd_12m: Number(plan.branchPriceUsd12m ?? plan.branch_price_usd_12m ?? 0),
        features: typeof plan.features === 'string' ? plan.features : JSON.stringify(plan.features || []),
        is_popular: plan.isPopular ? 1 : 0,
        is_active: plan.isActive !== false ? 1 : 0,
        display_order: Number(plan.displayOrder ?? plan.display_order ?? 0),
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('subscription_plans').upsert(payload, { onConflict: 'id' });
      return !error;
    } catch (e) {
      console.error('DB.saveSubscriptionPlan error:', e);
      return false;
    }
  },

  async saveSubscriptionPlans(plans: any[]): Promise<boolean> {
    if (!Array.isArray(plans)) return false;
    let ok = true;
    for (const plan of plans) {
      const res = await this.saveSubscriptionPlan(plan);
      if (!res) ok = false;
    }
    return ok;
  },

  async fetchSubscriptionAddons(): Promise<any[]> {
    const client = sb();
    if (client) {
      try {
        const { data, error } = await client.from('subscription_addons').select('*').eq('is_active', true);
        if (!error && data && data.length > 0) {
          return data.map((row: any) => {
            const camel = toCamel(row);
            return {
              id: camel.id || row.id,
              addonName: camel.addonName || row.addon_name || '',
              addonNameAr: camel.addonNameAr || row.addon_name_ar || '',
              addonType: camel.addonType || row.addon_type || 'branch_license',
              maxEmployeesPerBranch: Number(camel.maxEmployeesPerBranch ?? row.max_employees_per_branch ?? 5),
              priceEgp1m: Number(camel.priceEgp1m ?? camel.priceEgp_1m ?? row.price_egp_1m ?? 0),
              priceEgp3m: Number(camel.priceEgp3m ?? camel.priceEgp_3m ?? row.price_egp_3m ?? 0),
              priceEgp6m: Number(camel.priceEgp6m ?? camel.priceEgp_6m ?? row.price_egp_6m ?? 0),
              priceEgp12m: Number(camel.priceEgp12m ?? camel.priceEgp_12m ?? row.price_egp_12m ?? 0),
              priceUsd1m: Number(camel.priceUsd1m ?? camel.priceUsd_1m ?? row.price_usd_1m ?? 0),
              priceUsd3m: Number(camel.priceUsd3m ?? camel.priceUsd_3m ?? row.price_usd_3m ?? 0),
              priceUsd6m: Number(camel.priceUsd6m ?? camel.priceUsd_6m ?? row.price_usd_6m ?? 0),
              priceUsd12m: Number(camel.priceUsd12m ?? camel.priceUsd_12m ?? row.price_usd_12m ?? 0),
              descriptionAr: camel.descriptionAr || row.description_ar || ''
            };
          });
        }
      } catch (e) {
        console.warn('Could not fetch subscription_addons from DB, using fallback defaults');
      }
    }
    return [
      {
        id: 'branch_license',
        addonName: 'Additional Branch License',
        addonNameAr: 'رخصة فرع إضافي',
        addonType: 'branch_license',
        maxEmployeesPerBranch: 5,
        priceEgp1m: 300,
        priceEgp3m: 800,
        priceEgp6m: 1500,
        priceEgp12m: 2700,
        priceUsd1m: 10,
        priceUsd3m: 27,
        priceUsd6m: 50,
        priceUsd12m: 90,
        descriptionAr: 'رخصة لربط وتشغيل فرع إضافي جديد تحت نفس المنشأة بحد أقصى 5 موظفين للفرع'
      }
    ];
  },

  async fetchTenantSubscription(salonId?: string): Promise<any | null> {
    const client = sb(); if (!client) return null;
    const validSalonId = toSalonUUID(salonId || getSalonId());
    try {
      const { data, error } = await client
        .from('tenant_subscriptions')
        .select('*')
        .or(`salon_id.eq.${validSalonId},tenant_id.eq.${validSalonId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data ? toCamel(data) : null;
    } catch (e) {
      return null;
    }
  },

  async recordTenantSubscription(record: {
    id?: string;
    salonId: string;
    planId?: string;
    status: 'active' | 'trial' | 'expired' | 'pending_payment' | 'suspended';
    startDate: string;
    endDate: string;
    totalBranches?: number;
    totalEmployees?: number;
    billingCycle?: string;
    currency?: string;
    paidAmount?: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<boolean> {
    const client = sb();
    if (!client) return false;
    try {
      const validSalonId = toSalonUUID(record.salonId);
      if (!validSalonId) return false;
      const subId = record.id || ('SUB-' + Math.random().toString(36).substring(2, 9).toUpperCase());
      const nowIso = new Date().toISOString();
      const validPlans = ['starter', 'growth', 'enterprise'];
      let targetPlan = (record.planId || 'growth').toLowerCase();
      if (!validPlans.includes(targetPlan)) {
        targetPlan = 'growth';
      }

      const snap = {
        id: subId,
        salon_id: validSalonId,
        tenant_id: validSalonId,
        plan_id: targetPlan,
        status: record.status,
        start_date: record.startDate,
        end_date: record.endDate,
        total_branches: record.totalBranches || 1,
        total_employees: record.totalEmployees || 10,
        billing_cycle: record.billingCycle || '1m',
        currency: record.currency || 'SAR',
        paid_amount: record.paidAmount !== undefined ? Number(record.paidAmount) : 0,
        payment_method: record.paymentMethod || 'cash',
        notes: record.notes || null,
        created_at: nowIso,
        updated_at: nowIso
      };
      const { error } = await client.from('tenant_subscriptions').insert(snap);
      if (error) {
        console.warn('DB.recordTenantSubscription error:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('DB.recordTenantSubscription exception:', e);
      return false;
    }
  },

  async fetchTenantSubscriptions(salonId?: string): Promise<any[]> {
    const client = sb();
    if (!client) return [];
    try {
      let query = client.from('tenant_subscriptions').select('*').order('created_at', { ascending: false });
      if (salonId) {
        const validSalonId = toSalonUUID(salonId);
        if (validSalonId) {
          query = query.or(`salon_id.eq.${validSalonId},tenant_id.eq.${validSalonId}`);
        }
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map(toCamel);
      }
    } catch (e) {}
    return [];
  },

  async extendSalonTrialDB(salonId: string, days: number = 7, targetPlan?: string): Promise<any> {
    const client = sb();
    const validSalonId = toSalonUUID(salonId);
    const salons = SubscriptionService.getSalons();
    const salon = salons.find(s => s.id === salonId);

    const currentEnd = new Date(salon?.subscriptionEndDate || Date.now());
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(baseDate.getTime() + days * 24 * 3600 * 1000);
    const newEndStr = newEnd.toISOString().split('T')[0];
    const effectivePlan = targetPlan || salon?.subscriptionPlan || 'pro';
    const trialDays = (Number(salon?.trialDays) || 7) + days;

    const updates = {
      subscription_status: 'trial',
      subscription_plan: effectivePlan,
      subscription_end_date: newEndStr,
      trial_days: trialDays,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    if (client && validSalonId) {
      try {
        await client.from('salons').update(updates).eq('id', validSalonId);
        await this.recordTenantSubscription({
          salonId: validSalonId,
          planId: effectivePlan,
          status: 'trial',
          startDate: baseDate.toISOString().split('T')[0],
          endDate: newEndStr,
          totalBranches: salon?.maxBranches || 1,
          totalEmployees: salon?.maxUsers || 10,
          billingCycle: 'trial',
          currency: salon?.currency || 'SAR',
          paidAmount: 0,
          paymentMethod: 'free_trial',
          notes: `تمديد الفترة التجريبية بواسطة المبرمج (+${days} أيام) - الباقة: ${effectivePlan}`
        });
      } catch (e) {
        console.warn('DB.extendSalonTrialDB error:', e);
      }
    }

    await this.updateSalonSubscription(validSalonId || salonId, {
      subscriptionStatus: 'trial',
      subscriptionEndDate: newEndStr,
      isSalonActive: true
    });

    return SubscriptionService.updateSalon(salonId, {
      subscriptionStatus: 'trial',
      subscriptionPlan: effectivePlan as any,
      subscriptionEndDate: newEndStr,
      trialDays,
      isActive: true
    });
  },

  async calculateBranchProrationRPC(tenantId: string, additionalBranches: number, currency: string = 'EGP') {
    const client = sb();
    if (client) {
      try {
        const { data, error } = await client.rpc('rpc_calculate_branch_addon_proration', {
          p_tenant_id: toSalonUUID(tenantId),
          p_additional_branches: additionalBranches,
          p_currency: currency
        });
        if (!error && data && data.success) {
          return data;
        }
      } catch (e) {}
    }
    // Frontend fallback proration calculation
    const monthlyRate = currency.toUpperCase() === 'USD' ? 10 : 300;
    const dailyRate = monthlyRate / 30;
    const daysRemaining = 30;
    const proratedAmount = Math.round(dailyRate * daysRemaining * additionalBranches * 100) / 100;
    return {
      success: true,
      daysRemaining,
      monthlyRatePerBranch: monthlyRate,
      proratedAmount,
      currency
    };
  },

  async activateOrRenewSubscriptionRPC(params: {
    tenantId: string;
    planId: string;
    billingCycle: string;
    additionalBranches?: number;
    currency?: string;
    paidAmount?: number;
    paymentMethod?: string;
    notes?: string;
    status?: 'active' | 'pending_payment';
  }) {
    const client = sb();
    const validSalonId = toSalonUUID(params.tenantId || getSalonId());
    const reqStatus = params.status || 'pending_payment';

    if (client) {
      try {
        const { data, error } = await client.rpc('rpc_activate_or_renew_subscription', {
          p_tenant_id: validSalonId,
          p_plan_id: params.planId,
          p_billing_cycle: params.billingCycle,
          p_additional_branches: params.additionalBranches || 0,
          p_currency: params.currency || 'EGP',
          p_paid_amount: params.paidAmount || 0,
          p_payment_method: params.paymentMethod || 'bank_transfer',
          p_notes: params.notes || null,
          p_status: reqStatus
        });
        if (!error && data) return data;
      } catch (e) {
        console.warn('RPC rpc_activate_or_renew_subscription failed, using client fallback', e);
      }
    }
    // Fallback:
    try {
      const months = params.billingCycle === '1m' ? 1 : params.billingCycle === '3m' ? 3 : params.billingCycle === '12m' ? 12 : 6;
      const end = new Date(Date.now() + months * 30 * 86400000).toISOString().split('T')[0];
      const subId = 'SUB-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // CRITICAL SECURITY: ONLY update salons table if status is strictly 'active' (programmer authorized)
      // Normal tenant renewal requests MUST NEVER activate or extend the salons table directly!
      if (reqStatus === 'active' && client) {
        await client.from('salons').update({
          subscription_status: 'active',
          subscription_plan: params.planId,
          subscription_start_date: new Date().toISOString().split('T')[0],
          subscription_end_date: end,
          is_active: true
        }).eq('id', validSalonId);
      }
      return { 
        success: true, 
        subscriptionId: subId, 
        status: reqStatus, 
        endDate: end,
        message: reqStatus === 'active'
          ? 'تم تفعيل وتنشيط الاشتراك رسمياً بنجاح'
          : 'تم تسجيل طلب الاشتراك وبانتظار تأكيد السداد واعتماده من إدارة المنظومة'
      };
    } catch (e) {
      return { success: false, error: e };
    }
  },

  // ---- دوال المبرمج لإدارة الاشتراكات والطلبات وتصحيح الحالات ----

  async fetchPendingSubscriptions(): Promise<any[]> {
    const client = sb(); if (!client) return [];
    try {
      const { data, error } = await client
        .from('tenant_subscriptions')
        .select('*')
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map(toCamel);
      }
    } catch (e) {}
    return [];
  },

  async approvePendingSubscription(subscriptionId: string, salonId: string): Promise<boolean> {
    const client = sb(); if (!client) return false;
    const validSalonId = toSalonUUID(salonId);
    try {
      // 1. Get subscription details
      const { data: sub } = await client
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .maybeSingle();

      const subPlan = sub?.plan_id || 'growth';
      const subEnd = sub?.end_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
      const maxBranches = sub?.total_branches || 1;
      const maxUsers = sub?.total_employees || 10;

      // 2. Mark subscription as active
      await client
        .from('tenant_subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);

      // 3. Update salon table
      await client
        .from('salons')
        .update({
          subscription_status: 'active',
          subscription_plan: subPlan,
          subscription_end_date: subEnd,
          max_branches: maxBranches,
          max_users: maxUsers,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', validSalonId);

      // 4. Update app_settings
      await this.updateSalonSubscription(validSalonId, {
        subscriptionStatus: 'active',
        subscriptionEndDate: subEnd,
        isSalonActive: true
      });

      return true;
    } catch (e) {
      console.error('Error approving pending subscription:', e);
      return false;
    }
  },

  async cancelPendingSubscription(subscriptionId: string): Promise<boolean> {
    const client = sb(); if (!client) return false;
    try {
      await client
        .from('tenant_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);
      return true;
    } catch (e) {
      return false;
    }
  },

  async resetSalonToTrialDB(salonId: string, trialDays: number = 7, plan?: string): Promise<any> {
    const client = sb();
    const validSalonId = toSalonUUID(salonId);
    const salons = SubscriptionService.getSalons();
    const existingSalon = salons.find(s => s.id === salonId);
    const targetPlan = plan || existingSalon?.subscriptionPlan || 'pro';
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + trialDays * 86400000).toISOString().split('T')[0];

    const updates = {
      subscription_status: 'trial',
      subscription_plan: targetPlan,
      subscription_start_date: startDate,
      subscription_end_date: endDate,
      trial_days: trialDays,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    if (client) {
      try {
        await client.from('salons').update(updates).eq('id', validSalonId);
        const subId = 'SUB-TR-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        await client.from('tenant_subscriptions').insert({
          id: subId,
          salon_id: validSalonId,
          tenant_id: validSalonId,
          plan_id: targetPlan,
          status: 'trial',
          start_date: startDate,
          end_date: endDate,
          total_branches: 1,
          total_employees: 5,
          billing_cycle: 'trial',
          currency: 'SAR',
          paid_amount: 0,
          payment_method: 'free_trial',
          notes: `إعادة إلى الفترة التجريبية بواسطة المبرمج (${trialDays} أيام) - الباقة: ${targetPlan}`
        });
      } catch (e) {
        console.warn('DB update failed during reset to trial:', e);
      }
    }

    await this.updateSalonSubscription(validSalonId, {
      subscriptionStatus: 'trial',
      subscriptionEndDate: endDate,
      isSalonActive: true
    });

    return SubscriptionService.updateSalon(salonId, {
      subscriptionStatus: 'trial',
      subscriptionPlan: plan as any,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      trialDays,
      isActive: true
    });
  },

  async expireSalonSubscriptionDB(salonId: string, reason: string = 'إلغاء الاشتراك من لوحة المبرمج'): Promise<any> {
    const client = sb();
    const validSalonId = toSalonUUID(salonId);
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const updates = {
      subscription_status: 'expired',
      subscription_end_date: yesterday,
      is_active: false,
      updated_at: new Date().toISOString()
    };

    if (client) {
      try {
        await client.from('salons').update(updates).eq('id', validSalonId);
        await client.from('tenant_subscriptions')
          .update({ status: 'expired', notes: reason, updated_at: new Date().toISOString() })
          .or(`salon_id.eq.${validSalonId},tenant_id.eq.${validSalonId}`)
          .in('status', ['active', 'trial', 'pending_payment']);
      } catch (e) {
        console.warn('DB update failed during cancel subscription:', e);
      }
    }

    await this.updateSalonSubscription(validSalonId, {
      subscriptionStatus: 'expired',
      subscriptionEndDate: yesterday,
      isSalonActive: false
    });

    return SubscriptionService.updateSalon(salonId, {
      subscriptionStatus: 'expired',
      subscriptionEndDate: yesterday,
      isActive: false
    });
  },

  // ============================================================
  // تحميل البيانات الأساسية فقط (Auth, Settings, POS Catalog) بسرعة خارقة
  // ============================================================
  async loadEssentialData(salonId: string) {
    const client = sb();
    if (!client) return null;

    const validSalonId = toSalonUUID(salonId);
    console.log('[Fast Startup] تحميل البيانات الأساسية للصالون:', validSalonId);
    
    // Fetch ONLY essential catalog needed for POS & basic operations concurrently
    const [categories, services, employees, clients, products, suppliers, purchaseInvoices, supplierPayments] = await Promise.all([
      DB.fetchAll<any>('categories', undefined, validSalonId),
      DB.fetchAll<any>('services', undefined, validSalonId),
      DB.fetchAll<any>('employees', undefined, validSalonId),
      // Recent clients for instant POS lookup
      DB.fetchAll<any>('clients', undefined, validSalonId),
      DB.fetchAll<any>('products', undefined, validSalonId),
      DB.fetchAll<any>('suppliers', undefined, validSalonId),
      DB.fetchAll<any>('purchase_invoices', undefined, validSalonId),
      DB.fetchAll<any>('supplier_payments', undefined, validSalonId),
    ]);

    return {
      categories,
      services,
      employees,
      clients,
      products,
      suppliers,
      purchaseInvoices,
      supplierPayments
    };
  },

  // ============================================================
  // تحميل بيانات قسم معين عند فتحه (Lazy Load per Tab)
  // ============================================================
  async loadSectionData(section: string, salonId: string) {
    const client = sb();
    if (!client) return {};
    const validSalonId = toSalonUUID(salonId);

    switch (section) {
      case 'invoices': {
        const invoices = await DB.fetchAll<any>('invoices', undefined, validSalonId);
        return { invoices };
      }
      case 'transactions':
      case 'treasury':
      case 'expenses': {
        const [transactions, custodies] = await Promise.all([
          DB.fetchAll<any>('transactions', undefined, validSalonId),
          DB.fetchAll<any>('employee_custodies', undefined, validSalonId)
        ]);
        return { transactions, custodies };
      }
      case 'barber_portal': {
        const [bookings, invoices] = await Promise.all([
          DB.fetchAll<any>('bookings', undefined, validSalonId),
          DB.fetchAll<any>('invoices', undefined, validSalonId)
        ]);
        return { bookings, invoices };
      }
      case 'bookings': {
        const bookings = await DB.fetchAll<any>('bookings', undefined, validSalonId);
        return { bookings };
      }
      case 'clients': {
        const clients = await DB.fetchAll<any>('clients', undefined, validSalonId);
        return { clients };
      }
      case 'dashboard':
      case 'reports': {
        const [invoices, transactions, bookings, purchaseInvoices, supplierPayments, suppliers, fingerprintLogs] = await Promise.all([
          DB.fetchAll<any>('invoices', undefined, validSalonId),
          DB.fetchAll<any>('transactions', undefined, validSalonId),
          DB.fetchAll<any>('bookings', undefined, validSalonId),
          DB.fetchAll<any>('purchase_invoices', undefined, validSalonId),
          DB.fetchAll<any>('supplier_payments', undefined, validSalonId),
          DB.fetchAll<any>('suppliers', undefined, validSalonId),
          DB.fetchAll<any>('fingerprint_logs', undefined, validSalonId)
        ]);
        return { invoices, transactions, bookings, purchaseInvoices, supplierPayments, suppliers, fingerprintLogs };
      }
      case 'hr':
      case 'employees': {
        const [fingerprintLogs, custodies, tips, emps] = await Promise.all([
          DB.fetchAll<any>('fingerprint_logs', undefined, validSalonId),
          DB.fetchAll<any>('employee_custodies', undefined, validSalonId),
          DB.fetchAll<any>('tips', undefined, validSalonId),
          DB.fetchAll<any>('employees', undefined, validSalonId)
        ]);
        return { fingerprintLogs, custodies, tips, employees: emps ? emps.map(dbEmployeeToApp) : [] };
      }
      case 'warehouse':
      case 'suppliers':
      case 'purchases':
      case 'inventory':
      case 'products': {
        const [suppliers, purchaseInvoices, supplierPayments, inventoryCounts, itemMovements, products, categories] = await Promise.all([
          DB.fetchAll<any>('suppliers', undefined, validSalonId),
          DB.fetchAll<any>('purchase_invoices', undefined, validSalonId),
          DB.fetchAll<any>('supplier_payments', undefined, validSalonId),
          DB.fetchAll<any>('inventory_counts', undefined, validSalonId),
          DB.fetchAll<any>('item_movements', undefined, validSalonId),
          DB.fetchAll<any>('products', undefined, validSalonId),
          DB.fetchAll<any>('categories', undefined, validSalonId)
        ]);
        return { suppliers, purchaseInvoices, supplierPayments, inventoryCounts, itemMovements, products, categories };
      }
      case 'partners': {
        const [partners, partnerTransactions] = await Promise.all([
          DB.fetchAll<any>('partners', undefined, validSalonId),
          DB.fetchAll<any>('partner_transactions', undefined, validSalonId)
        ]);
        return { partners, partnerTransactions };
      }
      case 'owner_portal':
      case 'owner': {
        const [
          invoices, 
          transactions, 
          bookings, 
          purchaseInvoices, 
          supplierPayments, 
          suppliers, 
          partners, 
          partnerTransactions, 
          employees, 
          clients,
          fingerprintLogs,
          users,
          settings
        ] = await Promise.all([
          DB.fetchAll<any>('invoices', undefined, validSalonId),
          DB.fetchAll<any>('transactions', undefined, validSalonId),
          DB.fetchAll<any>('bookings', undefined, validSalonId),
          DB.fetchAll<any>('purchase_invoices', undefined, validSalonId),
          DB.fetchAll<any>('supplier_payments', undefined, validSalonId),
          DB.fetchAll<any>('suppliers', undefined, validSalonId),
          DB.fetchPartners(validSalonId),
          DB.fetchPartnerTransactions(validSalonId),
          DB.fetchEmployees(validSalonId),
          DB.fetchAll<any>('clients', undefined, validSalonId),
          DB.fetchAll<any>('fingerprint_logs', undefined, validSalonId),
          DB.fetchUsers(validSalonId),
          DB.fetchSettings(validSalonId)
        ]);
        return { 
          invoices, 
          transactions, 
          bookings, 
          purchaseInvoices, 
          supplierPayments, 
          suppliers, 
          partners, 
          partnerTransactions, 
          employees, 
          clients,
          fingerprintLogs,
          users,
          settings
        };
      }
      case 'promotions':
      case 'promo_codes':
      case 'promo-codes': {
        const [promoCodes, promoCodeUsages] = await Promise.all([
          DB.fetchAll<any>('promo_codes', undefined, validSalonId),
          DB.fetchAll<any>('promo_code_usages', undefined, validSalonId)
        ]);
        return { promoCodes, promoCodeUsages };
      }
      case 'tips': {
        const tips = await DB.fetchAll<any>('tips', undefined, validSalonId);
        return { tips };
      }
      case 'fingerprint':
      case 'fingerprint_logs':
      case 'fingerprint-logs': {
        const fingerprintLogs = await DB.fetchAll<any>('fingerprint_logs', undefined, validSalonId);
        return { fingerprintLogs };
      }
      default:
        return {};
    }
  },

  // ============================================================
  // تحميل كل بيانات الصالون دفعة واحدة عند بدء التشغيل أو الطلب
  // ============================================================
  async loadAllData(salonId: string) {
    const client = sb();
    if (!client) return null;

    const validSalonId = toSalonUUID(salonId);
    console.log('جاري تحميل البيانات من Supabase للصالون:', validSalonId);
    const [
      categories, services, employees, clients,
      products, suppliers, invoices, transactions,
      bookings, purchaseInvoices, supplierPayments,
      inventoryCounts, itemMovements, partners,
      partnerTransactions, promoCodes, promoCodeUsages,
      tips, custodies, fingerprintLogs
    ] = await Promise.all([
      DB.fetchAll<any>('categories', undefined, validSalonId),
      DB.fetchAll<any>('services', undefined, validSalonId),
      DB.fetchAll<any>('employees', undefined, validSalonId),
      DB.fetchAll<any>('clients', undefined, validSalonId),
      DB.fetchAll<any>('products', undefined, validSalonId),
      DB.fetchAll<any>('suppliers', undefined, validSalonId),
      DB.fetchAll<any>('invoices', undefined, validSalonId),
      DB.fetchAll<any>('transactions', undefined, validSalonId),
      DB.fetchAll<any>('bookings', undefined, validSalonId),
      DB.fetchAll<any>('purchase_invoices', undefined, validSalonId),
      DB.fetchAll<any>('supplier_payments', undefined, validSalonId),
      DB.fetchAll<any>('inventory_counts', undefined, validSalonId),
      DB.fetchAll<any>('item_movements', undefined, validSalonId),
      DB.fetchAll<any>('partners', undefined, validSalonId),
      DB.fetchAll<any>('partner_transactions', undefined, validSalonId),
      DB.fetchAll<any>('promo_codes', undefined, validSalonId),
      DB.fetchAll<any>('promo_code_usages', undefined, validSalonId),
      DB.fetchAll<any>('tips', undefined, validSalonId),
      DB.fetchAll<any>('employee_custodies', undefined, validSalonId),
      DB.fetchAll<any>('fingerprint_logs', undefined, validSalonId),
    ]);

    console.log('تم تحميل جميع بيانات الصالون من Supabase بنجاح');
    return {
      categories, services, employees, clients,
      products, suppliers, invoices, transactions,
      bookings, purchaseInvoices, supplierPayments,
      inventoryCounts, itemMovements, partners,
      partnerTransactions, promoCodes, promoCodeUsages,
      tips, custodies, fingerprintLogs
    };
  }
};

// تحويل بيانات العميل من snake_case أو camelCase قاعدة البيانات إلى كيان Client في التطبيق
export function dbClientToApp(row: any) {
  if (!row) return {} as any;
  return {
    id: row.id,
    salonId: row.salonId || row.salon_id,
    branchId: row.branchId || row.branch_id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    dob: row.dob || '',
    dobDay: row.dobDay || row.dob_day || (row.dob ? String(new Date(row.dob).getDate()) : undefined),
    dobMonth: row.dobMonth || row.dob_month || (row.dob ? String(new Date(row.dob).getMonth() + 1) : undefined),
    clientType: (row.clientType || row.client_type) === 'foreigner' ? 'foreigner' : 'citizen',
    lastBirthdayGreetingAt: row.lastBirthdayGreetingAt || row.last_birthday_greeting_at || undefined,
    lastReactivationMessageAt: row.lastReactivationMessageAt || row.last_reactivation_message_at || undefined,
    loyaltyPoints: Number(row.loyaltyPoints ?? row.loyalty_points ?? 0),
    cashback: Number(row.cashbackBalance ?? row.cashback_balance ?? row.cashback ?? 0),
    tierLevel: row.tierLevel || row.tier_level || 'standard',
    isVip: toBool(row.isVip !== undefined ? row.isVip : row.is_vip),
    vipSince: row.vipSince || row.vip_since || '',
    vipNotes: row.vipNotes || row.vip_notes || '',
    referredByPhone: row.referredByPhone || row.referred_by_phone || '',
    hasUsedReferralReward: toBool(row.hasUsedReferralReward !== undefined ? row.hasUsedReferralReward : row.has_used_referral_reward),
    referralCount: Number(row.referralCount ?? row.referral_count ?? 0),
    referralTotalCashbackEarned: Number(row.referralTotalCashbackEarned ?? row.referral_total_cashback_earned ?? 0),
    notes: row.notes || '',
    isBlacklisted: toBool(row.isBlacklisted !== undefined ? row.isBlacklisted : row.is_blacklisted),
    blacklistReason: row.blacklistReason || row.blacklist_reason || '',
    lastVisit: row.lastVisit || row.last_visit || '',
    preferences: row.preferences || {},
    createdAt: row.createdAt || row.created_at || ''
  };
}

function parseJsonArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim().length > 0) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// تحويل بيانات الموظف من قاعدة البيانات إلى كيان Employee في التطبيق
export function dbEmployeeToApp(row: any) {
  if (!row) return {} as any;
  const parsedWeeklyOff = parseJsonArray(row.weeklyDaysOff ?? row.weekly_days_off);
  return {
    id: row.id,
    salonId: row.salonId || row.salon_id,
    branchId: row.branchId || row.branch_id,
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    avatarUrl: row.avatarUrl || row.avatar_url || '',
    publicBio: row.publicBio || row.public_bio || '',
    hasOnlineAccount: toBool(row.hasOnlineAccount !== undefined ? row.hasOnlineAccount : row.has_online_account),
    username: row.username || '',
    userId: row.userId || row.user_id || '',
    role: row.role || 'حلاق / كوافير',
    basicSalary: Number(row.basicSalary ?? row.basic_salary ?? row.baseSalary ?? row.base_salary ?? 0) || 0,
    baseSalary: Number(row.baseSalary ?? row.base_salary ?? row.basicSalary ?? row.basic_salary ?? 0) || 0,
    fingerprintCode: row.fingerprintCode || row.fingerprint_code || '',
    commissionRate: Number(row.commissionRate ?? row.commission_rate ?? 0),
    commissionModel: row.commissionModel || row.commission_model || (Number(row.commissionRate ?? row.commission_rate ?? 0) === 0 ? 'none' : 'fixed_rate'),
    commissionTiers: parseJsonArray(row.commissionTiers ?? row.commission_tiers),
    target: Number(row.target ?? row.target_amount ?? row.targetAmount ?? 5000),
    targetAmount: Number(row.targetAmount ?? row.target_amount ?? row.target ?? 5000),
    targetType: row.targetType || row.target_type || 'monthly',
    dailyTargetAmount: Number(row.dailyTargetAmount ?? row.daily_target_amount ?? (row.target_type === 'daily' ? (row.target ?? row.target_amount ?? 300) : 0)),
    dailyTargetMethod: (row.dailyTargetMethod || row.daily_target_method || 'excess_only') as 'excess_only' | 'full_amount' | 'salary_multiplier',
    dailyTargetMultiplier: Number(row.dailyTargetMultiplier ?? row.daily_target_multiplier ?? row.targetSalaryMultiplier ?? row.target_salary_multiplier ?? 1),
    monthlyTargetAmount: Number(row.monthlyTargetAmount ?? row.monthly_target_amount ?? (row.target_type !== 'daily' ? (row.target ?? row.target_amount ?? 5000) : 5000)),
    monthlyTargetMethod: (row.monthlyTargetMethod || row.monthly_target_method || 'deduct_salary') as 'deduct_salary' | 'gross_sales' | 'salary_multiplier',
    monthlyTargetMultiplier: Number(row.monthlyTargetMultiplier ?? row.monthly_target_multiplier ?? row.targetSalaryMultiplier ?? row.target_salary_multiplier ?? 1),
    targetSalaryMultiplier: Number(row.targetSalaryMultiplier ?? row.target_salary_multiplier ?? row.monthlyTargetMultiplier ?? row.monthly_target_multiplier ?? row.dailyTargetMultiplier ?? row.daily_target_multiplier ?? 1),
    targetCommissionRate: Number(row.targetCommissionRate ?? row.target_commission_rate ?? row.commissionRate ?? row.commission_rate ?? 0),
    availableVacations: Number(row.availableVacations ?? row.available_vacations ?? 21),
    salaryType: row.salaryType || row.salary_type || 'salary',
    allowDualCommission: toBool(row.allowDualCommission !== undefined ? row.allowDualCommission : row.allow_dual_commission),
    checkInTime: row.checkInTime || row.check_in_time || '09:00',
    checkOutTime: row.checkOutTime || row.check_out_time || '23:00',
    weeklyDaysOff: parsedWeeklyOff.length > 0 ? parsedWeeklyOff : ['Friday'],
    isActive: row.isActive !== false && row.is_active !== false && row.is_active !== '0' && row.is_active !== 0,
    isBlacklisted: toBool(row.isBlacklisted !== undefined ? row.isBlacklisted : row.is_blacklisted),
    blacklistReason: row.blacklistReason || row.blacklist_reason || '',
    financialRecords: parseJsonArray(row.financialRecords ?? row.financial_records),
    leaveRecords: parseJsonArray(row.leaveRecords ?? row.leave_records),
    salaryHistory: parseJsonArray(row.salaryHistory ?? row.salary_history),
    shiftScheduleHistory: parseJsonArray(row.shiftScheduleHistory ?? row.shift_schedule_history),
    permissionRecords: parseJsonArray(row.permissionRecords ?? row.permission_records),
    endOfService: row.endOfService || row.end_of_service || null
  };
}

// تحويل بيانات الخدمة من قاعدة البيانات إلى كيان ServiceItem في التطبيق
export function dbServiceToApp(row: any) {
  const price = Number(row.price) || 0;
  const rawDiscount = Number(row.discountPrice ?? row.discount_price);
  const validDiscount = (!isNaN(rawDiscount) && rawDiscount > 0 && rawDiscount < price) ? rawDiscount : undefined;

  return {
    id: row.id, 
    salonId: row.salonId || row.salon_id, 
    branchId: row.branchId || row.branch_id,
    categoryId: row.categoryId || row.category_id || row.category || '',
    name: row.name, 
    price: price, 
    foreignerPrice: (row.foreignerPrice !== undefined && row.foreignerPrice !== null && row.foreignerPrice !== '') 
      ? Number(row.foreignerPrice) 
      : ((row.foreigner_price !== undefined && row.foreigner_price !== null && row.foreigner_price !== '') ? Number(row.foreigner_price) : undefined),
    discountPrice: validDiscount,
    employeeCommissionPercentage: Number(row.employeeCommissionPercentage ?? row.employee_commission_percentage ?? row.commissionRate ?? row.commission_rate ?? 0),
    employeeCommissionAmount: Number(row.employeeCommissionAmount ?? row.employee_commission_amount ?? row.commissionAmount ?? row.commission_amount ?? 0),
    commissionableAmount: (row.commissionableAmount !== undefined && row.commissionableAmount !== null && row.commissionableAmount !== '') 
      ? Number(row.commissionableAmount) 
      : ((row.commissionable_amount !== undefined && row.commissionable_amount !== null && row.commissionable_amount !== '') ? Number(row.commissionable_amount) : undefined),
    isTargetExempt: Boolean(row.isTargetExempt ?? row.is_target_exempt),
    referralCommissionType: row.referralCommissionType || row.referral_commission_type || 'percentage',
    referralCommissionAmount: Number(row.referralCommissionAmount ?? row.referral_commission_amount ?? 0),
    cashbackPercentage: Number(row.cashbackPercentage ?? row.cashback_percentage ?? 0),
    clientReferralCashbackType: row.clientReferralCashbackType || row.client_referral_cashback_type || 'percentage',
    clientReferralCashbackAmount: Number(row.clientReferralCashbackAmount ?? row.client_referral_cashback_amount ?? 0),
    durationMinutes: row.durationMinutes ?? 30, 
    barcode: row.barcode || '',
    imageUrl: row.imageUrl || row.image_url || '',
    isActive: row.isActive !== false, 
    type: row.type || 'service',
    isPriority: row.isPriority ?? row.is_priority ?? false,
    cardColor: row.cardColor || row.card_color || '',
    priorityOrder: row.priorityOrder ?? row.priority_order ?? 0
  };
}

// تحويل بيانات المستخدم من قاعدة البيانات إلى كيان AppUser في التطبيق
export function dbUserToApp(row: any): any {
  if (!row) return {} as any;
  const c = toCamel(row);
  const role = (c.role === 'kiosk' || (Array.isArray(c.screens) && c.screens.includes('kiosk') && c.screens.length === 1)) ? 'kiosk' : (c.role || 'cashier');
  
  // Parse screens
  let screens = c.screens;
  if (typeof screens === 'string') {
    try { screens = JSON.parse(screens); } catch { screens = null; }
  }
  if (!Array.isArray(screens)) {
    screens = (role === 'programmer' || role === 'admin' || role === 'owner') ? ['*'] : null;
  } else if (role !== 'programmer' && role !== 'admin' && role !== 'owner') {
    screens = screens.filter((s: string) => s !== '*');
  }

  // Parse actions / permissions
  let actions = c.actions || c.permissions;
  if (typeof actions === 'string') {
    try { actions = JSON.parse(actions); } catch { actions = null; }
  }
  if (!Array.isArray(actions)) {
    actions = (role === 'programmer' || role === 'admin' || role === 'owner') ? ['*'] : null;
  } else if (role !== 'programmer' && role !== 'admin' && role !== 'owner') {
    actions = actions.filter((a: string) => a !== '*');
  }

  return {
    ...c,
    id: c.id,
    salonId: c.salonId,
    branchId: c.branchId,
    salonCode: c.salonCode,
    branchCode: c.branchCode,
    username: (c.username || '').trim().toLowerCase(),
    password: c.password || c.passwordHash || row.password_hash || '',
    name: c.name || c.username || 'مستخدم',
    email: c.email || '',
    phone: c.phone || '',
    role,
    customRoleId: c.customRoleId,
    employeeId: c.employeeId || row.employee_id || '',
    active: c.active !== false,
    screens,
    actions,
    avatar: c.avatar,
    integritySignature: c.integritySignature || c.securityHash || row.security_hash || row.integrity_signature || '',
    securityHash: c.securityHash || c.integritySignature || row.security_hash || row.integrity_signature || ''
  };
}

// تحويل بيانات المنتج من قاعدة البيانات إلى كيان Product في التطبيق
export function dbProductToApp(row: any): any {
  if (!row) return {} as any;
  const c = toCamel(row);
  return {
    id: c.id || row.id || '',
    name: c.name || row.name || '',
    categoryId: c.categoryId || row.category_id || '',
    sellPrice: Number(c.sellPrice ?? row.sell_price ?? row.retail_price ?? 0),
    price: Number(c.sellPrice ?? row.sell_price ?? row.retail_price ?? 0),
    costPrice: Number(c.costPrice ?? row.cost_price ?? 0),
    reorderLimit: Number(c.reorderLimit ?? row.reorder_limit ?? 5),
    openingStock: Number(c.openingStock ?? row.opening_stock ?? 0),
    currentStock: Number(c.currentStock ?? row.current_stock ?? 0),
    commission: Number(c.commission ?? 0),
    barcode: c.barcode || row.barcode || '',
    productType: (c.productType || row.product_type || 'for_sale') as 'for_sale' | 'raw_material',
    salonId: c.salonId || row.salon_id || undefined,
    branchId: c.branchId || row.branch_id || undefined,
    isActive: c.isActive !== false && row.is_active !== false
  };
}

// تحويل بيانات الحجز من قاعدة البيانات إلى كيان Booking موحد ومكتمل في التطبيق
export function dbBookingToApp(row: any): any {
  if (!row) return {} as any;
  const c = toCamel(row);

  let services = c.services || row.services || [];
  if (typeof services === 'string') {
    try { services = JSON.parse(services); } catch { services = []; }
  }
  if (!Array.isArray(services)) services = [];
  services = services.map((s: any) => ({
    ...s,
    quantity: Math.max(1, Number(s.quantity) || 1)
  }));

  let advancePayments = c.advancePayments || row.advance_payments || [];
  if (typeof advancePayments === 'string') {
    try { advancePayments = JSON.parse(advancePayments); } catch { advancePayments = []; }
  }
  if (!Array.isArray(advancePayments)) advancePayments = [];

  // Date & Time formatting with Timezone support
  let date = c.date || row.date || '';
  if (typeof date === 'string' && date.includes('T')) {
    date = date.split('T')[0];
  }

  let time = c.time || row.time || '';
  const rawStartTime = c.startTime || row.start_time;
  const rawEndTime = c.endTime || row.end_time;
  const tz = c.timezone || row.timezone || getSalonTimezone();

  if (rawStartTime && typeof rawStartTime === 'string' && (rawStartTime.endsWith('Z') || rawStartTime.includes('+'))) {
    try {
      const local = utcToSalonLocal(rawStartTime, tz);
      if (!date) date = local.date;
      if (!time) time = local.time;
    } catch {}
  } else if (!time) {
    if (typeof rawStartTime === 'string' && rawStartTime.includes('T')) {
      time = rawStartTime.split('T')[1]?.slice(0, 5) || '10:00';
    } else if (typeof rawStartTime === 'string') {
      time = rawStartTime.slice(0, 5);
    } else {
      time = '10:00';
    }
  }

  return {
    ...c,
    id: c.id || row.id,
    salonId: c.salonId || row.salon_id,
    branchId: c.branchId || row.branch_id,
    clientName: c.clientName || row.client_name || c.customerName || row.customer_name || 'عميل نقدي',
    phone: c.phone || row.phone || c.clientPhone || row.client_phone || c.customerPhone || row.customer_phone || '',
    customerId: c.customerId || c.clientId || row.client_id || undefined,
    customerEmail: c.customerEmail || row.customer_email || '',
    date,
    time,
    status: c.status || row.status || 'pending',
    advancePayments,
    services,
    totalAmount: Number(c.totalAmount ?? row.total_amount ?? c.totalPrice ?? row.total_price ?? 0),
    notes: c.notes || row.notes || '',
    internalNotes: c.internalNotes || row.internal_notes || row.internalNotes || '',
    source: c.source || row.source || 'pos',
    bookingCode: c.bookingCode || row.booking_code || '',
    queueNumber: c.queueNumber || row.queue_number || undefined,
    location: c.location || row.location || '',
    isPaid: Boolean(c.isPaid ?? row.is_paid),
    invoiceId: c.invoiceId || row.invoice_id || undefined,
    createdAt: c.createdAt || row.created_at || (row.created_at ? new Date(row.created_at).toISOString() : undefined),
    createdBy: c.createdBy || row.created_by_name || row.created_by || c.createdByName || undefined,
    createdById: c.createdById || row.created_by_id || undefined,
    updatedAt: c.updatedAt || row.updated_at || (row.updated_at ? new Date(row.updated_at).toISOString() : undefined),
    updatedBy: c.updatedBy || row.updated_by_name || row.updated_by || c.updatedByName || undefined,
    updatedById: c.updatedById || row.updated_by_id || undefined,
    discountType: c.discountType || row.discount_type || undefined,
    discountValue: c.discountValue !== undefined ? Number(c.discountValue) : (row.discount_value !== null && row.discount_value !== undefined ? Number(row.discount_value) : undefined),
    discountAmount: c.discountAmount !== undefined ? Number(c.discountAmount) : (row.discount_amount !== null && row.discount_amount !== undefined ? Number(row.discount_amount) : undefined),
    paidDeposit: c.paidDeposit !== undefined ? Number(c.paidDeposit) : (row.paid_deposit !== null && row.paid_deposit !== undefined ? Number(row.paid_deposit) : (Array.isArray(advancePayments) ? advancePayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0) : 0)),
    isDepositRefunded: Boolean(c.isDepositRefunded ?? row.is_deposit_refunded),
    depositRefundedAt: c.depositRefundedAt || row.deposit_refunded_at || (row.deposit_refunded_at ? new Date(row.deposit_refunded_at).toISOString() : undefined),
    depositRefundedBy: c.depositRefundedBy || row.deposit_refunded_by || undefined,
    depositRefundAmount: c.depositRefundAmount !== undefined ? Number(c.depositRefundAmount) : (row.deposit_refund_amount !== null && row.deposit_refund_amount !== undefined ? Number(row.deposit_refund_amount) : undefined),
    refundExpenseId: c.refundExpenseId || row.refund_expense_id || undefined,
    cancelledAt: c.cancelledAt || row.cancelled_at || (row.cancelled_at ? new Date(row.cancelled_at).toISOString() : undefined),
    cancelledBy: c.cancelledBy || row.cancelled_by || undefined,
    startTime: rawStartTime,
    endTime: rawEndTime,
    timezone: tz
  };
}

/**
 * حساب تاريخ معالجة البصمة (Processed Date):
 * إذا كان نوع الحركة انصراف (check_out) ووقت البصمة بين منتصف الليل (00:00) وحتى السادسة صباحاً (06:00)،
 * يُعتبر تاريخ الانصراف تابعاً للوردية السابقة (تاريخ أمس / اليوم السابق).
 * خلاف ذلك، يُعتبر تاريخ البصمة هو نفس تاريخ اليوم العادي.
 */
export function calculateFingerprintProcessedDate(timestampStr?: string, type?: string): string {
  if (!timestampStr) return new Date().toISOString().split('T')[0];
  const str = String(timestampStr).trim();
  const normalizedType = String(type || '').toLowerCase().replace('-', '_');
  const isCheckOut = normalizedType === 'check_out' || normalizedType === 'checkout';

  // 1. Try timezone-agnostic Regex extraction
  const match = str.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);

    const isNightCheckout = isCheckOut && (hour >= 0 && (hour < 6 || (hour === 6 && minute === 0)));
    if (isNightCheckout) {
      const d = new Date(Date.UTC(year, month - 1, day));
      d.setUTCDate(d.getUTCDate() - 1);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dt = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // 2. Fallback to JS Date
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const isNightCheckout = isCheckOut && (hours >= 0 && (hours < 6 || (hours === 6 && minutes === 0)));
      if (isNightCheckout) {
        d.setDate(d.getDate() - 1);
      }
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    }
  } catch (e) {}

  return str.split('T')[0].split(' ')[0] || new Date().toISOString().split('T')[0];
}

export function getFingerprintProcessedDate(log: any): string {
  if (!log) return '';
  if (log.processedDate) return log.processedDate;
  if (log.processed_date) return log.processed_date;
  const ts = log.timestamp || log.logTime || log.log_time;
  return calculateFingerprintProcessedDate(ts, log.type);
}

export function dbCategoryToApp(row: any): any {
  if (!row) return {} as any;
  const c = toCamel(row);
  return {
    id: c.id || row.id || '',
    salonId: c.salonId || row.salon_id || undefined,
    branchId: c.branchId || row.branch_id || undefined,
    name: c.name || row.name || '',
    icon: c.icon || row.icon || 'Scissors',
    type: (c.type || row.type || 'service') as 'service' | 'product',
    isActive: c.isActive !== false && row.is_active !== false,
  };
}

// تحويل بيانات الفاتورة من قاعدة البيانات إلى كيان Invoice موحد ومكتمل في التطبيق
export function dbInvoiceToApp(row: any): any {
  if (!row) return {} as any;
  let items = row.items || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  let paymentMethods = row.paymentMethods || row.payment_methods || [];
  if (typeof paymentMethods === 'string') {
    try { paymentMethods = JSON.parse(paymentMethods); } catch { paymentMethods = []; }
  }
  if (!Array.isArray(paymentMethods)) paymentMethods = [];

  return {
    id: row.id,
    salonId: row.salonId || row.salon_id,
    branchId: row.branchId || row.branch_id,
    branchCode: row.branchCode || row.branch_code,
    invoiceNumber: row.invoiceNumber || row.invoice_number || row.id,
    clientId: row.clientId || row.client_id || undefined,
    clientName: row.clientName || row.client_name || 'عميل نقدي',
    clientPhone: row.clientPhone || row.client_phone || '',
    date: row.date || row.created_at || row.createdAt || new Date().toISOString(),
    subtotal: Number(row.subtotal ?? row.total ?? 0),
    discount: Number(row.discount ?? 0),
    discountType: row.discountType || row.discount_type || 'fixed',
    tax: Number(row.tax ?? row.vat ?? row.vatAmount ?? 0),
    vatAmount: Number(row.vatAmount ?? row.vat ?? row.tax ?? 0),
    cashbackUsed: Number(row.cashbackUsed ?? row.cashback_used ?? 0),
    total: Number(row.total ?? 0),
    paid: Number(row.paid ?? row.paidAmount ?? row.total ?? 0),
    paidAmount: Number(row.paidAmount ?? row.paid ?? row.total ?? 0),
    remaining: Number(row.remaining ?? row.remainingAmount ?? 0),
    remainingAmount: Number(row.remainingAmount ?? row.remaining ?? 0),
    advanceDeduction: Number(row.advanceDeduction ?? row.advance_deduction ?? 0),
    paymentMethod: row.paymentMethod || row.payment_method || (paymentMethods[0]?.treasuryId) || 'cash',
    treasuryId: row.treasuryId || row.treasury_id || (paymentMethods[0]?.treasuryId) || 'main',
    paymentMethods,
    items,
    status: row.status || 'completed',
    isCancelled: Boolean(row.isCancelled ?? row.is_cancelled),
    cancelReason: row.cancelReason || row.cancel_reason || '',
    cancelledAt: row.cancelledAt || row.cancelled_at || undefined,
    isRemedyInvoice: Boolean(row.isRemedyInvoice ?? row.isRemedy ?? row.is_remedy),
    remedyReason: row.remedyReason || row.remedyNotes || row.remedy_notes || '',
    relatedComplaintId: row.relatedComplaintId || row.related_complaint_id || '',
    originalInvoiceId: row.originalInvoiceId || row.original_invoice_id || '',
    beforePhotoUrl: row.beforePhotoUrl || row.before_photo_url || undefined,
    afterPhotoUrl: row.afterPhotoUrl || row.after_photo_url || undefined,
    zatcaQr: row.zatcaQr || row.zatca_qr || '',
    zatcaHash: row.zatcaHash || row.zatca_hash || '',
    zatcaReportingStatus: row.zatcaReportingStatus || row.zatca_reporting_status || 'not_submitted',
    zatcaWarning: row.zatcaWarning || row.zatca_warning || '',
    etaSubmissionUuid: row.etaSubmissionUuid || row.eta_submission_uuid || '',
    etaStatus: row.etaStatus || row.eta_status || 'not_submitted',
    createdBy: row.createdBy || row.created_by || '',
    cashierId: row.cashierId || row.cashier_id || undefined,
    cashierName: row.cashierName || row.cashier_name || undefined,
    notes: row.notes || '',
    dueDate: row.dueDate || row.due_date || undefined,
    badDebtReason: row.badDebtReason || row.bad_debt_reason || undefined,
    badDebtAt: row.badDebtAt || row.bad_debt_at || undefined,
    badDebtBy: row.badDebtBy || row.bad_debt_by || undefined,
    paymentsHistory: Array.isArray(row.paymentsHistory || row.payments_history)
      ? (row.paymentsHistory || row.payments_history)
      : (typeof (row.paymentsHistory || row.payments_history) === 'string'
          ? (function() { try { return JSON.parse(row.paymentsHistory || row.payments_history); } catch { return []; } })()
          : []),
    tipAmount: Number(row.tipAmount ?? row.tips ?? 0),
    bookingId: row.bookingId || row.booking_id || undefined,
    shiftId: row.shiftId || row.shift_id || undefined,
    shiftDate: row.shiftDate || row.shift_date || undefined,
    shiftCode: row.shiftCode || row.shift_code || undefined,
    createdAt: row.createdAt || row.created_at || undefined,
  };
}

