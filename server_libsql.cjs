const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@libsql/client');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const cloudConfig = require('./cloudConfig.cjs');
require('dotenv').config();
let licenseHelper;
try {
  licenseHelper = require('./license.cjs');
} catch (e) {
  console.warn('⚠️ license.cjs could not be loaded:', e.message);
}

// Cryptographic Seal for Platform Settings Protection
const PLATFORM_HMAC_SECRET = process.env.PLATFORM_HMAC_SECRET || 'SmartCut_TamerMostafa_Secret_#2026';
function computePlatformSignature(row) {
  if (!row) return '';
  const payload = [
    row.id || '',
    row.platform_name || '',
    row.platform_phone || '',
    row.platform_email || '',
    row.master_programmer_key || ''
  ].join(':::');
  return crypto.createHmac('sha256', PLATFORM_HMAC_SECRET).update(payload).digest('hex');
}

const app = express();
const httpServer = http.createServer(app);

const PORT = parseInt(process.env.PORT || process.env.MSSQL_API_PORT || '3001', 10);
const HOST = '0.0.0.0';

// ==============================================================================
// 1. CORS & Middleware
// ==============================================================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'apikey', 'prefer']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Uploads directory (ASAR safe)
let UPLOADS_DIR = process.env.SMARTCUT_UPLOADS_DIR;
if (!UPLOADS_DIR) {
  if (__dirname.includes('app.asar')) {
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local');
    UPLOADS_DIR = path.join(appData, 'smartcut-pos', 'uploads');
  } else {
    UPLOADS_DIR = path.join(__dirname, 'uploads');
  }
}
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Warning] Could not initialize uploads directory:', e.message);
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Backups directory (ASAR safe)
let BACKUPS_DIR = process.env.SMARTCUT_BACKUPS_DIR;
if (!BACKUPS_DIR) {
  if (__dirname.includes('app.asar')) {
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local');
    BACKUPS_DIR = path.join(appData, 'smartcut-pos', 'backups');
  } else {
    BACKUPS_DIR = path.join(__dirname, 'backups');
  }
}
try {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Warning] Could not initialize backups directory:', e.message);
}

// ==============================================================================
// 2. WebSockets (Socket.io) Real-time Engine
// ==============================================================================
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 15000
});

io.on('connection', (socket) => {
  console.log(`📡 [WebSocket] Client connected: ${socket.id} (IP: ${socket.handshake.address})`);

  socket.emit('connected', {
    status: 'online',
    serverTime: new Date().toISOString(),
    socketId: socket.id
  });

  socket.on('subscribe_table', (table) => {
    socket.join(`table:${table}`);
  });

  socket.on('unsubscribe_table', (table) => {
    socket.leave(`table:${table}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 [WebSocket] Client disconnected: ${socket.id} (${reason})`);
  });
});

function broadcastDbChange(change) {
  const payload = {
    ...change,
    timestamp: Date.now()
  };
  // Broadcast to all clients
  io.emit('db_change', payload);
  if (change.table) {
    io.to(`table:${change.table}`).emit('table_change', payload);
    io.emit(`table:${change.table}`, payload);
  }
}

// ==============================================================================
// 3. libSQL Client Configuration & Turso Distributed Cloud Sync Engine
// ==============================================================================
let dbClient = null;
let isReplicaMode = false;
let syncTimer = null;
let isSyncInProgress = false;

function getDbUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    const raw = process.env.DATABASE_URL.trim();
    if (raw.startsWith('file:') && !raw.includes('/') && !raw.includes('\\')) {
      const fileName = raw.replace('file:', '');
      return `file:${path.resolve(__dirname, fileName)}`;
    }
    return raw;
  }
  let baseDir = __dirname;
  if (__dirname.includes('app.asar')) {
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local');
    baseDir = path.join(appData, 'smartcut-pos');
  }
  const dbPath = path.join(baseDir, 'smartcut.db');
  return `file:${dbPath}`;
}

/**
 * دالة تهيئة اتصال libSQL الديناميكية
 * تعمل محلياً 100% بدون إنترنت (Offline POS Mode)
 * وتتحول تلقائياً إلى عقدة موزعة متزامنة (Embedded Replica) فور توفر بيانات Turso
 */
function getDbClient(forceReload = false) {
  if (dbClient && !forceReload) {
    return dbClient;
  }

  if (dbClient && forceReload) {
    try {
      if (typeof dbClient.close === 'function') dbClient.close();
    } catch (e) {}
    dbClient = null;
  }

  const localUrl = getDbUrl();
  const cfg = cloudConfig.getCloudConfig();
  const hasTursoCreds = Boolean(
    cfg.turso_url && 
    typeof cfg.turso_url === 'string' && 
    cfg.turso_url.trim().length > 0 &&
    cfg.turso_auth_token && 
    typeof cfg.turso_auth_token === 'string' && 
    cfg.turso_auth_token.trim().length > 0
  );

  if (hasTursoCreds) {
    const cleanSyncUrl = cfg.turso_url.trim();
    const cleanToken = cfg.turso_auth_token.trim();
    console.log(`🌐 [Turso Distributed Architecture] Initializing EMBEDDED REPLICA Client:`);
    console.log(`   📂 Local Embedded Storage Node: ${localUrl}`);
    console.log(`   ☁️ Remote Turso Cloud Sync URL:  ${cleanSyncUrl}`);

    try {
      dbClient = createClient({
        url: localUrl,
        syncUrl: cleanSyncUrl,
        authToken: cleanToken
      });
      isReplicaMode = true;
      console.log(`✅ [Turso Distributed DB] Embedded Replica Client initialized successfully.`);
      startBackgroundSyncScheduler(cfg.sync_interval || '5m');
    } catch (initErr) {
      console.error(`❌ [Turso Init Error] Falling back to 100% Offline Local POS:`, initErr.message);
      dbClient = createClient({ url: localUrl });
      isReplicaMode = false;
      stopBackgroundSyncScheduler();
    }
  } else {
    console.log(`🔌 [libSQL Engine] Initializing 100% OFFLINE Local POS Client:`);
    console.log(`   📂 Local Storage: ${localUrl}`);
    dbClient = createClient({
      url: localUrl
    });
    isReplicaMode = false;
    stopBackgroundSyncScheduler();
    console.log(`✅ [libSQL Engine] Offline POS Database Client initialized successfully.`);
  }

  return dbClient;
}

/**
 * محرك المزامنة السحابية الخلفية مع Turso
 * يبث إشعار WebSockets لكافة الشاشات المحلية فور اكتمال المزامنة بنجاح
 */
async function executeCloudSync(trigger = 'scheduled') {
  if (!isReplicaMode || !dbClient) {
    return { success: false, reason: 'not_in_replica_mode' };
  }
  if (isSyncInProgress) {
    console.log(`⏳ [Turso Sync Engine] A sync is already running. Skipping (${trigger}).`);
    return { success: false, reason: 'sync_already_in_progress' };
  }

  isSyncInProgress = true;
  try {
    console.log(`☁️ [Turso Sync Engine] Syncing local replica with Turso Cloud (${trigger})...`);
    if (typeof dbClient.sync === 'function') {
      await dbClient.sync();
    } else {
      console.warn('⚠️ [Turso Sync Engine] dbClient.sync is not a function on this client instance.');
    }

    const nowIso = new Date().toISOString();
    console.log(`✨ [Turso Sync Engine] Bidirectional sync completed successfully at ${nowIso}!`);
    cloudConfig.updateSyncStatus('connected');

    // بث إشعار WebSockets اللحظي لجميع شاشات وأجهزة النظام
    const syncPayload = {
      event: 'cloud-sync-complete',
      timestamp: nowIso,
      trigger,
      success: true
    };
    io.emit('cloud-sync-complete', syncPayload);
    io.emit('db_change', {
      table: '*',
      action: 'sync',
      timestamp: Date.now(),
      source: 'turso_cloud'
    });

    return { success: true, timestamp: nowIso };
  } catch (syncErr) {
    const errorMsg = syncErr?.message || String(syncErr);
    // التعامل مع انقطاع الإنترنت بهدوء تام دون التأثير على عمل نقطة البيع
    console.warn(`⚠️ [Turso Sync Engine] Notice (${trigger} - network/offline): ${errorMsg}`);
    cloudConfig.updateSyncStatus('error', errorMsg);
    return { success: false, error: errorMsg };
  } finally {
    isSyncInProgress = false;
  }
}

function startBackgroundSyncScheduler(intervalSetting = '5m') {
  stopBackgroundSyncScheduler();
  if (!isReplicaMode || intervalSetting === 'manual') {
    console.log(`ℹ️ [Turso Scheduler] Background sync is set to: [${intervalSetting}] (no recurring timer)`);
    return;
  }

  let ms = 5 * 60 * 1000; // الافتراضي 5 دقائق
  if (intervalSetting === '1m') ms = 1 * 60 * 1000;
  else if (intervalSetting === '5m') ms = 5 * 60 * 1000;
  else if (intervalSetting === '15m') ms = 15 * 60 * 1000;

  console.log(`⏰ [Turso Scheduler] Scheduled background sync every ${intervalSetting} (${ms / 1000}s)`);

  // مزامنة أولية بعد 3 ثوانٍ من استقرار السيرفر
  setTimeout(() => {
    executeCloudSync('startup').catch(() => {});
  }, 3000);

  syncTimer = setInterval(() => {
    executeCloudSync('scheduled').catch(() => {});
  }, ms);
}

function stopBackgroundSyncScheduler() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('⏹️ [Turso Scheduler] Background sync timer stopped.');
  }
}

// Helper: sanitize SQLite identifiers (table/column names)
const IDENTIFIER_REGEX = /^[a-zA-Z0-9_]+$/;
function sanitizeIdentifier(name) {
  if (!name || typeof name !== 'string' || !IDENTIFIER_REGEX.test(name.trim())) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return `"${name.trim()}"`;
}

// Table schema cache for dynamic self-healing migrations
const tableColumnsCache = new Map();

async function getTableColumns(db, tableName) {
  const cacheKey = String(tableName).toLowerCase();
  if (tableColumnsCache.has(cacheKey)) {
    return tableColumnsCache.get(cacheKey);
  }
  try {
    const res = await db.execute(`PRAGMA table_info(${sanitizeIdentifier(tableName)});`);
    const cols = new Set((res.rows || []).map(r => String(r.name).toLowerCase()));
    tableColumnsCache.set(cacheKey, cols);
    return cols;
  } catch (e) {
    return new Set();
  }
}

