import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

export const DOCUMENT_BUCKET = "documents";

export function getSupabaseAdmin() {
  const { supabaseUrl, serviceRoleKey } = getServerEnv();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
