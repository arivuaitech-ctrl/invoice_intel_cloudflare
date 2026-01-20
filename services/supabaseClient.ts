import { createClient } from '@supabase/supabase-js';

// Use environment variables (mapped in vite.config.ts)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Expose to window for console debugging/verification
if (typeof window !== 'undefined') {
    (window as any).supabase = supabase;
}