import { SupabaseService } from './supabase';
import { dataUrlToBlob } from '../utils/imageUpload';
import { HeldInvoice } from '../types';

// ============================================================
// 🗄️ SmartCut DB Service — طبقة البيانات الموحدة
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
  return (id && UUID_REGEX.test(id)) ? id : '';
}

export function toBranchUUID(id?: string | null): string | null {
  if (!id) return null;
  if (UUID_REGEX.test(id)) return id;
  return null;
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

    return '';
  } catch { return ''; }
}

// ============================================================
// 🛡️ نظام الفحص والإنشاء التلقائي للأعمدة (Self-Healing Schema Engine)
// ============================================================
const verifiedColumns = new Set<string>();

export async function ensureColumn(table: string, column: string, type: string = 'TEXT'): Promise<boolean> {
  const cacheKey = `${table}.${column}`;
  if (verifiedColumns.has(cacheKey)) return true;

  const client = sb();
  if (!client) return false;

  try {
    // 1. Try standard RPC add_column_if_not_exists
    const { data, error } = await client.rpc('add_column_if_not_exists', {
      p_table: table,
      p_column: column,
      p_type: type
    });
    if (!error && (data === true || data === null)) {
      verifiedColumns.add(cacheKey);
      return true;
    }
  } catch { /* Continue to fallback */ }

  try {
    // 2. Try exec_sql RPC fallback if available
    const { error: sqlErr } = await client.rpc('exec_sql', {
      query: `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type};`
    });
    if (!sqlErr) {
      verifiedColumns.add(cacheKey);
      return true;
    }
  } catch { /* RPC not yet created in PostgreSQL */ }

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
      ensureColumn('work_shifts', 'salon_id', 'UUID'),
      ensureColumn('work_shifts', 'branch_id', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'shift_date', 'VARCHAR(50)'),
      ensureColumn('work_shifts', 'opened_at', 'TIMESTAMPTZ'),
      ensureColumn('work_shifts', 'closed_at', 'TIMESTAMPTZ'),
      ensureColumn('work_shifts', 'opened_by_user_id', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'opened_by_user_name', 'VARCHAR(255)'),
      ensureColumn('work_shifts', 'opened_by_role', 'VARCHAR(100)'),
      ensureColumn('work_shifts', 'initial_cash', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'expected_cash', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'actual_cash', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'cash_difference', 'NUMERIC(12,2)'),
      ensureColumn('work_shifts', 'status', 'VARCHAR(50)'),
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
      ensureColumn('partners', 'exit_date', 'DATE')
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
        ai_model: settings.aiModel || 'gemini-1.5-flash',
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

      const snake: any = {
        id: held.id,
        salon_id: validSalonId,
        branch_id: toBranchUUID(held.branchId) || held.branchId || null,
        client_id: held.client?.id || null,
        client_name: held.client?.name || held.clientSearch || 'عميل',
        client_phone: held.client?.phone || '',
        client_search: held.clientSearch || held.client?.name || '',
        cart: held.cart || [],
        items: held.cart || [],
        discount_type: held.discount?.type || 'fixed',
        discount_value: held.discount?.value || 0,
        advance_deduction: held.advanceDeduction || 0,
        is_remedy_invoice: !!held.isRemedyInvoice,
        remedy_reason: held.remedyReason || null,
        before_photo_url: held.beforePhotoUrl || null,
        after_photo_url: held.afterPhotoUrl || null,
        note: held.note || null,
        held_at: held.heldAt || new Date().toISOString(),
        queue_number: held.queueNumber || null,
        queue_ticket_id: held.queueTicketId || null,
        total: (held.cart || []).reduce((sum, c) => sum + ((c.item?.displayPrice || c.price || 0) * (c.quantity || 1)), 0)
      };

      const { error } = await client.from('held_invoices').upsert(snake, { onConflict: 'id' });
      if (error) {
        console.error('DB.saveHeldInvoice error:', error.message);
        return false;
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
      const snap: any = {
        id: validSalonId,
        code: s.code,
        name: s.name,
        salon_type: s.salonType || 'men',
        tax_number: s.taxNumber || '300000000000003',
        commercial_reg: s.commercialReg || '1010000000',
        phone: s.phone,
        email: s.email,
        owner_name: s.ownerName || s.name,
        owner_email: s.email,
        country: s.country || 'المملكة العربية السعودية',
        currency: s.currency || 'SAR',
        address: s.address || s.country,
        logo_url: s.logoUrl || null,
        is_active: s.isActive !== false,
        subscription_status: s.subscriptionStatus || 'trial',
        subscription_plan: s.subscriptionPlan || 'pro',
        subscription_start_date: toDateOrNull(s.subscriptionStartDate) || new Date().toISOString().split('T')[0],
        subscription_end_date: toDateOrNull(s.subscriptionEndDate) || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        trial_days: s.trialDays || 7,
        max_branches: s.maxBranches || 3,
        max_users: s.maxUsers || 10,
        evolution_instance_name: s.evolutionInstanceName ?? s.waInstantName ?? null,
        evolution_api_key: s.evolutionApiKey ?? s.waApiKey ?? null,
        evolution_api_url: s.evolutionApiUrl ?? null,
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
      return (data || []).map(toCamel);
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
            .select('id')
            .eq('salon_id', validSalonId)
            .eq('code', branchCode)
            .maybeSingle();
          if (existing?.id) {
            validBranchId = existing.id;
          }
        } catch {}
      }

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
        vat_rate: b.vatRate ?? 15,
        vat_enabled: b.vatEnabled !== false,
        tax_number: b.taxNumber || null,
        commercial_reg: b.commercialReg || null,
        is_main: b.isMain || false,
        is_active: b.isActive !== false,
        status: b.status || 'active',
        evolution_instance_name: b.evolutionInstanceName || null,
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
      const snap: any = {
        id: userUuid,
        salon_id: validSalonId,
        branch_id: validBranchId,
        salon_code: u.salonCode || 'SC-01',
        branch_code: u.branchCode || 'BR-01',
        username: cleanUsername,
        email: u.email || null,
        employee_id: u.employeeId || null,
        password_hash: u.password || u.passwordHash || '123456',
        name: u.name || cleanUsername,
        role: u.role || 'owner',
        custom_role_id: u.customRoleId || null,
        phone: u.phone || null,
        active: u.active !== false,
        screens: u.screens || ['*'],
        actions: u.actions || ['*'],
        avatar: u.avatar || null,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('users').upsert(snap, { onConflict: 'username' });
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
      return data ? toCamel(data) : null;
    } catch (e) { return null; }
  },

  async saveSettings(salonId: string, settings: any) {
    const client = sb();
    if (!client) return false;
    try {
      const validSalonId = toSalonUUID(salonId);
      const validBranchId = toBranchUUID(settings.branchId);
      const snap: any = {
        salon_id: validSalonId,
        branch_id: validBranchId,
        salon_name: settings.salonName || 'صالون سمارت كت',
        salon_type: settings.salonType || settings.salon_type || 'men',
        logo_url: settings.logoUrl || null,
        phone: settings.phone || '0500000000',
        address: settings.address || '',
        currency: settings.currency || 'SAR',
        country: settings.country || 'المملكة العربية السعودية',
        tax_number: settings.taxNumber || '300000000000003',
        commercial_reg: settings.commercialReg || '1010000000',
        vat_enabled: settings.vatEnabled ?? true,
        vat_rate: settings.vatRate ?? 15,
        zatca_enabled: settings.zatcaEnabled ?? false,
        zatca_settings: settings.zatcaSettings || null,
        eta_egypt_settings: settings.etaEgyptSettings || null,
        receipt_header_note: settings.receiptHeaderNote || '',
        receipt_footer_note: settings.receiptFooterNote || '',
        booking_notes: settings.bookingNotes || '',
        treasuries: settings.treasuries || [],
        expense_categories: settings.expenseCategories || [],
        printer_name: settings.printerName || 'طابعة الكاشير',
        paper_size: settings.paperSize || '80mm',
        print_automatically: settings.printAutomatically ?? false,
        thermal_printer_ip: settings.thermalPrinterIp || null,
        thermal_printer_port: settings.thermalPrinterPort ? Number(settings.thermalPrinterPort) : 9100,
        evolution_api_url: settings.evolutionApiUrl || null,
        evolution_api_key: settings.evolutionApiKey || settings.waApiKey || null,
        evolution_instance_name: settings.evolutionInstanceName || settings.waInstantName || null,
        wa_instant_name: settings.evolutionInstanceName || settings.waInstantName || null,
        wa_api_key: settings.evolutionApiKey || settings.waApiKey || null,
        evolution_branch_instances: settings.evolutionBranchInstances || {},
        supabase_url: settings.supabaseUrl || null,
        supabase_anon_key: settings.supabaseAnonKey || null,
        supabase_enabled: settings.supabaseEnabled ?? false,
        hr_settings: settings.hrSettings || null,
        booking_rules: settings.bookingRules || null,
        vip_settings: settings.vipSettings || null,
        tier_settings: settings.tierSettings || null,
        show_dashboard_analytics: settings.showDashboardAnalytics ?? true,
        show_employee_analytics: settings.showEmployeeAnalytics ?? true,
        ai_provider: settings.aiProvider || 'builtin',
        ai_api_key: settings.aiApiKey || null,
        ai_model: settings.aiModel || null,
        updated_at: new Date().toISOString()
      };
      // Check if existing record exists for this salon
      const { data: existing } = await client
        .from('app_settings')
        .select('id')
        .eq('salon_id', validSalonId)
        .limit(1)
        .maybeSingle();

      let error: any = null;
      if (existing && existing.id) {
        const res = await client.from('app_settings').update(snap).eq('id', existing.id);
        error = res.error;
      } else {
        const res = await client.from('app_settings').insert(snap);
        error = res.error;
      }
      if (error) { console.error('DB.saveSettings error:', error.message); return false; }
      
      // Keep salons table synchronized as well
      if (settings.salonType || settings.salonName || settings.phone) {
        const salonUpdate: any = { updated_at: new Date().toISOString() };
        if (settings.salonType) salonUpdate.salon_type = settings.salonType;
        if (settings.salonName) salonUpdate.name = settings.salonName;
        if (settings.phone) salonUpdate.phone = settings.phone;
        if (settings.address) salonUpdate.address = settings.address;
        if (settings.taxNumber) salonUpdate.tax_number = settings.taxNumber;
        if (settings.commercialReg) salonUpdate.commercial_reg = settings.commercialReg;
        await client.from('salons').update(salonUpdate).eq('id', validSalonId);
      }

      return true;
    } catch (e) { return false; }
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
        dob_day: c.dobDay || null,
        dob_month: c.dobMonth || null,
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

  // ---- الفواتير ----
  async fetchInvoices(salonId?: string) { return DB.fetchAll<any>('invoices', undefined, salonId); },
  async saveInvoice(inv: any, salonId?: string) {
    const client = sb(); if (!client || !inv) return null;
    const validSalonId = toSalonUUID(salonId || inv.salonId || getSalonId());
    const validBranchId = toBranchUUID(inv.branchId);
    try {
      const snap: any = {
        id: inv.id, salon_id: validSalonId, branch_id: validBranchId,
        branch_code: inv.branchCode || null,
        client_id: inv.clientId || null, client_name: inv.clientName, client_phone: inv.clientPhone || '',
        date: inv.date, subtotal: inv.subtotal ?? 0, discount: inv.discount ?? 0,
        discount_type: inv.discountType || 'fixed', vat: inv.vatAmount ?? 0,
        cashback_used: inv.cashbackUsed ?? 0,
        total: inv.total ?? 0, paid: inv.total ?? 0, remaining: 0,
        advance_deduction: inv.advanceDeduction ?? 0,
        payment_method: inv.paymentMethods?.[0]?.treasuryId || 'cash',
        treasury_id: inv.paymentMethods?.[0]?.treasuryId || 'main',
        items: inv.items || [], payment_methods: inv.paymentMethods || [],
        status: inv.status || 'completed',
        is_cancelled: inv.status === 'cancelled', cancel_reason: null, cancelled_at: null,
        is_remedy: inv.isRemedyInvoice || false, remedy_notes: inv.remedyReason || null,
        related_complaint_id: inv.relatedComplaintId || null,
        original_invoice_id: inv.originalInvoiceId || null,
        before_photo_url: inv.beforePhotoUrl || null, after_photo_url: inv.afterPhotoUrl || null,
        zatca_qr: inv.zatcaQr || null, zatca_hash: inv.zatcaHash || null,
        zatca_reporting_status: inv.zatcaReportingStatus || 'not_submitted',
        eta_submission_uuid: inv.etaSubmissionUuid || null, eta_status: inv.etaStatus || 'not_submitted',
        created_by: inv.createdBy || null
      };
      const { error } = await client.from('invoices').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveInvoice error:', error.message); return null; }
      return inv;
    } catch (e) { console.error('DB.saveInvoice exception:', e); return null; }
  },

  // ---- المعاملات المالية ----
  async fetchTransactions(salonId?: string) { return DB.fetchAll<any>('transactions', undefined, salonId); },
  async saveTransaction(t: any, salonId?: string) {
    const client = sb(); if (!client || !t) return null;
    const validSalonId = toSalonUUID(salonId || t.salonId || getSalonId());
    const validBranchId = toBranchUUID((t as any).branchId);
    try {
      const snap: any = {
        id: t.id, salon_id: validSalonId, branch_id: validBranchId,
        branch_code: (t as any).branchCode || null,
        date: t.date, type: t.type, amount: t.amount, category: t.category,
        expense_category: t.expenseCategory || null, description: t.description,
        treasury: t.treasury, invoice_id: (t as any).invoiceId || null,
        created_by: t.createdBy || null, user_id: t.userId || null,
        user_name: t.userName || null, shift_date: t.shiftDate || null
      };
      const { error } = await client.from('transactions').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveTransaction error:', error.message); return null; }
      return t;
    } catch (e) { console.error('DB.saveTransaction exception:', e); return null; }
  },
  async saveTransactions(list: any[], salonId?: string) {
    for (const t of list) await DB.saveTransaction(t, salonId);
    return true;
  },

  // ---- الحجوزات ----
  async fetchBookings(salonId?: string) { return DB.fetchAll<any>('bookings', undefined, salonId); },
  async saveBooking(b: any, salonId?: string) {
    const client = sb(); if (!client || !b) return null;
    const validSalonId = toSalonUUID(salonId || b.salonId || getSalonId());
    const validBranchId = toBranchUUID((b as any).branchId);
    try {
      const snap: any = {
        id: b.id, salon_id: validSalonId, branch_id: validBranchId,
        branch_code: (b as any).branchCode || null,
        client_id: b.clientId || null, client_name: b.clientName, client_phone: b.phone,
        customer_email: b.customerEmail || null, booking_code: b.bookingCode || null,
        source: b.source || 'pos', services: b.services || [],
        total_amount: b.totalAmount ?? 0,
        date: b.date, time: b.time, status: b.status || 'confirmed',
        queue_number: b.queueNumber || null,
        advance_payments: b.advancePayments || [], notes: b.notes || null
      };
      const { error } = await client.from('bookings').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveBooking error:', error.message); return null; }
      return b;
    } catch (e) { console.error('DB.saveBooking exception:', e); return null; }
  },

  // ---- الموظفون ----
  async fetchEmployees(salonId?: string) { 
    const list = await DB.fetchAll<any>('employees', undefined, salonId);
    return (list || []).map(emp => ({
      ...emp,
      commissionModel: emp.commissionModel || (emp.commissionRate === 0 ? 'none' : 'fixed_rate')
    }));
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
        base_salary: e.baseSalary ?? 0,
        fingerprint_code: e.fingerprintCode || null, 
        commission_rate: e.commissionRate !== undefined && e.commissionRate !== null ? Number(e.commissionRate) : 0,
        commission_model: dbCommissionModel,
        commission_tiers: e.commissionTiers || [],
        target: e.target ?? 5000, 
        target_type: e.targetType || 'monthly',
        available_vacations: e.availableVacations ?? 21,
        salary_type: e.salaryType || 'salary',
        allow_dual_commission: e.allowDualCommission || false,
        check_in_time: e.checkInTime || '09:00', 
        check_out_time: e.checkOutTime || '18:00',
        weekly_days_off: e.weeklyDaysOff || ['Friday'],
        is_active: e.isActive !== false, 
        is_blacklisted: e.isBlacklisted || false,
        blacklist_reason: e.blacklistReason || null,
        financial_records: e.financialRecords || [],
        leave_records: e.leaveRecords || [],
        salary_history: e.salaryHistory || [],
        shift_schedule_history: e.shiftScheduleHistory || [],
        permission_records: e.permissionRecords || [],
        end_of_service: e.endOfService || null,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('employees').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveEmployee error:', error.message); return null; }
      return e;
    } catch (e2) { console.error('DB.saveEmployee exception:', e2); return null; }
  },
  async saveEmployees(list: any[], salonId?: string) { for (const e of list) await DB.saveEmployee(e, salonId); return true; },

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
        discount_price: s.discountPrice ?? 0,
        employee_commission_percentage: s.employeeCommissionPercentage ?? 0,
        employee_commission_amount: s.employeeCommissionAmount ?? 0,
        referral_commission_type: s.referralCommissionType || 'percentage',
        referral_commission_amount: s.referralCommissionAmount ?? 0,
        cashback_percentage: s.cashbackPercentage ?? 0,
        client_referral_cashback_type: s.clientReferralCashbackType || 'percentage',
        client_referral_cashback_amount: s.clientReferralCashbackAmount ?? 0,
        duration_minutes: s.durationMinutes ?? 30, 
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

  // ---- رفع وحذف صور الخدمات في Supabase Storage (Bucket: services) ----
  async uploadServiceImage(fileOrBlob: File | Blob | string, serviceId: string, oldImageUrl?: string): Promise<string> {
    const client = sb();
    if (!client) {
      return typeof fileOrBlob === 'string' ? fileOrBlob : '';
    }

    try {
      await ensureStorageBucket('services');

      // 1. حذف الصورة القديمة للخدمة من الـ Bucket إن وجدت
      if (oldImageUrl) {
        await DB.deleteServiceImage(oldImageUrl);
      }

      let blob: Blob;
      let fileExt = 'webp';

      if (typeof fileOrBlob === 'string') {
        if (!fileOrBlob.startsWith('data:')) return fileOrBlob;
        blob = dataUrlToBlob(fileOrBlob);
        fileExt = fileOrBlob.includes('image/webp') ? 'webp' : 'jpg';
      } else {
        blob = fileOrBlob;
        if (fileOrBlob.type.includes('webp')) fileExt = 'webp';
        else if (fileOrBlob.type.includes('png')) fileExt = 'png';
        else fileExt = 'jpg';
      }

      // 2. رفع الصورة الجديدة باسم فريد
      const cleanId = (serviceId || 'srv').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `service_${cleanId}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error } = await client.storage.from('services').upload(filePath, blob, {
        contentType: blob.type || `image/${fileExt}`,
        cacheControl: '3600',
        upsert: true
      });

      if (error) {
        console.error('DB.uploadServiceImage storage error:', error.message);
        return typeof fileOrBlob === 'string' ? fileOrBlob : '';
      }

      // 3. الحصول على الرابط العام المباشر للصورة
      const { data: publicUrlData } = client.storage.from('services').getPublicUrl(filePath);
      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('DB.uploadServiceImage exception:', err);
      return typeof fileOrBlob === 'string' ? fileOrBlob : '';
    }
  },

  async deleteServiceImage(imageUrl?: string): Promise<boolean> {
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
        filePath = parts[parts.length - 1];
      }

      if (filePath && !filePath.startsWith('data:')) {
        const cleanPath = filePath.split('?')[0];
        const { error } = await client.storage.from('services').remove([cleanPath]);
        if (error) {
          console.warn('DB.deleteServiceImage warning:', error.message);
        }
        return true;
      }
      return true;
    } catch (e) {
      console.error('DB.deleteServiceImage exception:', e);
      return false;
    }
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
    const { error } = await client.from('products').upsert({
      id: p.id, salon_id: validSalonId, branch_id: validBranchId,
      category_id: p.categoryId || null, name: p.name,
      sell_price: p.sellPrice ?? 0, cost_price: p.costPrice ?? 0,
      reorder_limit: p.reorderLimit ?? 5, opening_stock: p.openingStock ?? 0,
      current_stock: p.currentStock ?? 0, commission: p.commission ?? 0,
      barcode: p.barcode || null, is_active: p.isActive !== false
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveProduct error:', error.message); return null; }
    return p;
  },
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
      // 1. Delete all transactions linked to this invoice from PostgreSQL DB
      await client.from('transactions').delete().eq('invoice_id', invoiceId);
      await client.from('transactions').delete().ilike('description', `%${invoiceId}%`);
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

  // ---- الورديات ومتابعة العهدة (Work Shifts & Custody) ----
  async fetchWorkShifts(salonId?: string, branchId?: string) {
    const client = sb();
    if (!client) return [];
    try {
      let q = client.from('work_shifts').select('*');
      const sId = salonId || getSalonId();
      if (sId) q = q.eq('salon_id', toSalonUUID(sId));
      if (branchId && branchId !== 'all') {
        const bId = toBranchUUID(branchId) || branchId;
        q = q.eq('branch_id', bId);
      }
      const { data, error } = await q.order('opened_at', { ascending: false });
      if (error) { console.error('DB.fetchWorkShifts:', error.message); return []; }
      return (data || []).map(toCamel);
    } catch (e) { return []; }
  },

  async getActiveWorkShift(salonId?: string, branchId?: string) {
    const client = sb();
    if (!client) return null;
    try {
      let q = client.from('work_shifts').select('*').eq('status', 'open');
      const sId = salonId || getSalonId();
      if (sId) q = q.eq('salon_id', toSalonUUID(sId));
      if (branchId && branchId !== 'all') {
        const bId = toBranchUUID(branchId) || branchId;
        q = q.eq('branch_id', bId);
      }
      const { data, error } = await q.order('opened_at', { ascending: false }).limit(1).maybeSingle();
      if (error) return null;
      return data ? toCamel(data) : null;
    } catch (e) { return null; }
  },

  async saveWorkShift(ws: any): Promise<boolean> {
    const client = sb();
    if (!client || !ws) return false;
    try {
      const validSalonId = toSalonUUID(ws.salonId || getSalonId());
      const validBranchId = ws.branchId ? (toBranchUUID(ws.branchId) || ws.branchId) : null;
      const snap: any = {
        id: ws.id,
        salon_id: validSalonId,
        branch_id: validBranchId,
        shift_date: ws.shiftDate,
        opened_at: ws.openedAt || new Date().toISOString(),
        closed_at: ws.closedAt || null,
        opened_by_user_id: ws.openedByUserId || null,
        opened_by_user_name: ws.openedByUserName || null,
        opened_by_role: ws.openedByRole || null,
        closed_by_user_id: ws.closedByUserId || null,
        closed_by_user_name: ws.closedByUserName || null,
        initial_cash: Number(ws.initialCash) || 0,
        expected_cash: ws.expectedCash !== undefined ? Number(ws.expectedCash) : null,
        actual_cash: ws.actualCash !== undefined ? Number(ws.actualCash) : null,
        cash_difference: ws.cashDifference !== undefined ? Number(ws.cashDifference) : null,
        total_sales: ws.totalSales !== undefined ? Number(ws.totalSales) : null,
        total_cash_sales: ws.totalCashSales !== undefined ? Number(ws.totalCashSales) : null,
        total_card_sales: ws.totalCardSales !== undefined ? Number(ws.totalCardSales) : null,
        total_expenses: ws.totalExpenses !== undefined ? Number(ws.totalExpenses) : null,
        status: ws.status || 'open',
        notes: ws.notes || null,
        created_at: ws.createdAt || new Date().toISOString()
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
        max_uses_total: pc.maxUsesTotal || null, uses_count: pc.usesCount ?? 0,
        is_active: pc.isActive !== false, notes: pc.notes || null,
        created_by: pc.createdBy || null, updated_at: new Date().toISOString()
      };
      const { error } = await client.from('promo_codes').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.savePromoCode error:', error.message); return null; }
      return pc;
    } catch (e) { console.error('DB.savePromoCode exception:', e); return null; }
  },
  async deletePromoCode(promoCodeId: string) {
    return DB.remove('promo_codes', promoCodeId);
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
        code: u.code, client_phone: u.clientPhone, client_name: u.clientName || null,
        invoice_id: u.invoiceId || null, discount_applied: u.discountApplied ?? 0,
        used_at: u.usedAt || new Date().toISOString()
      };
      const { error } = await client.from('promo_code_usages').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.savePromoCodeUsage error:', error.message); return null; }
      return u;
    } catch (e) { console.error('DB.savePromoCodeUsage exception:', e); return null; }
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
        invoice_id: t.invoiceId, client_name: t.clientName || null, employee_id: t.employeeId,
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
    return DB.fetchAll<any>('fingerprint_logs', undefined, salonId);
  },
  async saveFingerprintLog(fl: any) {
    const client = sb(); if (!client || !fl) return null;
    const validSalonId = toSalonUUID(fl.salonId || getSalonId());
    const validBranchId = toBranchUUID(fl.branchId);
    try {
      const snap: any = {
        id: fl.id, salon_id: validSalonId, branch_id: validBranchId,
        employee_id: fl.employeeId || null, employee_name: fl.employeeName || null,
        fingerprint_code: fl.fingerprintCode || (fl.employeeId ? `FP-${fl.employeeId.slice(0, 4)}` : '101'),
        timestamp: fl.timestamp,
        type: fl.type || 'check_in', device_ip: fl.deviceIp || null,
        status: fl.status || 'synced', notes: fl.notes || null
      };
      const { error } = await client.from('fingerprint_logs').upsert(snap, { onConflict: 'id' });
      if (error) { 
        console.error('DB.saveFingerprintLog error:', error.message); 
        throw error; 
      }
      return fl;
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
        planNameAr: 'باقة البداية',
        planNameEn: 'Starter Plan',
        descriptionAr: 'مثالية للصالونات الناشئة والصغيرة ذات الفريق المحدود',
        minEmployees: 2,
        maxEmployees: 5,
        priceEgp1m: 450,
        priceEgp3m: 1250,
        priceEgp6m: 2300,
        priceEgp12m: 4200,
        priceUsd1m: 15,
        priceUsd3m: 40,
        priceUsd6m: 75,
        priceUsd12m: 140,
        features: [
          'من 2 إلى 5 موظفين',
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
        planNameAr: 'باقة التوسع',
        planNameEn: 'Growth Plan',
        descriptionAr: 'الخيار الأكثر طلباً للصالونات المتنامية التي تحتاج ميزات احترافية متكاملة',
        minEmployees: 6,
        maxEmployees: 10,
        priceEgp1m: 750,
        priceEgp3m: 2100,
        priceEgp6m: 3900,
        priceEgp12m: 6900,
        priceUsd1m: 25,
        priceUsd3m: 70,
        priceUsd6m: 130,
        priceUsd12m: 230,
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
        planNameAr: 'باقة الأعمال',
        planNameEn: 'Enterprise Plan',
        descriptionAr: 'حل متكامل للمنشآت والمراكز الكبرى مع قدرات غير محدودة وتوسع كامل',
        minEmployees: 11,
        maxEmployees: 9999,
        priceEgp1m: 1250,
        priceEgp3m: 3500,
        priceEgp6m: 6500,
        priceEgp12m: 11500,
        priceUsd1m: 40,
        priceUsd3m: 110,
        priceUsd6m: 210,
        priceUsd12m: 380,
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
      await DB.saveSettings(validSalonId, {
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

  async resetSalonToTrialDB(salonId: string, trialDays: number = 7, plan: string = 'starter'): Promise<any> {
    const client = sb();
    const validSalonId = toSalonUUID(salonId);
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + trialDays * 86400000).toISOString().split('T')[0];

    const updates = {
      subscription_status: 'trial',
      subscription_plan: plan,
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
          plan_id: plan,
          status: 'trial',
          start_date: startDate,
          end_date: endDate,
          total_branches: 1,
          total_employees: 5,
          billing_cycle: 'trial',
          currency: 'SAR',
          paid_amount: 0,
          payment_method: 'free_trial',
          notes: `إعادة إلى الفترة التجريبية بواسطة المبرمج (${trialDays} أيام)`
        });
      } catch (e) {
        console.warn('DB update failed during reset to trial:', e);
      }
    }

    await DB.saveSettings(validSalonId, {
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

    await DB.saveSettings(validSalonId, {
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
    console.log('⚡ [Fast Startup] تحميل البيانات الأساسية للصالون:', validSalonId);
    
    // Fetch ONLY essential catalog needed for POS & basic operations concurrently
    const [categories, services, employees, clients, products] = await Promise.all([
      DB.fetchAll<any>('categories', undefined, validSalonId),
      DB.fetchAll<any>('services', undefined, validSalonId),
      DB.fetchAll<any>('employees', undefined, validSalonId),
      // Recent clients for instant POS lookup
      DB.fetchAll<any>('clients', undefined, validSalonId),
      DB.fetchAll<any>('products', undefined, validSalonId),
    ]);

    return {
      categories,
      services,
      employees,
      clients,
      products
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
        const [invoices, transactions, bookings] = await Promise.all([
          DB.fetchAll<any>('invoices', undefined, validSalonId),
          DB.fetchAll<any>('transactions', undefined, validSalonId),
          DB.fetchAll<any>('bookings', undefined, validSalonId)
        ]);
        return { invoices, transactions, bookings };
      }
      case 'hr':
      case 'employees': {
        const [fingerprintLogs, custodies, tips] = await Promise.all([
          DB.fetchAll<any>('fingerprint_logs', undefined, validSalonId),
          DB.fetchAll<any>('employee_custodies', undefined, validSalonId),
          DB.fetchAll<any>('tips', undefined, validSalonId)
        ]);
        return { fingerprintLogs, custodies, tips };
      }
      case 'warehouse':
      case 'suppliers':
      case 'purchases':
      case 'inventory': {
        const [suppliers, purchaseInvoices, supplierPayments, inventoryCounts, itemMovements] = await Promise.all([
          DB.fetchAll<any>('suppliers', undefined, validSalonId),
          DB.fetchAll<any>('purchase_invoices', undefined, validSalonId),
          DB.fetchAll<any>('supplier_payments', undefined, validSalonId),
          DB.fetchAll<any>('inventory_counts', undefined, validSalonId),
          DB.fetchAll<any>('item_movements', undefined, validSalonId)
        ]);
        return { suppliers, purchaseInvoices, supplierPayments, inventoryCounts, itemMovements };
      }
      case 'partners': {
        const [partners, partnerTransactions] = await Promise.all([
          DB.fetchAll<any>('partners', undefined, validSalonId),
          DB.fetchAll<any>('partner_transactions', undefined, validSalonId)
        ]);
        return { partners, partnerTransactions };
      }
      case 'promotions':
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
    console.log('⏳ جاري تحميل البيانات من Supabase للصالون:', validSalonId);
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

    console.log('✅ تم تحميل جميع بيانات الصالون من Supabase بنجاح');
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

// تحويل بيانات العميل من snake_case قاعدة البيانات إلى كيان Client في التطبيق
export function dbClientToApp(row: any) {
  return {
    id: row.id,
    salonId: row.salonId,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    dob: row.dob || '',
    loyaltyPoints: row.loyaltyPoints ?? 0,
    cashback: row.cashbackBalance ?? 0,
    tierLevel: row.tierLevel || 'standard',
    isVip: row.isVip || false,
    vipSince: row.vipSince || '',
    vipNotes: row.vipNotes || '',
    referredByPhone: row.referredByPhone || '',
    hasUsedReferralReward: row.hasUsedReferralReward || false,
    referralCount: row.referralCount ?? 0,
    referralTotalCashbackEarned: row.referralTotalCashbackEarned ?? 0,
    notes: row.notes || '',
    isBlacklisted: row.isBlacklisted || false,
    blacklistReason: row.blacklistReason || '',
    lastVisit: row.lastVisit || '',
    preferences: row.preferences || {},
    createdAt: row.createdAt || ''
  };
}

// تحويل بيانات الموظف من قاعدة البيانات إلى كيان Employee في التطبيق
export function dbEmployeeToApp(row: any) {
  return {
    id: row.id,
    salonId: row.salonId,
    branchId: row.branchId,
    name: row.name,
    email: row.email || '',
    avatarUrl: row.avatarUrl || '',
    publicBio: row.publicBio || '',
    hasOnlineAccount: row.hasOnlineAccount || false,
    userId: row.userId || '',
    role: row.role,
    baseSalary: row.baseSalary ?? 0,
    fingerprintCode: row.fingerprintCode || '',
    commissionRate: row.commissionRate ?? 0,
    commissionModel: row.commissionModel || 'fixed_rate',
    commissionTiers: row.commissionTiers || [],
    target: row.target ?? 5000,
    targetType: row.targetType || 'monthly',
    availableVacations: row.availableVacations ?? 21,
    salaryType: row.salaryType || 'salary',
    allowDualCommission: row.allowDualCommission || false,
    checkInTime: row.checkInTime || '09:00',
    checkOutTime: row.checkOutTime || '18:00',
    weeklyDaysOff: row.weeklyDaysOff || ['Friday'],
    isActive: row.isActive !== false,
    isBlacklisted: row.isBlacklisted || false,
    blacklistReason: row.blacklistReason || '',
    financialRecords: row.financialRecords || [],
    leaveRecords: row.leaveRecords || [],
    salaryHistory: row.salaryHistory || [],
    shiftScheduleHistory: row.shiftScheduleHistory || [],
    permissionRecords: row.permissionRecords || [],
    endOfService: row.endOfService || null
  };
}

// تحويل بيانات الخدمة من قاعدة البيانات إلى كيان ServiceItem في التطبيق
export function dbServiceToApp(row: any) {
  const price = Number(row.price) || 0;
  const rawDiscount = Number(row.discountPrice ?? row.discount_price);
  const validDiscount = (!isNaN(rawDiscount) && rawDiscount > 0 && rawDiscount < price) ? rawDiscount : undefined;

  return {
    id: row.id, 
    salonId: row.salonId, 
    branchId: row.branchId,
    categoryId: row.categoryId || '',
    name: row.name, 
    price: price, 
    discountPrice: validDiscount,
    employeeCommissionPercentage: row.employeeCommissionPercentage ?? 0,
    employeeCommissionAmount: row.employeeCommissionAmount ?? 0,
    referralCommissionType: row.referralCommissionType || 'percentage',
    referralCommissionAmount: row.referralCommissionAmount ?? 0,
    cashbackPercentage: row.cashbackPercentage ?? 0,
    clientReferralCashbackType: row.clientReferralCashbackType || 'percentage',
    clientReferralCashbackAmount: row.clientReferralCashbackAmount ?? 0,
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
    role: c.role || 'cashier',
    customRoleId: c.customRoleId,
    active: c.active !== false,
    screens: Array.isArray(c.screens) ? c.screens : ['*'],
    actions: Array.isArray(c.actions) ? c.actions : ['*'],
    avatar: c.avatar
  };
}

