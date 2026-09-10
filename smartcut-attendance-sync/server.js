import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { ZKClient } from './zkDriver.js';
import { HikvisionClient } from './hikvisionDriver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Default initial config
const defaultConfig = {
  supabaseUrl: 'https://api.101488.xyz',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjcyNTMxMjAwLCJleHAiOjE5ODgxNTA0MDB9.vW9qTGUVdfudKMLfAqHL78-QAtSMs58uNMlP-6dyySw',
  salonId: '',
  branchId: '',
  deviceBrand: 'zkteco', // 'zkteco' | 'hikvision'
  deviceIp: '192.168.1.201',
  devicePort: 4370,
  deviceUsername: 'admin',
  devicePassword: '',
  syncIntervalMinutes: 5, // Auto-sync interval
  isAutoSyncEnabled: true,
  
  // Custom Time Window Rule for In/Out Auto Classification
  useTimeWindowRules: true,
  checkInStartHour: '07:00',  // 7:00 AM
  checkInEndHour: '19:00',    // 7:00 PM (Between 07:00 and 19:00 => check_in)
                              // (Between 19:00 and 07:00 => check_out)
  deviceModePriority: 'time_window', // 'time_window' | 'device_status' | 'always_check_in'
  lastSyncTime: null,
  lastSyncStatus: 'جاهز للعمل'
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to read config file:', err);
  }
  return { ...defaultConfig };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config file:', err);
  }
}

