
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://kzpzxhaemgevtpagrepy.supabase.co';
const supabaseKey = 'sb_publishable_wcMOf0lTkYi16Lxn5ab9Bg_HhHSYUuW';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('personnel').select('*').limit(1);
  if (error) console.error(error);
  else console.log('PERSONNEL COLS:', Object.keys(data[0] || {}));
}
check();
