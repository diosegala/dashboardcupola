

# Funil de Conversão do Site (GA4 Events)

## O que será feito

Buscar os eventos `page_view`, `view_item`, `add_to_cart`, `begin_checkout` e `purchase` do GA4, armazená-los no banco e exibir uma visualização em etapas com barras proporcionais (como no print de referência do GA4).

## Etapas

### 1. Nova tabela `ga4_events`

```sql
CREATE TABLE public.ga4_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  event_name text NOT NULL,
  event_count integer DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(date, event_name)
);

ALTER TABLE public.ga4_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ga4_events"
  ON public.ga4_events FOR SELECT TO authenticated USING (true);
```

### 2. Expandir `sync-google-analytics/index.ts`

Adicionar um novo `runReport` que busca:
- Dimensões: `date`, `eventName`
- Métrica: `eventCount`
- Filtro: apenas os 5 eventos de interesse

Upsert dos resultados na tabela `ga4_events`.

### 3. Novo hook `useGa4Events(range)` em `useDashboardData.ts`

Query simples à tabela `ga4_events` filtrando pelo período selecionado.

### 4. Novo componente `src/components/dashboard/charts/ConversionFunnelChart.tsx`

Visualização em etapas (como no print):
- 5 colunas lado a lado: page_view → view_item → add_to_cart → begin_checkout → purchase
- Cada coluna com uma barra proporcional ao total do evento
- Percentual de conversão entre etapas (ex: "33.8%" entre etapa 1 e 2)
- Taxa de abandono abaixo de cada barra
- Estilo similar ao print: barras azuis, labels de etapa no topo

### 5. Integrar no `MarketingSection.tsx`

Renderizar o `ConversionFunnelChart` na seção "Site (Google Analytics)", acima dos cards de métricas atuais.

### 6. Passar dados do `Index.tsx`

Adicionar `useGa4Events(range)` no Index e passar para MarketingSection.

