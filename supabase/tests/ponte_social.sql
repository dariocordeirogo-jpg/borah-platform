-- Teste da ponte com TikTok e Instagram: vínculo por código, lance e "EU QUERO" pelo chat, assinatura do conector,
-- espelho apagado quando a live termina.
-- Roda numa transação e desfaz tudo (rollback). O segredo do conector é criado aqui e some no rollback.
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000d1','vend-tt@teste.zexi','{"full_name":"Vendedor TT"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d2','ana-tt@teste.zexi','{"full_name":"Ana TT"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d3','bia-tt@teste.zexi','{"full_name":"Bia TT"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
select vault.create_secret('segredo-de-teste-do-conector-social-0123456789', 'social_bridge_secret_teste');
-- Usa o segredo real se existir; senão o de teste
create function pg_temp.secret() returns text language sql as $$
  select coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'social_bridge_secret'),
                  (select decrypted_secret from vault.decrypted_secrets where name = 'social_bridge_secret_teste'))
$$;
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'social_bridge_secret') then
    perform vault.create_secret('segredo-de-teste-do-conector-social-0123456789', 'social_bridge_secret');
  end if;
end $$;
create function pg_temp.sig(_payload text) returns text language sql as $$
  select encode(extensions.hmac(convert_to(_payload, 'UTF8'), convert_to(pg_temp.secret(), 'UTF8'), 'sha256'), 'hex')
