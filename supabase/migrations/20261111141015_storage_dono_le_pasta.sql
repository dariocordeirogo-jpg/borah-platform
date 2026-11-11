-- A API do Storage só apaga o que o usuário consegue "ver" pelo RLS. Sem esta leitura, apagar foto
-- ou vídeo retornava sucesso sem remover o arquivo. Leitura restrita à pasta da própria loja
-- (o público continua lendo pelo link público dos buckets).
create policy "fotos: dono lê a pasta da loja" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select private.my_store_id())::text);
create policy "vídeos: dono lê a pasta da loja" on storage.objects for select to authenticated
  using (bucket_id = 'product-videos' and (storage.foldername(name))[1] = (select private.my_store_id())::text);
