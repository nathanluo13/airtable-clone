"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { createClient } from "~/lib/supabase/client";

function CallbackClientInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ranRef = useRef(false);
  const [status, setStatus] = useState<string>("Signing you in...");

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = searchParams.get("code");
    const next = searchParams.get("next");
    const redirectPath = next?.startsWith("/") ? next : "/";

    if (!code) {
      router.replace(`/login?error=${encodeURIComponent("no_code")}`);
      return;
    }

    const supabase = createClient({
      isSingleton: false,
      auth: {
        detectSessionInUrl: false,
      },
    });

    void (async () => {
      setStatus("Exchanging OAuth code for session...");
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        router.replace(`/login?error=${encodeURIComponent(error.message)}`);
        return;
      }

      setStatus("Redirecting...");
      router.replace(redirectPath);
      router.refresh();
    })();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-8 text-white">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-semibold">Authentication</h1>
        <p className="mt-2 text-sm text-white/70">{status}</p>
      </div>
    </main>
  );
}

export default function CallbackClientPage() {
  return (
    <Suspense fallback={null}>
      <CallbackClientInner />
    </Suspense>
  );
}
