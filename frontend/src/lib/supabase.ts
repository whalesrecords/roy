import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://huolkgcnizwrhzyboemd.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Auth will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
