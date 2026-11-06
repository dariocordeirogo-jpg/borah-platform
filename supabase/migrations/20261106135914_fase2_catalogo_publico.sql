-- A política de leitura de produtos é avaliada também para visitantes (anon).
-- private.my_store_id() devolve null para quem não está logado, então é seguro liberar a execução.
grant execute on function private.my_store_id() to anon;
