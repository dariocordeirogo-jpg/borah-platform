# Lançamento — checklist da Fase 10

O código está pronto para homologação. **Nada aqui foi publicado em produção**: deploy, chaves reais e
limpeza de dados só acontecem com autorização explícita do dono do projeto. Marque cada item quando estiver feito.

## 1. Decisões e documentos (dono do projeto)

- [ ] Parecer jurídico sobre os leilões (profissão de leiloeiro) e sobre o programa de indicação.
- [ ] Termos de uso e Política de privacidade revisados por advogado (hoje são rascunhos em `/termos` e `/privacidade`).
- [ ] Encarregado de dados (DPO) nomeado e canal de contato publicado na Política de privacidade.
- [ ] Quem paga as comissões de indicação e como (saque, crédito) — hoje só ficam registradas.
- [x] Serviço de transmissão das lives: Mux integrado (ver [LIVE.md](LIVE.md)).
- [ ] Token do Mux válido (`MUX_TOKEN_ID` / `MUX_TOKEN_SECRET`) na Vercel e teste de uma live real pelo OBS.

## 2. Contas e chaves (nunca no GitHub; só na Vercel e no Vault)

- [ ] Stripe: conta da plataforma ativa, Connect habilitado, **chave de teste** `sk_test_` para homologar.
  A chave `live` salva no ambiente de desenvolvimento deve ser removida de lá.
- [ ] Webhook da Stripe apontando para `https://livelance.com.br/api/webhooks/stripe`; segredo na Vercel e no Vault
  (`stripe_webhook_secret`) — ver [PAYMENTS.md](PAYMENTS.md).
- [ ] `ANTHROPIC_API_KEY` na Vercel (ver [AI.md](AI.md)) e flag `ai` ligada.
- [ ] Domínio `livelance.com.br`, projeto na Vercel e Supabase Auth configurados — ver [DEPLOYMENT.md](DEPLOYMENT.md).
- [ ] SMTP próprio no Supabase Auth e proteção contra senhas vazadas ligada.

## 3. Homologação (com chave de teste)

- [ ] Loja real de teste cadastra a conta de recebimento na Stripe (modo teste) e fica apta a receber.
- [ ] Compra com cartão de teste: pedido vira "pago", comissão de 10% aparece, loja vê o repasse.
- [ ] Pix e boleto de teste: pedido fica "processando" e depois "pago" pelo webhook.
- [ ] Reembolso pelo painel da Stripe: pagamento marcado como reembolsado e comissão de indicação conferida.
- [ ] Leilão completo: lances, prorrogação, encerramento, arremate pago.
- [ ] Live com URL HLS real: chat, produto em destaque e leilão relâmpago.
- [ ] Recursos de IA com a chave: descrição, busca inteligente, triagem de denúncia.
- [ ] `GET /api/health` responde `ok: true` com `stripe: true` e `ai: true`.
- [ ] Rodar `supabase/tests/*.sql` (todos devem terminar sem erro) e a suíte e2e contra o ambiente de homologação.

## 4. Antes de abrir ao público

- [ ] Rodar `supabase/manual/limpar-dados-de-teste.sql` (termina em ROLLBACK; conferir e trocar por COMMIT)
  e apagar as pastas das lojas de teste no Storage.
- [ ] Dar o papel de admin à conta do dono (SQL em [DATABASE.md](DATABASE.md)).
- [ ] `NEXT_PUBLIC_SITE_URL=https://livelance.com.br` na Vercel (libera indexação e troca o aviso do rodapé).
- [ ] Ligar a flag `payments` e trocar para a chave `sk_live_` — **só com autorização explícita**.
- [ ] Monitor externo (ex.: UptimeRobot) em `https://livelance.com.br/api/health`.
- [ ] Backups: confirmar o plano do Supabase com backup diário (PITR se possível).

## 5. Depois do lançamento (escala)

- Consolidar as políticas RLS permissivas duplicadas apontadas pelo advisor de performance (8 avisos), com teste de RLS.
- Revisar índices não usados após algumas semanas de tráfego real.
- [x] Cupons da loja (ver docs/ROADMAP.md).
- [x] Frete por tabela no formato PAC/SEDEX (ver [SHIPPING.md](SHIPPING.md)); trocar pela API dos Correios quando houver contrato.
- [ ] Revisar os valores da tabela de frete em /admin/frete.
- SMS de verificação de telefone, e-mails de pedido.

## O que a Fase 10 já entregou no código

- Rodapé: "versão de testes" fora do domínio oficial; texto institucional só com `NEXT_PUBLIC_SITE_URL` de produção.
- Cabeçalhos de segurança: HSTS (2 anos, preload), COOP, além dos que já existiam.
- `GET /api/health`: banco, latência e quais integrações estão configuradas (sem expor segredo).
- Índices nas chaves estrangeiras `lives.pinned_product_id` e `reports.resolved_by`.
- CI no GitHub Actions: lint, tipos, testes unitários e build a cada PR.
- Rascunhos completos de Termos e Privacidade (LGPD) refletindo o que o sistema faz.
- Script de limpeza dos dados de teste (não executado).
