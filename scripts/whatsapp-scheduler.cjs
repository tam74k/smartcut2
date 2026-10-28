/**
 * ==============================================================================
 * 🚀 SMART CUT V2 PRO - SERVER-SIDE WHATSAPP AUTOMATION SCHEDULER
 * خادم الجدولة الآلي لرسائل الواتساب للحجوزات والتذكيرات (مستقل 100% عن المتصفح)
 * ==============================================================================
 * 
 * المهام المجدولة:
 * 1. يومياً الساعة 10:00 مساءً (22:00):
 *    - فحص الصالونات النشطة التي لديها WhatsApp API نشط.
 *    - إرسال رسائل تذكير لعملاء حجوزات الغد (date = tomorrow) لكل صالون عبر حسابه المستقل.
 *    - إرسال ملخص حجوزات الغد بالكامل لمالك الصالون.
 *    - وسم الحجوزات بـ reminder_tomorrow_sent = true لمنع التكرار نهائياً.
 * 
 * 2. يومياً الساعة 10:00 صباحاً (10:00):
 *    - فحص الصالونات النشطة وإرسال رسائل تذكير لعملاء حجوزات اليوم (date = today).
 *    - وسم الحجوزات بـ reminder_today_sent = true لمنع التكرار نهائياً.
 * 
 * أوامر التشغيل المباشر للاختبار:
 * - node scripts/whatsapp-scheduler.cjs               (تشغيل الخادم الدائم 24/7)
 * - node scripts/whatsapp-scheduler.cjs --now-tomorrow (تنفيذ فحص ورسائل الغد فوراً)
 * - node scripts/whatsapp-scheduler.cjs --now-today    (تنفيذ فحص ورسائل اليوم فوراً)
 * - node scripts/whatsapp-scheduler.cjs --status       (عرض حالة واتساب لجميع الصالونات)
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// 1. تحميل المتغيرات من .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://api.101488.xyz';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[WhatsApp Scheduler Error] Missing Supabase URL or Key in .env');
  process.exit(1);
}

// 2. قوالب الرسائل الافتراضية
const DEFAULT_TEMPLATES = {
  reminderTomorrow: `تذكير بموعد حجزكم غداً ⏰
مرحباً أستاذ {clientName} 👋
نود تذكيركم بموعد حجزكم غداً في {salonName}:
📅 التاريخ: {date}
⏰ الساعة: {time}
✂️ الخدمات: {services}
💈 الفرع: {branchName}
يسعدنا تشريفكم ونرجو إبلاغنا مبكراً في حال رغبتكم في تعديل الموعد. ✨`,

  reminderToday: `موعدكم اليوم ⏳
مرحباً أستاذ {clientName} 💈
نذكركم بموعد حجزكم اليوم في {salonName}:
⏰ الساعة: {time}
✂️ الخدمات: {services}
💈 الفرع: {branchName}
يرجى التكرم بالحضور قبل الموعد بـ 10 دقائق. نتطلع لزيارتكم! 💇‍♂️✨`,

  ownerTomorrow: `تقرير حجوزات ومواعيد الغد 📋
مساء الخير أستاذ {ownerName}،
ملخص جدول مواعيد وحجوزات الغد ({date}) في {salonName}:
📊 إجمالي الحجوزات: {bookingsCount} حجز

تفاصيل الحجوزات:
{details}

نتمنى لكم يوماً عملياً موفقاً وناجحاً! 🌟`
};

// 3. دوال مساعدة
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFormattedDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWhatsAppNumber(phone, country = 'المملكة العربية السعودية') {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);

  if (cleaned.startsWith('05') && (country.includes('السعودية') || country === 'SAR')) {
    cleaned = '966' + cleaned.substring(1);
  } else if (cleaned.startsWith('01') && (country.includes('مصر') || country === 'EGP')) {
    cleaned = '20' + cleaned.substring(1);
  } else if (cleaned.startsWith('05') && (country.includes('الإمارات') || country === 'AED')) {
    cleaned = '971' + cleaned.substring(1);
  } else if (cleaned.startsWith('07') && (country.includes('الأردن') || country === 'JOD')) {
    cleaned = '962' + cleaned.substring(1);
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '966' + cleaned.substring(1);
  }
  return cleaned;
}

function interpolate(template, vars) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
  }).trim();
}

// 4. استدعاء Supabase REST API
async function supabaseFetch(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params ? '?' + params : ''}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase query failed on ${table}: ${res.status} ${txt}`);
  }
  return await res.json();
}

async function supabasePatch(table, id, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[DB Patch Error] ${table} id=${id}:`, txt);
  }
}

// 5. إرسال رسالة واتساب عبر Evolution API
async function sendEvolutionMessage(apiUrl, apiKey, instanceName, phone, message) {
  if (!apiUrl || !apiKey || !instanceName || !phone || !message) {
    return { success: false, error: 'بيانات الاتصال أو الهاتف غير مكتملة' };
  }

  let cleanUrl = apiUrl.trim().replace(/\/+$/, '');
  const targetPhone = formatWhatsAppNumber(phone);
  const endpoint = `${cleanUrl}/message/sendText/${encodeURIComponent(instanceName)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey.trim()
      },
      body: JSON.stringify({
        number: targetPhone,
        text: message,
        options: {
          delay: 1200,
          presence: 'composing'
        }
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.key?.id || data?.status === 'SUCCESS' || data?.messageId)) {
      return { success: true, messageId: data?.key?.id || data?.messageId };
    } else {
      return { success: false, error: data?.message || data?.error || `HTTP ${res.status}` };
    }
  } catch (err) {
    return { success: false, error: err?.message || 'تعذر الاتصال بـ Evolution API' };
  }
}

// 6. جلب بيانات الصالونات المؤهلة فقط
async function getActiveWhatsAppSalons() {
  const salons = await supabaseFetch('salons', 'select=*');
  const allSettings = await supabaseFetch('app_settings', 'select=*');

  const settingsMap = new Map();
  allSettings.forEach(s => {
    if (s.salon_id) settingsMap.set(s.salon_id, s);
  });

  const qualifiedSalons = [];

  for (const sl of salons) {
    // 1. فحص نشاط الصالون
    if (sl.is_active === false) continue;

    // 2. فحص حالة الـ WhatsApp API في الصالون أو الإعدادات
    // يجب ألا يكون معطلاً صراحة
    if (sl.is_whatsapp_active === false || sl.whatsapp_api_status === 'inactive') continue;

    const st = settingsMap.get(sl.id) || {};
    if (st.is_whatsapp_active === false || st.whatsapp_api_status === 'inactive') continue;
    if (st.whatsapp_enabled === false) continue;

    // 3. التحقق من وجود بيانات الجلسة والمفتاح والرابط بدون أي خلط
    const apiUrl = sl.evolution_api_url || st.evolution_api_url;
    const apiKey = sl.evolution_api_key || st.evolution_api_key;
    const instanceName = sl.evolution_instance_name || st.evolution_instance_name;

    if (!apiUrl || !apiKey || !instanceName) {
      // صالون غير مفعل أو غير مكتمل الإعدادات، يتم تجاوزه فوراً لتوفير الوقت
      continue;
    }

    qualifiedSalons.push({
      salon: sl,
      settings: st,
      apiUrl,
      apiKey,
      instanceName,
      branches: st.branches || [],
      ownerPhone: sl.phone || st.phone || '',
      ownerName: sl.owner_name || 'مالك الصالون',
      waSettings: st.whatsapp_settings || {}
    });
  }

  return qualifiedSalons;
}

// 7. مهمة تذكيرات الغد + ملخص المالك (تُنفذ في 10:00 مساءً)
async function executeTomorrowReminders() {
  const tomorrowDate = getFormattedDate(1);
  console.log(`\n======================================================`);
  console.log(`[10:00 PM Job] بدء فحص حجوزات الغد (${tomorrowDate})...`);
  console.log(`======================================================`);

  let salonsList = [];
  try {
    salonsList = await getActiveWhatsAppSalons();
  } catch (err) {
    console.error('[Error] تعذر جلب الصالونات من قاعدة البيانات:', err.message);
    return;
  }

  console.log(`[Info] عدد الصالونات المؤهلة النشطة مع واتساب API: ${salonsList.length}`);

  for (const item of salonsList) {
    const { salon, settings, apiUrl, apiKey, instanceName, branches, ownerPhone, ownerName, waSettings } = item;
    console.log(`\n🔹 معالجة صالون: [${salon.name}] (رمز: ${salon.code}) | الجلسة: [${instanceName}]`);

    // فحص إعداد التفعيل للتذكير
    if (waSettings.sendBookingReminderToClient === false) {
      console.log(`   ⏭️ تذكير العملاء معطل في إعدادات صالون ${salon.name}`);
      continue;
    }

    // جلب حجوزات الغد الخاصة بهذا الصالون فقط
    let bookings = [];
    try {
      bookings = await supabaseFetch('bookings', `salon_id=eq.${salon.id}&date=eq.${tomorrowDate}&status=not.in.(cancelled,completed)&select=*`);
    } catch (e) {
      console.error(`   ❌ خطأ في جلب حجوزات صالون ${salon.name}:`, e.message);
      continue;
    }

    console.log(`   📅 إجمالي حجوزات الغد للصالون: ${bookings.length}`);

    // تصفية الحجوزات التي لم يُرسل لها تذكير الغد بعد
    const unreminded = bookings.filter(b => !b.reminder_tomorrow_sent);
    console.log(`   📩 الحجوزات التي تحتاج إرسال تذكير الآن: ${unreminded.length}`);

    const template = waSettings.reminderTemplate || DEFAULT_TEMPLATES.reminderTomorrow;
    let sentCount = 0;

    for (const b of unreminded) {
      if (!b.phone || b.phone.length < 7) {
        console.warn(`   ⚠️ تخطي حجز #${b.id} لعدم وجود رقم هاتف صحيح.`);
        continue;
      }

      const branchObj = branches.find(br => br.id === b.branch_id);
      const branchName = branchObj?.name || 'الفرع الرئيسي';
      const servicesList = Array.isArray(b.services)
        ? b.services.map(s => s.serviceName || s.name || 'خدمة').join('، ')
        : 'خدمات الحجز';

      const message = interpolate(template, {
        clientName: b.client_name || b.clientName || 'عميلنا العزيز',
        date: b.date,
        time: b.time || 'في موعدكم المحدد',
        services: servicesList,
        branchName,
        salonName: settings.salon_name || salon.name
      });

      const res = await sendEvolutionMessage(apiUrl, apiKey, instanceName, b.phone, message);

      if (res.success) {
        sentCount++;
        console.log(`   ✅ تم إرسال تذكير الغد للعميل (${b.client_name || b.phone}) بنجاح.`);
        // تحديث حالة الحجز فوراً في قاعدة البيانات لمنع التكرار
        await supabasePatch('bookings', b.id, {
          reminder_tomorrow_sent: true,
          reminder_tomorrow_sent_at: new Date().toISOString()
        });
      } else {
        console.error(`   ❌ فشل إرسال تذكير الغد للعميل (${b.client_name || b.phone}):`, res.error);
      }

      // تأخير احترازي بين الرسائل (1.5 ثانية) لحماية رقم الواتساب
      await sleep(1500);
    }

    console.log(`   ✨ اكتمل إرسال تذكيرات العملاء لصالون ${salon.name} (تم إرسال: ${sentCount}/${unreminded.length})`);

    // إرسال ملخص حجوزات الغد للمالك (إذا كان الخيار مفعلاً)
    if (waSettings.sendTomorrowBookingsToOwner !== false && ownerPhone) {
      console.log(`   📲 جاري إرسال ملخص حجوزات الغد لمالك الصالون (${ownerName} - ${ownerPhone})...`);

      const details = bookings.length > 0
        ? bookings.map((b, i) => `${i + 1}. ⏰ ${b.time || 'غير محدد'} - ${b.client_name || 'عميل'} (${Array.isArray(b.services) ? b.services.map(s => s.serviceName || s.name).join('، ') : 'خدمات'})`).join('\n')
        : 'لا توجد حجوزات مسجلة للغد.';

      const ownerTemplate = waSettings.ownerTomorrowTemplate || DEFAULT_TEMPLATES.ownerTomorrow;
      const ownerMessage = interpolate(ownerTemplate, {
        ownerName,
        date: tomorrowDate,
        bookingsCount: bookings.length,
        branchName: 'كافة الفروع',
        details,
        salonName: settings.salon_name || salon.name
      });

      const ownerRes = await sendEvolutionMessage(apiUrl, apiKey, instanceName, ownerPhone, ownerMessage);
      if (ownerRes.success) {
        console.log(`   👑 تم إرسال ملخص حجوزات الغد لمالك صالون [${salon.name}] بنجاح.`);
        await supabasePatch('salons', salon.id, {
          owner_tomorrow_summary_sent_date: tomorrowDate
        });
      } else {
        console.error(`   ⚠️ تعذر إرسال الملخص لمالك الصالون:`, ownerRes.error);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`[10:00 PM Job] اكتملت المهمة بنجاح.`);
  console.log(`======================================================\n`);
}

// 8. مهمة تذكيرات اليوم (تُنفذ في 10:00 صباحاً)
async function executeTodayReminders() {
  const todayDate = getFormattedDate(0);
  console.log(`\n======================================================`);
  console.log(`[10:00 AM Job] بدء فحص حجوزات اليوم (${todayDate})...`);
  console.log(`======================================================`);

  let salonsList = [];
  try {
    salonsList = await getActiveWhatsAppSalons();
  } catch (err) {
    console.error('[Error] تعذر جلب الصالونات من قاعدة البيانات:', err.message);
    return;
  }

  console.log(`[Info] عدد الصالونات المؤهلة النشطة مع واتساب API: ${salonsList.length}`);

  for (const item of salonsList) {
    const { salon, settings, apiUrl, apiKey, instanceName, branches, waSettings } = item;
    console.log(`\n🔹 معالجة صالون: [${salon.name}] (رمز: ${salon.code}) | الجلسة: [${instanceName}]`);

    if (waSettings.sendBookingReminderToClient === false) {
      console.log(`   ⏭️ تذكير العملاء معطل في إعدادات صالون ${salon.name}`);
      continue;
    }

    let bookings = [];
    try {
      bookings = await supabaseFetch('bookings', `salon_id=eq.${salon.id}&date=eq.${todayDate}&status=not.in.(cancelled,completed)&select=*`);
    } catch (e) {
      console.error(`   ❌ خطأ في جلب حجوزات صالون ${salon.name}:`, e.message);
      continue;
    }

    console.log(`   📅 إجمالي حجوزات اليوم للصالون: ${bookings.length}`);

    // تصفية الحجوزات التي لم يُرسل لها تذكير اليوم بعد
    const unreminded = bookings.filter(b => !b.reminder_today_sent);
    console.log(`   📩 الحجوزات التي تحتاج إرسال تذكير اليوم: ${unreminded.length}`);

    const template = waSettings.reminderTodayTemplate || DEFAULT_TEMPLATES.reminderToday;
    let sentCount = 0;

    for (const b of unreminded) {
      if (!b.phone || b.phone.length < 7) {
        console.warn(`   ⚠️ تخطي حجز #${b.id} لعدم وجود رقم هاتف صحيح.`);
        continue;
      }

      const branchObj = branches.find(br => br.id === b.branch_id);
      const branchName = branchObj?.name || 'الفرع الرئيسي';
      const servicesList = Array.isArray(b.services)
        ? b.services.map(s => s.serviceName || s.name || 'خدمة').join('، ')
        : 'خدمات الحجز';

      const message = interpolate(template, {
        clientName: b.client_name || b.clientName || 'عميلنا العزيز',
        date: b.date,
        time: b.time || 'في موعدكم المحدد',
        services: servicesList,
        branchName,
        salonName: settings.salon_name || salon.name
      });

      const res = await sendEvolutionMessage(apiUrl, apiKey, instanceName, b.phone, message);

      if (res.success) {
        sentCount++;
        console.log(`   ✅ تم إرسال تذكير اليوم للعميل (${b.client_name || b.phone}) بنجاح.`);
        await supabasePatch('bookings', b.id, {
          reminder_today_sent: true,
          reminder_today_sent_at: new Date().toISOString()
        });
      } else {
        console.error(`   ❌ فشل إرسال تذكير اليوم للعميل (${b.client_name || b.phone}):`, res.error);
      }

      await sleep(1500);
    }

    console.log(`   ✨ اكتمل إرسال تذكيرات اليوم لصالون ${salon.name} (تم إرسال: ${sentCount}/${unreminded.length})`);
  }

  console.log(`\n======================================================`);
  console.log(`[10:00 AM Job] اكتملت المهمة بنجاح.`);
  console.log(`======================================================\n`);
}

// 9. عرض حالة واتساب للصالونات
async function displayStatus() {
  console.log('\n🔍 جلب حالة الصالونات والـ WhatsApp API من قاعدة البيانات...');
  const salons = await getActiveWhatsAppSalons();
  console.log(`\n📌 تم العثور على (${salons.length}) صالون بحسابات واتساب نشطة ومكتملة:`);
  console.table(salons.map(s => ({
    الصالون: s.salon.name,
    الرمز: s.salon.code,
    الجلسة: s.instanceName,
    رابط_السيرفر: s.apiUrl,
    هاتف_المالك: s.ownerPhone || 'غير مسجل'
  })));
}

// 10. نقطة الدخول والمجدول الزمني المستمر
async function main() {
  const arg = process.argv[2];

  if (arg === '--now-tomorrow') {
    console.log('[Manual Trigger] تشغيل فحص حجوزات الغد فوراً...');
    await executeTomorrowReminders();
    process.exit(0);
  }

  if (arg === '--now-today') {
    console.log('[Manual Trigger] تشغيل فحص حجوزات اليوم فوراً...');
    await executeTodayReminders();
    process.exit(0);
  }

  if (arg === '--status') {
    await displayStatus();
    process.exit(0);
  }

  console.log('================================================================');
  console.log('🤖 SMART CUT - خادم الجدولة الآلي لرسائل الواتساب قيد التشغيل 24/7');
  console.log('⏰ المواعيد المبرمجة:');
  console.log('   - 10:00 PM يومياً: إرسال تذكيرات حجوزات الغد للعملاء + ملخص الحجوزات للمالك.');
  console.log('   - 10:00 AM يومياً: إرسال تذكيرات حجوزات اليوم للعملاء.');
  console.log('================================================================');

  let lastRunTomorrowDay = -1;
  let lastRunTodayDay = -1;

  // فحص كل 30 ثانية
  setInterval(async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentDay = now.getDate();

    // 1. الساعة 10:00 مساءً (22:00)
    if (hours === 22 && minutes === 0 && lastRunTomorrowDay !== currentDay) {
      lastRunTomorrowDay = currentDay;
      await executeTomorrowReminders();
    }

    // 2. الساعة 10:00 صباحاً (10:00)
    if (hours === 10 && minutes === 0 && lastRunTodayDay !== currentDay) {
      lastRunTodayDay = currentDay;
      await executeTodayReminders();
    }
  }, 30000);
}

main().catch(err => {
  console.error('[Fatal Scheduler Error]:', err);
});
