type FeedbackAlertProps = {
  message: string;
  variant?: "error" | "success";
  title?: string;
  id?: string;
};

const styleByVariant: Record<NonNullable<FeedbackAlertProps["variant"]>, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const defaultTitleByVariant: Record<NonNullable<FeedbackAlertProps["variant"]>, string> = {
  error: "We could not save your changes.",
  success: "Operation completed.",
};

export function FeedbackAlert({ message, variant = "error", title, id }: FeedbackAlertProps) {
  const semanticRole = variant === "error" ? "alert" : "status";

  return (
    <div
      id={id}
      role={semanticRole}
      aria-live="polite"
      className={`rounded-md border px-3 py-2 text-sm ${styleByVariant[variant]}`}
    >
      <p className="font-semibold">{title ?? defaultTitleByVariant[variant]}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
