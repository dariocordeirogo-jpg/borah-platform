-- Teste de RLS da Fase 1. Roda dentro de uma transação e desfaz tudo no fim (rollback).
-- Uso: cole no SQL Editor do Supabase (ou rode via psql). Todas as linhas devem vir com ok = true.
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-00000000000a','a@teste.livelance','{"full_name":"Ana Teste"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000b','b@teste.livelance','{}','authenticated','authenticated');

create temp table r(test text, ok boolean) on commit drop;
grant all on r to authenticated, anon;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);

insert into r select 'A vê o próprio perfil', count(*)=1 from public.profiles where id='00000000-0000-0000-0000-00000000000a';
insert into r select 'A NÃO vê perfil de B', count(*)=0 from public.profiles where id='00000000-0000-0000-0000-00000000000b';
insert into r select 'A tem papel buyer', exists(select 1 from public.user_roles where role='buyer');
insert into r select 'nome veio do metadata', (select display_name from public.profiles where id='00000000-0000-0000-0000-00000000000a')='Ana Teste';
with u as (update public.profiles set display_name='Hack' where id='00000000-0000-0000-0000-00000000000b' returning 1)
insert into r select 'A NÃO edita perfil de B', count(*)=0 from u;
with u as (update public.profiles set bio='oi' where id='00000000-0000-0000-0000-00000000000a' returning 1)
insert into r select 'A edita o próprio perfil', count(*)=1 from u;
insert into r select 'A NÃO lê auditoria', count(*)=0 from public.audit_logs;
insert into r select 'flags visíveis', count(*)=5 from public.feature_flags;

do $$ begin
  begin insert into public.user_roles(user_id, role) values ('00000000-0000-0000-0000-00000000000a','admin_super');
    insert into r values ('A NÃO se dá papel de admin', false);
  exception when others then insert into r values ('A NÃO se dá papel de admin', true); end;
  begin update public.profiles set id='00000000-0000-0000-0000-00000000000b' where id='00000000-0000-0000-0000-00000000000a';
    insert into r values ('A NÃO troca o id do perfil', false);
  exception when others then insert into r values ('A NÃO troca o id do perfil', true); end;
  begin insert into public.addresses(user_id, recipient, cep, street, number, district, city, state)
    values ('00000000-0000-0000-0000-00000000000b','X','01001000','Rua','1','Centro','São Paulo','SP');
    insert into r values ('A NÃO cria endereço para B', false);
  exception when others then insert into r values ('A NÃO cria endereço para B', true); end;
end $$;

insert into public.addresses(user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-00000000000a','Ana','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into r select 'A cria e vê o próprio endereço', count(*)=1 from public.addresses;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}',true);
insert into r select 'B NÃO vê endereço de A', count(*)=0 from public.addresses;
insert into r select 'B NÃO vê perfil de A', count(*)=0 from public.profiles where id='00000000-0000-0000-0000-00000000000a';

reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin
  begin perform 1 from public.profiles;
    insert into r values ('anônimo NÃO lê perfis', (select count(*) from public.profiles)=0);
  exception when others then insert into r values ('anônimo NÃO lê perfis', true); end;
  begin perform 1 from public.addresses;
    insert into r values ('anônimo NÃO lê endereços', (select count(*) from public.addresses)=0);
  exception when others then insert into r values ('anônimo NÃO lê endereços', true); end;
end $$;
insert into r select 'anônimo lê flags', count(*)=5 from public.feature_flags;
reset role;
select * from r;
rollback;
