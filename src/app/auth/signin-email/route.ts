import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "~/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return NextResponse.redirect(
      new URL("/login?error=Email and password are required", origin),
      303
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
      303
    );
  }

  return NextResponse.redirect(new URL("/dashboard", origin), 303);
}
