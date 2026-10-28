-- ==============================================================================
-- 🚀 SMART CUT V2 PRO - أتمتة وجدولة رسائل الواتساب للتذكير بالحجوزات (24/7)
-- ==============================================================================
-- 1. إضافة حقول تفعيل وحالة WhatsApp API لكل صالون (is_whatsapp_active, whatsapp_api_status).
-- 2. إضافة حقول وسم وتتبع الرسائل المرسلة لكل حجز لمنع التكرار نهائياً.
-- 3. تفعيل إرسال تذكيرات الغد وملخص المالك يومياً الساعة 10:00 مساءً.
-- 4. تفعيل إرسال تذكيرات مواعيد اليوم للعملاء يومياً الساعة 10:00 صباحاً.
-- ==============================================================================

-- 1. إضافة حقول تفعيل وحالة الـ WhatsApp API في جدول الصالونات والإعدادات
ALTER TABLE salons ADD COLUMN IF NOT EXISTS is_whatsapp_active BOOLEAN DEFAULT TRUE;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS whatsapp_api_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE salons ADD COLUMN IF NOT EXISTS owner_tomorrow_summary_sent_date DATE;

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS is_whatsapp_active BOOLEAN DEFAULT TRUE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS whatsapp_api_status VARCHAR(20) DEFAULT 'active';

-- تعيين القيمة الافتراضية للصالونات الحالية التي تملك بيانات API إلى 'active'
UPDATE salons 
SET is_whatsapp_active = TRUE, whatsapp_api_status = 'active'
WHERE evolution_instance_name IS NOT NULL AND evolution_instance_name != '';

UPDATE app_settings 
SET is_whatsapp_active = TRUE, whatsapp_api_status = 'active'
WHERE evolution_instance_name IS NOT NULL AND evolution_instance_name != '';

-- 2. إضافة حقول وسم منع تكرار الرسائل في جدول الحجوزات (bookings)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_tomorrow_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_tomorrow_sent_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_today_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_today_sent_at TIMESTAMPTZ;

-- فهرسة سريعة لتسريع فحص الحجوزات المجدولة دون استهلاك موارد قاعدة البيانات
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_tomorrow 
ON bookings (salon_id, date, reminder_tomorrow_sent) 
WHERE status NOT IN ('cancelled', 'completed');

CREATE INDEX IF NOT EXISTS idx_bookings_reminder_today 
ON bookings (salon_id, date, reminder_today_sent) 
WHERE status NOT IN ('cancelled', 'completed');
