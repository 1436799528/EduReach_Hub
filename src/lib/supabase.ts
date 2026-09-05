import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gjdfatwcoosyuhakrrhh.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3mlCDMxbAaQZ1oSL1eaBOg_wgUj9Dae';

export const supabase = createClient(supabaseUrl, supabaseKey);
