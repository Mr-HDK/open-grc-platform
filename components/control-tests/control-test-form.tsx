import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { controlTestResultOptions, type ControlTestResult } from "@/lib/validators/control-test";
import { cn } from "@/lib/utils/cn";

type Option = {
  id: string;
  label: string;
};

type ControlTestFormDefaults = {
  controlTestId?: string;
  controlId?: string;
  testPeriodStart?: string;
  testPeriodEnd?: string;
  testerProfileId?: string;
  result?: ControlTestResult;
  notes?: string | null;
  findingId?: string | null;
};

type ControlTestFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  controlOptions: Option[];
  testerOptions: Option[];
  defaults?: ControlTestFormDefaults;
  error?: string | null;
  cancelHref?: string;
};

const textAreaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function ControlTestForm({
  mode,
  action,
  controlOptions,
  testerOptions,
  defaults,
  error,
  cancelHref = "/dashboard/control-tests",
}: ControlTestFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "control-test-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.controlTestId ? (
        <input type="hidden" name="controlTestId" value={defaults.controlTestId} />
      ) : null}
      {defaults?.findingId ? (
        <input type="hidden" name="findingId" value={defaults.findingId} />
      ) : null}

      {error ? <FeedbackAlert id="control-test-form-error" message={error} /> : null}

      {defaults?.findingId ? (
        <FeedbackAlert
          variant="success"
          title="Retest mode"
          message="This control test will update the linked finding status."
        />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="controlId" className="text-sm font-medium">
            Control
          </label>
          <select
            id="controlId"
            name="controlId"
            required
            defaultValue={defaults?.controlId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="" disabled>
              Select control
            </option>
            {controlOptions.map((control) => (
              <option key={control.id} value={control.id}>
                {control.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="testPeriodStart" className="text-sm font-medium">
            Test period start
          </label>
          <Input
            id="testPeriodStart"
            name="testPeriodStart"
            type="date"
            required
            defaultValue={defaults?.testPeriodStart ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="testPeriodEnd" className="text-sm font-medium">
            Test period end
          </label>
          <Input
            id="testPeriodEnd"
            name="testPeriodEnd"
            type="date"
            required
            defaultValue={defaults?.testPeriodEnd ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="testerProfileId" className="text-sm font-medium">
            Tester
          </label>
          <select
            id="testerProfileId"
            name="testerProfileId"
            required
            defaultValue={defaults?.testerProfileId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="" disabled>
              Select tester
            </option>
            {testerOptions.map((tester) => (
              <option key={tester.id} value={tester.id}>
                {tester.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="result" className="text-sm font-medium">
            Result
          </label>
          <select
            id="result"
            name="result"
            defaultValue={defaults?.result ?? "passed"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {controlTestResultOptions.map((result) => (
              <option key={result} value={result}>
                {result}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            maxLength={2000}
            defaultValue={defaults?.notes ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create control test" : "Save changes"}
        </button>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
