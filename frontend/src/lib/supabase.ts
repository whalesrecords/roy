import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://huolkgcnizwrhzyboemd.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

if (!supabaseKey) {
  console.warn('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY is not set. Auth will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
