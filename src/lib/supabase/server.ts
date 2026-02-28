import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client from a Request object.
 * Accepts Bearer tokens (for mobile clients) with a fallback to cookie-based auth.
 */
export async function createClientFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );
    return supabase;
  }
  // Fall back to cookie-based auth
  return createClient();
}