let currentConfig = loadConfig();
let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && currentConfig.supabaseUrl && currentConfig.supabaseKey) {
    supabaseClient = createClient(currentConfig.supabaseUrl, currentConfig.supabaseKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}

// In-memory sync log for GUI display
const syncLogs = [];
function addLog(message, type = 'info') {
  const time = new Date().toLocaleTimeString('ar-EG');
  const entry = { time, message, type };
  syncLogs.unshift(entry);
  if (syncLogs.length > 100) syncLogs.pop();
  console.log(`[${time}] [${type.toUpperCase()}] ${message}`);
}

/**
 * Determine if a timestamp should be classified as check_in or check_out
 * based on user's customizable time window:
 * e.g. From 07:00 to 19:00 => check_in
 *      From 19:00 to 07:00 => check_out
 */
function classifyLogType(timestampStr, deviceVerifyState, config) {
  if (config.deviceModePriority === 'device_status' && deviceVerifyState !== undefined) {
    // 0 = check_in, 1 = check_out in standard ZK/Hikvision
    return (deviceVerifyState === 1 || deviceVerifyState === 'check_out') ? 'check_out' : 'check_in';
  }

  if (!config.useTimeWindowRules) {
    return (deviceVerifyState === 1 || deviceVerifyState === 'check_out') ? 'check_out' : 'check_in';
  }

  try {
    const d = new Date(timestampStr);
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const curMin = hours * 60 + minutes;

    const [inStartH, inStartM] = (config.checkInStartHour || '07:00').split(':').map(Number);
    const [inEndH, inEndM] = (config.checkInEndHour || '19:00').split(':').map(Number);

    const startMin = (inStartH || 0) * 60 + (inStartM || 0);
    const endMin = (inEndH || 0) * 60 + (inEndM || 0);

    if (startMin <= endMin) {
      // Normal range: e.g. 07:00 (420) to 19:00 (1140)
      if (curMin >= startMin && curMin < endMin) {
        return 'check_in';
      } else {
        return 'check_out';
      }
    } else {
      // Inverted range across midnight: e.g. 20:00 to 08:00
      if (curMin >= startMin || curMin < endMin) {
        return 'check_in';
      } else {
        return 'check_out';
      }
    }
  } catch {
    return 'check_in';
  }
}

/**
 * Core Sync Function: Pull logs from device, filter duplicates in Supabase, and upload
 */
async function performSync(fromDateStr = null, toDateStr = null) {
  const config = currentConfig;
  if (!config.salonId) {
    throw new Error('يرجى تحديد كود الصالون (Salon ID) أولاً من الإعدادات لمنع خلط البيانات.');
  }

  const sb = getSupabase();
  if (!sb) {
    throw new Error('تعذر الاتصال بقاعدة بيانات Supabase، تأكد من صحة الرابط والمفتاح.');
  }

  // 1. Determine Target Date Range
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const startDay = fromDateStr || todayStr;
  const endDay = toDateStr || todayStr;

  const startIso = `${startDay}T00:00:00`;
  const endIso = `${endDay}T23:59:59`;

  addLog(`بدء مزامنة البصمات من جهاز (${config.deviceBrand}) للفترة من ${startDay} إلى ${endDay}...`, 'info');

  // 2. Fetch Employees from Supabase to map fingerprint_code -> employee_id & employee_name
  const { data: employees, error: empErr } = await sb
    .from('employees')
    .select('id, name, fingerprint_code, salon_id, branch_id')
    .eq('salon_id', config.salonId);

  if (empErr) {
    addLog(`تنبيه: تعذر جلب قائمة الموظفين (${empErr.message}). سيتم تسجيل البصمة برقم الكود.`, 'warn');
  }

  const empMap = new Map();
  (employees || []).forEach(emp => {
    if (emp.fingerprint_code) empMap.set(String(emp.fingerprint_code).trim(), emp);
    // Also fallback map by last 4 chars or pure numeric ID
    empMap.set(String(emp.id).trim(), emp);
  });

  // 3. Connect to Hardware Device and Pull Logs
  let rawLogs = [];
  if (config.deviceBrand === 'zkteco') {
    const zk = new ZKClient(config.deviceIp, config.devicePort);
    try {
      addLog(`جاري الاتصال بجهاز ZKTeco على ${config.deviceIp}:${config.devicePort}...`, 'info');
      await zk.connect();
      rawLogs = await zk.getAttendanceLogs();
      await zk.disconnect();
    } catch (err) {
      if (zk) await zk.disconnect().catch(() => {});
      throw new Error(`خطأ اتصال بجهاز ZKTeco: ${err.message}`);
    }
  } else if (config.deviceBrand === 'hikvision') {
    const hik = new HikvisionClient(config.deviceIp, config.devicePort, config.deviceUsername, config.devicePassword);
    try {
      addLog(`جاري الاتصال بجهاز Hikvision على ${config.deviceIp}:${config.devicePort}...`, 'info');
      rawLogs = await hik.getEvents(startIso, endIso);
    } catch (err) {
      throw new Error(`خطأ اتصال بجهاز Hikvision: ${err.message}`);
    }
  }

  addLog(`تم استخراج (${rawLogs.length}) حركة بصمة إجمالية من الجهاز.`, 'info');

  // 4. Filter Logs within Target Date Range
  const filteredLogs = rawLogs.filter(item => {
    if (!item.recordTime) return false;
    const itemIso = item.recordTime.substring(0, 10);
    return itemIso >= startDay && itemIso <= endDay;
  });

  addLog(`عدد حركات البصمة في النطاق المستهدف (${startDay} - ${endDay}): ${filteredLogs.length}`, 'info');

  if (filteredLogs.length === 0) {
    currentConfig.lastSyncTime = new Date().toISOString();
    currentConfig.lastSyncStatus = 'لا توجد حركات جديدة في الجهاز لهذا التاريخ';
    saveConfig(currentConfig);
    return { totalPulled: 0, newUploaded: 0, duplicatesSkipped: 0 };
  }

  // 5. Query Supabase for EXISTING logs in this date range to prevent any duplicates
  const { data: existingDbLogs, error: existErr } = await sb
    .from('fingerprint_logs')
    .select('id, fingerprint_code, timestamp, type')
    .eq('salon_id', config.salonId)
    .gte('timestamp', startIso)
    .lte('timestamp', endIso);

  if (existErr) {
    throw new Error(`خطأ فحص السجلات السابقة من سوبابيز: ${existErr.message}`);
  }

  // Create a deduplication Set: `code|timestamp_minute`
  const existingSet = new Set();
  (existingDbLogs || []).forEach(l => {
    // Round to minute to absorb minor seconds deviations
    const cleanTime = (l.timestamp || '').substring(0, 16);
    existingSet.add(`${String(l.fingerprint_code).trim()}|${cleanTime}`);
  });

  // 6. Build new records payload
  const newRecordsToUpload = [];
  let skippedDuplicates = 0;

  for (const log of filteredLogs) {
    const code = String(log.userSn).trim();
    const cleanTime = (log.recordTime || '').substring(0, 16);
    const dedupeKey = `${code}|${cleanTime}`;

    if (existingSet.has(dedupeKey)) {
      skippedDuplicates++;
      continue;
    }

    // New unique record!
    existingSet.add(dedupeKey);

    const matchedEmp = empMap.get(code);
    const determinedType = classifyLogType(log.recordTime, log.verifyState, config);

    newRecordsToUpload.push({
      id: crypto.randomUUID(),
      salon_id: config.salonId,
      branch_id: config.branchId || matchedEmp?.branch_id || null,
      employee_id: matchedEmp ? matchedEmp.id : null,
      employee_name: matchedEmp ? matchedEmp.name : `موظف كود (${code})`,
      fingerprint_code: code,
      timestamp: log.recordTime,
      type: determinedType,
      device_ip: config.deviceIp,
      status: 'synced',
      notes: `مزامنة آلية من جهاز ${config.deviceBrand.toUpperCase()} [قاعدة التوقيت: ${determinedType === 'check_in' ? 'حضور' : 'انصراف'}]`
    });
  }

  // 7. Insert into Supabase in batches
  if (newRecordsToUpload.length > 0) {
    const { error: insertErr } = await sb
      .from('fingerprint_logs')
      .insert(newRecordsToUpload);

    if (insertErr) {
      throw new Error(`فشل رفع البصمات إلى سوبابيز: ${insertErr.message}`);
    }

    addLog(`✅ تم بنجاح رفع (${newRecordsToUpload.length}) بصمة جديدة إلى سوبابيز بدون تكرار! (تم تخطي ${skippedDuplicates} مكررة)`, 'success');
  } else {
    addLog(`ℹ️ جميع البصمات (${skippedDuplicates}) مرفوعة مسبقاً بالفعل لقاعدة البيانات.`, 'info');
  }

  currentConfig.lastSyncTime = new Date().toISOString();
  currentConfig.lastSyncStatus = `ناجح: تم رفع ${newRecordsToUpload.length} بصمة جديدة (تخطي ${skippedDuplicates} مكررة)`;
  saveConfig(currentConfig);

  return {
    totalPulled: filteredLogs.length,
    newUploaded: newRecordsToUpload.length,
    duplicatesSkipped: skippedDuplicates
  };
}

// Background Auto-Sync Timer Loop
let autoSyncTimer = null;
function startAutoSyncLoop() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);

  const intervalMs = Math.max(1, currentConfig.syncIntervalMinutes || 5) * 60 * 1000;
  addLog(`تشغيل مؤقت المزامنة التلقائي في الخلفية كل (${currentConfig.syncIntervalMinutes}) دقيقة.`, 'info');

  autoSyncTimer = setInterval(async () => {
    if (!currentConfig.isAutoSyncEnabled) return;
    try {
      await performSync();
    } catch (err) {
      addLog(`خطأ أثناء المزامنة التلقائية: ${err.message}`, 'error');
    }
  }, intervalMs);
}

