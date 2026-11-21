# Logs de atividade (só admin)

Você pediu para ver o modelo antes do código. Abaixo estão a tabela, as tabelas com gatilho e como o ator é capturado em cada origem. Depois que você aprovar, eu implemento e provo os 10 critérios de aceite.

## 1. Modelo final

**`logs_atividade`**: igual ao seu modelo, com três campos a mais:
- `actor_processo text`: nome do processo quando não há pessoa (ex.: `sync_sympla`).
- `actor_removido boolean`: vira verdadeiro na hora da exclusão da pessoa. É o único UPDATE permitido, feito só pela própria função de exclusão, nunca pela API.
- `qtd_linhas integer`: usado nos resumos de sincronização (veja a seção 2).

Índices: exatamente os que você listou, mais um de busca em `entidade_rotulo` e `actor_email`.

**`logs_auditoria_erros`**: registra quando o próprio log falhou (tabela, ação, mensagem, quando). Também é só leitura para admin. Quando tiver linhas, aparece um aviso no topo da tela Logs.

**`auditoria_tabelas`**: cadastro de cada tabela auditada. Guarda o modo (linha ou resumo), a coluna do nome legível, a coluna do evento e os campos de controle ignorados. Assim, o comportamento muda sem precisar mexer na função.

**Proteção (regra 2):**
- RLS ligado e SELECT só para `is_admin()`.
- Nenhuma política de INSERT, UPDATE ou DELETE.
- `REVOKE insert, update, delete, truncate` para `anon` e `authenticated`. Se o admin tentar apagar pela API, recebe erro de permissão.

**Datas:** gravadas em UTC (`timestamptz`) e mostradas no horário de Brasília.

**Campos sensíveis:** token, chave, segredo, senha e todo o conteúdo de `credentials`. Fica gravado o nome do campo com o valor `"•••• (alterado)"`, nunca o valor real.

## 2. Tabelas que recebem o gatilho

Todas as 35 tabelas do painel recebem o gatilho, sem exceção. Elas se dividem em dois modos, porque as sincronizações reescrevem milhões de linhas: só `ticket_sales` já teve 65 milhões de atualizações. Registrar linha a linha soterraria o log.

**Modo linha** (cada criação, edição ou exclusão vira um registro com antes e depois):
- **Eventos:** events, event_batches (lotes), event_integrations.
- **Usuários e permissões:** profiles, user_roles, event_users, user_event_scope, user_imports.
  - Os registros de permissão ganham destaque.
  - Hoje não existe tabela de "permissões por página". Quando ela for criada, entra neste grupo.
- **Integrações e credenciais:** integrations.
  - Ficam ignoradas as mudanças só de controle (`last_synced_at`, `sync_status` indo de "sincronizando" para "ok"). Elas acontecem a cada 15 minutos.
  - A passagem para "erro" vira o registro `integracao.falhou`.
- **Metas:** goals.
- **Cupons:** coupon_people, team_coupons (antiga).
- **Patrocínios:** sponsorship_config, sponsorship_pending.
- **Configurações:** email_sale_links, app_secrets (sempre mascarada).

**Modo resumo** (uma linha por gravação, como "Sympla sincronizou ingressos: 12 novos, 3 alterados, 1 removido"):
- Valem para ticket_sales, ticket_sales_details, ad_metrics, ga4_events, site_analytics, email_campaigns, deals, deal_products, deal_installments, deal_stage_history, deal_product_value_history, crm_leads, crm_organizations, crm_pipelines, crm_stages, crm_products, crm_users, crm_sync_state e event_history.
- Gravação que não mudou nada não gera linha.
- Os registros removidos guardam o conteúdo anterior completo, como pede a regra 4.

**Tabela nova sem lacuna** (três travas):
1. **No banco:** uma trava automática liga o gatilho de auditoria em qualquer tabela nova assim que ela é criada. Ela entra em modo linha até ser classificada.
2. **Função de verificação:** `tabelas_sem_auditoria()` lista as tabelas sem gatilho. O aviso no topo da tela Logs usa essa lista.
3. **No build do painel:** uma checagem confere se todo `CREATE TABLE public.*` nas migrações tem o gatilho na mesma migração. Se não tiver, o build falha e não sobe.

## 3. Como o ator é capturado em cada origem

Em todas as origens, a função de auditoria copia **na própria linha** o nome, o e-mail e o papel daquele instante, lidos de `profiles`, das contas e de `user_roles`. A tela lê só o log, nunca cruza com a lista de usuários.

| Origem | Como identifica | `actor_origem` |
|---|---|---|
| Pessoa logada no painel | `sub` do JWT; IP e navegador vêm dos cabeçalhos da requisição | `painel` |
| Funções do servidor agindo por um admin (convite, edição e exclusão de usuário) | A função confere o admin e envia `x-actor-id`. O banco só aceita esse cabeçalho de quem usa a chave de serviço, então ninguém consegue se passar por outro | `painel` |
| Sincronizações (Sympla, Meta, Google Ads, GA, RD, Pipedrive, webhook) | Cada função envia `x-actor-processo`, ex.: `sync_sympla` ou `pipedrive_webhook` | `integracao` |
| Tarefas agendadas e SQL direto | Sem JWT nem cabeçalho. O processo é lido de `app.actor_processo` ou do nome da conexão | `sistema` |
| Nada identificado | `actor_processo = 'desconhecido'` e um registro em `logs_auditoria_erros`. Nunca fica vazio sem explicação | `sistema` |

