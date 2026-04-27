import { createClient } from '@supabase/supabase-js';

// We should use env vars, but as a placeholder we will use dummy config
// Note: In real app, these should be securely stored in .env like VITE_SUPABASE_URL
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
