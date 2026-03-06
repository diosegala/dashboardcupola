

# Comparação Ano a Ano de Vendas de Ingressos

## Abordagem recomendada

A tabela `ticket_sales` já possui a coluna `event_id`, então podemos armazenar os dados de ambos os eventos na mesma tabela e comparar por semana relativa (Semana 1, Semana 2, etc.) desde o início das vendas de cada evento.

## Etapas

### 1. Importar dados do evento do ano passado

Atualizar a edge function `sync-sympla` para aceitar um `event_id` opcional no body da request. Se recebido, usa esse ID em vez do padrão. Assim, basta chamar a função uma vez passando o ID do evento anterior para importar os dados históricos.

Alternativa mais simples: criar um botão na página de Integrações para "Importar evento anterior" onde o usuário cola o ID do evento passado e dispara o sync.

### 2. Novo componente de comparação ano a ano

Criar `src/components/dashboard/charts/YearOverYearChart.tsx`:

- Receber todos os tickets (sem filtro de data) de ambos os eventos
- Agrupar por **semana relativa** a partir da primeira venda de cada evento (Semana 1 = primeira semana de vendas)
- Exibir um `LineChart` com duas linhas: uma para cada evento/ano
- Acumulado semanal de ingressos vendidos

```text
┌─ Comparação Ano a Ano ─────────────────────────┐
│                                                  │
│  📈 Linha azul: 2026 (evento atual)              │
│  📈 Linha cinza: 2025 (evento anterior)          │
│                                                  │
│  Eixo X: Semana 1, Semana 2, ...                │
│  Eixo Y: Ingressos vendidos (acumulado)          │
└──────────────────────────────────────────────────┘
```

### 3. Configuração do evento anterior

Adicionar um secret `SYMPLA_PREVIOUS_EVENT_ID` para armazenar o ID do evento do ano passado OU salvar como campo nas credenciais da integração Sympla (campo `previous_event_id`). Prefiro a segunda opção pois fica editável pela UI.

### 4. Hook de dados

Criar `useTicketSalesAllEvents()` que busca todos os tickets sem filtro de data, retornando dados de ambos os `event_id`s. O componente separa por `event_id` no frontend.

### 5. Integração no Dashboard

Adicionar o gráfico comparativo na `SalesSection`, abaixo dos gráficos existentes.

## Arquivos afetados

- `supabase/functions/sync-sympla/index.ts` (aceitar event_id no body)
- `src/hooks/useDashboardData.ts` (novo hook para buscar todos os eventos)
- `src/components/dashboard/charts/YearOverYearChart.tsx` (novo)
- `src/components/dashboard/SalesSection.tsx` (adicionar o gráfico)
- `src/pages/Integrations.tsx` ou `src/components/integrations/CredentialsForm.tsx` (campo para ID do evento anterior)