// Setup Express App for GUI and REST APIs
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get current config & status
app.get('/api/config', (req, res) => {
  res.json({
    config: currentConfig,
    logs: syncLogs
  });
});

// API: Save configuration
app.post('/api/config', (req, res) => {
  const newConfig = { ...currentConfig, ...req.body };
  currentConfig = newConfig;
  saveConfig(currentConfig);
  supabaseClient = null; // reset client instance

  startAutoSyncLoop();
  addLog('تم تحديث إعدادات البرنامج وحفظها بنجاح.', 'success');
  res.json({ success: true, config: currentConfig });
});

// API: Test Hardware Connection
app.post('/api/test-device', async (req, res) => {
  const { deviceBrand, deviceIp, devicePort, deviceUsername, devicePassword } = req.body;
  try {
    if (deviceBrand === 'zkteco') {
      const zk = new ZKClient(deviceIp, devicePort);
      await zk.connect();
      await zk.disconnect();
      return res.json({ success: true, message: `✅ تم الاتصال بنجاح بجهاز ZKTeco على (${deviceIp}:${devicePort})!` });
    } else {
      const hik = new HikvisionClient(deviceIp, devicePort, deviceUsername, devicePassword);
      await hik.testConnection();
      return res.json({ success: true, message: `✅ تم الاتصال بنجاح بجهاز Hikvision ISAPI على (${deviceIp}:${devicePort})!` });
    }
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// API: Trigger Manual Sync
app.post('/api/sync', async (req, res) => {
  const { fromDate, toDate } = req.body;
  try {
    const result = await performSync(fromDate, toDate);
    res.json({ success: true, result });
  } catch (err) {
    addLog(`فشل المزامنة: ${err.message}`, 'error');
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Fetch Salons list from Supabase for easy selection
app.get('/api/salons', async (req, res) => {
  try {
    const sb = getSupabase();
    if (!sb) return res.json({ salons: [] });
    const { data: salons } = await sb.from('salons').select('id, name, code');
    const { data: branches } = await sb.from('branches').select('id, salon_id, name, code');
    res.json({ salons: salons || [], branches: branches || [] });
  } catch {
    res.json({ salons: [], branches: [] });
  }
});

const PORT = 4500;
app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 SmartCut Attendance Sync Agent is running!`);
  console.log(`🌐 Control Panel: http://localhost:${PORT}`);
  console.log(`=============================================================`);
  addLog(`تم بدء تشغيل البرنامج بنجاح على المنفذ ${PORT}. افتح المتصفح على: http://localhost:${PORT}`, 'success');
  startAutoSyncLoop();
});
