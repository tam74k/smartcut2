-- ==============================================================================
-- SmartCut Pro — Database Security & High-Performance Acceleration Indexes
-- Safe & Non-Destructive: Does NOT alter, delete, or modify any existing data.
-- ==============================================================================

-- 1. Invoices Index (Fast daily sheet, financial reports, and shift audits)
CREATE INDEX IF NOT EXISTS idx_invoices_salon_date ON invoices(salon_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_salon_status ON invoices(salon_id, status);

-- 2. Transactions Index (Fast treasury movements, expense filtering, cash drawer)
CREATE INDEX IF NOT EXISTS idx_transactions_salon_date ON transactions(salon_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_salon_type ON transactions(salon_id, type);

-- 3. Bookings Index (Fast calendar lookups, customer portals, and queue display)
CREATE INDEX IF NOT EXISTS idx_bookings_salon_date ON bookings(salon_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_salon_status ON bookings(salon_id, status);

-- 4. Shifts Index (Fast shift verification and cashier isolation)
CREATE INDEX IF NOT EXISTS idx_shifts_salon_branch ON shifts(salon_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_shifts_salon_status ON shifts(salon_id, status);

-- 5. Users & Clients Index (Fast authentication and customer phone lookup)
CREATE INDEX IF NOT EXISTS idx_users_salon_username ON users(salon_id, username);
CREATE INDEX IF NOT EXISTS idx_clients_salon_phone ON clients(salon_id, phone);

-- ==============================================================================
-- Verification Query
-- ==============================================================================
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
