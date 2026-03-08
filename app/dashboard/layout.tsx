import { AppShell } from "@/components/layout/app-shell";
import { requireSessionProfile } from "@/lib/auth/profile";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireSessionProfile("viewer");

  return (
    <AppShell userEmail={profile.email} userRole={profile.role}>
      {children}
    </AppShell>
  );
}
