import { createClient } from '@supabase/supabase-js';

// Supabase bağlantı bilgileri — anon key herkese açık public anahtardır
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kzpzxhaemgevtpagrepy.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wcMOf0lTkYi16Lxn5ab9Bg_HhHSYUuW';

export const supabase = createClient(supabaseUrl, supabaseKey);
