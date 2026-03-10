import { createCommentAction } from "@/app/dashboard/comments/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type CommentItem = {
  id: string;
  body: string;
  authorLabel: string;
  createdAt: string;
};

type CommentsSectionProps = {
  title?: string;
  entityType: "risk" | "control" | "action_plan";
  entityId: string;
  items: CommentItem[];
  canCreate: boolean;
};

export function CommentsSection({
  title = "Comments",
  entityType,
  entityId,
  items,
  canCreate,
}: CommentsSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <p className="text-sm whitespace-pre-line">{item.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.authorLabel} | {new Date(item.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <form action={createCommentAction} className="mt-4 space-y-2">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <label htmlFor={`comment-${entityType}-${entityId}`} className="sr-only">
            Add a comment
          </label>
          <textarea
            id={`comment-${entityType}-${entityId}`}
            name="body"
            rows={3}
            required
            maxLength={2000}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Add a comment..."
          />
          <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
            Post comment
          </button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Contributors or higher can add comments.
        </p>
      )}
    </section>
  );
}
