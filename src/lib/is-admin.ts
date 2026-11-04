import { supabase } from "@/integrations/supabase/client";

/**
 * Checks whether a user holds the admin role. Reads `user_roles` directly, which
 * is protected by row-level security (users can only see their own roles).
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}
