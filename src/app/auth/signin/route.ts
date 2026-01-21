import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "~/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const baseUrl =
    isLocalEnv ? origin : forwardedHost ? `https://${forwardedHost}` : origin;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Avoid query params in the redirect URL, as Supabase redirect allow-lists
      // are commonly configured for the plain path (e.g. /auth/callback).
      redirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
      303
    );
  }

  return NextResponse.redirect(data.url, 303);
}
