-- Refresh PostgREST schema cache after RCSA changes.

notify pgrst, 'reload schema';
