import {
  createBrowserClient,
  type CookieMethodsBrowser,
  type CookieOptionsWithName,
} from "@supabase/ssr";
import type { SupabaseClientOptions } from "@supabase/supabase-js";

type CreateBrowserClientOptions = SupabaseClientOptions<any> & {
  cookies?: CookieMethodsBrowser;
  cookieOptions?: CookieOptionsWithName;
  cookieEncoding?: "raw" | "base64url";
  isSingleton?: boolean;
};

export function createClient(options?: CreateBrowserClientOptions) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options
  );
}
