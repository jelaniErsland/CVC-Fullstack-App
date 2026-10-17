import type { ReactNode } from "react";

import { PersistentAdminShell } from "@/components/AdminShell";
import { adminDestinations } from "@/lib/adminNavigation";
import { readVerifiedAdminContext } from "@/lib/auth/verified-admin-context.server";
import { selectOverviewWorkspaceContext } from "@/lib/overview/routeRead.server";
import { withReadTimeout } from "@/lib/readTimeout";

export default async function WorkspaceAdminLayout({ children }: { children: ReactNode }) {
  // The page remains the authority for its own data and actions. This context
  // supplies only navigation presentation and is shared within this request.
  const verified = await withReadTimeout(readVerifiedAdminContext()).catch(() => null);
  const selection = verified ? selectOverviewWorkspaceContext(verified) : null;
  const ready = selection?.ok ? selection : null;

  return (
    <PersistentAdminShell
      active="overview"
      workspaceName={ready?.workspace.displayName}
      destinations={ready ? adminDestinations(ready.capabilities) : ["overview"]}
      calendarWorkspaceKey={ready?.workspace.key ?? null}
    >
      {children}
    </PersistentAdminShell>
  );
}
