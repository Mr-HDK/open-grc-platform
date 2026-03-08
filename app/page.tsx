import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-border/60 bg-card/80 p-10 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Open GRC Platform
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Risk and controls MVP bootstrap
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Initial project scaffold with Next.js, Tailwind, Supabase setup, and
          protected dashboard routes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard" className={buttonVariants()}>
            Go to dashboard
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Go to login
          </Link>
        </div>
      </div>
    </main>
  );
}
