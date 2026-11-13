-- Vídeo do produto: link do YouTube, Instagram ou Facebook colado pela loja (o player é montado pelo servidor a partir do ID).
alter table public.products add column video_url text
  check (video_url is null or (length(video_url) <= 500 and video_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch)/'));
comment on column public.products.video_url is 'Link do vídeo do produto (YouTube, Instagram ou Facebook).';
