import Link from "next/link";

type AdminNavProps = {
  active?:
    | "overview"
    | "volunteers"
    | "schedule"
    | "food"
    | "security"
    | "announcements"
    | "emails"
    | "needs-attention"
    | "conflicts"
    | "settings";
};

const navItems = [
  { id: "overview", label: "Overview", href: "/admin/dashboard#overview" },
  { id: "volunteers", label: "Volunteers", href: "/admin/volunteers" },
  { id: "schedule", label: "Schedule", href: "/admin/dashboard#schedule" },
  { id: "food", label: "Food", href: "/admin/dashboard#food" },
  { id: "security", label: "Security", href: "/admin/dashboard#security" },
  {
    id: "announcements",
    label: "Announcements",
    href: "/admin/dashboard#announcements",
  },
  { id: "emails", label: "Emails", href: "/admin/dashboard#emails" },
  {
    id: "needs-attention",
    label: "Needs Attention",
    href: "/admin/dashboard#needs-attention",
  },
  { id: "conflicts", label: "Conflicts", href: "/admin/dashboard#conflicts" },
  { id: "settings", label: "Settings", href: "/admin/dashboard#settings" },
] as const;

export function AdminNav({ active = "overview" }: AdminNavProps) {
  return (
    <nav className="mt-6 grid gap-2 text-sm font-medium text-slate-600">
      {navItems.map((item) => (
        <Link
          key={item.id}
          className={[
            "rounded-lg px-3 py-2 transition hover:bg-white/58 hover:text-slate-950",
            active === item.id ? "bg-white/58 text-slate-950" : "",
          ].join(" ")}
          href={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
