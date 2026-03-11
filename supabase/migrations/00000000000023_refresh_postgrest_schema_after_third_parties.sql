-- Refresh PostgREST schema cache after adding third-party risk tables.

notify pgrst, 'reload schema';
