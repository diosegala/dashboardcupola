

# Tabela de Totais — Geração de Demanda (Site)

## O que será feito

Exibir uma tabela simples com os totais dos eventos `add_to_cart`, `botao_sympla`, `botao_tabela` e `mais_infos_tp_mobile` na seção de Marketing, como uma sub-seção "Geração de Demanda — Site".

## Etapas

### 1. Expandir o sync do GA4

No `sync-google-analytics/index.ts`, adicionar `botao_sympla`, `botao_tabela` e `mais_infos_tp_mobile` à lista `funnelEventNames` (ou criar uma segunda lista dedicada). Assim esses eventos customizados serão buscados e salvos na tabela `ga4_events` que já existe.

### 2. Novo componente `DemandGenTable.tsx`

Criar `src/components/dashboard/charts/DemandGenTable.tsx`:
- Recebe `ga4Events: any[]`
- Filtra pelos 4 eventos de interesse
- Exibe uma tabela com 2 colunas: Evento | Total
- Labels amigáveis: "Add to Cart", "Botão Sympla", "Botão Tabela", "Mais Infos TP (Mobile)"
- Usa os componentes `Table` já existentes no projeto

### 3. Integrar no `MarketingSection.tsx`

Adicionar o `DemandGenTable` na seção "Site (Google Analytics)", abaixo do funil de conversão e acima dos cards de métricas.

### Não é necessário

- Criar tabela nova no banco (reutiliza `ga4_events`)
- Alterar hooks (o `useGa4Events` já busca todos os eventos do período)
- Alterar `Index.tsx` (os dados já são passados)

