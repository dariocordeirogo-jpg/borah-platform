-- Perguntas e respostas no produto (como nos grandes marketplaces).
-- Quem está logado pergunta; só a loja dona do produto responde. Contato fora da Zexi (e-mail, telefone, links,
-- WhatsApp) é recusado nas perguntas e nas respostas, para a compra continuar protegida pela Compra Garantida.
-- Escrita só pelas funções abaixo; leitura pública das perguntas visíveis de produtos à venda.

create table public.product_questions (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  asker_id uuid not null references auth.users (id) on delete cascade,
  asker_alias text not null,
  body text not null check (char_length(body) between 5 and 500),
  answer text check (answer is null or char_length(answer) between 2 and 1000),
  answered_at timestamptz,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_questions_product_idx on public.product_questions (product_id, created_at desc) where not hidden;
create index product_questions_store_open_idx on public.product_questions (store_id, created_at) where answer is null and not hidden;
create index product_questions_asker_idx on public.product_questions (asker_id);
alter table public.product_questions enable row level security;

-- Visível: pergunta não escondida de produto à venda; quem perguntou e a loja sempre veem as suas; moderação vê tudo
create policy "perguntas: visitante lê as visíveis" on public.product_questions for select to anon using (
  not hidden and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
);
create policy "perguntas: leitura de quem entrou" on public.product_questions for select to authenticated using (
  (not hidden and exists (select 1 from public.products p where p.id = product_id and p.status = 'active'))
  or asker_id = (select auth.uid())
  or store_id = (select private.my_store_id())
  or (select private.staff_can('moderate'))
);
revoke insert, update, delete on public.product_questions from anon, authenticated;

-- Contato fora da plataforma: e-mail, link, @perfil, WhatsApp ou telefone (DDD + 8 ou 9 dígitos, com ou sem separadores)
create function private.has_contact(_t text) returns boolean
language sql immutable set search_path = '' as $$
  select _t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
      or _t ~* '(https?://|www\.|\.com\y|\.com\.br\y|\.net\y|wa\.me|whats ?app|zap ?zap|telegram|instagram\.com)'
      or _t ~ '\(?[0-9]{2}\)?[ .-]?9?[ .-]?[0-9]{4}[ .-]?[0-9]{4}'
      or _t ~ '(^|\s)@[A-Za-z0-9._]{3,}'
$$;

create function public.ask_question(_product_id uuid, _body text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _b text := btrim(regexp_replace(coalesce(_body, ''), '\s+', ' ', 'g'));
  _p record;
  _id bigint;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(_b) < 5 or char_length(_b) > 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
  if private.has_contact(_b) then raise exception 'contact_not_allowed' using errcode = 'P0001'; end if;
  select p.id, p.status, p.store_id, s.owner_id into _p from public.products p join public.stores s on s.id = p.store_id where p.id = _product_id;
  if _p.id is null or _p.status <> 'active' then raise exception 'product_not_found' using errcode = 'P0001'; end if;
  if _p.owner_id = _uid then raise exception 'own_product' using errcode = 'P0001'; end if;
  if (select count(*) from public.product_questions where asker_id = _uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_questions' using errcode = 'P0001';
  end if;
  insert into public.product_questions (product_id, store_id, asker_id, asker_alias, body)
  values (_p.id, _p.store_id, _uid, coalesce(private.alias_for(_uid), 'Comprador'), _b)
  returning id into _id;
  perform private.enqueue('email', 'question.received', (select email from auth.users where id = _p.owner_id),
    jsonb_build_object('question_id', _id, 'product_id', _p.id));
  return _id;
end $$;

-- Só a loja dona responde (pode corrigir a resposta depois)
create function public.answer_question(_question_id bigint, _answer text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  _a text := btrim(coalesce(_answer, ''));
  _q public.product_questions;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _q from public.product_questions where id = _question_id for update;
  if _q.id is null or _q.store_id is distinct from private.my_store_id() then raise exception 'question_not_found' using errcode = 'P0001'; end if;
  if char_length(_a) < 2 or char_length(_a) > 1000 then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
  if private.has_contact(_a) then raise exception 'contact_not_allowed' using errcode = 'P0001'; end if;
  update public.product_questions set answer = _a, answered_at = coalesce(answered_at, now()) where id = _q.id;
  if _q.answer is null then
    perform private.enqueue('email', 'question.answered', (select email from auth.users where id = _q.asker_id),
      jsonb_build_object('question_id', _q.id, 'product_id', _q.product_id));
  end if;
end $$;

-- Loja esconde pergunta ofensiva ou fora de contexto; moderação também
create function public.hide_question(_question_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.product_questions set hidden = true
  where id = _question_id and (store_id = private.my_store_id() or private.staff_can('moderate'));
  if not found then raise exception 'question_not_found' using errcode = 'P0001'; end if;
end $$;

revoke execute on function public.ask_question(uuid, text), public.answer_question(bigint, text), public.hide_question(bigint) from public, anon;
grant execute on function public.ask_question(uuid, text), public.answer_question(bigint, text), public.hide_question(bigint) to authenticated;
revoke execute on function private.has_contact(text) from public, anon, authenticated;
