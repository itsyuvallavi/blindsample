import { describe, expect, it } from "vitest";

import {
  getSupabaseConfig,
  SupabaseConfigurationError,
} from "./client";

describe("getSupabaseConfig", () => {
  it("accepts a current server-only key and HTTPS project URL", () => {
    expect(
      getSupabaseConfig({
        SUPABASE_SECRET_KEY: "sb_secret_test-only",
        SUPABASE_URL: "https://project-ref.supabase.co/path",
      }),
    ).toEqual({
      secretKey: "sb_secret_test-only",
      url: "https://project-ref.supabase.co",
    });
  });

  it("rejects publishable and legacy keys", () => {
    for (const secretKey of [
      "sb_publishable_test-only",
      "eyJlegacy-service-role",
    ]) {
      expect(() =>
        getSupabaseConfig({
          SUPABASE_SECRET_KEY: secretKey,
          SUPABASE_URL: "https://project-ref.supabase.co",
        }),
      ).toThrowError(SupabaseConfigurationError);
    }
  });

  it("rejects a non-Supabase or insecure URL", () => {
    expect(() =>
      getSupabaseConfig({
        SUPABASE_SECRET_KEY: "sb_secret_test-only",
        SUPABASE_URL: "http://example.com",
      }),
    ).toThrowError(SupabaseConfigurationError);
  });
});
