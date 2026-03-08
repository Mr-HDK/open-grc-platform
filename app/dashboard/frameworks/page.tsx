import { requireSessionProfile } from "@/lib/auth/profile";

export default async function FrameworksPage() {
  await requireSessionProfile("admin");

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Frameworks</h1>
      <p className="text-sm text-muted-foreground">
        Framework mappings are restricted to admin users in this MVP baseline.
      </p>
    </div>
  );
}
