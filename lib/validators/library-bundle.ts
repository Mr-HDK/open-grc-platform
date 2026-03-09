import { z } from "zod";

import { hasLibraryBundle } from "@/lib/libraries/bundles";

export const applyLibraryBundleSchema = z.object({
  bundleId: z
    .string()
    .trim()
    .min(1, "Bundle selection is required.")
    .refine((value) => hasLibraryBundle(value), {
      message: "Selected bundle is invalid.",
    }),
});

export type ApplyLibraryBundleInput = z.infer<typeof applyLibraryBundleSchema>;
