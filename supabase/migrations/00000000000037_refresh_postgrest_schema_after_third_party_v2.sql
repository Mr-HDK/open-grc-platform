-- Refresh PostgREST schema cache after third-party v2 changes.

notify pgrst, 'reload schema';
