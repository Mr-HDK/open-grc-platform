import { AppShell } from "@/components/layout/app-shell";
import { requireSessionUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSessionUser();

  return <AppShell userEmail={user.email ?? "unknown@local"}>{children}</AppShell>;
}
