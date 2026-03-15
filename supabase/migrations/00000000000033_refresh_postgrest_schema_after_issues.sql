-- Refresh PostgREST schema cache after adding unified issues tables.

notify pgrst, 'reload schema';
