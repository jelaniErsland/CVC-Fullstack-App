import { AdminShell } from "@/components/AdminShell";
import { ProjectSettingsPanel } from "@/components/ProjectSettingsPanel";
import { getAssignedProjectWorkspace } from "@/lib/mockData";

export default function AdminSettingsPage() {
  const workspace = getAssignedProjectWorkspace();

  if (!workspace.project) {
    return null;
  }

  return (
    <AdminShell active="settings">
          <ProjectSettingsPanel
            project={workspace.project}
            contacts={workspace.contacts}
          />
    </AdminShell>
  );
}
