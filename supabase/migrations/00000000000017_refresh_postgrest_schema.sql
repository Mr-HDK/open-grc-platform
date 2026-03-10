-- Force PostgREST schema reload after newly applied migrations.

notify pgrst, 'reload schema';
