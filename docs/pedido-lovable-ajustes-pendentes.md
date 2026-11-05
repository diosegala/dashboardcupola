# Pedido ao Lovable: o que ainda falta no Pipedrive (atualizado em 05/11/2026)

**Já aplicado pelo Lovable em 05/11/2026** (commit "Agendou 96 execuções/dia"): os itens 1 a 7 do texto anterior. Falta só o pedido abaixo.

Tudo o que dava foi resolvido sem o Lovable, por SQL e pelo código do painel. Este é o único texto a colar.

## Texto para colar

Preciso de mais um ajuste na função de sincronização do Pipedrive, sem mudar tabelas e sem desfazer nada do que já foi feito:

1. **Canal de origem do negócio:** em `CrmWriter.deal` (`supabase/functions/_shared/pipedrive.ts`), guarde também os campos padrão do Pipedrive `channel` (Canal de origem), `channel_id` (ID do canal de origem) e `origin` (Origem) dentro de `custom_fields`, com as chaves `__channel`, `__channel_id` e `__origin`. Hoje só os campos personalizados são guardados, e o painel precisa do canal para mostrar a prospecção por canal.
2. Depois de publicar a função, rode uma vez a busca completa dos negócios do funil de patrocínio para preencher esses campos nos negócios que já existem (sem apagar nada) e me diga quantos negócios ficaram com `__channel` preenchido.

Rode os testes e me diga o resultado.

## Histórico (já aplicado)



Preciso de ajustes nas funções do Pipedrive. Antes, o que já está feito e **não deve ser refeito nem desfeito**:

- Já rodei por SQL: a remoção da chave `sponsorship_config_copied_from_event_id_fkey` (a coluna `copied_from_event_id` continua; não recrie a chave, ela causava o erro PGRST201), a coluna `sponsorship_config.product_code`, a tabela `deal_product_value_history` com as regras `deal_products_guarda_valor` e `deal_products_guarda_remocao`, e a regra `crm_sync_state_normaliza` na tabela `crm_sync_state`. Mantenha todas.
- A carga inicial dos negócios já foi feita. Não rode carga completa nem apague dados das tabelas do CRM.
- Os testes de `src/test/pipedrive.test.ts` e o `Object.hasOwn` você já corrigiu.
- Não mexa nos arquivos de `src/` da página Patrocínios.

O que falta, sem mudar tabelas:

1. **Chamadas sem login de usuário:** em `supabase/config.toml`, adicione `[functions.sync-pipedrive]`, `[functions.pipedrive-webhook]` e `[functions.list-crm-options]`, cada uma com `verify_jwt = false`, como as outras funções do projeto. As próprias funções já validam quem chama.
2. **Agendamento de 15 minutos:** crie o job que chama `sync-pipedrive` a cada 15 minutos, uma chamada por conta de `sponsorship_config`, assinada como a função `authorize` espera (HMAC-SHA256 de `conta:horário`, com o token da conta lido no momento da chamada). Me diga o nome do job e o resultado de `select jobname, schedule, active from cron.job;`.
3. **Webhook:** peça os valores de `PIPEDRIVE_WEBHOOK_USER` e `PIPEDRIVE_WEBHOOK_PASSWORD` pela tela de segredos (eu digito lá) e me passe o endereço final do webhook com `?conta=cupola`, para eu cadastrar no Pipedrive. Na primeira chamada real, confira se `meta.entity` chega como `deal`, `deal_product`, `deal_installment`, `product`, `stage`, `pipeline`, `organization` e `lead`.
4. **Data sem milissegundos:** em `sync-pipedrive/index.ts`, monte `work.since` sem milissegundos (`...toISOString().replace(/\.\d{3}Z$/, 'Z')`), na carga e no incremental. O Pipedrive responde 400 com `.000Z`.
5. **Páginas menores de negócios:** a função grava um negócio por vez e o servidor corta em 150 segundos. Peça `limit: 100` na busca de `/api/v2/deals` ou chame `guard()` dentro do laço que grava cada negócio, guardando o ponto antes de parar.
6. **Tirar as pendências:** em `sync-pipedrive` e `pipedrive-webhook`, remova a chamada e o import de `avaliarPendencias`; apague `avaliarPendencias` em `_shared/pipedrive.ts` e `pendingCandidates`/`inWindow` em `_shared/pipedrive-rules.ts`, ajustando os testes. Não apague a tabela `sponsorship_pending`.
7. **Tipos:** atualize `src/integrations/supabase/types.ts` com a coluna `product_code` e a tabela `deal_product_value_history`.

Depois, rode `npx tsc -p tsconfig.app.json --noEmit` e os testes e me diga o resultado. Não rode a sincronização manualmente.
