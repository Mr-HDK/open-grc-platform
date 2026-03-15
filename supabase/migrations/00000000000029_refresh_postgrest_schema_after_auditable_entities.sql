-- Refresh PostgREST schema cache after adding auditable entity tables.

notify pgrst, 'reload schema';
