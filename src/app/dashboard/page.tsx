import { redirect } from "next/navigation";

import { createClient } from "~/lib/supabase/server";
import { api, HydrateClient } from "~/trpc/server";
import { DashboardClient } from "./ui/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  void api.base.list.prefetch();

  return (
    <HydrateClient>
      <DashboardClient />
    </HydrateClient>
  );
}
