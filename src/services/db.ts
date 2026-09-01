import { SupabaseService } from './supabase';

// ============================================================
// 🗄️ SmartCut DB Service — طبقة البيانات الموحدة
// تحوّل بين camelCase (TypeScript) وsnake_case (PostgreSQL)
// ============================================================

const sb = () => SupabaseService.getClient();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toSalonUUID(id?: string | null): string {
  if (id && UUID_REGEX.test(id)) return id;
  try {
    const s = localStorage.getItem('smartcut_app_settings');
    const parsed = s ? JSON.parse(s).salonId : null;
    if (parsed && UUID_REGEX.test(parsed)) return parsed;
    const salons = JSON.parse(localStorage.getItem('smartcut_salons') || '[]');
    if (salons.length > 0 && salons[0].id && UUID_REGEX.test(salons[0].id)) return salons[0].id;
  } catch (e) {}
  return id || '';
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
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
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
    const s = localStorage.getItem('smartcut_app_settings');
    const parsed = s ? JSON.parse(s).salonId : null;
    return toSalonUUID(parsed);
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
      ensureColumn('app_settings', 'overtime_settings', 'JSONB'),
      ensureColumn('app_settings', 'attendance_settings', 'JSONB'),
      ensureColumn('app_settings', 'commission_settings', 'JSONB'),
      ensureColumn('custom_roles', 'screens', 'JSONB'),
      ensureColumn('custom_roles', 'actions', 'JSONB'),
      ensureColumn('custom_roles', 'is_system', 'BOOLEAN'),
      ensureColumn('purchase_invoices', 'paid_amount', 'NUMERIC(12,2)'),
      ensureColumn('purchase_invoices', 'remaining_amount', 'NUMERIC(12,2)')
    ]);
  } catch { /* Silent fail */ }
}

// تشغيل الفحص الاستباقي تلقائياً عند تحميل الخدمة
setTimeout(() => { ensureCoreSchema(); }, 1000);

