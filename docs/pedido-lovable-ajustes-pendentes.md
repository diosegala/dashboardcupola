# Ajustes nas funções do Pipedrive (texto final para colar no chat do Lovable)

Revisado em 05/11/2026. A fila de pendências saiu do produto: a página Patrocínios é só leitura de números.
O antigo item 5 (`Object.hasOwn`) ficava dentro da avaliação de pendências e some junto com ela.

**Sem créditos no Lovable?** Os itens 0 e 6 saem pelo arquivo `docs/sql-patrocinios-desbloqueio.sql` (já rodado), e a carga inicial da sincronização sai com `docs/sql-patrocinios-sincronizacao.sql`, rodado no editor SQL. Só com ele já dá para ler a conta e sincronizar pelo botão do card Pipedrive. Os demais itens servem para a atualização automática (agendamento e webhook) e a limpeza do código, e podem esperar. Quando colar o texto abaixo depois do SQL, tire os itens 0 e 6. O item 8 continua necessário: sem ele, as atualizações seguintes à carga inicial voltam a dar erro 400.

## Para pedir depois (quando houver créditos)

Hoje o painel já funciona sem estes itens: a carga inicial entrou por SQL, a sincronização segue com a regra do banco
(`docs/sql-patrocinios-sincronizacao-continua.sql`) e o painel aberto por um admin atualiza a cada 15 minutos.
O que só o Lovable destrava, por ordem de importância:

1. **Tempo real:** itens 1 (verify_jwt) e 3 (segredos e endereço do webhook). Com eles, a mudança feita no Pipedrive aparece no painel em segundos.
2. **Atualização sem ninguém com o painel aberto:** item 2 (agendamento de 15 minutos no servidor).
3. **Código da sincronização:** itens 8 (data sem milissegundos) e 9 (páginas menores). A regra do banco e a carga por SQL contornam os dois hoje.
4. **Limpeza:** itens 4 (pendências) e 5 (testes). Não afetam o que aparece no painel.

Itens 0 e 6 já foram resolvidos por SQL e saem do texto.

## Texto para colar

Revisei as funções do Pipedrive que você criou. Faltam estes ajustes. A fila de pendências saiu do produto: a tabela `sponsorship_pending` fica no banco, sem uso, e nada mais grava nela.

0. **Erro que trava tudo (urgente):** ao clicar em "Ler a conta do Pipedrive", a função responde "Não foi possível gravar ou ler os dados do CRM (PGRST201)". Em `supabase/functions/_shared/pipedrive.ts`, a função `configsFor` faz `select('*, events!inner(id,name,end_date,is_active)')`, mas `sponsorship_config` tem duas chaves para `events` (`event_id` e `copied_from_event_id`), e o banco não sabe qual usar. Troque por `events!sponsorship_config_event_id_fkey!inner(id,name,end_date,is_active)` e procure o mesmo padrão em `list-crm-options`, `sync-pipedrive` e `pipedrive-webhook`. Depois clique você mesmo em "Ler a conta" para confirmar.
1. **`supabase/config.toml`:** adicione `[functions.sync-pipedrive]`, `[functions.pipedrive-webhook]` e `[functions.list-crm-options]`, cada uma com `verify_jwt = false`, como as outras funções do projeto. O webhook do Pipedrive e a chamada agendada não levam token de usuário, e as próprias funções já validam quem chama. Sem isso, o gateway recusa as chamadas antes de a função rodar.
2. **Agendamento de 15 minutos:** confirme se o job existe (`select jobname, schedule, active from cron.job;`), com uma chamada por conta de `sponsorship_config`, assinada como a função `authorize` espera (HMAC-SHA256 de `conta:horário`, com o token da conta lido no momento da chamada). Me diga o nome do job e o resultado da consulta.
3. **Segredos do webhook:** peça os valores de `PIPEDRIVE_WEBHOOK_USER` e `PIPEDRIVE_WEBHOOK_PASSWORD` pela tela de segredos (eu digito lá), e me passe o endereço final do webhook com `?conta=<domínio>`.
4. **Tirar as pendências da sincronização:** em `sync-pipedrive` e em `pipedrive-webhook`, remova a chamada e o import de `avaliarPendencias` e o campo `pendencias_abertas` da resposta. Em `supabase/functions/_shared/pipedrive.ts`, apague `avaliarPendencias`; em `_shared/pipedrive-rules.ts`, apague `pendingCandidates` e `inWindow` (com isso sai também o `Object.hasOwn` que o `tsc` recusava). Ajuste `src/test/pipedrive.test.ts` se algum teste usar essas funções. Não apague a tabela.
5. **Testes:** `src/test/pipedrive.test.ts` tem 6 falhas no ambiente de teste do navegador (jsdom): o cliente captura um erro ao chamar `AbortSignal.timeout`, que não existe ali, e devolve "Não foi possível conectar ao Pipedrive". Faça o cliente funcionar nos dois ambientes (por exemplo, `AbortController` com `setTimeout`) ou rode esses testes em ambiente Node. Rode a suíte inteira e o `npx tsc -p tsconfig.app.json --noEmit` e me diga o resultado.
6. **Código do produto na configuração:** adicione a coluna `product_code text` (pode ser nula) em `public.sponsorship_config`, sem mudar as políticas. Ela guarda o código que marca a venda de patrocínio (no Summit, "B2B"): conta como venda do evento o produto com o termo no nome **e** esse código. Na `sync-pipedrive`, o filtro de produtos do catálogo (`matchesTerm`) pode continuar como está; quem aplica o código é a página. Atualize os tipos gerados.
8. **Data do "atualizados desde" sem milissegundos (trava a sincronização):** o Pipedrive respondeu 400 ao buscar negócios com `updated_since=2025-05-05T00:00:00.000Z`; ele aceita só `2025-05-05T00:00:00Z`. Em `sync-pipedrive/index.ts`, formate `work.since` sem os milissegundos (por exemplo `new Date(...).toISOString().replace(/\.\d{3}Z$/, 'Z')`), tanto na carga inicial quanto no incremental a partir de `cursors.deals`. Confira se outras chamadas com data têm o mesmo problema.
9. **Página de negócios grande demais para o tempo da função (trava a carga inicial):** o servidor corta a chamada em 150 segundos e a `sync-pipedrive` grava os negócios um por um (cerca de 230 por chamada), mas pede 500 por página e só guarda o ponto ao fim da página. Resultado: resposta 504 e a sincronização recomeça sempre na mesma página. Peça páginas menores na busca de negócios (por exemplo `limit: 100`) ou chame `guard()` dentro do laço que grava cada negócio, guardando o ponto antes de parar. Depois rode a carga desde 18 meses atrás para trazer a edição anterior inteira.
7. **Webhooks v2:** confira, na primeira chamada real, se `meta.entity` chega como `deal`, `deal_product`, `deal_installment`, `product`, `stage`, `pipeline`, `organization` e `lead`. Qualquer nome diferente hoje cai em "formato ignorado" e só aparece no log.

O token já está no card Pipedrive da tela Integrações. Depois dos ajustes, clique em "Ler a conta" na configuração do Summit 2027, rode uma sincronização manual pelo card Pipedrive e me diga quantos negócios, produtos e parcelas vieram.
