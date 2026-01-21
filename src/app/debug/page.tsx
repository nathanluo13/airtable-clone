import { createClient } from "~/lib/supabase/server";
import { cookies } from "next/headers";

export default async function DebugPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const cookieNames = cookieStore
    .getAll()
    .map((c) => c.name)
    .sort();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  return (
    <main className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="mb-8 text-3xl font-bold">Auth Debug</h1>

      <div className="space-y-6">
        <section className="rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold text-green-400">User</h2>
          {userError ? (
            <pre className="text-red-400">{JSON.stringify(userError, null, 2)}</pre>
          ) : user ? (
            <pre className="overflow-auto text-sm">{JSON.stringify(user, null, 2)}</pre>
          ) : (
            <p className="text-yellow-400">No user logged in</p>
          )}
        </section>

        <section className="rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold text-blue-400">Session</h2>
          {sessionError ? (
            <pre className="text-red-400">{JSON.stringify(sessionError, null, 2)}</pre>
          ) : session ? (
            <pre className="overflow-auto text-sm">{JSON.stringify({
              access_token: session.access_token?.slice(0, 20) + "...",
              refresh_token: session.refresh_token?.slice(0, 20) + "...",
              expires_at: session.expires_at,
              user: session.user?.email,
            }, null, 2)}</pre>
          ) : (
            <p className="text-yellow-400">No session</p>
          )}
        </section>

        <section className="rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold text-purple-400">Environment</h2>
          <pre className="text-sm">
            SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ?? "NOT SET"}{"\n"}
            ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET (" + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 20) + "...)" : "NOT SET"}
          </pre>
        </section>

        <section className="rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold text-orange-400">Request Cookies</h2>
          {cookieNames.length ? (
            <pre className="overflow-auto text-sm">
              {JSON.stringify(cookieNames, null, 2)}
            </pre>
          ) : (
            <p className="text-yellow-400">No cookies on request</p>
          )}
        </section>

        <div className="flex gap-4">
          <a
            href="/login"
            className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-700"
          >
            Go to Login
          </a>
          <a
            href="/"
            className="rounded bg-gray-600 px-4 py-2 hover:bg-gray-700"
          >
            Go to Home
          </a>
        </div>
      </div>
    </main>
  );
}
