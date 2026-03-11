-- Refresh PostgREST schema cache after adding assets tables.

notify pgrst, 'reload schema';
