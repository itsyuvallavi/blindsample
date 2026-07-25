import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export type SupabaseConfig = {
  secretKey: string;
  url: string;
};

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

let cachedClient: SupabaseClient<Database> | undefined;

export function getSupabaseConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SupabaseConfig {
  const secretKey = environment.SUPABASE_SECRET_KEY?.trim() ?? "";
  const url = environment.SUPABASE_URL?.trim() ?? "";

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SupabaseConfigurationError(
      "SUPABASE_URL must be a valid project URL.",
    );
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname.endsWith(".supabase.co")
  ) {
    throw new SupabaseConfigurationError(
      "SUPABASE_URL must use the project's HTTPS supabase.co URL.",
    );
  }

  if (!secretKey.startsWith("sb_secret_")) {
    throw new SupabaseConfigurationError(
      "SUPABASE_SECRET_KEY must be a current sb_secret_ server key.",
    );
  }

  return { secretKey, url: parsedUrl.origin };
}

export function getSupabaseServerClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getSupabaseConfig();

  cachedClient = createClient<Database>(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
