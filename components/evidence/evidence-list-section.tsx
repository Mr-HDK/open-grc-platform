import Link from "next/link";

type EvidenceListItem = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  created_at: string;
  download_url?: string | null;
};

type EvidenceListProps = {
  title: string;
  emptyMessage: string;
  items: EvidenceListItem[];
  createHref: string;
  canCreate?: boolean;
};

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenceListSection({
  title,
  emptyMessage,
  items,
  createHref,
  canCreate = true,
}: EvidenceListProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {canCreate ? (
          <Link href={createHref} className="text-sm font-medium text-muted-foreground underline">
            Add evidence
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.file_name} | {formatFileSize(item.file_size)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Added {new Date(item.created_at).toLocaleString()}
              </p>
              {item.download_url ? (
                <p className="mt-2">
                  <a
                    href={item.download_url}
                    className="text-xs font-medium text-muted-foreground underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download file
                  </a>
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Download unavailable.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
