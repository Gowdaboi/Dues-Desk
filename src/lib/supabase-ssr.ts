import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSSRClient() {
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
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll fails in Server Components (read-only cookies)
            // This is expected — the proxy handles refresh writes
          }
        },
      },
    }
  );
}

export async function getSessionUser() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getWorkspaceForUser(userId: string) {
  const supabase = await createSSRClient();
  const { data } = await supabase
    .from("workspaces")
    .select("id, name, mcp_token")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data;
}
