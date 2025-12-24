import { createClient } from '@supabase/supabase-js';

// Ambil URL & Key dari Dashboard Supabase lu (Settings > API)
const supabaseUrl = '';
const supabaseAnonKey = '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);