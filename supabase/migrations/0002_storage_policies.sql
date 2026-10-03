create policy erp_files_select on storage.objects for select to anon, authenticated using (bucket_id = 'erp-files');
create policy erp_files_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'erp-files');
create policy erp_files_update on storage.objects for update to anon, authenticated using (bucket_id = 'erp-files') with check (bucket_id = 'erp-files');
create policy erp_files_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'erp-files');