async function ensureTableExists(db, tableName, idCol = 'id') {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS ${sanitizeIdentifier(tableName)} (${sanitizeIdentifier(idCol)} TEXT PRIMARY KEY);`);
  } catch (e) {}
}

async function ensureColumnsExist(db, tableName, keys) {
  const existingCols = await getTableColumns(db, tableName);
  for (const k of keys) {
    const lowerK = String(k).toLowerCase();
    if (!existingCols.has(lowerK) && IDENTIFIER_REGEX.test(k)) {
      try {
        await db.execute(`ALTER TABLE ${sanitizeIdentifier(tableName)} ADD COLUMN ${sanitizeIdentifier(k)} TEXT;`);
        existingCols.add(lowerK);
        console.log(`🛠️ [Auto-Schema] Dynamically added missing column '${k}' to table '${tableName}'`);
      } catch (alterErr) {
        existingCols.add(lowerK);
      }
    }
  }
}

// Helper: prepare SQLite parameters
function prepareSqlParam(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return val;
}

// Helper: parse JSON columns on output
function formatOutputRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
      try {
        out[k] = JSON.parse(v);
        continue;
      } catch {}
    }
    // Normalize boolean flag columns that SQLite or libSQL may return as '0.0' or '1.0'
    if (k.endsWith('_enabled') || k.startsWith('is_') || k === 'print_automatically') {
      if (v === '0.0' || v === '0' || v === 0 || v === false || v === 'false') {
        out[k] = 0;
        continue;
      } else if (v === '1.0' || v === '1' || v === 1 || v === true || v === 'true') {
        out[k] = 1;
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

// ==============================================================================
// 4. Schema Initialization & Self-Healing Migration (All Tables in libSQL)
// ==============================================================================
async function ensureDatabaseSchema() {
  const db = getDbClient();
  console.log('🔄 [libSQL] Initializing tables and schema...');

  const schemaStatements = [
    // 1. Salons
    `CREATE TABLE IF NOT EXISTS salons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      salon_code TEXT,
      phone TEXT,
      email TEXT,
      commercial_record TEXT,
      tax_number TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      logo_url TEXT,
      currency TEXT DEFAULT 'SAR',
      is_active INTEGER DEFAULT 1,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 2. Branches
    `CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      address TEXT,
      phone TEXT,
      is_main INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 3. Users
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      salon_id TEXT,
      branch_id TEXT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      username TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'cashier',
      screens TEXT DEFAULT '[]',
      actions TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 4. Categories
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 5. Services
    `CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      category_id TEXT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      discount_price REAL DEFAULT 0,
      duration_minutes INTEGER DEFAULT 30,
      description TEXT,
      image_url TEXT,
      barcode TEXT,
      type TEXT DEFAULT 'service',
      employee_commission_percentage REAL DEFAULT 0,
      employee_commission_amount REAL DEFAULT 0,
      commissionable_amount REAL DEFAULT 0,
      is_target_exempt INTEGER DEFAULT 0,
      referral_commission_type TEXT DEFAULT 'percentage',
      referral_commission_amount REAL DEFAULT 0,
      cashback_percentage REAL DEFAULT 0,
      client_referral_cashback_type TEXT DEFAULT 'percentage',
      client_referral_cashback_amount REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 6. Products
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      name TEXT NOT NULL,
      barcode TEXT,
      cost_price REAL DEFAULT 0,
      sell_price REAL DEFAULT 0,
      stock_quantity REAL DEFAULT 0,
      opening_stock REAL DEFAULT 0,
      reorder_limit INTEGER DEFAULT 5,
      commission REAL DEFAULT 0,
      unit TEXT DEFAULT 'قطعة',
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 7. Employees
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      branch_code TEXT,
      salon_code TEXT,
      user_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      role TEXT DEFAULT 'barber',
      base_salary REAL DEFAULT 0,
      salary_type TEXT DEFAULT 'salary',
      target REAL DEFAULT 5000,
      target_type TEXT DEFAULT 'monthly',
      daily_target_amount REAL DEFAULT 0,
      daily_target_method TEXT DEFAULT 'excess_only',
      monthly_target_amount REAL DEFAULT 5000,
      monthly_target_method TEXT DEFAULT 'deduct_salary',
      target_commission_rate REAL DEFAULT 0,
      check_in_time TEXT DEFAULT '09:00',
      check_out_time TEXT DEFAULT '18:00',
      weekly_days_off TEXT DEFAULT '["Friday"]',
      has_online_account INTEGER DEFAULT 0,
      public_bio TEXT,
      commission_model TEXT DEFAULT 'fixed_rate',
      commission_tiers TEXT DEFAULT '[]',
      available_vacations INTEGER DEFAULT 21,
      allow_dual_commission INTEGER DEFAULT 0,
      financial_records TEXT DEFAULT '[]',
      leave_records TEXT DEFAULT '[]',
      salary_history TEXT DEFAULT '[]',
      shift_schedule_history TEXT DEFAULT '[]',
      permission_records TEXT DEFAULT '[]',
      end_of_service TEXT,
      blacklist_reason TEXT,
      is_blacklisted INTEGER DEFAULT 0,
      avatar_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 8. Clients
    `CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      total_spend REAL DEFAULT 0,
      visits_count INTEGER DEFAULT 0,
      cashback_balance REAL DEFAULT 0,
      dob TEXT,
      dob_day INTEGER,
      dob_month INTEGER,
      tier_level TEXT DEFAULT 'standard',
      vip_since TEXT,
      vip_notes TEXT,
      referred_by_phone TEXT,
      has_used_referral_reward INTEGER DEFAULT 0,
      referral_count INTEGER DEFAULT 0,
      referral_total_cashback_earned REAL DEFAULT 0,
      is_blacklisted INTEGER DEFAULT 0,
      blacklist_reason TEXT,
      preferences TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 9. Invoices
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      branch_code TEXT,
      invoice_number TEXT,
      date TEXT,
      client_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      total_amount REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'fixed',
      discount_value REAL DEFAULT 0,
      promo_code TEXT,
      promo_discount_amount REAL DEFAULT 0,
      vat REAL DEFAULT 0,
      paid REAL DEFAULT 0,
      remaining REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      payment_methods TEXT DEFAULT '[]',
      status TEXT DEFAULT 'completed',
      cashback_earned REAL DEFAULT 0,
      cashback_used REAL DEFAULT 0,
      advance_deduction REAL DEFAULT 0,
      booking_id TEXT,
      treasury_id TEXT,
      is_cancelled INTEGER DEFAULT 0,
      cancel_reason TEXT,
      cancelled_at TEXT,
      is_remedy INTEGER DEFAULT 0,
      remedy_notes TEXT,
      related_complaint_id TEXT,
      original_invoice_id TEXT,
      before_photo_url TEXT,
      after_photo_url TEXT,
      zatca_reporting_status TEXT DEFAULT 'not_submitted',
      zatca_qr TEXT,
      zatca_hash TEXT,
      eta_submission_uuid TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 10. Invoice Items
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      service_id TEXT,
      product_id TEXT,
      item_name TEXT NOT NULL,
      item_type TEXT DEFAULT 'service',
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      employee_id TEXT,
      employee_name TEXT,
      employee_commission REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 11. Bookings
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      branch_code TEXT,
      booking_code TEXT,
      client_id TEXT,
      client_name TEXT,
      customer_name TEXT,
      client_phone TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      employee_id TEXT,
      employee_name TEXT,
      barber_id TEXT,
      service_id TEXT,
      source TEXT DEFAULT 'pos',
      services TEXT DEFAULT '[]',
      date TEXT,
      time TEXT,
      start_time TEXT,
      duration_minutes INTEGER DEFAULT 30,
      total_price REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'confirmed',
      queue_number INTEGER,
      is_paid INTEGER DEFAULT 0,
      invoice_id TEXT,
      notes TEXT,
      internal_notes TEXT,
      location TEXT,
      advance_payments TEXT DEFAULT '[]',
      discount_type TEXT,
      discount_value REAL,
      discount_amount REAL,
      created_by TEXT,
      created_by_name TEXT,
      created_by_id TEXT,
      updated_by TEXT,
      updated_by_name TEXT,
      updated_by_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 12. Transactions
    `CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      branch_code TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      category TEXT,
      expense_category TEXT,
      description TEXT,
      payment_method TEXT DEFAULT 'cash',
      treasury TEXT,
      treasury_id TEXT,
      invoice_id TEXT,
      user_id TEXT,
      user_name TEXT,
      shift_date TEXT,
      date TEXT DEFAULT (datetime('now')),
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 13. Held Invoices
    `CREATE TABLE IF NOT EXISTS held_invoices (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      client_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      client_search TEXT,
      queue_ticket_id TEXT,
      items TEXT DEFAULT '[]',
      discount_type TEXT DEFAULT 'fixed',
      discount_value REAL DEFAULT 0,
      advance_deduction REAL DEFAULT 0,
      advance_payments TEXT DEFAULT '[]',
      is_remedy_invoice INTEGER DEFAULT 0,
      remedy_reason TEXT,
      before_photo_url TEXT,
      after_photo_url TEXT,
      note TEXT,
      notes TEXT,
      held_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 14. Customer Complaints
    `CREATE TABLE IF NOT EXISTS customer_complaints (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      client_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      invoice_id TEXT,
      invoice_date TEXT,
      invoice_total REAL,
      category TEXT,
      complaint_text TEXT,
      status TEXT DEFAULT 'open',
      actions TEXT DEFAULT '[]',
      is_remedy_provided INTEGER DEFAULT 0,
      remedy_invoice_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 15. Tips
    `CREATE TABLE IF NOT EXISTS tips (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      employee_id TEXT NOT NULL,
      invoice_id TEXT,
      client_name TEXT,
      amount REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending_payout',
      paid_out_treasury_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 16. Employee Custodies
    `CREATE TABLE IF NOT EXISTS employee_custodies (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      employee_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      serial_number TEXT,
      quantity REAL DEFAULT 1,
      status TEXT DEFAULT 'with_employee',
      given_date TEXT,
      returned_date TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 17. Promo Codes
    `CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      code TEXT NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value REAL NOT NULL DEFAULT 0,
      min_invoice_amount REAL DEFAULT 0,
      max_discount_amount REAL,
      start_date TEXT,
      end_date TEXT,
      usage_limit INTEGER,
      max_uses_total INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      uses_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 18. Promo Code Usages
    `CREATE TABLE IF NOT EXISTS promo_code_usages (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      promo_code_id TEXT NOT NULL,
      code TEXT,
      client_id TEXT,
      client_phone TEXT,
      client_name TEXT,
      invoice_id TEXT,
      discount_amount REAL DEFAULT 0,
      discount_applied REAL DEFAULT 0,
      used_at TEXT DEFAULT (datetime('now'))
    );`,

    // 19. Fingerprint Logs
    `CREATE TABLE IF NOT EXISTS fingerprint_logs (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      employee_id TEXT,
      fingerprint_code TEXT,
      employee_name TEXT,
      timestamp TEXT,
      log_time TEXT,
      status TEXT DEFAULT 'synced',
      type TEXT DEFAULT 'check_in',
      source TEXT DEFAULT 'device',
      processed_date TEXT,
      device_ip TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 20. App License
    `CREATE TABLE IF NOT EXISTS app_license (
      id TEXT PRIMARY KEY,
      machine_code TEXT,
      license_type TEXT,
      license_key TEXT,
      status TEXT DEFAULT 'unlicensed',
      plan TEXT,
      max_employees INTEGER,
      max_branches INTEGER,
      activated_at TEXT,
      expires_at TEXT,
      runs_remaining INTEGER,
      max_seen_timestamp INTEGER,
      signature TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 21. App Used Licenses
    `CREATE TABLE IF NOT EXISTS app_used_licenses (
      license_key TEXT PRIMARY KEY,
      used_at TEXT DEFAULT (datetime('now')),
      machine_code TEXT
    );`,

    // 22. Backup Settings
    `CREATE TABLE IF NOT EXISTS backup_settings (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      days TEXT DEFAULT '["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]',
      schedule_mode TEXT DEFAULT 'frequency',
      frequency_preset TEXT DEFAULT 'every_6_hours',
      custom_times TEXT DEFAULT '["02:00","14:00","23:00"]',
      last_backup_at TEXT,
      backup_dir TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 23. Backup Logs
    `CREATE TABLE IF NOT EXISTS backup_logs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      filesize INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      trigger_type TEXT DEFAULT 'scheduled',
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 24. Suppliers
    `CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      current_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 25. Purchase Invoices
    `CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      supplier_id TEXT,
      invoice_number TEXT,
      date TEXT DEFAULT (datetime('now')),
      invoice_date TEXT DEFAULT (datetime('now')),
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      remaining REAL DEFAULT 0,
      remaining_amount REAL DEFAULT 0,
      treasury_id TEXT,
      payment_method TEXT,
      notes TEXT,
      items TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 26. Supplier Payments
    `CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      supplier_id TEXT,
      payment_number TEXT,
      date TEXT DEFAULT (datetime('now')),
      payment_date TEXT DEFAULT (datetime('now')),
      amount REAL DEFAULT 0,
      treasury_id TEXT,
      payment_method TEXT,
      notes TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 27. Work Shifts
    `CREATE TABLE IF NOT EXISTS work_shifts (
      id TEXT PRIMARY KEY,
      shift_code TEXT,
      salon_id TEXT,
      branch_id TEXT,
      shift_date TEXT,
      opened_at TEXT,
      closed_at TEXT,
      opened_by_user_id TEXT,
      opened_by_user_name TEXT,
      opened_by_name TEXT,
      opened_by_role TEXT,
      closed_by_user_id TEXT,
      closed_by_user_name TEXT,
      closed_by_name TEXT,
      closed_by_role TEXT,
      initial_cash REAL DEFAULT 0,
      expected_cash REAL DEFAULT 0,
      actual_cash REAL DEFAULT 0,
      cash_difference REAL DEFAULT 0,
      total_sales REAL DEFAULT 0,
      total_cash_sales REAL DEFAULT 0,
      total_card_sales REAL DEFAULT 0,
      total_expenses REAL DEFAULT 0,
      transferred_to_treasury TEXT,
      transferred_amount REAL DEFAULT 0,
      total_advances REAL DEFAULT 0,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 28. Inventory Counts
    `CREATE TABLE IF NOT EXISTS inventory_counts (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      date TEXT,
      notes TEXT,
      items TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 29. Item Movements
    `CREATE TABLE IF NOT EXISTS item_movements (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      product_id TEXT,
      date TEXT,
      type TEXT,
      reference_id TEXT,
      quantity_in REAL DEFAULT 0,
      quantity_out REAL DEFAULT 0,
      balance_after REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 30. Platform Settings
    `CREATE TABLE IF NOT EXISTS platform_settings (
      id TEXT PRIMARY KEY,
      platform_name TEXT DEFAULT 'منظومة سمارت كت برو لإدارة الصالونات',
      platform_phone TEXT DEFAULT '+201014889704',
      platform_email TEXT DEFAULT 'admin@smartcut.app',
      logo_url TEXT,
      platform_logo_url TEXT,
      default_trial_days INTEGER DEFAULT 7,
      master_programmer_key TEXT DEFAULT 'dev@smartcut2026',
      ai_provider TEXT DEFAULT 'builtin',
      ai_api_key TEXT,
      evolution_api_url TEXT,
      evolution_api_key TEXT,
      evolution_instance_name TEXT,
      data_signature TEXT,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 31. App Settings
    `CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      salon_name TEXT DEFAULT 'صالون سمارت كت',
      salon_type TEXT DEFAULT 'men',
      logo_url TEXT,
      phone TEXT DEFAULT '0500000000',
      address TEXT DEFAULT '',
      currency TEXT DEFAULT 'SAR',
      country TEXT DEFAULT 'المملكة العربية السعودية',
      tax_number TEXT,
      commercial_reg TEXT,
      vat_enabled INTEGER DEFAULT 1,
      vat_rate REAL DEFAULT 15,
      vat_percentage REAL DEFAULT 15,
      zatca_enabled INTEGER DEFAULT 0,
      zatca_settings TEXT,
      eta_egypt_settings TEXT,
      receipt_header_note TEXT DEFAULT '',
      receipt_footer_note TEXT DEFAULT '',
      booking_notes TEXT DEFAULT '',
      treasuries TEXT DEFAULT '[]',
      expense_categories TEXT DEFAULT '[]',
      printer_name TEXT DEFAULT 'طابعة الكاشير',
      paper_size TEXT DEFAULT '80mm',
      print_automatically INTEGER DEFAULT 0,
      thermal_printer_ip TEXT,
      thermal_printer_port INTEGER DEFAULT 9100,
      evolution_api_url TEXT,
      evolution_api_key TEXT,
      evolution_instance_name TEXT,
      wa_instant_name TEXT,
      wa_api_key TEXT,
      evolution_branch_instances TEXT DEFAULT '{}',
      supabase_url TEXT,
      supabase_anon_key TEXT,
      supabase_enabled INTEGER DEFAULT 0,
      hr_settings TEXT,
      booking_rules TEXT,
      vip_settings TEXT,
      tier_settings TEXT,
      show_dashboard_analytics INTEGER DEFAULT 1,
      show_employee_analytics INTEGER DEFAULT 1,
      ai_provider TEXT DEFAULT 'builtin',
      ai_api_key TEXT,
      ai_model TEXT,
      settings_json TEXT DEFAULT '{}',
      overtime_settings TEXT DEFAULT '{}',
      attendance_settings TEXT DEFAULT '{}',
      commission_settings TEXT DEFAULT '{}',
      loyalty_settings TEXT DEFAULT '{}',
      referral_settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 32. Custom Roles
    `CREATE TABLE IF NOT EXISTS custom_roles (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      screens TEXT DEFAULT '[]',
      actions TEXT DEFAULT '[]',
      is_system INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 33. Client Portal Accounts
    `CREATE TABLE IF NOT EXISTS client_portal_accounts (
      id TEXT PRIMARY KEY,
      salon_id TEXT,
      client_id TEXT,
      phone TEXT NOT NULL,
      username TEXT,
      password_hash TEXT,
      salon_code TEXT,
      linked_salon_codes TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 34. Queue Tickets
    `CREATE TABLE IF NOT EXISTS queue_tickets (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      branch_id TEXT,
      ticket_number TEXT,
      client_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      service_id TEXT,
      employee_id TEXT,
      status TEXT DEFAULT 'waiting',
      called_at TEXT,
      served_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 35. Partners
    `CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      tenant_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      national_id TEXT,
      share_percentage REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      debit_balance REAL DEFAULT 0,
      total_withdrawn REAL DEFAULT 0,
      total_profit_received REAL DEFAULT 0,
      max_drawings_cap REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      join_date TEXT,
      exit_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 36. Partner Transactions
    `CREATE TABLE IF NOT EXISTS partner_transactions (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      partner_name TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT DEFAULT (datetime('now')),
      notes TEXT,
      payment_method TEXT DEFAULT 'cash',
      treasury_id TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 37. Partner Drawings
    `CREATE TABLE IF NOT EXISTS partner_drawings (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT DEFAULT (datetime('now')),
      reason TEXT,
      notes TEXT,
      treasury_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 38. Partner Exit Installments
    `CREATE TABLE IF NOT EXISTS partner_exit_installments (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      installment_number INTEGER DEFAULT 1,
      amount REAL NOT NULL DEFAULT 0,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      paid_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 39. Profit Distributions
    `CREATE TABLE IF NOT EXISTS profit_distributions (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      distribution_date TEXT DEFAULT (datetime('now')),
      total_profit REAL DEFAULT 0,
      distributed_amount REAL DEFAULT 0,
      retained_amount REAL DEFAULT 0,
      details TEXT DEFAULT '[]',
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 40. Tenant Subscriptions
    `CREATE TABLE IF NOT EXISTS tenant_subscriptions (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      plan_id TEXT,
      status TEXT DEFAULT 'active',
      start_date TEXT,
      end_date TEXT,
      price REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 41. Subscription Plans (Dynamic Pricing & Plans Table)
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT,
      plan_name_ar TEXT,
      plan_name_en TEXT,
      description_ar TEXT,
      min_employees INTEGER DEFAULT 1,
      max_employees INTEGER DEFAULT 9999,
      price_egp_1m REAL DEFAULT 0,
      price_egp_3m REAL DEFAULT 0,
      price_egp_6m REAL DEFAULT 0,
      price_egp_12m REAL DEFAULT 0,
      price_usd_1m REAL DEFAULT 0,
      price_usd_3m REAL DEFAULT 0,
      price_usd_6m REAL DEFAULT 0,
      price_usd_12m REAL DEFAULT 0,
      branch_price_egp_1m REAL DEFAULT 0,
      branch_price_egp_3m REAL DEFAULT 0,
      branch_price_egp_6m REAL DEFAULT 0,
      branch_price_egp_12m REAL DEFAULT 0,
      branch_price_usd_1m REAL DEFAULT 0,
      branch_price_usd_3m REAL DEFAULT 0,
      branch_price_usd_6m REAL DEFAULT 0,
      branch_price_usd_12m REAL DEFAULT 0,
      features TEXT DEFAULT '[]',
      is_popular INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 42. Subscription Addons
    `CREATE TABLE IF NOT EXISTS subscription_addons (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL,
      addon_type TEXT,
      name TEXT,
      price REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 44. Used License Keys
    `CREATE TABLE IF NOT EXISTS app_used_licenses (
      license_key TEXT PRIMARY KEY,
      machine_code TEXT,
      license_type TEXT,
      value_amount REAL,
      max_employees INTEGER,
      used_at TEXT DEFAULT (datetime('now'))
    );`
  ];

  for (const stmt of schemaStatements) {
    try {
      await db.execute(stmt);
    } catch (err) {
      console.warn('⚠️ Table creation notice:', err.message);
    }
  }

  // Ensure unique indexes for columns used in ON CONFLICT upserts
  const uniqueIndexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_salons_salon_code ON salons(salon_code);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_salon_id ON app_settings(salon_id);`,
  ];
  for (const idxStmt of uniqueIndexes) {
    try {
      await db.execute(idxStmt);
    } catch (err) {
      console.warn('⚠️ Index creation notice:', err.message);
    }
  }

  // Self-healing migrations for existing databases across all modules
  const autoColumns = [
    // invoices
    { table: 'invoices', column: 'total', type: 'REAL DEFAULT 0' },
    { table: 'invoices', column: 'paid_amount', type: 'REAL DEFAULT 0' },
    { table: 'invoices', column: 'remaining_amount', type: 'REAL DEFAULT 0' },
    { table: 'invoices', column: 'discount', type: 'REAL DEFAULT 0' },
    { table: 'invoices', column: 'tax', type: 'REAL DEFAULT 0' },
    { table: 'invoices', column: 'items', type: "TEXT DEFAULT '[]'" },
    { table: 'invoices', column: 'shift_id', type: 'TEXT' },
    { table: 'invoices', column: 'shift_date', type: 'TEXT' },
    { table: 'invoices', column: 'cashier_id', type: 'TEXT' },
    { table: 'invoices', column: 'cashier_name', type: 'TEXT' },
    { table: 'invoices', column: 'notes', type: 'TEXT' },
    { table: 'invoices', column: 'eta_status', type: "TEXT DEFAULT 'not_submitted'" },
    { table: 'invoices', column: 'date', type: 'TEXT' },
    // products
    { table: 'products', column: 'category_id', type: 'TEXT' },
    { table: 'products', column: 'barcode', type: 'TEXT' },
    { table: 'products', column: 'retail_price', type: 'REAL DEFAULT 0' },
    { table: 'products', column: 'current_stock', type: 'REAL DEFAULT 0' },
    { table: 'products', column: 'min_stock_alert', type: 'INTEGER DEFAULT 5' },
    // held_invoices
    { table: 'held_invoices', column: 'queue_number', type: 'TEXT' },
    { table: 'held_invoices', column: 'total', type: 'REAL DEFAULT 0' },
    { table: 'held_invoices', column: 'held_at', type: 'TEXT' },
    { table: 'held_invoices', column: 'queue_ticket_id', type: 'TEXT' },
    { table: 'held_invoices', column: 'notes', type: 'TEXT' },
    { table: 'held_invoices', column: 'booking_id', type: 'TEXT' },
    // clients
    { table: 'clients', column: 'cashback', type: 'REAL DEFAULT 0' },
    { table: 'clients', column: 'birth_date', type: 'TEXT' },
    { table: 'clients', column: 'loyalty_points', type: 'REAL DEFAULT 0' },
    // promo_codes
    { table: 'promo_codes', column: 'max_uses_total', type: 'INTEGER' },
    { table: 'promo_codes', column: 'usage_limit', type: 'INTEGER' },
    { table: 'promo_codes', column: 'uses_count', type: 'INTEGER DEFAULT 0' },
    { table: 'promo_codes', column: 'used_count', type: 'INTEGER DEFAULT 0' },
    // promo_code_usages
    { table: 'promo_code_usages', column: 'discount_applied', type: 'REAL DEFAULT 0' },
    { table: 'promo_code_usages', column: 'discount_amount', type: 'REAL DEFAULT 0' },
    // transactions
    { table: 'transactions', column: 'date', type: 'TEXT' },
    { table: 'transactions', column: 'shift_date', type: 'TEXT' },
    { table: 'transactions', column: 'user_id', type: 'TEXT' },
    { table: 'transactions', column: 'user_name', type: 'TEXT' },
    // users
    { table: 'users', column: 'screens', type: "TEXT DEFAULT '[]'" },
    { table: 'users', column: 'actions', type: "TEXT DEFAULT '[]'" },
    // services
    { table: 'services', column: 'is_priority', type: 'INTEGER DEFAULT 0' },
    { table: 'services', column: 'card_color', type: 'TEXT' },
    { table: 'services', column: 'priority_order', type: 'INTEGER DEFAULT 0' },
    // app_license
    { table: 'app_license', column: 'machine_code', type: 'TEXT' },
    { table: 'app_license', column: 'signature', type: 'TEXT' },
    { table: 'app_license', column: 'activated_at', type: "TEXT DEFAULT (datetime('now'))" },
    { table: 'app_license', column: 'license_type', type: 'TEXT' },
    // app_used_licenses
    { table: 'app_used_licenses', column: 'license_type', type: 'TEXT' },
    { table: 'app_used_licenses', column: 'value_amount', type: 'REAL' },
    { table: 'app_used_licenses', column: 'max_employees', type: 'INTEGER' },
    // employees target fields
    { table: 'employees', column: 'daily_target_amount', type: 'REAL DEFAULT 0' },
    { table: 'employees', column: 'monthly_target_amount', type: 'REAL DEFAULT 5000' },
    { table: 'employees', column: 'target_commission_rate', type: 'REAL DEFAULT 0' },
    // app_settings target fields
    { table: 'app_settings', column: 'target_calculation_policy', type: 'INTEGER DEFAULT 1' },
    { table: 'app_settings', column: 'target_step_amount', type: 'REAL DEFAULT 1000' },
    // OpenRouter AI Integration
    { table: 'app_settings', column: 'openrouter_api_key', type: 'TEXT' },
    { table: 'app_settings', column: 'openrouter_model', type: "TEXT DEFAULT 'google/gemini-1.5-flash'" },
    // fingerprint_logs
    { table: 'fingerprint_logs', column: 'fingerprint_code', type: 'TEXT' },
    { table: 'fingerprint_logs', column: 'employee_name', type: 'TEXT' },
    { table: 'fingerprint_logs', column: 'processed_date', type: 'TEXT' },
    { table: 'fingerprint_logs', column: 'device_ip', type: 'TEXT' },
    // subscription_plans auto-columns
    { table: 'subscription_plans', column: 'name', type: 'TEXT' },
    { table: 'subscription_plans', column: 'plan_name_ar', type: 'TEXT' },
    { table: 'subscription_plans', column: 'plan_name_en', type: 'TEXT' },
    { table: 'subscription_plans', column: 'description_ar', type: 'TEXT' },
    { table: 'subscription_plans', column: 'min_employees', type: 'INTEGER DEFAULT 1' },
    { table: 'subscription_plans', column: 'max_employees', type: 'INTEGER DEFAULT 9999' },
    { table: 'subscription_plans', column: 'price_egp_1m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'price_egp_3m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'price_egp_6m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'price_egp_12m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'price_usd_1m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'price_usd_3m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'price_usd_6m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'price_usd_12m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'branch_price_egp_1m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'branch_price_egp_3m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'branch_price_egp_6m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'branch_price_egp_12m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'branch_price_usd_1m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'branch_price_usd_3m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'branch_price_usd_6m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'branch_price_usd_12m', type: 'REAL DEFAULT 0' },
    { table: 'subscription_plans', column: 'display_order', type: 'INTEGER DEFAULT 0' },
    { table: 'subscription_plans', column: 'updated_at', type: "TEXT DEFAULT (datetime('now'))" },
    // branches auto-columns
    { table: 'branches', column: 'salon_code', type: 'TEXT' },
    { table: 'branches', column: 'city', type: 'TEXT' },
    { table: 'branches', column: 'country', type: "TEXT DEFAULT 'المملكة العربية السعودية'" },
    { table: 'branches', column: 'currency', type: "TEXT DEFAULT 'SAR'" },
    { table: 'branches', column: 'vat_rate', type: 'REAL DEFAULT 15' },
    { table: 'branches', column: 'vat_enabled', type: 'INTEGER DEFAULT 1' },
    { table: 'branches', column: 'tax_number', type: 'TEXT' },
    { table: 'branches', column: 'commercial_reg', type: 'TEXT' },
    { table: 'branches', column: 'status', type: "TEXT DEFAULT 'active'" },
    { table: 'branches', column: 'evolution_instance_name', type: 'TEXT' },
    { table: 'branches', column: 'storage_limit_mb', type: 'REAL DEFAULT 50' },
    { table: 'branches', column: 'used_storage_bytes', type: 'REAL DEFAULT 0' },
    // sales_returns auto-columns
    { table: 'sales_returns', column: 'is_general_return', type: 'INTEGER DEFAULT 0' },
    // bookings auto-columns
    { table: 'bookings', column: 'client_name', type: 'TEXT' },
    { table: 'bookings', column: 'client_phone', type: 'TEXT' },
    { table: 'bookings', column: 'employee_name', type: 'TEXT' },
    { table: 'bookings', column: 'source', type: "TEXT DEFAULT 'pos'" },
    { table: 'bookings', column: 'services', type: "TEXT DEFAULT '[]'" },
    { table: 'bookings', column: 'start_time', type: 'TEXT' },
    { table: 'bookings', column: 'total_price', type: 'REAL DEFAULT 0' },
    { table: 'bookings', column: 'queue_number', type: 'INTEGER' },
    { table: 'bookings', column: 'is_paid', type: 'INTEGER DEFAULT 0' },
    { table: 'bookings', column: 'invoice_id', type: 'TEXT' },
    { table: 'bookings', column: 'internal_notes', type: 'TEXT' },
    { table: 'bookings', column: 'location', type: 'TEXT' },
    { table: 'bookings', column: 'discount_type', type: 'TEXT' },
    { table: 'bookings', column: 'discount_value', type: 'REAL' },
    { table: 'bookings', column: 'discount_amount', type: 'REAL' },
    { table: 'bookings', column: 'created_by', type: 'TEXT' },
    { table: 'bookings', column: 'created_by_name', type: 'TEXT' },
    { table: 'bookings', column: 'created_by_id', type: 'TEXT' },
    { table: 'bookings', column: 'updated_by', type: 'TEXT' },
    { table: 'bookings', column: 'updated_by_name', type: 'TEXT' },
    { table: 'bookings', column: 'updated_by_id', type: 'TEXT' },
    { table: 'services', column: 'commissionable_amount', type: 'REAL' },
    { table: 'services', column: 'is_target_exempt', type: 'INTEGER DEFAULT 0' },
    { table: 'employees', column: 'daily_target_method', type: "TEXT DEFAULT 'excess_only'" },
    { table: 'employees', column: 'monthly_target_method', type: "TEXT DEFAULT 'deduct_salary'" },
    // work_shifts auto-columns
    { table: 'work_shifts', column: 'shift_code', type: 'TEXT' },
    { table: 'work_shifts', column: 'opened_by_name', type: 'TEXT' },
    { table: 'work_shifts', column: 'closed_by_user_id', type: 'TEXT' },
    { table: 'work_shifts', column: 'closed_by_user_name', type: 'TEXT' },
    { table: 'work_shifts', column: 'closed_by_name', type: 'TEXT' },
    { table: 'work_shifts', column: 'closed_by_role', type: 'TEXT' },
    { table: 'work_shifts', column: 'transferred_to_treasury', type: 'TEXT' },
    { table: 'work_shifts', column: 'transferred_amount', type: 'REAL DEFAULT 0' },
    { table: 'work_shifts', column: 'total_advances', type: 'REAL DEFAULT 0' },
    { table: 'work_shifts', column: 'total_sales', type: 'REAL DEFAULT 0' },
    { table: 'work_shifts', column: 'total_cash_sales', type: 'REAL DEFAULT 0' },
    { table: 'work_shifts', column: 'total_card_sales', type: 'REAL DEFAULT 0' },
    { table: 'work_shifts', column: 'total_expenses', type: 'REAL DEFAULT 0' },
    // invoices & transactions shift_code
    { table: 'invoices', column: 'shift_code', type: 'TEXT' },
    { table: 'transactions', column: 'shift_code', type: 'TEXT' }
  ];

  const tableColumnsCache = {};
  for (const ac of autoColumns) {
    try {
      if (!tableColumnsCache[ac.table]) {
        const info = await db.execute(`PRAGMA table_info(${sanitizeIdentifier(ac.table)});`);
        tableColumnsCache[ac.table] = new Set((info.rows || []).map(r => String(r.name || r[1]).toLowerCase()));
      }
      if (!tableColumnsCache[ac.table].has(ac.column.toLowerCase())) {
        await db.execute(`ALTER TABLE ${sanitizeIdentifier(ac.table)} ADD COLUMN ${sanitizeIdentifier(ac.column)} ${ac.type};`);
        tableColumnsCache[ac.table].add(ac.column.toLowerCase());
      }
    } catch (e) {}
  }

  try { await db.execute("UPDATE held_invoices SET held_at = COALESCE(created_at, datetime('now')) WHERE held_at IS NULL;"); } catch (e) {}
  try { await db.execute("UPDATE transactions SET date = COALESCE(shift_date, created_at, datetime('now')) WHERE date IS NULL;"); } catch (e) {}
  try { await db.execute("UPDATE invoices SET date = COALESCE(created_at, datetime('now')) WHERE date IS NULL;"); } catch (e) {}

  // Auto-backfill processed_date on existing fingerprint_logs
  try {
    await db.execute(`
      UPDATE fingerprint_logs 
      SET processed_date = CASE 
        WHEN LOWER(type) = 'check_out' AND (
          (substr(COALESCE(timestamp, log_time), 12, 5) >= '00:00' AND substr(COALESCE(timestamp, log_time), 12, 5) <= '06:00')
        )
        THEN date(substr(COALESCE(timestamp, log_time), 1, 10), '-1 day')
        ELSE substr(COALESCE(timestamp, log_time), 1, 10)
      END
      WHERE processed_date IS NULL OR processed_date = '';
    `);
  } catch (e) {}

  // SQLite trigger to automatically calculate processed_date for direct SQL inserts (biometric sync tools)
  try {
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_fingerprint_logs_calc_processed_date
      AFTER INSERT ON fingerprint_logs
      FOR EACH ROW
      WHEN NEW.processed_date IS NULL OR NEW.processed_date = ''
      BEGIN
        UPDATE fingerprint_logs
        SET processed_date = CASE 
          WHEN LOWER(NEW.type) = 'check_out' AND (
            substr(COALESCE(NEW.timestamp, NEW.log_time), 12, 5) >= '00:00' AND 
            substr(COALESCE(NEW.timestamp, NEW.log_time), 12, 5) <= '06:00'
          )
          THEN date(substr(COALESCE(NEW.timestamp, NEW.log_time), 1, 10), '-1 day')
          ELSE substr(COALESCE(NEW.timestamp, NEW.log_time), 1, 10)
        END
        WHERE id = NEW.id;
      END;
    `);
  } catch (e) {}

  // Ensure default platform_settings row exists and apply tamper protection
  try {
    // 1. Ensure data_signature column exists in platform_settings
    try {
      await db.execute("ALTER TABLE platform_settings ADD COLUMN data_signature TEXT;");
    } catch (colErr) {}

    const psCount = await db.execute("SELECT COUNT(*) as c FROM platform_settings;");
    if (Number(psCount.rows[0]?.c || 0) === 0) {
      const defaultRow = {
        id: '00000000-0000-0000-0000-000000000000',
        platform_name: 'منظومة سمارت كت برو لإدارة الصالونات',
        platform_phone: '+201014889704',
        platform_email: 'admin@smartcut.app',
        master_programmer_key: 'dev@smartcut2026'
      };
      const initialSig = computePlatformSignature(defaultRow);
      await db.execute({
        sql: `INSERT INTO platform_settings (id, platform_name, platform_phone, platform_email, master_programmer_key, data_signature)
              VALUES (?, ?, ?, ?, ?, ?);`,
        args: [
          defaultRow.id,
          defaultRow.platform_name,
          defaultRow.platform_phone,
          defaultRow.platform_email,
          defaultRow.master_programmer_key,
          initialSig
        ]
      });
    }

    // 2. Cryptographic Integrity Verification & Self-Healing
    const curPs = await db.execute("SELECT * FROM platform_settings LIMIT 1;");
    if (curPs.rows && curPs.rows.length > 0) {
      const pRow = curPs.rows[0];
      const expectedSig = computePlatformSignature(pRow);

      if (!pRow.data_signature) {
        // Initial sealing
        await db.execute({
          sql: "UPDATE platform_settings SET data_signature = ? WHERE id = ?;",
          args: [expectedSig, pRow.id]
        });
        console.log('🔒 [Security] platform_settings cryptographic seal initialized.');
      } else if (pRow.data_signature !== expectedSig) {
        // TAMPERING DETECTED!
        console.warn('⚠️ [SECURITY] Unauthorized manual alteration detected in platform_settings!');
        console.warn('🛡️ [Security] Reverting unauthorized changes and restoring authentic developer credentials...');
        
        // Self-heal: restore developer authentic contact & key
        const healedData = {
          ...pRow,
          platform_phone: '+201014889704',
          master_programmer_key: 'dev@smartcut2026'
        };
        const healedSig = computePlatformSignature(healedData);

        await db.execute({
          sql: `UPDATE platform_settings 
                SET platform_phone = ?, 
                    master_programmer_key = ?, 
                    data_signature = ? 
                WHERE id = ?;`,
          args: ['+201014889704', 'dev@smartcut2026', healedSig, pRow.id]
        });
        console.log('✅ [Security] platform_settings self-healed and re-sealed successfully.');
      }
    }

    // 3. In-Database Triggers to Prevent Direct SQLite Tampering
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_protect_platform_settings_update
      BEFORE UPDATE ON platform_settings
      FOR EACH ROW
      WHEN NEW.data_signature IS NULL OR (
        NEW.data_signature = OLD.data_signature AND (
          NEW.platform_phone != OLD.platform_phone OR
          NEW.platform_name != OLD.platform_name OR
          NEW.master_programmer_key != OLD.master_programmer_key OR
          NEW.platform_email != OLD.platform_email
        )
      )
      BEGIN
        SELECT RAISE(ABORT, '⛔ خطأ أمني: جدول إعدادات المنظومة platform_settings محمي ومشفر ضد التعديل اليدوي المباشر.');
      END;
    `);

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_protect_platform_settings_delete
      BEFORE DELETE ON platform_settings
      FOR EACH ROW
      BEGIN
        SELECT RAISE(ABORT, '⛔ خطأ أمني: غير مصرح بحذف سجلات إعدادات المنظومة platform_settings.');
      END;
    `);
  } catch (e) {
    console.warn('⚠️ platform_settings protection setup warning:', e?.message);
  }

  // Ensure default subscription_plans exist in the database with the approved pricing
  try {
    const initialPlans = [
      {
        id: 'starter',
        plan_name_ar: 'باقة البداية (1–5 موظفين)',
        plan_name_en: 'Starter Plan',
        description_ar: 'مثالية للصالونات الناشئة والصغيرة بفريق عمل حتى 5 موظفين',
        min_employees: 1,
        max_employees: 5,
        price_egp_1m: 350,
        price_egp_3m: 1000,
        price_egp_6m: 1950,
        price_egp_12m: 3500,
        price_usd_1m: 10,
        price_usd_3m: 28,
        price_usd_6m: 53,
        price_usd_12m: 100,
        branch_price_egp_1m: 230,
        branch_price_egp_3m: 670,
        branch_price_egp_6m: 1300,
        branch_price_egp_12m: 2300,
        branch_price_usd_1m: 7,
        branch_price_usd_3m: 19,
        branch_price_usd_6m: 35,
        branch_price_usd_12m: 67,
        features: JSON.stringify([
          'من 1 إلى 5 موظفين',
          'نقطة بيع POS سريعة وفواتير غير محدودة',
          'إدارة الحجوزات والمواعيد والعملاء',
          'الخزينة والمصروفات والتقارير اليومية',
          'إغلاق الوردية وطباعة تقرير Z-Report',
          'دعم فني وتحديثات مستمرة'
        ]),
        is_popular: 0,
        is_active: 1,
        display_order: 1
      },
      {
        id: 'growth',
        plan_name_ar: 'باقة التوسع (6–10 موظفين)',
        plan_name_en: 'Growth Plan',
        description_ar: 'الخيار الممتاز للصالونات المتوسطة والمتنامية',
        min_employees: 6,
        max_employees: 10,
        price_egp_1m: 450,
        price_egp_3m: 1250,
        price_egp_6m: 2500,
        price_egp_12m: 4500,
        price_usd_1m: 17,
        price_usd_3m: 47,
        price_usd_6m: 87,
        price_usd_12m: 160,
        branch_price_egp_1m: 300,
        branch_price_egp_3m: 830,
        branch_price_egp_6m: 1670,
        branch_price_egp_12m: 3000,
        branch_price_usd_1m: 11,
        branch_price_usd_3m: 31,
        branch_price_usd_6m: 58,
        branch_price_usd_12m: 107,
        features: JSON.stringify([
          'من 6 إلى 10 موظفين',
          'كافة ميزات باقة 1-5 موظفين',
          'المخازن والمستودع الشامل وحركة الأصناف',
          'حساب عمولات الموظفين ومسيرات الرواتب والسلف',
          'برنامج ولاء ونقاط العملاء وكوبونات الخصم',
          'ربط وإشعارات رسائل واتساب'
        ]),
        is_popular: 1,
        is_active: 1,
        display_order: 2
      },
      {
        id: 'enterprise',
        plan_name_ar: 'باقة الأعمال الكبرى (أكثر من 10 موظفين)',
        plan_name_en: 'Enterprise Plan',
        description_ar: 'حل متكامل للمنشآت والمراكز الكبرى (سعة غير محدودة)',
        min_employees: 11,
        max_employees: 9999,
        price_egp_1m: 550,
        price_egp_3m: 1550,
        price_egp_6m: 3050,
        price_egp_12m: 5500,
        price_usd_1m: 27,
        price_usd_3m: 75,
        price_usd_6m: 140,
        price_usd_12m: 264,
        branch_price_egp_1m: 370,
        branch_price_egp_3m: 1030,
        branch_price_egp_6m: 2030,
        branch_price_egp_12m: 3670,
        branch_price_usd_1m: 18,
        branch_price_usd_3m: 50,
        branch_price_usd_6m: 93,
        branch_price_usd_12m: 176,
        features: JSON.stringify([
          'أكثر من 10 موظفين (سعة مفتوحة ∞)',
          'كافة ميزات باقة التوسع',
          'لوحة تحليلات ورسوم بيانية لأداء الموظفين',
          'دعم الفروع المتعددة والمستودعات',
          'أولوية قصوى في الدعم الفني والتحديثات'
        ]),
        is_popular: 0,
        is_active: 1,
        display_order: 3
      }
    ];

    for (const plan of initialPlans) {
      await db.execute({
        sql: `INSERT INTO subscription_plans (
          id, name, plan_name_ar, plan_name_en, description_ar, 
          min_employees, max_employees, 
          price_egp_1m, price_egp_3m, price_egp_6m, price_egp_12m,
          price_usd_1m, price_usd_3m, price_usd_6m, price_usd_12m,
          branch_price_egp_1m, branch_price_egp_3m, branch_price_egp_6m, branch_price_egp_12m,
          branch_price_usd_1m, branch_price_usd_3m, branch_price_usd_6m, branch_price_usd_12m,
          features, is_popular, is_active, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = COALESCE(subscription_plans.name, excluded.name),
          plan_name_ar = COALESCE(subscription_plans.plan_name_ar, excluded.plan_name_ar),
          price_egp_1m = CASE WHEN subscription_plans.price_egp_1m = 0 OR subscription_plans.price_egp_1m IS NULL THEN excluded.price_egp_1m ELSE subscription_plans.price_egp_1m END,
          price_egp_3m = CASE WHEN subscription_plans.price_egp_3m = 0 OR subscription_plans.price_egp_3m IS NULL THEN excluded.price_egp_3m ELSE subscription_plans.price_egp_3m END,
          price_egp_6m = CASE WHEN subscription_plans.price_egp_6m = 0 OR subscription_plans.price_egp_6m IS NULL THEN excluded.price_egp_6m ELSE subscription_plans.price_egp_6m END,
          price_egp_12m = CASE WHEN subscription_plans.price_egp_12m = 0 OR subscription_plans.price_egp_12m IS NULL THEN excluded.price_egp_12m ELSE subscription_plans.price_egp_12m END;`,
        args: [
          plan.id, plan.plan_name_ar, plan.plan_name_ar, plan.plan_name_en, plan.description_ar,
          plan.min_employees, plan.max_employees,
          plan.price_egp_1m, plan.price_egp_3m, plan.price_egp_6m, plan.price_egp_12m,
          plan.price_usd_1m, plan.price_usd_3m, plan.price_usd_6m, plan.price_usd_12m,
          plan.branch_price_egp_1m, plan.branch_price_egp_3m, plan.branch_price_egp_6m, plan.branch_price_egp_12m,
          plan.branch_price_usd_1m, plan.branch_price_usd_3m, plan.branch_price_usd_6m, plan.branch_price_usd_12m,
          plan.features, plan.is_popular, plan.is_active, plan.display_order
        ]
      });
    }
  } catch (err) {
    console.warn('⚠️ subscription_plans seeding notice:', err.message);
  }

  console.log('✅ [libSQL] Database tables initialized successfully.');
  await handleInitialInstallationOrUpdate();
}

// ==============================================================================
// 5. Initial Installation & Update Protection Handler
// ==============================================================================
async function handleInitialInstallationOrUpdate() {
  const db = getDbClient();
  try {
    const salonsRes = await db.execute('SELECT COUNT(*) as count FROM salons;');
    const salonsCount = Number(salonsRes.rows[0]?.count) || 0;
    
    const licenseRes = await db.execute('SELECT COUNT(*) as count FROM app_license;');
    const licenseCount = Number(licenseRes.rows[0]?.count) || 0;

    // فحص هل هذه قاعدة بيانات سابقة تحتوي على بيانات (وضع التحديث أو إعادة التثبيت)
    // عند التحديث ممنوع نهائياً إضافة أو حذف أو تعديل أي بيانات تخص المنشأة أو التراخيص
    if (salonsCount > 0 || licenseCount > 0) {
      console.log('🛡️ [libSQL Engine] Existing installation detected. Preserving all existing user and business data. Skipping initial seeding.');
      return;
    }

    console.log('🎉 [libSQL Engine] First clean installation detected on this machine!');
    console.log('⚡ [libSQL Engine] Auto-provisioning 7-day trial license for 5 employees without activation prompt...');

    // 1. تفعيل تلقائي لمدة 7 أيام تجريبي لـ 5 موظفين وفرع واحد بدون طلب كود التفعيل
    const machineCode = licenseHelper && typeof licenseHelper.getMachineCode === 'function'
      ? licenseHelper.getMachineCode()
      : 'APP-LOCAL-OFFLINE';

    let trialKey = 'TRIAL-7DAYS-0001';
    if (licenseHelper && typeof licenseHelper.generateLicenseKey === 'function') {
      try {
        trialKey = licenseHelper.generateLicenseKey(machineCode, 'days', 7, 5);
      } catch (err) {
        console.warn('⚠️ Could not generate algorithmic trial key:', err.message);
      }
    }

    const now = Date.now();
    const activatedAt = new Date().toISOString();
    const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    const signature = licenseHelper && typeof licenseHelper.computeLicenseSignature === 'function'
      ? licenseHelper.computeLicenseSignature(machineCode, trialKey, 'days', 5, activatedAt, expiresAt, null)
      : null;

    await db.execute({
      sql: `INSERT INTO app_license (
        id, machine_code, license_type, license_key, status, plan,
        max_employees, max_branches, activated_at, expires_at, runs_remaining, max_seen_timestamp, signature, is_active
      ) VALUES (
        'primary_license', ?, 'days', ?, 'active', 'تجريبي (7 أيام - 5 موظفين)',
        5, 1, ?, ?, 999, ?, ?, 1
      )
      ON CONFLICT(id) DO UPDATE SET
        machine_code = excluded.machine_code,
        license_type = excluded.license_type,
        license_key = excluded.license_key,
        status = excluded.status,
        plan = excluded.plan,
        max_employees = excluded.max_employees,
        max_branches = excluded.max_branches,
        activated_at = excluded.activated_at,
        expires_at = excluded.expires_at,
        signature = excluded.signature,
        is_active = excluded.is_active;`,
      args: [machineCode, trialKey, activatedAt, expiresAt, now, signature]
    });

    // 2. إنشاء المستخدم الرئيسي (admin / 123) في حال كان جدول المستخدمين فارغاً
    const usersRes = await db.execute('SELECT COUNT(*) as count FROM users;');
    const usersCount = Number(usersRes.rows[0]?.count) || 0;
    if (usersCount === 0) {
      await db.execute({
        sql: `INSERT INTO users (id, name, username, email, phone, password_hash, role, screens, actions, is_active)
              VALUES ('user_admin_default', 'مدير النظام', 'admin', 'admin@smartcut.app', '', '123', 'owner', '["*"]', '["*"]', 1);`,
        args: []
      });
    }

    // 3. إعدادات النسخ الاحتياطي الافتراضية
    await db.execute({
      sql: `INSERT INTO backup_settings (id, salon_id, enabled, days, frequency_preset, custom_times, backup_dir)
            VALUES ('default_backup_settings', 'default', 1, '["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]', 'every_6_hours', '["02:00","14:00","23:00"]', ?)
            ON CONFLICT(id) DO NOTHING;`,
      args: [BACKUPS_DIR]
    }).catch(() => {});

    // جدول الصالونات salons يُترك فارغاً تماماً لتظهر بطاقة التهيئة الأولى
    console.log('✨ [libSQL Engine] Clean initial installation ready. Salons table is 100% empty for user onboarding.');
  } catch (err) {
    console.error('❌ [libSQL Initial Setup Error]:', err.message);
  }
}

// ==============================================================================
// 5.1. Secure Read-Only SQL Endpoint for Manager AI Chat (libSQL)
// ==============================================================================
app.post('/api/ai/execute-sql', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const trimmedQuery = query.trim();

    // 1. Remove comments (-- comment and /* comment */)
    const cleanQuery = trimmedQuery
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    if (!cleanQuery) {
      return res.status(400).json({ success: false, error: 'Empty query after cleaning' });
    }

    // 2. Strict Read-Only Security Check: Must start with SELECT or WITH or EXPLAIN
    const upperQuery = cleanQuery.toUpperCase();
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('WITH') && !upperQuery.startsWith('EXPLAIN')) {
      return res.status(403).json({
        success: false,
        error: 'Security Violation: Only SELECT queries are permitted on the local database.'
      });
    }

    // 3. Prohibit any mutating or administrative keywords anywhere in the SQL
    const forbiddenKeywords = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
      'REPLACE', 'EXEC', 'CREATE', 'ATTACH', 'DETACH', 'PRAGMA',
      'GRANT', 'REVOKE', 'VACUUM', 'REINDEX'
    ];

    for (const kw of forbiddenKeywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
      if (kwRegex.test(cleanQuery)) {
        return res.status(403).json({
          success: false,
          error: `Security Violation: The command '${kw}' is strictly prohibited. Only read-only SELECT statements are allowed.`
        });
      }
    }

    // 4. Multiple statement protection: reject multiple statements
    const statementParts = cleanQuery.split(';').map(s => s.trim()).filter(Boolean);
    if (statementParts.length > 1) {
      return res.status(403).json({
        success: false,
        error: 'Security Violation: Multiple SQL statements are not permitted in a single query.'
      });
    }

    // 5. Execute query on local libSQL client
    const db = getDbClient();
    const result = await db.execute(cleanQuery);

    // 6. Format and sanitize output rows
    const rows = (result.rows || []).map(r => formatOutputRow(r));

    return res.json({
      success: true,
      rows,
      rowCount: rows.length,
      columns: result.columns || (rows[0] ? Object.keys(rows[0]) : [])
    });
  } catch (err) {
    console.error('❌ [AI Execute SQL Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Database query execution failed'
    });
  }
});

// ==============================================================================
// 6. Generic Unified Query Endpoint (Refactored T-SQL -> libSQL/SQLite)
// ==============================================================================
app.post('/api/query', async (req, res) => {
  try {
    const db = getDbClient();
    const { action, table, columns, filters, orFilters, order, limit, range, data, onConflict, rpcName, rpcParams } = req.body;

    // --- A. RPC Mocking / Compatibility ---
    if (action === 'rpc') {
      if (rpcName === 'add_column_if_not_exists') {
        const { p_table, p_column, p_type } = rpcParams || {};
        try {
          await db.execute(`ALTER TABLE ${sanitizeIdentifier(p_table)} ADD COLUMN ${sanitizeIdentifier(p_column)} ${p_type || 'TEXT'};`);
        } catch (e) {
          // Column may already exist in SQLite
        }
        return res.json({ data: true, error: null });
      }
      return res.json({ data: true, error: null });
    }

    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    const safeTable = sanitizeIdentifier(table);

    // --- B. SELECT Query ---
    if (action === 'select') {
      let selectCols = '*';
      if (columns && typeof columns === 'string' && columns.trim() !== '*') {
        selectCols = columns.split(',').map(c => {
          const trimmed = c.trim();
          return trimmed === '*' ? '*' : sanitizeIdentifier(trimmed);
        }).join(', ');
      }

      const whereClauses = [];
      const queryParams = [];

      // Equal / Filter clauses
      if (filters && typeof filters === 'object') {
        Object.entries(filters).forEach(([col, val]) => {
          if (val === null) {
            whereClauses.push(`${sanitizeIdentifier(col)} IS NULL`);
          } else if (typeof val === 'object' && val !== null) {
            if (val.op === 'neq') {
              whereClauses.push(`${sanitizeIdentifier(col)} != ?`);
              queryParams.push(prepareSqlParam(val.val));
            } else if (val.op === 'ilike' || val.op === 'like') {
              whereClauses.push(`${sanitizeIdentifier(col)} LIKE ?`);
              queryParams.push(val.val);
            } else if (val.op === 'in' && Array.isArray(val.val)) {
              if (val.val.length === 0) {
                whereClauses.push('1 = 0');
              } else {
                const placeholders = val.val.map(() => '?').join(', ');
                whereClauses.push(`${sanitizeIdentifier(col)} IN (${placeholders})`);
                val.val.forEach(item => queryParams.push(prepareSqlParam(item)));
              }
            } else {
              whereClauses.push(`${sanitizeIdentifier(col)} = ?`);
              queryParams.push(prepareSqlParam(val.val ?? val));
            }
          } else {
            whereClauses.push(`${sanitizeIdentifier(col)} = ?`);
            queryParams.push(prepareSqlParam(val));
          }
        });
      }

      // OR Filters
      if (orFilters && Array.isArray(orFilters) && orFilters.length > 0) {
        const orParts = [];
        orFilters.forEach(f => {
          if (f.op === 'is' || f.val === null) {
            orParts.push(`${sanitizeIdentifier(f.col)} IS NULL`);
          } else if (f.op === 'not_null') {
            orParts.push(`${sanitizeIdentifier(f.col)} IS NOT NULL`);
          } else {
            orParts.push(`${sanitizeIdentifier(f.col)} = ?`);
            queryParams.push(prepareSqlParam(f.val));
          }
        });
        if (orParts.length > 0) {
          whereClauses.push(`(${orParts.join(' OR ')})`);
        }
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Order By
      let orderSql = '';
      if (order && typeof order === 'object' && order.column) {
        const dir = order.ascending === false ? 'DESC' : 'ASC';
        orderSql = `ORDER BY ${sanitizeIdentifier(order.column)} ${dir}`;
      }

      // Limit & Offset
      let limitSql = '';
      if (range && typeof range.from === 'number' && typeof range.to === 'number') {
        const offset = range.from;
        const rowCount = range.to - range.from + 1;
        limitSql = `LIMIT ${rowCount} OFFSET ${offset}`;
      } else if (typeof limit === 'number' && limit > 0) {
        limitSql = `LIMIT ${limit}`;
      }

      const sqlQuery = `SELECT ${selectCols} FROM ${safeTable} ${whereSql} ${orderSql} ${limitSql};`;
      await ensureTableExists(db, table);
      let result;
      try {
        result = await db.execute({ sql: sqlQuery, args: queryParams });
      } catch (selectErr) {
        if (selectErr.message && (selectErr.message.includes('no such table') || selectErr.message.includes('no such column'))) {
          await ensureTableExists(db, table);
          return res.json({ data: [], error: null });
        }
        throw selectErr;
      }
      const rows = (result.rows || []).map(formatOutputRow);
      return res.json({ data: rows, error: null });
    }

    // --- C. UPSERT / INSERT Query (SQLite ON CONFLICT DO UPDATE + Auto-Schema) ---
    if (action === 'upsert' || action === 'insert') {
      const records = Array.isArray(data) ? data : [data];
      if (records.length === 0) return res.json({ data: [], error: null });

      const conflictCol = onConflict || 'id';
      const safeConflictCol = sanitizeIdentifier(conflictCol);

      // Ensure table exists
      await ensureTableExists(db, table, conflictCol);

      for (const record of records) {
        // Auto-generate valid standard UUIDv4 for Primary Key upon every INSERT / UPSERT
        if (!record[conflictCol] || record[conflictCol] === '' || record[conflictCol] === null) {
          record[conflictCol] = crypto.randomUUID();
        }
        if (!record.id || record.id === '' || record.id === null) {
          record.id = crypto.randomUUID();
        }

        // Field aliasing & cross-compatibility across all entities
        if (table === 'invoices') {
          if (record.total !== undefined && record.total_amount === undefined) record.total_amount = record.total;
          if (record.total_amount !== undefined && record.total === undefined) record.total = record.total_amount;
          if (record.discount !== undefined && record.discount_amount === undefined) record.discount_amount = record.discount;
          if (record.discount_amount !== undefined && record.discount === undefined) record.discount = record.discount_amount;
          if (record.paid !== undefined && record.paid_amount === undefined) record.paid_amount = record.paid;
          if (record.paid_amount !== undefined && record.paid === undefined) record.paid = record.paid_amount;
          if (record.remaining !== undefined && record.remaining_amount === undefined) record.remaining_amount = record.remaining;
          if (record.remaining_amount !== undefined && record.remaining === undefined) record.remaining = record.remaining_amount;
          if (record.vatAmount !== undefined && record.vat === undefined) record.vat = record.vatAmount;
        } else if (table === 'products') {
          if (record.categoryId !== undefined && record.category_id === undefined) record.category_id = record.categoryId;
          if (record.category_id !== undefined && record.categoryId === undefined) record.categoryId = record.category_id;
          if (record.category_id === 'all') record.category_id = null;
          if (record.categoryId === 'all') record.categoryId = null;
          if (record.sell_price !== undefined && record.retail_price === undefined) record.retail_price = record.sell_price;
          if (record.retail_price !== undefined && record.sell_price === undefined) record.sell_price = record.retail_price;
          if (record.stock_quantity !== undefined && record.current_stock === undefined) record.current_stock = record.stock_quantity;
          if (record.current_stock !== undefined && record.stock_quantity === undefined) record.stock_quantity = record.current_stock;
          if (record.reorder_limit !== undefined && record.min_stock_alert === undefined) record.min_stock_alert = record.reorder_limit;
          if (record.min_stock_alert !== undefined && record.reorder_limit === undefined) record.reorder_limit = record.min_stock_alert;
        } else if (table === 'clients') {
          if (record.cashback !== undefined && record.cashback_balance === undefined) record.cashback_balance = record.cashback;
          if (record.cashback_balance !== undefined && record.cashback === undefined) record.cashback = record.cashback_balance;
          if (record.birth_date !== undefined && record.dob === undefined) record.dob = record.birth_date;
          if (record.dob !== undefined && record.birth_date === undefined) record.birth_date = record.dob;
        } else if (table === 'promo_codes') {
          if (record.max_uses_total !== undefined && record.usage_limit === undefined) record.usage_limit = record.max_uses_total;
          if (record.usage_limit !== undefined && record.max_uses_total === undefined) record.max_uses_total = record.usage_limit;
          if (record.uses_count !== undefined && record.used_count === undefined) record.used_count = record.uses_count;
          if (record.used_count !== undefined && record.uses_count === undefined) record.uses_count = record.used_count;
        } else if (table === 'promo_code_usages') {
          if (record.discount_applied !== undefined && record.discount_amount === undefined) record.discount_amount = record.discount_applied;
          if (record.discount_amount !== undefined && record.discount_applied === undefined) record.discount_applied = record.discount_amount;
        } else if (table === 'fingerprint_logs') {
          if (record.fingerprintCode !== undefined && record.fingerprint_code === undefined) record.fingerprint_code = record.fingerprintCode;
          if (record.fingerprint_code !== undefined && record.fingerprintCode === undefined) record.fingerprintCode = record.fingerprint_code;
          if (record.processedDate !== undefined && record.processed_date === undefined) record.processed_date = record.processedDate;
          if (record.processed_date !== undefined && record.processedDate === undefined) record.processedDate = record.processed_date;
          if (record.employeeId !== undefined && record.employee_id === undefined) record.employee_id = record.employeeId;
          if (record.employee_id !== undefined && record.employeeId === undefined) record.employeeId = record.employee_id;
          if (record.employeeName !== undefined && record.employee_name === undefined) record.employee_name = record.employeeName;
          if (record.employee_name !== undefined && record.employeeName === undefined) record.employeeName = record.employee_name;
          if (record.deviceIp !== undefined && record.device_ip === undefined) record.device_ip = record.deviceIp;
          if (record.device_ip !== undefined && record.deviceIp === undefined) record.deviceIp = record.device_ip;

          // Auto lookup employee from employees table by fingerprint_code
          const fpCode = record.fingerprint_code || record.fingerprintCode;
          if (fpCode && (!record.employee_id || !record.employee_name)) {
            try {
              const empRes = await db.execute({
                sql: `SELECT id, name FROM employees WHERE fingerprint_code = ? OR fingerprint_code = ? OR id = ? LIMIT 1;`,
                args: [String(fpCode), String(fpCode).trim(), String(fpCode).trim()]
              });
              if (empRes.rows && empRes.rows.length > 0) {
                const row = empRes.rows[0];
                if (!record.employee_id) record.employee_id = row.id;
                if (!record.employee_name) record.employee_name = row.name;
              }
            } catch (e) {}
          }

          // Auto-calculate processed_date if missing
          if (!record.processed_date) {
            const rawTs = record.timestamp || record.log_time || record.logTime;
            const type = record.type || 'check_in';
            if (rawTs) {
              const str = String(rawTs).trim();
              const normalizedType = String(type).toLowerCase().replace('-', '_');
              const isCheckOut = normalizedType === 'check_out' || normalizedType === 'checkout';
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
                  record.processed_date = `${y}-${m}-${dt}`;
                } else {
                  record.processed_date = `${match[1]}-${match[2]}-${match[3]}`;
                }
              } else {
                record.processed_date = str.split('T')[0].split(' ')[0];
              }
            }
          }
        } else if (table === 'branches') {
          if (record.salonId !== undefined && record.salon_id === undefined) record.salon_id = record.salonId;
          if (record.salon_id !== undefined && record.salonId === undefined) record.salonId = record.salon_id;
          if (record.salonCode !== undefined && record.salon_code === undefined) record.salon_code = record.salonCode;
          if (record.vatRate !== undefined && record.vat_rate === undefined) record.vat_rate = record.vatRate;
          if (record.vatEnabled !== undefined && record.vat_enabled === undefined) record.vat_enabled = record.vatEnabled ? 1 : 0;
          if (record.taxNumber !== undefined && record.tax_number === undefined) record.tax_number = record.taxNumber;
          if (record.commercialReg !== undefined && record.commercial_reg === undefined) record.commercial_reg = record.commercialReg;
          if (record.isMain !== undefined && record.is_main === undefined) record.is_main = record.isMain ? 1 : 0;
          if (record.isActive !== undefined && record.is_active === undefined) record.is_active = record.isActive ? 1 : 0;
          if (record.evolutionInstanceName !== undefined && record.evolution_instance_name === undefined) record.evolution_instance_name = record.evolutionInstanceName;
          if (record.storageLimitMb !== undefined && record.storage_limit_mb === undefined) record.storage_limit_mb = record.storageLimitMb;
          if (record.usedStorageBytes !== undefined && record.used_storage_bytes === undefined) record.used_storage_bytes = record.usedStorageBytes;
          if (record.settings && typeof record.settings === 'object') {
            record.settings = JSON.stringify(record.settings);
          }
        } else if (table === 'sales_returns') {
          if (record.salonId !== undefined && record.salon_id === undefined) record.salon_id = record.salonId;
          if (record.branchId !== undefined && record.branch_id === undefined) record.branch_id = record.branchId;
          if (record.returnNumber !== undefined && record.return_number === undefined) record.return_number = record.returnNumber;
          if (record.originalInvoiceId !== undefined && record.original_invoice_id === undefined) record.original_invoice_id = record.originalInvoiceId;
          if (record.originalInvoiceNumber !== undefined && record.original_invoice_number === undefined) record.original_invoice_number = record.originalInvoiceNumber;
          if (record.isGeneralReturn !== undefined && record.is_general_return === undefined) record.is_general_return = record.isGeneralReturn ? 1 : 0;
          if (record.clientId !== undefined && record.client_id === undefined) record.client_id = record.clientId;
          if (record.clientName !== undefined && record.client_name === undefined) record.client_name = record.clientName;
          if (record.clientPhone !== undefined && record.client_phone === undefined) record.client_phone = record.clientPhone;
          if (record.totalRefundAmount !== undefined && record.total_refund_amount === undefined) record.total_refund_amount = record.totalRefundAmount;
          if (record.refundMethod !== undefined && record.refund_method === undefined) record.refund_method = record.refundMethod;
          if (record.treasuryId !== undefined && record.treasury_id === undefined) record.treasury_id = record.treasuryId;
          if (record.treasuryName !== undefined && record.treasury_name === undefined) record.treasury_name = record.treasuryName;
          if (record.reasonText !== undefined && record.reason_text === undefined) record.reason_text = record.reasonText;
          if (record.createdByName !== undefined && record.created_by_name === undefined) record.created_by_name = record.createdByName;
          if (record.createdById !== undefined && record.created_by_id === undefined) record.created_by_id = record.createdById;
          if (record.items && typeof record.items === 'object') {
            record.items = JSON.stringify(record.items);
          }
        } else if (table === 'bookings') {
          if (record.client_name !== undefined && record.customer_name === undefined) record.customer_name = record.client_name;
          if (record.customer_name !== undefined && record.client_name === undefined) record.client_name = record.customer_name;
          if (record.client_phone !== undefined && record.customer_phone === undefined) record.customer_phone = record.client_phone;
          if (record.customer_phone !== undefined && record.client_phone === undefined) record.client_phone = record.customer_phone;
          if (record.total_amount !== undefined && record.total_price === undefined) record.total_price = record.total_amount;
          if (record.total_price !== undefined && record.total_amount === undefined) record.total_amount = record.total_price;
          if (record.time !== undefined && record.start_time === undefined) record.start_time = record.time;
          if (record.start_time !== undefined && record.time === undefined) record.time = record.start_time;
          if (record.services && typeof record.services === 'object') {
            record.services = JSON.stringify(record.services);
          }
          if (record.advance_payments && typeof record.advance_payments === 'object') {
            record.advance_payments = JSON.stringify(record.advance_payments);
          }
        }

        if (table === 'platform_settings') {
          record.data_signature = computePlatformSignature(record);
        }

        const keys = Object.keys(record);
        if (keys.length === 0) continue;

        // Auto-heal: Ensure all columns in this record exist in the SQLite table!
        await ensureColumnsExist(db, table, keys);

        const cols = keys.map(k => sanitizeIdentifier(k));
        const placeholders = keys.map(() => '?');
        const vals = keys.map(k => prepareSqlParam(record[k]));

        const existingCols = await getTableColumns(db, table);
        const hasConflictCol = existingCols.has(conflictCol.toLowerCase());

        let upsertSql = '';
        if (action === 'upsert' && hasConflictCol) {
          if (conflictCol !== 'id') {
            try {
              await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${table}_${conflictCol}" ON ${safeTable}("${safeConflictCol}");`);
            } catch (idxErr) {
              // Ignore if index creation fails; fallback below handles it
            }
          }

          const updateParts = keys
            .filter(k => k !== conflictCol)
            .map(k => `${sanitizeIdentifier(k)} = excluded.${sanitizeIdentifier(k)}`);

          const conflictClause = updateParts.length > 0
            ? `ON CONFLICT(${safeConflictCol}) DO UPDATE SET ${updateParts.join(', ')}`
            : `ON CONFLICT(${safeConflictCol}) DO NOTHING`;

          upsertSql = `
            INSERT INTO ${safeTable} (${cols.join(', ')})
            VALUES (${placeholders.join(', ')})
            ${conflictClause};
          `;
        } else {
          upsertSql = `
            INSERT OR REPLACE INTO ${safeTable} (${cols.join(', ')})
            VALUES (${placeholders.join(', ')});
          `;
        }

        try {
          await db.execute({ sql: upsertSql, args: vals });
        } catch (execErr) {
          const errMsg = execErr && execErr.message ? execErr.message : String(execErr);
          if (errMsg.includes('ON CONFLICT') || errMsg.includes('constraint')) {
            console.warn(`[Auto-Schema Fallback] ON CONFLICT failed on ${table}.${conflictCol}, using resilient SELECT+UPDATE/INSERT fallback:`, errMsg);
            const conflictVal = record[conflictCol];
            let existingRow = null;
            if (conflictVal !== undefined && conflictVal !== null) {
              const checkRes = await db.execute({
                sql: `SELECT ${safeConflictCol} FROM ${safeTable} WHERE ${safeConflictCol} = ? LIMIT 1`,
                args: [conflictVal]
              });
              if (checkRes.rows && checkRes.rows.length > 0) {
                existingRow = checkRes.rows[0];
              }
            }

            if (existingRow) {
              const updateCols = keys.filter(k => k !== conflictCol);
              if (updateCols.length > 0) {
                const setClause = updateCols.map(k => `${sanitizeIdentifier(k)} = ?`).join(', ');
                const updateVals = updateCols.map(k => prepareSqlParam(record[k]));
                updateVals.push(prepareSqlParam(conflictVal));
                await db.execute({
                  sql: `UPDATE ${safeTable} SET ${setClause} WHERE ${safeConflictCol} = ?`,
                  args: updateVals
                });
              }
            } else {
              await db.execute({
                sql: `INSERT INTO ${safeTable} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
                args: vals
              });
            }
          } else {
            throw execErr;
          }
        }
      }

      // Real-time broadcast via WebSockets to ALL connected clients
      broadcastDbChange({
        table,
        action: 'upsert',
        data,
        id: Array.isArray(data) ? data[0]?.id : data?.id
      });

      return res.json({ data, error: null });
    }

    // --- D. UPDATE Query ---
    if (action === 'update') {
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Update data is required' });
      }

      const keys = Object.keys(data);
      if (keys.length === 0) return res.json({ data, error: null });

      // Auto-heal: Ensure all columns being updated exist in the SQLite table!
      await ensureColumnsExist(db, table, keys);

      const updateParams = [];
      const setParts = keys.map(k => {
        updateParams.push(prepareSqlParam(data[k]));
        return `${sanitizeIdentifier(k)} = ?`;
      });

      const whereClauses = [];
      if (filters && typeof filters === 'object') {
        Object.entries(filters).forEach(([col, val]) => {
          if (val === null) {
            whereClauses.push(`${sanitizeIdentifier(col)} IS NULL`);
          } else if (typeof val === 'object' && val !== null) {
            if (val.op === 'neq') {
              whereClauses.push(`${sanitizeIdentifier(col)} != ?`);
              updateParams.push(prepareSqlParam(val.val));
            } else if (val.op === 'in' && Array.isArray(val.val)) {
              if (val.val.length === 0) {
                whereClauses.push('1 = 0');
              } else {
                const placeholders = val.val.map(() => '?').join(', ');
                whereClauses.push(`${sanitizeIdentifier(col)} IN (${placeholders})`);
                val.val.forEach(item => updateParams.push(prepareSqlParam(item)));
              }
            } else {
              whereClauses.push(`${sanitizeIdentifier(col)} = ?`);
              updateParams.push(prepareSqlParam(val.val ?? val));
            }
          } else {
            whereClauses.push(`${sanitizeIdentifier(col)} = ?`);
            updateParams.push(prepareSqlParam(val));
          }
        });
      }

      if (whereClauses.length === 0) {
        return res.status(400).json({ error: 'UPDATE requires at least one filter clause' });
      }

      const updateSql = `UPDATE ${safeTable} SET ${setParts.join(', ')} WHERE ${whereClauses.join(' AND ')};`;
      await db.execute({ sql: updateSql, args: updateParams });

      // Real-time broadcast
      broadcastDbChange({
        table,
        action: 'update',
        data,
        filters
      });

      return res.json({ data, error: null });
    }

    // --- E. DELETE Query ---
    if (action === 'delete') {
      const deleteParams = [];
      const whereClauses = [];

      if (filters && typeof filters === 'object') {
        Object.entries(filters).forEach(([col, val]) => {
          if (val === null) {
            whereClauses.push(`${sanitizeIdentifier(col)} IS NULL`);
          } else if (typeof val === 'object' && val !== null) {
            if (val.op === 'neq') {
              whereClauses.push(`${sanitizeIdentifier(col)} != ?`);
              deleteParams.push(prepareSqlParam(val.val));
            } else if (val.op === 'in' && Array.isArray(val.val)) {
              if (val.val.length === 0) {
                whereClauses.push('1 = 0');
              } else {
                const placeholders = val.val.map(() => '?').join(', ');
                whereClauses.push(`${sanitizeIdentifier(col)} IN (${placeholders})`);
                val.val.forEach(item => deleteParams.push(prepareSqlParam(item)));
              }
            } else {
              whereClauses.push(`${sanitizeIdentifier(col)} = ?`);
              deleteParams.push(prepareSqlParam(val.val ?? val));
            }
          } else {
            whereClauses.push(`${sanitizeIdentifier(col)} = ?`);
            deleteParams.push(prepareSqlParam(val));
          }
        });
      }

      // Support OR Filters in DELETE queries (e.g. held invoices, queue tickets)
      if (orFilters && Array.isArray(orFilters) && orFilters.length > 0) {
        const orParts = [];
        orFilters.forEach(f => {
          if (f.op === 'is' || f.val === null) {
            orParts.push(`${sanitizeIdentifier(f.col)} IS NULL`);
          } else if (f.op === 'not_null') {
            orParts.push(`${sanitizeIdentifier(f.col)} IS NOT NULL`);
          } else {
            orParts.push(`${sanitizeIdentifier(f.col)} = ?`);
            deleteParams.push(prepareSqlParam(f.val));
          }
        });
        if (orParts.length > 0) {
          whereClauses.push(`(${orParts.join(' OR ')})`);
        }
      }

      if (whereClauses.length === 0) {
        return res.status(400).json({ error: 'DELETE requires at least one filter clause' });
      }

      // Fetch IDs being deleted prior to removal for comprehensive real-time broadcast
      let deletedIds = [];
      try {
        const findSql = `SELECT id FROM ${safeTable} WHERE ${whereClauses.join(' AND ')};`;
        const findRes = await db.execute({ sql: findSql, args: deleteParams });
        if (findRes && findRes.rows) {
          deletedIds = findRes.rows.map(r => r.id).filter(Boolean);
        }
      } catch (findErr) {
        // Table might not have 'id' column or another transient schema variation
      }

      const deleteSql = `DELETE FROM ${safeTable} WHERE ${whereClauses.join(' AND ')};`;
      await db.execute({ sql: deleteSql, args: deleteParams });

      const targetId = filters?.id || (deletedIds.length > 0 ? deletedIds[0] : null) || filters?.val || data?.id;

      // Real-time broadcast to all connected devices via WebSockets
      broadcastDbChange({
        table,
        action: 'delete',
        id: targetId,
        ids: deletedIds,
        data: { id: targetId },
        filters,
        orFilters
      });

      if (table === 'app_license') {
        getLicenseInfoFromDb(db).then(lic => {
          broadcastLicenseUpdate({ type: 'license_updated', license: lic });
        }).catch(() => {});
      }

      return res.json({ success: true, error: null, deletedIds });
    }

    return res.status(400).json({ error: `Unsupported action: ${action}` });
  } catch (err) {
    console.error('❌ [libSQL Query Error]:', err.message);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// ==============================================================================
// 6.5. Turso Distributed Cloud Sync & Edge Replica Endpoints (Phase 3 & 4)
// ==============================================================================

// جلب إعدادات وحالة المزامنة السحابية الحالية
app.get('/api/turso/config', (req, res) => {
  try {
    const cfg = cloudConfig.getCloudConfig();
    return res.json({
      success: true,
      config: {
        turso_url: cfg.turso_url || '',
        turso_auth_token: cfg.turso_auth_token ? '••••••••' + cfg.turso_auth_token.slice(-6) : '',
        has_token: Boolean(cfg.turso_auth_token),
        sync_interval: cfg.sync_interval || '5m',
        last_sync_time: cfg.last_sync_time,
        last_sync_status: cfg.last_sync_status || 'disconnected',
        last_sync_error: cfg.last_sync_error,
        is_active: Boolean(cfg.is_active),
        is_replica_mode: isReplicaMode
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// حفظ بيانات الربط وتفعيل وضع العقدة الموزعة المتزامنة (Save & Connect)
app.post('/api/turso/save-connect', async (req, res) => {
  try {
    const { turso_url, turso_auth_token, sync_interval = '5m' } = req.body;

    if (!turso_url || typeof turso_url !== 'string' || !turso_url.trim()) {
      return res.status(400).json({
        success: false,
        error: 'رابط قاعدة بيانات Turso مطلوب (مثال: libsql://my-salon.turso.io)'
      });
    }

    const currentCfg = cloudConfig.getCloudConfig();
    let finalToken = turso_auth_token ? String(turso_auth_token).trim() : '';
    if (!finalToken || finalToken.includes('••••')) {
      finalToken = currentCfg.turso_auth_token || '';
    }

    if (!finalToken) {
      return res.status(400).json({
        success: false,
        error: 'رمز التوثيق (Turso Auth Token) مطلوب للاتصال بالسحابة'
      });
    }

    const cleanUrl = turso_url.trim();

    // 1. حفظ الإعدادات في الملف المحلي الآمن
    cloudConfig.saveCloudConfig({
      turso_url: cleanUrl,
      turso_auth_token: finalToken,
      sync_interval: sync_interval || '5m',
      last_sync_status: 'syncing'
    });

    // 2. إعادة تهيئة اتصال libSQL بالوضع السحابي الموزع Embedded Replica
    getDbClient(true);

    // 3. تنفيذ مزامنة أولية فورية للتحقق من سلامة الاتصال والبيانات
    console.log('🔄 [Turso] Initiating immediate validation sync with Turso cloud...');
    const syncRes = await executeCloudSync('initial_connection');

    if (!syncRes.success && syncRes.error) {
      return res.json({
        success: true,
        warning: true,
        message: `تم حفظ الإعدادات وتفعيل الوضع الموزع، لكن التزامن الفوري أرجع تنبيهاً (تحقق من الإنترنت أو صلاحية الرمز): ${syncRes.error}`,
        config: cloudConfig.getCloudConfig()
      });
    }

    return res.json({
      success: true,
      message: 'تم الاتصال بقاعدة بيانات Turso السحابية بنجاح! يعمل النظام الآن كعقدة متزامنة لحظياً.',
      config: cloudConfig.getCloudConfig()
    });
  } catch (err) {
    console.error('❌ [Turso Connect Endpoint Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'حدث خطأ أثناء الاتصال بقاعدة بيانات Turso'
    });
  }
});

// قطع الاتصال والتحول للوضع المحلي 100% بدون إنترنت (Disconnect / Go Offline)
app.post('/api/turso/disconnect', async (req, res) => {
  try {
    stopBackgroundSyncScheduler();
    cloudConfig.clearCloudConfig();
    getDbClient(true);

    io.emit('db_change', {
      table: '*',
      action: 'sync_mode_changed',
      mode: 'offline',
      timestamp: Date.now()
    });

    return res.json({
      success: true,
      message: 'تم إيقاف المزامنة السحابية والتحول الكامل لوضع العمل المحلي 100% Offline'
    });
  } catch (err) {
    console.error('❌ [Turso Disconnect Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// أمر مزامنة فورية عند الطلب (Sync Now)
app.post('/api/turso/sync-now', async (req, res) => {
  try {
    if (!isReplicaMode) {
      return res.status(400).json({
        success: false,
        error: 'النظام يعمل حالياً بالوضع المحلي Offline. يرجى إدخال بيانات Turso والاتصال أولاً.'
      });
    }

    const syncResult = await executeCloudSync('manual_user_action');
    if (syncResult.success) {
      return res.json({
        success: true,
        message: 'تمت المزامنة اللحظية مع سحابة Turso بنجاح!',
        timestamp: syncResult.timestamp
      });
    } else {
      return res.status(500).json({
        success: false,
        error: syncResult.error || 'تعذر استكمال المزامنة السحابية. يرجى التحقق من اتصال الإنترنت.'
      });
    }
  } catch (err) {
    console.error('❌ [Turso Sync Now Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 7. Advanced Backup Engine & Endpoints (UI + Backend VACUUM INTO)
// ==============================================================================

async function executeDatabaseBackup(triggerType = 'manual') {
  const db = getDbClient();
  
  // 1. Determine target directory from settings or fallback to BACKUPS_DIR
  let targetDir = BACKUPS_DIR;
  try {
    const settingsRes = await db.execute('SELECT backup_dir FROM backup_settings LIMIT 1;');
    if (settingsRes.rows.length > 0 && settingsRes.rows[0].backup_dir) {
      const customDir = String(settingsRes.rows[0].backup_dir).trim();
      if (customDir) {
        if (!fs.existsSync(customDir)) {
          fs.mkdirSync(customDir, { recursive: true });
        }
        targetDir = customDir;
      }
    }
  } catch (e) {}

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tempDbFilename = `temp_snapshot_${timestamp}.db`;
  const tempDbPath = path.join(targetDir, tempDbFilename);
  const zipFilename = `backup_smartcut_${timestamp}.zip`;
  const zipPath = path.join(targetDir, zipFilename);

  console.log(`💾 [Backup] Starting ZIP backup to: ${zipPath} (Trigger: ${triggerType})...`);

  try {
    // 2. Safe SQLite / libSQL snapshot using VACUUM INTO into temporary file
    let dbFileCreated = false;
    try {
      await db.execute(`VACUUM INTO '${tempDbPath.replace(/'/g, "''")}';`);
      dbFileCreated = fs.existsSync(tempDbPath);
    } catch (vacuumErr) {
      console.warn(`⚠️ VACUUM INTO returned (${vacuumErr.message}). Falling back to safe file copy...`);
      const srcUrl = getDbUrl();
      if (srcUrl.startsWith('file:')) {
        const srcPath = srcUrl.replace('file:', '');
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, tempDbPath);
          dbFileCreated = true;
        }
      }
    }

    if (!dbFileCreated) {
      throw new Error('Failed to create consistent database snapshot');
    }

    // 3. Compress the snapshot into a .zip archive to reduce storage footprint
    const zip = new AdmZip();
    zip.addLocalFile(tempDbPath, '', `smartcut_${timestamp}.db`);
    zip.writeZip(zipPath);

    // 4. Remove temporary uncompressed database file immediately
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch (cleanErr) {}

    const stats = fs.existsSync(zipPath) ? fs.statSync(zipPath) : { size: 0 };
    const logId = `LOG-${Date.now()}`;

    await db.execute({
      sql: `INSERT INTO backup_logs (id, filename, filepath, filesize, status, trigger_type)
            VALUES (?, ?, ?, ?, 'success', ?);`,
      args: [logId, zipFilename, zipPath, stats.size, triggerType]
    });

    await db.execute({
      sql: `UPDATE backup_settings SET last_backup_at = datetime('now'), updated_at = datetime('now');`
    });

    console.log(`✅ [Backup] Compressed ZIP backup completed successfully! File: ${zipFilename} (${(stats.size / 1024).toFixed(1)} KB)`);

    broadcastDbChange({
      table: 'backup_logs',
      action: 'insert',
      data: { id: logId, filename: zipFilename, filepath: zipPath, filesize: stats.size, status: 'success', triggerType }
    });

    return {
      success: true,
      filename: zipFilename,
      filepath: zipPath,
      filesize: stats.size,
      createdAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('❌ [Backup Failed]:', err.message);
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch {}
    try {
      await db.execute({
        sql: `INSERT INTO backup_logs (id, filename, filepath, filesize, status, error_message, trigger_type)
              VALUES (?, ?, ?, 0, 'failed', ?, ?);`,
        args: [`LOG-${Date.now()}`, zipFilename, zipPath, err.message, triggerType]
      });
    } catch {}
    throw err;
  }
}

// 7.1 GET Backup Settings
app.get('/api/backup/settings', async (req, res) => {
  try {
    const db = getDbClient();
    const result = await db.execute('SELECT * FROM backup_settings LIMIT 1;');
    if (result.rows.length === 0) {
      return res.json({
        enabled: 1,
        days: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
        scheduleMode: 'frequency',
        frequencyPreset: 'every_6_hours',
        customTimes: ["02:00","14:00","23:00"],
        lastBackupAt: null,
        backupDir: BACKUPS_DIR
      });
    }
    const row = formatOutputRow(result.rows[0]);
    res.json({
      enabled: row.enabled,
      days: row.days || [],
      scheduleMode: row.schedule_mode || 'frequency',
      frequencyPreset: row.frequency_preset || 'every_6_hours',
      customTimes: row.custom_times || [],
      lastBackupAt: row.last_backup_at,
      backupDir: row.backup_dir || BACKUPS_DIR
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7.2 POST Backup Settings
app.post('/api/backup/settings', async (req, res) => {
  try {
    const db = getDbClient();
    const { enabled, days, scheduleMode, frequencyPreset, customTimes, backupDir } = req.body;

    const daysJson = JSON.stringify(days || []);
    const customTimesJson = JSON.stringify(customTimes || []);
    const dirToUse = (backupDir && typeof backupDir === 'string' && backupDir.trim()) ? backupDir.trim() : BACKUPS_DIR;
    const modeToUse = scheduleMode === 'custom_times' ? 'custom_times' : 'frequency';

    // Auto-heal column if missing
    try {
      await db.execute(`ALTER TABLE backup_settings ADD COLUMN schedule_mode TEXT DEFAULT 'frequency';`);
    } catch (e) {}

    await db.execute({
      sql: `INSERT INTO backup_settings (id, salon_id, enabled, days, schedule_mode, frequency_preset, custom_times, backup_dir, updated_at)
            VALUES ('default_backup_settings', '11111111-1111-4111-8111-111111111111', ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              enabled = excluded.enabled,
              days = excluded.days,
              schedule_mode = excluded.schedule_mode,
              frequency_preset = excluded.frequency_preset,
              custom_times = excluded.custom_times,
              backup_dir = excluded.backup_dir,
              updated_at = datetime('now');`,
      args: [enabled ? 1 : 0, daysJson, modeToUse, frequencyPreset || 'every_6_hours', customTimesJson, dirToUse]
    });

    broadcastDbChange({
      table: 'backup_settings',
      action: 'update',
      data: req.body
    });

    res.json({ success: true, message: 'تم حفظ إعدادات النسخ الاحتياطي ومسار التخزين بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7.3 POST Backup Run Now
app.post('/api/backup/run-now', async (req, res) => {
  try {
    const { backupDir } = req.body || {};
    if (backupDir && typeof backupDir === 'string' && backupDir.trim()) {
      const db = getDbClient();
      await db.execute({
        sql: `UPDATE backup_settings SET backup_dir = ?, updated_at = datetime('now') WHERE id = 'default_backup_settings';`,
        args: [backupDir.trim()]
      });
    }
    const result = await executeDatabaseBackup('manual');
    res.json({
      success: true,
      message: 'تم إنشاء النسخة الاحتياطية وضغطها (.zip) بنجاح!',
      backup: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7.4 GET Backup List
app.get('/api/backup/list', async (req, res) => {
  try {
    const db = getDbClient();
    const result = await db.execute('SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 50;');
    
    // Determine target directory
    let targetDir = BACKUPS_DIR;
    try {
      const settingsRes = await db.execute('SELECT backup_dir FROM backup_settings LIMIT 1;');
      if (settingsRes.rows.length > 0 && settingsRes.rows[0].backup_dir) {
        const customDir = String(settingsRes.rows[0].backup_dir).trim();
        if (customDir && fs.existsSync(customDir)) {
          targetDir = customDir;
        }
      }
    } catch (e) {}

    const scannedDirs = [targetDir];
    if (targetDir !== BACKUPS_DIR && fs.existsSync(BACKUPS_DIR)) {
      scannedDirs.push(BACKUPS_DIR);
    }

    const filesMap = new Map();
    scannedDirs.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir)
          .filter(f => f.endsWith('.zip') || f.endsWith('.db') || f.endsWith('.sqlite'))
          .forEach(filename => {
            if (!filesMap.has(filename)) {
              const fPath = path.join(dir, filename);
              const stats = fs.statSync(fPath);
              filesMap.set(filename, {
                filename,
                filepath: fPath,
                filesize: stats.size,
                createdAt: stats.mtime.toISOString(),
                isZip: filename.endsWith('.zip'),
                status: 'success'
              });
            }
          });
      } catch (e) {}
    });

    const files = Array.from(filesMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      logs: result.rows.map(formatOutputRow),
      files
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7.5 GET Download Backup File
app.get('/api/backup/download/:filename', async (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const db = getDbClient();

    let targetDir = BACKUPS_DIR;
    try {
      const settingsRes = await db.execute('SELECT backup_dir FROM backup_settings LIMIT 1;');
      if (settingsRes.rows.length > 0 && settingsRes.rows[0].backup_dir) {
        const customDir = String(settingsRes.rows[0].backup_dir).trim();
        if (customDir && fs.existsSync(customDir)) {
          targetDir = customDir;
        }
      }
    } catch (e) {}

    let filePath = path.join(targetDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(BACKUPS_DIR, safeFilename);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'ملف النسخة الاحتياطية غير موجود' });
    }

    res.download(filePath, safeFilename);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 8. Background Scheduler Worker for Backups (Accurate Mutual Exclusion)
// ==============================================================================
let lastRunMinute = -1;

setInterval(async () => {
  try {
    const now = new Date();
    const currentMinute = now.getMinutes();
    if (currentMinute === lastRunMinute) return;
    lastRunMinute = currentMinute;

    const db = getDbClient();
    const res = await db.execute('SELECT * FROM backup_settings LIMIT 1;');
    if (res.rows.length === 0) return;

    const settings = formatOutputRow(res.rows[0]);
    if (!settings.enabled) return;

    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = daysMap[now.getDay()];
    const configuredDays = settings.days || [];

    if (!configuredDays.includes(currentDayName)) return;

    const currentHourStr = String(now.getHours()).padStart(2, '0');
    const currentMinStr = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHourStr}:${currentMinStr}`;

    const mode = settings.schedule_mode || 'frequency';
    let isDue = false;

    // Mutually exclusive scheduler execution
    if (mode === 'custom_times') {
      // 1. Mapped exclusively to exact scheduled times
      const customTimes = settings.custom_times || [];
      if (customTimes.includes(currentTimeStr)) {
        isDue = true;
      }
    } else {
      // 2. Mapped exclusively to frequency intervals
      const preset = settings.frequency_preset || 'every_6_hours';
      if (preset === 'every_1_hour' && currentMinStr === '00') isDue = true;
      if (preset === 'every_3_hours' && now.getHours() % 3 === 0 && currentMinStr === '00') isDue = true;
      if (preset === 'every_6_hours' && now.getHours() % 6 === 0 && currentMinStr === '00') isDue = true;
      if (preset === 'every_12_hours' && now.getHours() % 12 === 0 && currentMinStr === '00') isDue = true;
      if (preset === 'once_a_day' && currentTimeStr === '03:00') isDue = true;
    }

    if (isDue) {
      console.log(`⏰ [Scheduler] Automatic backup triggered at ${currentTimeStr} (${currentDayName}, Mode: ${mode})...`);
      await executeDatabaseBackup('scheduled');
    }
  } catch (err) {
    console.warn('⚠️ [Scheduler Worker Notice]:', err.message);
  }
}, 60000); // Check every minute

// ==============================================================================
// 9. Storage Upload Endpoint (Offline Image Engine)
// ==============================================================================
app.post('/api/storage/upload', async (req, res) => {
  try {
    const { bucket, path: relPath, base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: { message: 'Missing base64Data' } });
    }

    const bucketDir = path.join(UPLOADS_DIR, bucket || 'services');
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }

    const safeRelPath = (relPath || `file_${Date.now()}.png`).replace(/\.\./g, '');
    const targetFilePath = path.join(bucketDir, safeRelPath);

    const targetSubDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetSubDir)) {
      fs.mkdirSync(targetSubDir, { recursive: true });
    }

    const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64Data, 'base64');

    fs.writeFileSync(targetFilePath, buffer);

    const publicUrl = `/uploads/${bucket || 'services'}/${safeRelPath}`;
    res.json({
      data: { path: safeRelPath, fullPath: publicUrl },
      publicUrl: publicUrl,
      error: null
    });
  } catch (err) {
    console.error('Local Storage upload error:', err);
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// ==============================================================================
// 10. Thermal Printing Handler
// ==============================================================================
app.post('/api/printer/print-receipt', async (req, res) => {
  try {
    const { html, printerName } = req.body;
    if (!html) {
      return res.status(400).json({ success: false, message: 'HTML content is required' });
    }

    const tempFile = path.join(os.tmpdir(), `smartcut_receipt_${Date.now()}.html`);
    const fullHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>طباعة الفاتورة</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
    body { width: 72mm; margin: 0 auto; padding: 2mm; background: #fff; color: #000; direction: rtl; }
    @media print { body { width: 72mm; margin: 0 auto; padding: 0; } }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    fs.writeFileSync(tempFile, fullHtml, 'utf8');

    // Locate browser executable on Windows (Edge / Chrome)
    const browserCandidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];
    const browserPath = browserCandidates.find(p => fs.existsSync(p)) || 'msedge';

    const cleanPrinter = (printerName && typeof printerName === 'string') ? printerName.trim() : '';
    const printerArgs = cleanPrinter
      ? `'--headless', '--disable-gpu', '--run-all-compositor-stages-before-draw', '--print-to-printer', '--print-to-printer-name=\"${cleanPrinter.replace(/'/g, "''")}\"', '${tempFile.replace(/'/g, "''")}'`
      : `'--headless', '--disable-gpu', '--run-all-compositor-stages-before-draw', '--print-to-printer', '${tempFile.replace(/'/g, "''")}'`;

    const printCmd = `powershell -NoProfile -Command "Start-Process -FilePath '${browserPath.replace(/'/g, "''")}' -ArgumentList ${printerArgs} -NoNewWindow"`;
    const { exec } = require('child_process');
    exec(printCmd, (error) => {
      setTimeout(() => {
        try { fs.unlinkSync(tempFile); } catch {}
      }, 10000);

      if (error) {
        console.warn('⚠️ Server direct print notice:', error.message);
        return res.json({ success: false, error: error.message });
      }
      console.log('✅ [Server Print] Silent print job executed successfully on main PC printer:', cleanPrinter || 'Default Printer');
      res.json({ success: true });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 11. System Health & Info
// ==============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'offline_libsql',
    databaseUrl: getDbUrl(),
    serverTime: new Date().toISOString()
  });
});

app.get('/api/system/network-info', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          ips.push({
            name,
            address: iface.address
          });
        }
      }
    }
    const currentPort = parseInt(process.env.PORT || '3001', 10);
    res.json({
      success: true,
      hostname: os.hostname(),
      port: currentPort,
      frontendDevPort: 3000,
      ips: ips.map(i => i.address),
      interfaces: ips,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 11. Dynamic Database-Backed License Engine & Real-Time SSE Streams
// ==============================================================================
const sseClients = new Set();

function handleSseConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
}

function broadcastLicenseUpdate(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch {}
  }
  if (io) {
    try { io.emit('license_updated', data); } catch {}
  }
}

async function getLicenseInfoFromDb(db) {
  const machineCode = licenseHelper && typeof licenseHelper.getMachineCode === 'function'
    ? licenseHelper.getMachineCode()
    : 'APP-LOCAL-OFFLINE';
  const now = Date.now();

  try {
    // ضمان وجود كافة الأعمدة في جدول الترخيص
    try { await db.execute("ALTER TABLE app_license ADD COLUMN activated_at TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE app_license ADD COLUMN license_type TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE app_license ADD COLUMN machine_code TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE app_license ADD COLUMN signature TEXT;"); } catch (e) {}

    const res = await db.execute("SELECT * FROM app_license LIMIT 1;");
    const record = res.rows && res.rows[0];

    // استخراج عدد الموظفين الفعلي في المنظومة
    let currentEmployeeCount = 0;
    try {
      const empRes = await db.execute("SELECT COUNT(*) AS total FROM employees WHERE is_active = 1 OR is_active IS NULL;");
      currentEmployeeCount = Number(empRes.rows[0]?.total || 0);
    } catch {}

    // إذا تم حذف سطر الترخيص من قاعدة البيانات أو لم يكن هناك أي سطر مسجل
    if (!record || !record.id) {
      return {
        isLicensed: false,
        mode: 'none',
        status: 'unlicensed',
        machineCode,
        daysLeft: 0,
        runsLeft: null,
        maxEmployees: null,
        currentEmployeeCount,
        expiryDate: null,
        message: '⚠️ لا يوجد ترخيص مسجل للنظام (غير مرخص). يرجى إدخال كود التفعيل لتشغيل المنظومة.'
      };
    }

    // 1. فحص التشفير وبصمة كود الترخيص مقابل عتاد الجهاز (Hardware Fingerprint Validation)
    const rawKey = String(record.license_key || '').trim().toUpperCase();

    // إذا كان الترخيص هو الكود التجريبي الافتراضي القديم، يتم حذفه فوراً ليطلب التفعيل كجهاز جديد
    if (rawKey === 'PRO-LIFETIME-OFFLINE-2026') {
      try { await db.execute("DELETE FROM app_license WHERE id = 'primary_license';"); } catch (e) {}
      return {
        isLicensed: false,
        mode: 'none',
        status: 'unlicensed',
        machineCode,
        daysLeft: 0,
        runsLeft: null,
        maxEmployees: null,
        currentEmployeeCount,
        expiryDate: null,
        message: '⚠️ لا يوجد ترخيص مسجل للنظام (غير مرخص). يرجى إدخال كود التفعيل لتشغيل المنظومة.'
      };
    }
    const verifyResult = licenseHelper ? licenseHelper.verifyLicenseKey(machineCode, rawKey) : { valid: false };

    const recordedEmployees = Number(record.max_employees) || null;

    if (!verifyResult || !verifyResult.valid) {
      return {
        isLicensed: false,
        mode: 'none',
        status: 'tampered',
        machineCode,
        daysLeft: 0,
        runsLeft: null,
        maxEmployees: recordedEmployees,
        currentEmployeeCount,
        expiryDate: null,
        message: '⚠️ كود الترخيص المسجل في قاعدة البيانات غير صالح لهذا الجهاز أو تم التلاعب به!'
      };
    }

    // 2. التحقق من التوقيع الرقمي للسطر (HMAC Anti-Tamper Row Signature)
    // يمنع نهائياً تعديل عدد الموظفين أو مدة الصلاحية أو نوع الاشتراك يدوياً في قاعدة البيانات
    if (record.signature && licenseHelper && typeof licenseHelper.computeLicenseSignature === 'function') {
      const expectedSig = licenseHelper.computeLicenseSignature(
        machineCode,
        rawKey,
        record.license_type,
        record.max_employees,
        record.activated_at,
        record.expires_at,
        record.runs_remaining
      );
      if (expectedSig !== record.signature) {
        console.warn('🚨 [Tamper Alert] License signature mismatch in database!');
        return {
          isLicensed: false,
          mode: record.license_type,
          status: 'tampered',
          machineCode,
          daysLeft: 0,
          runsLeft: null,
          maxEmployees: recordedEmployees,
          currentEmployeeCount,
          expiryDate: null,
          message: '⚠️ تم رصد تعديل يدوي أو عدم تطابق ببيانات الترخيص في قاعدة البيانات!'
        };
      }
    }

    // 3. فرض القيم المشفرة الأصلية المستخرجة من الكود وليس من قيم الأعمدة المعدلة في SQLite
    // لو تم تعديل سقف الموظفين أو نوع الترخيص في جدول SQLite، السيرفر يفرض القيمة المشفرة في الكود
    const licenseType = verifyResult.type || record.license_type || 'lifetime';
    const maxEmployees = typeof verifyResult.maxEmployees === 'number' ? verifyResult.maxEmployees : (Number(record.max_employees) || null);
    const empSuffix = maxEmployees ? ` (باقة ${maxEmployees} موظفين)` : '';

    // 4. فحص التلاعب بساعة وتاريخ النظام (Anti-Clock Tampering) مع سماحية 48 ساعة لتفادي أي فروق في التوقيت الصيفي أو ضبط ساعة الويندوز
    const recordedMaxSeen = Number(record.max_seen_timestamp) || 0;
    const TAMPER_THRESHOLD_MS = 48 * 60 * 60 * 1000;
    if (recordedMaxSeen > 0 && now < (recordedMaxSeen - TAMPER_THRESHOLD_MS)) {
      return {
        isLicensed: false,
        mode: licenseType,
        status: 'tampered',
        machineCode,
        daysLeft: 0,
        runsLeft: 0,
        maxEmployees,
        currentEmployeeCount,
        expiryDate: record.expires_at,
        message: '⚠️ تم رصد تأخير أو تلاعب بساعة وتاريخ النظام (أكثر من 48 ساعة)! يرجى ضبط توقيت الجهاز بدقة أو إدخال كود تفعيل معتمد.'
      };
    }

    // تحديث العلامة المائية للوقت دورياً للأمام
    if (now > recordedMaxSeen) {
      db.execute({
        sql: "UPDATE app_license SET max_seen_timestamp = ? WHERE id = 'primary_license';",
        args: [now]
      }).catch(() => {});
    }

    // 5. استعادة الحالة التلقائية (Self-Healing) إذا كانت مسجلة سابقاً كتلاعب والتوقيت الحالي سليم
    if (record.status === 'tampered') {
      const isClockNormal = !recordedMaxSeen || now >= (recordedMaxSeen - TAMPER_THRESHOLD_MS);
      if (isClockNormal) {
        await db.execute({
          sql: "UPDATE app_license SET status = 'active', max_seen_timestamp = ? WHERE id = 'primary_license';",
          args: [now]
        }).catch(() => {});
        record.status = 'active';
        console.log('✅ [License Engine] Auto-healed license status back to active.');
      }
    }

    // 6. فحص الحالة المسجلة
    if (record.status !== 'active') {
      return {
        isLicensed: false,
        mode: licenseType,
        status: record.status,
        machineCode,
        daysLeft: 0,
        runsLeft: 0,
        maxEmployees,
        currentEmployeeCount,
        expiryDate: record.expires_at,
        message: record.status === 'tampered'
          ? '⚠️ تم رصد تلاعب ببيانات الترخيص! المنظومة متوقفة في وضع القراءة فقط.'
          : '⚠️ انتهت صلاحية ترخيص النظام.'
      };
    }

    // أ. ترخيص دائم مدى الحياة (Lifetime)
    if (licenseType === 'lifetime' || licenseType === 'lifetime_pro') {
      return {
        isLicensed: true,
        mode: 'lifetime',
        status: 'active',
        plan: 'Lifetime Pro',
        machineCode,
        daysLeft: null,
        runsLeft: null,
        expiryDate: null,
        maxEmployees,
        currentEmployeeCount,
        message: `مرخص رسمياً مدى الحياة 👑${empSuffix}`
      };
    }

    // ب. ترخيص بعدد مرات التشغيل (Runs)
    if (licenseType === 'runs') {
      const currentRuns = Number(record.runs_remaining || 0);
      if (currentRuns <= 0) {
        return {
          isLicensed: false,
          mode: 'runs',
          status: 'expired',
          machineCode,
          daysLeft: 0,
          runsLeft: 0,
          expiryDate: null,
          maxEmployees,
          currentEmployeeCount,
          message: 'انتهت عدد مرات تشغيل البرنامج المسموح بها. يرجى إدخال كود ترخيص جديد للتفعيل.'
        };
      }
      return {
        isLicensed: true,
        mode: 'runs',
        status: 'active',
        machineCode,
        daysLeft: null,
        runsLeft: currentRuns,
        expiryDate: null,
        maxEmployees,
        currentEmployeeCount,
        message: `متبقي ${currentRuns} تشغيلة 🚀${empSuffix}`
      };
    }

    // ج. ترخيص محدد بالأيام (Days)
    // التحقق الصارم من أن تاريخ الانتهاء لا يتجاوز مدة الكود المصرح بها
    if (verifyResult.days && record.activated_at) {
      const activatedTimestamp = new Date(record.activated_at).getTime();
      const maxAllowedExpiry = activatedTimestamp + (verifyResult.days * 24 * 60 * 60 * 1000) + TAMPER_THRESHOLD_MS;
      const actualExpiry = record.expires_at ? new Date(record.expires_at).getTime() : 0;
      if (actualExpiry > maxAllowedExpiry) {
        console.warn('🚨 [Tamper Alert] Expiry date manipulated beyond key days limit!');
        return {
          isLicensed: false,
          mode: licenseType,
          status: 'tampered',
          machineCode,
          daysLeft: 0,
          runsLeft: null,
          maxEmployees,
          currentEmployeeCount,
          expiryDate: record.expires_at,
          message: '⚠️ تم رصد تلاعب بتاريخ انتهاء الاشتراك في قاعدة البيانات!'
        };
      }
    }

    const expiryTimestamp = record.expires_at ? new Date(record.expires_at).getTime() : 0;
    const msRemaining = expiryTimestamp - now;
    const daysLeft = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    if (daysLeft <= 0 || msRemaining <= 0) {
      return {
        isLicensed: false,
        mode: licenseType,
        status: 'expired',
        machineCode,
        daysLeft: 0,
        runsLeft: null,
        expiryDate: record.expires_at,
        maxEmployees,
        currentEmployeeCount,
        message: 'انتهت فترة الترخيص المحددة بالأيام. يرجى إدخال كود تفعيل جديد لتجديد وتمديد الاشتراك.'
      };
    }

    return {
      isLicensed: true,
      mode: licenseType,
      status: 'active',
      machineCode,
      daysLeft,
      runsLeft: null,
      expiryDate: record.expires_at,
      maxEmployees,
      currentEmployeeCount,
      message: `متبقي ${daysLeft} يوم 📅${empSuffix}`
    };
  } catch (err) {
    console.error('Error fetching license info from db:', err.message);
    return {
      isLicensed: false,
      mode: 'none',
      status: 'unlicensed',
      machineCode,
      daysLeft: 0,
      runsLeft: null,
      maxEmployees: null,
      currentEmployeeCount: 0,
      message: err.message
    };
  }
}

app.get('/api/license/stream', handleSseConnection);
app.get('/api/realtime/stream', handleSseConnection);

app.get('/api/server-info', async (req, res) => {
  try {
    const db = getDbClient();
    const licenseInfo = await getLicenseInfoFromDb(db);
    res.json({
      status: 'ok',
      mode: 'offline_libsql',
      serverTime: new Date().toISOString(),
      license: licenseInfo
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/license/check', async (req, res) => {
  try {
    const db = getDbClient();
    const licenseInfo = await getLicenseInfoFromDb(db);
    res.json({ success: true, license: licenseInfo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/test-connection', async (req, res) => {
  try {
    const db = getDbClient();
    const result = await db.execute("SELECT 1 AS ok, datetime('now') AS serverTime;");
    res.json({
      success: true,
      message: 'تم الاتصال بقاعدة بيانات libSQL بنجاح! ✅',
      dbUrl: getDbUrl(),
      serverTime: result.rows[0]?.serverTime
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `فشل الاتصال بـ libSQL: ${err.message}` });
  }
});

app.post('/api/license/activate', async (req, res) => {
  try {
    const licenseKey = req.body.licenseKey || req.body.code;
    if (!licenseKey) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال كود التفعيل' });
    }
    const cleanKey = String(licenseKey).trim().toUpperCase();
    const machineCode = licenseHelper && typeof licenseHelper.getMachineCode === 'function'
      ? licenseHelper.getMachineCode()
      : 'APP-LOCAL-OFFLINE';

    if (!licenseHelper || typeof licenseHelper.verifyLicenseKey !== 'function') {
      return res.status(500).json({ success: false, message: 'محرك التحقق من كود الترخيص غير متاح' });
    }

    const verifyResult = licenseHelper.verifyLicenseKey(machineCode, cleanKey);
    if (!verifyResult.valid) {
      return res.status(400).json({ success: false, message: verifyResult.error || 'كود التفعيل غير صالح لهذا الجهاز' });
    }

    const db = getDbClient();

    // 1. فحص هل تم استخدام هذا الكود سابقاً في قاعدة البيانات (app_used_licenses)
    await db.execute(`CREATE TABLE IF NOT EXISTS app_used_licenses (
      license_key TEXT PRIMARY KEY,
      machine_code TEXT,
      license_type TEXT,
      value_amount REAL,
      max_employees INTEGER,
      used_at TEXT DEFAULT (datetime('now'))
    );`);

    const usedCheck = await db.execute({
      sql: 'SELECT license_key FROM app_used_licenses WHERE license_key = ? LIMIT 1;',
      args: [cleanKey]
    });
    if (usedCheck.rows && usedCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: '⛔ عذراً، تم استخدام كود التفعيل هذا مسبقاً! كل كود تفعيل صالح للاستخدام مرة واحدة فقط ولا يمكن تكراره.'
      });
    }

    // 2. فحص هل تم استخدام هذا الكود مسبقاً في المخزن الأمني المشفر لنظام التشغيل (Secondary Store)
    // يضمن عدم إمكانية إعادة استخدام نفس الكود حتى لو قام المستخدم بحذف قاعدة البيانات أو تفريغ جدول app_used_licenses
    if (licenseHelper.isKeyUsedInPersistedStore && licenseHelper.isKeyUsedInPersistedStore(cleanKey)) {
      return res.status(400).json({
        success: false,
        message: '⛔ عذراً، تم استهلاك هذا الكود مسبقاً على هذا الجهاز! يرجى الحصول على كود تفعيل جديد من موفر النظام.'
      });
    }

    // 3. فحص هل الكود المدخل هو نفس الكود النشط حالياً في النظام
    const curRes = await db.execute("SELECT license_key FROM app_license WHERE id = 'primary_license' LIMIT 1;");
    if (curRes.rows && curRes.rows[0]?.license_key && curRes.rows[0].license_key.trim().toUpperCase() === cleanKey) {
      return res.status(400).json({
        success: false,
        message: '⛔ هذا الكود مفعل حالياً في النظام بالفعل، ولا يمكن تكراره لتمديد المدة.'
      });
    }

    const now = Date.now();
    const activatedAt = new Date().toISOString();
    const newType = verifyResult.type;
    const newMaxEmployees = typeof verifyResult.maxEmployees === 'number' ? verifyResult.maxEmployees : null;
    let newExpiresAt = null;
    let newRuns = null;

    if (newType === 'days') {
      newExpiresAt = new Date(now + verifyResult.days * 24 * 60 * 60 * 1000).toISOString();
    } else if (newType === 'runs') {
      newRuns = verifyResult.runs;
    }

    // 4. توليد التوقيع الرقمي المشفر لسطر الترخيص (Anti-Tamper Signature)
    const rowSignature = licenseHelper.computeLicenseSignature
      ? licenseHelper.computeLicenseSignature(
          machineCode,
          cleanKey,
          newType,
          newMaxEmployees,
          activatedAt,
          newExpiresAt,
          newRuns
        )
      : null;

    // تسجيل الكود في جدول المفاتيح المستهلكة بقاعدة البيانات
    await db.execute({
      sql: `INSERT INTO app_used_licenses (license_key, machine_code, license_type, value_amount, max_employees)
            VALUES (?, ?, ?, ?, ?);`,
      args: [cleanKey, machineCode, newType, newType === 'days' ? verifyResult.days : (newType === 'runs' ? verifyResult.runs : null), newMaxEmployees]
    });

    // تسجيل الكود في المخزن المشفر الثانوي لنظام التشغيل
    if (licenseHelper.persistUsedKey) {
      licenseHelper.persistUsedKey(cleanKey, machineCode, {
        type: newType,
        maxEmployees: newMaxEmployees,
        days: verifyResult.days,
        runs: verifyResult.runs
      });
    }

    // ضمان وجود كافة الأعمدة المطلوبة في جدول app_license لمنع أي خطأ SQL
    try { await db.execute("ALTER TABLE app_license ADD COLUMN activated_at TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE app_license ADD COLUMN license_type TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE app_license ADD COLUMN machine_code TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE app_license ADD COLUMN signature TEXT;"); } catch (e) {}

    // حفظ الترخيص مع التوقيع الرقمي وعلامة الوقت في app_license
    await db.execute({
      sql: `INSERT INTO app_license (id, machine_code, license_type, license_key, status, plan, max_employees, max_branches, activated_at, expires_at, runs_remaining, max_seen_timestamp, signature, is_active, updated_at)
            VALUES ('primary_license', ?, ?, ?, 'active', ?, ?, 99, ?, ?, ?, ?, ?, 1, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              machine_code = excluded.machine_code,
              license_type = excluded.license_type,
              license_key = excluded.license_key,
              status = 'active',
              plan = excluded.plan,
              max_employees = excluded.max_employees,
              activated_at = excluded.activated_at,
              expires_at = excluded.expires_at,
              runs_remaining = excluded.runs_remaining,
              max_seen_timestamp = excluded.max_seen_timestamp,
              signature = excluded.signature,
              is_active = 1,
              updated_at = datetime('now');`,
      args: [machineCode, newType, cleanKey, newType, newMaxEmployees, activatedAt, newExpiresAt, newRuns, now, rowSignature]
    });

    const updatedLicense = await getLicenseInfoFromDb(db);
    broadcastLicenseUpdate({ type: 'license_updated', license: updatedLicense });

    res.json({
      success: true,
      message: `تم تفعيل ترخيص المنظومة بنجاح! [${verifyResult.label || 'مرخص'}]`,
      license: updatedLicense
    });
  } catch (err) {
    console.error('License activate error:', err);
    res.status(500).json({ success: false, message: `فشل حفظ التفعيل في قاعدة البيانات: ${err.message}` });
  }
});

// ==============================================================================
// 12. Static Hosting for Frontend Application
// ==============================================================================
const DIST_DIR = process.env.SMARTCUT_DIST_DIR || path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
  });
}

// ==============================================================================
// 13. Server Lifecycle (Start / Stop)
// ==============================================================================
let serverInstance = null;

async function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const listenPort = port || PORT;

    serverInstance = httpServer.listen(listenPort, HOST, () => {
      console.log(`=======================================================`);
      console.log(`🚀 خادم Smart Cut POS يعمل بنجاح (libSQL + WebSockets)`);
      console.log(`🏠 محلياً على هذا الجهاز: http://localhost:${listenPort}`);
      try {
        const interfaces = os.networkInterfaces();
        const lanIps = [];
        for (const name of Object.keys(interfaces)) {
          for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
              lanIps.push({ name, ip: iface.address });
            }
          }
        }
        if (lanIps.length > 0) {
          console.log(`📲 عبر الشبكة الداخلية (للأجهزة الأخرى والتابلت):`);
          lanIps.forEach(item => {
            console.log(`   👉 http://${item.ip}:${listenPort} (${item.name})`);
          });
        }
      } catch (e) {}
      console.log(`💾 قاعدة البيانات: ${getDbUrl()}`);
      console.log(`⚡ المزامنة اللحظية (WebSockets): مفعلة`);
      console.log(`📂 مجلد النسخ الاحتياطية: ${BACKUPS_DIR}`);
      console.log(`📂 مجلد المرفقات: ${UPLOADS_DIR}`);
      console.log(`=======================================================`);

      ensureDatabaseSchema().then(() => {
        resolve(serverInstance);
      }).catch(err => {
        console.error('❌ Database schema init notice:', err);
        resolve(serverInstance);
      });
    });

    serverInstance.on('error', (err) => {
      console.error('❌ Server listen error:', err);
      reject(err);
    });
  });
}

function stopServer() {
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch {}
    serverInstance = null;
  }
}

if (require.main === module) {
  startServer(PORT).catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = { app, httpServer, io, startServer, stopServer, getDbClient, executeDatabaseBackup };
