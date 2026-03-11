import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assetCriticalityOptions,
  assetStatusOptions,
  isAssetCriticality,
  isAssetStatus,
} from "@/lib/validators/asset";
import { cn } from "@/lib/utils/cn";

type AssetRow = {
  id: string;
  name: string;
  asset_type: string;
  criticality: string;
  status: string;
  owner_profile_id: string | null;
  updated_at: string;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type AssetTypeRow = {
  asset_type: string;
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    criticality?: string;
    owner?: string;
    status?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const type = params.type?.trim() ?? "";
  const criticality = isAssetCriticality(params.criticality) ? params.criticality : "";
  const status = isAssetStatus(params.status) ? params.status : "";
  const owner = z.string().uuid().safeParse(params.owner).success ? (params.owner ?? "") : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("assets")
    .select("id, name, asset_type, criticality, status, owner_profile_id, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,asset_type.ilike.%${q}%`);
  }

  if (type) {
    query = query.eq("asset_type", type);
  }

  if (criticality) {
    query = query.eq("criticality", criticality);
  }

  if (owner) {
    query = query.eq("owner_profile_id", owner);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const [{ data: assets, error }, { data: owners }, { data: assetTypes }] = await Promise.all([
    query.returns<AssetRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OwnerRow[]>(),
    supabase
      .from("assets")
      .select("asset_type")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<AssetTypeRow[]>(),
  ]);

  const ownerById = new Map(
    (owners ?? []).map((item) => [
      item.id,
      item.full_name ? `${item.full_name} (${item.email})` : item.email,
    ]),
  );

  const uniqueTypes = Array.from(new Set((assetTypes ?? []).map((item) => item.asset_type))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Asset register</h1>
          <p className="text-sm text-muted-foreground">
            Track critical assets and link them to risks and controls.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/assets/new" className={buttonVariants()}>
            New asset
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-6">
        <Input name="q" placeholder="Search by name or type" defaultValue={q} />

        <select
          name="type"
          aria-label="Filter by type"
          defaultValue={type}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All types</option>
          {uniqueTypes.map((assetType) => (
            <option key={assetType} value={assetType}>
              {assetType}
            </option>
          ))}
        </select>

        <select
          name="criticality"
          aria-label="Filter by criticality"
          defaultValue={criticality}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All criticalities</option>
          {assetCriticalityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="owner"
          aria-label="Filter by owner"
          defaultValue={owner}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All owners</option>
          {(owners ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.full_name ? `${item.full_name} (${item.email})` : item.email}
            </option>
          ))}
        </select>

        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {assetStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[860px] text-left text-sm">
          <caption className="sr-only">Asset register results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Name
              </th>
              <th scope="col" className="px-4 py-3">
                Type
              </th>
              <th scope="col" className="px-4 py-3">
                Criticality
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Owner
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {(assets ?? []).map((asset) => (
              <tr key={asset.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/assets/${asset.id}`} className="font-medium hover:underline">
                    {asset.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{asset.asset_type}</td>
                <td className="px-4 py-3">{asset.criticality}</td>
                <td className="px-4 py-3">{asset.status}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {asset.owner_profile_id ? ownerById.get(asset.owner_profile_id) ?? "Unknown" : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(asset.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!error && (assets?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No assets found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
