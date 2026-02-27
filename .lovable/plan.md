

# Implementar Pagina de Metas

## Resumo
Transformar a pagina placeholder `/goals` em uma interface completa de CRUD para gerenciar metas. As metricas disponiveis serao exatamente aquelas usadas no Dashboard, com labels claros. Admins podem criar, editar e excluir metas. Viewers podem apenas visualizar.

## Metricas disponiveis

As opcoes do select de metrica serao derivadas diretamente dos `metric_key` usados no Dashboard:

| metric_key | Label | Categoria |
|---|---|---|
| tickets_sold | Ingressos Vendidos | Vendas |
| revenue | Receita (R$) | Vendas |
| meta_impressions | Impressoes (Meta Ads) | Marketing |
| meta_clicks | Cliques (Meta Ads) | Marketing |
| google_impressions | Impressoes (Google Ads) | Marketing |
| google_clicks | Cliques (Google Ads) | Marketing |
| email_open_rate | Taxa de Abertura (RD Station) | Marketing |
| email_click_rate | Taxa de Clique (RD Station) | Marketing |
| leads | Leads / Cliques em E-mail | Marketing |
| site_visits | Sessoes do Site (GA) | Marketing |

Essas 10 opcoes serao apresentadas agrupadas por categoria no select.

## Funcionalidades

### Lista de metas
- Tabela com colunas: Label, Metrica, Valor-alvo, Periodo, Status
- Badge colorido: verde (ativa), cinza (expirada), azul (futura)
- Barra de progresso visual (valor atual vs meta) -- calculado a partir dos dados do dashboard quando a meta esta ativa
- Botoes de editar e excluir visiveis apenas para admins

### Formulario de criacao/edicao (apenas admins)
- Dialog modal com campos:
  - **Label**: nome descritivo (ex: "Ingressos Q1")
  - **Metrica**: select com as 10 opcoes acima, agrupadas por categoria
  - **Valor-alvo**: campo numerico
  - **Periodo inicio e fim**: date pickers
- Validacao com zod
- Mutation de insert/update com invalidacao do cache

### Exclusao (apenas admins)
- Botao de excluir com confirmacao via AlertDialog
- Mutation de delete com invalidacao do cache

## Detalhes tecnicos

### `src/pages/Goals.tsx`
- Reescrever completamente o placeholder atual
- Usar `useGoals` existente para listar
- Criar mutations (`useMutation`) para insert, update e delete na tabela `goals`
- Usar `useAuth` para condicionar botoes de criar/editar/excluir a `isAdmin`
- Mapa constante `METRIC_OPTIONS` com as 10 metricas e seus labels/categorias
- `created_by` preenchido com `user.id` no insert

### Componentes utilizados
- `Table` para listagem
- `Dialog` para formulario de criacao/edicao
- `AlertDialog` para confirmacao de exclusao
- `Select`, `Input`, `Label`, `Button`, `Badge` do shadcn
- `Calendar` / Popover para selecao de datas
- `Progress` para barra de progresso

### Sem mudancas no banco
A tabela `goals` ja existe com a estrutura correta (`id`, `label`, `metric_key`, `target_value`, `period_start`, `period_end`, `created_by`, `created_at`, `updated_at`) e as RLS policies ja permitem admins gerenciarem e viewers visualizarem.

