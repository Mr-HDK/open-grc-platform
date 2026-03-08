import { createSupabaseServerClient } from "@/lib/supabase/server";

type EvidencePathRow = {
  id: string;
  file_path: string;
};

export async function getEvidenceSignedUrlById(
  rows: EvidencePathRow[],
  expiresInSeconds = 300,
) {
  if (rows.length === 0) {
    return new Map<string, string | null>();
  }

  const supabase = await createSupabaseServerClient();
  const urlEntries = await Promise.all(
    rows.map(async (row) => {
      const { data, error } = await supabase.storage
        .from("evidence")
        .createSignedUrl(row.file_path, expiresInSeconds);

      return [row.id, error ? null : (data?.signedUrl ?? null)] as const;
    }),
  );

  return new Map<string, string | null>(urlEntries);
}