## 4. O que não nasce de tabela

O sistema de login fica fora do banco do painel e o histórico interno dele está vazio. Por isso, alguns registros entram por uma função própria, `registrar_atividade`, que roda no banco e confere quem chama. Nenhuma tela grava direto na tabela.

- **Login, logout, troca de senha e convite aceito:** chamados pelo controle de sessão, um ponto único do app, e não por cada tela.
- **Falha de login:** registrada com o e-mail digitado. Fica marcada como "não confirmado", porque vem de quem ainda não entrou. Tem limite de repetição contra abuso.
- **Convite enviado e link de senha:** registrados pelo servidor, nas funções de convite.
- **Acesso negado a tela de admin:** registrado pela proteção de rotas, também um ponto único.
- **Ação que falhou (regra 6.7):** quando uma gravação é recusada, o banco desfaz tudo, inclusive o log. Por isso:
  - As funções do servidor registram a falha com resultado "erro".
  - No painel, um único "ouvinte" de erros em todas as gravações registra a tentativa com a mensagem.
- **Exportação do log:** sai do servidor, que gera o arquivo e grava `log.exportado` antes de devolver.
- **Se o log falhar:** a função de auditoria trata o erro, grava em `logs_auditoria_erros` e deixa a operação principal seguir.

## 5. Exclusão de pessoa (regra 4)

Hoje a exclusão bloqueia o login e apaga perfil, função e eventos. Muda para:
- **Perfil preservado:** o perfil ganha `deleted_at` e continua existindo.
- **Acesso cortado na hora:** função e eventos são removidos, o login fica bloqueado e a conta não é mais apagada. Sem função, ninguém entra, como já é hoje.
- **Registro da exclusão:** gera `usuario.excluido` com o conteúdo anterior completo e quem excluiu.
- **Selo:** marca `actor_removido = true` nos registros antigos da pessoa, para o selo "acesso removido" aparecer.
- **Filtro de pessoas:** sai do próprio log, em dois grupos, Ativos e Removidos.
- **Rebaixar o próprio papel:** continua bloqueado, como hoje. Se quiser liberar com confirmação, faço e registro.

## 6. A tela Logs

- **Acesso:** menu e rota só para admin. Quem não é admin é redirecionado e a tentativa é registrada. O banco também bloqueia.
- **Layout:**
  - Faixa com 4 números: total, exclusões, mudanças de permissão e falhas.
  - Barra de filtros com chips: período (hoje, 7 dias, 30 dias, personalizado), pessoa, papel, categoria, tela, evento, resultado e busca. Os filtros ficam no endereço da página, para mandar o link a outro admin.
  - Contagem de resultados e exportação em CSV.
- **Lista:** colunas Quando, Quem, Ação (com cor e verbo), Onde, Evento e Resumo. Paginação por cursor (`ocorrido_em`, `id`).
- **Painel lateral:**
  - Cabeçalho com quem, quando, origem e IP.
  - Antes e depois lado a lado, só com os campos alterados e os nomes em português.
  - Botões "Ver a vida deste registro" e "Ver tudo desta pessoa".
- **Três estados separados:** carregando; sem resultado para os filtros; falhou ao carregar, com a mensagem e o botão "Tentar de novo".
- **Ao vivo:** registro novo aparece no topo com o selo "novo". Também mostra "atualizado há X" e o botão atualizar. O cache é por filtro e não fica guardado para sempre.

## Detalhes técnicos

- **Migração única:**
  - Tabelas, índices e grants.
  - `is_admin()`.
  - Função `auditar()` (SECURITY DEFINER, com `EXCEPTION`): por linha nas tabelas de modo linha, por comando com tabelas de transição nas de modo resumo.
  - `registrar_atividade()`, `tabelas_sem_auditoria()` e `exportar_logs()`.
  - A trava automática para tabela nova (`ddl_command_end`).
  - `profiles.deleted_at` e o aviso ao vivo do log.
- **Funções do servidor:** `manage-user`, `invite-user` e as 7 de sincronização passam a mandar os cabeçalhos de ator. `manage-user` também ganha a exclusão lógica.
- **No app:**
  - Rota `/logs`, item no menu e `src/lib/activityLog.ts` (regras puras e nomes de campos em português, com testes).
  - Ouvinte único de falhas no cliente de dados.
  - Registro de login e logout no controle de sessão.
  - Checagem de migrações no build.
- **Regras novas no `AGENTS.md`:** log nasce no banco; tabela nova exige gatilho; a tela lê só o log.
