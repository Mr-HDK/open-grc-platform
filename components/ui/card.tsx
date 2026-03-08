type CardProps = {
  title: string;
  value: string;
  helper?: string;
};

export function Card({ title, value, helper }: CardProps) {
  return (
    <article className="rounded-lg border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {helper ? <p className="mt-2 text-xs text-muted-foreground">{helper}</p> : null}
    </article>
  );
}
