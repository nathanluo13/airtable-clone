import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "~/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const redirectPath = next?.startsWith("/") ? next : "/";

  if (!code) {
    const error =
      searchParams.get("error_description") ??
      searchParams.get("error") ??
      "no_code";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, origin),
      303
    );
  }

  const hasPkceVerifierCookie = request.cookies
    .getAll()
    .some((c) => c.name.endsWith("-code-verifier"));

  if (!hasPkceVerifierCookie) {
    const host = request.headers.get("host") ?? "unknown";
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          `PKCE code verifier cookie missing for host ${host}. Ensure you start and finish OAuth on the same exact origin (e.g. localhost vs 127.0.0.1) and that the origin is in Supabase Auth redirect allow list.`
        )}`,
        origin
      ),
      303
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
      303
    );
  }

  // `exchangeCodeForSession` schedules the SIGNED_IN event on a timer.
  // `@supabase/ssr` applies cookie updates on auth state change, so we need
  // to yield once to allow those cookie writes to occur before we redirect.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${redirectPath}`);
  }

  if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`);
  }

  return NextResponse.redirect(`${origin}${redirectPath}`);
}
