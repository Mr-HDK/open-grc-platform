import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditableEntityStatusOptions,
  auditableEntityTypeOptions,
  isAuditableEntityStatus,
  isAuditableEntityType,
} from "@/lib/validators/auditable-entity";
import { cn } from "@/lib/utils/cn";

type AuditableEntityRow = {
  id: string;
  name: string;
  entity_type: string;
  status: string;
  owner_profile_id: string | null;
  parent_entity_id: string | null;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function AuditableEntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    owner?: string;
    parent?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const type = isAuditableEntityType(params.type) ? params.type : "";
  const status = isAuditableEntityStatus(params.status) ? params.status : "";
  const owner = z.string().uuid().safeParse(params.owner).success ? (params.owner ?? "") : "";
  const parent = z.string().uuid().safeParse(params.parent).success ? (params.parent ?? "") : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("auditable_entities")
    .select("id, name, entity_type, status, owner_profile_id, parent_entity_id, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (type) {
    query = query.eq("entity_type", type);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (owner) {
    query = query.eq("owner_profile_id", owner);
  }

  if (parent) {
    query = query.eq("parent_entity_id", parent);
  }

  const [{ data: entities, error }, { data: owners }, { data: parentOptions }] = await Promise.all([
    query.returns<AuditableEntityRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
    supabase
      .from("auditable_entities")
      .select("id, name")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("name")
      .returns<Array<{ id: string; name: string }>>(),
  ]);

  const ownerById = new Map(
    (owners ?? []).map((item) => [
      item.id,
      item.full_name ? `${item.full_name} (${item.email})` : item.email,
    ]),
  );
  const parentNameById = new Map((parentOptions ?? []).map((item) => [item.id, item.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auditable entities</h1>
          <p className="text-sm text-muted-foreground">
            Organize auditable scope across business units, processes, applications, and vendors.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/auditable-entities/new" className={buttonVariants()}>
            New entity
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-6">
        <Input name="q" placeholder="Search by name or description" defaultValue={q} />

        <select
          name="type"
          aria-label="Filter by type"
          defaultValue={type}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize"
        >
          <option value="">All types</option>
          {auditableEntityTypeOptions.map((option) => (
            <option key={option} value={option}>
              {formatLabel(option)}
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
          {auditableEntityStatusOptions.map((option) => (
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
          name="parent"
          aria-label="Filter by parent"
          defaultValue={parent}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All parents</option>
          {(parentOptions ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[920px] text-left text-sm">
          <caption className="sr-only">Auditable entity results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Name
              </th>
              <th scope="col" className="px-4 py-3">
                Type
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Parent
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
            {(entities ?? []).map((entity) => (
              <tr key={entity.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/auditable-entities/${entity.id}`}
                    className="font-medium hover:underline"
                  >
                    {entity.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatLabel(entity.entity_type)}</td>
                <td className="px-4 py-3">{entity.status}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entity.parent_entity_id ? parentNameById.get(entity.parent_entity_id) ?? "Unknown" : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entity.owner_profile_id ? ownerById.get(entity.owner_profile_id) ?? "Unknown" : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(entity.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!error && (entities?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No auditable entities found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
