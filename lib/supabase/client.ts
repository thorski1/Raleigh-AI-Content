import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabasePoolUrl = process.env.NEXT_PUBLIC_SUPABASE_POOL_URL!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export function createClerkSupabaseClient() {
  const { session } = useSession();
  return createClient(supabasePoolUrl || supabaseUrl, supabaseAnonKey, {
    global: {
      // Get the custom Supabase token from Clerk
      fetch: async (url, options = {}) => {
        const clerkToken = await session?.getToken({
          template: "supabase",
        });

        // Insert the Clerk Supabase token into the headers
        const headers = new Headers(options?.headers);
        headers.set("Authorization", `Bearer ${clerkToken}`);

        // Now call the default fetch
        return fetch(url, {
          ...options,
          headers,
        });
      },
    },
  });
}
