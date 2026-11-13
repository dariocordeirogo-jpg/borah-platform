-- A loja pode alterar o vídeo do próprio produto (o RLS de products continua limitando à loja dona).
grant update (video_url) on public.products to authenticated;
