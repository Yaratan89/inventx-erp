
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://kzpzxhaemgevtpagrepy.supabase.co';
const supabaseKey = 'sb_publishable_wcMOf0lTkYi16Lxn5ab9Bg_HhHSYUuW';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('parties').select('id, name, type');
  if (error) console.error("SUPABASE ERROR:", error);
  else {
    console.log("PARTIES FOUND:", data.length);
    console.log("SAMPLES:", data.slice(0, 5));
    console.log("DISTINCT TYPES:", [...new Set(data.map(p => p.type))]);
  }
}
check();
