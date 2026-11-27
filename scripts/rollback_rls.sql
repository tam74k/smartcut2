-- ==============================================================================
-- 🛟 SMART CUT PRO - INSTANT RLS ROLLBACK SCRIPT (Emergency Disabler)
-- يعطل سياسات الـ RLS فوراً في 5 ثوانٍ ويعيد قاعدة البيانات لحالتها السابقة
-- ==============================================================================

ALTER TABLE IF EXISTS public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.work_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.held_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.queue_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.salons DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;

-- Verification
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
