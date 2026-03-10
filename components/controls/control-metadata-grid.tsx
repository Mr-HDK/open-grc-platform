type ControlMetadata = {
  control_type: string;
  effectiveness_status: string;
  review_frequency: string;
  next_review_date: string | null;
  updated_at: string;
};

type OwnerDetail = {
  email: string;
  full_name: string | null;
} | null;

type ControlMetadataGridProps = {
  control: ControlMetadata;
  owner: OwnerDetail;
};

export function ControlMetadataGrid({ control, owner }: ControlMetadataGridProps) {
  const ownerLabel = owner
    ? owner.full_name
      ? `${owner.full_name} (${owner.email})`
      : owner.email
    : "-";

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
        <p className="mt-1 text-sm font-medium">{control.control_type}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Effectiveness</p>
        <p className="mt-1 text-sm font-medium">{control.effectiveness_status}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Review frequency</p>
        <p className="mt-1 text-sm font-medium">{control.review_frequency}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Next review</p>
        <p className="mt-1 text-sm font-medium">{control.next_review_date ?? "-"}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
        <p className="mt-1 text-sm font-medium">{ownerLabel}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
        <p className="mt-1 text-sm font-medium">
          {new Date(control.updated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