$$;
create function pg_temp.c(_msg text, _user text, _text text, _platform text default 'tiktok') returns text language sql as $$
  select public.social_bridge_comment(p, pg_temp.sig(p)) ->> 'result'
  from (select json_build_object('platform', _platform, 'live_id', (select v from ids where k='live'), 'msg_id', _msg,
    'username', _user, 'nickname', initcap(_user), 'text', _text, 'ts', (extract(epoch from now()) * 1000)::bigint)::text p) x
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Loja com live no ar e dois produtos
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
insert into ids values ('store', public.create_store('Loja TT', 'loja-tt-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values
  ((select v::uuid from ids where k='store'), 'Relógio TT', 20000, 3, 'active'),
  ((select v::uuid from ids where k='store'), 'Óculos TT', 9000, 1, 'active');
insert into ids select 'rel', id from public.products where title = 'Relógio TT';
insert into ids select 'oc', id from public.products where title = 'Óculos TT';
insert into ids values ('live', public.create_live('Live TT', null, now() + interval '1 minute',
  array[(select v from ids where k='rel'), (select v from ids where k='oc')]::uuid[]));
insert into r select '@ inválido recusado',
  pg_temp.err(format('select public.set_live_social(%L, %L, %L)', (select v from ids where k='live'), 'tiktok', 'a b')) = 'invalid_social_username';
insert into r select 'rede desconhecida recusada',
  pg_temp.err(format('select public.set_live_social(%L, %L, %L)', (select v from ids where k='live'), 'orkut', 'loja')) = 'invalid_platform';
select public.set_live_social((select v::uuid from ids where k='live'), 'tiktok', '@Loja.TT');
insert into r select 'loja liga a live ao @ do TikTok (normalizado)', tiktok_username = 'loja.tt' from public.lives where id = (select v::uuid from ids where k='live');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
insert into r select 'outra pessoa não liga a live alheia',
  pg_temp.err(format('select public.set_live_social(%L, %L, %L)', (select v from ids where k='live'), 'tiktok', 'golpe')) = 'live_not_found';

-- Conector: sem assinatura válida nada passa; live ainda não está no ar
reset role;
insert into r select 'assinatura errada recusada',
  pg_temp.err(format('select public.social_bridge_targets(%L, %L)', '{"kind":"targets","ts":' || (extract(epoch from now())*1000)::bigint || '}', 'abc')) = 'bad_signature';
insert into r select 'payload antigo recusado',
  pg_temp.err(format('select public.social_bridge_targets(%L, %L)', '{"kind":"targets","ts":1000}', pg_temp.sig('{"kind":"targets","ts":1000}'))) = 'stale_payload';
insert into r select 'comentário fora do ar ignorado', pg_temp.c('m0', 'ana_tt', 'oi') = 'live_not_live';

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select public.start_live((select v::uuid from ids where k='live'));
select public.pin_live_product((select v::uuid from ids where k='live'), (select v::uuid from ids where k='rel'));
reset role;
insert into r select 'conector recebe a live no ar com o @',
  public.social_bridge_targets(p, pg_temp.sig(p)) @> jsonb_build_array(jsonb_build_object('live_id', (select v from ids where k='live'), 'platform', 'tiktok', 'username', 'loja.tt'))
  from (select json_build_object('kind', 'targets', 'ts', (extract(epoch from now())*1000)::bigint)::text p) x;

-- Comentário comum é espelhado; repetição do mesmo id é ignorada
insert into r select 'Instagram não ligado à live é ignorado', pg_temp.c('i0', 'ana_ig', 'oi', 'instagram') = 'platform_not_linked';
insert into r select 'comentário espelhado', pg_temp.c('m1', 'ana_tt', 'Que lindo!') = 'comment';
insert into r select 'mesmo comentário não duplica', pg_temp.c('m1', 'ana_tt', 'Que lindo!') = 'duplicate';

-- EU QUERO sem vínculo: pede para vincular
insert into r select 'EU QUERO sem vínculo pede vínculo', pg_temp.c('m2', 'ana_tt', 'eu quero!!') = 'not_linked';

-- Ana gera o código no Zexi e comenta com o @ dela
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
insert into ids values ('code', public.start_social_link());
insert into r select 'código no formato ZX + 6 dígitos', (select v from ids where k='code') ~ '^ZX[0-9]{6}$';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
insert into r select 'outra pessoa não vê o código da Ana', count(*) = 0 from public.social_link_codes where code = (select v from ids where k='code');
reset role;
insert into r select 'código errado não vincula', pg_temp.c('m3', 'ana_tt', 'ZX000000') = 'invalid_code';
insert into r select 'código certo vincula o @', pg_temp.c('m4', 'Ana_TT', lower((select v from ids where k='code'))) = 'linked';
insert into r select 'vínculo gravado', exists (select 1 from public.social_links where user_id = '00000000-0000-0000-0000-0000000000d2' and platform = 'tiktok' and username = 'ana_tt');
insert into r select 'código não vale duas vezes', pg_temp.c('m5', 'golpista', (select v from ids where k='code')) = 'invalid_code';
insert into r select 'espelho não mostra o código', not exists (select 1 from public.live_social_events where body ~ 'ZX[0-9]{6}');

-- EU QUERO vinculado: produto fixado vai para o carrinho
insert into r select 'EU QUERO vinculado vai para o carrinho', pg_temp.c('m6', 'ana_tt', 'EU QUERO') = 'in_cart';
insert into r select 'item no carrinho da Ana', exists (select 1 from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000d2' and product_id = (select v::uuid from ids where k='rel') and live_id = (select v::uuid from ids where k='live'));

-- Leilão na live: lance pelo TikTok passa pelas mesmas regras do site
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
insert into ids values ('a', public.start_live_auction((select v::uuid from ids where k='live'), (select v::uuid from ids where k='oc'), 10000, 1000, 5)::text);
reset role;
insert into r select 'EU QUERO bloqueado durante leilão', pg_temp.c('m7', 'ana_tt', 'eu quero') = 'auction_running';
insert into r select 'lance sem verificação de CPF segue a regra do site', pg_temp.c('m8', 'ana_tt', 'LANCE 100') = 'verification_required';
insert into public.user_verifications (user_id, cpf_hash, cpf_masked, phone) values
  ('00000000-0000-0000-0000-0000000000d2', 'hash-tt-ana', '***.000.000-**', '+5511999990001');
insert into r select 'lance abaixo do mínimo recusado', pg_temp.c('m9', 'ana_tt', 'lance 50') = 'bid_too_low';
insert into r select 'lance válido aceito', pg_temp.c('m10', 'ana_tt', 'Lance R$ 1.200,50') = 'ok';
insert into r select 'leilão atualizado com o lance do TikTok',
  current_price_cents = 120050 and leader_id = '00000000-0000-0000-0000-0000000000d2' from public.auctions where id = (select v::uuid from ids where k='a');
insert into r select 'quem lidera não cobre o próprio lance', pg_temp.c('m11', 'ana_tt', 'lance 1300') = 'already_leading';
insert into r select 'lance de @ não vinculado', pg_temp.c('m12', 'perfil_falso', 'LANCE 5000') = 'not_linked';
insert into r select 'perfil falso não mexe no leilão', current_price_cents = 120050 from public.auctions where id = (select v::uuid from ids where k='a');
insert into r select 'resultado de cada comando no espelho', (select count(*) from public.live_social_events where kind = 'bid' and live_id = (select v::uuid from ids where k='live')) = 5;

-- Lance pelo site continua igual
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
insert into r select 'lance no site sem verificação continua bloqueado',
  pg_temp.err(format('select public.place_bid(%L, 150000, %L)', (select v from ids where k='a'), 'k1')) = 'verification_required';

-- Espelho público; ninguém escreve direto
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
insert into r select 'espelho visível para quem assiste', count(*) > 0 from public.live_social_events where live_id = (select v::uuid from ids where k='live');
insert into r select 'ninguém escreve no espelho direto',
  pg_temp.err(format('insert into public.live_social_events (live_id, platform, msg_id, username, nickname, body, kind) values (%L, %L, %L, %L, %L, %L, %L)',
    (select v from ids where k='live'), 'tiktok', 'x', 'x1', 'x', 'x', 'comment')) ~ 'permission denied|row-level security';
insert into r select 'ninguém se vincula direto',
  pg_temp.err($q$insert into public.social_links (user_id, platform, username) values ('00000000-0000-0000-0000-0000000000d3', 'tiktok', 'qualquer')$q$) ~ 'permission denied|row-level security';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select public.unlink_social('tiktok');
insert into r select 'Ana desvincula o TikTok', not exists (select 1 from public.social_links where user_id = '00000000-0000-0000-0000-0000000000d2' and platform = 'tiktok');

-- Instagram: a loja liga o @ e o mesmo código de vínculo vale para a outra rede
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select public.set_live_social((select v::uuid from ids where k='live'), 'instagram', 'loja.ig');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
insert into ids values ('code_bia', public.start_social_link());
reset role;
insert into r select 'conector recebe o @ do Instagram também',
  public.social_bridge_targets(p, pg_temp.sig(p)) @> jsonb_build_array(jsonb_build_object('live_id', (select v from ids where k='live'), 'platform', 'instagram', 'username', 'loja.ig'))
  from (select json_build_object('kind', 'targets', 'ts', (extract(epoch from now())*1000)::bigint)::text p) x;
insert into r select 'Bia vincula o @ do Instagram', pg_temp.c('i1', 'bia.ig', (select v from ids where k='code_bia'), 'instagram') = 'linked';
insert into r select 'vínculo do Instagram não vale no TikTok', pg_temp.c('m13', 'bia.ig', 'LANCE 2000') = 'not_linked';
insert into public.user_verifications (user_id, cpf_hash, cpf_masked, phone) values
  ('00000000-0000-0000-0000-0000000000d3', 'hash-tt-bia', '***.000.001-**', '+5511999990002');
insert into r select 'lance pelo Instagram cobre o do TikTok', pg_temp.c('i2', 'bia.ig', 'lance 1400', 'instagram') = 'ok';
insert into r select 'mesmo id de mensagem em redes diferentes não colide', pg_temp.c('m1', 'bia.ig', 'oi', 'instagram') = 'comment';

-- Acabou a live: o espelho dos comentários é apagado
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select public.end_live((select v::uuid from ids where k='live'));
reset role;
insert into r select 'espelho apagado quando a live termina', not exists (select 1 from public.live_social_events where live_id = (select v::uuid from ids where k='live'));
insert into r select 'lances continuam no leilão', current_price_cents = 140000 from public.auctions where id = (select v::uuid from ids where k='a');
insert into r select 'comentário depois do fim é ignorado', pg_temp.c('m14', 'ana_tt', 'oi') = 'live_not_live';

reset role;
select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
