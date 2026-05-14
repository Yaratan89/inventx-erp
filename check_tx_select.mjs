import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kzpzxhaemgevtpagrepy.supabase.co';
const supabaseKey = 'sb_publishable_wcMOf0lTkYi16Lxn5ab9Bg_HhHSYUuW';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: t, error } = await supabase.from('financial_transactions').select('*, parties(name)');
  console.log("Error:", error);
  console.log("Data:", t);
}
check();
