import { AdminShell } from "@/components/AdminShell";
import { CreateProjectWizard } from "@/components/CreateProjectWizard";

export default function AdminNewProjectPage() {
  return (
    <AdminShell active="projects">
      <CreateProjectWizard />
    </AdminShell>
  );
}
