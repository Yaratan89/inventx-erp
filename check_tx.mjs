import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kzpzxhaemgevtpagrepy.supabase.co';
const supabaseKey = 'sb_publishable_wcMOf0lTkYi16Lxn5ab9Bg_HhHSYUuW';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: t } = await supabase.from('financial_transactions').select('*');
  console.log("All txs count:", t ? t.length : 0);
  if (t && t.length > 0) {
    console.log("Last 2 txs:", t.slice(-2));
  }
}
check();
