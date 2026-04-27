import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kzpzxhaemgevtpagrepy.supabase.co';
const supabaseKey = 'sb_publishable_wcMOf0lTkYi16Lxn5ab9Bg_HhHSYUuW';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndReport() {
  console.log('🔍 Veritabanı tablo kontrolü yapılıyor...\n');

  // inventory_counts tablosunu test et
  const { data: countTest, error: countErr } = await supabase
    .from('inventory_counts')
    .select('id')
    .limit(1);

  if (countErr) {
    console.log('❌ inventory_counts tablosu YOK:', countErr.message);
    console.log('\n📋 Aşağıdaki SQL kodunu Supabase SQL Editor\'e girin:\n');
    console.log('─'.repeat(60));
    console.log(`
CREATE TABLE IF NOT EXISTS public.inventory_counts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    location_id uuid REFERENCES locations(id),
    status text DEFAULT 'draft',
    created_by text,
    completed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.inventory_count_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    count_id uuid REFERENCES inventory_counts(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id),
    system_qty integer DEFAULT 0,
    counted_qty integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.returns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    party_id uuid REFERENCES parties(id),
    product_id uuid REFERENCES products(id),
    location_id uuid REFERENCES locations(id),
    qty integer NOT NULL DEFAULT 1,
    price decimal(10,2) NOT NULL DEFAULT 0,
    amount decimal(10,2) NOT NULL DEFAULT 0,
    type text NOT NULL DEFAULT 'Sale_Return',
    description text
);

ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all counts" ON public.inventory_counts FOR ALL TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Allow all items" ON public.inventory_count_items FOR ALL TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Allow all returns" ON public.returns FOR ALL TO authenticated USING (true);
`);
    console.log('─'.repeat(60));
    console.log('\n🌐 Supabase SQL Editor adresi:');
    console.log('   https://supabase.com/dashboard/project/kzpzxhaemgevtpagrepy/sql/new');
  } else {
    console.log('✅ inventory_counts tablosu MEVCUT! Veriler:', countTest);
  }

  // returns tablosunu test et
  const { data: returnTest, error: returnErr } = await supabase
    .from('returns')
    .select('id')
    .limit(1);

  if (returnErr) {
    console.log('❌ returns tablosu YOK:', returnErr.message);
  } else {
    console.log('✅ returns tablosu MEVCUT!');
  }

  // locations tablosunu test et (bağlantı kontrolü için)
  const { data: locTest, error: locErr } = await supabase
    .from('locations')
    .select('id, name')
    .limit(3);

  if (locErr) {
    console.log('❌ locations tablosuna erişilemiyor — Supabase bağlantısı hatalı olabilir:', locErr.message);
  } else {
    console.log('✅ Supabase bağlantısı BAŞARILI. Depolar:', locTest);
  }
}

checkAndReport();
