-- Refresh PostgREST schema cache after policy governance v2 changes.

notify pgrst, 'reload schema';