// ============================================================
// Generic CRUD
// ============================================================
export const DB = {

  // فحص وإنشاء عمود يدوياً
  async ensureColumn(table: string, column: string, type: string = 'TEXT'): Promise<boolean> {
    return ensureColumn(table, column, type);
  },

  // --- جلب جميع سجلات جدول مع استعادة الحقول المحفوظة محلياً إن وجدت ----
  async fetchAll<T>(table: string, extraFilters?: Record<string, string>, overrideSalonId?: string): Promise<T[]> {
    const client = sb();
    if (!client) return [];
    try {
      const salonId = overrideSalonId || getSalonId();
      let q = client.from(table).select('*');
      if (salonId && table !== 'platform_settings' && table !== 'arab_countries' && table !== 'salons') {
        q = q.eq('salon_id', toSalonUUID(salonId));
      }
      if (extraFilters) {
        Object.entries(extraFilters).forEach(([k, v]) => { q = q.eq(k, v); });
      }
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) { console.error(`DB.fetchAll[${table}]:`, error.message); return []; }
      
      return (data || []).map(row => {
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
          await this.upsert<T>(table, rec);
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
      const { data, error } = await client.from('platform_settings').select('*').limit(1).single();
      if (error && error.code !== 'PGRST116') { console.error('DB.fetchPlatformSettings:', error.message); }
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
      const validBranchId = toBranchUUID(b.id) || b.id;
      const validSalonId = toSalonUUID(b.salonId);
      const snap: any = {
        id: validBranchId,
        salon_id: validSalonId,
        salon_code: b.salonCode || 'SC-01',
        code: b.code || 'BR-01',
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
      if (error) { console.error('DB.saveBranch error:', error.message); return false; }
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
      const snap: any = {
        id: u.id && u.id.includes('-') && u.id.length === 36 ? u.id : undefined,
        salon_id: validSalonId,
        branch_id: validBranchId,
        salon_code: u.salonCode || 'SC-01',
        branch_code: u.branchCode || 'BR-01',
        username: cleanUsername,
        email: u.email || null,
        employee_id: u.employeeId || null,
        password_hash: u.password || u.passwordHash || '123456',
        name: u.name || cleanUsername,
        role: u.role || 'admin',
        custom_role_id: u.customRoleId || null,
        phone: u.phone || null,
        active: u.active !== false,
        screens: u.screens || ['*'],
        actions: u.actions || ['*'],
        avatar: u.avatar || null,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('users').upsert(snap, { onConflict: 'username' });
      if (error) { console.error('DB.saveUser error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.saveUser exception:', e); return false; }
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
      const { data, error } = await client.from('app_settings').select('*').eq('salon_id', validSalonId).limit(1).single();
      if (error && error.code !== 'PGRST116') { console.error('DB.fetchSettings:', error.message); return null; }
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
      const { error } = await client.from('app_settings').upsert(snap, { onConflict: 'salon_id' });
      if (error) { console.error('DB.saveSettings:', error.message); return false; }
      return true;
    } catch (e) { return false; }
  },

  // ---- العملاء (Shared Across all Branches of the Same Salon) ----
  async fetchClients() { return DB.fetchAll<any>('clients'); },
  
  async saveClient(c: any) {
    const client = sb();
    if (!client || !c) return null;
    const validSalonId = toSalonUUID(c.salonId || getSalonId());
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

  async saveClients(list: any[]) {
    if (!list || !list.length) return true;
    for (const c of list) {
      await this.saveClient(c);
    }
    return true;
  },

  // ---- الفواتير ----
  async fetchInvoices() { return DB.fetchAll<any>('invoices'); },
  async saveInvoice(inv: any) {
    const client = sb(); if (!client || !inv) return null;
    const validSalonId = toSalonUUID(inv.salonId || getSalonId());
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
  async fetchTransactions() { return DB.fetchAll<any>('transactions'); },
  async saveTransaction(t: any) {
    const client = sb(); if (!client || !t) return null;
    const validSalonId = toSalonUUID(t.salonId || getSalonId());
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
  async saveTransactions(list: any[]) {
    for (const t of list) await DB.saveTransaction(t);
    return true;
  },

  // ---- الحجوزات ----
  async fetchBookings() { return DB.fetchAll<any>('bookings'); },
  async saveBooking(b: any) {
    const client = sb(); if (!client || !b) return null;
    const validSalonId = toSalonUUID(b.salonId || getSalonId());
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
        advance_payments: b.advancePayments || [], notes: b.notes || null
      };
      const { error } = await client.from('bookings').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveBooking error:', error.message); return null; }
      return b;
    } catch (e) { console.error('DB.saveBooking exception:', e); return null; }
  },

  // ---- الموظفون ----
  async fetchEmployees() { return DB.fetchAll<any>('employees'); },
  async saveEmployee(e: any) {
    const client = sb(); if (!client || !e) return null;
    const validSalonId = toSalonUUID(e.salonId || getSalonId());
    const validBranchId = toBranchUUID(e.branchId);
    try {
      const snap: any = {
        id: e.id, salon_id: validSalonId, branch_id: validBranchId,
        salon_code: e.salonCode || null, branch_code: e.branchCode || null,
        name: e.name, email: e.email || null, avatar_url: e.avatarUrl || null,
        public_bio: e.publicBio || null, has_online_account: e.hasOnlineAccount || false,
        user_id: e.userId || null, role: e.role, base_salary: e.baseSalary ?? 0,
        fingerprint_code: e.fingerprintCode || null, commission_rate: e.commissionRate ?? 0,
        commission_model: e.commissionModel || 'fixed_rate',
        commission_tiers: e.commissionTiers || [],
        target: e.target ?? 5000, target_type: e.targetType || 'monthly',
        available_vacations: e.availableVacations ?? 21,
        salary_type: e.salaryType || 'salary',
        allow_dual_commission: e.allowDualCommission || false,
        check_in_time: e.checkInTime || '09:00', check_out_time: e.checkOutTime || '18:00',
        weekly_days_off: e.weeklyDaysOff || ['Friday'],
        is_active: e.isActive !== false, is_blacklisted: e.isBlacklisted || false,
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
  async saveEmployees(list: any[]) { for (const e of list) await DB.saveEmployee(e); return true; },

  // ---- الخدمات ----
  async fetchServices() { return DB.fetchAll<any>('services'); },
  async saveService(s: any) {
    const client = sb(); if (!client || !s) return null;
    const validSalonId = toSalonUUID(s.salonId || getSalonId());
    try {
      const snap: any = {
        id: s.id, salon_id: validSalonId, category_id: s.categoryId || null, name: s.name,
        price: s.price ?? 0, discount_price: s.discountPrice ?? 0,
        employee_commission_percentage: s.employeeCommissionPercentage ?? 0,
        employee_commission_amount: s.employeeCommissionAmount ?? 0,
        referral_commission_type: s.referralCommissionType || 'percentage',
        referral_commission_amount: s.referralCommissionAmount ?? 0,
        cashback_percentage: s.cashbackPercentage ?? 0,
        client_referral_cashback_type: s.clientReferralCashbackType || 'percentage',
        client_referral_cashback_amount: s.clientReferralCashbackAmount ?? 0,
        duration_minutes: s.durationMinutes ?? 30, barcode: s.barcode || null,
        is_active: s.isActive !== false, type: s.type || 'service'
      };
      const { error } = await client.from('services').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveService error:', error.message); return null; }
      return s;
    } catch (e) { console.error('DB.saveService exception:', e); return null; }
  },
  async saveServices(list: any[]) { for (const s of list) await DB.saveService(s); return true; },

  // ---- التصنيفات ----
  async fetchCategories() { return DB.fetchAll<any>('categories'); },
  async saveCategory(c: any) {
    const client = sb(); if (!client || !c) return null;
    const validSalonId = toSalonUUID(c.salonId || getSalonId());
    const { error } = await client.from('categories').upsert(
      { id: c.id, salon_id: validSalonId, name: c.name, icon: c.icon || 'Scissors', type: c.type || 'service' },
      { onConflict: 'id' }
    );
    if (error) console.error('DB.saveCategory error:', error.message);
    return error ? null : c;
  },
  async saveCategories(list: any[]) { for (const c of list) await DB.saveCategory(c); return true; },

  // ---- المنتجات ----
  async fetchProducts() { return DB.fetchAll<any>('products'); },
  async saveProduct(p: any) {
    const client = sb(); if (!client || !p) return null;
    const validSalonId = toSalonUUID(p.salonId || getSalonId());
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
  async saveProducts(list: any[]) { for (const p of list) await DB.saveProduct(p); return true; },

  // ---- الموردون ----
  async fetchSuppliers() { return DB.fetchAll<any>('suppliers'); },
  async saveSupplier(s: any) {
    const client = sb(); if (!client || !s) return null;
    const validSalonId = toSalonUUID(s.salonId || getSalonId());
    const { error } = await client.from('suppliers').upsert({
      id: s.id, salon_id: validSalonId, name: s.name, phone: s.phone,
      email: s.email || null, address: s.address || null, current_balance: s.currentBalance ?? 0
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveSupplier error:', error.message); return null; }
    return s;
  },

  // ---- فواتير الشراء ----
  async fetchPurchaseInvoices() { return DB.fetchAll<any>('purchase_invoices'); },
  async savePurchaseInvoice(p: any) {
    const client = sb(); if (!client || !p) return null;
    const validSalonId = toSalonUUID(p.salonId || getSalonId());
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
  async fetchSupplierPayments() { return DB.fetchAll<any>('supplier_payments'); },
  async saveSupplierPayment(sp: any) {
    const client = sb(); if (!client || !sp) return null;
    const validSalonId = toSalonUUID(sp.salonId || getSalonId());
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
  async fetchInventoryCounts() { return DB.fetchAll<any>('inventory_counts'); },
  async saveInventoryCount(ic: any) {
    const client = sb(); if (!client || !ic) return null;
    const validSalonId = toSalonUUID(ic.salonId || getSalonId());
    const validBranchId = toBranchUUID(ic.branchId);
    const { error } = await client.from('inventory_counts').upsert({
      id: ic.id, salon_id: validSalonId, branch_id: validBranchId,
      date: ic.date, notes: ic.notes || null, items: ic.items || []
    }, { onConflict: 'id' });
    if (error) { console.error('DB.saveInventoryCount error:', error.message); return null; }
    return ic;
  },

  // ---- حركات المخزون ----
  async fetchItemMovements() { return DB.fetchAll<any>('item_movements'); },
  async saveItemMovement(im: any) {
    const client = sb(); if (!client || !im) return null;
    const validSalonId = toSalonUUID(im.salonId || getSalonId());
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
  async fetchComplaints() { return DB.fetchAll<any>('customer_complaints'); },
  async saveComplaint(c: any) {
    const client = sb(); if (!client) return null;
    const salonId = getSalonId();
    const { error } = await client.from('customer_complaints').upsert({
      id: c.id, salon_id: salonId, branch_id: c.branchId || null,
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

  // ---- حذف فاتورة (خاص بالأدمن) ----
  async deleteInvoice(invoiceId: string) {
    const client = sb();
    if (!client) return false;
    try {
      const { error } = await client.from('invoices').delete().eq('id', invoiceId);
      if (error) { console.error('DB.deleteInvoice error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.deleteInvoice exception:', e); return false; }
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
        id: p.id, salon_id: validSalonId, name: p.name,
        phone: p.phone, id_number: p.idNumber || null,
        capital_share: p.capitalShare ?? 0, share_percentage: p.sharePercentage ?? 0,
        join_date: toDateOrNull(p.joinDate) || new Date().toISOString().split('T')[0],
        notes: p.notes || null, is_active: p.isActive !== false,
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
        id: pt.id, salon_id: validSalonId, partner_id: pt.partnerId,
        partner_name: pt.partnerName, type: pt.type, amount: pt.amount ?? 0,
        date: pt.date, treasury_id: pt.treasuryId, description: pt.description,
        created_by: pt.createdBy || null
      };
      const { error } = await client.from('partner_transactions').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.savePartnerTransaction error:', error.message); return null; }
      return pt;
    } catch (e) { console.error('DB.savePartnerTransaction exception:', e); return null; }
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
        fingerprint_code: fl.fingerprintCode, timestamp: fl.timestamp,
        type: fl.type || 'check_in', device_ip: fl.deviceIp || null,
        status: fl.status || 'synced', notes: fl.notes || null
      };
      const { error } = await client.from('fingerprint_logs').upsert(snap, { onConflict: 'id' });
      if (error) { console.error('DB.saveFingerprintLog error:', error.message); return null; }
      return fl;
    } catch (e) { console.error('DB.saveFingerprintLog exception:', e); return null; }
  },
  async deleteFingerprintLog(id: string) {
    const client = sb(); if (!client || !id) return false;
    try {
      const { error } = await client.from('fingerprint_logs').delete().eq('id', id);
      if (error) { console.error('DB.deleteFingerprintLog error:', error.message); return false; }
      return true;
    } catch (e) { console.error('DB.deleteFingerprintLog exception:', e); return false; }
  },


  // ============================================================
  // تحميل كل بيانات الصالون دفعة واحدة عند بدء التشغيل
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
    isActive: row.isActive !== false, 
    type: row.type || 'service'
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
    password: c.password || c.passwordHash || row.password_hash || '123456',
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

