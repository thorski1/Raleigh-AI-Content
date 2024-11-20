import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabasePoolUrl = process.env.NEXT_PUBLIC_SUPABASE_POOL_URL!;

export const supabase = createClient(
  supabasePoolUrl || supabaseUrl,
  supabaseAnonKey,
);
