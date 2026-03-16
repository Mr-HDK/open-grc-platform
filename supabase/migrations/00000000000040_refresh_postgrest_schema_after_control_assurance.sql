-- Refresh PostgREST schema cache after control assurance changes.

notify pgrst, 'reload schema';
