-- Refresh PostgREST schema cache after adding policy/attestation tables.

notify pgrst, 'reload schema';
