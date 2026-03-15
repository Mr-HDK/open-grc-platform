-- Refresh PostgREST schema cache after adding audit management tables.

notify pgrst, 'reload schema';
