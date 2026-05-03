-- Refresh PostgREST schema cache after reporting saved view changes.

notify pgrst, 'reload schema';
