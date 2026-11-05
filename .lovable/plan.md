# Ajustes finais das funções do Pipedrive

Mantido como está (não refazer nem desfazer): remoção da chave de `copied_from_event_id`, coluna `product_code`, tabela `deal_product_value_history` e suas regras, regra `crm_sync_state_normaliza`, carga inicial, dados do CRM, testes já corrigidos e arquivos da página Patrocínios. Nenhuma tabela será alterada e a sincronização não será rodada manualmente.

## Passos

1. **Chamadas sem login** — em `supabase/config.toml`, adicionar `[functions.sync-pipedrive]`, `[functions.pipedrive-webhook]` e `[functions.list-crm-options]` com `verify_jwt = false`.
2. **Data sem milissegundos** — em `sync-pipedrive/index.ts`, montar `work.since` com `.toISOString().replace(/\.\d{3}Z$/, 'Z')` na carga e no incremental.
3. **Páginas menores** — pedir `limit: 100` na busca de `/api/v2/deals` e chamar `guard()` dentro do laço que grava cada negócio, salvando o ponto antes de parar.
4. **Tirar as pendências** — remover chamada e import de `avaliarPendencias` em `sync-pipedrive` e `pipedrive-webhook`; apagar `avaliarPendencias` em `_shared/pipedrive.ts` e `pendingCandidates`/`inWindow` em `_shared/pipedrive-rules.ts`; tirar os testes correspondentes de `src/test/pipedrive.test.ts`. A tabela `sponsorship_pending` fica.
5. **Tipos** — regenerar `types.ts` pela ferramenta oficial do Lovable (que lê o banco atual e já traz `product_code` e `deal_product_value_history`), em vez de editar à mão, pois o arquivo é gerado automaticamente.
6. **Publicar** as três funções e rodar o checador de tipos e os testes; informar o resultado.
7. **Webhook** — abrir a tela segura para `PIPEDRIVE_WEBHOOK_USER` e `PIPEDRIVE_WEBHOOK_PASSWORD` e informar o endereço final `.../functions/v1/pipedrive-webhook?conta=cupola`. A conferência de `meta.entity` (deal, deal_product, deal_installment, product, stage, pipeline, organization, lead) será feita nos registros da função depois da primeira chamada real do Pipedrive.
8. **Agendamento de 15 minutos** (96 chamadas por dia por conta) — criar o job `sync-pipedrive-15min`: a cada execução, para cada conta de `sponsorship_config`, lê o token da conta naquele momento, assina `conta:horário` com HMAC-SHA256 como `authorize` espera e chama `sync-pipedrive`. Depois, informar o resultado de `select jobname, schedule, active from cron.job;`.

## Detalhes técnicos

- Antes do passo 8, ler `authorize` em `_shared/pipedrive.ts` para reproduzir exatamente cabeçalhos, formato do horário e origem do token (usando `pgcrypto` `hmac()` dentro do job). Se o token ainda não estiver salvo para alguma conta, o job pula essa conta e eu aviso.
- O job é criado por SQL direto (não por migração), pois contém o endereço do projeto.
