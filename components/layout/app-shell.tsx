import Link from "next/link";

type AppShellProps = {
  userEmail: string;
  children: React.ReactNode;
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/risks", label: "Risks" },
  { href: "/dashboard/controls", label: "Controls" },
  { href: "/dashboard/actions", label: "Actions" },
  { href: "/dashboard/evidence", label: "Evidence" },
  { href: "/dashboard/frameworks", label: "Frameworks" },
];

export function AppShell({ userEmail, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.04),_transparent_45%)]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-border/70 bg-white/70 p-6 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Open GRC
          </p>
          <p className="mt-2 truncate text-sm text-muted-foreground">{userEmail}</p>

          <nav className="mt-8 space-y-2">
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
