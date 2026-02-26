
# Filtro por Campanha no Dashboard de Marketing

## Resumo
Adicionar um seletor de campanhas na secao de Marketing do dashboard, permitindo filtrar todas as metricas e graficos por uma ou mais campanhas ativas do Meta Ads. Atualmente existem 19 campanhas distintas no banco de dados.

## O que muda para o usuario
- Um novo dropdown "Todas as campanhas" aparecera acima dos cards de Meta Ads
- Ao selecionar uma ou mais campanhas, os cards de metricas (impressoes, cliques, gasto, CTR) e o grafico "Cliques por Dia" serao filtrados para mostrar apenas dados daquelas campanhas
- Opcao "Todas as campanhas" para voltar a visao consolidada

## Etapas

### 1. Criar componente CampaignFilter
Novo arquivo: `src/components/dashboard/CampaignFilter.tsx`
- Dropdown multi-select usando Popover + Checkbox (componentes ja disponiveis no projeto)
- Recebe lista de campanhas disponiveis (extraidas dos dados ja carregados em `adMetrics`)
- Retorna array de `campaign_id` selecionados (ou vazio = todas)

### 2. Atualizar MarketingSection
- Adicionar estado `selectedCampaigns` (array de campaign_id)
- Extrair lista unica de campanhas a partir de `adMetrics` (campo `campaign_name` + `campaign_id`)
- Renderizar o `CampaignFilter` ao lado do titulo "Marketing"
- Filtrar `adMetrics` pelos campaign_ids selecionados antes de calcular totais e passar para os graficos
- O filtro se aplica somente a secao Meta Ads (e ao grafico de cliques para a linha Meta)

### 3. Nenhuma mudanca no backend
Os dados de `campaign_id` e `campaign_name` ja sao sincronizados e armazenados na tabela `ad_metrics`. O filtro sera 100% no frontend, usando os dados ja carregados.

## Detalhes tecnicos

- O filtro opera sobre os dados ja em memoria (array `adMetrics`), sem queries adicionais ao banco
- Campanhas serao listadas em ordem alfabetica com o nome da campanha como label
- Quando nenhuma campanha esta selecionada, o comportamento e identico ao atual (mostra tudo)
- O componente usara `Popover` + `Command` (cmdk) para permitir busca rapida entre as campanhas, dado que ha muitas (19+)
