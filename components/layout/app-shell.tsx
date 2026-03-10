import Link from "next/link";

import { type Role } from "@/lib/permissions/roles";

type AppShellProps = {
  userEmail: string;
  userRole: Role;
  children: React.ReactNode;
};

const baseNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/risks", label: "Risks" },
  { href: "/dashboard/risk-acceptances", label: "Risk acceptances" },
  { href: "/dashboard/controls", label: "Controls" },
  { href: "/dashboard/control-reviews", label: "Control reviews" },
  { href: "/dashboard/control-tests", label: "Control tests" },
  { href: "/dashboard/findings", label: "Findings" },
  { href: "/dashboard/actions", label: "Actions" },
  { href: "/dashboard/incidents", label: "Incidents" },
  { href: "/dashboard/evidence", label: "Evidence" },
];

const roleBadgeClass: Record<Role, string> = {
  admin: "bg-slate-900 text-white",
  manager: "bg-slate-200 text-slate-900",
  contributor: "bg-sky-100 text-sky-700",
  viewer: "bg-zinc-100 text-zinc-700",
};

export function AppShell({ userEmail, userRole, children }: AppShellProps) {
  const navLinks = [...baseNavLinks];

  if (userRole === "admin") {
    navLinks.push({ href: "/dashboard/frameworks", label: "Frameworks" });
    navLinks.push({ href: "/dashboard/libraries", label: "Libraries" });
    navLinks.push({ href: "/dashboard/settings", label: "Settings" });
  }

  if (userRole === "admin" || userRole === "manager") {
    navLinks.push({ href: "/dashboard/reporting", label: "Reporting" });
    navLinks.push({ href: "/dashboard/notifications", label: "Notifications" });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.04),_transparent_45%)]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-border/70 bg-white/70 p-6 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Open GRC
          </p>
          <p className="mt-2 truncate text-sm text-muted-foreground">{userEmail}</p>
          <p
            className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${roleBadgeClass[userRole]}`}
          >
            {userRole}
          </p>

          <nav aria-label="Primary navigation" className="mt-8 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
