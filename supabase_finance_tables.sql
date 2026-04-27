-- =============================================
-- FINANS MODÜLÜ — Supabase Tablo Tanımları
-- =============================================

-- 1. Vergi Oranları Tablosu
CREATE TABLE IF NOT EXISTS tax_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,          -- örn: "KDV %20"
  rate NUMERIC NOT NULL,       -- 20, 10, 1, 0
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Varsayılan KDV oranlarını ekle
INSERT INTO tax_config (name, rate, is_default) VALUES
  ('KDV %0 (Muaf)', 0, false),
  ('KDV %1', 1, false),
  ('KDV %10', 10, false),
  ('KDV %20', 20, true)
ON CONFLICT DO NOTHING;

-- 2. Gelir/Gider Kayıtları
CREATE TABLE IF NOT EXISTS income_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,        -- örn: "Satış Geliri", "Kira Gideri", "Elektrik"
  description TEXT,
  amount NUMERIC NOT NULL,       -- Brüt tutar (KDV dahil)
  tax_rate NUMERIC DEFAULT 0,    -- Vergi oranı (%)
  tax_amount NUMERIC DEFAULT 0,  -- Hesaplanan vergi tutarı
  net_amount NUMERIC DEFAULT 0,  -- Vergisiz tutar
  payment_method TEXT DEFAULT 'Cash', -- Cash, Bank, CreditCard, Check
  reference_no TEXT,             -- Fatura/fiş referans numarası
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  voucher_id UUID,               -- Gider fişi referansı (varsa)
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Gider Fişleri
CREATE TABLE IF NOT EXISTS expense_vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_no TEXT NOT NULL,       -- Fiş numarası (otomatik veya manuel)
  supplier_name TEXT,             -- Tedarikçi adı
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'cancelled')),
  items JSONB DEFAULT '[]',       -- [{description, quantity, unit_price, tax_rate, tax_amount, total}]
  subtotal NUMERIC DEFAULT 0,     -- Ara toplam (KDV hariç)
  total_tax NUMERIC DEFAULT 0,    -- Toplam KDV
  grand_total NUMERIC DEFAULT 0,  -- Genel toplam (KDV dahil)
  notes TEXT,
  voucher_date DATE DEFAULT CURRENT_DATE,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Politikaları
ALTER TABLE tax_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON tax_config FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON income_expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON expense_vouchers FOR ALL USING (auth.role() = 'authenticated');
