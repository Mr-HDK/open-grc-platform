import { requireSessionProfile } from "@/lib/auth/profile";

export default async function SettingsPage() {
  const profile = await requireSessionProfile("admin");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted-foreground">
        Admin-only area for tenant and permission administration.
      </p>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Current admin</p>
        <p className="mt-1 text-sm font-medium">{profile.email}</p>
      </div>
    </div>
  );
}
